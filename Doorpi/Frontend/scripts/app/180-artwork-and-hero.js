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
                    postToHost({
                        action: 'saveStaticFrame',
                        gameId: entityId,
                        imageType,
                        sourceUrl: src,
                        base64: c.toDataURL('image/png')
                    });
                } catch { card.dataset[dsKey] = src; }
                finally { URL.revokeObjectURL(blobUrl); resolve(); }
            };
            tmp.onerror = () => { card.dataset[dsKey] = src; URL.revokeObjectURL(blobUrl); resolve(); };
            tmp.src = blobUrl;
        });
    }

    window.requestStaticFrameExtraction = async function ({ gameId, entityId, src, imageType }) {
        const id = entityId || gameId;
        if (!id || !src || !imageType) return false;

        const blob = await getAnimatedBlob(src);
        if (!blob) return false;

        return new Promise(resolve => {
            const tmp = new Image();
            const blobUrl = URL.createObjectURL(blob);
            let settled = false;

            const finish = (ok) => {
                if (settled) return;
                settled = true;
                URL.revokeObjectURL(blobUrl);
                resolve(!!ok);
            };

            tmp.onload = () => {
                try {
                    const c = document.createElement('canvas');
                    c.width = tmp.naturalWidth;
                    c.height = tmp.naturalHeight;
                    c.getContext('2d').drawImage(tmp, 0, 0);
                    postToHost({
                        action: 'saveStaticFrame',
                        gameId: id,
                        imageType,
                        sourceUrl: src,
                        base64: c.toDataURL('image/png')
                    });
                    finish(true);
                } catch (_) {
                    finish(false);
                }
            };
            tmp.onerror = () => finish(false);
            tmp.src = blobUrl;
        });
    };


    function moveCardToTop(card) {
        if (!card) return;
        const grid = card.closest('#gameGrid') || card.closest('#mediaGrid') || document.getElementById('gameGrid');

        grid.querySelectorAll('.card.featured').forEach(c => {
            if (c === card) return;
            c.classList.remove('featured');
            const img = c.querySelector('img');
            if (img) {
                const src = c.dataset.staticVertical || (c.dataset.isAnimated !== 'true' ? c.dataset.vertical : '');
                if (src) img.src = src;
            }
        });

        card.classList.add('featured');
        grid.prepend(card);

        const img = card.querySelector('img');
        if (img) {
            img.src = card.dataset.staticVertical || card.dataset.vertical || card.dataset.staticHorizontal || card.dataset.horizontal || '';
        }
        window.syncFeaturedCardArt?.(grid);

        grid.scrollTo({ left: 0, behavior: 'smooth' });
    }

    /* Seção: Hero background */
    let _heroTimer = null;
    let _currentBgSrc = '';
    let _heroReqId = 0;

    function cancelHeroTransition() {
        if (_heroTimer) { clearTimeout(_heroTimer); _heroTimer = null; }

        document.querySelectorAll('.crossfade-clone-heroImage, .crossfade-clone-gridBgImg').forEach(c => {
            c.style.setProperty('transition', 'opacity 0.2s ease-out', 'important');
            c.style.opacity = '0';
            setTimeout(() => { if (c.parentNode) c.remove(); }, 200);
        });
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
        if (window._userSwitching) return;


        const currentTab = (typeof window.getCurrentHomeTab === 'function') ? window.getCurrentHomeTab() : 'games';
        const gridId = currentTab === 'media' ? 'mediaGrid' : (currentTab === 'stores' ? 'storesGrid' : 'gameGrid');
        const grid = document.getElementById(gridId);

        if (grid && !grid.querySelector('.card:not(.add-card)')) {
            if (typeof clearHero === 'function') clearHero(true);
            return;
        }

        // ── CORREÇÃO: SE NÃO TEM HERO, LIMPA O FUNDO PRO BLOB ASSUMIR ──
        if (!bgSrc) {
            if (typeof clearHero === 'function') clearHero();
            return;
        }
        // ───────────────────────────────────────────────────────────────

        if (window._heroCleanupTimer) {
            clearTimeout(window._heroCleanupTimer);
            window._heroCleanupTimer = null;
        }
        const heroImg = document.getElementById('heroImage');
        const logoImg = document.getElementById('gameLogo');
        const gridBg = document.getElementById('gridBgImg');
        const bgBlur = document.getElementById('bgBlur');

        if (!bgSrc) return;

        const comparableSrc = value => {
            if (!value) return '';
            try { return new URL(value, window.location.href).href.split('?')[0]; }
            catch { return String(value).split('?')[0]; }
        };
        const requestedHeroSrc = heroSrc || bgSrc;
        const currentHeroSrc = heroImg?.getAttribute('src') || '';
        if (comparableSrc(_currentBgSrc) === comparableSrc(bgSrc)
            && comparableSrc(currentHeroSrc) === comparableSrc(requestedHeroSrc)) {
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


    // Para aplicar, você pode inserir dinamicamente:
