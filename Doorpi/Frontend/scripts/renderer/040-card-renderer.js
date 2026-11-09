const CardRenderer = (() => {
    if (!document.getElementById('admin-lock-card-styles')) {
        const s = document.createElement('style');
        s.id = 'admin-lock-card-styles';
        s.textContent = __doorpiCss("injected-styles/renderer/admin-lock-card-styles.css");
        document.head.appendChild(s);
    }
    if (!document.getElementById('bulk-silent-card-styles')) {
        const s = document.createElement('style');
        s.id = 'bulk-silent-card-styles';
        s.textContent = __doorpiCss("injected-styles/renderer/bulk-silent-card-styles.css");
        document.head.appendChild(s);
    }

    const LOCK_ICON_SVG = `
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="5.5" y="10" width="13" height="10" rx="2.2" stroke="currentColor" stroke-width="2"/>
            <path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>`;

    function _safeIconBase64(value) {
        return String(value || '').replace(/"/g, '&quot;').trim();
    }

    function _safeFallbackName(value) {
        return String(value || 'App').trim().replace(/[&<>"']/g, char => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[char]));
    }

    function _fallbackMarkup(iconBase64, name) {
        const safeIcon = _safeIconBase64(iconBase64);
        if (safeIcon) {
            return `
                <img class="media-card-fallback-blur" src="data:image/png;base64,${safeIcon}" alt="" />
                <img class="media-card-fallback-icon" src="data:image/png;base64,${safeIcon}" alt="" />
            `;
        }

        return `<span class="media-card-fallback-name">${_safeFallbackName(name)}</span>`;
    }

    function _syncFallback(card, iconBase64, name = '') {
        const fallbackEl = card?.querySelector?.('.media-card-fallback');
        if (!fallbackEl) return;
        const nextIcon = _safeIconBase64(iconBase64);
        const nextName = String(name || card.querySelector?.('.title')?.textContent || 'App').trim() || 'App';
        if (fallbackEl.dataset.iconBase64 === nextIcon && fallbackEl.dataset.fallbackName === nextName) return;
        fallbackEl.dataset.iconBase64 = nextIcon;
        fallbackEl.dataset.fallbackName = nextName;
        fallbackEl.innerHTML = _fallbackMarkup(nextIcon, nextName);
    }

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
        if (fallback) { fallback.innerHTML = ''; fallback.style.display = ''; delete fallback.dataset.iconBase64; }

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
        return item.staticVertical || (canUseLiveAsStatic ? item.vertical : '')
            || item.staticHorizontal || item.horizontal || '';
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
        card.dataset.id = item.id || '';
        card.dataset.channel = item.channel || '';
        card.dataset.appType = item.appType || '';
        if (item.channel === 'games') {
            card.dataset.gameId = item.id || '';
            card.dataset.source = item.source || '';
            delete card.dataset.appId;
            delete card.dataset.appUrl;
        } else {
            card.dataset.appId = item.id || '';
            card.dataset.appUrl = item.url || '';
            delete card.dataset.gameId;
        }
        card.dataset.name = item.name || '';
        card.dataset.vertical = item.vertical || '';
        card.dataset.horizontal = item.horizontal || '';
        card.dataset.hero = item.hero || '';
        card.dataset.logo = item.logo || '';
        card.dataset.staticVertical = item.staticVertical || '';
        card.dataset.staticHorizontal = item.staticHorizontal || '';
        card.dataset.staticHero = item.staticHero || '';
        card.dataset.staticLogo = item.staticLogo || '';
        card.dataset.trailerSource = item.trailerSource || '';
        card.dataset.trailerType = item.trailerType || '';
        card.dataset.iconBase64 = item.iconBase64 || '';
        card.dataset.assetQuery = item.assetQuery || item.AssetQuery || '';
        card.dataset.path = item.path || '';
        card.dataset.launchUrl = item.launchUrl || '';
        card.dataset.launchCommand = item.launchCommand || '';
        card.dataset.emulatorId = item.emulatorId || '';
        card.dataset.emulatorName = item.emulatorName || '';
        card.dataset.emulatorDiscPaths = JSON.stringify(item.emulatorDiscPaths || []);
        card.dataset.totalPlaytimeMinutes = String(item.totalPlaytimeMinutes || 0);
        card.dataset.lastSessionMinutes = String(item.lastSessionMinutes || 0);
        card.dataset.isAnimated = item.isAnimated ? 'true' : 'false';
        if (item.disableGamepadControl != null) {
            card.dataset.disableGamepadControl = item.disableGamepadControl ? 'true' : 'false';
        }
        if (item.channel === 'media') {
            card.dataset.mediaHistoryCategory = item.mediaHistoryCategory || item.MediaHistoryCategory || 'auto';
        }
        card.dataset.isAdminLocked = item.isAdminLocked ? 'true' : 'false';
        card.dataset.adminLockReason = item.adminLockReason || '';
        card.classList.toggle('admin-locked', !!item.isAdminLocked);

        const titleEl = card.querySelector('.title');
        if (titleEl) titleEl.textContent = item.name || '';

        _syncAdminLockIcon(card, !!item.isAdminLocked);

        _syncFallback(card, item.iconBase64 || '', item.name || '');
        const fallbackEl = card.querySelector('.media-card-fallback');

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
        card.dataset.name = item.name || '';
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
        card.dataset.trailerSource = item.trailerSource || '';
        card.dataset.trailerType = item.trailerType || '';
        card.dataset.iconBase64 = item.iconBase64 || '';
        card.dataset.path = item.path || '';
        card.dataset.launchUrl = item.launchUrl || '';
        card.dataset.launchCommand = item.launchCommand || '';
        card.dataset.emulatorId = item.emulatorId || '';
        card.dataset.emulatorName = item.emulatorName || '';
        card.dataset.emulatorDiscPaths = JSON.stringify(item.emulatorDiscPaths || []);
        card.dataset.totalPlaytimeMinutes = String(item.totalPlaytimeMinutes || 0);
        card.dataset.lastSessionMinutes = String(item.lastSessionMinutes || 0);

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
            card.dataset.mediaHistoryCategory = item.mediaHistoryCategory || item.MediaHistoryCategory || 'auto';

        }

        const img = card.querySelector('img');
        const titleEl = card.querySelector('.title');
        const fallbackEl = card.querySelector('.media-card-fallback');

        titleEl.textContent = item.name;
        _syncFallback(card, item.iconBase64 || '', item.name || '');
        window.applyRuntimeStateToCard?.(card);

        if (item.isAdminLocked) {
            _syncAdminLockIcon(card, true);
        }

        const staticSrc = _selectedImageSrc(item, isFeatured);

        if (fallbackEl) fallbackEl.style.display = staticSrc ? 'none' : '';
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

            if (item.channel === 'games') {
                const launch = (discPath = '') => {
                    window.AppStore.mutations.trackOpened(item.id);
                    window.suspendDoorpiGameInput?.();
                    postToHost({
                        action: 'launch',
                        path: launchId,
                        discPath,
                        errorMsg: typeof t === 'function' ? t('msgErrorLaunch') : 'Erro ao iniciar'
                    });
                };
                if (Array.isArray(item.emulatorDiscPaths) && item.emulatorDiscPaths.length > 1 &&
                    window.openEmulatorDiscSelector?.(item, launch)) return;
                launch();
            } else if (item.channel === 'stores') {
                window.AppStore.mutations.trackOpened(item.id);
                window.isStoreSessionActive = true;
                postToHost({ action: 'openStore', storeId: item.id || launchId });
            } else {
                window.AppStore.mutations.trackOpened(item.id);
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
        const hasOwn = key => Object.prototype.hasOwnProperty.call(patch, key);
        const artworkChanged = [
            'staticVertical', 'staticHorizontal', 'staticHero', 'staticLogo',
            'vertical', 'horizontal', 'hero', 'logo'
        ].some(hasOwn);

        if (patch.name != null) {
            const titleEl = card.querySelector('.title');
            if (titleEl) titleEl.textContent = patch.name;
        }

        if (hasOwn('staticVertical')) card.dataset.staticVertical = patch.staticVertical || '';
        if (hasOwn('staticHorizontal')) card.dataset.staticHorizontal = patch.staticHorizontal || '';
        if (hasOwn('staticHero')) card.dataset.staticHero = patch.staticHero || '';
        if (hasOwn('staticLogo')) card.dataset.staticLogo = patch.staticLogo || '';
        if (hasOwn('vertical')) card.dataset.vertical = patch.vertical || '';
        if (hasOwn('horizontal')) card.dataset.horizontal = patch.horizontal || '';
        if (hasOwn('hero')) card.dataset.hero = patch.hero || '';
        if (hasOwn('logo')) card.dataset.logo = patch.logo || '';
        if (hasOwn('iconBase64')) card.dataset.iconBase64 = patch.iconBase64 || '';
        if (hasOwn('trailerSource')) card.dataset.trailerSource = patch.trailerSource || '';
        if (hasOwn('trailerType')) card.dataset.trailerType = patch.trailerType || '';
        if (hasOwn('isAnimated')) card.dataset.isAnimated = String(!!patch.isAnimated);
        if (patch.iconBase64 != null || patch.name != null) {
            _syncFallback(card, card.dataset.iconBase64 || '', patch.name || card.querySelector('.title')?.textContent || '');
        }
        if (patch.shareMode) card.dataset.shareMode = patch.shareMode;
        if (patch.disableGamepadControl != null) card.dataset.disableGamepadControl = String(patch.disableGamepadControl);
        if (patch.mediaHistoryCategory) card.dataset.mediaHistoryCategory = patch.mediaHistoryCategory;
        const img = card.querySelector('img');
        if (img && artworkChanged) {
            const cardSrc = card.classList.contains('featured')
                ? _doorpiFeaturedCardSrc(card)
                : _doorpiRestingCardSrc(card);
            card.classList.toggle('no-art', !cardSrc);
            const fallbackEl = card.querySelector('.media-card-fallback');
            if (fallbackEl) fallbackEl.style.display = cardSrc ? 'none' : '';
            _doorpiSetCardImage(card, cardSrc);
            img.style.display = cardSrc ? '' : 'none';

            // A atualização incremental também precisa iniciar a geração do frame
            // estático. Enquanto ele não existir, artes animadas permanecem ocultas.
            _queueStaticExtraction(card, {
                id,
                vertical: card.dataset.vertical || '',
                horizontal: card.dataset.horizontal || '',
                hero: card.dataset.hero || '',
                logo: card.dataset.logo || '',
                staticVertical: card.dataset.staticVertical || '',
                staticHorizontal: card.dataset.staticHorizontal || '',
                staticHero: card.dataset.staticHero || '',
                staticLogo: card.dataset.staticLogo || ''
            });
        }

        const stage = document.getElementById('homeFeatureStage');
        const cardId = card.dataset.id || card.dataset.gameId || card.dataset.appId || '';
        const isCurrentFeature = stage?.dataset.cardId === cardId
            || document.activeElement === card
            || card.matches(':hover');
        if (artworkChanged && isCurrentFeature) {
            const animateArtwork = document.activeElement === card || card.matches(':hover');
            window.updateHomeFeatureStage?.(card, { animate: animateArtwork });
            const bgSrc = card.dataset.staticVertical || card.dataset.vertical || '';
            const heroSrc = animateArtwork
                ? (card.dataset.hero || card.dataset.staticHero
                    || card.dataset.horizontal || card.dataset.staticHorizontal || bgSrc)
                : (card.dataset.staticHero || card.dataset.hero
                || card.dataset.staticHorizontal || card.dataset.horizontal
                || bgSrc);
            if (typeof switchHeroBackground === 'function') {
                switchHeroBackground(bgSrc, null, heroSrc);
            }
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
