// =============================================================================
// renderer.js — Renderização Blindada contra Stuttering (Off-DOM Preloading)
// =============================================================================

// =============================================================================
// renderer.js — CardInteraction Definitivo (Decode via GPU Off-Thread)
// =============================================================================

function _doorpiFeaturedCardSrc(card) {
    return card?.dataset?.staticHorizontal
        || card?.dataset?.horizontal
        || card?.dataset?.staticVertical
        || card?.dataset?.vertical
        || '';
}

function _doorpiRestingCardSrc(card) {
    const canUseLiveAsStatic = card?.dataset?.isAnimated !== 'true';
    return card?.dataset?.staticVertical
        || (canUseLiveAsStatic ? card?.dataset?.vertical : '')
        || '';
}

function _doorpiSetCardImage(card, src) {
    const img = card?.querySelector?.('img');
    if (!img || !src) return;

    const currentAttr = img.getAttribute('src') || '';
    const currentSrc = img.src || '';
    if (currentAttr === src || currentSrc.endsWith(src)) return;

    img.style.display = '';
    img.src = src;
}

function _doorpiSyncFeaturedCardArt(root = document) {
    const grids = root?.matches?.('#gameGrid, #mediaGrid')
        ? [root]
        : Array.from(root?.querySelectorAll?.('#gameGrid, #mediaGrid') || []);

    grids.forEach(grid => {
        grid.querySelectorAll('.card:not(.add-card):not(.loading-card)').forEach(card => {
            const src = card.classList.contains('featured')
                ? _doorpiFeaturedCardSrc(card)
                : _doorpiRestingCardSrc(card);
            _doorpiSetCardImage(card, src);
        });
    });
}

window.syncFeaturedCardArt = _doorpiSyncFeaturedCardArt;

const CardInteraction = (() => {
    let heroTimer = null;
    let animTimer = null;
    let currentActiveCard = null;

    function start(card) {
        window._stopBlobBg?.(); // ← NOVO: para blob imediatamente ao focar card

        const channel = card.dataset.channel;
        if (channel === 'media' && window.getCurrentHomeTab?.() !== 'media') return;
        if (channel === 'stores' && window.getCurrentHomeTab?.() !== 'stores') return;
        if (channel === 'stores') return;

        if (currentActiveCard && currentActiveCard !== card) {
            stop(currentActiveCard);
        }
        currentActiveCard = card;

        if (heroTimer) clearTimeout(heroTimer);
        if (animTimer) clearTimeout(animTimer);

        const bgSrc = card.dataset.staticVertical || card.dataset.vertical;
        const heroSrc = card.dataset.staticHero || card.dataset.hero
            || card.dataset.staticHorizontal || card.dataset.horizontal
            || bgSrc;

        // ← MUDANÇA: logoSrc removido — triggerAnimations assume controle total do logo
        const heroDelay = window._gpNavigating ? 120 : 60;
        const animDelay = window._gpNavigating ? 380 : 250;

        heroTimer = setTimeout(() => {
            if (currentActiveCard === card && typeof switchHeroBackground === 'function') {
                switchHeroBackground(bgSrc, null, heroSrc); // null = não setar logo aqui
            }
        }, heroDelay);

        animTimer = setTimeout(() => {
            if (currentActiveCard === card) {
                triggerAnimations(card);
            }
        }, animDelay);
    }

    function stop(card) {
        if (currentActiveCard === card) {
            currentActiveCard = null;
            if (heroTimer) clearTimeout(heroTimer);
            if (animTimer) clearTimeout(animTimer);
        }

        const img = card.querySelector('img');
        if (!img) return;

        const isFeatured = card.classList.contains('featured');
        const staticSrc = isFeatured
            ? _doorpiFeaturedCardSrc(card)
            : _doorpiRestingCardSrc(card);

        // Só reverte se o src atual já é diferente — evita flicker desnecessário
        if (staticSrc && img.src && !img.src.endsWith(staticSrc)) {
            img.src = staticSrc;
        }
    }

    function triggerAnimations(card) {
        const isFeatured = card.classList.contains('featured');

        const animSrc = isFeatured
            ? (card.dataset.horizontal || card.dataset.vertical)
            : card.dataset.vertical;
        const staticSrc = isFeatured
            ? _doorpiFeaturedCardSrc(card)
            : _doorpiRestingCardSrc(card);

        if (animSrc && animSrc !== staticSrc) {
            const img = card.querySelector('img');
            if (img) safeLoadImage(img, animSrc, () => currentActiveCard === card);
        }

        const animHero = card.dataset.hero;
        if (animHero && animHero !== card.dataset.staticHero) {
            const heroImg = document.getElementById('heroImage');
            if (heroImg) safeLoadImage(heroImg, animHero, () => currentActiveCard === card);
        }

        // ← MUDANÇA: logo tratado aqui exclusivamente (sem concorrência com setImgSrc)
        // Usa animado se existir, senão usa estático — NUNCA há race condition
        const logoEl = document.getElementById('gameLogo');
        if (logoEl) {
            const logoToSet = card.dataset.logo || card.dataset.staticLogo;
            if (logoToSet) {
                safeLoadImage(logoEl, logoToSet, () => currentActiveCard === card, () => {
                    if (currentActiveCard === card) logoEl.classList.add('visible');
                });
            }
        }
    }

    // Versão estável — sem decode(), sem double rAF, sem off-thread.
    // Usa onload clássico: o browser carrega o arquivo completo antes de
    // aplicar, então GIF/APNG/WebP animado funcionam nativamente e sem piscar.
    function safeLoadImage(targetEl, src, isActiveFn, onComplete) {
        if (!src) return;

        if (targetEl.src && targetEl.src.endsWith(src)) {
            if (isActiveFn() && onComplete) onComplete();
            return;
        }

       
        targetEl.__req = Symbol();

        targetEl.onload = null;
        targetEl.onerror = null;

        targetEl.onload = function () {
            targetEl.onload = null;
            targetEl.onerror = null;
            if (!isActiveFn()) return;
            if (onComplete) onComplete();
        };

        targetEl.onerror = function () {
            targetEl.onload = null;
            targetEl.onerror = null;
            if (!isActiveFn()) return;
            if (onComplete) onComplete();
        };

        targetEl.src = src;
    }

    return { start, stop };
})();

