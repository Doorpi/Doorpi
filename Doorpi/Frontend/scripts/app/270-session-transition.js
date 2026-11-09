    function _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function _nextFrame() {
        return new Promise(resolve => requestAnimationFrame(() => resolve()));
    }

    async function _afterFrames(count = 1) {
        for (let i = 0; i < count; i++) await _nextFrame();
    }

    function _getActiveHomeGrid() {
        const currentTab = (typeof window.getCurrentHomeTab === 'function') ? window.getCurrentHomeTab() : 'games';
        const gridId = typeof window.getHomeGridId === 'function'
            ? window.getHomeGridId(currentTab)
            : (currentTab === 'media' ? 'mediaGrid' : (currentTab === 'stores' ? 'storesGrid' : 'gameGrid'));
        return document.getElementById(gridId) || document.getElementById('gameGrid');
    }

    function _isImageReady(img) {
        if (!img || !img.src) return true;
        if (img.complete && img.naturalWidth > 0) return true;
        if (img.src.startsWith('data:image/svg+xml')) return true;
        return false;
    }

    function _waitImageReady(img, timeoutMs = 900) {
        if (_isImageReady(img)) return Promise.resolve();
        return new Promise(resolve => {
            let done = false;
            const finish = () => {
                if (done) return;
                done = true;
                img.removeEventListener('load', finish);
                img.removeEventListener('error', finish);
                resolve();
            };
            img.addEventListener('load', finish, { once: true });
            img.addEventListener('error', finish, { once: true });
            if (typeof img.decode === 'function') img.decode().then(finish).catch(() => { });
            setTimeout(finish, timeoutMs);
        });
    }

    async function _waitForDoorpiHomeReady() {
        const started = performance.now();
        await _afterFrames(1);

        // Libera assim que a aba ativa possui uma superfície utilizável. Downloads,
        // esqueletos de outras abas e renders em segundo plano não bloqueiam a entrada.
        while (performance.now() - started < 1000) {
            const grid = _getActiveHomeGrid();
            const hasRenderableCard = !!grid?.querySelector('.card:not(.loading-card)');
            const hasActiveLoadingCards = !!grid?.querySelector('.card.loading-card');
            const hasNavigableTarget = typeof getNavigableItems === 'function' &&
                getNavigableItems().some(el =>
                    el &&
                    el.offsetWidth > 0 &&
                    el.offsetHeight > 0 &&
                    !el.disabled &&
                    el.getAttribute('aria-disabled') !== 'true');
            const isHomeStillLoading = !!window.isSystemLoading || !!window.isGlobalLoading;

            if (!isHomeStillLoading &&
                (hasRenderableCard || (!hasActiveLoadingCards && hasNavigableTarget))) break;
            await _delay(40);
        }

        // Inicia o primeiro hero atrás da tela "Entrando", com uma espera curta:
        // artes ainda em download continuam sendo substituídas depois do fade.
        _focusDoorpiInteractiveTarget();
        await _afterFrames(1);
        await Promise.all([
            _waitImageReady(document.getElementById('bgBlur'), 200),
            _waitImageReady(document.getElementById('heroImage'), 200),
            _waitImageReady(document.getElementById('gridBgImg'), 200)
        ]);
        await _afterFrames(1);
    }

    function _focusDoorpiInteractiveTarget() {
        const userPicker = document.getElementById('doorpiUserPicker');
        if (userPicker?.style.display !== 'none' && document.body.classList.contains('user-picker-open')) {
            const active = document.activeElement;
            if (active && userPicker.contains(active) && active.offsetParent !== null) return true;
            if (typeof userPicker._doorpiFocusInitialCard === 'function')
                return userPicker._doorpiFocusInitialCard('auto');
        }

        if (!window.isDoorpiOverlayOpen?.() && window.focusFeaturedCard?.() === true)
            return true;

        const items = typeof getNavigableItems === 'function'
            ? getNavigableItems().filter(el =>
                el &&
                el.offsetWidth > 0 &&
                el.offsetHeight > 0 &&
                !el.disabled &&
                el.getAttribute('aria-disabled') !== 'true')
            : [];

        const target = items[0] || null;
        if (target) {
            target.focus();
            target.scrollIntoView?.({ behavior: 'instant', block: 'nearest', inline: 'nearest' });
            return document.activeElement === target;
        }

        return window.focusFeaturedCard?.() === true;
    }

    async function _waitForDoorpiInteractiveReady(data = {}) {
        _focusDoorpiInteractiveTarget();

        window.resetDoorpiGamepadInputState?.();
        try {
            postToHost({
                action: 'doorpiHomeInteractiveReady',
                mode: data.mode || '',
                activeTag: document.activeElement?.tagName || '',
                activeId: document.activeElement?.id || '',
                activeClass: document.activeElement?.className || ''
            });
        } catch { }
    }

    function _runDeferredFirstRunTutorial() {
        if (!window._doorpiFirstRunTutorialDeferred) return false;
        window._doorpiFirstRunTutorialDeferred = false;
        return window.DoorpiFirstRunTutorial?.maybeShow?.() === true;
    }

    window._releaseDoorpiSessionInputNow = function (reason = '') {
        window._doorpiSessionTransitionBlockUntil = 0;
        window._userSwitching = false;
        window._doorpiPointerSuppressUntil = 0;
        window._doorpiNativeDialogSuppressUntil = 0;
        window._doorpiGameInputSuppressedUntil = 0;
        window._doorpiIntroInputBlockUntil = 0;
        window.isGameLaunchActive = false;
        document.body.classList.remove('doorpi-session-transition');
        window.clearDoorpiInputQuarantine?.({ dropPending: true });
        const wrap = document.querySelector('.main-content-wrapper');
        if (wrap) {
            wrap.style.pointerEvents = '';
            if (wrap.style.opacity === '0') wrap.style.opacity = '1';
            if (wrap.style.transform) wrap.style.transform = '';
        }
        const logoutOverlay = document.getElementById('doorpiUserSwitchLogout');
        if (logoutOverlay) {
            logoutOverlay.classList.remove('visible');
            logoutOverlay.style.pointerEvents = 'none';
            logoutOverlay.style.display = 'none';
        }
        window.DoorpiIntro?.finishHandoff?.();
        window._setDoorpiHomeInteractionBlocked?.(false);
        requestAnimationFrame(() => {
            window.resetDoorpiGamepadInputState?.();
            _focusDoorpiInteractiveTarget();
            window.updateDoorpiTopClusterVisibility?.();
            try {
                postToHost({
                    action: 'doorpiHomeInteractiveReady',
                    mode: reason || 'session-input-released',
                    activeTag: document.activeElement?.tagName || '',
                    activeId: document.activeElement?.id || '',
                    activeClass: document.activeElement?.className || ''
                });
            } catch { }
        });
    };

    async function _completeUserSwitchInteraction(data = {}) {
        window._doorpiSessionTransitionBlockUntil = 0;
        window._userSwitching = false;
        window._doorpiPointerSuppressUntil = 0;
        window._doorpiNativeDialogSuppressUntil = 0;
        window._doorpiGameInputSuppressedUntil = 0;
        window._doorpiIntroInputBlockUntil = 0;
        document.body.classList.remove('doorpi-session-transition');
        window.clearDoorpiInputQuarantine?.({ dropPending: true });
        window._setDoorpiHomeInteractionBlocked?.(false);

        if (_runDeferredFirstRunTutorial()) {
            window.resetDoorpiGamepadInputState?.();
            return;
        }

        requestAnimationFrame(async () => {
            await _waitForDoorpiInteractiveReady(data);
            window.updateDoorpiTopClusterVisibility?.();
            scheduleDoorpiFocusRecovery?.();
        });
    }

    function _getUserSwitchOverlayCopy(mode = 'switch') {
        if (mode === 'initial') {
            return {
                mark: 'Conta',
                title: 'Entrando',
                sub: 'Preparando sua tela inicial',
            };
        }

        if (mode === 'delete') {
            return {
                mark: typeof t === 'function' ? t('sessionDeleteMark') : 'Conta',
                title: typeof t === 'function' ? t('sessionDeleteTitle') : 'Encerrando sessão para excluir',
                sub: typeof t === 'function' ? t('sessionDeleteSubtitle') : 'Fechando processos e preparando a exclusão desta conta',
            };
        }

        return {
            mark: typeof t === 'function' ? t('sessionTransitionMark') : 'Sessão',
            title: typeof t === 'function' ? t('sessionSwitchTitle') : 'Trocando sessão',
            sub: typeof t === 'function' ? t('logoutSubtitle') : 'Encerrando sessão atual',
        };
    }

    function _userSwitchAvatarHtml(user = {}) {
        const photo = user.PhotoBase64 || user.photoBase64 || '';
        const name = user.Name || user.name || '';
        if (photo) return `<div class="logout-avatar"><img src="${escapeHtml(_normalizeUserPhotoSrc(photo))}" alt=""></div>`;
        const initial = (name || 'D').trim().charAt(0).toUpperCase() || 'D';
        return `<div class="logout-avatar logout-avatar-fallback">${escapeHtml(initial)}</div>`;
    }

    function _normalizeUserPhotoSrc(photo) {
        const value = String(photo || '').trim();
        if (!value) return '';
        if (/^(data:|blob:|https?:)/i.test(value)) return value;
        if (value.startsWith('/9j/')) return `data:image/jpeg;base64,${value}`;
        if (value.startsWith('UklGR')) return `data:image/webp;base64,${value}`;
        if (value.startsWith('R0lGOD')) return `data:image/gif;base64,${value}`;
        return `data:image/png;base64,${value}`;
    }
    window._doorpiUserPhotoSrc = _normalizeUserPhotoSrc;

    function _ensureUserSwitchLogoutOverlay(mode = 'switch', user = {}) {
        const copy = _getUserSwitchOverlayCopy(mode);
        const userName = String(user.Name || user.name || '').trim();
        const markText = userName || copy.mark;
        let overlay = document.getElementById('doorpiUserSwitchLogout');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'doorpiUserSwitchLogout';
            overlay.innerHTML = `
                <div class="logout-title">${copy.title}</div>
                <div class="logout-mark">${escapeHtml(markText)}</div>
                <div class="logout-avatar-slot">${_userSwitchAvatarHtml(user)}</div>
                <div class="logout-sub">${copy.sub}</div>
                <div class="logout-spinner" aria-hidden="true"></div>
            `;
            document.body.appendChild(overlay);
        } else {
            const mark = overlay.querySelector('.logout-mark');
            const title = overlay.querySelector('.logout-title');
            const sub = overlay.querySelector('.logout-sub');
            const avatar = overlay.querySelector('.logout-avatar-slot');
            if (avatar) avatar.innerHTML = _userSwitchAvatarHtml(user);
            if (mark) mark.textContent = markText;
            if (title) title.textContent = copy.title;
            if (sub) sub.textContent = copy.sub;
        }
        return overlay;
    }

    function _userSwitchFadeOut(data = {}) {
        if (data.showTransition === false) return;
        closeUserPinPrompt({ immediate: true, restoreFocus: false });
        // Limpa o hero na hora, sem delay, e bloqueia novos switches
        window._userSwitching = true;
        document.body.classList.add('doorpi-session-transition');
        window._doorpiAllowLibraryRenderDuringSessionTransition = true;
        window._userSwitchStartedAt = performance.now();
        window._stopSystemAudio?.();
        _currentBgSrc = '';
        if (typeof _heroReqId !== 'undefined') _heroReqId++;

        const heroImg = document.getElementById('heroImage');
        const bgBlur = document.getElementById('bgBlur');
        const logoEl = document.getElementById('gameLogo');
        const gridBg = document.getElementById('gridBgImg');

        if (heroImg) heroImg.style.opacity = '0';
        if (bgBlur) { bgBlur.style.opacity = '0'; bgBlur.removeAttribute('src'); }
        if (logoEl) logoEl.classList.remove('visible');
        if (gridBg) gridBg.removeAttribute('src');
        window._stopBlobBg?.();
        window.DoorpiIntro?.startUserPickerAmbient?.();
        window.DoorpiIntro?.freezeUserPickerAmbient?.();

        const userPicker = document.getElementById('doorpiUserPicker');
        if (userPicker?.style.display !== 'none') userPicker.classList.add('doorpi-switching-out');

        const logoutOverlay = _ensureUserSwitchLogoutOverlay(data.mode || 'switch', data.user || window._doorpiProfile || {});
        logoutOverlay.style.display = 'flex';
        logoutOverlay.style.pointerEvents = 'auto';
        window._setDoorpiHomeInteractionBlocked?.(true);
        logoutOverlay.classList.add('visible');

        const wrap = document.querySelector('.main-content-wrapper');
        if (!wrap) return;
        wrap.style.opacity = '0';
        wrap.style.transform = 'scale(0.97) translateY(-10px)';
        wrap.style.pointerEvents = 'none';
    }

    async function _userSwitchFadeIn(data = {}) {
        const shouldShowTransition = data.showTransition !== false && window._userSwitching;
        const shouldRestartAudio = !!data.restartAudio;
        const resumeTransitionAudio = () => {
            window._isDoorpiFocused = true;
            window.isDoorpiFocused = true;
            if (shouldRestartAudio) window._restartSystemAudioForNewSession?.();
            else window._startSystemAudio?.(true);
        };

        if (shouldShowTransition && data.mode === 'delete' && !data._delayed) {
            const minVisibleMs = Number.isFinite(data.minVisibleMs) ? data.minVisibleMs : 900;
            const elapsed = performance.now() - (window._userSwitchStartedAt || performance.now());
            if (elapsed < minVisibleMs) {
                setTimeout(() => _userSwitchFadeIn({ ...data, _delayed: true }), minVisibleMs - elapsed);
                return;
            }
        }

        if (shouldShowTransition) {
            window._doorpiSessionTransitionBlockUntil = 0;
            window._userSwitching = false;
            document.body.classList.remove('doorpi-session-transition');
            const wrap = document.querySelector('.main-content-wrapper');
            if (wrap) wrap.style.pointerEvents = '';
        }

        if (!shouldShowTransition) {
            const wrap = document.querySelector('.main-content-wrapper');
            if (wrap) {
                wrap.style.opacity = '1';
                wrap.style.transform = '';
                wrap.style.pointerEvents = '';
                wrap.style.removeProperty('transition');
            }
            const logoutOverlay = document.getElementById('doorpiUserSwitchLogout');
            if (logoutOverlay) {
                logoutOverlay.classList.remove('visible');
                logoutOverlay.style.pointerEvents = 'none';
                setTimeout(() => {
                    if (!logoutOverlay.classList.contains('visible')) {
                        logoutOverlay.style.display = 'none';
                    }
                }, 300);
            }
            resumeTransitionAudio();
            window._doorpiAllowLibraryRenderDuringSessionTransition = false;
            window._setDoorpiHomeInteractionBlocked?.(false);
            window.DoorpiIntro?.finishHandoff?.();
            await _completeUserSwitchInteraction(data);
            return;
        }

        const minVisibleMs = Number.isFinite(data.minVisibleMs)
            ? data.minVisibleMs
            : (data.mode === 'delete' ? 900 : 0);
        const elapsed = performance.now() - (window._userSwitchStartedAt || performance.now());
        if (!data._delayed && elapsed < minVisibleMs) {
            setTimeout(() => _userSwitchFadeIn({ ...data, _delayed: true }), minVisibleMs - elapsed);
            return;
        }

        const userPicker = document.getElementById('doorpiUserPicker');
        const returnToRequiredUserPicker =
            data.mode === 'delete' &&
            userPicker?.style.display !== 'none' &&
            userPicker?.dataset.required === 'true';
        if (returnToRequiredUserPicker) {
            window._doorpiSessionTransitionBlockUntil = 0;
            window._userSwitching = false;
            window._doorpiPointerSuppressUntil = 0;
            window._doorpiNativeDialogSuppressUntil = 0;
            window._doorpiGameInputSuppressedUntil = 0;
            window._doorpiIntroInputBlockUntil = 0;
            document.body.classList.remove('doorpi-session-transition');
            userPicker.classList.remove('doorpi-switching-out');

            const wrap = document.querySelector('.main-content-wrapper');
            if (wrap) {
                wrap.style.opacity = '0';
                wrap.style.transform = '';
                wrap.style.pointerEvents = 'none';
                wrap.style.removeProperty('transition');
            }

            const logoutOverlay = document.getElementById('doorpiUserSwitchLogout');
            if (logoutOverlay) {
                logoutOverlay.classList.remove('visible');
                logoutOverlay.style.pointerEvents = 'none';
                setTimeout(() => {
                    if (!logoutOverlay.classList.contains('visible')) logoutOverlay.style.display = 'none';
                }, 300);
            }

            window._doorpiAllowLibraryRenderDuringSessionTransition = false;
            window._setDoorpiHomeInteractionBlocked?.(false);
            window.DoorpiIntro?.resumeUserPickerAmbient?.();
            resumeTransitionAudio();
            window.clearDoorpiInputQuarantine?.({ dropPending: true });

            requestAnimationFrame(() => requestAnimationFrame(() => {
                userPicker._doorpiFocusInitialCard?.('auto');
                window.resetDoorpiGamepadInputState?.();
                window.updateDoorpiTopClusterVisibility?.();
            }));
            return;
        }

        if (data.waitForHomeReady === true && !data._homeReadyWaited) {
            try { await _waitForDoorpiHomeReady(); } catch { }
            _userSwitchFadeIn({ ...data, _homeReadyWaited: true, _delayed: true });
            return;
        }

        const wrap = document.querySelector('.main-content-wrapper');
        if (!wrap) {
            const logoutOverlay = document.getElementById('doorpiUserSwitchLogout');
            if (logoutOverlay) {
                logoutOverlay.classList.remove('visible');
                logoutOverlay.style.pointerEvents = 'none';
                logoutOverlay.style.display = 'none';
            }
            resumeTransitionAudio();
            window._doorpiAllowLibraryRenderDuringSessionTransition = false;
            window._setDoorpiHomeInteractionBlocked?.(false);
            window.DoorpiIntro?.finishHandoff?.();
            await _completeUserSwitchInteraction(data);
            return;
        }

        wrap.style.setProperty('transition', 'none', 'important');
        wrap.style.opacity = '0';
        wrap.style.transform = 'scale(0.98) translateY(10px)'; 

        void wrap.offsetWidth;

        wrap.style.setProperty(
            'transition',
            'opacity 0.25s ease, transform 0.3s cubic-bezier(0.23, 1, 0.32, 1)',
            'important'
        );
        wrap.style.opacity = '1';
        wrap.style.transform = 'none';
        wrap.style.pointerEvents = '';

        const logoutOverlay = document.getElementById('doorpiUserSwitchLogout');
        if (logoutOverlay) {
            logoutOverlay.classList.remove('visible');
            logoutOverlay.style.pointerEvents = 'none';
            setTimeout(() => {
                if (!logoutOverlay.classList.contains('visible')) {
                    logoutOverlay.style.display = 'none';
                }
            }, 300);
        }

        requestAnimationFrame(async () => {
            wrap.style.removeProperty('transition');
            wrap.style.transform = '';
            window._doorpiAllowLibraryRenderDuringSessionTransition = false;
            window._setDoorpiHomeInteractionBlocked?.(false);
            resumeTransitionAudio();
            window.DoorpiIntro?.finishHandoff?.();
            await _completeUserSwitchInteraction(data);
        });
    }

    function clearLoadingCards(tab = 'games') {
        const gridId = tab === 'games' ? 'gameGrid' : 'mediaGrid';
        const grid = document.getElementById(gridId);
        if (!grid) return;
        grid.querySelectorAll('.card.loading-card').forEach(c => c.remove());
    }
    function clearHero(instant = false) {
        const isNavMenuActive =
            document.body.classList.contains('nav-menu-active') ||
            document.body.classList.contains('nav-menu-closing') ||
            window.isNavMenuOpen;
 
        if (isNavMenuActive && !instant) return;

        if (window._heroCleanupTimer) {
            clearTimeout(window._heroCleanupTimer);
            window._heroCleanupTimer = null;
        }

        const doClear = () => {
            const bgBlur = document.getElementById('bgBlur');
            const heroImg = document.getElementById('heroImage');
            const logoEl = document.getElementById('gameLogo');
            const gridBgImg = document.getElementById('gridBgImg');

            if (bgBlur) { bgBlur.style.opacity = '0'; bgBlur.removeAttribute('src'); }
            if (heroImg) { heroImg.style.opacity = '0'; }
            if (logoEl) { logoEl.classList.remove('visible'); logoEl.style.opacity = ''; }
            if (gridBgImg) { gridBgImg.style.opacity = '0'; gridBgImg.removeAttribute('src'); }

            cancelHeroTransition(); 

            _currentBgSrc = '';
            if (typeof _heroReqId !== 'undefined') _heroReqId++;
        };

        if (instant === true) {
            doClear();
        } else {
            window._heroCleanupTimer = setTimeout(doClear, 80);
        }
    }
    document.getElementById('btnAdd')?.addEventListener('mouseenter', clearHero);
    document.getElementById('btnAdd')?.addEventListener('focus', clearHero);

    document.getElementById('btnAddMedia')?.addEventListener('mouseenter', clearHero);
    document.getElementById('btnAddMedia')?.addEventListener('focus', clearHero);


