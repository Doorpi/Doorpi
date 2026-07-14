(function () {
    'use strict';

    let picker = null;
    let rightStickLastAt = 0;

    const tx = (key, fallback, ...args) => {
        try {
            const value = window.t?.(key, ...args);
            return value && value !== key ? value : fallback;
        } catch { return fallback; }
    };

    const esc = value => String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');

    function ensureStyles() {
        if (document.getElementById('profile-photo-picker-styles')) return;
        const style = document.createElement('style');
        style.id = 'profile-photo-picker-styles';
        style.textContent = `
            .profile-photo-picker-overlay { position:fixed; inset:0; z-index:14500; display:flex; align-items:center; justify-content:center; padding:clamp(24px,4vw,64px); background:rgba(3,5,14,.86); box-sizing:border-box; }
            .profile-photo-picker { width:min(1480px,96vw); max-height:min(920px,92vh); display:flex; flex-direction:column; overflow:hidden; border:1px solid rgba(255,255,255,.16); border-radius:8px; background:#10131d; box-shadow:0 28px 90px rgba(0,0,0,.62); color:#fff; }
            .profile-photo-picker-overlay.profile-photo-search-vkb-open { align-items:flex-start; padding-top:var(--profile-photo-vkb-clearance,44vh); }
            .profile-photo-picker-overlay.profile-photo-search-vkb-open .profile-photo-picker { max-height:calc(100vh - var(--profile-photo-vkb-clearance,44vh) - clamp(24px,4vw,64px)); }
            .profile-photo-picker-head { display:flex; align-items:flex-start; justify-content:space-between; gap:24px; padding:clamp(20px,2.4vw,32px); border-bottom:1px solid rgba(255,255,255,.09); }
            .profile-photo-picker-title { margin:0; font-size:clamp(1.1rem,1.5vw,1.65rem); font-weight:700; letter-spacing:.08em; }
            .profile-photo-picker-subtitle { margin:0; color:rgba(255,255,255,.48); font-size:clamp(.8rem,.9vw,1rem); }
            .profile-photo-picker-close { width:42px; height:42px; display:grid; place-items:center; border:1px solid rgba(255,255,255,.14); border-radius:6px; background:rgba(255,255,255,.05); color:#fff; font:inherit; font-size:1.3rem; outline:none; }
            .profile-photo-picker-close:focus { border-color:#72b8ff; box-shadow:0 0 0 3px rgba(75,155,255,.22); }
            .profile-photo-picker-body { min-height:0; overflow:auto; padding:clamp(20px,2.4vw,32px); }
            .profile-photo-sources { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:14px; }
            .profile-photo-source { min-height:128px; display:flex; flex-direction:column; align-items:flex-start; justify-content:flex-end; gap:7px; padding:20px; border:1px solid rgba(255,255,255,.12); border-radius:7px; background:rgba(255,255,255,.045); color:#fff; text-align:left; font:inherit; outline:none; }
            .profile-photo-source strong { font-size:1rem; }
            .profile-photo-source span { color:rgba(255,255,255,.46); font-size:.82rem; line-height:1.35; }
            .profile-photo-source:focus { border-color:#72b8ff; background:rgba(72,145,230,.16); box-shadow:0 0 0 3px rgba(75,155,255,.18); }
            .profile-photo-source:disabled { opacity:.38; cursor:not-allowed; }
            .profile-photo-key-hint { grid-column:1/-1; margin:0; color:rgba(255,255,255,.46); font-size:.82rem; }
            .profile-photo-toolbar { display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:start; gap:10px; margin-bottom:24px; }
            .profile-photo-search-wrap { min-width:0; display:grid; gap:8px; }
            .profile-photo-game-suggestions { display:grid; gap:6px; }
            .profile-photo-game-suggestion { min-height:38px; padding:0 13px; overflow:hidden; border:1px solid rgba(255,255,255,.11); border-radius:5px; background:rgba(255,255,255,.045); color:rgba(255,255,255,.78); font:inherit; font-size:.82rem; text-align:left; text-overflow:ellipsis; white-space:nowrap; outline:none; }
            .profile-photo-game-suggestion:focus { border-color:#72b8ff; background:rgba(70,145,230,.18); box-shadow:0 0 0 3px rgba(75,155,255,.18); }
            .profile-photo-input { min-width:0; padding:14px 16px; border:1px solid rgba(255,255,255,.16); border-radius:6px; background:rgba(255,255,255,.07); color:#fff; font:inherit; outline:none; }
            .profile-photo-input:focus { border-color:#72b8ff; box-shadow:0 0 0 3px rgba(75,155,255,.2); }
            .profile-photo-command { min-height:48px; padding:0 22px; border:1px solid rgba(255,255,255,.18); border-radius:6px; background:rgba(255,255,255,.08); color:#fff; font:inherit; font-weight:650; outline:none; }
            #profilePhotoSearchButton { height:48px; align-self:start; }
            .profile-photo-command:focus { border-color:#72b8ff; background:rgba(70,145,230,.18); box-shadow:0 0 0 3px rgba(75,155,255,.2); }
            .profile-photo-status { min-height:24px; margin:0 0 14px; color:rgba(255,255,255,.52); font-size:.86rem; }
            .profile-photo-group { margin-top:18px; }
            .profile-photo-group-head { display:flex; align-items:center; gap:14px; margin-bottom:12px; color:rgba(255,255,255,.72); font-size:.76rem; font-weight:800; text-transform:uppercase; letter-spacing:.12em; }
            .profile-photo-group-head::after { content:''; height:1px; flex:1; background:rgba(255,255,255,.1); }
            .profile-photo-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(clamp(138px,11vw,172px),1fr)); gap:12px; }
            .profile-photo-choice { position:relative; aspect-ratio:1; padding:0; overflow:hidden; border:2px solid transparent; border-radius:6px; background:rgba(255,255,255,.04); outline:none; }
            .profile-photo-choice.vertical { aspect-ratio:2/3; }
            .profile-photo-choice img { width:100%; height:100%; object-fit:cover; display:block; }
            .profile-photo-choice:focus { border-color:#fff; transform:scale(1.035); z-index:2; box-shadow:0 12px 28px rgba(0,0,0,.5); }
            .profile-photo-choice small { position:absolute; left:6px; right:6px; bottom:6px; padding:5px 6px; overflow:hidden; border-radius:3px; background:rgba(0,0,0,.72); color:#fff; font-size:.62rem; text-overflow:ellipsis; white-space:nowrap; opacity:0; }
            .profile-photo-choice:focus small { opacity:1; }
            .profile-photo-empty { padding:30px 0; color:rgba(255,255,255,.34); }
            .profile-photo-url-panel { display:grid; gap:14px; }
            .profile-photo-url-actions { display:flex; flex-wrap:wrap; gap:10px; }
            .profile-photo-crop-layout { display:grid; grid-template-columns:minmax(300px,1fr) minmax(220px,.62fr); align-items:center; gap:clamp(28px,5vw,72px); }
            .profile-photo-crop-stage { position:relative; width:min(54vh,500px); max-width:100%; aspect-ratio:1; justify-self:center; overflow:hidden; border:2px solid rgba(255,255,255,.82); border-radius:50%; background:#05060b; outline:none; box-shadow:0 22px 60px rgba(0,0,0,.5),0 0 0 12px rgba(255,255,255,.035); }
            .profile-photo-crop-stage:focus { border-color:#72b8ff; box-shadow:0 0 0 5px rgba(75,155,255,.26),0 22px 60px rgba(0,0,0,.5); }
            .profile-photo-crop-image { position:absolute; left:50%; top:50%; max-width:none; transform-origin:center; user-select:none; pointer-events:none; }
            .profile-photo-crop-stage.loading { display:grid; place-items:center; border-color:rgba(255,255,255,.2); cursor:default; }
            .profile-photo-loading-preview { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; opacity:.2; filter:blur(5px); transform:scale(1.04); }
            .profile-photo-loading-shade { position:absolute; inset:0; background:rgba(4,6,12,.58); }
            .profile-photo-loading-state { position:relative; z-index:1; width:min(72%,320px); display:grid; justify-items:center; gap:14px; color:#fff; text-align:center; }
            .profile-photo-loading-state strong { font-size:clamp(.92rem,1.1vw,1.15rem); font-weight:650; }
            .profile-photo-progress { width:100%; height:6px; overflow:hidden; border-radius:999px; background:rgba(255,255,255,.13); }
            .profile-photo-progress-fill { display:block; width:0; height:100%; border-radius:inherit; background:#72b8ff; transition:width .16s ease; }
            .profile-photo-progress.indeterminate .profile-photo-progress-fill { width:38%; animation:profilePhotoProgress 1.05s ease-in-out infinite; }
            .profile-photo-progress-value { min-height:1em; color:rgba(255,255,255,.58); font-size:.76rem; }
            .profile-photo-crop-info { display:flex; flex-direction:column; gap:16px; }
            .profile-photo-crop-info h4 { margin:0; font-size:clamp(1.1rem,1.6vw,1.8rem); font-weight:450; }
            .profile-photo-crop-info p { margin:0; color:rgba(255,255,255,.5); line-height:1.55; }
            .profile-photo-crop-actions { display:grid; gap:10px; margin-top:8px; }
            .profile-photo-error { color:#ff9d9d; }
            @keyframes profilePhotoProgress { from { transform:translateX(-120%); } to { transform:translateX(330%); } }
            @media (max-width:800px) {
                .profile-photo-sources { grid-template-columns:1fr; }
                .profile-photo-crop-layout { grid-template-columns:1fr; }
                .profile-photo-crop-stage { width:min(46vh,360px); }
            }
        `;
        document.head.appendChild(style);
    }

    function closePicker(applied = false) {
        if (!picker) return false;
        const state = picker;
        if (state.overlay.classList.contains('profile-photo-search-vkb-open'))
            window._vkbForceClose?.({ restoreFocus: false });
        picker = null;
        clearTimeout(state.suggestionTimer);
        state.overlay.remove();
        document.body.classList.remove('profile-photo-picker-open');
        requestAnimationFrame(() => state.returnFocus?.focus?.({ preventScroll: true }));
        return true;
    }

    function setSearchKeyboardLayout(active) {
        if (!picker) return;
        const overlay = picker.overlay;
        overlay.classList.toggle('profile-photo-search-vkb-open', !!active);
        if (!active) {
            overlay.style.removeProperty('--profile-photo-vkb-clearance');
            return;
        }

        const updateClearance = () => {
            if (!picker || picker.overlay !== overlay) return;
            const keyboard = document.querySelector('.vkb-overlay.visible');
            if (!keyboard) return;
            const bottom = Math.ceil(keyboard.getBoundingClientRect().bottom + 14);
            overlay.style.setProperty('--profile-photo-vkb-clearance', `${bottom}px`);
        };
        requestAnimationFrame(() => requestAnimationFrame(updateClearance));
    }

    function setStatus(message, error = false) {
        if (!picker) return;
        const status = picker.overlay.querySelector('.profile-photo-status');
        if (!status) return;
        status.textContent = message || '';
        status.classList.toggle('profile-photo-error', !!error);
    }

    function post(message) {
        if (typeof window.postToHost === 'function') window.postToHost(message);
    }

    function sourceScreen() {
        if (!picker) return;
        if (picker.mode === 'crop-loading')
            picker.requestId = `profile_source_canceled_${Date.now()}`;
        picker.mode = 'source';
        picker.body.innerHTML = `
            <div class="profile-photo-sources">
                <button class="profile-photo-source" data-source="steamgrid" ${picker.hasApiKey ? '' : 'disabled'}>
                    <strong>SteamGrid</strong>
                    <span>${tx('profilePhotoSteamGridDesc', 'Artes quadradas ou verticais.')}</span>
                </button>
                <button class="profile-photo-source" data-source="local">
                    <strong>${tx('profilePhotoComputer', 'Computador')}</strong>
                    <span>${tx('profilePhotoComputerDesc', 'Imagem deste computador.')}</span>
                </button>
                <button class="profile-photo-source" data-source="url">
                    <strong>${tx('profilePhotoExternalUrl', 'URL externa')}</strong>
                    <span>${tx('profilePhotoExternalUrlDesc', 'Imagem por link direto.')}</span>
                </button>
                ${picker.hasApiKey ? '' : `<p class="profile-photo-key-hint">${tx('profilePhotoSteamGridNeedsKey', 'Cadastre sua chave SteamGrid para usar esta opção.')}</p>`}
            </div>`;

        picker.body.querySelector('[data-source="steamgrid"]')?.addEventListener('click', () => steamGridScreen(true));
        picker.body.querySelector('[data-source="local"]')?.addEventListener('click', () => {
            picker.requestId = `photo_${Date.now()}_${Math.random().toString(16).slice(2)}`;
            setStatus(tx('profilePhotoOpeningFile', 'Abrindo seletor de imagem...'));
            post({ action: 'pickProfilePhotoSource', requestId: picker.requestId, dialogTitle: tx('dlgPhotoTitle', 'Selecionar foto de perfil') });
        });
        picker.body.querySelector('[data-source="url"]')?.addEventListener('click', urlScreen);
        requestAnimationFrame(() => picker?.body.querySelector('.profile-photo-source:not(:disabled)')?.focus({ preventScroll: true }));
    }

    function urlScreen() {
        if (!picker) return;
        picker.mode = 'url';
        picker.body.innerHTML = `
            <div class="profile-photo-url-panel">
                <p class="profile-photo-status">${tx('profilePhotoUrlHint', 'Cole ou digite o link da imagem.')}</p>
                <div class="profile-photo-toolbar">
                    <input class="profile-photo-input" id="profilePhotoUrlInput" type="url" data-vkb-disabled="true" autocomplete="off" />
                    <button class="profile-photo-command" id="profilePhotoUrlLoad">${tx('profilePhotoLoad', 'Carregar')}</button>
                </div>
                <div class="profile-photo-url-actions">
                    <button class="profile-photo-command" id="profilePhotoUrlPaste" type="button">${tx('imageUrlPaste', 'Colar URL')}</button>
                    <button class="profile-photo-command" id="profilePhotoUrlBrowser" type="button">${tx('imageUrlOpenBrowser', 'Abrir navegador')}</button>
                </div>
                <button class="profile-photo-command" id="profilePhotoUrlBack">${tx('navBack', 'Voltar')}</button>
            </div>`;
        const input = picker.body.querySelector('#profilePhotoUrlInput');
        const load = () => {
            const url = input.value.trim();
            if (!url) return;
            loadRemoteSource(url, 'url', 0);
        };
        picker.body.querySelector('#profilePhotoUrlPaste').addEventListener('click', () => {
            post({ action: 'readClipboard' });
        });
        picker.body.querySelector('#profilePhotoUrlBrowser').addEventListener('click', () => {
            post({ action: 'openImageBrowserCapture', target: 'profilePhoto' });
        });
        picker.body.querySelector('#profilePhotoUrlLoad').addEventListener('click', load);
        picker.body.querySelector('#profilePhotoUrlBack').addEventListener('click', sourceScreen);
        input.addEventListener('keydown', event => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            load();
        });
        requestAnimationFrame(() => input.focus({ preventScroll: true }));
    }

    function steamGridScreen(suggestions) {
        if (!picker || !picker.hasApiKey) return;
        picker.mode = 'steamgrid';
        picker.body.scrollTop = 0;
        picker.body.innerHTML = `
            <div class="profile-photo-toolbar">
                <div class="profile-photo-search-wrap">
                    <input class="profile-photo-input" id="profilePhotoSearchInput" type="text" readonly autocomplete="off" spellcheck="false" placeholder="${esc(tx('profilePhotoSearchPlaceholder', 'Pesquisar jogo...'))}" />
                    <div class="profile-photo-game-suggestions" id="profilePhotoGameSuggestions"></div>
                </div>
                <button class="profile-photo-command" id="profilePhotoSearchButton">${tx('artworkSearch', 'Pesquisar')}</button>
            </div>
            <p class="profile-photo-status"></p>
            <div id="profilePhotoResults"></div>`;
        const input = picker.body.querySelector('#profilePhotoSearchInput');
        const closeSearchKeyboard = () => setSearchKeyboardLayout(false);
        input._doorpiVkbReturnFocus = input;
        input._doorpiVkbCallbacks = {
            placement: 'top',
            onEnter: closeSearchKeyboard,
            onOk: closeSearchKeyboard,
            onCancel: closeSearchKeyboard
        };
        input.addEventListener('click', event => {
            input.removeAttribute('readonly');
            if (!window._doorpiShouldOpenVkbFromEvent?.(event)) return;
            if (window._vkbOpen?.(input, input._doorpiVkbCallbacks)) setSearchKeyboardLayout(true);
        });
        const search = () => {
            const query = input.value.trim();
            picker.overlay.querySelector('#profilePhotoGameSuggestions').innerHTML = '';
            if (!query) {
                if (!picker.showingRecommendations) requestArtwork(true, '');
                return;
            }
            requestArtwork(false, query);
        };
        picker.body.querySelector('#profilePhotoSearchButton').addEventListener('click', search);
        input.addEventListener('input', () => {
            if (!picker) return;
            clearTimeout(picker.suggestionTimer);
            const query = input.value.trim();
            const suggestions = picker.overlay.querySelector('#profilePhotoGameSuggestions');
            if (!query) {
                suggestions.innerHTML = '';
                if (!picker.showingRecommendations) requestArtwork(true, '');
                return;
            }
            picker.showingRecommendations = false;
            picker.suggestionTimer = setTimeout(() => requestGameSuggestions(query), 280);
        });
        requestArtwork(!!suggestions, '');
    }

    function requestGameSuggestions(query) {
        if (!picker || picker.mode !== 'steamgrid' || !query) return;
        picker.gameSuggestionRequestId = `profile_games_${Date.now()}_${Math.random().toString(16).slice(2)}`;
        post({
            action: 'searchProfilePhotoGames',
            requestId: picker.gameSuggestionRequestId,
            query,
            apiKey: picker.apiKey
        });
    }

    function handleGameSuggestions(data) {
        if (!picker || picker.mode !== 'steamgrid' || picker.gameSuggestionRequestId !== data.requestId) return;
        const input = picker.overlay.querySelector('#profilePhotoSearchInput');
        const container = picker.overlay.querySelector('#profilePhotoGameSuggestions');
        if (!input || !container || input.value.trim().toLocaleLowerCase() !== String(data.query || '').trim().toLocaleLowerCase()) return;
        const games = Array.isArray(data.games) ? data.games.slice(0, 6) : [];
        container.innerHTML = games.map(game =>
            `<button class="profile-photo-game-suggestion" type="button" data-name="${esc(game.name)}">${esc(game.name)}</button>`
        ).join('');
        container.querySelectorAll('.profile-photo-game-suggestion').forEach(button => {
            button.addEventListener('click', () => {
                const name = button.dataset.name || '';
                if (!name) return;
                if (window._vkbIsOpen) window._vkbForceClose?.({ restoreFocus: false });
                setSearchKeyboardLayout(false);
                input.value = name;
                container.innerHTML = '';
                requestArtwork(false, name);
            });
        });
    }

    function requestArtwork(suggestions, query) {
        if (!picker) return;
        picker.requestId = `profile_art_${Date.now()}_${Math.random().toString(16).slice(2)}`;
        picker.showingRecommendations = !!suggestions;
        picker.overlay.querySelector('#profilePhotoResults').innerHTML = '';
        picker.body.scrollTop = 0;
        if (suggestions && picker.recommendations) {
            handleArtworkResults({
                type: 'profilePhotoArtworkResults',
                requestId: picker.requestId,
                suggestions: true,
                squares: picker.recommendations.squares,
                verticals: picker.recommendations.verticals
            });
            return;
        }
        setStatus(suggestions
            ? tx('profilePhotoLoadingSuggestions', 'Carregando sugestões...')
            : tx('profilePhotoSearching', 'Pesquisando artes...'));
        post({
            action: 'searchProfilePhotoArtwork',
            requestId: picker.requestId,
            query,
            suggestions,
            apiKey: picker.apiKey
        });
    }

    function renderArtworkGroup(title, shape, items) {
        if (!items.length) return '';
        return `
            <section class="profile-photo-group">
                <div class="profile-photo-group-head">${esc(title)}</div>
                <div class="profile-photo-grid">
                    ${items.map(item => `
                        <button class="profile-photo-choice ${shape}" data-url="${esc(item.url)}" data-preview="${esc(item.thumb || item.url)}" data-asset-id="${Number(item.id || 0)}" type="button">
                            <img src="${esc(item.thumb || item.url)}" loading="lazy" alt="" />
                            <small>${esc(item.gameName || '')}</small>
                        </button>`).join('')}
                </div>
            </section>`;
    }

    function handleArtworkResults(data) {
        if (!picker || picker.requestId !== data.requestId || picker.mode !== 'steamgrid') return;
        const squares = Array.isArray(data.squares) ? data.squares : [];
        const verticals = Array.isArray(data.verticals) ? data.verticals : [];
        picker.showingRecommendations = !!data.suggestions;
        if (data.suggestions && !data.error)
            picker.recommendations = { squares, verticals };
        const results = picker.overlay.querySelector('#profilePhotoResults');
        if (!results) return;
        setStatus(data.error
            ? tx('profilePhotoSearchFailed', 'Não foi possível consultar o SteamGrid.')
            : tx('profilePhotoResultCount', `${squares.length + verticals.length} imagens encontradas`, squares.length + verticals.length),
            !!data.error);
        results.innerHTML = squares.length || verticals.length
            ? renderArtworkGroup(tx('profilePhotoSquares', 'Quadradas'), 'square', squares) +
              renderArtworkGroup(tx('profilePhotoVerticals', 'Verticais'), 'vertical', verticals)
            : `<div class="profile-photo-empty">${tx('profilePhotoNoResults', 'Nenhuma arte estática sem logo foi encontrada.')}</div>`;
        results.querySelectorAll('.profile-photo-choice').forEach(button => {
            button.addEventListener('click', () => loadRemoteSource(
                button.dataset.url,
                'steamgrid',
                Number(button.dataset.assetId || 0),
                button.dataset.preview || ''));
        });
        picker.body.scrollTop = 0;
        requestAnimationFrame(() => {
            picker?.body?.scrollTo?.({ top: 0, behavior: 'auto' });
            results.querySelector('.profile-photo-choice')?.focus({ preventScroll: true });
        });
    }

    function loadRemoteSource(url, source, assetId, previewUrl = '') {
        if (!picker) return;
        picker.requestId = `profile_source_${Date.now()}_${Math.random().toString(16).slice(2)}`;
        loadingCropScreen(previewUrl);
        post({ action: 'loadProfilePhotoSource', requestId: picker.requestId, url, source, assetId });
    }

    function loadingCropScreen(previewUrl = '') {
        if (!picker) return;
        picker.mode = 'crop-loading';
        picker.body.innerHTML = `
            <div class="profile-photo-crop-layout">
                <div class="profile-photo-crop-stage loading" id="profilePhotoCropLoadingStage" aria-busy="true">
                    ${previewUrl ? `<img class="profile-photo-loading-preview" src="${esc(previewUrl)}" alt="" />` : ''}
                    <span class="profile-photo-loading-shade"></span>
                    <div class="profile-photo-loading-state">
                        <strong>${tx('profilePhotoDownloading', 'Preparando imagem...')}</strong>
                        <div class="profile-photo-progress indeterminate" id="profilePhotoProgress" role="progressbar">
                            <span class="profile-photo-progress-fill"></span>
                        </div>
                        <span class="profile-photo-progress-value" id="profilePhotoProgressValue"></span>
                    </div>
                </div>
                <div class="profile-photo-crop-info">
                    <h4>${tx('profilePhotoDownloading', 'Preparando imagem...')}</h4>
                    <p>${tx('profilePhotoDownloadingHint', 'Baixando a imagem para o editor.')}</p>
                    <div class="profile-photo-crop-actions">
                        <button class="profile-photo-command" id="profilePhotoLoadingBack">${tx('navBack', 'Voltar')}</button>
                    </div>
                </div>
            </div>`;
        picker.body.querySelector('#profilePhotoLoadingBack')?.addEventListener('click', sourceScreen);
        requestAnimationFrame(() => picker?.body.querySelector('#profilePhotoLoadingBack')?.focus({ preventScroll: true }));
    }

    function handleSourceProgress(data) {
        if (!picker || picker.requestId !== data.requestId || picker.mode !== 'crop-loading') return;
        const progress = picker.overlay.querySelector('#profilePhotoProgress');
        const fill = progress?.querySelector('.profile-photo-progress-fill');
        const value = picker.overlay.querySelector('#profilePhotoProgressValue');
        if (data.percent === null || data.percent === undefined) return;
        const percent = Number(data.percent);
        if (!progress || !fill || !value || !Number.isFinite(percent)) return;
        const bounded = Math.max(0, Math.min(100, Math.round(percent)));
        progress.classList.remove('indeterminate');
        progress.setAttribute('aria-valuenow', String(bounded));
        fill.style.width = `${bounded}%`;
        value.textContent = `${bounded}%`;
    }

    function handleSourceLoaded(data) {
        if (!picker || picker.requestId !== data.requestId) return;
        handleSourceProgress({ requestId: data.requestId, percent: 100 });
        const image = new Image();
        image.onload = () => {
            if (!picker) return;
            if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 16777216) {
                setStatus(tx('profilePhotoDimensionsTooLarge', 'A imagem possui dimensões grandes demais.'), true);
                return;
            }
            picker.source = {
                dataUrl: data.dataUrl,
                source: data.source || 'local',
                sourceUrl: data.sourceUrl || '',
                assetId: Number(data.assetId || 0),
                naturalWidth: image.naturalWidth,
                naturalHeight: image.naturalHeight
            };
            cropScreen();
        };
        image.onerror = () => showSourceLoadError(tx('profilePhotoInvalidImage', 'A imagem não pôde ser decodificada.'));
        image.src = data.dataUrl;
    }

    function showSourceLoadError(message) {
        if (!picker || picker.mode !== 'crop-loading') {
            setStatus(message, true);
            return;
        }
        const title = picker.overlay.querySelector('.profile-photo-loading-state strong');
        const detail = picker.overlay.querySelector('.profile-photo-crop-info p');
        const progress = picker.overlay.querySelector('#profilePhotoProgress');
        if (title) {
            title.textContent = message;
            title.classList.add('profile-photo-error');
        }
        if (detail) detail.textContent = message;
        progress?.remove();
        picker.overlay.querySelector('#profilePhotoLoadingBack')?.focus({ preventScroll: true });
    }

    function cropScreen() {
        if (!picker?.source) return;
        picker.mode = 'crop';
        picker.crop = { offsetX: 0, offsetY: 0, zoom: 1 };
        picker.body.innerHTML = `
            <div class="profile-photo-crop-layout">
                <button class="profile-photo-crop-stage" id="profilePhotoCropStage" type="button" aria-label="${esc(tx('profilePhotoConfirmCrop', 'Confirmar enquadramento'))}">
                    <img class="profile-photo-crop-image" src="${picker.source.dataUrl}" alt="" />
                </button>
                <div class="profile-photo-crop-info">
                    <h4>${tx('profilePhotoAdjustTitle', 'Ajuste o enquadramento')}</h4>
                    <p>${tx('profilePhotoAdjustHint', 'Use o analógico esquerdo para mover e o direito para aproximar ou afastar.')}</p>
                    <div class="profile-photo-crop-actions">
                        <button class="profile-photo-command" id="profilePhotoConfirm">${tx('profilePhotoUseImage', 'Usar esta imagem')}</button>
                        <button class="profile-photo-command" id="profilePhotoCropBack">${tx('navBack', 'Voltar')}</button>
                    </div>
                </div>
            </div>`;
        const stage = picker.body.querySelector('#profilePhotoCropStage');
        stage.addEventListener('keydown', event => {
            const delta = event.shiftKey ? 18 : 9;
            if (event.key === 'ArrowLeft') picker.crop.offsetX -= delta;
            else if (event.key === 'ArrowRight') picker.crop.offsetX += delta;
            else if (event.key === 'ArrowUp') picker.crop.offsetY -= delta;
            else if (event.key === 'ArrowDown') picker.crop.offsetY += delta;
            else return;
            event.preventDefault();
            event.stopPropagation();
            updateCropTransform();
        });
        stage.addEventListener('click', confirmCrop);
        picker.body.querySelector('#profilePhotoConfirm').addEventListener('click', confirmCrop);
        picker.body.querySelector('#profilePhotoCropBack').addEventListener('click', sourceScreen);
        requestAnimationFrame(() => {
            updateCropTransform();
            stage.focus({ preventScroll: true });
        });
    }

    function cropMetrics() {
        const stage = picker?.overlay.querySelector('#profilePhotoCropStage');
        if (!picker?.source || !stage) return null;
        const size = Math.max(1, stage.clientWidth);
        const fit = Math.max(size / picker.source.naturalWidth, size / picker.source.naturalHeight);
        const scaledWidth = picker.source.naturalWidth * fit * picker.crop.zoom;
        const scaledHeight = picker.source.naturalHeight * fit * picker.crop.zoom;
        const maxX = Math.max(0, (scaledWidth - size) / 2);
        const maxY = Math.max(0, (scaledHeight - size) / 2);
        picker.crop.offsetX = Math.max(-maxX, Math.min(maxX, picker.crop.offsetX));
        picker.crop.offsetY = Math.max(-maxY, Math.min(maxY, picker.crop.offsetY));
        return { stage, size, fit, scaledWidth, scaledHeight };
    }

    function updateCropTransform() {
        const metrics = cropMetrics();
        const image = picker?.overlay.querySelector('.profile-photo-crop-image');
        if (!metrics || !image) return;
        image.style.width = `${picker.source.naturalWidth * metrics.fit}px`;
        image.style.height = `${picker.source.naturalHeight * metrics.fit}px`;
        image.style.transform = `translate(-50%, -50%) translate(${picker.crop.offsetX}px, ${picker.crop.offsetY}px) scale(${picker.crop.zoom})`;
    }

    function adjustZoom(axisY) {
        if (!picker || picker.mode !== 'crop' || Math.abs(axisY) < .18) return false;
        const now = performance.now();
        const dt = Math.min(50, Math.max(8, rightStickLastAt ? now - rightStickLastAt : 16));
        rightStickLastAt = now;
        picker.crop.zoom = Math.max(1, Math.min(3.2, picker.crop.zoom + axisY * dt * .0018));
        updateCropTransform();
        return true;
    }

    function confirmCrop() {
        const metrics = cropMetrics();
        if (!picker?.source || !metrics) return;
        const scale = metrics.fit * picker.crop.zoom;
        const sourceSize = metrics.size / scale;
        const centerX = picker.source.naturalWidth / 2 - picker.crop.offsetX / scale;
        const centerY = picker.source.naturalHeight / 2 - picker.crop.offsetY / scale;
        const sx = Math.max(0, Math.min(picker.source.naturalWidth - sourceSize, centerX - sourceSize / 2));
        const sy = Math.max(0, Math.min(picker.source.naturalHeight - sourceSize, centerY - sourceSize / 2));
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 1024;
        const ctx = canvas.getContext('2d', { alpha: false });
        ctx.fillStyle = '#080a10';
        ctx.fillRect(0, 0, 1024, 1024);
        const image = picker.overlay.querySelector('.profile-photo-crop-image');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(image, sx, sy, sourceSize, sourceSize, 0, 0, 1024, 1024);
        const dataUrl = canvas.toDataURL('image/jpeg', .9);
        const result = {
            base64: dataUrl.slice(dataUrl.indexOf(',') + 1),
            photoSource: picker.source.source,
            photoSourceUrl: picker.source.sourceUrl,
            photoSteamGridAssetId: picker.source.assetId,
            photoCropX: Number((picker.crop.offsetX / metrics.size).toFixed(5)),
            photoCropY: Number((picker.crop.offsetY / metrics.size).toFixed(5)),
            photoZoom: Number(picker.crop.zoom.toFixed(5))
        };
        const apply = picker.onApply;
        closePicker(true);
        apply?.(result);
    }

    window.openDoorpiProfilePhotoPicker = function (options = {}) {
        closePicker(false);
        ensureStyles();
        const overlay = document.createElement('div');
        overlay.className = 'profile-photo-picker-overlay';
        overlay.innerHTML = `
            <div class="profile-photo-picker" role="dialog" aria-modal="true">
                <div class="profile-photo-picker-head">
                    <div>
                        <h3 class="profile-photo-picker-title">${tx('profilePhotoPickerTitle', 'SELECIONE UMA IMAGEM')}</h3>
                    </div>
                    <button class="profile-photo-picker-close" type="button" aria-label="${esc(tx('btnCancel', 'Cancelar'))}">×</button>
                </div>
                <div class="profile-photo-picker-body"></div>
            </div>`;
        document.body.appendChild(overlay);
        picker = {
            overlay,
            body: overlay.querySelector('.profile-photo-picker-body'),
            apiKey: String(options.apiKey || '').trim(),
            hasApiKey: !!options.hasApiKey || !!String(options.apiKey || '').trim(),
            onApply: options.onApply,
            returnFocus: options.returnFocus || document.activeElement,
            mode: 'source',
            requestId: '',
            gameSuggestionRequestId: '',
            suggestionTimer: 0,
            recommendations: null,
            showingRecommendations: false
        };
        document.body.classList.add('profile-photo-picker-open');
        overlay.querySelector('.profile-photo-picker-close').addEventListener('click', () => closePicker(false));
        overlay.addEventListener('mousedown', event => { if (event.target === overlay) closePicker(false); });
        overlay.addEventListener('keydown', event => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            window._profilePhotoPickerShortcut?.('cancel');
        });
        sourceScreen();
    };

    window._profilePhotoPickerHandleMessage = function (data) {
        if (!picker || !data) return false;
        if (data.type === 'profilePhotoArtworkResults') handleArtworkResults(data);
        else if (data.type === 'profilePhotoGameSuggestions') handleGameSuggestions(data);
        else if (data.type === 'profilePhotoSourceProgress') handleSourceProgress(data);
        else if (data.type === 'profilePhotoSourceLoaded') handleSourceLoaded(data);
        else if (data.type === 'profilePhotoSourceFailed') {
            if (picker.requestId !== data.requestId) return false;
            const errorKey = data.error === 'profile-photo-too-large'
                ? 'profilePhotoTooLarge'
                : data.error === 'profile-photo-invalid-format'
                    ? 'profilePhotoAnimatedRejected'
                    : 'profilePhotoLoadFailed';
            showSourceLoadError(tx(errorKey, 'Não foi possível carregar esta imagem.'));
        }
        else if (data.type === 'profilePhotoSourceCanceled') {
            if (picker.requestId !== data.requestId) return false;
            sourceScreen();
        }
        return true;
    };

    window._profilePhotoPickerIsOpen = () => !!picker;
    window._profilePhotoPickerHandleClipboard = value => {
        if (!picker || picker.mode !== 'url') return false;
        const input = picker.overlay.querySelector('#profilePhotoUrlInput');
        if (!input) return false;
        input.value = String(value || '').trim();
        input.dispatchEvent(new Event('input', { bubbles: true }));
        requestAnimationFrame(() => picker?.overlay?.querySelector('#profilePhotoUrlLoad')?.focus({ preventScroll: true }));
        return true;
    };
    window._profilePhotoPickerSetUrl = value => window._profilePhotoPickerHandleClipboard?.(value);
    window._profilePhotoPickerFocusUrl = () => {
        const input = picker?.overlay?.querySelector('#profilePhotoUrlInput');
        input?.focus?.({ preventScroll: true });
    };
    window._profilePhotoPickerAdjustZoom = value => adjustZoom(Number(value || 0));
    document.addEventListener('doorpi-vkb-closed', event => {
        if (!picker?.overlay?.classList.contains('profile-photo-search-vkb-open')) return;
        if (event.detail?.input?.id !== 'profilePhotoSearchInput') return;
        setSearchKeyboardLayout(false);
    });
    window._profilePhotoPickerShortcut = action => {
        if (!picker) return false;
        if (action === 'confirm') {
            if (picker.mode === 'crop') confirmCrop();
            else document.activeElement?.click?.();
            return true;
        }
        if (action === 'cancel') {
            if (picker.mode === 'source') closePicker(false);
            else sourceScreen();
            return true;
        }
        return false;
    };
})();
