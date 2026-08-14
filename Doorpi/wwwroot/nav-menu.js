'use strict';

window.isNavMenuOpen = false;

(function () {

    // ── Dados Locais ──────────────────────────────────────────────────────────
    let _menuData = { user: {}, games: [], history: [], mediaHistory: [], media: [], emulators: [] };
    let _menuDataUserId = '';
    let _menuReloadToken = 0;
    let _profileSyncUi = { status: 'Disconnected', connected: false, busy: false, message: '' };

    // SVGs das Plataformas
    const PLATFORM_ICONS = {
        Steam: `<svg viewBox="0 0 24 24" fill="#1b9bd4" xmlns="http://www.w3.org/2000/svg"><path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.5 1.009 2.455-.397.957-1.497 1.41-2.454 1.012H7.54zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.663 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.265 2.265-1.253 0-2.265-1.014-2.265-2.265z"/></svg>`,
        Epic: `<svg viewBox="0 0 24 24" fill="#a0a0a0" xmlns="http://www.w3.org/2000/svg"><path d="M3.537 0C2.165 0 1.66.506 1.66 1.879V18.44a4.262 4.262 0 00.02.433c.031.3.037.59.316.92.027.033.311.245.311.245.153.075.258.13.43.2l8.335 3.491c.433.199.614.276.928.27h.002c.314.006.495-.071.928-.27l8.335-3.492c.172-.07.277-.124.43-.2 0 0 .284-.211.311-.243.28-.33.285-.621.316-.92a4.261 4.261 0 00.02-.434V1.879c0-1.373-.506-1.88-1.878-1.88zm13.366 3.11h.68c1.138 0 1.688.553 1.688 1.696v1.88h-1.374v-1.8c0-.369-.17-.54-.523-.54h-.235c-.367 0-.537.17-.537.539v5.81c0 .369.17.54.537.54h.262c.353 0 .523-.171.523-.54V8.619h1.373v2.143c0 1.144-.562 1.71-1.7 1.71h-.694c-1.138 0-1.7-.566-1.7-1.71V4.82c0-1.144.562-1.709 1.7-1.709zm-12.186.08h3.114v1.274H6.117v2.603h1.648v1.275H6.117v2.774h1.74v1.275h-3.14zm3.816 0h2.198c1.138 0 1.7.564 1.7 1.708v2.445c0 1.144-.562 1.71-1.7 1.71h-.799v3.338h-1.4zm4.53 0h1.4v9.201h-1.4zm-3.13 1.235v3.392h.575c.354 0 .523-.171.523-.54V4.965c0-.368-.17-.54-.523-.54zm-3.74 10.147a1.708 1.708 0 01.591.108 1.745 1.745 0 01.49.299l-.452.546a1.247 1.247 0 00-.308-.195.91.91 0 00-.363-.068.658.658 0 00-.28.06.703.703 0 00-.224.163.783.783 0 00-.151.243.799.799 0 00-.056.299v.008a.852.852 0 00.056.31.7.7 0 00.157.245.736.736 0 00.238.16.774.774 0 00.303.058.79.79 0 00.445-.116v-.339h-.548v-.565H7.37v1.255a2.019 2.019 0 01-.524.307 1.789 1.789 0 01-.683.123 1.642 1.642 0 01-.602-.107 1.46 1.46 0 01-.478-.3 1.371 1.371 0 01-.318-.455 1.438 1.438 0 01-.115-.58v-.008a1.426 1.426 0 01.113-.57 1.449 1.449 0 01.312-.46 1.418 1.418 0 01.474-.309 1.58 1.58 0 01.598-.111 1.708 1.708 0 01.045 0zm11.963.008a2.006 2.006 0 01.612.094 1.61 1.61 0 01.507.277l-.386.546a1.562 1.562 0 00-.39-.205 1.178 1.178 0 00-.388-.07.347.347 0 00-.208.052.154.154 0 00-.07.127v.008a.158.158 0 00.022.084.198.198 0 00.076.066.831.831 0 00.147.06c.062.02.14.04.236.061a3.389 3.389 0 01.43.122 1.292 1.292 0 01.328.17.678.678 0 01.207.24.739.739 0 01.071.337v.008a.865.865 0 01-.081.382.82.82 0 01-.229.285 1.032 1.032 0 01-.353.18 1.606 1.606 0 01-.46.061 2.16 2.16 0 01-.71-.116 1.718 1.718 0 01-.593-.346l.43-.514c.277.223.578.335.9.335a.457.457 0 00.236-.05.157.157 0 00.082-.142v-.008a.15.15 0 00-.02-.077.204.204 0 00-.073-.066.753.753 0 00-.143-.062 2.45 2.45 0 00-.233-.062 5.036 5.036 0 01-.413-.113 1.26 1.26 0 01-.331-.16.72.72 0 01-.222-.243.73.73 0 01-.082-.36v-.008a.863.863 0 01.074-.359.794.794 0 01.214-.283 1.007 1.007 0 01.34-.185 1.423 1.423 0 01.448-.066 2.006 2.006 0 01.025 0zm-9.358.025h.742l1.183 2.81h-.825l-.203-.499H8.623l-.198.498h-.81zm2.197.02h.814l.663 1.08.663-1.08h.814v2.79h-.766v-1.602l-.711 1.091h-.016l-.707-1.083v1.593h-.754zm3.469 0h2.235v.658h-1.473v.422h1.334v.61h-1.334v.442h1.493v.658h-2.255zm-5.3.897l-.315.793h.624zm-1.145 5.19h8.014l-4.09 1.348z"/></svg>`,
        GOG: `<svg viewBox="0 0 24 24" fill="#8a4fff" xmlns="http://www.w3.org/2000/svg"><path d="M7.15 15.24H4.36a.4.4 0 0 0-.4.4v2c0 .21.18.4.4.4h2.8v1.32h-3.5c-.56 0-1.02-.46-1.02-1.03v-3.39c0-.56.46-1.02 1.03-1.02h3.48v1.32zM8.16 11.54c0 .58-.47 1.05-1.05 1.05H2.63v-1.35h3.78a.4.4 0 0 0 .4-.4V6.39a.4.4 0 0 0-.4-.4H4.39a.4.4 0 0 0-.41.4v2.02c0 .23.18.4.4.4H6v1.35H3.68c-.58 0-1.05-.46-1.05-1.04V5.68c0-.57.47-1.04 1.05-1.04H7.1c.58 0 1.05.47 1.05 1.04v5.86zM21.36 19.36h-1.32v-4.12h-.93a.4.4 0 0 0-.4.4v3.72h-1.33v-4.12h-.93a.4.4 0 0 0-.4.4v3.72h-1.33v-4.42c0-.56.46-1.02 1.03-1.02h5.61v5.44zM21.37 11.54c0 .58-.47 1.05-1.05 1.05h-4.48v-1.35h3.78a.4.4 0 0 0 .4-.4V6.39a.4.4 0 0 0-.4-.4h-2.03a.4.4 0 0 0-.4.4v2.02c0 .23.18.4.4.4h1.62v1.35H16.9c-.58 0-1.05-.46-1.05-1.04V5.68c0-.57.47-1.04 1.05-1.04h3.43c.58 0 1.05.47 1.05 1.04v5.86zM13.72 4.64h-3.44c-.58 0-1.04.47-1.04 1.04v3.44c0 .58.46 1.04 1.04 1.04h3.44c.57 0 1.04-.46 1.04-1.04V5.68c0-.57-.47-1.04-1.04-1.04m-.3 1.75v2.02a.4.4 0 0 1-.4.4h-2.03a.4.4 0 0 1-.4-.4V6.4c0-.22.17-.4.4-.4H13c.23 0 .4.18.4.4zM12.63 13.92H9.24c-.57 0-1.03.46-1.03 1.02v3.39c0 .57.46 1.03 1.03 1.03h3.39c.57 0 1.03-.46 1.03-1.03v-3.39c0-.56-.46-1.02-1.03-1.02m-.3 1.72v2a.4.4 0 0 1-.4.4v-.01H9.94a.4.4 0 0 1-.4-.4v-1.99c0-.22.18-.4.4-.4h2c.22 0 .4.18.4.4zM23.49 1.1a1.74 1.74 0 0 0-1.24-.52H1.75A1.74 1.74 0 0 0 0 2.33v19.34a1.74 1.74 0 0 0 1.75 1.75h20.5A1.74 1.74 0 0 0 24 21.67V2.33c0-.48-.2-.92-.51-1.24m0 20.58a1.23 1.23 0 0 1-1.24 1.24H1.75A1.23 1.23 0 0 1 .5 21.67V2.33a1.23 1.23 0 0 1 1.24-1.24h20.5a1.24 1.24 0 0 1 1.24 1.24v19.34z"/></svg>`,
        Riot: `<svg viewBox="0 0 24 24" fill="#eb0029" xmlns="http://www.w3.org/2000/svg"><path d="M13.458.86 0 7.093l3.353 12.761 2.552-.313-.701-8.024.838-.373 1.447 8.202 4.361-.535-.775-8.857.83-.37 1.591 9.025 4.412-.542-.849-9.708.84-.374 1.74 9.87L24 17.318V3.5Zm.316 19.356.222 1.256L24 23.14v-4.18l-10.22 1.256Z"/></svg>`,
        Xbox: `<svg viewBox="0 0 24 24" fill="#107C10" xmlns="http://www.w3.org/2000/svg"><path d="M4.102 21.033C6.211 22.881 8.977 24 12 24c3.026 0 5.789-1.119 7.902-2.967 1.877-1.912-4.316-8.709-7.902-11.417-3.582 2.708-9.779 9.505-7.898 11.417zm11.16-14.406c2.5 2.961 7.484 10.313 6.076 12.912C23.002 17.48 24 14.861 24 12.004c0-3.34-1.365-6.362-3.57-8.536 0 0-.027-.022-.082-.042-.063-.022-.152-.045-.281-.045-.592 0-1.985.434-4.805 3.246zM3.654 3.426c-.057.02-.082.041-.086.042C1.365 5.642 0 8.664 0 12.004c0 2.854.998 5.473 2.661 7.533-1.401-2.605 3.579-9.951 6.08-12.91-2.82-2.813-4.216-3.245-4.806-3.245-.131 0-.223.021-.281.046v-.002zM12 3.551S9.055 1.828 6.755 1.746c-.903-.033-1.454.295-1.521.339C7.379.646 9.659 0 11.984 0H12c2.334 0 4.605.646 6.766 2.085-.068-.046-.615-.372-1.52-.339C14.946 1.828 12 3.545 12 3.545v.006z"/></svg>`,
        Windows: `<svg viewBox="0 0 88 88" fill="#0078d4" xmlns="http://www.w3.org/2000/svg"><path d="M0 12.4 35.7 7.6V42H0zm40.3-5.5L88 0v42H40.3zM0 46h35.7v34.4L0 75.6zm40.3.1H88V88L40.3 81.4z"/></svg>`
    };

    function _getPlatformData(url) {
        if (!url) return { name: 'Windows / Pasta', svg: PLATFORM_ICONS.Windows };
        const value = String(url).toLowerCase();
        if (value === 'steam' || value.startsWith('steam://')) return { name: 'Steam', svg: PLATFORM_ICONS.Steam };
        if (value === 'epic' || value.startsWith('com.epicgames')) return { name: 'Epic Games', svg: PLATFORM_ICONS.Epic };
        if (value === 'gog' || value.startsWith('goggalaxy://')) return { name: 'GOG', svg: PLATFORM_ICONS.GOG };
        if (value === 'riot' || value.startsWith('riot:')) return { name: 'Riot Games', svg: PLATFORM_ICONS.Riot };
        if (value === 'xbox' || /^(xbox:|ms-xbl-)/i.test(value)) return { name: 'Xbox', svg: PLATFORM_ICONS.Xbox };
        return { name: 'Windows / Pasta', svg: PLATFORM_ICONS.Windows };
    }

    function _itemKey(item) {
        return item?.LaunchUrl || item?.launchUrl || item?.Path || item?.path || item?.Url || item?.url || item?.Id || item?.id || '';
    }

    function _isArtworkPending(item, channel = 'games') {
        const key = _itemKey(item);
        return !!(key && window.AppStore?.queries?.isArtworkPending?.(channel, key));
    }

    function _restingGridSrc(item, channel = 'games') {
        if (!item) return '';
        if (item.GridStaticImage) return item.GridStaticImage;
        if (_isArtworkPending(item, channel)) return '';
        return item.GridImage || '';
    }

    // ── Função Exclusiva para o Modal de Aviso de Modo Desktop ──────────────
    window.isDesktopWarningOpen = false;

    function _ensureDoorpiShortcutStyles() {
        if (document.getElementById('doorpiShortcutStyles')) return;
        const s = document.createElement('style');
        s.id = 'doorpiShortcutStyles';
        s.textContent = `
            .doorpi-shortcut-combo { display:inline-flex; align-items:center; gap:.42em; white-space:nowrap; vertical-align:middle; }
            .doorpi-shortcut-plus { color:rgba(255,255,255,.42); font-size:.82em; font-weight:800; }
            .doorpi-keycap { min-width:2.7em; height:1.8em; padding:0 .72em; border-radius:.55em; display:inline-flex; align-items:center; justify-content:center; background:linear-gradient(180deg, rgba(255,255,255,.18), rgba(255,255,255,.055)); border:1px solid rgba(255,255,255,.30); box-shadow:inset 0 1px 0 rgba(255,255,255,.20), 0 .32em .9em rgba(0,0,0,.30); color:rgba(255,255,255,.94); font-size:.72em; font-weight:860; letter-spacing:.08em; }
            .doorpi-stickcap { width:2.15em; height:2.15em; border-radius:50%; position:relative; display:inline-flex; align-items:center; justify-content:center; background:radial-gradient(circle at 38% 30%, rgba(255,255,255,.26), transparent 18%), radial-gradient(circle at 50% 55%, rgba(255,255,255,.08), transparent 46%), linear-gradient(180deg, #303340, #11131b); border:1px solid rgba(255,255,255,.22); box-shadow:inset 0 .18em .32em rgba(255,255,255,.08), inset 0 -.24em .42em rgba(0,0,0,.42), 0 .38em .9em rgba(0,0,0,.36); color:rgba(255,255,255,.95); font-size:.72em; font-weight:900; letter-spacing:.04em; }
            .doorpi-stickcap::after { content:''; position:absolute; inset:28%; border-radius:50%; border:1px solid rgba(255,255,255,.28); box-shadow:0 0 0 .18em rgba(0,0,0,.14); }
            .doorpi-xbox-logo-btn { width:2.15em; height:2.15em; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; background:linear-gradient(180deg, #f6f6f7, #c9ccd2); border:1px solid rgba(255,255,255,.48); box-shadow:inset 0 .12em .22em rgba(255,255,255,.58), inset 0 -.18em .34em rgba(0,0,0,.22), 0 .34em .82em rgba(0,0,0,.34); color:#151820; }
            .doorpi-xbox-logo-btn svg { width:1.2em; height:1.2em; display:block; fill:currentColor; }
            .nav-shortcut-row { display:flex; flex-wrap:wrap; align-items:center; gap:8px 10px; margin-top:10px; color:rgba(255,255,255,.54); font-size:.78rem; }
        `;
        document.head.appendChild(s);
    }

    function _xboxButtonSvg() {
        return `<svg viewBox="1 1 30 30" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M11.9 9.3c-5.1-5.1-6.4-4-6.4-4C2.7 8 1 11.8 1 16c0 3.4 1.1 6.6 3.1 9.1h.1V25C3 21.5 8.9 12.9 11.9 9.3zm14.6-4s-1.3-1.1-6.4 3.9c3 3.6 8.9 12.2 7.7 15.7v.1h.1c1.9-2.5 3.1-5.7 3.1-9.1 0-4.1-1.7-7.9-4.5-10.6zM16 5.4c.5-.2 4.9-2.8 7.8-2.1h.1v-.1C21.5 1.8 19 1 16 1s-5.5.8-7.8 2.2v.1h.1c2.5-.6 6.6 1.5 7.7 2.1zm0 7.7c0-.1 0-.1 0 0C11.4 16.5 3.7 25 6.1 27.3 8.8 29.6 12.2 31 16 31s7.2-1.4 9.9-3.7c2.3-2.4-5.4-10.8-9.9-14.2z"/></svg>`;
    }

    function _doorpiReturnShortcutHtml() {
        _ensureDoorpiShortcutStyles();
        return `<span class="doorpi-shortcut-combo" aria-label="Xbox ou LB + RB + R3">
            <span class="doorpi-xbox-logo-btn">${_xboxButtonSvg()}</span>
            <span class="doorpi-shortcut-plus">/</span>
            <span class="doorpi-keycap">LB</span>
            <span class="doorpi-shortcut-plus">+</span>
            <span class="doorpi-keycap">RB</span>
            <span class="doorpi-shortcut-plus">+</span>
            <span class="doorpi-stickcap">R3</span>
        </span>`;
    }

    function _doorpiTaskSwitcherShortcutHtml() {
        _ensureDoorpiShortcutStyles();
        return `<span class="doorpi-shortcut-combo" aria-label="Xbox + Select ou LB + RB + Select">
            <span class="doorpi-xbox-logo-btn">${_xboxButtonSvg()}</span>
            <span class="doorpi-shortcut-plus">+</span>
            <span class="doorpi-keycap">SELECT</span>
            <span class="doorpi-shortcut-plus">/</span>
            <span class="doorpi-keycap">LB</span>
            <span class="doorpi-shortcut-plus">+</span>
            <span class="doorpi-keycap">RB</span>
            <span class="doorpi-shortcut-plus">+</span>
            <span class="doorpi-keycap">SELECT</span>
        </span>`;
    }

    function _decorateDoorpiReturnShortcut(root) {
        const card = root?.querySelector?.('#navCardGameBar');
        if (!card || card.querySelector('.nav-shortcut-row')) return;
        const title = card.querySelector('.nav-suggestion-card-btn');
        title?.insertAdjacentHTML('afterend', `
            <span class="nav-shortcut-row">
                <span>${_t('sysDoorpiReturnShortcut', 'Retornar ao sistema')}</span>
                ${_doorpiReturnShortcutHtml()}
            </span>
            <span class="nav-shortcut-row">
                <span>${_t('sysWindowSwitcherShortcut', 'Alternar entre janelas')}</span>
                ${_doorpiTaskSwitcherShortcutHtml()}
            </span>
            <span class="nav-suggestion-card-text">${_t('sysWindowSwitcherHint', 'Use o direcional para escolher, A para abrir e B para cancelar.')}</span>
        `);
    }

    function _showDesktopWarning(context, onConfirm) {
        // Verifica se o usuário já marcou para não exibir novamente
        if (localStorage.getItem('doorpi_skip_desktop_warning') === 'true') {
            if (onConfirm) onConfirm();
            return;
        }

        let overlay = document.getElementById('desktopWarningOverlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'desktopWarningOverlay';
            overlay.className = 'desktop-warning-overlay';

            const s = document.createElement('style');
            s.textContent = `
                .desktop-warning-overlay { position: fixed; inset: 0; background: rgba(0,0,10,0.85); backdrop-filter: blur(15px); z-index: 10000; display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.3s ease; pointer-events: none; font-family: inherit; }
                .desktop-warning-overlay.visible { opacity: 1; pointer-events: auto; }
                .dw-modal { background: rgba(20,20,35,0.95); border: 1px solid rgba(255,255,255,0.15); border-radius: 20px; padding: 32px 40px; width: 90%; max-width: 760px; box-shadow: 0 30px 60px rgba(0,0,0,0.7); transform: scale(0.95); transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1); display: flex; flex-direction: column; gap: 24px; }
                .desktop-warning-overlay.visible .dw-modal { transform: scale(1); }
                .dw-header h2 { margin: 0; font-size: 1.8rem; font-weight: 300; color: #fff; letter-spacing: -0.01em; }
                .dw-header p { margin: 8px 0 0; color: rgba(255,255,255,0.6); font-size: 1rem; line-height: 1.4; }
                .dw-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px 24px; background: rgba(0,0,0,0.3); padding: 24px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.05); }
                .dw-item { display: flex; align-items: center; gap: 14px; font-size: 0.95rem; color: rgba(255,255,255,0.8); }
                .dw-badge { background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); padding: 4px 10px; border-radius: 8px; font-weight: 700; color: #fff; min-width: 48px; text-align: center; font-size: 0.85rem; letter-spacing: 0.05em; }
                .dw-badge.a { color: #6ee696; border-color: rgba(110,230,150,0.4); background: rgba(110,230,150,0.1); }
                .dw-badge.b { color: #ff6b6b; border-color: rgba(255,107,107,0.4); background: rgba(255,107,107,0.1); }
                .dw-badge.x { color: #78beff; border-color: rgba(120,190,255,0.4); background: rgba(120,190,255,0.1); }
                .dw-badge.y { color: #ffd166; border-color: rgba(255,209,102,0.4); background: rgba(255,209,102,0.1); }
                
                /* ESTILO DO ANALÓGICO 3D */
                .dw-badge.rs { 
                    color: #e0e0e0; 
                    border: 2px solid #3a3a3a; 
                    background: radial-gradient(circle at center, #2a2a2a 0%, #111 100%); 
                    border-radius: 50%; 
                    min-width: 34px; 
                    height: 34px; 
                    padding: 0; 
                    display: inline-flex; 
                    align-items: center; 
                    justify-content: center; 
                    box-shadow: inset 0 2px 4px rgba(255,255,255,0.1), 0 3px 6px rgba(0,0,0,0.6); 
                    font-size: 0.85rem; 
                    text-shadow: 0 -1px 1px rgba(0,0,0,0.8);
                }
                
                .dw-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 8px; }
                .dw-checkbox { display: flex; align-items: center; gap: 10px; background: transparent; border: 1px solid transparent; color: rgba(255,255,255,0.6); font-family: inherit; font-size: 0.95rem; cursor: pointer; outline: none; padding: 8px 12px; border-radius: 10px; transition: all 0.2s; }
                .dw-checkbox.nav-focused-el { background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.2); color: #fff; transform: scale(1.05); }
                .dw-box { width: 20px; height: 20px; border: 2px solid rgba(255,255,255,0.4); border-radius: 4px; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
                .dw-checkbox.checked .dw-box { background: #6ee696; border-color: #6ee696; }
                .dw-checkbox.checked .dw-box::after { content: ''; width: 5px; height: 10px; border-right: 2px solid #000; border-bottom: 2px solid #000; transform: rotate(45deg) translateY(-2px); }
                .dw-checkbox.checked span { color: #fff; }
                
                .dw-actions { display: flex; gap: 16px; }
                .dw-btn { padding: 12px 24px; border-radius: 10px; font-weight: 600; font-size: 1rem; cursor: pointer; transition: all 0.2s; outline: none; border: 1px solid transparent; }
                .dw-btn-cancel { background: rgba(255,255,255,0.08); color: #fff; border-color: rgba(255,255,255,0.15); }
                .dw-btn-confirm { background: #fff; color: #000; }
                
                .dw-btn.nav-focused-el { transform: scale(1.05); box-shadow: 0 10px 25px rgba(0,0,0,0.3); }
                .dw-btn-cancel.nav-focused-el { border-color: #fff; background: rgba(255,255,255,0.2); }
                .dw-btn-confirm.nav-focused-el { box-shadow: 0 0 0 4px rgba(255,255,255,0.2), 0 10px 25px rgba(0,0,0,0.5); }
            `;
            document.head.appendChild(s);
            document.body.appendChild(overlay);
        }

        // Lógica para diferenciar a mensagem de "Sair" dependendo do Contexto
        const exitContentHtml = context === 'settings'
            ? `<div class="dw-item" style="grid-column: 1 / -1; margin-top: 8px; justify-content: center; background: rgba(255,255,255,0.05); padding: 12px; border-radius: 10px; text-align: center;">
                    <span id="dwSettingsExit" style="font-weight: 500; color:#ffd166;"></span>
               </div>`
            : `<div class="dw-item" style="grid-column: 1 / -1; margin-top: 8px; justify-content: center; background: rgba(255,255,255,0.05); padding: 12px; border-radius: 10px; display: flex; align-items: center; gap: 12px;">
                    ${_doorpiReturnShortcutHtml()}
                    <span id="dwExit" style="font-weight: 500; color:#fff;"></span>
               </div>`;

        overlay.innerHTML = `
            <div class="dw-modal">
                <div class="dw-header">
                    <h2 id="dwTitle"></h2>
                    <p id="dwSubtitle"></p>
                </div>
                
                <div class="dw-grid">
                    <div class="dw-item"><div class="dw-badge rs">R</div> <span id="dwMouse"></span></div>
                    <div class="dw-item">
                        <div style="display:flex; align-items:center; gap:6px;">
                            <div class="dw-badge" style="min-width: auto; padding: 4px 8px;">RB</div>
                            <span style="font-size:1.1rem; font-weight:bold; color:rgba(255,255,255,0.6);">+</span>
                            <div class="dw-badge rs">R</div>
                        </div>
                        <span id="dwScroll"></span>
                    </div>
                    <div class="dw-item"><div class="dw-badge" style="color:#c8c8c8;border-color:rgba(200,200,200,0.3);background:rgba(200,200,200,0.08);">RT</div> <span id="dwLClick"></span></div>
                    <div class="dw-item"><div class="dw-badge x">X</div> <span id="dwRClick"></span></div>
                    <div class="dw-item"><div class="dw-badge y">Y</div> <span id="dwVkb"></span></div>
                    <div class="dw-item"><div class="dw-badge b">B</div> <span id="dwBack"></span></div>
                    ${exitContentHtml}
                </div>

                <div class="dw-footer">
                    <button class="dw-checkbox" id="btnDwCheckbox" tabindex="-1">
                        <div class="dw-box"></div> <span id="dwDontShowAgain"></span>
                    </button>
                    <div class="dw-actions">
                        <button class="dw-btn dw-btn-cancel" id="btnDesktopWarningCancel" tabindex="-1"></button>
                        <button class="dw-btn dw-btn-confirm" id="btnDesktopWarningConfirm" tabindex="-1"></button>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('dwTitle').textContent = _t('dwTitle', 'Modo Área de Trabalho');
        document.getElementById('dwSubtitle').textContent = _t('dwSubtitle', 'Seu controle assumirá temporariamente a função de mouse e teclado. Conheça os comandos:');
        document.getElementById('dwMouse').textContent = _t('dwBtnMouse', 'Mover Mouse');
        document.getElementById('dwScroll').textContent = _t('dwBtnScroll', 'Rolar a Tela (Scroll)');
        document.getElementById('dwLClick').textContent = _t('dwBtnLClick', 'Clique Esquerdo');
        document.getElementById('dwRClick').textContent = _t('dwBtnRClick', 'Clique Direito');
        document.getElementById('dwVkb').textContent = _t('dwBtnVkb', 'Teclado Virtual (Avulso)');
        document.getElementById('dwBack').textContent = _t('dwBtnBack', 'Voltar');

        if (context === 'settings') {
            document.getElementById('dwSettingsExit').textContent = _t('dwSettingsExit', 'Feche a janela de configuração ao finalizar para retornar ao Doorpi');
        } else {
            document.getElementById('dwExit').textContent = _t('dwBtnExit', 'Sair e retornar ao Doorpi');
        }

        document.getElementById('btnDesktopWarningCancel').textContent = _t('dwBtnCancel', 'Cancelar');
        document.getElementById('btnDesktopWarningConfirm').textContent = _t('dwBtnConfirm', 'Entendi e Continuar');
        document.getElementById('dwDontShowAgain').textContent = _t('dwDontShowAgain', 'Não mostrar novamente');

        const btnCheckbox = document.getElementById('btnDwCheckbox');
        const btnCancel = document.getElementById('btnDesktopWarningCancel');
        const btnConfirm = document.getElementById('btnDesktopWarningConfirm');

        let focusIdx = 2; // 0 = Checkbox, 1 = Cancelar, 2 = Confirmar
        let dontShowAgain = false;

        btnCheckbox.classList.remove('checked');

        const updateFocus = () => {
            btnCheckbox.classList.toggle('nav-focused-el', focusIdx === 0);
            btnCancel.classList.toggle('nav-focused-el', focusIdx === 1);
            btnConfirm.classList.toggle('nav-focused-el', focusIdx === 2);
        };
        updateFocus();

        const cleanup = () => {
            overlay.classList.remove('visible');
            window.isDesktopWarningOpen = false;
            window._dwMoveFocus = null;
            window._dwAction = null;
        };

        window._dwMoveFocus = (delta) => {
            focusIdx += delta;
            if (focusIdx < 0) focusIdx = 0;
            if (focusIdx > 2) focusIdx = 2;
            updateFocus();
        };

        window._dwAction = (action) => {
            if (action === 'CONFIRM') {
                if (focusIdx === 0) {
                    dontShowAgain = !dontShowAgain;
                    btnCheckbox.classList.toggle('checked', dontShowAgain);
                } else if (focusIdx === 1) {
                    cleanup();
                } else if (focusIdx === 2) {
                    if (dontShowAgain) localStorage.setItem('doorpi_skip_desktop_warning', 'true');
                    cleanup();
                    if (onConfirm) onConfirm();
                }
            } else if (action === 'CANCEL') {
                cleanup();
            }
        };

        btnCheckbox.onclick = () => { focusIdx = 0; updateFocus(); window._dwAction('CONFIRM'); };
        btnCancel.onclick = () => { focusIdx = 1; updateFocus(); window._dwAction('CONFIRM'); };
        btnConfirm.onclick = () => { focusIdx = 2; updateFocus(); window._dwAction('CONFIRM'); };

        btnCheckbox.onmouseenter = () => { focusIdx = 0; updateFocus(); };
        btnCancel.onmouseenter = () => { focusIdx = 1; updateFocus(); };
        btnConfirm.onmouseenter = () => { focusIdx = 2; updateFocus(); };

        window.isDesktopWarningOpen = true;
        requestAnimationFrame(() => overlay.classList.add('visible'));
    }
    window.showDesktopWarning = _showDesktopWarning;
    // ────────────────────────────────────────────────────────────────────────
    // ██████████████████  LAZY GRID LOADER  ██████████████████████████████████
    // ────────────────────────────────────────────────────────────────────────
    class _NavLazyGrid {
        constructor({ body, scrollRoot, items, catId, emptyIcon, onLaunchAction, onFocusUpdate }) {
            this.items        = items;
            this.catId        = catId;
            this.emptyIcon    = emptyIcon;
            this.onLaunchAction = onLaunchAction;
            this.onFocusUpdate  = onFocusUpdate; 
            this.scrollRoot   = scrollRoot;

            // Margens para garantir que o skeleton nunca seja visto:
            // Ele vai carregar as imagens muito antes de entrar e só descarregar muito depois de sair.
            this.LOAD_MARGIN   = '1200px 0px 1200px 0px';
            this.UNLOAD_MARGIN = '1600px 0px 1600px 0px';
            this.BATCH_SIZE    = 40; // Inicial de quantos processar na tela logo de cara

            this._cards      = [];           
            this._loadObs    = null;         
            this._unloadObs  = null;         
            this._aborted    = false;
            this._wrapper    = null;
            this._initialCount = 0;
            this._scrollRaf = 0;
            this._onScroll = () => {
                if (this._scrollRaf) return;
                this._scrollRaf = requestAnimationFrame(() => {
                    this._scrollRaf = 0;
                    this.hydrateViewportBand();
                });
            };

            this._build(body, scrollRoot);
        }

        _build(body, scrollRoot) {
            this._wrapper = document.createElement('div');
            this._wrapper.className = 'nlg-wrapper';
            
            this._grid = document.createElement('div');
            this._grid.className = 'nav-big-grid nlg-grid';
            this._grid.id = 'navDynGrid';
            
            this._wrapper.appendChild(this._grid);
            body.appendChild(this._wrapper);

            this._setupObservers(scrollRoot);
            scrollRoot?.addEventListener?.('scroll', this._onScroll, { passive: true });

            const firstBatch = Math.min(this.items.length, this.BATCH_SIZE);
            this._initialCount = firstBatch;
            for (let i = 0; i < firstBatch; i++) {
                const card = this._createCard(i);
                card._initialPage = true;
                this._grid.appendChild(card);
                this._cards.push(card);
                this._loadObs.observe(card);
                this._unloadObs.observe(card);
                this._loadCard(card);
            }

            this.onFocusUpdate(this._cards, -1);
            if (typeof refreshRuntimeCards === 'function') refreshRuntimeCards();

            if (this.items.length > firstBatch) {
                this._buildRemainder(firstBatch);
            }
            requestAnimationFrame(() => this.hydrateViewportBand());
        }

        async _buildRemainder(startIdx) {
            const BATCH = this.BATCH_SIZE;
            let i = startIdx;

            while (i < this.items.length && !this._aborted && this._grid) {
                await new Promise(resolve => {
                    if ('requestIdleCallback' in window) {
                        requestIdleCallback(resolve, { timeout: 100 });
                    } else {
                        setTimeout(resolve, 10);
                    }
                });

                if (this._aborted || !this._grid) break;

                const end = Math.min(i + BATCH, this.items.length);
                const fragment = document.createDocumentFragment();

                for (let j = i; j < end; j++) {
                    const card = this._createCard(j);
                    fragment.appendChild(card);
                    this._cards.push(card);
                }

                this._grid.appendChild(fragment);

                const newCards = this._cards.slice(i, end);
                for (const card of newCards) {
                    this._loadObs?.observe(card);
                    this._unloadObs?.observe(card);
                }

                this.onFocusUpdate(this._cards, -1);
                if (typeof refreshRuntimeCards === 'function') refreshRuntimeCards();
                i = end;
            }
        }

        _setupObservers(scrollRoot) {
            this._loadObs = new IntersectionObserver(
                entries => {
                    entries.forEach(e => {
                        if (e.isIntersecting) this._loadCard(e.target);
                    });
                },
                { root: scrollRoot, rootMargin: this.LOAD_MARGIN, threshold: 0 }
            );

            this._unloadObs = new IntersectionObserver(
                entries => {
                    entries.forEach(e => {
                        if (!e.isIntersecting) this._unloadCard(e.target);
                    });
                },
                { root: scrollRoot, rootMargin: this.UNLOAD_MARGIN, threshold: 0 }
            );
        }

        _createCard(idx) {
            const item = this.items[idx];
            const name = item.Name || '';
            const isAdminLocked = _isAdminLockedGame(item);

            const card = document.createElement('div');
            card.className = `nav-vertical-card nav-skeleton${isAdminLocked ? ' admin-locked' : ''}`;
            card.tabIndex = -1;
            card.dataset.idx     = String(idx);
            card.dataset.gameId  = item.LaunchUrl || item.Path || item.Url || '';
            card.dataset.path = item.Path || '';
            card.dataset.launchUrl = item.LaunchUrl || '';
            card.dataset.launchCommand = item.LaunchCommand || '';
            card.dataset.isAdminLocked = isAdminLocked ? 'true' : 'false';
            card._item           = item;
            card._loaded         = false;
            card._initialPage    = false;

            if (this.catId === 'media') {
                card.dataset.appId   = item.Id  || item.Url || '';
                card.dataset.appUrl  = item.Url || '';
                card.dataset.appType = item.Type || 'browser';
            }

            const itemKey = item.LaunchUrl || item.Path || item.Url || item.Id || '';
            if (item._isNew || window.newGameIdsThisSession?.has(itemKey)) {
                card.classList.add('new-game');
            }

            card.innerHTML = `
                <div class="nlg-skeleton-bg" aria-hidden="true"></div>
                <div class="nav-card-gradient"></div>
                <div class="nav-vertical-card-title">${_esc(name)}</div>
                ${isAdminLocked ? `<div class="admin-lock-icon">${ADMIN_LOCK_ICON_SVG}</div>` : ''}`;

            card.addEventListener('click', () => {
                if (!this._aborted) this.onLaunchAction(idx);
            });
            card.addEventListener('mouseenter', () => {
                if (!this._aborted) this.onFocusUpdate(this._cards, idx);
            });

            return card;
        }

        _loadCard(card) {
            if (card._loaded || this._aborted) return;
            card._loaded = true;
            card.classList.remove('nav-skeleton');

            const item      = card._item;
            const staticSrc = _restingGridSrc(item, this.catId);
            const animSrc   = item.GridImage || '';

            if (staticSrc) {
                const img = document.createElement('img');
                img.loading  = 'eager';
                img.decoding = 'async';
                img.alt      = item.Name || '';
                img.src      = staticSrc;

                const skeletonBg = card.querySelector('.nlg-skeleton-bg');
                if (skeletonBg) skeletonBg.replaceWith(img);
                else card.insertBefore(img, card.firstChild);

                let _animTimer = null;
                card._startInteraction = () => {
                    if (_animTimer) clearTimeout(_animTimer);
                    _animTimer = setTimeout(async () => {
                        if (!card.classList.contains('nav-focused')) return;
                        if (animSrc && animSrc !== staticSrc) {
                            const tmp = new Image();
                            tmp.src = animSrc;
                            try { await tmp.decode(); } catch (_) {}
                            if (card.classList.contains('nav-focused') && img.isConnected) {
                                img.src = animSrc;
                            }
                        }
                    }, 200);
                };
                card._stopInteraction = () => {
                    if (_animTimer) clearTimeout(_animTimer);
                    if (img.isConnected && staticSrc && img.src !== staticSrc) img.src = staticSrc;
                };
            } else {
                const noImg = document.createElement('div');
                noImg.className = 'nav-vertical-card-no-img';
                noImg.textContent = this.emptyIcon;
                const skeletonBg = card.querySelector('.nlg-skeleton-bg');
                if (skeletonBg) skeletonBg.replaceWith(noImg);
            }
        }

        _unloadCard(card) {
            if (!card._loaded) return;
            if (card._initialPage) return;
            if (this._isInViewportBand(card)) return;
            
            // Nunca descarrega a imagem do item que está com foco no gamepad
            if (card.classList.contains('nav-focused')) return;

            card._loaded = false;
            card.classList.add('nav-skeleton');
            card._stopInteraction?.();
            card._startInteraction = null;
            card._stopInteraction  = null;

            const content = card.querySelector('img, .nav-vertical-card-no-img');
            if (content) {
                const skeletonBg = document.createElement('div');
                skeletonBg.className = 'nlg-skeleton-bg';
                skeletonBg.setAttribute('aria-hidden', 'true');
                content.replaceWith(skeletonBg);
            }
        }
        hydrateInitialPage() {
            const count = Math.min(this._initialCount || this.BATCH_SIZE, this._cards.length);
            for (let i = 0; i < count; i++) {
                const card = this._cards[i];
                if (card) this._loadCard(card);
            }
        }
        warmInitialPage() {
            this.hydrateInitialPage();

            const count = Math.min(this._initialCount || this.BATCH_SIZE, this.items.length);
            const tasks = [];
            for (let i = 0; i < count; i++) {
                const item = this.items[i];
                const src = _restingGridSrc(item, this.catId);
                if (src) tasks.push(this._preloadImage(src));
            }
            return Promise.allSettled(tasks);
        }
        _preloadImage(src) {
            if (!src) return Promise.resolve();

            const cache = window.__doorpiNavImagePreloadCache || (window.__doorpiNavImagePreloadCache = new Map());
            if (cache.has(src)) return cache.get(src);

            const promise = new Promise(resolve => {
                let done = false;
                const finish = () => {
                    if (done) return;
                    done = true;
                    resolve();
                };

                const img = new Image();
                img.decoding = 'async';
                img.loading = 'eager';
                img.onload = () => {
                    if (typeof img.decode === 'function') img.decode().then(finish).catch(finish);
                    else finish();
                };
                img.onerror = finish;
                img.src = src;

                if (img.complete) {
                    if (typeof img.decode === 'function') img.decode().then(finish).catch(finish);
                    else finish();
                }
            });

            cache.set(src, promise);
            return promise;
        }
        hydrateViewportBand() {
            for (const card of this._cards) {
                if (card && this._isInViewportBand(card)) this._loadCard(card);
            }
        }
        _isInViewportBand(card) {
            const root = this.scrollRoot;
            if (!root || !card?.isConnected) return false;

            try {
                const rootRect = root.getBoundingClientRect();
                const cardRect = card.getBoundingClientRect();
                return cardRect.bottom >= rootRect.top && cardRect.top <= rootRect.bottom;
            } catch (_) {
                return false;
            }
        }
        removeItem(itemKey) {
            // Remove do array de dados (mesma referência de _menuData)
            const dataIdx = this.items.findIndex(item => {
                const key = item.LaunchUrl || item.Path || item.Url || item.Id || '';
                return key === itemKey;
            });
            if (dataIdx !== -1) this.items.splice(dataIdx, 1);

            // Remove o card do DOM e do array interno
            const cardIdx = this._cards.findIndex(c => c?.dataset?.gameId === itemKey);
            if (cardIdx !== -1) {
                const card = this._cards[cardIdx];
                this._loadObs?.unobserve(card);
                this._unloadObs?.unobserve(card);
                card._item = null;
                card._startInteraction = null;
                card._stopInteraction = null;
                card.remove();
                this._cards.splice(cardIdx, 1);
            }

            // Reindexar data-idx para manter consistência
            this._cards.forEach((c, i) => { if (c) c.dataset.idx = String(i); });
        }
        destroy() {
            this._aborted = true;
            this.scrollRoot?.removeEventListener?.('scroll', this._onScroll);
            if (this._scrollRaf) {
                cancelAnimationFrame(this._scrollRaf);
                this._scrollRaf = 0;
            }
            this._loadObs?.disconnect();
            this._unloadObs?.disconnect();
            this._loadObs = null;
            this._unloadObs = null;

            for (const card of this._cards) {
                if (card) {
                    card.classList.remove('nav-focused');
                    card._item = null;
                    card._startInteraction = null;
                    card._stopInteraction  = null;
                }
            }
            this._cards = [];
            
            const wrapper = this._wrapper;
            this._wrapper = null;
            this._grid = null;
            
            if (wrapper) {
                requestAnimationFrame(() => {
                    try { wrapper.remove(); } catch (_) {}
                });
            }
        }
    }
    // ────────────────────────────────────────────────────────────────────────


    // ── Lazy Grid Variables ──
    let _lazyGrid = null;   // grid de jogos (persistente)
    let _lazyGridMedia = null;   // grid de mídia (persistente)
    let _dualPaneContainer = null;
    const _gameLibraryFilters = new Set();
    const _librarySearch = { games: '', media: '' };
    let _libraryInteractionMode = null;

    function _librarySource(item) {
        if (item?.EmulatorId || item?.emulatorId || /^(emulator|emulador)$/i.test(String(item?.Source || item?.source || ''))) {
            return `emulator:${String(item?.EmulatorId || item?.emulatorId || 'unknown').trim().toLowerCase()}`;
        }
        const source = String(item?.Source || item?.source || '').trim().toLowerCase();
        if (source === 'steam') return 'steam';
        if (source === 'epic') return 'epic';
        if (source === 'gog') return 'gog';
        return 'windows';
    }

    function _libraryFilterLabel(filter) {
        const labels = {
            steam: 'Steam',
            epic: 'Epic Games',
            gog: 'GOG',
            windows: _t('filterLabels.Windows', 'Windows e pastas')
        };
        if (labels[filter]) return labels[filter];
        const emulatorId = String(filter || '').replace(/^emulator:/, '');
        const config = (_menuData.emulators || []).find(item =>
            String(item?.Id || item?.id || '').trim().toLowerCase() === emulatorId);
        const configuredName = String(config?.Name || config?.name || '').trim();
        if (configuredName) return configuredName;
        const knownNames = {
            rpcs3: 'RPCS3', pcsx2: 'PCSX2', ppsspp: 'PPSSPP', xenia: 'Xenia',
            dolphin: 'Dolphin', cemu: 'Cemu', ryujinx: 'Ryujinx', eden: 'Eden',
            azahar: 'Azahar', citra: 'Citra', vita3k: 'Vita3K', duckstation: 'DuckStation',
            project64: 'Project64', snes9x: 'Snes9x', shadps4: 'shadPS4'
        };
        if (knownNames[emulatorId]) return knownNames[emulatorId];
        return emulatorId.split(/[-_\s]+/).filter(Boolean)
            .map(part => part.length <= 4 ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ') || 'Emulador';
    }

    function _libraryPane(catId) {
        return _dualPaneContainer?.querySelector(catId === 'media' ? '#navPaneMedia' : '#navPaneGames');
    }

    function _libraryGrid(catId) {
        return catId === 'media' ? _lazyGridMedia : _lazyGrid;
    }

    function _filteredLibraryItems(catId) {
        const sourceItems = catId === 'media' ? (_menuData.media || []) : (_menuData.games || []);
        const query = String(_librarySearch[catId] || '').trim().toLocaleLowerCase();
        return sourceItems.filter(item => {
            if (catId === 'games' && _gameLibraryFilters.size > 0 &&
                !_gameLibraryFilters.has(_librarySource(item))) return false;
            return !query || String(item?.Name || item?.name || '').toLocaleLowerCase().includes(query);
        });
    }

    function _libraryActionItems(catId) {
        const pane = _libraryPane(catId);
        if (!pane) return [];
        return Array.from(pane.querySelectorAll('.nav-library-action'));
    }

    function _syncLibraryContentItems(catId, focusedCard = null) {
        if (CATS[_catIdx]?.id !== catId) return;
        const pane = _libraryPane(catId);
        if (!pane) return;

        if (_libraryInteractionMode === 'filters' && catId === 'games') {
            _contentItems = Array.from(pane.querySelectorAll('.nav-library-filter-option, .nav-library-filter-footer button'));
        } else {
            const actions = _libraryActionItems(catId);
            const cards = _libraryGrid(catId)?._cards || [];
            _contentItems = [...actions, ...cards];
        }

        if (focusedCard) {
            const nextIndex = _contentItems.indexOf(focusedCard);
            if (nextIndex >= 0) _contentIdx = nextIndex;
        }
        _contentIdx = Math.max(0, Math.min(Math.max(0, _contentItems.length - 1), _contentIdx));
    }

    function _rebuildLibraryGrid(catId, { resetScroll = false } = {}) {
        const pane = _libraryPane(catId);
        if (!pane) return;

        const previousScroll = pane.scrollTop;
        const oldGrid = _libraryGrid(catId);
        oldGrid?.destroy();
        if (catId === 'media') _lazyGridMedia = null;
        else _lazyGrid = null;
        pane.querySelector('.nav-library-empty')?.remove();

        const items = _filteredLibraryItems(catId);
        if (!items.length) {
            const empty = document.createElement('div');
            empty.className = 'nav-library-empty';
            empty.innerHTML = `<strong>${catId === 'media' ? 'Nenhum aplicativo encontrado' : 'Nenhum jogo encontrado'}</strong><span>Tente outro termo${catId === 'games' ? ' ou combinação de filtros' : ''}.</span>`;
            pane.appendChild(empty);
            _syncLibraryContentItems(catId);
            return;
        }

        const nextGrid = new _NavLazyGrid({
            body: pane, scrollRoot: pane,
            items, catId, emptyIcon: catId === 'media' ? '▶' : '⊞',
            onLaunchAction: (idx) => _launchAction(catId, idx, items),
            onFocusUpdate: (cards, idx) => {
                if (CATS[_catIdx]?.id !== catId) return;
                const focusedCard = idx >= 0 ? cards[idx] : null;
                _syncLibraryContentItems(catId, focusedCard);
                if (idx >= 0) {
                    _topbarFocus = false;
                    _updateContentFocus();
                }
            }
        });
        if (catId === 'media') _lazyGridMedia = nextGrid;
        else _lazyGrid = nextGrid;
        pane.scrollTop = resetScroll ? 0 : previousScroll;
        _syncLibraryContentItems(catId);
    }

    function _availableLibraryFilters() {
        const items = _menuData.games || [];
        const counts = new Map();
        items.forEach(item => {
            const source = _librarySource(item);
            counts.set(source, (counts.get(source) || 0) + 1);
        });
        const baseFilters = ['steam', 'epic', 'gog', 'windows'].filter(filter => counts.has(filter));
        const emulatorFilters = [...counts.keys()].filter(key => key.startsWith('emulator:')).sort();
        return [...baseFilters, ...emulatorFilters].map(id => ({
            id,
            label: _libraryFilterLabel(id),
            count: counts.get(id) || 0
        }));
    }

    function _refreshLibraryActionState(catId) {
        const pane = _libraryPane(catId);
        if (!pane) return;
        pane.querySelector('[data-library-action="search"]')?.classList.toggle('has-value', !!_librarySearch[catId]);
        const filterAction = pane.querySelector('[data-library-action="filters"]');
        filterAction?.classList.toggle('has-value', _gameLibraryFilters.size > 0);
        const badge = filterAction?.querySelector('.nav-library-action-badge');
        if (badge) {
            badge.textContent = String(_gameLibraryFilters.size);
            badge.hidden = _gameLibraryFilters.size === 0;
        }
    }

    function _closeLibrarySearch(catId) {
        const pane = _libraryPane(catId);
        const sheet = pane?.querySelector('.nav-library-search-sheet');
        if (!sheet) return;
        sheet.classList.remove('is-open');
        pane.classList.remove('is-search-open');
        _libraryInteractionMode = null;
        _syncLibraryContentItems(catId);
        const action = pane.querySelector('[data-library-action="search"]');
        const idx = _contentItems.indexOf(action);
        if (idx >= 0) _contentIdx = idx;
        _topbarFocus = false;
        _updateContentFocus();
    }

    function _openLibrarySearch(catId) {
        const pane = _libraryPane(catId);
        const sheet = pane?.querySelector('.nav-library-search-sheet');
        const search = sheet?.querySelector('input');
        if (!sheet || !search) return;

        _closeLibraryFilters(false);
        _libraryInteractionMode = 'search';
        sheet.classList.add('is-open');
        pane.classList.add('is-search-open');
        search.value = _librarySearch[catId] || '';
        search._doorpiVkbReturnFocus = pane.querySelector('[data-library-action="search"]');
        search.focus({ preventScroll: true });
        search.setSelectionRange(search.value.length, search.value.length);
        window._vkbOpen?.(search, {
            allowProgrammatic: true,
            placement: 'below',
            align: 'start',
            anchorElement: sheet.querySelector('.nav-library-expanded-search'),
            offsetY: 22,
            onEnter: () => _closeLibrarySearch(catId)
        });
    }

    function _renderLibraryFilterPanel() {
        const pane = _libraryPane('games');
        const panel = pane?.querySelector('.nav-library-filter-panel');
        if (!panel) return;
        const filters = _availableLibraryFilters();
        panel.innerHTML = `
            <div class="nav-library-filter-head">
                <div><span>Biblioteca</span><h3>Filtros</h3></div>
                <span class="nav-library-filter-selected">${_gameLibraryFilters.size} selecionado(s)</span>
            </div>
            <div class="nav-library-filter-list">
                ${filters.map(filter => `
                    <button class="nav-library-filter-option${_gameLibraryFilters.has(filter.id) ? ' selected' : ''}" type="button" tabindex="-1" data-filter-id="${_esc(filter.id)}" aria-pressed="${_gameLibraryFilters.has(filter.id)}">
                        <span class="nav-library-filter-copy"><strong>${_esc(filter.label)}</strong><small>${filter.count} ${filter.count === 1 ? 'jogo' : 'jogos'}</small></span>
                        <span class="nav-library-switch" aria-hidden="true"><i></i></span>
                    </button>`).join('')}
            </div>
            <div class="nav-library-filter-footer">
                <button type="button" tabindex="-1" data-filter-command="reset">Resetar</button>
                <button type="button" tabindex="-1" data-filter-command="done">Concluir</button>
            </div>`;

        panel.querySelectorAll('[data-filter-id]').forEach(button => {
            button.addEventListener('click', () => {
                const id = button.dataset.filterId;
                if (_gameLibraryFilters.has(id)) _gameLibraryFilters.delete(id);
                else _gameLibraryFilters.add(id);
                button.classList.toggle('selected', _gameLibraryFilters.has(id));
                button.setAttribute('aria-pressed', String(_gameLibraryFilters.has(id)));
                panel.querySelector('.nav-library-filter-selected').textContent = `${_gameLibraryFilters.size} selecionado(s)`;
                _refreshLibraryActionState('games');
                _rebuildLibraryGrid('games', { resetScroll: true });
                _syncLibraryContentItems('games');
                _contentIdx = Math.max(0, _contentItems.indexOf(button));
                _updateContentFocus();
            });
        });
        panel.querySelector('[data-filter-command="reset"]')?.addEventListener('click', () => {
            _gameLibraryFilters.clear();
            _refreshLibraryActionState('games');
            _renderLibraryFilterPanel();
            _rebuildLibraryGrid('games', { resetScroll: true });
            _syncLibraryContentItems('games');
            _contentIdx = Math.max(0, _contentItems.findIndex(item => item.dataset?.filterCommand === 'reset'));
            _updateContentFocus();
        });
        panel.querySelector('[data-filter-command="done"]')?.addEventListener('click', () => _closeLibraryFilters());
        panel.querySelectorAll('.nav-library-filter-option, .nav-library-filter-footer button').forEach(item => {
            item.addEventListener('mouseenter', () => {
                if (_libraryInteractionMode !== 'filters') return;
                _syncLibraryContentItems('games');
                const idx = _contentItems.indexOf(item);
                if (idx >= 0) {
                    _contentIdx = idx;
                    _updateContentFocus();
                }
            });
        });
    }

    function _openLibraryFilters() {
        const pane = _libraryPane('games');
        const panel = pane?.querySelector('.nav-library-filter-panel');
        if (!panel) return;
        window._vkbForceClose?.({ restoreFocus: false });
        pane.querySelector('.nav-library-search-sheet')?.classList.remove('is-open');
        _libraryInteractionMode = 'filters';
        _renderLibraryFilterPanel();
        panel.classList.add('is-open');
        _syncLibraryContentItems('games');
        _contentIdx = 0;
        _topbarFocus = false;
        _updateContentFocus();
    }

    function _closeLibraryFilters(restoreFocus = true) {
        const pane = _libraryPane('games');
        const panel = pane?.querySelector('.nav-library-filter-panel');
        if (!panel?.classList.contains('is-open')) return false;
        panel.classList.remove('is-open');
        _libraryInteractionMode = null;
        _syncLibraryContentItems('games');
        if (restoreFocus) {
            const action = pane.querySelector('[data-library-action="filters"]');
            const idx = _contentItems.indexOf(action);
            if (idx >= 0) _contentIdx = idx;
            _topbarFocus = false;
            _updateContentFocus();
        }
        return true;
    }

    function _buildLibraryControls(pane, catId) {
        pane.classList.add('nav-library-pane');
        const controls = document.createElement('div');
        controls.className = 'nav-library-actions';
        controls.innerHTML = `
            <button class="nav-library-action" type="button" tabindex="-1" data-library-action="search" aria-label="Pesquisar">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.3"/><path d="m16 16 4.2 4.2"/></svg>
                <span>Pesquisar</span>
            </button>
            ${catId === 'games' ? `
            <button class="nav-library-action" type="button" tabindex="-1" data-library-action="filters" aria-label="Filtros">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 7h14M8 12h8M10.5 17h3"/><path d="m4 5 1 2-1 2M7 10l1 2-1 2M9.5 15l1 2-1 2"/></svg>
                <span>Filtros</span><b class="nav-library-action-badge" hidden>0</b>
            </button>` : ''}`;
        pane.prepend(controls);

        const searchSheet = document.createElement('div');
        searchSheet.className = 'nav-library-search-sheet';
        searchSheet.innerHTML = `
            <div class="nav-library-expanded-search">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.3"/><path d="m16 16 4.2 4.2"/></svg>
                <input type="search" autocomplete="off" spellcheck="false" placeholder="${catId === 'games' ? 'Pesquisar jogos' : 'Pesquisar aplicativos'}" value="${_esc(_librarySearch[catId])}" />
            </div>
            <button type="button" class="nav-library-search-cancel" tabindex="-1">Cancelar</button>`;
        pane.prepend(searchSheet);

        if (catId === 'games') {
            const filterPanel = document.createElement('aside');
            filterPanel.className = 'nav-library-filter-panel';
            filterPanel.setAttribute('aria-label', 'Filtros da biblioteca');
            pane.prepend(filterPanel);
        }

        const search = searchSheet.querySelector('input');
        search?.addEventListener('input', () => {
            _librarySearch[catId] = search.value || '';
            _refreshLibraryActionState(catId);
            _rebuildLibraryGrid(catId, { resetScroll: true });
        });
        searchSheet.querySelector('.nav-library-search-cancel')?.addEventListener('click', () => {
            window._vkbForceClose?.({ restoreFocus: false });
            _closeLibrarySearch(catId);
        });
        controls.querySelector('[data-library-action="search"]')?.addEventListener('click', () => _openLibrarySearch(catId));
        controls.querySelector('[data-library-action="filters"]')?.addEventListener('click', () => _openLibraryFilters());

        document.addEventListener('doorpi-vkb-closed', event => {
            if (event.detail?.input === search && _libraryInteractionMode === 'search') {
                _closeLibrarySearch(catId);
            }
        });

        _libraryActionItems(catId).forEach(action => {
            action.addEventListener('mouseenter', () => {
                if (CATS[_catIdx]?.id !== catId || _libraryInteractionMode) return;
                _syncLibraryContentItems(catId);
                const idx = _contentItems.indexOf(action);
                if (idx >= 0) {
                    _topbarFocus = false;
                    _contentIdx = idx;
                    _updateContentFocus();
                }
            });
        });
        _refreshLibraryActionState(catId);
    }

    function _currentLazyGrid() {
        const id = CATS[_catIdx]?.id;
        if (id === 'games') return _lazyGrid;
        if (id === 'media') return _lazyGridMedia;
        return null;
    }

    function _isLazyCat() {
        const id = CATS[_catIdx]?.id;
        return id === 'games' || id === 'media';
    }

    function _destroyLazyGrid() {
        if (_lazyGrid) { _lazyGrid.destroy(); _lazyGrid = null; }
        if (_lazyGridMedia) { _lazyGridMedia.destroy(); _lazyGridMedia = null; }
        if (_dualPaneContainer) {
            try { _dualPaneContainer.remove(); } catch (_) { }
            _dualPaneContainer = null;
        }
        document.getElementById('navContentBody')?.classList.remove('dual-pane-active');
        _contentItems = [];
    }

    function _activeUserIdFromPayload(user, currentUserId) {
        return currentUserId || user?.Id || user?.id || user?.UserId || user?.userId || '';
    }

    async function _reloadMenuForCurrentUser(activeCatId) {
        const token = ++_menuReloadToken;
        await _loadJSONs();
        if (token !== _menuReloadToken || !window.isNavMenuOpen) return;

        const body = document.getElementById('navContentBody');
        if (!body) return;

        const catId = activeCatId || CATS[_catIdx]?.id || 'games';
        if (catId === 'games' || catId === 'media') {
            _attachDualPane(body);
            _switchDualPane(catId);
        } else {
            _renderContent(catId);
        }
        _updateContentFocus();
    }

    async function _reloadMenuAfterLibraryChange(changedCatId = 'games') {
        const token = ++_menuReloadToken;
        const activeCatId = CATS[_catIdx]?.id || 'games';
        await _loadJSONs();
        if (token !== _menuReloadToken) return;
        if (!window.isNavMenuOpen) {
            if (changedCatId === 'games' || changedCatId === 'media') {
                _destroyLazyGrid();
            }
            return;
        }

        if (activeCatId === 'games' || activeCatId === 'media') {
            _destroyLazyGrid();
            const body = document.getElementById('navContentBody');
            if (!body) return;
            _attachDualPane(body);
            _switchDualPane(activeCatId);
            _updateContentFocus();
            return;
        }

        if (changedCatId === activeCatId) {
            _renderContent(activeCatId);
            _updateContentFocus();
        }
    }

    function _setMenuUserContext(user, currentUserId, forceReload = false) {
        const nextUserId = _activeUserIdFromPayload(user, currentUserId);
        const changed = !!nextUserId && !_sameId(nextUserId, _menuDataUserId);
        if (user) _menuData.user = user;
        if (nextUserId) _menuDataUserId = nextUserId;

        if (!changed && !forceReload) return;

        _menuData.games = [];
        _menuData.history = [];
        _menuData.mediaHistory = [];
        _menuData.media = [];
        _menuData.emulators = [];
        _gameLibraryFilters.clear();
        _librarySearch.games = '';
        _librarySearch.media = '';
        _libraryFocusMemory.games = { key: '', index: 0 };
        _libraryFocusMemory.media = { key: '', index: 0 };
        const activeCatId = CATS[_catIdx]?.id || 'games';
        _destroyLazyGrid();

        if (window.isNavMenuOpen) {
            _reloadMenuForCurrentUser(activeCatId);
        }
    }

    function _attachDualPane(body) {
        if (!body) return;
        body.classList.add('dual-pane-active');

        if (!_dualPaneContainer) {
            body.innerHTML = '';
            _ensureDualPane(body);
            return;
        }

        if (_dualPaneContainer.parentNode !== body) {
            body.innerHTML = '';
            body.appendChild(_dualPaneContainer);
        }

        _dualPaneContainer.style.display = 'block';
        _dualPaneContainer.setAttribute('aria-hidden', 'false');
    }

    function _detachDualPane(body) {
        if (_dualPaneContainer?.parentNode) _dualPaneContainer.parentNode.removeChild(_dualPaneContainer);
        if (body) body.classList.remove('dual-pane-active');
    }

    // ── Dual Pane: constrói e gerencia os dois grids persistentes ─────────────
    function _ensureDualPane(body) {
        if (_dualPaneContainer) return; // já existe, só mudar visibilidade

        body.classList.add('dual-pane-active');

        _dualPaneContainer = document.createElement('div');
        _dualPaneContainer.id = 'navDualPane';
        body.appendChild(_dualPaneContainer);

        const gamesPane = document.createElement('div');
        gamesPane.id = 'navPaneGames';
        _dualPaneContainer.appendChild(gamesPane);

        const mediaPane = document.createElement('div');
        mediaPane.id = 'navPaneMedia';
        _dualPaneContainer.appendChild(mediaPane);

        const gamesItems = _menuData.games || [];
        if (gamesItems.length) {
            _buildLibraryControls(gamesPane, 'games');
            _rebuildLibraryGrid('games', { resetScroll: true });
        } else {
            gamesPane.innerHTML = `<div class="nav-placeholder"><div class="nav-placeholder-icon">⊞</div><div class="nav-placeholder-text">${_t('navNoGames', 'Nenhum jogo encontrado')}</div></div>`;
        }

        const mediaItems = _menuData.media || [];
        if (mediaItems.length) {
            _buildLibraryControls(mediaPane, 'media');
            _rebuildLibraryGrid('media', { resetScroll: true });
        } else {
            mediaPane.innerHTML = `<div class="nav-placeholder"><div class="nav-placeholder-icon">▶</div><div class="nav-placeholder-text">${_t('navNoMedia', 'Nenhum aplicativo configurado')}</div></div>`;
        }
    }

    function _applyPaneVisibility(catId) {
        const gamesPane = _dualPaneContainer?.querySelector('#navPaneGames');
        const mediaPane = _dualPaneContainer?.querySelector('#navPaneMedia');
        if (!gamesPane || !mediaPane) return;

        gamesPane.querySelector('.nav-library-filter-panel')?.classList.remove('is-open');
        _dualPaneContainer.querySelectorAll('.nav-library-search-sheet').forEach(sheet => sheet.classList.remove('is-open'));
        _dualPaneContainer.querySelectorAll('.nav-library-pane').forEach(pane => pane.classList.remove('is-search-open'));
        _libraryInteractionMode = null;

        const showGames = catId === 'games';
        const visPane = showGames ? gamesPane : mediaPane;
        const hidPane = showGames ? mediaPane : gamesPane;

        visPane.style.opacity = '1';
        visPane.style.pointerEvents = 'auto';
        visPane.style.zIndex = '1';

        hidPane.style.opacity = '0';
        hidPane.style.pointerEvents = 'none';
        hidPane.style.zIndex = '0';

        const grid = showGames ? _lazyGrid : _lazyGridMedia;
        grid?.hydrateInitialPage?.();
        grid?.hydrateViewportBand?.();
        _libraryInteractionMode = null;
        _syncLibraryContentItems(catId);
    }

    function _switchDualPane(catId) {
        _applyPaneVisibility(catId);
        _contentIdx = 0;
        _updateContentFocus();
    }

    function _warmDualPaneInitialPages() {
        const tasks = [];
        const gamesWarm = _lazyGrid?.warmInitialPage?.();
        const mediaWarm = _lazyGridMedia?.warmInitialPage?.();
        if (gamesWarm) tasks.push(gamesWarm);
        if (mediaWarm) tasks.push(mediaWarm);

        requestAnimationFrame(() => {
            _lazyGrid?.hydrateViewportBand?.();
            _lazyGridMedia?.hydrateViewportBand?.();
        });

        return Promise.allSettled(tasks);
    }
    // ─────────────────────────────────────────────────────────────────────────
    // ── Funções de Inicialização / Componentes Settings ───────────────────────
    function _renderSettingsSystem(body) {
        if (typeof postToHost === 'function') postToHost({ action: 'requestBootMode' });

        const svgDesktop = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:20px;height:20px;"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`;

        body.innerHTML = `
        <div class="nav-settings-subheader">
            <button class="nav-back-btn" id="setBackSystem" tabindex="-1">‹ ${_t('navBack', 'Voltar')}</button>
            <h2>${_t('navSetSystem', 'Sistema')}</h2>
        </div>

        <div class="nav-system-startup-panel nav-system-startup-panel-compact">
            <h3 style="font-size:1.1rem;font-weight:500;color:#fff;margin-bottom:12px;">${_t('sysBootBehavior', 'Comportamento de Inicialização')}</h3>

            <div class="nav-radio-group">
                <button class="nav-radio-btn" id="bootModeNone" data-mode="0" tabindex="-1">
                    <div class="nav-radio-circle"></div>
                    <div class="nav-radio-text">
                        <strong>${_t('sysBootNoneTitle', 'Não Iniciar Automaticamente')}</strong>
                        <span>${_t('sysBootNoneDesc', 'O aplicativo deve ser aberto manualmente pelo usuário.')}</span>
                    </div>
                </button>
                <button class="nav-radio-btn" data-mode="1" tabindex="-1">
                    <div class="nav-radio-circle"></div>
                    <div class="nav-radio-text">
                        <strong>${_t('sysBootRunTitle', 'Iniciar com Windows (Padrão)')}</strong>
                        <span>${_t('sysBootRunDesc', 'Inicia junto com o sistema operacional, mantendo a Área de Trabalho acessível ao fundo.')}</span>
                    </div>
                </button>
                <button class="nav-radio-btn" data-mode="2" tabindex="-1">
                    <div class="nav-radio-circle"></div>
                    <div class="nav-radio-text">
                        <strong>${_t('sysBootShellTitle', 'Modo Console (Imersivo)')}</strong>
                        <span>${_t('sysBootShellDesc', 'Substitui a Área de Trabalho e silencia o boot do Windows, criando uma experiência contínua e dedicada para a sua sala.')}</span>
                    </div>
                </button>
            </div>

            <div class="nav-update-panel" id="systemUpdatePanel" style="margin:22px 0 18px;padding:16px 18px;border:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.035);border-radius:10px;">
                <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:18px;">
                    <div style="min-width:0;">
                        <div id="systemUpdateBadge" style="display:inline-flex;margin-bottom:8px;padding:3px 8px;border-radius:999px;background:rgba(125,203,255,.14);color:#7dcbff;font-size:.68rem;font-weight:800;letter-spacing:.12em;">${_t('sysUpdateBadgeUpdated', 'ATUALIZADO')}</div>
                        <h3 id="systemUpdateTitle" style="font-size:1.1rem;font-weight:600;color:#fff;margin:0 0 5px;">${_t('sysUpdateTitle', 'Atualizações do sistema')}</h3>
                        <p id="systemUpdateSub" style="margin:0;color:rgba(255,255,255,.56);line-height:1.35;">${_t('sysUpdateIdle', 'Atualizações ainda não verificadas.')}</p>
                    </div>
                    <div id="systemUpdateVersions" style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;color:rgba(255,255,255,.62);font-size:.84rem;white-space:nowrap;"></div>
                </div>
                <section id="systemUpdateChangelog" class="nav-release-notes" tabindex="-1" role="button"></section>
            </div>

            <div class="nav-suggestions-grid" id="navUpdateActionsGrid" style="margin-bottom:18px;">
                <button class="nav-suggestion-card visible" id="navCardCheckUpdates" tabindex="-1">
                    <div class="nav-suggestion-card-btn">${_t('sysUpdateCheckNow', 'Verificar agora')}</div>
                    <span class="nav-suggestion-card-text">${_t('sysUpdateCheckNowDesc', 'Consulta o manifesto remoto e mostra versoes, changelog e obrigatoriedade.')}</span>
                </button>
                <button class="nav-suggestion-card" id="navCardStartUpdate" tabindex="-1" style="display:none;">
                    <div class="nav-suggestion-card-btn">${_t('sysUpdateStart', 'Atualizar')}</div>
                    <span class="nav-suggestion-card-text">${_t('sysUpdateStartDesc', 'Baixa o pacote validado, atualiza componentes e reinicia o Doorpi se necessario.')}</span>
                </button>
            </div>

            <div class="nav-update-panel" id="windowsUpdatePanel" style="margin:22px 0 18px;padding:16px 18px;border:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.035);border-radius:10px;">
                <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:18px;">
                    <div style="min-width:0;">
                        <div id="windowsUpdateBadge" style="display:inline-flex;margin-bottom:8px;padding:3px 8px;border-radius:999px;background:rgba(125,203,255,.14);color:#7dcbff;font-size:.68rem;font-weight:800;letter-spacing:.12em;">WINDOWS</div>
                        <h3 id="windowsUpdateTitle" style="font-size:1.1rem;font-weight:600;color:#fff;margin:0 0 5px;">Windows Update</h3>
                        <p id="windowsUpdateSub" style="margin:0;color:rgba(255,255,255,.56);line-height:1.35;">${_t('windowsUpdateIdle', 'Atualizações do Windows ainda não verificadas.')}</p>
                    </div>
                    <div id="windowsUpdateMeta" style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;color:rgba(255,255,255,.62);font-size:.84rem;white-space:nowrap;"></div>
                </div>
                <div id="windowsUpdateList" style="display:grid;gap:7px;margin:12px 0 0;color:rgba(255,255,255,.62);font-size:.86rem;line-height:1.35;"></div>
            </div>

            <div style="display:grid;gap:7px;margin:0 0 18px;padding-left:14px;border-left:2px solid rgba(125,203,255,.48);">
                <p style="margin:0;color:rgba(255,255,255,.56);font-size:.84rem;line-height:1.42;"><strong style="color:rgba(255,255,255,.84);font-weight:650;">${_t('windowsUpdateAdminNoticeTitle', 'Permiss\u00e3o administrativa necess\u00e1ria.')}</strong> ${_t('windowsUpdateAdminNoticeText', 'O Windows solicitar\u00e1 autoriza\u00e7\u00e3o antes de baixar e instalar os pacotes selecionados.')}</p>
            </div>

            <div class="nav-suggestions-grid" id="windowsUpdateActionsGrid" style="margin-bottom:18px;">
                <button class="nav-suggestion-card visible" id="navCardCheckWindowsUpdates" tabindex="-1">
                    <div class="nav-suggestion-card-btn">${_t('checkWindows', 'Verificar Windows')}</div>
                    <span class="nav-suggestion-card-text">${_t('checkWindowsDesc', 'Consulta o Windows Update e lista os pacotes encontrados.')}</span>
                </button>
                <button class="nav-suggestion-card" id="navCardStartWindowsUpdate" tabindex="-1" style="display:none;">
                    <div class="nav-suggestion-card-btn">${_t('windowsUpdateInstall', 'Baixar e instalar')}</div>
                    <span class="nav-suggestion-card-text">${_t('windowsUpdateInstallDesc', 'Usa a API do Windows Update para baixar e instalar em segundo plano.')}</span>
                </button>
                <button class="nav-suggestion-card" id="navCardRestartWindows" tabindex="-1" style="display:none;">
                    <div class="nav-suggestion-card-btn">${_t('restartNow', 'Reiniciar agora')}</div>
                    <span class="nav-suggestion-card-text">${_t('windowsRestartDesc', 'Reinicia o computador para concluir atualizações pendentes.')}</span>
                </button>
                <button class="nav-suggestion-card visible" id="navCardOpenWindowsUpdate" tabindex="-1">
                    <div class="nav-suggestion-card-btn">${_t('quickOpenWindowsUpdate', 'Abrir Windows Update')}</div>
                    <span class="nav-suggestion-card-text">${_t('windowsOpenNativeDesc', 'Abre a tela nativa do Windows com mouse e teclado pelo controle.')}</span>
                </button>
            </div>

            <div class="nav-suggestions-grid" id="navSuggestionsGrid">
                <button class="nav-suggestion-card" id="navCardSignIn" tabindex="-1">
                    <div class="nav-suggestion-card-btn">${_t('sysBootNoticeBtn', 'Opções de Entrada')}</div>
                    <span class="nav-suggestion-card-text">${_t('sysBootNoticeText', 'Desative a senha de login para iniciar direto no Doorpi sem teclado.')}</span>
                </button>
                <button class="nav-suggestion-card" id="navCardTaskbar" tabindex="-1">
                    <div class="nav-suggestion-card-btn">${_t('sysTaskbarNoticeBtn', 'Barra de Tarefas')}</div>
                    <span class="nav-suggestion-card-text">${_t('sysTaskbarNoticeText', 'Configure a Barra de Tarefas para ocultar automaticamente — sem distrações visuais no Modo Console.')}</span>
                </button>
                <button class="nav-suggestion-card" id="navCardGameBar" tabindex="-1">
                    <div class="nav-suggestion-card-btn">${_t('sysGameBarNoticeBtn', 'Xbox Game Bar')}</div>
                    <span class="nav-suggestion-card-text">${_t('sysGameBarNoticeText', 'Desative o atalho do botão Xbox para não abrir a overlay durante o uso do Doorpi.')}</span>
                </button>
            </div>

            <h3 style="font-size:1.1rem;font-weight:500;color:#fff;margin-bottom:12px;">${_t('sysActionsHeader', 'Ações do Sistema')}</h3>

            <button class="nav-settings-card" id="btnEnterDesktop" tabindex="-1" style="width:100%;">
                <div class="settings-card-icon" style="width:36px;height:36px;">${svgDesktop}</div>
                <div class="settings-card-info">
                    <h3>${_t('sysActionDesktopTitle', 'Acessar Área de Trabalho')}</h3>
                    <p>${_t('sysActionDesktopDesc', 'O controle assume a função de mouse e teclado com uma disposição de botões específica para este modo. Acesse a interface padrão do Windows para gerenciamento do sistema.')}</p>
                </div>
            </button>
        </div>
    `;

        _decorateDoorpiReturnShortcut(body);

        window._updateBootModeUI = () => {
            const currentMode = window._doorpiBootMode || 0;

            body.querySelectorAll('.nav-radio-btn').forEach(r =>
                r.classList.toggle('active', parseInt(r.dataset.mode) === currentMode));

            body.querySelector('#navCardSignIn')?.classList.toggle('visible', currentMode === 2);
            body.querySelector('#navCardTaskbar')?.classList.toggle('visible', currentMode === 1 || currentMode === 2);
            body.querySelector('#navCardGameBar')?.classList.toggle('visible', currentMode === 1 || currentMode === 2);

            _contentItems = [
                body.querySelector('#setBackSystem'),
                ...Array.from(body.querySelectorAll('.nav-radio-btn')),
                body.querySelector('#navCardCheckUpdates'),
                body.querySelector('#navCardStartUpdate'),
                body.querySelector('#navCardCheckWindowsUpdates'),
                body.querySelector('#navCardStartWindowsUpdate'),
                body.querySelector('#navCardRestartWindows'),
                body.querySelector('#navCardOpenWindowsUpdate'),
                body.querySelector('#navCardSignIn'),
                body.querySelector('#navCardTaskbar'),
                body.querySelector('#navCardGameBar'),
                body.querySelector('#btnEnterDesktop')
            ].filter(el => el && el.offsetParent !== null);

            _contentItems.forEach((el, idx) => {
                el.onmouseenter = () => {
                    _topbarFocus = false;
                    _contentIdx = idx;
                    _updateContentFocus();
                };
            });
        };

        window._updateBootModeUI();
        _updateSystemUpdateUI();
        _updateWindowsUpdateUI();
        if (typeof postToHost === 'function') postToHost({ action: 'requestUpdateStatus' });
        if (typeof postToHost === 'function') postToHost({ action: 'requestWindowsUpdateStatus' });

        body.querySelector('#setBackSystem')?.addEventListener('click', () => {
            _settingsSubView = null;
            _contentIdx = 0;
            _renderContent('settings');
            _updateContentFocus();
        });

        body.querySelectorAll('.nav-radio-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = parseInt(btn.dataset.mode);
                if (typeof postToHost === 'function') postToHost({ action: 'setBootMode', mode });
                window._doorpiBootMode = mode;
                window._updateBootModeUI();

                const newIdx = _contentItems.indexOf(btn);
                if (newIdx !== -1) {
                    _contentIdx = newIdx;
                }

                _updateContentFocus();
            });
        });

        body.querySelector('#navCardSignIn')?.addEventListener('click', () => {
            _showDesktopWarning('settings', () => {
                if (typeof postToHost === 'function') postToHost({ action: 'openSignInOptions' });
            });
        });

        body.querySelector('#navCardTaskbar')?.addEventListener('click', () => {
            _showDesktopWarning('settings', () => {
                if (typeof postToHost === 'function') postToHost({ action: 'openTaskbarSettings' });
            });
        });

        body.querySelector('#navCardGameBar')?.addEventListener('click', () => {
            _showDesktopWarning('settings', () => {
                if (typeof postToHost === 'function') postToHost({ action: 'openXboxGameBarSettings' });
            });
        });

        body.querySelector('#navCardCheckUpdates')?.addEventListener('click', () => {
            _systemUpdateStatus = { ..._systemUpdateStatus, status: 'checking', message: _t('quickCheckingDoorpi', 'Verificando atualizações do Doorpi...') };
            _updateSystemUpdateUI();
            if (typeof postToHost === 'function') postToHost({ action: 'checkSystemUpdates' });
        });

        body.querySelector('#navCardStartUpdate')?.addEventListener('click', () => {
            _systemUpdateStatus = { ..._systemUpdateStatus, status: 'installing', message: _t('sysUpdatePreparing', 'Preparando atualização...') };
            _updateSystemUpdateUI();
            if (typeof postToHost === 'function') postToHost({ action: 'startSystemUpdate' });
        });

        body.querySelector('#navCardCheckWindowsUpdates')?.addEventListener('click', () => {
            if (['checking', 'downloading', 'installing'].includes(_windowsUpdateStatus.status)) return;
            _windowsUpdateStatus = { ..._windowsUpdateStatus, status: 'checking', message: _t('quickCheckingWindows', 'Verificando atualizações do Windows...') };
            _updateWindowsUpdateUI();
            if (typeof postToHost === 'function') postToHost({ action: 'checkWindowsUpdates' });
        });

        body.querySelector('#navCardStartWindowsUpdate')?.addEventListener('click', () => {
            _windowsUpdateStatus = { ..._windowsUpdateStatus, status: 'downloading', message: _t('windowsUpdateDownloadingInstalling', 'Baixando e instalando atualizações do Windows...') };
            _updateWindowsUpdateUI();
            if (typeof postToHost === 'function') postToHost({ action: 'startWindowsUpdateInstall' });
        });

        body.querySelector('#navCardRestartWindows')?.addEventListener('click', () => {
            if (typeof postToHost === 'function') postToHost({ action: 'restartSystem' });
        });

        body.querySelector('#navCardOpenWindowsUpdate')?.addEventListener('click', () => {
            _showDesktopWarning('settings', () => {
                if (typeof postToHost === 'function') postToHost({ action: 'openWindowsUpdateSettings' });
            });
        });

        body.querySelector('#btnEnterDesktop')?.addEventListener('click', () => {
            _showDesktopWarning('desktop', () => {
                if (typeof postToHost === 'function') postToHost({ action: 'enterDesktopMode' });
            });
        });
    }

    function _wireSystemItems(body, selectors) {
        const activeElement = document.activeElement;
        _contentItems = selectors
            .flatMap(selector => Array.from(body.querySelectorAll(selector)))
            .filter(el => el && el.offsetParent !== null);

        const activeIndex = _contentItems.indexOf(activeElement);
        _contentIdx = activeIndex >= 0
            ? activeIndex
            : Math.max(0, Math.min(_contentIdx, Math.max(0, _contentItems.length - 1)));

        _contentItems.forEach((el, idx) => {
            el.onmouseenter = () => {
                _topbarFocus = false;
                _contentIdx = idx;
                _updateContentFocus();
            };
        });
    }

    function _returnFromSystemDetail() {
        _systemSubView = null;
        if (_settingsReturnToRoot) {
            _settingsReturnToRoot = false;
            _settingsSubView = null;
        }
        _contentIdx = 0;
        _renderContent('settings');
        _updateContentFocus();
    }

    function _settingsDirectoryMarkup(backId, title, entries) {
        const rows = entries.map(entry => `
            <button class="nav-settings-directory-item" id="${entry.id}" tabindex="-1">
                <span class="settings-card-icon">${entry.icon}</span>
                <span class="nav-settings-directory-copy"><strong>${entry.title}</strong><small>${entry.description}</small></span>
                <span class="nav-settings-directory-chevron" aria-hidden="true">›</span>
            </button>`).join('');
        const first = entries[0] || {};
        return `
            <div class="nav-settings-subheader">
                <button class="nav-back-btn" id="${backId}" tabindex="-1">‹ ${_t('navBack', 'Voltar')}</button>
                <h2>${title}</h2>
            </div>
            <div class="nav-settings-directory">
                <div class="nav-settings-directory-list">${rows}</div>
                <aside class="nav-settings-directory-preview" aria-live="polite">
                    <span class="settings-card-icon">${first.icon || ''}</span>
                    <h3>${first.title || ''}</h3><p>${first.description || ''}</p>
                    <div class="nav-settings-home-action"><kbd>A</kbd><span>Abrir configuração</span></div>
                </aside>
            </div>`;
    }

    function _wireSettingsDirectory(body, entries) {
        const preview = body.querySelector('.nav-settings-directory-preview');
        const show = entry => {
            if (!preview || !entry) return;
            preview.querySelector('.settings-card-icon').innerHTML = entry.icon;
            preview.querySelector('h3').textContent = entry.title;
            preview.querySelector('p').textContent = entry.description;
        };
        entries.forEach(entry => {
            const button = body.querySelector(`#${entry.id}`);
            button?.addEventListener('focus', () => show(entry));
            button?.addEventListener('mouseenter', () => show(entry));
        });
    }

    function _renderSettingsSystemV2(body) {
        if (_systemSubView === 'startup') { _renderSettingsSystemStartupV2(body); return; }
        if (_systemSubView === 'updates') { _renderSettingsSystemUpdatesV2(body); return; }
        if (_systemSubView === 'video') { _renderSettingsSystemVideo(body); return; }

        const svgPower = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2v10"/><path d="M18.4 6.6a9 9 0 1 1-12.8 0"/></svg>`;
        const svgUpdate = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 1 1-2.34-5.66"/><path d="M20 4v6h-6"/></svg>`;
        const svgDevices = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5.2" width="9.4" height="13.6" rx="2.1"/><circle cx="7.7" cy="14.1" r="2.15"/><circle cx="7.7" cy="9.1" r=".72" fill="currentColor" stroke="none"/><path d="M16.5 6.2v11.6l3.6-3.6-3.6-2.2 3.6-2.2-3.6-3.6Z"/></svg>`;
        const svgVideo = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/></svg>`;

        const entries = [
            { id:'setSystemStartup', icon:svgPower, title:'Inicialização', description:'Comportamento de boot, modo console e atalhos para ajustes essenciais.' },
            { id:'setSystemUpdates', icon:svgUpdate, title:'Atualizações', description:'Doorpi, Updater e Windows Update reunidos em uma área dedicada.' },
            { id:'setSystemDevices', icon:svgDevices, title:_t('navSetDevices', 'Dispositivos'), description:_t('navSetDevicesDesc', 'Bluetooth, som e acessórios conectados') },
            { id:'setSystemVideo', icon:svgVideo, title:_t('navSetVideo', 'Vídeo'), description:_t('navSetVideoDesc', 'Ajuste a escala visual do Doorpi') }
        ];
        body.innerHTML = _settingsDirectoryMarkup('setBackSystemHub', _t('navSetSystem', 'Sistema'), entries);
        _wireSettingsDirectory(body, entries);

        _wireSystemItems(body, ['#setBackSystemHub', '#setSystemStartup', '#setSystemUpdates', '#setSystemDevices', '#setSystemVideo']);

        body.querySelector('#setBackSystemHub')?.addEventListener('click', () => {
            _settingsReturnToRoot = false;
            _settingsSubView = null;
            _systemSubView = null;
            _contentIdx = 0;
            _renderContent('settings');
            _updateContentFocus();
        });
        body.querySelector('#setSystemStartup')?.addEventListener('click', () => {
            _systemSubView = 'startup';
            _contentIdx = 0;
            _renderContent('settings');
            _updateContentFocus();
        });
        body.querySelector('#setSystemUpdates')?.addEventListener('click', () => {
            _systemSubView = 'updates';
            _systemUpdatesSubView = 'doorpi';
            _contentIdx = 0;
            _renderContent('settings');
            _updateContentFocus();
        });
        body.querySelector('#setSystemDevices')?.addEventListener('click', () => {
            _settingsSubView = 'devicesHub';
            _systemSubView = 'devices';
            _contentIdx = 0;
            _renderContent('settings');
            _updateContentFocus();
        });
        body.querySelector('#setSystemVideo')?.addEventListener('click', () => {
            _systemSubView = 'video';
            _contentIdx = 0;
            _renderContent('settings');
            _updateContentFocus();
        });
    }

    function _renderSettingsSystemVideo(body) {
        if (!document.getElementById('nav-system-video-styles')) {
            const s = document.createElement('style');
            s.id = 'nav-system-video-styles';
            s.textContent = `
                .nav-video-panel { width:100%; min-height:clamp(440px,51vh,560px); display:grid; grid-template-columns:minmax(520px,1.15fr) minmax(360px,.85fr); gap:clamp(22px,2.4vw,42px); align-items:stretch; }
                .nav-video-controls { min-width:0; display:grid; align-content:center; gap:clamp(14px,1.65vh,23px); padding:clamp(20px,2.25vw,36px); border:1px solid rgba(255,255,255,.1); border-radius:10px; background:linear-gradient(145deg,rgba(255,255,255,.06),rgba(255,255,255,.018) 76%); }
                .nav-video-intro { display:grid; gap:10px; padding-left:18px; border-left:3px solid rgba(255,255,255,.68); }
                .nav-video-kicker { color:rgba(255,255,255,.42); font-size:.7rem; font-weight:720; letter-spacing:.13em; text-transform:uppercase; }
                .nav-video-value { color:#fff; font-size:clamp(2rem,2.75vw,3.65rem); font-weight:300; line-height:1; }
                .nav-video-description { max-width:760px;margin:0;color:rgba(255,255,255,.57);font-size:clamp(.82rem,.9vw,1rem);line-height:1.48; }
                .nav-video-metrics { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); border-top:1px solid rgba(255,255,255,.1); border-bottom:1px solid rgba(255,255,255,.1); }
                .nav-video-metric { min-width:0; padding:clamp(10px,1.15vh,15px) 10px; display:grid; gap:4px; border-right:1px solid rgba(255,255,255,.08); }
                .nav-video-metric:first-child{padding-left:0}.nav-video-metric:last-child{border-right:0}
                .nav-video-metric small { color:rgba(255,255,255,.4); font-size:.7rem; }
                .nav-video-metric strong { color:rgba(255,255,255,.86); font-size:clamp(.82rem,.9vw,1rem); font-weight:590; white-space:nowrap; }
                .nav-video-adjustment{display:grid;gap:11px}.nav-video-adjustment-title{color:rgba(255,255,255,.72);font-size:.76rem;font-weight:650}
                .nav-video-presets { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:5px; }
                .nav-video-preset { min-height:58px; padding:9px 12px; display:grid; gap:3px; align-content:center; border:1px solid rgba(255,255,255,.09); border-radius:7px; background:rgba(255,255,255,.035); color:#fff; font:inherit; text-align:left; outline:0; cursor:pointer; }
                .nav-video-preset strong { font-size:.88rem; font-weight:600; }
                .nav-video-preset small { color:rgba(255,255,255,.44); font-size:.72rem; }
                .nav-video-preset.active { background:rgba(255,255,255,.095); border-color:rgba(255,255,255,.22); }
                .nav-video-preset.nav-focused-el { background:rgba(255,255,255,.15); border-color:#fff; box-shadow:0 0 0 2px rgba(255,255,255,.12),0 12px 24px rgba(0,0,0,.25); }
                .nav-video-range-wrap { display:grid; gap:7px; padding:3px 8px 0; }
                .nav-video-range-labels { display:flex; justify-content:space-between; color:rgba(255,255,255,.38); font-size:.66rem; }
                .nav-video-range { width:100%; accent-color:#fff; outline:none; }
                .nav-video-range.nav-focused-el { outline:1px solid rgba(255,255,255,.72); outline-offset:7px; border-radius:2px; }
                .nav-video-recommendation { padding-left:12px; border-left:2px solid rgba(255,255,255,.5); color:rgba(255,255,255,.5); font-size:.76rem; line-height:1.42; }
                .nav-video-guidance{min-width:0;display:flex;flex-direction:column;justify-content:space-between;padding:clamp(20px,2.25vw,36px);border-left:1px solid rgba(255,255,255,.14);background:linear-gradient(90deg,rgba(255,255,255,.035),transparent 86%)}
                .nav-video-guidance h3{margin:7px 0 9px;color:#fff;font-size:clamp(1.35rem,1.75vw,2.25rem);font-weight:340;line-height:1.08}.nav-video-guidance p{max-width:620px;margin:0;color:rgba(255,255,255,.55);font-size:clamp(.8rem,.86vw,.95rem);line-height:1.48}
                .nav-video-guide{position:relative;width:100%;aspect-ratio:16/6;margin-top:clamp(15px,2vh,25px);overflow:hidden;border:1px solid rgba(255,255,255,.2);border-radius:10px;background:linear-gradient(90deg,rgba(255,255,255,.027) 1px,transparent 1px),linear-gradient(0deg,rgba(255,255,255,.027) 1px,transparent 1px),rgba(0,0,0,.12);background-size:28px 28px,28px 28px,auto;transition:border-color .18s ease,box-shadow .18s ease}
                .nav-video-guide::before{content:'';position:absolute;inset:12%;border:1px dashed rgba(255,255,255,.22);border-radius:6px}.nav-video-guide::after{content:'';position:absolute;left:50%;top:14%;bottom:14%;border-left:1px solid rgba(255,255,255,.1)}
                .nav-video-guide-status{position:absolute;z-index:1;inset:0;display:flex;align-items:center;justify-content:center;gap:12px;padding:18px;text-align:center;background:radial-gradient(circle,rgba(8,12,24,.82),rgba(8,12,24,.28) 52%,transparent 72%)}
                .nav-video-guide-check{width:32px;height:32px;display:grid;place-items:center;flex:0 0 auto;border:1px solid rgba(255,255,255,.25);border-radius:50%;color:rgba(255,255,255,.58);font-weight:800}.nav-video-guide-copy{display:grid;gap:3px;text-align:left}.nav-video-guide-copy strong{color:rgba(255,255,255,.86);font-size:clamp(.78rem,.86vw,.96rem);font-weight:620}.nav-video-guide-copy span{color:rgba(255,255,255,.4);font-size:clamp(.65rem,.7vw,.76rem)}
                .nav-video-guide.is-calibrated{border-color:rgba(112,218,156,.72);box-shadow:inset 0 0 0 1px rgba(112,218,156,.12),0 0 34px rgba(71,183,119,.1)}.nav-video-guide.is-calibrated .nav-video-guide-check{color:#baf2d0;border-color:rgba(112,218,156,.72);background:rgba(75,165,113,.16)}.nav-video-guide.is-calibrated .nav-video-guide-copy strong{color:#c5f1d6}
                .nav-video-facts{display:grid;margin-top:clamp(17px,2.2vh,28px);border-top:1px solid rgba(255,255,255,.1)}.nav-video-fact{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:18px;padding:11px 0;border-bottom:1px solid rgba(255,255,255,.08)}.nav-video-fact span{color:rgba(255,255,255,.48);font-size:.75rem}.nav-video-fact strong{color:rgba(255,255,255,.84);font-size:.79rem;font-weight:600}
                .nav-video-live-note{display:flex;align-items:center;gap:9px;margin-top:18px;color:rgba(255,255,255,.62);font-size:.75rem}.nav-video-live-note::before{content:'✓';width:23px;height:23px;display:grid;place-items:center;border:1px solid rgba(255,255,255,.25);border-radius:50%;color:#fff}
                @media(max-width:1050px){.nav-video-panel{grid-template-columns:1fr}.nav-video-guidance{border-left:0;border-top:1px solid rgba(255,255,255,.13)} }
            `;
            document.head.appendChild(s);
        }

        const scale = window.DoorpiLayoutScale?.get?.() || 1;
        const pct = Math.round(scale * 100);
        const minScale = window.DoorpiLayoutScale?.min ?? 0.25;
        const maxScale = window.DoorpiLayoutScale?.max ?? 1.80;
        const clampScale = raw => Math.max(minScale, Math.min(maxScale, Number(raw) || 1));
        const dpiScale = Math.max(0.5, Number(window.DoorpiDisplayMetrics?.dpiScale) || 1);
        const referenceScale = clampScale(1 / dpiScale);
        const compactScale = clampScale(referenceScale * .9);
        const enlargedScale = clampScale(referenceScale * 1.15);
        const refPct = Math.round(referenceScale * 100);
        const compactPct = Math.round(compactScale * 100);
        const enlargedPct = Math.round(enlargedScale * 100);
        const viewportLabel = `${Math.round(window.innerWidth)} × ${Math.round(window.innerHeight)}`;
        body.innerHTML = `
        <div class="nav-settings-subheader">
            <button class="nav-back-btn" id="setBackSystemVideo" tabindex="-1">‹ ${_t('navBack', 'Voltar')}</button>
            <h2>Tela e interface</h2>
        </div>
        <div class="nav-video-panel">
            <section class="nav-video-controls">
                <div class="nav-video-intro">
                    <span class="nav-video-kicker">Tamanho da interface</span>
                    <div class="nav-video-value" id="navVideoScaleValue">${pct}%</div>
                    <p class="nav-video-description">A escala altera cartões, textos, espaçamentos e alvos de foco em todo o Doorpi.</p>
                </div>
                <div class="nav-video-metrics">
                    <span class="nav-video-metric"><small>Área do Doorpi</small><strong>${viewportLabel}</strong></span>
                    <span class="nav-video-metric"><small>Escala do Windows</small><strong>${Math.round(dpiScale * 100)}%</strong></span>
                    <span class="nav-video-metric"><small>Base recomendada</small><strong>${refPct}%</strong></span>
                </div>
                <div class="nav-video-adjustment">
                    <span class="nav-video-adjustment-title">Escolha um perfil ou faça o ajuste fino</span>
                    <div class="nav-video-presets">
                        <button class="nav-video-preset" id="navVideoPresetCompact" data-video-scale="${compactPct}" tabindex="-1"><strong>Compacta</strong><small>${compactPct}% · mais conteúdo</small></button>
                        <button class="nav-video-preset" id="navVideoPresetRecommended" data-video-scale="${refPct}" tabindex="-1"><strong>Recomendada</strong><small>${refPct}% · equilibrada</small></button>
                        <button class="nav-video-preset" id="navVideoPresetEnlarged" data-video-scale="${enlargedPct}" tabindex="-1"><strong>Ampliada</strong><small>${enlargedPct}% · leitura distante</small></button>
                    </div>
                    <div class="nav-video-range-wrap">
                        <div class="nav-video-range-labels"><span>Menor</span><span>Ajuste fino</span><span>Maior</span></div>
                        <input class="nav-video-range" id="navVideoScale" type="range" min="25" max="180" step="5" value="${pct}" tabindex="-1">
                    </div>
                    <div class="nav-video-recommendation" id="navVideoRecommendation">A recomendação considera a escala configurada no Windows.</div>
                </div>
            </section>
            <aside class="nav-video-guidance">
                <div>
                    <span class="nav-video-kicker">Escolha com confiança</span>
                    <h3>Legibilidade ou espaço útil</h3>
                    <p>Em uma TV vista à distância, prefira alvos maiores. Em um monitor próximo, uma escala compacta mostra mais conteúdo sem alterar a resolução do Windows.</p>
                    <div class="nav-video-guide" id="navVideoGuide" aria-hidden="true">
                        <div class="nav-video-guide-status">
                            <span class="nav-video-guide-check">✓</span>
                            <span class="nav-video-guide-copy"><strong id="navVideoGuideTitle">Ajuste de referência</strong><span id="navVideoGuideText">Base recomendada: ${refPct}%</span></span>
                        </div>
                    </div>
                    <div class="nav-video-facts">
                        <span class="nav-video-fact"><span>Perfil equilibrado</span><strong>${refPct}%</strong></span>
                        <span class="nav-video-fact"><span>Mais conteúdo</span><strong>${compactPct}%</strong></span>
                        <span class="nav-video-fact"><span>Leitura à distância</span><strong>${enlargedPct}%</strong></span>
                    </div>
                </div>
                <div class="nav-video-live-note">A alteração é aplicada diretamente à interface.</div>
            </aside>
        </div>`;

        const sync = raw => {
            const next = window.DoorpiLayoutScale?.save?.(Number(raw) / 100) || 1;
            const nextPct = Math.round(next * 100);
            const value = body.querySelector('#navVideoScaleValue');
            if (value) value.textContent = `${nextPct}%`;
            body.querySelectorAll('[data-video-scale]').forEach(button => button.classList.toggle('active', Math.abs(Number(button.dataset.videoScale) - nextPct) <= 2));
            const recommendation = body.querySelector('#navVideoRecommendation');
            const calibrated = Math.abs(next - referenceScale) <= .026;
            if (recommendation) recommendation.textContent = calibrated
                ? 'Escala equilibrada para a configuração atual do Windows.'
                : next < referenceScale
                    ? 'Mais conteúdo visível, com textos e alvos de foco menores.'
                    : 'Textos e alvos maiores para uso em TV ou maior distância.';
            const guide = body.querySelector('#navVideoGuide');
            const guideTitle = body.querySelector('#navVideoGuideTitle');
            const guideText = body.querySelector('#navVideoGuideText');
            guide?.classList.toggle('is-calibrated', calibrated);
            if (guideTitle) guideTitle.textContent = calibrated ? 'Escala recomendada' : 'Ajuste de referência';
            if (guideText) guideText.textContent = calibrated ? 'Proporção equilibrada para esta tela' : `Base recomendada: ${refPct}%`;
        };

        _wireSystemItems(body, ['#setBackSystemVideo', '#navVideoPresetCompact', '#navVideoPresetRecommended', '#navVideoPresetEnlarged', '#navVideoScale']);
        body.querySelector('#setBackSystemVideo')?.addEventListener('click', () => {
            _returnFromSystemDetail();
        });
        body.querySelector('#navVideoScale')?.addEventListener('input', e => sync(e.currentTarget.value));
        body.querySelectorAll('[data-video-scale]').forEach(button => button.addEventListener('click', () => {
            const range = body.querySelector('#navVideoScale');
            if (range) range.value = button.dataset.videoScale;
            sync(button.dataset.videoScale);
            _contentIdx = Math.max(0, _contentItems.indexOf(button));
            _updateContentFocus();
        }));
        sync(pct);
    }

    function _renderSettingsSystemStartupV2(body) {
        if (typeof postToHost === 'function') postToHost({ action: 'requestBootMode' });

        body.innerHTML = `
        <div class="nav-settings-subheader">
            <button class="nav-back-btn" id="setBackSystemStartup" tabindex="-1">‹ ${_t('navBack', 'Voltar')}</button>
            <h2>Inicialização</h2>
        </div>

        <div class="nav-system-startup-panel nav-system-startup-panel-compact">
            <h3 style="font-size:1.1rem;font-weight:500;color:#fff;margin-bottom:12px;">${_t('sysBootBehavior', 'Comportamento de Inicialização')}</h3>

            <div class="nav-radio-group">
                <button class="nav-radio-btn" id="bootModeNone" data-mode="0" tabindex="-1">
                    <div class="nav-radio-circle"></div>
                    <div class="nav-radio-text">
                        <strong>${_t('sysBootNoneTitle', 'Não Iniciar Automaticamente')}</strong>
                        <span>${_t('sysBootNoneDesc', 'O aplicativo deve ser aberto manualmente pelo usuário.')}</span>
                    </div>
                </button>
                <button class="nav-radio-btn" id="bootModeRun" data-mode="1" tabindex="-1">
                    <div class="nav-radio-circle"></div>
                    <div class="nav-radio-text">
                        <strong>${_t('sysBootRunTitle', 'Iniciar com Windows (Padrão)')}</strong>
                        <span>${_t('sysBootRunDesc', 'Inicia junto com o sistema operacional, mantendo a Área de Trabalho acessível ao fundo.')}</span>
                    </div>
                </button>
                <button class="nav-radio-btn" id="bootModeShell" data-mode="2" tabindex="-1">
                    <div class="nav-radio-circle"></div>
                    <div class="nav-radio-text">
                        <strong>${_t('sysBootShellTitle', 'Modo Console (Imersivo)')}</strong>
                        <span>${_t('sysBootShellDesc', 'Substitui a Área de Trabalho e silencia o boot do Windows, criando uma experiência contínua e dedicada para a sua sala.')}</span>
                    </div>
                </button>
            </div>

            <div class="nav-suggestions-grid nav-startup-suggestions" id="navSuggestionsGrid">
                <button class="nav-suggestion-card" id="navCardSignIn" tabindex="-1">
                    <div class="nav-suggestion-card-btn">${_t('sysBootNoticeBtn', 'Opções de Entrada')}</div>
                    <span class="nav-suggestion-card-text">${_t('sysBootNoticeText', 'Desative a senha de login para iniciar direto no Doorpi sem teclado.')}</span>
                </button>
                <button class="nav-suggestion-card" id="navCardTaskbar" tabindex="-1">
                    <div class="nav-suggestion-card-btn">${_t('sysTaskbarNoticeBtn', 'Barra de Tarefas')}</div>
                    <span class="nav-suggestion-card-text">${_t('sysTaskbarNoticeText', 'Configure a Barra de Tarefas para ocultar automaticamente — sem distrações visuais no Modo Console.')}</span>
                </button>
                <button class="nav-suggestion-card" id="navCardGameBar" tabindex="-1">
                    <div class="nav-suggestion-card-btn">${_t('sysGameBarNoticeBtn', 'Xbox Game Bar')}</div>
                    <span class="nav-shortcut-row">
                        <span>${_t('sysDoorpiReturnShortcut', 'Retornar ao sistema')}</span>
                        ${_doorpiReturnShortcutHtml()}
                    </span>
                    <span class="nav-shortcut-row">
                        <span>${_t('sysWindowSwitcherShortcut', 'Alternar entre janelas')}</span>
                        ${_doorpiTaskSwitcherShortcutHtml()}
                    </span>
                    <span class="nav-suggestion-card-text">${_t('sysWindowSwitcherHint', 'Use o direcional para escolher, A para abrir e B para cancelar.')}</span>
                    <span class="nav-suggestion-card-text">${_t('sysGameBarNoticeText', 'Desative o atalho do botão Xbox para não abrir a overlay durante o uso do Doorpi.')}</span>
                </button>
            </div>

        </div>`;

        _decorateDoorpiReturnShortcut(body);

        window._updateBootModeUI = () => {
            const currentMode = window._doorpiBootMode || 0;
            body.querySelectorAll('.nav-radio-btn').forEach(r =>
                r.classList.toggle('active', parseInt(r.dataset.mode) === currentMode));
            body.querySelector('#navCardSignIn')?.classList.toggle('visible', currentMode === 2);
            body.querySelector('#navCardTaskbar')?.classList.toggle('visible', currentMode === 1 || currentMode === 2);
            body.querySelector('#navCardGameBar')?.classList.toggle('visible', currentMode === 1 || currentMode === 2);
            _wireSystemItems(body, [
                '#setBackSystemStartup',
                '#bootModeNone',
                '#bootModeRun',
                '#bootModeShell',
                '#navCardSignIn',
                '#navCardTaskbar',
                '#navCardGameBar'
            ]);
        };

        window._updateBootModeUI();

        body.querySelector('#setBackSystemStartup')?.addEventListener('click', () => {
            _returnFromSystemDetail();
        });
        body.querySelectorAll('.nav-radio-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = parseInt(btn.dataset.mode);
                if (typeof postToHost === 'function') postToHost({ action: 'setBootMode', mode });
                window._doorpiBootMode = mode;
                window._updateBootModeUI();
                _contentIdx = Math.max(0, _contentItems.indexOf(btn));
                _updateContentFocus();
            });
        });
        body.querySelector('#navCardSignIn')?.addEventListener('click', () => {
            _showDesktopWarning('settings', () => postToHost?.({ action: 'openSignInOptions' }));
        });
        body.querySelector('#navCardTaskbar')?.addEventListener('click', () => {
            _showDesktopWarning('settings', () => postToHost?.({ action: 'openTaskbarSettings' }));
        });
        body.querySelector('#navCardGameBar')?.addEventListener('click', () => {
            _showDesktopWarning('settings', () => postToHost?.({ action: 'openXboxGameBarSettings' }));
        });
    }

    function _renderSettingsSystemUpdatesV2(body) {
        const active = _systemUpdatesSubView || 'doorpi';
        if (active !== 'doorpi') _releaseNotesScrollActive = false;
        const doorpiActive = active === 'doorpi';
        const windowsActive = active === 'windows';
        const gpuActive = active === 'gpu';
        if (!document.getElementById('nav-system-update-tabs-styles')) {
            const s = document.createElement('style');
            s.id = 'nav-system-update-tabs-styles';
            s.textContent = `
                .nav-updates-shell { width:min(100%,1480px); display:grid; gap:18px; }
                .nav-system-tabs { width:100%; display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:0; margin:0; border-bottom:1px solid rgba(255,255,255,.1); }
                .nav-system-tab { min-height:64px; padding:10px 18px 12px; border:0; border-bottom:2px solid transparent; background:transparent; color:rgba(255,255,255,.48); font:inherit; text-align:left; outline:none; cursor:pointer; display:grid; gap:3px; }
                .nav-system-tab strong { color:inherit; font-size:.94rem; font-weight:620; }
                .nav-system-tab small { color:rgba(255,255,255,.34); font-size:.69rem; font-weight:520; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
                .nav-system-tab.active { border-bottom-color:#fff; color:#fff; background:linear-gradient(180deg,rgba(255,255,255,.045),transparent); }
                .nav-system-tab.active small { color:rgba(255,255,255,.58); }
                .nav-system-tab.nav-focused-el { color:#fff; border-bottom-color:#fff; background:rgba(255,255,255,.075); }
                .nav-update-view { display:grid; grid-template-columns:minmax(0,1fr); gap:14px; min-width:0; }
                .nav-update-view[hidden] { display:none !important; }
                .nav-update-panel { margin:0; padding:clamp(22px,2.5vw,38px); border:1px solid rgba(255,255,255,.1); border-radius:9px; background:linear-gradient(105deg,rgba(255,255,255,.06),rgba(255,255,255,.018) 76%); }
                .nav-update-overview { display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:start; gap:28px; }
                .nav-update-heading { min-width:0; padding-left:17px; border-left:3px solid rgba(255,255,255,.58); }
                .nav-update-state { display:block; margin-bottom:7px; color:rgba(255,255,255,.48); font-size:.68rem; font-weight:760; letter-spacing:.13em; text-transform:uppercase; }
                .nav-update-state[data-state="error"] { color:#e7a0a0; }
                .nav-update-heading h3 { margin:0 0 6px; color:#fff; font-size:clamp(1.25rem,1.5vw,1.75rem); font-weight:430; }
                .nav-update-heading p { margin:0; max-width:720px; color:rgba(255,255,255,.55); font-size:.87rem; line-height:1.45; }
                .nav-update-meta { display:grid; justify-items:end; gap:5px; padding-top:23px; color:rgba(255,255,255,.48); font-size:.78rem; white-space:nowrap; }
                .nav-update-list { display:grid; gap:7px; margin:18px 0 0; padding-top:12px; border-top:1px solid rgba(255,255,255,.08); color:rgba(255,255,255,.62); font-size:.84rem; line-height:1.4; }
                .nav-update-actions { display:grid; grid-template-columns:repeat(2,minmax(260px,1fr)); gap:8px; width:100%; margin:0; }
                .nav-update-actions .nav-suggestion-card { min-height:68px; padding:12px 16px; display:grid; grid-template-columns:minmax(150px,.7fr) minmax(0,1.3fr) 18px; align-items:center; gap:18px; border-radius:7px; background:rgba(255,255,255,.035); }
                .nav-update-actions .nav-suggestion-card::after { content:'›'; justify-self:end; color:rgba(255,255,255,.28); font-size:1.25rem; transition:transform .16s,color .16s; }
                .nav-update-actions .nav-suggestion-card.nav-focused-el::after { color:#fff; transform:translateX(2px); }
                .nav-update-actions .nav-suggestion-card-btn { width:auto; min-width:0; padding:0; border:0; border-radius:0; background:transparent; box-shadow:none; color:rgba(255,255,255,.9); font-size:.86rem; font-weight:630; align-self:center; }
                .nav-update-actions .nav-suggestion-card.nav-focused-el .nav-suggestion-card-btn { border:0; background:transparent; box-shadow:none; }
                .nav-update-actions .nav-suggestion-card-text { color:rgba(255,255,255,.46); font-size:.76rem; line-height:1.35; }
                .nav-update-actions .nav-update-primary { background:rgba(255,255,255,.88); color:#0a0d16; }
                .nav-update-actions .nav-update-primary .nav-suggestion-card-btn { color:#0a0d16; }
                .nav-update-actions .nav-update-primary .nav-suggestion-card-text { color:rgba(10,13,22,.62); }
                .nav-update-actions .nav-update-primary::after { color:rgba(10,13,22,.48); }
                .nav-update-actions .nav-update-primary.nav-focused-el { background:#fff !important; border-color:#fff !important; box-shadow:0 15px 32px rgba(0,0,0,.28) !important; }
                .nav-update-actions .nav-update-primary.nav-focused-el::after { color:#0a0d16; }
                .nav-update-actions .nav-gpu-app-card { min-height:210px; border-radius:8px; background:rgba(255,255,255,.032); }
                .nav-update-actions .nav-gpu-app-art { background:linear-gradient(180deg,rgba(255,255,255,.09),rgba(255,255,255,.025)); box-shadow:inset 0 1px 0 rgba(255,255,255,.06),0 16px 26px rgba(0,0,0,.15); }
                #gpuUpdateActionsGrid { grid-template-columns:minmax(0,1fr); }
                .nav-gpu-guidance,.nav-windows-guidance { display:grid; gap:7px; margin:0 0 18px; padding-left:14px; border-left:2px solid rgba(255,255,255,.38); }
                .nav-gpu-guidance p { margin:0; color:rgba(255,255,255,.56); font-size:.84rem; line-height:1.42; }
                .nav-gpu-guidance strong { color:rgba(255,255,255,.84); font-weight:650; }
                .nav-release-notes { max-height:min(34vh,350px); margin:0; padding:0 18px 2px; overflow-y:auto; border:1px solid rgba(255,255,255,.08); border-radius:7px; background:rgba(4,7,15,.16); outline:none; scroll-behavior:smooth; }
                .nav-release-notes.nav-focused-el,.nav-release-notes.is-scroll-active { border-color:rgba(255,255,255,.62); box-shadow:inset 0 0 0 1px rgba(255,255,255,.08); }
                .nav-release-notes-head { position:sticky; top:0; z-index:1; display:flex; align-items:center; justify-content:space-between; min-height:48px; background:linear-gradient(180deg,rgba(23,28,42,.99),rgba(19,23,35,.96)); color:rgba(255,255,255,.78); font-size:.72rem; font-weight:740; letter-spacing:.1em; text-transform:uppercase; }
                .nav-release-entry { padding:14px 0 16px; border-top:1px solid rgba(255,255,255,.07); }
                .nav-release-entry:first-of-type { border-top:0; }
                .nav-release-entry-title { color:#fff; font-size:1rem; font-weight:650; line-height:1.3; }
                .nav-release-entry-version { margin-left:8px; color:rgba(255,255,255,.46); font-size:.78rem; font-weight:650; }
                .nav-release-entry ul { display:grid; gap:8px; margin:10px 0 0; padding:0 0 0 20px; color:rgba(255,255,255,.66); font-size:.9rem; line-height:1.48; }
                @media(max-width:1050px){ .nav-update-actions{grid-template-columns:1fr}.nav-update-overview{grid-template-columns:1fr}.nav-update-meta{justify-items:start;padding:0 0 0 20px} }
            `;
            document.head.appendChild(s);
        }

        body.innerHTML = `
        <div class="nav-settings-subheader">
            <button class="nav-back-btn" id="setBackSystemUpdates" tabindex="-1">‹ ${_t('navBack', 'Voltar')}</button>
            <h2>${_t('updatesTitle', 'Atualizações')}</h2>
        </div>

        <div class="nav-updates-shell">
            <div class="nav-system-tabs">
                <button class="nav-system-tab ${doorpiActive ? 'active' : ''}" id="updatesTabDoorpi" data-updates-tab="doorpi" tabindex="-1"><strong>Doorpi</strong><small id="updatesTabDoorpiState">Sistema e componentes</small></button>
                <button class="nav-system-tab ${windowsActive ? 'active' : ''}" id="updatesTabWindows" data-updates-tab="windows" tabindex="-1"><strong>Windows</strong><small id="updatesTabWindowsState">Sistema operacional</small></button>
                <button class="nav-system-tab ${gpuActive ? 'active' : ''}" id="updatesTabGpu" data-updates-tab="gpu" tabindex="-1"><strong>${_t('videoCardTitle', 'Placa de vídeo')}</strong><small id="updatesTabGpuState">Drivers e atualizadores</small></button>
            </div>

            <section class="nav-update-view" data-update-panel="doorpi" ${doorpiActive ? '' : 'hidden'}>
            <div class="nav-update-panel" id="systemUpdatePanel">
                <div class="nav-update-overview">
                    <div class="nav-update-heading">
                        <span class="nav-update-state" id="systemUpdateBadge">${_t('sysUpdateBadgeUpdated', 'ATUALIZADO')}</span>
                        <h3 id="systemUpdateTitle">Doorpi</h3>
                        <p id="systemUpdateSub">${_t('sysUpdateIdle', 'Atualizações ainda não verificadas.')}</p>
                    </div>
                    <div class="nav-update-meta" id="systemUpdateVersions"></div>
                </div>
            </div>

            <div class="nav-suggestions-grid nav-update-actions" id="navUpdateActionsGrid">
                <button class="nav-suggestion-card visible" id="navCardCheckUpdates" tabindex="-1">
                    <div class="nav-suggestion-card-btn">${_t('checkDoorpi', 'Verificar Doorpi')}</div>
                    <span class="nav-suggestion-card-text">${_t('checkDoorpiDesc', 'Consulta atualizações do Doorpi, Updater e changelog.')}</span>
                </button>
                <button class="nav-suggestion-card nav-update-primary" id="navCardStartUpdate" tabindex="-1" style="display:none;">
                    <div class="nav-suggestion-card-btn">${_t('updateDoorpi', 'Atualizar Doorpi')}</div>
                    <span class="nav-suggestion-card-text">${_t('updateDoorpiDesc', 'Baixa o pacote validado, atualiza componentes e reinicia o Doorpi se necessário.')}</span>
                </button>
            </div>
            <section class="nav-release-notes" id="systemUpdateChangelog" role="region" aria-label="Notas da versão"></section>
            </section>

            <section class="nav-update-view" data-update-panel="windows" ${windowsActive ? '' : 'hidden'}>
            <div class="nav-update-panel" id="windowsUpdatePanel">
                <div class="nav-update-overview">
                    <div class="nav-update-heading">
                        <span class="nav-update-state" id="windowsUpdateBadge">WINDOWS</span>
                        <h3 id="windowsUpdateTitle">Windows Update</h3>
                        <p id="windowsUpdateSub">${_t('windowsUpdateIdle', 'Atualizações do Windows ainda não verificadas.')}</p>
                    </div>
                    <div class="nav-update-meta" id="windowsUpdateMeta"></div>
                </div>
                <div class="nav-update-list" id="windowsUpdateList"></div>
            </div>

            <div class="nav-windows-guidance">
                <p style="margin:0;color:rgba(255,255,255,.56);font-size:.84rem;line-height:1.42;"><strong style="color:rgba(255,255,255,.84);font-weight:650;">${_t('windowsUpdateAdminNoticeTitle', 'Permiss\u00e3o administrativa necess\u00e1ria.')}</strong> ${_t('windowsUpdateAdminNoticeText', 'O Windows solicitar\u00e1 autoriza\u00e7\u00e3o antes de baixar e instalar os pacotes selecionados.')}</p>
            </div>

            <div class="nav-suggestions-grid nav-update-actions" id="windowsUpdateActionsGrid">
                <button class="nav-suggestion-card visible" id="navCardCheckWindowsUpdates" tabindex="-1">
                    <div class="nav-suggestion-card-btn">${_t('checkWindows', 'Verificar Windows')}</div>
                    <span class="nav-suggestion-card-text">${_t('checkWindowsDesc', 'Consulta o Windows Update e lista os pacotes encontrados.')}</span>
                </button>
                <button class="nav-suggestion-card nav-update-primary" id="navCardStartWindowsUpdate" tabindex="-1" style="display:none;">
                    <div class="nav-suggestion-card-btn">${_t('windowsUpdateInstall', 'Baixar e instalar')}</div>
                    <span class="nav-suggestion-card-text">${_t('windowsUpdateInstallDesc', 'Usa a API do Windows Update para baixar e instalar em segundo plano.')}</span>
                </button>
                <button class="nav-suggestion-card nav-update-primary" id="navCardRestartWindows" tabindex="-1" style="display:none;">
                    <div class="nav-suggestion-card-btn">${_t('restartNow', 'Reiniciar agora')}</div>
                    <span class="nav-suggestion-card-text">${_t('windowsRestartDesc', 'Reinicia o computador para concluir atualizações pendentes.')}</span>
                </button>
                <button class="nav-suggestion-card visible" id="navCardOpenWindowsUpdate" tabindex="-1">
                    <div class="nav-suggestion-card-btn">${_t('quickOpenWindowsUpdate', 'Abrir Windows Update')}</div>
                    <span class="nav-suggestion-card-text">${_t('windowsOpenNativeDesc', 'Abre a tela nativa do Windows com mouse e teclado pelo controle.')}</span>
                </button>
            </div>
            </section>

            <section class="nav-update-view" data-update-panel="gpu" ${gpuActive ? '' : 'hidden'}>
            <div class="nav-update-panel" id="gpuUpdatePanel">
                <div class="nav-update-overview">
                    <div class="nav-update-heading">
                        <span class="nav-update-state" id="gpuUpdateBadge">GPU</span>
                        <h3 id="gpuUpdateTitle">Placa de vídeo</h3>
                        <p id="gpuUpdateSub">Dados de placa de vídeo ainda não carregados.</p>
                    </div>
                    <div class="nav-update-meta" id="gpuUpdateMeta"></div>
                </div>
                <div class="nav-update-list" id="gpuAdapterList"></div>
            </div>

            <div class="nav-gpu-guidance">
                <p><strong>${_t('gpuUpdaterAdminNoticeTitle', 'Permiss\u00e3o tempor\u00e1ria.')}</strong> ${_t('gpuUpdaterAdminNoticeText', 'Se o Windows pedir permiss\u00e3o, autorize o assistente do Doorpi para controlar instaladores elevados.')}</p>
                <p><strong>${_t('gpuUpdaterSessionNoticeTitle', 'Durante a atualiza\u00e7\u00e3o.')}</strong> ${_t('gpuUpdaterSessionNoticeText', 'N\u00e3o feche nem minimize o atualizador. Ao final, o Doorpi ser\u00e1 reiniciado para restaurar o renderizador.')}</p>
            </div>

            <div class="nav-suggestions-grid nav-update-actions" id="gpuUpdateActionsGrid"></div>
            </section>
        </div>`;

        const refreshItems = () => _wireSystemItems(body, [
            '#setBackSystemUpdates',
            '#updatesTabDoorpi',
            '#updatesTabWindows',
            '#updatesTabGpu',
            '#navCardCheckUpdates',
            '#navCardStartUpdate',
            '#navCardCheckWindowsUpdates',
            '#navCardStartWindowsUpdate',
            '#navCardRestartWindows',
            '#navCardOpenWindowsUpdate',
            '#gpuUpdateActionsGrid .nav-gpu-app-card'
        ]);

        window._updateBootModeUI = refreshItems;
        refreshItems();
        _updateSystemUpdateUI();
        _updateWindowsUpdateUI();
        _updateGpuUpdateUI();
        if (typeof postToHost === 'function') postToHost({ action: 'requestUpdateStatus' });
        if (typeof postToHost === 'function') postToHost({ action: 'requestWindowsUpdateStatus' });
        if (typeof postToHost === 'function') postToHost({ action: 'requestGpuUpdateStatus' });

        body.querySelector('#setBackSystemUpdates')?.addEventListener('click', () => {
            _returnFromSystemDetail();
        });
        body.querySelectorAll('[data-updates-tab]').forEach(btn => {
            btn.addEventListener('click', () => {
                _releaseNotesScrollActive = false;
                _systemUpdatesSubView = btn.dataset.updatesTab || 'doorpi';
                _contentIdx = _systemUpdatesSubView === 'gpu' ? 3 : (_systemUpdatesSubView === 'windows' ? 2 : 1);
                _renderContent('settings');
                _updateContentFocus();
            });
        });
        body.querySelector('#navCardCheckUpdates')?.addEventListener('click', () => {
            _systemUpdateStatus = { ..._systemUpdateStatus, status: 'checking', message: _t('quickCheckingDoorpi', 'Verificando atualizações do Doorpi...') };
            _updateSystemUpdateUI();
            postToHost?.({ action: 'checkSystemUpdates' });
        });
        body.querySelector('#navCardStartUpdate')?.addEventListener('click', () => {
            _systemUpdateStatus = { ..._systemUpdateStatus, status: 'installing', message: _t('sysUpdatePreparing', 'Preparando atualização...') };
            _updateSystemUpdateUI();
            postToHost?.({ action: 'startSystemUpdate' });
        });
        body.querySelector('#navCardCheckWindowsUpdates')?.addEventListener('click', () => {
            if (['checking', 'downloading', 'installing'].includes(_windowsUpdateStatus.status)) return;
            _windowsUpdateStatus = { ..._windowsUpdateStatus, status: 'checking', message: _t('quickCheckingWindows', 'Verificando atualizações do Windows...') };
            _updateWindowsUpdateUI();
            postToHost?.({ action: 'checkWindowsUpdates' });
        });
        body.querySelector('#navCardStartWindowsUpdate')?.addEventListener('click', () => {
            _windowsUpdateStatus = { ..._windowsUpdateStatus, status: 'downloading', message: _t('windowsUpdateDownloadingInstalling', 'Baixando e instalando atualizações do Windows...') };
            _updateWindowsUpdateUI();
            postToHost?.({ action: 'startWindowsUpdateInstall' });
        });
        body.querySelector('#navCardRestartWindows')?.addEventListener('click', () => {
            postToHost?.({ action: 'restartSystem' });
        });
        body.querySelector('#navCardOpenWindowsUpdate')?.addEventListener('click', () => {
            _showDesktopWarning('settings', () => postToHost?.({ action: 'openWindowsUpdateSettings' }));
        });
        body.querySelector('#gpuUpdateActionsGrid')?.addEventListener('click', (event) => {
            const card = event.target.closest?.('.nav-gpu-app-card');
            if (!card) return;
            const action = card.dataset.gpuAction || '';
            const updaterId = card.dataset.updaterId || '';
            if (action === 'open') {
                if (updaterId) postToHost?.({ action: 'openGpuUpdater', updaterId });
            } else if (action === 'add') {
                postToHost?.({ action: 'addGpuUpdater' });
            }
        });
    }

    async function _loadJSONs() {
        const domCards = Array.from(document.querySelectorAll('#gameGrid .card:not(.add-card)'));
        if (domCards.length > 0 && _menuData.games.length > 0) {
            const domMeta = new Map();
            domCards.forEach((c, i) => {
                domMeta.set(c.dataset.gameId, {
                    idx: i,
                    isNew: c.classList.contains('new-game')
                });
            });

            _menuData.games.forEach(item => {
                const key = item.LaunchUrl || item.Path || '';
                const meta = domMeta.get(key);
                if (meta?.isNew) item._isNew = true;
            });

            _menuData.games.sort((a, b) => {
                const aKey = a.LaunchUrl || a.Path || '';
                const bKey = b.LaunchUrl || b.Path || '';
                const aIdx = domMeta.get(aKey)?.idx ?? 999999;
                const bIdx = domMeta.get(bKey)?.idx ?? 999999;
                return aIdx - bIdx;
            });
        }
        let loadedGamesFromJson = false;
        let loadedMediaFromJson = false;
        try {
            const ts = new Date().getTime();
            const [uRes, gRes, hRes, mhRes, mRes, eRes] = await Promise.allSettled([
                fetch(`https://data.local/user.json?t=${ts}`),
                fetch(`https://data.local/games.json?t=${ts}`),
                fetch(`https://data.local/game-history.json?t=${ts}`),
                fetch(`https://data.local/media-history.json?t=${ts}`),
                fetch(`https://data.local/media.json?t=${ts}`),
                fetch(`https://data.local/emulators.json?t=${ts}`)
            ]);

            if (uRes.status === 'fulfilled' && uRes.value.ok) {
                const storedUser = await uRes.value.json();
                const liveUser = window._doorpiProfile || {};
                _menuData.user = {
                    ...storedUser,
                    ...liveUser,
                    HasSteamGridApiKey: !!(liveUser.HasSteamGridApiKey ?? storedUser.SteamGridApiKey),
                    HasPin: !!(liveUser.HasPin ?? storedUser.PinCode),
                    SteamGridApiKey: '',
                    PinCode: ''
                };
            }
            if (gRes.status === 'fulfilled' && gRes.value.ok) {
                const games = await gRes.value.json();
                _menuData.games = Array.isArray(games)
                    ? games.filter(g => !(g.IsPendingArtwork || g.isPendingArtwork) && !_isArtworkPending(g, 'games'))
                    : games;
                loadedGamesFromJson = true;
            }
            if (hRes.status === 'fulfilled' && hRes.value.ok) {
                const history = await hRes.value.json();
                _menuData.history = Array.isArray(history) ? history : [];
            }
            if (mhRes.status === 'fulfilled' && mhRes.value.ok) {
                const mediaHistory = await mhRes.value.json();
                _menuData.mediaHistory = Array.isArray(mediaHistory) ? mediaHistory : [];
            }
            if (mRes.status === 'fulfilled' && mRes.value.ok) {
                _menuData.media = await mRes.value.json();
                loadedMediaFromJson = true;
            }
            if (eRes.status === 'fulfilled' && eRes.value.ok) {
                const emulators = await eRes.value.json();
                _menuData.emulators = Array.isArray(emulators) ? emulators : [];
            }
            if ((!_menuData.emulators || _menuData.emulators.length === 0) && window._doorpiCurrentUserId) {
                try {
                    const userId = encodeURIComponent(String(window._doorpiCurrentUserId));
                    const userEmulators = await fetch(`https://data.local/users/${userId}/emulators.json?t=${ts}`);
                    if (userEmulators.ok) {
                        const emulators = await userEmulators.json();
                        _menuData.emulators = Array.isArray(emulators) ? emulators : [];
                    }
                } catch (_) { }
            }
        } catch (e) {
            console.warn("Fetch bloqueado pelo WebView (CORS). Usando fallback local...", e);
        }

        if (!_menuData.user || Object.keys(_menuData.user).length === 0) {
            _menuData.user = window._doorpiProfile || {};
        }
        const loadedUserId = _userId(_menuData.user) || window._doorpiCurrentUserId || '';
        if (loadedUserId) _menuDataUserId = loadedUserId;

        if (!loadedGamesFromJson && (!_menuData.games || _menuData.games.length === 0)) {
            const gameCards = Array.from(document.querySelectorAll('#gameGrid .card:not(.add-card)'));
            _menuData.games = gameCards.map(c => {
                let emulatorDiscPaths = [];
                try {
                    emulatorDiscPaths = JSON.parse(c.dataset.emulatorDiscPaths || '[]');
                } catch (_) { }
                return {
                    Name: c.querySelector('.title')?.innerText || '',
                    Path: c.dataset.path || c.dataset.gameId || '',
                    LaunchUrl: c.dataset.launchUrl || '',
                    EmulatorDiscPaths: Array.isArray(emulatorDiscPaths) ? emulatorDiscPaths : [],
                    GridImage: c.dataset.vertical || '',
                    GridStaticImage: c.dataset.staticVertical || ''
                };
            });
        }

        if (!loadedMediaFromJson && (!_menuData.media || _menuData.media.length === 0)) {
            const mediaCards = Array.from(document.querySelectorAll('#mediaGrid .card:not(.add-card)'));
            _menuData.media = mediaCards.map(c => ({
                Name: c.querySelector('.title')?.innerText || '',
                Url: c.dataset.gameId || c.dataset.appId || '',
                Type: 'browser',
                GridImage: c.dataset.vertical || '',
                GridStaticImage: c.dataset.staticVertical || ''
            }));
        }
    }

    function _startBlobBg() {
        const canvas = document.getElementById('navMenuBg');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        const blobs = [
            { px: 0.0, py: 0.3, sx: 0.00018, sy: 0.00013, r: 0.62, color: [45, 65, 185] },
            { px: 1.2, py: 2.1, sx: 0.00014, sy: 0.00019, r: 0.56, color: [28, 85, 210] },
            { px: 2.5, py: 0.8, sx: 0.00022, sy: 0.00011, r: 0.52, color: [70, 50, 165] },
            { px: 0.7, py: 3.4, sx: 0.00016, sy: 0.00024, r: 0.50, color: [22, 110, 175] },
            { px: 3.1, py: 1.6, sx: 0.00012, sy: 0.00017, r: 0.46, color: [90, 70, 195] },
            { px: 1.8, py: 4.2, sx: 0.00020, sy: 0.00015, r: 0.42, color: [30, 130, 190] },
        ];

        let t = 0;

        function resize() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }
        resize();
        window.addEventListener('resize', resize);

        function frame() {
            const W = canvas.width, H = canvas.height;
            ctx.clearRect(0, 0, W, H);
            ctx.fillStyle = '#07071a';
            ctx.fillRect(0, 0, W, H);

            blobs.forEach(b => {
                const x = W * (0.15 + 0.7 * (0.5 + 0.5 * Math.sin(t * b.sx + b.px)));
                const y = H * (0.10 + 0.8 * (0.5 + 0.5 * Math.sin(t * b.sy + b.py)));
                const r = Math.min(W, H) * b.r;
                const g = ctx.createRadialGradient(x, y, 0, x, y, r);
                const [cr, cg, cb] = b.color;
                g.addColorStop(0, `rgba(${cr},${cg},${cb},0.55)`);
                g.addColorStop(0.4, `rgba(${cr},${cg},${cb},0.22)`);
                g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
                ctx.fillStyle = g;
                ctx.beginPath();
                ctx.ellipse(x, y, r, r * 0.72, t * 0.00004, 0, Math.PI * 2);
                ctx.fill();
            });

            const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.85);
            vig.addColorStop(0, 'rgba(0,0,0,0)');
            vig.addColorStop(1, 'rgba(0,0,18,0.62)');
            ctx.fillStyle = vig;
            ctx.fillRect(0, 0, W, H);

            t++;
            _bgRaf = requestAnimationFrame(frame);
        }
        frame();
    }

    function _stopBlobBg() {
        if (_bgRaf) { cancelAnimationFrame(_bgRaf); _bgRaf = null; }
    }

    function _t(key, fallback, ...args) {
        try {
            if (typeof t === 'function') {
                const res = t(key, ...args);
                if (res) return res;
            }
            if (args.length > 0 && fallback) {
                return fallback.replace(/\{0\}|%d/g, args[0]);
            }
            return fallback;
        }
        catch { return fallback; }
    }

    function _esc(value) {
        return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    }

    function _storePolicyKeyFromGame(item) {
        const source = item?.Source || item?.source || '';
        if (source) return source;
        const launch = item?.LaunchUrl || item?.launchUrl || '';
        if (/^steam:/i.test(launch)) return 'Steam';
        if (/^com\.epicgames\.launcher:/i.test(launch)) return 'Epic';
        if (/^goggalaxy:/i.test(launch)) return 'GOG';
        if (/^riot/i.test(launch)) return 'Riot';
        if (/^(xbox:|ms-xbl-)/i.test(launch)) return 'Xbox';
        return '';
    }

    function _isAdminLockedGame(item) {
        if (item?.IsAdminLocked || item?.isAdminLocked) return true;
        if (window._doorpiIsAdmin || window._doorpiProfile?.IsAdmin || window._doorpiProfile?.isAdmin) return false;
        const key = _storePolicyKeyFromGame(item);
        return !!key && window._adminBlockedStoreIds instanceof Set && window._adminBlockedStoreIds.has(key);
    }

    const ADMIN_LOCK_ICON_SVG = `
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="5.5" y="10" width="13" height="10" rx="2.2" stroke="currentColor" stroke-width="2"/>
            <path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>`;

    function _userId(user) {
        if (typeof user === 'string') return user;
        return user?.Id || user?.id || user?.UserId || user?.userId || '';
    }

    function _userName(user) {
        return user?.Name || user?.name || _t('defaultUser', 'Usuario');
    }

    function _sameId(a, b) {
        return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
    }

    function _appId(app) {
        return app?.Id || app?.id || app?.Url || app?.url || '';
    }

    function _appName(app) {
        return app?.Name || app?.name || _appId(app);
    }

    function _appType(app) {
        return String(app?.Type || app?.type || app?.appType || 'browser').toLowerCase();
    }

    function _isWebAccountApp(app) {
        const type = _appType(app);
        return type === 'browser' || type === 'webview';
    }

    // ── Categorias ────────────────────────────────────────────────────────────
    const CATS = [
        { id: 'games', icon: '⊞', get label() { return _t('navGames', 'Jogos'); } },
        { id: 'media', icon: '▶', get label() { return _t('navMedia', 'Aplicativos'); } },
        { id: 'settings', icon: '⚙', get label() { return _t('navSettings', 'Configurações'); } },
        { id: 'profile', icon: '◉', get label() { return _t('navProfile', 'Perfil'); } },
    ];

    // ── Estado ────────────────────────────────────────────────────────────────
    let _catIdx = 0;
    let _topbarFocus = true;
    let _contentIdx = 0;
    let _contentItems = [];
    const _libraryFocusMemory = {
        games: { key: '', index: 0 },
        media: { key: '', index: 0 }
    };
    let _libraryHoldDirection = '';
    let _libraryHoldStartedAt = 0;
    let _libraryHoldSawNativeInput = false;
    let _libraryRapidNavigation = false;
    let _libraryHoldRaf = 0;
    let _libraryRapidScrollPane = null;
    let _libraryRapidScrollTarget = 0;
    let _libraryRapidScrollRaf = 0;
    let _overlay = null;
    let _bgRaf = null;
    let _lastFocus = null;
    let _settingsSubView = null;
    let _profileSubView = null;
    let _profileTabTransitionDirection = 'forward';
    let _profileOverviewHeroIndex = 0;
    let _profileOverviewCarouselTimer = 0;
    let _profileOverviewAdvance = null;
    let _profileOverviewCarouselPaused = false;
    let _profileOverviewStoredKind = '';
    try {
        _profileOverviewCarouselPaused = localStorage.getItem('doorpi.profile.hero.paused') === '1';
        _profileOverviewStoredKind = localStorage.getItem('doorpi.profile.hero.kind') || '';
    } catch (_) {}
    let _systemSubView = null;
    let _settingsReturnToRoot = false;
    let _systemUpdatesSubView = 'doorpi';
    let _releaseNotesScrollActive = false;
    let _sharingFocusAppId = '';
    let _sharingSubView = 'apps';
    let _sharingFocusStoreId = 'Steam';
    let _preserveSettingsSubViewOnce = false;
    let _autoStartEnabled = false;
    let _systemUpdateStatus = {
        status: 'idle',
        message: 'Atualizações ainda não verificadas.',
        localDoorpiVersion: '',
        localUpdaterVersion: '',
        remoteDoorpiVersion: '',
        remoteUpdaterVersion: '',
        doorpiUpdateAvailable: false,
        updaterUpdateAvailable: false,
        forceUpdate: false,
        lastCheckedAt: '',
        changelog: []
    };
    let _windowsUpdateStatus = {
        status: 'idle',
        message: 'Atualizações do Windows ainda não verificadas.',
        lastCheckedAt: '',
        rebootRequired: false,
        updates: [],
        packageProgress: [],
        error: ''
    };
    let _gpuUpdateStatus = {
        status: 'idle',
        message: 'Dados de placa de vídeo ainda não carregados.',
        lastCheckedAt: '',
        adapters: [],
        updaters: []
    };
    let _bluetoothUpdateStatus = null;
    let _bluetoothRenderTimer = 0;
    let _wifiUpdateStatus = null;
    const NAV_MENU_TRANSITION_MS = 600;
    let _navMenuTransitionTimer = 0;
    let _navMenuTransitionToken = 0;
    let _navMenuTransitionCleanup = null;
    let _navMenuPhase = 'closed';
    window._navMenuPhase = _navMenuPhase;
    let _navMenuLifecycleToken = 0;

    // ── Estilos ────────────────────────────────────────
    (function injectStyles() {
        if (document.getElementById('nav-menu-styles')) return;
        const s = document.createElement('style');
        s.id = 'nav-menu-styles';
        s.textContent = `
        /* ── Dual Pane (Jogos + Mídia) ── */
.nav-content-body.dual-pane-active {
    padding: 0; margin: 0; overflow: hidden;
}
#navDualPane {
    position: absolute; inset: 0; width: 100%; height: 100%;
    container-type: size; container-name: pane;
}
#navPaneGames, #navPaneMedia {
    position: absolute; inset: 0;
    overflow-y: auto; overflow-x: hidden; scrollbar-width: none;
    padding: clamp(24px, 2.4vw, 38px); box-sizing: border-box;
    transition: opacity 0.22s ease;
}
#navPaneGames::-webkit-scrollbar,
#navPaneMedia::-webkit-scrollbar { display: none; }
#navPaneGames.nav-rapid-navigation,
#navPaneMedia.nav-rapid-navigation { scroll-behavior: auto !important; }

/* Biblioteca estilo console: ações compactas e painéis ocultos por padrão. */
.nav-library-pane { padding-left: clamp(116px, 7.2vw, 154px) !important; }
.nav-library-actions {
    position: fixed;
    left: clamp(30px, 3vw, 58px);
    top: clamp(230px, 25vh, 360px);
    z-index: 45;
    display: flex;
    flex-direction: column;
    gap: clamp(14px, 1.5vh, 22px);
    opacity: 1;
    transform: translateX(0);
    transition: opacity .18s ease, transform .22s cubic-bezier(.22,1,.36,1);
}
.nav-library-action {
    position: relative;
    width: clamp(64px, 4.6vw, 88px);
    height: clamp(64px, 4.6vw, 88px);
    display: grid;
    place-items: center;
    padding: 0;
    border: 1px solid rgba(255,255,255,.10);
    border-radius: 50%;
    outline: 0;
    color: rgba(255,255,255,.78);
    background: rgba(255,255,255,.075);
    font-family: inherit;
    box-shadow: 0 14px 34px rgba(0,0,0,.24);
    cursor: pointer;
    transition: color .16s ease, background .16s ease, border-color .16s ease, transform .16s ease, box-shadow .16s ease;
}
.nav-library-action svg { width: 45%; height: 45%; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.nav-library-action > span {
    position: absolute;
    left: calc(100% + 13px);
    top: 50%;
    padding: 7px 11px;
    border-radius: 7px;
    color: #fff;
    background: rgba(13,16,30,.94);
    font-size: .78rem;
    font-weight: 600;
    opacity: 0;
    pointer-events: none;
    transform: translate(-6px,-50%);
    transition: opacity .15s ease, transform .15s ease;
    white-space: nowrap;
}
.nav-library-action.nav-focused-el {
    color: #101522;
    border-color: #fff;
    background: #fff;
    transform: scale(1.08);
    box-shadow: 0 0 0 4px rgba(255,255,255,.16), 0 18px 42px rgba(0,0,0,.36);
}
.nav-library-action.nav-focused-el > span { opacity: 1; transform: translate(0,-50%); }
.nav-library-action.has-value::after {
    content: '';
    position: absolute;
    right: 2px;
    top: 2px;
    width: 11px;
    height: 11px;
    border-radius: 50%;
    border: 2px solid rgba(8,10,20,.8);
    background: #75baff;
}
.nav-library-action-badge {
    position: absolute;
    right: -4px;
    top: -5px;
    min-width: 22px;
    height: 22px;
    padding: 0 5px;
    box-sizing: border-box;
    border-radius: 999px;
    color: #07101d;
    background: #fff;
    font-size: .68rem;
    line-height: 22px;
    text-align: center;
}
.nav-library-search-sheet {
    position: fixed;
    left: clamp(168px, 8.8vw, 230px);
    right: clamp(44px, 4vw, 84px);
    top: clamp(266px, 26vh, 390px);
    z-index: 70;
    display: flex;
    align-items: center;
    gap: 0;
    min-height: clamp(68px, 6.4vh, 90px);
    border: 1px solid rgba(255,255,255,.16);
    border-bottom-color: rgba(255,255,255,.72);
    background: rgba(255,255,255,.095);
    box-shadow: 0 18px 52px rgba(0,0,0,.22);
    opacity: 0;
    pointer-events: none;
    transform: translateY(-14px);
    transition: opacity .2s ease, transform .22s cubic-bezier(.22,1,.36,1);
}
.nav-library-search-sheet.is-open { opacity: 1; pointer-events: auto; transform: translateY(0); }
.nav-library-search-sheet::before {
    content: '';
    position: fixed;
    inset: 0;
    z-index: -1;
    background: rgba(4,6,15,.48);
    backdrop-filter: blur(15px) brightness(.78);
}
.nav-library-expanded-search {
    flex: 1;
    align-self: stretch;
    min-height: clamp(66px, 6.3vh, 88px);
    display: flex;
    align-items: center;
    gap: clamp(14px, 1.3vw, 24px);
    padding: 0 clamp(20px, 2vw, 34px);
    box-sizing: border-box;
    background: transparent;
}
.nav-library-expanded-search svg { width: clamp(28px, 2vw, 38px); height: clamp(28px, 2vw, 38px); stroke: #fff; stroke-width: 1.8; }
.nav-library-expanded-search input { min-width: 0; flex: 1; border: 0; outline: 0; color: #fff; background: transparent; font-family: inherit; font-size: clamp(1.15rem, 1.55vw, 1.75rem); font-weight: 480; }
.nav-library-expanded-search input::placeholder { color: rgba(255,255,255,.42); }
.nav-library-search-cancel {
    min-width: clamp(150px, 12vw, 230px);
    align-self: stretch;
    min-height: clamp(66px, 6.3vh, 88px);
    border: 0;
    border-left: 1px solid rgba(255,255,255,.16);
    border-radius: 0;
    outline: 0;
    color: #fff;
    background: transparent;
    font-family: inherit;
    font-size: clamp(.92rem, 1.1vw, 1.25rem);
    font-weight: 650;
}
.nav-library-search-cancel:hover,
.nav-library-search-cancel:focus { background: rgba(255,255,255,.09); }
.nav-library-pane.is-search-open .nav-library-actions {
    opacity: 0;
    transform: translateX(-18px);
    pointer-events: none;
}
.nav-library-pane .nlg-wrapper,
.nav-library-pane .nav-library-empty {
    transition: transform .34s cubic-bezier(.22,1,.36,1), opacity .24s ease;
    transform-origin: center top;
}
.nav-library-pane.is-search-open .nlg-wrapper,
.nav-library-pane.is-search-open .nav-library-empty {
    opacity: .22;
    transform: translateY(clamp(300px, 38vh, 480px));
    pointer-events: none;
}
.nav-library-filter-panel {
    --nav-library-filter-top: clamp(210px, 22vh, 330px);
    position: fixed;
    left: clamp(112px, 8.8vw, 184px);
    top: var(--nav-library-filter-top);
    z-index: 68;
    width: min(clamp(440px, 31vw, 620px), calc(100vw - 160px));
    max-height: calc(100vh - var(--nav-library-filter-top) - clamp(28px, 3vh, 52px));
    display: flex;
    flex-direction: column;
    padding: clamp(22px, 2.2vw, 34px);
    box-sizing: border-box;
    overflow: hidden;
    border: 1px solid rgba(255,255,255,.18);
    background: linear-gradient(145deg, rgba(64,72,101,.96), rgba(30,35,58,.97));
    box-shadow: 0 32px 80px rgba(0,0,0,.52);
    opacity: 0;
    pointer-events: none;
    transform: translateX(-18px) scale(.985);
    transition: opacity .18s ease, transform .2s cubic-bezier(.22,1,.36,1);
}
.nav-library-filter-panel.is-open { opacity: 1; pointer-events: auto; transform: none; }
.nav-library-filter-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 18px; padding-bottom: 18px; border-bottom: 1px solid rgba(255,255,255,.2); }
.nav-library-filter-head span { color: rgba(255,255,255,.52); font-size: .78rem; }
.nav-library-filter-head h3 { margin: 2px 0 0; color: #fff; font-size: clamp(1.35rem, 1.8vw, 2rem); font-weight: 480; }
.nav-library-filter-list {
    min-height: 0;
    display: grid;
    gap: 5px;
    padding: 12px 4px 12px 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-width: thin;
    scrollbar-color: rgba(255,255,255,.28) transparent;
}
.nav-library-filter-list::-webkit-scrollbar { width: 6px; }
.nav-library-filter-list::-webkit-scrollbar-track { background: transparent; }
.nav-library-filter-list::-webkit-scrollbar-thumb { border-radius: 999px; background: rgba(255,255,255,.28); }
.nav-library-filter-option {
    min-height: clamp(62px, 5.7vh, 82px);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
    padding: 10px 14px;
    border: 1px solid transparent;
    border-radius: 7px;
    outline: 0;
    color: #fff;
    background: transparent;
    font: inherit;
    text-align: left;
}
.nav-library-filter-copy { min-width: 0; display: grid; gap: 2px; }
.nav-library-filter-copy strong { overflow: hidden; font-size: clamp(.95rem, 1.08vw, 1.2rem); font-weight: 520; text-overflow: ellipsis; white-space: nowrap; }
.nav-library-filter-copy small { color: rgba(255,255,255,.48); font-size: .72rem; }
.nav-library-filter-option.nav-focused-el { border-color: #fff; background: rgba(255,255,255,.16); box-shadow: 0 0 0 2px rgba(255,255,255,.14); }
.nav-library-switch { width: 48px; height: 27px; flex: 0 0 48px; padding: 3px; box-sizing: border-box; border: 1px solid rgba(255,255,255,.24); border-radius: 999px; background: rgba(0,0,0,.24); }
.nav-library-switch i { display: block; width: 19px; height: 19px; border-radius: 50%; background: rgba(255,255,255,.55); transition: transform .18s ease, background .18s ease; }
.nav-library-filter-option.selected .nav-library-switch { border-color: rgba(255,255,255,.8); background: rgba(255,255,255,.24); }
.nav-library-filter-option.selected .nav-library-switch i { background: #fff; transform: translateX(20px); }
.nav-library-filter-footer { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding-top: 15px; border-top: 1px solid rgba(255,255,255,.16); }
.nav-library-filter-footer button {
    min-height: 52px;
    border: 1px solid rgba(255,255,255,.13);
    border-radius: 999px;
    outline: 0;
    color: #fff;
    background: rgba(255,255,255,.075);
    font-family: inherit;
    font-size: .86rem;
    font-weight: 650;
}
.nav-library-filter-footer button.nav-focused-el { color: #121827; border-color: #fff; background: #fff; box-shadow: 0 0 0 3px rgba(255,255,255,.14); }
.nav-library-empty { min-height: 58%; display: grid; place-content: center; gap: 8px; text-align: center; color: rgba(255,255,255,.58); }
.nav-library-empty strong { color: #fff; font-size: clamp(1.1rem, 1.45vw, 1.7rem); font-weight: 550; }
.nav-library-empty span { font-size: clamp(.82rem, .95vw, 1.1rem); }
/* ── Lazy Grid Skeleton & Shimmer ── */
.nlg-wrapper { width: 100%; }
.nlg-grid { padding-bottom: 80px; }

.nav-vertical-card.nav-skeleton img,
.nav-vertical-card.nav-skeleton .nav-vertical-card-no-img { display: none; }

.nlg-skeleton-bg {
    position: absolute; inset: 0;
    border-radius: inherit;
    background: rgba(255,255,255,0.04);
    overflow: hidden;
}
.nlg-skeleton-bg::after {
    content: '';
    position: absolute; inset: 0;
    background: linear-gradient(
        90deg,
        transparent 0%,
        rgba(255,255,255,0.07) 40%,
        rgba(255,255,255,0.12) 50%,
        rgba(255,255,255,0.07) 60%,
        transparent 100%
    );
    background-size: 200% 100%;
    animation: nlg-shimmer 2s ease-in-out infinite;
}
@keyframes nlg-shimmer {
    0%   { background-position:  200% 0; }
    100% { background-position: -200% 0; }
}

/* Skeleton cards still show title and border on focus */
.nav-vertical-card.nav-skeleton.nav-focused { border-color: rgba(255,255,255,0.6); }
.nav-vertical-card.nav-skeleton.nav-focused .nav-card-gradient { opacity: 1; }
.nav-vertical-card.nav-skeleton.nav-focused .nav-vertical-card-title { opacity: 1; transform: translateY(0); }

/* ── Toggle Iniciar com o Windows ── */
.nav-toggle {
    width: 52px; height: 28px; border-radius: 999px;
    background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.14);
    position: relative; flex-shrink: 0; align-self: center;
    transition: background 0.25s ease, border-color 0.25s ease;
    pointer-events: none;
}
.nav-toggle.on  { background: rgba(100,220,120,0.28); border-color: rgba(100,220,120,0.55); }
.nav-toggle-thumb {
    position: absolute; top: 3px; left: 3px;
    width: 20px; height: 20px; border-radius: 50%;
    background: rgba(255,255,255,0.38);
    transition: transform 0.25s cubic-bezier(0.34,1.56,0.64,1), background 0.25s;
}
.nav-toggle.on .nav-toggle-thumb { transform: translateX(24px); background: #6ee696; }

/* ── Estilos dos Atalhos no Modal de Edição ── */
.edit-shortcuts-grid { display: flex; flex-direction: column; gap: 12px; margin-top: 4px; }
.edit-shortcut-card {
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
    border-radius: 12px; padding: 12px 14px; display: flex; align-items: center; gap: 14px;
    cursor: pointer; outline: none; text-align: left; transition: all 0.2s cubic-bezier(0.25, 1, 0.5, 1);
    color: inherit; font-family: inherit;
}
.edit-shortcut-icon { width: 32px; height: 32px; flex-shrink: 0; color: rgba(255,255,255,0.4); transition: color 0.2s; }
.edit-shortcut-icon svg { width: 100%; height: 100%; }
.edit-shortcut-info { flex: 1; display: flex; flex-direction: column; gap: 4px; }
.edit-shortcut-info h4 { margin: 0; font-size: 0.95rem; font-weight: 500; color: #fff; line-height: 1.1; letter-spacing: 0.01em;}
.edit-shortcut-info p { margin: 0; font-size: 0.75rem; color: rgba(255,255,255,0.45); line-height: 1.3; }

.edit-shortcut-card:hover, .edit-shortcut-card:focus {
    transform: translateY(-2px) scale(1.02);
    background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.4); box-shadow: 0 8px 24px rgba(0,0,0,0.3);
}
.edit-shortcut-card:hover .edit-shortcut-icon, .edit-shortcut-card:focus .edit-shortcut-icon { color: #fff; }

/* ── Overlay Transição ── */
#navMenuOverlay {
    content-visibility: visible; contain: layout paint style; isolation: isolate;
    position: fixed; inset: 0; z-index: 8000;
    display: none; opacity: 1; pointer-events: none;
    font-family: 'Inter', 'Segoe UI', sans-serif;
    transform: translate3d(0, 100%, 0);
    transition: transform 0.60s cubic-bezier(0.16, 1, 0.3, 1);
    backface-visibility: hidden;
}
#navMenuOverlay.visible { transform: translate3d(0, 0, 0); pointer-events: auto; }
#navMenuOverlay.nav-menu-animating { will-change: transform; }
#navMenuOverlay.nav-menu-input-released { pointer-events: none; }
#navMenuBg { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 0; pointer-events: none; transform: translateZ(0); }

.top-profile-btn.nav-menu-hidden { opacity: 0 !important; pointer-events: none !important; transition: opacity 0.3s ease; }

.nav-layout { position: relative; z-index: 1; display: flex; flex-direction: column; width: 100%; height: 100%; contain: layout paint style; transform: translateZ(0); }
#navMenuOverlay.visible .nav-layout { transform: translateZ(0); }
.nav-topbar { display: flex; align-items: center; padding-top: clamp(5rem, 5vh, 5rem); gap: clamp(12px, 2vw, 40px); flex-shrink: 0; flex-direction: column; }
.nav-cat-list { display: flex; gap: clamp(16px, 2.5vw, 40px); }

.nav-cat-item {
    display: flex; align-items: center; gap: 10px; padding: 10px;
    cursor: pointer; outline: none; border: 1px solid transparent; border-radius: 8px; background: none;
    font-family: inherit; color: rgba(255,255,255,0.35); position: relative; transition: color 0.2s ease;
}
.nav-cat-item::after { content: none; }
.nav-cat-item.active { color: #fff; }
.nav-cat-item.nav-focused { color: #fff; border-color: rgba(255,255,255,.92); }
.nav-cat-label { font-size: clamp(.92rem, 1.08vw, 1.12rem); font-weight: 500; letter-spacing: 0.02em; }

.nav-content {
    --nav-focus-gutter: clamp(26px, 2vw, 46px);
    flex: 1; display: flex; flex-direction: column;
    padding: clamp(10px, 2vh, 40px) clamp(20px, 3vw, 60px);
    overflow: hidden;
    position: relative;
    min-width: 0;
    min-height: 0;
}
.nav-content-header {
    position: relative; z-index: 1;
    margin-bottom: clamp(20px, 3vh, 32px); flex-shrink: 0; text-align: left;
    animation: fadeInTop 0.4s cubic-bezier(0.2, 0.9, 0.3, 1) forwards;
}
.nav-content-title { font-size: clamp(1.65rem, 2.5vw, 3.6rem); font-weight: 300; color: #fff; margin: 0 0 6px; letter-spacing: -0.01em; }
.nav-content-subtitle { font-size: clamp(1rem, 1.08vw, 1.3rem); color: rgba(255,255,255,0.48); margin: 0; font-weight: 400; }

.nav-content-body {
    flex: 1; margin: 0; padding: 10px var(--nav-focus-gutter) 42px;
    overflow-x: visible;
    overflow-y: auto;
    min-height: 0;
    position: relative;
    scrollbar-width: none;
    scroll-padding: 18px var(--nav-focus-gutter) 46px;
    box-sizing: border-box;
}
.nav-content-body::-webkit-scrollbar { display: none; }
.nav-content-body.dual-pane-active { padding: 0; scroll-padding: 0; }

@keyframes fadeInTop { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: none; } }

/* ── Grid Premium Comum (Jogos/Apps) ── */

/* SUBSTITUA O .nav-big-grid POR ISSO: */
.nav-big-grid {
    --gap-x: clamp(20px, 1.8vw, 30px);
    --gap-y: clamp(32px, 3vw, 54px);

    --rows: 2;

    --padding-y: clamp(30px, 3.8vh, 52px);
    --available-h: calc(100cqh - var(--padding-y));
    --total-gap-h: calc(var(--gap-y) * (var(--rows) - 1));

    /* 🔹 Subtrai 1px para evitar que dízimas infinitas do Windows quebrem o grid */
    --card-h-raw: calc(((var(--available-h) - var(--total-gap-h)) / var(--rows)) - 1px);
    --card-h-limit: clamp(300px, 32vh, 440px);
    --card-h: min(var(--card-h-raw), var(--card-h-limit));
    --card-w: calc(var(--card-h) * (2 / 3));

    display: grid;
    grid-template-columns: repeat(auto-fill, var(--card-w));
    column-gap: var(--gap-x);
    row-gap: var(--gap-y);
    justify-content: center;
    align-content: start;
    margin: 0; padding-top: 0;
    animation: fadeInTop 0.4s ease;
}

/* 🔹 Escada Matemática: Adiciona +1 linha conforme a tela cresce para manter a capa no tamanho perfeito */
@container pane (max-height: 480px) { .nav-big-grid { --rows: 1; } } /* Somente para janelas super amassadas */
@container pane (min-height: 1320px) { .nav-big-grid { --rows: 3; } }
@container pane (min-height: 1900px) { .nav-big-grid { --rows: 4; } }
@container pane (min-height: 2500px) { .nav-big-grid { --rows: 5; } }

.nav-vertical-card {
    box-sizing: border-box; /* 🔹 Isso obriga a borda de 2px a nascer para DENTRO do card, não para fora */
    aspect-ratio: 2/3; border-radius: 8px; overflow: hidden;
    background: rgba(255,255,255,0.03); border: 2px solid transparent;
    cursor: pointer; outline: none; position: relative; display: flex; flex-direction: column;
    transition: transform 0.2s cubic-bezier(0.25, 1, 0.5, 1), box-shadow 0.2s ease, border-color 0.2s ease;

}
.nav-vertical-card img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; display: block; }
.nav-vertical-card.new-game::before {
    content: 'NOVO'; position: absolute; top: 7px; left: 7px; z-index: 20;
    background: #fff; color: #06060e; font-size: clamp(7px, 0.6vmin, 10px); font-weight: 800;
    letter-spacing: 0.18em; padding: 3px 7px 4px; border-radius: 3px; box-shadow: 0 2px 10px rgba(0,0,0,0.6);
}
.nav-vertical-card-no-img { flex: 1; display: flex; align-items: center; justify-content: center; color: rgba(255,255,255,0.1); font-size: clamp(3rem, 4vw, 5rem); z-index: 1; }
.nav-card-gradient {
    position: absolute; bottom: 0; left: 0; right: 0; height: 60%;
    background: linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.5) 40%, transparent 100%);
    z-index: 2; opacity: 0; transition: opacity 0.2s ease;
}
.nav-vertical-card-title {
    position: absolute; bottom: 0; left: 0; right: 0; font-size: clamp(0.75rem, 0.85vw, 1rem);
    color: #fff; padding: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; z-index: 3;
    font-weight: 500; opacity: 0; transform: translateY(10px); transition: opacity 0.2s ease, transform 0.2s ease;
    text-shadow: 0 2px 4px rgba(0,0,0,0.8); text-align: end;
}
.nav-vertical-card.nav-focused { transform: scale(1.05);box-shadow: 0 15px 40px rgba(0,0,0,0.8); border-color: #fff; z-index: 10; }
.nav-vertical-card.nav-focused .nav-card-gradient { opacity: 1; }
.nav-vertical-card.nav-focused .nav-vertical-card-title { opacity: 1; transform: translateY(0); }

/* ── HUB de Perfil (Visual Cinemático) ── */
.nav-content-body.profile-showcase-active { display: flex; flex-direction: column; align-items: center; overflow: hidden; }
.nav-profile-showcase { width: 100%; height: 100%; max-width: min(1900px, 100%); max-height: 100%; margin-inline: auto; display: flex; flex-direction: column; gap: clamp(10px, 1.35vh, 22px); overflow: hidden; animation: fadeInTop 0.3s ease; box-sizing: border-box; }
.nav-profile-cover { width: 100%; min-height: 0; height: clamp(270px, 36%, 470px); flex: 0 0 auto; position: relative; overflow: hidden; border-radius: clamp(14px, 1vw, 20px); border: 1px solid rgba(255,255,255,.1); background: linear-gradient(135deg, rgba(255,255,255,.07), rgba(255,255,255,.025)); box-shadow: 0 24px 70px rgba(0,0,0,.26); box-sizing: border-box; }
.nav-profile-cover-art { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: center 40%; opacity: .7; filter: saturate(.94) contrast(.98); transform: scale(1.002); }
.nav-profile-cover::after { content: ""; position: absolute; inset: 0; background: linear-gradient(90deg, rgba(6,9,19,.92) 0%, rgba(6,9,19,.62) 30%, rgba(6,9,19,.12) 58%, rgba(6,9,19,.42) 100%), linear-gradient(0deg, rgba(2,5,13,.76) 0%, rgba(2,5,13,.08) 56%, rgba(2,5,13,.2) 100%); }
.nav-profile-header { position: absolute; z-index: 2; left: 0; bottom: 0; width: min(54%, 800px); display: flex; align-items: center; gap: clamp(14px, 1.8vw, 32px); justify-content: flex-start; padding: clamp(24px, 2.7vw, 52px); margin-bottom: 0; box-sizing: border-box; }
.nav-profile-avatar-large { 
    width: clamp(70px, 12vh, 120px); height: clamp(70px, 12vh, 120px); 
    border-radius: 50%; border: 3px solid rgba(255,255,255,0.15); box-shadow: 0 15px 40px rgba(0,0,0,0.5); 
    overflow: hidden; display:flex; align-items:center; justify-content:center; font-size: 2.5rem; 
    background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.3); flex-shrink: 0;
}
.nav-profile-avatar-large img { width: 100%; height: 100%; object-fit: cover; }
.nav-profile-info { flex: 1; display: flex; flex-direction: column; gap: 8px; justify-content: center; }
.nav-profile-name { font-size: clamp(1.6rem, 2.8vw, 4rem); font-weight: 300; margin: 0; color: #fff; letter-spacing: -0.02em; line-height: 1.1; }
.nav-profile-edit-btn {
    background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 30px;
    padding: 12px 24px; color: #fff; font-size: 1rem; font-family: inherit; cursor: pointer; outline: none;
    transition: all 0.2s cubic-bezier(0.25, 1, 0.5, 1); font-weight: 500; position: absolute; z-index: 3; top: clamp(18px, 1.7vw, 32px); right: clamp(18px, 1.7vw, 32px);
}
.nav-profile-edit-btn.nav-focused-el { background: #fff; color: #000; transform: scale(1.05); box-shadow: 0 10px 30px rgba(255,255,255,0.2); }
.nav-profile-cover-game { position: absolute; z-index: 2; right: clamp(26px, 3vw, 58px); bottom: clamp(26px, 2.7vw, 52px); width: min(38%, 560px); display: flex; flex-direction: column; align-items: flex-end; gap: clamp(5px, .6vh, 9px); color: #fff; text-align: right; }
.nav-profile-cover-game-kicker { color: rgba(255,255,255,.58); font-size: clamp(.68rem, .72vw, .84rem); font-weight: 700; letter-spacing: .14em; text-transform: uppercase; }
.nav-profile-cover-game-title { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: clamp(1.25rem, 1.7vw, 2.2rem); font-weight: 520; line-height: 1.08; letter-spacing: -.02em; text-shadow: 0 2px 16px rgba(0,0,0,.5); }
.nav-profile-cover-game-meta { display: flex; align-items: center; justify-content: flex-end; gap: 9px; color: rgba(255,255,255,.72); font-size: clamp(.78rem, .86vw, 1rem); font-weight: 550; }
.nav-profile-cover-game-platform { width: clamp(18px, 1.35vw, 24px); height: clamp(18px, 1.35vw, 24px); display: grid; place-items: center; opacity: .86; }
.nav-profile-cover-game-platform svg { width: 100%; height: 100%; }
.nav-profile-section-head { width: 100%; box-sizing: border-box; display: flex; align-items: flex-end; justify-content: space-between; gap: 18px; border-bottom: 1px solid rgba(255,255,255,0.1); margin-top: 10px; }
.nav-profile-section-head .nav-profile-section-title { border-bottom: 0; margin-top: 0; padding-bottom: 12px; }
.nav-profile-journey-btn { margin-bottom: 8px; padding: 7px 13px; border: 1px solid rgba(255,255,255,.14); border-radius: 6px; background: rgba(255,255,255,.055); color: rgba(255,255,255,.66); font: inherit; font-size: clamp(.72rem, .78vw, .9rem); font-weight: 600; outline: none; transition: background .16s ease, color .16s ease, border-color .16s ease, transform .16s ease; }
.nav-profile-journey-btn.nav-focused-el { background: rgba(255,255,255,.16); border-color: #fff; color: #fff; transform: translateY(-2px); }

.nav-profile-history-view { width: min(100%, 1180px); display: flex; flex-direction: column; gap: clamp(18px, 2.4vh, 32px); animation: fadeInTop 0.3s ease; }
.nav-profile-history-head { display: flex; align-items: center; gap: clamp(18px, 2vw, 30px); }
.nav-profile-history-head h2 { margin: 0 0 4px; font-size: clamp(1.4rem, 2.2vw, 2.8rem); font-weight: 350; color: #fff; }
.nav-profile-history-head p { margin: 0; color: rgba(255,255,255,.46); font-size: clamp(.78rem, .9vw, 1rem); }
.nav-profile-history-list { display: flex; flex-direction: column; gap: 8px; padding: 4px 10px 60px 4px; }
.nav-profile-history-row { width: 100%; min-height: clamp(72px, 8vh, 104px); display: grid; grid-template-columns: clamp(112px, 12vw, 180px) minmax(0, 1fr) auto; align-items: center; gap: clamp(16px, 2vw, 30px); padding: 8px clamp(14px, 1.5vw, 24px) 8px 8px; border: 1px solid rgba(255,255,255,.08); border-radius: 8px; background: rgba(255,255,255,.035); color: #fff; font: inherit; text-align: left; outline: none; transition: background .16s ease, border-color .16s ease, transform .16s ease; }
.nav-profile-history-row.nav-focused-el { background: rgba(255,255,255,.11); border-color: rgba(255,255,255,.76); transform: translateX(8px); }
.nav-profile-history-art { width: 100%; aspect-ratio: 92/43; display: grid; place-items: center; overflow: hidden; border-radius: 6px; background: rgba(0,0,0,.32); }
.nav-profile-history-art img { width: 100%; height: 100%; object-fit: cover; }
.nav-profile-history-art img.is-icon { object-fit: contain; padding: 16%; }
.nav-profile-history-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: clamp(.95rem, 1.25vw, 1.45rem); font-weight: 550; }
.nav-profile-history-time { color: rgba(255,255,255,.66); font-size: clamp(.82rem, 1vw, 1.12rem); font-variant-numeric: tabular-nums; white-space: nowrap; }
.nav-profile-history-empty { padding: 50px 0; color: rgba(255,255,255,.35); }

.nav-profile-stats-row { width: 100%; min-height: clamp(82px, 9vh, 112px); box-sizing: border-box; display: grid; grid-template-columns: minmax(190px, .72fr) minmax(220px, .9fr) minmax(360px, 1.65fr); gap: 0; padding: clamp(8px, .75vw, 14px); border: 1px solid rgba(255,255,255,.09); border-radius: clamp(12px, .85vw, 17px); background: linear-gradient(100deg, rgba(255,255,255,.045), rgba(255,255,255,.018)); box-shadow: 0 16px 42px rgba(0,0,0,.14); overflow: hidden; }
.nav-profile-stat-box {
    min-width: 0; position: relative; padding: clamp(8px, .8vh, 13px) clamp(18px, 1.5vw, 30px); display: flex; flex-direction: row; gap: clamp(12px, 1vw, 18px);
    align-items: center; text-align: left;
}
.nav-profile-stat-box + .nav-profile-stat-box::before { content: ""; position: absolute; left: 0; top: 14%; bottom: 14%; width: 1px; background: linear-gradient(transparent, rgba(255,255,255,.13), transparent); }
.nav-profile-stat-box.future-placeholder { opacity: 0.35; }
.nav-profile-stat-icon { width: clamp(38px, 2.8vw, 52px); height: clamp(38px, 2.8vw, 52px); flex: none; display: grid; place-items: center; color: rgba(255,255,255,.78); border-radius: 50%; background: rgba(255,255,255,.065); border: 1px solid rgba(255,255,255,.08); }
.nav-profile-stat-icon svg { width: 52%; height: 52%; }
.nav-profile-stat-box.nav-profile-last-stat { min-width: 0; justify-content: flex-start; gap: clamp(12px, 1.1vw, 20px); text-align: left; }
.nav-profile-stat-thumb { width: clamp(88px, 7vw, 132px); aspect-ratio: 92/43; border-radius: 8px; overflow: hidden; flex: none; display: grid; place-items: center; background: rgba(0,0,0,.28); border: 1px solid rgba(255,255,255,.08); }
.nav-profile-stat-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.nav-profile-stat-thumb .nav-profile-stat-platform { width: 42%; height: 42%; opacity: .75; }
.nav-profile-stat-copy { min-width: 0; display: flex; flex-direction: column; gap: clamp(3px, .4vh, 6px); }
.nav-profile-stat-copy .stat-value { font-size: clamp(1.25rem, 1.65vw, 2rem); font-weight: 350; line-height: 1.05; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.nav-profile-stat-copy .stat-label { order: -1; font-size: clamp(.66rem, .7vw, .82rem); }
.nav-profile-last-name { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #fff; font-size: clamp(.94rem, 1.12vw, 1.36rem); font-weight: 600; line-height: 1.16; }
.nav-profile-last-meta { min-width: max-content; margin-left: auto; padding-left: clamp(10px, 1vw, 18px); display: flex; flex-direction: column; align-items: flex-end; gap: 3px; color: rgba(255,255,255,.78); text-align: right; font-variant-numeric: tabular-nums; }
.nav-profile-last-meta strong { font-size: clamp(.88rem, 1vw, 1.16rem); font-weight: 560; }
.nav-profile-last-meta small { color: rgba(255,255,255,.43); font-size: clamp(.66rem, .7vw, .8rem); font-weight: 550; text-transform: capitalize; }
.nav-profile-last-stat > .stat-value { min-width: 0; display: block; text-align: left !important; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: clamp(.92rem, 1.12vw, 1.42rem) !important; font-weight: 560; line-height: 1.18 !important; }
.nav-profile-last-stat > .stat-value::after { content: "Último jogado"; display: block; margin-top: 5px; color: rgba(255,255,255,0.5); font-size: clamp(0.7rem, 0.8vw, 0.85rem); text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; }
.nav-profile-last-stat > .stat-label { display: none; }
.stat-value { font-size: clamp(1.4rem, 2.2vw, 2.8rem); font-weight: 200; color: #fff; line-height: 1; }
.stat-label { font-size: clamp(0.7rem, 0.8vw, 0.85rem); color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; }
.nav-profile-section-title { font-size: 1.3rem; font-weight: 400; color: #fff; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 12px; margin-top: 10px;}

.nav-profile-hero {
    min-height: clamp(124px, 17vh, 220px); border-radius: 14px; overflow: hidden; position: relative;
    border: 1px solid rgba(255,255,255,.11); background: linear-gradient(135deg, rgba(255,255,255,.08), rgba(255,255,255,.025));
    box-shadow: 0 20px 55px rgba(0,0,0,.28);
}
.nav-profile-hero img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: .72; }
.nav-profile-hero::after {
    content: ""; position: absolute; inset: 0;
    background: linear-gradient(90deg, rgba(8,10,19,.92) 0%, rgba(8,10,19,.68) 42%, rgba(8,10,19,.16) 100%),
                linear-gradient(0deg, rgba(0,0,0,.44), transparent 62%);
}
.nav-profile-hero-content { position: relative; z-index: 2; height: 100%; min-height: inherit; display: flex; flex-direction: column; justify-content: flex-end; align-items: flex-start; padding: clamp(18px, 2.3vw, 34px); color: #fff; max-width: min(62%, 620px); }
.nav-profile-hero-kicker { margin-bottom: 8px; color: rgba(255,255,255,.54); font-size: clamp(.68rem, .76vw, .86rem); font-weight: 720; letter-spacing: .14em; text-transform: uppercase; }
.nav-profile-hero-title { margin: 0; font-size: clamp(1.28rem, 2.15vw, 3rem); font-weight: 520; line-height: 1.04; letter-spacing: -.025em; text-shadow: 0 10px 25px rgba(0,0,0,.45); }
.nav-profile-hero-meta { margin-top: 12px; display: flex; align-items: center; gap: 10px; color: rgba(255,255,255,.68); font-size: clamp(.78rem, .9vw, 1rem); font-weight: 560; }
.nav-profile-hero-meta .nav-profile-hero-platform { width: clamp(18px, 1.5vw, 24px); height: clamp(18px, 1.5vw, 24px); opacity: .86; }

/* ── Cards Recentes ── */
.nav-profile-recent-grid {
    width: 100%; box-sizing: border-box;
    flex: 1 1 0; min-height: 0; overflow: hidden; align-content: start;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(clamp(150px, min(11.5vw, 19vh), 230px), 1fr));
    gap: clamp(12px, 1vw, 22px); padding: 8px;
}
.nav-profile-recent-card {
    aspect-ratio: 2/3; border-radius: 8px; overflow: hidden; background: rgba(255,255,255,0.03); border: 2px solid transparent;
    position: relative; display: flex; flex-direction: column; transition: transform 0.2s cubic-bezier(0.25, 1, 0.5, 1), box-shadow 0.2s ease;
}
.nav-profile-recent-card.is-top-played { grid-row: span 2; aspect-ratio: 2/3; border-color: rgba(255,255,255,.22); box-shadow: 0 22px 52px rgba(0,0,0,.38); }
.nav-profile-recent-card.is-top-played .nav-profile-recent-title { font-size: clamp(1.02rem, 1.32vw, 1.7rem); max-width: 92%; }
.nav-profile-top-badge { position: absolute; top: clamp(9px, 1vw, 16px); left: clamp(9px, 1vw, 16px); z-index: 4; width: clamp(30px, 2.25vw, 42px); height: clamp(30px, 2.25vw, 42px); display: grid; place-items: center; border-radius: 999px; color: rgba(255,255,255,.86); background: linear-gradient(135deg, rgba(255,255,255,.22), rgba(255,255,255,.07)); border: 1px solid rgba(255,255,255,.24); box-shadow: 0 12px 30px rgba(0,0,0,.32), inset 0 0 18px rgba(255,255,255,.06); opacity: .88; pointer-events: none; transition: transform .2s ease, opacity .2s ease, background .2s ease; }
.nav-profile-top-badge svg { width: 58%; height: 58%; display: block; }
.nav-profile-recent-card.nav-focused-el .nav-profile-top-badge { opacity: 1; transform: translateY(-2px) scale(1.04); background: linear-gradient(135deg, rgba(255,255,255,.32), rgba(255,255,255,.1)); }
.nav-profile-recent-card img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; display: block; }
.nav-profile-recent-card.nav-focused-el { transform: scale(1.05); box-shadow: 0 15px 40px rgba(0,0,0,0.6); z-index: 10; }
.nav-profile-recent-card .nav-card-gradient {
    position: absolute; inset: 0; height: 100%; background: linear-gradient(to top, rgba(0,0,0, 0.9) 0%, rgba(0,0,0, 0.4) 50%, rgba(0,0,0,0.1) 100%);
    backdrop-filter: blur(3px); z-index: 2; opacity: 0; transition: opacity 0.3s ease;
}
.nav-profile-recent-card.nav-focused-el .nav-card-gradient { opacity: 1; }
.nav-profile-recent-info {
    position: absolute; inset: 0; padding: clamp(10px, 1.2vw, 16px);
    display: flex; flex-direction: column; justify-content: space-between;
    opacity: 0; transform: translateY(10px); transition: all 0.3s ease; z-index: 3; color: #fff;
}
.nav-profile-recent-card.nav-focused-el .nav-profile-recent-info { opacity: 1; transform: translateY(0); }
.nav-profile-recent-platform-icon { width: clamp(20px, 2vw, 28px); height: clamp(20px, 2vw, 28px); align-self: flex-end; opacity: 0.9; }
.nav-profile-recent-text { display: flex; flex-direction: column; gap: 4px; text-align: left; }
.nav-profile-recent-title {
    font-size: clamp(0.9rem, 1.1vw, 1.2rem); font-weight: 600; line-height: 1.2;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-shadow: 0 2px 4px rgba(0,0,0,0.8);
}
.nav-profile-recent-date { font-size: clamp(0.7rem, 0.8vw, 0.85rem); color: rgba(255,255,255,0.6); font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; }

@media (max-height: 1080px) {
    .nav-content-body.profile-showcase-active { overflow-y: hidden; padding-bottom: 10px; }
    .nav-profile-showcase { width: 100%; height: 100%; max-height: 100%; gap: clamp(8px, 1.2vh, 14px); }
    .nav-profile-cover { min-height: 0; height: clamp(250px, 37%, 330px); flex: 0 0 auto; border-radius: 12px; }
    .nav-profile-header { padding: clamp(18px, 2vw, 32px); gap: clamp(12px, 1.8vw, 28px); }
    .nav-profile-avatar-large { width: clamp(62px, 9vh, 96px); height: clamp(62px, 9vh, 96px); }
    .nav-profile-name { font-size: clamp(1.5rem, 2.35vw, 3rem); }
    .nav-profile-edit-btn { padding: 8px 18px; font-size: .9rem; }
    .nav-profile-stats-row { flex: 0 0 auto; min-height: 78px; gap: 0; padding: 6px 8px; }
    .nav-profile-stat-box { min-height: 58px; padding: 8px clamp(13px, 1.2vw, 22px); gap: clamp(9px, .8vw, 14px); }
    .nav-profile-stat-thumb { width: clamp(78px, 6vw, 108px); }
    .nav-profile-cover-game { right: clamp(22px, 2.5vw, 40px); bottom: clamp(22px, 2.2vw, 36px); }
    .nav-profile-section-head { flex: 0 0 auto; margin-top: 0; min-height: 36px; }
    .nav-profile-section-head .nav-profile-section-title { padding-bottom: 7px; }
    .nav-profile-journey-btn { margin-bottom: 5px; padding: 5px 11px; }
    .nav-profile-recent-grid { flex: 1 1 auto; min-height: 0; overflow: visible; align-content: start; gap: clamp(8px, 1vw, 14px); padding: 10px 8px 8px; box-sizing: border-box; }
    .nav-profile-recent-card.is-top-played { grid-row: span 1; }
}

/* ── Dashboard de Configurações ── */
.nav-settings-grid {
    --settings-focus-pad-y: clamp(16px, 1.8vh, 28px);
    --settings-focus-pad-x: clamp(20px, 2vw, 36px);
    --settings-card-w: clamp(320px, 22vw, 380px);
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(0, var(--settings-card-w)));
    justify-content: start;
    gap: clamp(12px, 1.5vh, 24px);
    animation: fadeInTop 0.4s ease;
    width: min(100%, 1400px);
    padding: var(--settings-focus-pad-y) var(--settings-focus-pad-x) clamp(20px, 2vh, 34px);
    margin: calc(var(--settings-focus-pad-y) * -1) calc(var(--settings-focus-pad-x) * -1) 0;
    box-sizing: border-box;
}
.nav-settings-grid.nav-connectivity-grid {
    --settings-card-w: clamp(250px, 18vw, 320px);
    grid-template-columns: repeat(2, minmax(0, var(--settings-card-w)));
    width: fit-content;
    max-width: 100%;
    column-gap: clamp(14px, 1.4vw, 28px);
}
.nav-settings-grid.nav-system-settings-grid {
    --settings-card-w: auto;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    width: min(100%, 1520px);
}
.nav-settings-grid.nav-system-settings-grid > .nav-settings-card {
    width: 100%;
    max-width: none;
}
.nav-settings-card {
    background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 16px;
    min-height: clamp(112px, 10vh, 138px);
    padding: clamp(16px, 2.5vh, 30px) clamp(16px, 1.8vw, 24px); display: flex; align-items: flex-start; gap: clamp(12px, 1.5vw, 20px); cursor: pointer; outline: none;
    text-align: left; transition: all 0.2s cubic-bezier(0.25, 1, 0.5, 1); color: inherit; font-family: inherit;
}
.nav-settings-grid > .nav-settings-card {
    width: min(100%, var(--settings-card-w));
    max-width: var(--settings-card-w);
    justify-self: start;
}
.settings-card-icon { width: clamp(36px, 4.5vh, 54px); height: clamp(36px, 4.5vh, 54px); flex-shrink: 0; color: rgba(255,255,255,0.4); transition: color 0.2s; }
.settings-card-icon svg { width: 100%; height: 100%; }
.settings-card-info h3 { margin: 0 0 8px 0; font-size: 1.4rem; font-weight: 400; color: #fff; letter-spacing: -0.01em; }
.settings-card-info p { margin: 0; font-size: 0.95rem; color: rgba(255,255,255,0.4); line-height: 1.5; }
.nav-settings-card.nav-focused-el { transform: translateY(-4px) scale(1.03); background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.4); box-shadow: 0 20px 50px rgba(0,0,0,0.5); }
.nav-settings-card.nav-focused-el .settings-card-icon { color: #fff; }

/* Hub principal de configurações: navegação vertical de console + contexto. */
.nav-content-body.settings-home-active {
    overflow: hidden;
    padding-top: 0;
    padding-bottom: clamp(18px, 2.4vh, 36px);
    padding-left: 0;
    padding-right: 0;
}
.nav-settings-home {
    width: 100%;
    max-width: none;
    height: 100%;
    min-height: 0;
    display: grid;
    grid-template-columns: minmax(390px, .72fr) minmax(560px, 1.28fr);
    gap: clamp(30px, 3.4vw, 64px);
    margin: 0;
    animation: fadeInTop .32s cubic-bezier(.2,.9,.3,1);
}

/* Diretórios internos: a mesma hierarquia do hub, ancorada à margem do sistema. */
.nav-settings-directory {
    width: min(100%, 1480px);
    min-height: min(520px, 65vh);
    display: grid;
    grid-template-columns: minmax(390px, .88fr) minmax(390px, 1.12fr);
    gap: clamp(32px, 4vw, 72px);
    align-items: stretch;
    animation: fadeInTop .3s cubic-bezier(.2,.9,.3,1);
}
.nav-settings-directory-list { display: grid; align-content: start; gap: 4px; }
.nav-settings-directory-item {
    width: 100%; min-height: clamp(72px, 8vh, 94px);
    display: grid; grid-template-columns: clamp(38px, 3vw, 50px) minmax(0,1fr) 18px;
    align-items: center; gap: clamp(14px, 1.3vw, 20px);
    padding: clamp(11px, 1.2vh, 16px) clamp(15px, 1.35vw, 22px);
    border: 1px solid transparent; border-radius: 8px; outline: 0;
    background: transparent; color: #fff; font: inherit; text-align: left; cursor: pointer;
    transition: background .16s ease, border-color .16s ease, transform .16s ease, box-shadow .16s ease;
}
.nav-settings-directory-item .settings-card-icon {
    width: clamp(34px, 2.8vw, 46px); height: clamp(34px, 2.8vw, 46px);
    display: grid; place-items: center; color: rgba(255,255,255,.56);
}
.nav-settings-directory-item .settings-card-icon svg { width: 72%; height: 72%; }
.nav-settings-directory-copy { min-width: 0; display: grid; gap: 4px; }
.nav-settings-directory-copy strong { color: rgba(255,255,255,.92); font-size: clamp(.98rem,1.08vw,1.24rem); font-weight: 540; }
.nav-settings-directory-copy small { color: rgba(255,255,255,.45); font-size: clamp(.72rem,.77vw,.88rem); line-height: 1.35; }
.nav-settings-directory-chevron { color: rgba(255,255,255,.28); font-size: 1.35rem; }
#navMenuOverlay .nav-settings-directory-item.nav-focused-el {
    background: rgba(255,255,255,.115) !important; border-color: rgba(255,255,255,.76) !important;
    box-shadow: 0 0 0 2px rgba(255,255,255,.11), 0 14px 34px rgba(0,0,0,.27) !important;
    transform: translateX(7px);
}
.nav-settings-directory-item.nav-focused-el .settings-card-icon,
.nav-settings-directory-item.nav-focused-el .nav-settings-directory-chevron { color: #fff; }
.nav-settings-directory-preview {
    min-width: 0; padding: clamp(28px,3vw,50px); border-left: 1px solid rgba(255,255,255,.14);
    background: linear-gradient(90deg, rgba(255,255,255,.035), transparent 78%);
    display: grid; align-content: center;
}
.nav-settings-directory-preview .settings-card-icon { width: clamp(64px,5vw,86px); height: clamp(64px,5vw,86px); color: rgba(255,255,255,.8); }
.nav-settings-directory-preview h3 { margin: 24px 0 10px; color:#fff; font-size: clamp(1.65rem,2.2vw,3rem); font-weight: 340; letter-spacing: -.02em; }
.nav-settings-directory-preview p { max-width: 660px; margin:0; color:rgba(255,255,255,.57); font-size:clamp(.86rem,.95vw,1.08rem); line-height:1.55; }
.nav-settings-directory-preview .nav-settings-home-action { margin-top: clamp(32px,4vh,58px); }
.nav-settings-home-nav {
    min-width: 0;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 2px 8px 34px 3px;
    scrollbar-width: none;
}
.nav-settings-home-nav::-webkit-scrollbar { display: none; }
.nav-settings-home-group + .nav-settings-home-group { margin-top: clamp(14px, 1.7vh, 24px); }
.nav-settings-home-group-title {
    display: block;
    margin: 0 0 clamp(5px, .7vh, 9px);
    padding: 0 clamp(15px, 1.1vw, 20px);
    color: rgba(255,255,255,.39);
    font-size: clamp(.66rem, .68vw, .78rem);
    font-weight: 700;
    letter-spacing: .14em;
    text-transform: uppercase;
}
.nav-settings-home-list { display: grid; gap: 3px; }
.nav-settings-home-item {
    width: 100%;
    min-height: clamp(66px, 7.2vh, 88px);
    display: grid;
    grid-template-columns: clamp(38px, 3vw, 50px) minmax(0, 1fr) 18px;
    align-items: center;
    gap: clamp(13px, 1.25vw, 20px);
    padding: clamp(10px, 1.1vh, 15px) clamp(15px, 1.35vw, 22px);
    box-sizing: border-box;
    border: 1px solid transparent;
    border-radius: 8px;
    outline: 0;
    background: transparent;
    color: #fff;
    font: inherit;
    text-align: left;
    cursor: pointer;
    transition: background .16s ease, border-color .16s ease, transform .16s ease, box-shadow .16s ease;
}
.nav-settings-home-icon {
    width: clamp(34px, 2.8vw, 46px);
    height: clamp(34px, 2.8vw, 46px);
    display: grid;
    place-items: center;
    color: rgba(255,255,255,.58);
    transition: color .16s ease, transform .16s ease;
}
.nav-settings-home-icon svg { width: 70%; height: 70%; display: block; }
.nav-settings-home-copy { min-width: 0; display: grid; gap: 3px; }
.nav-settings-home-copy strong {
    overflow: hidden;
    color: rgba(255,255,255,.91);
    font-size: clamp(.96rem, 1.08vw, 1.25rem);
    font-weight: 530;
    line-height: 1.15;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.nav-settings-home-copy small {
    overflow: hidden;
    color: rgba(255,255,255,.43);
    font-size: clamp(.71rem, .76vw, .88rem);
    line-height: 1.25;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.nav-settings-home-chevron {
    color: rgba(255,255,255,.27);
    font-size: 1.35rem;
    font-weight: 300;
    transform: translateX(-3px);
    transition: color .16s ease, transform .16s ease;
}
#navMenuOverlay .nav-settings-home-item.nav-focused-el {
    background: rgba(255,255,255,.115) !important;
    border-color: rgba(255,255,255,.76) !important;
    box-shadow: 0 0 0 2px rgba(255,255,255,.12), 0 14px 34px rgba(0,0,0,.28) !important;
    transform: translateX(7px);
}
.nav-settings-home-item.nav-focused-el .nav-settings-home-icon { color: #fff; transform: scale(1.04); }
.nav-settings-home-item.nav-focused-el .nav-settings-home-copy strong { color: #fff; }
.nav-settings-home-item.nav-focused-el .nav-settings-home-copy small { color: rgba(255,255,255,.67); }
.nav-settings-home-item.nav-focused-el .nav-settings-home-chevron { color: #fff; transform: translateX(1px); }

.nav-settings-home-preview {
    position: relative; z-index: 1;
    min-width: 0;
    min-height: 0;
    align-self: stretch;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    overflow: hidden;
    padding: clamp(30px, 3.3vw, 56px);
    box-sizing: border-box;
    border: 1px solid rgba(255,255,255,.09);
    border-radius: clamp(14px, 1.1vw, 20px);
    background: linear-gradient(145deg, rgba(255,255,255,.065), rgba(255,255,255,.018) 72%);
    box-shadow: 0 26px 72px rgba(0,0,0,.2);
}
.nav-settings-home-preview::before {
    content: none;
}
.nav-settings-home-preview-main { position: relative; z-index: 1; display: grid; align-content: start; }
.nav-settings-home-preview-icon {
    width: clamp(64px, 5.5vw, 92px);
    height: clamp(64px, 5.5vw, 92px);
    display: grid;
    place-items: center;
    margin-bottom: clamp(25px, 3vh, 42px);
    color: rgba(255,255,255,.84);
}
.nav-settings-home-preview-icon svg { width: 72%; height: 72%; display: block; }
.nav-settings-home-kicker {
    color: rgba(255,255,255,.43);
    font-size: clamp(.68rem, .72vw, .82rem);
    font-weight: 720;
    letter-spacing: .16em;
    text-transform: uppercase;
}
.nav-settings-home-preview h3 {
    margin: 9px 0 0;
    color: #fff;
    font-size: clamp(1.65rem, 2.45vw, 3.35rem);
    font-weight: 330;
    line-height: 1.04;
    letter-spacing: -.025em;
}
.nav-settings-home-preview p {
    max-width: 720px;
    margin: clamp(13px, 1.5vh, 21px) 0 0;
    color: rgba(255,255,255,.58);
    font-size: clamp(.86rem, .96vw, 1.12rem);
    line-height: 1.55;
}
.nav-settings-home-scope {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0 clamp(16px, 1.4vw, 26px);
    margin-top: clamp(24px, 3.2vh, 46px);
    border-top: 1px solid rgba(255,255,255,.09);
}
.nav-settings-home-scope span {
    min-width: 0;
    padding: clamp(12px, 1.35vh, 18px) 0;
    border-bottom: 1px solid rgba(255,255,255,.07);
    color: rgba(255,255,255,.69);
    font-size: clamp(.75rem, .82vw, .96rem);
    line-height: 1.25;
}
.nav-settings-home-action {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    gap: 10px;
    padding-top: clamp(24px, 2.8vh, 42px);
    color: rgba(255,255,255,.62);
    font-size: clamp(.76rem, .82vw, .94rem);
    font-weight: 560;
}
.nav-settings-home-action kbd {
    width: 27px;
    height: 27px;
    display: inline-grid;
    place-items: center;
    box-sizing: border-box;
    border: 1px solid rgba(255,255,255,.43);
    border-radius: 50%;
    color: #fff;
    background: rgba(255,255,255,.08);
    font: inherit;
    font-size: .72rem;
    font-weight: 760;
}

@media (max-width: 1180px) {
    .nav-settings-home { grid-template-columns: minmax(350px, .92fr) minmax(340px, 1.08fr); gap: 28px; }
    .nav-settings-home-preview { padding: clamp(24px, 2.7vw, 38px); }
}
@media (max-width: 900px) {
    .nav-content-body.settings-home-active { overflow-y: auto; }
    .nav-settings-home { height: auto; grid-template-columns: 1fr; }
    .nav-settings-home-preview { display: none; }
    .nav-settings-home-nav { overflow: visible; }
    .nav-settings-directory { grid-template-columns:1fr; min-height:0; }
    .nav-settings-directory-preview { display:none; }
}
@media (max-height: 780px) {
    .nav-settings-home { gap: 28px; }
    .nav-settings-home-group + .nav-settings-home-group { margin-top: 9px; }
    .nav-settings-home-group-title { margin-bottom: 3px; font-size: .6rem; }
    .nav-settings-home-list { gap: 1px; }
    .nav-settings-home-item { min-height: 54px; padding-block: 7px; }
    .nav-settings-home-icon { width: 31px; height: 31px; }
    .nav-settings-home-copy strong { font-size: .88rem; }
    .nav-settings-home-copy small { font-size: .67rem; }
    .nav-settings-home-preview-icon { margin-bottom: 18px; }
    .nav-settings-home-scope { margin-top: 20px; }
    .nav-settings-home-scope span { padding-block: 9px; }
    .nav-settings-home-action { padding-top: 18px; }
}

.nav-settings-subheader { display: flex; align-items: center; gap: 24px; margin-bottom: 30px; animation: fadeInTop 0.3s ease; }
.nav-back-btn { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 30px; padding: 10px 24px; color: #fff; font-family: inherit; font-size: 1rem; cursor: pointer; outline: none; transition: all 0.2s; font-weight: 500; }
.nav-back-btn.nav-focused-el { background: #fff; color: #000; transform: scale(1.05); }
.nav-settings-subheader h2 { margin: 0; font-size: 1.8rem; font-weight: 300; color: #fff; }
.nav-system-startup-panel { width: 100%; max-width: 900px; padding-bottom: 18px; }
.nav-system-startup-panel-compact {
    display: flex;
    flex-direction: column;
    gap: clamp(8px, 1.1vh, 14px);
    max-width: min(900px, 100%);
    padding-bottom: clamp(8px, 1.2vh, 16px);
    transform-origin: top left;
}
.nav-system-startup-panel-compact > h3 {
    font-size: clamp(0.92rem, 1.1vw, 1.08rem) !important;
    font-weight: 500 !important;
    color: #fff !important;
    margin: 0 !important;
    line-height: 1.2;
}
.nav-system-startup-panel-compact .nav-radio-group {
    gap: clamp(7px, .9vh, 11px);
    margin-bottom: clamp(2px, .6vh, 8px);
}
.nav-system-startup-panel-compact .nav-radio-btn {
    min-height: 0;
    padding: clamp(9px, 1.15vh, 14px) clamp(12px, 1.2vw, 18px);
    gap: clamp(9px, 1vw, 14px);
}
.nav-system-startup-panel-compact .nav-radio-text strong {
    font-size: clamp(.84rem, .95vw, .98rem);
    line-height: 1.16;
}
.nav-system-startup-panel-compact .nav-radio-text span {
    font-size: clamp(.72rem, .78vw, .84rem);
    line-height: 1.28;
}
.nav-system-startup-panel-compact .nav-startup-suggestions {
    display: flex;
    flex-direction: column;
    gap: clamp(7px, .9vh, 10px);
    margin: 0;
}
.nav-system-startup-panel-compact .nav-suggestion-card {
    min-height: 0;
    padding: clamp(9px, 1.1vh, 13px) clamp(12px, 1.2vw, 16px);
    gap: clamp(5px, .7vh, 9px);
}
.nav-system-startup-panel-compact .nav-suggestion-card-btn {
    padding: 5px 9px;
    font-size: clamp(.68rem, .7vw, .78rem);
}
.nav-system-startup-panel-compact .nav-suggestion-card-text {
    font-size: clamp(.68rem, .74vw, .78rem);
    line-height: 1.3;
}
.nav-system-startup-panel-compact > .nav-shortcut-row {
    margin: 0 !important;
    padding: clamp(8px, .95vh, 10px) clamp(10px, 1vw, 12px) !important;
    border-radius: 10px !important;
    background: rgba(255,255,255,.045) !important;
    border: 1px solid rgba(255,255,255,.08) !important;
}
.nav-system-startup-panel-compact > #btnEnterDesktop {
    width: 100%;
    min-height: 0;
    padding: clamp(10px, 1.2vh, 14px) clamp(14px, 1.4vw, 18px);
}
.nav-system-startup-panel-compact > #btnEnterDesktop .settings-card-icon {
    width: clamp(30px, 3.4vh, 36px) !important;
    height: clamp(30px, 3.4vh, 36px) !important;
}
.nav-system-startup-panel-v2 {
    max-width: min(1120px, 100%);
    display: grid;
    grid-template-columns: minmax(320px, 1fr) minmax(320px, .92fr);
    gap: clamp(18px, 2.2vw, 34px);
    align-items: start;
}
.nav-startup-section {
    min-width: 0;
}
.nav-startup-section-title {
    font-size: 1.1rem;
    font-weight: 500;
    color: #fff;
    margin: 0 0 12px;
}
.nav-startup-actions {
    display: flex;
    flex-direction: column;
    gap: clamp(8px, 1.1vh, 12px);
}
.nav-startup-actions .nav-suggestions-grid {
    margin: 0;
}
.nav-startup-actions .nav-shortcut-row {
    margin: 0 !important;
    padding: clamp(8px, .95vh, 10px) clamp(10px, 1vw, 12px) !important;
}
.nav-startup-actions #btnEnterDesktop {
    width: 100%;
    min-height: 0;
    padding: clamp(10px, 1.2vh, 14px) clamp(14px, 1.4vw, 18px);
}
.nav-startup-actions #btnEnterDesktop .settings-card-icon {
    width: clamp(30px, 3.4vh, 36px) !important;
    height: clamp(30px, 3.4vh, 36px) !important;
}

.nav-profile-dashboard { display: grid; grid-template-columns: minmax(250px,.62fr) minmax(520px,1.38fr); align-items: stretch; gap: clamp(28px, 3.6vw, 64px); animation: fadeInTop 0.3s ease; width:min(100%,1420px); max-width:none; }
.nav-profile-avatar-sec { min-height:460px; display:flex; flex-direction:column; align-items:flex-start; justify-content:center; gap:16px; padding:clamp(26px,3vw,46px); border-left:3px solid rgba(255,255,255,.62); background:linear-gradient(90deg,rgba(255,255,255,.055),transparent); box-sizing:border-box; }
.nav-profile-photo { width: clamp(120px, 14vw, 180px); height: clamp(120px, 14vw, 180px); border-radius: 50%; background: rgba(255,255,255,0.05); border: 3px solid rgba(255,255,255,0.1); overflow: hidden; display: flex; align-items: center; justify-content: center; font-size: 3.5rem; color: rgba(255,255,255,0.3); cursor: pointer; outline: none; transition: all 0.2s; padding: 0; }
.nav-profile-photo img { width: 100%; height: 100%; object-fit: cover; }
.nav-profile-photo.nav-focused-el { border-color: #fff; box-shadow: 0 0 20px rgba(255,255,255,0.2), 0 10px 40px rgba(0,0,0,0.8); transform: scale(1.05); }

.nav-profile-fields { min-width:0; display:flex; flex-direction:column; gap:clamp(12px,1.35vh,18px); background:transparent; border:0; padding:0; border-radius:0; box-shadow:none; }
.nav-profile-field { display: flex; flex-direction: column; gap: 8px; }
.nav-profile-field-label { font-size: clamp(0.75rem, 0.85vw, 0.95rem); color: rgba(255,255,255,0.4); font-weight: 500; }
.nav-profile-field-input { background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: clamp(14px, 1.8vh, 18px) clamp(16px, 1.6vw, 20px); color: #fff; font-size: clamp(1rem, 1.1vw, 1.2rem); font-family: inherit; outline: none; width: 100%; box-sizing: border-box; cursor: pointer; transition: all 0.2s; }
.nav-profile-field-input.nav-focused-el { border-color: #fff; background: rgba(255,255,255,0.05); box-shadow: 0 0 15px rgba(255,255,255,0.1); transform: scale(1.02); }

.nav-api-row { display: flex; gap: 10px; width: 100%; }
.nav-icon-btn { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 0 clamp(10px, 1.2vw, 16px); color: rgba(255,255,255,0.8); cursor: pointer; outline: none; transition: all 0.2s; display: flex; align-items: center; justify-content: center; font-family: inherit; font-size: 0.9rem; font-weight: 500; }
.nav-icon-btn.nav-focused-el { border-color: #fff; background: rgba(255,255,255,0.15); color: #fff; transform: scale(1.05); box-shadow: 0 5px 15px rgba(0,0,0,0.3); }

.nav-btn-danger { color: #ff6b6b; border-color: rgba(255,107,107,0.3); margin-top: 24px; width: 100%; }
.nav-btn-danger.nav-focused-el { background: rgba(255,107,107,0.15); border-color: #ff6b6b; color: #fff; }

.nav-placeholder { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; min-height: 300px; gap: 20px; color: rgba(255,255,255,0.2); animation: fadeInTop 0.4s ease; }
.nav-placeholder-icon { font-size: clamp(3rem, 5vw, 6rem); opacity: 0.5; }
.nav-placeholder-text { font-size: clamp(1rem, 1.2vw, 1.4rem); font-weight: 400; letter-spacing: 0.02em; }

/* ── Responsividade ── */
@media (max-height: 768px) {
    .nav-content-header { margin-bottom: clamp(8px, 1.5vh, 20px); }
    .nav-profile-section-title { font-size: 1rem; padding-bottom: 8px; margin-top: 4px; }
    .nav-profile-avatar-large { width: clamp(52px, 9vh, 90px); height: clamp(52px, 9vh, 90px); }
    .nav-profile-edit-btn { padding: 8px 16px; font-size: 0.9rem; }
    .settings-card-info h3 { font-size: clamp(1rem, 1.8vh, 1.4rem); margin-bottom: 4px; }
    .settings-card-info p { font-size: clamp(0.8rem, 1.3vh, 0.95rem); }
    .nav-back-btn { padding: 7px 18px; font-size: 0.9rem; }
    .nav-settings-subheader { margin-bottom: clamp(12px, 2vh, 30px); gap: 16px; }
    .nav-settings-subheader h2 { font-size: clamp(1.2rem, 2.5vh, 1.8rem); }
}

@media (max-height: 1080px) {
    .nav-topbar { padding-top: clamp(4.4rem, 7vh, 5.25rem); gap: clamp(10px, 1.5vh, 18px); }
    .nav-content { padding-top: clamp(8px, 1.35vh, 18px); padding-bottom: 10px; }
    .nav-content-header { margin-bottom: clamp(10px, 1.6vh, 18px); }
    .nav-big-grid {
        --gap-x: clamp(16px, 1.45vw, 24px);
        --gap-y: clamp(24px, 2.4vh, 38px);
        --padding-y: clamp(20px, 2.8vh, 34px);
        --card-h-limit: clamp(260px, 29vh, 340px);
    }
    .nav-vertical-card.nav-focused { transform: scale(1.035); }
    .nav-system-startup-panel-compact { zoom: .94; }
    .nav-system-startup-panel-v2 { gap: clamp(12px, 1.5vw, 20px); }
    .nav-startup-section-title { font-size: .98rem; margin-bottom: 8px; }
}

/* ── Sistema (Radios) ── */
.nav-radio-group { display: flex; flex-direction: column; gap: 12px; margin-bottom: 24px; animation: fadeInTop 0.3s ease;}
.nav-radio-btn { display: flex; align-items: center; gap: 16px; padding: 16px 20px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; cursor: pointer; color: #fff; text-align: left; transition: all 0.2s cubic-bezier(0.25, 1, 0.5, 1); font-family: inherit; outline: none; }
.nav-radio-btn.active { background: rgba(120,190,255,0.1); border-color: rgba(120,190,255,0.5); }
.nav-radio-btn.nav-focused-el { border-color: #fff; background: rgba(255,255,255,0.15); transform: scale(1.02); box-shadow: 0 5px 20px rgba(0,0,0,0.3); }
.nav-radio-circle { width: 20px; height: 20px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.3); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.nav-radio-btn.active .nav-radio-circle { border-color: #78beff; }
.nav-radio-btn.active .nav-radio-circle::after { content: ''; width: 10px; height: 10px; border-radius: 50%; background: #78beff; }
.nav-radio-text { display: flex; flex-direction: column; gap: 4px; flex: 1; }
.nav-radio-text strong { font-weight: 500; font-size: 1.05rem; }
.nav-radio-text span { font-size: 0.85rem; color: rgba(255,255,255,0.75); line-height: 1.4;}
.nav-radio-btn.nav-focused-el .nav-radio-text span { color: rgba(255,255,255,0.95); }

/* ── Cards de Sugestão ── */
.nav-suggestions-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin-bottom: 28px; }
.nav-suggestion-card { display: none; flex-direction: column; gap: 10px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.12); border-radius: 12px; padding: 16px; cursor: pointer; outline: none; text-align: left; transition: all 0.2s cubic-bezier(0.25, 1, 0.5, 1); color: inherit; font-family: inherit; min-height: 110px; }
.nav-suggestion-card.visible { display: flex; }
.nav-suggestion-card.nav-focused-el { transform: translateY(-3px) scale(1.02); background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.4); box-shadow: 0 15px 35px rgba(0,0,0,0.4); }
.nav-suggestion-card-btn { background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; padding: 7px 12px; color: #fff; font-size: 0.85rem; font-weight: 600; align-self: flex-start; pointer-events: none; transition: background 0.15s; }
.nav-suggestion-card.nav-focused-el .nav-suggestion-card-btn { background: rgba(255,255,255,0.2); border-color: rgba(255,255,255,0.5); }
.nav-suggestion-card-text { font-size: 0.78rem; color: rgba(255,255,255,0.75); line-height: 1.45; }
.nav-suggestion-card.nav-focused-el .nav-suggestion-card-text { color: #fff; }
.nav-gpu-app-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:14px; width:100%; }
.nav-gpu-app-card { min-height:238px; border:1px solid rgba(255,255,255,.12); border-radius:12px; background:radial-gradient(circle at 50% 0%, rgba(255,255,255,.12), transparent 42%), linear-gradient(180deg, rgba(255,255,255,.07), rgba(255,255,255,.035)); color:#fff; outline:none; cursor:pointer; padding:15px 15px 18px; display:flex; flex-direction:column; justify-content:flex-start; gap:15px; text-align:left; transition:all .2s cubic-bezier(.25,1,.5,1); overflow:hidden; }
.nav-gpu-app-card.nav-focused-el { transform:translateY(-3px) scale(1.02); background:rgba(255,255,255,.09); border-color:rgba(255,255,255,.48); box-shadow:0 15px 35px rgba(0,0,0,.4); }
.nav-gpu-app-art { min-height:128px; border-radius:10px; background:radial-gradient(circle at 50% 18%, rgba(255,255,255,.24), transparent 32%), radial-gradient(circle at 20% 10%, rgba(125,203,255,.28), transparent 36%), linear-gradient(180deg, rgba(255,255,255,.10), rgba(255,255,255,.03)); display:flex; align-items:center; justify-content:center; overflow:hidden; box-shadow:inset 0 1px 0 rgba(255,255,255,.08), 0 18px 28px rgba(0,0,0,.16); }
.nav-gpu-app-art img { width:min(72%, 108px); height:min(72%, 108px); object-fit:contain; filter:drop-shadow(0 14px 28px rgba(0,0,0,.34)); }
.nav-gpu-app-cover { width:100%; height:100%; background-size:contain; background-repeat:no-repeat; background-position:center; filter:drop-shadow(0 14px 24px rgba(90,180,255,.18)); transform:scale(1.03); }
.nav-gpu-app-fallback { width:58px; height:58px; border-radius:16px; display:flex; align-items:center; justify-content:center; background:rgba(255,255,255,.12); color:#fff; font-weight:800; letter-spacing:.04em; }
.nav-gpu-app-copy { display:grid; gap:6px; align-content:start; }
.nav-gpu-app-name { color:#fff; font-size:.95rem; font-weight:700; line-height:1.24; overflow:hidden; }
.nav-gpu-app-meta { color:rgba(255,255,255,.58); font-size:.74rem; line-height:1.38; }
.nav-gpu-app-add { border-style:dashed; }
.nav-gpu-app-add .nav-gpu-app-art { background:none; box-shadow:none; min-height:128px; }
.nav-gpu-app-add .nav-gpu-app-fallback { width:62px; height:62px; background:#fff; color:#0d1018; box-shadow:0 12px 28px rgba(255,255,255,.18); }

/* Foco unificado do nav-menu: mesmo idioma visual da home */
#navMenuOverlay {
    --nav-focus-bg: rgba(255,255,255,0.15);
    --nav-focus-border: rgba(255,255,255,0.82);
    --nav-focus-shadow: 0 0 0 2px rgba(255,255,255,0.20), 0 10px 24px rgba(0,0,0,0.34);
    --nav-focus-shadow-strong: 0 0 0 2px rgba(255,255,255,0.22), 0 16px 38px rgba(0,0,0,0.46);
}

#navMenuOverlay .nav-cat-item.nav-focused {
    color: #fff;
    background: transparent;
    border-color: rgba(255,255,255,.92);
    border-radius: 8px;
    box-shadow: none;
    transform: none;
}

#navMenuOverlay :is(
    .nav-settings-card,
    .nav-back-btn,
    .nav-radio-btn,
    .nav-suggestion-card,
    .nav-gpu-app-card,
    .nav-profile-edit-btn,
    .nav-profile-photo,
    .nav-profile-field-input,
    .nav-icon-btn,
    .nav-btn-danger,
    .nav-system-tab,
    .nav-sharing-app,
    .nav-sharing-mode,
    .nav-sharing-user,
    .nav-sharing-save,
    .nav-sharing-tab,
    .nav-sharing-toggle,
    .nav-store-policy-toggle,
    .nav-ext-btn
).nav-focused-el {
    background: var(--nav-focus-bg) !important;
    border-color: var(--nav-focus-border) !important;
    color: #fff !important;
    box-shadow: var(--nav-focus-shadow) !important;
}

#navMenuOverlay :is(
    .nav-settings-card,
    .nav-suggestion-card,
    .nav-gpu-app-card,
    .nav-profile-recent-card
).nav-focused-el {
    box-shadow: var(--nav-focus-shadow-strong) !important;
}

#navMenuOverlay :is(.nav-vertical-card.nav-focused, .nav-profile-recent-card.nav-focused-el) {
    border-color: #fff !important;
    box-shadow: var(--nav-focus-shadow-strong) !important;
}

#navMenuOverlay :is(.nav-settings-card, .nav-suggestion-card, .nav-gpu-app-card).nav-focused-el,
#navMenuOverlay :is(.nav-vertical-card.nav-focused, .nav-profile-recent-card.nav-focused-el) {
    transform: translateY(-2px) scale(1.03);
}

@media (max-width: 1366px), (max-height: 780px) {

    .nav-topbar { padding-top: clamp(3.9rem, 7.5vh, 4.9rem); gap: 12px; }
    .nav-cat-item { padding: 6px; }
    .nav-cat-label { font-size: 0.82rem; }
    .nav-content { --nav-focus-gutter: clamp(28px, 2.4vw, 40px); padding: 12px 32px; }
    .nav-content-body { padding: 8px var(--nav-focus-gutter) 28px; scroll-padding: 14px var(--nav-focus-gutter) 34px; }
    .nav-content-body.dual-pane-active { padding: 0; scroll-padding: 0; }
    .nav-system-startup-panel { max-width: 840px; padding-bottom: 8px; }
    .nav-system-startup-panel-v2 {
        max-width: 100%;
        grid-template-columns: minmax(0, 1.08fr) minmax(300px, .92fr);
        gap: 14px;
    }
    .nav-content-header { margin-bottom: 8px; }
    .nav-content-title { font-size: 1.5rem; }
    .nav-content-subtitle { font-size: 0.78rem; }
    #navPaneGames, #navPaneMedia { padding: clamp(20px, 2.2vw, 30px); scroll-padding-top: 22px; scroll-padding-bottom: 22px; }
    .nav-big-grid {
        --padding-y: clamp(18px, 2.6vh, 32px);
        --gap-x: clamp(14px, 1.4vw, 22px);
        --gap-y: clamp(20px, 2.4vh, 34px);
        --card-h-limit: clamp(210px, 27vh, 275px);
    }
    .nav-settings-grid { --settings-card-w: 260px; --settings-focus-pad-y: 18px; --settings-focus-pad-x: clamp(24px, 2.4vw, 34px); gap: 10px; }
    .nav-settings-card { min-height: 112px; padding: 18px 16px; gap: 12px; border-radius: 10px; }
    .settings-card-icon { width: 28px; height: 28px; }
    .settings-card-info h3 { font-size: 1rem; margin-bottom: 2px; }
    .settings-card-info p { font-size: 0.78rem; line-height: 1.35; }
    .nav-settings-subheader { margin-bottom: 12px; gap: 12px; }
    .nav-settings-subheader h2 { font-size: 1.15rem; }
    .nav-back-btn { padding: 6px 12px; font-size: 0.78rem; border-radius: 20px; }
    .nav-profile-dashboard { gap: 16px; }
    .nav-profile-photo { width: 72px; height: 72px; font-size: 1.6rem; }
    .nav-profile-fields { padding: 14px 18px; gap: 8px; border-radius: 10px; }
    .nav-profile-field { gap: 4px; }
    .nav-profile-field-label { font-size: 0.7rem; }
    .nav-profile-field-input { padding: 8px 12px; font-size: 0.85rem; border-radius: 6px; }
    .nav-icon-btn { padding: 0 10px; font-size: 0.78rem; min-height: 32px; height: 34px; border-radius: 6px; }
    .nav-btn-danger { padding: 8px; margin-top: 4px; font-size: 0.82rem; }
    .nav-radio-group { gap: 6px; margin-bottom: 12px; }
    .nav-radio-btn { padding: 10px 14px; gap: 10px; border-radius: 8px; }
    .nav-radio-circle { width: 14px; height: 14px; }
    .nav-radio-btn.active .nav-radio-circle::after { width: 6px; height: 6px; }
    .nav-radio-text { gap: 2px; }
    .nav-radio-text strong { font-size: 0.88rem; }
    .nav-radio-text span { font-size: 0.75rem; line-height: 1.3; }
    .nav-suggestions-grid { grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; margin-bottom: 12px; }
    .nav-suggestion-card { padding: 10px; gap: 6px; min-height: auto; border-radius: 8px; }
    .nav-suggestion-card-btn { padding: 4px 8px; font-size: 0.72rem; border-radius: 6px; }
    .nav-suggestion-card-text { font-size: 0.7rem; line-height: 1.3; }
    .nav-ext-row { padding: 8px 12px; gap: 10px; border-radius: 8px; }
    .nav-ext-info strong { font-size: 0.85rem; }
    .nav-ext-info span { font-size: 0.75rem; }
    .nav-ext-btn { padding: 4px 8px; font-size: 0.72rem; border-radius: 6px; }
    .nav-sharing-layout { grid-template-columns: minmax(150px, 1fr) minmax(240px, 1.4fr); gap: 10px; }
    .nav-sharing-apps { max-height: 45vh; gap: 6px; padding: 8px; }
    .nav-sharing-app { min-height: 36px; font-size: 0.8rem; padding: 0 8px; border-radius: 6px; }
    .nav-sharing-panel { padding: 10px 14px; min-height: 200px; gap: 10px; border-radius: 8px; }
    .nav-sharing-title { font-size: 1rem; }
    .nav-sharing-sub { font-size: 0.78rem; line-height: 1.35; margin-top: -2px; }
    .nav-sharing-modes { gap: 6px; }
    .nav-sharing-mode { min-height: 32px; font-size: 0.78rem; border-radius: 6px; }
    .nav-sharing-users { gap: 6px; }
    .nav-sharing-user { min-height: 72px; gap: 4px; border-radius: 6px; font-size: 0.75rem; }
    .nav-sharing-avatar { width: 28px; height: 28px; font-size: 0.8rem; }
    .nav-sharing-save { min-height: 32px; font-size: 0.8rem; padding: 0 12px; border-radius: 6px; }
    .nav-sharing-note { font-size: 0.8rem; min-height: auto; }
}

@media (max-height: 920px) {
    .nav-content {
        padding-top: clamp(8px, 1.1vh, 14px);
        padding-bottom: 8px;
    }
    .nav-content-body {
        padding-top: 18px;
        padding-bottom: 28px;
        scroll-padding-top: 24px;
        scroll-padding-bottom: 30px;
    }
    .nav-system-startup-panel-compact {
        zoom: .88;
        gap: 8px;
        padding-bottom: 6px;
    }
    .nav-system-startup-panel-compact .nav-radio-group {
        gap: 7px;
        margin-bottom: 2px;
    }
    .nav-system-startup-panel-compact .nav-radio-btn {
        padding: 9px 13px;
    }
    .nav-system-startup-panel-compact .nav-startup-suggestions {
        gap: 7px;
    }
    .nav-system-startup-panel-compact .nav-suggestion-card {
        padding: 9px 12px;
    }
    .nav-system-startup-panel-compact > .nav-shortcut-row {
        padding: 8px 10px !important;
    }
    .nav-system-startup-panel-compact > #btnEnterDesktop {
        padding: 10px 12px;
    }
}

@media (max-height: 820px) {
    .nav-content-body {
        padding-top: 16px;
        padding-bottom: 24px;
        scroll-padding-top: 22px;
        scroll-padding-bottom: 30px;
    }
    .nav-system-startup-panel-compact {
        zoom: .82;
        gap: 6px;
        padding-bottom: 4px;
    }
    .nav-system-startup-panel-compact > h3 {
        font-size: .86rem !important;
        line-height: 1.1;
    }
    .nav-system-startup-panel-compact .nav-radio-group,
    .nav-system-startup-panel-compact .nav-startup-suggestions {
        gap: 6px;
    }
    .nav-system-startup-panel-compact .nav-radio-btn {
        padding: 8px 11px;
        gap: 8px;
    }
    .nav-system-startup-panel-compact .nav-radio-text span,
    .nav-system-startup-panel-compact .nav-suggestion-card-text {
        line-height: 1.22;
    }
    .nav-system-startup-panel-compact .nav-suggestion-card {
        padding: 8px 10px;
        gap: 4px;
    }
    .nav-system-startup-panel-compact .nav-suggestion-card-btn {
        padding: 4px 8px;
    }
    .nav-system-startup-panel-compact > .nav-shortcut-row {
        padding: 7px 9px !important;
    }
    .nav-system-startup-panel-compact > #btnEnterDesktop {
        padding: 8px 10px;
    }
}

@media (max-width: 980px), (max-height: 680px) {
    .nav-system-startup-panel-v2 {
        display: flex;
        flex-direction: column;
    }
}

/* Escala editorial do hub de Configurações para TV e monitor. */
.nav-settings-home {
    width: 100%;
    max-width: none;
    height: 100%;
    max-height: none;
    align-self: stretch;
    position: relative;
    isolation: isolate;
    grid-template-columns: minmax(430px, .86fr) minmax(420px, 1.14fr);
    gap: clamp(34px, 4.2vw, 78px);
    margin: 0;
}

#navMenuOverlay.settings-ambient-active .nav-layout::before {
    content: '';
    position: absolute;
    z-index: 0;
    pointer-events: none;
    inset: -10%;
    background:
        radial-gradient(ellipse 39% 68% at 21% 55%,
            rgba(59, 126, 205, .135) 0%,
            rgba(55, 103, 190, .078) 34%,
            rgba(75, 76, 172, .032) 61%,
            transparent 100%),
        radial-gradient(ellipse 25% 38% at 31% 71%,
            rgba(57, 113, 178, .036) 0%,
            transparent 100%);
    opacity: .82;
    transform: translate3d(0, 0, 0) scale(1);
    animation: navSettingsRailAmbient 18s ease-in-out infinite alternate;
    will-change: transform, opacity;
}

#navMenuOverlay.settings-ambient-active .nav-topbar,
#navMenuOverlay.settings-ambient-active .nav-content {
    position: relative;
    z-index: 1;
}

@keyframes navSettingsRailAmbient {
    from { transform: translate3d(-1.5%, -1.2%, 0) scale(.985); opacity: .74; }
    to { transform: translate3d(2.2%, 1.3%, 0) scale(1.025); opacity: .9; }
}

.nav-settings-home-nav {
    position: relative;
    z-index: 1;
    padding: 3px 12px clamp(34px, 4vh, 56px) 4px;
}

.nav-settings-home-group + .nav-settings-home-group {
    margin-top: clamp(19px, 2.25vh, 32px);
}

.nav-settings-home-group-title {
    margin-bottom: clamp(7px, .95vh, 12px);
    padding-inline: clamp(17px, 1.28vw, 25px);
    font-size: clamp(.71rem, .75vw, .86rem);
}

.nav-settings-home-list {
    gap: clamp(3px, .45vh, 7px);
}

.nav-settings-home-item {
    min-height: clamp(80px, 8.2vh, 106px);
    grid-template-columns: clamp(44px, 3.2vw, 57px) minmax(0, 1fr) 18px;
    gap: clamp(16px, 1.48vw, 24px);
    padding: clamp(12px, 1.38vh, 19px) clamp(19px, 1.62vw, 28px);
    border-radius: clamp(8px, .65vw, 12px);
}

.nav-settings-home-icon {
    width: clamp(40px, 3.15vw, 55px);
    height: clamp(40px, 3.15vw, 55px);
}

.nav-settings-home-copy {
    gap: clamp(4px, .45vh, 7px);
}

.nav-settings-home-copy strong {
    font-size: clamp(1.03rem, 1.19vw, 1.47rem);
}

.nav-settings-home-copy small {
    color: rgba(255,255,255,.52);
    font-size: clamp(.76rem, .83vw, .97rem);
}

.nav-settings-home-chevron {
    font-size: clamp(1.3rem, 1.4vw, 1.62rem);
    justify-self: end;
    margin-left: 0;
}

#navMenuOverlay .nav-settings-home-item.nav-focused-el {
    transform: translateX(clamp(7px, .55vw, 11px));
    box-shadow: 0 0 0 2px rgba(255,255,255,.13), 0 18px 44px rgba(0,0,0,.3), -16px 0 52px rgba(64,119,194,.11) !important;
}

@media (prefers-reduced-motion: reduce) {
    #navMenuOverlay.settings-ambient-active .nav-layout::before { animation: none; }
}

.nav-settings-directory {
    width: 100%;
    max-width: none;
    grid-template-columns: minmax(420px, .76fr) minmax(560px, 1.24fr);
    gap: clamp(28px, 3.1vw, 59px);
}

.nav-settings-home-preview,
.nav-settings-directory-preview {
    padding: clamp(38px, 3.8vw, 72px);
}

.nav-settings-home-preview-icon {
    width: clamp(74px, 5.9vw, 106px);
    height: clamp(74px, 5.9vw, 106px);
    margin-bottom: clamp(28px, 3.4vh, 49px);
}

.nav-settings-home-kicker {
    font-size: clamp(.73rem, .78vw, .91rem);
}

.nav-settings-home-preview h3 {
    font-size: clamp(2.04rem, 2.85vw, 3.9rem);
}

.nav-settings-home-preview p {
    max-width: 860px;
    margin-top: clamp(15px, 1.7vh, 25px);
    font-size: clamp(.94rem, 1.07vw, 1.24rem);
    line-height: 1.58;
}

.nav-settings-home-scope {
    gap: 0 clamp(21px, 1.7vw, 32px);
    margin-top: clamp(30px, 3.8vh, 55px);
}

.nav-settings-home-scope span {
    padding-block: clamp(14px, 1.62vh, 22px);
    font-size: clamp(.8rem, .9vw, 1.05rem);
}

.nav-settings-home-action {
    gap: 12px;
    padding-top: clamp(28px, 3.3vh, 49px);
    font-size: clamp(.8rem, .9vw, 1.03rem);
}

.nav-settings-home-action kbd {
    width: clamp(28px, 1.9vw, 34px);
    height: clamp(28px, 1.9vw, 34px);
    font-size: clamp(.69rem, .74vw, .86rem);
}

/* Perfil em escala de console: ocupa a área útil sem reduzir as capas. */
.nav-profile-showcase {
    max-width: none;
    gap: clamp(12px, 1.5vh, 24px);
}

.nav-profile-cover {
    height: clamp(300px, 38%, 500px);
}

.nav-profile-avatar-large {
    width: clamp(84px, 13vh, 132px);
    height: clamp(84px, 13vh, 132px);
}

.nav-profile-name {
    font-size: clamp(1.9rem, 3vw, 4.2rem);
}

.nav-profile-cover-game-title {
    font-size: clamp(1.45rem, 1.95vw, 2.55rem);
}

.nav-profile-cover-game-meta {
    font-size: clamp(.84rem, .94vw, 1.1rem);
}

.nav-profile-stats-row {
    min-height: clamp(94px, 10vh, 128px);
}

.nav-profile-stat-icon {
    width: clamp(42px, 3.15vw, 58px);
    height: clamp(42px, 3.15vw, 58px);
}

.nav-profile-stat-copy .stat-value {
    font-size: clamp(1.4rem, 1.85vw, 2.3rem);
}

.nav-profile-last-name {
    font-size: clamp(1.02rem, 1.24vw, 1.48rem);
}

.nav-profile-section-head .nav-profile-section-title {
    font-size: clamp(1.3rem, 1.5vw, 1.8rem);
}

.nav-profile-recent-grid {
    gap: clamp(14px, 1.15vw, 24px);
    padding: 10px 6px clamp(22px, 3vh, 44px);
}

@media (max-width: 1180px) {
    .nav-settings-home,
    .nav-settings-directory {
        grid-template-columns: minmax(350px, .9fr) minmax(380px, 1.1fr);
        gap: 28px;
    }
}

@media (max-width: 900px) {
    .nav-settings-home,
    .nav-settings-directory {
        grid-template-columns: 1fr;
    }

    .nav-settings-home {
        width: 100%;
        height: auto;
        max-height: none;
    }

    .nav-settings-home-preview,
    .nav-settings-directory-preview {
        display: none;
    }
}
        `;
        document.head.appendChild(s);
    })();

    // ── Build overlay DOM ─────────────────────────────────────────────────────
    function _buildOverlay() {
        if (_overlay) return;

        _overlay = document.createElement('div');
        _overlay.id = 'navMenuOverlay';

        _overlay.innerHTML = `
            <canvas id="navMenuBg"></canvas>
            <div class="nav-layout">
                <div class="nav-topbar" id="navTopbar">
                    <div class="nav-cat-list" id="navCatList"></div>
                </div>
                <div class="nav-content" id="navContent">
                    <div class="nav-content-header" id="navHeaderWrap">
                        <h2 class="nav-content-title" id="navContentTitle"></h2>
                        <p class="nav-content-subtitle" id="navContentSub"></p>
                    </div>
                    <div class="nav-content-body" id="navContentBody"></div>
                </div>
            </div>`;

        document.body.appendChild(_overlay);

        _buildCatList();
    }

    function _buildCatList() {
        const list = document.getElementById('navCatList');
        if (!list) return;

        list.innerHTML = CATS.map((cat, i) => `
            <button class="nav-cat-item" data-idx="${i}" tabindex="-1">
                <span class="nav-cat-label">${cat.label}</span>
            </button>`).join('');

        list.querySelectorAll('.nav-cat-item').forEach(btn => {
            btn.addEventListener('click', () => {
                _catIdx = parseInt(btn.dataset.idx);
                _selectCat(_catIdx);
                _setTopbarFocus(true);
            });
        });
    }

    // ── Seleção de categoria ──────────────────────────────────────────────────
    function _selectCat(idx) {
        if (_navMenuPhase === 'closing') return;
        if (CATS[_catIdx]?.id === 'settings' && _settingsSubView === 'sound' && Number(idx) !== _catIdx) {
            window.DoorpiSoundUI?.closeDrawer?.('settings');
        }
        _catIdx = Number(idx);

        if (_preserveSettingsSubViewOnce) {
            _preserveSettingsSubViewOnce = false;
        } else {
            _settingsSubView = null;
            _profileSubView = null;
            _systemSubView = null;
            _settingsReturnToRoot = false;
        }

        document.querySelectorAll('.nav-cat-item').forEach((el, i) => {
            el.classList.toggle('active', i === _catIdx);
        });
        _updateTopbarFocusVisual();

        const cat = CATS[_catIdx];
        if (!cat) return;

        const titleEl = document.getElementById('navContentTitle');
        const subEl = document.getElementById('navContentSub');
        const headerWrap = document.getElementById('navHeaderWrap');

        const isProfile = cat.id === 'profile';

        if (headerWrap) headerWrap.style.display = isProfile ? 'none' : 'block';

        const header = document.querySelector('.nav-content-header');
        if (header) {
            header.style.animation = 'none';
            setTimeout(() => { if (header) header.style.animation = ''; }, 10);
        }

        if (titleEl) titleEl.textContent = cat.label;
        if (subEl) subEl.textContent = _subtitle(cat.id);

        _contentIdx = 0;
        _renderContent(cat.id);
    }

    function _subtitle(id) {
        const map = {
            games: _t('navGamesSub', 'Toda a sua biblioteca de jogos e títulos instalados'),
            media: _t('navMediaSub', 'Aplicativos e serviços de entretenimento'),
            settings: _t('navSettingsSub', 'Ajustes do sistema e preferências do console'),
            profile: _t('navProfileSub', 'Gerenciamento da sua conta e dados pessoais'),
        };
        return map[id] || '';
    }

    // ── Renderização Genérica de Grid (Jogos/Multimidia) com Lazy Loading ──
    function _renderGrid(body, items, catId, emptyText, emptyIcon) {
        _destroyLazyGrid();

        if (!items.length) {
            body.innerHTML = `<div class="nav-placeholder">
                <div class="nav-placeholder-icon">${emptyIcon}</div>
                <div class="nav-placeholder-text">${emptyText}</div>
            </div>`;
            _contentItems = [];
            return;
        }

        body.innerHTML = '';
        const scrollRoot = document.getElementById('navContentBody');

        _lazyGrid = new _NavLazyGrid({
            body,
            scrollRoot,
            items,
            catId,
            emptyIcon,
            onLaunchAction: (globalIdx) => _launchAction(catId, globalIdx),
            onFocusUpdate: (cards, globalIdx) => {
                _contentItems = cards;
                if (globalIdx >= 0) {
                    _topbarFocus = false;
                    _contentIdx  = globalIdx;
                    _updateContentFocus();
                }
            }
        });
    }

    // ── Launch ────────────────────────────────────────────────────────────────

    function _launchAction(catId, idx, itemList = null) {
        const items = itemList || (catId === 'games' ? _menuData.games : _menuData.media);
        const item = items[idx];
        if (!item) return;
        if (catId === 'games' && _isAdminLockedGame(item)) {
            window.showDoorpiToast?.(
                _t('adminBlockedTitle', 'Bloqueado pelo administrador'),
                _t('adminBlockedSubtitle', 'Esta loja foi privada para esta conta.')
            );
            return;
        }

        if (typeof postToHost === 'function') {
            if (catId === 'games') {
                const targetPath = item.LaunchUrl || item.Path || '';
                const completeLaunch = (discPath = '') => {
                    window.trackGameOpened?.(targetPath);
                    window.suspendDoorpiGameInput?.();
                    postToHost({
                        action: 'launch',
                        path: targetPath,
                        discPath,
                        errorMsg: _t('msgErrorLaunch', 'Erro ao abrir')
                    });

                    const tabBtn = document.querySelector('.home-tab[data-tab="games"]')
                        ?? document.querySelector('.home-tab:not(.active)');
                    tabBtn?.click();
                    close();
                };
                const emulatorDiscPaths = Array.isArray(item.EmulatorDiscPaths)
                    ? item.EmulatorDiscPaths.filter(Boolean)
                    : (Array.isArray(item.emulatorDiscPaths)
                        ? item.emulatorDiscPaths.filter(Boolean)
                        : []);
                const selectorItem = {
                    ...item,
                    name: item.Name || item.name || 'Jogo',
                    emulatorDiscPaths,
                    staticVertical: item.GridStaticImage || item.staticVertical || '',
                    vertical: item.GridImage || item.vertical || ''
                };
                if (emulatorDiscPaths.length > 1 &&
                    window.openEmulatorDiscSelector?.(selectorItem, completeLaunch)) {
                    return;
                }
                completeLaunch();
                return;
            } else if (catId === 'media') {
                const targetUrl = item.Url || '';
                const appType = item.Type || 'browser';
                postToHost({ action: 'launchMediaApp', url: targetUrl, appType: appType });
            }
        }

        // Troca a aba enquanto o nav menu ainda cobre a tela — sem ninguém ver
        const targetTab = catId === 'media' ? 'media' : 'games';
        const tabBtn = document.querySelector(`.home-tab[data-tab="${targetTab}"]`)
            ?? document.querySelector(`.home-tab:not(.active)`);
        tabBtn?.click();

        close();
    }

    // ── Renderização Central ──────────────────────────────────────────────────
    function _clearProfileOverviewCarousel() {
        if (!_profileOverviewCarouselTimer) return;
        clearTimeout(_profileOverviewCarouselTimer);
        _profileOverviewCarouselTimer = 0;
    }

    function _persistProfileOverviewCarousel(kind = '') {
        try {
            localStorage.setItem('doorpi.profile.hero.paused', _profileOverviewCarouselPaused ? '1' : '0');
            if (kind) localStorage.setItem('doorpi.profile.hero.kind', kind);
        } catch (_) {}
    }

    function _renderProfileWithTransition(direction = 'forward', focusIndex = _contentIdx) {
        _profileTabTransitionDirection = direction;
        const hadTopbarFocus = _topbarFocus;
        const update = () => {
            _renderContent('profile');
            _contentIdx = Math.max(0, Math.min(_contentItems.length - 1, focusIndex));
            if (!hadTopbarFocus) {
                _setTopbarFocus(false);
                _updateContentFocus();
            }
        };
        const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
        if (!reduceMotion && typeof document.startViewTransition === 'function') {
            document.documentElement.dataset.profileTransition = direction;
            try {
                const transition = document.startViewTransition(update);
                transition.finished.finally(() => {
                    delete document.documentElement.dataset.profileTransition;
                });
                return;
            } catch (_) {
                delete document.documentElement.dataset.profileTransition;
            }
        }
        update();
    }

    function _scheduleProfileOverviewCarousel(highlightCount) {
        _clearProfileOverviewCarousel();
        if (highlightCount < 2 || _profileSubView || _profileOverviewCarouselPaused ||
            window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return;
        _profileOverviewCarouselTimer = setTimeout(() => {
            _profileOverviewCarouselTimer = 0;
            if (!window.isNavMenuOpen || CATS[_catIdx]?.id !== 'profile' || _profileSubView || document.hidden) return;
            _profileOverviewAdvance?.(1, true);
        }, 8000);
    }

    function _renderContent(id) {
        const body = document.getElementById('navContentBody');
        if (!body) return;
        if (id !== 'profile' || _profileSubView) {
            _clearProfileOverviewCarousel();
            _profileOverviewAdvance = null;
        }
        _overlay?.classList.toggle('settings-ambient-active', id === 'settings');
        body.classList.toggle('profile-showcase-active', id === 'profile' && _profileSubView !== 'history');
        body.classList.toggle('settings-home-active', id === 'settings' && !_settingsSubView);

        switch (id) {
            case 'games':
            case 'media':
                _contentItems = [];
                _attachDualPane(body);
                _switchDualPane(id);
                break;
            case 'settings':
                _contentItems = [];
                _detachDualPane(body);
                body.innerHTML = '';
                _renderSettings(body);
                break;
            case 'profile':
                _contentItems = [];
                _detachDualPane(body);
                body.innerHTML = '';
                if (_profileSubView === 'history') _renderProfileHistory(body);
                else _renderProfile(body);
                break;
        }
    }

    // ── Vitrine de Perfil ─────────────────────────────────────────────────────
    function _ensureUnifiedProfileStyles() {
        if (document.getElementById('doorpiUnifiedProfileStyles')) return;
        const style = document.createElement('style');
        style.id = 'doorpiUnifiedProfileStyles';
        style.textContent = `
            .nav-unified-profile { --profile-accent:110,156,255; width:100%; height:100%; min-height:0; display:grid; grid-template-rows:auto auto minmax(0,1fr) auto; gap:clamp(10px,1.4vh,20px); color:#fff; }
            .nav-unified-identity { view-transition-name:doorpi-profile-identity; min-height:clamp(68px,8vh,96px); display:flex; align-items:center; gap:clamp(14px,1.3vw,22px); padding:0 2px; }
            .nav-unified-avatar { width:clamp(58px,7vh,82px); height:clamp(58px,7vh,82px); border-radius:50%; overflow:hidden; display:grid; place-items:center; flex:none; background:rgba(255,255,255,.055); border:2px solid rgba(255,255,255,.17); box-shadow:0 14px 36px rgba(0,0,0,.26); color:rgba(255,255,255,.34); font-size:1.8rem; }
            .nav-unified-avatar img { width:100%; height:100%; object-fit:cover; }
            .nav-unified-name { min-width:0; display:grid; }
            .nav-unified-name h2 { margin:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:clamp(1.55rem,2.25vw,3rem); font-weight:390; letter-spacing:-.028em; }
            .nav-unified-edit { margin-left:auto; min-height:42px; padding:0 19px; border-radius:999px; border:1px solid rgba(255,255,255,.14); background:rgba(255,255,255,.055); color:#fff; font:inherit; font-size:.86rem; font-weight:600; outline:none; transition:.16s ease; }
            .nav-unified-edit.nav-focused-el { color:#08101d; background:#fff; border-color:#fff; transform:scale(1.04); }
            .nav-unified-tabs { view-transition-name:doorpi-profile-tabs; display:flex; align-items:center; gap:4px; min-height:46px; border-bottom:1px solid rgba(255,255,255,.09); }
            .nav-unified-tab { position:relative; min-height:40px; margin-bottom:5px; padding:0 clamp(12px,1.25vw,22px); border:1px solid transparent; border-radius:8px; background:transparent; color:rgba(255,255,255,.48); font:inherit; font-size:clamp(.76rem,.83vw,.96rem); font-weight:590; outline:none; transition:color .16s ease,border-color .16s ease; }
            .nav-unified-tab::after { content:""; position:absolute; left:14px; right:14px; bottom:-1px; height:2px; border-radius:2px; background:rgb(var(--profile-accent)); opacity:0; transform:scaleX(.3); transition:.18s ease; }
            .nav-unified-tab.is-active { color:#fff; }
            .nav-unified-tab.is-active::after { opacity:1; transform:scaleX(1); }
            .nav-unified-tab.nav-focused-el { color:#fff; border-color:rgba(255,255,255,.92); }
            .nav-unified-main { min-height:0; display:grid; grid-template-columns:minmax(0,1.58fr) minmax(330px,.72fr); gap:clamp(12px,1.2vw,22px); }
            .nav-unified-profile.is-entering-forward .nav-unified-main,.nav-unified-profile.is-entering-forward .nav-unified-stats { animation:navProfileEnterForward .3s cubic-bezier(.22,.72,.2,1) both; }
            .nav-unified-profile.is-entering-back .nav-unified-main,.nav-unified-profile.is-entering-back .nav-unified-stats { animation:navProfileEnterBack .3s cubic-bezier(.22,.72,.2,1) both; }
            html[data-profile-transition] .nav-unified-profile .nav-unified-main,html[data-profile-transition] .nav-unified-profile .nav-unified-stats { animation:none !important; }
            .nav-unified-profile .nav-unified-stats { animation-delay:35ms !important; }
            @keyframes navProfileEnterForward { from { opacity:.35; transform:translateX(10px); } to { opacity:1; transform:none; } }
            @keyframes navProfileEnterBack { from { opacity:.35; transform:translateX(-10px); } to { opacity:1; transform:none; } }
            ::view-transition-group(doorpi-profile-identity),::view-transition-group(doorpi-profile-tabs){ animation-duration:.28s; animation-timing-function:ease; }
            ::view-transition-group(doorpi-profile-hero),::view-transition-group(doorpi-profile-recent),::view-transition-group(doorpi-profile-stats){ animation-duration:.42s; animation-timing-function:cubic-bezier(.22,.72,.2,1); }
            ::view-transition-old(doorpi-profile-hero),::view-transition-old(doorpi-profile-recent),::view-transition-old(doorpi-profile-stats){ animation:navProfileSnapshotOut .2s ease both; }
            ::view-transition-new(doorpi-profile-hero),::view-transition-new(doorpi-profile-recent),::view-transition-new(doorpi-profile-stats){ animation:navProfileSnapshotIn .4s cubic-bezier(.22,.72,.2,1) both; }
            html[data-profile-transition="back"]::view-transition-new(doorpi-profile-hero),html[data-profile-transition="back"]::view-transition-new(doorpi-profile-recent),html[data-profile-transition="back"]::view-transition-new(doorpi-profile-stats){ animation-name:navProfileSnapshotInBack; }
            @keyframes navProfileSnapshotOut { to { opacity:0; transform:scale(.995); } }
            @keyframes navProfileSnapshotIn { from { opacity:0; transform:translateX(12px); } }
            @keyframes navProfileSnapshotInBack { from { opacity:0; transform:translateX(-12px); } }
            .nav-unified-hero { --hero-fade-duration:1600ms; view-transition-name:doorpi-profile-hero; position:relative; min-height:0; overflow:hidden; border-radius:clamp(14px,1vw,20px); background:radial-gradient(circle at 82% 18%,rgba(var(--profile-accent),.2),transparent 45%),linear-gradient(145deg,rgba(255,255,255,.075),rgba(255,255,255,.018)); border:1px solid rgba(255,255,255,.1); box-shadow:0 24px 64px rgba(0,0,0,.28); outline:none; transition:border-color .18s ease,box-shadow .18s ease,transform .18s ease; }
            .nav-unified-hero.is-carousel { cursor:pointer; }
            .nav-unified-hero.nav-focused-el { border-color:rgba(255,255,255,.72); box-shadow:0 26px 72px rgba(0,0,0,.34),0 0 0 2px rgba(var(--profile-accent),.18); transform:scale(1.004); }
            .nav-unified-hero>img { position:absolute; z-index:1; inset:0; width:100%; height:100%; object-fit:cover; opacity:.72; filter:saturate(.94) contrast(1.02); transition:opacity var(--hero-fade-duration) cubic-bezier(.25,.65,.25,1); }
            .nav-unified-hero>img.is-next-art { opacity:0; }
            .nav-unified-hero>img.is-next-art.is-visible { opacity:.72; }
            .nav-unified-hero>img.is-leaving-art { opacity:0; }
            .nav-unified-hero.is-twitch-channel { background:#100c1b; }
            .nav-unified-hero.is-twitch-channel::before { content:""; position:absolute; z-index:0; inset:0; background-image:radial-gradient(circle at 78% 46%,rgba(145,70,255,.3),transparent 34%),linear-gradient(112deg,rgba(7,6,14,.92) 0%,rgba(21,13,39,.76) 48%,rgba(70,36,126,.3) 100%),var(--twitch-channel-backdrop,none),url('https://app.local/native-assets/twitch/hero.png'); background-position:center; background-size:cover; background-repeat:no-repeat; opacity:.9; }
            .nav-unified-hero.is-twitch-channel::after { background:linear-gradient(90deg,rgba(5,4,11,.82) 0%,rgba(8,6,16,.62) 44%,rgba(9,6,17,.06) 76%),linear-gradient(0deg,rgba(3,3,8,.42),transparent 58%); }
            .nav-unified-hero>img.is-channel-avatar { inset:50% clamp(54px,7vw,122px) auto auto; width:clamp(164px,17vw,250px); height:clamp(164px,17vw,250px); transform:translateY(-50%); object-fit:cover; border-radius:50%; opacity:1; filter:saturate(1.02) contrast(1.02); border:clamp(3px,.26vw,5px) solid rgba(255,255,255,.9); box-shadow:0 0 0 8px rgba(145,70,255,.18),0 26px 68px rgba(0,0,0,.48); }
            .nav-unified-hero>img.is-channel-avatar.is-next-art { opacity:0; }
            .nav-unified-hero>img.is-channel-avatar.is-next-art.is-visible { opacity:1; }
            .nav-unified-hero>img.is-channel-avatar.is-leaving-art { opacity:0; }
            .nav-unified-hero.is-twitch-channel .nav-unified-hero-copy { z-index:3; width:min(58%,620px); }
            .nav-unified-art-fallback { position:absolute; z-index:0; inset:0; display:grid; place-items:center; padding:12px; box-sizing:border-box; color:rgba(255,255,255,.38); font-size:clamp(.62rem,.72vw,.82rem); font-weight:650; letter-spacing:.08em; text-align:center; text-transform:uppercase; }
            .nav-unified-art-fallback span { display:block; max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
            .nav-unified-hero>.nav-unified-art-fallback { justify-items:end; align-items:start; padding:clamp(22px,2.2vw,38px); color:rgba(255,255,255,.18); font-size:clamp(.72rem,.9vw,1rem); }
            .nav-unified-hero::after { content:""; position:absolute; z-index:1; inset:0; background:linear-gradient(90deg,rgba(5,8,16,.94) 0%,rgba(5,8,16,.74) 38%,rgba(5,8,16,.16) 76%),linear-gradient(0deg,rgba(3,5,11,.6),transparent 62%); }
            .nav-unified-hero-copy { position:relative; z-index:2; width:min(70%,700px); height:100%; min-height:inherit; box-sizing:border-box; padding:clamp(24px,3vw,54px); display:flex; flex-direction:column; justify-content:flex-end; align-items:flex-start; }
            .nav-unified-kicker { margin-bottom:9px; color:rgba(255,255,255,.54); font-size:clamp(.66rem,.72vw,.82rem); font-weight:720; letter-spacing:.15em; text-transform:uppercase; }
            .nav-unified-hero h3 { max-width:100%; margin:0; display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:2; overflow:hidden; font-size:clamp(1.55rem,2.45vw,3.5rem); font-weight:470; line-height:1.04; letter-spacing:-.032em; text-shadow:0 10px 30px rgba(0,0,0,.5); }
            .nav-unified-hero.is-empty h3 { max-width:520px; font-size:clamp(1.4rem,2.05vw,2.8rem); line-height:1.08; }
            .nav-unified-hero-meta { margin-top:13px; color:rgba(255,255,255,.68); font-size:clamp(.76rem,.85vw,.98rem); font-weight:550; }
            .nav-unified-hero-pager { position:absolute; z-index:3; right:clamp(18px,1.8vw,30px); bottom:clamp(17px,1.7vw,28px); display:flex; align-items:center; gap:7px; }
            .nav-unified-hero-pager i { width:6px; height:6px; border-radius:999px; background:rgba(255,255,255,.32); box-shadow:0 2px 8px rgba(0,0,0,.32); transition:width .25s ease,background .25s ease; }
            .nav-unified-hero-pager i.is-active { width:22px; background:rgba(255,255,255,.9); }
            .nav-unified-hero-state { width:10px; height:10px; margin-right:2px; opacity:.66; }
            .nav-unified-hero-state svg { width:100%; height:100%; display:none; fill:currentColor; }
            .nav-unified-hero-state:not(.is-paused) .icon-pause,.nav-unified-hero-state.is-paused .icon-play { display:block; }
            .nav-unified-recent { view-transition-name:doorpi-profile-recent; min-height:0; display:flex; flex-direction:column; padding:clamp(15px,1.4vw,24px); border-radius:clamp(14px,1vw,20px); background:rgba(255,255,255,.035); border:1px solid rgba(255,255,255,.085); overflow:hidden; outline:none; transition:border-color .18s ease,box-shadow .18s ease; }
            .nav-unified-recent.nav-focused-el { border-color:rgba(255,255,255,.68); box-shadow:0 0 0 2px rgba(var(--profile-accent),.14); }
            .nav-unified-section-head { display:flex; align-items:center; justify-content:space-between; gap:12px; min-height:31px; margin-bottom:8px; }
            .nav-unified-section-head strong { font-size:clamp(.82rem,.95vw,1.08rem); font-weight:610; }
            .nav-unified-journey { min-height:31px; padding:0 11px; border-radius:6px; border:1px solid rgba(255,255,255,.12); background:rgba(255,255,255,.04); color:rgba(255,255,255,.66); font:inherit; font-size:.72rem; outline:none; }
            .nav-unified-journey.nav-focused-el { background:#fff; color:#08101d; border-color:#fff; }
            .nav-unified-list { min-height:0; display:flex; flex-direction:column; overflow-x:hidden; overflow-y:auto; overscroll-behavior:contain; scrollbar-width:none; }
            .nav-unified-list::-webkit-scrollbar { display:none; }
            .nav-unified-row { flex:0 0 auto; min-height:clamp(52px,6.15vh,72px); display:grid; grid-template-columns:clamp(68px,5.6vw,98px) minmax(0,1fr) auto; align-items:center; gap:clamp(10px,.9vw,16px); border-top:1px solid rgba(255,255,255,.075); transition:background .16s ease; }
            .nav-unified-row:first-child { border-top:0; }
            .nav-unified-recent.nav-focused-el .nav-unified-row.is-current { background:rgba(255,255,255,.075); }
            .nav-unified-row-art { position:relative; width:100%; aspect-ratio:16/9; border-radius:6px; overflow:hidden; display:grid; place-items:center; background:rgba(0,0,0,.28); }
            .nav-unified-row-art img { position:relative; z-index:1; width:100%; height:100%; object-fit:cover; }
            .nav-unified-row-copy { min-width:0; display:grid; gap:3px; }
            .nav-unified-row-copy strong { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:clamp(.74rem,.82vw,.94rem); font-weight:580; }
            .nav-unified-row-copy small,.nav-unified-row-time small { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:rgba(255,255,255,.4); font-size:clamp(.62rem,.66vw,.74rem); }
            .nav-unified-row-time { display:grid; gap:3px; text-align:right; font-variant-numeric:tabular-nums; }
            .nav-unified-row-time strong { color:rgba(255,255,255,.78); font-size:clamp(.68rem,.75vw,.86rem); font-weight:570; }
            .nav-unified-empty { flex:1; display:grid; place-items:center; padding:24px; text-align:center; color:rgba(255,255,255,.34); font-size:.84rem; line-height:1.5; }
            .nav-unified-stats { view-transition-name:doorpi-profile-stats; min-height:clamp(72px,8.6vh,104px); display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); border-radius:clamp(12px,.9vw,17px); border:1px solid rgba(255,255,255,.085); background:linear-gradient(100deg,rgba(255,255,255,.045),rgba(255,255,255,.018)); }
            .nav-unified-stat { position:relative; min-width:0; padding:clamp(11px,1.2vw,20px) clamp(18px,1.7vw,31px); display:flex; flex-direction:column; justify-content:center; gap:5px; }
            .nav-unified-stat+.nav-unified-stat::before { content:""; position:absolute; left:0; top:20%; bottom:20%; width:1px; background:linear-gradient(transparent,rgba(255,255,255,.14),transparent); }
            .nav-unified-stat small { color:rgba(255,255,255,.42); font-size:clamp(.62rem,.67vw,.76rem); font-weight:650; letter-spacing:.1em; text-transform:uppercase; }
            .nav-unified-stat strong { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:clamp(1.1rem,1.55vw,2rem); font-weight:380; }
            .nav-unified-stat.is-compact strong { font-size:clamp(.88rem,1.08vw,1.36rem); font-weight:470; }
            @media(max-width:1100px){.nav-unified-main{grid-template-columns:minmax(0,1.3fr) minmax(280px,.8fr)}.nav-unified-hero-copy{width:78%}}
            @media(max-height:760px){.nav-unified-profile{gap:8px}.nav-unified-identity{min-height:56px}.nav-unified-avatar{width:52px;height:52px}.nav-unified-tabs,.nav-unified-tab{min-height:38px}.nav-unified-recent{padding:12px}.nav-unified-row{min-height:47px}.nav-unified-stats{min-height:64px}}
            @media(prefers-reduced-motion:reduce){.nav-unified-profile.is-entering-forward .nav-unified-main,.nav-unified-profile.is-entering-forward .nav-unified-stats,.nav-unified-profile.is-entering-back .nav-unified-main,.nav-unified-profile.is-entering-back .nav-unified-stats{animation:none}.nav-unified-hero,.nav-unified-hero-pager i{transition:none}}
        `;
        document.head.appendChild(style);
    }

    function _renderProfile(body) {
        _ensureUnifiedProfileStyles();
        const prof = _menuData.user || {};
        const games = _menuData.games || [];
        const gameHistory = (_menuData.history || []).filter(item => item?.Name && Number(item.TotalPlaytimeMinutes) >= 1);
        const mediaHistory = (_menuData.mediaHistory || []).filter(item => item?.ContentTitle && Number(item.TotalPlaybackSeconds) >= 1);
        const mediaApps = _menuData.media || [];
        const tab = ['gaming', 'film-series', 'streaming', 'music'].includes(_profileSubView) ? _profileSubView : 'overview';
        const trackingEnabled = prof.ApplicationHistoryEnabled !== false && prof.applicationHistoryEnabled !== false;
        const name = prof.Name || 'Doorpi';
        const photo = prof.PhotoBase64 || '';

        const fmtSeconds = value => {
            const total = Math.max(0, Math.round(Number(value) || 0));
            if (total < 60) return total ? '< 1 min' : '--';
            const hours = Math.floor(total / 3600);
            const minutes = Math.floor((total % 3600) / 60);
            if (!hours) return `${minutes} min`;
            return `${hours}h ${String(minutes).padStart(2, '0')}min`;
        };
        const relDate = value => {
            const time = new Date(value || 0).getTime();
            if (!Number.isFinite(time) || time <= 0) return '';
            const days = Math.max(0, Math.floor((Date.now() - time) / 86400000));
            if (days === 0) return _t('today', 'hoje');
            if (days === 1) return _t('yesterday', 'ontem');
            if (days < 7) return `há ${days} dias`;
            return new Date(time).toLocaleDateString();
        };
        const isToday = value => {
            const date = new Date(value || 0);
            if (!Number.isFinite(date.getTime()) || date.getTime() <= 0) return false;
            const now = new Date();
            return date.getFullYear() === now.getFullYear() &&
                date.getMonth() === now.getMonth() &&
                date.getDate() === now.getDate();
        };
        const nowForTodayKey = new Date();
        const todayKey = `${nowForTodayKey.getFullYear()}-${String(nowForTodayKey.getMonth() + 1).padStart(2,'0')}-${String(nowForTodayKey.getDate()).padStart(2,'0')}`;
        const appFor = id => mediaApps.find(app => String(app.Id || app.id || '').toLowerCase() === String(id || '').toLowerCase()) || {};
        const appName = id => appFor(id).Name || mediaHistory.find(item => item.AppId === id)?.AppName || id || 'Doorpi';
        const appArt = app => app.HeroStaticImage || app.HeroImage || app.GridHorizontalStaticImage || app.GridHorizontalImage || app.GridStaticImage || app.GridImage || '';
        const appThumb = app => app.GridHorizontalStaticImage || app.GridHorizontalImage || app.HeroStaticImage || app.HeroImage || app.GridStaticImage || app.GridImage || '';
        const gameArt = item => item?.ProfileBannerLocalImage || item?.ProfileBannerImageUrl || item?.HistoryHorizontalLocalImage || item?.GridHorizontalStaticImage || item?.GridHorizontalImage || item?.HistoryHorizontalImageUrl || item?.GridStaticImage || item?.GridImage || '';
        const mediaArtChain = item => [...new Set([
            item?.ArtworkLocalUrl,
            item?.ArtworkRemoteUrl,
            appThumb(appFor(item?.AppId))
        ].filter(Boolean))];
        const isEpisode = item => String(item?.Category || '').toLowerCase() !== 'music' &&
            (String(item?.ContentType || '').toLowerCase() === 'episode' ||
             !!(item?.SeriesTitle && item.SeriesTitle !== item.ContentTitle));
        const mediaPrimaryTitle = item => isEpisode(item)
            ? (item?.SeriesTitle || item?.ContentTitle || appName(item?.AppId))
            : (item?.ContentTitle || item?.SeriesTitle || appName(item?.AppId));
        const mediaSecondaryTitle = item => {
            if (!isEpisode(item)) return '';
            if (item?.ContentTitle && item.ContentTitle !== mediaPrimaryTitle(item)) return item.ContentTitle;
            const episode = item?.EpisodeNumber ? `${_t('navEpisodeShort','Ep.')} ${item.EpisodeNumber}` : '';
            return [item?.SeasonTitle, episode].filter(Boolean).join(' · ');
        };
        const isLiveActivity = item => String(item?.Category || '').toLowerCase() === 'live' ||
            ['twitch', 'kick'].includes(String(item?.AppId || '').toLowerCase());
        const mediaActivityLabel = item => {
            if (!item) return '';
            if (String(item.Category || '').toLowerCase() === 'music') {
                return [item.ContentTitle, item.CreatorName, appName(item.AppId)].filter(Boolean).join(' · ');
            }
            if (isLiveActivity(item)) {
                const creator = String(item.CreatorName || '').trim();
                return creator
                    ? `${_t('navWatchedCreator','Assistiu')} ${creator} · ${appName(item.AppId)}`
                    : appName(item.AppId);
            }
            return [mediaPrimaryTitle(item), mediaSecondaryTitle(item), appName(item.AppId)]
                .filter(Boolean)
                .join(' · ');
        };
        const filmHighlightMeta = group => {
            if (!group) return '';
            const lastEpisode = isEpisode(group.latest) ? mediaSecondaryTitle(group.latest) : '';
            const watched = `${fmtSeconds(group.seconds)} ${_t('navProfileTotalSuffix','no total')}`;
            return lastEpisode
                ? `${_t('navLastEpisode','Último episódio')}: ${lastEpisode} · ${watched}`
                : watched;
        };
        const artImage = (chain, lazy = false, fallbackLabel = '', imageClass = '') => {
            const candidates = Array.isArray(chain) ? chain.filter(Boolean) : [];
            const fallback = `<span class="nav-unified-art-fallback"><span>${_esc(fallbackLabel || 'Doorpi')}</span></span>`;
            if (!candidates.length) return fallback;
            const fallbacks = encodeURIComponent(JSON.stringify(candidates.slice(1)));
            return `${fallback}<img${imageClass ? ` class="${_esc(imageClass)}"` : ''} src="${_esc(candidates[0])}" data-art-fallbacks="${_esc(fallbacks)}"${lazy ? ' loading="lazy" decoding="async"' : ''} alt="" />`;
        };
        const gameMinutes = gameHistory.reduce((sum, item) => sum + (Number(item.TotalPlaytimeMinutes) || 0), 0);
        const mediaSeconds = mediaHistory.reduce((sum, item) => sum + (Number(item.TotalPlaybackSeconds) || 0), 0);
        const films = mediaHistory.filter(item => item.Category === 'film-series');
        const streams = mediaHistory.filter(item => item.Category === 'live' || item.Category === 'video');
        const music = mediaHistory.filter(item => item.Category === 'music');
        const groupPlatforms = entries => [...entries.reduce((map, item) => {
            const key = item.AppId || 'unknown';
            const current = map.get(key) || { id:key, seconds:0, entries:[] };
            current.seconds += Number(item.TotalPlaybackSeconds) || 0;
            current.entries.push(item);
            map.set(key, current);
            return map;
        }, new Map()).values()].sort((a,b) => b.seconds - a.seconds);
        const groupFilmTitles = entries => [...entries.reduce((map, item) => {
            const title = mediaPrimaryTitle(item);
            const key = `${String(item.AppId || '').toLowerCase()}\u001f${title.toLocaleLowerCase()}`;
            const current = map.get(key) || { title, seconds:0, entries:[], latest:null };
            current.seconds += Number(item.TotalPlaybackSeconds) || 0;
            current.entries.push(item);
            if (!current.latest || new Date(item.LastPlayed || 0) > new Date(current.latest.LastPlayed || 0)) current.latest = item;
            map.set(key, current);
            return map;
        }, new Map()).values()].sort((a,b) => b.seconds - a.seconds);
        const mostPlayedGame = [...gameHistory].sort((a,b) => Number(b.TotalPlaytimeMinutes) - Number(a.TotalPlaytimeMinutes))[0];
        const latestGame = [...gameHistory].sort((a,b) => new Date(b.LastPlayed || 0) - new Date(a.LastPlayed || 0))[0];
        const latestMedia = [...mediaHistory].sort((a,b) => new Date(b.LastPlayed || 0) - new Date(a.LastPlayed || 0))[0];
        const filmPlatform = groupPlatforms(films)[0];
        const streamPlatform = groupPlatforms(streams)[0];

        const gameHighlight = mostPlayedGame ? {
            kind:'gaming',
            kicker:_t('navGamingHighlight','Destaque em jogos'),
            title:mostPlayedGame.Name,
            meta:`${fmtSeconds(Number(mostPlayedGame.TotalPlaytimeMinutes) * 60)} ${_t('navProfileTotalSuffix','no total')}`,
            art:gameArt(mostPlayedGame),
            artChain:[gameArt(mostPlayedGame)].filter(Boolean),
            appId:''
        } : null;
        const topFilm = groupFilmTitles(filmPlatform?.entries || [])[0];
        const filmHighlight = topFilm?.latest ? (() => {
            const chain = mediaArtChain(topFilm.latest);
            return {
                kind:'film-series',
                kicker:`${_t('navMostWatched','Mais assistido')} · ${appName(filmPlatform.id)}`,
                title:topFilm.title,
                meta:filmHighlightMeta(topFilm),
                art:chain[0] || appArt(appFor(filmPlatform.id)),
                artChain:chain,
                appId:filmPlatform.id
            };
        })() : null;
        const streamCreatorGroups = [...streams.reduce((map,item) => {
            const label = (item.CreatorName || item.ContentTitle || '').trim();
            const key = label.toLocaleLowerCase();
            if (label) {
                const current = map.get(key) || { label, seconds:0, entries:[] };
                current.seconds += Number(item.TotalPlaybackSeconds || 0);
                current.entries.push(item);
                map.set(key, current);
            }
            return map;
        }, new Map()).values()].sort((a,b) => b.seconds - a.seconds);
        const favoriteCreator = streamCreatorGroups[0];
        const favoriteCreatorEntry = favoriteCreator ? favoriteCreator.entries
            .sort((a,b) => {
                const aHasContentArt = !!(a.ArtworkLocalUrl || a.ArtworkRemoteUrl);
                const bHasContentArt = !!(b.ArtworkLocalUrl || b.ArtworkRemoteUrl);
                if (aHasContentArt !== bHasContentArt) return bHasContentArt - aHasContentArt;
                return new Date(b.LastPlayed || 0) - new Date(a.LastPlayed || 0);
            })[0] : null;
        const streamHighlight = favoriteCreator && favoriteCreatorEntry ? (() => {
            const chain = mediaArtChain(favoriteCreatorEntry);
            return {
                kind:'streaming',
                kicker:`${_t('navMostWatched','Mais assistido')} · ${appName(favoriteCreatorEntry.AppId)}`,
                title:favoriteCreator.label,
                meta:`${fmtSeconds(favoriteCreator.seconds)} ${_t('navProfileTotalSuffix','no total')}`,
                art:chain[0] || appArt(appFor(favoriteCreatorEntry.AppId)),
                artChain:chain,
                appId:favoriteCreatorEntry.AppId,
                channelHub:String(favoriteCreatorEntry.AppId || '').toLowerCase() === 'twitch' &&
                    String(favoriteCreatorEntry.ArtworkSource || '').toLowerCase() === 'channel-avatar',
                hubBackdrop:appArt(appFor(favoriteCreatorEntry.AppId))
            };
        })() : null;
        const musicArtistGroups = [...music.reduce((map,item) => {
            const label = (item.CreatorName || item.ContentTitle || '').trim();
            if (label) map.set(label, (map.get(label) || 0) + Number(item.TotalPlaybackSeconds || 0));
            return map;
        }, new Map()).entries()].sort((a,b) => b[1] - a[1]);
        const topMusicArtist = musicArtistGroups[0];
        const topMusicEntry = topMusicArtist ? music
            .filter(item => (item.CreatorName || item.ContentTitle || '').trim() === topMusicArtist[0])
            .sort((a,b) => new Date(b.LastPlayed || 0) - new Date(a.LastPlayed || 0))[0] : null;
        const musicHighlight = topMusicArtist && topMusicEntry ? (() => {
            const chain = mediaArtChain(topMusicEntry);
            return {
                kind:'music',
                kicker:`${_t('navMostListened','Mais ouvido')} · ${appName(topMusicEntry.AppId)}`,
                title:topMusicArtist[0],
                meta:`${fmtSeconds(topMusicArtist[1])} ${_t('navProfileTotalSuffix','no total')}`,
                art:chain[0] || appArt(appFor(topMusicEntry.AppId)),
                artChain:chain,
                appId:topMusicEntry.AppId
            };
        })() : null;
        const overviewHighlights = [gameHighlight, filmHighlight, streamHighlight, musicHighlight].filter(Boolean);

        let hero = {
            kicker:_t('navProfileEmptyKicker','Seu perfil'),
            title:_t('navProfileEmptyTitle','Nenhuma atividade registrada'),
            meta:_t('navProfileEmptyHint','Jogue ou assista para começar'),
            art:'', appId:'', isEmpty:true
        };
        let rows = [];
        let stats = [];
        let sectionTitle = _t('navTodayActivity', 'Atividade de hoje');
        const gameRows = gameHistory.map(item => ({ title:item.Name, sub:_t('navGames','Jogos'), seconds:Number(item.TotalPlaytimeMinutes) * 60, recentSeconds:Number(item.LastSessionMinutes) * 60, date:item.LastPlayed, artChain:[gameArt(item)].filter(Boolean), platform:_t('navGames','Jogos') }));
        const mediaRows = entries => entries.map(item => ({
            title:mediaPrimaryTitle(item),
            sub:item.Category === 'music'
                ? [item.CreatorName, item.AlbumTitle, appName(item.AppId)].filter(Boolean).join(' · ')
                : isEpisode(item)
                ? [mediaSecondaryTitle(item), appName(item.AppId)].filter(Boolean).join(' · ')
                : [item.CreatorName, appName(item.AppId)].filter(Boolean).join(' · '),
            seconds:Number(item.TotalPlaybackSeconds),
            recentSeconds:isToday(item.LastPlayed) && String(item.DailyPlaybackDate || '') === todayKey
                ? Number(item.DailyPlaybackSeconds)
                : 0,
            date:item.LastPlayed,
            artChain:mediaArtChain(item),
            platform:appName(item.AppId),
            source:item
        }));
        const filmRows = groupFilmTitles(films).map(group => ({
            title:group.title,
            sub:[isEpisode(group.latest) ? mediaSecondaryTitle(group.latest) : '', appName(group.latest?.AppId)].filter(Boolean).join(' · '),
            seconds:group.seconds,
            date:group.latest?.LastPlayed,
            artChain:mediaArtChain(group.latest),
            platform:appName(group.latest?.AppId)
        }));
        const streamRows = [...streams.reduce((map, item) => {
            const title = String(item.CreatorName || item.ContentTitle || appName(item.AppId)).trim();
            const key = title.toLocaleLowerCase();
            const current = map.get(key) || { title, seconds:0, date:item.LastPlayed, latest:item, platforms:new Set() };
            current.seconds += Number(item.TotalPlaybackSeconds) || 0;
            current.platforms.add(appName(item.AppId));
            if (new Date(item.LastPlayed || 0) > new Date(current.date || 0)) {
                current.date = item.LastPlayed;
                current.latest = item;
            }
            map.set(key, current);
            return map;
        }, new Map()).values()].map(item => ({
            ...item,
            sub:[...item.platforms].join(' · '),
            platform:appName(item.latest?.AppId),
            artChain:mediaArtChain(item.latest)
        }));
        const musicRows = mediaRows(music);

        if (tab === 'gaming') {
            if (gameHighlight) hero = { ...gameHighlight, kicker:_t('navStatMostPlayed','Mais jogado') };
            rows = gameRows.sort((a,b) => b.seconds - a.seconds);
            sectionTitle = _t('navMostPlayedGames', 'Mais jogados');
            stats = [
                [_t('navStatGames','Jogos na biblioteca'), String(games.length)],
                [_t('navStatTime','Tempo jogado'), fmtSeconds(gameMinutes * 60)],
                [_t('navLastPlayed','Último jogado'), latestGame?.Name || '--', true]
            ];
        } else if (tab === 'film-series') {
            if (filmHighlight) hero = filmHighlight;
            rows = filmRows.sort((a,b) => b.seconds - a.seconds);
            sectionTitle = _t('navMostWatchedTitles', 'Mais assistidos');
            stats = [
                [_t('navWatchTime','Tempo assistido'), fmtSeconds(films.reduce((s,i) => s + Number(i.TotalPlaybackSeconds || 0), 0))],
                [_t('navTitlesWatched','Séries/filmes assistidos'), String(groupFilmTitles(films).length)],
                [_t('navFavoritePlatform','Plataforma principal'), filmPlatform ? appName(filmPlatform.id) : '--', true]
            ];
        } else if (tab === 'streaming') {
            if (streamHighlight) hero = streamHighlight;
            rows = streamRows.sort((a,b) => b.seconds - a.seconds);
            sectionTitle = _t('navMostWatchedCreators', 'Mais assistidos');
            stats = [
                [_t('navWatchTime','Tempo assistido'), fmtSeconds(streams.reduce((s,i) => s + Number(i.TotalPlaybackSeconds || 0), 0))],
                [_t('navCreatorsWatched','Criadores acompanhados'), String(new Set(streams.map(i => i.CreatorName).filter(Boolean)).size)],
                [_t('navFavoritePlatform','Plataforma principal'), streamPlatform ? appName(streamPlatform.id) : '--', true]
            ];
        } else if (tab === 'music') {
            if (musicHighlight) hero = musicHighlight;
            rows = musicRows.sort((a,b) => b.seconds - a.seconds);
            sectionTitle = _t('navMostListenedTracks', 'Mais ouvidos');
            stats = [
                [_t('navListeningTime','Tempo ouvido'), fmtSeconds(music.reduce((s,i) => s + Number(i.TotalPlaybackSeconds || 0), 0))],
                [_t('navTracksListened','Faixas ouvidas'), String(new Set(music.map(i => `${i.ContentTitle}\u001f${i.CreatorName}`)).size)],
                [_t('navMostListenedArtist','Artista mais ouvido'), topMusicArtist?.[0] || '--', true]
            ];
        } else {
            if (overviewHighlights.length) {
                if (_profileOverviewCarouselPaused && _profileOverviewStoredKind) {
                    const storedIndex = overviewHighlights.findIndex(item => item.kind === _profileOverviewStoredKind);
                    if (storedIndex >= 0) _profileOverviewHeroIndex = storedIndex;
                }
                _profileOverviewHeroIndex %= overviewHighlights.length;
                hero = overviewHighlights[_profileOverviewHeroIndex];
            }
            rows = [...gameRows, ...mediaRows(mediaHistory)]
                .filter(item => isToday(item.date))
                .map(item => ({ ...item, seconds:Math.max(0, Number(item.recentSeconds) || 0) }))
                .sort((a,b) => new Date(b.date || 0) - new Date(a.date || 0));
            const latestGameToday = isToday(latestGame?.LastPlayed) ? latestGame : null;
            const latestMediaToday = isToday(latestMedia?.LastPlayed) ? latestMedia : null;
            const latestIsMedia = new Date(latestMediaToday?.LastPlayed || 0) > new Date(latestGameToday?.LastPlayed || 0);
            stats = [
                [_t('navGamingTime','Tempo em jogos'), fmtSeconds(gameMinutes * 60)],
                [_t('navWatchTime','Tempo assistido'), fmtSeconds(mediaSeconds)],
                [_t('navLastActivity','Última atividade'), (latestIsMedia ? mediaActivityLabel(latestMediaToday) : latestGameToday?.Name) || '--', true]
            ];
        }

        const accentByApp = { youtube:'255,68,68', netflix:'229,9,20', twitch:'145,70,255', kick:'83,252,24', disneyplus:'63,117,255', primevideo:'0,168,225', appletv:'235,235,240', max:'116,63,255', crunchyroll:'244,117,33' };
        const accentForHero = item => accentByApp[item?.appId] || (item?.kind === 'music' || tab === 'music' ? '52,211,120' : item?.kind === 'gaming' || tab === 'gaming' ? '92,154,255' : '110,156,255');
        const accent = accentForHero(hero);
        const applyChannelBackdrop = (element, item) => {
            if (!element) return;
            const backdrop = item?.channelHub ? String(item.hubBackdrop || '').trim() : '';
            if (backdrop) element.style.setProperty('--twitch-channel-backdrop', `url(${JSON.stringify(backdrop)})`);
            else element.style.removeProperty('--twitch-channel-backdrop');
        };
        const tabs = [
            ['overview', _t('navProfileOverview','Visão geral')],
            ['gaming', _t('navGames','Jogos')],
            ['film-series', _t('navFilmsSeries','Filmes e séries')],
            ['streaming', _t('navStreamingVideos','Ao vivo e vídeos')],
            ['music', _t('navMusic','Música')]
        ];
        const rowHtml = rows.map((item, index) => `
            <div class="nav-unified-row${index === 0 ? ' is-current' : ''}" data-profile-recent-index="${index}" role="option" aria-selected="${index === 0 ? 'true' : 'false'}">
                <span class="nav-unified-row-art">${artImage(item.artChain, true, item.platform)}</span>
                <span class="nav-unified-row-copy"><strong>${_esc(item.title)}</strong><small>${_esc(item.sub || '')}</small></span>
                <span class="nav-unified-row-time"><strong>${fmtSeconds(item.seconds)}</strong><small>${relDate(item.date)}</small></span>
            </div>`).join('');
        const heroCarouselEnabled = tab === 'overview' && overviewHighlights.length > 1;
        const heroPager = heroCarouselEnabled
            ? `<span class="nav-unified-hero-pager" aria-hidden="true"><b class="nav-unified-hero-state${_profileOverviewCarouselPaused ? ' is-paused' : ''}"><svg class="icon-play" viewBox="0 0 12 12"><path d="M2.4 1.4 10 6l-7.6 4.6z"/></svg><svg class="icon-pause" viewBox="0 0 12 12"><path d="M2.2 1.5h2.6v9H2.2zm5 0h2.6v9H7.2z"/></svg></b>${overviewHighlights.map((_, index) => `<i class="${index === _profileOverviewHeroIndex ? 'is-active' : ''}"></i>`).join('')}</span>`
            : '';
        const profileEntryClass = document.documentElement.dataset.profileTransition
            ? ''
            : ` is-entering-${_profileTabTransitionDirection}`;

        body.innerHTML = `
            <div class="nav-unified-profile${profileEntryClass}" style="--profile-accent:${accent}">
                <header class="nav-unified-identity">
                    <div class="nav-unified-avatar">${photo ? `<img src="${window._doorpiUserPhotoSrc?.(photo) || `data:image/png;base64,${photo}`}" alt="" />` : '◎'}</div>
                    <div class="nav-unified-name"><h2>${_esc(name)}</h2></div>
                    <button class="nav-unified-edit" id="btnEditProfileHub" tabindex="-1">${_t('navEditProfileBtn','Editar perfil')}</button>
                </header>
                <nav class="nav-unified-tabs" aria-label="${_t('navProfileSections','Seções do perfil')}">${tabs.map(([id,label]) => `<button class="nav-unified-tab${tab === id ? ' is-active' : ''}" data-profile-tab="${id}" tabindex="-1">${label}</button>`).join('')}</nav>
                <div class="nav-unified-main">
                    <section class="nav-unified-hero${hero.isEmpty ? ' is-empty' : ''}${heroCarouselEnabled ? ' is-carousel' : ''}${hero.channelHub ? ' is-twitch-channel' : ''}"${heroCarouselEnabled ? ` id="btnProfileHero" role="button" aria-label="${_esc(_profileOverviewCarouselPaused ? _t('navPlayHighlights','Retomar troca automática') : _t('navPauseHighlights','Pausar troca automática'))}" tabindex="-1"` : ''}>${artImage(hero.artChain?.length ? hero.artChain : [hero.art].filter(Boolean), false, hero.appId ? appName(hero.appId) : _t('navGames','Jogos'), hero.channelHub ? 'is-channel-avatar' : '')}<div class="nav-unified-hero-copy"><span class="nav-unified-kicker">${_esc(hero.kicker)}</span><h3>${_esc(hero.title)}</h3><span class="nav-unified-hero-meta">${_esc(hero.meta)}</span></div>${heroPager}</section>
                    <aside class="nav-unified-recent"${rows.length ? ` id="btnProfileRecent" role="listbox" aria-label="${_esc(sectionTitle)}" tabindex="-1"` : ''}><div class="nav-unified-section-head"><strong>${sectionTitle}</strong>${tab === 'gaming' && gameHistory.length ? `<button class="nav-unified-journey" id="btnGameHistory" tabindex="-1">${_t('navGameHistoryBtn','Ver jornada')}</button>` : ''}</div><div class="nav-unified-list">${rowHtml || `<div class="nav-unified-empty">${tab === 'overview' && trackingEnabled ? _t('navNoActivityToday','Nenhuma atividade hoje.') : trackingEnabled || tab === 'gaming' ? _t('navNoCategoryActivity','Nenhuma atividade nesta categoria ainda.') : _t('navHistoryPausedHint','A coleta está pausada nas configurações do perfil.')}</div>`}</div></aside>
                </div>
                <footer class="nav-unified-stats">${stats.map(([label,value,compact]) => `<div class="nav-unified-stat${compact ? ' is-compact' : ''}"><small>${label}</small><strong>${_esc(value)}</strong></div>`).join('')}</footer>
            </div>`;

        applyChannelBackdrop(body.querySelector('.nav-unified-hero'), hero);

        const bindArtFallback = image => {
            let fallbacks = [];
            try { fallbacks = JSON.parse(decodeURIComponent(image.dataset.artFallbacks || '[]')); } catch (_) {}
            image.addEventListener('error', () => {
                const next = fallbacks.shift();
                if (next) image.src = next;
                else image.remove();
            });
        };
        body.querySelectorAll('img[data-art-fallbacks]').forEach(bindArtFallback);

        _contentItems = [...body.querySelectorAll('.nav-unified-tab')];
        const heroButton = body.querySelector('#btnProfileHero');
        const recent = body.querySelector('#btnProfileRecent');
        const edit = body.querySelector('#btnEditProfileHub');
        const journey = body.querySelector('#btnGameHistory');
        if (heroButton) _contentItems.push(heroButton);
        if (recent) _contentItems.push(recent);
        if (edit) _contentItems.push(edit);
        if (journey) _contentItems.push(journey);
        if (recent) {
            const recentRows = [...recent.querySelectorAll('.nav-unified-row')];
            const recentList = recent.querySelector('.nav-unified-list');
            let recentIndex = 0;
            const selectRecent = (index, smooth = true) => {
                const next = Math.max(0, Math.min(recentRows.length - 1, index));
                const changed = next !== recentIndex;
                recentIndex = next;
                recentRows.forEach((row, rowIndex) => {
                    const selected = rowIndex === recentIndex;
                    row.classList.toggle('is-current', selected);
                    row.setAttribute('aria-selected', selected ? 'true' : 'false');
                });
                const row = recentRows[recentIndex];
                if (row && recentList) {
                    const rowRect = row.getBoundingClientRect();
                    const listRect = recentList.getBoundingClientRect();
                    if (rowRect.bottom > listRect.bottom)
                        recentList.scrollBy({ top: rowRect.bottom - listRect.bottom, behavior: smooth ? 'smooth' : 'auto' });
                    else if (rowRect.top < listRect.top)
                        recentList.scrollBy({ top: rowRect.top - listRect.top, behavior: smooth ? 'smooth' : 'auto' });
                }
                return changed;
            };
            recent._profileRecentStep = direction => selectRecent(recentIndex + direction);
            recent._profileRecentAtStart = () => recentIndex <= 0;
        }
        if (heroButton) {
            let requestedHeroIndex = _profileOverviewHeroIndex;
            let highlightRequestToken = 0;
            let cancelActiveTransition = () => {};
            const resolveLoadedArt = sources => new Promise(resolve => {
                const candidates = [...new Set((sources || []).filter(Boolean))];
                const tryCandidate = index => {
                    if (index >= candidates.length) {
                        resolve('');
                        return;
                    }
                    const source = candidates[index];
                    const probe = new Image();
                    let active = true;
                    const timeout = setTimeout(() => {
                        if (!active) return;
                        active = false;
                        tryCandidate(index + 1);
                    }, 4000);
                    probe.onload = async () => {
                        if (!active) return;
                        active = false;
                        clearTimeout(timeout);
                        try { await probe.decode?.(); } catch (_) {}
                        resolve(source);
                    };
                    probe.onerror = () => {
                        if (!active) return;
                        active = false;
                        clearTimeout(timeout);
                        tryCandidate(index + 1);
                    };
                    probe.src = source;
                };
                tryCandidate(0);
            });
            const applyHighlightPresentation = (next, index) => {
                const profile = heroButton.closest('.nav-unified-profile');
                heroButton.classList.toggle('is-empty', !!next.isEmpty);
                heroButton.classList.toggle('is-twitch-channel', !!next.channelHub);
                applyChannelBackdrop(heroButton, next);
                heroButton.querySelector('.nav-unified-kicker').textContent = next.kicker || '';
                heroButton.querySelector('h3').textContent = next.title || '';
                heroButton.querySelector('.nav-unified-hero-meta').textContent = next.meta || '';
                const fallbackLabel = heroButton.querySelector('.nav-unified-art-fallback span');
                if (fallbackLabel) fallbackLabel.textContent = next.appId ? appName(next.appId) : _t('navGames','Jogos');
                profile?.style.setProperty('--profile-accent', accentForHero(next));
                heroButton.querySelectorAll('.nav-unified-hero-pager i').forEach((dot, dotIndex) => {
                    dot.classList.toggle('is-active', dotIndex === index);
                });
            };
            const commitHighlightArt = (loadedSource, durationMs, token, automatic, channelHub = false) => new Promise(resolve => {
                if (!heroButton.isConnected || token !== highlightRequestToken) {
                    resolve(false);
                    return;
                }
                const oldImages = [...heroButton.children].filter(element => element.tagName === 'IMG');
                if (!automatic) {
                    oldImages.forEach(image => image.remove());
                    if (loadedSource) {
                        const image = document.createElement('img');
                        image.src = loadedSource;
                        image.alt = '';
                        if (channelHub) image.classList.add('is-channel-avatar');
                        heroButton.insertBefore(image, heroButton.firstChild);
                    }
                    heroButton.style.setProperty('--hero-fade-duration', '1600ms');
                    resolve(true);
                    return;
                }

                let nextImage = null;
                heroButton.style.setProperty('--hero-fade-duration', `${durationMs}ms`);
                if (loadedSource) {
                    nextImage = document.createElement('img');
                    nextImage.src = loadedSource;
                    nextImage.alt = '';
                    nextImage.className = `is-next-art${channelHub ? ' is-channel-avatar' : ''}`;
                    heroButton.insertBefore(nextImage, heroButton.firstChild);
                }

                let cleaned = false;
                const finish = () => {
                    if (cleaned) return;
                    cleaned = true;
                    oldImages.forEach(image => image.remove());
                    nextImage?.classList.remove('is-next-art', 'is-visible');
                    if (cancelActiveTransition === cancel) cancelActiveTransition = () => {};
                    resolve(token === highlightRequestToken);
                };
                const cancel = () => {
                    if (cleaned) return;
                    cleaned = true;
                    nextImage?.remove();
                    oldImages.forEach(image => {
                        image.style.transition = 'none';
                        image.classList.remove('is-leaving-art');
                        requestAnimationFrame(() => image.style.removeProperty('transition'));
                    });
                    if (cancelActiveTransition === cancel) cancelActiveTransition = () => {};
                    resolve(false);
                };
                cancelActiveTransition = cancel;
                requestAnimationFrame(() => requestAnimationFrame(() => {
                    if (token !== highlightRequestToken) {
                        cancel();
                        return;
                    }
                    oldImages.forEach(image => image.classList.add('is-leaving-art'));
                    nextImage?.classList.add('is-visible');
                    if (durationMs === 0) finish();
                }));
                nextImage?.addEventListener('transitionend', event => {
                    if (event.propertyName === 'opacity') {
                        if (token === highlightRequestToken) finish();
                        else cancel();
                    }
                }, { once:true });
                setTimeout(() => token === highlightRequestToken ? finish() : cancel(), durationMs + 280);
            });
            const applyHighlight = (step, automatic = false) => {
                _clearProfileOverviewCarousel();
                if (!automatic) cancelActiveTransition();
                requestedHeroIndex = (requestedHeroIndex + step + overviewHighlights.length) % overviewHighlights.length;
                _profileOverviewHeroIndex = requestedHeroIndex;
                const next = overviewHighlights[requestedHeroIndex];
                applyHighlightPresentation(next, requestedHeroIndex);
                const chain = next.artChain?.length ? next.artChain : [next.art].filter(Boolean);
                const token = ++highlightRequestToken;
                resolveLoadedArt(chain).then(async loadedSource => {
                    if (token !== highlightRequestToken || !heroButton.isConnected) return;
                    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
                    const completed = await commitHighlightArt(loadedSource, reduceMotion ? 0 : 1600, token, automatic, !!next.channelHub);
                    if (completed && token === highlightRequestToken && heroButton.isConnected)
                        _scheduleProfileOverviewCarousel(overviewHighlights.length);
                });

                if (_profileOverviewCarouselPaused && !automatic) {
                    _profileOverviewStoredKind = next.kind || '';
                    _persistProfileOverviewCarousel(_profileOverviewStoredKind);
                }
            };
            const toggleCarousel = () => {
                _profileOverviewCarouselPaused = !_profileOverviewCarouselPaused;
                const current = overviewHighlights[requestedHeroIndex];
                if (_profileOverviewCarouselPaused) _profileOverviewStoredKind = current?.kind || '';
                _persistProfileOverviewCarousel(_profileOverviewStoredKind);
                heroButton.querySelector('.nav-unified-hero-state')?.classList.toggle('is-paused', _profileOverviewCarouselPaused);
                heroButton.setAttribute('aria-label', _profileOverviewCarouselPaused
                    ? _t('navPlayHighlights','Retomar troca automática')
                    : _t('navPauseHighlights','Pausar troca automática'));
                _scheduleProfileOverviewCarousel(overviewHighlights.length);
            };
            heroButton._profileHeroStep = applyHighlight;
            heroButton.addEventListener('click', toggleCarousel);
            _profileOverviewAdvance = applyHighlight;
        } else {
            _profileOverviewAdvance = null;
        }
        body.querySelectorAll('.nav-unified-tab').forEach(button => button.addEventListener('click', () => {
            const currentTabIndex = tabs.findIndex(([id]) => id === tab);
            const nextTabIndex = tabs.findIndex(([id]) => id === button.dataset.profileTab);
            const direction = nextTabIndex < currentTabIndex ? 'back' : 'forward';
            _profileSubView = button.dataset.profileTab === 'overview' ? null : button.dataset.profileTab;
            _contentIdx = nextTabIndex;
            _renderProfileWithTransition(direction, nextTabIndex);
        }));
        edit?.addEventListener('click', () => {
            _catIdx = CATS.findIndex(cat => cat.id === 'settings');
            _settingsSubView = 'accountHub';
            document.querySelectorAll('.nav-cat-item').forEach((el, i) => el.classList.toggle('active', i === _catIdx));
            _updateTopbarFocusVisual();
            _contentIdx = 0;
            const headerWrap = document.getElementById('navHeaderWrap');
            if (headerWrap) headerWrap.style.display = 'block';
            document.getElementById('navContentTitle').textContent = CATS[_catIdx].label;
            document.getElementById('navContentSub').textContent = _subtitle('settings');
            _renderContent('settings');
            _setTopbarFocus(false);
        });
        journey?.addEventListener('click', () => {
            _profileSubView = 'history';
            _contentIdx = 0;
            _renderContent('profile');
            _setTopbarFocus(false);
        });
        if (tab === 'overview') {
            overviewHighlights.forEach((item, index) => {
                if (index === _profileOverviewHeroIndex) return;
                const source = item.artChain?.[0] || item.art;
                if (source) {
                    const preload = new Image();
                    preload.src = source;
                }
            });
        }
        _scheduleProfileOverviewCarousel(tab === 'overview' ? overviewHighlights.length : 0);
    }

    function _renderLegacyProfile(body) {
        const prof = _menuData.user || {};
        const name = prof.Name || '—';
        const photo = prof.PhotoBase64 || '';
        const games = _menuData.games || [];
        const history = (_menuData.history || [])
            .filter(item => item?.Name && (Number(item.TotalPlaytimeMinutes) || 0) >= 1);

        const totalGames = games.length;

        const totalMinutes = history.reduce((sum, g) => sum + (g.TotalPlaytimeMinutes || 0), 0);

        const mostPlayed = [...history]
            .filter(g => (g.TotalPlaytimeMinutes || 0) > 0)
            .sort((a, b) => b.TotalPlaytimeMinutes - a.TotalPlaytimeMinutes)[0];

        const playedGames = history
            .filter(g => (g.TotalPlaytimeMinutes || 0) > 0)
            .sort((a, b) => (b.TotalPlaytimeMinutes || 0) - (a.TotalPlaytimeMinutes || 0));

        const fmtTime = (minutes) => {
            if (!minutes || minutes < 1) return null;
            const h = Math.floor(minutes / 60);
            const m = minutes % 60;
            if (h === 0) return `${m}min`;
            if (m === 0) return `${h}h`;
            return `${h}h ${m}min`;
        };

        const relDate = (dateStr) => {
            if (!dateStr || dateStr.startsWith('0001')) return '';
            const diffDays = Math.floor((Date.now() - new Date(dateStr)) / 86400000);
            if (diffDays === 0) return _t('today', 'hoje');
            if (diffDays === 1) return _t('yesterday', 'ontem');
            if (diffDays < 7) return `há ${diffDays}d`;
            if (diffDays < 30) return `há ${Math.floor(diffDays / 7)}sem`;
            return new Date(dateStr).toLocaleDateString();
        };

        const totalFmt = fmtTime(totalMinutes) || '--';
        const mostPlayedFmt = mostPlayed ? (fmtTime(mostPlayed.TotalPlaytimeMinutes) || '') : '';
        const validDate = (dateStr) => {
            if (!dateStr || String(dateStr).startsWith('0001')) return false;
            const time = new Date(dateStr).getTime();
            return Number.isFinite(time) && time > 0;
        };
        const artFor = (item, wide = false) => {
            if (!item) return '';
            if (wide) {
                return item.HistoryHorizontalLocalImage || item.GridHorizontalStaticImage || item.GridHorizontalImage ||
                    item.HistoryHorizontalImageUrl || item.ShowcaseVerticalLocalImage || item.GridStaticImage ||
                    item.GridImage || item.ShowcaseVerticalImageUrl || '';
            }
            return item.ShowcaseVerticalLocalImage || item.GridStaticImage || item.GridImage ||
                item.ShowcaseVerticalImageUrl || item.HistoryHorizontalLocalImage ||
                item.GridHorizontalStaticImage || item.GridHorizontalImage || item.HistoryHorizontalImageUrl || '';
        };
        const lastPlayed = [...history]
            .filter(g => validDate(g.LastPlayed))
            .sort((a, b) => new Date(b.LastPlayed) - new Date(a.LastPlayed))[0];
        const lastPlayedArt = artFor(lastPlayed, true);
        const lastPlayedPlatform = _getPlatformData(lastPlayed?.Source || '');
        const mostPlayedArt = mostPlayed
            ? (mostPlayed.ProfileBannerLocalImage || mostPlayed.ProfileBannerImageUrl || artFor(mostPlayed, true))
            : '';
        const mostPlayedPlatform = _getPlatformData(mostPlayed?.Source || '');
        const lastPlayedSessionFmt = lastPlayed ? (fmtTime(lastPlayed.LastSessionMinutes) || '') : '';
        const lastPlayedWhen = lastPlayed && validDate(lastPlayed.LastPlayed) ? relDate(lastPlayed.LastPlayed) : '';
        const libraryStatIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="4" width="17" height="16" rx="2.5"/><path d="M8 4v16M12 8h5M12 12h5M12 16h3"/></svg>`;
        const timeStatIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v5l3.5 2"/></svg>`;
        body.innerHTML = `
        <div class="nav-profile-showcase">
            <div class="nav-profile-cover">
                ${mostPlayedArt ? `<img class="nav-profile-cover-art" src="${mostPlayedArt}" alt="" />` : ''}
                <button class="nav-profile-edit-btn" id="btnEditProfileHub" tabindex="-1">
                    ${_t('navEditProfileBtn', 'Editar Perfil')}
                </button>
                <div class="nav-profile-header">
                <div class="nav-profile-avatar-large">
                    ${photo ? `<img src="${window._doorpiUserPhotoSrc?.(photo) || `data:image/png;base64,${photo}`}" />` : '◉'}
                </div>
                <div class="nav-profile-info">
                    <h2 class="nav-profile-name">${name}</h2>
                </div>
                </div>
                ${mostPlayed ? `
                <div class="nav-profile-cover-game">
                    <span class="nav-profile-cover-game-kicker">${_t('navStatMostPlayed', 'Mais jogado')}</span>
                    <strong class="nav-profile-cover-game-title">${_esc(mostPlayed.Name)}</strong>
                    <span class="nav-profile-cover-game-meta">
                        <span class="nav-profile-cover-game-platform">${mostPlayedPlatform.svg}</span>
                        <span>${mostPlayedFmt || '--'} ${_t('navProfileTotalSuffix', 'no total')}</span>
                    </span>
                </div>` : ''}
            </div>

            <div class="nav-profile-stats-row">
                <div class="nav-profile-stat-box">
                    <span class="nav-profile-stat-icon">${libraryStatIcon}</span>
                    <span class="nav-profile-stat-copy">
                        <span class="stat-label">${_t('navStatGames', 'Jogos na Biblioteca')}</span>
                        <span class="stat-value">${totalGames}</span>
                    </span>
                </div>
                <div class="nav-profile-stat-box ${totalMinutes === 0 ? 'future-placeholder' : ''}">
                    <span class="nav-profile-stat-icon">${timeStatIcon}</span>
                    <span class="nav-profile-stat-copy">
                        <span class="stat-label">${_t('navStatTime', 'Horas Jogadas')}</span>
                        <span class="stat-value">${totalFmt}</span>
                    </span>
                </div>
                <div class="nav-profile-stat-box nav-profile-last-stat ${!lastPlayed ? 'future-placeholder' : ''}">
                    <span class="nav-profile-stat-thumb">
                        ${lastPlayedArt
                ? `<img src="${lastPlayedArt}" alt="${lastPlayed ? _esc(lastPlayed.Name) : ''}" />`
                : `<span class="nav-profile-stat-platform">${lastPlayedPlatform.svg}</span>`}
                    </span>
                    <span class="nav-profile-stat-copy">
                        <span class="stat-label">${_t('navLastPlayed', 'Último jogado')}</span>
                        <span class="nav-profile-last-name">${lastPlayed ? _esc(lastPlayed.Name) : '--'}</span>
                    </span>
                    <span class="nav-profile-last-meta">
                        <strong>${lastPlayedSessionFmt || '--'}</strong>
                        <small>${lastPlayedSessionFmt ? `${_t('navLastSession', 'última sessão')} · ` : ''}${lastPlayedWhen || _t('navNoRecentActivity', 'sem atividade recente')}</small>
                    </span>
                </div>
            </div>

            <div class="nav-profile-section-head">
                <div class="nav-profile-section-title">${_t('navMostPlayedGames', 'Mais jogados')}</div>
                <button class="nav-profile-journey-btn" id="btnGameHistory" tabindex="-1">
                    ${_t('navGameHistoryBtn', 'Ver jornada')}
                </button>
            </div>
            <div class="nav-profile-recent-grid" id="profileRecentGrid"></div>
        </div>
    `;

        _contentItems = [];

        const btnEdit = body.querySelector('#btnEditProfileHub');
        if (btnEdit) {
            _contentItems.push(btnEdit);
            btnEdit.addEventListener('click', () => {
                _catIdx = 2;
                _settingsSubView = 'accountHub';
                document.querySelectorAll('.nav-cat-item').forEach((el, i) => el.classList.toggle('active', i === _catIdx));
                _updateTopbarFocusVisual();
                _contentIdx = 0;
                const headerWrap = document.getElementById('navHeaderWrap');
                if (headerWrap) headerWrap.style.display = 'block';
                document.getElementById('navContentTitle').textContent = CATS[_catIdx].label;
                document.getElementById('navContentSub').textContent = _subtitle(CATS[_catIdx].id);
                _renderContent('settings');
                _setTopbarFocus(false);
            });
        }

        const btnHistory = body.querySelector('#btnGameHistory');
        if (btnHistory) {
            _contentItems.push(btnHistory);
            btnHistory.addEventListener('click', () => {
                _profileSubView = 'history';
                _contentIdx = 0;
                _renderContent('profile');
                _setTopbarFocus(false);
            });
        }

        const grid = body.querySelector('#profileRecentGrid');

        const idealCardWidth = Math.max(
            190,
            Math.min(310, window.innerWidth * .15, window.innerHeight * .27)
        );
        const gridGap = Math.max(14, Math.min(24, window.innerWidth * .0115));
        const gridStyle = getComputedStyle(grid);
        const horizontalInsets = (parseFloat(gridStyle.paddingLeft) || 0) + (parseFloat(gridStyle.paddingRight) || 0);
        const verticalInsets = (parseFloat(gridStyle.paddingTop) || 0) + (parseFloat(gridStyle.paddingBottom) || 0);
        const availableGridWidth = Math.max(0, grid.clientWidth - horizontalInsets);
        const availableGridHeight = Math.max(0, grid.clientHeight - verticalInsets);
        const safeBottom = Math.max(14, Math.min(34, window.innerHeight * .022));
        const maxCardWidthByHeight = Math.max(150, (availableGridHeight - safeBottom) * (2 / 3));
        const widthDrivenSlots = Math.floor((availableGridWidth + gridGap) / (idealCardWidth + gridGap));
        const heightDrivenSlots = Math.ceil((availableGridWidth + gridGap) / (maxCardWidthByHeight + gridGap));
        const visibleSlots = Math.max(
            2,
            widthDrivenSlots,
            heightDrivenSlots
        );
        const showcaseGames = playedGames.slice(0, visibleSlots);
        grid.style.gridTemplateColumns = `repeat(${visibleSlots}, minmax(0, 1fr))`;

        if (showcaseGames.length === 0) {
            grid.innerHTML = `<div style="color:rgba(255,255,255,0.3); grid-column:1/-1;">
            ${_t('navNoPlayedGames', 'Nenhum jogo jogado ainda')}
        </div>`;
        } else {
            showcaseGames.forEach((item, index) => {
                const localSrc = item.ShowcaseVerticalLocalImage || item.GridStaticImage || item.GridImage || '';
                const remoteSrc = item.ShowcaseVerticalImageUrl || '';
                const staticSrc = localSrc || remoteSrc;
                const totalFmtItem = fmtTime(item.TotalPlaytimeMinutes);
                const lastFmt = fmtTime(item.LastSessionMinutes);
                const dateStr = relDate(item.LastPlayed);
                const pData = _getPlatformData(item.LaunchUrl || item.Source);

                const card = document.createElement('div');
                card.className = `nav-profile-recent-card${index === 0 ? ' is-top-played' : ''}`;
                card.dataset.historyGameName = item.Name;

                card.innerHTML = staticSrc
                    ? `<img src="${staticSrc}" alt="${item.Name}" />`
                    : `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:rgba(255,255,255,0.1);font-size:2rem;">⊞</div>`;

                if (index === 0) {
                    card.innerHTML += `
                <div class="nav-profile-top-badge" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none">
                        <path d="M7 4h10v3.3c0 3.7-2 6-5 6s-5-2.3-5-6V4Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
                        <path d="M7 6H4.8c0 3.1 1.4 5 3.7 5.5M17 6h2.2c0 3.1-1.4 5-3.7 5.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M12 13.5V17M8.8 20h6.4M10 17h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                    </svg>
                </div>`;
                }

                card.innerHTML += `
                <div class="nav-card-gradient"></div>
                <div class="nav-profile-recent-info">
                    <div class="nav-profile-recent-platform-icon">${pData.svg}</div>
                    <div class="nav-profile-recent-text">
                        <span class="nav-profile-recent-title">${item.Name}</span>
                        <div style="display:flex;flex-direction:column;gap:2px;margin-top:4px;">
                            ${totalFmtItem
                        ? `<span class="nav-profile-recent-date">${totalFmtItem} no total</span>`
                        : ''}
                            ${lastFmt
                        ? `<span class="nav-profile-recent-date" style="color:rgba(255,255,255,0.45);">última: ${lastFmt}</span>`
                        : ''}
                            ${dateStr
                        ? `<span class="nav-profile-recent-date" style="color:rgba(255,255,255,0.35);">${dateStr}</span>`
                        : ''}
                        </div>
                    </div>
                </div>
            `;

                grid.appendChild(card);
                const artworkImage = card.querySelector(':scope > img');
                if (artworkImage && remoteSrc && remoteSrc !== staticSrc) {
                    artworkImage.addEventListener('error', () => {
                        if (artworkImage.src === remoteSrc) return;
                        artworkImage.src = remoteSrc;
                    }, { once: true });
                }
                _contentItems.push(card);

                card.addEventListener('mouseenter', () => {
                    _topbarFocus = false;
                    _contentIdx = _contentItems.indexOf(card);
                    _updateContentFocus();
                });
                card.addEventListener('contextmenu', event => {
                    event.preventDefault();
                    _openHistoryContextMenu(card);
                });
            });
        }
    }

    function _openHistoryArtworkPicker(item, element) {
        if (!item || !element || typeof window.openDoorpiHistoryArtworkPicker !== 'function') return;
        window.openDoorpiHistoryArtworkPicker(element, item, images => {
            if (images.verticalSourceUrl) {
                item.ShowcaseVerticalImageUrl = images.verticalSourceUrl;
                item.ShowcaseVerticalLocalImage = '';
            } else if (images.vertical) {
                item.ShowcaseVerticalLocalImage = images.vertical;
            }
            if (images.horizontalSourceUrl) {
                item.HistoryHorizontalImageUrl = images.horizontalSourceUrl;
                item.HistoryHorizontalLocalImage = '';
            } else if (images.horizontal) {
                item.HistoryHorizontalLocalImage = images.horizontal;
            }
            if (images.bannerSourceUrl) {
                item.ProfileBannerImageUrl = images.bannerSourceUrl;
                item.ProfileBannerLocalImage = '';
            } else if (images.banner) {
                item.ProfileBannerLocalImage = images.banner;
            }
            const previousIndex = _contentIdx;
            _renderContent('profile');
            _contentIdx = Math.max(0, Math.min(previousIndex, _contentItems.length - 1));
            _updateContentFocus();
        });
    }

    function _openHistoryContextMenu(element) {
        if (!element || typeof window._ctxMenuOpen !== 'function') return;
        const rect = element.getBoundingClientRect();
        window._ctxMenuOpen(element, rect.right + 2, rect.top);
    }

    function _findHistoryItem(element) {
        const name = element?.dataset?.historyGameName || '';
        return (_menuData.history || []).find(entry =>
            String(entry?.Name || '').localeCompare(name, undefined, { sensitivity: 'base' }) === 0);
    }

    function _renderProfileHistory(body) {
        const history = [...(_menuData.history || [])]
            .filter(item => item?.Name && (Number(item.TotalPlaytimeMinutes) || 0) >= 1)
            .sort((a, b) => (b.TotalPlaytimeMinutes || 0) - (a.TotalPlaytimeMinutes || 0));
        const fmtTime = (minutes) => {
            const total = Math.max(0, Number(minutes) || 0);
            const h = Math.floor(total / 60);
            const m = total % 60;
            if (h === 0) return `${m} min`;
            if (m === 0) return `${h} h`;
            return `${h} h ${m} min`;
        };

        body.innerHTML = `
            <div class="nav-profile-history-view">
                <div class="nav-profile-history-head">
                    <button class="nav-back-btn" id="profileHistoryBack" tabindex="-1">‹ ${_t('navBack', 'Voltar')}</button>
                    <div>
                        <h2>${_t('navGameHistoryTitle', 'Minha jornada')}</h2>
                        <p>${_t('navGameHistorySub', 'Todos os jogos registrados neste perfil')}</p>
                    </div>
                </div>
                <div class="nav-profile-history-list" id="profileHistoryList"></div>
            </div>`;

        const back = body.querySelector('#profileHistoryBack');
        const list = body.querySelector('#profileHistoryList');
        _contentItems = [back];

        back?.addEventListener('click', () => {
            _profileSubView = null;
            _contentIdx = 0;
            _renderContent('profile');
            _setTopbarFocus(false);
        });

        if (history.length === 0) {
            list.innerHTML = `<div class="nav-profile-history-empty">${_t('navGameHistoryEmpty', 'Nenhum jogo foi jogado ainda')}</div>`;
        } else {
            history.forEach(item => {
                const localImage = item.HistoryHorizontalLocalImage || item.GridHorizontalStaticImage || item.GridHorizontalImage || item.ShowcaseVerticalLocalImage || item.GridStaticImage || item.GridImage || '';
                const remoteImage = item.HistoryHorizontalImageUrl || item.ShowcaseVerticalImageUrl || '';
                const image = localImage || remoteImage;
                const icon = item.IconBase64 ? `data:image/png;base64,${item.IconBase64}` : '';
                const row = document.createElement('button');
                row.type = 'button';
                row.tabIndex = -1;
                row.className = 'nav-profile-history-row';
                row.dataset.historyGameName = item.Name;
                row.innerHTML = `
                    <span class="nav-profile-history-art">
                        ${image ? `<img src="${_esc(image)}" alt="" />` : icon ? `<img class="is-icon" src="${_esc(icon)}" alt="" />` : ''}
                    </span>
                    <span class="nav-profile-history-name">${_esc(item.Name)}</span>
                    <span class="nav-profile-history-time">${fmtTime(item.TotalPlaytimeMinutes)}</span>`;
                list.appendChild(row);
                const artworkImage = row.querySelector('.nav-profile-history-art img:not(.is-icon)');
                if (artworkImage && remoteImage && remoteImage !== image) {
                    artworkImage.addEventListener('error', () => {
                        if (artworkImage.src === remoteImage) return;
                        artworkImage.src = remoteImage;
                    }, { once: true });
                }
                _contentItems.push(row);
                row.addEventListener('contextmenu', event => {
                    event.preventDefault();
                    _openHistoryContextMenu(row);
                });
            });
        }

        _contentItems.forEach((element, index) => element?.addEventListener('mouseenter', () => {
            _topbarFocus = false;
            _contentIdx = index;
            _updateContentFocus();
        }));
    }

    // ── Novo Hub de Configurações ─────────────────────────────────────────────
    function _renderSettingsLegacy(body) {
        if (_settingsSubView === 'accountHub') { _renderSettingsAccountHub(body); return; }
        if (_settingsSubView === 'account') { _renderSettingsAccount(body); return; }
        if (_settingsSubView === 'extensions') { _renderSettingsExtensions(body); return; }
        if (_settingsSubView === 'sharing') { _renderSettingsSharing(body); return; }
        if (_settingsSubView === 'system') { _renderSettingsSystemV2(body); return; }
        if (_settingsSubView === 'devicesHub' || _settingsSubView === 'connectivityHub') { _renderSettingsDevicesHub(body); return; }
        if (_settingsSubView === 'bluetooth') { _renderSettingsBluetooth(body); return; }
        if (_settingsSubView === 'wifi') { _renderSettingsWifi(body); return; }
        if (_settingsSubView === 'sound') { _renderSettingsSound(body); return; }
        const svgUser = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
        const svgSys = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`;
        const svgControls = window.DoorpiControls?.controllerIcon?.('nav-settings-controller-svg') || `<svg viewBox="0 0 24 18" fill="currentColor" fill-opacity=".34" stroke="currentColor" stroke-width="1.4"><path d="M4 5h16c2.3 0 3.8 2.4 3 4.5l-1.5 4a2 2 0 0 1-3.2.8L16 12H8l-2.3 2.3a2 2 0 0 1-3.2-.8l-1.5-4C.2 7.4 1.7 5 4 5Z"/></svg>`;
        const svgExt = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`;

        body.innerHTML = `
        <div class="nav-settings-grid">
            <button class="nav-settings-card" id="setAccount" tabindex="-1">
                <div class="settings-card-icon">${svgUser}</div>
                <div class="settings-card-info">
                    <h3>${_t('navSetAccount', 'Conta e Perfil')}</h3>
                    <p>${_t('navSetAccountDesc', 'Editar avatar, nome, API Key e usuários')}</p>
                </div>
            </button>
            <button class="nav-settings-card" id="setSystem" tabindex="-1">
                <div class="settings-card-icon">${svgSys}</div>
                <div class="settings-card-info">
                    <h3>${_t('navSetSystem', 'Sistema')}</h3>
                    <p>${_t('navSetSystemDesc', 'Ajustes de inicialização do console e acesso à área de trabalho')}</p>
                </div>
            </button>
            <button class="nav-settings-card" id="setControls" tabindex="-1">
                <div class="settings-card-icon">${svgControls}</div>
                <div class="settings-card-info">
                    <h3>${_t('controlsSettingsTitle', 'Controles')}</h3>
                    <p>${_t('controlsSettingsDesc', 'Perfis reutilizáveis para apps, web apps e lojas')}</p>
                </div>
            </button>
            <button class="nav-settings-card" id="setExt" tabindex="-1">
                <div class="settings-card-icon">${svgExt}</div>
                <div class="settings-card-info">
                    <h3>${_t('navSetExt', 'Extensões')}</h3>
                    <p>${_t('navSetExtDesc', 'Gerenciar plugins e integrações')}</p>
                </div>
            </button>
        </div>
    `;

        _contentItems = [
            body.querySelector('#setAccount'),
            body.querySelector('#setSystem'),
            body.querySelector('#setControls'),
            body.querySelector('#setExt')
        ].filter(Boolean);

        body.querySelector('#setAccount')?.addEventListener('click', () => {
            _settingsSubView = 'accountHub'; _contentIdx = 0; _renderContent('settings'); _updateContentFocus();
        });

        body.querySelector('#setSystem')?.addEventListener('click', () => {
            _settingsSubView = 'system'; _systemSubView = null; _contentIdx = 0; _renderContent('settings'); _updateContentFocus();
        });

        body.querySelector('#setControls')?.addEventListener('click', () => {
            window.DoorpiControls?.open?.();
        });

        body.querySelector('#setExt')?.addEventListener('click', () => {
            window.openExtensionsManager?.();
        });

        _contentItems.forEach((btn, idx) => {
            btn.addEventListener('mouseenter', () => {
                _topbarFocus = false; _contentIdx = idx; _updateContentFocus();
            });
        });
    }

    function _renderSettings(body) {
        body.classList.toggle('settings-home-active', !_settingsSubView);
        if (_settingsSubView) {
            _renderSettingsLegacy(body);
            return;
        }

        const svgUser = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
        const svgControls = window.DoorpiControls?.controllerIcon?.('nav-settings-controller-svg') || `<svg viewBox="0 0 24 18" fill="currentColor" fill-opacity=".34" stroke="currentColor" stroke-width="1.4"><path d="M4 5h16c2.3 0 3.8 2.4 3 4.5l-1.5 4a2 2 0 0 1-3.2.8L16 12H8l-2.3 2.3a2 2 0 0 1-3.2-.8l-1.5-4C.2 7.4 1.7 5 4 5Z"/></svg>`;
        const svgDevices = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5.2" width="9.4" height="13.6" rx="2.1"/><circle cx="7.7" cy="14.1" r="2.15"/><circle cx="7.7" cy="9.1" r=".72" fill="currentColor" stroke="none"/><path d="M16.5 6.2v11.6l3.6-3.6-3.6-2.2 3.6-2.2-3.6-3.6Z"/></svg>`;
        const svgPower = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2v10"/><path d="M18.4 6.6a9 9 0 1 1-12.8 0"/></svg>`;
        const svgVideo = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/></svg>`;
        const svgUpdate = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 1 1-2.34-5.66"/><path d="M20 4v6h-6"/></svg>`;
        const svgExt = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`;

        const entries = [
            {
                id: 'setAccount', group: 'Conta', icon: svgUser,
                title: _t('navSetAccount', 'Conta e perfis'),
                short: 'Usuários, dados pessoais e contas dos apps',
                description: 'Gerencie quem usa o Doorpi, os dados de cada perfil e como as contas dos aplicativos são compartilhadas.',
                scope: ['Perfil e avatar', 'Sincronização', 'Usuários locais', 'Contas dos apps'],
                action: 'account'
            },
            {
                id: 'setControls', group: 'Experiência', icon: svgControls,
                title: _t('controlsSettingsTitle', 'Controles'),
                short: 'Comandos globais e perfis por aplicativo',
                description: 'Personalize comandos, atalhos e comportamento do ponteiro para cada jogo, aplicativo ou serviço web.',
                scope: ['Perfis de controle', 'Atalhos globais', 'Mouse e teclado', 'Comandos primários'],
                action: 'controls'
            },
            {
                id: 'setDevices', group: 'Experiência', icon: svgDevices,
                title: 'Dispositivos e som',
                short: 'Bluetooth, áudio e acessórios conectados',
                description: 'Conecte acessórios e escolha como o Doorpi e o Windows reproduzem áudio na sua configuração.',
                scope: ['Bluetooth', 'Saída de áudio', 'Volume do sistema', 'Sons do Doorpi'],
                action: 'devices'
            },
            {
                id: 'setVideo', group: 'Experiência', icon: svgVideo,
                title: 'Tela e interface',
                short: 'Escala visual para TV ou monitor',
                description: 'Ajuste a escala da interface para preservar legibilidade e espaço útil em diferentes telas e distâncias.',
                scope: ['Escala da interface', 'Área segura', 'Legibilidade', 'Pré-visualização'],
                action: 'video'
            },
            {
                id: 'setStartup', group: 'Sistema', icon: svgPower,
                title: 'Inicialização',
                short: 'Boot, modo console e área de trabalho',
                description: 'Defina como o Doorpi inicia com o Windows e quais caminhos ficam disponíveis ao entrar no sistema.',
                scope: ['Início automático', 'Modo console', 'Game Bar', 'Área de trabalho'],
                action: 'startup'
            },
            {
                id: 'setUpdates', group: 'Sistema', icon: svgUpdate,
                title: 'Atualizações',
                short: 'Doorpi, Windows e drivers gráficos',
                description: 'Consulte versões e mantenha o Doorpi, o Windows e os componentes gráficos atualizados em um só lugar.',
                scope: ['Doorpi e Updater', 'Windows Update', 'Drivers de vídeo', 'Notas da versão'],
                action: 'updates'
            },
            {
                id: 'setExt', group: 'Sistema', icon: svgExt,
                title: _t('navSetExt', 'Extensões'),
                short: 'Recursos adicionais e integrações',
                description: 'Adicione integrações ao navegador e gerencie recursos opcionais instalados no Doorpi.',
                scope: ['Extensões instaladas', 'Loja de extensões', 'Instalação por link', 'Gerenciamento'],
                action: 'extensions'
            }
        ];

        const groupMarkup = ['Conta', 'Experiência', 'Sistema'].map(group => `
            <section class="nav-settings-home-group" aria-label="${group}">
                <span class="nav-settings-home-group-title">${group}</span>
                <div class="nav-settings-home-list">
                    ${entries.filter(entry => entry.group === group).map(entry => `
                        <button class="nav-settings-home-item" id="${entry.id}" data-settings-action="${entry.action}" tabindex="-1">
                            <span class="nav-settings-home-icon">${entry.icon}</span>
                            <span class="nav-settings-home-copy">
                                <strong>${entry.title}</strong>
                                <small>${entry.short}</small>
                            </span>
                            <span class="nav-settings-home-chevron" aria-hidden="true">›</span>
                        </button>`).join('')}
                </div>
            </section>`).join('');

        body.innerHTML = `
            <div class="nav-settings-home">
                <nav class="nav-settings-home-nav" aria-label="Categorias de configurações">${groupMarkup}</nav>
                <aside class="nav-settings-home-preview" id="navSettingsHomePreview" aria-live="polite"></aside>
            </div>`;

        const preview = body.querySelector('#navSettingsHomePreview');
        const renderPreview = entry => {
            if (!preview || !entry) return;
            preview.innerHTML = `
                <div class="nav-settings-home-preview-main">
                    <div class="nav-settings-home-preview-icon">${entry.icon}</div>
                    <span class="nav-settings-home-kicker">${entry.group}</span>
                    <h3>${entry.title}</h3>
                    <p>${entry.description}</p>
                    <div class="nav-settings-home-scope">
                        ${entry.scope.map(item => `<span>${item}</span>`).join('')}
                    </div>
                </div>
                <div class="nav-settings-home-action"><kbd>A</kbd><span>Abrir configuração</span></div>`;
        };

        _contentItems = entries.map(entry => body.querySelector(`#${entry.id}`)).filter(Boolean);
        renderPreview(entries[Math.max(0, Math.min(entries.length - 1, _contentIdx))]);

        const openSystemDetail = detail => {
            _settingsReturnToRoot = true;
            _settingsSubView = 'system';
            _systemSubView = detail;
            if (detail === 'updates') _systemUpdatesSubView = 'doorpi';
            _contentIdx = 0;
            _renderContent('settings');
            _updateContentFocus();
        };

        _contentItems.forEach((button, index) => {
            const entry = entries[index];
            button.addEventListener('focus', () => renderPreview(entry));
            button.addEventListener('mouseenter', () => {
                _topbarFocus = false;
                _contentIdx = index;
                renderPreview(entry);
                _updateContentFocus();
            });
            button.addEventListener('click', () => {
                switch (entry.action) {
                    case 'account':
                        _settingsReturnToRoot = false;
                        _settingsSubView = 'accountHub';
                        _contentIdx = 0;
                        _renderContent('settings');
                        _updateContentFocus();
                        break;
                    case 'controls':
                        window.DoorpiControls?.open?.();
                        break;
                    case 'devices':
                        _settingsReturnToRoot = true;
                        _settingsSubView = 'devicesHub';
                        _systemSubView = null;
                        _contentIdx = 0;
                        _renderContent('settings');
                        _updateContentFocus();
                        break;
                    case 'video': openSystemDetail('video'); break;
                    case 'startup': openSystemDetail('startup'); break;
                    case 'updates': openSystemDetail('updates'); break;
                    case 'extensions': window.openExtensionsManager?.(); break;
                }
            });
        });
    }

    function _updateAutoStartUI() {
        const toggle = document.getElementById('autoStartToggle');
        const desc = document.getElementById('autoStartDesc');
        if (toggle) toggle.classList.toggle('on', _autoStartEnabled);
        if (desc) desc.textContent = _autoStartEnabled
            ? _t('autoStartOn', 'Ativo — o app inicia automaticamente com o Windows')
            : _t('autoStartOff', 'Desativado — não inicia automaticamente');
    }

    function _updateSystemUpdateUI() {
        const status = _systemUpdateStatus || {};
        const badge = document.getElementById('systemUpdateBadge');
        const title = document.getElementById('systemUpdateTitle');
        const sub = document.getElementById('systemUpdateSub');
        const versions = document.getElementById('systemUpdateVersions');
        const changelog = document.getElementById('systemUpdateChangelog');
        const startBtn = document.getElementById('navCardStartUpdate');

        const hasUpdate = !!(status.doorpiUpdateAvailable || status.updaterUpdateAvailable);
        const isChecking = status.status === 'checking';
        const isError = status.status === 'error';
        const isNotConfigured = status.status === 'not-configured';
        const tabState = document.getElementById('updatesTabDoorpiState');

        if (tabState) {
            tabState.textContent = status.forceUpdate
                ? 'Atualização obrigatória'
                : isChecking
                    ? 'Verificando agora'
                    : hasUpdate
                        ? 'Atualização disponível'
                        : isError
                            ? 'Falha na verificação'
                            : isNotConfigured
                                ? 'Configuração necessária'
                                : 'Sistema atualizado';
        }

        if (badge) {
            badge.textContent = status.forceUpdate
                ? 'OBRIGATORIA'
                : isChecking
                    ? 'VERIFICANDO'
                    : hasUpdate
                        ? 'DISPONÍVEL'
                        : isError
                            ? 'ERRO'
                            : isNotConfigured
                                ? 'CONFIGURAR'
                                : 'ATUALIZADO';
            badge.dataset.state = status.status || 'idle';
        }

        if (title) {
            title.textContent = hasUpdate
                ? _t('sysUpdateAvailableTitle', 'Atualização disponível')
                : _t('sysUpdateTitle', 'Atualizações do sistema');
        }

        if (sub) {
            sub.textContent = status.message || _t('sysUpdateIdle', 'Atualizações ainda não verificadas.');
        }

        if (versions) {
            const remoteDoorpi = status.remoteDoorpiVersion ? ` -> ${status.remoteDoorpiVersion}` : '';
            const remoteUpdater = status.remoteUpdaterVersion ? ` -> ${status.remoteUpdaterVersion}` : '';
            versions.innerHTML = `
                <span>Doorpi ${status.localDoorpiVersion || '--'}${remoteDoorpi}</span>
                <span>Updater ${status.localUpdaterVersion || '--'}${remoteUpdater}</span>
            `;
        }

        if (changelog) {
            const entries = Array.isArray(status.changelog) ? status.changelog : [];
            const renderedEntries = entries
                .filter(entry => entry && (entry.title || entry.version || (entry.items || []).length))
                .map(entry => {
                    const items = Array.isArray(entry.items) ? entry.items : [];
                    const version = entry.version ? `<span class="nav-release-entry-version">${_esc(entry.version)}</span>` : '';
                    return `
                        <article class="nav-release-entry">
                            <div class="nav-release-entry-title">${_esc(entry.title || 'Doorpi')}${version}</div>
                            ${items.length ? `<ul>${items.map(item => `<li>${_esc(item)}</li>`).join('')}</ul>` : ''}
                        </article>`;
                })
                .join('');

            changelog.innerHTML = `
                <div class="nav-release-notes-head">${_t('sysUpdateReleaseNotes', 'Notas da versão')}</div>
                ${renderedEntries || `<div class="nav-release-entry">${_t('sysUpdateNoChangelog', '')}</div>`}`;
        }

        if (startBtn) {
            startBtn.classList.toggle('visible', hasUpdate);
            startBtn.style.display = hasUpdate ? '' : 'none';
        }

        if (window._updateBootModeUI && document.getElementById('systemUpdatePanel')) {
            window._updateBootModeUI();
        }
    }

    function _renderSettingsDevicesHub(body) {
        const svgBluetooth = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2v20l6-6-6-4 6-4-6-6Z"/><path d="M6.5 6.5 12 12l-5.5 5.5"/></svg>`;
        const svgSound = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9H4Z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/><path d="M19 6a8.5 8.5 0 0 1 0 12"/></svg>`;
        const entries = [
            { id:'setBluetooth', icon:svgBluetooth, title:'Bluetooth', description:_t('bluetoothSettingsDesc', 'Parear e gerenciar controles, áudio, teclados e outros dispositivos') },
            { id:'setSound', icon:svgSound, title:_t('soundTitle', 'Som'), description:_t('soundSettingsDesc', 'Saída de áudio, volume do Windows e sons do Doorpi') }
        ];
        body.innerHTML = _settingsDirectoryMarkup('setBackConnectivity', _t('navSetDevices', 'Dispositivos'), entries);
        _wireSettingsDirectory(body, entries);

        _contentItems = [body.querySelector('#setBackConnectivity'), body.querySelector('#setBluetooth'), body.querySelector('#setSound')].filter(Boolean);
        _contentItems.forEach((el, idx) => el.addEventListener('mouseenter', () => {
            _topbarFocus = false; _contentIdx = idx; _updateContentFocus();
        }));
        body.querySelector('#setBackConnectivity')?.addEventListener('click', () => {
            if (_settingsReturnToRoot) {
                _settingsReturnToRoot = false;
                _settingsSubView = null;
                _systemSubView = null;
            } else {
                _settingsSubView = 'system';
                _systemSubView = null;
            }
            _contentIdx = 0;
            _renderContent('settings');
            _updateContentFocus();
        });
        body.querySelector('#setBluetooth')?.addEventListener('click', () => {
            _settingsSubView = 'bluetooth'; _contentIdx = 0; _renderContent('settings'); _updateContentFocus();
        });
        body.querySelector('#setSound')?.addEventListener('click', () => {
            _settingsSubView = 'sound'; _contentIdx = 0; _renderContent('settings'); _updateContentFocus();
        });
    }

    function _bluetoothFocusSelector() {
        const active = document.activeElement;
        if (active?.dataset?.btMenuId) return `[data-bt-menu-id="${CSS.escape(active.dataset.btMenuId)}"]`;
        if (active?.dataset?.deviceId) return `[data-device-id="${CSS.escape(active.dataset.deviceId)}"]`;
        if (active?.dataset?.btAction) return `[data-bt-action="${active.dataset.btAction}"]`;
        return '';
    }

    function _wireSettingsBluetooth(body, focusSelector = '') {
        const host = body.querySelector('#navBluetoothHost');
        window.DoorpiBluetoothUI?.bind?.(host, 'settings', nextFocus => {
            _refreshSettingsBluetooth(body, nextFocus);
        });
        _contentItems = [body.querySelector('#setBackBluetooth'), ...Array.from(host?.querySelectorAll('.bluetooth-focus') || [])].filter(Boolean);
        _contentItems.forEach((el, idx) => el.addEventListener('mouseenter', () => {
            _topbarFocus = false; _contentIdx = idx; _updateContentFocus();
        }));
        const target = focusSelector ? body.querySelector(focusSelector) : null;
        _contentIdx = target ? _contentItems.indexOf(target) : Math.max(0, Math.min(_contentIdx, _contentItems.length - 1));
        _updateContentFocus();
    }

    function _refreshSettingsBluetooth(body, focusSelector = '') {
        const host = body.querySelector('#navBluetoothHost');
        if (!host) return;
        host.innerHTML = window.DoorpiBluetoothUI?.render?.('settings') || '';
        _wireSettingsBluetooth(body, focusSelector);
    }

    function _scheduleSettingsBluetoothRefresh(focusSelector = '', immediate = false) {
        if (_bluetoothRenderTimer) {
            clearTimeout(_bluetoothRenderTimer);
            _bluetoothRenderTimer = 0;
        }
        const body = document.querySelector('.nav-content-body');
        if (!body) return;
        if (immediate) {
            _refreshSettingsBluetooth(body, focusSelector);
            return;
        }
        _bluetoothRenderTimer = setTimeout(() => {
            _bluetoothRenderTimer = 0;
            const currentBody = document.querySelector('.nav-content-body');
            if (currentBody && window.isNavMenuOpen && _settingsSubView === 'bluetooth')
                _refreshSettingsBluetooth(currentBody, focusSelector);
        }, 120);
    }

    function _renderSettingsBluetooth(body) {
        body.innerHTML = `
            <div class="nav-settings-subheader">
                <button class="nav-back-btn" id="setBackBluetooth" tabindex="-1">‹ ${_t('navBack', 'Voltar')}</button>
                <h2>Bluetooth</h2>
            </div>
            <div id="navBluetoothHost" style="max-width:920px;"></div>`;

        _refreshSettingsBluetooth(body);
        postToHost?.({ action: 'requestBluetoothStatus' });
        body.querySelector('#setBackBluetooth')?.addEventListener('click', () => {
            if (window.DoorpiBluetoothUI?.back?.('settings')) {
                _refreshSettingsBluetooth(body, '.bt-device-card');
                return;
            }
            if (_bluetoothUpdateStatus?.discovering) postToHost?.({ action: 'stopBluetoothDiscovery' });
            _settingsSubView = 'devicesHub'; _contentIdx = 0; _renderContent('settings'); _updateContentFocus();
        });
    }

    window._navMenuSetBluetoothStatus = function (status) {
        _bluetoothUpdateStatus = { ...(_bluetoothUpdateStatus || {}), ...(status || {}) };
        if (!window.isNavMenuOpen || _settingsSubView !== 'bluetooth') return;
        const op = _bluetoothUpdateStatus.operation || '';
        _scheduleSettingsBluetoothRefresh(
            _bluetoothFocusSelector(),
            op === 'pairing' || op === 'removing' || !!_bluetoothUpdateStatus.pairingPrompt);
    };

    function _wifiFocusSelector() {
        const active = document.activeElement;
        if (active?.dataset?.wifiNetworkId) return `[data-wifi-network-id="${CSS.escape(active.dataset.wifiNetworkId)}"]`;
        if (active?.dataset?.wifiAction) return `[data-wifi-action="${active.dataset.wifiAction}"]`;
        return '';
    }

    function _wireSettingsWifi(body, focusSelector = '') {
        const host = body.querySelector('#navWifiHost');
        window.DoorpiWifiUI?.bind?.(host, 'settings', nextFocus => _refreshSettingsWifi(body, nextFocus));
        _contentItems = [body.querySelector('#setBackWifi'), ...Array.from(host?.querySelectorAll('.wifi-focus') || [])].filter(Boolean);
        _contentItems.forEach((el, idx) => el.addEventListener('mouseenter', () => {
            _topbarFocus = false; _contentIdx = idx; _updateContentFocus();
        }));
        const target = focusSelector ? body.querySelector(focusSelector) : null;
        _contentIdx = target ? _contentItems.indexOf(target) : Math.max(0, Math.min(_contentIdx, _contentItems.length - 1));
        _updateContentFocus();
    }

    function _refreshSettingsWifi(body, focusSelector = '') {
        const host = body.querySelector('#navWifiHost');
        if (!host) return;
        host.innerHTML = window.DoorpiWifiUI?.render?.('settings') || '';
        _wireSettingsWifi(body, focusSelector);
    }

    function _renderSettingsWifi(body) {
        body.innerHTML = `
            <div class="nav-settings-subheader">
                <button class="nav-back-btn" id="setBackWifi" tabindex="-1">‹ ${_t('navBack', 'Voltar')}</button>
                <h2>Wi-Fi</h2>
            </div>
            <div id="navWifiHost" style="max-width:920px;"></div>`;
        _refreshSettingsWifi(body);
        postToHost?.({ action: 'requestWifiStatus' });
        body.querySelector('#setBackWifi')?.addEventListener('click', () => {
            if (window.DoorpiWifiUI?.back?.('settings')) {
                _refreshSettingsWifi(body, '.wifi-network-card');
                return;
            }
            _settingsSubView = 'devicesHub'; _contentIdx = 0; _renderContent('settings'); _updateContentFocus();
        });
    }

    window._navMenuSetWifiStatus = function (status) {
        _wifiUpdateStatus = { ...(_wifiUpdateStatus || {}), ...(status || {}) };
        if (!window.isNavMenuOpen || _settingsSubView !== 'wifi') return;
        const body = document.querySelector('.nav-content-body');
        if (body) _refreshSettingsWifi(body, _wifiFocusSelector());
    };

    function _soundFocusSelector() {
        const active = document.activeElement;
        if (active?.dataset?.soundAction) return `[data-sound-action="${CSS.escape(active.dataset.soundAction)}"]`;
        if (active?.dataset?.soundVolumeControl) return `[data-sound-volume-control="${CSS.escape(active.dataset.soundVolumeControl)}"]`;
        if (active?.dataset?.soundDeviceOption) return `[data-sound-device-option="${CSS.escape(active.dataset.soundDeviceOption)}"]`;
        if (active?.dataset?.soundItem) return `[data-sound-item="${CSS.escape(active.dataset.soundItem)}"]`;
        if (active?.dataset?.soundSlider) return `[data-sound-slider="${CSS.escape(active.dataset.soundSlider)}"]`;
        return '';
    }

    function _wireSettingsSound(body, focusSelector = '') {
        const host = body.querySelector('#navSoundHost');
        window.DoorpiSoundUI?.bind?.(host, 'settings', nextFocus => _refreshSettingsSound(body, nextFocus));
        _contentItems = [body.querySelector('#setBackSound'), ...Array.from(host?.querySelectorAll('.sound-focus') || [])].filter(Boolean);
        _contentItems.forEach((el, idx) => el.addEventListener('mouseenter', () => {
            _topbarFocus = false; _contentIdx = idx; _updateContentFocus();
        }));
        const target = focusSelector ? body.querySelector(focusSelector) : null;
        _contentIdx = target ? _contentItems.indexOf(target) : Math.max(0, Math.min(_contentIdx, _contentItems.length - 1));
        _updateContentFocus();
    }

    function _refreshSettingsSound(body, focusSelector = '') {
        const host = body.querySelector('#navSoundHost');
        if (!host) return;
        host.innerHTML = window.DoorpiSoundUI?.render?.('settings') || '';
        _wireSettingsSound(body, focusSelector);
    }

    function _renderSettingsSound(body) {
        body.innerHTML = `
            <div class="nav-settings-subheader">
                <button class="nav-back-btn" id="setBackSound" tabindex="-1">‹ ${_t('navBack', 'Voltar')}</button>
                <h2>${_t('soundTitle', 'Som')}</h2>
            </div>
            <div id="navSoundHost" style="width:100%;"></div>`;
        _refreshSettingsSound(body);
        postToHost?.({ action: 'requestSoundStatus' });
        body.querySelector('#setBackSound')?.addEventListener('click', () => {
            window.DoorpiSoundUI?.closeDrawer?.('settings');
            _settingsSubView = 'devicesHub'; _contentIdx = 0; _renderContent('settings'); _updateContentFocus();
        });
    }

    window._navMenuSetSoundStatus = function (status) {
        if (!window.isNavMenuOpen || _settingsSubView !== 'sound') return;
        const body = document.querySelector('.nav-content-body');
        if (body) _refreshSettingsSound(body, _soundFocusSelector());
    };

    function _formatWindowsUpdateSize(bytes) {
        const value = Number(bytes || 0);
        if (!Number.isFinite(value) || value <= 0) return '';
        if (value >= 1024 * 1024 * 1024) return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`;
        if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(0)} MB`;
        return `${Math.max(1, Math.round(value / 1024))} KB`;
    }

    function _formatWindowsUpdateDate(value) {
        if (!value) return _t('never', 'Nunca');
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return _t('never', 'Nunca');
        return date.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit' })
            + ' '
            + date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    }

    function _windowsUpdateActionLabel(status) {
        if (status === 'installing') return _t('windowsUpdateInstalling', 'Instalando');
        if (status === 'downloading') return _t('windowsUpdateDownloading', 'Baixando');
        if (status === 'checking') return _t('windowsUpdateChecking', 'Verificando');
        return _t('checkWindows', 'Verificar Windows');
    }

    function _windowsUpdatePackageState(item) {
        if (item?.rebootRequired || item?.status === 'reboot-required') {
            return { text: _t('windowsUpdateRebootPending', 'Reinicialização pendente'), color: '#ffd872' };
        }
        const keys = {
            pending: ['windowsUpdatePending', 'Pendente'],
            downloading: ['windowsUpdateDownloading', 'Baixando'],
            downloaded: ['windowsUpdateDownloaded', 'Baixado'],
            installing: ['windowsUpdateInstalling', 'Instalando'],
            installed: ['windowsUpdateInstalled', 'Instalado'],
            error: ['windowsUpdatePackageError', 'Falha']
        };
        const [key, fallback] = keys[item?.status] || keys.pending;
        return { text: _t(key, fallback), color: 'rgba(255,255,255,.48)' };
    }

    function _renderWindowsUpdatePackages(status, updates) {
        const progress = Array.isArray(status.packageProgress) ? status.packageProgress : [];
        if (!progress.length) {
            if (!updates.length)
                return `<div style="padding-top:4px;color:rgba(255,255,255,.42);">${_t('windowsUpdateNoneListed', 'Nenhuma atualização listada.')}</div>`;
            return updates.map(update => {
                const size = _formatWindowsUpdateSize(update.sizeBytes);
                const downloaded = update.isDownloaded
                    ? _t('windowsUpdateDownloaded', 'Baixado')
                    : _t('windowsUpdatePending', 'Pendente');
                return `
                    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:7px 0;border-top:1px solid rgba(255,255,255,.06);">
                        <span style="min-width:0;color:rgba(255,255,255,.72);">${_esc(update.title || 'Atualização do Windows')}</span>
                        <span style="flex:0 0 auto;color:rgba(255,255,255,.42);">${_esc([downloaded, size].filter(Boolean).join(' - '))}</span>
                    </div>`;
            }).join('');
        }

        const updatesById = new Map(updates.map(update => [String(update.updateId || '').toLowerCase(), update]));
        return progress.map(item => {
            const update = updatesById.get(String(item.updateId || '').toLowerCase());
            const state = _windowsUpdatePackageState(item);
            const percent = Math.max(0, Math.min(100, Number(item.percent) || 0));
            const detail = [state.text, `${Math.round(percent)}%`, _formatWindowsUpdateSize(update?.sizeBytes)]
                .filter(Boolean)
                .join(' - ');
            return `
                <div style="display:grid;gap:7px;padding:10px 0;border-top:1px solid rgba(255,255,255,.06);">
                    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:14px;">
                        <span style="min-width:0;color:rgba(255,255,255,.72);line-height:1.35;">${_esc(item.title || update?.title || 'Atualização do Windows')}</span>
                        <span style="flex:0 0 auto;color:${state.color};font-size:.8rem;">${_esc(detail)}</span>
                    </div>
                    <div style="height:4px;overflow:hidden;border-radius:2px;background:rgba(255,255,255,.10);">
                        <div style="height:100%;width:${percent}%;background:rgba(255,255,255,.72);transition:width .18s linear;"></div>
                    </div>
                </div>`;
        }).join('');
    }

    function _updateWindowsUpdateUI() {
        const status = _windowsUpdateStatus || {};
        const updates = Array.isArray(status.updates) ? status.updates : [];
        const badge = document.getElementById('windowsUpdateBadge');
        const title = document.getElementById('windowsUpdateTitle');
        const sub = document.getElementById('windowsUpdateSub');
        const meta = document.getElementById('windowsUpdateMeta');
        const list = document.getElementById('windowsUpdateList');
        const checkBtn = document.getElementById('navCardCheckWindowsUpdates');
        const startBtn = document.getElementById('navCardStartWindowsUpdate');
        const restartBtn = document.getElementById('navCardRestartWindows');

        const active = ['checking', 'downloading', 'installing'].includes(status.status);
        const hasUpdates = updates.length > 0;
        const tabState = document.getElementById('updatesTabWindowsState');

        if (tabState) {
            tabState.textContent = status.rebootRequired
                ? 'Reinício pendente'
                : active
                    ? 'Atualização em andamento'
                    : hasUpdates
                        ? `${updates.length} atualização(ões)`
                        : status.status === 'error'
                            ? 'Falha na verificação'
                            : 'Windows atualizado';
        }

        if (badge) {
            badge.textContent = status.rebootRequired
                ? _t('restartNow', 'Reiniciar agora').toUpperCase()
                : active
                    ? _t('windowsUpdateProcessing', 'PROCESSANDO')
                    : hasUpdates
                        ? _t('windowsUpdateAvailable', 'DISPONÍVEL')
                        : status.status === 'error'
                            ? 'ERRO'
                            : status.status === 'access-denied'
                                ? 'WINDOWS'
                                : _t('windowsUpdateUpdated', 'ATUALIZADO');
            badge.dataset.state = status.status || 'idle';
        }

        if (title) {
            title.textContent = status.rebootRequired
                ? _t('windowsUpdateRestartTitle', 'Windows Update - reinício pendente')
                : hasUpdates
                    ? _t('windowsUpdateFoundTitle', 'Windows Update - atualizações encontradas')
                    : 'Windows Update';
        }

        if (sub) {
            sub.textContent = status.message || _t('windowsUpdateIdle', 'Atualizações do Windows ainda não verificadas.');
        }

        if (meta) {
            const visiblePackageCount = Array.isArray(status.packageProgress) && status.packageProgress.length
                ? status.packageProgress.length
                : updates.length;
            meta.innerHTML = `
                <span>${_t('windowsUpdatePackages', `${visiblePackageCount} pacote(s)`, visiblePackageCount)}</span>
                ${active ? `<span>${_t('windowsUpdateOverall', `${Math.max(0, Math.min(100, Number(status.overallPercent) || 0))}% geral`, Math.max(0, Math.min(100, Number(status.overallPercent) || 0)))}</span>` : ''}
                <span>${_t('windowsUpdateLastCheck', `Última verificação: ${_formatWindowsUpdateDate(status.lastCheckedAt)}`, _esc(_formatWindowsUpdateDate(status.lastCheckedAt)))}</span>
            `;
        }

        if (list) {
            list.innerHTML = _renderWindowsUpdatePackages(status, updates);
        }

        if (checkBtn) {
            const label = checkBtn.querySelector('.nav-suggestion-card-btn');
            if (label) label.textContent = _windowsUpdateActionLabel(status.status);
            checkBtn.dataset.busy = active ? 'true' : 'false';
            checkBtn.setAttribute('aria-disabled', active ? 'true' : 'false');
        }

        if (startBtn) {
            const visible = hasUpdates && !active && !status.rebootRequired;
            startBtn.classList.toggle('visible', visible);
            startBtn.style.display = visible ? '' : 'none';
        }

        if (restartBtn) {
            const visible = !!status.rebootRequired;
            restartBtn.classList.toggle('visible', visible);
            restartBtn.style.display = visible ? '' : 'none';
        }

        if (window._updateBootModeUI && document.getElementById('windowsUpdatePanel')) {
            window._updateBootModeUI();
        }
    }

    function _gpuVendorName(vendor) {
        const v = String(vendor || '').toLowerCase();
        if (v === 'nvidia') return 'NVIDIA';
        if (v === 'amd') return 'AMD';
        if (v === 'intel') return 'Intel';
        return vendor || 'GPU';
    }

    function _gpuUpdaterInitials(app) {
        const base = _gpuVendorName(_readGpuProp(app, 'vendor')) || _readGpuProp(app, 'name') || 'APP';
        return String(base).replace(/[^a-z0-9]/gi, '').slice(0, 3).toUpperCase() || 'APP';
    }

    function _readGpuProp(obj, key) {
        if (!obj) return '';
        const pascal = key.charAt(0).toUpperCase() + key.slice(1);
        return obj[key] ?? obj[pascal] ?? '';
    }

    function _updateGpuUpdateUI() {
        const status = _gpuUpdateStatus || {};
        const adapters = Array.isArray(status.adapters) ? status.adapters : [];
        const updaters = Array.isArray(status.updaters) ? status.updaters : [];
        const badge = document.getElementById('gpuUpdateBadge');
        const title = document.getElementById('gpuUpdateTitle');
        const sub = document.getElementById('gpuUpdateSub');
        const meta = document.getElementById('gpuUpdateMeta');
        const list = document.getElementById('gpuAdapterList');
        const actions = document.getElementById('gpuUpdateActionsGrid');
        const tabState = document.getElementById('updatesTabGpuState');

        if (tabState) {
            tabState.textContent = status.status === 'error'
                ? 'Falha na detecção'
                : !adapters.length
                    ? 'Nenhuma GPU detectada'
                    : !updaters.length
                        ? 'Atualizador não configurado'
                        : `${updaters.length} atualizador(es)`;
        }

        if (badge) {
            badge.textContent = status.status === 'error'
                ? 'ERRO'
                : !adapters.length
                    ? 'SEM GPU'
                    : !updaters.length
                        ? 'SEM APP'
                        : 'DETECTADO';
            badge.dataset.state = status.status || 'idle';
        }

        if (title) title.textContent = 'Placa de vídeo';
        if (sub) sub.textContent = status.message || 'Dados de placa de vídeo ainda não carregados.';

        if (meta) {
            meta.innerHTML = `
                <span>${adapters.length} adaptador(es)</span>
                <span>${updaters.length} app(s) configurado(s)</span>
                <span>Última leitura: ${_esc(_formatWindowsUpdateDate(status.lastCheckedAt))}</span>
            `;
        }

        if (list) {
            list.innerHTML = adapters.length
                ? adapters.map(adapter => `
                    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:7px 0;border-top:1px solid rgba(255,255,255,.06);">
                        <span style="min-width:0;color:rgba(255,255,255,.72);">${_esc(_readGpuProp(adapter, 'name') || _gpuVendorName(_readGpuProp(adapter, 'vendor')))}</span>
                        <span style="flex:0 0 auto;color:rgba(255,255,255,.42);">${_esc([_gpuVendorName(_readGpuProp(adapter, 'vendor')), _readGpuProp(adapter, 'driverVersion') || '--'].filter(Boolean).join(' - '))}</span>
                    </div>
                `).join('')
                : `<div style="padding-top:4px;color:rgba(255,255,255,.42);">Nenhum driver de vídeo detectado.</div>`;
        }

        if (actions) {
            actions.innerHTML = `
                <div class="nav-gpu-app-grid">
                    ${updaters.map(app => {
                        const id = _readGpuProp(app, 'id');
                        const name = _readGpuProp(app, 'name') || 'Atualizador';
                        const vendor = _readGpuProp(app, 'vendor');
                        const source = _readGpuProp(app, 'source');
                        const imageUrl = _readGpuProp(app, 'imageUrl');
                        const iconDataUrl = _readGpuProp(app, 'iconDataUrl');
                        return `
                        <div class="nav-gpu-app-card" data-gpu-action="open" data-updater-id="${_esc(id)}" data-gpu-updater-card="true" tabindex="-1" role="button">
                            <div class="nav-gpu-app-art">
                                ${imageUrl ? `<div class="nav-gpu-app-cover" style="background-image:url('${_esc(imageUrl)}')"></div>` : (iconDataUrl ? `<img src="${_esc(iconDataUrl)}" alt="">` : `<div class="nav-gpu-app-fallback">${_esc(_gpuUpdaterInitials(app))}</div>`)}
                            </div>
                            <div class="nav-gpu-app-copy">
                                <div class="nav-gpu-app-name">${_esc(name)}</div>
                                <div class="nav-gpu-app-meta">${_esc(_gpuVendorName(vendor))} · ${_esc(source === 'manual' ? 'Adicionado manualmente' : 'Detectado automaticamente')}</div>
                            </div>
                        </div>
                    `}).join('')}
                    <div class="nav-gpu-app-card nav-gpu-app-add" data-gpu-action="add" tabindex="-1" role="button">
                        <div class="nav-gpu-app-art"><div class="nav-gpu-app-fallback">+</div></div>
                        <div class="nav-gpu-app-copy">
                            <div class="nav-gpu-app-name">Adicionar app</div>
                            <div class="nav-gpu-app-meta">Escolha outro atualizador instalado no Windows.</div>
                        </div>
                    </div>
                </div>
            `;
        }

        if (window._updateBootModeUI && document.getElementById('gpuUpdatePanel')) {
            window._updateBootModeUI();
        }
    }

    window._navMenuSetGpuUpdateStatus = function (status) {
        _gpuUpdateStatus = { ..._gpuUpdateStatus, ...(status || {}) };
        _updateGpuUpdateUI();
    };

    function _renderSettingsAccountHub(body) {
        const svgProfile = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
        const svgShare = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 10.6l6.8-4.2M8.6 13.4l6.8 4.2"/></svg>`;

        const entries = [
            { id:'setProfileData', icon:svgProfile, title:_t('navAccountProfileData', 'Dados do perfil'), description:_t('navAccountProfileDataDesc', 'Avatar, nome, segurança e sincronização da sua conta') },
            { id:'setAccountSharing', icon:svgShare, title:_t('navSetSharing', 'Contas dos apps'), description:_t('navSetSharingDesc', 'Defina com clareza quem pode usar cada conta conectada') }
        ];
        body.innerHTML = _settingsDirectoryMarkup('setBackAccountHub', _t('navSetAccount', 'Conta e Perfil'), entries);
        _wireSettingsDirectory(body, entries);

        _contentItems = [
            body.querySelector('#setBackAccountHub'),
            body.querySelector('#setProfileData'),
            body.querySelector('#setAccountSharing')
        ].filter(Boolean);

        body.querySelector('#setBackAccountHub')?.addEventListener('click', () => {
            _settingsSubView = null;
            _contentIdx = 0;
            _renderContent('settings');
            _updateContentFocus();
        });
        body.querySelector('#setProfileData')?.addEventListener('click', () => {
            _settingsSubView = 'account';
            _contentIdx = 0;
            _renderContent('settings');
            _updateContentFocus();
        });
        body.querySelector('#setAccountSharing')?.addEventListener('click', () => {
            _settingsSubView = 'sharing';
            _contentIdx = 0;
            _renderContent('settings');
            _updateContentFocus();
        });

        _contentItems.forEach((el, idx) => {
            el.addEventListener('mouseenter', () => {
                _topbarFocus = false;
                _contentIdx = idx;
                _updateContentFocus();
            });
        });
    }

    function _renderSettingsAccount(body) {
        if (!document.getElementById('nav-account-styles')) {
            const s = document.createElement('style');
            s.id = 'nav-account-styles';
            s.textContent = `
                .nav-api-row { display: flex; gap: 10px; width: 100%; }
                .nav-icon-btn { min-height:48px; background: rgba(255,255,255,0.045); border: 1px solid rgba(255,255,255,0.11); border-radius: 7px; padding: 0 clamp(12px, 1.2vw, 18px); color: rgba(255,255,255,0.8); cursor: pointer; outline: none; transition: transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1), background-color 0.1s, border-color 0.1s, color 0.1s, box-shadow 0.15s; display: flex; align-items: center; justify-content: center; gap:9px; font-family: inherit; font-size: 0.9rem; font-weight: 560; }
                .nav-icon-btn.nav-focused-el { border-color: #fff; background: rgba(255,255,255,0.15); color: #fff; transform: scale(1.06); box-shadow: 0 8px 20px rgba(0,0,0,0.4); z-index: 10; position: relative;}
                .nav-btn-danger { color: #e99a9a; border-color: rgba(255,107,107,0.24); width: 100%; padding: 14px; margin-top:0; font-size: 1rem; justify-content:flex-start; }
                .nav-btn-danger.nav-focused-el { background: rgba(255,107,107,0.15); border-color: #ff6b6b; color: #fff; }
                .nav-account-identity-kicker { color:rgba(255,255,255,.42); font-size:.72rem; font-weight:720; letter-spacing:.14em; text-transform:uppercase; }
                .nav-account-identity-name { color:#fff; font-size:clamp(1.45rem,2vw,2.5rem); font-weight:360; line-height:1.05; }
                .nav-account-identity-help { max-width:270px; color:rgba(255,255,255,.5); font-size:.84rem; line-height:1.5; }
                .nav-account-section-label { margin-top:4px; padding:0 2px 8px; border-bottom:1px solid rgba(255,255,255,.09); color:rgba(255,255,255,.42); font-size:.7rem; font-weight:720; letter-spacing:.13em; text-transform:uppercase; }
                .nav-profile-sync { margin:2px 0 0; display:flex; align-items:center; justify-content:space-between; gap:14px; min-height:62px; padding:10px 0 14px; border-bottom:1px solid rgba(255,255,255,.08); }
                .nav-profile-sync-status { color:rgba(255,255,255,.52); font-size:.86rem; }
                .nav-profile-sync-status.connected { color:#83d7a0; }
                .nav-profile-sync-actions { display:flex; gap:10px; }
                .nav-profile-sync-actions .nav-icon-btn { min-width:0; min-height:46px; height:46px; padding:0 15px; border-radius:7px; flex:none; }
                .nav-profile-sync-actions .profile-sync-google { width:21px; height:21px; }
                .nav-profile-sync-actions svg:not(.profile-sync-google) { width:20px; height:20px; stroke:currentColor; fill:none; stroke-width:1.8; stroke-linecap:round; stroke-linejoin:round; }
                .nav-account-route { width:100%; min-height:60px; justify-content:space-between; padding:0 17px; font-size:1rem; }
                .nav-account-route-copy { display:grid; gap:3px; text-align:left; }
                .nav-account-route-copy strong { font-size:.98rem; font-weight:590; color:#fff; }
                .nav-account-route-copy small { font-size:.78rem; font-weight:400; color:rgba(255,255,255,.46); }
                .nav-account-route-chevron { color:rgba(255,255,255,.38); font-size:1.25rem; }
                .nav-account-toggle { width:100%; min-height:70px; display:flex; align-items:center; justify-content:space-between; gap:20px; padding:10px 17px; border:1px solid rgba(255,255,255,.08); border-radius:10px; background:rgba(255,255,255,.025); color:#fff; font:inherit; outline:none; text-align:left; }
                .nav-account-toggle.nav-focused-el { border-color:rgba(255,255,255,.72); background:rgba(255,255,255,.09); }
                .nav-account-toggle-copy { min-width:0; display:grid; gap:4px; }
                .nav-account-toggle-copy strong { font-size:.98rem; font-weight:590; }
                .nav-account-toggle-copy small { color:rgba(255,255,255,.46); font-size:.78rem; font-weight:400; line-height:1.35; }
                .nav-account-switch { width:46px; height:25px; flex:none; position:relative; border-radius:999px; background:rgba(255,255,255,.16); transition:.18s ease; }
                .nav-account-switch::after { content:""; position:absolute; top:3px; left:3px; width:19px; height:19px; border-radius:50%; background:#fff; box-shadow:0 2px 8px rgba(0,0,0,.28); transition:.18s ease; }
                .nav-account-toggle[aria-pressed="true"] .nav-account-switch { background:#5f9dff; }
                .nav-account-toggle[aria-pressed="true"] .nav-account-switch::after { transform:translateX(21px); }
                .nav-profile-avatar-sec .nav-profile-photo { width:clamp(112px,10vw,164px); height:clamp(112px,10vw,164px); }
                .nav-profile-fields { padding:0; }
                @media (max-width: 940px) {
                    .nav-profile-dashboard { grid-template-columns:1fr; }
                    .nav-profile-avatar-sec { min-height:230px; }
                }
            `;
            document.head.appendChild(s);
        }

        let pendingName = _menuData.user.Name || '';
        let pendingApi = '';
        let pendingPin = '';
        let apiConfigured = !!(_menuData.user.HasSteamGridApiKey || _menuData.user.hasSteamGridApiKey);
        let pinConfigured = !!(_menuData.user.HasPin || _menuData.user.hasPin);
        let applicationHistoryEnabled = _menuData.user.ApplicationHistoryEnabled !== false && _menuData.user.applicationHistoryEnabled !== false;
        const photo = _menuData.user.PhotoBase64 || '';

        const maskApi = () => apiConfigured
            ? _t('navApiConfigured', 'Chave configurada')
            : _t('navApiNotConfigured', 'Nenhuma chave configurada');

        const maskPin = () => pinConfigured
            ? _t('navPinConfigured', 'PIN configurado')
            : _t('setupPinPlaceholder', 'Sem PIN');

        const _saveProfileNow = (patch = {}) => {
            if (Object.prototype.hasOwnProperty.call(patch, 'name')) pendingName = patch.name;
            const hasApiPatch = Object.prototype.hasOwnProperty.call(patch, 'apiKey');
            const hasPinPatch = Object.prototype.hasOwnProperty.call(patch, 'pin');
            const hasHistoryPatch = Object.prototype.hasOwnProperty.call(patch, 'applicationHistoryEnabled');
            if (hasApiPatch) { pendingApi = patch.apiKey; apiConfigured = !!pendingApi; }
            if (hasPinPatch) { pendingPin = patch.pin; pinConfigured = !!pendingPin; }
            if (hasHistoryPatch) applicationHistoryEnabled = patch.applicationHistoryEnabled !== false;
            _menuData.user.Name = pendingName;
            _menuData.user.SteamGridApiKey = '';
            _menuData.user.PinCode = '';
            _menuData.user.HasSteamGridApiKey = apiConfigured;
            _menuData.user.HasPin = pinConfigured;
            _menuData.user.ApplicationHistoryEnabled = applicationHistoryEnabled;
            if (window._doorpiProfile) {
                window._doorpiProfile.Name = pendingName;
                window._doorpiProfile.SteamGridApiKey = '';
                window._doorpiProfile.PinCode = '';
                window._doorpiProfile.HasSteamGridApiKey = apiConfigured;
                window._doorpiProfile.HasPin = pinConfigured;
                window._doorpiProfile.ApplicationHistoryEnabled = applicationHistoryEnabled;
            }
            if (typeof postToHost === 'function') {
                const message = {
                    action: 'saveUserProfile',
                    name: pendingName,
                    photoBase64: _menuData.user.PhotoBase64 || '',
                    skipTasks: true
                };
                if (hasApiPatch) message.apiKey = pendingApi;
                if (hasPinPatch) message.pin = pendingPin;
                if (hasHistoryPatch) message.applicationHistoryEnabled = applicationHistoryEnabled;
                postToHost(message);
            }
        };

        const _saveApiNow = (apiKey) => {
            _saveProfileNow({ apiKey });
            pendingApi = '';
        };

        const _normalizePin = (value) => String(value || '').replace(/\D/g, '').slice(0, 4);
        const _isValidPin = (value) => {
            const pin = _normalizePin(value);
            return pin.length === 0 || pin.length === 4;
        };

        body.innerHTML = `
            <div class="nav-settings-subheader">
                <button class="nav-back-btn" id="setBack" tabindex="-1">‹ ${_t('navBack', 'Voltar')}</button>
                <h2>${_t('navSetAccount', 'Conta e Perfil')}</h2>
            </div>
            
            <div class="nav-profile-dashboard">
                <div class="nav-profile-avatar-sec">
                    <button class="nav-profile-photo" id="navProfilePhoto" tabindex="-1">
                        ${photo ? `<img src="${window._doorpiUserPhotoSrc?.(photo) || `data:image/png;base64,${photo}`}" />` : '◉'}
                    </button>
                    <span class="nav-account-identity-kicker">${_t('navAvatarChange', 'Alterar avatar')}</span>
                    <strong class="nav-account-identity-name">${_esc(pendingName || _t('navSetAccount', 'Perfil'))}</strong>
                    <span class="nav-account-identity-help">Sua identidade no Doorpi, preferências de segurança e sincronização ficam reunidas aqui.</span>
                </div>
                
                <div class="nav-profile-fields">
                    <span class="nav-account-section-label">Identidade e acesso</span>
                    <div class="nav-profile-field">
                        <span class="nav-profile-field-label">${_t('navProfileNameLabel', 'Nome de Usuário')}</span>
                        <input class="nav-profile-field-input" id="navProfName" readonly value="${pendingName}" tabindex="-1" />
                    </div>

                    <div class="nav-profile-field" style="margin-top: 10px;">
                        <span class="nav-profile-field-label">${_t('navProfilePinLabel', 'PIN de acesso (opcional)')}</span>
                        <input class="nav-profile-field-input" id="navProfPin" type="text" readonly value="${maskPin()}" inputmode="numeric" pattern="[0-9]*" maxlength="4" tabindex="-1" />
                    </div>
                    
                    <div class="nav-profile-field" style="margin-top: 10px;">
                        <span class="nav-profile-field-label">${_t('navProfileApiLabel', 'Chave API SteamGridDB')}</span>
                        <div class="nav-api-row">
                            <input class="nav-profile-field-input" id="navProfApi" readonly value="${maskApi()}" tabindex="-1" style="flex:1;" />
                            <button class="nav-icon-btn" id="navApiPaste" tabindex="-1">${_t('btnPaste', 'Colar')}</button>
                            <button class="nav-icon-btn" id="navApiLink" tabindex="-1">${_t('btnViewKey', 'Ver Chave')}</button>
                        </div>
                    </div>
                    
                    <div style="display:flex; justify-content:flex-start; align-items:center; min-height:18px;">
                        <span id="navSaveStatus" style="color:#6ee696; font-size:0.95rem; font-weight:500; opacity:0; transition:opacity 0.3s;">${_t('toastChangesSaved', '✓ Alterações Salvas')}</span>
                    </div>

                    <span class="nav-account-section-label">Conta na nuvem</span>
                    <div class="nav-profile-sync">
                        <span class="nav-profile-sync-status" id="navProfileSyncStatus"></span>
                        <div class="nav-profile-sync-actions">
                            <button class="nav-icon-btn" id="navProfileSyncConnect" tabindex="-1" title="${_t('profileSyncLoginGoogle', 'Entrar com Google')}" aria-label="${_t('profileSyncLoginGoogle', 'Entrar com Google')}">${window.DoorpiProfileSync?.googleIcon || 'G'}<span>${_t('profileSyncLoginGoogle', 'Entrar com Google')}</span></button>
                            <button class="nav-icon-btn" id="navProfileSyncNow" tabindex="-1" title="${_t('profileSyncNow', 'Sincronizar agora')}" aria-label="${_t('profileSyncNow', 'Sincronizar agora')}">${window.DoorpiProfileSync?.googleIcon || 'G'}<span>${_t('profileSyncNow', 'Sincronizar agora')}</span></button>
                            <button class="nav-icon-btn" id="navProfileSyncDisconnect" tabindex="-1" title="${_t('profileSyncDisconnect', 'Desconectar')}" aria-label="${_t('profileSyncDisconnect', 'Desconectar')}"><svg viewBox="0 0 24 24"><path d="M9 15l6-6"/><path d="M7.2 11.2 5.4 13a4 4 0 0 0 5.6 5.6l1.8-1.8"/><path d="m16.8 12.8 1.8-1.8A4 4 0 0 0 13 5.4l-1.8 1.8"/><path d="M4 4l16 16"/></svg><span>${_t('profileSyncDisconnect', 'Desconectar')}</span></button>
                        </div>
                    </div>

                    <span class="nav-account-section-label">${_t('navPrivacyActivity','Privacidade e atividade')}</span>
                    <button class="nav-account-toggle" id="navApplicationHistory" aria-pressed="${applicationHistoryEnabled}" tabindex="-1">
                        <span class="nav-account-toggle-copy"><strong>${_t('navApplicationHistory','Histórico de aplicativos')}</strong><small>${_t('navApplicationHistoryHint','Registra apenas mídias realmente reproduzidas nos aplicativos nativos deste perfil.')}</small></span>
                        <span class="nav-account-switch" aria-hidden="true"></span>
                    </button>

                    <span class="nav-account-section-label">${_t('navAccessMaintenance','Acesso e manutenção')}</span>
                    <button class="nav-icon-btn nav-account-route" id="navAccountSharing" tabindex="-1"><span class="nav-account-route-copy"><strong>${_t('navSetSharing', 'Contas dos apps')}</strong><small>Escolha quem pode usar cada conta conectada.</small></span><span class="nav-account-route-chevron">›</span></button>
                    <button class="nav-icon-btn nav-btn-danger" id="navDeleteUser" tabindex="-1"><span>Excluir perfil</span></button>
                </div>
            </div>`;

        _contentItems = [
            body.querySelector('#setBack'),
            body.querySelector('#navProfilePhoto'),
            body.querySelector('#navProfName'),
            body.querySelector('#navProfPin'),
            body.querySelector('#navProfApi'),
            body.querySelector('#navApiPaste'),
            body.querySelector('#navApiLink'),
            body.querySelector('#navProfileSyncConnect'),
            body.querySelector('#navProfileSyncNow'),
            body.querySelector('#navProfileSyncDisconnect'),
            body.querySelector('#navApplicationHistory'),
            body.querySelector('#navAccountSharing'),
            body.querySelector('#navDeleteUser')
        ].filter(Boolean);

        body.querySelector('#setBack')?.addEventListener('click', () => {
            _settingsSubView = 'accountHub';
            _contentIdx = 0;
            document.activeElement?.blur(); 
            requestAnimationFrame(() => {
                _renderContent('settings');
                _updateContentFocus();
            });
        });

        const photoBtn = body.querySelector('#navProfilePhoto');
        const nameInput = body.querySelector('#navProfName');
        const pinInput = body.querySelector('#navProfPin');
        const apiInput = body.querySelector('#navProfApi');
        const pasteBtn = body.querySelector('#navApiPaste');
        const linkBtn = body.querySelector('#navApiLink');
        const applicationHistoryBtn = body.querySelector('#navApplicationHistory');
        const sharingBtn = body.querySelector('#navAccountSharing');
        const deleteBtn = body.querySelector('#navDeleteUser');

        const refreshSyncUi = () => {
            const connected = !!_profileSyncUi.connected;
            const busy = !!_profileSyncUi.busy;
            const status = body.querySelector('#navProfileSyncStatus');
            const connect = body.querySelector('#navProfileSyncConnect');
            const syncNow = body.querySelector('#navProfileSyncNow');
            const disconnect = body.querySelector('#navProfileSyncDisconnect');
            if (status) {
                status.textContent = busy
                    ? _t('profileSyncWorking', 'Sincronizando...')
                    : (_profileSyncUi.message || (connected ? _t('profileSyncConnected', 'Sincronizado') : _t('profileSyncDisconnected', 'Não conectado')));
                status.classList.toggle('connected', connected && !busy);
            }
            if (connect) connect.style.display = connected ? 'none' : 'flex';
            if (syncNow) syncNow.style.display = connected ? 'flex' : 'none';
            if (disconnect) disconnect.style.display = connected ? 'flex' : 'none';
            if (connect) connect.disabled = busy;
            if (syncNow) syncNow.disabled = busy;
            if (disconnect) disconnect.disabled = busy;
            _contentItems = [
                body.querySelector('#setBack'), body.querySelector('#navProfilePhoto'),
                body.querySelector('#navProfName'), body.querySelector('#navProfPin'),
                body.querySelector('#navProfApi'), body.querySelector('#navApiPaste'),
                body.querySelector('#navApiLink'), body.querySelector('#navProfileSyncConnect'),
                body.querySelector('#navProfileSyncNow'), body.querySelector('#navProfileSyncDisconnect'),
                body.querySelector('#navApplicationHistory'),
                body.querySelector('#navAccountSharing'), body.querySelector('#navDeleteUser')
            ].filter(item => item && item.offsetWidth > 0 && item.offsetHeight > 0);
            _contentIdx = Math.min(_contentIdx, Math.max(0, _contentItems.length - 1));
        };
        window._refreshProfileSyncAccountUi = refreshSyncUi;
        refreshSyncUi();
        postToHost?.({ action: 'profileSyncStatus' });

        body.querySelector('#navProfileSyncConnect')?.addEventListener('click', () => {
            _profileSyncUi.busy = true;
            refreshSyncUi();
            postToHost?.({ action: 'profileSyncConnect' });
        });
        body.querySelector('#navProfileSyncNow')?.addEventListener('click', () => {
            _profileSyncUi.busy = true;
            refreshSyncUi();
            postToHost?.({ action: 'profileSyncNow' });
        });
        body.querySelector('#navProfileSyncDisconnect')?.addEventListener('click', () => {
            window.DoorpiProfileSync?.confirmDisconnect?.('', deleteCloud => {
                _profileSyncUi.busy = true;
                refreshSyncUi();
                postToHost?.({ action: 'profileSyncDisconnect', deleteCloud });
            });
        });

        applicationHistoryBtn?.addEventListener('click', () => {
            applicationHistoryEnabled = !applicationHistoryEnabled;
            applicationHistoryBtn.setAttribute('aria-pressed', String(applicationHistoryEnabled));
            _saveProfileNow({ applicationHistoryEnabled });
            _showSavedFeedback();
        });

        const _showSavedFeedback = () => {
            const status = document.getElementById('navSaveStatus');
            if (status) {
                status.style.opacity = '1';
                setTimeout(() => status.style.opacity = '0', 3000);
            }
        };

        photoBtn?.addEventListener('click', () => {
            if (typeof window.openDoorpiProfilePhotoPicker !== 'function') {
                console.error('[ProfilePhoto] Seletor de foto não foi carregado.');
                return;
            }
            window.openDoorpiProfilePhotoPicker({
                hasApiKey: apiConfigured,
                returnFocus: photoBtn,
                onApply: result => {
                    _menuData.user.PhotoBase64 = result.base64;
                    _menuData.user.PhotoSource = result.photoSource;
                    _menuData.user.PhotoSourceUrl = result.photoSourceUrl;
                    _menuData.user.PhotoSteamGridAssetId = result.photoSteamGridAssetId;
                    _menuData.user.PhotoCropX = result.photoCropX;
                    _menuData.user.PhotoCropY = result.photoCropY;
                    _menuData.user.PhotoZoom = result.photoZoom;
                    if (window._doorpiProfile) Object.assign(window._doorpiProfile, _menuData.user);
                    window._applyDoorpiTopProfile?.(window._doorpiProfile || _menuData.user);
                    postToHost({
                        action: 'saveUserProfile',
                        name: _menuData.user.Name || '',
                        photoBase64: result.base64,
                        photoSource: result.photoSource,
                        photoSourceUrl: result.photoSourceUrl,
                        photoSteamGridAssetId: result.photoSteamGridAssetId,
                        photoCropX: result.photoCropX,
                        photoCropY: result.photoCropY,
                        photoZoom: result.photoZoom,
                        skipTasks: true
                    });
                    const imgTag = `<img src="data:image/jpeg;base64,${result.base64}" />`;
                    if (photoBtn) photoBtn.innerHTML = imgTag;
                    document.querySelectorAll('.nav-profile-avatar-large').forEach(avatar => { avatar.innerHTML = imgTag; });
                    _showSavedFeedback();
                }
            });
        });

        linkBtn?.addEventListener('click', () => {
            if (typeof postToHost === 'function') postToHost({ action: 'launchMediaApp', url: 'https://www.steamgriddb.com/profile/preferences/api', appType: 'webview' });
        });

        sharingBtn?.addEventListener('click', () => {
            _settingsSubView = 'sharing';
            _contentIdx = 0;
            _renderContent('settings');
            _updateContentFocus();
        });

        pasteBtn?.addEventListener('click', () => {
            window._isPastingApiKey = true;
            if (typeof postToHost === 'function') postToHost({ action: 'readClipboard' });
        });

        let _deleteConfirmStep = false;
        deleteBtn?.addEventListener('click', () => {
            if (!_deleteConfirmStep) {
                _deleteConfirmStep = true;
                deleteBtn.textContent = _t('btnDeleteProfileConfirm', 'Tem certeza? Pressione novamente para excluir');
                deleteBtn.style.backgroundColor = 'rgba(255,50,50,0.3)';
                deleteBtn.style.borderColor = '#ff4444';

                const revert = () => {
                    _deleteConfirmStep = false;
                    deleteBtn.textContent = _t('btnDeleteProfile', 'Excluir Perfil');
                    deleteBtn.style.backgroundColor = '';
                    deleteBtn.style.borderColor = '';
                    deleteBtn.removeEventListener('blur', revert);
                };
                deleteBtn.addEventListener('blur', revert);
            } else {
                if (typeof postToHost === 'function') postToHost({ action: 'deleteCurrentUser' });
            }
        });

        nameInput?.addEventListener('click', event => {
            nameInput.value = pendingName;
            nameInput.removeAttribute('readonly');
            if (!window._doorpiShouldOpenVkbFromEvent?.(event)) return;
            window._vkbOpen?.(nameInput, {
                onOk: () => {
                    pendingName = nameInput.value.trim();
                    nameInput.value = pendingName;
                    nameInput.setAttribute('readonly', '');
                    window._vkbForceClose?.();

                    _saveProfileNow({ name: pendingName });
                    const topBtnName = document.querySelector('#btnTopProfile .top-profile-name');
                    if (topBtnName) topBtnName.textContent = pendingName;
                    const identityName = body.querySelector('.nav-account-identity-name');
                    if (identityName) identityName.textContent = pendingName;
                    _showSavedFeedback();
                },
                onCancel: () => {
                    nameInput.value = pendingName;
                    nameInput.setAttribute('readonly', '');
                    window._vkbForceClose?.();
                }
            });
        });

        pinInput?.addEventListener('click', event => {
            pinInput.value = '';
            pinInput.type = 'password';
            pinInput.removeAttribute('readonly');
            if (!window._doorpiShouldOpenVkbFromEvent?.(event)) return;
            window._vkbOpen?.(pinInput, {
                mode: 'numeric',
                onOk: () => {
                    const newPin = _normalizePin(pinInput.value);
                    pinInput.value = newPin;
                    if (!_isValidPin(newPin)) {
                        window.showDoorpiToast?.(
                            _t('setupPinInvalidTitle', 'PIN inválido'),
                            _t('setupPinLengthError', 'Use 4 dígitos ou deixe vazio.')
                        );
                        pinInput.focus();
                        return;
                    }
                    pendingPin = newPin;
                    pinInput.setAttribute('readonly', '');
                    window._vkbForceClose?.();
                    _saveProfileNow({ pin: newPin });
                    pinInput.type = 'text';
                    pinInput.value = maskPin();
                    _showSavedFeedback();
                },
                onCancel: () => {
                    pinInput.type = 'text';
                    pinInput.value = maskPin();
                    pinInput.setAttribute('readonly', '');
                    window._vkbForceClose?.();
                }
            });
        });
        pinInput?.addEventListener('input', event => {
            const digits = _normalizePin(event.target.value);
            if (event.target.value !== digits) event.target.value = digits;
        });

        apiInput?.addEventListener('click', event => {
            apiInput.value = '';
            apiInput.removeAttribute('readonly');
            if (!window._doorpiShouldOpenVkbFromEvent?.(event)) return;
            window._vkbOpen?.(apiInput, {
                onOk: () => {
                    const newKey = apiInput.value.trim();
                    apiInput.setAttribute('readonly', '');
                    window._vkbForceClose?.();
                    _saveApiNow(newKey);
                    apiInput.value = maskApi();
                    _showSavedFeedback();
                },
                onCancel: () => {
                    apiInput.value = maskApi();
                    apiInput.setAttribute('readonly', '');
                    window._vkbForceClose?.();
                }
            });
        });

        window._updatePendingApiKey = (keyText) => {
            const trimmed = keyText.trim();
            _saveApiNow(trimmed);
            if (apiInput) apiInput.value = maskApi();
            _showSavedFeedback();
        };

        _contentItems.forEach((el, idx) => {
            el.addEventListener('mouseenter', () => {
                _topbarFocus = false;
                _contentIdx = idx;
                _updateContentFocus();
            });
        });
    }

    function _renderSettingsSharingLegacy(body) {
        if (!document.getElementById('nav-sharing-styles')) {
            const s = document.createElement('style');
            s.id = 'nav-sharing-styles';
            s.textContent = `
                .nav-sharing-layout { display: grid; grid-template-columns: minmax(220px, 0.9fr) minmax(360px, 1.4fr); gap: 18px; align-items: start; max-width: 1180px; animation: fadeInTop 0.3s ease; }
                .nav-sharing-apps, .nav-sharing-panel { background: rgba(255,255,255,0.035); border: 1px solid rgba(255,255,255,0.09); border-radius: 10px; padding: 14px; }
                .nav-sharing-apps { display: flex; flex-direction: column; gap: 8px; max-height: 58vh; overflow: auto; }
                .nav-sharing-app { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-height: 52px; padding: 0 12px; border-radius: 8px; border: 1px solid transparent; background: transparent; color: #fff; font: inherit; text-align: left; outline: none; cursor: pointer; }
                .nav-sharing-app.active { background: rgba(120,190,255,0.08); border-color: rgba(120,190,255,0.22); }
                .nav-sharing-app.nav-focused-el { background: rgba(255,255,255,0.14); border-color: #fff; box-shadow: 0 0 0 2px rgba(255,255,255,0.22), 0 10px 24px rgba(0,0,0,0.35); }
                .nav-sharing-app small { color: rgba(255,255,255,0.45); white-space: nowrap; }
                .nav-sharing-panel { min-height: 360px; display: flex; flex-direction: column; gap: 16px; }
                .nav-sharing-title { margin: 0; color: #fff; font-size: 1.35rem; font-weight: 500; }
                .nav-sharing-sub { margin: -6px 0 0; color: rgba(255,255,255,0.55); line-height: 1.45; }
                .nav-sharing-modes { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
                .nav-sharing-mode, .nav-sharing-save { min-height: 48px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.14); background: rgba(255,255,255,0.05); color: #fff; font: inherit; outline: none; cursor: pointer; }
                .nav-sharing-mode.active { border-color: rgba(120,190,255,0.55); background: rgba(120,190,255,0.12); }
                .nav-sharing-mode.nav-focused-el { border-color: #fff; background: rgba(255,255,255,0.16); box-shadow: 0 0 0 2px rgba(255,255,255,0.2), 0 8px 20px rgba(0,0,0,0.32); }
                .nav-sharing-users { display: grid; grid-template-columns: repeat(auto-fill, minmax(118px, 1fr)); gap: 10px; }
                .nav-sharing-user { min-height: 112px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.04); color: #fff; font: inherit; outline: none; cursor: pointer; position: relative; }
                .nav-sharing-user.selected { border-color: rgba(120,190,255,0.52); background: rgba(120,190,255,0.10); }
                .nav-sharing-user.nav-focused-el { border-color: #fff; background: rgba(255,255,255,0.14); box-shadow: 0 0 0 2px rgba(255,255,255,0.2), 0 10px 24px rgba(0,0,0,0.35); }
                .nav-sharing-user.selected::after { content: 'OK'; position: absolute; top: 8px; right: 8px; font-size: 0.62rem; color: #111; background: #fff; border-radius: 999px; padding: 2px 6px; font-weight: 800; }
                .nav-sharing-avatar { width: 44px; height: 44px; border-radius: 50%; overflow: hidden; background: rgba(255,255,255,0.10); display:flex; align-items:center; justify-content:center; color: rgba(255,255,255,0.65); }
                .nav-sharing-avatar img { width: 100%; height: 100%; object-fit: cover; }
                .nav-sharing-save { align-self: flex-start; padding: 0 22px; font-weight: 700; background: #fff; color: #080812; border-color: transparent; }
                .nav-sharing-save.nav-focused-el { background: #101018; color: #fff; border-color: #fff; box-shadow: 0 0 0 3px rgba(255,255,255,0.26), 0 10px 26px rgba(0,0,0,0.45); transform: scale(1.04); }
                .nav-sharing-save[disabled] { opacity: .45; pointer-events: none; }
                .nav-sharing-note { min-height: 22px; color: rgba(130,210,255,0.95); font-size: 0.92rem; }
                .nav-store-policy-section { max-width: 1180px; margin: 0 0 18px; animation: fadeInTop 0.3s ease; }
                .nav-store-policy-head { display: flex; flex-direction: column; gap: 3px; margin: 0 0 10px; }
                .nav-store-policy-head h3 { margin: 0; color: #fff; font-size: 1.02rem; font-weight: 600; }
                .nav-store-policy-head p { margin: 0; color: rgba(255,255,255,0.46); font-size: 0.86rem; line-height: 1.32; }
                .nav-store-policy-grid { display: flex; flex-direction: column; gap: 8px; }
                .nav-store-policy-row { min-height: 58px; display: grid; grid-template-columns: minmax(150px, .45fr) minmax(0, 1fr); gap: 10px; align-items: center; padding: 9px 12px; border-radius: 8px; border: 1px solid transparent; background: rgba(255,255,255,0.035); }
                .nav-store-policy-name { color: #fff; font-size: .98rem; font-weight: 600; }
                .nav-store-policy-actions { display: flex; flex-direction: column; justify-content: center; align-items: stretch; gap: 7px; min-width: 0; }
                .nav-store-policy-toggle { min-height: 40px; width: 100%; display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 9px; align-items: center; padding: 6px 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.10); background: transparent; color: #fff; font: inherit; text-align: left; outline: none; cursor: pointer; }
                .nav-store-policy-toggle.active { border-color: rgba(120,190,255,0.38); background: rgba(120,190,255,0.09); }
                .nav-store-policy-toggle.nav-focused-el { border-color: #fff; background: rgba(255,255,255,0.14); box-shadow: 0 0 0 2px rgba(255,255,255,0.18), 0 8px 20px rgba(0,0,0,0.30); }
                .nav-store-policy-switch { width: 36px; height: 20px; border-radius: 999px; background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.14); position: relative; transition: background .14s ease, border-color .14s ease; }
                .nav-store-policy-toggle.active .nav-store-policy-switch { background: rgba(120,190,255,0.8); border-color: rgba(255,255,255,0.42); }
                .nav-store-policy-switch::after { content: ''; position: absolute; width: 14px; height: 14px; left: 2px; top: 2px; border-radius: 50%; background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,.35); transition: transform .14s ease; }
                .nav-store-policy-toggle.active .nav-store-policy-switch::after { transform: translateX(16px); }
                .nav-store-policy-copy { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
                .nav-store-policy-copy strong { font-size: .86rem; color: rgba(255,255,255,.9); font-weight: 600; white-space: nowrap; }
                .nav-store-policy-copy span { display: none; }
            `;
            document.head.appendChild(s);
        }

        if (!Array.isArray(window._doorpiUsers) || window._doorpiUsers.length === 0) {
            if (typeof postToHost === 'function') postToHost({ action: 'requestUsersData' });
        }

        const currentUserId = _userId(_menuData.user) || _userId(window._doorpiProfile) || window._doorpiCurrentUserId || '';
        const users = (window._doorpiUsers || []).filter(u => _userId(u));
        const shareUsers = users.filter(u => !_sameId(_userId(u), currentUserId));
        const apps = (_menuData.media || []).filter(app => _isWebAccountApp(app));
        const isAdmin = !!window._doorpiIsAdmin || !!(window._doorpiProfile?.IsAdmin || window._doorpiProfile?.isAdmin);
        const betaStores = [
            { id: 'Steam', name: 'Steam', steam: true },
            { id: 'Epic', name: 'Epic Games' },
            { id: 'GOG', name: 'GOG' },
            { id: 'Riot', name: 'Riot Games' },
            { id: 'Xbox', name: 'Xbox' }
        ];
        const rawBlockedStores = window._adminBlockedStoreIds instanceof Set
            ? Array.from(window._adminBlockedStoreIds)
            : (Array.isArray(window._adminBlockedStoreIds) ? window._adminBlockedStoreIds : []);
        const blockedStoreKeys = new Set(rawBlockedStores.map(id => String(id || '').trim().toLowerCase()).filter(Boolean));
        const isStoreBlocked = (id) => blockedStoreKeys.has(String(id || '').trim().toLowerCase());
        let selectedAppId = _sharingFocusAppId || _appId(apps[0]) || '';
        let selectedApp = apps.find(app => _sameId(_appId(app), selectedAppId)) || apps[0] || null;
        if (selectedApp) selectedAppId = _appId(selectedApp);

        const sharedIdsOf = (app) => {
            const ids = Array.isArray(app?.SharedWithUserIds || app?.sharedWithUserIds)
                ? (app.SharedWithUserIds || app.sharedWithUserIds)
                : [];
            const legacy = app?.SharedWithUserId || app?.sharedWithUserId || '';
            return [...ids, legacy].filter(Boolean).filter(id => !_sameId(id, currentUserId));
        };
        let draftMode = selectedApp?.ShareMode || selectedApp?.shareMode || 'private';
        let draftUsers = new Set(sharedIdsOf(selectedApp));

        const appStatus = (app) => {
            if (app.IsSharedFromOtherUser || app.isSharedFromOtherUser)
                return app.SharedFromUserName || app.sharedFromName || _t('sharedFromOther', 'Compartilhado');
            const mode = app.ShareMode || app.shareMode || 'private';
            if (mode === 'all') return _t('shareModeAll', 'Todos os usuários');
            if (mode === 'user') {
                const names = app.SharedWithUserNames || app.sharedWithUserNames || [];
                return names.length ? names.join(', ') : _t('shareModeUser', 'Usuários escolhidos');
            }
            return _t('shareModePrivate', 'Somente eu');
        };

        const userAvatar = (u) => (u.PhotoBase64 || u.photoBase64)
            ? `<img src="${window._doorpiUserPhotoSrc?.(u.PhotoBase64 || u.photoBase64) || `data:image/png;base64,${u.PhotoBase64 || u.photoBase64}`}" />`
            : _esc((_userName(u) || '?').charAt(0).toUpperCase());

        body.innerHTML = `
            <div class="nav-settings-subheader">
                <button class="nav-back-btn" id="setBackSharing" tabindex="-1">< ${_t('navBack', 'Voltar')}</button>
                <h2>${_t('accountSharingLabel', 'Compartilhamento de conta')}</h2>
            </div>
            ${isAdmin ? `
            <section class="nav-store-policy-section" aria-label="${_t('storePolicyTitle', 'Políticas de lojas')}">
                <div class="nav-store-policy-head">
                    <h3>${_t('storePolicyTitle', 'Políticas de lojas')}</h3>
                    <p>${_t('storePolicyDesc', 'Controle quais lojas podem ser usadas por outras contas deste Doorpi.')}</p>
                </div>
                <div class="nav-store-policy-grid">
                    ${betaStores.map(store => `
                    <div class="nav-store-policy-row" data-store-id="${_esc(store.id)}">
                        <div class="nav-store-policy-name">${_esc(store.name)}</div>
                        <div class="nav-store-policy-actions">
                            <button class="nav-store-policy-toggle ${isStoreBlocked(store.id) ? 'active' : ''}" data-policy="blocked" data-store-id="${_esc(store.id)}" data-active="${isStoreBlocked(store.id) ? 'true' : 'false'}" tabindex="-1">
                                <span class="nav-store-policy-switch" aria-hidden="true"></span>
                                <span class="nav-store-policy-copy">
                                    <strong>${_t('storeAdminBlockToggle', 'Privar loja para outras contas')}</strong>
                                    <span>${_t('storePolicyPrivateDesc', 'Impede abrir a loja e iniciar jogos dela em outros perfis.')}</span>
                                </span>
                            </button>
                            ${store.steam ? `
                            <button class="nav-store-policy-toggle ${window._steamForceAccountSelection ? 'active' : ''}" data-policy="steam-account" data-store-id="Steam" data-active="${window._steamForceAccountSelection ? 'true' : 'false'}" tabindex="-1">
                                <span class="nav-store-policy-switch" aria-hidden="true"></span>
                                <span class="nav-store-policy-copy">
                                    <strong>${_t('steamForceAccountSelection', 'Forçar seleção de usuário Steam')}</strong>
                                    <span>${_t('steamForceAccountSelectionDesc', 'Fecha e reabre a Steam antes de iniciar jogos para exibir o seletor de usuário.')}</span>
                                </span>
                            </button>` : ''}
                        </div>
                    </div>`).join('')}
                </div>
            </section>` : ''}
            <div class="nav-sharing-layout">
                <div class="nav-sharing-apps" id="navSharingApps">
                    ${apps.length ? apps.map(app => {
                        const id = _appId(app);
                        return `<button class="nav-sharing-app ${id === selectedAppId ? 'active' : ''}" data-app-id="${_esc(id)}" tabindex="-1">
                            <span>${_esc(_appName(app))}</span>
                            <small>${_esc(appStatus(app))}</small>
                        </button>`;
                    }).join('') : `<div class="nav-sharing-sub">${_t('navNoMedia', 'Nenhum app configurado')}</div>`}
                </div>
                <div class="nav-sharing-panel" id="navSharingPanel"></div>
            </div>`;

        const panel = body.querySelector('#navSharingPanel');

        const renderPanel = () => {
            if (!panel) return;
            if (!selectedApp) {
                panel.innerHTML = `<p class="nav-sharing-sub">${_t('navNoMedia', 'Nenhum app configurado')}</p>`;
                return;
            }

            const appName = _appName(selectedApp);
            const sharedFrom = selectedApp.SharedFromUserName || selectedApp.sharedFromName || '';
            const locked = !!(selectedApp.IsSharedFromOtherUser || selectedApp.isSharedFromOtherUser);
            const selectedNames = Array.from(draftUsers)
                .map(id => _userName(users.find(u => _sameId(_userId(u), id))))
                .filter(Boolean);
            
            const currentText = locked
                ? _t('sharedByInfo', `Compartilhado por ${sharedFrom || _t('defaultOtherUser', 'outro usuário')}.`, sharedFrom || _t('defaultOtherUser', 'outro usuário'))
                : draftMode === 'all'
                    ? _t('shareStatusAll', 'Este app está público para todos os usuários atuais e futuros.')
                    : draftMode === 'user'
                        ? (selectedNames.length ? _t('shareStatusUser', `Compartilhado com ${selectedNames.join(', ')}.`, selectedNames.join(', ')) : _t('shareStatusUserEmpty', 'Escolha um ou mais usuários.'))
                        : _t('shareStatusPrivate', 'Este app usa uma conta separada para cada usuário.');

            panel.innerHTML = `
                <h3 class="nav-sharing-title">${_esc(appName)}</h3>
                <p class="nav-sharing-sub">${_esc(currentText)}</p>
                ${locked ? '' : `
                    <p class="nav-sharing-question">Quem pode usar esta conta?</p>
                    <div class="nav-sharing-modes">
                        <button class="nav-sharing-mode ${draftMode === 'private' ? 'active' : ''}" data-mode="private" tabindex="-1"><span class="nav-sharing-mode-copy"><strong>Somente eu</strong><small>Cada perfil conecta e usa a própria conta.</small></span><span class="nav-sharing-mode-state">${draftMode === 'private' ? 'Selecionado' : 'Selecionar'}</span></button>
                        <button class="nav-sharing-mode ${draftMode === 'user' ? 'active' : ''}" data-mode="user" tabindex="-1"><span class="nav-sharing-mode-copy"><strong>Usuários escolhidos</strong><small>Libere esta conta apenas para os perfis que você indicar.</small></span><span class="nav-sharing-mode-state">${draftMode === 'user' ? 'Selecionado' : 'Selecionar'}</span></button>
                        <button class="nav-sharing-mode ${draftMode === 'all' ? 'active' : ''}" data-mode="all" tabindex="-1"><span class="nav-sharing-mode-copy"><strong>Todos neste Doorpi</strong><small>Perfis atuais e futuros poderão usar a mesma conta.</small></span><span class="nav-sharing-mode-state">${draftMode === 'all' ? 'Selecionado' : 'Selecionar'}</span></button>
                    </div>
                    <div class="nav-sharing-users" style="${draftMode === 'user' ? '' : 'display:none;'}">
                        ${shareUsers.map(u => {
                            const uid = _userId(u);
                            const selected = Array.from(draftUsers).some(id => _sameId(id, uid));
                            return `
                            <button class="nav-sharing-user ${selected ? 'selected' : ''}" data-user-id="${_esc(uid)}" tabindex="-1">
                                <span class="nav-sharing-avatar">${userAvatar(u)}</span>
                                <span>${_esc(_userName(u))}</span>
                            </button>`;
                        }).join('')}
                    </div>
                    <div class="nav-sharing-savebar">
                        <div class="nav-sharing-note" id="navSharingNote">As alterações só são aplicadas ao salvar.</div>
                        <button class="nav-sharing-save" id="navSharingSave" tabindex="-1" ${draftMode === 'user' && draftUsers.size === 0 ? 'disabled' : ''}>Salvar acesso</button>
                    </div>
                `}
            `;

            panel.querySelectorAll('.nav-sharing-mode').forEach(btn => {
                btn.addEventListener('click', () => {
                    draftMode = btn.dataset.mode || 'private';
                    renderPanel();
                    refreshSharingFocus();
                });
            });
            panel.querySelectorAll('.nav-sharing-user').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = btn.dataset.userId || '';
                    const existing = Array.from(draftUsers).find(value => _sameId(value, id));
                    if (existing) draftUsers.delete(existing);
                    else draftUsers.add(id);
                    renderPanel();
                    refreshSharingFocus();
                });
            });
            panel.querySelector('#navSharingSave')?.addEventListener('click', () => {
                if (!selectedApp) return;
                const ids = draftMode === 'user' ? Array.from(draftUsers) : [];
                if (draftMode === 'user' && ids.length === 0) return;
                selectedApp.ShareMode = draftMode;
                selectedApp.shareMode = draftMode;
                selectedApp.SharedWithUserIds = ids;
                selectedApp.sharedWithUserIds = ids;
                selectedApp.SharedWithUserNames = ids.map(id => _userName(users.find(u => _sameId(_userId(u), id)))).filter(Boolean);
                selectedApp.sharedWithUserNames = selectedApp.SharedWithUserNames;
                if (typeof postToHost === 'function') {
                    window._doorpiSuppressSharingRefreshUntil = Date.now() + 1200;
                    postToHost({ action: 'updateAppSharing', appId: selectedAppId, shareMode: draftMode, sharedWithUserIds: ids });
                }
                const activeRow = Array.from(body.querySelectorAll('.nav-sharing-app'))
                    .find(btn => _sameId(btn.dataset.appId, selectedAppId));
                const statusEl = activeRow?.querySelector('small');
                if (statusEl) statusEl.textContent = appStatus(selectedApp);
                const note = panel.querySelector('#navSharingNote');
                if (note) {
                    note.textContent = _t('navSharingSaved', 'Compartilhamento salvo.');
                    clearTimeout(note._clearTimer);
                    note._clearTimer = setTimeout(() => {
                        if (document.contains(note)) note.textContent = 'As alterações só são aplicadas ao salvar.';
                    }, 2200);
                }
                const saveBtn = panel.querySelector('#navSharingSave');
                if (saveBtn) {
                    const idx = _contentItems.indexOf(saveBtn);
                    if (idx >= 0) _contentIdx = idx;
                    _updateContentFocus();
                }
            });
        };

        const selectApp = (appId) => {
            _sharingFocusAppId = appId;
            selectedApp = apps.find(app => _sameId(_appId(app), appId)) || apps[0] || null;
            selectedAppId = _appId(selectedApp);
            draftMode = selectedApp?.ShareMode || selectedApp?.shareMode || 'private';
            draftUsers = new Set(sharedIdsOf(selectedApp));
            body.querySelectorAll('.nav-sharing-app').forEach(btn => btn.classList.toggle('active', btn.dataset.appId === selectedAppId));
            renderPanel();
            refreshSharingFocus();
        };

        function refreshSharingFocus() {
            _contentItems = [
                body.querySelector('#setBackSharing'),
                ...Array.from(body.querySelectorAll('.nav-store-policy-toggle')),
                ...Array.from(body.querySelectorAll('.nav-sharing-app')),
                ...Array.from(body.querySelectorAll('.nav-sharing-mode, .nav-sharing-user, .nav-sharing-save')).filter(el => !el.disabled && el.offsetParent !== null)
            ].filter(Boolean);
            _contentItems.forEach((el, idx) => {
                el.onmouseenter = () => {
                    _topbarFocus = false;
                    _contentIdx = idx;
                    _updateContentFocus();
                };
            });
        }

        body.querySelector('#setBackSharing')?.addEventListener('click', () => {
            _settingsSubView = 'accountHub';
            _contentIdx = 0;
            _renderContent('settings');
            _updateContentFocus();
        });
        body.querySelectorAll('.nav-sharing-app').forEach(btn => {
            btn.addEventListener('click', () => selectApp(btn.dataset.appId || ''));
        });
        body.querySelectorAll('.nav-store-policy-toggle').forEach(btn => {
            btn.addEventListener('click', () => {
                const storeId = btn.dataset.storeId || '';
                const policy = btn.dataset.policy || '';
                const next = btn.dataset.active !== 'true';
                btn.dataset.active = next ? 'true' : 'false';
                btn.classList.toggle('active', next);

                if (policy === 'blocked') {
                    window._adminBlockedStoreIds = window._adminBlockedStoreIds instanceof Set
                        ? window._adminBlockedStoreIds
                        : new Set(Array.isArray(window._adminBlockedStoreIds) ? window._adminBlockedStoreIds : []);
                    if (next) window._adminBlockedStoreIds.add(storeId);
                    else window._adminBlockedStoreIds.delete(storeId);
                    window.AppStore?.mutations?.patchItem?.('stores', storeId, { adminStoreBlocked: next });
                    postToHost?.({ action: 'setAdminStorePolicy', storeId, blockedForNonAdmins: next });
                    return;
                }

                if (policy === 'steam-account') {
                    window._steamForceAccountSelection = next;
                    window.AppStore?.mutations?.patchItem?.('stores', 'Steam', { steamForceAccountSelection: next });
                    postToHost?.({ action: 'setAdminStorePolicy', storeId: 'Steam', steamForceAccountSelection: next });
                }
            });
        });

        window._doorpiUsersDataReady = () => {
            if (_settingsSubView === 'sharing' && window.isNavMenuOpen) {
                if (Date.now() < (window._doorpiSuppressSharingRefreshUntil || 0)) return;
                _renderSettingsSharing(body);
                _updateContentFocus();
            }
        };

        renderPanel();
        refreshSharingFocus();
        const focusedApp = _sharingFocusAppId ? body.querySelector(`.nav-sharing-app[data-app-id="${CSS.escape(_sharingFocusAppId)}"]`) : null;
        const idx = focusedApp ? _contentItems.indexOf(focusedApp) : 0;
        _contentIdx = idx >= 0 ? idx : 0;
    }

    function _renderSettingsSharing(body) {
        if (!document.getElementById('nav-sharing-v2-styles')) {
            const s = document.createElement('style');
            s.id = 'nav-sharing-v2-styles';
            s.textContent = `
                .nav-sharing-layout { display:grid; grid-template-columns:minmax(330px,.72fr) minmax(520px,1.28fr); gap:clamp(28px,3.5vw,58px); align-items:stretch; width:min(100%,1480px); animation:fadeInTop .3s ease; }
                .nav-sharing-apps { display:flex; flex-direction:column; gap:3px; max-height:62vh; overflow:auto; padding:3px 8px 24px 2px; scrollbar-width:none; }
                .nav-sharing-apps::-webkit-scrollbar { display:none; }
                .nav-sharing-app { display:grid; grid-template-columns:minmax(0,1fr) auto 16px; align-items:center; gap:12px; min-height:62px; padding:8px 14px; border-radius:7px; border:1px solid transparent; background:transparent; color:#fff; font:inherit; text-align:left; outline:none; cursor:pointer; }
                .nav-sharing-app::after { content:'›'; color:rgba(255,255,255,.25); font-size:1.2rem; }
                .nav-sharing-app.active { background:rgba(255,255,255,.07); border-color:rgba(255,255,255,.15); }
                .nav-sharing-app.nav-focused-el { background: rgba(255,255,255,0.14); border-color: #fff; box-shadow: 0 0 0 2px rgba(255,255,255,0.22), 0 10px 24px rgba(0,0,0,0.35); }
                .nav-sharing-app small { color: rgba(255,255,255,0.45); white-space: nowrap; }
                .nav-sharing-panel { min-height:440px; max-height:62vh; overflow:auto; display:flex; flex-direction:column; gap:14px; padding:clamp(22px,2.5vw,38px); border-left:1px solid rgba(255,255,255,.14); background:linear-gradient(90deg,rgba(255,255,255,.035),transparent 82%); scrollbar-width:none; }
                .nav-sharing-panel::-webkit-scrollbar { display:none; }
                .nav-sharing-title { margin:0; color:#fff; font-size:clamp(1.45rem,1.8vw,2.25rem); font-weight:390; }
                .nav-sharing-sub { margin:-5px 0 4px; color:rgba(255,255,255,.53); line-height:1.45; }
                .nav-sharing-question { margin:8px 0 0; color:rgba(255,255,255,.78); font-size:.76rem; font-weight:720; letter-spacing:.12em; text-transform:uppercase; }
                .nav-sharing-modes { display:grid; grid-template-columns:1fr; gap:3px; }
                .nav-sharing-mode { min-height:64px; display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:center; gap:16px; padding:10px 15px; border-radius:7px; border:1px solid transparent; background:transparent; color:#fff; font:inherit; text-align:left; outline:none; cursor:pointer; }
                .nav-sharing-mode-copy { display:grid; gap:3px; }
                .nav-sharing-mode-copy strong { color:rgba(255,255,255,.93); font-size:.96rem; font-weight:590; }
                .nav-sharing-mode-copy small { color:rgba(255,255,255,.45); font-size:.78rem; line-height:1.3; }
                .nav-sharing-mode-state { min-width:74px; color:rgba(255,255,255,.36); font-size:.72rem; font-weight:650; text-align:right; }
                .nav-sharing-mode.active { border-color:rgba(255,255,255,.2); background:rgba(255,255,255,.075); }
                .nav-sharing-mode.active .nav-sharing-mode-state { color:#fff; }
                .nav-sharing-mode.nav-focused-el { border-color: #fff; background: rgba(255,255,255,0.16); box-shadow: 0 0 0 2px rgba(255,255,255,0.2), 0 8px 20px rgba(0,0,0,0.32); }
                .nav-sharing-users { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:6px; padding-top:4px; }
                .nav-sharing-user { min-height:58px; display:grid; grid-template-columns:40px minmax(0,1fr) auto; align-items:center; gap:10px; padding:8px 12px; border-radius:7px; border:1px solid rgba(255,255,255,.09); background:rgba(255,255,255,.025); color:#fff; font:inherit; text-align:left; outline:none; cursor:pointer; }
                .nav-sharing-user::after { content:'Adicionar'; color:rgba(255,255,255,.36); font-size:.68rem; font-weight:650; }
                .nav-sharing-user.selected { border-color:rgba(255,255,255,.22); background:rgba(255,255,255,.08); }
                .nav-sharing-user.selected::after { content:'Incluído'; color:#fff; }
                .nav-sharing-user.nav-focused-el { border-color: #fff; background: rgba(255,255,255,0.14); box-shadow: 0 0 0 2px rgba(255,255,255,0.2), 0 10px 24px rgba(0,0,0,0.35); }
                .nav-sharing-avatar { width:38px; height:38px; border-radius:50%; overflow:hidden; background:rgba(255,255,255,.10); display:flex; align-items:center; justify-content:center; color:rgba(255,255,255,.65); }
                .nav-sharing-avatar img { width: 100%; height: 100%; object-fit: cover; }
                .nav-sharing-savebar { margin-top:auto; padding-top:16px; border-top:1px solid rgba(255,255,255,.1); display:flex; align-items:center; justify-content:space-between; gap:18px; }
                .nav-sharing-save { min-height:48px; min-width:180px; padding:0 22px; border-radius:7px; border:1px solid transparent; font:inherit; font-weight:700; background:#fff; color:#080812; outline:none; cursor:pointer; order:2; }
                .nav-sharing-save.nav-focused-el { background: #101018; color: #fff; border-color: #fff; box-shadow: 0 0 0 3px rgba(255,255,255,0.26), 0 10px 26px rgba(0,0,0,0.45); transform: scale(1.04); }
                .nav-sharing-save[disabled] { opacity: .45; pointer-events: none; }
                .nav-sharing-note { min-height:22px; color:rgba(255,255,255,.62); font-size:.86rem; }
                .nav-sharing-tabs { width:min(100%,1480px); display:flex; gap:26px; margin:0 0 18px; border-bottom:1px solid rgba(255,255,255,.09); }
                .nav-sharing-tab { min-height:44px; padding:0 2px; border:0; border-bottom:2px solid transparent; background:transparent; color:rgba(255,255,255,.52); font:inherit; font-weight:560; outline:none; cursor:pointer; }
                .nav-sharing-tab.active { border-bottom-color:#fff; color:#fff; }
                .nav-sharing-tab.nav-focused-el { color:#fff; text-shadow:0 0 18px rgba(255,255,255,.4); }
                .nav-sharing-panel-actions { display: flex; flex-direction: column; gap: 10px; }
                .nav-sharing-toggle { min-height: 56px; display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 12px; align-items: center; padding: 10px 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,.12); background: rgba(255,255,255,.045); color: #fff; font: inherit; text-align: left; outline: none; cursor: pointer; }
                .nav-sharing-toggle.active { border-color: rgba(120,190,255,.46); background: rgba(120,190,255,.10); }
                .nav-sharing-toggle.nav-focused-el { border-color: #fff; background: rgba(255,255,255,.15); box-shadow: 0 0 0 2px rgba(255,255,255,.18), 0 8px 20px rgba(0,0,0,.30); }
                .nav-sharing-switch { width: 42px; height: 24px; border-radius: 999px; background: rgba(255,255,255,.12); border: 1px solid rgba(255,255,255,.14); position: relative; transition: background .14s ease, border-color .14s ease; }
                .nav-sharing-toggle.active .nav-sharing-switch { background: rgba(120,190,255,.82); border-color: rgba(255,255,255,.42); }
                .nav-sharing-switch::after { content: ''; position: absolute; width: 18px; height: 18px; left: 2px; top: 2px; border-radius: 50%; background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,.35); transition: transform .14s ease; }
                .nav-sharing-toggle.active .nav-sharing-switch::after { transform: translateX(18px); }
                .nav-sharing-toggle-copy { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
                .nav-sharing-toggle-copy strong { color: rgba(255,255,255,.94); font-size: .95rem; font-weight: 650; }
                .nav-sharing-toggle-copy span { color: rgba(255,255,255,.48); font-size: .82rem; line-height: 1.28; }
            `;
            document.head.appendChild(s);
        }

        if (!Array.isArray(window._doorpiUsers) || window._doorpiUsers.length === 0) {
            if (typeof postToHost === 'function') postToHost({ action: 'requestUsersData' });
        }

        const currentUserId = _userId(_menuData.user) || _userId(window._doorpiProfile) || window._doorpiCurrentUserId || '';
        const users = (window._doorpiUsers || []).filter(u => _userId(u));
        const shareUsers = users.filter(u => !_sameId(_userId(u), currentUserId));
        const apps = (_menuData.media || []).filter(app => _isWebAccountApp(app));
        const isAdmin = !!window._doorpiIsAdmin || !!(window._doorpiProfile?.IsAdmin || window._doorpiProfile?.isAdmin);
        const tabs = isAdmin
            ? [
                { id: 'apps', label: _t('sharingTabApps', 'Streaming e mídia') },
                { id: 'stores', label: _t('sharingTabStores', 'Lojas') }
            ]
            : [{ id: 'apps', label: _t('sharingTabApps', 'Streaming e mídia') }];
        if (!tabs.some(tab => tab.id === _sharingSubView)) _sharingSubView = 'apps';

        const betaStores = [
            { id: 'Steam', name: 'Steam', steam: true },
            { id: 'Epic', name: 'Epic Games' },
            { id: 'GOG', name: 'GOG' },
            { id: 'Riot', name: 'Riot Games' },
            { id: 'Xbox', name: 'Xbox' }
        ];
        const rawBlockedStores = window._adminBlockedStoreIds instanceof Set
            ? Array.from(window._adminBlockedStoreIds)
            : (Array.isArray(window._adminBlockedStoreIds) ? window._adminBlockedStoreIds : []);
        const blockedStoreKeys = new Set(rawBlockedStores.map(id => String(id || '').trim().toLowerCase()).filter(Boolean));
        const isStoreBlocked = (id) => blockedStoreKeys.has(String(id || '').trim().toLowerCase());
        const storeStatus = (store) => {
            const blocked = isStoreBlocked(store.id);
            if (store.steam && window._steamForceAccountSelection) {
                return blocked ? _t('storePolicyStatusPrivateSteam', 'Privada + seletor') : _t('storePolicyStatusSteam', 'Seletor Steam');
            }
            return blocked ? _t('storePolicyStatusPrivate', 'Privada') : _t('storePolicyStatusOpen', 'Liberada');
        };

        let selectedAppId = _sharingFocusAppId || _appId(apps[0]) || '';
        let selectedApp = apps.find(app => _sameId(_appId(app), selectedAppId)) || apps[0] || null;
        if (selectedApp) selectedAppId = _appId(selectedApp);
        let selectedStore = betaStores.find(store => _sameId(store.id, _sharingFocusStoreId)) || betaStores[0];
        _sharingFocusStoreId = selectedStore?.id || 'Steam';

        const sharedIdsOf = (app) => {
            const ids = Array.isArray(app?.SharedWithUserIds || app?.sharedWithUserIds)
                ? (app.SharedWithUserIds || app.sharedWithUserIds)
                : [];
            const legacy = app?.SharedWithUserId || app?.sharedWithUserId || '';
            return [...ids, legacy].filter(Boolean).filter(id => !_sameId(id, currentUserId));
        };
        let draftMode = selectedApp?.ShareMode || selectedApp?.shareMode || 'private';
        let draftUsers = new Set(sharedIdsOf(selectedApp));

        const appStatus = (app) => {
            if (app.IsSharedFromOtherUser || app.isSharedFromOtherUser)
                return app.SharedFromUserName || app.sharedFromName || _t('sharedFromOther', 'Compartilhado');
            const mode = app.ShareMode || app.shareMode || 'private';
            if (mode === 'all') return _t('shareModeAll', 'Publico');
            if (mode === 'user') {
                const names = app.SharedWithUserNames || app.sharedWithUserNames || [];
                return names.length ? names.join(', ') : _t('shareModeUser', 'Usuarios');
            }
            return _t('shareModePrivate', 'Separado');
        };
        const userAvatar = (u) => (u.PhotoBase64 || u.photoBase64)
            ? `<img src="${window._doorpiUserPhotoSrc?.(u.PhotoBase64 || u.photoBase64) || `data:image/png;base64,${u.PhotoBase64 || u.photoBase64}`}" />`
            : _esc((_userName(u) || '?').charAt(0).toUpperCase());

        const listHtml = _sharingSubView === 'stores'
            ? betaStores.map(store => `<button class="nav-sharing-app ${_sameId(store.id, _sharingFocusStoreId) ? 'active' : ''}" data-store-id="${_esc(store.id)}" tabindex="-1">
                    <span>${_esc(store.name)}</span>
                    <small>${_esc(storeStatus(store))}</small>
                </button>`).join('')
            : (apps.length ? apps.map(app => {
                const id = _appId(app);
                return `<button class="nav-sharing-app ${id === selectedAppId ? 'active' : ''}" data-app-id="${_esc(id)}" tabindex="-1">
                    <span>${_esc(_appName(app))}</span>
                    <small>${_esc(appStatus(app))}</small>
                </button>`;
            }).join('') : `<div class="nav-sharing-sub">${_t('navNoMedia', 'Nenhum app configurado')}</div>`);

        body.innerHTML = `
            <div class="nav-settings-subheader">
                <button class="nav-back-btn" id="setBackSharing" tabindex="-1">< ${_t('navBack', 'Voltar')}</button>
                <h2>${_t('accountSharingLabel', 'Compartilhamento de conta')}</h2>
            </div>
            <div class="nav-sharing-tabs">
                ${tabs.map(tab => `<button class="nav-sharing-tab ${tab.id === _sharingSubView ? 'active' : ''}" data-sharing-tab="${tab.id}" tabindex="-1">${tab.label}</button>`).join('')}
            </div>
            <div class="nav-sharing-layout">
                <div class="nav-sharing-apps" id="navSharingApps">${listHtml}</div>
                <div class="nav-sharing-panel" id="navSharingPanel"></div>
            </div>`;

        const panel = body.querySelector('#navSharingPanel');

        const renderAppsPanel = () => {
            if (!panel) return;
            if (!selectedApp) {
                panel.innerHTML = `<p class="nav-sharing-sub">${_t('navNoMedia', 'Nenhum app configurado')}</p>`;
                return;
            }

            const appName = _appName(selectedApp);
            const sharedFrom = selectedApp.SharedFromUserName || selectedApp.sharedFromName || '';
            const locked = !!(selectedApp.IsSharedFromOtherUser || selectedApp.isSharedFromOtherUser);
            const selectedNames = Array.from(draftUsers)
                .map(id => _userName(users.find(u => _sameId(_userId(u), id))))
                .filter(Boolean);
            const currentText = locked
                ? _t('sharedByInfo', `Compartilhado por ${sharedFrom || _t('defaultOtherUser', 'outro usuário')}.`, sharedFrom || _t('defaultOtherUser', 'outro usuário'))
                : draftMode === 'all'
                    ? _t('shareStatusAll', 'Este app está público para todos os usuários atuais e futuros.')
                    : draftMode === 'user'
                        ? (selectedNames.length ? _t('shareStatusUser', `Compartilhado com ${selectedNames.join(', ')}.`, selectedNames.join(', ')) : _t('shareStatusUserEmpty', 'Escolha um ou mais usuários.'))
                        : _t('shareStatusPrivate', 'Este app usa uma conta separada para cada usuário.');

            panel.innerHTML = `
                <h3 class="nav-sharing-title">${_esc(appName)}</h3>
                <p class="nav-sharing-sub">${_esc(currentText)}</p>
                ${locked ? '' : `
                    <div class="nav-sharing-modes">
                        <button class="nav-sharing-mode ${draftMode === 'private' ? 'active' : ''}" data-mode="private" tabindex="-1">${_t('shareModePrivate', 'Separado por usuário')}</button>
                        <button class="nav-sharing-mode ${draftMode === 'user' ? 'active' : ''}" data-mode="user" tabindex="-1">${_t('shareModeUser', 'Usuarios especificos')}</button>
                        <button class="nav-sharing-mode ${draftMode === 'all' ? 'active' : ''}" data-mode="all" tabindex="-1">${_t('shareModeAll', 'Publico')}</button>
                    </div>
                    <div class="nav-sharing-users" style="${draftMode === 'user' ? '' : 'display:none;'}">
                        ${shareUsers.map(u => {
                            const uid = _userId(u);
                            const selected = Array.from(draftUsers).some(id => _sameId(id, uid));
                            return `<button class="nav-sharing-user ${selected ? 'selected' : ''}" data-user-id="${_esc(uid)}" tabindex="-1">
                                <span class="nav-sharing-avatar">${userAvatar(u)}</span>
                                <span>${_esc(_userName(u))}</span>
                            </button>`;
                        }).join('')}
                    </div>
                    <button class="nav-sharing-save" id="navSharingSave" tabindex="-1" ${draftMode === 'user' && draftUsers.size === 0 ? 'disabled' : ''}>${_t('editModalSave', 'Salvar')}</button>
                    <div class="nav-sharing-note" id="navSharingNote"></div>
                `}
            `;

            panel.querySelectorAll('.nav-sharing-mode').forEach(btn => {
                btn.addEventListener('click', () => {
                    draftMode = btn.dataset.mode || 'private';
                    renderAppsPanel();
                    refreshSharingFocus();
                });
            });
            panel.querySelectorAll('.nav-sharing-user').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = btn.dataset.userId || '';
                    const existing = Array.from(draftUsers).find(value => _sameId(value, id));
                    if (existing) draftUsers.delete(existing);
                    else draftUsers.add(id);
                    renderAppsPanel();
                    refreshSharingFocus();
                });
            });
            panel.querySelector('#navSharingSave')?.addEventListener('click', () => {
                if (!selectedApp) return;
                const ids = draftMode === 'user' ? Array.from(draftUsers) : [];
                if (draftMode === 'user' && ids.length === 0) return;
                selectedApp.ShareMode = draftMode;
                selectedApp.shareMode = draftMode;
                selectedApp.SharedWithUserIds = ids;
                selectedApp.sharedWithUserIds = ids;
                selectedApp.SharedWithUserNames = ids.map(id => _userName(users.find(u => _sameId(_userId(u), id)))).filter(Boolean);
                selectedApp.sharedWithUserNames = selectedApp.SharedWithUserNames;
                if (typeof postToHost === 'function') {
                    window._doorpiSuppressSharingRefreshUntil = Date.now() + 1200;
                    postToHost({ action: 'updateAppSharing', appId: selectedAppId, shareMode: draftMode, sharedWithUserIds: ids });
                }
                const activeRow = Array.from(body.querySelectorAll('.nav-sharing-app'))
                    .find(btn => _sameId(btn.dataset.appId, selectedAppId));
                const statusEl = activeRow?.querySelector('small');
                if (statusEl) statusEl.textContent = appStatus(selectedApp);
                const note = panel.querySelector('#navSharingNote');
                if (note) {
                    note.textContent = _t('navSharingSaved', 'Compartilhamento salvo.');
                    clearTimeout(note._clearTimer);
                    note._clearTimer = setTimeout(() => {
                        if (document.contains(note)) note.textContent = '';
                    }, 2200);
                }
                const saveBtn = panel.querySelector('#navSharingSave');
                if (saveBtn) {
                    const idx = _contentItems.indexOf(saveBtn);
                    if (idx >= 0) _contentIdx = idx;
                    _updateContentFocus();
                }
            });
        };

        const renderStoresPanel = () => {
            if (!panel || !selectedStore) return;
            const blocked = isStoreBlocked(selectedStore.id);
            const forceSteam = selectedStore.steam && !!window._steamForceAccountSelection;
            panel.innerHTML = `
                <h3 class="nav-sharing-title">${_esc(selectedStore.name)}</h3>
                <p class="nav-sharing-sub">${_esc(_t('storePolicyDesc', 'Controle quais lojas podem ser usadas por outras contas deste Doorpi.'))}</p>
                <div class="nav-sharing-panel-actions">
                    <button class="nav-sharing-toggle ${blocked ? 'active' : ''}" data-policy="blocked" data-store-id="${_esc(selectedStore.id)}" data-active="${blocked ? 'true' : 'false'}" tabindex="-1">
                        <span class="nav-sharing-switch" aria-hidden="true"></span>
                        <span class="nav-sharing-toggle-copy">
                            <strong>${_t('storeAdminBlockToggle', 'Privar loja para outras contas')}</strong>
                            <span>${_t('storePolicyPrivateDesc', 'Impede abrir a loja e iniciar jogos dela em outros perfis.')}</span>
                        </span>
                    </button>
                    ${selectedStore.steam ? `
                    <button class="nav-sharing-toggle ${forceSteam ? 'active' : ''}" data-policy="steam-account" data-store-id="Steam" data-active="${forceSteam ? 'true' : 'false'}" tabindex="-1">
                        <span class="nav-sharing-switch" aria-hidden="true"></span>
                        <span class="nav-sharing-toggle-copy">
                            <strong>${_t('steamForceAccountSelection', 'Forçar seleção de usuário Steam')}</strong>
                            <span>${_t('steamForceAccountSelectionDesc', 'Fecha e reabre a Steam antes de iniciar jogos para exibir o seletor de usuário.')}</span>
                        </span>
                    </button>` : ''}
                </div>`;

            panel.querySelectorAll('.nav-sharing-toggle').forEach(btn => {
                btn.addEventListener('click', () => {
                    const storeId = btn.dataset.storeId || '';
                    const policy = btn.dataset.policy || '';
                    const next = btn.dataset.active !== 'true';
                    btn.dataset.active = next ? 'true' : 'false';
                    btn.classList.toggle('active', next);

                    if (policy === 'blocked') {
                        window._adminBlockedStoreIds = window._adminBlockedStoreIds instanceof Set
                            ? window._adminBlockedStoreIds
                            : new Set(Array.isArray(window._adminBlockedStoreIds) ? window._adminBlockedStoreIds : []);
                        if (next) window._adminBlockedStoreIds.add(storeId);
                        else window._adminBlockedStoreIds.delete(storeId);
                        window.AppStore?.mutations?.patchItem?.('stores', storeId, { adminStoreBlocked: next });
                        postToHost?.({ action: 'setAdminStorePolicy', storeId, blockedForNonAdmins: next });
                    } else if (policy === 'steam-account') {
                        window._steamForceAccountSelection = next;
                        window.AppStore?.mutations?.patchItem?.('stores', 'Steam', { steamForceAccountSelection: next });
                        postToHost?.({ action: 'setAdminStorePolicy', storeId: 'Steam', steamForceAccountSelection: next });
                    }

                    const row = body.querySelector(`.nav-sharing-app[data-store-id="${CSS.escape(storeId)}"] small`);
                    const updatedStore = betaStores.find(store => _sameId(store.id, storeId));
                    if (row && updatedStore) row.textContent = storeStatus(updatedStore);
                    refreshSharingFocus();
                });
            });
        };

        const renderActivePanel = () => {
            if (_sharingSubView === 'stores') renderStoresPanel();
            else renderAppsPanel();
        };

        const selectApp = (appId) => {
            _sharingFocusAppId = appId;
            selectedApp = apps.find(app => _sameId(_appId(app), appId)) || apps[0] || null;
            selectedAppId = _appId(selectedApp);
            draftMode = selectedApp?.ShareMode || selectedApp?.shareMode || 'private';
            draftUsers = new Set(sharedIdsOf(selectedApp));
            body.querySelectorAll('.nav-sharing-app').forEach(btn => btn.classList.toggle('active', btn.dataset.appId === selectedAppId));
            renderAppsPanel();
            refreshSharingFocus();
        };

        const selectStore = (storeId) => {
            selectedStore = betaStores.find(store => _sameId(store.id, storeId)) || betaStores[0];
            _sharingFocusStoreId = selectedStore.id;
            body.querySelectorAll('.nav-sharing-app').forEach(btn => btn.classList.toggle('active', _sameId(btn.dataset.storeId, _sharingFocusStoreId)));
            renderStoresPanel();
            refreshSharingFocus();
        };

        function refreshSharingFocus() {
            _contentItems = [
                body.querySelector('#setBackSharing'),
                ...Array.from(body.querySelectorAll('.nav-sharing-tab')),
                ...Array.from(body.querySelectorAll('.nav-sharing-app')),
                ...Array.from(body.querySelectorAll('.nav-sharing-mode, .nav-sharing-user, .nav-sharing-save, .nav-sharing-toggle')).filter(el => !el.disabled && el.offsetParent !== null)
            ].filter(Boolean);
            _contentItems.forEach((el, idx) => {
                el.onmouseenter = () => {
                    _topbarFocus = false;
                    _contentIdx = idx;
                    _updateContentFocus();
                };
            });
        }

        body.querySelector('#setBackSharing')?.addEventListener('click', () => {
            _settingsSubView = 'accountHub';
            _contentIdx = 0;
            _renderContent('settings');
            _updateContentFocus();
        });
        body.querySelectorAll('.nav-sharing-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                _sharingSubView = btn.dataset.sharingTab || 'apps';
                _contentIdx = 1;
                _renderSettingsSharing(body);
                _updateContentFocus();
            });
        });
        body.querySelectorAll('.nav-sharing-app').forEach(btn => {
            btn.addEventListener('click', () => {
                if (_sharingSubView === 'stores') selectStore(btn.dataset.storeId || '');
                else selectApp(btn.dataset.appId || '');
            });
        });

        window._doorpiUsersDataReady = () => {
            if (_settingsSubView === 'sharing' && window.isNavMenuOpen) {
                if (Date.now() < (window._doorpiSuppressSharingRefreshUntil || 0)) return;
                _renderSettingsSharing(body);
                _updateContentFocus();
            }
        };

        renderActivePanel();
        refreshSharingFocus();
        const focusedSelector = _sharingSubView === 'stores'
            ? `.nav-sharing-app[data-store-id="${CSS.escape(_sharingFocusStoreId)}"]`
            : (_sharingFocusAppId ? `.nav-sharing-app[data-app-id="${CSS.escape(_sharingFocusAppId)}"]` : '');
        const focused = focusedSelector ? body.querySelector(focusedSelector) : null;
        const idx = focused ? _contentItems.indexOf(focused) : 0;
        _contentIdx = idx >= 0 ? idx : 0;
    }

    function _renderSettingsExtensions(body) {
        if (!document.getElementById('nav-ext-styles')) {
            const s = document.createElement('style');
            s.id = 'nav-ext-styles';
            s.textContent = `
                .nav-ext-hub { width:100%; min-height:calc(100% - 62px); display:grid; grid-template-rows:auto minmax(260px,1fr); gap:clamp(20px,2.3vh,32px); animation:fadeInTop .3s ease; box-sizing:border-box; }
                .nav-ext-entry-stage{min-width:0}.nav-ext-entry-grid { display:grid; grid-template-columns:minmax(520px,1fr) minmax(260px,.28fr); gap:clamp(12px,1.2vw,18px); align-items:stretch; }
                .nav-ext-entry-stage.is-inline-open .nav-ext-entry-grid{display:none}
                .nav-ext-store-card { min-width:0; min-height:clamp(126px,13.5vh,158px); padding:clamp(18px,1.7vw,28px); display:grid; grid-template-columns:auto minmax(0,1fr) auto; align-items:center; gap:clamp(16px,1.35vw,24px); color:#fff; text-align:left; font:inherit; border:1px solid rgba(255,255,255,.12); border-radius:10px; background:linear-gradient(135deg,rgba(255,255,255,.085),rgba(255,255,255,.025) 72%); outline:0; cursor:pointer; transition:transform .18s ease,border-color .18s ease,background .18s ease,box-shadow .18s ease; }
                .nav-ext-store-symbol { width:clamp(56px,4.2vw,72px); height:clamp(56px,4.2vw,72px); display:grid; place-items:center; color:rgba(255,255,255,.9); border:1px solid rgba(255,255,255,.16); border-radius:14px; background:rgba(255,255,255,.055); }
                .nav-ext-store-symbol svg { width:67%; height:67%; fill:none; stroke:currentColor; stroke-width:1.5; stroke-linecap:round; stroke-linejoin:round; }
                .nav-ext-store-copy { min-width:0; display:grid; gap:5px; }
                .nav-ext-kicker { color:rgba(255,255,255,.43); font-size:clamp(.65rem,.72vw,.78rem); font-weight:750; letter-spacing:.14em; text-transform:uppercase; }
                .nav-ext-store-copy h3 { margin:0; color:#fff; font-size:clamp(1.3rem,1.5vw,2rem); line-height:1.05; font-weight:380; letter-spacing:-.02em; }
                .nav-ext-store-copy p { max-width:650px; margin:0; color:rgba(255,255,255,.56); font-size:clamp(.82rem,.92vw,1.02rem); line-height:1.48; }
                .nav-ext-chevron { color:rgba(255,255,255,.6); font-size:clamp(1.8rem,2.3vw,3rem); font-weight:250; }
                .nav-ext-store-card.nav-focused-el { transform:translateY(-2px); border-color:#fff; background:linear-gradient(135deg,rgba(255,255,255,.16),rgba(255,255,255,.05) 76%); box-shadow:0 0 0 2px rgba(255,255,255,.13),0 24px 56px rgba(0,0,0,.28); }

                .nav-ext-manual-card { min-width:0; min-height:clamp(126px,13.5vh,158px); padding:clamp(18px,1.55vw,26px); display:grid; grid-template-columns:auto minmax(0,1fr); align-items:center; gap:15px; color:#fff; text-align:left; font:inherit; border:1px solid rgba(255,255,255,.09); border-radius:10px; background:rgba(255,255,255,.025); outline:0; cursor:pointer; transition:transform .18s ease,border-color .18s ease,background .18s ease,box-shadow .18s ease; }
                .nav-ext-manual-symbol { width:45px;height:45px;display:grid;place-items:center;color:rgba(255,255,255,.62);border:1px solid rgba(255,255,255,.1);border-radius:11px;background:rgba(255,255,255,.035) }.nav-ext-manual-symbol svg{width:25px;height:25px;fill:none;stroke:currentColor;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round}
                .nav-ext-manual-copy{min-width:0;display:grid;gap:4px}.nav-ext-manual-copy strong{font-size:clamp(.9rem,.98vw,1.08rem);font-weight:580}.nav-ext-manual-copy span{color:rgba(255,255,255,.42);font-size:clamp(.66rem,.7vw,.76rem);line-height:1.35}
                .nav-ext-manual-card.nav-focused-el{transform:translateY(-2px);border-color:#fff;background:rgba(255,255,255,.11);box-shadow:0 0 0 2px rgba(255,255,255,.12),0 18px 38px rgba(0,0,0,.24)}

                .nav-ext-link-panel { min-width:0; min-height:clamp(165px,18vh,215px); padding:clamp(20px,1.9vw,32px); display:flex; flex-direction:column; justify-content:center; gap:clamp(12px,1.35vh,18px); border-left:2px solid rgba(255,255,255,.52); background:linear-gradient(90deg,rgba(255,255,255,.052),transparent 88%); box-sizing:border-box; }
                .nav-ext-link-heading { display:flex; align-items:center; gap:15px; }
                .nav-ext-link-icon { width:42px; height:42px; flex:0 0 auto; display:grid; place-items:center; color:rgba(255,255,255,.74); }
                .nav-ext-link-icon svg { width:100%; height:100%; fill:none; stroke:currentColor; stroke-width:1.45; stroke-linecap:round; stroke-linejoin:round; }
                .nav-ext-link-copy { display:grid; gap:4px; min-width:0; }
                .nav-ext-link-copy strong { color:#fff; font-size:clamp(1rem,1.18vw,1.35rem); font-weight:570; }
                .nav-ext-link-copy span { color:rgba(255,255,255,.44); font-size:clamp(.72rem,.78vw,.86rem); line-height:1.4; }
                .nav-ext-url { width:100%; min-height:clamp(48px,5.4vh,62px); padding:0 18px; box-sizing:border-box; color:#fff; background:rgba(0,0,0,.2); border:1px solid rgba(255,255,255,.12); border-radius:8px; font:inherit; font-size:clamp(.82rem,.9vw,1rem); outline:0; text-overflow:ellipsis; }
                .nav-ext-url::placeholder { color:rgba(255,255,255,.32); }
                .nav-ext-url.nav-focused-el { border-color:#fff; background:rgba(255,255,255,.07); box-shadow:0 0 0 2px rgba(255,255,255,.12); }
                .nav-ext-link-actions { display:grid; grid-template-columns:minmax(100px,.62fr) minmax(150px,1fr); gap:9px; }
                .nav-ext-action { min-height:clamp(42px,4.7vh,54px); padding:0 16px; border:1px solid rgba(255,255,255,.13); border-radius:8px; background:rgba(255,255,255,.045); color:#fff; font:inherit; font-size:clamp(.78rem,.84vw,.94rem); font-weight:570; outline:0; cursor:pointer; }
                .nav-ext-action.primary { color:#090b12; background:#fff; border-color:#fff; font-weight:720; }
                .nav-ext-action.nav-focused-el { border-color:#fff; background:rgba(255,255,255,.16); box-shadow:0 0 0 2px rgba(255,255,255,.13),0 12px 26px rgba(0,0,0,.28); transform:translateY(-1px); }
                .nav-ext-action.primary.nav-focused-el { color:#090b12; background:#fff; box-shadow:0 0 0 3px rgba(255,255,255,.22),0 14px 28px rgba(0,0,0,.3); }

                .nav-ext-library { min-height:0; display:flex; flex-direction:column; gap:13px; }
                .nav-ext-library-heading { display:flex; align-items:flex-end; justify-content:space-between; gap:24px; padding-bottom:11px; border-bottom:1px solid rgba(255,255,255,.1); }
                .nav-ext-library-title { display:grid; gap:3px; }
                .nav-ext-library-title h3 { margin:0; color:#fff; font-size:clamp(1.1rem,1.35vw,1.55rem); font-weight:430; }
                .nav-ext-status { min-height:18px; margin:0; color:rgba(255,255,255,.44); font-size:clamp(.7rem,.76vw,.84rem); line-height:1.35; }
                .nav-ext-status.error { color:#f1a5a5; }
                .nav-ext-count { color:rgba(255,255,255,.42); font-size:clamp(.7rem,.76vw,.84rem); white-space:nowrap; }
                .nav-ext-list { min-height:0; display:grid; grid-template-columns:repeat(auto-fit,minmax(360px,1fr)); gap:clamp(12px,1.15vw,18px); align-content:start; overflow:auto; scrollbar-width:none; padding:3px 4px 22px; }
                .nav-ext-list::-webkit-scrollbar { display:none; }
                .nav-ext-card { min-width:0; min-height:clamp(138px,16vh,190px); padding:clamp(18px,1.65vw,28px); display:flex; flex-direction:column; justify-content:space-between; gap:20px; border:1px solid rgba(255,255,255,.09); border-radius:10px; background:linear-gradient(145deg,rgba(255,255,255,.052),rgba(255,255,255,.018)); box-sizing:border-box; }
                .nav-ext-card-main { min-width:0; display:grid; grid-template-columns:auto minmax(0,1fr); gap:clamp(16px,1.4vw,24px); align-items:center; }
                .nav-ext-icon { width:clamp(56px,4.6vw,78px); height:clamp(56px,4.6vw,78px); display:grid; place-items:center; flex:0 0 auto; border-radius:14px; background:rgba(255,255,255,.065); border:1px solid rgba(255,255,255,.1); overflow:hidden; }
                .nav-ext-icon img { width:76%; height:76%; object-fit:contain; }
                .nav-ext-icon svg { width:52%; height:52%; fill:none; stroke:rgba(255,255,255,.72); stroke-width:1.45; stroke-linecap:round; stroke-linejoin:round; }
                .nav-ext-info { min-width:0; display:grid; gap:5px; }
                .nav-ext-info strong { color:#fff; font-size:clamp(.95rem,1.06vw,1.2rem); font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
                .nav-ext-info p { min-height:2.65em; margin:0; color:rgba(255,255,255,.45); font-size:clamp(.7rem,.76vw,.84rem); line-height:1.34; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
                .nav-ext-meta { display:flex; align-items:center; flex-wrap:wrap; gap:8px 12px; color:rgba(255,255,255,.42); font-size:clamp(.66rem,.72vw,.8rem); }
                .nav-ext-update-label { padding:4px 8px; color:#f0d89e; border:1px solid rgba(240,216,158,.26); border-radius:4px; background:rgba(240,216,158,.07); font-weight:650; }
                .nav-ext-card-footer { display:flex; align-items:center; justify-content:flex-end; gap:8px; padding-top:13px; border-top:1px solid rgba(255,255,255,.075); }
                .nav-ext-btn { min-height:37px; padding:0 14px; border:1px solid rgba(255,255,255,.12); border-radius:7px; background:rgba(255,255,255,.045); color:rgba(255,255,255,.82); font:inherit; font-size:clamp(.7rem,.76vw,.84rem); font-weight:600; outline:0; cursor:pointer; }
                .nav-ext-btn.primary { color:#080a10; background:#fff; border-color:#fff; }
                .nav-ext-btn.danger { color:#eeb1b1; border-color:rgba(238,177,177,.2); background:transparent; }
                .nav-ext-btn.nav-focused-el { color:#fff; border-color:#fff; background:rgba(255,255,255,.15); box-shadow:0 0 0 2px rgba(255,255,255,.12),0 10px 24px rgba(0,0,0,.26); transform:translateY(-1px); }
                .nav-ext-btn.primary.nav-focused-el { color:#080a10; background:#fff; }
                .nav-ext-btn.danger.nav-focused-el { color:#fff; background:rgba(176,70,70,.34); border-color:rgba(255,205,205,.8); }
                .nav-ext-empty { grid-column:1/-1; min-height:170px; display:grid; place-items:center; text-align:center; color:rgba(255,255,255,.4); border:1px dashed rgba(255,255,255,.12); border-radius:10px; background:rgba(255,255,255,.018); }
                .nav-ext-empty div { display:grid; gap:5px; }.nav-ext-empty strong{color:rgba(255,255,255,.72);font-size:1rem}.nav-ext-empty span{font-size:.8rem}

                .nav-ext-dialog{display:none;width:100%;min-height:clamp(126px,13.5vh,166px);box-sizing:border-box}.nav-ext-dialog.visible{display:block}
                .nav-ext-dialog-panel{width:100%;min-height:inherit;padding:clamp(18px,1.7vw,28px);display:grid;grid-template-columns:minmax(240px,.38fr) minmax(0,1fr);gap:clamp(22px,2.2vw,38px);align-items:center;border:1px solid rgba(255,255,255,.13);border-radius:10px;background:linear-gradient(135deg,rgba(255,255,255,.09),rgba(255,255,255,.025) 74%);box-sizing:border-box}
                .nav-ext-dialog-head{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:14px;align-items:start}.nav-ext-dialog-title{display:grid;gap:5px}.nav-ext-dialog-title h3{margin:0;color:#fff;font-size:clamp(1.15rem,1.45vw,1.8rem);font-weight:420}.nav-ext-dialog-title p{margin:0;color:rgba(255,255,255,.48);font-size:.78rem;line-height:1.42}.nav-ext-dialog-close{min-width:90px;min-height:39px;padding:0 13px;border:1px solid rgba(255,255,255,.13);border-radius:7px;background:rgba(255,255,255,.045);color:#fff;font:inherit;font-size:.75rem;outline:0;cursor:pointer}
                .nav-ext-dialog-entry{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center}.nav-ext-dialog-entry-actions{display:grid;grid-template-columns:120px 135px;gap:8px}.nav-ext-dialog-hint{grid-column:1/-1;color:rgba(255,255,255,.4);font-size:.69rem;line-height:1.35}
                .nav-ext-candidate{display:none;grid-column:1/-1;grid-template-columns:clamp(76px,6.5vw,104px) minmax(0,1fr);gap:clamp(18px,1.7vw,28px);align-items:center}.nav-ext-dialog.has-candidate .nav-ext-dialog-head,.nav-ext-dialog.has-candidate .nav-ext-dialog-entry{display:none}.nav-ext-dialog.has-candidate .nav-ext-candidate{display:grid}
                .nav-ext-candidate-art{width:clamp(76px,6.5vw,104px);aspect-ratio:1;display:grid;place-items:center;overflow:hidden;border:1px solid rgba(255,255,255,.13);border-radius:18px;background:rgba(255,255,255,.055)}.nav-ext-candidate-art img{width:82%;height:82%;object-fit:contain}.nav-ext-candidate-art svg{width:46px;height:46px;fill:none;stroke:rgba(255,255,255,.65);stroke-width:1.45;stroke-linecap:round;stroke-linejoin:round}
                .nav-ext-candidate-copy{min-width:0;display:grid;grid-template-columns:minmax(0,1fr) auto;column-gap:24px;row-gap:5px;align-items:center}.nav-ext-candidate-copy>.nav-ext-kicker,.nav-ext-candidate-copy>h4,.nav-ext-candidate-copy>p,.nav-ext-candidate-copy>.nav-ext-candidate-source{grid-column:1}.nav-ext-candidate-copy h4{margin:0;color:#fff;font-size:clamp(1.15rem,1.42vw,1.65rem);font-weight:570;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.nav-ext-candidate-copy p{margin:0;color:rgba(255,255,255,.5);font-size:.78rem;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.nav-ext-candidate-source{color:rgba(255,255,255,.34);font-size:.66rem}.nav-ext-candidate-actions{grid-column:2;grid-row:1/5;display:flex;gap:8px;align-self:center}.nav-ext-candidate-actions .nav-ext-action{min-width:132px}
                .nav-ext-dialog :is(.nav-ext-dialog-close,.nav-ext-url,.nav-ext-action).nav-focused-el{border-color:#fff;box-shadow:0 0 0 2px rgba(255,255,255,.13),0 12px 28px rgba(0,0,0,.3)}
                @media(max-width:1100px){.nav-ext-entry-grid{grid-template-columns:minmax(0,1fr) minmax(240px,.38fr)}.nav-ext-list{grid-template-columns:1fr}}
                @media(max-height:800px){.nav-ext-hub{gap:14px}.nav-ext-store-card,.nav-ext-manual-card,.nav-ext-dialog{min-height:108px}.nav-ext-store-card,.nav-ext-manual-card,.nav-ext-dialog-panel{padding:14px 19px}.nav-ext-store-symbol{width:52px;height:52px}.nav-ext-card{min-height:125px;padding:15px 18px;gap:13px}.nav-ext-icon{width:48px;height:48px}.nav-ext-card-footer{padding-top:9px}}
            `;
            document.head.appendChild(s);
        }

        body.innerHTML = `
            <div class="nav-settings-subheader">
                <button class="nav-back-btn" id="setBackExt" tabindex="-1">‹ ${_t('navBack', 'Voltar')}</button>
                <h2>${_t('extManagerTitle', 'Extensões')}</h2>
            </div>
            <main class="nav-ext-hub">
                <div class="nav-ext-entry-stage" id="navExtEntryStage">
                    <div class="nav-ext-entry-grid">
                        <button class="nav-ext-store-card" id="navExtStoreBtn" tabindex="-1">
                            <span class="nav-ext-store-symbol" aria-hidden="true">
                                <svg viewBox="0 0 64 64">
                                    <path d="M13 25h38l-3.8-11H16.8L13 25Z"/>
                                    <path d="M16 25v27h32V25M24 52V39h16v13"/>
                                    <path d="M20 25v3.5a4 4 0 0 0 8 0V25m0 0v3.5a4 4 0 0 0 8 0V25m0 0v3.5a4 4 0 0 0 8 0V25"/>
                                    <path d="M24 14c.7-4 3.3-6 8-6s7.3 2 8 6"/>
                                </svg>
                            </span>
                            <span class="nav-ext-store-copy">
                                <span class="nav-ext-kicker">Catálogo</span>
                                <h3>Explorar loja</h3>
                                <p>Encontre recursos compatíveis e envie a instalação diretamente para o Doorpi.</p>
                            </span>
                            <span class="nav-ext-chevron" aria-hidden="true">›</span>
                        </button>

                        <button class="nav-ext-manual-card" id="navExtManualBtn" tabindex="-1">
                            <span class="nav-ext-manual-symbol" aria-hidden="true"><svg viewBox="0 0 48 48"><path d="M19.5 29.5 28.8 20a6.5 6.5 0 0 1 9.2 9.2l-7.1 7.1a6.5 6.5 0 0 1-9.2 0"/><path d="m28.5 18.5-9.3 9.5a6.5 6.5 0 0 1-9.2-9.2l7.1-7.1a6.5 6.5 0 0 1 9.2 0"/></svg></span>
                            <span class="nav-ext-manual-copy"><span class="nav-ext-kicker">Outra origem</span><strong>Instalar por link</strong><span>Opção manual para links compatíveis.</span></span>
                        </button>
                    </div>

                    <section class="nav-ext-dialog" id="navExtDialog" aria-hidden="true" aria-labelledby="navExtDialogTitle">
                        <div class="nav-ext-dialog-panel">
                            <header class="nav-ext-dialog-head">
                                <span class="nav-ext-dialog-title"><span class="nav-ext-kicker">Instalação manual</span><h3 id="navExtDialogTitle">Adicionar extensão</h3><p id="navExtDialogDescription">Cole um link compatível da Chrome Web Store.</p></span>
                                <button class="nav-ext-dialog-close" id="navExtDialogClose" tabindex="-1">Cancelar</button>
                            </header>
                            <div class="nav-ext-dialog-entry">
                                <input class="nav-ext-url" id="navExtUrlInput" readonly placeholder="${_t('extManagerInputPlaceholder', 'Cole o link da extensão aqui...')}" tabindex="-1" />
                                <div class="nav-ext-dialog-entry-actions">
                                    <button class="nav-ext-action" id="navExtPasteBtn" tabindex="-1">${_t('btnPaste', 'Colar link')}</button>
                                    <button class="nav-ext-action primary" id="navExtReviewBtn" tabindex="-1">Continuar</button>
                                </div>
                                <span class="nav-ext-dialog-hint">O Doorpi valida o endereço antes de iniciar a instalação.</span>
                            </div>
                            <div class="nav-ext-candidate">
                                <div class="nav-ext-candidate-art" id="navExtCandidateArt"></div>
                                <div class="nav-ext-candidate-copy">
                                    <span class="nav-ext-kicker">Pronta para instalar</span>
                                    <h4 id="navExtCandidateName">Extensão selecionada</h4>
                                    <p id="navExtCandidateDescription">Confirme para adicionar este recurso ao navegador do Doorpi.</p>
                                    <span class="nav-ext-candidate-source" id="navExtCandidateSource"></span>
                                    <div class="nav-ext-candidate-actions">
                                        <button class="nav-ext-action" id="navExtCandidateBack" tabindex="-1">Cancelar</button>
                                        <button class="nav-ext-action primary" id="navExtInstallBtn" tabindex="-1">${_t('btnInstall', 'Instalar extensão')}</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>
                </div>

                <section class="nav-ext-library">
                    <header class="nav-ext-library-heading">
                        <span class="nav-ext-library-title">
                            <h3>Instaladas</h3>
                            <span class="nav-ext-status" id="navExtensionStatus">${_t('loadingExtensions', 'Carregando extensões...')}</span>
                        </span>
                        <span class="nav-ext-count" id="navExtensionCount"></span>
                    </header>
                    <div class="nav-ext-list" id="navExtensionsList"></div>
                </section>
            </main>`;

        _contentItems = [
            body.querySelector('#setBackExt'),
            body.querySelector('#navExtStoreBtn'),
            body.querySelector('#navExtManualBtn')
        ].filter(Boolean);

        body.querySelector('#setBackExt')?.addEventListener('click', () => {
            _settingsSubView = null;
            _contentIdx = 0;
            document.activeElement?.blur();
            requestAnimationFrame(() => {
                _renderContent('settings');
                _updateContentFocus();
            });
        });

        const dialog = body.querySelector('#navExtDialog');
        const entryStage = body.querySelector('#navExtEntryStage');
        const urlInput = body.querySelector('#navExtUrlInput');
        const dialogDescription = body.querySelector('#navExtDialogDescription');
        let extensionCandidate = null;
        let extensionReturnIndex = 2;
        const candidateFallbackIcon = `
            <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M18 9h8v6.2a4.8 4.8 0 1 0 6 0V9h7v10h-5.2a4.8 4.8 0 1 0 0 6H39v14H25v-5.2a4.8 4.8 0 1 0-6 0V39H9V25h5.2a4.8 4.8 0 1 0 0-6H9V9h9Z"/></svg>`;

        const bindExtensionHover = items => items.forEach((element, index) => {
            if (!element || element.dataset.navExtHoverBound === 'true') return;
            element.dataset.navExtHoverBound = 'true';
            element.addEventListener('mouseenter', () => {
                _topbarFocus = false;
                const currentIndex = _contentItems.indexOf(element);
                _contentIdx = currentIndex >= 0 ? currentIndex : index;
                _updateContentFocus();
            });
        });

        const extensionBaseItems = () => [
            body.querySelector('#setBackExt'),
            body.querySelector('#navExtStoreBtn'),
            body.querySelector('#navExtManualBtn'),
            ...body.querySelectorAll('#navExtensionsList .nav-ext-btn')
        ].filter(Boolean);

        const setExtensionItems = (items, preferred = 0) => {
            _contentItems = items.filter(Boolean);
            _contentIdx = Math.max(0, Math.min(preferred, _contentItems.length - 1));
            bindExtensionHover(_contentItems);
            _updateContentFocus();
        };

        const showExtensionEntry = (focusInput = true, message = '') => {
            extensionCandidate = null;
            dialog?.classList.remove('has-candidate');
            if (dialogDescription) dialogDescription.textContent = message || 'Cole um link compatível da Chrome Web Store.';
            setExtensionItems([
                body.querySelector('#navExtDialogClose'),
                urlInput,
                body.querySelector('#navExtPasteBtn'),
                body.querySelector('#navExtReviewBtn')
            ], focusInput ? 1 : 0);
        };

        const openExtensionDialog = () => {
            if (!dialog) return;
            extensionReturnIndex = 2;
            entryStage?.classList.add('is-inline-open');
            dialog.classList.add('visible');
            dialog.setAttribute('aria-hidden', 'false');
            showExtensionEntry(true);
        };

        const closeExtensionDialog = () => {
            if (!dialog) return;
            entryStage?.classList.remove('is-inline-open');
            dialog.classList.remove('visible', 'has-candidate');
            dialog.setAttribute('aria-hidden', 'true');
            extensionCandidate = null;
            setExtensionItems(extensionBaseItems(), extensionReturnIndex);
        };

        const showExtensionCandidate = data => {
            const url = String(data?.url || urlInput?.value || '').trim();
            const extensionId = url.match(/[a-p]{32}/i)?.[0] || '';
            if (!url || !extensionId) {
                if (!dialog?.classList.contains('visible')) openExtensionDialog();
                showExtensionEntry(true, 'Esse endereço não corresponde a uma extensão válida da Chrome Web Store.');
                return false;
            }

            const rawName = String(data?.name || '').trim();
            const genericName = !rawName || /^chrome web store(?:\s*[-|].*)?$/i.test(rawName) ||
                /^(extensões|extensions)$/i.test(rawName);
            const pathParts = (() => {
                try { return new URL(url).pathname.split('/').filter(Boolean); }
                catch { return []; }
            })();
            const idIndex = pathParts.findIndex(part => part.toLocaleLowerCase() === extensionId.toLocaleLowerCase());
            const slugName = idIndex > 0
                ? decodeURIComponent(pathParts[idIndex - 1]).replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim()
                : '';
            const resolvedName = genericName
                ? (slugName.replace(/\b\p{L}/gu, letter => letter.toLocaleUpperCase()) || 'Extensão selecionada')
                : rawName;

            extensionCandidate = {
                url,
                name: resolvedName,
                description: String(data?.description || 'Confirme para adicionar este recurso ao navegador do Doorpi.').trim(),
                imageUrl: String(data?.imageUrl || '').trim()
            };
            extensionReturnIndex = data?.name || data?.imageUrl ? 1 : 2;
            if (urlInput) urlInput.value = url;
            if (!dialog?.classList.contains('visible')) {
                entryStage?.classList.add('is-inline-open');
                dialog?.classList.add('visible');
                dialog?.setAttribute('aria-hidden', 'false');
            }
            dialog?.classList.add('has-candidate');
            const art = body.querySelector('#navExtCandidateArt');
            const safeImage = /^(https?:\/\/|data:image\/)/i.test(extensionCandidate.imageUrl) ? extensionCandidate.imageUrl : '';
            if (art) {
                art.innerHTML = safeImage ? `<img src="${_esc(safeImage)}" alt="" />` : candidateFallbackIcon;
                art.querySelector('img')?.addEventListener('error', () => { art.innerHTML = candidateFallbackIcon; }, { once: true });
            }
            const name = body.querySelector('#navExtCandidateName');
            const description = body.querySelector('#navExtCandidateDescription');
            const source = body.querySelector('#navExtCandidateSource');
            if (name) name.textContent = extensionCandidate.name;
            if (description) description.textContent = extensionCandidate.description;
            if (source) source.textContent = `Chrome Web Store · ${extensionId}`;
            setExtensionItems([
                body.querySelector('#navExtCandidateBack'),
                body.querySelector('#navExtInstallBtn')
            ], 1);
            return true;
        };

        window._showNavExtensionInstallCandidate = showExtensionCandidate;
        window._closeNavExtensionInline = () => {
            if (!dialog?.classList.contains('visible')) return false;
            closeExtensionDialog();
            return true;
        };

        body.querySelector('#navExtManualBtn')?.addEventListener('click', openExtensionDialog);
        body.querySelector('#navExtDialogClose')?.addEventListener('click', closeExtensionDialog);
        body.querySelector('#navExtCandidateBack')?.addEventListener('click', closeExtensionDialog);
        body.querySelector('#navExtPasteBtn')?.addEventListener('click', () => {
            window._isPastingExtensionUrl = true;
            if (typeof postToHost === 'function') postToHost({ action: 'readClipboard' });
        });
        body.querySelector('#navExtReviewBtn')?.addEventListener('click', () => showExtensionCandidate({ url: urlInput?.value }));

        body.querySelector('#navExtStoreBtn')?.addEventListener('click', () => {
            if (typeof postToHost === 'function') {
                postToHost({
                    action: 'openExtensionStore',
                    extBtnTitle: _t('extStoreAddBtn'),
                    extBtnSub: _t('extStoreAddSub'),
                    toastTitle: _t('toastDoorpi'),
                    toastSub: _t('toastExtSent'),
                    extInstalledTitle: _t('extAlreadyInstalledBtn'),
                    extInstalledSub: _t('extAlreadyInstalledSub')
                });
            }
        });

        urlInput?.addEventListener('click', event => {
            urlInput.removeAttribute('readonly');
            if (!window._doorpiShouldOpenVkbFromEvent?.(event)) return;
            window._vkbOpen?.(urlInput, {
                onOk: () => {
                    urlInput.setAttribute('readonly', '');
                    window._vkbForceClose?.();
                    requestAnimationFrame(() => showExtensionCandidate({ url: urlInput.value }));
                },
                onCancel: () => {
                    urlInput.setAttribute('readonly', '');
                    window._vkbForceClose?.();
                }
            });
        });

        body.querySelector('#navExtInstallBtn')?.addEventListener('click', () => {
            const url = extensionCandidate?.url || urlInput?.value.trim();
            const status = document.getElementById('navExtensionStatus');
            if (!url) {
                if (status) { status.textContent = _t('extPasteLinkError', 'Insira um link válido.'); status.className = 'nav-ext-status error'; }
                return;
            }
            if (status) { status.textContent = _t('extInstallingStatus', 'Instalando...'); status.className = 'nav-ext-status'; }
            closeExtensionDialog();
            if (typeof postToHost === 'function') postToHost({ action: 'installExtension', url, successMsg: _t('extInstallSuccess', 'Extensão Instalada') });
        });

        window._renderNavExtensionsList = function (extensions, statusClass, message, updates) {
            const listEl = document.getElementById('navExtensionsList');
            const statusEl = document.getElementById('navExtensionStatus');
            const countEl = document.getElementById('navExtensionCount');
            if (!listEl) return;
            extensions = Array.isArray(extensions) ? extensions : [];
            updates = updates || {};

            if (statusEl) {
                statusEl.textContent = message || (extensions.length
                    ? 'Recursos adicionais disponíveis no navegador do Doorpi.'
                    : _t('extNoneInstalled', 'Nenhuma extensão instalada.'));
                statusEl.className = `nav-ext-status ${statusClass || ''}`.trim();
            }
            if (countEl) countEl.textContent = extensions.length === 1 ? '1 extensão' : `${extensions.length} extensões`;

            const fallbackIcon = `
                <svg viewBox="0 0 48 48" aria-hidden="true">
                    <path d="M18 9h8v6.2a4.8 4.8 0 1 0 6 0V9h7v10h-5.2a4.8 4.8 0 1 0 0 6H39v14H25v-5.2a4.8 4.8 0 1 0-6 0V39H9V25h5.2a4.8 4.8 0 1 0 0-6H9V9h9Z"/>
                </svg>`;

            listEl.innerHTML = extensions.length ? extensions.map(ext => {
                const updateVersion = updates[ext.Id];
                const hasUpdate = !!updateVersion;
                const id = _esc(ext.Id || '');
                const name = _esc(ext.Name || _t('extUnknown', 'Extensão'));
                const version = _esc(ext.Version || '—');
                const description = _esc(ext.Description || 'Recurso adicional instalado no navegador do Doorpi.');
                const iconData = String(ext.IconDataUrl || '');
                const icon = /^data:image\/[a-z0-9.+-]+;base64,/i.test(iconData)
                    ? `<img src="${_esc(iconData)}" alt="" />`
                    : fallbackIcon;

                return `
                <article class="nav-ext-card">
                    <div class="nav-ext-card-main">
                        <span class="nav-ext-icon">${icon}</span>
                        <div class="nav-ext-info">
                            <strong>${name}</strong>
                            <p>${description}</p>
                            <div class="nav-ext-meta">
                                <span>${_t('extInstalled', 'Instalada')} · v${version}</span>
                                ${hasUpdate ? `<span class="nav-ext-update-label">Atualização v${_esc(updateVersion)}</span>` : ''}
                            </div>
                        </div>
                    </div>
                    <div class="nav-ext-card-footer">
                        ${hasUpdate ? `
                        <button class="nav-ext-btn primary" data-action="update" data-id="${id}" tabindex="-1" title="${_t('btnUpdate', 'Atualizar')}">
                            ${_t('btnUpdate', 'Atualizar')}
                        </button>` : ''}
                        <button class="nav-ext-btn danger" data-action="delete" data-id="${id}" tabindex="-1" title="${_t('btnRemove', 'Remover')}">
                            ${_t('btnRemove', 'Remover')}
                        </button>
                    </div>
                </article>`;
            }).join('') : `
                <div class="nav-ext-empty">
                    <div><strong>Sua biblioteca está vazia</strong><span>Abra a loja ou instale uma extensão por link.</span></div>
                </div>`;

            listEl.querySelectorAll('.nav-ext-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const action = btn.dataset.action;
                    const id = btn.dataset.id;
                    if (action === 'update') window._doorpiUpdateExtension(id);
                    if (action === 'delete') window._doorpiDeleteExtension(id);
                });
            });

            _contentItems = extensionBaseItems();
            bindExtensionHover(_contentItems);

            _contentIdx = Math.min(_contentIdx, Math.max(0, _contentItems.length - 1));
            _updateContentFocus();
        };

        if (typeof postToHost === 'function') postToHost({ action: 'requestExtensions' });

        bindExtensionHover(_contentItems);
    }

    // ── Foco ──────────────────────────────────────────────────────────────────
    function _libraryCardKey(card) {
        return card?.dataset?.gameId || card?.dataset?.appId || card?.dataset?.path || '';
    }

    function _rememberLibraryCard(catId, card, cardIdx) {
        const memory = _libraryFocusMemory[catId];
        if (!memory || !card?.classList?.contains('nav-vertical-card')) return;
        memory.key = _libraryCardKey(card);
        memory.index = Math.max(0, Number(cardIdx) || 0);
    }

    function _rememberedLibraryContentIndex(catId, actionCount, cards) {
        const memory = _libraryFocusMemory[catId];
        if (!memory || !cards?.length) return actionCount;
        let cardIdx = memory.key
            ? cards.findIndex(card => _libraryCardKey(card) === memory.key)
            : -1;
        if (cardIdx < 0) cardIdx = Math.min(memory.index, cards.length - 1);
        return actionCount + Math.max(0, cardIdx);
    }

    function _activeLibraryCard() {
        if (_topbarFocus || !_isLazyCat()) return null;
        const card = _contentItems[_contentIdx];
        return card?.classList?.contains('nav-vertical-card') ? card : null;
    }

    function _stopRapidLibraryScrollAnimation() {
        if (_libraryRapidScrollRaf) cancelAnimationFrame(_libraryRapidScrollRaf);
        _libraryRapidScrollRaf = 0;
        _libraryRapidScrollPane = null;
        _libraryRapidScrollTarget = 0;
    }

    function _animateRapidLibraryScroll(pane, targetTop) {
        if (!pane) return;
        const maxTop = Math.max(0, pane.scrollHeight - pane.clientHeight);
        const nextTarget = Math.max(0, Math.min(maxTop, targetTop));

        if (_libraryRapidScrollPane !== pane) {
            _stopRapidLibraryScrollAnimation();
            _libraryRapidScrollPane = pane;
        }
        _libraryRapidScrollTarget = nextTarget;
        if (_libraryRapidScrollRaf) return;

        const step = () => {
            const activePane = _libraryRapidScrollPane;
            if (!activePane || !_libraryRapidNavigation) {
                _stopRapidLibraryScrollAnimation();
                return;
            }

            const distance = _libraryRapidScrollTarget - activePane.scrollTop;
            if (Math.abs(distance) <= 0.7) {
                activePane.scrollTop = _libraryRapidScrollTarget;
                _libraryRapidScrollRaf = 0;
                return;
            }

            // Um único movimento segue o alvo mais recente. O fator alto mantém
            // resposta imediata sem os saltos do scroll instantâneo.
            activePane.scrollTop += distance * 0.38;
            _libraryRapidScrollRaf = requestAnimationFrame(step);
        };

        _libraryRapidScrollRaf = requestAnimationFrame(step);
    }

    function _cancelLibraryScrollAnimation() {
        const pane = _libraryPane(CATS[_catIdx]?.id);
        if (!pane) return;
        _stopRapidLibraryScrollAnimation();
        pane.classList.add('nav-rapid-navigation');
        pane.scrollTo({ top: pane.scrollTop, behavior: 'auto' });
    }

    function _settleLibraryScroll() {
        const card = _activeLibraryCard();
        const pane = card?.closest?.('#navPaneGames, #navPaneMedia');
        if (!card || !pane) return;
        const paneRect = pane.getBoundingClientRect();
        const cardRect = card.getBoundingClientRect();
        const centeredTop = pane.scrollTop + (cardRect.top - paneRect.top)
            - ((paneRect.height - cardRect.height) / 2);
        const maxTop = Math.max(0, pane.scrollHeight - pane.clientHeight);
        pane.scrollTo({ top: Math.max(0, Math.min(maxTop, centeredTop)), behavior: 'smooth' });
    }

    function _stopLibraryDirectionHold({ settle = true } = {}) {
        if (_libraryHoldRaf) cancelAnimationFrame(_libraryHoldRaf);
        _libraryHoldRaf = 0;
        const wasRapid = _libraryRapidNavigation;
        _libraryHoldDirection = '';
        _libraryHoldStartedAt = 0;
        _libraryHoldSawNativeInput = false;
        _libraryRapidNavigation = false;
        _stopRapidLibraryScrollAnimation();
        document.querySelectorAll('.nav-library-pane.nav-rapid-navigation')
            .forEach(pane => pane.classList.remove('nav-rapid-navigation'));
        if (settle && wasRapid) requestAnimationFrame(_settleLibraryScroll);
    }

    function _trackLibraryDirectionHold(key) {
        const direction = {
            ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT'
        }[key];
        if (!direction || !_isLazyCat()) return;
        if (_libraryHoldDirection === direction && _libraryHoldRaf) return;

        _stopLibraryDirectionHold({ settle: false });
        _libraryHoldDirection = direction;
        _libraryHoldStartedAt = performance.now();

        const poll = () => {
            if (!window.isNavMenuOpen || !_isLazyCat() || _libraryHoldDirection !== direction) {
                _stopLibraryDirectionHold();
                return;
            }

            const elapsed = performance.now() - _libraryHoldStartedAt;
            const held = window.isDoorpiNativeDirectionHeld?.(direction) === true;
            if (held) _libraryHoldSawNativeInput = true;

            if (held) {
                if (!_libraryRapidNavigation && elapsed >= 120) {
                    _libraryRapidNavigation = true;
                    _cancelLibraryScrollAnimation();
                }
                _libraryHoldRaf = requestAnimationFrame(poll);
                return;
            }

            // O snapshot nativo pode chegar alguns frames depois do primeiro
            // evento de teclado sintetizado pelo controle.
            if (!_libraryHoldSawNativeInput && elapsed < 110) {
                _libraryHoldRaf = requestAnimationFrame(poll);
                return;
            }
            _stopLibraryDirectionHold();
        };

        _libraryHoldRaf = requestAnimationFrame(poll);
    }

    function _setTopbarFocus(val) {
        _topbarFocus = val;
        _updateTopbarFocusVisual();
        _updateContentFocus();
    }

    function _updateTopbarFocusVisual() {
        document.querySelectorAll('.nav-cat-item').forEach((el, i) => {
            el.classList.toggle('nav-focused', _topbarFocus && i === _catIdx);
        });
    }

    function _revealInsideScrollContainer(element, container, edge = 12) {
        if (!element || !container) return;

        const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight);
        if (maxScroll <= 1) {
            // Evita preservar um deslocamento residual criado pelo navegador quando
            // todo o conteudo ja cabe no painel.
            if (container.scrollTop !== 0) container.scrollTop = 0;
            return;
        }

        const itemRect = element.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        let delta = 0;
        if (itemRect.top < containerRect.top + edge)
            delta = itemRect.top - containerRect.top - edge;
        else if (itemRect.bottom > containerRect.bottom - edge)
            delta = itemRect.bottom - containerRect.bottom + edge;

        if (Math.abs(delta) > 0.5)
            container.scrollBy({ top: delta, behavior: 'smooth' });
    }

    function _updateContentFocus() {
        if (_topbarFocus) {
   
            const _lg = _currentLazyGrid();
            if (_isLazyCat() && _lg) {
                for (const card of _lg._cards) {
                    if (card && card.classList.contains('nav-focused')) {
                        card.classList.remove('nav-focused');
                        card._stopInteraction?.();
                    }
                }
            }
            // Remove o foco dos botões de settings e profile
            _contentItems.forEach(el => el?.classList.remove('nav-focused-el'));
            return;
        }
        const _lg = _currentLazyGrid();
        if (_isLazyCat() && _lg) {
            // Garante que o indice não passe dos limites
            const globalIdx = Math.max(0, Math.min((_contentItems.length || 1) - 1, _contentIdx));
            _contentItems.forEach(el => el?.classList.remove('nav-focused-el'));

            // Remove dos anteriores
            for (const card of _lg._cards) {
                if (card && card.classList.contains('nav-focused')) {
                    card.classList.remove('nav-focused');
                    card._stopInteraction?.();
                }
            }

            const card = _contentItems[globalIdx];
            if (card) {
                if (!card.classList.contains('nav-vertical-card')) {
                    card.classList.add('nav-focused-el');
                    card.focus?.({ preventScroll: true });
                    const filterList = card.closest?.('.nav-library-filter-list');
                    if (filterList) {
                        const itemRect = card.getBoundingClientRect();
                        const listRect = filterList.getBoundingClientRect();
                        const edgePadding = 8;
                        if (itemRect.bottom > listRect.bottom - edgePadding) {
                            filterList.scrollBy({
                                top: itemRect.bottom - listRect.bottom + edgePadding,
                                behavior: 'smooth'
                            });
                        } else if (itemRect.top < listRect.top + edgePadding) {
                            filterList.scrollBy({
                                top: itemRect.top - listRect.top - edgePadding,
                                behavior: 'smooth'
                            });
                        }
                    }
                    return;
                }
         
                const cols = _gridCols();
                const container = card.closest('#navPaneGames, #navPaneMedia');
                const cardIdx = _lg._cards.indexOf(card);
                _rememberLibraryCard(CATS[_catIdx]?.id, card, cardIdx);

    
                if (cardIdx >= 0 && cardIdx < cols && container) {
                   
                    if (container.scrollTop > 4) {
                        if (_libraryRapidNavigation) _animateRapidLibraryScroll(container, 0);
                        else container.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                } else {
                    
                    const paneRect = container?.getBoundingClientRect();
                    const cardRect = card.getBoundingClientRect();
                    const PADDING = 10; 

                    if (paneRect && cardRect.bottom > paneRect.bottom - PADDING) {
                        const delta = cardRect.bottom - paneRect.bottom + PADDING;
                        if (_libraryRapidNavigation) _animateRapidLibraryScroll(container, container.scrollTop + delta);
                        else container.scrollBy({ top: delta, behavior: 'smooth' });
                    } else if (paneRect && cardRect.top < paneRect.top + PADDING) {
                        const delta = cardRect.top - paneRect.top - PADDING;
                        if (_libraryRapidNavigation) _animateRapidLibraryScroll(container, container.scrollTop + delta);
                        else container.scrollBy({ top: delta, behavior: 'smooth' });
                    }
                }

             
                card.classList.add('nav-focused');
                if (document.activeElement !== card) card.focus?.({ preventScroll: true });
                card._startInteraction?.();

                _lg._loadCard(card);
                _lg.hydrateViewportBand?.();
                requestAnimationFrame(() => _lg.hydrateViewportBand?.());
            }
       
        } else {
            _contentItems.forEach((el, i) => {
                if (!el) return;
                el.classList.toggle('nav-focused-el', !_topbarFocus && i === _contentIdx);
            });

            const focused = _contentItems[_contentIdx];
            if (focused && typeof focused.focus === 'function' && document.activeElement !== focused) {
                focused.focus({ preventScroll: true });
                const isProfileShowcase = CATS[_catIdx]?.id === 'profile' && _profileSubView !== 'history';
                const isExtensionsView = CATS[_catIdx]?.id === 'settings' && _settingsSubView === 'extensions';
                const isSettingsHome = CATS[_catIdx]?.id === 'settings' && !_settingsSubView;
                if (isSettingsHome) {
                    // O hub possui seu proprio painel de rolagem. Nao use
                    // scrollIntoView aqui: ele tenta centralizar o item e acaba
                    // deslocando a pagina mesmo quando a opcao ja esta visivel.
                    _revealInsideScrollContainer(focused, focused.closest?.('.nav-settings-home-nav'));
                } else if (isExtensionsView) {
                    const list = focused.closest?.('.nav-ext-list');
                    if (list) {
                        const itemRect = focused.getBoundingClientRect();
                        const listRect = list.getBoundingClientRect();
                        const edge = 10;
                        if (itemRect.bottom > listRect.bottom - edge) {
                            list.scrollBy({ top: itemRect.bottom - listRect.bottom + edge, behavior: 'smooth' });
                        } else if (itemRect.top < listRect.top + edge) {
                            list.scrollBy({ top: itemRect.top - listRect.top - edge, behavior: 'smooth' });
                        }
                    }
                } else if (!isProfileShowcase) {
                    focused.scrollIntoView({ block: 'center', behavior: 'smooth' });
                }
            }
        }
    }

    function _gridCols(referenceGrid = null) {
        const grid = referenceGrid
            || (_isLazyCat() ? _currentLazyGrid()?._grid : null)
            || document.querySelector('.nav-big-grid, .nav-settings-grid, .nav-profile-recent-grid');
        if (!grid) return 1;
        return Math.max(1, getComputedStyle(grid).gridTemplateColumns.split(' ').length);
    }

    function _runNavMenuTransition(afterDone) {
        if (!_overlay) return;

        const token = ++_navMenuTransitionToken;
        if (_navMenuTransitionTimer) {
            clearTimeout(_navMenuTransitionTimer);
            _navMenuTransitionTimer = 0;
        }
        _navMenuTransitionCleanup?.();
        _navMenuTransitionCleanup = null;

        _overlay.classList.add('nav-menu-animating');
        _overlay.style.willChange = 'transform';

        const finish = () => {
            if (token !== _navMenuTransitionToken) return;
            if (_navMenuTransitionTimer) {
                clearTimeout(_navMenuTransitionTimer);
                _navMenuTransitionTimer = 0;
            }
            _navMenuTransitionCleanup?.();
            _navMenuTransitionCleanup = null;
            _overlay?.classList.remove('nav-menu-animating');
            if (_overlay) _overlay.style.willChange = 'auto';
            afterDone?.();
        };

        const onEnd = (event) => {
            if (event.target === _overlay && event.propertyName === 'transform') finish();
        };

        _overlay.addEventListener('transitionend', onEnd);
        _navMenuTransitionCleanup = () => _overlay?.removeEventListener('transitionend', onEnd);
        _navMenuTransitionTimer = setTimeout(finish, NAV_MENU_TRANSITION_MS + 90);
    }

    function _releaseNavMenuInput(lifecycleToken) {
        if (lifecycleToken !== _navMenuLifecycleToken || _navMenuPhase !== 'closing') return;
        if (!window.isNavMenuOpen) return false;

        window.isNavMenuOpen = false;

        if (_lastFocus && document.contains(_lastFocus)) {
            _lastFocus.focus();
        } else {
            document.querySelector('#gameGrid .card:not(.add-card)')?.focus();
        }

        window.updateNavHint?.();
    }

    // ── Abrir / Fechar ────────────────────────────────────────────────────────
    async function open(startIdx = 0) {
        if (window.isDoorpiUpdatePromptOpen?.() || document.querySelector('.doorpi-update-prompt.is-visible')) return;
        if (window.isDoorpiOverlayOpen?.() || window.isModalOpen || window.isSetupOpen || window._vkbIsOpen) return;
        if (window.isNavMenuOpen || _navMenuPhase !== 'closed' || window.isDoorpiSessionTransitionActive?.()) return;
        const requestedIdx = Number(startIdx);
        if (arguments.length > 0 && Number.isFinite(requestedIdx)) {
            _catIdx = Math.max(0, Math.min(CATS.length - 1, requestedIdx));
        }
        const lifecycleToken = ++_navMenuLifecycleToken;
        window.isNavMenuOpen = true;
        _navMenuPhase = 'opening';
        window._navMenuPhase = _navMenuPhase;

        document.body.classList.add('nav-menu-active');
        document.body.classList.remove('nav-menu-closing');

        const topProf = document.getElementById('btnTopProfile');
        if (topProf) topProf.classList.add('nav-menu-hidden');

        _lastFocus = document.activeElement;
        window.pauseDoorpiArtworkForTransition?.(_lastFocus);

        _buildOverlay();
        _overlay.classList.remove('nav-menu-input-released');
        _overlay.style.display = 'flex';
        window.updateNavHint?.();
        await _loadJSONs();
        if (lifecycleToken !== _navMenuLifecycleToken || !window.isNavMenuOpen || _navMenuPhase !== 'opening') return;

        const body = document.getElementById('navContentBody');
        if (body) {
            const initialPane = CATS[_catIdx]?.id === 'media' ? 'media' : 'games';
            _attachDualPane(body);
            _applyPaneVisibility(initialPane);
            await Promise.race([
                _warmDualPaneInitialPages(),
                new Promise(resolve => setTimeout(resolve, 90))
            ]);
        }
        if (lifecycleToken !== _navMenuLifecycleToken || !window.isNavMenuOpen || _navMenuPhase !== 'opening') return;

        requestAnimationFrame(() => {
            if (lifecycleToken !== _navMenuLifecycleToken || !window.isNavMenuOpen || _navMenuPhase !== 'opening') return;
            _runNavMenuTransition(() => {
                if (lifecycleToken === _navMenuLifecycleToken && window.isNavMenuOpen && _navMenuPhase === 'opening') {
                    _navMenuPhase = 'open';
                    window._navMenuPhase = _navMenuPhase;
                }
            });
            _overlay.classList.add('visible');
            _selectCat(_catIdx);
        });
    }

    function close() {
        if (!window.isNavMenuOpen || _navMenuPhase === 'closing') return;
        _clearProfileOverviewCarousel();
        _stopLibraryDirectionHold({ settle: false });
        if (_settingsSubView === 'bluetooth' && _bluetoothUpdateStatus?.discovering)
            postToHost?.({ action: 'stopBluetoothDiscovery' });
        if (_settingsSubView === 'sound') window.DoorpiSoundUI?.closeDrawer?.('settings');
        if (document.querySelector('.context-menu.visible')) window._ctxMenuClose?.();
        const lifecycleToken = ++_navMenuLifecycleToken;
        _navMenuPhase = 'closing';
        window._navMenuPhase = _navMenuPhase;

        document.body.classList.remove('nav-menu-active');
        document.body.classList.add('nav-menu-closing');
        
        const topProf = document.getElementById('btnTopProfile');
        if (topProf) topProf.classList.remove('nav-menu-hidden');

        _overlay?.classList.add('nav-menu-input-released');

        _runNavMenuTransition(() => {
            if (lifecycleToken !== _navMenuLifecycleToken || _navMenuPhase !== 'closing') return;
            if (_overlay) _overlay.style.display = 'none';
            document.body.classList.remove('nav-menu-closing');
            _overlay?.classList.remove('nav-menu-input-released');
            _releaseNavMenuInput(lifecycleToken);
            _navMenuPhase = 'closed';
            window._navMenuPhase = _navMenuPhase;
            window.resumeDoorpiArtworkAfterTransition?.(_lastFocus);
        });
        _overlay?.classList.remove('visible');
    }

    // ── Teclado / gamepad ────────────────────────────────────────────────────
    window._navMenuCycleTab = function (delta) {
        const tabs = Array.from(document.querySelectorAll('.nav-cat-item'));
        if (!tabs || tabs.length === 0) return;

        let currentIdx = tabs.findIndex(tab => tab.classList.contains('active'));
        if (currentIdx === -1) currentIdx = 0;

        let nextIdx = currentIdx + parseInt(delta);
        if (nextIdx < 0 || nextIdx >= tabs.length) return;

        tabs[nextIdx].click();
    };

    window._navMenuCycleSharingSubtab = function (delta) {
        if (CATS[_catIdx]?.id !== 'settings' || _settingsSubView !== 'sharing') return false;
        if (_topbarFocus) return false;
        const focused = _contentItems[_contentIdx];
        if (focused?.id === 'setBackSharing') return false;

        const tabs = Array.from(document.querySelectorAll('.nav-sharing-tab'));
        if (tabs.length <= 1) return false;

        let currentIdx = tabs.findIndex(tab => tab.classList.contains('active'));
        if (currentIdx === -1) currentIdx = 0;

        const nextIdx = Math.max(0, Math.min(tabs.length - 1, currentIdx + parseInt(delta)));
        if (nextIdx === currentIdx) return true;

        tabs[nextIdx].click();
        return true;
    };

    window._navMenuExitReleaseNotesScroll = function () {
        if (!_releaseNotesScrollActive) return false;

        const notes = document.getElementById('systemUpdateChangelog');
        if (!notes || notes.offsetParent === null) {
            _releaseNotesScrollActive = false;
            return false;
        }
        _releaseNotesScrollActive = false;
        notes?.classList.remove('is-scroll-active');
        notes?.focus({ preventScroll: true });
        return true;
    };

    window._navMenuHandleKey = function (key) {
        if (window._vkbIsOpen) return false;
        if (_navMenuPhase === 'closing') return false;
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
            _trackLibraryDirectionHold(key);
        }
        if ((key === 'Escape' || key === 'Backspace') && _libraryInteractionMode === 'filters' &&
            _closeLibraryFilters()) return true;
        if ((key === 'Escape' || key === 'Backspace') && window._navMenuExitReleaseNotesScroll?.()) return true;
        if ((key === 'L1' || key === 'R1') && window._navMenuCycleSharingSubtab?.(key === 'R1' ? 1 : -1)) return true;
        if (key === 'L1') { window._navMenuCycleTab(-1); return true; }
        if (key === 'R1') { window._navMenuCycleTab(1); return true; }

        if (_topbarFocus) return _navTopbar(key) === true;
        return _navContent(key) === true;
    };

    document.addEventListener('keydown', e => {
        // Modais de sincronizacao ficam acima do nav-menu e recebem a navegacao primeiro.
        // O controlador global trata as setas; nao as consuma neste listener de captura.
        if (window.DoorpiProfileSync?.isOpen?.()) return;
        // O seletor de discos também fica acima do nav-menu. As direções do
        // controle chegam como teclas e precisam alcançar a navegação global.
        if (window.isEmulatorDiscSelectorOpen?.()) return;
        // O popup de conflito possui prioridade no controlador global de navegacao.
        if (window.isSessionConflictPopupOpen?.()) return;
        const executionOverlay = document.getElementById('gameLaunchOverlay');
        if (executionOverlay?.classList.contains('visible') &&
            executionOverlay.classList.contains('execution-lock-visible')) return;

        if (window.isDoorpiSessionTransitionActive?.()) {
            e.preventDefault();
            e.stopImmediatePropagation();
            return true;
        }

        if (window.isDesktopWarningOpen) {
            e.preventDefault();
            e.stopImmediatePropagation();
            if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') window._dwMoveFocus?.(-1);
            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') window._dwMoveFocus?.(1);
            if (e.key === 'Enter') window._dwAction?.('CONFIRM');
            if (e.key === 'Escape' || e.key === 'Backspace') window._dwAction?.('CANCEL');
            return;
        }

        const _addModalVisible = () => {
            const el = document.getElementById('addGameContainer');
            return !!(el && el.style.display !== 'none');
        };

        if (!window.isNavMenuOpen && !isSetupOpen && !window._vkbIsOpen && !isCtxMenuOpen && !isEditModalOpen && !_addModalVisible()) {
            return;
        }

        if (window._vkbIsOpen) {
            e.preventDefault();
            e.stopImmediatePropagation();
            if (['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
                const dirMap = { 'ArrowRight': 'RIGHT', 'ArrowLeft': 'LEFT', 'ArrowDown': 'DOWN', 'ArrowUp': 'UP' };
                moveFocus(dirMap[e.key]);
            }
            else if (e.key === 'Escape') { window._vkbCancel?.(); }
            else if (e.key === 'Enter') { window._vkbConfirm?.(); }
            else if (e.key === 'Backspace') { window._vkbPhysicalKey?.('Backspace'); }
            else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
                window._vkbPhysicalKey?.(e.key);
            }
            return;
        }

        if (_addModalVisible() && !window.isNavMenuOpen) {
            const mediaView = document.getElementById('view-media-apps');
            if (mediaView?.classList.contains('active') && (e.key === 'L1' || e.key === 'R1')) {
                e.preventDefault();
                e.stopImmediatePropagation();
                window._cycleMediaSubtab?.(e.key === 'R1' ? 1 : -1);
                return;
            }
        }

        if (window.isNavMenuOpen) {
            if (document.querySelector('.profile-photo-picker-overlay, .artwork-wizard-overlay')) return;
            if (typeof isCtxMenuOpen !== 'undefined' && isCtxMenuOpen) return;
            if (typeof isEditModalOpen !== 'undefined' && isEditModalOpen) return;

            e.preventDefault();
            e.stopImmediatePropagation();
            if (CATS[_catIdx]?.id === 'settings' && _settingsSubView === 'sound' &&
                ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
                const dirMap = { 'ArrowRight': 'RIGHT', 'ArrowLeft': 'LEFT', 'ArrowDown': 'DOWN', 'ArrowUp': 'UP' };
                if (window.DoorpiSoundUI?.handleDirection?.('settings', dirMap[e.key])) {
                    const focusedIdx = _contentItems.indexOf(document.activeElement);
                    if (focusedIdx >= 0) {
                        _contentIdx = focusedIdx;
                        _contentItems.forEach((el, i) => el?.classList.toggle('nav-focused-el', i === _contentIdx));
                    }
                    return;
                }
            }
            if (e.key === 'Escape' || e.key === 'Backspace') {
                if (window._navMenuExitReleaseNotesScroll?.()) return;
                if (window._closeNavExtensionInline?.()) return;
                if (window.requestDoorpiBackAction?.()) return;
                return;
            }
            window._navMenuHandleKey(e.key);
            return;
        }
    }, true);

    function _navTopbar(key) {
        switch (key) {
            case 'ArrowLeft':
                if (_catIdx > 0) { _catIdx--; _selectCat(_catIdx); }
                return true;
            case 'ArrowRight':
                if (_catIdx < CATS.length - 1) { _catIdx++; _selectCat(_catIdx); }
                return true;
            case 'ArrowDown':
            case 'Enter':
                if (_contentItems.length > 0) {
                    _setTopbarFocus(false);
                    if (_isLazyCat()) {
                        const catId = CATS[_catIdx]?.id;
                        const actionCount = _libraryActionItems(catId).length;
                        const cards = _libraryGrid(catId)?._cards || [];
                        _contentIdx = cards.length
                            ? _rememberedLibraryContentIndex(catId, actionCount, cards)
                            : 0;
                    } else if (CATS[_catIdx]?.id === 'profile' && _profileSubView !== 'history') {
                        const editIndex = _contentItems.findIndex(item => item?.id === 'btnEditProfileHub');
                        _contentIdx = editIndex >= 0 ? editIndex : 0;
                    } else {
                        _contentIdx = 0;
                    }
                    _updateContentFocus();
                }
                return true;
            case 'ArrowUp':
            case 'Escape':
            case 'Backspace':
                close();
                return true;
        }
        return false;
    }

    function _navLibraryContent(key) {
        const catId = CATS[_catIdx]?.id;
        if (catId !== 'games' && catId !== 'media') return false;
        const total = _contentItems.length;
        if (!total) {
            if (key === 'ArrowUp' || key === 'Escape' || key === 'Backspace') _setTopbarFocus(true);
            return true;
        }

        if (_libraryInteractionMode === 'filters' && catId === 'games') {
            const footerStart = _contentItems.findIndex(item => item?.dataset?.filterCommand);
            const onFooter = footerStart >= 0 && _contentIdx >= footerStart;
            if (key === 'Enter') _contentItems[_contentIdx]?.click();
            else if (key === 'ArrowLeft' || key === 'ArrowRight') {
                if (onFooter) {
                    const resetIdx = _contentItems.findIndex(item => item?.dataset?.filterCommand === 'reset');
                    const doneIdx = _contentItems.findIndex(item => item?.dataset?.filterCommand === 'done');
                    if (resetIdx >= 0 && doneIdx >= 0) {
                        const nextIdx = _contentIdx === resetIdx ? doneIdx : resetIdx;
                        if (nextIdx !== _contentIdx) _contentIdx = nextIdx;
                    }
                } else if (key === 'ArrowLeft') {
                    _closeLibraryFilters();
                }
            }
            else if (key === 'ArrowUp') {
                if (onFooter && footerStart > 0) _contentIdx = Math.max(0, footerStart - 1);
                else _contentIdx = Math.max(0, _contentIdx - 1);
            }
            else if (key === 'ArrowDown') {
                if (!onFooter) _contentIdx = Math.min(total - 1, _contentIdx + 1);
            }
            else if (key === 'Escape' || key === 'Backspace') _closeLibraryFilters();
            else return true;
            _updateContentFocus();
            return true;
        }

        const actions = _libraryActionItems(catId);
        const actionCount = actions.length;
        const grid = _libraryGrid(catId);
        const cards = grid?._cards || [];
        const current = _contentItems[_contentIdx];
        const onAction = current?.classList?.contains('nav-library-action');

        if (key === 'Enter') {
            current?.click();
            return true;
        }
        if (key === 'Escape' || key === 'Backspace') {
            _setTopbarFocus(true);
            return true;
        }

        if (onAction) {
            if (key === 'ArrowUp') {
                if (_contentIdx > 0) _contentIdx--;
                else _setTopbarFocus(true);
            } else if (key === 'ArrowDown') {
                if (_contentIdx + 1 < actionCount) _contentIdx++;
                else if (cards.length) _contentIdx = actionCount;
            } else if (key === 'ArrowRight' && cards.length) {
                _contentIdx = actionCount;
            }
            _updateContentFocus();
            return true;
        }

        const cols = _gridCols(current?.closest?.('.nav-big-grid'));
        const cardIdx = Math.max(0, _contentIdx - actionCount);
        if (key === 'ArrowLeft') {
            if (cardIdx % cols === 0) _contentIdx = 0;
            else _contentIdx--;
        } else if (key === 'ArrowRight') {
            if (cardIdx + 1 < cards.length) _contentIdx++;
        } else if (key === 'ArrowUp') {
            if (cardIdx < cols) {
                _setTopbarFocus(true);
                return true;
            }
            else _contentIdx -= cols;
        } else if (key === 'ArrowDown') {
            const nextRowStart = (Math.floor(cardIdx / cols) + 1) * cols;
            if (nextRowStart < cards.length) {
                const exactBelow = cardIdx + cols;
                const nextCardIdx = exactBelow < cards.length ? exactBelow : nextRowStart;
                _contentIdx = actionCount + nextCardIdx;
            }
        } else if (key === ' ' || key === 'Square') {
            window._navMenuTriggerCtxMenu();
            return true;
        } else {
            return false;
        }
        _updateContentFocus();
        return true;
    }

    function _navContent(key) {
        const cols = _gridCols();
        const total = _contentItems.length;

        if (CATS[_catIdx]?.id === 'settings' &&
            _settingsSubView === 'system' &&
            _systemSubView === 'updates' &&
            _systemUpdatesSubView === 'doorpi') {
            const notes = document.getElementById('systemUpdateChangelog');
            const focusedNotes = _contentItems[_contentIdx] === notes;

            if (_releaseNotesScrollActive && notes) {
                const delta = key === 'ArrowDown' ? 96
                    : key === 'ArrowUp' ? -96
                    : key === 'ArrowRight' ? 320
                    : key === 'ArrowLeft' ? -320
                    : 0;
                if (delta !== 0) {
                    notes.scrollBy({ top: delta, behavior: 'smooth' });
                    return true;
                }
                if (key === 'Enter') return true;
            }

            if (focusedNotes && key === 'Enter') {
                notes?.click();
                return true;
            }
        }

        if (CATS[_catIdx]?.id === 'settings' &&
            !_settingsSubView &&
            ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
            if (key === 'ArrowUp') {
                if (_contentIdx <= 0) {
                    _setTopbarFocus(true);
                    return true;
                }
                _contentIdx--;
                _updateContentFocus();
            } else if (key === 'ArrowDown' && _contentIdx < total - 1) {
                _contentIdx++;
                _updateContentFocus();
            }
            return true;
        }

        if (CATS[_catIdx]?.id === 'settings' && _settingsSubView === 'bluetooth' &&
            ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
            const active = _contentItems[_contentIdx];
            if (!active) return true;
            if (_contentIdx === 0 && key === 'ArrowUp') {
                _setTopbarFocus(true);
                return true;
            }

            const rect = active.getBoundingClientRect();
            const originX = rect.left + rect.width / 2;
            const originY = rect.top + rect.height / 2;
            const vertical = key === 'ArrowUp' || key === 'ArrowDown';
            const sign = (key === 'ArrowRight' || key === 'ArrowDown') ? 1 : -1;
            let nextIndex = -1;
            let bestScore = Number.POSITIVE_INFINITY;

            _contentItems.forEach((candidate, index) => {
                if (!candidate || candidate === active) return;
                const candidateRect = candidate.getBoundingClientRect();
                const x = candidateRect.left + candidateRect.width / 2;
                const y = candidateRect.top + candidateRect.height / 2;
                const primary = vertical ? (y - originY) * sign : (x - originX) * sign;
                if (primary <= 4) return;
                const secondary = vertical ? Math.abs(x - originX) : Math.abs(y - originY);
                const score = primary + secondary * 1.65;
                if (score < bestScore) { bestScore = score; nextIndex = index; }
            });

            if (nextIndex >= 0) {
                _contentIdx = nextIndex;
                _updateContentFocus();
            } else if (key === 'ArrowLeft' && _contentIdx > 0) {
                _contentIdx = 0;
                _updateContentFocus();
            }
            return true;
        }

        if (_isLazyCat()) return _navLibraryContent(key);

        if (CATS[_catIdx]?.id === 'profile' && _profileSubView !== 'history') {
            const active = _contentItems[_contentIdx];
            const heroIndex = _contentItems.findIndex(item => item?.id === 'btnProfileHero');
            const recentIndex = _contentItems.findIndex(item => item?.id === 'btnProfileRecent');
            const journeyIndex = _contentItems.findIndex(item => item?.id === 'btnGameHistory');
            const editIndex = _contentItems.findIndex(item => item?.id === 'btnEditProfileHub');
            const activeTabIndex = _contentItems.findIndex(item => item?.classList?.contains('nav-unified-tab') && item.classList.contains('is-active'));
            const onTab = active?.classList?.contains('nav-unified-tab');

            if (key === 'ArrowUp') {
                if (active?.id === 'btnProfileRecent') {
                    if (!active._profileRecentAtStart?.()) {
                        active._profileRecentStep?.(-1);
                    } else {
                        _contentIdx = journeyIndex >= 0
                            ? journeyIndex
                            : heroIndex >= 0
                                ? heroIndex
                                : (activeTabIndex >= 0 ? activeTabIndex : 0);
                        _updateContentFocus();
                    }
                } else if (active?.id === 'btnGameHistory') {
                    _contentIdx = activeTabIndex >= 0 ? activeTabIndex : 0;
                    _updateContentFocus();
                } else if (active?.id === 'btnProfileHero') {
                    _contentIdx = activeTabIndex >= 0 ? activeTabIndex : 0;
                    _updateContentFocus();
                } else if (onTab && editIndex >= 0) {
                    _contentIdx = editIndex;
                    _updateContentFocus();
                } else {
                    _setTopbarFocus(true);
                }
                return true;
            }
            if (key === 'ArrowDown') {
                if (active?.id === 'btnEditProfileHub') {
                    _contentIdx = activeTabIndex >= 0 ? activeTabIndex : 0;
                    _updateContentFocus();
                } else if (onTab && (journeyIndex >= 0 || heroIndex >= 0 || recentIndex >= 0)) {
                    _contentIdx = journeyIndex >= 0 ? journeyIndex : (heroIndex >= 0 ? heroIndex : recentIndex);
                    _updateContentFocus();
                } else if (active?.id === 'btnGameHistory' && recentIndex >= 0) {
                    _contentIdx = recentIndex;
                    _updateContentFocus();
                } else if (active?.id === 'btnProfileHero' && recentIndex >= 0) {
                    _contentIdx = recentIndex;
                    _updateContentFocus();
                } else if (active?.id === 'btnProfileRecent') {
                    active._profileRecentStep?.(1);
                }
                return true;
            }
            if (active?.id === 'btnProfileRecent' && (key === 'ArrowLeft' || key === 'ArrowRight')) {
                if (key === 'ArrowLeft') {
                    _contentIdx = journeyIndex >= 0
                        ? journeyIndex
                        : heroIndex >= 0
                            ? heroIndex
                            : (activeTabIndex >= 0 ? activeTabIndex : 0);
                    _updateContentFocus();
                }
                return true;
            }
            if (active?.id === 'btnGameHistory' && (key === 'ArrowLeft' || key === 'ArrowRight')) return true;
            if (active?.id === 'btnProfileHero' && (key === 'ArrowLeft' || key === 'ArrowRight')) {
                active._profileHeroStep?.(key === 'ArrowLeft' ? -1 : 1);
                return true;
            }
            if (active?.id === 'btnEditProfileHub' && (key === 'ArrowLeft' || key === 'ArrowRight')) return true;
        }

        // Navegação Complexa nos menus de Settings da Conta
        if (CATS[_catIdx]?.id === 'settings' && _settingsSubView === 'account') {
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
                const byId = Object.fromEntries(_contentItems.map((item, index) => [item.id, index]));
                const activeId = _contentItems[_contentIdx]?.id;
                const syncPrimaryId = byId.navProfileSyncNow !== undefined ? 'navProfileSyncNow' : 'navProfileSyncConnect';
                const routes = {
                    setBack: { ArrowDown: 'navProfilePhoto', ArrowRight: 'navProfilePhoto' },
                    navProfilePhoto: { ArrowUp: 'setBack', ArrowDown: 'navProfName', ArrowRight: 'navProfName' },
                    navProfName: { ArrowUp: 'navProfilePhoto', ArrowDown: 'navProfPin', ArrowLeft: 'navProfilePhoto' },
                    navProfPin: { ArrowUp: 'navProfName', ArrowDown: 'navProfApi', ArrowLeft: 'navProfilePhoto' },
                    navProfApi: { ArrowUp: 'navProfPin', ArrowDown: syncPrimaryId, ArrowRight: 'navApiPaste', ArrowLeft: 'navProfilePhoto' },
                    navApiPaste: { ArrowUp: 'navProfPin', ArrowDown: syncPrimaryId, ArrowLeft: 'navProfApi', ArrowRight: 'navApiLink' },
                    navApiLink: { ArrowUp: 'navProfPin', ArrowDown: syncPrimaryId, ArrowLeft: 'navApiPaste' },
                    navProfileSyncConnect: { ArrowUp: 'navProfApi', ArrowDown: 'navApplicationHistory' },
                    navProfileSyncNow: { ArrowUp: 'navProfApi', ArrowDown: 'navApplicationHistory', ArrowRight: 'navProfileSyncDisconnect' },
                    navProfileSyncDisconnect: { ArrowUp: 'navApiPaste', ArrowDown: 'navApplicationHistory', ArrowLeft: 'navProfileSyncNow' },
                    navApplicationHistory: { ArrowUp: syncPrimaryId, ArrowDown: 'navAccountSharing' },
                    navAccountSharing: { ArrowUp: 'navApplicationHistory', ArrowDown: 'navDeleteUser' },
                    navDeleteUser: { ArrowUp: 'navAccountSharing' }
                };
                const nextId = routes[activeId]?.[key];
                if (nextId && byId[nextId] !== undefined) {
                    _contentIdx = byId[nextId];
                    _updateContentFocus();
                } else if (key === 'ArrowUp' && activeId === 'setBack') {
                    _setTopbarFocus(true);
                }
                return true;
            }
        }
        if (CATS[_catIdx]?.id === 'settings' && document.querySelector('.nav-settings-directory')) {
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
                if (_contentIdx === 0) {
                    if (key === 'ArrowUp' || key === 'ArrowLeft') _setTopbarFocus(true);
                    else if (key === 'ArrowDown' || key === 'ArrowRight') _contentIdx = Math.min(1, total - 1);
                } else if (key === 'ArrowUp') {
                    _contentIdx = Math.max(0, _contentIdx - 1);
                } else if (key === 'ArrowDown') {
                    _contentIdx = Math.min(total - 1, _contentIdx + 1);
                } else if (key === 'ArrowLeft') {
                    _contentIdx = 0;
                }
                _updateContentFocus();
                return;
            }
        }
        if (CATS[_catIdx]?.id === 'settings' && _settingsSubView === 'accountHub') {
            const map = {
                0: { ArrowUp: 'top', ArrowDown: 1, ArrowRight: 1 },
                1: { ArrowUp: 0, ArrowRight: 2 },
                2: { ArrowUp: 0, ArrowLeft: 1 }
            };

            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
                const next = map[_contentIdx]?.[key];
                if (next === 'top') {
                    _setTopbarFocus(true);
                } else if (next !== undefined && next < total) {
                    _contentIdx = next;
                    _updateContentFocus();
                }
                return;
            }
        }

        if (CATS[_catIdx]?.id === 'settings' && _settingsSubView === 'sharing') {
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
                const current = _contentItems[_contentIdx];
                const tabs = Array.from(document.querySelectorAll('.nav-sharing-tab'));
                const apps = Array.from(document.querySelectorAll('.nav-sharing-app'));
                const modes = Array.from(document.querySelectorAll('.nav-sharing-mode'));
                const users = Array.from(document.querySelectorAll('.nav-sharing-user')).filter(el => el.offsetParent !== null);
                const toggles = Array.from(document.querySelectorAll('.nav-sharing-toggle')).filter(el => el.offsetParent !== null);
                const save = document.querySelector('#navSharingSave:not([disabled])');
                const activeTab = tabs.find(el => el.classList.contains('active')) || tabs[0];
                const activeApp = apps.find(el => el.classList.contains('active')) || apps[0];
                const moveTo = element => {
                    const idx = element ? _contentItems.indexOf(element) : -1;
                    if (idx >= 0) _contentIdx = idx;
                };

                if (current?.id === 'setBackSharing') {
                    if (key === 'ArrowUp' || key === 'ArrowLeft') _setTopbarFocus(true);
                    else moveTo(activeTab || activeApp || modes[0] || toggles[0]);
                } else if (current?.classList.contains('nav-sharing-tab')) {
                    const idx = tabs.indexOf(current);
                    if (key === 'ArrowLeft') moveTo(tabs[Math.max(0, idx - 1)]);
                    else if (key === 'ArrowRight') moveTo(tabs[Math.min(tabs.length - 1, idx + 1)]);
                    else if (key === 'ArrowUp') moveTo(document.querySelector('#setBackSharing'));
                    else if (key === 'ArrowDown') moveTo(activeApp || modes[0] || toggles[0]);
                } else if (current?.classList.contains('nav-sharing-app')) {
                    const idx = apps.indexOf(current);
                    if (key === 'ArrowUp') moveTo(idx > 0 ? apps[idx - 1] : activeTab);
                    else if (key === 'ArrowDown') moveTo(apps[Math.min(apps.length - 1, idx + 1)]);
                    else if (key === 'ArrowLeft') moveTo(document.querySelector('#setBackSharing'));
                    else if (key === 'ArrowRight') moveTo(modes[0] || toggles[0] || save);
                } else if (current?.classList.contains('nav-sharing-mode')) {
                    const idx = modes.indexOf(current);
                    if (key === 'ArrowUp') moveTo(idx > 0 ? modes[idx - 1] : activeTab);
                    else if (key === 'ArrowDown') moveTo(idx < modes.length - 1 ? modes[idx + 1] : (users[0] || save));
                    else if (key === 'ArrowLeft') moveTo(activeApp);
                } else if (current?.classList.contains('nav-sharing-user')) {
                    const idx = users.indexOf(current);
                    if (key === 'ArrowLeft') moveTo(idx % 2 ? users[idx - 1] : activeApp);
                    else if (key === 'ArrowRight' && idx % 2 === 0) moveTo(users[idx + 1] || current);
                    else if (key === 'ArrowUp') moveTo(idx >= 2 ? users[idx - 2] : modes[modes.length - 1]);
                    else if (key === 'ArrowDown') moveTo(users[idx + 2] || save || current);
                } else if (current?.classList.contains('nav-sharing-toggle')) {
                    const idx = toggles.indexOf(current);
                    if (key === 'ArrowUp') moveTo(idx > 0 ? toggles[idx - 1] : activeTab);
                    else if (key === 'ArrowDown') moveTo(toggles[Math.min(toggles.length - 1, idx + 1)]);
                    else if (key === 'ArrowLeft') moveTo(activeApp);
                } else if (current === save) {
                    if (key === 'ArrowUp') moveTo(users[users.length - 1] || modes[modes.length - 1]);
                    else if (key === 'ArrowLeft') moveTo(activeApp);
                }
                _updateContentFocus();
                return;
            }
        }

        if (CATS[_catIdx]?.id === 'settings' && _settingsSubView === 'extensions') {
            const extensionDialog = document.getElementById('navExtDialog');
            const extensionDialogOpen = extensionDialog?.classList.contains('visible');
            if (extensionDialogOpen && (key === 'Escape' || key === 'Backspace')) {
                document.getElementById('navExtDialogClose')?.click();
                return true;
            }
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
                const current = _contentItems[_contentIdx];
                const moveToExtensionElement = targetOrSelector => {
                    const target = typeof targetOrSelector === 'string'
                        ? document.querySelector(targetOrSelector)
                        : targetOrSelector;
                    const index = target ? _contentItems.indexOf(target) : -1;
                    if (index < 0) return false;
                    _contentIdx = index;
                    _updateContentFocus();
                    return true;
                };

                if (extensionDialogOpen) {
                    const dialogNavigation = extensionDialog.classList.contains('has-candidate') ? {
                        navExtCandidateBack: { ArrowRight: '#navExtInstallBtn' },
                        navExtInstallBtn: { ArrowLeft: '#navExtCandidateBack' }
                    } : {
                        navExtDialogClose: { ArrowRight: '#navExtUrlInput', ArrowDown: '#navExtUrlInput' },
                        navExtUrlInput: { ArrowLeft: '#navExtDialogClose', ArrowUp: '#navExtDialogClose', ArrowDown: '#navExtPasteBtn', ArrowRight: '#navExtPasteBtn' },
                        navExtPasteBtn: { ArrowLeft: '#navExtUrlInput', ArrowUp: '#navExtUrlInput', ArrowRight: '#navExtReviewBtn' },
                        navExtReviewBtn: { ArrowUp: '#navExtUrlInput', ArrowLeft: '#navExtPasteBtn' }
                    };
                    const target = dialogNavigation[current?.id]?.[key];
                    if (target) moveToExtensionElement(target);
                    return true;
                }

                const back = document.getElementById('setBackExt');
                const store = document.getElementById('navExtStoreBtn');
                const manual = document.getElementById('navExtManualBtn');
                const list = document.getElementById('navExtensionsList');
                const cards = Array.from(list?.querySelectorAll('.nav-ext-card') || []);
                const card = current?.closest?.('.nav-ext-card');

                if (current === back) {
                    if (key === 'ArrowUp' || key === 'ArrowLeft') _setTopbarFocus(true);
                    else moveToExtensionElement(store);
                    return true;
                }
                if (current === store || current === manual) {
                    if (key === 'ArrowUp') moveToExtensionElement(back);
                    else if (key === 'ArrowLeft') moveToExtensionElement(current === manual ? store : back);
                    else if (key === 'ArrowRight' && current === store) moveToExtensionElement(manual);
                    else if (key === 'ArrowDown' && cards.length) {
                        const targetCard = current === manual && cards.length > 1 ? cards[1] : cards[0];
                        moveToExtensionElement(targetCard.querySelector('.nav-ext-btn'));
                    }
                    return true;
                }

                if (card) {
                    const cardIndex = cards.indexOf(card);
                    const actions = Array.from(card.querySelectorAll('.nav-ext-btn'));
                    const actionIndex = Math.max(0, actions.indexOf(current));
                    const columns = Math.max(1, String(getComputedStyle(list).gridTemplateColumns || '').split(' ').filter(Boolean).length);
                    const moveToCard = targetIndex => {
                        if (targetIndex < 0 || targetIndex >= cards.length) return false;
                        const targetActions = Array.from(cards[targetIndex].querySelectorAll('.nav-ext-btn'));
                        return moveToExtensionElement(targetActions[Math.min(actionIndex, targetActions.length - 1)] || targetActions[0]);
                    };

                    if (key === 'ArrowRight') {
                        if (!moveToExtensionElement(actions[actionIndex + 1])) moveToCard(cardIndex + 1);
                    } else if (key === 'ArrowLeft') {
                        if (!moveToExtensionElement(actions[actionIndex - 1])) moveToCard(cardIndex - 1);
                    } else if (key === 'ArrowDown') {
                        moveToCard(cardIndex + columns);
                    } else if (key === 'ArrowUp') {
                        if (!moveToCard(cardIndex - columns)) {
                            moveToExtensionElement(cardIndex % columns === 0 ? store : manual);
                        }
                    }
                }
                return true;
            }
        }

        if (CATS[_catIdx]?.id === 'settings' && _settingsSubView === 'system') {
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
                if (!_systemSubView) {
                    if (key === 'ArrowUp') {
                        if (_contentIdx <= 0) {
                            _setTopbarFocus(true);
                            return;
                        }
                        _contentIdx = 0;
                    } else if (key === 'ArrowDown') {
                        if (_contentIdx === 0) _contentIdx = 1;
                    } else if (key === 'ArrowLeft') {
                        if (_contentIdx > 1) _contentIdx--;
                        else if (_contentIdx === 1) _contentIdx = 0;
                        else {
                            _setTopbarFocus(true);
                            return;
                        }
                    } else if (key === 'ArrowRight') {
                        if (_contentIdx >= 1 && _contentIdx < total - 1) _contentIdx++;
                    }

                    _contentIdx = Math.max(0, Math.min(total - 1, _contentIdx));
                    _updateContentFocus();
                    return;
                }

                if (_systemSubView === 'video') {
                    const activeItem = _contentItems[_contentIdx];
                    const presets = Array.from(document.querySelectorAll('.nav-video-preset'));
                    const range = document.getElementById('navVideoScale');
                    const back = document.getElementById('setBackSystemVideo');
                    const moveTo = element => {
                        const idx = _contentItems.indexOf(element);
                        if (idx >= 0) { _contentIdx = idx; _updateContentFocus(); }
                    };
                    if (activeItem === back) {
                        if (key === 'ArrowDown' || key === 'ArrowRight') moveTo(presets[0] || range);
                        else if (key === 'ArrowUp' || key === 'ArrowLeft') _setTopbarFocus(true);
                        return;
                    }
                    if (activeItem?.classList.contains('nav-video-preset')) {
                        const idx = presets.indexOf(activeItem);
                        if (key === 'ArrowLeft') moveTo(presets[Math.max(0, idx - 1)]);
                        else if (key === 'ArrowRight') moveTo(presets[Math.min(presets.length - 1, idx + 1)]);
                        else if (key === 'ArrowUp') moveTo(back);
                        else if (key === 'ArrowDown') moveTo(range);
                        return;
                    }
                    if (activeItem?.id === 'navVideoScale' && (key === 'ArrowLeft' || key === 'ArrowRight')) {
                        const delta = key === 'ArrowRight' ? 5 : -5;
                        const min = Number(activeItem.min || 25);
                        const max = Number(activeItem.max || 180);
                        const next = Math.max(min, Math.min(max, Number(activeItem.value || 100) + delta));
                        activeItem.value = String(next);
                        activeItem.dispatchEvent(new Event('input', { bubbles: true }));
                        _updateContentFocus();
                        return;
                    }
                    if (activeItem === range && key === 'ArrowUp') {
                        moveTo(presets[1] || presets[0] || back);
                        return;
                    }
                    if (activeItem === range && key === 'ArrowDown') return;
                }

                if (_systemSubView === 'updates') {
                    const tabDoorpiIdx = _contentItems.findIndex(el => el?.id === 'updatesTabDoorpi');
                    const tabWindowsIdx = _contentItems.findIndex(el => el?.id === 'updatesTabWindows');
                    const tabGpuIdx = _contentItems.findIndex(el => el?.id === 'updatesTabGpu');
                    const activeTabIdx = _systemUpdatesSubView === 'gpu'
                        ? tabGpuIdx
                        : (_systemUpdatesSubView === 'windows' ? tabWindowsIdx : tabDoorpiIdx);
                    const firstActionIdx = _contentItems.findIndex(el =>
                        el?.classList?.contains('nav-suggestion-card') ||
                        el?.classList?.contains('nav-gpu-app-card'));
                    const releaseNotesIdx = _contentItems.findIndex(el => el?.id === 'systemUpdateChangelog');
                    const actionIndices = _contentItems
                        .map((el, idx) => el?.classList?.contains('nav-suggestion-card') ? idx : -1)
                        .filter(idx => idx >= 0);
                    const actionPosition = actionIndices.indexOf(_contentIdx);
                    const onTabs = _contentIdx === tabDoorpiIdx || _contentIdx === tabWindowsIdx || _contentIdx === tabGpuIdx;
                    const gpuCardIndices = _contentItems
                        .map((el, idx) => el?.classList?.contains('nav-gpu-app-card') ? idx : -1)
                        .filter(idx => idx >= 0);
                    const gpuCardPosition = gpuCardIndices.indexOf(_contentIdx);

                    if (_systemUpdatesSubView === 'gpu' && gpuCardPosition >= 0) {
                        if (key === 'ArrowLeft') {
                            _contentIdx = gpuCardIndices[(gpuCardPosition - 1 + gpuCardIndices.length) % gpuCardIndices.length];
                        } else if (key === 'ArrowRight') {
                            _contentIdx = gpuCardIndices[(gpuCardPosition + 1) % gpuCardIndices.length];
                        } else if (key === 'ArrowUp') {
                            _contentIdx = tabGpuIdx;
                        }
                        _updateContentFocus();
                        return;
                    }

                    if (actionPosition >= 0) {
                        if (key === 'ArrowLeft' && actionPosition % 2 === 1) _contentIdx = actionIndices[actionPosition - 1];
                        else if (key === 'ArrowRight' && actionPosition % 2 === 0 && actionIndices[actionPosition + 1] !== undefined) _contentIdx = actionIndices[actionPosition + 1];
                        else if (key === 'ArrowUp') _contentIdx = actionPosition >= 2
                            ? actionIndices[actionPosition - 2]
                            : activeTabIdx;
                        else if (key === 'ArrowDown') {
                            if (actionIndices[actionPosition + 2] !== undefined) _contentIdx = actionIndices[actionPosition + 2];
                            else if (releaseNotesIdx >= 0 && _systemUpdatesSubView === 'doorpi') _contentIdx = releaseNotesIdx;
                        }
                        _updateContentFocus();
                        return;
                    }

                    if (_contentIdx === releaseNotesIdx) {
                        if (key === 'ArrowUp') _contentIdx = actionIndices[actionIndices.length - 1] ?? activeTabIdx;
                        _updateContentFocus();
                        return;
                    }

                    if (key === 'ArrowUp') {
                        if (_contentIdx <= 0) {
                            _setTopbarFocus(true);
                            return;
                        }
                        if (onTabs) _contentIdx = 0;
                        else if (_contentIdx === firstActionIdx) _contentIdx = activeTabIdx;
                        else _contentIdx--;
                    } else if (key === 'ArrowDown') {
                        if (_contentIdx === 0) _contentIdx = activeTabIdx;
                        else if (onTabs && firstActionIdx !== -1) _contentIdx = firstActionIdx;
                        else if (onTabs && releaseNotesIdx >= 0 && _systemUpdatesSubView === 'doorpi') _contentIdx = releaseNotesIdx;
                        else if (_contentIdx < total - 1) _contentIdx++;
                    } else if (key === 'ArrowLeft') {
                        if (_contentIdx === tabGpuIdx) _contentIdx = tabWindowsIdx;
                        else if (_contentIdx === tabWindowsIdx) _contentIdx = tabDoorpiIdx;
                    } else if (key === 'ArrowRight') {
                        if (_contentIdx === tabDoorpiIdx) _contentIdx = tabWindowsIdx;
                        else if (_contentIdx === tabWindowsIdx) _contentIdx = tabGpuIdx;
                    }

                    _contentIdx = Math.max(0, Math.min(total - 1, _contentIdx));
                    _updateContentFocus();
                    return;
                }

                if (key === 'ArrowUp') {
                    if (_contentIdx <= 0) {
                        _setTopbarFocus(true);
                        return;
                    }
                    _contentIdx--;
                } else if (key === 'ArrowDown') {
                    if (_contentIdx < total - 1) {
                        _contentIdx++;
                    }
                } else if (key === 'ArrowLeft') {
                    if (_contentIdx > 0) {
                        _contentIdx--;
                    } else {
                        _setTopbarFocus(true);
                        return;
                    }
                } else if (key === 'ArrowRight') {
                    return true;
                }

                _contentIdx = Math.max(0, Math.min(total - 1, _contentIdx));
                _updateContentFocus();
                return;
            }
        }

        if (CATS[_catIdx]?.id === 'settings' && (_settingsSubView === 'devicesHub' || _settingsSubView === 'connectivityHub')) {
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
                if (key === 'ArrowUp') {
                    if (_contentIdx <= 0) {
                        _setTopbarFocus(true);
                        return;
                    }
                    _contentIdx = 0;
                } else if (key === 'ArrowDown') {
                    if (_contentIdx === 0) _contentIdx = 1;
                } else if (key === 'ArrowLeft') {
                    if (_contentIdx > 1) _contentIdx--;
                    else if (_contentIdx === 1) _contentIdx = 0;
                    else {
                        _setTopbarFocus(true);
                        return;
                    }
                } else if (key === 'ArrowRight') {
                    if (_contentIdx >= 1 && _contentIdx < total - 1) _contentIdx++;
                }

                _contentIdx = Math.max(0, Math.min(total - 1, _contentIdx));
                _updateContentFocus();
                return;
            }
        }

        // Navegação Comum Padrão (Sem Lazy Load)
        switch (key) {
            case 'ArrowLeft':
                if (_contentIdx > 0) { _contentIdx--; _updateContentFocus(); }
                break;
            case 'ArrowRight':
                if (_contentIdx < total - 1) { _contentIdx++; _updateContentFocus(); }
                break;
            case 'ArrowUp':
                if (CATS[_catIdx]?.id === 'profile' && !_profileSubView && _contentIdx > 0) {
                    _contentIdx = _contentIdx >= 2 ? 1 : 0; _updateContentFocus(); break;
                }
                if (_contentIdx < cols) { _setTopbarFocus(true); }
                else { _contentIdx = Math.max(0, _contentIdx - cols); _updateContentFocus(); }
                break;
            case 'ArrowDown':
                if (CATS[_catIdx]?.id === 'profile' && !_profileSubView && _contentIdx <= 1 && total > 1) {
                    _contentIdx = _contentIdx === 0 ? 1 : (total > 2 ? 2 : 1); _updateContentFocus(); break;
                }
                if (_contentIdx + cols < total) { _contentIdx += cols; _updateContentFocus(); }
                break;
            case 'Enter': {
                if (CATS[_catIdx]?.id === 'settings' && _settingsSubView === 'sound') {
                    if (window.DoorpiSoundUI?.confirm?.('settings')) return true;
                    const active = document.activeElement;
                    if (active?.closest?.('#navSoundHost') && active.classList.contains('sound-focus')) {
                        active.click();
                        const focusedIdx = _contentItems.indexOf(document.activeElement);
                        if (focusedIdx >= 0) _contentIdx = focusedIdx;
                        return true;
                    }
                }
                const target = _contentItems[_contentIdx];
                if (target) target.click();
                break;
            }
            case 'Escape':
            case 'Backspace':
                if (CATS[_catIdx]?.id === 'profile' && _profileSubView === 'history') {
                    _profileSubView = null;
                    _contentIdx = 0;
                    _renderContent('profile');
                    _setTopbarFocus(false);
                } else if (CATS[_catIdx]?.id === 'settings' && _settingsSubView) {
                    if (_settingsSubView === 'bluetooth' && _bluetoothUpdateStatus?.pairingPrompt) {
                        postToHost?.({ action: 'respondBluetoothPairing', accepted: false, pin: '' });
                        return true;
                    } else if (_settingsSubView === 'bluetooth' && window.DoorpiBluetoothUI?.back?.('settings')) {
                        const body = document.querySelector('.nav-content-body');
                        if (body) _refreshSettingsBluetooth(body, '.bt-device-card');
                        return true;
                    } else if (_settingsSubView === 'bluetooth') {
                        if (_bluetoothUpdateStatus?.discovering) postToHost?.({ action: 'stopBluetoothDiscovery' });
                        _settingsSubView = 'devicesHub';
                    } else if (_settingsSubView === 'wifi' && window.DoorpiWifiUI?.back?.('settings')) {
                        const body = document.querySelector('.nav-content-body');
                        if (body) _refreshSettingsWifi(body, '.wifi-network-card');
                        return true;
                    } else if (_settingsSubView === 'wifi') {
                        _settingsSubView = 'devicesHub';
                    } else if (_settingsSubView === 'sound') {
                        const soundFocusSelector = window.DoorpiSoundUI?.back?.('settings');
                        if (soundFocusSelector) {
                            if (typeof soundFocusSelector === 'string') {
                                const body = document.querySelector('.nav-content-body');
                                if (body) _refreshSettingsSound(body, soundFocusSelector);
                            }
                            return true;
                        }
                        window.DoorpiSoundUI?.closeDrawer?.('settings');
                        _settingsSubView = 'devicesHub';
                    } else if (_settingsSubView === 'devicesHub' || _settingsSubView === 'connectivityHub') {
                        if (_settingsReturnToRoot) {
                            _settingsReturnToRoot = false;
                            _settingsSubView = null;
                            _systemSubView = null;
                        } else {
                            _settingsSubView = 'system';
                            _systemSubView = null;
                        }
                    } else if (_settingsSubView === 'system' && _systemSubView) {
                        if (_settingsReturnToRoot) {
                            _settingsReturnToRoot = false;
                            _settingsSubView = null;
                        }
                        _systemSubView = null;
                    } else {
                        _settingsSubView = (_settingsSubView === 'account' || _settingsSubView === 'sharing') ? 'accountHub' : null;
                        if (_settingsSubView !== 'system') _systemSubView = null;
                    }
                    _contentIdx = 0;
                    _renderContent('settings');
                    _updateContentFocus();
                } else { _setTopbarFocus(true); }
                return true;
            case ' ':
            case 'Square':
                window._navMenuTriggerCtxMenu();
                return true;
        }
        return false;
    }

    window.addEventListener('doorpi:profile-sync-message', event => {
        const data = event.detail || {};
        if (data.setup) return;
        if (data.type === 'profileSyncDataApplied') {
            const profileId = data.profileId || window._doorpiCurrentUserId || '';
            if (_sameId(profileId, window._doorpiCurrentUserId || _menuDataUserId)) {
                _setMenuUserContext(window._doorpiProfile || _menuData.user, profileId, true);
            }
            return;
        }
        if (data.type === 'profileSyncArtworkUpdated') {
            const item = (_menuData.history || []).find(entry =>
                String(entry?.Name || '').localeCompare(String(data.gameName || ''), undefined, { sensitivity: 'base' }) === 0);
            if (!item) return;
            if (data.verticalUrl) item.ShowcaseVerticalImageUrl = data.verticalUrl;
            if (data.horizontalUrl) item.HistoryHorizontalImageUrl = data.horizontalUrl;
            if (data.bannerUrl) item.ProfileBannerImageUrl = data.bannerUrl;
            if (data.category === 'vertical') {
                if (data.remoteUrl) item.ShowcaseVerticalImageUrl = data.remoteUrl;
                if (data.localUrl) item.ShowcaseVerticalLocalImage = data.localUrl;
            } else if (data.category === 'horizontal') {
                if (data.remoteUrl) item.HistoryHorizontalImageUrl = data.remoteUrl;
                if (data.localUrl) item.HistoryHorizontalLocalImage = data.localUrl;
            } else if (data.category === 'banner') {
                if (data.remoteUrl) item.ProfileBannerImageUrl = data.remoteUrl;
                if (data.localUrl) item.ProfileBannerLocalImage = data.localUrl;
            }
            document.querySelectorAll('[data-history-game-name]').forEach(element => {
                if (String(element.dataset.historyGameName || '').localeCompare(String(data.gameName || ''), undefined, { sensitivity: 'base' }) !== 0) return;
                const image = element.querySelector(':scope > img, .nav-profile-history-art img:not(.is-icon)');
                const source = element.classList.contains('nav-profile-history-row')
                    ? (item.HistoryHorizontalLocalImage || item.HistoryHorizontalImageUrl || item.ShowcaseVerticalLocalImage || item.ShowcaseVerticalImageUrl)
                    : (item.ShowcaseVerticalLocalImage || item.ShowcaseVerticalImageUrl);
                if (image && source) image.src = source;
            });
            return;
        }
        if (data.type === 'profileSyncBusy') {
            _profileSyncUi.busy = !!data.busy;
        } else if (data.type === 'profileSyncStatus') {
            _profileSyncUi.status = data.status || 'Disconnected';
            _profileSyncUi.connected = !!data.connected;
            _profileSyncUi.busy = false;
            _profileSyncUi.message = _profileSyncUi.connected
                ? _t('profileSyncConnected', 'Sincronizado')
                : _t('profileSyncDisconnected', 'Não conectado');
        } else if (data.type === 'profileSyncResult' || data.type === 'profileSyncConflict') {
            _profileSyncUi.status = data.status || _profileSyncUi.status;
            _profileSyncUi.busy = false;
            if (data.status === 'Disconnected') _profileSyncUi.connected = false;
            else if (['Synced', 'Uploaded', 'Downloaded', 'Conflict'].includes(data.status)) _profileSyncUi.connected = true;
            _profileSyncUi.message = data.message || (data.status === 'Offline'
                ? _t('profileSyncOffline', 'Sem conexão. Os dados locais foram mantidos.')
                : data.status === 'AuthenticationRequired'
                    ? _t('profileSyncAuthRequired', 'Entre novamente para sincronizar.')
                    : data.status === 'Failed'
                        ? _t('profileSyncFailed', 'Falha na sincronização')
                        : (_profileSyncUi.connected ? _t('profileSyncConnected', 'Sincronizado') : _t('profileSyncDisconnected', 'Não conectado')));
        }
        window._refreshProfileSyncAccountUi?.();
        if (window.isNavMenuOpen && _settingsSubView === 'account') _updateContentFocus();
    });

    // ── Bridge Update ─────────────────────────────────────────────────────────
    if (window.chrome?.webview) {
        window.chrome.webview.addEventListener('message', e => {
            try {
                const data = JSON.parse(e.data);

                if (data.type === 'gameHistoryDeleted' && data.removed) {
                    const deletedName = String(data.gameName || '');
                    _menuData.history = (_menuData.history || []).filter(entry =>
                        String(entry?.Name || '').localeCompare(
                            deletedName,
                            undefined,
                            { sensitivity: 'base' }) !== 0);

                    if (window.isNavMenuOpen && CATS[_catIdx]?.id === 'profile') {
                        const previousIndex = _contentIdx;
                        _renderContent('profile');
                        _contentIdx = Math.max(0, Math.min(previousIndex, _contentItems.length - 1));
                        _setTopbarFocus(false);
                        _updateContentFocus();
                    }
                }

                if (data.type === 'clipboardText' && window._isPastingApiKey) {
                    window._isPastingApiKey = false;
                    const text = data.text.trim();
                    if (text) {
                        window._updatePendingApiKey?.(text);
                        if (text !== _menuData.user.SteamGridApiKey) {
                            _menuData.user.SteamGridApiKey = text;
                        }
                    }
                }
                
                if (data.type === 'bootModeState') {
                    window._doorpiBootMode = data.mode || 0;
                    if (typeof window._updateBootModeUI === 'function') {
                        window._updateBootModeUI();
                    }
                }

                if (data.type === 'systemUpdateStatus') {
                    _systemUpdateStatus = { ..._systemUpdateStatus, ...data };
                    _updateSystemUpdateUI();
                    if (_settingsSubView === 'system' && typeof window._updateBootModeUI === 'function') {
                        window._updateBootModeUI();
                    }
                }

                if (data.type === 'windowsUpdateStatus') {
                    _windowsUpdateStatus = { ..._windowsUpdateStatus, ...data };
                    _updateWindowsUpdateUI();
                }

                if (data.type === 'gpuUpdateStatus') {
                    _gpuUpdateStatus = { ..._gpuUpdateStatus, ...data };
                    _updateGpuUpdateUI();
                }
                
                if (data.type === 'autoStartState') {
                    _autoStartEnabled = !!data.enabled;
                    _updateAutoStartUI();
                }
                
                if (data.type === 'profilePhotoSelected' && data.base64) {
                    if (typeof isSetupOpen !== 'undefined' && isSetupOpen) return;

                    _menuData.user.PhotoBase64 = data.base64;
                    if (window._doorpiProfile) window._doorpiProfile.PhotoBase64 = data.base64;
                    window._applyDoorpiTopProfile?.(window._doorpiProfile || _menuData.user);

                    const name = _menuData.user.Name || '';
                    postToHost({ action: 'saveUserProfile', name: name, photoBase64: data.base64, skipTasks: true });

                    if (!window.isNavMenuOpen) return;

                    const imgTag = `<img src="${window._doorpiUserPhotoSrc?.(data.base64) || `data:image/png;base64,${data.base64}`}" />`;

                    const photoBtn = document.getElementById('navProfilePhoto');
                    if (photoBtn) photoBtn.innerHTML = imgTag;

                    const hubAvatar = document.querySelector('.nav-profile-avatar-large');
                    if (hubAvatar) hubAvatar.innerHTML = imgTag;

                    const status = document.getElementById('navSaveStatus');
                    if (status) {
                        status.style.opacity = '1';
                        clearTimeout(status._hideTimer);
                        status._hideTimer = setTimeout(() => { status.style.opacity = '0'; }, 3000);
                    }
                }

                // showSetup é uma transição global e é tratada exclusivamente
                // por app.js. Mantê-la aqui abria o setup duas vezes e encerrava
                // o handoff da intro antes do conteúdo estar visível.
            } catch { }
        });
    }

    // ── Context Menu no Nav ───────────────────────────────────────────────────
    window._navMenuTriggerCtxMenu = function () {
        if (!window.isNavMenuOpen) return false;
        const catId = CATS[_catIdx]?.id;
        const focusedProfileItem = _contentItems[_contentIdx];
        if (catId === 'profile' && !_topbarFocus && focusedProfileItem?.dataset?.historyGameName) {
            _openHistoryContextMenu(focusedProfileItem);
            return true;
        }
        const allowGpuUpdaterContext =
            catId === 'settings' &&
            _settingsSubView === 'system' &&
            _systemSubView === 'updates' &&
            _systemUpdatesSubView === 'gpu';
        const allowBluetoothContext = catId === 'settings' && _settingsSubView === 'bluetooth';
        const isLibrary = catId === 'games' || catId === 'media';
        if (!isLibrary && !allowGpuUpdaterContext && !allowBluetoothContext) return false;

        // Ao usar Virtual Rendering, a referencia O(1) correta no DOM é essa:
        const focused = _contentItems[_contentIdx];
        if (!focused || _topbarFocus) return false;

        // Pesquisa, filtros e demais acoes da biblioteca compartilham a aba com
        // os cards, mas nao representam jogos/aplicativos. Validar aqui tambem
        // cobre o X disparado diretamente pelo polling do controle.
        if (isLibrary && !focused.classList?.contains('nav-vertical-card')) return false;
        if (allowGpuUpdaterContext && focused.dataset?.gpuUpdaterCard !== 'true') return false;
        if (allowBluetoothContext && focused.dataset?.bluetoothDeviceCard !== 'true') return false;

        const r = focused.getBoundingClientRect();
        window._ctxMenuOpen?.(focused, r.right + 2, r.top);
        return true;
    };

    // ── Expose ────────────────────────────────────────────────────────────────
    window.openNavMenu = open;
    window.closeNavMenu = close;
    window._navMenuOpenSettings = async function () {
        _catIdx = 2;
        _settingsSubView = null;
        _systemSubView = null;
        _settingsReturnToRoot = false;
        if (!window.isNavMenuOpen) {
            await open(2);
            requestAnimationFrame(() => _setTopbarFocus(false));
            return;
        }
        document.querySelectorAll('.nav-cat-item').forEach((el, i) => el.classList.toggle('active', i === _catIdx));
        _updateTopbarFocusVisual();
        _contentIdx = 0;
        _renderContent('settings');
        _setTopbarFocus(false);
        _updateContentFocus();
    };
    window._navMenuCurrentUserChanged = function (user, currentUserId, userChanged = false) {
        _setMenuUserContext(user || {}, currentUserId || '', !!userChanged);
    };
    window._navMenuDataChanged = function (catId = 'games') {
        _reloadMenuAfterLibraryChange(catId);
    };
    window._navMenuEditHistoryArtwork = function (element) {
        const item = _findHistoryItem(element);
        if (item) _openHistoryArtworkPicker(item, element);
    };
    window._navMenuDeleteHistory = function (element) {
        const item = _findHistoryItem(element);
        if (!item) return;
        postToHost?.({ action: 'deleteGameHistory', gameName: item.Name });
    };
    window._navMenuRemoveItem = function (catId, itemKey) {
        if (catId === 'games' && Array.isArray(_menuData.games)) {
            _menuData.games = _menuData.games.filter(item => {
                const key = item.LaunchUrl || item.launchUrl || item.Path || item.path || '';
                return key !== itemKey;
            });
        }

        const grid = catId === 'games' ? _lazyGrid : _lazyGridMedia;
        if (!grid) return;

        const removedIdx = grid._cards.findIndex(c => c?.dataset?.gameId === itemKey);
        grid.removeItem(itemKey);

        // Só atualiza navegação se a aba visível for a afetada
        if (CATS[_catIdx]?.id !== catId) return;

        _contentItems = grid._cards;

        // Se o item removido estava antes ou no cursor atual, recua 1 para não pular item
        if (removedIdx !== -1 && removedIdx <= _contentIdx) {
            _contentIdx = Math.max(0, _contentIdx - 1);
        }

        _contentIdx = Math.max(0, Math.min(_contentItems.length - 1, _contentIdx));
        _updateContentFocus();
    };
    window._navMenuOpenExtensions = function () {
        _catIdx = 2; // Categoria de Configurações
        _settingsSubView = 'extensions';
        _settingsReturnToRoot = false;
        document.querySelectorAll('.nav-cat-item').forEach((el, i) => el.classList.toggle('active', i === _catIdx));
        _updateTopbarFocusVisual();
        _contentIdx = 0;

        const titleEl = document.getElementById('navContentTitle');
        const subEl = document.getElementById('navContentSub');
        const headerWrap = document.getElementById('navHeaderWrap');
        if (headerWrap) headerWrap.style.display = 'block';
        if (titleEl) titleEl.textContent = CATS[_catIdx].label;
        if (subEl) subEl.textContent = _subtitle(CATS[_catIdx].id);

        _renderContent('settings');
        _setTopbarFocus(false);
    };

    window._navMenuOpenAccountSharing = async function (appId = '') {
        _settingsReturnToRoot = false;
        if (!window.isNavMenuOpen) {
            _catIdx = 2;
            _settingsSubView = 'sharing';
            _sharingFocusAppId = appId || '';
            _preserveSettingsSubViewOnce = true;
            await open();
            requestAnimationFrame(() => _setTopbarFocus(false));
            return;
        }

        _catIdx = 2;
        _settingsSubView = 'sharing';
        _sharingFocusAppId = appId || '';

        document.querySelectorAll('.nav-cat-item').forEach((el, i) => el.classList.toggle('active', i === _catIdx));
        _updateTopbarFocusVisual();
        _contentIdx = 0;

        const titleEl = document.getElementById('navContentTitle');
        const subEl = document.getElementById('navContentSub');
        const headerWrap = document.getElementById('navHeaderWrap');
        if (headerWrap) headerWrap.style.display = 'block';
        if (titleEl) titleEl.textContent = CATS[_catIdx].label;
        if (subEl) subEl.textContent = _subtitle(CATS[_catIdx].id);

        _renderContent('settings');
        _setTopbarFocus(false);
    };

})();
