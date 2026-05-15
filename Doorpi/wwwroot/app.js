let allInstalledApps = [];
let cachedFolders = null;
let currentSourceFilter = ['all'];
let isFolderOperationInProgress = false;
window.newGameIdsThisSession = new Set();
window.recentlyOpenedIds = [];
window.isGlobalLoading = false;
window._doorpiUsers = [];
window._doorpiCurrentUserId = '';
window._pendingExtensionUpdates = {};
window._isBatchRendering = false;

const PLATFORMS = {
    Steam: {
        type: 'svg',
        icon: `<svg viewBox="0 0 24 24" fill="#1b9bd4" xmlns="http://www.w3.org/2000/svg"><path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.5 1.009 2.455-.397.957-1.497 1.41-2.454 1.012H7.54zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.663 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.265 2.265-1.253 0-2.265-1.014-2.265-2.265z"/></svg>`
    },
    Epic: {
        type: 'svg',
        icon: `<svg viewBox="0 0 24 24" fill="#a0a0a0" xmlns="http://www.w3.org/2000/svg"><path d="M3.537 0C2.165 0 1.66.506 1.66 1.879V18.44a4.262 4.262 0 00.02.433c.031.3.037.59.316.92.027.033.311.245.311.245.153.075.258.13.43.2l8.335 3.491c.433.199.614.276.928.27h.002c.314.006.495-.071.928-.27l8.335-3.492c.172-.07.277-.124.43-.2 0 0 .284-.211.311-.243.28-.33.285-.621.316-.92a4.261 4.261 0 00.02-.434V1.879c0-1.373-.506-1.88-1.878-1.88zm13.366 3.11h.68c1.138 0 1.688.553 1.688 1.696v1.88h-1.374v-1.8c0-.369-.17-.54-.523-.54h-.235c-.367 0-.537.17-.537.539v5.81c0 .369.17.54.537.54h.262c.353 0 .523-.171.523-.54V8.619h1.373v2.143c0 1.144-.562 1.71-1.7 1.71h-.694c-1.138 0-1.7-.566-1.7-1.71V4.82c0-1.144.562-1.709 1.7-1.709zm-12.186.08h3.114v1.274H6.117v2.603h1.648v1.275H6.117v2.774h1.74v1.275h-3.14zm3.816 0h2.198c1.138 0 1.7.564 1.7 1.708v2.445c0 1.144-.562 1.71-1.7 1.71h-.799v3.338h-1.4zm4.53 0h1.4v9.201h-1.4zm-3.13 1.235v3.392h.575c.354 0 .523-.171.523-.54V4.965c0-.368-.17-.54-.523-.54zm-3.74 10.147a1.708 1.708 0 01.591.108 1.745 1.745 0 01.49.299l-.452.546a1.247 1.247 0 00-.308-.195.91.91 0 00-.363-.068.658.658 0 00-.28.06.703.703 0 00-.224.163.783.783 0 00-.151.243.799.799 0 00-.056.299v.008a.852.852 0 00.056.31.7.7 0 00.157.245.736.736 0 00.238.16.774.774 0 00.303.058.79.79 0 00.445-.116v-.339h-.548v-.565H7.37v1.255a2.019 2.019 0 01-.524.307 1.789 1.789 0 01-.683.123 1.642 1.642 0 01-.602-.107 1.46 1.46 0 01-.478-.3 1.371 1.371 0 01-.318-.455 1.438 1.438 0 01-.115-.58v-.008a1.426 1.426 0 01.113-.57 1.449 1.449 0 01.312-.46 1.418 1.418 0 01.474-.309 1.58 1.58 0 01.598-.111 1.708 1.708 0 01.045 0zm11.963.008a2.006 2.006 0 01.612.094 1.61 1.61 0 01.507.277l-.386.546a1.562 1.562 0 00-.39-.205 1.178 1.178 0 00-.388-.07.347.347 0 00-.208.052.154.154 0 00-.07.127v.008a.158.158 0 00.022.084.198.198 0 00.076.066.831.831 0 00.147.06c.062.02.14.04.236.061a3.389 3.389 0 01.43.122 1.292 1.292 0 01.328.17.678.678 0 01.207.24.739.739 0 01.071.337v.008a.865.865 0 01-.081.382.82.82 0 01-.229.285 1.032 1.032 0 01-.353.18 1.606 1.606 0 01-.46.061 2.16 2.16 0 01-.71-.116 1.718 1.718 0 01-.593-.346l.43-.514c.277.223.578.335.9.335a.457.457 0 00.236-.05.157.157 0 00.082-.142v-.008a.15.15 0 00-.02-.077.204.204 0 00-.073-.066.753.753 0 00-.143-.062 2.45 2.45 0 00-.233-.062 5.036 5.036 0 01-.413-.113 1.26 1.26 0 01-.331-.16.72.72 0 01-.222-.243.73.73 0 01-.082-.36v-.008a.863.863 0 01.074-.359.794.794 0 01.214-.283 1.007 1.007 0 01.34-.185 1.423 1.423 0 01.448-.066 2.006 2.006 0 01.025 0zm-9.358.025h.742l1.183 2.81h-.825l-.203-.499H8.623l-.198.498h-.81zm2.197.02h.814l.663 1.08.663-1.08h.814v2.79h-.766v-1.602l-.711 1.091h-.016l-.707-1.083v1.593h-.754zm3.469 0h2.235v.658h-1.473v.422h1.334v.61h-1.334v.442h1.493v.658h-2.255zm-5.3.897l-.315.793h.624zm-1.145 5.19h8.014l-4.09 1.348z"/></svg>`
    },
    GOG: {
        type: 'svg',
        icon: `<svg viewBox="0 0 24 24" fill="#8a4fff" xmlns="http://www.w3.org/2000/svg"><path d="M7.15 15.24H4.36a.4.4 0 0 0-.4.4v2c0 .21.18.4.4.4h2.8v1.32h-3.5c-.56 0-1.02-.46-1.02-1.03v-3.39c0-.56.46-1.02 1.03-1.02h3.48v1.32zM8.16 11.54c0 .58-.47 1.05-1.05 1.05H2.63v-1.35h3.78a.4.4 0 0 0 .4-.4V6.39a.4.4 0 0 0-.4-.4H4.39a.4.4 0 0 0-.41.4v2.02c0 .23.18.4.4.4H6v1.35H3.68c-.58 0-1.05-.46-1.05-1.04V5.68c0-.57.47-1.04 1.05-1.04H7.1c.58 0 1.05.47 1.05 1.04v5.86zM21.36 19.36h-1.32v-4.12h-.93a.4.4 0 0 0-.4.4v3.72h-1.33v-4.12h-.93a.4.4 0 0 0-.4.4v3.72h-1.33v-4.42c0-.56.46-1.02 1.03-1.02h5.61v5.44zM21.37 11.54c0 .58-.47 1.05-1.05 1.05h-4.48v-1.35h3.78a.4.4 0 0 0 .4-.4V6.39a.4.4 0 0 0-.4-.4h-2.03a.4.4 0 0 0-.4.4v2.02c0 .23.18.4.4.4h1.62v1.35H16.9c-.58 0-1.05-.46-1.05-1.04V5.68c0-.57.47-1.04 1.05-1.04h3.43c.58 0 1.05.47 1.05 1.04v5.86zM13.72 4.64h-3.44c-.58 0-1.04.47-1.04 1.04v3.44c0 .58.46 1.04 1.04 1.04h3.44c.57 0 1.04-.46 1.04-1.04V5.68c0-.57-.47-1.04-1.04-1.04m-.3 1.75v2.02a.4.4 0 0 1-.4.4h-2.03a.4.4 0 0 1-.4-.4V6.4c0-.22.17-.4.4-.4H13c.23 0 .4.18.4.4zM12.63 13.92H9.24c-.57 0-1.03.46-1.03 1.02v3.39c0 .57.46 1.03 1.03 1.03h3.39c.57 0 1.03-.46 1.03-1.03v-3.39c0-.56-.46-1.02-1.03-1.02m-.3 1.72v2a.4.4 0 0 1-.4.4v-.01H9.94a.4.4 0 0 1-.4-.4v-1.99c0-.22.18-.4.4-.4h2c.22 0 .4.18.4.4zM23.49 1.1a1.74 1.74 0 0 0-1.24-.52H1.75A1.74 1.74 0 0 0 0 2.33v19.34a1.74 1.74 0 0 0 1.75 1.75h20.5A1.74 1.74 0 0 0 24 21.67V2.33c0-.48-.2-.92-.51-1.24m0 20.58a1.23 1.23 0 0 1-1.24 1.24H1.75A1.23 1.23 0 0 1 .5 21.67V2.33a1.23 1.23 0 0 1 1.24-1.24h20.5a1.24 1.24 0 0 1 1.24 1.24v19.34z"/></svg>`
    },
    Riot: {
        type: 'svg',
        icon: `<svg viewBox="0 0 24 24" fill="#eb0029" xmlns="http://www.w3.org/2000/svg"><path d="M13.458.86 0 7.093l3.353 12.761 2.552-.313-.701-8.024.838-.373 1.447 8.202 4.361-.535-.775-8.857.83-.37 1.591 9.025 4.412-.542-.849-9.708.84-.374 1.74 9.87L24 17.318V3.5Zm.316 19.356.222 1.256L24 23.14v-4.18l-10.22 1.256Z"/></svg>`
    },
    Folder: {
        type: 'svg',
        icon: `<svg viewBox="0 0 24 24" fill="#f0a500" xmlns="http://www.w3.org/2000/svg"><path d="M10.4 4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V6c0-1.1.9-2 2-2h5.4z"/></svg>`
    },
    Windows: {
        type: 'svg',
        icon: `<svg viewBox="0 0 88 88" fill="#0078d4" xmlns="http://www.w3.org/2000/svg"><path d="M0 12.4 35.7 7.6V42H0zm40.3-5.5L88 0v42H40.3zM0 46h35.7v34.4L0 75.6zm40.3.1H88V88L40.3 81.4z"/></svg>`
    },
};

const FILTER_SOURCES = {
    all: null,
    Steam: ['Steam'],
    Epic: ['Epic'],
    GOG: ['GOG'],
    Riot: ['Riot'],
    Windows: ['Windows', 'Folder'],
};

const SCAN_LIBS = ['Steam', 'Epic', 'GOG', 'Riot', 'Windows', 'Folder'];
// ── ANTI-WEB FIXES (Impede bordas brancas e força Loading na GPU corretamente) ───────────
(function applyAntiWebFixes() {
    const s = document.createElement('style');
    s.textContent = `
        /* 1. Elimina as bordas nativas do navegador em imagens vazias/carregando */
        img { 
            border: none !important; 
            outline: none !important; 
            color: transparent !important; 
            -webkit-user-drag: none; 
        }
        img:not([src]), img[src=""] { 
            visibility: hidden !important; 
        }

        /* 2. Joga a tela de Loading para a GPU (Placa de vídeo) SEM quebrar os giros */
        #systemLoadingOverlay, 
        #globalLoadingOverlay {
            will-change: opacity;
        }
        
        /* Apenas avisa o navegador para processar o giro separadamente, sem travar o eixo */
        .vb-ring, 
        .vb-ring-wrap {
            will-change: transform;
        }
    `;
    document.head.appendChild(s);
})();
// 🔹 INJEÇÃO DA FOTO DE PERFIL NO CANTO SUPERIOR ESQUERDO
(function injectTopProfile() {
    const btn = document.createElement('button');
    btn.id = 'btnTopProfile';
    btn.className = 'top-profile-btn';
    btn.tabIndex = 0;
    btn.innerHTML = `<div class="doorpi-avatar"></div><span class="top-profile-name"></span>`;
    document.body.appendChild(btn);

    btn.addEventListener('click', () => {
        postToHost({ action: 'requestUsers' });
    });

    const s = document.createElement('style');
    s.textContent = `
        .top-profile-btn {
            position: fixed;
            top: clamp(20px, 3vh, 40px);
            left: clamp(24px, 4vw, 60px);
            display: flex;
            align-items: center;
            gap: 18px;
            background: none;
            border: none;
            cursor: pointer;
            outline: none;
            z-index: 8000;
            padding: 0;
        }

        .top-profile-btn .doorpi-avatar {
            width: clamp(58px, 4.5vw, 74px);
            height: clamp(58px, 4.5vw, 74px);
            border-radius: 50%;
            background: rgb(255 255 255 / 0%);
            border: 2px solid rgba(255,255,255,0.15);
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            flex-shrink: 0;
            transition: transform 0.2s, border-color 0.2s, box-shadow 0.2s;
        }
        .top-profile-btn:focus .doorpi-avatar, .top-profile-btn:hover .doorpi-avatar {
            transform: scale(1.1);
            border-color: #fff;
        }
        .top-profile-btn img { width: 100%; height: 100%; object-fit: cover; }
        .top-profile-name {
            font-size: clamp(17px, 1vw, 19px);
            font-weight: 500;
            color: rgba(255,255,255,0.7);
            white-space: nowrap;
            filter: drop-shadow(1px 2px 1px black);
        }
        .top-profile-btn:focus .top-profile-name, .top-profile-btn:hover .top-profile-name {
            color: #fff;
        }
    `;
    document.head.appendChild(s);
})();
    

setInterval(() => {
    document.getElementById('clock').innerText = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}, 1000);

