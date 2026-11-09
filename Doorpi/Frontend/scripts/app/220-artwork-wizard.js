    // ══════════════════════════════════════════════════════════════════════════
    // Edit Modal
    // ══════════════════════════════════════════════════════════════════════════

    let _editCard = null;
    let _editOverlay = null;
    const ARTWORK_CATEGORIES = [
        { key: 'vertical', labelKey: 'artworkCategoryVertical' },
        { key: 'horizontal', labelKey: 'artworkCategoryHorizontal' },
        { key: 'banner', labelKey: 'artworkCategoryBanner' },
        { key: 'logo', labelKey: 'artworkCategoryLogo' }
    ];
    let _artworkWizard = null;

    function artworkLabel(cat) {
        return typeof t === 'function' ? t(cat.labelKey) : cat.key;
    }

    function _artworkPatchFromCategories(images) {
        const patch = {};
        if (images.vertical) {
            patch.vertical = images.vertical;
            patch.staticVertical = '';
        }
        if (images.horizontal) {
            patch.horizontal = images.horizontal;
            patch.staticHorizontal = '';
        }
        if (images.banner) {
            patch.hero = images.banner;
            patch.staticHero = '';
        }
        if (images.logo) {
            patch.logo = images.logo;
            patch.staticLogo = '';
        }
        return patch;
    }

    function openArtworkWizard(card, mode, defaultQuery, options = {}) {
        const requestId = `art_${Date.now()}_${Math.random().toString(16).slice(2)}`;
        const isStore = card.dataset.channel === 'stores' || card.closest('#storesGrid') !== null;
        const isMedia = !isStore && (card.hasAttribute('data-app-id') || card.closest('#mediaGrid') !== null);
        const gameId = card.dataset.gameId || card.dataset.appId || card.dataset.appUrl
            || card.dataset.id || card.dataset.launchUrl || card.dataset.path || '';
        const requestedCategories = Array.isArray(options.categories) ? new Set(options.categories) : null;
        const categories = requestedCategories
            ? ARTWORK_CATEGORIES.filter(cat => requestedCategories.has(cat.key))
            : ARTWORK_CATEGORIES;
        const state = {
            requestId,
            mode,
            card,
            gameId,
            isMedia,
            isStore,
            categories,
            index: 0,
            query: defaultQuery || card.querySelector('.title')?.innerText?.trim() || '',
            selected: {},
            localPreview: {},
            options,
            focusResultsOnLoad: mode === 'steamgrid'
        };

        const overlay = document.createElement('div');
        overlay.className = 'artwork-wizard-overlay';
        overlay.innerHTML = `
            <div class="artwork-wizard" role="dialog" aria-modal="true">
                <div class="artwork-wizard-head">
                    <h3 class="artwork-wizard-title">${t('artworkWizardTitle')}</h3>
                    <div class="artwork-steps"></div>
                </div>
                <div class="artwork-wizard-body">
                    <div class="artwork-status"></div>
                    <div class="artwork-results"></div>
                    <div class="artwork-search-row">
                        <div class="artwork-search-box">
                            <span class="gp-face-btn gp-y artwork-search-badge">Y</span>
                            <input class="edit-modal-input" id="artworkSearchInput" type="text" autocomplete="off" spellcheck="false" data-nav-right="#artworkSearchBtn" />
                        </div>
                        <button class="modal-btn secondary" id="artworkSearchBtn" data-nav-left="#artworkSearchInput">${t('artworkSearch')}</button>
                    </div>
                    <div class="artwork-actions">
                        <button class="modal-btn secondary artwork-action-btn" id="artworkSkipBtn"><span class="gp-face-btn gp-x">X</span><span class="artwork-skip-label">${t('artworkSkip')}</span></button>
                        <button class="modal-btn cancel artwork-action-btn" id="artworkCancelBtn"><span class="gp-face-btn gp-b">B</span><span>${t('btnCancel')}</span></button>
                        <span></span>
                    </div>
                </div>
            </div>`;
        document.body.appendChild(overlay);

        state.overlay = overlay;
        _artworkWizard = state;

        const searchInput = overlay.querySelector('#artworkSearchInput');
        if (searchInput) {
            searchInput._doorpiVkbReturnFocus = searchInput;
            searchInput._doorpiVkbCallbacks = {
                onCancel: () => requestAnimationFrame(() => searchInput.focus({ preventScroll: true })),
                onEnter: () => {
                    overlay.querySelector('#artworkSearchBtn')?.click();
                    requestAnimationFrame(() => searchInput.focus({ preventScroll: true }));
                }
            };
        }

        const renderSteps = () => {
            overlay.querySelector('.artwork-steps').innerHTML = categories.map((cat, i) =>
                `<div class="artwork-step ${i === state.index ? 'active' : ''} ${i < state.index ? 'done' : ''}">${artworkLabel(cat)}</div>`
            ).join('');
        };

        const formatArtworkBytes = value => {
            const bytes = Math.max(0, Number(value) || 0);
            if (bytes < 1024) return `${Math.round(bytes)} B`;
            if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
            return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
        };

        const showProgressPanel = () => {
            state.isApplying = true;
            renderSteps();
            const results = overlay.querySelector('.artwork-results');
            results.className = 'artwork-results is-progress';
            results.innerHTML = `
                <div class="artwork-progress-panel" role="status" aria-live="polite">
                    <div class="artwork-progress-icon is-processing">
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M12 3v12m0 0 4-4m-4 4-4-4"></path>
                            <path d="M5 19h14"></path>
                        </svg>
                    </div>
                    <div class="artwork-progress-title">${t('artworkDownloading')}</div>
                    <div class="artwork-progress-category">${t('artworkStartingDownload')}</div>
                    <div class="artwork-progress-track is-indeterminate">
                        <div class="artwork-progress-fill"></div>
                    </div>
                    <div class="artwork-progress-detail"></div>
                </div>`;
            overlay.querySelector('.artwork-search-row').style.display = 'none';
            overlay.querySelector('.artwork-actions').style.display = 'none';
            overlay.querySelector('.artwork-status').textContent = t('artworkApplying');
        };

        const setProgressComplete = () => {
            const icon = overlay.querySelector('.artwork-progress-icon');
            const title = overlay.querySelector('.artwork-progress-title');
            const category = overlay.querySelector('.artwork-progress-category');
            const track = overlay.querySelector('.artwork-progress-track');
            const fill = overlay.querySelector('.artwork-progress-fill');
            icon?.classList.remove('is-processing');
            icon?.classList.add('is-complete');
            if (icon) {
                icon.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4.5 4.5L19 7"></path></svg>`;
            }
            if (title) title.textContent = t('artworkReady');
            if (category) category.textContent = t('artworkReadyHint');
            track?.classList.remove('is-indeterminate');
            if (fill) fill.style.width = '100%';
            overlay.querySelector('.artwork-progress-detail').textContent = '';
            overlay.querySelector('.artwork-status').textContent = '';
        };

        const finish = () => {
            const images = {};
            for (const cat of categories) {
                if (state.selected[cat.key]) images[cat.key] = state.selected[cat.key];
            }
            if (Object.keys(images).length === 0) {
                close();
                return;
            }
            if (options.clientOnly === true) {
                options.onApplied?.(images);
                close();
                return;
            }
            if (mode === 'steamgrid') showProgressPanel();
            postToHost({
                action: options.applyAction || 'applyArtworkSelection',
                requestId,
                gameId,
                gameName: options.gameName || card.dataset.name
                    || card.querySelector('.title')?.textContent?.trim() || '',
                isMedia,
                isStore,
                localFiles: mode === 'local',
                images
            });
            if (mode !== 'steamgrid')
                overlay.querySelector('.artwork-status').textContent = t('artworkApplying');
        };

        const next = () => {
            state.index += 1;
            if (state.index >= categories.length) {
                finish();
                return;
            }
            render();
        };

        const close = () => {
            if (state.preparationTimer) {
                clearTimeout(state.preparationTimer);
                state.preparationTimer = null;
            }
            overlay.remove();
            if (_artworkWizard === state) _artworkWizard = null;
            if (options.returnFocus?.isConnected)
                requestAnimationFrame(() => options.returnFocus.focus?.({ preventScroll: true }));
        };

        const renderLocal = (cat) => {
            const preview = state.localPreview[cat.key] || '';
            overlay.querySelector('.artwork-results').innerHTML = `
                <div class="artwork-local-panel">
                    <div class="artwork-local-title">${artworkLabel(cat)}</div>
                    <div class="artwork-local-hint">${t('artworkLocalHint')}</div>
                    ${preview ? `<img class="artwork-local-preview" src="${preview}" />` : ''}
                    <div class="artwork-local-controls">
                        <button class="modal-btn secondary artwork-pick-btn" id="artworkPickLocalBtn" data-nav-right="#artworkClearLocalBtn" data-nav-down="#artworkSkipBtn">${t('artworkSelectImage')}</button>
                        ${preview ? `<button class="modal-btn artwork-clear-btn" id="artworkClearLocalBtn" aria-label="${t('artworkClearImage')}" data-nav-left="#artworkPickLocalBtn" data-nav-down="#artworkCancelBtn">X</button>` : ''}
                    </div>
                </div>`;
            overlay.querySelector('#artworkPickLocalBtn')?.addEventListener('click', () => {
                window._doorpiSuppressNativeDialogPointer?.(900);
                postToHost({
                    action: 'pickArtworkImage',
                    requestId,
                    category: cat.key,
                    dialogTitle: t('artworkSelectImage'),
                    dialogFilter: t('artworkImageFilter')
                });
            });
            overlay.querySelector('#artworkClearLocalBtn')?.addEventListener('click', () => {
                delete state.selected[cat.key];
                delete state.localPreview[cat.key];
                render();
            });
        };

        const renderSteamGrid = (cat) => {
            const results = overlay.querySelector('.artwork-results');
            results.innerHTML = '';
            results.scrollTop = 0;
            overlay.querySelector('.artwork-status').textContent = t('artworkSearching', state.query, artworkLabel(cat));
            state.focusResultsOnLoad = true;
            postToHost({ action: 'searchSteamGridArtwork', requestId, query: state.query, category: cat.key });
        };

        const renderUrl = (cat) => {
            overlay.querySelector('.artwork-results').innerHTML = `
                <div class="artwork-local-panel">
                    <div class="artwork-local-title">${artworkLabel(cat)}</div>
                    <div class="artwork-local-hint">${t('historyArtworkUrlHint')}</div>
                    <div class="artwork-url-controls">
                        <input class="edit-modal-input" id="historyArtworkUrlInput" type="url" data-vkb-disabled="true" autocomplete="off" spellcheck="false" />
                        <button class="modal-btn secondary" id="historyArtworkUrlNext">${t('artworkNext')}</button>
                        <div class="artwork-url-actions">
                            <button class="modal-btn secondary" id="historyArtworkUrlPaste" type="button">${t('imageUrlPaste')}</button>
                            <button class="modal-btn secondary" id="historyArtworkUrlBrowser" type="button">${t('imageUrlOpenBrowser')}</button>
                        </div>
                    </div>
                </div>`;
            const input = overlay.querySelector('#historyArtworkUrlInput');
            const applyUrl = () => {
                const value = input?.value?.trim() || '';
                if (!/^https?:\/\//i.test(value)) return;
                state.selected[cat.key] = value;
                next();
            };
            overlay.querySelector('#historyArtworkUrlPaste')?.addEventListener('click', () => {
                postToHost({ action: 'readClipboard' });
            });
            overlay.querySelector('#historyArtworkUrlBrowser')?.addEventListener('click', () => {
                postToHost({ action: 'openImageBrowserCapture', target: 'historyArtwork' });
            });
            overlay.querySelector('#historyArtworkUrlNext')?.addEventListener('click', applyUrl);
            input?.addEventListener('keydown', event => {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                applyUrl();
            });
            requestAnimationFrame(() => input?.focus({ preventScroll: true }));
        };

        const render = () => {
            const cat = categories[state.index];
            renderSteps();
            const results = overlay.querySelector('.artwork-results');
            results.className = mode === 'local' || mode === 'url' ? 'artwork-results is-local' : `artwork-results is-${cat.key}`;
            overlay.querySelector('#artworkSearchInput').value = state.query;
            overlay.querySelector('.artwork-search-row').style.display = mode === 'steamgrid' ? 'grid' : 'none';
            overlay.querySelector('#artworkSkipBtn .artwork-skip-label').textContent = mode === 'local' || mode === 'url'
                ? t('artworkNext')
                : t('artworkSkip');
            overlay.querySelector('.artwork-status').textContent = `${artworkLabel(cat)}`;
            if (mode === 'local') renderLocal(cat);
            else if (mode === 'url') renderUrl(cat);
            else renderSteamGrid(cat);
            if (mode === 'local') {
                const clearBtn = overlay.querySelector('#artworkClearLocalBtn');
                overlay.querySelector('#artworkSkipBtn')?.setAttribute('data-nav-up', '#artworkPickLocalBtn');
                overlay.querySelector('#artworkCancelBtn')?.setAttribute('data-nav-up', clearBtn ? '#artworkClearLocalBtn' : '#artworkPickLocalBtn');
            } else {
                overlay.querySelector('#artworkSkipBtn')?.removeAttribute('data-nav-up');
                overlay.querySelector('#artworkCancelBtn')?.removeAttribute('data-nav-up');
            }
        };

        overlay.querySelector('#artworkSearchBtn').addEventListener('click', () => {
            state.query = overlay.querySelector('#artworkSearchInput').value.trim() || state.query;
            render();
        });
        overlay.querySelector('#artworkSearchInput').addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                e.preventDefault();
                overlay.querySelector('#artworkSearchBtn')?.click();
            }
        });
        overlay.querySelector('#artworkSkipBtn').addEventListener('click', next);
        overlay.querySelector('#artworkCancelBtn').addEventListener('click', () => {
            if (!state.isApplying) close();
        });
        overlay.addEventListener('mousedown', e => {
            if (e.target === overlay && !state.isApplying) close();
        });
        overlay.addEventListener('keydown', e => {
            if (e.key === 'Escape' && !state.isApplying) close();
        });

        state.renderResults = (category, images) => {
            if (!_artworkWizard || _artworkWizard.requestId !== requestId) return;
            const cat = categories[state.index];
            if (!cat || cat.key !== category) return;
            const artworks = (Array.isArray(images) ? images : [])
                .map(image => typeof image === 'string'
                    ? { url: image, thumb: image, animated: false }
                    : {
                        url: image?.Url || image?.url || '',
                        thumb: image?.Thumb || image?.thumb || image?.Url || image?.url || '',
                        animated: image?.IsAnimated === true || image?.isAnimated === true
                    })
                .filter(image => image.url && image.thumb);
            overlay.querySelector('.artwork-status').textContent = artworks.length
                ? t('artworkFound', artworks.length, state.query)
                : t('artworkNoneFound', state.query);
            const results = overlay.querySelector('.artwork-results');
            results.scrollTop = 0;
            results.innerHTML = artworks.map(artwork => {
                const media = artwork.animated
                    ? `<video src="${escapeHtml(artwork.thumb)}" autoplay muted loop playsinline preload="metadata" aria-hidden="true"></video>`
                    : `<img src="${escapeHtml(artwork.thumb)}" loading="lazy" decoding="async" />`;
                return `<button class="artwork-choice ${cat.key}" type="button" data-url="${escapeHtml(artwork.url)}">${media}</button>`;
            }
            ).join('');
            overlay.querySelectorAll('.artwork-choice').forEach(btn => {
                btn.addEventListener('click', () => {
                    state.selected[cat.key] = btn.dataset.url;
                    next();
                });
            });
            if (state.focusResultsOnLoad) {
                state.focusResultsOnLoad = false;
                requestAnimationFrame(() => {
                    const firstChoice = overlay.querySelector('.artwork-choice');
                    if (!firstChoice) {
                        overlay.querySelector('#artworkSearchInput')?.focus({ preventScroll: true });
                        return;
                    }
                    firstChoice.focus({ preventScroll: true });
                    results.scrollTop = 0;
                });
            }
        };

        state.pickLocal = (category, path, preview) => {
            if (!_artworkWizard || _artworkWizard.requestId !== requestId) return;
            state.selected[category] = path;
            state.localPreview[category] = preview;
            render();
        };

        state.downloadProgress = data => {
            if (data?.requestId !== requestId || !state.isApplying) return;
            const categoryKey = String(data.category || '');
            const category = categories.find(item => item.key === categoryKey);
            const received = Math.max(0, Number(data.receivedBytes) || 0);
            const total = Math.max(0, Number(data.totalBytes) || 0);
            const percent = total > 0
                ? Math.max(0, Math.min(100, received / total * 100))
                : null;
            const title = overlay.querySelector('.artwork-progress-title');
            const categoryEl = overlay.querySelector('.artwork-progress-category');
            const track = overlay.querySelector('.artwork-progress-track');
            const fill = overlay.querySelector('.artwork-progress-fill');
            const detail = overlay.querySelector('.artwork-progress-detail');

            if (title) title.textContent = t('artworkDownloading');
            if (categoryEl) {
                categoryEl.textContent = t(
                    'artworkDownloadingCategory',
                    category ? artworkLabel(category) : categoryKey
                );
            }
            track?.classList.toggle('is-indeterminate', percent === null);
            if (fill && percent !== null) fill.style.width = `${percent.toFixed(2)}%`;
            if (detail) {
                detail.textContent = total > 0
                    ? `${formatArtworkBytes(received)} / ${formatArtworkBytes(total)} · ${Math.round(percent)}%`
                    : formatArtworkBytes(received);
            }
        };

        state.applied = (data) => {
            const images = data?.images || data || {};
            if (typeof options.onApplied === 'function') {
                options.onApplied(images || {});
                close();
                return;
            }
            if (state.isApplying && Object.keys(images || {}).length === 0) {
                state.isApplying = false;
                const icon = overlay.querySelector('.artwork-progress-icon');
                icon?.classList.remove('is-processing');
                if (icon) {
                    icon.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17"></path></svg>`;
                }
                overlay.querySelector('.artwork-progress-title').textContent =
                    t('artworkDownloadFailed');
                overlay.querySelector('.artwork-progress-category').textContent =
                    t('artworkDownloadFailedHint');
                overlay.querySelector('.artwork-progress-track').style.display = 'none';
                overlay.querySelector('.artwork-progress-detail').textContent = '';
                const actions = overlay.querySelector('.artwork-actions');
                actions.style.display = 'grid';
                overlay.querySelector('#artworkSkipBtn').style.display = 'none';
                overlay.querySelector('#artworkCancelBtn').style.display = 'inline-flex';
                overlay.querySelector('.artwork-status').textContent = '';
                requestAnimationFrame(() =>
                    overlay.querySelector('#artworkCancelBtn')?.focus({ preventScroll: true }));
                return;
            }
            const patch = _artworkPatchFromCategories(images || {});
            const channel = isStore ? 'stores' : (isMedia ? 'media' : 'games');
            window.AppStore?.mutations?.patchItem(channel, gameId, patch);
            const pending = Array.isArray(data?.pendingStaticTypes)
                ? data.pendingStaticTypes.filter(Boolean)
                : [];
            if (pending.length) {
                state.pendingStaticTypes = new Set(pending);
                const title = overlay.querySelector('.artwork-progress-title');
                const category = overlay.querySelector('.artwork-progress-category');
                const track = overlay.querySelector('.artwork-progress-track');
                if (title) title.textContent = t('artworkPreparing');
                if (category) category.textContent = t('artworkExtractingFrame');
                track?.classList.add('is-indeterminate');
                overlay.querySelector('.artwork-progress-detail').textContent = '';
                overlay.querySelector('.artwork-status').textContent = '';
                return;
            }
            if (state.isApplying) {
                setProgressComplete();
                setTimeout(close, 650);
            } else {
                close();
            }
        };

        state.staticSaved = (data) => {
            if (!state.pendingStaticTypes ||
                String(data?.gameId || '').toLowerCase() !== String(gameId).toLowerCase())
                return;
            state.pendingStaticTypes.delete(data.imageType);
            const detail = overlay.querySelector('.artwork-progress-detail');
            if (detail && state.pendingStaticTypes.size > 0) {
                detail.textContent = t('artworkFramesRemaining', state.pendingStaticTypes.size);
            }
            if (state.pendingStaticTypes.size === 0) {
                setProgressComplete();
                setTimeout(close, 650);
            }
        };

        render();
        requestAnimationFrame(() => {
            const first = mode === 'steamgrid'
                ? overlay.querySelector('.artwork-results')
                : overlay.querySelector('#artworkPickLocalBtn');
            first?.focus?.();
        });
    }

    window._artworkWizardHandleResults = data => _artworkWizard?.renderResults?.(data.category, data.images || []);
    window.openDoorpiArtworkWizard = openArtworkWizard;
    window._artworkWizardHandlePicked = data => _artworkWizard?.pickLocal?.(data.category, data.path, data.preview);
    window._artworkWizardHandleApplied = data => _artworkWizard?.applied?.(data);
    window._artworkWizardHandleDownloadProgress = data => _artworkWizard?.downloadProgress?.(data);
    window._artworkWizardHandleStaticSaved = data => _artworkWizard?.staticSaved?.(data);
    window._artworkWizardIsOpen = () => !!_artworkWizard?.overlay;
    window._artworkWizardHandleClipboard = value => {
        if (!_artworkWizard?.overlay || _artworkWizard.mode !== 'url') return false;
        const input = _artworkWizard.overlay.querySelector('#historyArtworkUrlInput');
        if (!input) return false;
        input.value = String(value || '').trim();
        input.dispatchEvent(new Event('input', { bubbles: true }));
        requestAnimationFrame(() => _artworkWizard?.overlay?.querySelector('#historyArtworkUrlNext')?.focus({ preventScroll: true }));
        return true;
    };
    window._artworkWizardSetUrl = value => window._artworkWizardHandleClipboard?.(value);
    window._artworkWizardFocusUrl = () => {
        const input = _artworkWizard?.overlay?.querySelector('#historyArtworkUrlInput');
        input?.focus?.({ preventScroll: true });
    };
    window._artworkWizardShortcut = action => {
        if (!_artworkWizard?.overlay) return false;
        const overlay = _artworkWizard.overlay;
        if (action === 'confirm') {
            const active = document.activeElement;
            if (!active || !overlay.contains(active)) return false;
            if (active.tagName === 'INPUT' && active.dataset.vkbDisabled !== 'true') window._vkbOpen?.(active);
            else active.click?.();
            return true;
        }
        if (action === 'search') {
            const input = overlay.querySelector('#artworkSearchInput');
            if (!input || input.offsetParent === null) return false;
            input.focus({ preventScroll: true });
            requestAnimationFrame(() => window._vkbOpen?.(input));
            return true;
        }
        if (action === 'skip') {
            overlay.querySelector('#artworkSkipBtn')?.click();
            return true;
        }
        if (action === 'cancel') {
            if (_artworkWizard.isApplying) return true;
            overlay.querySelector('#artworkCancelBtn')?.click();
            return true;
        }
        return false;
    };
    window._artworkWizardClose = () => {
        if (!_artworkWizard?.overlay) return false;
        if (_artworkWizard.isApplying) return true;
        _artworkWizard.overlay.remove();
        _artworkWizard = null;
        return true;
    };

    window.openDoorpiHistoryArtworkPicker = function (card, item, onApplied) {
        if (!card || !item?.Name) return;
        const overlay = document.createElement('div');
        overlay.className = 'artwork-wizard-overlay';
        overlay.innerHTML = `
            <div class="artwork-wizard history-artwork-source-dialog" role="dialog" aria-modal="true">
                <div class="artwork-wizard-head">
                    <h3 class="artwork-wizard-title">${t('historyArtworkTitle')}</h3>
                    <p class="history-artwork-source-subtitle">${t('historyArtworkSourceHint')}</p>
                </div>
                <div class="artwork-wizard-body">
                    <div class="history-artwork-source-grid">
                        <button class="history-artwork-source-card" id="historyArtworkSteamGrid" type="button" ${window._doorpiProfile?.HasSteamGridApiKey ? '' : 'disabled'}>
                            <strong>SteamGrid</strong>
                            <span>${t('historyArtworkSteamGridDesc')}</span>
                        </button>
                        <button class="history-artwork-source-card" id="historyArtworkUrl" type="button">
                            <strong>${t('profilePhotoExternalUrl')}</strong>
                            <span>${t('historyArtworkUrlDesc')}</span>
                        </button>
                    </div>
                    ${window._doorpiProfile?.HasSteamGridApiKey ? '' : `<p class="history-artwork-source-key-hint">${t('profilePhotoSteamGridNeedsKey')}</p>`}
                    <div class="history-artwork-source-actions"><button class="modal-btn cancel" id="artworkCancelBtn">${t('btnCancel')}</button></div>
                </div>
            </div>`;
        document.body.appendChild(overlay);
        const closeSource = (restoreFocus = true) => {
            overlay.remove();
            if (_artworkWizard?.overlay === overlay) _artworkWizard = null;
            if (restoreFocus && card.isConnected)
                requestAnimationFrame(() => card.focus?.({ preventScroll: true }));
        };
        const openMode = mode => {
            closeSource(false);
            openArtworkWizard(card, mode, item.Name, {
                categories: ['vertical', 'horizontal', 'banner'],
                applyAction: 'applyHistoryArtworkSelection',
                gameName: item.Name,
                returnFocus: card,
                onApplied
            });
        };
        _artworkWizard = { overlay, sourceOnly: true };
        overlay.querySelector('#historyArtworkSteamGrid')?.addEventListener('click', () => openMode('steamgrid'));
        overlay.querySelector('#historyArtworkUrl')?.addEventListener('click', () => openMode('url'));
        overlay.querySelector('#artworkCancelBtn')?.addEventListener('click', () => closeSource(true));
        overlay.addEventListener('mousedown', event => { if (event.target === overlay) closeSource(); });
        requestAnimationFrame(() => overlay.querySelector('button:not(:disabled)')?.focus({ preventScroll: true }));
    };

