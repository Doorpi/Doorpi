// =============================================================================
// renderer.js — Renderização sem DOM Thrashing + CardInteraction
// =============================================================================

const CardInteraction = (() => {
    function start(card) {
        const channel = card.dataset.channel;

        if (channel === 'media' && window.getCurrentHomeTab?.() !== 'media') return;

        const bgSrc = card.dataset.staticVertical || card.dataset.vertical;
        const logoSrc = card.dataset.staticLogo || card.dataset.logo;
        const heroSrc = card.dataset.staticHero || card.dataset.hero
            || card.dataset.staticHorizontal || card.dataset.horizontal
            || bgSrc;

        switchHeroBackground(bgSrc, logoSrc, heroSrc);

        if (card._animTimer) clearTimeout(card._animTimer);

        card._animTimer = setTimeout(async () => {
            const active = () => document.activeElement === card || card.matches(':hover');
            if (!active()) return;

            const img = card.querySelector('img');
            const isFeatured = card.classList.contains('featured');

            const animSrc = isFeatured
                ? (card.dataset.horizontal || card.dataset.vertical)
                : card.dataset.vertical;

            const staticSrc = isFeatured
                ? (card.dataset.staticHorizontal || card.dataset.horizontal || card.dataset.staticVertical || card.dataset.vertical)
                : (card.dataset.staticVertical || card.dataset.vertical);

            if (animSrc && animSrc !== staticSrc) {
                await setImgSrc(img, animSrc);
            }

            if (!active()) return;

            const animHero = card.dataset.hero;
            if (animHero && animHero !== card.dataset.staticHero)
                await setImgSrc(document.getElementById('heroImage'), animHero);

            if (!active()) return;

            const animLogo = card.dataset.logo;
            if (animLogo && animLogo !== card.dataset.staticLogo) {
                const logoEl = document.getElementById('gameLogo');
                if (logoEl) { await setImgSrc(logoEl, animLogo); logoEl.classList.add('visible'); }
            }
        }, 200);
    }

    function stop(card) {
        if (card._animTimer) clearTimeout(card._animTimer);
        if (document.activeElement === card || card.matches(':hover')) return;

        const img = card.querySelector('img');
        const staticSrc = card.classList.contains('featured')
            ? (card.dataset.staticHorizontal || card.dataset.horizontal
                || card.dataset.staticVertical || card.dataset.vertical)
            : (card.dataset.staticVertical || card.dataset.vertical);

        if (img && staticSrc && img.src !== staticSrc) {
            setImgSrc(img, staticSrc);
        }
    }

    return { start, stop };
})();

