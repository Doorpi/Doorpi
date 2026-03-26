// =============================================================================
// nav-menu.js — Menu de navegação (Estilo PS5 / Premium / Horizontal)
// Acionado: ArrowDown no carrossel principal
// Fechado:  ArrowUp no menu do topo
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

    function _t(key, fallback) {
        try { return (typeof t === 'function' ? t(key) : null) || fallback; }
        catch { return fallback; }
    }

    const CATS = [
        { id: 'games', icon: '⊞', get label() { return _t('navGames', 'Jogos'); } },
        { id: 'media', icon: '▶', get label() { return _t('navMedia', 'Multimídia'); } },
        { id: 'settings', icon: '⚙', get label() { return _t('navSettings', 'Configurações'); } },
        { id: 'profile', icon: '◉', get label() { return _t('navProfile', 'Perfil'); } },
    ];

    let _catIdx = 0;
    let _topbarFocus = true;
    let _contentIdx = 0;
    let _contentItems = [];
    let _overlay = null;
    let _bgRaf = null;
    let _lastFocus = null;

    // ── Estilos Responsivos (Ultrawide/4K/720p ready) ─────────────────────────
    (function injectStyles() {
        if (document.getElementById('nav-menu-styles')) return;
        const s = document.createElement('style');
        s.id = 'nav-menu-styles';
        s.textContent = `
        /* ── Overlay Transição ── */
        #navMenuOverlay {
            position: fixed; inset: 0; z-index: 8000;
            display: none; opacity: 0;
            transition: opacity 0.4s cubic-bezier(0.25, 1, 0.5, 1);
            font-family: 'Inter', 'Segoe UI', sans-serif;
            background: #0a0a20; /* Fundo idêntico ao setup */
        }
        #navMenuOverlay.visible { opacity: 1; }

        #navMenuBg {
            position: absolute; inset: 0; width: 100%; height: 100%;
            z-index: 0; pointer-events: none;
        }

        .nav-layout {
            position: relative; z-index: 1; display: flex; flex-direction: column;
            width: 100%; height: 100%;
            transform: scale(1.03);
            transition: transform 0.4s cubic-bezier(0.2, 0.9, 0.3, 1);
            /* Removido gradiente escuro e desfoque para o Blob brilhar igual ao setup.js */
            background: transparent;
        }
        #navMenuOverlay.visible .nav-layout { transform: scale(1); }

        /* ── Topbar Horizontal (Menu PS5) ── */
        .nav-topbar {
            display: flex; align-items: center;
            padding: clamp(12px, 3vh, 40px) clamp(24px, 4vw, 80px) 0;
            gap: clamp(16px, 3vw, 40px);
            flex-shrink: 0;
        }

        .nav-back-item {
            display: flex; align-items: center; gap: clamp(6px, 0.8vw, 12px);
            color: rgba(255,255,255,0.4);
            font-size: clamp(0.7rem, 1.1vmin, 1.1rem);
            font-weight: 500; cursor: pointer;
            background: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.1);
            padding: clamp(6px, 1vmin, 12px) clamp(12px, 2vmin, 24px);
            border-radius: clamp(12px, 2vmin, 30px);
            transition: all 0.2s ease; outline: none;
            margin-right: auto;
        }
        .nav-back-item:hover { color: #fff; background: rgba(255,255,255,0.1); }

        .nav-cat-list {
            display: flex; gap: clamp(16px, 3vmin, 40px);
            margin: 0 auto;
            position: absolute; left: 50%; transform: translateX(-50%);
        }

        .nav-cat-item {
            display: flex; align-items: center; gap: clamp(8px, 1vmin, 14px);
            padding: clamp(8px, 1vmin, 16px) 0;
            cursor: pointer; outline: none; border: none; background: none;
            font-family: inherit; color: rgba(255,255,255,0.35);
            position: relative; transition: color 0.2s ease;
        }

        .nav-cat-item::after {
            content: ''; position: absolute; bottom: 0; left: 0; right: 0;
            height: clamp(2px, 0.3vmin, 4px);
            background: #fff; transform: scaleX(0); transform-origin: center;
            transition: transform 0.2s cubic-bezier(0.25, 1, 0.5, 1);
            box-shadow: 0 0 clamp(6px, 1vmin, 12px) rgba(255,255,255,0.5);
        }

        .nav-cat-item.active { color: #fff; }
        .nav-cat-item.active::after { transform: scaleX(1); }
        .nav-cat-item.nav-focused { color: #fff; }
        .nav-cat-item.nav-focused::after { transform: scaleX(1); height: clamp(3px, 0.4vmin, 5px); }

        .nav-cat-icon { font-size: clamp(0.9rem, 1.5vmin, 1.6rem); }
        .nav-cat-label { font-size: clamp(0.85rem, 1.3vmin, 1.4rem); font-weight: 500; letter-spacing: 0.02em; }

        /* ── Área de Conteúdo ── */
        .nav-content {
            flex: 1; display: flex; flex-direction: column;
            padding: clamp(16px, 3vmin, 40px) clamp(24px, 4vw, 80px);
            overflow: hidden; min-width: 0;
        }

        .nav-content-header {
            margin-bottom: clamp(12px, 2vmin, 24px);
            flex-shrink: 0; text-align: left;
            animation: fadeInTop 0.4s cubic-bezier(0.2, 0.9, 0.3, 1) forwards;
        }
        .nav-content-title {
            font-size: clamp(1.6rem, 3vmin, 4rem);
            font-weight: 300; color: #fff;
            margin: 0 0 clamp(4px, 0.8vmin, 8px);
            letter-spacing: -0.01em;
            text-shadow: 0 4px 12px rgba(0,0,0,0.5);
        }
        .nav-content-subtitle {
            font-size: clamp(0.8rem, 1.2vmin, 1.2rem);
            color: rgba(255,255,255,0.4); margin: 0; font-weight: 400;
        }

        .nav-content-body {
            flex: 1; overflow-y: auto; overflow-x: hidden; scrollbar-width: none;
            /* Padding EXTREMO para impedir o corte da sombra e do scale(1.08) */
            padding: 25px;
            /* Margin negativa anula o padding visualmente, mantendo os alinhamentos originais */
            margin: -10px;
        }
        .nav-content-body::-webkit-scrollbar { display: none; }

        @keyframes fadeInTop { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: none; } }

        /* ── Grid Premium Escalável ── */
        .nav-big-grid {
            display: grid;
            /* Modificado para que em 720p os cards fiquem consideravelmente menores (começam em ~90px) */
            grid-template-columns: repeat(auto-fill, minmax(clamp(90px, 10vw, 200px), 1fr));
            gap: clamp(4px, 0.8vw, 24px);
            /* Espaço extra ao final para a rolagem não cortar a sombra da última linha */
            padding-bottom: 80px; 
        }

        .nav-vertical-card {
            aspect-ratio: 2/3;
            border-radius: clamp(6px, 1vmin, 12px);
            overflow: hidden; background: rgba(255,255,255,0.03);
            border: clamp(2px, 0.3vmin, 4px) solid transparent;
            cursor: pointer; outline: none; position: relative;
            display: flex; flex-direction: column;
            transition: transform 0.2s cubic-bezier(0.25, 1, 0.5, 1), box-shadow 0.2s ease, border-color 0.2s ease;
        }
        
        .nav-vertical-card img {
            position: absolute; inset: 0; width: 100%; height: 100%;
            object-fit: cover; display: block;
        }

        .nav-vertical-card-no-img {
            flex: 1; display: flex; align-items: center; justify-content: center;
            color: rgba(255,255,255,0.1); font-size: clamp(2.5rem, 5vmin, 7rem); z-index: 1;
        }

        .nav-card-gradient {
            position: absolute; bottom: 0; left: 0; right: 0; height: 60%;
            background: linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.5) 40%, transparent 100%);
            z-index: 2; opacity: 0; transition: opacity 0.2s ease;
        }

        .nav-vertical-card-title {
            position: absolute; bottom: 0; left: 0; right: 0;
            font-size: clamp(0.7rem, 1vmin, 1.1rem); color: #fff;
            padding: clamp(8px, 1.5vmin, 16px);
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
            z-index: 3; font-weight: 500; opacity: 0; transform: translateY(10px);
            transition: opacity 0.2s ease, transform 0.2s ease;
            text-shadow: 0 2px 4px rgba(0,0,0,0.8);
        }

        .nav-vertical-card.nav-focused {
            transform: scale(1.08);
            box-shadow: 0 clamp(8px, 1.5vmin, 25px) clamp(20px, 4vmin, 50px) rgba(0,0,0,0.8);
            border-color: #fff; z-index: 10;
        }
        .nav-vertical-card.nav-focused .nav-card-gradient { opacity: 1; }
        .nav-vertical-card.nav-focused .nav-vertical-card-title { opacity: 1; transform: translateY(0); }

        /* ── Placeholder Vazio ── */
        .nav-placeholder {
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            height: 100%; min-height: clamp(150px, 25vmin, 400px); gap: clamp(12px, 2vmin, 30px);
            color: rgba(255,255,255,0.2); animation: fadeInTop 0.4s ease;
        }
        .nav-placeholder-icon { font-size: clamp(2.5rem, 5vmin, 8rem); opacity: 0.5; }
        .nav-placeholder-text { font-size: clamp(0.9rem, 1.3vmin, 1.8rem); font-weight: 400; letter-spacing: 0.02em; }

        /* ── Perfil Dashboard ── */
        .nav-profile-dashboard {
            display: flex; align-items: flex-start;
            gap: clamp(20px, 3vmin, 80px); animation: fadeInTop 0.3s ease;
            width: min(100%, 1400px);
        }
        
        .nav-profile-avatar-sec { display: flex; flex-direction: column; align-items: center; gap: clamp(10px, 1.5vmin, 20px); }

        .nav-profile-photo {
            width: clamp(80px, 12vmin, 220px); height: clamp(80px, 12vmin, 220px);
            border-radius: 50%; background: rgba(255,255,255,0.05);
            border: clamp(2px, 0.4vmin, 4px) solid rgba(255,255,255,0.1); overflow: hidden;
            display: flex; align-items: center; justify-content: center;
            font-size: clamp(2.5rem, 4vmin, 6rem); color: rgba(255,255,255,0.3);
            cursor: pointer; outline: none; transition: border-color 0.2s, box-shadow 0.2s, transform 0.2s;
            box-shadow: 0 clamp(6px, 1vmin, 20px) clamp(15px, 2.5vmin, 40px) rgba(0,0,0,0.5);
        }
        .nav-profile-photo img { width: 100%; height: 100%; object-fit: cover; }
        .nav-profile-photo:focus, .nav-profile-photo.nav-focused-el {
            border-color: #fff;
            box-shadow: 0 0 clamp(8px, 1.5vmin, 25px) rgba(255,255,255,0.2), 0 clamp(8px, 1.5vmin, 20px) clamp(25px, 4vmin, 60px) rgba(0,0,0,0.8);
            transform: scale(1.05);
        }

        .nav-profile-fields {
            flex: 1; display: flex; flex-direction: column; gap: clamp(12px, 2vmin, 32px);
            background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05);
            padding: clamp(16px, 2.5vmin, 50px); border-radius: clamp(10px, 1.5vmin, 24px);
            box-shadow: 0 clamp(6px, 1vmin, 20px) clamp(15px, 2.5vmin, 40px) rgba(0,0,0,0.3);
        }

        .nav-profile-field { display: flex; flex-direction: column; gap: clamp(4px, 0.8vmin, 12px); }
        .nav-profile-field-label { font-size: clamp(0.7rem, 0.9vmin, 1rem); color: rgba(255,255,255,0.4); font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; }
        .nav-profile-field-input {
            background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1);
            border-radius: clamp(6px, 1vmin, 12px);
            padding: clamp(10px, 1.5vmin, 24px) clamp(12px, 1.8vmin, 28px);
            color: #fff; font-size: clamp(0.9rem, 1.2vmin, 1.4rem); font-family: inherit;
            outline: none; width: 100%; box-sizing: border-box; cursor: pointer;
            transition: border-color 0.2s, box-shadow 0.2s, transform 0.2s;
        }
        .nav-profile-field-input:focus, .nav-profile-field-input.nav-focused-el {
            border-color: #fff; background: rgba(255,255,255,0.05);
            box-shadow: 0 0 clamp(8px, 1.2vmin, 20px) rgba(255,255,255,0.1); transform: scale(1.02);
        }
        .nav-profile-field-input.vkb-active {
            border-color: rgba(100,160,255,0.8); box-shadow: 0 0 0 clamp(2px, 0.4vmin, 4px) rgba(100,160,255,0.3);
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
                        <span>${_t('navBack', 'Voltar ao Início')}</span>
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
                <span class="nav-cat-icon">${cat.icon}</span>
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

    // ── Fundo Animado (Extraído exatamente de setup.js) ───────────────────────
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
        _updateTopbarFocusVisual();

        const cat = CATS[idx];
        const titleEl = document.getElementById('navContentTitle');
        const subEl = document.getElementById('navContentSub');

        const header = document.querySelector('.nav-content-header');
        if (header) {
            header.style.animation = 'none';
            header.offsetHeight;
            header.style.animation = '';
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
                    <span style="color:rgba(255,255,255,0.4); font-size: clamp(0.7rem, 1vmin, 1rem);">Alterar Avatar</span>
                </div>
                
                <div class="nav-profile-fields">
                    <div class="nav-profile-field">
                        <span class="nav-profile-field-label">${_t('navProfileNameLabel', 'Nome de Usuário')}</span>
                        <input class="nav-profile-field-input" id="navProfName" readonly value="${name}" />
                    </div>
                    <div class="nav-profile-field" style="margin-top: clamp(4px, 1vmin, 10px);">
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
        // Rolagem fluida com bloco no centro, mantendo margens seguras pro grid
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
    window._navMenuHandleKey = function (key) {
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
                if (_contentIdx > 0 && CATS[_catIdx]?.id !== 'profile') {
                    _contentIdx--;
                    _updateContentFocus();
                } else if (CATS[_catIdx]?.id === 'profile') {
                    _setTopbarFocus(true);
                }
                break;
            case 'ArrowRight':
                if (_contentIdx < total - 1 && CATS[_catIdx]?.id !== 'profile') {
                    _contentIdx++;
                    _updateContentFocus();
                }
                break;
            case 'ArrowUp':
                if (_contentIdx < cols) {
                    _setTopbarFocus(true);
                } else {
                    _contentIdx = Math.max(0, _contentIdx - cols);
                    _updateContentFocus();
                }
                break;
            case 'ArrowDown':
                if (_contentIdx + cols < total) {
                    _contentIdx += cols;
                    _updateContentFocus();
                } else if (CATS[_catIdx]?.id === 'profile' && _contentIdx < total - 1) {
                    _contentIdx++;
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