window.pauseDoorpiArtworkForTransition = function (element) {
    const card = element?.closest?.('.card:not(.add-card):not(.loading-card)');
    if (!card) return;

    CardInteraction.stop(card);

    const heroStatic = card.dataset.staticHero
        || card.dataset.staticHorizontal
        || card.dataset.staticVertical
        || '';
    const heroImg = document.getElementById('heroImage');
    if (heroStatic && heroImg && !(heroImg.src || '').endsWith(heroStatic)) {
        heroImg.src = heroStatic;
    }

    const gridBg = document.getElementById('gridBgImg');
    if (heroStatic && gridBg && !(gridBg.src || '').endsWith(heroStatic)) {
        gridBg.src = heroStatic;
    }

    const logoStatic = card.dataset.staticLogo || '';
    const logoEl = document.getElementById('gameLogo');
    if (logoStatic && logoEl && !(logoEl.src || '').endsWith(logoStatic)) {
        logoEl.src = logoStatic;
    }
};

window.resumeDoorpiArtworkAfterTransition = function (element) {
    const card = element?.closest?.('.card:not(.add-card):not(.loading-card)')
        || document.activeElement?.closest?.('.card:not(.add-card):not(.loading-card)');
    if (!card) return;

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            if (!document.contains(card)) return;
            CardInteraction.start(card);
        });
    });
};