/* Seção: Ponte com o host */
window.chrome.webview.addEventListener('message', event => {
    try {
        const data = JSON.parse(event.data);
        console.log("Mensagem recebida no JS:", data);
        if (data.updates) {
            window._pendingExtensionUpdates = data.updates;
        }
        // 1. Quando o C# envia um ÚNICO jogo novo
        if (data.type === 'newGame') {
            const channel = (data.isMedia || data.tab === 'media' || data.appUrl !== undefined || data.appType !== undefined) ? 'media' : 'games';
            if (window.AppStore) window.AppStore.mutations.addItem(channel, data);
        }
        // 2. Quando o C# envia A LISTA COMPLETA de uma vez (Início do App)
        else if (data.type === 'renderGames') {
            if (window.AppStore) window.AppStore.mutations.setBatch('games', data.games || []);
        }
        // app.js — handler de mensagens do C#
        else if (data.type === 'windowFocused') {
            window.isMediaAppActive = false; // 🔹 Libera o gamepad loop
            if (!window._vkbIsOpen) {
                recoverGlobalFocus();
            }
        }
        else if (data.type === 'extensionsList' || data.type === 'extensionUpdatesList') {
            if (data.type === 'extensionUpdatesList') {
                window._pendingExtensionUpdates = data.updates || {};
            }
            // Atualiza a lista na nova interface do Nav Menu se estiver aberta
            if (document.getElementById('navExtensionsList')) {
                window._renderNavExtensionsList?.(data.extensions || [], data.status || '', data.message || '', window._pendingExtensionUpdates);
            }
        }
        else if (data.type === 'installedAppsList') {
            allInstalledApps = data.apps;
            refreshInstalledAppsView();
        }
        else if (data.type === 'installedAppsUpdated') {
            const modal = document.getElementById('addGameContainer');
            if (!modal || modal.style.display === 'none') return;
            allInstalledApps = data.apps;
            refreshInstalledAppsView();
        }
        else if (data.type === 'clearLoadingCards') {
            clearLoadingCards(data.tab || 'games');
            if (!data.tab) clearLoadingCards('media');
        }
        else if (data.type === 'showSetup') {
            if (typeof openSetup === 'function') openSetup();
        }
        else if (data.type === 'profilePhotoSelected') {
            window._setupHandlePhotoSelected?.(data.base64);
        }
        else if (data.type === 'setupFolderAdded') {
            window._setupHandleFolderAdded?.(data.path);
        }
        else if (data.type === 'browsersDetected') {
            window._setupRenderBrowsers?.(data.browsers);
        }
        // 1. Quando o C# manda limpar a grade (Ao iniciar ou resetar)
        else if (data.type === 'clearGamesGrid') {
            if (window.AppStore) window.AppStore.mutations.setBatch('games', []);
        }

        // 2. Quando o C# avisa que salvou a imagem estática localmente
        else if (data.type === 'staticSaved') {
            const patch = {};
            if (data.imageType === 'GridStatic') patch.staticVertical = data.newUrl;
            if (data.imageType === 'HorizontalStatic') patch.staticHorizontal = data.newUrl;
            if (data.imageType === 'HeroStatic') patch.staticHero = data.newUrl;
            if (data.imageType === 'LogoStatic') patch.staticLogo = data.newUrl;

            // Avisamos o Store da mudança. O Store avisa o Grid, e a imagem é atualizada sem piscar.
            if (window.AppStore.queries.hasItem('games', data.gameId)) {
                window.AppStore.mutations.patchItem('games', data.gameId, patch);
            } else if (window.AppStore.queries.hasItem('media', data.gameId)) {
                window.AppStore.mutations.patchItem('media', data.gameId, patch);
            }
        }
        else if (data.type === 'clearMediaGrid') {
            const grid = document.getElementById('mediaGrid');
            if (grid) {
                const btnAdd = document.getElementById('btnAddMedia');
                grid.innerHTML = '';
                if (btnAdd) grid.appendChild(btnAdd);
            }
        }
        else if (data.type === 'currentUserUpdated') {
            window._doorpiProfile = data.user;
            const btn = document.getElementById('btnTopProfile');
            if (btn) {
                const u = data.user;
                const avatar = btn.querySelector('.doorpi-avatar');
                const name = btn.querySelector('.top-profile-name');
                if (avatar) {
                    avatar.innerHTML = u?.PhotoBase64
                        ? `<img src="data:image/png;base64,${u.PhotoBase64}" />`
                        : (u?.Name ? u.Name.charAt(0).toUpperCase() : '•');
                }
                if (name) name.textContent = u?.Name ?? '';
            }
            if (typeof clearHero === 'function') clearHero();
        }
        else if (data.type === 'updateFeaturedCard') {
            // 🔹 Avisa o Store: ele reordena o carrossel E atualiza o hero automaticamente
            if (window.AppStore) window.AppStore.mutations.trackOpened(data.id);
        }
        else if (data.type === 'updateLoadingText') {
            if (window.isGlobalLoading) {
                showGlobalLoading(data.title, data.subtitle);
            }
        }
        else if (data.type === 'foldersList') {
            cachedFolders = data.folders;
            renderFolderList(cachedFolders);
        }
        else if (data.type === 'hideLoading' || data.type === 'hideSystemLoading') {
            hideGlobalLoading();
            isFolderOperationInProgress = false;
        }
        else if (data.type === 'usersList') {
            window._doorpiUsers = data.users || [];
            window._doorpiCurrentUserId = data.currentUserId || '';
            showUserPicker(data.users || [], !!data.requireSelection);
        }
        else if (data.type === 'clipboardText') {
            if (data.text?.trim()) {
                // Intercepta a colagem no Nav Menu de Conta/Perfil
                if (window._isPastingApiKey) {
                    window._isPastingApiKey = false;
                    if (typeof window._updatePendingApiKey === 'function') {
                        window._updatePendingApiKey(data.text.trim());
                    }
                }
                // Intercepta a colagem no Nav Menu de Extensões
                else if (window._isPastingExtensionUrl || (document.getElementById('navExtUrlInput') && data.text.includes('chromewebstore'))) {
                    window._isPastingExtensionUrl = false;
                    const input = document.getElementById('navExtUrlInput');
                    if (input) {
                        input.value = data.text.trim();
                        const btnInstall = document.getElementById('navExtInstallBtn');
                        if (btnInstall) {
                            btnInstall.focus();
                            // Força o foco devido ao delay do navegador que fecha após ler o clipboard
                            setTimeout(() => { if (document.getElementById('navExtUrlInput')) btnInstall.focus(); }, 1900);
                            setTimeout(() => { if (document.getElementById('navExtUrlInput')) btnInstall.focus(); }, 2300);
                        }
                    }
                }
                // Configuração Inicial (Setup)
                else if (typeof isSetupOpen !== 'undefined' && isSetupOpen) {
                    const input = document.getElementById('setupApiInput');
                    if (input) {
                        input.value = data.text.trim();
                        if (typeof _currUser !== 'undefined' && _currUser) _currUser.apiKey = data.text.trim();
                        const hint = document.getElementById('setupApiHint');
                        if (hint) hint.textContent = typeof t === 'function' ? t('setupStep3PasteSuccess') : 'Copiado com sucesso!';
                        if (typeof _updateStatus === 'function') _updateStatus();
                        document.getElementById('btnSetupFinish')?.focus();
                    }
                }
            }
        }
        else if (document.getElementById('doorpiExtensionsManager')?.style.display !== 'none' && document.getElementById('extensionUrlInput')) {
            const input = document.getElementById('extensionUrlInput');
            input.value = data.text.trim();

            const btnInstall = document.getElementById('btnInstallExtension');
            if (btnInstall) {
                // Tenta focar imediatamente
                btnInstall.focus();

                // Força o foco exatamente após o fechamento da janela da loja (que leva 1800ms)
                setTimeout(() => {
                    if (document.getElementById('doorpiExtensionsManager')?.style.display !== 'none') {
                        btnInstall.focus();
                    }
                }, 1900);

                // Margem de segurança extra para casos onde o PC demore a renderizar o retorno
                setTimeout(() => {
                    if (document.getElementById('doorpiExtensionsManager')?.style.display !== 'none') {
                        btnInstall.focus();
                    }
                }, 2300);
            } else {
                input.focus();
            }
        }



        window._mediaHandleMessage?.(data);
    } catch (e) { console.error('[bridge] Erro:', e); }
});
function recoverGlobalFocus() {
    // 1. Prioridade: Se tem um Modal de Adicionar aberto, foca nos botões dele
    if (window.isModalOpen) {
        const btn = document.querySelector('#btnAddWebApp') || document.querySelector('#btnConfirmAdd') || document.querySelector('#btnConfirmAddMedia');
        if (btn && btn.style.display !== 'none') { btn.focus(); return; }
    }

    // 2. Prioridade: Se o usuário estiver na tela principal (jogos ou mídia)
    const currentTab = (typeof window.getCurrentHomeTab === 'function') ? window.getCurrentHomeTab() : 'games';
    const gridId = currentTab === 'media' ? 'mediaGrid' : 'gameGrid';
    const grid = document.getElementById(gridId);

    // Tenta focar no Card Featured ou no primeiro card da lista
    if (grid) {
        const target = grid.querySelector('.card.featured') || grid.querySelector('.card:not(.add-card)');
        if (target) {
            target.focus();
            return;
        }
    }

    // 3. Fallback: Qualquer coisa clicável na tela
    const fallback = document.querySelector('button, [tabindex="0"]');
    if (fallback) fallback.focus();
}
function postToHost(payload) {
    window.chrome?.webview?.postMessage(JSON.stringify(payload));
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[ch]));
}

function ensureDoorpiOverlayStyles() {
    if (document.getElementById('doorpiOverlayStyles')) return;
    const s = document.createElement('style');
    s.id = 'doorpiOverlayStyles';
    s.textContent = `
    .doorpi-user-overlay, .doorpi-manager-overlay {
        position: fixed; inset: 0; z-index: 9200;
        background: rgba(6, 6, 14, 0.75);
        backdrop-filter: blur(40px) saturate(1.5);
        -webkit-backdrop-filter: blur(40px) saturate(1.5);
        display: flex; align-items: center; justify-content: center;
        padding: clamp(24px, 5vw, 60px); box-sizing: border-box;
        animation: doorpiOverlayFadeIn 0.4s cubic-bezier(0.22, 1, 0.36, 1) forwards;
    }
    @keyframes doorpiOverlayFadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }

    .doorpi-user-panel {
        width: 100%; max-width: 1200px;
        display: flex; flex-direction: column; align-items: center; gap: clamp(30px, 4vw, 50px);
    }
    .doorpi-manager-panel {
        width: min(980px, 94vw); max-height: 86vh;
        display: flex; flex-direction: column; gap: 22px;
        background: rgba(16, 16, 28, 0.6);
        padding: clamp(24px, 3vw, 40px);
        border-radius: clamp(16px, 2vw, 24px);
        border: 1px solid rgba(255,255,255,0.1);
        box-shadow: 0 24px 64px rgba(0,0,0,0.5);
    }

    .doorpi-panel-head { width: 100%; display: flex; justify-content: space-between; gap: 18px; align-items: flex-start; }
    .doorpi-user-panel .doorpi-panel-head { flex-direction: column; align-items: center; text-align: center; justify-content: center; }
    
    .doorpi-panel-title {
        font-size: clamp(2.4rem, 4.2vw, 5.4rem);
        font-weight: 200;
        letter-spacing: -0.03em;
        color: #ffffff;
        margin: 0;
        line-height: 1.05;
        text-shadow: 0 2px 40px rgba(80,100,255,0.25);
    }
    .doorpi-panel-sub {
        font-size: clamp(0.95rem, 1.1vw, 1.4rem);
        color: rgba(255,255,255,0.55);
        margin: clamp(10px, 1.2vw, 16px) 0 0;
        line-height: 1.6;
        font-weight: 300;
    }

    /* MANAGER STYLES */
    .doorpi-manager-panel .doorpi-panel-title { font-size: clamp(2rem, 3vw, 3rem); text-align: left; }
    .doorpi-manager-panel .doorpi-panel-sub { text-align: left; }
    .doorpi-manager-row { background: rgba(255,255,255,.075); border: 1px solid rgba(255,255,255,.13); border-radius: 12px; color: #fff; padding: 14px 16px; display: flex; align-items: center; justify-content: space-between; gap: 14px; }
    .doorpi-manager-form { display: grid; grid-template-columns: 1fr auto auto auto; gap: 10px; }
    .doorpi-manager-input, .doorpi-choice-trigger { background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.16); border-radius: 12px; color: #fff; font: inherit; padding: 13px 16px; outline: none; box-sizing: border-box; transition: all 0.2s; }
    .doorpi-manager-input:focus, .doorpi-choice-trigger:focus, .doorpi-manager-btn:focus, .doorpi-manager-btn:hover { border-color: #fff; box-shadow: 0 0 0 4px rgba(255,255,255,1); background: rgba(255,255,255,0.1); }
    .doorpi-choice-wrap { position: relative; }
    .doorpi-choice-trigger { width: 100%; min-height: 50px; display: flex; align-items: center; justify-content: space-between; gap: 12px; text-align: left; cursor: pointer; }
    .doorpi-choice-trigger::after { content: 'v'; font-size: .8rem; color: rgba(255,255,255,.58); }
    .doorpi-choice-wrap.is-disabled { opacity: .48; pointer-events: none; }
    .doorpi-choice-wrap.is-open .doorpi-choice-trigger, .doorpi-choice-option:focus { border-color: #fff; box-shadow: 0 0 0 4px rgba(255,255,255,.15); }
    .doorpi-choice-menu { display: none; position: absolute; z-index: 4; left: 0; right: 0; top: calc(100% + 6px); background: #1a1a2e; border: 1px solid rgba(255,255,255,.18); border-radius: 12px; padding: 6px; box-shadow: 0 18px 40px rgba(0,0,0,.42); }
    .doorpi-choice-wrap.is-open .doorpi-choice-menu { display: flex; flex-direction: column; gap: 4px; }
    .doorpi-choice-option { background: transparent; border: 1px solid transparent; border-radius: 8px; color: #fff; font: inherit; text-align: left; padding: 11px 12px; cursor: pointer; outline: none; transition: background 0.15s; }
    .doorpi-choice-option:hover, .doorpi-choice-option.is-selected { background: rgba(255,255,255,.11); }
    .doorpi-share-select { display: none; }

    .doorpi-manager-btn { background: rgba(255,255,255,.10); border: 1px solid rgba(255,255,255,.16); border-radius: 12px; color: #fff; font: inherit; font-weight: 600; padding: 12px 20px; cursor: pointer; outline: none; transition: all 0.2s; }
    .doorpi-manager-btn.primary { background: #fff; color: #07071a; border-color: transparent; transition: background 0.1s, color 0.1s; }
    .doorpi-manager-btn.primary:hover { background: #e8e8e8; color: #07071a; border-color: transparent; box-shadow: none; }
    .doorpi-manager-btn.primary:focus { background: #fff; outline: 3px solid #fff; outline-offset: 3px; box-shadow: none; transition: none !important; }
    .doorpi-manager-list { display: flex; flex-direction: column; gap: 10px; overflow: auto; padding-right: 4px; }

    .doorpi-status { min-height: 20px; color: rgba(255,255,255,.62); }
    .doorpi-status.error { color: rgba(255,110,110,.95); }
    .doorpi-status.success { color: rgba(110,230,150,.95); }
    .doorpi-share-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 14px; }
    .doorpi-shared-note { font-size: .85rem; color: rgba(120,190,255,.9); margin-top: 8px; }

/* USER CARDS STYLES */
.doorpi-user-grid {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: clamp(32px, 4vw, 64px);
    width: 100%;
}

.doorpi-user-card {
    background: none;
    border: none;
    color: #fff;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: clamp(14px, 1.6vw, 20px);
    cursor: pointer;
    outline: none;
    padding: 0;
    transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    position: relative;
    animation: doorpiCardRise 0.5s cubic-bezier(0.16, 1, 0.3, 1) backwards;
    will-change: transform;
}

@keyframes doorpiCardRise {
    from { opacity: 0; translate: 0 24px; }
    to { opacity: 1; translate: 0 0; }
}

.doorpi-user-card:focus,
.doorpi-user-card:hover {
    transform: translateY(-8px) scale(1.06);
}

.doorpi-avatar {
    width: clamp(170px, 12vw, 220px);
    height: clamp(170px, 12vw, 220px);
    border-radius: 50%;
    background: rgba(255,255,255,0.08);
    border: 3px solid rgba(255,255,255,0.15);
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    color: rgba(255,255,255,0.45);
    font-size: clamp(38px, 5vw, 58px);
    transition: border-color 0.25s, box-shadow 0.25s;
    position: relative;
    z-index: 2;
}

.doorpi-user-card:focus .doorpi-avatar,
.doorpi-user-card:hover .doorpi-avatar {
    border-color: #fff;

}

.doorpi-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.doorpi-user-name {
    font-size: clamp(1rem, 1.2vw, 1.3rem);
    font-weight: 500;
    text-align: center;
    letter-spacing: 0.02em;
    color: rgba(255,255,255,0.65);
    transition: color 0.2s;
    z-index: 2;
}

.doorpi-user-card:focus .doorpi-user-name,
.doorpi-user-card:hover .doorpi-user-name {
    color: #fff;
}

.doorpi-user-badge {
    font-size: 0.65rem;
    font-weight: 800;
    color: rgba(16, 25, 20, 0.95);
    background: rgba(120, 220, 150, 0.95);
    padding: 3px 9px;
    border-radius: 12px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    box-shadow: 0 4px 10px rgba(0,0,0,0.3);
    margin-top: -6px;
}

.doorpi-create-user-icon {
    font-size: clamp(40px, 5vw, 58px);
    font-weight: 200;
    color: rgba(255,255,255,0.35);
    transition: color 0.3s, transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    line-height: 1;
}

.doorpi-user-card.create-card .doorpi-avatar {
    border-style: dashed;
    border-color: rgba(255,255,255,0.2);
    background: rgba(255,255,255,0.03);
}

.doorpi-user-card.create-card:focus .doorpi-avatar,
.doorpi-user-card.create-card:hover .doorpi-avatar {
    border-color: rgba(255,255,255,0.6);
}

.doorpi-user-card.create-card:focus .doorpi-create-user-icon,
.doorpi-user-card.create-card:hover .doorpi-create-user-icon {
    color: #fff;
    transform: rotate(90deg) scale(1.1);
}



    @media(max-width: 760px) {
        .doorpi-manager-form, .doorpi-share-grid { grid-template-columns: 1fr; }
        .doorpi-user-overlay, .doorpi-manager-overlay { padding: 24px; }
        .doorpi-user-panel .doorpi-panel-title { font-size: 2.5rem; }
    }
    `;
    document.head.appendChild(s);
}

