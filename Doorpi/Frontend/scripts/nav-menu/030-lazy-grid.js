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
            card.dataset.path = item.Path || '';
            card.dataset.launchUrl = item.LaunchUrl || '';
            card.dataset.launchCommand = item.LaunchCommand || '';
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