const CardRenderer = (() => {
    if (!document.getElementById('admin-lock-card-styles')) {
        const s = document.createElement('style');
        s.id = 'admin-lock-card-styles';
        s.textContent = `
            .card.admin-locked, .nav-vertical-card.admin-locked { filter: grayscale(.55) brightness(.72); opacity: .56; }
            .card.admin-locked:focus, .card.admin-locked:hover,
            .card.featured.admin-locked:focus, .card.featured.admin-locked:hover,
            .nav-vertical-card.admin-locked.nav-focused-el,
            .nav-vertical-card.admin-locked:focus, .nav-vertical-card.admin-locked:hover {
                opacity: .56 !important;
                filter: grayscale(.55) brightness(.72);
            }
            .admin-lock-icon {
                position: absolute;
                z-index: 5;
                background: rgba(0,0,0,.72);
                border: 1px solid rgba(255,255,255,.26);
                color: rgba(255,255,255,.9);
                display: inline-flex;
                align-items: center;
                justify-content: center;
                pointer-events: none;
                box-shadow: 0 8px 22px rgba(0,0,0,.38);
            }
            .admin-lock-icon svg { width: 58%; height: 58%; display: block; }
            .card .admin-lock-icon {
                top: clamp(10px, 0.8vw, 16px);
                right: clamp(10px, 0.8vw, 16px);
                width: clamp(34px, 2.2vw, 46px);
                height: clamp(34px, 2.2vw, 46px);
                border-radius: 50%;
            }
            .nav-vertical-card .admin-lock-icon {
                left: 50%;
                top: 50%;
                width: clamp(38px, 4.2vw, 70px);
                height: clamp(38px, 4.2vw, 70px);
                border-radius: 50%;
                transform: translate(-50%, -50%);
                background: rgba(0,0,0,.66);
                backdrop-filter: blur(4px);
                -webkit-backdrop-filter: blur(4px);
            }
        `;
        document.head.appendChild(s);
    }
    if (!document.getElementById('bulk-silent-card-styles')) {
        const s = document.createElement('style');
        s.id = 'bulk-silent-card-styles';
        s.textContent = `
            @keyframes doorpiBulkCardFadeIn {
                from { opacity: 0; transform: translateY(10px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .card.bulk-silent-card {
                animation: doorpiBulkCardFadeIn .65s ease both !important;
                transition: none !important;
            }
            .card.bulk-silent-card::before,
            .card.bulk-silent-card::after {
                animation: none !important;
                transition: none !important;
            }
        `;
        document.head.appendChild(s);
    }

    const LOCK_ICON_SVG = `
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="5.5" y="10" width="13" height="10" rx="2.2" stroke="currentColor" stroke-width="2"/>
            <path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>`;

    function _syncAdminLockIcon(card, locked) {
        let icon = card.querySelector('.admin-lock-icon');
        if (locked) {
            if (!icon) {
                icon = document.createElement('div');
                icon.className = 'admin-lock-icon';
                icon.innerHTML = LOCK_ICON_SVG;
                card.appendChild(icon);
            }
        } else {
            icon?.remove();
        }
        card.querySelector('.admin-lock-tooltip')?.remove();
    }

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

        // Avisa a interação que este card morreu
        CardInteraction.stop(card);

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

    function _selectedImageSrc(item, isFeatured) {
        const canUseLiveAsStatic = !item.isAnimated;
        return isFeatured
            ? (item.staticHorizontal || item.horizontal || item.staticVertical || item.vertical || '')
            : (item.staticVertical || (canUseLiveAsStatic ? item.vertical : ''));
    }

    function _queueStaticExtraction(card, item) {
        if (typeof processImage !== 'function') return;

        const queue = (src, dsKey, imageType) => {
            const processingKey = `processing_${dsKey}`;
            if (!src || item[dsKey] || card.dataset[dsKey] || card.dataset[processingKey]) return;
            card.dataset[processingKey] = 'true';
            Promise.resolve(processImage(card, src, dsKey, imageType, item.id))
                .finally(() => { delete card.dataset[processingKey]; });
        };

        queue(item.vertical, 'staticVertical', 'GridStatic');
        queue(item.horizontal, 'staticHorizontal', 'HorizontalStatic');
        queue(item.hero, 'staticHero', 'HeroStatic');
        queue(item.logo, 'staticLogo', 'LogoStatic');
    }

    function _syncCardData(card, item, isFeatured) {
        card.dataset.vertical = item.vertical || '';
        card.dataset.horizontal = item.horizontal || '';
        card.dataset.hero = item.hero || '';
        card.dataset.logo = item.logo || '';
        card.dataset.staticVertical = item.staticVertical || '';
        card.dataset.staticHorizontal = item.staticHorizontal || '';
        card.dataset.staticHero = item.staticHero || '';
        card.dataset.staticLogo = item.staticLogo || '';
        card.dataset.iconBase64 = item.iconBase64 || '';
        card.dataset.isAnimated = item.isAnimated ? 'true' : 'false';
        if (item.disableGamepadControl != null) {
            card.dataset.disableGamepadControl = item.disableGamepadControl ? 'true' : 'false';
        }
        card.dataset.isAdminLocked = item.isAdminLocked ? 'true' : 'false';
        card.dataset.adminLockReason = item.adminLockReason || '';
        card.classList.toggle('admin-locked', !!item.isAdminLocked);

        const titleEl = card.querySelector('.title');
        if (titleEl) titleEl.textContent = item.name || '';

        _syncAdminLockIcon(card, !!item.isAdminLocked);

        const fallbackEl = card.querySelector('.media-card-fallback');
        if (fallbackEl) fallbackEl.textContent = (item.name || '?').charAt(0).toUpperCase();

        const img = card.querySelector('img');
        const src = _selectedImageSrc(item, isFeatured);

        if (!src) {
            card.classList.add('no-art');
            if (img) img.style.display = 'none';
            if (fallbackEl) fallbackEl.style.display = '';
            return;
        }

        card.classList.remove('no-art');
        if (fallbackEl) fallbackEl.style.display = 'none';
        if (img) {
            img.onload = () => { if (fallbackEl) fallbackEl.style.display = 'none'; };
            img.onerror = () => {
                img.style.display = 'none';
                card.classList.add('no-art');
                if (fallbackEl) fallbackEl.style.display = '';
            };
            img.style.display = '';
            if (img.getAttribute('src') !== src) img.src = src;
        }

        _queueStaticExtraction(card, item);
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

        card.tabIndex = 0;
        card.dataset.badgeNew = typeof t === 'function' ? t('badgeNew') : 'Novo';
        card.dataset.id = item.id;
        card.dataset.channel = item.channel;
        card.dataset.appType = item.appType;
        card.dataset.isAnimated = item.isAnimated ? 'true' : 'false';
        card.dataset.isAdminLocked = item.isAdminLocked ? 'true' : 'false';
        card.dataset.adminLockReason = item.adminLockReason || '';
        card.classList.toggle('admin-locked', !!item.isAdminLocked);

        card.dataset.vertical = item.vertical || '';
        card.dataset.horizontal = item.horizontal || '';
        card.dataset.hero = item.hero || '';
        card.dataset.logo = item.logo || '';
        card.dataset.staticVertical = item.staticVertical || '';
        card.dataset.staticHorizontal = item.staticHorizontal || '';
        card.dataset.staticHero = item.staticHero || '';
        card.dataset.staticLogo = item.staticLogo || '';
        card.dataset.iconBase64 = item.iconBase64 || '';

        if (item.channel === 'games') {
            card.dataset.gameId = item.id;
            card.dataset.source = item.source || '';
        } else {
            card.dataset.appId = item.id;
            card.dataset.appUrl = item.url || '';
            card.dataset.adminStoreBlocked = item.adminStoreBlocked ? 'true' : 'false';
            card.dataset.steamForceAccountSelection = item.steamForceAccountSelection ? 'true' : 'false';
            card.dataset.shareMode = item.shareMode || 'private';
            card.dataset.sharedWithUserId = item.sharedWithUserId || '';
            card.dataset.sharedWithUserIds = JSON.stringify(item.sharedWithUserIds || []);
            card.dataset.sharedWithUserNames = JSON.stringify(item.sharedWithUserNames || []);
            card.dataset.ownerUserId = item.ownerUserId || '';
            card.dataset.sharedFromOther = item.sharedFromOther ? 'true' : 'false';
            card.dataset.sharedFromName = item.sharedFromName || '';

   
            let dgc = !!(item.disableGamepadControl || item.DisableGamepadControl);
            if (window._mediaGamepadConfig && window._mediaGamepadConfig[item.id] !== undefined) {
                dgc = window._mediaGamepadConfig[item.id];
            }
            card.dataset.disableGamepadControl = dgc ? 'true' : 'false';

        }

        const img = card.querySelector('img');
        const titleEl = card.querySelector('.title');
        const fallbackEl = card.querySelector('.media-card-fallback');

        titleEl.textContent = item.name;
        window.applyRuntimeStateToCard?.(card);

        if (item.isAdminLocked) {
            _syncAdminLockIcon(card, true);
        }

        const staticSrc = _selectedImageSrc(item, isFeatured);

        if (fallbackEl) {
            fallbackEl.textContent = (item.name || '?').charAt(0).toUpperCase();
            fallbackEl.style.display = staticSrc ? 'none' : '';
        }
        if (!staticSrc) {
            card.classList.add('no-art');
        }

        if (staticSrc) {
            img.src = staticSrc;
            img.onload = () => { if (fallbackEl) fallbackEl.style.display = 'none'; };
            img.onerror = () => {
                img.style.display = 'none';
                card.classList.add('no-art');
                if (fallbackEl) fallbackEl.style.display = '';
            };
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
            if (item.isAdminLocked) {
                window.showDoorpiToast?.(
                    typeof t === 'function' ? t('adminBlockedTitle', 'Bloqueado pelo administrador') : 'Bloqueado pelo administrador',
                    typeof t === 'function' ? t('adminBlockedSubtitle', 'Esta loja foi privada para esta conta.') : 'Esta loja foi privada para esta conta.'
                );
                return;
            }

            const launchId = item.channel === 'games' ? (item.launchUrl || item.path) : item.url;
            const hasConflict = window._handleSessionConflictFromLaunch?.(item, launchId) === true;
            if (hasConflict) return;

            window.AppStore.mutations.trackOpened(item.id);

            if (item.channel === 'games') {
                window.suspendDoorpiGameInput?.();
                postToHost({ action: 'launch', path: launchId, errorMsg: typeof t === 'function' ? t('msgErrorLaunch') : 'Erro ao iniciar' });
            } else if (item.channel === 'stores') {
                window.isStoreSessionActive = true;
                postToHost({ action: 'openStore', storeId: item.id || launchId });
            } else {
                window.isMediaAppActive = true;
                window._rememberLaunchedWebAppForConflict?.(item, launchId);
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

        gridEl.querySelectorAll('.loading-card').forEach(c => c.remove());

        const old = Array.from(gridEl.querySelectorAll('.card:not(.add-card):not(.loading-card)'));
        old.forEach(_recycle);
        old.forEach(c => c.remove());

        anchorEl ? gridEl.insertBefore(fragment, anchorEl) : gridEl.appendChild(fragment);
        _doorpiSyncFeaturedCardArt(gridEl);
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
                const src = c.dataset.staticVertical || (c.dataset.isAnimated !== 'true' ? c.dataset.vertical : '');
                if (src) img.src = src;
            }
        });

        gridEl.insertBefore(card, gridEl.firstElementChild);
        _doorpiSyncFeaturedCardArt(gridEl);
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
        const isStoresGrid = gridEl?.id === 'storesGrid';

        gridEl.querySelectorAll('.card:not(.add-card):not(.loading-card)').forEach(c => {
            cardMap.set(c.dataset.id, c);
        });

        items.forEach(item => {
            const card = cardMap.get(item.id);
            if (card) gridEl.insertBefore(card, anchorEl);
        });

        const first = items[0];
        if (first && !isStoresGrid) {
            cardMap.forEach((card, id) => {
                const shouldBeFeatured = id === first.id;
                card.classList.toggle('featured', shouldBeFeatured);
            });
        }
        _doorpiSyncFeaturedCardArt(gridEl);
    }

    function applyPatch(id, patch, gridEl) {
        const card = gridEl.querySelector(`.card[data-id="${CSS.escape(id)}"]`);
        if (!card) return;

        if (patch.name != null) {
            const titleEl = card.querySelector('.title');
            if (titleEl) titleEl.textContent = patch.name;

            const fallbackEl = card.querySelector('.media-card-fallback');
            if (fallbackEl) {
                fallbackEl.textContent = patch.name.charAt(0).toUpperCase();
            }
        }
        if (patch.staticVertical) card.dataset.staticVertical = patch.staticVertical;
        if (patch.staticHorizontal) card.dataset.staticHorizontal = patch.staticHorizontal;
        if (patch.staticHero) card.dataset.staticHero = patch.staticHero;
        if (patch.staticLogo) card.dataset.staticLogo = patch.staticLogo;
        if (patch.vertical) card.dataset.vertical = patch.vertical;
        if (patch.horizontal) card.dataset.horizontal = patch.horizontal;
        if (patch.hero) card.dataset.hero = patch.hero;
        if (patch.logo) card.dataset.logo = patch.logo;
        if (patch.iconBase64) card.dataset.iconBase64 = patch.iconBase64;
        if (patch.shareMode) card.dataset.shareMode = patch.shareMode;
        if (patch.disableGamepadControl != null) card.dataset.disableGamepadControl = String(patch.disableGamepadControl);
        const img = card.querySelector('img');
        if (img && (patch.staticVertical || patch.staticHorizontal || patch.vertical || patch.horizontal)) {
            card.classList.remove('no-art');
            const fallbackEl = card.querySelector('.media-card-fallback');
            if (fallbackEl) fallbackEl.style.display = 'none';
            const isFeatured = card.classList.contains('featured');
            _doorpiSetCardImage(card, isFeatured ? _doorpiFeaturedCardSrc(card) : _doorpiRestingCardSrc(card));
            img.style.display = '';
        }
    }

    function syncDOM(channel, items, gridEl, anchorEl, opts = {}) {
        const silent = !!opts.silent;
        const existingCards = Array.from(gridEl.querySelectorAll('.card:not(.add-card):not(.loading-card)'));
        const firstPositions = new Map();
        if (!silent) {
            existingCards.forEach(c => firstPositions.set(c.dataset.id, c.getBoundingClientRect()));
        }

        const existingMap = new Map();
        existingCards.forEach(c => existingMap.set(c.dataset.id, c));

        const isUpdate = existingCards.length > 0;
        const hasSkeletons = gridEl.querySelectorAll('.loading-card').length > 0;

        items.forEach((item, index) => {
            const isFeatured = channel !== 'stores' && index === 0;
            let card = existingMap.get(item.id);

            if (card) {
                _syncCardData(card, item, isFeatured);
                if (card.classList.contains('featured') !== isFeatured) {
                    card.classList.toggle('featured', isFeatured);
                }
                gridEl.insertBefore(card, anchorEl);
            } else {
                card = _buildCard(item, isFeatured);
                if (silent) {
                    card.classList.add('bulk-silent-card');
                    setTimeout(() => card.classList.remove('bulk-silent-card'), 750);
                }
                if (!silent && isUpdate && index > 0 && !hasSkeletons) {
                    card.classList.add('promoted-up');
                    setTimeout(() => card.classList.remove('promoted-up'), 500);
                }
                gridEl.insertBefore(card, anchorEl);
            }
        });

        if (!silent) {
            existingCards.forEach(card => {
                const newPos = card.getBoundingClientRect();
                const oldPos = firstPositions.get(card.dataset.id);

                if (oldPos && (oldPos.left !== newPos.left || oldPos.top !== newPos.top)) {
                    const deltaX = oldPos.left - newPos.left;
                    const deltaY = oldPos.top - newPos.top;

                    card.style.transition = 'none';
                    card.style.transform = `translate(${deltaX}px, ${deltaY}px)`;

                    requestAnimationFrame(() => {
                        card.style.transition = '';
                        card.style.transform = '';
                    });
                }
            });
        }

        gridEl.querySelectorAll('.loading-card').forEach(c => c.remove());

        const newIds = new Set(items.map(i => i.id));
        existingCards.forEach(c => {
            if (!newIds.has(c.dataset.id) && !c.classList.contains('removing')) {
                _recycle(c);
                c.remove();
            }
        });
        _doorpiSyncFeaturedCardArt(gridEl);
    }
    return { renderBatch, prependCard, removeCard, reorderDOM, applyPatch, syncDOM };
})();
// ── Transição Estilo "Swipe / Scroll" (Otimizada para 60fps) ───────────
// ── Transição Estilo "Swipe / Scroll" (Otimizada e Longa) ───────────
(function injectScrollTabTransitions() {
    if (document.getElementById('doorpiTabTransitions')) {
        document.getElementById('doorpiTabTransitions').remove();
    }

    const style = document.createElement('style');
    style.id = 'doorpiTabTransitions';
    style.textContent = `
        /* ABA DA ESQUERDA (Jogos) */
        @keyframes slideInFromLeft {
            0% {
                opacity: 0;
                transform: translateX(-150px); /* Distância maior e mais perceptível */
            }
            100% {
                opacity: 1;
                transform: translateX(0);
            }
        }

        /* ABA DA DIREITA (Mídia) */
        @keyframes slideInFromRight {
            0% {
                opacity: 0;
                transform: translateX(150px);
            }
            100% {
                opacity: 1;
                transform: translateX(0);
            }
        }

        #gameGrid,
        #view-apps.active {
            /* 'both' é a mágica: aplica opacidade 0 antes de iniciar, matando a piscada */
            animation: slideInFromLeft 0.45s cubic-bezier(0.22, 1, 0.36, 1) both !important;
            will-change: transform, opacity;
            backface-visibility: hidden; /* Força 2D por hardware, evita tremulação nos pixels */
        }

        #mediaGrid,
        #storesGrid,
        #view-media-apps.active,
        #view-folders.active {
            animation: slideInFromRight 0.45s cubic-bezier(0.22, 1, 0.36, 1) both !important;
            will-change: transform, opacity;
            backface-visibility: hidden;
        }
    `;
    document.head.appendChild(style);
})();

// ── Reseta o fundo imediatamente ao clicar ou focar em qualquer aba/menu lateral ───────────
document.addEventListener('mousedown', (e) => {
    if (e.target.closest('.nav-menu, .menu-tab, .nav-item, .nav-btn')) {
        if (typeof clearHero === 'function') {
            clearHero(true); 
        }
    }
}, true);

document.addEventListener('focusin', (e) => {

    if (e.target.closest('.nav-menu, .menu-tab, .nav-item, .nav-btn')) {
        if (typeof clearHero === 'function') {
            clearHero(true);
        }
    }
}, true);
