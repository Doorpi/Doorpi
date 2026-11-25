    let _doorpiSessionTransitionVersion = 0;
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

    async function _waitForDoorpiHomeReady(valid = () => true, deadline = performance.now() + 8000) {
        await _afterFrames(1);

        await window.DoorpiThemeSelection?.whenReady?.();

        // Add appears during clearGamesGrid too. Only the host's committed batch
        // distinguishes an empty library from one that has not rendered yet.
        let target = null;
        while (valid() && performance.now() < deadline) {
            const grid = _getActiveHomeGrid();
            const hasRenderableCard = !!grid?.querySelector('.card:not(.loading-card):not(.add-card)');
            const hasActiveLoadingCards = !!grid?.querySelector('.card.loading-card');
            target = window.DoorpiNavigation?.getEntryTarget?.('home') || null;
            const isHomeStillLoading = !!window.isSystemLoading || !!window.isGlobalLoading;
            const batch = window.getDoorpiGamesPresentation?.();
            const batchReady = batch?.committed && batch.profileId === String(window._doorpiCurrentUserId || '');
            const trulyEmpty = batchReady && batch.count === 0;

            if (batchReady && !isHomeStillLoading && target &&
                (hasRenderableCard || (trulyEmpty && !hasActiveLoadingCards))) break;
            target = null;
            await _delay(40);
        }
        if (!valid() || !target) return null;
        const preparedBatch = window.getDoorpiGamesPresentation?.();
        target.scrollIntoView?.({ behavior: 'instant', block: 'nearest', inline: 'nearest' });

        // Inicia o primeiro hero atrás da tela "Entrando", com uma espera curta:
        // artes ainda em download continuam sendo substituídas depois do fade.
        window.updateHomeFeatureStage?.(target);
        if (!target.classList.contains('add-card') && typeof switchHeroBackground === 'function') {
            const art = target.dataset;
            switchHeroBackground(art.staticVertical || art.vertical || '', null,
                art.staticHero || art.hero || art.staticHorizontal || art.horizontal || art.staticVertical || art.vertical || '',
                { prepareSession: true });
        }
        await _afterFrames(1);
        const visibleCards = [...(_getActiveHomeGrid()?.querySelectorAll('.card img, .store-card img') || [])]
            .filter(image => { const rect = image.getBoundingClientRect(); return rect.right > 0 && rect.left < window.innerWidth; });
        await Promise.all([
            ...visibleCards.map(image => _waitImageReady(image, 400)),
            _waitImageReady(document.getElementById('bgBlur'), 200),
            _waitImageReady(document.getElementById('heroImage'), 200),
            _waitImageReady(document.getElementById('gridBgImg'), 200)
        ]);
        await _afterFrames(1);
        if (!valid()) return null;
        if (preparedBatch !== window.getDoorpiGamesPresentation?.() || !target.isConnected)
            return performance.now() < deadline ? _waitForDoorpiHomeReady(valid, deadline) : null;
        return target;
    }

    function _focusDoorpiInteractiveTarget() {
        const userPicker = document.getElementById('doorpiUserPicker');
        if (userPicker?.style.display !== 'none' && document.body.classList.contains('user-picker-open')) {
            const active = document.activeElement;
            if (active && userPicker.contains(active) && active.offsetParent !== null) return true;
            if (typeof userPicker._doorpiFocusInitialCard === 'function')
                return userPicker._doorpiFocusInitialCard('auto');
        }

        if (!window.isDoorpiOverlayOpen?.()) {
            if (window.DoorpiNavigation) return window.DoorpiNavigation.enter('home');
            if (window.focusFeaturedCard?.() === true) return true;
        }

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
                activeClass: document.activeElement?.className || '',
                activeRegion: window.DoorpiNavigation?.getRegionId?.() ?? null
            });
        } catch { }
    }

    function _runDeferredFirstRunTutorial() {
        if (!window._doorpiFirstRunTutorialDeferred) return false;
        window._doorpiFirstRunTutorialDeferred = false;
        return window.DoorpiFirstRunTutorial?.maybeShow?.() === true;
    }

    window._releaseDoorpiSessionInputNow = function (reason = '') {
        _doorpiSessionTransitionVersion++;
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
        if (data._transitionVersion != null && data._transitionVersion !== _doorpiSessionTransitionVersion) return;
        if (data._transitionProfileId != null && data._transitionProfileId !== String(window._doorpiCurrentUserId || '')) return;
        window._doorpiSessionTransitionBlockUntil = 0;
        window._userSwitching = false;
        window._doorpiPointerSuppressUntil = 0;
        window._doorpiNativeDialogSuppressUntil = 0;
        window._doorpiGameInputSuppressedUntil = 0;
        window._doorpiIntroInputBlockUntil = 0;
        document.body.classList.remove('doorpi-session-transition');
        window.clearDoorpiInputQuarantine?.({ dropPending: true });
        window._setDoorpiHomeInteractionBlocked?.(false);

        window.scheduleDoorpiExtensionUpdateCheck?.();
        if (_runDeferredFirstRunTutorial()) {
            window.resetDoorpiGamepadInputState?.();
            return;
        }

        requestAnimationFrame(async () => {
            if (data._transitionVersion != null && data._transitionVersion !== _doorpiSessionTransitionVersion) return;
            if (data._transitionProfileId != null && data._transitionProfileId !== String(window._doorpiCurrentUserId || '')) return;
            await _waitForDoorpiInteractiveReady(data);
            if (data._transitionVersion != null && data._transitionVersion !== _doorpiSessionTransitionVersion) return;
            window.updateDoorpiTopClusterVisibility?.();
            scheduleDoorpiFocusRecovery?.();
            window.DoorpiUpdatePrompt?.evaluate?.();
        });
    }

    function _getUserSwitchOverlayCopy(mode = 'switch') {
        if (mode === 'initial') {
            return {
                mark: 'Conta',
                title: 'Entrando',
                sub: '',
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
        const image = window._doorpiProfilePhotoMarkup?.(user, '', '') ||
            (photo ? `<img src="${escapeHtml(_normalizeUserPhotoSrc(photo))}" alt="">` : '');
        if (image || user.PhotoSourceUrl) return `<div class="logout-avatar">${image}</div>`;
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

    function _profilePhotoMarkup(user = {}, className = '', alt = '') {
        const photo = user.PhotoBase64 || user.photoBase64 || '';
        const localSrc = /^(https?:|blob:)/i.test(String(photo)) ? '' : _normalizeUserPhotoSrc(photo);
        const remoteCandidate = user.AvatarFromGame
            ? (/^https:\/\//i.test(String(photo)) ? photo : '')
            : (user.PhotoSourceUrl || (/^https:\/\//i.test(String(photo)) ? photo : ''));
        let remoteSrc = '';
        try {
            const parsed = new URL(String(remoteCandidate || ''));
            if (parsed.protocol === 'https:') remoteSrc = parsed.href;
        } catch { }

        const src = remoteSrc && navigator.onLine ? remoteSrc : (localSrc || remoteSrc);
        if (!src) return '';
        const attr = value => String(value || '').replace(/[&<>"']/g, char => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[char]));
        return `<img${className ? ` class="${attr(className)}"` : ''} src="${attr(src)}" alt="${attr(alt)}" data-doorpi-profile-photo="true" data-doorpi-photo-url="${attr(remoteSrc)}" data-doorpi-photo-local="${attr(localSrc)}">`;
    }
    window._doorpiProfilePhotoMarkup = _profilePhotoMarkup;

    document.addEventListener('error', event => {
        const image = event.target;
        if (!(image instanceof HTMLImageElement) || image.dataset.doorpiProfilePhoto !== 'true') return;
        const localSrc = image.dataset.doorpiPhotoLocal || '';
        if (localSrc && image.src !== localSrc) {
            image.src = localSrc;
            return;
        }
        image.hidden = true;
    }, true);

    window.addEventListener('online', () => {
        document.querySelectorAll('img[data-doorpi-profile-photo="true"][data-doorpi-photo-url]')
            .forEach(image => {
                const remoteSrc = image.dataset.doorpiPhotoUrl || '';
                if (remoteSrc && image.src !== remoteSrc) {
                    image.hidden = false;
                    image.src = remoteSrc;
                }
            });
    });

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
                <div class="logout-sub"${copy.sub ? '' : ' hidden'}>${copy.sub}</div>
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
            if (sub) { sub.textContent = copy.sub; sub.hidden = !copy.sub; }
        }
        overlay.dataset.transitionMode = mode;
        return overlay;
    }

    function _userSwitchFadeOut(data = {}) {
        _doorpiSessionTransitionVersion++;
        if (data.showTransition === false) return;
        if (!data.reuseCurrentLibrary) window.resetDoorpiGamesPresentation?.();
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
        logoutOverlay.classList.remove('home-entry-recovery', 'doorpi-manager-overlay');
        logoutOverlay.querySelector('.logout-recovery-actions')?.remove();
        logoutOverlay.querySelector('.logout-spinner').hidden = false;
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

    window.isDoorpiHomeEntryRecoveryOpen = () => {
        const overlay = document.getElementById('doorpiUserSwitchLogout');
        return !!overlay && overlay.style.display !== 'none' && overlay.classList.contains('home-entry-recovery');
    };

    function _showDoorpiHomeEntryRecovery(data, valid) {
        if (!valid()) return;
        const overlay = document.getElementById('doorpiUserSwitchLogout');
        if (!overlay) return;
        overlay.style.display = 'flex'; overlay.style.pointerEvents = 'auto';
        overlay.classList.add('visible', 'home-entry-recovery', 'doorpi-manager-overlay');
        overlay.querySelector('.logout-sub').textContent = t('sessionHomePrepareError');
        overlay.querySelector('.logout-sub').hidden = false;
        overlay.querySelector('.logout-spinner').hidden = true;
        overlay.querySelector('.logout-recovery-actions')?.remove();
        const actions = document.createElement('div'); actions.className = 'logout-recovery-actions';
        const retry = document.createElement('button'); retry.textContent = t('sessionHomePrepareRetry');
        retry.onclick = () => { if (valid()) void _userSwitchFadeIn({ ...data, _delayed: true }); };
        actions.appendChild(retry);
        if (Array.isArray(window._doorpiUsers) && window._doorpiUsers.length) {
            const back = document.createElement('button'); back.textContent = t('sessionHomePrepareProfiles');
            back.dataset.recoveryAction = 'profiles';
            back.onclick = () => {
                if (!valid()) return;
                _doorpiSessionTransitionVersion++; window._userSwitching = false;
                document.body.classList.remove('doorpi-session-transition');
                overlay.classList.remove('visible', 'home-entry-recovery', 'doorpi-manager-overlay');
                overlay.style.display = 'none';
                window.DoorpiIntro?.resumeUserPickerAmbient?.();
                showUserPicker(window._doorpiUsers, true);
            };
            actions.appendChild(back);
        }
        overlay.appendChild(actions); retry.focus();
    }

    async function _userSwitchFadeIn(data = {}) {
        if (data._transitionVersion != null && data._transitionVersion !== _doorpiSessionTransitionVersion) return;
        if (data._transitionProfileId != null && data._transitionProfileId !== String(window._doorpiCurrentUserId || '')) return;
        if (data.mode === 'initial' && data.showTransition !== false && !window._userSwitching)
            _userSwitchFadeOut({ mode: 'initial', user: window._doorpiProfile || {}, reuseCurrentLibrary: true });
        const version = data._transitionVersion ?? _doorpiSessionTransitionVersion;
        const profile = data._transitionProfileId ?? String(window._doorpiCurrentUserId || '');
        const valid = () => version === _doorpiSessionTransitionVersion && profile === String(window._doorpiCurrentUserId || '');
        if (!valid()) return;
        data = { ...data, _transitionVersion: version, _transitionProfileId: profile };
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

        const wrap = document.querySelector('.main-content-wrapper');
        const ui = document.getElementById('doorpi-app-ui');
        const logoutOverlay = document.getElementById('doorpiUserSwitchLogout');
        if (ui) { ui.style.transition = 'none'; ui.style.display = 'block'; ui.style.opacity = '1'; }
        if (logoutOverlay) {
            logoutOverlay.classList.remove('home-entry-recovery', 'doorpi-manager-overlay');
            logoutOverlay.querySelector('.logout-recovery-actions')?.remove();
            logoutOverlay.querySelector('.logout-spinner').hidden = false;
            const sub = logoutOverlay.querySelector('.logout-sub');
            sub.textContent = _getUserSwitchOverlayCopy(logoutOverlay.dataset.transitionMode || data.mode).sub;
            sub.hidden = !sub.textContent;
        }
        window._setDoorpiHomeInteractionBlocked?.(true);
        const target = await _waitForDoorpiHomeReady(valid);
        if (!valid()) return;
        if (!wrap || !target) { _showDoorpiHomeEntryRecovery(data, valid); return; }

        await window.prepareDoorpiNavMenuEntry?.(valid);
        if (!valid()) return;

        const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        const remaining = reducedMotion ? 0 : Math.max(0, 120 - (performance.now() - (window._userSwitchStartedAt || 0)));
        if (remaining) await _delay(remaining);
        if (!valid()) return;
        wrap.style.setProperty('transition', 'none', 'important');
        wrap.style.opacity = '0'; wrap.style.transform = 'translateY(4px)';
        void wrap.offsetWidth;
        wrap.style.setProperty('transition', reducedMotion ? 'none' : 'opacity .12s ease, transform .18s cubic-bezier(.22,1,.36,1)', 'important');
        wrap.style.opacity = '1'; wrap.style.transform = 'none';
        window.DoorpiIntro?.finishHandoff?.({ fadeMs: reducedMotion ? 0 : 180 });
        logoutOverlay?.classList.remove('visible');
        // Keep input/inert locked during the crossfade, not just during loading.
        if (!reducedMotion) await _delay(180);
        if (!valid()) return;
        if (logoutOverlay) { logoutOverlay.style.display = 'none'; logoutOverlay.style.pointerEvents = 'none'; }
        window._userSwitching = false;
        document.body.classList.remove('doorpi-session-transition');
        window._setDoorpiHomeInteractionBlocked?.(false);
        if (!window.DoorpiNavigation?.enter('home')) {
            window._userSwitching = true; document.body.classList.add('doorpi-session-transition');
            window._setDoorpiHomeInteractionBlocked?.(true);
            _showDoorpiHomeEntryRecovery(data, valid); return;
        }
        wrap.style.removeProperty('transition'); wrap.style.transform = '';
        window._doorpiAllowLibraryRenderDuringSessionTransition = false;
        resumeTransitionAudio();
        await _completeUserSwitchInteraction(data);
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
            window.clearHomeFeatureLogo?.();
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
    // Moving to Add or the system controls keeps the last selection's artwork.
    // Session resets and screen changes still clear it explicitly through clearHero.


