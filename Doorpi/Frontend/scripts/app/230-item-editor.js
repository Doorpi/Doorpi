    function openEditGameModal(card) {
        ensureDoorpiOverlayStyles();
        window.stopHomeFeatureTrailer?.();

        const currentName = card.querySelector('.title')?.innerText?.trim() ||
            card.querySelector('.nav-vertical-card-title')?.innerText?.trim() || '';
        _editCard = card;

        const gameId = card.dataset.gameId || card.dataset.appId || card.dataset.appUrl;

        // 🔹 DETECÇÃO INFALÍVEL DE MÍDIA PARA TÍTULOS DINÂMICOS 🔹
        const isStoreCard = card.dataset.channel === 'stores' || card.closest('#storesGrid') !== null;
        const isMediaTabActive = typeof window.getCurrentHomeTab === 'function' && window.getCurrentHomeTab() === 'media';
        const isMediaCard = !isStoreCard && (card.hasAttribute('data-app-id') ||
            card.closest('#mediaGrid') !== null ||
            isMediaTabActive);

        // Textos Dinâmicos Baseados no Tipo
        const modalTitle = isStoreCard
            ? (typeof t === 'function' ? t('editStoreTitle', 'Editar Loja') : 'Editar Loja')
            : isMediaCard
            ? (typeof t === 'function' ? t('editAppTitle', 'Editar App') : 'Editar App')
            : (typeof t === 'function' ? t('editGameTitle', 'Editar Jogo') : 'Editar Jogo');

        const modalSubtitle = isStoreCard
            ? (typeof t === 'function' ? t('editStoreSubtitle', 'Altere apenas as artes desta loja.') : 'Altere apenas as artes desta loja.')
            : isMediaCard
            ? (typeof t === 'function' ? t('editAppSubtitle', 'Ajuste os detalhes deste aplicativo.') : 'Ajuste os detalhes deste aplicativo.')
            : (typeof t === 'function' ? t('editGameSubtitle', 'Ajuste os detalhes deste jogo.') : 'Ajuste os detalhes deste jogo.');


        const appType = card.dataset.appType || 'browser';
        const normalizedAppType = appType.toLowerCase();
        const canManageBrowser = isMediaCard && appType !== 'browser' ? false : (isMediaCard && appType !== 'exe');
        const canManageSharing = isMediaCard && ['browser', 'webview'].includes(normalizedAppType);
        const isSharedFromOther = card.dataset.sharedFromOther === 'true';

        const isExeApp = isMediaCard && normalizedAppType === 'exe';
        const isWebApp = isMediaCard && ['browser', 'webview'].includes(normalizedAppType);
        const libraryChannel = isMediaCard ? 'media' : 'games';
        const libraryItemId = isMediaCard ? (card.dataset.appId || gameId || '') : (card.dataset.id || gameId || '');
        const canConfigureMediaHistory = isWebApp && !isSharedFromOther &&
            String(libraryItemId || '').toLowerCase() !== 'doorpi-browser';
        const libraryItem = !isStoreCard
            ? window.AppStore?.queries?.getItem?.(libraryChannel, libraryItemId)
            : null;
        const canEditLaunchCommand = !isStoreCard && (!isMediaCard || isExeApp);
        const canEditWebUrl = isWebApp && !isSharedFromOther;
        const canEditLaunchTarget = canEditLaunchCommand || canEditWebUrl;
        const defaultLaunchTarget = isMediaCard
            ? (libraryItem?.url || card.dataset.appUrl || '')
            : (libraryItem?.launchUrl || card.dataset.launchUrl || libraryItem?.path || card.dataset.path || gameId || '');
        const currentLaunchTarget = canEditLaunchTarget
            ? (canEditWebUrl ? defaultLaunchTarget : (libraryItem?.launchCommand || card.dataset.launchCommand || defaultLaunchTarget))
            : '';
        const storeIdForSettings = isStoreCard ? (card.dataset.appId || card.dataset.id || card.dataset.appUrl || '') : '';
        if (isStoreCard && typeof postToHost === 'function' && !window._storeAutoAddSettings) {
            postToHost({ action: 'requestStoreAutoAddSettings' });
        }
        const storeAutoAddSettings = window._storeAutoAddSettings || {};
        const storeAutoAdd = isStoreCard
            ? (Object.prototype.hasOwnProperty.call(storeAutoAddSettings, storeIdForSettings) ? !!storeAutoAddSettings[storeIdForSettings] : true)
            : false;
        const contextArt = card.dataset.staticVertical || card.dataset.vertical || '';
        const currentTrailerSource = libraryItem?.trailerSource || card.dataset.trailerSource || '';
        const currentTrailerType = libraryItem?.trailerType || card.dataset.trailerType || '';
        let pendingTrailerSource = currentTrailerSource;
        let pendingTrailerType = currentTrailerType;
        const validMediaHistoryCategories = new Set(['auto', 'music', 'video-live', 'film-series', 'disabled']);
        const storedMediaHistoryCategory = libraryItem?.mediaHistoryCategory || card.dataset.mediaHistoryCategory || 'auto';
        const currentMediaHistoryCategory = validMediaHistoryCategories.has(storedMediaHistoryCategory)
            ? storedMediaHistoryCategory
            : 'auto';
        let pendingMediaHistoryCategory = currentMediaHistoryCategory;

        const sharedWithNames = (() => {
            try { return JSON.parse(card.dataset.sharedWithUserNames || '[]'); } catch { return []; }
        })();
        const shareSummary = isSharedFromOther
            ? (typeof t === 'function' ? t('sharedByInfo', escapeHtml(card.dataset.sharedFromName || 'outro')) : `Compartilhado por ${escapeHtml(card.dataset.sharedFromName || 'outro')}`)
            : (card.dataset.shareMode === 'all'
                ? (typeof t === 'function' ? t('shareModeAll') : 'Público')
                : (card.dataset.shareMode === 'user' && sharedWithNames.length ? sharedWithNames.join(', ') : (typeof t === 'function' ? t('shareModePrivate') : 'Separado por usuário')));

        // ── Geração dos novos Botões em Grid ──
        const svgShare = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 10.6l6.8-4.2M8.6 13.4l6.8 4.2"/></svg>`;
        const svgExt = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`;

        const sharingBtnHtml = canManageSharing ? `
            <button class="edit-shortcut-card" id="editSharingBtn" type="button" tabindex="0">
                <div class="edit-shortcut-icon">${svgShare}</div>
                <div class="edit-shortcut-info">
                    <h4>${typeof t === 'function' ? t('accountSharingLabel', 'Contas e Acesso') : 'Contas e Acesso'}</h4>
                    <p>${escapeHtml(shareSummary)}</p>
                </div>
            </button>
        ` : '';

        const extensionsBtnHtml = canManageBrowser ? `
            <button class="edit-shortcut-card" id="editExtensionsBtn" type="button" tabindex="0">
                <div class="edit-shortcut-icon">${svgExt}</div>
                <div class="edit-shortcut-info">
                    <h4>${typeof t === 'function' ? t('manageExtensions', 'Extensões') : 'Extensões'}</h4>
                    <p>${typeof t === 'function' ? t('manageExtensionsDesc', 'Gerenciar plugins nativos') : 'Gerenciar plugins nativos'}</p>
                </div>
            </button>
        ` : '';

        const mediaExtras = (canManageSharing || canManageBrowser) ? `
            <div class="edit-modal-field" style="margin-top: 8px;">
                <label class="edit-modal-label">${typeof t === 'function' ? t('editShortcutsLabel', 'Atalhos do Sistema') : 'Atalhos do Sistema'}</label>
                <div class="edit-shortcuts-grid">
                    ${sharingBtnHtml}
                    ${extensionsBtnHtml}
                </div>
            </div>
        ` : '';

        const trailerHtml = !isStoreCard && !isMediaCard ? `
            <div class="edit-modal-field edit-trailer-field">
                <label class="edit-modal-label">TRAILER</label>
                <div class="edit-trailer-summary" id="editTrailerSummary">
                    <span class="edit-trailer-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m10 9 5 3-5 3V9Z" fill="currentColor" stroke="none"/></svg>
                    </span>
                    <span><strong id="editTrailerStatus"></strong><small id="editTrailerHint"></small></span>
                </div>
                <div class="edit-trailer-url-row" id="editTrailerUrlRow" hidden>
                    <input class="edit-modal-input" id="editTrailerUrlInput" type="url" autocomplete="off" spellcheck="false" placeholder="https://youtube.com/watch?v=..." tabindex="0" />
                </div>
                <div class="edit-artwork-actions edit-trailer-actions">
                    <button class="edit-artwork-btn is-primary" id="editTrailerSearchBtn" type="button" tabindex="0" data-nav-down="#editTrailerLocalBtn">Selecionar trailer</button>
                    <button class="edit-artwork-btn" id="editTrailerLocalBtn" type="button" tabindex="0" data-nav-up="#editTrailerSearchBtn" data-nav-right="#editTrailerUrlBtn" data-nav-down="#editCancelBtn">Vídeo local</button>
                    <button class="edit-artwork-btn" id="editTrailerUrlBtn" type="button" tabindex="0" data-nav-up="#editTrailerSearchBtn" data-nav-left="#editTrailerLocalBtn" data-nav-right="#editTrailerRemoveBtn" data-nav-down="#editCancelBtn">Usar URL</button>
                    <button class="edit-artwork-btn is-danger" id="editTrailerRemoveBtn" type="button" tabindex="0" data-nav-up="#editTrailerSearchBtn" data-nav-left="#editTrailerUrlBtn" data-nav-down="#editSaveBtn">Remover</button>
                </div>
                <span class="edit-modal-input-hint">O trailer começa automaticamente após um breve foco. Arquivos locais funcionam offline.</span>
            </div>` : '';

        const overlay = document.createElement('div');
        overlay.className = 'edit-modal-overlay';
        _editOverlay = overlay;

        overlay.innerHTML = `
            <div class="edit-modal" role="dialog" aria-modal="true" aria-label="${modalTitle}">
                <div class="edit-modal-header">
                    ${contextArt ? `<div class="edit-modal-context-art" aria-hidden="true"><img src="${escapeHtml(contextArt)}" /></div>` : ''}
                    <div>
                        <h3 class="edit-modal-title">${modalTitle}</h3>
                        <p class="edit-modal-subtitle">${modalSubtitle}</p>
                    </div>
                </div>
                <div class="edit-modal-body">
                    <div class="edit-modal-field">
                        <label class="edit-modal-label" for="editNameInput">
                            ${typeof t === 'function' ? t('editModalFieldName', 'NOME NA BIBLIOTECA') : 'NOME NA BIBLIOTECA'}
                        </label>
                        <input class="edit-modal-input" id="editNameInput" type="text" autocomplete="off" spellcheck="false" />
                        <span class="edit-modal-input-hint">
                            ${typeof t === 'function' ? t('editModalHint', 'Pressione enter para alterar') : 'Pressione enter para alterar'}
                        </span>
                    </div>
                    ${canEditLaunchTarget ? `
                    <div class="edit-modal-field">
                        <label class="edit-modal-label" for="editLaunchCommandInput">
                            ${canEditWebUrl
                                ? (typeof t === 'function' ? t('editWebAppUrlLabel', 'URL DO SITE') : 'URL DO SITE')
                                : (typeof t === 'function' ? t('editLaunchCommandLabel', 'CAMINHO') : 'CAMINHO')}
                        </label>
                        <div class="edit-command-row">
                            <input class="edit-modal-input" id="editLaunchCommandInput" type="text" autocomplete="off" spellcheck="false" tabindex="0" ${canEditWebUrl ? '' : 'data-nav-right="#editBrowseLaunchCommandBtn"'} />
                            ${canEditWebUrl ? '' : `
                            <button class="modal-btn secondary edit-command-browse" id="editBrowseLaunchCommandBtn" type="button" tabindex="0" data-nav-left="#editLaunchCommandInput">
                                ${typeof t === 'function' ? t('editLaunchCommandBrowse', 'Alterar') : 'Alterar'}
                            </button>`}
                        </div>
                    </div>` : ''}
                    ${canConfigureMediaHistory ? `
                    <div class="edit-modal-field">
                        <label class="edit-modal-label">${typeof t === 'function' ? t('mediaHistoryCategoryLabel', 'CATEGORIA') : 'CATEGORIA'}</label>
                        <div class="edit-category-options" role="radiogroup" aria-label="${typeof t === 'function' ? t('mediaHistoryCategoryLabel', 'Categoria') : 'Categoria'}">
                            <button class="edit-category-option ${pendingMediaHistoryCategory === 'auto' ? 'active' : ''}" id="editCategoryAutoBtn" type="button" role="radio" aria-checked="${pendingMediaHistoryCategory === 'auto'}" data-media-history-category="auto" data-nav-right="#editCategoryMusicBtn" data-nav-down="#editCategoryVideoLiveBtn" tabindex="0">
                                <strong>${typeof t === 'function' ? t('mediaHistoryCategoryAuto', 'Automático') : 'Automático'}</strong>
                                <small>${typeof t === 'function' ? t('mediaHistoryCategoryAutoHint', 'Usa os metadados fornecidos pelo site.') : 'Usa os metadados fornecidos pelo site.'}</small>
                            </button>
                            <button class="edit-category-option ${pendingMediaHistoryCategory === 'music' ? 'active' : ''}" id="editCategoryMusicBtn" type="button" role="radio" aria-checked="${pendingMediaHistoryCategory === 'music'}" data-media-history-category="music" data-nav-left="#editCategoryAutoBtn" data-nav-down="#editCategoryFilmSeriesBtn" tabindex="0">
                                <strong>${typeof t === 'function' ? t('mediaHistoryCategoryMusic', 'Música') : 'Música'}</strong>
                                <small>${typeof t === 'function' ? t('mediaHistoryCategoryMusicHint', 'Faixas, artistas e álbuns.') : 'Faixas, artistas e álbuns.'}</small>
                            </button>
                            <button class="edit-category-option ${pendingMediaHistoryCategory === 'video-live' ? 'active' : ''}" id="editCategoryVideoLiveBtn" type="button" role="radio" aria-checked="${pendingMediaHistoryCategory === 'video-live'}" data-media-history-category="video-live" data-nav-up="#editCategoryAutoBtn" data-nav-right="#editCategoryFilmSeriesBtn" data-nav-down="#editCategoryDisabledBtn" tabindex="0">
                                <strong>${typeof t === 'function' ? t('mediaHistoryCategoryVideoLive', 'Vídeos / Live') : 'Vídeos / Live'}</strong>
                                <small>${typeof t === 'function' ? t('mediaHistoryCategoryVideoLiveHint', 'Canais, criadores e transmissões.') : 'Canais, criadores e transmissões.'}</small>
                            </button>
                            <button class="edit-category-option ${pendingMediaHistoryCategory === 'film-series' ? 'active' : ''}" id="editCategoryFilmSeriesBtn" type="button" role="radio" aria-checked="${pendingMediaHistoryCategory === 'film-series'}" data-media-history-category="film-series" data-nav-up="#editCategoryMusicBtn" data-nav-left="#editCategoryVideoLiveBtn" data-nav-down="#editCategoryDisabledBtn" tabindex="0">
                                <strong>${typeof t === 'function' ? t('mediaHistoryCategoryFilmSeries', 'Filmes e séries') : 'Filmes e séries'}</strong>
                                <small>${typeof t === 'function' ? t('mediaHistoryCategoryFilmSeriesHint', 'Filmes, séries e episódios.') : 'Filmes, séries e episódios.'}</small>
                            </button>
                            <button class="edit-category-option ${pendingMediaHistoryCategory === 'disabled' ? 'active' : ''}" id="editCategoryDisabledBtn" type="button" role="radio" aria-checked="${pendingMediaHistoryCategory === 'disabled'}" data-media-history-category="disabled" data-nav-up="#editCategoryFilmSeriesBtn" data-nav-down="#editArtworkLocalBtn" tabindex="0">
                                <strong>${typeof t === 'function' ? t('mediaHistoryCategoryDisabled', 'Desativar histórico') : 'Desativar histórico'}</strong>
                                <small>${typeof t === 'function' ? t('mediaHistoryCategoryDisabledHint', 'Não registra novas atividades deste app.') : 'Não registra novas atividades deste app.'}</small>
                            </button>
                        </div>
                    </div>` : ''}
                    <div class="edit-modal-field">
                        <label class="edit-modal-label">${t('artworkWizardTitle')}</label>
                        <div class="edit-artwork-actions">
                            <button class="edit-artwork-btn" id="editArtworkSteamGridBtn" type="button" data-nav-up="${canConfigureMediaHistory ? '#editCategoryDisabledBtn' : ''}" tabindex="0">SteamGrid</button>
                            <button class="edit-artwork-btn" id="editArtworkLocalBtn" type="button" data-nav-up="${canConfigureMediaHistory ? '#editCategoryDisabledBtn' : ''}" tabindex="0">${t('artworkChooseComputer')}</button>
                        </div>
                    </div>
                    ${trailerHtml}
                    ${mediaExtras}
                    ${isStoreCard ? `
                    <div class="edit-modal-field" style="margin-top: 8px;">
                        <label class="edit-modal-label">${typeof t === 'function' ? t('storeAutoAddTitle', 'BIBLIOTECA') : 'BIBLIOTECA'}</label>
                        <label class="edit-toggle-row" tabindex="0">
                            <span class="edit-toggle-switch">
                                <input type="checkbox" id="editStoreAutoAdd" tabindex="-1" ${storeAutoAdd ? 'checked' : ''} />
                                <span class="edit-toggle-slider"></span>
                            </span>
                            <span class="edit-toggle-label">${typeof t === 'function' ? t('editStoreAutoAddLabel', 'Adicionar jogos automaticamente') : 'Adicionar jogos automaticamente'}</span>
                        </label>
                        <span class="edit-modal-input-hint">${typeof t === 'function' ? t('editStoreAutoAddHint', 'Jogos novos instalados por esta loja entram na biblioteca ao fechar a loja.') : 'Jogos novos instalados por esta loja entram na biblioteca ao fechar a loja.'}</span>
                    </div>` : ''}
                </div>
                <div class="edit-modal-actions">
                    <button class="modal-btn cancel" id="editCancelBtn" data-nav-up="#editTrailerLocalBtn" data-nav-right="#editSaveBtn">${typeof t === 'function' ? t('editModalCancel', 'Cancelar') : 'Cancelar'}</button>
                    <button class="modal-btn primary" id="editSaveBtn" data-nav-up="#editTrailerRemoveBtn" data-nav-left="#editCancelBtn">${typeof t === 'function' ? t('editModalSave', 'Salvar') : 'Salvar'}</button>
                </div>  
            </div>
        `;
        document.body.appendChild(overlay);

        const input = overlay.querySelector('#editNameInput');
        input.value = currentName;
        const commandInput = overlay.querySelector('#editLaunchCommandInput');
        if (commandInput) commandInput.value = currentLaunchTarget;
        if (isStoreCard) {
            input.disabled = true;
            input.setAttribute('aria-readonly', 'true');
            const hint = overlay.querySelector('.edit-modal-input-hint');
            if (hint) hint.textContent = typeof t === 'function' ? t('editStoreNameLocked', 'O nome da loja é fixo.') : 'O nome da loja é fixo.';
        }

        const doClose = () => {
            isEditModalOpen = false;
            window._editLaunchCommandBrowseResult = null;
            window._editTrailerBrowseResult = null;
            window._editTrailerBrowserUrlResult = null;
            window._vkbForceClose();
            overlay.style.opacity = '0';
            overlay.style.transition = 'opacity 0.12s';
            setTimeout(() => { overlay.remove(); _editOverlay = null; }, 130);
            window.focusFeaturedCard?.();
        };

        overlay.querySelector('#editExtensionsBtn')?.addEventListener('click', () => {
            doClose();
            window.openExtensionsManager?.();
        });

        overlay.querySelector('#editSharingBtn')?.addEventListener('click', () => {
            const appId = card.dataset.appId || card.dataset.gameId || '';
            doClose();
            window._navMenuOpenAccountSharing?.(appId);
        });

        overlay.querySelector('#editArtworkSteamGridBtn')?.addEventListener('click', () => {
            openArtworkWizard(card, 'steamgrid', card.dataset.assetQuery || input.value.trim() || currentName);
        });

        overlay.querySelector('#editArtworkLocalBtn')?.addEventListener('click', () => {
            openArtworkWizard(card, 'local', card.dataset.assetQuery || input.value.trim() || currentName);
        });

        const trailerStatus = overlay.querySelector('#editTrailerStatus');
        const trailerHint = overlay.querySelector('#editTrailerHint');
        const trailerUrlRow = overlay.querySelector('#editTrailerUrlRow');
        const trailerUrlInput = overlay.querySelector('#editTrailerUrlInput');
        const trailerRemoveBtn = overlay.querySelector('#editTrailerRemoveBtn');
        const trailerDisplayName = source => {
            if (!source) return 'Nenhum trailer';
            if (pendingTrailerType === 'local') {
                if (source.startsWith('https://data.local/')) return 'Vídeo local';
                try { return decodeURIComponent(source.split(/[\\/]/).pop() || 'Vídeo local'); }
                catch { return 'Vídeo local'; }
            }
            try { return new URL(source).hostname.replace(/^www\./, ''); }
            catch { return 'Trailer online'; }
        };
        const refreshTrailerSummary = () => {
            if (!trailerStatus) return;
            trailerStatus.textContent = trailerDisplayName(pendingTrailerSource);
            if (trailerHint) trailerHint.textContent = pendingTrailerSource
                ? (pendingTrailerType === 'local' ? 'Salvo no dispositivo' : 'Requer conexão com a internet')
                : 'Adicione um vídeo local ou uma URL do YouTube';
            if (trailerRemoveBtn) trailerRemoveBtn.disabled = !pendingTrailerSource;
        };

        if (trailerUrlInput && pendingTrailerSource && pendingTrailerType !== 'local') {
            trailerUrlInput.value = pendingTrailerSource;
            trailerUrlRow.hidden = false;
        }

        const refreshMediaHistoryCategory = () => {
            overlay.querySelectorAll('[data-media-history-category]').forEach(button => {
                const active = button.dataset.mediaHistoryCategory === pendingMediaHistoryCategory;
                button.classList.toggle('active', active);
                button.setAttribute('aria-checked', String(active));
            });
        };
        overlay.querySelectorAll('[data-media-history-category]').forEach(button => {
            button.addEventListener('click', () => {
                pendingMediaHistoryCategory = button.dataset.mediaHistoryCategory || 'auto';
                refreshMediaHistoryCategory();
                button.focus({ preventScroll: true });
            });
        });
        refreshTrailerSummary();

        window._editTrailerBrowseResult = path => {
            if (!path || !document.body.contains(overlay)) return;
            pendingTrailerSource = path;
            pendingTrailerType = 'local';
            if (trailerUrlInput) trailerUrlInput.value = '';
            if (trailerUrlRow) trailerUrlRow.hidden = true;
            refreshTrailerSummary();
            overlay.querySelector('#editTrailerLocalBtn')?.focus({ preventScroll: true });
        };

        window._editTrailerBrowserUrlResult = url => {
            if (!url || !document.body.contains(overlay)) return;
            pendingTrailerSource = url;
            pendingTrailerType = 'url';
            if (trailerUrlInput) trailerUrlInput.value = url;
            if (trailerUrlRow) trailerUrlRow.hidden = false;
            refreshTrailerSummary();
            setTimeout(() => overlay.querySelector('#editTrailerSearchBtn')?.focus({ preventScroll: true }), 180);
        };

        overlay.querySelector('#editTrailerLocalBtn')?.addEventListener('click', () => {
            postToHost({
                action: 'browseGameTrailer',
                dialogTitle: 'Selecionar trailer',
                initialPath: pendingTrailerType === 'local' && !pendingTrailerSource.startsWith('https://data.local/')
                    ? pendingTrailerSource
                    : ''
            });
        });

        overlay.querySelector('#editTrailerUrlBtn')?.addEventListener('click', () => {
            if (!trailerUrlRow || !trailerUrlInput) return;
            trailerUrlRow.hidden = false;
            if (pendingTrailerType !== 'local') trailerUrlInput.value = pendingTrailerSource;
            requestAnimationFrame(() => trailerUrlInput.focus({ preventScroll: true }));
        });

        trailerUrlInput?.addEventListener('input', () => {
            pendingTrailerSource = trailerUrlInput.value.trim();
            pendingTrailerType = pendingTrailerSource ? 'url' : '';
            refreshTrailerSummary();
        });

        overlay.querySelector('#editTrailerSearchBtn')?.addEventListener('click', () => {
            const query = encodeURIComponent(`${input.value.trim() || currentName} trailer oficial`);
            postToHost({ action: 'openTrailerBrowserCapture', url: `https://www.youtube.com/results?search_query=${query}` });
        });

        trailerRemoveBtn?.addEventListener('click', () => {
            pendingTrailerSource = '';
            pendingTrailerType = '';
            if (trailerUrlInput) trailerUrlInput.value = '';
            if (trailerUrlRow) trailerUrlRow.hidden = true;
            refreshTrailerSummary();
        });

        window._editLaunchCommandBrowseResult = (path) => {
            if (!path || !commandInput || !document.body.contains(overlay)) return;
            commandInput.value = path;
            commandInput.dispatchEvent(new Event('input', { bubbles: true }));
            commandInput.focus({ preventScroll: true });
        };

        overlay.querySelector('#editBrowseLaunchCommandBtn')?.addEventListener('click', () => {
            postToHost({
                action: 'browseEditLaunchCommand',
                dialogTitle: typeof t === 'function' ? t('editLaunchCommandDialogTitle', 'Selecionar programa ou atalho') : 'Selecionar programa ou atalho',
                initialPath: commandInput?.value?.trim() || currentLaunchTarget
            });
        });

        const doSave = () => {
            const newName = input.value.trim();
            const nameChanged = newName && newName !== currentName;
            let newLaunchTarget = commandInput?.value?.trim() || '';
            if (canEditWebUrl && newLaunchTarget && !/^https?:\/\//i.test(newLaunchTarget))
                newLaunchTarget = `https://${newLaunchTarget}`;

            if (canEditWebUrl) {
                let validWebUrl = false;
                try {
                    const parsedUrl = new URL(newLaunchTarget);
                    validWebUrl = ['http:', 'https:'].includes(parsedUrl.protocol) && !!parsedUrl.hostname;
                } catch { }
                if (!validWebUrl) {
                    commandInput?.classList.add('error');
                    commandInput?.focus({ preventScroll: true });
                    return;
                }
            }

            const launchCommandChanged = canEditLaunchCommand && !!newLaunchTarget && newLaunchTarget !== currentLaunchTarget;
            const webUrlChanged = canEditWebUrl && newLaunchTarget !== currentLaunchTarget;
            if (pendingTrailerType === 'url' && pendingTrailerSource && !/^https?:\/\//i.test(pendingTrailerSource))
                pendingTrailerSource = `https://${pendingTrailerSource}`;
            if (pendingTrailerType === 'url' && pendingTrailerSource) {
                try {
                    const trailerUrl = new URL(pendingTrailerSource);
                    if (!['http:', 'https:'].includes(trailerUrl.protocol) || !trailerUrl.hostname) throw new Error('invalid');
                } catch {
                    trailerUrlInput?.classList.add('error');
                    trailerUrlInput?.focus({ preventScroll: true });
                    return;
                }
            }
            const trailerChanged = !isStoreCard && !isMediaCard &&
                (pendingTrailerSource !== currentTrailerSource || pendingTrailerType !== currentTrailerType);
            const mediaHistoryCategoryChanged = canConfigureMediaHistory &&
                pendingMediaHistoryCategory !== currentMediaHistoryCategory;

            const storeAutoAddCheckbox = overlay.querySelector('#editStoreAutoAdd');
            const newStoreAutoAdd = storeAutoAddCheckbox ? storeAutoAddCheckbox.checked : storeAutoAdd;
            const storeAutoAddChanged = isStoreCard && newStoreAutoAdd !== storeAutoAdd;
            const editEntityId = isMediaCard
                ? (card.dataset.appId || card.dataset.gameId || card.dataset.appUrl)
                : card.dataset.gameId;
            if (nameChanged) {
                const gameId = editEntityId;
                const allCards = Array.from(document.querySelectorAll('.card, .nav-vertical-card')).filter(c =>
                    c.dataset.gameId === gameId || c.dataset.appId === gameId
                );

                // Gera as novas artes com o nome atualizado
                const iconBase64 = card.dataset.iconBase64 || '';
                const newLogoSvg = window.generateFallbackSvg(newName, 'logo', iconBase64);
                const newGridSvg = window.generateFallbackSvg(newName, 'grid', iconBase64);
                const newHorizSvg = window.generateFallbackSvg(newName, 'horizontal', iconBase64);

                allCards.forEach(c => {
                    // Atualiza o texto normal da UI
                    const titleEl = c.querySelector('.title, .nav-vertical-card-title');
                    if (titleEl) titleEl.innerText = newName;

                    // 1. Atualiza a LOGO
                    if (c.dataset.logo && c.dataset.logo.startsWith('data:image/svg+xml')) {
                        c.dataset.logo = newLogoSvg;
                        if (c.dataset.staticLogo) c.dataset.staticLogo = newLogoSvg;

                        if (c.classList.contains('featured')) {
                            const gameLogoEl = document.getElementById('gameLogo');
                            if (gameLogoEl) gameLogoEl.src = newLogoSvg;
                        }
                    }

                    // 2. Atualiza a Capa Vertical (Grid em pé)
                    if (c.dataset.vertical && c.dataset.vertical.startsWith('data:image/svg+xml')) {
                        c.dataset.vertical = newGridSvg;
                        if (c.dataset.staticVertical) c.dataset.staticVertical = newGridSvg;

                        if (!c.classList.contains('featured')) {
                            const img = c.querySelector('img');
                            if (img) img.src = newGridSvg;
                        }
                    }

                    // 3. Atualiza a Capa Horizontal (Grid deitado, do Featured)
                    if (c.dataset.horizontal && c.dataset.horizontal.startsWith('data:image/svg+xml')) {
                        c.dataset.horizontal = newHorizSvg;
                        if (c.dataset.staticHorizontal) c.dataset.staticHorizontal = newHorizSvg;

                        // Se estiver em destaque, a imagem visível no src do <img> é a horizontal
                        if (c.classList.contains('featured')) {
                            const img = c.querySelector('img');
                            if (img) img.src = newHorizSvg;
                        }
                    }
                });

                if (typeof _menuData !== 'undefined') {
                    ['games', 'media'].forEach(cat => {
                        if (!_menuData[cat]) return;
                        const item = _menuData[cat].find(i => (i.LaunchUrl || i.Path || i.Url || i.Id) === gameId);
                        if (item) item.Name = newName;
                    });
                }
            }

            if (isStoreCard) {
                const storeId = card.dataset.appId || card.dataset.id || card.dataset.appUrl || '';
                if (storeAutoAddChanged && storeId) {
                    window._storeAutoAddSettings = window._storeAutoAddSettings || {};
                    window._storeAutoAddSettings[storeId] = newStoreAutoAdd;
                    postToHost({ action: 'setStoreAutoAdd', store: storeId, enabled: newStoreAutoAdd });
                }
            } else if (nameChanged || launchCommandChanged || webUrlChanged || trailerChanged || mediaHistoryCategoryChanged) {
                const gameId = editEntityId;
                const payload = { action: 'editGame', gameId };
                if (nameChanged) payload.newName = newName;
                if (launchCommandChanged) payload.newLaunchCommand = newLaunchTarget;
                if (webUrlChanged) payload.newUrl = newLaunchTarget;
                if (mediaHistoryCategoryChanged) payload.mediaHistoryCategory = pendingMediaHistoryCategory;
                if (trailerChanged) {
                    payload.newTrailerSource = pendingTrailerSource;
                    payload.newTrailerType = pendingTrailerType;
                }
                postToHost(payload);

                if (mediaHistoryCategoryChanged) {
                    document.querySelectorAll('.card, .nav-vertical-card').forEach(candidate => {
                        if (candidate.dataset.appId === gameId)
                            candidate.dataset.mediaHistoryCategory = pendingMediaHistoryCategory;
                    });
                    window.AppStore?.mutations?.patchItem?.('media', gameId, {
                        mediaHistoryCategory: pendingMediaHistoryCategory
                    });
                }

                if (launchCommandChanged) {
                    document.querySelectorAll('.card, .nav-vertical-card').forEach(candidate => {
                        if (candidate.dataset.gameId === gameId || candidate.dataset.appId === gameId)
                            candidate.dataset.launchCommand = newLaunchTarget;
                    });
                    window.AppStore?.mutations?.patchItem?.(libraryChannel, gameId, { launchCommand: newLaunchTarget });
                    if (typeof _menuData !== 'undefined' && Array.isArray(_menuData[libraryChannel])) {
                        const menuItem = _menuData[libraryChannel].find(item =>
                            (item.LaunchUrl || item.Path || item.Url || item.Id) === gameId);
                        if (menuItem) menuItem.LaunchCommand = newLaunchTarget;
                    }
                }

                if (webUrlChanged) {
                    document.querySelectorAll('.card, .nav-vertical-card').forEach(candidate => {
                        if (candidate.dataset.appId !== gameId) return;
                        candidate.dataset.appUrl = newLaunchTarget;
                        if (candidate.classList.contains('nav-vertical-card')) candidate.dataset.gameId = newLaunchTarget;
                    });
                    window.AppStore?.mutations?.patchItem?.('media', gameId, { url: newLaunchTarget });
                    if (typeof _menuData !== 'undefined' && Array.isArray(_menuData.media)) {
                        const menuItem = _menuData.media.find(item => (item.Id || item.Url) === gameId);
                        if (menuItem) menuItem.Url = newLaunchTarget;
                    }
                    window._navMenuDataChanged?.('media');
                }

            }

            doClose();
        };

        overlay.querySelector('#editSaveBtn').addEventListener('click', doSave);
        overlay.querySelector('#editCancelBtn').addEventListener('click', doClose);
        overlay.addEventListener('mousedown', e => { if (e.target === overlay) doClose(); });

        // ── GESTÃO CENTRAL DE TECLADO E CONTROLE (Foco Perfeito) ──
        overlay.addEventListener('keydown', e => {
            if (window._vkbIsOpen) return;

            // 1. Enter no Input -> Abre o teclado virtual
            if ((e.target.id === 'editNameInput' || e.target.id === 'editLaunchCommandInput' || e.target.id === 'editTrailerUrlInput') && e.key === 'Enter') {
                e.preventDefault();
                window._vkbOpen?.(e.target);
                return;
            }

            // 2. Enter no Checkbox -> Marca/Desmarca
            if (e.target.classList.contains('edit-toggle-row') && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                const chk = e.target.querySelector('input[type="checkbox"]');
                if (chk) chk.checked = !chk.checked;
                return;
            }

            // 3. Voltar / Cancelar (Botão B no controle ou Esc)
            if (e.key === 'Escape') {
                e.preventDefault();
                doClose();
                return;
            }

            // 4. "DESENTUPIDOR DE FOCO": Se o motor do navegador travar nas bordas do modal
            if (['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                const activeBefore = document.activeElement;

                // Espera meio milissegundo pra ver se o navegador moveu sozinho
                setTimeout(() => {
                    const activeAfter = document.activeElement;

                    // Se o foco não andou nada (bateu na barreira invisível)
                    if (activeBefore === activeAfter) {
                        // Mapeia tudo que é clicável no modal
                        const focusables = Array.from(overlay.querySelectorAll('input, button, .edit-toggle-row'))
                            .filter(el => el.offsetParent !== null && !el.disabled);

                        const currentIndex = focusables.indexOf(activeBefore);
                        if (currentIndex === -1) return;

                        // Força a descida
                        if (e.key === 'ArrowDown' && currentIndex < focusables.length - 1) {
                            focusables[currentIndex + 1].focus();
                        }
                        // Força a subida
                        else if (e.key === 'ArrowUp' && currentIndex > 0) {
                            focusables[currentIndex - 1].focus();
                        }
                        // Alterna entre Cancelar <-> Salvar no rodapé
                        else if (e.key === 'ArrowRight' && activeBefore.id === 'editCancelBtn') {
                            overlay.querySelector('#editSaveBtn')?.focus();
                        }
                        else if (e.key === 'ArrowLeft' && activeBefore.id === 'editSaveBtn') {
                            overlay.querySelector('#editCancelBtn')?.focus();
                        }
                    }
                }, 10);
            }
        });

        // Mantém as declarações finais que já existiam
        window._editModalClose = doClose;
        window._editModalSave = doSave;
        isEditModalOpen = true;

        requestAnimationFrame(() => {
            if (isStoreCard) {
                overlay.querySelector('#editArtworkSteamGridBtn')?.focus({ preventScroll: true });
            } else {
                input.focus();
                input.setSelectionRange(input.value.length, input.value.length);
            }
        });
    } 

