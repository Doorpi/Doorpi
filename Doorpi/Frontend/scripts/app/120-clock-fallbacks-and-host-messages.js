    const refreshClocks = () => {
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        document.querySelectorAll('#clock, .doorpi-user-clock').forEach(clock => { clock.innerText = time; });
    };
    refreshClocks();
    setInterval(refreshClocks, 1000);

    /* Seção: Ponte com o host */
    // ── GERADOR DE FALLBACKS SVG ──────────────────────────────────────────
    window.generateFallbackSvg = function (name, type, iconBase64 = '', forceLetter = false) {
        const makeSvg = (svg) => "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svg)));
        const safeIcon = String(iconBase64 || '').replace(/"/g, '&quot;').trim();
        const hasIcon = !!safeIcon;
        const escapeSvgText = value => String(value || 'App').replace(/[&<>"']/g, char => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'
        }[char]));
        const fitFallbackName = (value, maxWidth, fontSize) => {
            const raw = String(value || 'App').trim() || 'App';
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            if (!context) return raw;
            context.font = `600 ${fontSize}px Arial, sans-serif`;
            if (context.measureText(raw).width <= maxWidth) return raw;
            let low = 0;
            let high = raw.length;
            while (low < high) {
                const middle = Math.ceil((low + high) / 2);
                if (context.measureText(`${raw.slice(0, middle).trimEnd()}…`).width <= maxWidth) low = middle;
                else high = middle - 1;
            }
            return `${raw.slice(0, Math.max(1, low)).trimEnd()}…`;
        };
        const fitFallbackTypography = (value, maxWidth, maxFontSize, minFontSize) => {
            const raw = String(value || 'App').trim() || 'App';
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            if (!context) return { text: raw, fontSize: minFontSize };

            let fontSize = maxFontSize;
            while (fontSize > minFontSize) {
                context.font = `650 ${fontSize}px Arial, sans-serif`;
                if (context.measureText(raw).width <= maxWidth) break;
                fontSize -= 2;
            }
            return {
                text: fitFallbackName(raw, maxWidth, fontSize),
                fontSize
            };
        };
        const iconSvg = (w, h, mainSize, blurSize, fontSize, textY, horizontalPadding) => {
            const xMain = (w - mainSize) / 2;
            const yMain = (h - mainSize) / 2;
            const xBlur = (w - blurSize) / 2;
            const yBlur = (h - blurSize) / 2;
            const fittedName = escapeSvgText(fitFallbackName(name, w - (horizontalPadding * 2), fontSize));
            return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">
                <defs>
                    <filter id="doorpiIconBlur"><feGaussianBlur stdDeviation="${Math.round(Math.min(w, h) * 0.08)}"/></filter>
                    <radialGradient id="doorpiShade" cx="50%" cy="45%" r="75%">
                        <stop offset="0%" stop-color="#30365f"/>
                        <stop offset="100%" stop-color="#070812"/>
                    </radialGradient>
                </defs>
                <rect width="${w}" height="${h}" fill="url(#doorpiShade)"/>
                <image href="data:image/png;base64,${safeIcon}" x="${xBlur}" y="${yBlur}" width="${blurSize}" height="${blurSize}" preserveAspectRatio="xMidYMid meet" opacity="0.7" filter="url(#doorpiIconBlur)"/>
                <rect width="${w}" height="${h}" fill="#03040c" opacity="0.35"/>
                <image href="data:image/png;base64,${safeIcon}" x="${xMain}" y="${yMain}" width="${mainSize}" height="${mainSize}" preserveAspectRatio="xMidYMid meet"/>
                <text x="${w / 2}" y="${textY}" text-anchor="middle" fill="#eef4ff" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="600">${fittedName}</text>
            </svg>`;
        };
        const genericSvg = (w, h, maxFontSize, minFontSize, horizontalPadding) => {
            const fitted = fitFallbackTypography(name, w - (horizontalPadding * 2), maxFontSize, minFontSize);
            const fittedName = escapeSvgText(fitted.text);
            return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">
                <defs>
                    <linearGradient id="doorpiGenericShade" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stop-color="#202638"/>
                        <stop offset="52%" stop-color="#121827"/>
                        <stop offset="100%" stop-color="#090d17"/>
                    </linearGradient>
                </defs>
                <rect width="${w}" height="${h}" fill="url(#doorpiGenericShade)"/>
                <path d="M${horizontalPadding} ${h * 0.5 + fitted.fontSize * 0.92}H${w - horizontalPadding}" stroke="#eef4ff" stroke-opacity="0.14" stroke-width="2"/>
                <text x="${w / 2}" y="${h * 0.5}" dominant-baseline="middle" text-anchor="middle" fill="#eef4ff" font-family="Arial, sans-serif" font-size="${fitted.fontSize}" font-weight="650" letter-spacing="0.2">${fittedName}</text>
            </svg>`;
        };

        if (type === 'grid') {
            if (hasIcon) return makeSvg(iconSvg(600, 900, 190, 760, 34, 820, 42));
            return makeSvg(genericSvg(600, 900, 54, 32, 54));

        } else if (type === 'horizontal') {
            if (hasIcon) return makeSvg(iconSvg(920, 430, 150, 560, 28, 376, 46));
            return makeSvg(genericSvg(920, 430, 58, 34, 72));

        } else if (type === 'logo') {
            if (hasIcon) return makeSvg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 150"><image href="data:image/png;base64,${safeIcon}" x="0" y="18" width="112" height="112" preserveAspectRatio="xMidYMid meet"/></svg>`);
            // LOGO: Alinhado à esquerda (x="0") e mais para baixo (y="80%") para casar com a posição real
            return makeSvg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 150"><rect width="800" height="150" fill="transparent"/></svg>`);

        } else if (type === 'banner') {
            // BANNER: 100% TRANSPARENTE (Deixa o Blob brilhar!)
            return makeSvg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080"><rect width="1920" height="1080" fill="transparent"/></svg>`);
        }

        return '';
    };

    /* Seção: Ponte com o host */
    window.chrome.webview.addEventListener('message', event => {
        try {
            const data = JSON.parse(event.data);
            console.log("Mensagem recebida no JS:", data);

            // ── INJEÇÃO DE FALLBACKS (SEM ARTE) ──────────────────────────────────
            const applyFallbacks = (item) => {
                const name = item.name || item.Name || "App";
                const iconBase64 = item.iconBase64 || item.IconBase64 || '';

                // 1. Grid Vertical (Inicial)
                const gridKey = item.imageData !== undefined ? 'imageData' : (item.GridImage !== undefined ? 'GridImage' : null);
                if (gridKey && !item[gridKey]) item[gridKey] = window.generateFallbackSvg(name, 'grid', iconBase64);

                // 2. Grid Horizontal (Inicial)
                const horizKey = item.horizontalImage !== undefined ? 'horizontalImage' : (item.GridHorizontalImage !== undefined ? 'GridHorizontalImage' : null);
                if (horizKey && !item[horizKey]) item[horizKey] = window.generateFallbackSvg(name, 'horizontal', iconBase64);

                // 3. Logo (Nome)
                const logoKey = item.logo !== undefined ? 'logo' : (item.LogoImage !== undefined ? 'LogoImage' : null);
                if (logoKey && !item[logoKey]) item[logoKey] = window.generateFallbackSvg(name, 'logo', iconBase64);

                // 4. Banner (Transparente para o Blob)
                const bannerKey = item.hero !== undefined ? 'hero' : (item.HeroImage !== undefined ? 'HeroImage' : null);
                if (bannerKey && !item[bannerKey]) item[bannerKey] = window.generateFallbackSvg(name, 'banner');
            };

            // Substitui o bloco renderGames existente
            if (data.type === 'renderGames' && data.games) {
                window.DoorpiFirstRunTutorial?.maybeShow?.();
                data.games.forEach(applyFallbacks);

                const wasOnMedia = typeof window.getCurrentHomeTab === 'function'
                    && window.getCurrentHomeTab() === 'media';

                // Snapshot do hero atual antes do setBatch trocar tudo
                const heroSnapSrc = document.getElementById('bgBlur')?.src || '';
                const heroSnapLogo = document.getElementById('gameLogo')?.src || '';
                const heroSnapHoriz = document.getElementById('heroImage')?.src || '';

                const sessionNewCount = _countSessionNewGames(data.games || []);
                data._doorpiRenderHandled = true;
                _scheduleRenderGamesBatch({
                    games: data.games || [],
                    silent: sessionNewCount > DOORPI_BULK_LIBRARY_THRESHOLD || _libraryUpdateShouldWait(),
                    wasOnMedia,
                    heroSnapSrc,
                    heroSnapLogo,
                    heroSnapHoriz
                });

                // Se estava na mídia, devolve o hero que estava ativo
            }
            else if (data.type === 'newGame') applyFallbacks(data);
            else if (data.type === 'nativeAppsLoaded' && data.apps) data.apps.forEach(applyFallbacks);
            // ─────────────────────────────────────────────────────────────────────
            // ─────────────────────────────────────────────────────────────────────

            // 1. Quando o C# envia um ÚNICO jogo novo
            if (data.type === 'editLaunchCommandSelected') {
                window._editLaunchCommandBrowseResult?.(data.path || '');
            }
            else if (data.type === 'gameTrailerSelected') {
                window._editTrailerBrowseResult?.(data.path || '');
            }
            else if (data.type === 'gameUpdated') {
                const gameId = data.gameId || '';
                const patch = data.game || {};
                if (gameId && window.AppStore) {
                    applyFallbacks(patch);
                    window.AppStore.mutations.patchItem('games', gameId, patch);
                }
            }
            else if (data.type === 'mediaUpdated') {
                const appId = data.appId || '';
                const patch = data.app || {};
                if (appId && window.AppStore) {
                    applyFallbacks(patch);
                    window.AppStore.mutations.patchItem('media', appId, patch);
                }
            }
            else if (data.type === 'gameTrailerUpdated') {
                const gameId = data.gameId || '';
                const source = data.source || '';
                const trailerType = data.trailerType || '';
                window.AppStore?.mutations?.patchItem?.('games', gameId, { trailerSource: source, trailerType });
            }
            else if (data.type === 'gameTrailerUpdateFailed') {
                console.error('[Trailer] Não foi possível salvar o trailer selecionado.');
            }
            else if (data.type === 'newGame') {
                const channel = (data.isMedia || data.tab === 'media' || data.appUrl !== undefined || data.appType !== undefined) ? 'media' : 'games';
                _enqueueNewGameForLibrary(channel, data);
            }
            // 2. Quando o C# envia A LISTA COMPLETA de uma vez (Início do App)
            else if (data.type === 'renderGames' && !data._doorpiRenderHandled) {
                _scheduleRenderGamesBatch({
                    games: data.games || [],
                    silent: _countSessionNewGames(data.games || []) > DOORPI_BULK_LIBRARY_THRESHOLD || _libraryUpdateShouldWait()
                });
            }
            else if (data.type === 'gamesRemoved' && Array.isArray(data.games)) {
                data.games.forEach(game => {
                    const id = game.id || game.launchUrl || game.LaunchUrl || game.path || game.Path;
                    if (!id) return;
                    window.newGameIdsThisSession?.delete(id);
                    window.AppStore?.mutations?.removeItem('games', id);
                    window._navMenuRemoveItem?.('games', id);
                });
            }
            // app.js — handler de mensagens do C#
            else if (data.type === 'windowFocused') {
                window.isGameLaunchActive = false;
                window._doorpiGameInputSuppressedUntil = 0;
                window.isMediaAppActive = false;
                window.isStoreSessionActive = false;
                const launchOverlay = document.getElementById('gameLaunchOverlay');
                const isExecutionLockVisible = !!(launchOverlay &&
                    launchOverlay.classList.contains('visible') &&
                    launchOverlay.classList.contains('execution-lock-visible'));
                const isTransientLaunchOverlayVisible = !!(launchOverlay &&
                    launchOverlay.classList.contains('visible') &&
                    !isExecutionLockVisible);
                const isWaitingForValidGameWindowVisible = _isWaitingForValidGameWindowOverlayVisible();
                const isAnyLaunchLoadingVisible = _isAnyLaunchLoadingOverlayVisible();

                const shouldMuteDoorpiAudio = _readDoorpiAudioMuteFlag(data);

                if (data.appAlive !== undefined ||
                    data.hasBlockingSession !== undefined ||
                    data.hasLiveExternalSession !== undefined ||
                    data.shouldMuteDoorpiAudio !== undefined) {
                    window._isExternalAppRunning = shouldMuteDoorpiAudio;
                }

                if (isExecutionLockVisible) {
                    window._isExternalAppRunning = true;
                    window.isMediaAppActive = true;
                    _ensureExecutionOverlayRefreshLoop();
                    _refreshExecutionOverlayFromRuntime();
                }
                if (isWaitingForValidGameWindowVisible) {
                    window._isExternalAppRunning = true;
                }

                window._isDoorpiFocused = true;
                window.isDoorpiFocused = true;

                if (!window._vkbIsOpen) {
                    scheduleDoorpiFocusRecovery();
                }

                if (window._isExternalAppRunning) {
                    window._stopSystemAudio();

                } else {
                    // Gap de transição: se houver sessão ativa, sobe direto para EM EXECUÇÃO
                    // em vez de esconder o overlay no retorno de foco.

                    window._startSystemAudio(true);
                }
            }
            else if (data.type === 'appProcessDied') {
                if (Array.isArray(data.running)) {
                    window.DoorpiRuntimeState.running = data.running;
                    _syncWebAppConflictEntryFromRuntime();
                    refreshRuntimeCards();
                }
                const shouldMuteDoorpiAudio = _readDoorpiAudioMuteFlag(
                    data,
                    window.DoorpiRuntimeState.running.length > 0
                );
                window._syncSystemAudioFromRuntime(shouldMuteDoorpiAudio);
            }
            else if (data.type === 'scanProgress') {
                const folderName = data.folderName || '';
                window.setInlineScanStatus?.(true, t('inlineScanReadingFolder', folderName));
            }
            else if (data.type === 'runtimeSessionsChanged') {
                window.DoorpiRuntimeState.running = Array.isArray(data.running) ? data.running : [];
                _syncWebAppConflictEntryFromRuntime();
                refreshRuntimeCards();
                const shouldMuteDoorpiAudio = _readDoorpiAudioMuteFlag(
                    data,
                    window.DoorpiRuntimeState.running.length > 0
                );
                window._syncSystemAudioFromRuntime(shouldMuteDoorpiAudio);
                if (_hasAnyRuntimeSession()) {
                    _clearExecutionOverlayCloseTimer();
                    _ensureExecutionOverlayRefreshLoop();
                    _refreshExecutionOverlayFromRuntime();
                } else if (_isExecutionOverlayVisible()) {
                    if (_isGpuUpdaterExecutionLockOwned()) {
                        _clearExecutionOverlayCloseTimer();
                        return;
                    }
                    _clearExecutionOverlayCloseTimer();
                    window._executionOverlayCloseTimer = setTimeout(() => {
                        window._executionOverlayCloseTimer = 0;
                        if (_hasAnyRuntimeSession()) return;
                        if (!_isExecutionOverlayVisible()) return;
                        window.isMediaAppActive = false;
                        window._lastExecutionLockData = null;
                        window._executionOverlayVisualKey = '';
                        GameLaunchOverlay.hide();
                        _stopExecutionOverlayRefreshLoop();
                    }, 450);
                } else {
                    _stopExecutionOverlayRefreshLoop();
                }
            }
            else if (data.type === 'windowLostFocus') {
                window._isDoorpiFocused = false;
                window._stopSystemAudio();
            }
            else if (data.type === 'openUserPicker') {
                const picker = document.getElementById('doorpiUserPicker');
                const isPickerOpen = picker && picker.style.display !== 'none';


                if (window.isSetupOpen) return;

                if (!window.isNavMenuOpen && !window.isModalOpen && !window._vkbIsOpen && !isPickerOpen) {
                    postToHost({ action: 'requestUsers' });
                }
            }
            else if (data.type === 'openQuickPanel') {
                if (window.isDoorpiUpdatePromptOpen?.()) return;
                if (window.isDoorpiFileBrowserOpen?.()) return;
                window.DoorpiQuickPanel?.toggle?.();
            }
            else if (data.type === 'displaySettings') {
                window.DoorpiDisplayMetrics.dpiScale = Math.max(0.5, Number(data.systemDpiScale) || 1);
                window.DoorpiLayoutScale?.apply?.(data.layoutScale, true);
                window._setupRefreshLayoutReference?.();
            }
            else if (data.type === 'extensionsList' || data.type === 'extensionUpdatesList') {
                if (data.type === 'extensionUpdatesList') {
                    window._pendingExtensionUpdates = data.updates || {};
                }
                if (data.updates) {
                    window._pendingExtensionUpdates = data.updates || {};
                }
                window.DoorpiNotifications?.setExtensionUpdates?.(window._pendingExtensionUpdates);
                // Atualiza a lista na nova interface do Nav Menu se estiver aberta
                if (document.getElementById('navExtensionsList')) {
                    window._renderNavExtensionsList?.(data.extensions || [], data.status || '', data.message || '', window._pendingExtensionUpdates);
                }
            }
            else if (data.type === 'installedAppsList') {
                // A consulta leve terminou. Encerrar apenas o indicador do próprio
                // modal — hideLoading também executa lógica de foco da Home.
                window.setInlineScanStatus?.(false);
                if (_replaceInstalledAppsIfChanged(data.apps)) {
                    _patchInstalledAppsModalInPlace();
                }
            }
            else if (data.type === 'installedAppsUpdated') {
                const modal = document.getElementById('addGameContainer');
                if (!modal || modal.style.display === 'none') return;
                if (_replaceInstalledAppsIfChanged(data.apps)) {
                    _patchInstalledAppsModalInPlace();
                }
            }
            else if (data.type === 'installedAppsRequestCompleted') {
                // Fallback para falhas no detector: encerra o estado visual sem tocar
                // no modal nem no foco atual.
                window.setInlineScanStatus?.(false);
            }
            else if (data.type === 'nativeAppsLoaded') {
                if (data.apps) {
                    window._mediaGamepadConfig = window._mediaGamepadConfig || {};
                    data.apps.forEach(app => {
                        window._mediaGamepadConfig[app.Id] = !!app.DisableGamepadControl;
                    });

                    // Aplica aos cards que já possam estar ativos no DOM
                    document.querySelectorAll('.card[data-app-id]').forEach(card => {
                        const id = card.dataset.appId;
                        if (window._mediaGamepadConfig[id] !== undefined) {
                            card.dataset.disableGamepadControl = window._mediaGamepadConfig[id] ? 'true' : 'false';
                        }
                    });
                }
            }
            else if (data.type === 'clearLoadingCards') {
                clearLoadingCards(data.tab || 'games');
                if (!data.tab) clearLoadingCards('media');
            }
            else if (data.type === 'showLoadingCards') {
                window.showLoadingCards?.(data.count || 1, data.tab || 'games');
            }
            else if (data.type === 'showSetup') {
                const open = () => {
                    if (typeof openSetup === 'function') openSetup();
                };
                if (window.DoorpiIntro?.isRunning?.()) {
                    window.DoorpiIntro.prepareSetupHandoff?.();
                    window.DoorpiIntro.runAfterIntro(open);
                }
                else open();
            }
            else if (data.type === 'profilePhotoSelected') {
                window._setupHandlePhotoSelected?.(data.base64);
            }
            else if (data.type === 'profilePhotoArtworkResults' ||
                     data.type === 'profilePhotoGameSuggestions' ||
                     data.type === 'profilePhotoSourceProgress' ||
                     data.type === 'profilePhotoSourceLoaded' ||
                     data.type === 'profilePhotoSourceFailed' ||
                     data.type === 'profilePhotoSourceCanceled') {
                window._profilePhotoPickerHandleMessage?.(data);
            }
            else if (data.type === 'steamGridArtworkResults') {
                window._artworkWizardHandleResults?.(data);
            }
            else if (data.type === 'artworkImagePicked') {
                window._doorpiSuppressNativeDialogPointer?.(650);
                window._artworkWizardHandlePicked?.(data);
            }
            else if (data.type === 'artworkImagePickCanceled') {
                window._doorpiSuppressNativeDialogPointer?.(650);
            }
            else if (data.type === 'nativeDialogOpened') {
                window._doorpiNativeDialogActive = true;
                window.quarantineDoorpiGamepadActions?.(300);
            }
            else if (data.type === 'nativeDialogReturned') {
                window._doorpiNativeDialogPending = false;
                window._doorpiNativeDialogActive = false;
                window._doorpiSuppressNativeDialogPointer?.(900);
                window.quarantineDoorpiGamepadActions?.(500);
            }
            else if (data.type === 'artworkSelectionApplied') {
                window._artworkWizardHandleApplied?.(data);
            }
            else if (data.type === 'artworkDownloadProgress') {
                window._artworkWizardHandleDownloadProgress?.(data);
            }
            else if (data.type === 'setupFolderAdded') {
                window._setupHandleFolderAdded?.(data.path);
            }
            else if (data.type === 'setupFolderDialogClosed') {
                window._setupHandleFolderDialogClosed?.(data.path || '');
            }
            else if (data.type === 'browsersDetected') {
                window._setupRenderBrowsers?.(data.browsers);
            }
            // 1. Quando o C# manda limpar a grade (Ao iniciar ou resetar)
            else if (data.type === 'clearGamesGrid') {
                if (window.AppStore) window.AppStore.mutations.setBatch('games', []);
            }
            else if (data.type === 'bootstrapStarted') {
                window.DoorpiFirstRunTutorial?.maybeShow?.();
                // showLoadingCards já existe no codebase (usada ao adicionar jogos manualmente)
                if (typeof showLoadingCards === 'function') {
                    showLoadingCards(data.count || 6, 'games');
                }
            }
            // 2. Quando o C# avisa que salvou a imagem estática localmente
            else if (data.type === 'staticSaved') {
                const patch = {};
                if (data.imageType === 'GridStatic') patch.staticVertical = data.newUrl;
                if (data.imageType === 'HorizontalStatic') patch.staticHorizontal = data.newUrl;
                if (data.imageType === 'HeroStatic') patch.staticHero = data.newUrl;
                if (data.imageType === 'LogoStatic') patch.staticLogo = data.newUrl;

                // Avisamos o Store da mudança. O Store avisa o Grid, e a imagem é atualizada sem piscar.
                const hasGame = window.AppStore.queries.hasItem('games', data.gameId)
                    || window.AppStore.queries.isArtworkPending?.('games', data.gameId);
                const hasMedia = window.AppStore.queries.hasItem('media', data.gameId)
                    || window.AppStore.queries.isArtworkPending?.('media', data.gameId);
                const hasStore = window.AppStore.queries.hasItem('stores', data.gameId);

                if (hasGame) {
                    window.AppStore.mutations.patchItem('games', data.gameId, patch);
                    if (data.imageType === 'GridStatic') window._navMenuDataChanged?.('games');
                } else if (hasMedia) {
                    window.AppStore.mutations.patchItem('media', data.gameId, patch);
                    if (data.imageType === 'GridStatic') window._navMenuDataChanged?.('media');
                } else if (hasStore) {
                    window.AppStore.mutations.patchItem('stores', data.gameId, patch);
                    if (data.imageType === 'GridStatic') window._navMenuDataChanged?.('stores');
                }
                window._artworkWizardHandleStaticSaved?.(data);
            }
            else if (data.type === 'clearMediaGrid') {
                if (window.AppStore) window.AppStore.mutations.setBatch('media', []);
                const grid = document.getElementById('mediaGrid');
                if (grid) {
                    const btnAdd = document.getElementById('btnAddMedia');
                    grid.innerHTML = '';
                    if (btnAdd) grid.appendChild(btnAdd);
                }
            }
            else if (data.type === 'currentUserUpdated') {
                const nextUserId = data.currentUserId || data.user?.Id || data.user?.id || '';
                const userChanged = !!nextUserId && String(nextUserId).toLowerCase() !== String(window._doorpiCurrentUserId || '').toLowerCase();
                if (userChanged) {
                    window.newGameIdsThisSession?.clear?.();
                    window.AppStore?.mutations?.clearNewIds?.();
                    document.querySelectorAll('.new-game').forEach(el => el.classList.remove('new-game'));
                }
                window._doorpiProfile = data.user;
                window._doorpiCurrentUserId = nextUserId;
                window._doorpiUserSessionReady = !!nextUserId;
                window.setDoorpiSessionLocked?.(!window._doorpiUserSessionReady);
                window._doorpiIsAdmin = !!data.isAdmin || !!(data.user?.IsAdmin || data.user?.isAdmin);
                window._adminBlockedStoreIds = new Set(data.blockedStoreIds || []);
                window._steamForceAccountSelection = !!data.steamForceAccountSelection;
                window._applyDoorpiTopProfile?.(data.user);
                window._navMenuCurrentUserChanged?.(data.user, nextUserId, userChanged);
                if (window._pendingUserSwitchId && String(window._pendingUserSwitchId).toLowerCase() === String(nextUserId || '').toLowerCase()) {
                    closeUserPinPrompt();
                    const picker = document.getElementById('doorpiUserPicker');
                    if (picker) picker.style.display = 'none';
                    document.body.classList.remove('user-picker-open');
                    window._pendingUserSwitchId = '';
                    if (!window._userSwitching) window.DoorpiIntro?.finishHandoff?.();
                    requestAnimationFrame(() => window.updateDoorpiTopClusterVisibility?.());
                }
                window.DoorpiFirstRunTutorial?.maybeShow?.();
                setTimeout(() => window.DoorpiUpdatePrompt?.evaluate?.(), 420);
                if (typeof clearHero === 'function') clearHero();
            }
            else if (data.type === 'systemUpdateStatus') {
                window.DoorpiUpdatePrompt?.setStatus(data);
                window.DoorpiNotifications?.setSystemUpdateStatus?.(data);
                window.DoorpiQuickPanel?.setDoorpiUpdateStatus?.(data);
            }
            else if (data.type === 'windowsUpdateStatus') {
                window.DoorpiNotifications?.setWindowsUpdateStatus?.(data);
                window.DoorpiQuickPanel?.setWindowsUpdateStatus?.(data);
            }
            else if (data.type === 'gpuUpdateStatus') {
                window.DoorpiQuickPanel?.setGpuUpdateStatus?.(data);
                window._navMenuSetGpuUpdateStatus?.(data);
            }
            else if (data.type === 'doorpiNotification') {
                if (data.remove && data.id) {
                    window.DoorpiNotifications?.remove?.(data.id);
                    return;
                }
                if (data.category === 'steamgrid-download-failed') {
                    window.DoorpiNotifications?.notifySteamGridDownloadFailure?.();
                } else if (data.category === 'steamgrid-art-not-found') {
                    window.DoorpiNotifications?.notifySteamGridNotFound?.(data.name || data.gameName || '');
                } else {
                    window.DoorpiNotifications?.upsert?.({
                        id: data.id || `notification-${Date.now()}`,
                        title: data.title || t('notificationsTitle'),
                        message: data.message || '',
                        persistent: !!data.persistent,
                        action: data.action || '',
                        profileId: data.profileId || '',
                    });
                }
            }
            else if (data.type === 'bluetoothStatus') {
                const changed = window.DoorpiBluetoothUI?.setStatus?.(data) !== false;
                if (changed) {
                    window.DoorpiQuickPanel?.setBluetoothStatus?.(data);
                    window._navMenuSetBluetoothStatus?.(data);
                }
            }
            else if (data.type === 'wifiStatus') {
                const changed = window.DoorpiWifiUI?.setStatus?.(data) !== false;
                if (changed) {
                    window.DoorpiQuickPanel?.setWifiStatus?.(data);
                    window._navMenuSetWifiStatus?.(data);
                }
            }
            else if (data.type === 'soundStatus') {
                const changed = window.DoorpiSoundUI?.setStatus?.(data) !== false;
                if (changed) {
                    window.DoorpiQuickPanel?.setSoundStatus?.(data);
                    window._navMenuSetSoundStatus?.(data);
                }
            }
            else if (data.type === 'storageSnapshot') {
                window.DoorpiQuickPanel?.setStorageStatus?.(data);
                window._navMenuSetStorageStatus?.(data);
            }
            else if (data.type === 'storagePrograms') {
                window.DoorpiQuickPanel?.setStoragePrograms?.(data);
                window._navMenuSetStoragePrograms?.(data);
            }
            else if (data.type === 'storageUninstallStatus') {
                window.DoorpiQuickPanel?.setStorageUninstallStatus?.(data);
                window._navMenuSetStorageUninstallStatus?.(data);
            }
            else if (data.type === 'updateFeaturedCard') {
                // 🔹 Avisa o Store: ele reordena o carrossel E atualiza o hero automaticamente
                if (window.AppStore) window.AppStore.mutations.trackOpened(data.id);
            }
            else if (data.type === 'gameAlreadyRunning') {
                const running = _nonMinimizedRuntimeEntries().find(e =>
                    (e.channel === 'games' || e.kind === 'game') &&
                    (!data.currentGameId || !e.id || e.id === data.currentGameId)
                );
                const payload = running
                    ? _buildClosePayloadFromRuntimeEntry(running)
                    : { id: data.currentGameId || '', url: '', channel: 'games', appType: 'game' };
                window.showSessionConflictPopup?.({
                    closePayload: payload,
                    runningName: running ? _resolveRuntimeEntryName(running) : ''
                });
            }
            else if (data.type === 'storeAlreadyRunning') {
                const running = _nonMinimizedRuntimeEntries().find(e =>
                    (e.channel === 'stores' || e.kind === 'store') &&
                    (!data.currentStoreId || !e.id || e.id === data.currentStoreId)
                );
                const payload = running
                    ? _buildClosePayloadFromRuntimeEntry(running)
                    : { id: data.currentStoreId || '', url: data.currentStoreId || '', channel: 'stores', appType: 'store' };
                window.showSessionConflictPopup?.({
                    closePayload: payload,
                    runningName: running ? _resolveRuntimeEntryName(running) : ''
                });
            }
            else if (data.type === 'sessionConflictPrompt') {
                const payload = {
                    id: data.id || '',
                    url: data.url || '',
                    channel: data.channel || '',
                    appType: data.appType || ''
                };
                window.showSessionConflictPopup?.({
                    closePayload: payload,
                    runningName: data.name || ''
                });
            }
            else if (data.type === 'storeDownloadBlockedBySessions') {
                window.showStoreDownloadSessionConflict?.({
                    storeId: data.storeId || '',
                    url: data.url || '',
                    name: data.name || ''
                });
            }
            else if (data.type === 'gpuUpdaterBlockedBySessions') {
                window.showGpuUpdaterSessionConflict?.({
                    updaterId: data.updaterId || '',
                    name: data.name || ''
                });
            }
            else if (data.type === 'adminPolicyBlocked') {
                const title = data.kind === 'admin-delete'
                    ? (typeof t === 'function' ? t('adminDeleteBlockedTitle', 'Conta administradora') : 'Conta administradora')
                    : (typeof t === 'function' ? t('adminBlockedTitle', 'Bloqueado pelo administrador') : 'Bloqueado pelo administrador');
                const subtitle = data.kind === 'admin-delete'
                    ? (typeof t === 'function' ? t('adminDeleteBlockedSubtitle', 'A conta administradora não pode ser removida.') : 'A conta administradora não pode ser removida.')
                    : (typeof t === 'function' ? t('adminBlockedSubtitle', 'Esta loja foi privada para esta conta.') : 'Esta loja foi privada para esta conta.');
                window.showDoorpiToast?.(title, subtitle);
            }
            else if (data.type === 'gameFocusFallbackPrompt') {
                window.showGameFocusFallbackPopup?.({
                    id: data.id || '',
                    name: data.name || data.gameName || ''
                });
            }
            else if (data.type === 'gameHungRestorePrompt') {
                window.showGameFocusFallbackPopup?.({
                    id: data.id || '',
                    name: data.name || data.gameName || '',
                    mode: 'hung'
                });
            }
            else if (data.type === 'hideGameFocusFallbackPrompt') {
                window.hideGameFocusFallbackPopup?.(false);
            }
            else if (data.type === 'updateLoadingText') {
                if (window.isGlobalLoading) {
                    showGlobalLoading(data.title, data.subtitle);
                }
            }
            else if (data.type === 'foldersList') {
                cachedFolders = data.folders;
                renderFolderList(cachedFolders);
            }
            else if (data.type === 'hideLoading' || data.type === 'hideSystemLoading') {
                hideGlobalLoading();
                isFolderOperationInProgress = false;

               
                window.setInlineScanStatus?.(false);
            }
            else if (data.type === 'usersList') {
                // A lista de perfis já é uma tela interativa completa. Mantê-la
                // sob o estado global de loading fazia o controle parecer travado
                // até outro evento assíncrono liberar a navegação.
                hideGlobalLoading();
                window._doorpiIntroInputBlockUntil = 0;
                window._doorpiUsers = data.users || [];
                window._doorpiUserSessionReady = data.sessionActive === true;
                window._doorpiCurrentUserId = window._doorpiUserSessionReady
                    ? (data.currentUserId || '')
                    : '';
                window.setDoorpiSessionLocked?.(!window._doorpiUserSessionReady);
                showUserPicker(data.users || [], !!data.requireSelection);
            }
            else if (data.type === 'closeNavMenu') {
                window.closeNavMenu?.();
            }
            else if (data.type === 'usersData') {
                window._doorpiUsers = data.users || [];
                window._doorpiCurrentUserId = data.currentUserId || '';
                window._doorpiUsersDataReady?.(window._doorpiUsers, window._doorpiCurrentUserId);
            }
            else if (data.type === 'userPinRejected') {
                const shown = setUserPinError(t('pinPromptInvalid'), true);
                if (!shown) {
                    window._pendingUserSwitchId = '';
                    window.showDoorpiToast?.(t('pinPromptInvalid'), '');
                }
            }
            else if (data.type === 'userPinRecoveryRejected') {
                const shown = setUserPinRecoveryError(t(data.reason || 'pinRecoveryFailed'));
                if (!shown) {
                    window._pendingUserSwitchId = '';
                    window.showDoorpiToast?.(t(data.reason || 'pinRecoveryFailed'), '');
                }
            }
            else if (data.type === 'clipboardText') {
                if (data.text?.trim()) {
                    const clipboardText = data.text.trim();
                    if (window._profilePhotoPickerHandleClipboard?.(clipboardText)) {
                        return;
                    }
                    if (window._artworkWizardHandleClipboard?.(clipboardText)) {
                        return;
                    }
                    // Intercepta a colagem no Nav Menu de Conta/Perfil
                    if (window._isPastingApiKey) {
                        window._isPastingApiKey = false;
                        if (typeof window._updatePendingApiKey === 'function') {
                            window._updatePendingApiKey(data.text.trim());
                        }
                    }
                    // Intercepta a colagem no Nav Menu de Extensões
                    else if (window._isPastingWebAppUrl) {
                        window._isPastingWebAppUrl = false;
                        const input = document.getElementById('webAppUrlInput');
                        if (input) {
                            input.value = data.text.trim();
                            setTimeout(() => document.getElementById('btnAddWebApp')?.focus(), 80);
                        }
                    }
                    else if (window._isPastingExtensionUrl || (document.getElementById('navExtUrlInput') && data.text.includes('chromewebstore'))) {
                        window._isPastingExtensionUrl = false;
                        const candidate = data.extensionCandidate || { url: clipboardText };
                        candidate.url = candidate.url || clipboardText;
                        if (typeof window._showNavExtensionInstallCandidate === 'function') {
                            window._showNavExtensionInstallCandidate(candidate);
                        } else {
                            const input = document.getElementById('navExtUrlInput');
                            if (input) input.value = clipboardText;
                        }
                    }
                    // Configuração Inicial (Setup)
                    else if (typeof isSetupOpen !== 'undefined' && isSetupOpen) {
                        const input = document.getElementById('setupApiInput');
                        if (input) {
                            input.value = data.text.trim();
                            if (typeof _currUser !== 'undefined' && _currUser) _currUser.apiKey = data.text.trim();
                            const hint = document.getElementById('setupApiHint');
                            if (hint) hint.textContent = typeof t === 'function' ? t('setupStep3PasteSuccess') : 'Copiado com sucesso!';
                            if (typeof _updateStatus === 'function') _updateStatus();
                            document.getElementById('btnSetupFinish')?.focus();
                        }
                    }
                }
            }
            else if (data.type === 'webAppBrowserUrlCaptured') {
                const url = (data.url || '').trim();
                if (url) {
                    window._suppressNextMediaAppClosedFocus = true;
                    if (data.target === 'profilePhoto') {
                        window._profilePhotoPickerSetUrl?.(url);
                        return;
                    }
                    if (data.target === 'historyArtwork') {
                        window._artworkWizardSetUrl?.(url);
                        return;
                    }
                    if (data.target === 'gameTrailer') {
                        window._editTrailerBrowserUrlResult?.(url);
                        return;
                    }
                    const input = document.getElementById('webAppUrlInput');
                    if (input) {
                        input.value = url;
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                        setTimeout(() => document.getElementById('btnAddWebApp')?.focus(), 120);
                    }
                }
            }
            else if (data.type === 'webAppBrowserCaptureCanceled') {
                window._suppressNextMediaAppClosedFocus = true;
                if (data.target === 'profilePhoto') {
                    setTimeout(() => window._profilePhotoPickerFocusUrl?.(), 180);
                    return;
                }
                if (data.target === 'historyArtwork') {
                    setTimeout(() => window._artworkWizardFocusUrl?.(), 180);
                    return;
                }
                if (data.target === 'gameTrailer') {
                    setTimeout(() => document.getElementById('editTrailerSearchBtn')?.focus?.(), 180);
                    return;
                }
                setTimeout(() => {
                    const target =
                        document.getElementById('btnWebAppBrowser') ||
                        document.getElementById('webAppUrlInput') ||
                        document.getElementById('btnAddWebApp');
                    target?.focus?.();
                }, 180);
            }
            else if (data.type === 'gameLaunching') {
                window._isExternalAppRunning = true;
                window.stopHomeFeatureTrailer?.({ resumeAudio: false });
                window._stopSystemAudio();
                window.isMediaAppActive = true;

                const reason = data.reason || '';
                const launchKind = reason.startsWith('store') ? 'store' : (reason === 'app' ? 'app' : 'game');
                const isRestore = reason === 'restore' || reason === 'storeRestore';
                GameLaunchOverlay.show(data.gameName, data.heroImage, data.gridImage, isRestore, launchKind);
            }
            else if (data.type === 'gpuUpdaterRestarting') {
                window._isExternalAppRunning = true;
                window._stopSystemAudio();
                window.isMediaAppActive = true;
                GameLaunchOverlay.showGpuRestarting?.(data);
                requestAnimationFrame(() => requestAnimationFrame(() => {
                    postToHost({ action: 'gpuUpdaterRestartNoticeRendered' });
                }));
            }
            else if (data.type === 'gpuUpdaterSessionEnded') {
                window._isExternalAppRunning = false;
                window._isDoorpiFocused = true;
                window.isMediaAppActive = false;
                window.isGameLaunchActive = false;
                GameLaunchOverlay.hide();
                window._startSystemAudio(true);
            }
            else if (data.type === 'gpuUpdaterDoorpiActivated') {
                // O clique que trouxe o Doorpi para frente deve apenas restaurar o foco.
                // Confirmacoes disparadas pela navegacao usam HTMLElement.click() e nao
                // sao eventos confiaveis, portanto continuam liberadas durante a guarda.
                window._gpuUpdaterPointerGuardUntil = Date.now() + 350;
            }
            else if (data.type === 'storeTransition') {
                window._isExternalAppRunning = true;
                window._stopSystemAudio();
                window.isMediaAppActive = true;
                GameLaunchOverlay.showStoreTransition(data);
            }
            else if (data.type === 'storeTransitionDone') {
                const launchOverlay = document.getElementById('gameLaunchOverlay');
                if (launchOverlay?.classList.contains('store-transition-visible')) {
                    GameLaunchOverlay.hide();
                }
            }
            else if (data.type === 'executionLock') {
                if (Date.now() < (window._doorpiOfficialReturnSuppressUntil || 0)) {
                    GameLaunchOverlay.hide();
                    return;
                }
                const hydrated = _hydrateExecutionLockPayload(data);
                const launchOverlay = document.getElementById('gameLaunchOverlay');
                const isVisibleExecution = !!(launchOverlay &&
                    launchOverlay.classList.contains('visible') &&
                    launchOverlay.classList.contains('execution-lock-visible'));
                const hasActionableIdentity = !!(hydrated?.id || hydrated?.url);
                if (!hasActionableIdentity) {
                    return;
                }
                const hasVisualContext = !!(hydrated.heroImage || hydrated.gridImage);
                const hasIdentity = !!(hydrated.id || hydrated.url || hydrated.kind || hydrated.channel);
                const currentLock = window._lastExecutionLockData || {};
                const currentTargetKey = _executionTargetKey(currentLock);
                const incomingTargetKey = _executionTargetKey(hydrated);
                const isSameTargetVisible =
                    isVisibleExecution &&
                    !!currentTargetKey &&
                    !!incomingTargetKey &&
                    currentTargetKey === incomingTargetKey;
                if (isVisibleExecution &&
                    currentTargetKey &&
                    incomingTargetKey &&
                    currentTargetKey !== incomingTargetKey) {
                    // Overlay já está estável para uma sessão; ignoramos troca tardia
                    // para evitar flicker/alternância de contexto em Alt+Tab repetido.
                    return;
                }
                if (isVisibleExecution && !hasVisualContext && hasIdentity && window._lastExecutionLockData) {
                    return;
                }
                if (isVisibleExecution &&
                    currentTargetKey &&
                    incomingTargetKey &&
                    currentTargetKey === incomingTargetKey) {
                    if (!hydrated.heroImage && currentLock.heroImage) hydrated.heroImage = currentLock.heroImage;
                    if (!hydrated.gridImage && currentLock.gridImage) hydrated.gridImage = currentLock.gridImage;
                    if (!hydrated.name && currentLock.name) hydrated.name = currentLock.name;
                }
                if (isSameTargetVisible &&
                    (hydrated.kind || '') === (currentLock.kind || '') &&
                    (hydrated.channel || '') === (currentLock.channel || '') &&
                    (hydrated.appType || '') === (currentLock.appType || '') &&
                    (hydrated.name || '') === (currentLock.name || '') &&
                    (hydrated.heroImage || '') === (currentLock.heroImage || '') &&
                    (hydrated.gridImage || '') === (currentLock.gridImage || '')) {
                    if (data.focusActions === true) {
                        GameLaunchOverlay.focusExecutionLockActions?.();
                    }
                    return;
                }
                const currentIsGame = currentLock.channel === 'games' || currentLock.kind === 'game';
                const incomingIsGame = hydrated.channel === 'games' || hydrated.kind === 'game';
                if (isVisibleExecution && currentIsGame && !incomingIsGame && _hasActiveGameRuntimeSession()) {
                    return;
                }
                window._isExternalAppRunning = true;
                window._stopSystemAudio();
                window.isMediaAppActive = true;
                _clearExecutionOverlayCloseTimer();
                _ensureExecutionOverlayRefreshLoop();
                window._lastExecutionLockData = {
                    kind: hydrated.kind || '',
                    channel: hydrated.channel || '',
                    id: hydrated.id || '',
                    url: hydrated.url || '',
                    appType: hydrated.appType || '',
                    name: hydrated.name || '',
                    heroImage: hydrated.heroImage || '',
                    gridImage: hydrated.gridImage || ''
                };
                window._executionOverlayVisualKey = _executionOverlayVisualKeyFor(window._lastExecutionLockData);
                GameLaunchOverlay.showExecutionLock(hydrated);
            }
            else if (data.type === 'executionLockCleared') {
                _clearExecutionOverlayCloseTimer();
                // O monitor de GPU possui o ciclo de vida deste lock. Um clear
                // generico pode chegar durante trocas de janela, mas somente o
                // evento gpuUpdaterSessionEnded deve desmontar sua interface.
                if (_isGpuUpdaterExecutionLockOwned()) return;
                if (_hasAnyRuntimeSession()) {
                    _ensureExecutionOverlayRefreshLoop();
                    _refreshExecutionOverlayFromRuntime();
                    return;
                }
                // Nunca manter overlay "órfão": limpa a UI atual e só volta
                // para EM EXECUÇÃO quando houver nova confirmação oficial do host.
                window.isMediaAppActive = false;
                GameLaunchOverlay.hide();

                window._lastExecutionLockData = null;
                window._executionOverlayVisualKey = '';
                _stopExecutionOverlayRefreshLoop();
            }
            else if (data.type === 'officialReturnToDoorpi') {
                _clearExecutionOverlayCloseTimer();
                window._doorpiOfficialReturnSuppressUntil = Date.now() + 2000;
                window.isMediaAppActive = false;
                window.isGameLaunchActive = false;
                window._doorpiGameInputSuppressedUntil = 0;
                window._lastExecutionLockData = null;
                window._executionOverlayVisualKey = '';
                GameLaunchOverlay.hide();
                _stopExecutionOverlayRefreshLoop();
                scheduleDoorpiFocusRecovery();
            }
            else if (data.type === 'storeSessionReturnedToDoorpi') {
                const addModal = document.getElementById('addGameContainer');
                const modalVisible = !!(addModal && addModal.style.display !== 'none');
                if (window.isModalOpen || modalVisible) {
                    closeModal();
                }
                window.hideStoreSessionMenu?.();
                requestAnimationFrame(() => window.focusFeaturedCard?.());
            }
            else if (data.type === 'userSwitchStart') {
                const hadInteractiveSession = window._doorpiUserSessionReady === true &&
                    !!String(window._doorpiCurrentUserId || '').trim();
                const transitionMode = data.mode === 'delete'
                    ? 'delete'
                    : (hadInteractiveSession && data.mode === 'switch' ? 'switch' : 'initial');
                window._doorpiUserSessionReady = false;
                _userSwitchFadeOut({ ...data, mode: transitionMode });
            }
            else if (data.type === 'userSwitchComplete') {
                _userSwitchFadeIn(data);
                setTimeout(() => window.DoorpiUpdatePrompt?.evaluate?.(), 520);
            }

            else if (data.type === 'gameLaunchFailed') {
                const shouldMuteDoorpiAudio = _readDoorpiAudioMuteFlag(
                    data,
                    window.DoorpiRuntimeState.running.length > 0
                );
                window.isGameLaunchActive = false;
                window._doorpiGameInputSuppressedUntil = 0;
                window.isMediaAppActive = false;
                GameLaunchOverlay.setError(data.gameName, data.reason);
                window._syncSystemAudioFromRuntime(shouldMuteDoorpiAudio);
            }
            else if (data.type === 'gameLaunchDone') {
                window.isGameLaunchActive = false;
                window._doorpiGameInputSuppressedUntil = 0;
                const hasGpuUpdaterSession = (window.DoorpiRuntimeState?.running || []).some(entry =>
                    entry?.kind === 'gpuUpdater' ||
                    entry?.appType === 'gpuUpdater' ||
                    entry?.channel === 'gpu') || _isGpuUpdaterExecutionLockOwned();
                const shouldMuteDoorpiAudio = _readDoorpiAudioMuteFlag(
                    data,
                    window.DoorpiRuntimeState.running.length > 0
                );
                window._syncSystemAudioFromRuntime(shouldMuteDoorpiAudio);
                const launchOverlay = document.getElementById('gameLaunchOverlay');
                const isExecutionLockVisible = !!(launchOverlay &&
                    launchOverlay.classList.contains('visible') &&
                    launchOverlay.classList.contains('execution-lock-visible'));
                if (!hasGpuUpdaterSession &&
                    !isExecutionLockVisible &&
                    !launchOverlay?.classList.contains('store-transition-visible')) {
                    GameLaunchOverlay.hide();
                }
                if (!hasGpuUpdaterSession && !window._vkbIsOpen && !isExecutionLockVisible) {
                    recoverGlobalFocus();
                }
            }
            else if (document.getElementById('doorpiExtensionsManager')?.style.display !== 'none' && document.getElementById('extensionUrlInput')) {
                const input = document.getElementById('extensionUrlInput');
                input.value = data.text.trim();

                const btnInstall = document.getElementById('btnInstallExtension');
                if (btnInstall) {
                    // Tenta focar imediatamente
                    btnInstall.focus();

                    // Força o foco exatamente após o fechamento da janela da loja (que leva 1800ms)
                    setTimeout(() => {
                        if (document.getElementById('doorpiExtensionsManager')?.style.display !== 'none') {
                            btnInstall.focus();
                        }
                    }, 1900);

                    // Margem de segurança extra para casos onde o PC demore a renderizar o retorno
                    setTimeout(() => {
                        if (document.getElementById('doorpiExtensionsManager')?.style.display !== 'none') {
                            btnInstall.focus();
                        }
                    }, 2300);
                } else {
                    input.focus();
                }
            }



            window._mediaHandleMessage?.(data);
            window._storesHandleMessage?.(data);
            window._emulatorsHandleMessage?.(data);

            if ((data.type === 'libraryRevalidated' || data.type === 'newGamesDetected') && Array.isArray(data.games)) {
                const autoAddedGames = data.games.filter(g => g.autoAdded);
                autoAddedGames.forEach(game => {
                    const id = game.LaunchUrl || game.launchUrl || game.Path || game.path;
                    if (id) {
                        window.newGameIdsThisSession?.add(id);
                        window.AppStore?.mutations?.markNew?.(id);
                    }
                });
                if (autoAddedGames.length > 0) window._navMenuDataChanged?.('games');
            }
            else if (data.type === 'storeAutoAddSettings' && data.storeAutoAdd) {
                window._storeAutoAddSettings = data.storeAutoAdd;
            }
        } catch (e) { console.error('[bridge] Erro:', e); }
    });
