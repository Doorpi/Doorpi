// =============================================================================
'use strict';

window.isNavMenuOpen = false;

(function () {

    // ── Dados Locais ──────────────────────────────────────────────────────────
    let _menuData = { user: {}, games: [], media: [] };

    async function _loadJSONs() {
        try {
            const ts = new Date().getTime();
            const [uRes, gRes, mRes] = await Promise.allSettled([
                fetch(`https://data.local/user.json?t=${ts}`),
                fetch(`https://data.local/games.json?t=${ts}`),
                fetch(`https://data.local/media.json?t=${ts}`)
            ]);

            if (uRes.status === 'fulfilled' && uRes.value.ok) _menuData.user = await uRes.value.json();
            if (gRes.status === 'fulfilled' && gRes.value.ok) _menuData.games = await gRes.value.json();
            if (mRes.status === 'fulfilled' && mRes.value.ok) _menuData.media = await mRes.value.json();
        } catch (e) {
            console.warn("Fetch bloqueado pelo WebView (CORS). Usando fallback local...", e);
        }

        // ── FALLBACKS (Garante que nunca fique vazio) ──
        if (!_menuData.user || Object.keys(_menuData.user).length === 0) {
            _menuData.user = window._doorpiProfile || {};
        }

        if (!_menuData.games || _menuData.games.length === 0) {
            const gameCards = Array.from(document.querySelectorAll('#gameGrid .card:not(.add-card)'));
            _menuData.games = gameCards.map(c => ({
                Name: c.querySelector('.title')?.innerText || '',
                Path: c.dataset.gameId || '',
                GridImage: c.dataset.vertical || '',
                GridStaticImage: c.dataset.staticVertical || ''
            }));
        }

        if (!_menuData.media || _menuData.media.length === 0) {
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

    // ── i18n helper ───────────────────────────────────────────────────────────
    function _t(key, fallback) {
        try { return (typeof t === 'function' ? t(key) : null) || fallback; }
        catch { return fallback; }
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
    let _topbarFocus = true; // Estilo PS5: navegação agora é no topo
    let _contentIdx = 0;
    let _contentItems = [];
    let _overlay = null;
    let _bgRaf = null;
    let _lastFocus = null;

    // ── Estilos ────────────────────────────────────────
    (function injectStyles() {
        if (document.getElementById('nav-menu-styles')) return;
        const s = document.createElement('style');
        s.id = 'nav-menu-styles';
        s.textContent = `
        /* ── Overlay Transição ── */
        #navMenuOverlay {
            position: fixed;
            inset: 0;
            z-index: 8000;
            display: none;
            opacity: 0;
            transition: opacity 0.4s cubic-bezier(0.25, 1, 0.5, 1);
            font-family: 'Inter', 'Segoe UI', sans-serif;
            background: rgba(0, 0, 0, 0.4);
        }
        #navMenuOverlay.visible { opacity: 1; }

        #navMenuBg {
            position: absolute;
            inset: 0; width: 100%; height: 100%;
            z-index: 0; pointer-events: none;
        }

        /* O Layout Fade In com Zoom sutil */
        .nav-layout {
            position: relative;
            z-index: 1;
            display: flex;
            flex-direction: column;
            width: 100%; height: 100%;
            transform: scale(1.03);
            transition: transform 0.4s cubic-bezier(0.2, 0.9, 0.3, 1);
            background: radial-gradient(circle at 50% 0%, rgba(255,255,255,0.03) 0%, rgba(0,0,0,0.6) 80%);
            
        }
        #navMenuOverlay.visible .nav-layout { transform: scale(1); }


        .nav-topbar {
            display: flex;
            align-items: center;
            padding: clamp(20px, 3vh, 40px) clamp(30px, 4vw, 60px) 0;
            gap: clamp(20px, 3vw, 40px);
            flex-shrink: 0;
             flex-direction: column;
        }

        .nav-back-item {
            display: flex;
            align-items: center;
            gap: 8px;
            color: rgba(255,255,255,0.4);
            font-size: clamp(0.75rem, 0.85vw, 0.95rem);
            font-weight: 500;
            cursor: pointer;
            background: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.1);
            padding: 8px 16px;
            border-radius: 20px;
            transition: all 0.2s ease;
            outline: none;
     
        }
        .nav-back-item:hover { color: #fff; background: rgba(255,255,255,0.1); }

        .nav-cat-list {
            display: flex;
            gap: clamp(16px, 2.5vw, 40px);
        }

        .nav-cat-item {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px;
            cursor: pointer;
            outline: none;
            border: none;
            background: none;
            font-family: inherit;
            color: rgba(255,255,255,0.35);
            position: relative;
            transition: color 0.2s ease;
        }

        .nav-cat-item::after {
            content: '';
            position: absolute;
            bottom: 0; left: 0; right: 0;
            height: 2px;
            background: #fff;
            transform: scaleX(0);
            transform-origin: center;
            transition: transform 0.2s cubic-bezier(0.25, 1, 0.5, 1);
            box-shadow: 0 0 10px rgba(255,255,255,0.5);
        }

        .nav-cat-item.active { color: #fff; }
        .nav-cat-item.active::after { transform: scaleX(1); }
        
        .nav-cat-item.nav-focused { color: #fff;
    background: #f0f8ff1c;
    transform: scale(1.04); }
        .nav-cat-item.nav-focused::after {
            transform: scaleX(1);
            height: 3px;
        }

        
        .nav-cat-label {
            font-size: clamp(0.9rem, 1.1vw, 1.2rem);
            font-weight: 500;
            letter-spacing: 0.02em;
        }

        /* ── Área de Conteúdo ── */
        .nav-content {
            flex: 1;
            display: flex;
            flex-direction: column;
            padding: clamp(20px, 3vh, 40px) clamp(30px, 4vw, 60px);
            overflow: hidden;
            min-width: 0;
        }

        .nav-content-header {
            margin-bottom: clamp(20px, 3vh, 32px);
            flex-shrink: 0;
            text-align: left;
            animation: fadeInTop 0.4s cubic-bezier(0.2, 0.9, 0.3, 1) forwards;
        }
        .nav-content-title {
            font-size: clamp(1.8rem, 2.5vw, 3.2rem);
            font-weight: 300;
            color: #fff;
            margin: 0 0 6px;
            letter-spacing: -0.01em;
        }
        .nav-content-subtitle {
            font-size: clamp(0.85rem, 0.9vw, 1.1rem);
            color: rgba(255,255,255,0.4);
            margin: 0;
            font-weight: 400;
        }

        .nav-content-body {
            flex: 1;
            overflow-y: auto;
            overflow-x: hidden;
            scrollbar-width: none;
            padding: 25px; /* Evita cortar sombras */
            margin: -10px; 
        }
        .nav-content-body::-webkit-scrollbar { display: none; }

        @keyframes fadeInTop {
            from { opacity: 0; transform: translateY(-10px); }
            to   { opacity: 1; transform: none; }
        }

        /* ── Grid Premium ── */
        .nav-big-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(clamp(95px, 8vw, 170px), 1fr));
            gap: clamp(16px, 0.8vw, 24px);
            padding-bottom: 40px;
        }

        .nav-vertical-card {
            aspect-ratio: 2/3;
            border-radius: 8px; /* Mais nítido estilo PS5 */
            overflow: hidden;
            background: rgba(255,255,255,0.03);
            border: 2px solid transparent;
            cursor: pointer;
            outline: none;
            position: relative;
            display: flex;
            flex-direction: column;
            transition: transform 0.2s cubic-bezier(0.25, 1, 0.5, 1), box-shadow 0.2s ease, border-color 0.2s ease;
        }
        
        .nav-vertical-card img {
            position: absolute;
            inset: 0;
            width: 100%; height: 100%;
            object-fit: cover;
            display: block;
        }

        .nav-vertical-card-no-img {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            color: rgba(255,255,255,0.1);
            font-size: clamp(3rem, 4vw, 5rem);
            z-index: 1;
        }

        /* Gradiente de fundo pro texto só aparecer elegante */
        .nav-card-gradient {
            position: absolute;
            bottom: 0; left: 0; right: 0;
            height: 60%;
            background: linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.5) 40%, transparent 100%);
            z-index: 2;
            opacity: 0;
            transition: opacity 0.2s ease;
        }

        .nav-vertical-card-title {
            position: absolute;
            bottom: 0; left: 0; right: 0;
            font-size: clamp(0.75rem, 0.85vw, 1rem);
            color: #fff;
            padding: 12px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            z-index: 3;
            font-weight: 500;
            opacity: 0;
            transform: translateY(10px);
            transition: opacity 0.2s ease, transform 0.2s ease;
            text-shadow: 0 2px 4px rgba(0,0,0,0.8);
        }

        .nav-vertical-card.nav-focused {
            transform: scale(1.08);
            box-shadow: 0 15px 40px rgba(0,0,0,0.8);
            border-color: #fff;
            z-index: 10;
        }
        .nav-vertical-card.nav-focused .nav-card-gradient { opacity: 1; }
        .nav-vertical-card.nav-focused .nav-vertical-card-title { 
            opacity: 1; 
            transform: translateY(0); 
        }

        /* ── Placeholder Vazio ── */
        .nav-placeholder {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            min-height: 300px;
            gap: 20px;
            color: rgba(255,255,255,0.2);
            animation: fadeInTop 0.4s ease;
        }
        .nav-placeholder-icon { font-size: clamp(3rem, 5vw, 6rem); opacity: 0.5; }
        .nav-placeholder-text { font-size: clamp(1rem, 1.2vw, 1.4rem); font-weight: 400; letter-spacing: 0.02em; }

        /* ── Perfil Dashboard Premium ── */
        .nav-profile-dashboard {
            display: flex;
            align-items: flex-start;
            gap: clamp(30px, 4vw, 60px);
            animation: fadeInTop 0.3s ease;
            max-width: 1000px;
        }
        
        .nav-profile-avatar-sec {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 16px;
        }

        .nav-profile-photo {
            width: clamp(120px, 14vw, 180px);
            height: clamp(120px, 14vw, 180px);
            border-radius: 50%;
            background: rgba(255,255,255,0.05);
            border: 3px solid rgba(255,255,255,0.1);
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 3.5rem;
            color: rgba(255,255,255,0.3);
            cursor: pointer;
            outline: none;
            transition: border-color 0.2s, box-shadow 0.2s, transform 0.2s;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        }
        .nav-profile-photo img { width: 100%; height: 100%; object-fit: cover; }
        .nav-profile-photo:focus, .nav-profile-photo.nav-focused-el {
            border-color: #fff;
            box-shadow: 0 0 20px rgba(255,255,255,0.2), 0 10px 40px rgba(0,0,0,0.8);
            transform: scale(1.05);
        }

        .nav-profile-fields {
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: clamp(16px, 2vh, 24px);
            background: rgba(255,255,255,0.02);
            border: 1px solid rgba(255,255,255,0.05);
            padding: clamp(24px, 3vw, 40px);
            border-radius: 16px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        }

        .nav-profile-field { display: flex; flex-direction: column; gap: 8px; }
        .nav-profile-field-label {
            font-size: clamp(0.75rem, 0.85vw, 0.95rem);
            color: rgba(255,255,255,0.4);
            font-weight: 500;
        }
        .nav-profile-field-input {
            background: rgba(0,0,0,0.3);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 8px;
            padding: clamp(14px, 1.8vh, 18px) clamp(16px, 1.6vw, 20px);
            color: #fff;
            font-size: clamp(1rem, 1.1vw, 1.2rem);
            font-family: inherit;
            outline: none;
            width: 100%;
            box-sizing: border-box;
            cursor: pointer;
            transition: border-color 0.2s, box-shadow 0.2s, transform 0.2s;
        }
        .nav-profile-field-input:focus,
        .nav-profile-field-input.nav-focused-el {
            border-color: #fff;
            background: rgba(255,255,255,0.05);
            box-shadow: 0 0 15px rgba(255,255,255,0.1);
            transform: scale(1.02);
        }
        .nav-profile-field-input.vkb-active {
            border-color: rgba(100,160,255,0.8);
            box-shadow: 0 0 0 2px rgba(100,160,255,0.3);
        }
        .nav-cat-icon{
            display:none;
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
                    <button class="nav-back-item" id="navBackItem" tabindex="-1">
                        <span style="font-size:1.2em;opacity:0.8;margin-top:-2px;">⇡</span>
                        <span>${_t('navBack', 'Voltar')}</span>
                    </button>
                    <div class="nav-cat-list" id="navCatList"></div>
                </div>
                <div class="nav-content" id="navContent">
                    <div class="nav-content-header">
                        <h2 class="nav-content-title" id="navContentTitle"></h2>
                        <p class="nav-content-subtitle" id="navContentSub"></p>
                    </div>
                    <div class="nav-content-body" id="navContentBody"></div>
                </div>
            </div>`;

        document.body.appendChild(_overlay);

        document.getElementById('navBackItem').addEventListener('click', close);
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
        _catIdx = Number(idx);

        // Atualiza a linha visual na categoria do topo
        document.querySelectorAll('.nav-cat-item').forEach((el, i) => {
            el.classList.toggle('active', i === _catIdx);
        });
        _updateTopbarFocusVisual();

        const cat = CATS[_catIdx];
        if (!cat) return;

        const titleEl = document.getElementById('navContentTitle');
        const subEl = document.getElementById('navContentSub');

        // Reinicia a animação de forma segura (previne o WebView de piscar em branco)
        const header = document.querySelector('.nav-content-header');
        if (header) {
            header.style.animation = 'none';
            setTimeout(() => {
                if (header) header.style.animation = '';
            }, 10);
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

    // ── Renderização Genérica de Grid ─────────────────────────────────────────
    function _renderGrid(body, items, catId, emptyText, emptyIcon) {
        if (!items.length) {
            body.innerHTML = `<div class="nav-placeholder">
                <div class="nav-placeholder-icon">${emptyIcon}</div>
                <div class="nav-placeholder-text">${emptyText}</div>
            </div>`;
            return;
        }

        body.innerHTML = '<div class="nav-big-grid" id="navDynamicGrid"></div>';
        const grid = document.getElementById('navDynamicGrid');

        items.forEach((item, i) => {
            const name = item.Name || '';
            const animSrc = item.GridImage || '';
            const staticSrc = item.GridStaticImage || animSrc;

            const card = document.createElement('div');
            card.className = 'nav-vertical-card';
            card.tabIndex = -1;
            card.dataset.idx = i;

            card.innerHTML = staticSrc
                ? `<img src="${staticSrc}" alt="${name}" loading="lazy" />`
                : `<div class="nav-vertical-card-no-img">${emptyIcon}</div>`;

            card.innerHTML += `
                <div class="nav-card-gradient"></div>
                <div class="nav-vertical-card-title">${name}</div>
            `;

            const img = card.querySelector('img');
            let _animTimer = null;

            card._startInteraction = () => {
                if (_animTimer) clearTimeout(_animTimer);
                _animTimer = setTimeout(async () => {
                    if (!card.classList.contains('nav-focused')) return;
                    if (img && animSrc && animSrc !== staticSrc) {
                        const tmp = new Image();
                        tmp.src = animSrc;
                        try { await tmp.decode(); } catch (e) { }
                        if (card.classList.contains('nav-focused')) {
                            img.src = animSrc;
                        }
                    }
                }, 200);
            };

            card._stopInteraction = () => {
                if (_animTimer) clearTimeout(_animTimer);
                if (img && staticSrc && img.src !== staticSrc && !img.src.endsWith(staticSrc)) {
                    img.src = staticSrc;
                }
            };

            card.addEventListener('click', () => _launchAction(catId, i));

            card.addEventListener('mouseenter', () => {
                _topbarFocus = false;
                _contentIdx = i;
                _updateContentFocus();
            });

            grid.appendChild(card);
        });

        _contentItems = items;
    }

    // ── Launch ────────────────────────────────────────────────────────────────
    function _launchAction(catId, idx) {
        const items = catId === 'games' ? _menuData.games : _menuData.media;
        const item = items[idx];
        if (!item) return;

        if (typeof postToHost === 'function') {
            if (catId === 'games') {
                const targetPath = item.LaunchUrl || item.Path || '';
                postToHost({ action: 'launch', path: targetPath, errorMsg: _t('msgErrorLaunch', 'Erro ao abrir') });
            } else if (catId === 'media') {
                const targetUrl = item.Url || '';
                const appType = item.Type || 'browser';
                postToHost({ action: 'launchMediaApp', url: targetUrl, appType: appType });
            }
        }
        close();
    }

    // ── Renderização de conteúdo ──────────────────────────────────────────────
    function _renderContent(id) {
        const body = document.getElementById('navContentBody');
        if (!body) return;

        _contentItems = [];

        switch (id) {
            case 'games':
                _renderGrid(body, _menuData.games, id, _t('navNoGames', 'Nenhum jogo encontrado'), '⊞');
                break;
            case 'media':
                _renderGrid(body, _menuData.media, id, _t('navNoMedia', 'Nenhum aplicativo configurado'), '▶');
                break;
            case 'settings':
                body.innerHTML = `<div class="nav-placeholder">
                    <div class="nav-placeholder-icon">⚙</div>
                    <div class="nav-placeholder-text">${_t('navSettingsSoon', 'Configurações do console em breve')}</div>
                </div>`;
                break;
            case 'profile':
                _renderProfile(body);
                break;
        }
    }

    function _renderProfile(body) {
        const prof = _menuData.user || {};
        const name = prof.Name || '—';
        const apiKey = prof.SteamGridApiKey || '';
        const photo = prof.PhotoBase64 || '';
        const masked = apiKey
            ? apiKey.slice(0, 6) + '••••••••' + apiKey.slice(-4)
            : '—';

        body.innerHTML = `
            <div class="nav-profile-dashboard">
                <div class="nav-profile-avatar-sec">
                    <button class="nav-profile-photo" id="navProfilePhoto" tabindex="-1">
                        ${photo ? `<img src="data:image/png;base64,${photo}" />` : '◉'}
                    </button>
                    <span style="color:rgba(255,255,255,0.4); font-size: 0.85rem;">Alterar Avatar</span>
                </div>
                
                <div class="nav-profile-fields">
                    <div class="nav-profile-field">
                        <span class="nav-profile-field-label">${_t('navProfileNameLabel', 'Nome de Usuário')}</span>
                        <input class="nav-profile-field-input" id="navProfName" readonly value="${name}" />
                    </div>
                    <div class="nav-profile-field" style="margin-top: 10px;">
                        <span class="nav-profile-field-label">${_t('navProfileApiLabel', 'Chave API SteamGridDB')}</span>
                        <input class="nav-profile-field-input" id="navProfApi" readonly value="${masked}" />
                    </div>
                </div>
            </div>`;

        const photoBtn = document.getElementById('navProfilePhoto');
        const nameInput = document.getElementById('navProfName');
        const apiInput = document.getElementById('navProfApi');

        _contentItems = [photoBtn, nameInput, apiInput];

        photoBtn.addEventListener('click', () => {
            if (typeof postToHost === 'function') postToHost({ action: 'pickProfilePhoto' });
        });

        nameInput.addEventListener('click', () => {
            nameInput.removeAttribute('readonly');
            window._vkbOpen?.(nameInput, {
                onOk: () => {
                    const v = nameInput.value.trim();
                    if (v && typeof postToHost === 'function') {
                        postToHost({ action: 'saveUserProfile', name: v, apiKey: apiKey, photoBase64: photo });
                        _menuData.user.Name = v;
                    }
                    nameInput.setAttribute('readonly', '');
                    window._vkbForceClose?.();
                },
                onCancel: () => { nameInput.setAttribute('readonly', ''); window._vkbForceClose?.(); }
            });
        });

        apiInput.addEventListener('click', () => {
            apiInput.value = apiKey;
            apiInput.removeAttribute('readonly');
            window._vkbOpen?.(apiInput, {
                onOk: () => {
                    const v = apiInput.value.trim();
                    if (v && typeof postToHost === 'function') {
                        postToHost({ action: 'saveUserProfile', name: name, apiKey: v, photoBase64: photo });
                        _menuData.user.SteamGridApiKey = v;
                    }
                    apiInput.value = v ? v.slice(0, 6) + '••••••••' + v.slice(-4) : '—';
                    apiInput.setAttribute('readonly', '');
                    window._vkbForceClose?.();
                },
                onCancel: () => {
                    apiInput.value = masked;
                    apiInput.setAttribute('readonly', '');
                    window._vkbForceClose?.();
                }
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
        document.querySelectorAll('.nav-vertical-card').forEach((el, i) => {
            const isFocused = !_topbarFocus && i === _contentIdx;
            const wasFocused = el.classList.contains('nav-focused');

            el.classList.toggle('nav-focused', isFocused);

            if (isFocused && !wasFocused) {
                el._startInteraction?.();
            } else if (!isFocused && wasFocused) {
                el._stopInteraction?.();
            }
        });

        if (CATS[_catIdx]?.id === 'profile') {
            _contentItems.forEach((el, i) => {
                if (!el) return;
                el.classList.toggle('nav-focused-el', !_topbarFocus && i === _contentIdx);
            });
        }

        if (_topbarFocus) return;

        const focused = document.querySelector('.nav-vertical-card.nav-focused, .nav-focused-el');
        // Rola suavemente usando block: center para dar sensação mais fluída de console
        focused?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }

    function _gridCols() {
        const grid = document.querySelector('.nav-big-grid');
        if (!grid) return 1;
        return Math.max(1, getComputedStyle(grid).gridTemplateColumns.split(' ').length);
    }

    // ── Abrir / Fechar ────────────────────────────────────────────────────────
    async function open(startIdx = 0) {
        if (window.isNavMenuOpen) return;
        window.isNavMenuOpen = true;

        document.body.classList.add('nav-menu-active');

        window.updateNavHint?.();

        _lastFocus = document.activeElement;
        _catIdx = Math.max(0, Math.min(startIdx, CATS.length - 1));
        _topbarFocus = true;
        _contentIdx = 0;

        _buildOverlay();
        _overlay.style.display = 'flex';

        await _loadJSONs();

        requestAnimationFrame(() => {
            _overlay.classList.add('visible');
            _startBlobBg();
            _selectCat(_catIdx);
            _updateTopbarFocusVisual();
        });
    }

    function close() {
        if (!window.isNavMenuOpen) return;
        window.isNavMenuOpen = false;

        document.body.classList.remove('nav-menu-active');
        document.querySelectorAll('.nav-vertical-card.nav-focused').forEach(el => el._stopInteraction?.());

        _overlay?.classList.remove('visible');
        _stopBlobBg();

        setTimeout(() => {
            if (!window.isNavMenuOpen && _overlay)
                _overlay.style.display = 'none';
        }, 400);

        if (_lastFocus && document.contains(_lastFocus)) {
            _lastFocus.focus();
        } else {
            document.querySelector('#gameGrid .card:not(.add-card)')?.focus();
        }

        setTimeout(() => window.updateNavHint?.(), 50);
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

    window._navMenuHandleKey = function (key) {
        
        if (key === 'L1') { window._navMenuCycleTab(-1); return; }
        if (key === 'R1') { window._navMenuCycleTab(1); return; }

    
        if (_topbarFocus) {
            _navTopbar(key);
        } else {
            _navContent(key);
        }
    };


    document.addEventListener('keydown', e => {
        if (!window.isNavMenuOpen) return;
        if (window._vkbIsOpen) return;

        e.preventDefault();
        e.stopImmediatePropagation();
        window._navMenuHandleKey(e.key);
    }, true);

    function _navTopbar(key) {
        switch (key) {
            case 'ArrowLeft':
                if (_catIdx > 0) { _catIdx--; _selectCat(_catIdx); }
                break;
            case 'ArrowRight':
                if (_catIdx < CATS.length - 1) { _catIdx++; _selectCat(_catIdx); }
                break;
            case 'ArrowDown':
            case 'Enter':
                if (_contentItems.length > 0) {
                    _setTopbarFocus(false);
                    _contentIdx = 0;
                    _updateContentFocus();
                }
                break;
            case 'ArrowUp':
            case 'Escape':
            case 'Backspace':
                close();
                break;
        }
    }

    function _navContent(key) {
        const cols = _gridCols();
        const total = _contentItems.length;

        switch (key) {
            case 'ArrowLeft':
                if (_contentIdx > 0) {
                    _contentIdx--;
                    _updateContentFocus();
                }
                break;
            case 'ArrowRight':
                if (_contentIdx < total - 1) {
                    _contentIdx++;
                    _updateContentFocus();
                }
                break;
            case 'ArrowUp':
                if (_contentIdx < cols) {
                    _setTopbarFocus(true); // Volta para a barra do topo
                } else {
                    _contentIdx = Math.max(0, _contentIdx - cols);
                    _updateContentFocus();
                }
                break;
            case 'ArrowDown':
                if (_contentIdx + cols < total) {
                    _contentIdx += cols;
                    _updateContentFocus();
                }
                break;
            case 'Enter': {
                const catId = CATS[_catIdx]?.id;
                if (catId === 'games' || catId === 'media') { _launchAction(catId, _contentIdx); }
                else if (catId === 'profile') { _contentItems[_contentIdx]?.click(); }
                break;
            }
            case 'Escape':
            case 'Backspace':
                _setTopbarFocus(true);
                break;
        }
    }

    // ── Bridge Update ─────────────────────────────────────────────────────────
    if (window.chrome?.webview) {
        window.chrome.webview.addEventListener('message', e => {
            try {
                const data = JSON.parse(e.data);
                if (data.type === 'profilePhotoSelected' && data.base64) {
                    _menuData.user.PhotoBase64 = data.base64;
                    const apiKey = _menuData.user.SteamGridApiKey || '';
                    const name = _menuData.user.Name || '';
                    postToHost({ action: 'saveUserProfile', name: name, apiKey: apiKey, photoBase64: data.base64 });
                    if (window.isNavMenuOpen && CATS[_catIdx]?.id === 'profile') {
                        _renderContent('profile');
                    }
                }
            } catch { }
        });
    }
    // ── Expose ────────────────────────────────────────────────────────────────
    window.openNavMenu = open;
    window.closeNavMenu = close;

})();