function renderDoorpiChoice(id, options, value, disabled = false) {
    const safeOptions = Array.isArray(options) && options.length
        ? options
        : [{ value: '', label: t('noOptionsAvailable') }];
    const selected = safeOptions.find(opt => String(opt.value) === String(value)) || safeOptions[0];
    return `
        <div class="doorpi-choice-wrap${disabled ? ' is-disabled' : ''}" id="${escapeHtml(id)}" data-value="${escapeHtml(selected.value)}" data-disabled="${disabled ? 'true' : 'false'}">
            <button class="doorpi-choice-trigger" type="button" tabindex="0" aria-haspopup="listbox" aria-expanded="false">
                <span>${escapeHtml(selected.label)}</span>
            </button>
            <div class="doorpi-choice-menu" role="listbox">
                ${safeOptions.map(opt => `
                    <button class="doorpi-choice-option${String(opt.value) === String(selected.value) ? ' is-selected' : ''}" type="button" tabindex="0" data-value="${escapeHtml(opt.value)}" role="option">
                        ${escapeHtml(opt.label)}
                    </button>
                `).join('')}
            </div>
        </div>
    `;
}

function bindDoorpiChoice(root, onChange) {
    if (!root) return;
    const trigger = root.querySelector('.doorpi-choice-trigger');
    const options = Array.from(root.querySelectorAll('.doorpi-choice-option'));
    const setOpen = (open) => {
        if (root.dataset.disabled === 'true') return;
        root.classList.toggle('is-open', open);
        trigger?.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (open) {
            const selected = root.querySelector('.doorpi-choice-option.is-selected') || options[0];
            selected?.focus({ preventScroll: true });
        }
    };
    trigger?.addEventListener('click', () => setOpen(!root.classList.contains('is-open')));
    options.forEach(option => {
        option.addEventListener('click', () => {
            const value = option.dataset.value || '';
            const label = option.textContent.trim();
            root.dataset.value = value;
            trigger.querySelector('span').textContent = label;
            options.forEach(opt => opt.classList.toggle('is-selected', opt === option));
            setOpen(false);
            trigger.focus({ preventScroll: true });
            onChange?.(value);
        });
    });
}

function setDoorpiChoiceDisabled(id, disabled) {
    const root = document.getElementById(id);
    if (!root) return;
    root.dataset.disabled = disabled ? 'true' : 'false';
    root.classList.toggle('is-disabled', disabled);
    root.classList.remove('is-open');
    root.querySelector('.doorpi-choice-trigger')?.setAttribute('aria-expanded', 'false');
}

function getDoorpiChoiceValue(id) {
    return document.getElementById(id)?.dataset.value || '';
}

function avatarMarkup(user) {
    return `<div class="doorpi-avatar">${user.PhotoBase64 ? `<img src="data:image/png;base64,${user.PhotoBase64}" />` : `<svg viewBox="0 0 24 24" width="40" height="40" stroke="currentColor" fill="none" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>`}</div>`;
}

function showUserPicker(users, requireSelection = false) {
    ensureDoorpiOverlayStyles();
    let overlay = document.getElementById('doorpiUserPicker');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'doorpiUserPicker';
        overlay.className = 'doorpi-user-overlay';
        document.body.appendChild(overlay);
    }
    overlay.dataset.required = requireSelection ? 'true' : 'false';

    const cards = users.map((user, idx) => `
    <button class="doorpi-user-card" data-user-id="${escapeHtml(user.Id)}" tabindex="0" style="animation-delay: ${idx * 0.06}s">
        ${avatarMarkup(user)}
        <span class="doorpi-user-name">${escapeHtml(user.Name)}</span>
        ${user.Id === window._doorpiCurrentUserId ? `<span class="doorpi-user-badge">${t('badgeCurrent')}</span>` : ''}
    </button>`).join('');

    const createUserDelay = users.length * 0.05;

    overlay.innerHTML = `
        <div class="doorpi-user-panel">
            <div class="doorpi-panel-head">
                <h2 class="doorpi-panel-title" data-i18n="whoIsPlaying">${t('whoIsPlaying')}</h2>
                <p class="doorpi-panel-sub" data-i18n="welcomeBack">${t('welcomeBack')}</p>
            </div>
            <div class="doorpi-user-grid">
                ${cards}
                <button class="doorpi-user-card create-card" id="doorpiCreateUserCard" tabindex="0" style="animation-delay: ${createUserDelay}s">
                    <div class="doorpi-avatar">
                        <div class="doorpi-create-user-icon">+</div>
                    </div>
                    <span class="doorpi-user-name" data-i18n="newUser">${t('newUser')}</span>
                </button>
            </div>
            ${requireSelection ? '' : '<button class="doorpi-manager-btn" id="doorpiCloseUsers" style="margin-top: 30px; animation: doorpiCardRise 0.5s backwards; animation-delay: ' + (createUserDelay + 0.1) + 's">' + t('btnBackLabel') + '</button>'}
        </div>`;

    if (typeof applyI18n === 'function') applyI18n();

    overlay.style.display = 'flex';

    if (document.activeElement && document.activeElement !== document.body) {
        document.activeElement.blur();
    }

    overlay.querySelectorAll('[data-user-id]').forEach(btn => {
        btn.addEventListener('click', () => {
            postToHost({ action: 'selectUser', userId: btn.dataset.userId });
            overlay.style.display = 'none';
        });
    });
    overlay.querySelector('#doorpiCreateUserCard')?.addEventListener('click', () => {
        overlay.style.display = 'none';
        openCreateUserDialog();
    });
    overlay.querySelector('#doorpiCloseUsers')?.addEventListener('click', () => overlay.style.display = 'none');

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            overlay.querySelector('.doorpi-user-card')?.focus();
        });
    });
}

function openCreateUserDialog() {
    window.closeDoorpiTopOverlay?.(true);
    if (typeof openSetup === 'function') {
        openSetup(true);
    }
}
window.openExtensionsManager = function () {
    // Se o Nav Menu estiver fechado, manda abrir
    if (!window.isNavMenuOpen) {
        if (typeof window.openNavMenu === 'function') {
            window.openNavMenu();
        }
    }
    setTimeout(() => {
        if (typeof window._navMenuOpenExtensions === 'function') {
            window._navMenuOpenExtensions();
        }
    }, 120);
};

window.openCreateUserDialog = openCreateUserDialog;

// Handler global para atualizar extensões
window._doorpiUpdateExtension = function (extId) {
    // 1. Altera o texto de Status global
    const statusEl = document.getElementById('navExtensionStatus');
    if (statusEl) {
        statusEl.textContent = typeof t === 'function' ? t('extDownloadingUpdate') : "Baixando atualização...";
        statusEl.className = 'nav-ext-status';
    }

    // 2. Altera visualmente o botão específico que foi clicado
    const btn = document.querySelector(`.nav-ext-btn.primary[data-id="${extId}"]`);
    if (btn) {
        btn.textContent = typeof t === 'function' ? t('extUpdatingBtn') : "Atualizando...";
        btn.style.opacity = "0.5";
        btn.style.pointerEvents = "none";
    }

    // 3. Pede pro C# fazer a atualização
    postToHost({ action: 'updateExtension', id: extId });
};
// Handler global para remover extensões
window._doorpiDeleteExtension = function (extId) {
    postToHost({ action: 'deleteExtension', id: extId });
    setTimeout(() => { postToHost({ action: 'requestExtensions' }); }, 500);
};


window.openExtensionsManager = openExtensionsManager;
window.openCreateUserDialog = openCreateUserDialog;

window.isDoorpiOverlayOpen = function () {
    return Array.from(document.querySelectorAll('.doorpi-user-overlay, .doorpi-manager-overlay'))
        .some(el => el.style.display !== 'none' && el.offsetWidth > 0 && el.offsetHeight > 0);
};

document.addEventListener('focusin', (e) => {
    if (window.isDoorpiOverlayOpen && window.isDoorpiOverlayOpen()) {
        const overlays = Array.from(document.querySelectorAll('.doorpi-user-overlay, .doorpi-manager-overlay'))
            .filter(el => el.style.display !== 'none' && el.offsetWidth > 0 && el.offsetHeight > 0);
        const topOverlay = overlays.at(-1);

        if (topOverlay && !topOverlay.contains(e.target)) {
            const focusable = topOverlay.querySelector('button, input, select,[tabindex="0"]');
            if (focusable) {
                focusable.focus();
            }
        }
    }
});

window.getDoorpiOverlayItems = function () {
    const overlays = Array.from(document.querySelectorAll('.doorpi-user-overlay, .doorpi-manager-overlay'))
        .filter(el => el.style.display !== 'none' && el.offsetWidth > 0 && el.offsetHeight > 0);
    const top = overlays.at(-1);
    if (!top) return [];
    return Array.from(top.querySelectorAll('button, input, select, [tabindex="0"]'))
        .filter(el => !el.disabled && el.offsetWidth > 0 && el.offsetHeight > 0);
};

window.closeDoorpiTopOverlay = function (force = false) {
    const overlays = Array.from(document.querySelectorAll('.doorpi-user-overlay, .doorpi-manager-overlay'))
        .filter(el => el.style.display !== 'none' && el.offsetWidth > 0 && el.offsetHeight > 0);
    const top = overlays.at(-1);
    if (!force && top?.dataset.required === 'true') return;
    if (top) top.style.display = 'none';
};

document.addEventListener('click', (e) => {
    const input = e.target.closest?.('input[type="text"], input:not([type]), textarea');
    if (!input) return;
    if (window._vkbIsOpen) return;
    if (input.closest('.doorpi-manager-overlay, .doorpi-user-overlay, .edit-modal-overlay, #addGameContainer, #setupContainer, .nav-profile-dashboard')) {
        input.removeAttribute('readonly');
        window._vkbOpen?.(input);
    }
}, true);

document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || window._vkbIsOpen) return;
    const input = e.target.closest?.('input[type="text"], input:not([type]), textarea');
    if (!input) return;
    if (input.closest('.doorpi-manager-overlay, .doorpi-user-overlay, .edit-modal-overlay, #addGameContainer, #setupContainer, .nav-profile-dashboard')) {
        e.preventDefault();
        input.removeAttribute('readonly');
        window._vkbOpen?.(input);
    }
}, true);

/* Seção: Overlay de Loading */
function showGlobalLoading(titleText, subtitleText) {
    window.isGlobalLoading = true;
    window.updateNavHint?.();
    let overlay = document.getElementById('globalLoadingOverlay');

    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'globalLoadingOverlay';
        overlay.className = 'global-loading-overlay';
        document.querySelector('.modal-content-area').appendChild(overlay);
    }

    const libs = SCAN_LIBS.map((k, i) => `<div class="vb-lib ${i === 0 ? 'scanning' : ''}">${t('scanLibLabels.' + k)}</div>`).join('');

    overlay.innerHTML = `
        <div class="vb-wrap">
            <div class="vb-scanline"></div>
            <div class="vb-ghost-grid">${'<div class="vb-ghost-tile"></div>'.repeat(15)}</div>
            <div class="vb-center">
                <div class="vb-ring-wrap">
                    <div class="vb-ring outer"></div>
                    <div class="vb-ring inner"></div>
                    <div class="vb-ring core"></div>
                    <div class="vb-ring-dot"></div>
                </div>
                <div class="vb-text">
                    <div class="vb-title">${titleText || t('detectingLibrary')}</div>
                    <div class="vb-subtitle">${subtitleText || t('readingApps')}</div>
                    <div class="vb-dots"><span></span><span></span><span></span></div>
                    <div class="vb-libs" id="vbLibsGlobal">${libs}</div>
                </div>
            </div>
            <div class="vb-progress"><div class="vb-progress-fill"></div></div>
        </div>`;

    overlay.style.display = 'flex';

    if (overlay._iv) clearInterval(overlay._iv);
    let cur = 0;
    const libEls = overlay.querySelectorAll('#vbLibsGlobal .vb-lib');
    overlay._iv = setInterval(() => {
        if (overlay.style.display === 'none') { clearInterval(overlay._iv); return; }
        libEls.forEach(l => l.classList.remove('scanning'));
        if (libEls[cur]) libEls[cur].classList.add('scanning');
        cur = (cur + 1) % libEls.length;
    }, 700);
}

function hideGlobalLoading() {
    window.isGlobalLoading = false;
    const overlay = document.getElementById('globalLoadingOverlay');
    if (overlay) {
        overlay.style.display = 'none';
        if (overlay._iv) clearInterval(overlay._iv);
    }
    window.updateNavHint?.();
}

/* Seção: Utilitários de atualização de imagens */
function updateToLocalFile(gameId, imageType, newUrl) {
    const safeId = gameId.replace(/\\/g, '\\\\');
    const card = document.querySelector(`.card[data-game-id="${safeId}"]`)
        ?? document.querySelector(`.card[data-app-id="${safeId}"]`);
    if (!card) return;
    const keyMap = { GridStatic: 'staticVertical', HorizontalStatic: 'staticHorizontal', HeroStatic: 'staticHero', LogoStatic: 'staticLogo' };
    const key = keyMap[imageType];
    if (!key) return;

    card.dataset[key] = newUrl;
    const img = card.querySelector('img');
    const isFeatured = card.classList.contains('featured');

    if (img && document.activeElement !== card && !card.matches(':hover')) {
        if ((isFeatured && key === 'staticHorizontal') || (!isFeatured && key === 'staticVertical')) {
            img.src = newUrl;
            img.style.opacity = '1';
        }
    }
    if (isFeatured && key === 'staticHero') switchHeroBackground(newUrl, card.dataset.staticLogo || card.dataset.logo);
}

const _TAB_MAP = { 'apps': 0, 'media-apps': 1, 'folders': 2 };
const _VIEW_MAP = { 'apps': 'view-apps', 'media-apps': 'view-media-apps', 'folders': 'view-folders' };

