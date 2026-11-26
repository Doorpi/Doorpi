(() => {
    'use strict';

    const state = {
        items: [], rootDirectory: '', selectedGameId: '', imageId: '',
        host: null, surface: 'quick', loading: false, loaded: false,
        view: 'games', pendingFocus: '', contextItemId: '', focusedPhotoId: '', migrating: false, progressReturnFocus: null,
        imageCache: new Map(), requestedImageIds: new Set(), viewerDisplayedId: '', shareSelection: null
    };
    const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
    const pt = () => /^pt/i.test(String(window.currentLang || document.documentElement.lang || navigator.language || ''));
    const tx = (ptText, enText) => pt() ? ptText : enText;
    const send = payload => {
        if (typeof window.postToHost === 'function') { window.postToHost(payload); return; }
        window.chrome?.webview?.postMessage(JSON.stringify(payload));
    };
    function requestGallery() {
        if (state.loading || state.loaded) return;
        state.loading = true;
        send({ action:'requestScreenshotGallery' });
    }
    function galleryVisible() {
        return !!state.host?.isConnected && state.host.getClientRects().length > 0;
    }
    const dateText = value => {
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? '' : date.toLocaleString(undefined, { dateStyle:'medium', timeStyle:'short' });
    };
    const shortDateText = value => {
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString(undefined, { day:'2-digit', month:'short', year:'numeric' });
    };
    function gameGroups() {
        const groups = new Map();
        for (const item of state.items) {
            const id = String(item.gameId || item.gameName || 'unknown');
            let group = groups.get(id);
            if (!group) {
                group = { id, name:item.gameName || tx('Jogo','Game'), count:0, latest:item };
                groups.set(id, group);
            }
            group.count++;
            if (new Date(item.capturedAtUtc) > new Date(group.latest.capturedAtUtc)) group.latest = item;
        }
        return Array.from(groups.values()).sort((a,b) =>
            new Date(b.latest.capturedAtUtc) - new Date(a.latest.capturedAtUtc));
    }
    function selectedGame() {
        return gameGroups().find(game => game.id === state.selectedGameId) || null;
    }
    function gameItems() {
        return state.items.filter(item => String(item.gameId || item.gameName || 'unknown') === state.selectedGameId)
            .sort((a,b) => new Date(b.capturedAtUtc) - new Date(a.capturedAtUtc));
    }
    function ensureStyles() {
        if (document.getElementById('doorpiScreenshotGalleryStyles')) return;
        const style = document.createElement('style');
        style.id = 'doorpiScreenshotGalleryStyles';
        style.textContent = `
            .shot-gallery{height:100%;min-height:0;overflow:auto;padding:clamp(16px,2.1vw,32px);color:var(--doorpi-shell-ink);background:transparent;font-family:inherit;overscroll-behavior:contain;scrollbar-width:none}
            .shot-gallery::-webkit-scrollbar{display:none}
            .shot-gallery-head{display:flex;align-items:center;justify-content:space-between;gap:16px;margin:0 0 20px}.shot-gallery-heading{min-width:0}.shot-gallery-kicker{color:#9ba8bb;font-size:.64rem;letter-spacing:.17em;text-transform:uppercase}.shot-gallery h1{margin:4px 0 0;font-size:clamp(1.45rem,2vw,2.1rem);font-weight:470;letter-spacing:-.04em;line-height:1.1}.shot-gallery-sub{margin:6px 0 0;color:#919baa;font-size:.78rem}
            .shot-gallery button{font:inherit;color:inherit;cursor:pointer}.shot-gallery button:focus-visible,.shot-viewer button:focus-visible{outline:2px solid #eff5ff;outline-offset:2px;z-index:2}
            .shot-library-action,.shot-back-games{display:inline-flex;align-items:center;gap:9px;min-height:38px;padding:8px 12px;border:1px solid #ffffff24;border-radius:6px;background:#ffffff08;color:#d9e0e9!important;font-size:.75rem}.shot-library-action:hover,.shot-back-games:hover{background:#ffffff13}
            .shot-library-action svg,.shot-back-games svg{width:16px;height:16px;flex:none}
            .shot-game-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(390px,100%),1fr));gap:16px}
            .shot-game-card{position:relative;display:block;overflow:hidden;width:100%;aspect-ratio:16/9;padding:0;border:1px solid #ffffff14;border-radius:7px;background:#141923;text-align:left;isolation:isolate;transition:border-color .18s,transform .18s,box-shadow .18s}
            .shot-game-card img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transition:transform .35s,filter .25s}.shot-game-card::after{position:absolute;inset:48% 0 0;z-index:1;background:linear-gradient(180deg,transparent,#07090de8 92%);content:''}
            .shot-game-card:hover,.shot-game-card:focus-visible{transform:translateY(-2px);border-color:#e8efff76;box-shadow:0 16px 42px #0008}.shot-game-card:hover img,.shot-game-card:focus-visible img{transform:scale(1.035);filter:saturate(1.06)}
            .shot-game-copy{position:absolute;right:17px;bottom:15px;left:17px;z-index:2;display:flex;align-items:flex-end;justify-content:space-between;gap:12px}.shot-game-copy strong{font-size:clamp(.96rem,1.35vw,1.28rem);font-weight:570;text-shadow:0 2px 16px #000}.shot-game-copy small{flex:none;color:#e0e5ecbd;font-size:.7rem;text-shadow:0 1px 8px #000}
            .shot-empty{display:grid;place-items:center;min-height:42vh;padding:30px;color:#9ba6b4;text-align:center}.shot-empty strong{display:block;margin-bottom:8px;color:#edf1f7;font-size:1.12rem;font-weight:500}.shot-empty p{max-width:440px;line-height:1.55;font-size:.82rem}
            .shot-storage-setting{display:flex;align-items:center;gap:14px;margin:0 0 18px;padding:12px 14px;border:1px solid #ffffff13;border-radius:6px;background:linear-gradient(100deg,#ffffff09,#ffffff03)}.shot-storage-label{flex:none;color:#98a5b8;font-size:.62rem;letter-spacing:.12em;text-transform:uppercase}.shot-storage-path{overflow:hidden;margin-top:4px;color:#e6eaf1;font-size:.74rem;text-overflow:ellipsis;white-space:nowrap}.shot-storage-copy{min-width:0;flex:1}.shot-storage-setting .shot-library-action{flex:none}
            .shot-photo-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.shot-photo-card{position:relative;display:block;overflow:hidden;width:100%;aspect-ratio:16/9;padding:0;border:1px solid #ffffff12;background:#10141b;text-align:left}.shot-photo-card img{display:block;width:100%;height:100%;object-fit:cover;transition:transform .32s,filter .22s}.shot-photo-card::after{position:absolute;inset:40% 0 0;background:linear-gradient(180deg,transparent,#05070be0);opacity:0;transition:opacity .18s;content:''}.shot-photo-card:hover img,.shot-photo-card:focus-visible img{transform:scale(1.01)}.shot-photo-card:hover::after,.shot-photo-card:focus-visible::after{opacity:1}
            .shot-photo-meta{position:absolute;right:14px;bottom:12px;left:14px;z-index:1;display:flex;align-items:center;justify-content:space-between;gap:12px;color:#f3f5f9;font-size:.72rem;text-shadow:0 1px 8px #000;opacity:0;transform:translateY(4px);transition:opacity .18s,transform .18s}.shot-photo-card:hover .shot-photo-meta,.shot-photo-card:focus-visible .shot-photo-meta{opacity:1;transform:translateY(0)}.shot-photo-meta span:last-child{color:#e1e5edc9}
            .shot-select-bar{position:sticky;top:0;z-index:5;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:16px 24px;margin:0 0 16px;padding:20px 22px;background:linear-gradient(110deg,rgba(30,39,53,.97),rgba(17,22,31,.97));border:1px solid rgba(255,255,255,.09);border-radius:8px;box-shadow:0 12px 30px #0005;backdrop-filter:blur(18px)}
            .shot-select-copy{min-width:0}.shot-select-kicker{display:block;margin-bottom:7px;color:#aab8cb;font-size:.65rem;font-weight:650;letter-spacing:.14em;text-transform:uppercase}.shot-select-title{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap}.shot-select-title strong{font-size:clamp(1.05rem,1.25vw,1.4rem);font-weight:540;letter-spacing:-.025em}.shot-select-count{color:#b7c2d1;font-size:.8rem;font-variant-numeric:tabular-nums}.shot-select-hints{display:flex;align-items:center;gap:18px;flex-wrap:wrap;margin-top:14px;color:#c2cad6;font-size:.72rem}.shot-select-hint{display:inline-flex;align-items:center;gap:7px}.shot-select-hint .gp-face-btn{width:22px;height:22px;font-size:10px}.shot-select-hint .gp-start svg{width:12px;height:12px}
            .shot-gallery .shot-select-continue{display:inline-flex;align-items:center;justify-content:center;gap:11px;min-height:48px;padding:0 19px;border:1px solid rgba(255,255,255,.16);border-radius:6px;background:rgba(255,255,255,.92);color:#111720;font-size:.78rem;font-weight:650;white-space:nowrap;transition:background .15s,transform .15s,box-shadow .15s}.shot-gallery .shot-select-continue:hover,.shot-gallery .shot-select-continue:focus-visible{background:#fff;box-shadow:0 5px 20px #0006;transform:translateY(-1px)}.shot-gallery .shot-select-continue:disabled{opacity:.38;transform:none;box-shadow:none;cursor:default}.shot-select-continue svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.8}
            .shot-photo-card[data-selected-order]::before{content:attr(data-selected-order);position:absolute;z-index:3;top:12px;right:12px;display:grid;place-items:center;width:30px;height:30px;border:1px solid rgba(255,255,255,.8);border-radius:50%;background:rgba(18,23,32,.84);color:#fff;font-size:.75rem;font-weight:650;box-shadow:0 3px 14px #0008;backdrop-filter:blur(8px)}.shot-photo-card[data-selected-order]{border-color:rgba(245,249,255,.75)}.shot-photo-card[data-selected-order]::before{outline:1px solid #0004}
            @media(max-width:720px){.shot-select-bar{grid-template-columns:1fr;padding:16px}.shot-gallery .shot-select-continue{justify-self:start}.shot-select-hints{gap:12px}}
            .shot-viewer{position:fixed;inset:0;z-index:90000;overflow:hidden;background:#050609}.shot-viewer-stage{position:absolute;inset:0;display:grid;place-items:center;overflow:hidden;pointer-events:none}.shot-viewer-image{position:absolute;inset:0;display:block;width:100vw;height:100vh;min-height:0;object-fit:contain;image-rendering:auto;opacity:0;transform:translateX(3.5vw);transition:transform .24s cubic-bezier(.22,.72,.24,1),opacity .2s ease;will-change:transform,opacity}.shot-viewer-image.shot-viewer-enter-left{transform:translateX(-3.5vw)}.shot-viewer-image.shot-viewer-current{opacity:1;transform:translateX(0)}.shot-viewer-image.shot-viewer-leave-left{opacity:0;transform:translateX(-3.5vw)}.shot-viewer-image.shot-viewer-leave-right{opacity:0;transform:translateX(3.5vw)}.shot-viewer-loading{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#ffffff80;font-size:.72rem}.shot-viewer-nav{position:absolute;top:50%;z-index:2;display:grid;place-items:center;width:54px;height:72px;padding:0;border:1px solid #ffffff20;border-radius:5px;background:#07090dcc;color:#ffffffd9;opacity:.78;transform:translateY(-50%);transition:opacity .16s,background .16s}.shot-viewer-nav:hover,.shot-viewer-nav:focus-visible{background:#161a22eb;opacity:1}.shot-viewer-nav[hidden]{display:none}.shot-viewer-nav svg{width:26px;height:26px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.shot-viewer-prev{left:clamp(14px,2.4vw,38px)}.shot-viewer-next{right:clamp(14px,2.4vw,38px)}
            .shot-viewer-image,.shot-viewer-image.shot-viewer-enter-left,.shot-viewer-image.shot-viewer-current,.shot-viewer-image.shot-viewer-leave-left,.shot-viewer-image.shot-viewer-leave-right{opacity:1;transform:none;transition:none;animation:none;will-change:auto}
            .shot-viewer-nav{top:auto;bottom:14px;width:46px;height:50px;border:1px solid #ffffff2b;border-radius:5px;background:#05070bc4;box-shadow:0 2px 14px #0008;opacity:.68;transform:none;transition:opacity .16s,background .16s}.shot-viewer-nav:hover,.shot-viewer-nav:focus-visible{background:#05070bf2;opacity:1}.shot-viewer-nav svg{width:22px;height:22px}.shot-viewer-prev{left:12px}.shot-viewer-next{right:12px}
            .doorpi-quick-panel .dq-screenshot-shell{min-height:0;overflow:hidden}
            .dq-screenshot-shell .shot-gallery{padding:4px;scroll-padding:4px}
            .shot-gallery h1{font-size:clamp(1.6rem,2.3vw,2.5rem);font-weight:500}
            .shot-storage-setting{background:transparent;border:0;border-bottom:1px solid var(--doorpi-shell-edge);border-radius:0;padding:0 0 16px;margin-bottom:24px}
            .shot-storage-label,.shot-storage-path{color:var(--doorpi-shell-muted)}
            .shot-game-copy strong{font-size:clamp(1rem,1.45vw,1.5rem)}
            .shot-game-card:focus-visible{outline-color:var(--doorpi-shell-focus)}
            .shot-library-migration{position:fixed;inset:0;z-index:95000;display:grid;place-items:center;padding:24px;background:#05070bdc;backdrop-filter:blur(14px)}
            .shot-library-migration-card{width:min(520px,100%);padding:28px;border:1px solid #ffffff20;border-radius:10px;background:linear-gradient(145deg,#1b202b,#10131a);box-shadow:0 28px 90px #0009;color:#f4f6fa}
            .shot-library-migration-kicker{color:#aebbd0;font-size:.65rem;font-weight:650;letter-spacing:.15em;text-transform:uppercase}.shot-library-migration h2{margin:8px 0 8px;font-size:1.28rem;font-weight:500}.shot-library-migration-status{margin:0;color:#c0c8d5;font-size:.82rem}.shot-library-migration-count{display:block;margin-top:16px;color:#9ba8ba;font-size:.7rem;font-variant-numeric:tabular-nums}.shot-library-migration-track{height:5px;margin-top:9px;overflow:hidden;border-radius:99px;background:#ffffff18}.shot-library-migration-fill{width:0;height:100%;border-radius:inherit;background:linear-gradient(90deg,#a9c9ff,#f0f5ff);transition:width .12s linear}
            .nav-content:has(.shot-gallery){padding:0!important}.nav-content:has(.shot-gallery) .nav-content-header{display:none}.nav-content-body:has(>.shot-gallery){overflow:hidden;padding:0}
            @media(max-width:720px){.shot-gallery-head{align-items:flex-start}.shot-game-grid{grid-template-columns:1fr}.shot-photo-grid{grid-template-columns:1fr}.shot-storage-setting{align-items:flex-start;flex-wrap:wrap}.shot-storage-setting .shot-library-action{margin-left:auto}}
        `;
        document.head.appendChild(style);
    }
    function folderIcon() {
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 6.5h6l2 2H20a1 1 0 0 1 1 1v7.8a1.7 1.7 0 0 1-1.7 1.7H4.7A1.7 1.7 0 0 1 3 17.3V7a.5.5 0 0 1 .5-.5Z"/><path d="M3.5 9h17"/></svg>';
    }
    function backIcon() {
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m14.5 5-7 7 7 7"/><path d="M8 12h12"/></svg>';
    }
    function renderGames(settings) {
        const groups = gameGroups();
        return `
            <header class="shot-gallery-head"><div class="shot-gallery-heading"><h1>${tx('Capturas','Screenshots')}</h1></div>${settings ? `<button class="shot-library-action" data-shot-back-settings tabindex="0">${tx('Voltar às configurações','Back to settings')}</button>` : ''}</header>
            <div class="shot-storage-setting"><div class="shot-storage-copy"><div class="shot-storage-label">${tx('Local de salvamento','Save location')}</div><div class="shot-storage-path" title="${esc(state.rootDirectory)}">${esc(state.rootDirectory || tx('Pasta padrão de imagens','Default Pictures folder'))}</div></div><button class="shot-library-action" data-shot-folder tabindex="0">${tx('Alterar','Change')}</button></div>
            ${groups.length ? `<div class="shot-game-grid">${groups.map(game => `<button class="shot-game-card" data-shot-game="${esc(game.id)}" tabindex="0" aria-label="${esc(game.name)} · ${game.count} ${tx('capturas','screenshots')}"><img src="${esc(game.latest.thumbnail || '')}" alt=""><span class="shot-game-copy"><strong>${esc(game.name)}</strong><small>${game.count} ${tx(game.count === 1 ? 'captura' : 'capturas', game.count === 1 ? 'screenshot' : 'screenshots')}</small></span></button>`).join('')}</div>` : `<div class="shot-empty" tabindex="0"><div><strong>${tx('Sua galeria está vazia','Your gallery is empty')}</strong><p>${tx('Ative Capturar tela do jogo em Controles → Atalhos globais e escolha uma combinação no controle.','Enable Capture game screenshot in Controls → Global shortcuts and choose a controller combination.')}</p></div></div>`}
            `;
    }
    function renderPhotos() {
        const game = selectedGame();
        const items = gameItems();
        const menuBadge = '<span class="gp-face-btn gp-start" aria-hidden="true"><svg viewBox="0 0 16 16"><rect x="2" y="3.5" width="12" height="2" rx=".75" fill="currentColor"/><rect x="2" y="7.25" width="12" height="2" rx=".75" fill="currentColor"/><rect x="2" y="11" width="12" height="2" rx=".75" fill="currentColor"/></svg></span>';
        return `
            ${state.shareSelection ? `<section class="shot-select-bar" aria-label="${tx('Seleção para publicar no X','Selection for posting to X')}"><div class="shot-select-copy"><span class="shot-select-kicker">${tx('Compartilhar no X','Share on X')} · ${esc(game?.name || tx('Jogo','Game'))}</span><div class="shot-select-title"><strong>${tx('Escolha suas capturas','Choose your screenshots')}</strong><span class="shot-select-count"><span data-shot-count>${state.shareSelection.length}</span> / 4</span></div><div class="shot-select-hints"><span class="shot-select-hint"><span class="gp-face-btn gp-a" aria-hidden="true">A</span>${tx('Selecionar','Select')}</span><span class="shot-select-hint"><span class="gp-face-btn gp-b" aria-hidden="true">B</span>${tx('Cancelar','Cancel')}</span><span class="shot-select-hint">${menuBadge}${tx('Continuar','Continue')}</span></div></div><button class="shot-select-continue" type="button" data-shot-share-confirm ${state.shareSelection.length ? '' : 'disabled'}>${tx('Continuar para o X','Continue to X')}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6"/></svg></button></section>` : `<header class="shot-gallery-head"><button class="shot-back-games" data-shot-back-games tabindex="0">${backIcon()}<span>${tx('Jogos','Games')}</span></button><div class="shot-gallery-heading"><div class="shot-gallery-kicker">${items.length} ${tx('capturas','screenshots')}</div><h1>${esc(game?.name || tx('Jogo','Game'))}</h1></div></header>`}
            ${items.length ? `<div class="shot-photo-grid">${items.map(item => `<button class="shot-photo-card" data-shot-open="${esc(item.id)}" tabindex="0" aria-label="${esc(game?.name || '')} · ${dateText(item.capturedAtUtc)}"><img loading="lazy" src="${esc(item.thumbnail || '')}" alt=""><span class="shot-photo-meta"><span>${shortDateText(item.capturedAtUtc)} · ${new Date(item.capturedAtUtc).toLocaleTimeString(undefined, { hour:'2-digit', minute:'2-digit' })}</span><span>${item.width} × ${item.height}</span></span></button>`).join('')}</div>` : `<div class="shot-empty" tabindex="0"><strong>${tx('Nenhuma captura encontrada','No screenshots found')}</strong></div>`}`;
    }
    function focusHint(element) {
        if (!element) return '';
        if (element.dataset?.shotGame) return `[data-shot-game="${CSS.escape(element.dataset.shotGame)}"]`;
        if (element.dataset?.shotOpen) return `[data-shot-open="${CSS.escape(element.dataset.shotOpen)}"]`;
        if (element.matches?.('[data-shot-back-games]')) return '[data-shot-back-games]';
        if (element.matches?.('[data-shot-folder]')) return '[data-shot-folder]';
        if (element.matches?.('[data-shot-back-settings]')) return '[data-shot-back-settings]';
        if (element.matches?.('.shot-viewer')) return '.shot-viewer';
        return '';
    }
    function firstMatchingSelector(host, selectorList) {
        for (const selector of String(selectorList || '').split(',').map(value => value.trim()).filter(Boolean)) {
            const element = host?.querySelector(selector);
            if (element) return element;
        }
        return null;
    }
    function renderInto(host, surface = 'quick') {
        ensureStyles();
        const previousFocus = host?.contains(document.activeElement) ? focusHint(document.activeElement) : '';
        state.surface = surface;
        if (host) {
            host.innerHTML = `<section class="shot-gallery ${surface === 'settings' ? 'shot-gallery-settings' : ''}">${state.view === 'photos' ? renderPhotos() : renderGames(surface === 'settings')}</section>`;
            state.host = host;
            wire(host, surface);
            updateShareSelection();
            const preservedFocus = state.view === 'games' && !previousFocus.includes('data-shot-game') && !previousFocus.includes('data-shot-folder')
                ? '' : previousFocus;
            const hasGameFolders = gameGroups().length > 0;
            const defaultFocusSelector = state.view === 'photos'
                ? (gameItems().length ? '.shot-photo-card' : '.shot-empty')
                : hasGameFolders
                    ? '.shot-game-card'
                    : '.shot-empty';
            const focusSelector = state.pendingFocus || preservedFocus || defaultFocusSelector;
            state.pendingFocus = '';
            window.dispatchEvent(new CustomEvent('doorpi:screenshot-gallery-rendered', { detail:{ surface, view:state.view, viewerOpen:!!state.imageId, focusSelector } }));
            requestAnimationFrame(() => (firstMatchingSelector(host, focusSelector) || firstMatchingSelector(host, defaultFocusSelector))?.focus({ preventScroll:true }));
        } else {
            state.host = null;
        }
        requestGallery();
        if (state.imageId) renderViewer();
        return host ? '' : `<section class="dq-content dq-screenshot-shell"><section class="shot-gallery">${state.view === 'photos' ? renderPhotos() : renderGames(false)}</section></section>`;
    }
    function viewerNeighbors() {
        const items = gameItems();
        const index = items.findIndex(item => item.id === state.imageId);
        return {
            items, index,
            left:index > 0 ? items[index - 1] : null,
            right:index >= 0 ? items[index + 1] || null : null
        };
    }
    function requestViewerImage(id) {
        if (!id || state.imageCache.has(id) || state.requestedImageIds.has(id)) return;
        state.requestedImageIds.add(id);
        send({ action:'requestScreenshotImage', id });
    }
    function preloadViewerNeighbors() {
        if (!state.imageId || !viewerOpen()) return;
        const { left, right } = viewerNeighbors();
        requestViewerImage(state.imageId);
        requestViewerImage(left?.id);
        requestViewerImage(right?.id);
        pruneViewerImageCache();
    }
    function pruneViewerImageCache() {
        const keep = new Set([state.imageId, state.viewerDisplayedId].filter(Boolean));
        const { left, right } = viewerNeighbors();
        if (left) keep.add(left.id);
        if (right) keep.add(right.id);
        for (const [id, image] of state.imageCache) {
            if (keep.has(id) || image.isConnected) continue;
            image.removeAttribute('src');
            state.imageCache.delete(id);
        }
        for (const id of state.requestedImageIds) {
            if (!state.items.some(item => item.id === id)) state.requestedImageIds.delete(id);
        }
    }
    function showViewerImage(id) {
        const stage = document.querySelector('.shot-viewer-stage');
        const incoming = state.imageCache.get(id);
        if (!stage || !incoming) return false;
        incoming.className = 'shot-viewer-image shot-viewer-current';
        incoming.dataset.viewerImageId = id;
        incoming.alt = '';
        incoming.style.removeProperty('opacity');
        incoming.style.removeProperty('transform');
        stage.replaceChildren(incoming);
        state.viewerDisplayedId = id;
        stage.querySelector('.shot-viewer-loading')?.remove();
        return true;
    }
    function updateViewerArrows(viewer) {
        const { index, items } = viewerNeighbors();
        const previous = viewer.querySelector('.shot-viewer-prev');
        const next = viewer.querySelector('.shot-viewer-next');
        if (previous) previous.hidden = index <= 0;
        if (next) next.hidden = index < 0 || index >= items.length - 1;
        if (document.activeElement?.hidden) viewer.focus({ preventScroll:true });
    }
    function renderViewer() {
        const item = state.items.find(entry => entry.id === state.imageId);
        if (!item) return;
        let viewer = document.querySelector('.shot-viewer');
        if (!viewer) {
            viewer = document.createElement('div');
            viewer.className = 'shot-viewer';
            viewer.setAttribute('role','dialog');
            viewer.setAttribute('aria-modal','true');
            viewer.setAttribute('aria-label',tx('Visualizador de capturas','Screenshot viewer'));
            viewer.tabIndex = 0;
            viewer.innerHTML = `<div class="shot-viewer-stage"><div class="shot-viewer-loading">${tx('Carregando captura…','Loading screenshot…')}</div></div><button class="shot-viewer-nav shot-viewer-prev" type="button" aria-label="${tx('Captura anterior','Previous screenshot')}" title="${tx('Anterior','Previous')}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 5-7 7 7 7"/></svg></button><button class="shot-viewer-nav shot-viewer-next" type="button" aria-label="${tx('Próxima captura','Next screenshot')}" title="${tx('Próxima','Next')}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.5 5 7 7-7 7"/></svg></button>`;
            document.body.appendChild(viewer);
            window.dispatchEvent(new CustomEvent('doorpi:screenshot-gallery-rendered', { detail:{ surface:state.surface, view:state.view, viewerOpen:true, focusSelector:'.shot-viewer' } }));
            requestAnimationFrame(() => viewer?.focus({ preventScroll:true }));
            viewer.addEventListener('click', event => {
                if (event.target === viewer) closeViewer();
            });
            viewer.querySelector('.shot-viewer-prev')?.addEventListener('click', event => {
                event.preventDefault(); event.stopPropagation(); moveViewer('LEFT');
            });
            viewer.querySelector('.shot-viewer-next')?.addEventListener('click', event => {
                event.preventDefault(); event.stopPropagation(); moveViewer('RIGHT');
            });
        }
        viewer.dataset.screenshotId = state.viewerDisplayedId || item.id;
        updateViewerArrows(viewer);
        const image = state.imageCache.get(state.imageId);
        if (image) {
            showViewerImage(state.imageId);
            viewer.dataset.screenshotId = state.imageId;
        }
        preloadViewerNeighbors();
    }
    function closeViewer() {
        document.querySelectorAll('.shot-viewer').forEach(viewer => viewer.remove());
        state.imageId = '';
        state.viewerDisplayedId = '';
        window.dispatchEvent(new CustomEvent('doorpi:screenshot-gallery-rendered', { detail:{ surface:state.surface, view:state.view, viewerOpen:false, focusSelector:'.shot-photo-card' } }));
        state.pendingFocus = '.shot-photo-card';
        if (state.host?.isConnected) renderInto(state.host, state.surface);
    }
    function openContextMenu() {
        if (state.migrating) return true;
        if (state.shareSelection) return true;
        if (!galleryVisible() || document.querySelector('.context-menu.visible')) return false;
        const active = document.activeElement;
        const photoCard = active?.closest?.('[data-shot-open]');
        const viewer = state.imageId ? document.querySelector('.shot-viewer') : null;
        const anchor = viewer || photoCard;
        const id = state.viewerDisplayedId || state.imageId || photoCard?.dataset?.shotOpen || '';
        if (!id) return false;
        const item = state.items.find(entry => entry.id === id);
        if (!item || !anchor || typeof window._ctxMenuOpen !== 'function') return false;
        state.contextItemId = id;
        anchor.dataset.doorpiScreenshotContext = 'true';
        anchor.dataset.screenshotId = id;
        anchor.dataset.screenshotGameName = item.gameName || tx('Captura','Screenshot');
        anchor.dataset.screenshotCapturedAt = dateText(item.capturedAtUtc);
        const rect = anchor.getBoundingClientRect();
        window._ctxMenuOpen(anchor, rect.right + 2, rect.top);
        return true;
    }
    function contextMenuClosed() { state.contextItemId = ''; }
    function contextAction(action, id = '') {
        if (state.migrating) return true;
        const targetId = id || state.contextItemId;
        state.contextItemId = '';
        if (!targetId) return false;
        if (action === 'move') {
            send({ action:'moveScreenshot', id:targetId });
            return true;
        }
        if (action === 'share-x') {
            if (state.imageId) closeViewer();
            state.shareSelection = [targetId];
            state.pendingFocus = `[data-shot-open="${CSS.escape(targetId)}"]`;
            if (state.host?.isConnected) renderInto(state.host, state.surface);
            updateShareSelection();
            return true;
        }
        if (action === 'delete') {
            if (state.imageId === targetId) closeViewer();
            send({ action:'deleteScreenshot', id:targetId });
            return true;
        }
        return false;
    }
    function viewerOpen() { return !!state.imageId && !!document.querySelector('.shot-viewer'); }
    function moveViewer(direction) {
        if (!viewerOpen()) return false;
        if (direction !== 'LEFT' && direction !== 'RIGHT') return true;
        const items = gameItems();
        const currentIndex = items.findIndex(item => item.id === state.imageId);
        if (currentIndex < 0) return true;
        const step = direction === 'RIGHT' ? 1 : -1;
        const nextIndex = currentIndex + step;
        const next = items[nextIndex];
        if (!next) return true;
        state.imageId = next.id;
        renderViewer();
        return true;
    }
    function scrollableAncestors(element) {
        const containers = [];
        for (let node = element?.parentElement; node && node !== document.documentElement; node = node.parentElement) {
            const style = getComputedStyle(node);
            const canScrollY = /(auto|scroll|overlay)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 1;
            const canScrollX = /(auto|scroll|overlay)/.test(style.overflowX) && node.scrollWidth > node.clientWidth + 1;
            if (canScrollY || canScrollX) containers.push(node);
        }
        const page = document.scrollingElement;
        if (page && (page.scrollHeight > page.clientHeight + 1 || page.scrollWidth > page.clientWidth + 1)) containers.push(page);
        return containers;
    }
    function revealFocus(element) {
        if (!element?.isConnected) return false;
        const containers = scrollableAncestors(element);
        for (const container of containers) {
            const rect = element.getBoundingClientRect();
            const isPage = container === document.scrollingElement;
            const containerRect = isPage ? null : container.getBoundingClientRect();
            let top = isPage ? 0 : containerRect.top + container.clientTop;
            const left = isPage ? 0 : containerRect.left + container.clientLeft;
            const bottom = isPage ? window.innerHeight : top + container.clientHeight;
            const right = isPage ? window.innerWidth : left + container.clientWidth;
            const selectionBar = state.shareSelection && element.matches('.shot-photo-card') && container.classList.contains('shot-gallery')
                ? container.querySelector('.shot-select-bar') : null;
            if (selectionBar) top = Math.max(top, Math.min(bottom, selectionBar.getBoundingClientRect().bottom));
            const edgeY = Math.min(18, Math.max(4, (bottom - top) * 0.06));
            const edgeX = Math.min(18, Math.max(4, (right - left) * 0.06));
            if (rect.top < top + edgeY) container.scrollTop += rect.top - top - edgeY;
            else if (rect.bottom > bottom - edgeY) container.scrollTop += rect.bottom - bottom + edgeY;
            if (rect.left < left + edgeX) container.scrollLeft += rect.left - left - edgeX;
            else if (rect.right > right - edgeX) container.scrollLeft += rect.right - right + edgeX;
        }
        if (!containers.length) element.scrollIntoView?.({ block:'nearest', inline:'nearest' });
        return true;
    }
    function galleryItems() {
        return Array.from(state.host?.querySelectorAll('.shot-game-card, .shot-photo-card, .shot-empty, [data-shot-back-games], [data-shot-back-settings], [data-shot-folder]') || [])
            .filter(item => !item.disabled && item.getClientRects().length > 0);
    }
    function spatialGalleryTarget(current, direction, items) {
        const rect = current.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const vertical = direction === 'UP' || direction === 'DOWN';
        const sign = direction === 'UP' || direction === 'LEFT' ? -1 : 1;
        const candidates = [];
        for (const item of items) {
            if (item === current) continue;
            const r = item.getBoundingClientRect();
            const x = r.left + r.width / 2;
            const y = r.top + r.height / 2;
            const primary = vertical ? (y - cy) * sign : (x - cx) * sign;
            if (primary <= 3) continue;
            const overlap = vertical
                ? Math.min(rect.right, r.right) - Math.max(rect.left, r.left)
                : Math.min(rect.bottom, r.bottom) - Math.max(rect.top, r.top);
            const secondary = vertical ? Math.abs(x - cx) : Math.abs(y - cy);
            candidates.push({ item, primary, secondary, overlap });
        }
        if (!candidates.length) return null;
        const aligned = candidates.filter(candidate => candidate.overlap > 0);
        const pool = aligned.length ? aligned : candidates;
        pool.sort((a,b) => (a.primary + a.secondary * 2.4) - (b.primary + b.secondary * 2.4));
        return pool[0].item;
    }
    function moveGalleryFocus(direction) {
        if (state.migrating) return true;
        if (!galleryVisible() || viewerOpen()) return false;
        if (state.view === 'photos' && ['UP', 'DOWN', 'LEFT', 'RIGHT'].includes(direction)) {
            const cards = Array.from(state.host?.querySelectorAll('.shot-photo-card') || [])
                .filter(item => !item.disabled && item.getClientRects().length > 0);
            if (!cards.length) return true;
            const currentIndex = cards.indexOf(document.activeElement);
            if (currentIndex < 0) {
                if (state.shareSelection && document.activeElement?.matches('[data-shot-share-confirm]') && direction !== 'DOWN') return true;
                cards[0].focus({ preventScroll:true });
                revealFocus(cards[0]);
                return true;
            }
            const grid = cards[currentIndex].closest('.shot-photo-grid');
            const columns = Math.max(1, getComputedStyle(grid).gridTemplateColumns.split(' ').length);
            let nextIndex = currentIndex;
            if (direction === 'LEFT' && currentIndex % columns > 0) nextIndex--;
            else if (direction === 'LEFT') {
                const back = state.host?.querySelector('[data-shot-back-games]');
                if (back) { back.focus({ preventScroll:true }); revealFocus(back); }
                return true;
            }
            else if (direction === 'RIGHT' && currentIndex + 1 < cards.length && currentIndex % columns < columns - 1) nextIndex++;
            else if (direction === 'UP') {
                if (currentIndex < columns) {
                    const back = state.host?.querySelector(state.shareSelection ? '[data-shot-share-confirm]:not(:disabled)' : '[data-shot-back-games]');
                    if (back) { back.focus({ preventScroll:true }); revealFocus(back); }
                    return true;
                }
                nextIndex -= columns;
            } else if (direction === 'DOWN') {
                const nextRowStart = (Math.floor(currentIndex / columns) + 1) * columns;
                if (nextRowStart < cards.length) nextIndex = Math.min(currentIndex + columns, cards.length - 1);
            }
            if (nextIndex !== currentIndex) {
                cards[nextIndex].focus({ preventScroll:true });
                revealFocus(cards[nextIndex]);
                requestAnimationFrame(() => revealFocus(cards[nextIndex]));
            }
            return true;
        }
        const items = galleryItems();
        if (!items.length) return true;
        const current = items.includes(document.activeElement) ? document.activeElement : null;
        if (!current) {
            const entry = state.host.querySelector('.shot-game-card, .shot-empty');
            entry?.focus({ preventScroll:true });
            revealFocus(entry);
            return true;
        }
        let target;
        if (current.matches('.shot-game-card, .shot-empty')) {
            const cards = items.filter(item => item.matches('.shot-game-card'));
            target = spatialGalleryTarget(current, direction, cards);
            if (!target && direction === 'UP') target = state.host.querySelector('[data-shot-folder]');
        } else {
            target = spatialGalleryTarget(current, direction, items);
        }
        if (target) {
            target.focus({ preventScroll:true });
            revealFocus(target);
            requestAnimationFrame(() => revealFocus(target));
        }
        return true;
    }
    function back() {
        if (state.migrating) return true;
        if (state.contextItemId && document.querySelector('.context-menu.visible')) return false;
        if (!galleryVisible()) return false;
        if (state.shareSelection) { state.shareSelection = null; renderInto(state.host, state.surface); return true; }
        if (state.imageId) { closeViewer(); return true; }
        if (state.view === 'photos') {
            state.view = 'games';
            state.pendingFocus = `[data-shot-game="${CSS.escape(state.selectedGameId)}"]`;
            if (state.host?.isConnected) renderInto(state.host, state.surface);
            return true;
        }
        return false;
    }
    function wire(host, surface = state.surface) {
        if (!host || host._shotGalleryWired) return;
        host._shotGalleryWired = true;
        state.host = host;
        state.surface = surface;
        host.addEventListener('click', event => {
            const game = event.target.closest?.('[data-shot-game]');
            if (game) {
                state.selectedGameId = game.dataset.shotGame || '';
                state.view = 'photos';
                state.pendingFocus = '.shot-photo-card';
                renderInto(host, surface);
                return;
            }
            if (event.target.closest?.('[data-shot-back-games]')) {
                if (state.shareSelection) { back(); return; }
                state.view = 'games';
                state.pendingFocus = `[data-shot-game="${CSS.escape(state.selectedGameId)}"]`;
                renderInto(host, surface);
                return;
            }
            if (event.target.closest?.('[data-shot-folder]')) { send({ action:'chooseScreenshotFolder' }); return; }
            if (event.target.closest?.('[data-shot-back-settings]')) { window._navMenuOpenSettings?.(); return; }
            if (event.target.closest?.('[data-shot-share-confirm]')) { confirmShareSelection(); return; }
            const card = event.target.closest?.('[data-shot-open]');
            if (card) {
                if (state.shareSelection) {
                    const id = card.dataset.shotOpen || '';
                    const index = state.shareSelection.indexOf(id);
                    if (index >= 0) state.shareSelection.splice(index, 1);
                    else if (state.shareSelection.length < 4) state.shareSelection.push(id);
                    else window.showDoorpiToast?.(tx('Até 4 capturas por post','Up to 4 screenshots per post'), 'X');
                    updateShareSelection();
                    return;
                }
                state.imageId = card.dataset.shotOpen || '';
                state.viewerDisplayedId = '';
                renderViewer();
            }
        });
        host.addEventListener('focusin', event => {
            const focusedPhoto = event.target.closest?.('[data-shot-open]');
            if (focusedPhoto && host.contains(focusedPhoto)) state.focusedPhotoId = focusedPhoto.dataset.shotOpen || '';
            if (surface === 'quick') return;
            const target = event.target.closest?.('.shot-game-card, .shot-photo-card, [data-shot-back-games], [data-shot-folder]');
            if (!target || !host.contains(target)) return;
            requestAnimationFrame(() => revealFocus(target));
        });
    }
    function updateShareSelection() {
        if (!state.host || !state.shareSelection) return;
        state.host.querySelectorAll('[data-shot-open]').forEach(card => {
            const index = state.shareSelection.indexOf(card.dataset.shotOpen);
            if (index < 0) delete card.dataset.selectedOrder;
            else card.dataset.selectedOrder = String(index + 1);
            card.setAttribute('aria-pressed', index >= 0 ? 'true' : 'false');
        });
        const count = state.host.querySelector('[data-shot-count]');
        if (count) count.textContent = String(state.shareSelection.length);
        const button = state.host.querySelector('[data-shot-share-confirm]');
        if (button) button.disabled = state.shareSelection.length === 0;
    }
    function confirmShareSelection() {
        if (!galleryVisible() || !state.shareSelection) return false;
        if (!state.shareSelection.length) return true;
        send({ action:'shareScreenshotToX', ids:[...state.shareSelection] });
        state.shareSelection = null;
        renderInto(state.host, state.surface);
        return true;
    }
    function receive(event) {
        let data = event.data;
        if (typeof data === 'string') {
            try { data = JSON.parse(data); }
            catch { return; }
        }
        if (data?.type === 'screenshotGalleryState') {
            const hadGalleryItems = state.items.length > 0;
            const oldGameItems = state.view === 'photos' ? gameItems() : [];
            const oldFocusedIndex = oldGameItems.findIndex(item => item.id === state.focusedPhotoId);
            state.items = Array.isArray(data.items) ? data.items : [];
            state.rootDirectory = data.rootDirectory || '';
            state.loading = false;
            state.loaded = true;
            pruneViewerImageCache();
            if (state.view === 'photos' && !state.imageId && oldFocusedIndex >= 0) {
                const updatedGameItems = gameItems();
                const preserved = updatedGameItems.find(item => item.id === state.focusedPhotoId);
                const replacement = preserved || updatedGameItems[Math.min(oldFocusedIndex, updatedGameItems.length - 1)];
                state.focusedPhotoId = replacement?.id || '';
                state.pendingFocus = replacement ? `[data-shot-open="${CSS.escape(replacement.id)}"]` : '[data-shot-back-games]';
            }
            if (state.view === 'games' && !hadGalleryItems && state.items.length > 0)
                state.pendingFocus = '.shot-game-card';
            if (state.host?.isConnected) renderInto(state.host, state.surface);
            if (state.imageId && !state.items.some(item => item.id === state.imageId)) closeViewer();
        } else if (data?.type === 'screenshotImage') {
            state.requestedImageIds.delete(data.id);
            if (!data.data || !state.items.some(item => item.id === data.id)) {
                return;
            }
            const image = new Image();
            image.className = 'shot-viewer-image';
            image.dataset.viewerImageId = data.id;
            image.alt = '';
            image.src = data.data;
            const ready = () => {
                if (!image.naturalWidth) {
                    return;
                }
                state.imageCache.set(data.id, image);
                if (state.imageId === data.id) renderViewer();
                else pruneViewerImageCache();
            };
            if (typeof image.decode === 'function') image.decode().then(ready, () => { if (image.complete) ready(); });
            else { image.onload = ready; }
        } else if (data?.type === 'screenshotSaved') {
            state.loaded = false;
            state.loading = false;
            if (state.host?.isConnected) requestGallery();
        } else if (data?.type === 'screenshotLibraryMoveProgress') {
            renderMigrationProgress(data);
        } else if (data?.type === 'screenshotOperationError') {
            window.showDoorpiToast?.(tx('Não foi possível concluir a ação','Could not complete the action'), data.message || tx('Capturas','Screenshots'));
        } else if (data?.type === 'screenshotError') {
            state.loading = false;
            window.showDoorpiToast?.(tx('Não foi possível salvar a captura','Could not save screenshot'), data.message || tx('Erro de captura','Capture failed'));
        }
    }
    function renderMigrationProgress(data) {
        const active = data.active === true;
        let overlay = document.getElementById('shotLibraryMigrationProgress');
        if (!active) {
            state.migrating = false;
            overlay?.remove();
            if (state.progressReturnFocus?.isConnected) {
                state.progressReturnFocus.focus?.({ preventScroll:true });
                revealFocus(state.progressReturnFocus);
            }
            state.progressReturnFocus = null;
            if (data.error) window.showDoorpiToast?.(tx('Não foi possível mover a biblioteca','Could not move the library'), data.error);
            return;
        }
        state.migrating = true;
        if (!overlay) {
            state.progressReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
            overlay = document.createElement('div');
            overlay.id = 'shotLibraryMigrationProgress';
            overlay.className = 'shot-library-migration';
            overlay.tabIndex = -1;
            overlay.setAttribute('role','dialog');
            overlay.setAttribute('aria-modal','true');
            overlay.setAttribute('aria-live','polite');
            overlay.innerHTML = `<div class="shot-library-migration-card"><div class="shot-library-migration-kicker">${tx('Biblioteca de capturas','Screenshot library')}</div><h2>${tx('Organizando capturas','Organizing screenshots')}</h2><p class="shot-library-migration-status"></p><span class="shot-library-migration-count"></span><div class="shot-library-migration-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div class="shot-library-migration-fill"></div></div></div>`;
            document.body.appendChild(overlay);
            requestAnimationFrame(() => overlay?.focus({ preventScroll:true }));
        }
        const total = Math.max(1, Number(data.total) || 0);
        const completed = Math.max(0, Math.min(total, Number(data.completed) || 0));
        const percent = Math.round(completed * 100 / total);
        overlay.querySelector('.shot-library-migration-status').textContent = tx('Movendo imagens para o novo local…','Moving images to the new location…');
        overlay.querySelector('.shot-library-migration-count').textContent = `${completed.toLocaleString()} / ${total.toLocaleString()}`;
        overlay.querySelector('[role="progressbar"]').setAttribute('aria-valuenow', String(percent));
        overlay.querySelector('.shot-library-migration-fill').style.width = `${percent}%`;
    }
    window.chrome?.webview?.addEventListener('message', receive);
    window.DoorpiScreenshotGallery = {
        renderInto,
        wire,
        enter() {
            state.shareSelection = null;
            state.view = 'games';
            state.selectedGameId = '';
            state.pendingFocus = '';
        },
        refresh() { requestGallery(); },
        openContextMenu,
        contextMenuClosed,
        contextAction,
        confirmShareSelection,
        shareSelectionActive: () => galleryVisible() && !!state.shareSelection,
        viewerOpen,
        moveViewer,
        moveGalleryFocus,
        revealFocus,
        back
    };
})();