const CardRenderer = (() => {

    const _pool = [];
    const MAX_POOL = 24;

    function _getCard() {
        return _pool.pop() || _makeShell();
    }

    function _makeShell() {
        const card = document.createElement('div');
        card.innerHTML = `
            <img decoding="async" loading="lazy" alt="" />
            <div class="title"></div>
            <div class="media-card-fallback" aria-hidden="true"></div>
        `;
        return card;
    }

    function _recycle(card) {
        card._abortCtrl?.abort();
        card._abortCtrl = null;
        if (card._animTimer) { clearTimeout(card._animTimer); card._animTimer = null; }

        for (const key of Object.keys(card.dataset)) delete card.dataset[key];

        card.className = 'card';
        card.style.order = '';

        const img = card.querySelector('img');
        if (img) { img.src = ''; img.onload = null; img.onerror = null; img.style.display = ''; }

        const title = card.querySelector('.title');
        if (title) title.textContent = '';

        const fallback = card.querySelector('.media-card-fallback');
        if (fallback) { fallback.textContent = ''; fallback.style.display = ''; }

        Array.from(card.children).forEach(child => {
            if (!child.classList.contains('title') &&
                !child.classList.contains('media-card-fallback') &&
                child.tagName !== 'IMG') {
                child.remove();
            }
        });

        if (_pool.length < MAX_POOL) _pool.push(card);
    }

    function _buildCard(item, isFeatured) {
        const card = _getCard();
        const ctrl = new AbortController();
        card._abortCtrl = ctrl;
        const { signal } = ctrl;

        card.classList.add('card');
        if (item.channel === 'media') card.classList.add('media-card');
        if (isFeatured) card.classList.add('featured');
        if (window.AppStore.queries.isNew(item.id)) {
            card.classList.add('new-game');
        }
        // 🔹 Verifica no Store Global unificado se o item foi marcado como Novo
        if (window.AppStore.queries.isNew(item.id)) {
            card.classList.add('new-game');
        }

        card.tabIndex = 0;
        card.dataset.badgeNew = typeof t === 'function' ? t('badgeNew') : 'Novo';
        card.dataset.id = item.id;
        card.dataset.channel = item.channel;
        card.dataset.appType = item.appType;
        card.dataset.isAnimated = item.isAnimated ? 'true' : 'false';

        card.dataset.vertical = item.vertical || '';
        card.dataset.horizontal = item.horizontal || '';
        card.dataset.hero = item.hero || '';
        card.dataset.logo = item.logo || '';
        card.dataset.staticVertical = item.staticVertical || '';
        card.dataset.staticHorizontal = item.staticHorizontal || '';
        card.dataset.staticHero = item.staticHero || '';
        card.dataset.staticLogo = item.staticLogo || '';

        if (item.channel === 'games') {
            card.dataset.gameId = item.id;
        } else {
            card.dataset.appId = item.id;
            card.dataset.appUrl = item.url || '';
            card.dataset.shareMode = item.shareMode || 'private';
            card.dataset.sharedFromOther = item.sharedFromOther ? 'true' : 'false';
            card.dataset.sharedFromName = item.sharedFromName || '';
        }

        const img = card.querySelector('img');
        const titleEl = card.querySelector('.title');
        const fallbackEl = card.querySelector('.media-card-fallback');

        titleEl.textContent = item.name;

        const staticSrc = isFeatured
            ? (item.staticHorizontal || item.horizontal || item.staticVertical || item.vertical)
            : (item.staticVertical || item.vertical);

        if (item.channel === 'media') {
            if (fallbackEl) {
                fallbackEl.style.display = '';
                fallbackEl.textContent = (item.name || '?').charAt(0).toUpperCase();
            }
            if (!staticSrc) {
                card.classList.add('no-art');
            }
        } else {
            if (fallbackEl) fallbackEl.style.display = 'none';
        }

        if (staticSrc) {
            img.src = staticSrc;
            img.onload = () => { if (fallbackEl) fallbackEl.style.display = 'none'; };
            img.onerror = () => { img.style.display = 'none'; };
        }

        if (item.channel === 'media' && (item.shareMode !== 'private' || item.sharedFromOther)) {
            const badge = document.createElement('div');
            badge.className = 'title';
            badge.style.cssText = 'font-size:0.65em;color:rgba(120,190,255,.95);bottom:8px;';
            badge.textContent = item.sharedFromOther
                ? (typeof t === 'function' ? t('sharedFromOther') : 'Compartilhado')
                : (typeof t === 'function' ? t('sharedAccount') : 'Conta compartilhada');
            card.appendChild(badge);
        }

        card.addEventListener('mouseenter', () => CardInteraction.start(card), { signal });
        card.addEventListener('mouseleave', () => CardInteraction.stop(card), { signal });

        card.addEventListener('focus', () => {
            if (typeof pendingInteractionCard !== 'undefined') pendingInteractionCard = card;
            if (typeof signalNavigation === 'function') signalNavigation();
            CardInteraction.start(card);
        }, { signal });

        card.addEventListener('blur', () => {
            if (typeof pendingInteractionCard !== 'undefined' && pendingInteractionCard === card)
                pendingInteractionCard = null;
            CardInteraction.stop(card);
        }, { signal });

        card.addEventListener('click', () => {
            const launchId = item.channel === 'games' ? (item.launchUrl || item.path) : item.url;
            window.AppStore.mutations.trackOpened(item.id);

            if (item.channel === 'games') {
                postToHost({ action: 'launch', path: launchId, errorMsg: typeof t === 'function' ? t('msgErrorLaunch') : 'Erro ao iniciar' });
            } else {
                window.isMediaAppActive = true;
                postToHost({
                    action: 'launchMediaApp', url: launchId, appType: item.appType,
                    toastTitle: typeof t === 'function' ? t('toastCopied') : '', toastSub: typeof t === 'function' ? t('toastReturning') : ''
                });
            }
        }, { signal });

        if (typeof processImage === 'function') {
            if (item.vertical && !item.staticVertical)
                processImage(card, item.vertical, 'staticVertical', 'GridStatic', item.id);

            if (item.horizontal && !item.staticHorizontal)
                processImage(card, item.horizontal, 'staticHorizontal', 'HorizontalStatic', item.id);

            if (item.hero && !item.staticHero)
                processImage(card, item.hero, 'staticHero', 'HeroStatic', item.id);

            if (item.logo && !item.staticLogo)
                processImage(card, item.logo, 'staticLogo', 'LogoStatic', item.id);
        }

        return card;
    }

    function renderBatch(channel, items, gridEl, anchorEl) {
        const fragment = document.createDocumentFragment();
        items.forEach((item, i) => {
            const card = _buildCard(item, i === 0);
            fragment.appendChild(card);
        });

        // Limpa apenas o que for skeleton, preserva o anchor (botão adicionar)
        gridEl.querySelectorAll('.loading-card').forEach(c => c.remove());

        // Limpa cards antigos, mas ignora o botão adicionar
        const old = Array.from(gridEl.querySelectorAll('.card:not(.add-card):not(.loading-card)'));
        old.forEach(_recycle);
        old.forEach(c => c.remove());

        anchorEl ? gridEl.insertBefore(fragment, anchorEl) : gridEl.appendChild(fragment);
    }

    function prependCard(item, gridEl, anchorEl) {
        const card = _buildCard(item, true);
        const existing = Array.from(gridEl.querySelectorAll('.card:not(.add-card):not(.loading-card)'));

        if (existing.length >= 12) {
            const last = existing[existing.length - 1];
            _recycle(last);
            last.remove();
        }

        existing.forEach(c => {
            c.classList.remove('featured');
            const img = c.querySelector('img');
            if (img) {
                const src = c.dataset.staticVertical || c.dataset.vertical;
                if (src) img.src = src;
            }
        });

        // Insere o card fisicamente no topo do Grid
        gridEl.insertBefore(card, gridEl.firstElementChild);
        return card;
    }

    function removeCard(id, gridEl) {
        const card = gridEl.querySelector(`.card[data-id="${CSS.escape(id)}"]`);
        if (!card) return;

        card.classList.add('removing');
        setTimeout(() => { _recycle(card); card.remove(); }, 280);
    }

    function reorderDOM(items, gridEl, anchorEl) {
        const cardMap = new Map();

        // Pega todos os cards reais existentes
        gridEl.querySelectorAll('.card:not(.add-card):not(.loading-card)').forEach(c => {
            cardMap.set(c.dataset.id, c);
        });

        // Move os cards fisicamente para a ordem correta antes do botão Adicionar
        items.forEach(item => {
            const card = cardMap.get(item.id);
            if (card) gridEl.insertBefore(card, anchorEl);
        });

        // Atualiza a imagem Featured (se o cara perdeu a coroa, volta pra arte vertical)
        const first = items[0];
        if (first) {
            cardMap.forEach((card, id) => {
                const shouldBeFeatured = id === first.id;
                if (card.classList.contains('featured') === shouldBeFeatured) return;

                card.classList.toggle('featured', shouldBeFeatured);
                const img = card.querySelector('img');

                if (img && shouldBeFeatured) {
                    const src = card.dataset.staticHorizontal || card.dataset.horizontal || card.dataset.staticVertical || card.dataset.vertical;
                    if (src) img.src = src;
                } else if (img && !shouldBeFeatured) {
                    const src = card.dataset.staticVertical || card.dataset.vertical;
                    if (src) img.src = src;
                }
            });
        }
    }

    function applyPatch(id, patch, gridEl) {
        const card = gridEl.querySelector(`.card[data-id="${CSS.escape(id)}"]`);
        if (!card) return;

        if (patch.name != null) {
            const titleEl = card.querySelector('.title');
            if (titleEl) titleEl.textContent = patch.name;

            const fallbackEl = card.querySelector('.media-card-fallback');
            if (fallbackEl && card.classList.contains('media-card')) {
                fallbackEl.textContent = patch.name.charAt(0).toUpperCase();
            }
        }
        if (patch.staticVertical) card.dataset.staticVertical = patch.staticVertical;
        if (patch.staticHorizontal) card.dataset.staticHorizontal = patch.staticHorizontal;
        if (patch.staticHero) card.dataset.staticHero = patch.staticHero;
        if (patch.staticLogo) card.dataset.staticLogo = patch.staticLogo;
        if (patch.shareMode) card.dataset.shareMode = patch.shareMode;

        const img = card.querySelector('img');
        if (img && patch.staticVertical) {
            card.classList.remove('no-art');
            const isFeatured = card.classList.contains('featured');
            if (!isFeatured) {
                img.src = patch.staticVertical;
            } else if (patch.staticHorizontal) {
                img.src = patch.staticHorizontal;
            }
            img.style.display = '';
        }
    }

    return { renderBatch, prependCard, removeCard, reorderDOM, applyPatch };
})();