function switchTab(tabId) {
    document.querySelectorAll('.menu-tab').forEach((btn, i) => {
        const id = Object.keys(_TAB_MAP)[i];
        btn.classList.toggle('active', id === tabId);
    });
    document.querySelectorAll('.view-section').forEach(v => {
        v.classList.remove('active');
        v.classList.add('hidden');
    });
    const view = document.getElementById(_VIEW_MAP[tabId]);
    view?.classList.remove('hidden');
    view?.classList.add('active');

    // Controle inteligente de exibição dos botões
    const modalActions = document.getElementById('modalActions');
    const mediaAppActions = document.getElementById('mediaAppActions');

    if (tabId === 'apps') {
        if (modalActions) modalActions.style.display = 'flex';
        if (mediaAppActions) mediaAppActions.style.display = 'none';
        refreshInstalledAppsView(); // Força a lista a renderizar novamente
    }
    else if (tabId === 'folders') {
        if (modalActions) modalActions.style.display = 'none';
        if (mediaAppActions) mediaAppActions.style.display = 'none';
        if (cachedFolders === null) {
            showGlobalLoading(t('foldersTitle'), t('readingApps'));
            requestFolders();
        } else {
            renderFolderList(cachedFolders);
        }
    }
    else if (tabId === 'media-apps') {
        if (modalActions) modalActions.style.display = 'none';
        if (mediaAppActions) mediaAppActions.style.display = 'flex';
        _initMediaAppsView();
    }
}
/* Seção: Filtros e barra de filtros */
currentSourceFilter = ['all'];

function buildFilterBar(apps) {
    const bar = document.getElementById('filterBar');
    if (!bar) return;

    const present = new Set(apps.map(a => a.Source || a.source));
    const keys = ['all', ...Object.keys(FILTER_SOURCES).filter(k => k !== 'all' && FILTER_SOURCES[k].some(s => present.has(s)))];

    bar.innerHTML = keys.map(k => {
        const isActive = currentSourceFilter.includes(k);
        return `
            <button class="filter-btn ${isActive ? 'active' : ''}" tabindex="0" data-source="${k}">
                ${t('filterLabels.' + k)}
            </button>
        `;
    }).join('');

    bar.querySelectorAll('.filter-btn').forEach(btn =>
        btn.addEventListener('click', () => {
            const clicked = btn.dataset.source;

            if (clicked === 'all') {
                currentSourceFilter = ['all'];
            } else {
                currentSourceFilter = currentSourceFilter.filter(s => s !== 'all');

                if (currentSourceFilter.includes(clicked)) {
                    currentSourceFilter = currentSourceFilter.filter(s => s !== clicked);
                } else {
                    currentSourceFilter.push(clicked);
                }

                if (currentSourceFilter.length === 0) currentSourceFilter = ['all'];
            }

            applyFilterAndRender();

            setTimeout(() => {
                const alvo = document.querySelector(`.filter-bar .filter-btn[data-source="${clicked}"]`);
                if (alvo) alvo.focus();
                else document.querySelector('.filter-bar .filter-btn')?.focus();
            }, 10);
        })
    );
}

function applyFilterAndRender() {
    let filtered;

    if (currentSourceFilter.includes('all')) {
        filtered = allInstalledApps;
    } else {
        const allowedPlatforms = currentSourceFilter.flatMap(f => FILTER_SOURCES[f]);
        filtered = allInstalledApps.filter(a => allowedPlatforms.includes(a.Source || a.source));
    }

    filtered = filtered.filter(a => (a.AddedTo || a.addedTo) !== 'media');

    populateAppModal(filtered);
}

function refreshInstalledAppsView() {
    const activeView = document.querySelector('.view-section.active')?.id;
    const exeActive = activeView === 'view-media-apps' &&
        document.getElementById('subview-exe')?.classList.contains('active');

    if (exeActive) {
        _renderExeAppModal();
        return;
    }

    applyFilterAndRender();
}

document.getElementById('btnAdd').addEventListener('click', () => {
    isModalOpen = true;
    _modalReady = false;
    if (isSetupOpen) return;
    document.getElementById('modalActions').style.display = 'none';
    document.getElementById('gameGrid').style.overflowX = 'hidden';
    document.getElementById('addGameContainer').style.display = 'flex';
    document.getElementById('modalTitle').innerText = t('detectingLibrary');
    showGlobalLoading(t('detectingLibrary'), t('readingApps'));
    switchTab('apps');
    postToHost({ action: 'requestInstalledApps' });
    postToHost({ action: 'startAppPolling' });
});

document.getElementById('btnAddMedia')?.addEventListener('click', () => {
    isModalOpen = true;
    _modalReady = false;
    if (isSetupOpen) return;
    document.getElementById('modalActions').style.display = 'none';
    document.getElementById('gameGrid').style.overflowX = 'hidden';
    document.getElementById('addGameContainer').style.display = 'flex';
    document.getElementById('modalTitle').innerText = t('detectingLibrary');

    showGlobalLoading(t('detectingLibrary'), t('readingApps'));
    switchTab('media-apps');
    postToHost({ action: 'requestInstalledApps' });
    postToHost({ action: 'startAppPolling' });
});

function closeModal() {
    document.getElementById('addGameContainer').style.display = 'none';
    document.getElementById('gameGrid').style.overflowX = 'auto';
    document.getElementById('selectionCounter')?.classList.remove('visible');
    isModalOpen = false;
    hideGlobalLoading();

    postToHost({ action: 'stopAppPolling' });
    window.focusFeaturedCard?.();
}

function formatBytes(kb) {
    if (!kb) return '';
    const mb = kb / 1024;
    return mb > 1024 ? t('unitGB', (mb / 1024).toFixed(2)) : t('unitMB', mb.toFixed(0));
}

function populateAppModal(apps) {
    const titleEl = document.getElementById('modalTitle');
    titleEl.innerText = currentSourceFilter.includes('all') ? t('selectApps') : t('showingStore', currentSourceFilter);

    const rebind = (id, fn) => {
        const btn = document.getElementById(id);
        if (!btn) return;
        const fresh = btn.cloneNode(true);
        btn.replaceWith(fresh);
        fresh.addEventListener('click', fn);
    };

    rebind('btnSearch', () => {
        showGlobalLoading(t('detectingLibrary'), t('waitingWindows'));
        postToHost({
            action: 'browseManual',
            dialogTitle: t('dlgBrowseTitle'),
            dialogFilter: t('dlgBrowseFilter'),
            loadingTitle: t('loadingAddingGame'),
            loadingSub: t('loadingFetchingCovers'),
            errorMsg: t('msgErrorOpenFile')
        });
    });

    rebind('btnScanFolder', () => {
        showGlobalLoading(t('waitingFolder'), t('waitingWindows'));
        isFolderOperationInProgress = true;
        postToHost({
            action: 'pickFolder',
            dialogTitle: t('dlgFolderTitle'),
            forbiddenMsg: t('msgFolderForbidden'),
            forbiddenTitle: t('msgFolderForbiddenTitle'),
            loadingTitle: t('loadingUpdatingLibrary'),
            loadingSub: t('loadingScanningDoNotClose'),
            errorMsg: t('msgErrorOpenFolder')
        });
    });

    buildFilterBar(allInstalledApps);

    const appList = document.getElementById('appList');
    appList.innerHTML = apps.map(app => {
        const isAdded = app.IsAdded === true || app.isAdded === true;
        const icon = app.IconBase64 || app.iconBase64;
        const name = app.Name || app.name;
        const path = app.Path || app.path;
        const size = app.Size ?? app.size;
        const launch = app.LaunchUrl || app.launchUrl || '';
        const source = app.Source || app.source;

        return `
        <div class="app-item ${isAdded ? 'already-added' : ''}" ${isAdded ? '' : 'tabindex="0"'}
             data-path="${path.replace(/\\/g, '\\\\')}" data-launch="${launch}"
             data-name="${name.replace(/"/g, '&quot;')}">
            ${icon ? `<img class="app-icon" src="data:image/png;base64,${icon}" />` : ''}
            <div class="app-item-info">
                <span class="app-name">${name}</span>
                ${size ? `<span class="size">${formatBytes(size)}</span>` : ''}
            </div>
            ${getPlatformBadge(source)}
        </div>`;
    }).join('');

    document.getElementById('modalActions').style.display = 'flex';
    document.getElementById('selectionCounter')?.classList.remove('visible');

    appList.querySelectorAll('.app-item:not(.already-added)').forEach(item =>
        item.addEventListener('click', function () {
            this.classList.toggle('selected');
            const count = appList.querySelectorAll('.app-item.selected').length;
            const counter = document.getElementById('selectionCounter');
            const text = document.getElementById('selectionCounterText');
            if (text) text.innerText = count === 1 ? t('selectedOne') : t('selectedMany', count);
            counter?.classList.toggle('visible', count > 0);
        })
    );

    const rebindAction = (id, fn) => {
        const btn = document.getElementById(id);
        if (!btn) return;
        const fresh = btn.cloneNode(true);
        btn.replaceWith(fresh);
        fresh.addEventListener('click', fn);
    };

    rebindAction('btnCancelAdd', closeModal);
    rebindAction('btnConfirmAdd', () => {
        // Verifica se a ABA PRINCIPAL DE MÍDIA é a que está visível na tela no momento
        const isMediaViewActive = document.getElementById('view-media-apps')?.classList.contains('active');

        // Se a tela de Mídia estiver aberta, repassa a ação para o controle funcionar nela
        if (isMediaViewActive) {
            if (document.getElementById('subview-web')?.classList.contains('active')) {
                document.getElementById('btnAddWebApp')?.click();
            } else {
                document.getElementById('btnConfirmAddMedia')?.click();
            }
            return;
        }

        // Lógica normal se estivermos na aba de JOGOS (view-apps)
        const selected = Array.from(appList.querySelectorAll('.app-item.selected')).map(el => ({
            Name: el.dataset.name, Path: el.dataset.path, LaunchUrl: el.dataset.launch,
        }));

        if (selected.length > 0) {
            selected.forEach(g => newGameIdsThisSession.add(g.LaunchUrl || g.Path));
            postToHost({ action: 'addSelectedGames', games: selected });
            showLoadingCards(selected.length, 'games');
            closeModal(); // Fecha instantaneamente e deixa os skeletons na UI
        } else {
            closeModal();
        }
    });

    if (!isFolderOperationInProgress) {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                hideGlobalLoading();
                _modalReady = true;
            });
        });
    }
}

/* Seção: Pastas */
function requestFolders() {
    postToHost({ action: 'requestFolders' });
}

