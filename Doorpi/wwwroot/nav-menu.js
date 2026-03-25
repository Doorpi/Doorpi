// =============================================================================
// nav-menu.js — Menu de navegação Xbox-style
// Acionado: ArrowDown no carrossel principal
// Fechado:  ArrowUp na primeira categoria
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
    let _sidebarFocus = true;
    let _contentIdx = 0;
    let _contentItems = [];
    let _overlay = null;
    let _bgRaf = null;
    let _lastFocus = null;

    // ── Estilos ───────────────────────────────────────────────────────────────
    (function injectStyles() {
        if (document.getElementById('nav-menu-styles')) return;
        const s = document.createElement('style');
        s.id = 'nav-menu-styles';
        s.textContent = `
        /* ── Overlay Transição Xbox/Apple TV ── */
        #navMenuOverlay {
            position: fixed;
            inset: 0;
            z-index: 8000;
            display: none;
            opacity: 0;
            transition: opacity 0.35s cubic-bezier(0.25, 1, 0.5, 1);
        }
        #navMenuOverlay.visible { 
            opacity: 1; 
        }

        #navMenuBg {
            position: absolute;
            inset: 0; width: 100%; height: 100%;
            z-index: 0; pointer-events: none;
        }

        /* O Layout desliza de baixo para cima suavemente */
        .nav-layout {
            position: relative;
            z-index: 1;
            display: flex;
            width: 100%; height: 100%;
            transform: translateY(60px);
            transition: transform 0.4s cubic-bezier(0.2, 0.9, 0.3, 1);
        }
        #navMenuOverlay.visible .nav-layout {
            transform: translateY(0);
        }

        /* ── Sidebar ── */
        .nav-sidebar {
            width: clamp(220px, 18vw, 280px);
            flex-shrink: 0;
            display: flex;
            flex-direction: column;
            padding: clamp(28px, 4vh, 48px) 0 clamp(20px, 3vh, 40px);
            background: linear-gradient(to right,
                rgba(4,4,18,0.98) 0%,
                rgba(4,4,18,0.85) 65%,
                transparent 100%);
        }

        .nav-back-item {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: clamp(10px, 1.2vh, 14px) clamp(20px, 2vw, 36px);
            color: rgba(255,255,255,0.22);
            font-size: clamp(0.75rem, 0.85vw, 1rem);
            font-weight: 500;
            letter-spacing: 0.06em;
            margin-bottom: clamp(6px, 0.8vh, 12px);
            cursor: pointer;
            border-left: 3px solid transparent;
            transition: color 0.2s;
            font-family: inherit;
            background: none;
            border: none;
            text-align: left;
            width: 100%;
            outline: none;
        }
        .nav-back-item:hover { color: rgba(255,255,255,0.45); }

        .nav-sidebar-divider {
            height: 1px;
            background: rgba(255,255,255,0.07);
            margin: 0 clamp(20px,2vw,36px) clamp(10px,1.2vh,16px);
        }

        .nav-cat-item {
            display: flex;
            align-items: center;
            gap: clamp(12px, 1.4vw, 20px);
            padding: clamp(14px, 1.8vh, 20px) clamp(20px, 2vw, 36px);
            cursor: pointer;
            outline: none;
            border: none;
            background: none;
            text-align: left;
            width: 100%;
            font-family: inherit;
            border-left: 3px solid transparent;
            color: rgba(255,255,255,0.40);
            transition: color 0.15s, background 0.15s, border-color 0.15s;
        }

        .nav-cat-item.active     { color: rgba(255,255,255,0.72); }
        .nav-cat-item.nav-focused {
            color: #fff;
            border-left-color: #fff;
            background: rgba(255,255,255,0.08);
        }

        .nav-cat-icon {
            font-size: clamp(1rem, 1.3vw, 1.55rem);
            opacity: 0.65;
            flex-shrink: 0;
            width: 1.4em;
            text-align: center;
        }
        .nav-cat-item.active .nav-cat-icon,
        .nav-cat-item.nav-focused .nav-cat-icon { opacity: 1; }

        .nav-cat-label {
            font-size: clamp(0.88rem, 1.05vw, 1.25rem);
            font-weight: 600;
            letter-spacing: 0.03em;
        }

        .nav-cat-count {
            margin-left: auto;
            font-size: clamp(0.65rem, 0.72vw, 0.88rem);
            color: rgba(255,255,255,0.22);
            padding-right: 6px;
        }

        /* ── Content area ── */
        .nav-content {
            flex: 1;
            display: flex;
            flex-direction: column;
            padding: clamp(28px, 4vh, 48px) clamp(24px, 3vw, 48px);
            overflow: hidden;
            min-width: 0;
        }

        .nav-content-header {
            margin-bottom: clamp(16px, 2.2vh, 24px);
            flex-shrink: 0;
        }
        .nav-content-title {
            font-size: clamp(1.4rem, 2.2vw, 2.8rem);
            font-weight: 700;
            color: #fff;
            margin: 0 0 4px;
            letter-spacing: -0.02em;
        }
        .nav-content-subtitle {
            font-size: clamp(0.75rem, 0.84vw, 1.1rem);
            color: rgba(255,255,255,0.35);
            margin: 0;
        }

        .nav-content-body {
            flex: 1;
            overflow-y: auto;
            overflow-x: hidden;
            scrollbar-width: none;
            animation: navBodyIn 0.22s ease;
            padding:1%;
        }
        .nav-content-body::-webkit-scrollbar { display: none; }

        @keyframes navBodyIn {
            from { opacity: 0; transform: translateY(12px); }
            to   { opacity: 1; transform: none; }
        }

        /* ── Grid Vertical Único ── */
        .nav-big-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(clamp(150px, 14vw, 220px), 1fr));
            gap: clamp(14px, 1.5vw, 24px);
            padding-bottom: 30px;
        }

        .nav-vertical-card {
            aspect-ratio: 2/3; /* SEMPRE VERTICAL */
            border-radius: clamp(8px, 0.8vw, 14px);
            overflow: hidden;
            background: rgba(255,255,255,0.06);
            border: 2px solid rgba(255,255,255,0.07);
            cursor: pointer;
            outline: none;
            position: relative;
            display: flex;
            flex-direction: column;
            transition: transform 0.14s ease, box-shadow 0.14s ease, border-color 0.14s ease;
        }
        .nav-vertical-card img {
            width: 100%; flex: 1;
            object-fit: cover;
            display: block; min-height: 0;
        }
        .nav-vertical-card-no-img {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            color: rgba(255,255,255,0.15);
            font-size: clamp(2.5rem, 3.5vw, 4.5rem);
        }
        .nav-vertical-card-title {
            font-size: clamp(0.7rem, 0.8vw, 1.1rem);
            color: rgba(255,255,255,0.75);
            padding: clamp(6px, 0.8vh, 10px) clamp(8px, 1vw, 14px);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            flex-shrink: 0;
            background: rgba(0,0,0,0.65);
            text-align: center;
            font-weight: 500;
        }
        .nav-vertical-card.nav-focused {
            transform: scale(1.05);
            box-shadow: 0 12px 32px rgba(0,0,0,0.8), 0 0 0 3px rgba(255,255,255,0.9);
            border-color: rgba(255,255,255,0.8);
            z-index: 2;
        }
        .nav-vertical-card.nav-focused .nav-vertical-card-title { color: #fff; }

        /* ── Placeholder ── */
        .nav-placeholder {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            min-height: 300px;
            gap: 14px;
            color: rgba(255,255,255,0.18);
        }
        .nav-placeholder-icon  { font-size: clamp(3rem, 5vw, 6rem); }
        .nav-placeholder-text  { font-size: clamp(1rem, 1.2vw, 1.5rem); font-weight: 300; }

        /* ── Perfil ── */
        .nav-profile-wrap {
            display: flex;
            flex-direction: column;
            gap: clamp(18px, 2.5vh, 30px);
            max-width: 600px;
        }
        .nav-profile-hero {
            display: flex;
            align-items: center;
            gap: clamp(18px, 2.2vw, 32px);
        }
        .nav-profile-photo {
            width: clamp(80px, 9vw, 120px);
            height: clamp(80px, 9vw, 120px);
            border-radius: 50%;
            background: rgba(255,255,255,0.07);
            border: 2px solid rgba(255,255,255,0.16);
            overflow: hidden;
            flex-shrink: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 2.5rem;
            color: rgba(255,255,255,0.28);
            cursor: pointer;
            outline: none;
            transition: border-color 0.18s, box-shadow 0.18s, transform 0.18s;
        }
        .nav-profile-photo img { width: 100%; height: 100%; object-fit: cover; }
        .nav-profile-photo:focus, .nav-profile-photo.nav-focused-el {
            border-color: rgba(255,255,255,0.8);
            box-shadow: 0 0 0 4px rgba(255,255,255,0.14);
            transform: scale(1.05);
        }
        .nav-profile-name-text {
            font-size: clamp(1.5rem, 2.5vw, 3rem);
            font-weight: 700;
            color: #fff;
            margin: 0 0 4px;
        }
        .nav-profile-hello {
            font-size: clamp(0.85rem, 0.95vw, 1.1rem);
            color: rgba(255,255,255,0.32);
        }

        .nav-profile-fields {
            display: flex;
            flex-direction: column;
            gap: clamp(12px, 1.5vh, 20px);
        }
        .nav-profile-field { display: flex; flex-direction: column; gap: 6px; }
        .nav-profile-field-label {
            font-size: clamp(0.7rem, 0.8vw, 0.95rem);
            text-transform: uppercase;
            letter-spacing: 0.12em;
            color: rgba(255,255,255,0.28);
            font-weight: 600;
        }
        .nav-profile-field-input {
            background: rgba(255,255,255,0.06);
            border: 1px solid rgba(255,255,255,0.10);
            border-radius: clamp(8px, 0.8vw, 12px);
            padding: clamp(12px, 1.5vh, 20px) clamp(16px, 1.6vw, 22px);
            color: #fff;
            font-size: clamp(0.9rem, 1vw, 1.3rem);
            font-family: inherit;
            outline: none;
            width: 100%;
            box-sizing: border-box;
            cursor: pointer;
            caret-color: rgba(100,160,255,0.9);
            transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
        }
        .nav-profile-field-input:focus,
        .nav-profile-field-input.nav-focused-el {
            border-color: rgba(100,160,255,0.55);
            background: rgba(255,255,255,0.08);
            box-shadow: 0 0 0 3px rgba(100,160,255,0.11);
        }
        .nav-profile-field-input.vkb-active {
            border-color: rgba(100,160,255,0.7);
            box-shadow: 0 0 0 4px rgba(100,160,255,0.14);
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
                <div class="nav-sidebar" id="navSidebar">
                    <button class="nav-back-item" id="navBackItem">
                        <span style="font-size:0.85em;opacity:0.6">↑</span>
                        <span>${_t('navBack', 'Início')}</span>
                    </button>
                    <div class="nav-sidebar-divider"></div>
                    <div id="navCatList"></div>
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
                <span class="nav-cat-icon">${cat.icon}</span>
                <span class="nav-cat-label">${cat.label}</span>
                <span class="nav-cat-count" id="navCount_${cat.id}"></span>
            </button>`).join('');

        list.querySelectorAll('.nav-cat-item').forEach(btn => {
            btn.addEventListener('click', () => {
                _catIdx = parseInt(btn.dataset.idx);
                _selectCat(_catIdx);
                _setSidebarFocus(true);
            });
        });
    }

    // ── Blob background ───────────────────────────────────────────────────────
    function _startBlobBg() {
        const canvas = document.getElementById('navMenuBg');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        const blobs = [
            { px: 0.0, py: 0.3, sx: 0.00018, sy: 0.00013, r: 0.62, color: [45, 65, 185] },
            { px: 1.2, py: 2.1, sx: 0.00014, sy: 0.00019, r: 0.56, color: [28, 85, 210] },
            { px: 2.5, py: 0.8, sx: 0.00022, sy: 0.00011, r: 0.52, color: [70, 50, 165] },
            { px: 0.7, py: 3.4, sx: 0.00016, sy: 0.00024, r: 0.50, color: [22, 110, 175] },
        ];

        let t = 0;
        function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
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

    // ── Seleção de categoria ──────────────────────────────────────────────────
    function _selectCat(idx) {
        _catIdx = idx;

        document.querySelectorAll('.nav-cat-item').forEach((el, i) => {
            el.classList.toggle('active', i === idx);
        });
        _updateSidebarFocusVisual();

        const cat = CATS[idx];
        const titleEl = document.getElementById('navContentTitle');
        const subEl = document.getElementById('navContentSub');
        if (titleEl) titleEl.textContent = cat.label;
        if (subEl) subEl.textContent = _subtitle(cat.id);

        _contentIdx = 0;
        _renderContent(cat.id);
    }

    function _subtitle(id) {
        const map = {
            games: _t('navGamesSub', 'Toda a sua biblioteca de jogos'),
            media: _t('navMediaSub', 'Aplicativos e serviços de streaming'),
            settings: _t('navSettingsSub', 'Configurações do sistema e do Doorpi OS'),
            profile: _t('navProfileSub', 'Sua conta e preferências'),
        };
        return map[id] || '';
    }

    // ── Renderização Genérica de Grid (Trata as classes C#) ───────────────────
    function _renderGrid(body, items, catId, emptyText, emptyIcon) {
        const countEl = document.getElementById(`navCount_${catId}`);
        if (countEl) countEl.textContent = items.length || '';

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

            // ▼ CORREÇÃO: Apenas imagens Grid verticais (nunca Hero/banners)
            const animSrc = item.GridImage || '';
            const staticSrc = item.GridStaticImage || animSrc;

            const card = document.createElement('div');
            card.className = 'nav-vertical-card';
            card.tabIndex = -1;
            card.dataset.idx = i;

            card.innerHTML = staticSrc
                ? `<img src="${staticSrc}" alt="${name}" loading="lazy" />`
                : `<div class="nav-vertical-card-no-img">${emptyIcon}</div>`;
            card.innerHTML += `<div class="nav-vertical-card-title">${name}</div>`;

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
                _sidebarFocus = false;
                _contentIdx = i;
                _updateContentFocus();
            });

            grid.appendChild(card);
        });

        _contentItems = items;
    }

    // ── Launch adaptado para as chamadas do C# ────────────────────────────────
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

        body.style.animation = 'none';
        body.offsetHeight;
        body.style.animation = '';
        _contentItems = [];

        switch (id) {
            case 'games':
                _renderGrid(body, _menuData.games, id, _t('navNoGames', 'Nenhum jogo na biblioteca'), '⊞');
                break;
            case 'media':
                _renderGrid(body, _menuData.media, id, _t('navNoMedia', 'Nenhum app configurado'), '▶');
                break;
            case 'settings':
                body.innerHTML = `<div class="nav-placeholder">
                    <div class="nav-placeholder-icon">⚙</div>
                    <div class="nav-placeholder-text">${_t('navSettingsSoon', 'Em breve')}</div>
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
            <div class="nav-profile-wrap">
                <div class="nav-profile-hero">
                    <button class="nav-profile-photo" id="navProfilePhoto" tabindex="-1">
                        ${photo ? `<img src="data:image/png;base64,${photo}" />` : '◉'}
                    </button>
                    <div>
                        <div class="nav-profile-name-text">${name}</div>
                        <div class="nav-profile-hello">${_t('navProfileHello', 'Bem-vindo de volta')}</div>
                    </div>
                </div>
                <div class="nav-profile-fields">
                    <div class="nav-profile-field">
                        <span class="nav-profile-field-label">${_t('navProfileNameLabel', 'Nome')}</span>
                        <input class="nav-profile-field-input" id="navProfName" readonly value="${name}" />
                    </div>
                    <div class="nav-profile-field">
                        <span class="nav-profile-field-label">${_t('navProfileApiLabel', 'API Key SteamGridDB')}</span>
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
    function _setSidebarFocus(val) {
        _sidebarFocus = val;
        _updateSidebarFocusVisual();
        _updateContentFocus();
    }

    function _updateSidebarFocusVisual() {
        document.querySelectorAll('.nav-cat-item').forEach((el, i) => {
            el.classList.toggle('nav-focused', _sidebarFocus && i === _catIdx);
        });
    }

    function _updateContentFocus() {
        document.querySelectorAll('.nav-vertical-card').forEach((el, i) => {
            const isFocused = !_sidebarFocus && i === _contentIdx;
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
                el.classList.toggle('nav-focused-el', !_sidebarFocus && i === _contentIdx);
            });
        }

        if (_sidebarFocus) return;

        const focused = document.querySelector('.nav-vertical-card.nav-focused, .nav-focused-el');
        focused?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
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
        _sidebarFocus = true;
        _contentIdx = 0;

        _buildOverlay();
        _overlay.style.display = 'flex';

        await _loadJSONs();

        requestAnimationFrame(() => {
            _overlay.classList.add('visible'); 
            _startBlobBg();
            _selectCat(_catIdx);
            _updateSidebarFocusVisual();
            document.querySelectorAll('.nav-cat-item')[_catIdx]?.focus();
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
    window._navMenuHandleKey = function (key) {
        if (_sidebarFocus) {
            _navSidebar(key);
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

    function _navSidebar(key) {
        switch (key) {
            case 'ArrowUp':
                if (_catIdx === 0) { close(); }
                else { _catIdx--; _selectCat(_catIdx); _updateSidebarFocusVisual(); }
                break;
            case 'ArrowDown':
                if (_catIdx < CATS.length - 1) { _catIdx++; _selectCat(_catIdx); _updateSidebarFocusVisual(); }
                break;
            case 'ArrowRight':
            case 'Enter':
                if (_contentItems.length > 0) {
                    _setSidebarFocus(false);
                    _contentIdx = 0;
                    _updateContentFocus();
                }
                break;
            case 'Escape':
            case 'Backspace':
                close();
                break;
        }
    }

    function _navContent(key) {
        const cols = _gridCols();
        const cards = document.querySelectorAll('.nav-vertical-card');
        const total = cards.length || _contentItems.length;

        switch (key) {
            case 'ArrowLeft':
                if (_contentIdx % cols === 0) {
                    _setSidebarFocus(true);
                } else {
                    _contentIdx = Math.max(0, _contentIdx - 1);
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
                    _setSidebarFocus(true);
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
                _setSidebarFocus(true);
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