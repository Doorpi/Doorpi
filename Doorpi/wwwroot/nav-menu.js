'use strict';

window.isNavMenuOpen = false;

(function () {

    // ── Dados Locais ──────────────────────────────────────────────────────────
    let _menuData = { user: {}, games: [], media: [] };
    let _menuDataUserId = '';
    let _menuReloadToken = 0;

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
        if (url.startsWith('steam://')) return { name: 'Steam', svg: PLATFORM_ICONS.Steam };
        if (url.startsWith('com.epicgames')) return { name: 'Epic Games', svg: PLATFORM_ICONS.Epic };
        if (url.startsWith('goggalaxy://')) return { name: 'GOG', svg: PLATFORM_ICONS.GOG };
        if (url.startsWith('riot:')) return { name: 'Riot Games', svg: PLATFORM_ICONS.Riot };
        if (/^(xbox:|ms-xbl-)/i.test(url)) return { name: 'Xbox', svg: PLATFORM_ICONS.Xbox };
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
                    <div style="display:flex; align-items:center; gap:8px;">
                        <div class="dw-badge" style="background:transparent; border-color:rgba(255,255,255,0.4); color:#fff; font-size: 0.75rem;">START + SELECT</div> 
                        <span style="color: rgba(255,255,255,0.4); font-size: 0.8rem;">/</span>
                        <div class="dw-badge" style="background:transparent; border-color:rgba(255,255,255,0.4); color:#fff; font-size: 0.75rem;">XBOX</div>
                    </div>
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
        _menuData.media = [];
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
            _lazyGrid = new _NavLazyGrid({
                body: gamesPane, scrollRoot: gamesPane,
                items: gamesItems, catId: 'games', emptyIcon: '⊞',
                onLaunchAction: (idx) => _launchAction('games', idx),
                onFocusUpdate: (cards, idx) => {
                    if (CATS[_catIdx]?.id !== 'games') return;
                    _contentItems = cards;
                    if (idx >= 0) { _topbarFocus = false; _contentIdx = idx; _updateContentFocus(); }
                }
            });
        } else {
            gamesPane.innerHTML = `<div class="nav-placeholder"><div class="nav-placeholder-icon">⊞</div><div class="nav-placeholder-text">${_t('navNoGames', 'Nenhum jogo encontrado')}</div></div>`;
        }

        const mediaItems = _menuData.media || [];
        if (mediaItems.length) {
            _lazyGridMedia = new _NavLazyGrid({
                body: mediaPane, scrollRoot: mediaPane,
                items: mediaItems, catId: 'media', emptyIcon: '▶',
                onLaunchAction: (idx) => _launchAction('media', idx),
                onFocusUpdate: (cards, idx) => {
                    if (CATS[_catIdx]?.id !== 'media') return;
                    _contentItems = cards;
                    if (idx >= 0) { _topbarFocus = false; _contentIdx = idx; _updateContentFocus(); }
                }
            });
        } else {
            mediaPane.innerHTML = `<div class="nav-placeholder"><div class="nav-placeholder-icon">▶</div><div class="nav-placeholder-text">${_t('navNoMedia', 'Nenhum aplicativo configurado')}</div></div>`;
        }
    }

    function _applyPaneVisibility(catId) {
        const gamesPane = _dualPaneContainer?.querySelector('#navPaneGames');
        const mediaPane = _dualPaneContainer?.querySelector('#navPaneMedia');
        if (!gamesPane || !mediaPane) return;

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
        _contentItems = grid ? grid._cards : [];
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

        <div style="max-width: 900px;">
            <h3 style="font-size:1.1rem;font-weight:500;color:#fff;margin-bottom:12px;">${_t('sysBootBehavior', 'Comportamento de Inicialização')}</h3>

            <div class="nav-radio-group">
                <button class="nav-radio-btn" data-mode="0" tabindex="-1">
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
                        <h3 id="systemUpdateTitle" style="font-size:1.1rem;font-weight:600;color:#fff;margin:0 0 5px;">${_t('sysUpdateTitle', 'Atualizacoes do sistema')}</h3>
                        <p id="systemUpdateSub" style="margin:0;color:rgba(255,255,255,.56);line-height:1.35;">${_t('sysUpdateIdle', 'Atualizacoes ainda nao verificadas.')}</p>
                    </div>
                    <div id="systemUpdateVersions" style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;color:rgba(255,255,255,.62);font-size:.84rem;white-space:nowrap;"></div>
                </div>
                <ul id="systemUpdateChangelog" style="margin:12px 0 0;padding-left:18px;color:rgba(255,255,255,.48);font-size:.86rem;line-height:1.45;"></ul>
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
        if (typeof postToHost === 'function') postToHost({ action: 'requestUpdateStatus' });

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
            _systemUpdateStatus = { ..._systemUpdateStatus, status: 'checking', message: 'Verificando atualizacoes...' };
            _updateSystemUpdateUI();
            if (typeof postToHost === 'function') postToHost({ action: 'checkSystemUpdates' });
        });

        body.querySelector('#navCardStartUpdate')?.addEventListener('click', () => {
            _systemUpdateStatus = { ..._systemUpdateStatus, status: 'installing', message: 'Preparando atualizacao...' };
            _updateSystemUpdateUI();
            if (typeof postToHost === 'function') postToHost({ action: 'startSystemUpdate' });
        });

        body.querySelector('#btnEnterDesktop')?.addEventListener('click', () => {
            _showDesktopWarning('desktop', () => {
                if (typeof postToHost === 'function') postToHost({ action: 'enterDesktopMode' });
            });
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
            const [uRes, gRes, mRes] = await Promise.allSettled([
                fetch(`https://data.local/user.json?t=${ts}`),
                fetch(`https://data.local/games.json?t=${ts}`),
                fetch(`https://data.local/media.json?t=${ts}`)
            ]);

            if (uRes.status === 'fulfilled' && uRes.value.ok) _menuData.user = await uRes.value.json();
            if (gRes.status === 'fulfilled' && gRes.value.ok) {
                const games = await gRes.value.json();
                _menuData.games = Array.isArray(games)
                    ? games.filter(g => !(g.IsPendingArtwork || g.isPendingArtwork) && !_isArtworkPending(g, 'games'))
                    : games;
                loadedGamesFromJson = true;
            }
            if (mRes.status === 'fulfilled' && mRes.value.ok) {
                _menuData.media = await mRes.value.json();
                loadedMediaFromJson = true;
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
            _menuData.games = gameCards.map(c => ({
                Name: c.querySelector('.title')?.innerText || '',
                Path: c.dataset.gameId || '',
                GridImage: c.dataset.vertical || '',
                GridStaticImage: c.dataset.staticVertical || ''
            }));
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
        { id: 'media', icon: '▶', get label() { return _t('navMedia', 'Multimídia'); } },
        { id: 'settings', icon: '⚙', get label() { return _t('navSettings', 'Configurações'); } },
        { id: 'profile', icon: '◉', get label() { return _t('navProfile', 'Perfil'); } },
    ];

    // ── Estado ────────────────────────────────────────────────────────────────
    let _catIdx = 0;
    let _topbarFocus = true;
    let _contentIdx = 0;
    let _contentItems = [];
    let _overlay = null;
    let _bgRaf = null;
    let _lastFocus = null;
    let _settingsSubView = null;
    let _sharingFocusAppId = '';
    let _sharingSubView = 'apps';
    let _sharingFocusStoreId = 'Steam';
    let _preserveSettingsSubViewOnce = false;
    let _autoStartEnabled = false;
    let _systemUpdateStatus = {
        status: 'idle',
        message: 'Atualizacoes ainda nao verificadas.',
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
    padding: 24px; box-sizing: border-box;
    transition: opacity 0.22s ease;
}
#navPaneGames::-webkit-scrollbar,
#navPaneMedia::-webkit-scrollbar { display: none; }
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
    cursor: pointer; outline: none; border: none; background: none;
    font-family: inherit; color: rgba(255,255,255,0.35); position: relative; transition: color 0.2s ease;
}
.nav-cat-item::after {
    content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 2px;
    background: #fff; transform: scaleX(0); transform-origin: center;
    transition: transform 0.2s cubic-bezier(0.25, 1, 0.5, 1); box-shadow: 0 0 10px rgba(255,255,255,0.5);
}
.nav-cat-item.active { color: #fff; }
.nav-cat-item.active::after { transform: scaleX(1); }
.nav-cat-item.nav-focused { color: #fff; background: #f0f8ff1c; transform: scale(1.04); }
.nav-cat-item.nav-focused::after { transform: scaleX(1); height: 3px; }
.nav-cat-label { font-size: clamp(0.9rem, 1.1vw, 1.2rem); font-weight: 500; letter-spacing: 0.02em; }

.nav-content {
    flex: 1; display: flex; flex-direction: column;
    padding: clamp(10px, 2vh, 40px) clamp(20px, 3vw, 60px);
    overflow: visible;
    min-width: 0;
}
.nav-content-header {
    margin-bottom: clamp(20px, 3vh, 32px); flex-shrink: 0; text-align: left;
    animation: fadeInTop 0.4s cubic-bezier(0.2, 0.9, 0.3, 1) forwards;
}
.nav-content-title { font-size: clamp(1.2rem, 2vw, 3.2rem); font-weight: 300; color: #fff; margin: 0 0 4px; letter-spacing: -0.01em; }
.nav-content-subtitle { font-size: clamp(0.85rem, 0.9vw, 1.1rem); color: rgba(255,255,255,0.4); margin: 0; font-weight: 400; }

.nav-content-body {
    flex: 1; margin: 0; padding: 0;
    overflow: visible;
    position: relative;
}
.nav-content-body::-webkit-scrollbar { display: none; }

@keyframes fadeInTop { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: none; } }

/* ── Grid Premium Comum (Jogos/Apps) ── */

/* SUBSTITUA O .nav-big-grid POR ISSO: */
.nav-big-grid {
    --gap-x: clamp(16px, 1.5vw, 24px);
    --gap-y: clamp(40px, 4vw, 64px);

    --rows: 2;

    --padding-y: 48px;
    --available-h: calc(100cqh - var(--padding-y));
    --total-gap-h: calc(var(--gap-y) * (var(--rows) - 1));

    /* 🔹 Subtrai 1px para evitar que dízimas infinitas do Windows quebrem o grid */
    --card-h: calc(((var(--available-h) - var(--total-gap-h)) / var(--rows)) - 1px);
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
@container pane (min-height: 900px) { .nav-big-grid { --rows: 3; } } /* Telas 1080p "puras" (sem zoom do Windows) */
@container pane (min-height: 1300px) { .nav-big-grid { --rows: 4; } } /* Telas 2K puras / 4K com scaling */
@container pane (min-height: 1800px) { .nav-big-grid { --rows: 5; } } /* Telas 4K puras / 5K */
@container pane (min-height: 2400px) { .nav-big-grid { --rows: 6; } } /* Telas 8K */

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
.nav-profile-showcase { display: flex; flex-direction: column; gap: clamp(12px, 2.5vh, 40px); animation: fadeInTop 0.3s ease; max-width: clamp(85%, 75vw, 1100px); }
.nav-profile-header { display: flex; align-items: flex-start; gap: clamp(14px, 2.5vw, 40px); justify-content: flex-start; margin-bottom: clamp(4px, 1vh, 2%); }   
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
    transition: all 0.2s cubic-bezier(0.25, 1, 0.5, 1); font-weight: 500;
}
.nav-profile-edit-btn.nav-focused-el { background: #fff; color: #000; transform: scale(1.05); box-shadow: 0 10px 30px rgba(255,255,255,0.2); }

.nav-profile-stats-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: clamp(10px, 1.5vw, 24px); }
.nav-profile-stat-box {
    background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px;
    padding: clamp(10px, 1.5vh, 24px) clamp(12px, 1.5vw, 24px); display: flex; flex-direction: column; gap: clamp(4px, 0.8vh, 8px); box-shadow: 0 10px 20px rgba(0,0,0,0.2);
    align-items: center; text-align: center;
}
.nav-profile-stat-box.future-placeholder { opacity: 0.35; }
.stat-value { font-size: clamp(1.4rem, 2.2vw, 2.8rem); font-weight: 200; color: #fff; line-height: 1; }
.stat-label { font-size: clamp(0.7rem, 0.8vw, 0.85rem); color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; }
.nav-profile-section-title { font-size: 1.3rem; font-weight: 400; color: #fff; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 12px; margin-top: 10px;}

/* ── Cards Recentes ── */
.nav-profile-recent-grid {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(clamp(110px, 10vw, 205px), 1fr));
    gap: clamp(10px, 1.2vw, 24px); padding-bottom: 40px;
}
.nav-profile-recent-card {
    aspect-ratio: 2/3; border-radius: 8px; overflow: hidden; background: rgba(255,255,255,0.03); border: 2px solid transparent;
    position: relative; display: flex; flex-direction: column; transition: transform 0.2s cubic-bezier(0.25, 1, 0.5, 1), box-shadow 0.2s ease;
}
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

/* ── Dashboard de Configurações ── */
.nav-settings-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(clamp(200px, 22vw, 320px), 1fr)); gap: clamp(12px, 1.5vh, 24px); animation: fadeInTop 0.4s ease; max-width: 1400px; }
.nav-settings-card {
    background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 16px;
    padding: clamp(16px, 2.5vh, 30px) clamp(16px, 1.8vw, 24px); display: flex; align-items: flex-start; gap: clamp(12px, 1.5vw, 20px); cursor: pointer; outline: none;
    text-align: left; transition: all 0.2s cubic-bezier(0.25, 1, 0.5, 1); color: inherit; font-family: inherit;
}
.settings-card-icon { width: clamp(36px, 4.5vh, 54px); height: clamp(36px, 4.5vh, 54px); flex-shrink: 0; color: rgba(255,255,255,0.4); transition: color 0.2s; }
.settings-card-icon svg { width: 100%; height: 100%; }
.settings-card-info h3 { margin: 0 0 8px 0; font-size: 1.4rem; font-weight: 400; color: #fff; letter-spacing: -0.01em; }
.settings-card-info p { margin: 0; font-size: 0.95rem; color: rgba(255,255,255,0.4); line-height: 1.5; }
.nav-settings-card.nav-focused-el { transform: translateY(-4px) scale(1.03); background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.4); box-shadow: 0 20px 50px rgba(0,0,0,0.5); }
.nav-settings-card.nav-focused-el .settings-card-icon { color: #fff; }

.nav-settings-subheader { display: flex; align-items: center; gap: 24px; margin-bottom: 30px; animation: fadeInTop 0.3s ease; }
.nav-back-btn { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 30px; padding: 10px 24px; color: #fff; font-family: inherit; font-size: 1rem; cursor: pointer; outline: none; transition: all 0.2s; font-weight: 500; }
.nav-back-btn.nav-focused-el { background: #fff; color: #000; transform: scale(1.05); }
.nav-settings-subheader h2 { margin: 0; font-size: 1.8rem; font-weight: 300; color: #fff; }

.nav-profile-dashboard { display: flex; align-items: flex-start; gap: clamp(30px, 4vw, 60px); animation: fadeInTop 0.3s ease; max-width: 1000px; }
.nav-profile-avatar-sec { display: flex; flex-direction: column; align-items: center; gap: 16px; }
.nav-profile-photo { width: clamp(120px, 14vw, 180px); height: clamp(120px, 14vw, 180px); border-radius: 50%; background: rgba(255,255,255,0.05); border: 3px solid rgba(255,255,255,0.1); overflow: hidden; display: flex; align-items: center; justify-content: center; font-size: 3.5rem; color: rgba(255,255,255,0.3); cursor: pointer; outline: none; transition: all 0.2s; padding: 0; }
.nav-profile-photo img { width: 100%; height: 100%; object-fit: cover; }
.nav-profile-photo.nav-focused-el { border-color: #fff; box-shadow: 0 0 20px rgba(255,255,255,0.2), 0 10px 40px rgba(0,0,0,0.8); transform: scale(1.05); }

.nav-profile-fields { flex: 1; display: flex; flex-direction: column; gap: clamp(16px, 2vh, 24px); background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); padding: clamp(24px, 3vw, 40px); border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.3); }
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

@media (max-width: 1366px), (max-height: 780px) {

    .nav-topbar { padding-top: 1.8rem; gap: 12px; }
    .nav-cat-item { padding: 6px; }
    .nav-cat-label { font-size: 0.82rem; }
    .nav-content { padding: 12px 32px; }
    .nav-content-header { margin-bottom: 8px; }
    .nav-content-title { font-size: 1.5rem; }
    .nav-content-subtitle { font-size: 0.78rem; }
    #navPaneGames, #navPaneMedia { padding: 16px; scroll-padding-top: 16px; scroll-padding-bottom: 16px; }
    .nav-big-grid { --padding-y: 32px; }
    .nav-settings-grid { gap: 10px; }
    .nav-settings-card { padding: 12px 16px; gap: 12px; border-radius: 10px; }
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
        _catIdx = Number(idx);

        if (_preserveSettingsSubViewOnce) {
            _preserveSettingsSubViewOnce = false;
        } else {
            _settingsSubView = null;
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

        if (cat.id === 'profile') {
            fetch(`https://data.local/games.json?t=${new Date().getTime()}`)
                .then(r => r.json())
                .then(games => {
                    if (!Array.isArray(games)) return;
                    _menuData.games = games.filter(g => !(g.IsPendingArtwork || g.isPendingArtwork) && !_isArtworkPending(g, 'games'));
                    if (CATS[_catIdx]?.id === 'profile') {
                        _renderProfile(document.getElementById('navContentBody'));
                        _updateContentFocus();
                    }
                }).catch(() => { });
        }
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

    function _launchAction(catId, idx) {
        const items = catId === 'games' ? _menuData.games : _menuData.media;
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
                window.trackGameOpened?.(targetPath);
                window.suspendDoorpiGameInput?.();
                postToHost({ action: 'launch', path: targetPath, errorMsg: _t('msgErrorLaunch', 'Erro ao abrir') });
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
    function _renderContent(id) {
        const body = document.getElementById('navContentBody');
        if (!body) return;

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
                _renderProfile(body);
                break;
        }
    }

    // ── Vitrine de Perfil ─────────────────────────────────────────────────────
    function _renderProfile(body) {
        const prof = _menuData.user || {};
        const name = prof.Name || '—';
        const photo = prof.PhotoBase64 || '';
        const games = _menuData.games || [];

        const totalGames = games.length;

        const totalMinutes = games.reduce((sum, g) => sum + (g.TotalPlaytimeMinutes || 0), 0);

        const mostPlayed = [...games]
            .filter(g => (g.TotalPlaytimeMinutes || 0) > 0)
            .sort((a, b) => b.TotalPlaytimeMinutes - a.TotalPlaytimeMinutes)[0];

        const recentGames = games
            .filter(g => g.LastPlayed && !g.LastPlayed.startsWith('0001-01-01'))
            .sort((a, b) => new Date(b.LastPlayed) - new Date(a.LastPlayed))
            .slice(0, 6);

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
        const mostPlayedName = mostPlayed ? mostPlayed.Name : '--';
        const mostPlayedFmt = mostPlayed ? (fmtTime(mostPlayed.TotalPlaytimeMinutes) || '') : '';

        body.innerHTML = `
        <div class="nav-profile-showcase">
            <div class="nav-profile-header">
                <div class="nav-profile-avatar-large">
                    ${photo ? `<img src="data:image/png;base64,${photo}" />` : '◉'}
                </div>
                <div class="nav-profile-info">
                    <h2 class="nav-profile-name">${name}</h2>
                </div>
                <button class="nav-profile-edit-btn" id="btnEditProfileHub" tabindex="-1">
                    ${_t('navEditProfileBtn', 'Editar Perfil')}
                </button>
            </div>

            <div class="nav-profile-stats-row">
                <div class="nav-profile-stat-box">
                    <span class="stat-value">${totalGames}</span>
                    <span class="stat-label">${_t('navStatGames', 'Jogos na Biblioteca')}</span>
                </div>
                <div class="nav-profile-stat-box ${totalMinutes === 0 ? 'future-placeholder' : ''}">
                    <span class="stat-value">${totalFmt}</span>
                    <span class="stat-label">${_t('navStatTime', 'Horas Jogadas')}</span>
                </div>
                <div class="nav-profile-stat-box ${!mostPlayed ? 'future-placeholder' : ''}">
                    <span class="stat-value" style="font-size:clamp(0.85rem,1.3vw,1.6rem); line-height:1.2; text-align:center;">
                        ${mostPlayedName}
                    </span>
                    <span class="stat-label">
                        ${mostPlayed
                ? `${_t('navStatMostPlayed', 'Mais Jogado')} · ${mostPlayedFmt}`
                : _t('navStatMostPlayed', 'Mais Jogado')}
                    </span>
                </div>
            </div>

            <div class="nav-profile-section-title">${_t('navRecentGames', 'Jogados Recentemente')}</div>
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

        const grid = body.querySelector('#profileRecentGrid');

        if (recentGames.length === 0) {
            grid.innerHTML = `<div style="color:rgba(255,255,255,0.3); grid-column:1/-1;">
            ${_t('navNoRecentGames', 'Nenhum jogo recente')}
        </div>`;
        } else {
            recentGames.forEach((item) => {
                const staticSrc = _restingGridSrc(item, 'games');
                const totalFmtItem = fmtTime(item.TotalPlaytimeMinutes);
                const lastFmt = fmtTime(item.LastSessionMinutes);
                const dateStr = relDate(item.LastPlayed);
                const pData = _getPlatformData(item.LaunchUrl);

                const card = document.createElement('div');
                card.className = 'nav-profile-recent-card';

                card.innerHTML = staticSrc
                    ? `<img src="${staticSrc}" alt="${item.Name}" />`
                    : `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:rgba(255,255,255,0.1);font-size:2rem;">⊞</div>`;

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
                _contentItems.push(card);

                card.addEventListener('mouseenter', () => {
                    _topbarFocus = false;
                    _contentIdx = _contentItems.indexOf(card);
                    _updateContentFocus();
                });
            });
        }
    }

    // ── Novo Hub de Configurações ─────────────────────────────────────────────
    function _renderSettings(body) {
        if (_settingsSubView === 'accountHub') { _renderSettingsAccountHub(body); return; }
        if (_settingsSubView === 'account') { _renderSettingsAccount(body); return; }
        if (_settingsSubView === 'extensions') { _renderSettingsExtensions(body); return; }
        if (_settingsSubView === 'sharing') { _renderSettingsSharing(body); return; }
        if (_settingsSubView === 'system') { _renderSettingsSystem(body); return; }
        const svgUser = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
        const svgSys = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`;
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
                    <h3>${_t('navSetSystem', 'Sistema e Inicialização')}</h3>
                    <p>${_t('navSetSystemDesc', 'Ajustes de inicialização do console e acesso à área de trabalho')}</p>
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
            body.querySelector('#setExt')
        ].filter(Boolean);

        body.querySelector('#setAccount')?.addEventListener('click', () => {
            _settingsSubView = 'accountHub'; _contentIdx = 0; _renderContent('settings'); _updateContentFocus();
        });

        body.querySelector('#setSystem')?.addEventListener('click', () => {
            _settingsSubView = 'system'; _contentIdx = 0; _renderContent('settings'); _updateContentFocus();
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

        if (badge) {
            badge.textContent = status.forceUpdate
                ? 'OBRIGATORIA'
                : isChecking
                    ? 'VERIFICANDO'
                    : hasUpdate
                        ? 'DISPONIVEL'
                        : isError
                            ? 'ERRO'
                            : isNotConfigured
                                ? 'CONFIGURAR'
                                : 'ATUALIZADO';
            badge.dataset.state = status.status || 'idle';
        }

        if (title) {
            title.textContent = hasUpdate
                ? _t('sysUpdateAvailableTitle', 'Atualizacao disponivel')
                : _t('sysUpdateTitle', 'Atualizacoes do sistema');
        }

        if (sub) {
            sub.textContent = status.message || _t('sysUpdateIdle', 'Atualizacoes ainda nao verificadas.');
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
            const first = Array.isArray(status.changelog) ? status.changelog[0] : null;
            const items = first?.items || [];
            changelog.innerHTML = items.length
                ? items.slice(0, 3).map(item => `<li>${_esc(item)}</li>`).join('')
                : `<li>${_t('sysUpdateNoChangelog', '')}</li>`;
        }

        if (startBtn) {
            startBtn.classList.toggle('visible', hasUpdate);
            startBtn.style.display = hasUpdate ? '' : 'none';
        }
    }

    function _renderSettingsAccountHub(body) {
        const svgProfile = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
        const svgShare = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 10.6l6.8-4.2M8.6 13.4l6.8 4.2"/></svg>`;

        body.innerHTML = `
            <div class="nav-settings-subheader">
                <button class="nav-back-btn" id="setBackAccountHub" tabindex="-1">‹ ${_t('navBack', 'Voltar')}</button>
                <h2>${_t('navSetAccount', 'Conta e Perfil')}</h2>
            </div>
            <div class="nav-settings-grid">
                <button class="nav-settings-card" id="setProfileData" tabindex="-1">
                    <div class="settings-card-icon">${svgProfile}</div>
                    <div class="settings-card-info">
                        <h3>${_t('navAccountProfileData', 'Dados do perfil')}</h3>
                        <p>${_t('navAccountProfileDataDesc', 'Alterar avatar, nome e API Key')}</p>
                    </div>
                </button>
                <button class="nav-settings-card" id="setAccountSharing" tabindex="-1">
                    <div class="settings-card-icon">${svgShare}</div>
                    <div class="settings-card-info">
                        <h3>${_t('navSetSharing', 'Contas dos apps')}</h3>
                        <p>${_t('navSetSharingDesc', 'Dividir contas web por usuario, grupo ou todos')}</p>
                    </div>
                </button>
            </div>`;

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
                .nav-icon-btn { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 0 clamp(10px, 1.2vw, 16px); color: rgba(255,255,255,0.8); cursor: pointer; outline: none; transition: transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1), background-color 0.1s, border-color 0.1s, color 0.1s, box-shadow 0.15s; display: flex; align-items: center; justify-content: center; font-family: inherit; font-size: 0.9rem; font-weight: 500; }
                .nav-icon-btn.nav-focused-el { border-color: #fff; background: rgba(255,255,255,0.15); color: #fff; transform: scale(1.06); box-shadow: 0 8px 20px rgba(0,0,0,0.4); z-index: 10; position: relative;}
                .nav-btn-danger { color: #ff6b6b; border-color: rgba(255,107,107,0.3); width: 100%; padding: 14px; font-size: 1rem; }
                .nav-btn-danger.nav-focused-el { background: rgba(255,107,107,0.15); border-color: #ff6b6b; color: #fff; }
            `;
            document.head.appendChild(s);
        }

        let pendingName = _menuData.user.Name || '';
        let pendingApi = _menuData.user.SteamGridApiKey || '';
        let pendingPin = String(_menuData.user.PinCode || _menuData.user.pinCode || '');
        const photo = _menuData.user.PhotoBase64 || '';

        const maskApi = (key) => key ? key.slice(0, 6) + '••••••••' + key.slice(-4) : '—';

        const maskPin = (pin) => pin ? '*'.repeat(Math.min(4, pin.length)) : _t('setupPinPlaceholder', 'Sem PIN');

        const _saveProfileNow = (patch = {}) => {
            if (Object.prototype.hasOwnProperty.call(patch, 'name')) pendingName = patch.name;
            if (Object.prototype.hasOwnProperty.call(patch, 'apiKey')) pendingApi = patch.apiKey;
            if (Object.prototype.hasOwnProperty.call(patch, 'pin')) pendingPin = patch.pin;
            _menuData.user.Name = pendingName;
            _menuData.user.SteamGridApiKey = pendingApi;
            _menuData.user.PinCode = pendingPin;
            if (window._doorpiProfile) {
                window._doorpiProfile.Name = pendingName;
                window._doorpiProfile.SteamGridApiKey = pendingApi;
                window._doorpiProfile.PinCode = pendingPin;
            }
            if (typeof postToHost === 'function') {
                postToHost({
                    action: 'saveUserProfile',
                    name: pendingName,
                    apiKey: pendingApi,
                    pin: pendingPin,
                    photoBase64: _menuData.user.PhotoBase64 || '',
                    skipTasks: true
                });
            }
        };

        const _saveApiNow = (apiKey) => {
            pendingApi = apiKey;
            _saveProfileNow({ apiKey });
        };

        body.innerHTML = `
            <div class="nav-settings-subheader">
                <button class="nav-back-btn" id="setBack" tabindex="-1">‹ ${_t('navBack', 'Voltar')}</button>
                <h2>${_t('navSetAccount', 'Conta e Perfil')}</h2>
            </div>
            
            <div class="nav-profile-dashboard">
                <div class="nav-profile-avatar-sec">
                    <button class="nav-profile-photo" id="navProfilePhoto" tabindex="-1">
                        ${photo ? `<img src="data:image/png;base64,${photo}" />` : '◉'}
                    </button>
                    <span style="color:rgba(255,255,255,0.4); font-size: 0.85rem;">${_t('navAvatarChange', 'Alterar Avatar')}</span>
                </div>
                
                <div class="nav-profile-fields">
                    <div class="nav-profile-field">
                        <span class="nav-profile-field-label">${_t('navProfileNameLabel', 'Nome de Usuário')}</span>
                        <input class="nav-profile-field-input" id="navProfName" readonly value="${pendingName}" tabindex="-1" />
                    </div>

                    <div class="nav-profile-field" style="margin-top: 10px;">
                        <span class="nav-profile-field-label">${_t('navProfilePinLabel', 'PIN de acesso (opcional)')}</span>
                        <input class="nav-profile-field-input" id="navProfPin" type="password" readonly value="${maskPin(pendingPin)}" inputmode="numeric" pattern="[0-9]*" maxlength="4" tabindex="-1" />
                    </div>
                    
                    <div class="nav-profile-field" style="margin-top: 10px;">
                        <span class="nav-profile-field-label">${_t('navProfileApiLabel', 'Chave API SteamGridDB')}</span>
                        <div class="nav-api-row">
                            <input class="nav-profile-field-input" id="navProfApi" readonly value="${maskApi(pendingApi)}" tabindex="-1" style="flex:1;" />
                            <button class="nav-icon-btn" id="navApiPaste" tabindex="-1">${_t('btnPaste', 'Colar')}</button>
                            <button class="nav-icon-btn" id="navApiLink" tabindex="-1">${_t('btnViewKey', 'Ver Chave')}</button>
                        </div>
                    </div>
                    
                    <div style="display:flex; justify-content:flex-start; align-items:center; margin-bottom: 4px;">
                        <span id="navSaveStatus" style="color:#6ee696; font-size:0.95rem; font-weight:500; opacity:0; transition:opacity 0.3s;">${_t('toastChangesSaved', '✓ Alterações Salvas')}</span>
                    </div>

                    <button class="nav-icon-btn" id="navAccountSharing" tabindex="-1" style="width:100%; padding:14px; font-size:1rem;">${_t('navSetSharing', 'Contas dos apps')}</button>
                    <button class="nav-icon-btn nav-btn-danger" id="navDeleteUser" tabindex="-1" style="margin-top:12px;">${_t('btnDeleteProfile', 'Excluir Perfil')}</button>
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
        const sharingBtn = body.querySelector('#navAccountSharing');
        const deleteBtn = body.querySelector('#navDeleteUser');

        const _showSavedFeedback = () => {
            const status = document.getElementById('navSaveStatus');
            if (status) {
                status.style.opacity = '1';
                setTimeout(() => status.style.opacity = '0', 3000);
            }
        };

        photoBtn?.addEventListener('click', () => {
            if (typeof postToHost === 'function') postToHost({ action: 'pickProfilePhoto' });
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

        nameInput?.addEventListener('click', () => {
            nameInput.value = pendingName;
            nameInput.removeAttribute('readonly');
            window._vkbOpen?.(nameInput, {
                onOk: () => {
                    pendingName = nameInput.value.trim();
                    nameInput.value = pendingName;
                    nameInput.setAttribute('readonly', '');
                    window._vkbForceClose?.();

                    _saveProfileNow({ name: pendingName });
                    const topBtnName = document.querySelector('#btnTopProfile .top-profile-name');
                    if (topBtnName) topBtnName.textContent = pendingName;
                    _showSavedFeedback();
                },
                onCancel: () => {
                    nameInput.value = pendingName;
                    nameInput.setAttribute('readonly', '');
                    window._vkbForceClose?.();
                }
            });
        });

        pinInput?.addEventListener('click', () => {
            pinInput.value = pendingPin;
            pinInput.removeAttribute('readonly');
            window._vkbOpen?.(pinInput, {
                mode: 'numeric',
                onOk: () => {
                    const newPin = String(pinInput.value || '').replace(/\D/g, '').slice(0, 4);
                    pendingPin = newPin;
                    pinInput.value = maskPin(newPin);
                    pinInput.setAttribute('readonly', '');
                    window._vkbForceClose?.();
                    _saveProfileNow({ pin: newPin });
                    _showSavedFeedback();
                },
                onCancel: () => {
                    pinInput.value = maskPin(pendingPin);
                    pinInput.setAttribute('readonly', '');
                    window._vkbForceClose?.();
                }
            });
        });

        apiInput?.addEventListener('click', () => {
            apiInput.value = pendingApi;
            apiInput.removeAttribute('readonly');
            window._vkbOpen?.(apiInput, {
                onOk: () => {
                    const newKey = apiInput.value.trim();
                    apiInput.setAttribute('readonly', '');
                    window._vkbForceClose?.();
                    apiInput.value = maskApi(newKey);
                    _saveApiNow(newKey);
                    _showSavedFeedback();
                },
                onCancel: () => {
                    apiInput.value = maskApi(pendingApi);
                    apiInput.setAttribute('readonly', '');
                    window._vkbForceClose?.();
                }
            });
        });

        window._updatePendingApiKey = (keyText) => {
            const trimmed = keyText.trim();
            if (apiInput) apiInput.value = maskApi(trimmed);
            _saveApiNow(trimmed);
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
            if (mode === 'all') return _t('shareModeAll', 'Publico');
            if (mode === 'user') {
                const names = app.SharedWithUserNames || app.sharedWithUserNames || [];
                return names.length ? names.join(', ') : _t('shareModeUser', 'Usuarios');
            }
            return _t('shareModePrivate', 'Separado');
        };

        const userAvatar = (u) => (u.PhotoBase64 || u.photoBase64)
            ? `<img src="data:image/png;base64,${u.PhotoBase64 || u.photoBase64}" />`
            : _esc((_userName(u) || '?').charAt(0).toUpperCase());

        body.innerHTML = `
            <div class="nav-settings-subheader">
                <button class="nav-back-btn" id="setBackSharing" tabindex="-1">< ${_t('navBack', 'Voltar')}</button>
                <h2>${_t('accountSharingLabel', 'Compartilhamento de conta')}</h2>
            </div>
            ${isAdmin ? `
            <section class="nav-store-policy-section" aria-label="${_t('storePolicyTitle', 'Politicas de lojas')}">
                <div class="nav-store-policy-head">
                    <h3>${_t('storePolicyTitle', 'Politicas de lojas')}</h3>
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
                                    <strong>${_t('steamForceAccountSelection', 'Forcar selecao de usuario Steam')}</strong>
                                    <span>${_t('steamForceAccountSelectionDesc', 'Fecha e reabre a Steam antes de iniciar jogos para exibir o seletor de usuario.')}</span>
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
                ? _t('sharedByInfo', `Compartilhado por ${sharedFrom || _t('defaultOtherUser', 'outro usuario')}.`, sharedFrom || _t('defaultOtherUser', 'outro usuario'))
                : draftMode === 'all'
                    ? _t('shareStatusAll', 'Este app esta publico para todos os usuarios atuais e futuros.')
                    : draftMode === 'user'
                        ? (selectedNames.length ? _t('shareStatusUser', `Compartilhado com ${selectedNames.join(', ')}.`, selectedNames.join(', ')) : _t('shareStatusUserEmpty', 'Escolha um ou mais usuarios.'))
                        : _t('shareStatusPrivate', 'Este app usa uma conta separada para cada usuario.');

            panel.innerHTML = `
                <h3 class="nav-sharing-title">${_esc(appName)}</h3>
                <p class="nav-sharing-sub">${_esc(currentText)}</p>
                ${locked ? '' : `
                    <div class="nav-sharing-modes">
                        <button class="nav-sharing-mode ${draftMode === 'private' ? 'active' : ''}" data-mode="private" tabindex="-1">${_t('shareModePrivate', 'Separado por usuario')}</button>
                        <button class="nav-sharing-mode ${draftMode === 'user' ? 'active' : ''}" data-mode="user" tabindex="-1">${_t('shareModeUser', 'Usuarios especificos')}</button>
                        <button class="nav-sharing-mode ${draftMode === 'all' ? 'active' : ''}" data-mode="all" tabindex="-1">${_t('shareModeAll', 'Publico')}</button>
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
                    <button class="nav-sharing-save" id="navSharingSave" tabindex="-1" ${draftMode === 'user' && draftUsers.size === 0 ? 'disabled' : ''}>${_t('editModalSave', 'Salvar')}</button>
                    <div class="nav-sharing-note" id="navSharingNote"></div>
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
                .nav-sharing-tabs { max-width: 1180px; display: flex; gap: 8px; margin: 0 0 14px; }
                .nav-sharing-tab { min-height: 42px; min-width: 150px; padding: 0 16px; border-radius: 8px; border: 1px solid rgba(255,255,255,.1); background: rgba(255,255,255,.035); color: rgba(255,255,255,.74); font: inherit; outline: none; cursor: pointer; }
                .nav-sharing-tab.active { background: rgba(120,190,255,.10); border-color: rgba(120,190,255,.36); color: #fff; }
                .nav-sharing-tab.nav-focused-el { background: rgba(255,255,255,.15); border-color: #fff; box-shadow: 0 0 0 2px rgba(255,255,255,.18), 0 8px 20px rgba(0,0,0,.30); }
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
                { id: 'apps', label: _t('sharingTabApps', 'Streaming e midia') },
                { id: 'stores', label: _t('sharingTabStores', 'Lojas') }
            ]
            : [{ id: 'apps', label: _t('sharingTabApps', 'Streaming e midia') }];
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
            ? `<img src="data:image/png;base64,${u.PhotoBase64 || u.photoBase64}" />`
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
                ? _t('sharedByInfo', `Compartilhado por ${sharedFrom || _t('defaultOtherUser', 'outro usuario')}.`, sharedFrom || _t('defaultOtherUser', 'outro usuario'))
                : draftMode === 'all'
                    ? _t('shareStatusAll', 'Este app esta publico para todos os usuarios atuais e futuros.')
                    : draftMode === 'user'
                        ? (selectedNames.length ? _t('shareStatusUser', `Compartilhado com ${selectedNames.join(', ')}.`, selectedNames.join(', ')) : _t('shareStatusUserEmpty', 'Escolha um ou mais usuarios.'))
                        : _t('shareStatusPrivate', 'Este app usa uma conta separada para cada usuario.');

            panel.innerHTML = `
                <h3 class="nav-sharing-title">${_esc(appName)}</h3>
                <p class="nav-sharing-sub">${_esc(currentText)}</p>
                ${locked ? '' : `
                    <div class="nav-sharing-modes">
                        <button class="nav-sharing-mode ${draftMode === 'private' ? 'active' : ''}" data-mode="private" tabindex="-1">${_t('shareModePrivate', 'Separado por usuario')}</button>
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
                            <strong>${_t('steamForceAccountSelection', 'Forcar selecao de usuario Steam')}</strong>
                            <span>${_t('steamForceAccountSelectionDesc', 'Fecha e reabre a Steam antes de iniciar jogos para exibir o seletor de usuario.')}</span>
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
                .nav-ext-status { font-size: 0.9rem; color: rgba(255,255,255,0.5); margin: 16px 0 8px; min-height: 20px; }
                .nav-ext-status.error { color: #ff6b6b; }
                .nav-ext-list { display: flex; flex-direction: column; gap: 10px; margin-top: 10px; }
                .nav-ext-row {
                    display: flex; justify-content: space-between; align-items: center; gap: 14px;
                    background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); 
                    border-radius: 12px; padding: 14px 18px; color: #fff;
                }
                .nav-ext-info { display: flex; flex-direction: column; gap: 4px; }
                .nav-ext-info strong { font-size: 1rem; font-weight: 500; display:flex; align-items:center; gap:8px;}
                .nav-ext-info span { font-size: 0.85rem; color: rgba(255,255,255,0.4); }
                .nav-ext-actions { display: flex; gap: 8px; }
                
                .nav-ext-btn {
                    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px;
                    padding: 8px 12px; color: #fff; font-family: inherit; font-size: 0.85rem; cursor: pointer; outline: none; transition: transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1), background-color 0.1s, box-shadow 0.15s;
                }
                .nav-ext-btn.primary { background: #fff; color: #000; font-weight: 600; border-color: transparent;}
                .nav-ext-btn.danger { color: #ff6b6b; background: rgba(255,107,107,0.1); border-color: rgba(255,107,107,0.2); }
                
                .nav-ext-btn.nav-focused-el { transform: scale(1.06); box-shadow: 0 5px 15px rgba(0,0,0,0.3); border-color: #fff; background: rgba(255,255,255,0.15); color: #fff;}
                .nav-ext-btn.primary.nav-focused-el { background: #fff; color: #000; box-shadow: 0 0 15px rgba(255,255,255,0.4); }
                .nav-ext-btn.danger.nav-focused-el { background: #ff6b6b; color: #fff; border-color: #ff6b6b; }

                .nav-icon-btn.nav-btn-primary { background: #fff; color: #000; font-weight: 600; border-color: transparent; }
                .nav-icon-btn.nav-btn-primary.nav-focused-el { 
                    background: #e0e0e0; color: #000; border-color: #fff; 
                    box-shadow: 0 0 0 4px rgba(255,255,255,0.3), 0 8px 20px rgba(0,0,0,0.5); 
                }
            `;
            document.head.appendChild(s);
        }

        body.innerHTML = `
            <div class="nav-settings-subheader">
                <button class="nav-back-btn" id="setBackExt" tabindex="-1">‹ ${_t('navBack', 'Voltar')}</button>
                <h2>${_t('extManagerTitle', 'Gerenciador de Extensões')}</h2>
            </div>
            
            <div class="nav-profile-dashboard" style="flex-direction: column; gap: 10px;">
                <p style="color: rgba(255,255,255,0.5); font-size: 0.95rem; margin: 0 0 10px;">${_t('extManagerSubtitle', 'Adicione ou gerencie recursos adicionais do sistema.')}</p>
                
                <div class="nav-profile-fields" style="width: 100%; padding: 24px;">
                    <div class="nav-api-row">
                        <input class="nav-profile-field-input" id="navExtUrlInput" readonly placeholder="${_t('extManagerInputPlaceholder', 'Cole o link da extensão aqui...')}" tabindex="-1" style="flex:1;" />
                        <button class="nav-icon-btn" id="navExtPasteBtn" tabindex="-1">${_t('btnPaste', 'Colar')}</button>
                        <button class="nav-icon-btn" id="navExtStoreBtn" tabindex="-1">${_t('btnStore', 'Loja')}</button>
                        <button class="nav-icon-btn nav-btn-primary" id="navExtInstallBtn" tabindex="-1">${_t('btnInstall', 'Instalar')}</button>
                    </div>
                    
                    <div class="nav-ext-status" id="navExtensionStatus">${_t('loadingExtensions', 'Carregando extensões...')}</div>
                    
                    <div class="nav-ext-list" id="navExtensionsList"></div>
                </div>
            </div>`;

        _contentItems = [
            body.querySelector('#setBackExt'),
            body.querySelector('#navExtUrlInput'),
            body.querySelector('#navExtPasteBtn'),
            body.querySelector('#navExtStoreBtn'),
            body.querySelector('#navExtInstallBtn')
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

        body.querySelector('#navExtPasteBtn')?.addEventListener('click', () => {
            window._isPastingExtensionUrl = true;
            if (typeof postToHost === 'function') postToHost({ action: 'readClipboard' });
        });

        body.querySelector('#navExtStoreBtn')?.addEventListener('click', () => {
            window._isPastingExtensionUrl = true;
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

        const urlInput = body.querySelector('#navExtUrlInput');
        urlInput?.addEventListener('click', () => {
            urlInput.removeAttribute('readonly');
            window._vkbOpen?.(urlInput, {
                onOk: () => {
                    urlInput.setAttribute('readonly', '');
                    window._vkbForceClose?.();
                },
                onCancel: () => {
                    urlInput.setAttribute('readonly', '');
                    window._vkbForceClose?.();
                }
            });
        });

        body.querySelector('#navExtInstallBtn')?.addEventListener('click', () => {
            const url = urlInput?.value.trim();
            const status = document.getElementById('navExtensionStatus');
            if (!url) {
                if (status) { status.textContent = _t('extPasteLinkError', 'Insira um link válido.'); status.className = 'nav-ext-status error'; }
                return;
            }
            if (status) { status.textContent = _t('extInstallingStatus', 'Instalando...'); status.className = 'nav-ext-status'; }
            if (typeof postToHost === 'function') postToHost({ action: 'installExtension', url, successMsg: _t('extInstallSuccess', 'Extensão Instalada') });
        });

        window._renderNavExtensionsList = function (extensions, statusClass, message, updates) {
            const listEl = document.getElementById('navExtensionsList');
            const statusEl = document.getElementById('navExtensionStatus');
            if (!listEl) return;

            if (statusEl) {
                statusEl.textContent = message || (extensions.length ? _t('extInstalledCount', `${extensions.length} extensão(ões) instalada(s)`, extensions.length) : _t('extNoneInstalled', 'Nenhuma extensão instalada.'));
                statusEl.className = `nav-ext-status ${statusClass || ''}`.trim();
            }

            listEl.innerHTML = extensions.map(ext => {
                const updateVersion = updates[ext.Id];
                const hasUpdate = !!updateVersion;

                return `
                <div class="nav-ext-row">
                    <div class="nav-ext-info">
                        <strong>
                            ${(ext.Name || _t('extUnknown', 'Desconhecida')).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[ch]))}
                            ${hasUpdate ? '<span style="width:8px;height:8px;background:#ff4444;border-radius:50%;box-shadow: 0 0 6px #ff4444;"></span>' : ''}
                        </strong>
                        <span>
                            ${_t('extInstalled', 'Instalada')} (v${(ext.Version || '?.?.?').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[ch]))})
                            ${hasUpdate ? ` ➔ <strong style="color:#ff6e6e">v${updateVersion}</strong>` : ''}
                        </span>
                    </div>
                    <div class="nav-ext-actions">
                        ${hasUpdate ? `
                        <button class="nav-ext-btn primary" data-action="update" data-id="${ext.Id.replace(/"/g, '&quot;')}" tabindex="-1" title="${_t('btnUpdate', 'Atualizar')}">
                            ${_t('btnUpdate', 'Atualizar')}
                        </button>` : ''}
                        <button class="nav-ext-btn danger" data-action="delete" data-id="${ext.Id.replace(/"/g, '&quot;')}" tabindex="-1" title="${_t('btnRemove', 'Remover')}">
                            ${_t('btnRemove', 'Remover')}
                        </button>
                    </div>
                </div>`;
            }).join('');

            _contentItems = [
                document.getElementById('setBackExt'),
                document.getElementById('navExtUrlInput'),
                document.getElementById('navExtPasteBtn'),
                document.getElementById('navExtStoreBtn'),
                document.getElementById('navExtInstallBtn')
            ];

            listEl.querySelectorAll('.nav-ext-btn').forEach(btn => {
                _contentItems.push(btn);
                btn.addEventListener('click', () => {
                    const action = btn.dataset.action;
                    const id = btn.dataset.id;
                    if (action === 'update') window._doorpiUpdateExtension(id);
                    if (action === 'delete') window._doorpiDeleteExtension(id);
                });
            });

            _contentItems.forEach((el, idx) => {
                el?.addEventListener('mouseenter', () => {
                    _topbarFocus = false;
                    _contentIdx = idx;
                    _updateContentFocus();
                });
            });

            _updateContentFocus();
        };

        if (typeof postToHost === 'function') postToHost({ action: 'requestExtensions' });

        _contentItems.forEach((el, idx) => {
            el.addEventListener('mouseenter', () => {
                _topbarFocus = false;
                _contentIdx = idx;
                _updateContentFocus();
            });
        });
    }

    // ── Foco ──────────────────────────────────────────────────────────────────
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

            // Remove dos anteriores
            for (const card of _lg._cards) {
                if (card && card.classList.contains('nav-focused')) {
                    card.classList.remove('nav-focused');
                    card._stopInteraction?.();
                }
            }

            const card = _contentItems[globalIdx];
            if (card) {
         
                const cols = _gridCols();
                const container = card.closest('#navPaneGames, #navPaneMedia');

    
                if (globalIdx < cols && container) {
                   
                    if (container.scrollTop > 4) {
                        container.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                } else {
                    
                    const paneRect = container.getBoundingClientRect();
                    const cardRect = card.getBoundingClientRect();
                    const PADDING = 10; 

                    if (cardRect.bottom > paneRect.bottom - PADDING) {
                        
                        container.scrollBy({ top: cardRect.bottom - paneRect.bottom + PADDING, behavior: 'smooth' });
                    } else if (cardRect.top < paneRect.top + PADDING) {
                        
                        container.scrollBy({ top: cardRect.top - paneRect.top - PADDING, behavior: 'smooth' });
                    }
                }

             
                card.classList.add('nav-focused');
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
                focused.scrollIntoView({ block: 'center', behavior: 'smooth' });
            }
        }
    }

    function _gridCols() {
        const grid = document.querySelector('.nav-big-grid, .nav-settings-grid, .nav-profile-recent-grid');
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
        if (!window.isNavMenuOpen) return;

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
        if (window.isNavMenuOpen || _navMenuPhase !== 'closed' || window.isDoorpiSessionTransitionActive?.()) return;
        const lifecycleToken = ++_navMenuLifecycleToken;
        window.isNavMenuOpen = true;
        _navMenuPhase = 'opening';
        window._navMenuPhase = _navMenuPhase;

        document.body.classList.add('nav-menu-active');
        document.body.classList.remove('nav-menu-closing');

        const topProf = document.getElementById('btnTopProfile');
        if (topProf) topProf.classList.add('nav-menu-hidden');

        _lastFocus = document.activeElement;

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
        const lifecycleToken = ++_navMenuLifecycleToken;
        _navMenuPhase = 'closing';
        window._navMenuPhase = _navMenuPhase;

        document.body.classList.remove('nav-menu-active');
        document.body.classList.add('nav-menu-closing');
        
        const topProf = document.getElementById('btnTopProfile');
        if (topProf) topProf.classList.remove('nav-menu-hidden');

        _overlay?.classList.add('nav-menu-input-released');
        _releaseNavMenuInput(lifecycleToken);

        _runNavMenuTransition(() => {
            if (lifecycleToken !== _navMenuLifecycleToken || _navMenuPhase !== 'closing') return;
            if (_overlay) _overlay.style.display = 'none';
            _navMenuPhase = 'closed';
            window._navMenuPhase = _navMenuPhase;
            document.body.classList.remove('nav-menu-closing');
            _overlay?.classList.remove('nav-menu-input-released');
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

    window._navMenuHandleKey = function (key) {
        if (window._vkbIsOpen) return false;
        if (_navMenuPhase === 'closing') return false;
        if ((key === 'L1' || key === 'R1') && window._navMenuCycleSharingSubtab?.(key === 'R1' ? 1 : -1)) return true;
        if (key === 'L1') { window._navMenuCycleTab(-1); return true; }
        if (key === 'R1') { window._navMenuCycleTab(1); return true; }

        if (_topbarFocus) return _navTopbar(key) === true;
        return _navContent(key) === true;
    };

    document.addEventListener('keydown', e => {
        if (window.isDoorpiSessionTransitionActive?.()) {
            e.preventDefault();
            e.stopImmediatePropagation();
            return;
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
            else if (e.key === 'Enter') { document.activeElement?.click(); }
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
            if (typeof isCtxMenuOpen !== 'undefined' && isCtxMenuOpen) return;
            if (typeof isEditModalOpen !== 'undefined' && isEditModalOpen) return;

            e.preventDefault();
            e.stopImmediatePropagation();
            if (e.key === 'Escape' || e.key === 'Backspace') {
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
                    _contentIdx = 0;
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

    function _navContent(key) {
        const cols = _gridCols();
        const total = _contentItems.length;

        // Comportamento focado no Grid com o LazyLoading ativo (O(1) sem travamentos)
        if (_isLazyCat()) {
            switch (key) {
                case 'ArrowLeft':
                    if (_contentIdx > 0) { _contentIdx--; _updateContentFocus(); }
                    break;
                case 'ArrowRight':
                    if (_contentIdx < total - 1) { _contentIdx++; _updateContentFocus(); }
                    break;
                case 'ArrowUp':
                    if (_contentIdx < cols) { _setTopbarFocus(true); }
                    else { _contentIdx = Math.max(0, _contentIdx - cols); _updateContentFocus(); }
                    break;
                case 'ArrowDown':
                    if (_contentIdx + cols < total) { _contentIdx += cols; _updateContentFocus(); }
                    break;
                case 'Enter': {
                    const card = _contentItems[_contentIdx];
                    if (card) card.click();
                    return true;
                }
                case 'Escape': case 'Backspace':
                    _setTopbarFocus(true);
                    return true;
                case ' ': case 'Square':
                    window._navMenuTriggerCtxMenu();
                    return true;
            }
            return false;
        }

        // Navegação Complexa nos menus de Settings da Conta
        if (CATS[_catIdx]?.id === 'settings' && _settingsSubView === 'account') {
            const map = {
                0: { ArrowDown: 1, ArrowRight: 1 },
                1: { ArrowUp: 0, ArrowDown: 2, ArrowRight: 2 },
                2: { ArrowUp: 1, ArrowDown: 3, ArrowLeft: 1 },
                3: { ArrowUp: 2, ArrowDown: 4, ArrowLeft: 1 },
                4: { ArrowUp: 3, ArrowDown: 7, ArrowRight: 5, ArrowLeft: 1 },
                5: { ArrowUp: 3, ArrowDown: 7, ArrowLeft: 4, ArrowRight: 6 },
                6: { ArrowUp: 3, ArrowDown: 7, ArrowLeft: 5 },
                7: { ArrowUp: 4, ArrowDown: 8 },
                8: { ArrowUp: 7 }
            };

            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
                if (map[_contentIdx] && map[_contentIdx][key] !== undefined) {
                    _contentIdx = map[_contentIdx][key];
                    _updateContentFocus();
                } else if (key === 'ArrowUp' && _contentIdx === 0) { 
                    _setTopbarFocus(true);
                }
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
                const tabCount = document.querySelectorAll('.nav-sharing-tab').length;
                const listCount = document.querySelectorAll('.nav-sharing-app').length;
                const tabsStart = 1;
                const listStart = tabsStart + tabCount;
                const rightStart = listStart + listCount;
                const rightCount = Math.max(0, total - rightStart);
                const activeList = Array.from(document.querySelectorAll('.nav-sharing-app')).findIndex(el => el.classList.contains('active'));
                const activeListIdx = activeList >= 0 ? listStart + activeList : listStart;

                if (_contentIdx === 0) {
                    if (key === 'ArrowDown' || key === 'ArrowRight') _contentIdx = tabCount ? tabsStart : (listCount ? listStart : rightStart);
                    else if (key === 'ArrowUp') _setTopbarFocus(true);
                    _updateContentFocus();
                    return;
                }

                if (_contentIdx >= tabsStart && _contentIdx < listStart) {
                    if (key === 'ArrowLeft') _contentIdx = Math.max(tabsStart, _contentIdx - 1);
                    else if (key === 'ArrowRight') _contentIdx = Math.min(listStart - 1, _contentIdx + 1);
                    else if (key === 'ArrowUp') _contentIdx = 0;
                    else if (key === 'ArrowDown') _contentIdx = listCount ? listStart : (rightCount ? rightStart : _contentIdx);
                    _updateContentFocus();
                    return;
                }

                if (_contentIdx >= listStart && _contentIdx < rightStart) {
                    if (key === 'ArrowUp') _contentIdx = _contentIdx === listStart ? (tabCount ? tabsStart : 0) : _contentIdx - 1;
                    else if (key === 'ArrowDown') _contentIdx = _contentIdx < rightStart - 1 ? _contentIdx + 1 : _contentIdx;
                    else if (key === 'ArrowRight' && rightStart < total) _contentIdx = rightStart;
                    else if (key === 'ArrowLeft') _setTopbarFocus(true);
                    _updateContentFocus();
                    return;
                }

                if (_contentIdx >= rightStart) {
                    if (key === 'ArrowLeft') _contentIdx = listCount ? activeListIdx : (tabCount ? tabsStart : 0);
                    else if (key === 'ArrowUp') _contentIdx = _contentIdx === rightStart ? (tabCount ? tabsStart : 0) : _contentIdx - 1;
                    else if (key === 'ArrowDown') _contentIdx = Math.min(total - 1, _contentIdx + 1);
                    else if (key === 'ArrowRight') _contentIdx = Math.min(total - 1, _contentIdx + 1);
                    _updateContentFocus();
                    return;
                }
            }
        }

        if (CATS[_catIdx]?.id === 'settings' && _settingsSubView === 'extensions') {
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
                if (_contentIdx <= 4) {
                    const topMap = {
                        0: { ArrowDown: 1, ArrowRight: 1 },
                        1: { ArrowUp: 0, ArrowDown: 5, ArrowRight: 2 },
                        2: { ArrowUp: 0, ArrowDown: 5, ArrowLeft: 1, ArrowRight: 3 },
                        3: { ArrowUp: 0, ArrowDown: 5, ArrowLeft: 2, ArrowRight: 4 },
                        4: { ArrowUp: 0, ArrowDown: 5, ArrowLeft: 3 }
                    };
                    if (topMap[_contentIdx] && topMap[_contentIdx][key] !== undefined) {
                        let next = topMap[_contentIdx][key];
                        if (next >= _contentItems.length) next = _contentItems.length - 1; 
                        _contentIdx = next;
                        _updateContentFocus();
                    } else if (key === 'ArrowUp' && _contentIdx === 0) { 
                        _setTopbarFocus(true);
                    }
                }
                else {
                    if (key === 'ArrowUp') {
                        _contentIdx--;
                        if (_contentIdx < 4) _contentIdx = 1; 
                    }
                    else if (key === 'ArrowDown') {
                        if (_contentIdx < _contentItems.length - 1) _contentIdx++;
                    }
                    else if (key === 'ArrowLeft') {
                        if (_contentIdx > 4) _contentIdx--;
                    }
                    else if (key === 'ArrowRight') {
                        if (_contentIdx < _contentItems.length - 1) _contentIdx++;
                    }
                    _updateContentFocus();
                }
                return;
            }
        }

        if (CATS[_catIdx]?.id === 'settings' && _settingsSubView === 'system') {
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
                const items = _contentItems;
                const radios = items.filter(el => el.classList.contains('nav-radio-btn'));
                const cards = items.filter(el => el.classList.contains('nav-suggestion-card'));
                const btnDesktop = items.find(el => el.id === 'btnEnterDesktop');

                const backIdx = 0;
                const firstRadioIdx = items.indexOf(radios[0]);
                const lastRadioIdx = items.indexOf(radios[radios.length - 1]);
                const firstCardIdx = cards.length > 0 ? items.indexOf(cards[0]) : -1;
                const lastCardIdx = cards.length > 0 ? items.indexOf(cards[cards.length - 1]) : -1;
                const desktopIdx = items.indexOf(btnDesktop);

                const inCards = firstCardIdx !== -1 && _contentIdx >= firstCardIdx && _contentIdx <= lastCardIdx;

                if (key === 'ArrowUp') {
                    if (_contentIdx === backIdx) {
                        _setTopbarFocus(true);
                        return;
                    } else if (_contentIdx === firstRadioIdx) {
                        _contentIdx = backIdx;
                    } else if (_contentIdx > firstRadioIdx && _contentIdx <= lastRadioIdx) {
                        _contentIdx--; 
                    } else if (inCards) {
                        _contentIdx = lastRadioIdx; 
                    } else if (_contentIdx === desktopIdx) {
                        _contentIdx = firstCardIdx !== -1 ? firstCardIdx : lastRadioIdx;
                    }
                } else if (key === 'ArrowDown') {
                    if (_contentIdx === backIdx) {
                        _contentIdx = firstRadioIdx;
                    } else if (_contentIdx >= firstRadioIdx && _contentIdx < lastRadioIdx) {
                        _contentIdx++;
                    } else if (_contentIdx === lastRadioIdx) {
                        _contentIdx = firstCardIdx !== -1 ? firstCardIdx : desktopIdx;
                    } else if (inCards) {
                        _contentIdx = desktopIdx;
                    }
                } else if (key === 'ArrowLeft') {
                    if (inCards && _contentIdx > firstCardIdx) {
                        _contentIdx--;
                    }
                } else if (key === 'ArrowRight') {
                    if (inCards && _contentIdx < lastCardIdx) {
                        _contentIdx++;
                    }
                }

                _contentIdx = Math.max(0, Math.min(items.length - 1, _contentIdx));
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
                if (CATS[_catIdx]?.id === 'profile' && _contentIdx > 0) {
                    _contentIdx = 0; _updateContentFocus(); break;
                }
                if (_contentIdx < cols) { _setTopbarFocus(true); }
                else { _contentIdx = Math.max(0, _contentIdx - cols); _updateContentFocus(); }
                break;
            case 'ArrowDown':
                if (CATS[_catIdx]?.id === 'profile' && _contentIdx === 0 && total > 1) {
                    _contentIdx = 1; _updateContentFocus(); break;
                }
                if (_contentIdx + cols < total) { _contentIdx += cols; _updateContentFocus(); }
                break;
            case 'Enter': {
                const target = _contentItems[_contentIdx];
                if (target) target.click();
                break;
            }
            case 'Escape':
            case 'Backspace':
                if (CATS[_catIdx]?.id === 'settings' && _settingsSubView) {
                    _settingsSubView = (_settingsSubView === 'account' || _settingsSubView === 'sharing') ? 'accountHub' : null;
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

    // ── Bridge Update ─────────────────────────────────────────────────────────
    if (window.chrome?.webview) {
        window.chrome.webview.addEventListener('message', e => {
            try {
                const data = JSON.parse(e.data);

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
                
                if (data.type === 'autoStartState') {
                    _autoStartEnabled = !!data.enabled;
                    _updateAutoStartUI();
                }
                
                if (data.type === 'profilePhotoSelected' && data.base64) {
                    if (typeof isSetupOpen !== 'undefined' && isSetupOpen) return;

                    _menuData.user.PhotoBase64 = data.base64;
                    if (window._doorpiProfile) window._doorpiProfile.PhotoBase64 = data.base64;

                    const apiKey = _menuData.user.SteamGridApiKey || '';
                    const name = _menuData.user.Name || '';
                    postToHost({ action: 'saveUserProfile', name: name, apiKey: apiKey, photoBase64: data.base64, skipTasks: true });

                    if (!window.isNavMenuOpen) return;

                    const imgTag = `<img src="data:image/png;base64,${data.base64}" />`;

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

                if (data.type === 'showSetup') {
                    const open = () => {
                        window.DoorpiIntro?.finishHandoff?.();
                        if (window.isNavMenuOpen) close();
                        if (typeof openSetup === 'function') openSetup();
                    };
                    if (window.DoorpiIntro?.isRunning?.()) window.DoorpiIntro.runAfterIntro(open);
                    else open();
                }
            } catch { }
        });
    }

    // ── Context Menu no Nav ───────────────────────────────────────────────────
    window._navMenuTriggerCtxMenu = function () {
        if (!window.isNavMenuOpen) return;
        const catId = CATS[_catIdx]?.id;
        if (catId !== 'games' && catId !== 'media') return;

        // Ao usar Virtual Rendering, a referencia O(1) correta no DOM é essa:
        let focused = null;
        if (_isLazyCat()) {
            focused = _contentItems[_contentIdx];
        } else {
            focused = _contentItems[_contentIdx];
        }
        
        if (!focused) return;

        const r = focused.getBoundingClientRect();
        window._ctxMenuOpen?.(focused, r.right + 2, r.top);
    };

    // ── Expose ────────────────────────────────────────────────────────────────
    window.openNavMenu = open;
    window.closeNavMenu = close;
    window._navMenuCurrentUserChanged = function (user, currentUserId, userChanged = false) {
        _setMenuUserContext(user || {}, currentUserId || '', !!userChanged);
    };
    window._navMenuDataChanged = function (catId = 'games') {
        _reloadMenuAfterLibraryChange(catId);
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