function renderFolderList(folders) {
    const list = document.getElementById('folderList');
    const totalBar = document.getElementById('folderTotalTime');
    if (!list) return;

    if (!folders || folders.length === 0) {
        list.innerHTML = `
            <div class="folder-empty">
                <div class="folder-empty-icon">◫</div>
                <div class="folder-empty-text">${t('foldersEmpty')}</div>
                <div class="folder-empty-hint">${t('foldersEmptyHint')}</div>
            </div>`;
        if (totalBar) totalBar.style.display = 'none';
        return;
    }

    const formatTime = (ms) => ms < 1000 ? t('perfMs', ms) : t('perfSec', (ms / 1000).toFixed(1));
    const perfClass = (ms) => ms < 1000 ? 'fast' : ms < 3000 ? 'medium' : 'slow';
    const perfLabel = (ms) => ms < 1000 ? t('perfFast') : ms < 3000 ? t('perfMedium') : t('perfSlow');

    list.innerHTML = folders.map(folder => {
        const ms = folder.EstimatedMs ?? folder.estimatedMs ?? 0;
        const isAnalyzing = ms === -1;

        const tl = isAnalyzing ? t('analysing') : formatTime(ms);
        const pc = isAnalyzing ? 'loading' : perfClass(ms);
        const pl = isAnalyzing ? t('analysing') : perfLabel(ms);

        const subCount = folder.SubfolderCount ?? folder.subfolderCount ?? '—';
        const exeCount = folder.ExeCount ?? folder.exeCount ?? '—';
        const folderPath = folder.Path || folder.path || '';

        const pSafe = folderPath.replace(/\\/g, '\\\\').replace(/"/g, '&quot;');
        const isSlowClass = (!isAnalyzing && pc === 'slow') ? 'is-slow' : '';

        return `
        <div class="folder-item ${isSlowClass}" data-path="${pSafe}">
            <div class="folder-item-header">
                <div class="folder-info">
                    <span class="folder-icon">◫</span>
                    <span class="folder-path" title="${folderPath}">${folderPath}</span>
                </div>
                <div class="folder-actions">
                    <button class="icon-btn edit-btn" tabindex="0" data-path="${pSafe}">${t('btnEditLabel')}</button>
                    <button class="icon-btn delete-btn" tabindex="0" data-path="${pSafe}">${t('btnDeleteLabel')}</button>
                </div>
            </div>
            
        </div>`;
    }).join('');

    list.querySelectorAll('.edit-btn').forEach(btn =>
        btn.addEventListener('click', e => {
            e.stopPropagation();
            showGlobalLoading(t('waitingFolder'), t('waitingWindows'));
            isFolderOperationInProgress = true;
            postToHost({
                action: 'editFolder',
                path: btn.dataset.path.replace(/\\\\/g, '\\'),
                dialogTitle: t('dlgEditFolderTitle'),
                forbiddenMsg: t('msgFolderForbidden'),
                forbiddenTitle: t('msgFolderForbiddenTitle'),
                loadingTitle: t('loadingUpdatingLibrary'),
                loadingSub: t('loadingAnalyzingNewFolder'),
                errorMsg: t('msgErrorEditFolder')
            });
        })
    );

    list.querySelectorAll('.delete-btn').forEach(btn =>
        btn.addEventListener('click', e => {
            e.stopPropagation();
            showGlobalLoading(t('updatingLibrary'), t('readingApps'));
            isFolderOperationInProgress = true;
            postToHost({ action: 'deleteFolder', path: btn.dataset.path.replace(/\\\\/g, '\\') });
        })
    );

    if (totalBar) {
        const totalMs = folders.reduce((sum, f) => {
            const ms = f.EstimatedMs ?? f.estimatedMs ?? 0;
            return sum + (ms === -1 ? 0 : ms);
        }, 0);

        const valEl = totalBar.querySelector('.folder-total-value');
        if (valEl) valEl.textContent = formatTime(totalMs);
        totalBar.style.display = 'flex';
    }
}

// ── Utilitário compartilhado — detecta animação e salva frame estático ────────
async function processImage(card, src, dsKey, imageType, entityId) {
    if (!src || card.dataset[dsKey]) return;
    const blob = await getAnimatedBlob(src);
    if (!blob) { card.dataset[dsKey] = src; return; }
    return new Promise(resolve => {
        const tmp = new Image(), blobUrl = URL.createObjectURL(blob);
        tmp.onload = () => {
            try {
                const c = document.createElement('canvas');
                c.width = tmp.naturalWidth; c.height = tmp.naturalHeight;
                c.getContext('2d').drawImage(tmp, 0, 0);
                postToHost({ action: 'saveStaticFrame', gameId: entityId, imageType, base64: c.toDataURL('image/png') });
            } catch { card.dataset[dsKey] = src; }
            finally { URL.revokeObjectURL(blobUrl); resolve(); }
        };
        tmp.onerror = () => { card.dataset[dsKey] = src; URL.revokeObjectURL(blobUrl); resolve(); };
        tmp.src = blobUrl;
    });
}


function moveCardToTop(card) {
    if (!card) return;
    const grid = card.closest('#gameGrid') || card.closest('#mediaGrid') || document.getElementById('gameGrid');

    grid.querySelectorAll('.card.featured').forEach(c => {
        if (c === card) return;
        c.classList.remove('featured');
        const img = c.querySelector('img');
        if (img) img.src = c.dataset.staticVertical || c.dataset.vertical || '';
    });

    card.classList.add('featured');
    grid.prepend(card);

    const img = card.querySelector('img');
    if (img) {
        img.src = card.dataset.staticHorizontal || card.dataset.horizontal || card.dataset.staticVertical || card.dataset.vertical || '';
    }

    grid.scrollTo({ left: 0, behavior: 'smooth' });
}

/* Seção: Hero background */
let _heroTimer = null;
let _currentBgSrc = '';
let _heroReqId = 0;

function cancelHeroTransition() {
    if (_heroTimer) { clearTimeout(_heroTimer); _heroTimer = null; }
    document.querySelectorAll('.crossfade-clone-heroImage, .crossfade-clone-gridBgImg').forEach(c => c.remove());
}

function preloadImage(src) {
    return new Promise(resolve => {
        if (!src) return resolve();
        const img = new Image();
        img.onload = resolve;
        img.onerror = resolve;
        img.src = src;
    });
}

async function crossfadeBanner(el, newSrc) {
    if (!el || !newSrc) return;
    if (el.src === newSrc || el.src.endsWith(newSrc)) {
        el.style.opacity = '1';
        return;
    }

    const tempImg = new Image();
    tempImg.src = newSrc;
    try { await tempImg.decode(); } catch (e) { }

    const comp = window.getComputedStyle(el);
    const cloneClass = `crossfade-clone-${el.id}`;

    document.querySelectorAll(`.${cloneClass}`).forEach(c => c.remove());

    const clone = el.cloneNode(true);
    clone.classList.add(cloneClass);
    clone.style.position = 'absolute';
    clone.style.zIndex = parseInt(comp.zIndex) + 1;
    clone.style.pointerEvents = 'none';
    clone.style.opacity = comp.opacity;
    clone.style.transition = 'opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1)';

    clone.style.webkitMaskImage = comp.webkitMaskImage;
    clone.style.maskImage = comp.maskImage;
    clone.style.webkitMaskComposite = comp.webkitMaskComposite;
    clone.style.maskComposite = comp.maskComposite;

    el.parentNode.insertBefore(clone, el.nextSibling);

    el.style.transition = 'none';
    el.style.opacity = '1';
    el.src = newSrc;

    void el.offsetWidth;

    requestAnimationFrame(() => {
        clone.style.opacity = '0';
        setTimeout(() => { if (clone.parentNode) clone.remove(); }, 900);
    });
}

function switchHeroBackground(bgSrc, logoSrc, heroSrc) {
    if (window._heroCleanupTimer) {
        clearTimeout(window._heroCleanupTimer);
        window._heroCleanupTimer = null;
    }
    const heroImg = document.getElementById('heroImage');
    const logoImg = document.getElementById('gameLogo');
    const gridBg = document.getElementById('gridBgImg');
    const bgBlur = document.getElementById('bgBlur');

    if (!bgSrc) return;

    if (_currentBgSrc.split('?')[0] === bgSrc.split('?')[0]) {
        if (heroImg) heroImg.style.opacity = '1';
        if (gridBg) gridBg.style.opacity = '1';
        if (bgBlur) bgBlur.style.opacity = '1';
        if (logoImg && logoImg.src) logoImg.classList.add('visible');
        return;
    }

    _currentBgSrc = bgSrc;

    cancelHeroTransition();
    const reqId = ++_heroReqId;

    if (logoImg) logoImg.classList.remove('visible');

    const loadPromise = Promise.all([
        preloadImage(heroSrc || bgSrc),
        preloadImage(bgSrc),
        logoSrc ? preloadImage(logoSrc) : Promise.resolve()
    ]);
    const minTimePromise = new Promise(resolve => setTimeout(resolve, 0));

    Promise.all([loadPromise, minTimePromise]).then(() => {
        if (reqId !== _heroReqId) return;

        if (heroImg) crossfadeBanner(heroImg, heroSrc || bgSrc);

        if (gridBg) {
            gridBg.style.transition = 'none';
            gridBg.style.opacity = '1';
            gridBg.src = heroSrc || bgSrc;
        }

        if (bgBlur) {
            bgBlur.style.transition = 'none';
            bgBlur.style.opacity = '1';
            if (bgBlur.tagName === 'IMG') bgBlur.src = heroSrc || bgSrc;
        }

        if (logoImg) {
            if (logoSrc) {
                setTimeout(() => {
                    if (reqId !== _heroReqId) return;
                    setImgSrc(logoImg, logoSrc).then(() => {
                        requestAnimationFrame(() => logoImg.classList.add('visible'));
                    });
                }, 200);
            }
        }
    });
}

/* Seção: Badges e verificação de animações */
function getPlatformBadge(source) {
    const p = PLATFORMS[source];
    if (!p) return '';
    const label = t('platformLabels.' + source);
    const inner = p.type === 'url' ? `<img src="${p.icon}" alt="${label}" />` : p.icon;
    return `<span class="platform-badge" title="${label}">${inner}</span>`;
}

async function getAnimatedBlob(url) {
    if (!url) return null;
    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const blob = await res.blob();
        const bytes = new Uint8Array(await blob.slice(0, 256).arrayBuffer());
        const APNG = [0x61, 0x63, 0x54, 0x4C], WEBP = [0x41, 0x4E, 0x49, 0x4D];
        let isAnim = bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46;
        for (let i = 0; !isAnim && i < bytes.length - 4; i++) {
            if (bytes.slice(i, i + 4).every((v, j) => v === APNG[j])) isAnim = true;
            if (bytes.slice(i, i + 4).every((v, j) => v === WEBP[j])) isAnim = true;
        }
        return isAnim ? blob : null;
    } catch { return null; }
}

async function setImgSrc(imgEl, src) {
    if (!imgEl) return;

    const req = Symbol();
    imgEl.__req = req;

    if (!src) {
        imgEl.removeAttribute('src');
        return;
    }

    if (imgEl.src === src || imgEl.src.endsWith(src)) {
        imgEl.style.opacity = '1';
        return;
    }

    const tmp = new Image();
    tmp.loading = "eager";
    tmp.decoding = "async";
    tmp.src = src;

    try {
        await tmp.decode();

        if (imgEl.__req === req) {
            imgEl.src = src;
            imgEl.style.transition = 'none';
            imgEl.style.opacity = '1';
        }
    } catch (e) {
        if (imgEl.__req === req) {
            imgEl.src = src;
            imgEl.style.opacity = '1';
        }
    }
}

function toggleNavMenu(isOpen) {
    const hint = document.getElementById('navHintDown');
    if (isOpen) {
        if (typeof _stopBlobBg === 'function') _stopBlobBg();
        document.body.classList.add('nav-menu-active');
        hint?.classList.add('visible', 'nav-open');
    } else {
        document.body.classList.remove('nav-menu-active');
        hint?.classList.remove('nav-open');
        setTimeout(() => {
            if (typeof _startBlobBg === 'function') _startBlobBg();
        }, 800);
        window.updateNavHint?.();
    }
}

/* Seção: Injeção de estilos e elementos auxiliares */
(function injectStyles() {
    const s = document.createElement('style');
    s.textContent = `
    .home-tabs-hint {
        margin-left: auto;
        display: flex;
        align-items: center;
        gap: 8px;
        font-family: 'Outfit', sans-serif;
        font-size: clamp(0.6rem, 1vw, 1.4rem);
        color: rgba(255, 255, 255, 0.4);
        letter-spacing: 0.05em;
        user-select: none;
    }
    .home-tabs-hint b {
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 4px;
        padding: 1px 5px;
        font-weight: 600;
        font-size: 0.95em;
        color: #fff;
    }
    /* ── Skeletons de Loading (Tamanho e Shimmer perfeitos) ── */
    .card.loading-card {
        pointer-events: none;
        position: relative;
        overflow: hidden;
        background: rgba(255, 255, 255, 0.02);
    }
    .card.loading-card img {
        display: none !important;
    }
    .card.loading-card::before {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: inherit;
        background: linear-gradient(
            90deg,
            rgba(255,255,255,0.02) 0%,
            rgba(255,255,255,0.08) 40%,
            rgba(255,255,255,0.02) 100%
        );
        background-size: 200% 100%;
        animation: cardShimmer 1.4s ease infinite;
        z-index: 1;
    }
    @keyframes cardShimmer {
        0%   { background-position: 200% 0; }
        100% { background-position: -200% 0; }
    }
        /* Camadas de Renderização Otimizadas */
        .main-content-wrapper,
        #heroImage,
        #gridBgImg,
        #bgBlur,
        #gameLogo,
        [class*="crossfade-clone-"] {
            will-change: transform;
            backface-visibility: hidden;
            transform: translateZ(0); /* Força aceleração 2D simples */
        }

        /* 1. Transição com curva Sharp (Melhor para 60Hz) */
        .main-content-wrapper,
        #heroImage,
        #gridBgImg,
        #bgBlur,
        #gameLogo,[class*="crossfade-clone-"] {
            /* Curva 'Quintic Out': Começa muito rápido, termina muito lento */
            transition: transform 0.6s cubic-bezier(0.23, 1, 0.32, 1), 
                        opacity 0.25s ease-out !important;
        }

        /* 2. Movimento Consistente */
        body.nav-menu-active .main-content-wrapper,
        body.nav-menu-active #heroImage,
        body.nav-menu-active #gridBgImg,
        body.nav-menu-active #bgBlur,
        body.nav-menu-active #gameLogo,
        body.nav-menu-active[class*="crossfade-clone-"] {
            transform: translateY(-100vh) !important;
            opacity: 0 !important;
        }

        /* 3. Desligar o Blur IMEDIATAMENTE (O maior peso no 60Hz) */
        body.nav-menu-active #bgBlur,
        body.nav-menu-active[class*="crossfade-clone-bgBlur"] {
            filter: none !important;
        }

        /* 4. Blob Background (Aparece sem competir com o scroll) */
        #appBlobBg {
            z-index: -1;
            pointer-events: none;
        }
        
        body.nav-menu-active #appBlobBg {
            opacity: 1 !important;
            transition: opacity 0.4s ease-in 0.2s !important; 
        }

        .nav-menu {
            transition: transform 0.5s cubic-bezier(0.2, 0.8, 0.4, 1), opacity 0.4s ease;
            transform-origin: top right;
        }
.card.new-game {
        position: relative;
    }
    .card.new-game::before {
content: attr(data-badge-new);
    position: absolute;
    top: clamp(8px, 0.63vw, 12px);
    left: clamp(8px, 0.63vw, 12px);
    z-index: 10;
    background: #fff;
    color: #06060e;
    font-size: clamp(0.48rem, 0.50vw, 0.60rem);
    font-weight: 800;
    letter-spacing: 0.2em;
    width: 5.4em;
    padding: 3px 7px 4px;
    border-radius: 3px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.6);
    animation: badge-enter 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both;
    background-image: none;
    }

body.nav-menu-active .nav-menu {
    transform: scale(1) translateX(0) !important;
    opacity: 1;
}
    /* ▼ Novo Indicador Sutil ▼ */
#navHintDown {
    position: fixed;
    bottom: 0.2rem;
    left: 50%;
    transform: translateX(-50%);
    z-index: 9000;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.3s ease;
}
#navHintDown.visible { opacity: 1; }
#navHintDown.nav-open { bottom: auto; top: 2rem; }
#navHintDown.nav-open svg { transform: rotate(180deg); }
    .context-menu {
        position: fixed;
        z-index: 9999;
        display: none;
        flex-direction: column;
        background: rgb(13 13 43 / 95%);
        border: 1px solid rgba(255,255,255,0.10);
        border-radius: 12px;
        padding: 6px;
        min-width: 210px;
        box-shadow: 0 16px 48px rgba(0,0,0,0.75);
        backdrop-filter: blur(28px);
        opacity: 0;
        transform: scale(0.93) translateY(-5px);
        transition: opacity 0.13s ease, transform 0.13s ease;
        pointer-events: none;
    }
    .context-menu.visible {
        opacity: 1; transform: scale(1) translateY(0); pointer-events: all;
    }
    .ctx-game-name {
        padding: 8px 14px 4px;
        font-size: 10.5px;
        color: rgba(255,255,255,0.32);
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.09em;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 230px;
    }
    .ctx-separator { height: 1px; background: rgba(255,255,255,0.07); margin: 4px 2px; }
    .ctx-item {
        display: flex; align-items: center; gap: 10px;
        padding: 10px 14px;
        border: none; background: none;
        color: rgba(255,255,255,0.82);
        font-size: 13.5px; font-family: inherit; font-weight: 450;
        border-radius: 8px; cursor: pointer;
        text-align: left; width: 100%;
        transition: background 0.1s, color 0.1s;
    }
    .ctx-item:hover, .ctx-item:focus { background: rgba(255,255,255,0.09); color: #fff; outline: none; }
    .ctx-item.ctx-danger:hover, .ctx-item.ctx-danger:focus { background: rgba(220,50,50,0.18); color: #ff6e6e; }
    .ctx-item .ctx-icon { width: 16px; text-align: center; opacity: 0.6; font-size: 15px; flex-shrink: 0; }

    .edit-modal-overlay {
        position: fixed; inset: 0; z-index: 10000;
        display: flex; align-items: center; justify-content: center;
        background: rgba(0,0,0,0.55); backdrop-filter: blur(14px);
        animation: editOverlayIn 0.15s ease;
        transition: align-items 0.3s ease, padding-top 0.3s ease;
    }
    .edit-modal-overlay.vkb-active { align-items: flex-start; padding-top: 36px; }
    .edit-modal {
        background: rgba(14,14,20,0.99);
        border: 1px solid rgba(255,255,255,0.10);
        border-radius: 20px;
        padding: 0;
        width: min(560px, 90vw);
        box-shadow: 0 24px 64px rgba(0,0,0,0.8);
        display: flex; flex-direction: column;
        overflow: hidden;
        animation: editModalIn 0.16s ease;
    }
    .edit-modal-header {
        display: flex; align-items: center; justify-content: space-between;
        padding: 20px 24px 16px;
        border-bottom: 1px solid rgba(255,255,255,0.07);
    }
    .edit-modal-title {
        font-size: 15px; font-weight: 650; color: #fff; margin: 0;
        letter-spacing: 0.01em;
    }
    .edit-modal-subtitle {
        font-size: 11px; color: rgba(255,255,255,0.3);
        margin: 2px 0 0; font-weight: 400;
    }
    .edit-modal-body {
        padding: 20px 24px;
        display: flex; flex-direction: column; gap: 18px;
        max-height: 60vh; overflow-y: auto;
    }
    .edit-modal-field { display: flex; flex-direction: column; gap: 6px; }
    .edit-modal-label {
        font-size: 10px; text-transform: uppercase; letter-spacing: 0.10em;
        color: rgba(255,255,255,0.32); font-weight: 600;
    }
    .edit-modal-input {
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.10);
        border-radius: 9px; padding: 11px 14px;
        color: #fff; font-size: 15px; font-family: inherit;
        outline: none; width: 100%; box-sizing: border-box;
        transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
        cursor: pointer;
        caret-color: rgba(100,160,255,0.9);
    }
    .edit-modal-input:hover {
        background: rgba(255,255,255,0.08);
        border-color: rgba(255,255,255,0.18);
    }
    .edit-modal-input:focus {
        background: rgba(255,255,255,0.07);
        border-color: rgba(100,160,255,0.5);
        box-shadow: 0 0 0 3px rgba(100,160,255,0.09);
    }
    .edit-modal-input.vkb-active {
        border-color: rgba(100,160,255,0.6);
        box-shadow: 0 0 0 3px rgba(100,160,255,0.12);
    }
    .edit-modal-input-hint {
        font-size: 10px; color: rgba(255,255,255,0.22);
        display: flex; align-items: center; gap: 4px;
    }
    .edit-modal-actions {
        display: flex; gap: 8px; justify-content: flex-end;
        padding: 14px 24px 18px;
        border-top: 1px solid rgba(255,255,255,0.07);
    }

    .vkb-overlay {
        position: fixed;
        bottom: 0; left: 0; right: 0;
        z-index: 10001;
        padding: 0 clamp(24px, 4vw, 80px) clamp(24px, 3vh, 48px);
        background: linear-gradient(to top, rgba(5,5,10,1) 65%, rgba(5,5,10,0.96) 85%, transparent 100%);
        transform: translateY(100%);
        transition: transform 0.32s cubic-bezier(0.25,0.46,0.45,0.94);
        user-select: none;
    }
    .vkb-overlay.visible { transform: translateY(0); }

    .vkb-preview-wrap {
        display: flex; align-items: center; gap: 12px;
        margin-bottom: clamp(12px, 2vh, 22px);
        padding: 0 2px;
    }
    .vkb-preview-label {
        font-size: clamp(10px, 1.1vw, 14px);
        font-weight: 600; text-transform: uppercase;
        letter-spacing: 0.09em; color: rgba(255,255,255,0.3);
        white-space: nowrap; flex-shrink: 0;
    }
    .vkb-preview-text {
        flex: 1;
        font-size: clamp(16px, 1.8vw, 26px);
        font-weight: 500; color: #fff;
        padding: clamp(7px, 1vh, 12px) clamp(12px, 1.4vw, 18px);
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 10px;
        min-height: clamp(38px, 5vh, 56px);
        display: flex; align-items: center;
        white-space: nowrap; overflow: hidden;
    }
    .vkb-cursor {
        display: inline-block; width: 2px;
        height: 1.1em; background: rgba(255,255,255,0.9);
        margin-left: 2px; vertical-align: middle;
        animation: vkbBlink 1s step-end infinite;
    }
    @keyframes vkbBlink { 0%,100%{opacity:1} 50%{opacity:0} }

    .vkb-grid {
        display: grid;
        grid-template-columns: repeat(10, clamp(42px, 3.8vw, 95px));
        gap: clamp(4px, 0.5vh, 7px) clamp(4px, 0.38vw, 6px);
        width: fit-content;
        margin: 0 auto;
    }

    .vkb-key {
        width: clamp(42px, 3.8vw, 90px);
        height: clamp(42px, 3.8vw, 75px);
        padding: 0;
        background: rgba(255,255,255,0.08);
        border: 1px solid rgba(255,255,255,0.11);
        border-bottom: 3px solid rgba(0,0,0,0.45);
        border-radius: clamp(7px, 0.6vw, 10px);
        color: rgba(255,255,255,0.88);
        font-size: clamp(13px, 1.2vw, 18px);
        font-weight: 500; font-family: inherit;
        display: flex; align-items: center; justify-content: center;
        cursor: pointer;
        transition: background 0.07s, transform 0.07s, border-color 0.07s, color 0.07s, box-shadow 0.07s;
        outline: none;
        min-width: 0;
        box-sizing: border-box;
    }
    .vkb-key:hover { background: rgba(255,255,255,0.13); color: #fff; }
    .vkb-key:focus {
        background: rgba(255,255,255,0.97);
        color: #080810;
        border-color: transparent;
        border-bottom-color: rgba(0,0,0,0.25);
        transform: scale(1.1) translateY(-3px);
        box-shadow: 0 8px 24px rgba(0,0,0,0.55), 0 0 0 2px rgba(255,255,255,0.35);
        z-index: 1;
        position: relative;
    }
    .vkb-key:active { transform: scale(0.96) translateY(0); box-shadow: none; }

    .vkb-key[data-key="space"] {
        grid-column: span 6;
        height: clamp(52px, 4.8vw, 70px);
        font-size: clamp(12px, 1.2vw, 16px);
        letter-spacing: 0.08em;
        color: rgba(255,255,255,0.45);
        width: 100%;
    }
    .vkb-key[data-key="space"]:focus { color: rgba(0,0,0,0.65); }
    .vkb-key[data-key="cancel"] {
        grid-column: span 2;
        height: clamp(52px, 4.8vw, 70px);
        color: rgba(255,255,255,0.6);
        font-size: clamp(12px, 1.2vw, 16px);
        font-weight: 500;
        width: 100%;
    }
    .vkb-key[data-key="ok"] {
        grid-column: span 2;
        height: clamp(52px, 4.8vw, 70px);
        background: rgba(50,110,255,0.32);
        border-color: rgba(50,110,255,0.55);
        color: rgba(170,205,255,0.95);
        font-weight: 650;
        font-size: clamp(12px, 1.2vw, 16px);
        width: 100%;
    }
    .vkb-key[data-key="ok"]:focus {
        background: rgb(50,110,255); color: #fff;
        border-color: transparent;
        box-shadow: 0 8px 28px rgba(50,110,255,0.55), 0 0 0 2px rgba(50,110,255,0.4);
    }
    .vkb-key[data-key="⌫"]     { color: rgba(255,110,110,0.85); font-size: clamp(16px,1.7vw,23px); }
    .vkb-key[data-key="⌫"]:focus { color: #b00; }
    .vkb-key[data-key="shift"]  { font-size: clamp(15px,1.6vw,22px); }
    .vkb-key[data-key="shift"].shifted {
        background: rgba(255,255,255,0.2);
        border-color: rgba(255,255,255,0.3);
        color: #fff;
    }
    .vkb-key[data-key="shift"].shifted:focus { background: rgba(255,255,255,0.97); color: #080810; }

    .card.removing {
        opacity: 0 !important; transform: scale(0.88) !important;
        transition: opacity 0.25s ease, transform 0.25s ease !important;
        pointer-events: none !important;
    }

    @keyframes editOverlayIn { from{opacity:0} to{opacity:1} }
    @keyframes editModalIn   { from{opacity:0;transform:scale(0.93) translateY(10px)} to{opacity:1;transform:scale(1) translateY(0)} }
    
/* ── Novo Indicador de Menu (Seta) Robustez Total ── */

        @media (min-height: 1080px) {
        #navHintDown { bottom: 3px; padding:6px 90px; }
        #navHintDown svg { width: 28px; height: 28px; }
    }

/* Texto opcional abaixo da seta se quiser (ou deixe vazio) */
.nav-hint-text {
    font-size: clamp(10px, 1.2vmin, 14px);
    color: rgba(255, 255, 255, 0.5);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    font-weight: 600;
}

@keyframes navHintBounce {
    0%, 100% { transform: translate(-50%, 0); }
    50% { transform: translate(-50%, 8px); }
}
.nav-hint-icon {
    background: rgba(255,255,255,0.08);
    border: 1px solid rgba(255,255,255,0.15);
    border-radius: clamp(4px, 0.8vw, 8px);
    padding: clamp(3px, 0.5vw, 6px) clamp(6px, 1vw, 12px);
    font-size: clamp(11px, 1.2vw, 14px);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
}
    `;
    document.head.appendChild(s);
})();

/* ── Menu de Contexto & Outros ── */
// ══════════════════════════════════════════════════════════════════════════
// Context Menu
// ══════════════════════════════════════════════════════════════════════════

const _ctxMenu = (() => {
    const el = document.createElement('div');
    el.className = 'context-menu';
    el.setAttribute('role', 'menu');
    el.innerHTML = `
        <div class="ctx-game-name" id="ctxGameName"></div>
        <button class="ctx-item" id="ctxExtensions" role="menuitem">
            <span class="ctx-icon">+</span> <span data-i18n="manageExtensions">${t('manageExtensions')}</span>
        </button>
        <div class="ctx-separator"></div>
        <button class="ctx-item" id="ctxEdit" role="menuitem">
            <span class="ctx-icon">✎</span> <span data-i18n="ctxEditName">${t('ctxEditName')}</span>
        </button>
        <div class="ctx-separator"></div>
        <button class="ctx-item ctx-danger" id="ctxDelete" role="menuitem">
            <span class="ctx-icon">✕</span> <span data-i18n="ctxRemoveGame">${t('ctxRemoveGame')}</span>
        </button>
    `;
    document.body.appendChild(el);
    return el;
})();

let _ctxCard = null;

function _openCtxMenu(card, x, y) {
    _ctxCard = card;
    _ctxCard.classList.add('ctx-active');


    if (typeof applyI18n === 'function') applyI18n();
    const updateCount = Object.keys(window._pendingExtensionUpdates || {}).length;

    const gameId = card.dataset.gameId || card.dataset.appId || card.dataset.appUrl;
    const isYoutube = (gameId && gameId.toLowerCase().includes('youtube'));

    const ctxEditBtn = _ctxMenu.querySelector('#ctxEdit');
    const ctxDeleteBtn = _ctxMenu.querySelector('#ctxDelete');
    const isBrowserMedia = (card.hasAttribute('data-app-id') || card.closest('#mediaGrid')) &&
        (card.dataset.appType || 'browser') !== 'exe';

    const dotHtml = updateCount > 0
        ? `<span class="update-dot" style="display:inline-flex; align-items:center; justify-content:center; min-width:18px; height:18px; padding:0 6px 0px 5px; background:#ff4444; color:#fff; font-size:11px; font-weight:800; line-height:0; letter-spacing:0; border-radius:10px; margin-left:8px; box-shadow: 0 0 10px rgba(255,68,68,0.4); flex-shrink:0; box-sizing:border-box;">${updateCount}</span>`
        : '';

    const ctxExtensionsBtn = _ctxMenu.querySelector('#ctxExtensions');

    if (ctxExtensionsBtn) {
        // Recria o conteúdo completo para garantir que o span será inserido
        const btnText = t('manageExtensions');
        ctxExtensionsBtn.innerHTML = `
            <span class="ctx-icon">+</span> 
            <span>${escapeHtml(btnText)}</span>
            ${dotHtml}
        `;
        console.log("DEBUG: innerHTML do botão:", ctxExtensionsBtn.innerHTML);
    }
    let ctxCloseBtn = _ctxMenu.querySelector('#ctxClose');
    if (!ctxCloseBtn) {
        ctxCloseBtn = document.createElement('button');
        ctxCloseBtn.className = 'ctx-item';
        ctxCloseBtn.id = 'ctxClose';
        ctxCloseBtn.innerHTML = `<span class="ctx-icon">↩</span> <span>${t('btnBackLabel')}</span>`;
        ctxCloseBtn.addEventListener('click', _closeCtxMenu);
        _ctxMenu.appendChild(ctxCloseBtn);
    }

    if (isYoutube) {
        if (ctxEditBtn) ctxEditBtn.style.display = 'none';
        if (ctxExtensionsBtn) ctxExtensionsBtn.style.display = isBrowserMedia ? 'flex' : 'none';
        if (ctxDeleteBtn) ctxDeleteBtn.style.display = 'none';
        ctxCloseBtn.style.display = 'flex';
        _ctxMenu.querySelector('#ctxGameName').textContent = t('systemAppLabel');
    } else {
        if (ctxEditBtn) ctxEditBtn.style.display = 'flex';
        if (ctxExtensionsBtn) ctxExtensionsBtn.style.display = isBrowserMedia ? 'flex' : 'none';
        if (ctxDeleteBtn) ctxDeleteBtn.style.display = 'flex';
        ctxCloseBtn.style.display = 'none';
        _ctxMenu.querySelector('#ctxGameName').textContent = card.querySelector('.title, .nav-vertical-card-title')?.innerText?.trim() || '';
    }

    _ctxMenu.style.display = 'flex';
    requestAnimationFrame(() => {
        const w = _ctxMenu.offsetWidth, h = _ctxMenu.offsetHeight, m = 10;
        _ctxMenu.style.left = Math.min(x, window.innerWidth - w - m) + 'px';
        _ctxMenu.style.top = Math.min(y, window.innerHeight - h - m) + 'px';
        _ctxMenu.classList.add('visible');
        isCtxMenuOpen = true;

        if (isYoutube) ctxCloseBtn.focus();
        else ctxEditBtn?.focus();
    });
}
function _closeCtxMenu() {
    isCtxMenuOpen = false;
    _ctxMenu.classList.remove('visible');

    if (_ctxCard) _ctxCard.classList.remove('ctx-active');

    setTimeout(() => { if (!_ctxMenu.classList.contains('visible')) _ctxMenu.style.display = 'none'; }, 160);
    const card = _ctxCard; _ctxCard = null; card?.focus();
}

window._ctxMenuOpen = _openCtxMenu;
window._ctxMenuClose = _closeCtxMenu;

document.addEventListener('mousedown', e => {
    if (isCtxMenuOpen && !_ctxMenu.contains(e.target)) _closeCtxMenu();
}, true);

document.getElementById('ctxEdit').addEventListener('click', () => {
    const card = _ctxCard; _closeCtxMenu();
    if (card) openEditGameModal(card);
});

document.getElementById('ctxExtensions').addEventListener('click', () => {
    _closeCtxMenu();
    openExtensionsManager();
});

document.getElementById('ctxDelete').addEventListener('click', () => {
    const card = _ctxCard; _closeCtxMenu();
    if (card) _executeDelete(card);
});

// ══════════════════════════════════════════════════════════════════════════
// Deleção
// ══════════════════════════════════════════════════════════════════════════
function _executeDelete(card) {
    const id1 = card.dataset.gameId;
    const id2 = card.dataset.appId;
    const id3 = card.dataset.appUrl;

    const searchKeys = [id1, id2, id3].filter(Boolean);
    if (searchKeys.length === 0) return;

    if (searchKeys.some(k => k.toLowerCase().includes('youtube'))) return;

    const isMedia = card.hasAttribute('data-app-id') || card.closest('#mediaGrid') !== null;

    const allCards = Array.from(document.querySelectorAll('.card, .nav-vertical-card')).filter(c => {
        const cId1 = c.dataset.gameId;
        const cId2 = c.dataset.appId;
        const cId3 = c.dataset.appUrl;
        return searchKeys.some(k => k === cId1 || k === cId2 || k === cId3);
    });

    allCards.forEach(c => {
        if (c.classList.contains('featured')) {
            const grid = c.closest('#gameGrid') || c.closest('#mediaGrid');
            const next = Array.from(grid.querySelectorAll('.card:not(.add-card)')).find(sib => sib !== c);
            if (next) {
                next.classList.add('featured');
                const img = next.querySelector('img');
                if (img) img.src = next.dataset.staticHorizontal || next.dataset.horizontal || next.dataset.staticVertical || '';
                next._startInteraction?.();
            } else {
                if (typeof clearHero === 'function') clearHero();
            }
        }

        c.classList.add('removing');
        setTimeout(() => c.remove(), 280);
    });

    if (typeof _menuData !== 'undefined') {
        ['games', 'media'].forEach(cat => {
            if (!_menuData[cat]) return;
            const idx = _menuData[cat].findIndex(i => {
                const key = i.LaunchUrl || i.Path || i.Url;
                return searchKeys.includes(key) || searchKeys.includes(i.Id);
            });
            if (idx >= 0) _menuData[cat].splice(idx, 1);
        });
    }

    postToHost({
        action: 'deleteGame',
        gameId: id1 || id2,
        isMedia: isMedia
    });
}

// ══════════════════════════════════════════════════════════════════════════
// Edit Modal
// ══════════════════════════════════════════════════════════════════════════

let _editCard = null;
let _editOverlay = null;
function openEditGameModal(card) {
    ensureDoorpiOverlayStyles();
    const currentName = card.querySelector('.title')?.innerText?.trim() ||
        card.querySelector('.nav-vertical-card-title')?.innerText?.trim() || '';
    _editCard = card;

    const gameId = card.dataset.gameId || card.dataset.appId || card.dataset.appUrl;

    // 🔹 DETECÇÃO INFALÍVEL DE MÍDIA PARA O MENU CONTEXTO DA BIBLIOTECA 🔹
    const isMediaTabActive = typeof window.getCurrentHomeTab === 'function' && window.getCurrentHomeTab() === 'media';
    const isMediaCard = card.hasAttribute('data-app-id') ||
        card.closest('#mediaGrid') !== null ||
        isMediaTabActive;

    const appType = card.dataset.appType || 'browser';
    const canManageBrowser = isMediaCard && appType !== 'browser' ? false : (isMediaCard && appType !== 'exe');
    const shareMode = card.dataset.shareMode || 'private';
    const sharedWithUserId = card.dataset.sharedWithUserId || '';
    const isSharedFromOther = card.dataset.sharedFromOther === 'true';
    const shareUsers = (window._doorpiUsers || []).filter(u => u.Id !== window._doorpiCurrentUserId);
    const shareModeOptions = [
        { value: 'private', label: t('shareModePrivate') },
        { value: 'all', label: t('shareModeAll') },
        { value: 'user', label: t('shareModeUser') }
    ];
    const shareUserOptions = [
        { value: '', label: t('shareChooseUser') },
        ...shareUsers.map(u => ({ value: u.Id, label: u.Name || t('defaultUser') }))
    ];

    const shareOptions = shareUsers.map(u => `<option value="${escapeHtml(u.Id)}" ${sharedWithUserId === u.Id ? 'selected' : ''}>${escapeHtml(u.Name || t('defaultUser'))}</option>`).join('');

    const mediaExtras = isMediaCard ? `
                <div class="edit-modal-field">
                    <label class="edit-modal-label">${t('accountSharingLabel')}</label>
                    ${isSharedFromOther
            ? `<div class="doorpi-shared-note">${t('sharedByInfo', escapeHtml(card.dataset.sharedFromName || t('defaultOtherUser')))}</div>`
            : `<div class="doorpi-share-grid">
                            ${renderDoorpiChoice('editShareModeChoice', shareModeOptions, shareMode)}
                            ${renderDoorpiChoice('editShareUserChoice', shareUserOptions, sharedWithUserId, shareMode !== 'user')}
                            <select class="doorpi-share-select" id="editShareMode" tabindex="0">
                                <option value="private" ${shareMode === 'private' ? 'selected' : ''}>${t('shareModePrivate')}</option>
                                <option value="all" ${shareMode === 'all' ? 'selected' : ''}>${t('shareModeAll')}</option>
                                <option value="user" ${shareMode === 'user' ? 'selected' : ''}>${t('shareModeUser')}</option>
                            </select>
                            <select class="doorpi-share-select" id="editShareUser" tabindex="0" ${shareMode === 'user' ? '' : 'disabled'}>
                                <option value="">${t('shareChooseUser')}</option>
                                ${shareOptions}
                            </select>
                        </div>`}
                </div>
                ${canManageBrowser ? `<button class="modal-btn secondary" id="editExtensionsBtn" type="button" tabindex="0">${t('manageExtensions')}</button>` : ''}` : '';

    const overlay = document.createElement('div');
    overlay.className = 'edit-modal-overlay';
    _editOverlay = overlay;
    overlay.innerHTML = `
        <div class="edit-modal" role="dialog" aria-modal="true" aria-label="${t('editModalTitle')}">
            <div class="edit-modal-header">
                <div>
                    <h3 class="edit-modal-title">${t('editModalTitle')}</h3>
                    <p class="edit-modal-subtitle">${t('editModalSubtitle')}</p>
                </div>
            </div>
            <div class="edit-modal-body">
                <div class="edit-modal-field">
                    <label class="edit-modal-label" for="editNameInput">${t('editModalFieldName')}</label>
                    <input class="edit-modal-input" id="editNameInput" type="text" autocomplete="off" spellcheck="false" />
                    <span class="edit-modal-input-hint">${t('editModalHint')}</span>
                </div>
                ${mediaExtras}
            </div>
            <div class="edit-modal-actions">
                <button class="modal-btn cancel" id="editCancelBtn">${t('editModalCancel')}</button>
                <button class="modal-btn primary" id="editSaveBtn">${t('editModalSave')}</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    const input = overlay.querySelector('#editNameInput');
    input.value = currentName;
    bindDoorpiChoice(overlay.querySelector('#editShareModeChoice'), value => {
        setDoorpiChoiceDisabled('editShareUserChoice', value !== 'user');
    });
    bindDoorpiChoice(overlay.querySelector('#editShareUserChoice'));
    overlay.querySelector('#editShareMode')?.addEventListener('change', e => {
        const userSelect = overlay.querySelector('#editShareUser');
        if (userSelect) userSelect.disabled = e.target.value !== 'user';
    });

    const doClose = () => {
        isEditModalOpen = false;
        window._vkbForceClose();
        overlay.style.opacity = '0';
        overlay.style.transition = 'opacity 0.12s';
        setTimeout(() => { overlay.remove(); _editOverlay = null; }, 130);
        window.focusFeaturedCard?.();
    };

    overlay.querySelector('#editExtensionsBtn')?.addEventListener('click', () => {
        doClose(); // 🔹 Fecha o modal de Editar antes de abrir Extensões
        openExtensionsManager();
    });

    const doSave = () => {
        const newName = input.value.trim();
        if (newName && newName !== currentName) {
            const gameId = card.dataset.gameId || card.dataset.appId;
            const allCards = Array.from(document.querySelectorAll('.card, .nav-vertical-card')).filter(c =>
                c.dataset.gameId === gameId || c.dataset.appId === gameId
            );
            allCards.forEach(c => {
                const titleEl = c.querySelector('.title, .nav-vertical-card-title');
                if (titleEl) titleEl.innerText = newName;
            });
            if (typeof _menuData !== 'undefined') {
                ['games', 'media'].forEach(cat => {
                    if (!_menuData[cat]) return;
                    const item = _menuData[cat].find(i => (i.LaunchUrl || i.Path || i.Url) === gameId);
                    if (item) item.Name = newName;
                });
            }
            postToHost({ action: 'editGame', gameId: gameId, newName });
        }
        if (isMediaCard && !isSharedFromOther) {
            const mode = getDoorpiChoiceValue('editShareModeChoice') || 'private';
            const targetUser = getDoorpiChoiceValue('editShareUserChoice') || '';
            const appId = card.dataset.appId || card.dataset.gameId;
            card.dataset.shareMode = mode;
            card.dataset.sharedWithUserId = mode === 'user' ? targetUser : '';
            postToHost({ action: 'updateAppSharing', appId, shareMode: mode, sharedWithUserId: targetUser });
        }
        doClose();
    };

    overlay.querySelector('#editSaveBtn').addEventListener('click', doSave);
    overlay.querySelector('#editCancelBtn').addEventListener('click', doClose);
    overlay.addEventListener('mousedown', e => { if (e.target === overlay) doClose(); });

    input.addEventListener('keydown', e => {
        if (window._vkbIsOpen) return;
        if (e.key === 'Enter') {
            e.preventDefault();
            window._vkbOpen?.(input);
        }
        if (e.key === 'Escape') { e.preventDefault(); doClose(); }
    });

    input.addEventListener('click', () => { if (!window._vkbIsOpen) window._vkbOpen?.(); });

    window._editModalClose = doClose;
    window._editModalSave = doSave;
    isEditModalOpen = true;

    requestAnimationFrame(() => {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
    });
}

// ══════════════════════════════════════════════════════════════════════════
// Teclado Virtual
// ══════════════════════════════════════════════════════════════════════════

window._vkbIsOpen = false;

const VKB = (() => {
    const FLAT_KEYS = [
        '1', '2', '3', '4', '5', '6', '7', '8', '9', '0',
        'q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p',
        'a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', '⌫',
        'shift', 'z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.',
        'space', 'cancel', 'ok',
    ];

    let _el = null;
    let _callbacks = {};
    let _returnFocusEl = null;
    let _shifted = true;
    let _inputEl = null;
    let _cursorPos = 0;

    function _build() {
        if (_el) return;
        _el = document.createElement('div');
        _el.className = 'vkb-overlay';

        const dynamicLabels = { '⌫': '⌫', shift: '⇧', space: t('vkbSpace'), cancel: t('vkbCancel'), ok: t('vkbOk') };

        const keysHtml = FLAT_KEYS.map(k => {
            const lbl = dynamicLabels[k] ?? k;
            return `<button class="vkb-key" data-key="${k}" tabindex="0">${lbl}</button>`;
        }).join('');

        _el.innerHTML = `
            <div class="vkb-preview-wrap">
                <span class="vkb-preview-label">${t('vkbPreviewLabel')}</span>
                <div class="vkb-preview-text" id="vkbPreview"></div>
            </div>
            <div class="vkb-grid">${keysHtml}</div>
        `;
        document.body.appendChild(_el);

        _el.querySelectorAll('.vkb-key').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                _pressKey(btn.dataset.key);
            });
        });
    }

    function _syncCursorToInput() {
        if (!_inputEl) return;
        _inputEl.setSelectionRange(_cursorPos, _cursorPos);
    }

    function _insertText(text) {
        if (!_inputEl) return;
        let val = _inputEl.value;
        _inputEl.value = val.substring(0, _cursorPos) + text + val.substring(_cursorPos);
        _cursorPos += text.length;
        _syncCursorToInput();
    }

    function _deleteText() {
        if (!_inputEl || _cursorPos <= 0) return;
        let val = _inputEl.value;
        _inputEl.value = val.substring(0, _cursorPos - 1) + val.substring(_cursorPos);
        _cursorPos--;
        _syncCursorToInput();
    }

    function _pressKey(key) {
        if (!_inputEl) return;

        if (key === '⌫') { _deleteText(); }
        else if (key === 'shift') { _setShiftVisual(!_shifted); return; }
        else if (key === 'space') { _insertText(' '); }
        else if (key === 'ok') {
            const fn = _callbacks.onOk ?? window._editModalSave;
            _forceClose();
            fn?.();
            return;
        }
        else if (key === 'cancel') {
            const fn = _callbacks.onCancel ?? window._editModalClose;
            _forceClose();
            fn?.();
            return;
        }
        else { _insertText(_shifted ? key.toUpperCase() : key); }

        _inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        _renderPreview();
    }

    function _renderPreview() {
        const el = document.getElementById('vkbPreview');
        if (!el || !_inputEl) return;
        const val = _inputEl.value || '';
        const formatHtml = (text) => _esc(text).replace(/ /g, '&nbsp;');
        const left = val.substring(0, _cursorPos);
        const right = val.substring(_cursorPos);
        el.innerHTML = `${formatHtml(left)}<span class="vkb-cursor"></span>${formatHtml(right)}`;
    }

    function _moveCursor(dir) {
        if (!_inputEl) return;
        let newPos = _cursorPos + dir;
        if (newPos >= 0 && newPos <= _inputEl.value.length) _cursorPos = newPos;
        _syncCursorToInput();
        _renderPreview();
    }

    function _setShiftVisual(on) {
        _shifted = on;
        const btn = _el?.querySelector('[data-key="shift"]');
        btn?.classList.toggle('shifted', on);
        _el?.querySelectorAll('.vkb-key').forEach(k => {
            const key = k.dataset.key;
            if (key && key.length === 1 && key >= 'a' && key <= 'z')
                k.textContent = on ? key.toUpperCase() : key;
        });
    }

    function _open(targetInput, callbacks = {}) {
        _callbacks = callbacks;
        _returnFocusEl = targetInput ?? document.activeElement;
        _inputEl = targetInput || document.getElementById('editNameInput');

        if (!_inputEl) return;
        _build();

        if (_el) {
            _el.querySelector('.vkb-preview-label').textContent = t('vkbPreviewLabel');
            _el.querySelector('[data-key="space"]').textContent = t('vkbSpace');
            _el.querySelector('[data-key="cancel"]').textContent = t('vkbCancel');
            _el.querySelector('[data-key="ok"]').textContent = t('vkbOk');
        }

        _setShiftVisual(_shifted);
        _cursorPos = _inputEl.value.length;
        _inputEl.classList.add('vkb-active');
        if (typeof _editOverlay !== 'undefined' && _editOverlay) _editOverlay.classList.add('vkb-active');

        _el.style.display = 'block';
        _renderPreview();
        _syncCursorToInput();

        requestAnimationFrame(() => {
            _el.classList.add('visible');
            window._vkbIsOpen = true;
            _el.querySelector('[data-key="q"]')?.focus();
        });
    }

    function _forceClose() {
        if (!_el) return;
        _callbacks = {};
        window._vkbIsOpen = false;
        _el.classList.remove('visible');

        if (_inputEl) { _inputEl.classList.remove('vkb-active'); _inputEl = null; }
        if (typeof _editOverlay !== 'undefined' && _editOverlay) _editOverlay.classList.remove('vkb-active');

        const returnTo = _returnFocusEl;
        _returnFocusEl = null;
        setTimeout(() => { returnTo?.focus(); window.updateNavHint?.(); }, 350);
        setTimeout(() => { if (_el && !_el.classList.contains('visible')) _el.style.display = 'none'; }, 340);
    }

    function _physicalKey(key) {
        if (!_inputEl) return;
        if (key === 'Backspace') { _deleteText(); }
        else if (key.length === 1) { _insertText(key); }
        _inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        _renderPreview();
    }

    return {
        open: _open, forceClose: _forceClose, cancel: _forceClose, physicalKey: _physicalKey,
        toggleShift: () => _setShiftVisual(!_shifted), moveCursor: _moveCursor
    };
})();

const _TEXT_INPUT_TYPES = new Set(['text', 'search', 'email', 'password', 'url', 'tel', '']);
window._vkbOpen = (el, callbacks) => {
    if (el && el.tagName === 'INPUT' && !_TEXT_INPUT_TYPES.has((el.type || '').toLowerCase())) return;
    VKB.open(el, callbacks);
};
window._vkbCancel = () => VKB.cancel();
window._vkbForceClose = () => VKB.forceClose();
window._vkbPhysicalKey = (k) => VKB.physicalKey(k);
window._vkbToggleShift = () => VKB.toggleShift();
window._vkbMoveCursor = (dir) => VKB.moveCursor(dir);
window._vkbClearFocus = () => {
    const el = document.activeElement;
    if (el && el.classList.contains('vkb-key')) el.blur();
};
window._vkbHasFocus = () => {
    const el = document.activeElement;
    return el && el.classList.contains('vkb-key');
};

function _esc(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// =============================================================================
// Indicador Flutuante (Menu Seta para Baixo)
// =============================================================================

(function initNavHint() {
    const navHint = document.createElement('div');
    navHint.id = 'navHintDown';
    navHint.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <polyline points="6 9 12 15 18 9" stroke="rgba(255,255,255,0.45)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
    `;
    document.body.appendChild(navHint);

    window.updateNavHint = function () {
        const hint = document.getElementById('navHintDown');
        if (!hint) return;

        if (window.isNavMenuOpen) {
            hint.classList.add('visible', 'nav-open');
            return;
        }

        hint.classList.remove('nav-open');

        const focused = document.activeElement;
        const isCard = focused?.classList?.contains('card') && !focused?.classList?.contains('add-card');
        const inGrid = focused?.closest('#gameGrid') || focused?.closest('#mediaGrid');

        const isOverlayOpen = window.isModalOpen || window.isSetupOpen ||
            window._vkbIsOpen || window.isGlobalLoading ||
            (typeof isCtxMenuOpen !== 'undefined' && isCtxMenuOpen) ||
            (typeof isEditModalOpen !== 'undefined' && isEditModalOpen);

        if (isOverlayOpen) { hint.classList.remove('visible'); return; }
        hint.classList.toggle('visible', !!(isCard && inGrid));
    };

    document.addEventListener('focusin', window.updateNavHint);
    document.addEventListener('focusout', window.updateNavHint);
})();

// ── Fundo animado (blobs) — aparece quando não há hero ativo ──────────────────
(function initBlobBackground() {
    const canvas = document.createElement('canvas');
    canvas.id = 'appBlobBg';
    canvas.style.cssText =
        'position:fixed;inset:0;width:100%;height:100%;z-index:-1;' +
        'pointer-events:none;opacity:0;transition:opacity 0.6s ease;';
    document.body.appendChild(canvas);

    const ctx = canvas.getContext('2d');

    const blobs = [
        { px: 0.0, py: 0.3, sx: 0.00018, sy: 0.00013, r: 0.62, color: [45, 65, 185] },
        { px: 1.2, py: 2.1, sx: 0.00014, sy: 0.00019, r: 0.56, color: [28, 85, 210] },
        { px: 2.5, py: 0.8, sx: 0.00022, sy: 0.00011, r: 0.52, color: [70, 50, 165] },
        { px: 0.7, py: 3.4, sx: 0.00016, sy: 0.00024, r: 0.50, color: [22, 110, 175] },
        { px: 3.1, py: 1.6, sx: 0.00012, sy: 0.00017, r: 0.46, color: [90, 70, 195] },
        { px: 1.8, py: 4.2, sx: 0.00020, sy: 0.00015, r: 0.42, color: [30, 130, 190] },
    ];

    let t = 0, _raf = null;

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
        _raf = requestAnimationFrame(frame);
    }

    frame();

    let _blobShowTimer = null;

    function checkHeroState() {
        const bgBlur = document.getElementById('bgBlur');
        const heroInactive = !bgBlur?.src || bgBlur.style.opacity === '0' || !bgBlur.src;

        if (heroInactive) {
            if (!_blobShowTimer) {
                _blobShowTimer = setTimeout(() => {
                    const stillInactive = !bgBlur?.src || bgBlur.style.opacity === '0';
                    if (stillInactive) canvas.style.opacity = '1';
                    _blobShowTimer = null;
                }, 400);
            }
        } else {
            if (_blobShowTimer) { clearTimeout(_blobShowTimer); _blobShowTimer = null; }
            canvas.style.opacity = '0';
        }
    }

    const bgBlur = document.getElementById('bgBlur');
    if (bgBlur) {
        new MutationObserver(checkHeroState).observe(bgBlur, {
            attributes: true,
            attributeFilter: ['src', 'style']
        });
    }

    const _origSwitch = window.switchHeroBackground;
    window.switchHeroBackground = function (...args) {
        _origSwitch?.(...args);
        setTimeout(checkHeroState, 0);
    };

    checkHeroState();
    window._startBlobBg = () => { if (!_raf) frame(); };
    window._stopBlobBg = () => { if (_raf) { cancelAnimationFrame(_raf); _raf = null; } };
})();
document.addEventListener('focusin', () => {
    const focused = document.activeElement;
    const isCard = focused?.classList?.contains('card');
    const isInGrid = focused?.closest('#gameGrid');

    const isNavMenuActive = document.body.classList.contains('nav-menu-active') || window.isNavMenuOpen;

    if (!isCard && !isInGrid && !isNavMenuActive) {
        window._heroCleanupTimer = setTimeout(() => {
            const bgBlur = document.getElementById('bgBlur');
            const heroImg = document.getElementById('heroImage');
            const logoEl = document.getElementById('gameLogo');
            const gridBgImg = document.getElementById('gridBgImg');

            if (bgBlur) bgBlur.style.opacity = '0';
            if (heroImg) heroImg.style.opacity = '0';
            if (logoEl) { logoEl.classList.remove('visible'); logoEl.style.opacity = ''; }
            if (gridBgImg) gridBgImg.removeAttribute('src');

            _currentBgSrc = '';
            if (typeof _heroReqId !== 'undefined') _heroReqId++;
        }, 80);
    }
});


function clearLoadingCards(tab = 'games') {
    const gridId = tab === 'games' ? 'gameGrid' : 'mediaGrid';
    const grid = document.getElementById(gridId);
    if (!grid) return;
    grid.querySelectorAll('.card.loading-card').forEach(c => c.remove());
}
function clearHero() {
    const isNavMenuActive = document.body.classList.contains('nav-menu-active') || window.isNavMenuOpen;
    if (isNavMenuActive) return;

    window._heroCleanupTimer = setTimeout(() => {
        const bgBlur = document.getElementById('bgBlur');
        const heroImg = document.getElementById('heroImage');
        const logoEl = document.getElementById('gameLogo');
        const gridBgImg = document.getElementById('gridBgImg');

        if (bgBlur) bgBlur.style.opacity = '0';
        if (heroImg) heroImg.style.opacity = '0';
        if (logoEl) { logoEl.classList.remove('visible'); logoEl.style.opacity = ''; }
        if (gridBgImg) gridBgImg.removeAttribute('src');

        _currentBgSrc = '';
        if (typeof _heroReqId !== 'undefined') _heroReqId++;
    }, 80);
}
document.getElementById('btnAdd')?.addEventListener('mouseenter', clearHero);
document.getElementById('btnAdd')?.addEventListener('focus', clearHero);

document.getElementById('btnAddMedia')?.addEventListener('mouseenter', clearHero);
document.getElementById('btnAddMedia')?.addEventListener('focus', clearHero);


// ══════════════════════════════════════════════════════════════════════════
// View: Aplicativos (App Web + Executável)
// ══════════════════════════════════════════════════════════════════════════

let _activeMediaSubtab = 'web';

function _initMediaAppsView() {
    _switchMediaSubtab(_activeMediaSubtab);

    document.getElementById('mediaAppSubtabs')
        ?.querySelectorAll('.subtab')
        .forEach(btn => {
            const fresh = btn.cloneNode(true);
            btn.replaceWith(fresh);
            fresh.addEventListener('click', () => _switchMediaSubtab(fresh.dataset.subtab));
        });
}

function _switchMediaSubtab(subtab) {
    _activeMediaSubtab = subtab;

    document.querySelectorAll('#mediaAppSubtabs .subtab').forEach(b =>
        b.classList.toggle('active', b.dataset.subtab === subtab));

    document.getElementById('subview-web')?.classList.toggle('hidden', subtab !== 'web');
    document.getElementById('subview-web')?.classList.toggle('active', subtab === 'web');
    document.getElementById('subview-exe')?.classList.toggle('hidden', subtab !== 'exe');
    document.getElementById('subview-exe')?.classList.toggle('active', subtab === 'exe');

    if (subtab === 'web') {
        _renderWebAppActions();
        _modalReady = true;
        setTimeout(() => document.getElementById('webAppNameInput')?.focus(), 150);
    } else {
        _renderExeAppModal();

        setTimeout(() => {
            const firstApp = document.querySelector('#appListMedia .app-item');
            if (firstApp) firstApp.focus();
            else document.getElementById('btnSearchMedia')?.focus();
        }, 150);
    }
}

function _renderWebAppActions() {
    const bar = document.getElementById('mediaAppActions');
    bar.innerHTML = `
        <div class="action-buttons">
            <button class="modal-btn primary" id="btnAddWebApp" tabindex="0" data-gamepad-hint="start">
                <span data-i18n="btnAddWebApp">${t('btnAddWebApp')}</span>
            </button>
            <button class="modal-btn cancel" id="btnCancelWebApp" tabindex="0" data-gamepad-hint="cancel">
                <span data-i18n="btnCancelLabel">${t('btnCancelLabel')}</span>
            </button>
        </div>`;

    document.getElementById('btnAddWebApp').addEventListener('click', _submitWebApp);
    document.getElementById('btnCancelWebApp').addEventListener('click', closeModal);

    const btnPaste = document.getElementById('btnWebAppPaste');
    if (btnPaste) {
        const freshBtn = btnPaste.cloneNode(true);
        btnPaste.replaceWith(freshBtn);
        freshBtn.addEventListener('click', () => {
            postToHost({ action: 'readClipboard' });
        });
    }

    ['webAppNameInput', 'webAppUrlInput'].forEach(id => {
        const input = document.getElementById(id);
        if (!input) return;

        input.removeAttribute('readonly');
        input.setAttribute('tabindex', '0');

        const fresh = input.cloneNode(true);
        input.replaceWith(fresh);

        fresh.addEventListener('focus', () => { if (!window._vkbIsOpen) fresh.style.caretColor = ''; });
        fresh.addEventListener('blur', () => { if (!window._vkbIsOpen) fresh.style.caretColor = 'transparent'; });
        fresh.addEventListener('click', () => { if (!window._vkbIsOpen) window._vkbOpen?.(fresh); });

        fresh.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (!window._vkbIsOpen) window._vkbOpen?.(fresh);
            }
        });
    });

    if (typeof updateGamepadUI === 'function') updateGamepadUI(isGamepadConnected, _controllerType);
}

function _submitWebApp() {
    const nameInput = document.getElementById('webAppNameInput');
    const urlInput = document.getElementById('webAppUrlInput');
    const hint = document.getElementById('webAppHint');

    const name = nameInput?.value.trim() || '';
    let url = urlInput?.value.trim() || '';

    nameInput?.classList.remove('error');
    urlInput?.classList.remove('error');
    if (hint) { hint.textContent = ''; hint.classList.remove('error'); }

    if (!name) {
        nameInput?.classList.add('error');
        nameInput?.focus();
        if (hint) {
            hint.textContent = t('webAppErrorName');
            hint.classList.add('error');
        }
        return;
    }

    if (!url || url === 'https://' || url === 'http://') {
        urlInput?.classList.add('error');
        urlInput?.focus();
        if (hint) {
            hint.textContent = t('webAppErrorUrl');
            hint.classList.add('error');
        }
        return;
    }

    if (!/^https?:\/\//i.test(url)) {
        url = 'https://' + url;
    }

    // Adiciona ao set de IDs para marcar como "novo"
    window.newGameIdsThisSession.add(url);
    // Mostra 1 skeleton para o webapp que será adicionado
    showLoadingCards(1, 'media');
    postToHost({ action: 'addWebApp', name, url });
    closeModal(); // Fecha o modal imediatamente
}

function _shakeWebField(inputId, hintEl, msg) {
    const input = document.getElementById(inputId);
    if (!input) return;
    input.classList.add('error');
    input.addEventListener('input', () => input.classList.remove('error'), { once: true });
    if (hintEl) { hintEl.textContent = msg; hintEl.classList.add('error'); }
}

function _renderExeAppModal() {
    const bar = document.getElementById('mediaAppActions');
    bar.innerHTML = `
        <div class="selection-counter" id="selectionCounterMedia">
            <span class="counter-dot"></span>
            <span id="selectionCounterMediaText"></span>
        </div>
        <div class="action-buttons">
            <button class="modal-btn primary" id="btnConfirmAddMedia" tabindex="0" data-gamepad-hint="start">
                <span data-i18n="btnConfirmLabel">${t('btnConfirmLabel')}</span>
            </button>
            <button class="modal-btn secondary" id="btnSearchMedia" tabindex="0" data-gamepad-hint="triangle">
                <span data-i18n="btnSearchLabel">${t('btnSearchLabel')}</span>
            </button>
            <button class="modal-btn cancel" id="btnCancelAddMedia" tabindex="0" data-gamepad-hint="cancel">
                <span data-i18n="btnCancelLabel">${t('btnCancelLabel')}</span>
            </button>
        </div>`;

    document.getElementById('btnCancelAddMedia').addEventListener('click', closeModal);
    document.getElementById('btnSearchMedia').addEventListener('click', () => {
        showGlobalLoading(t('detectingLibrary'), t('waitingWindows'));
        postToHost({
            action: 'browseManualMedia',
            dialogTitle: t('dlgBrowseTitle'),
            dialogFilter: t('dlgBrowseFilter'),
            loadingTitle: t('loadingAddingGame'),
            loadingSub: t('loadingFetchingCovers'),
            errorMsg: t('msgErrorOpenFile')
        });
    });
    document.getElementById('btnConfirmAddMedia').addEventListener('click', () => {
        const selected = Array.from(
            document.querySelectorAll('#appListMedia .app-item.selected')
        ).map(el => ({ Name: el.dataset.name, Path: el.dataset.path, LaunchUrl: el.dataset.launch }));

        if (selected.length > 0) {
            selected.forEach(app => newGameIdsThisSession.add(app.LaunchUrl || app.Path));
            postToHost({ action: 'addSelectedMediaApps', apps: selected });
            showLoadingCards(selected.length, 'media');
            closeModal(); // Fecha instantaneamente
        } else {
            closeModal();
        }
    });

    const availableApps = allInstalledApps.filter(a => (a.AddedTo || a.addedTo) !== 'game');
    _populateExeList(availableApps);
    _modalReady = true;

    if (typeof updateGamepadUI === 'function') updateGamepadUI(isGamepadConnected, _controllerType);
}

function _populateExeList(apps) {
    const appList = document.getElementById('appListMedia');
    if (!appList) return;

    appList.innerHTML = apps.map(app => {
        const icon = app.IconBase64 || app.iconBase64;
        const name = app.Name || app.name;
        const path = app.Path || app.path;
        const launch = app.LaunchUrl || app.launchUrl || '';
        const source = app.Source || app.source;
        const isAdded = app.IsAdded === true || app.isAdded === true;

        return `
        <div class="app-item ${isAdded ? 'already-added' : ''}" ${isAdded ? '' : 'tabindex="0"'}
             data-path="${path.replace(/\\/g, '\\\\')}"
             data-launch="${launch}"
             data-name="${name.replace(/"/g, '&quot;')}">
            ${icon ? `<img class="app-icon" src="data:image/png;base64,${icon}" />` : ''}
            <div class="app-item-info">
                <span class="app-name">${name}</span>
            </div>
            ${getPlatformBadge(source)}
        </div>`;
    }).join('');

    appList.querySelectorAll('.app-item:not(.already-added)').forEach(item =>
        item.addEventListener('click', function () {
            this.classList.toggle('selected');
            const count = appList.querySelectorAll('.app-item.selected').length;
            const counter = document.getElementById('selectionCounterMedia');
            const text = document.getElementById('selectionCounterMediaText');
            if (text) text.innerText = count === 1 ? t('selectedOne') : t('selectedMany', count);
            counter?.classList.toggle('visible', count > 0);
        })
    );
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT' && !window._vkbIsOpen) {
        if (isEditModalOpen || isSetupOpen || isModalOpen) {
            e.preventDefault();
            window._vkbOpen?.(e.target);
        }
    }
});
// Solicita o status de atualizações de extensões após o carregamento inicial da UI

setTimeout(() => {
    postToHost({ action: 'requestExtensionUpdates' });
}, 1500);