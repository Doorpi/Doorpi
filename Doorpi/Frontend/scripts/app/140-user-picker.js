function showUserPicker(users, requireSelection = false) {
    if (window.DoorpiIntro?.shouldDeferUserPicker?.()) {
        window.DoorpiIntro.runAfterIntro(() => showUserPicker(users, requireSelection));
        return;
    }

    if (requireSelection) {
        window._doorpiUserSessionReady = false;
        window.setDoorpiSessionLocked?.(true);
    }
    const openedAt = performance.now();
    const blockInheritedActivationUntil = openedAt + 420;
    const blockStrayPointerReleaseUntil = openedAt + 1500;
    let pointerDownAfterOpen = false;
    let suppressNextPointerClick = false;

    ensureDoorpiOverlayStyles();
    let overlay = document.getElementById('doorpiUserPicker');
    if (!window.DoorpiIntro?.isHandoffActive?.() && !window.DoorpiIntro?.isRunning?.()) {
        window.DoorpiIntro?.startUserPickerAmbient?.();
    }
    const introHandoffClasses = window.DoorpiIntro?.isHandoffActive?.()
        ? (window.DoorpiIntro?.getUserPickerClasses?.() || [])
        : [];
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'doorpiUserPicker';
        overlay.className = ['doorpi-user-overlay', ...introHandoffClasses].join(' ');

        // Controle de navegação forçado (Fase de Captura)
        overlay.addEventListener('keydown', (e) => {
            const active = document.activeElement || document.body;

            if (e.key === 'ArrowDown') {
                const isUserCard = active.closest('.doorpi-user-card');
                const isBackBtn = active.closest('#doorpiCloseUsers');

                if (isUserCard) {
                    e.preventDefault();
                    e.stopPropagation();
                    overlay.querySelector('.doorpi-power-btn')?.focus();
                } else if (isBackBtn) {
                    e.preventDefault();
                    e.stopPropagation();
                    overlay.querySelector('.doorpi-power-btn')?.focus();
                }
            } else if (e.key === 'ArrowUp') {
                const isPowerBtn = active.closest('.doorpi-power-btn');
                const isBackBtn = active.closest('#doorpiCloseUsers');

                if (isPowerBtn || isBackBtn) {
                    e.preventDefault();
                    e.stopPropagation();

                    const userCards = Array.from(overlay.querySelectorAll('.doorpi-user-card'));
                    if (userCards.length) {
                        const activeRect = active.getBoundingClientRect();
                        let bestCard = userCards[0];
                        let minDiff = Infinity;
                        userCards.forEach(c => {
                            const cRect = c.getBoundingClientRect();
                            const diff = Math.abs((cRect.left + cRect.width / 2) - (activeRect.left + activeRect.width / 2));
                            if (diff < minDiff) {
                                minDiff = diff;
                                bestCard = c;
                            }
                        });
                        overlay._doorpiUserCenterBehavior = 'smooth';
                        bestCard.focus({ preventScroll: true });
                    }
                }
            } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                const isUserCard = active.closest('.doorpi-user-card');
                if (isUserCard) {
                    e.preventDefault();
                    e.stopPropagation();
                    const userCards = Array.from(overlay.querySelectorAll('.doorpi-user-card'));
                    const currentIndex = userCards.indexOf(isUserCard);

                    if (currentIndex !== -1) {
                        overlay._doorpiUserCenterBehavior = 'smooth';
                        if (e.key === 'ArrowLeft') {
                            const prevIndex = currentIndex > 0 ? currentIndex - 1 : userCards.length - 1;
                            userCards[prevIndex].focus({ preventScroll: true });
                        } else {
                            const nextIndex = currentIndex < userCards.length - 1 ? currentIndex + 1 : 0;
                            userCards[nextIndex].focus({ preventScroll: true });
                        }
                    }
                }
            }
        }, true);

        document.body.appendChild(overlay);
    } else {
        overlay.className = ['doorpi-user-overlay', ...introHandoffClasses].join(' ');
    }

    const shouldBlockInheritedUserPickerActivation = (event = null) => {
        const now = performance.now();
        const type = event?.type || '';

        if (now < (overlay._doorpiUserPickerBlockUntil || 0)) return true;
        if (type === 'click' && suppressNextPointerClick) {
            suppressNextPointerClick = false;
            return true;
        }
        return false;
    };

    const handleUserPickerActivationGuard = (event) => {
        const now = performance.now();
        const type = event?.type || '';
        const isPointerStart = type === 'pointerdown' || type === 'mousedown' || type === 'touchstart';
        const isPointerEnd = type === 'pointerup' || type === 'mouseup' || type === 'touchend';

        if (isPointerStart) {
            pointerDownAfterOpen = true;
            if (now < blockInheritedActivationUntil) {
                suppressNextPointerClick = true;
                event.preventDefault();
                event.stopImmediatePropagation();
            }
            return;
        }

        if (isPointerEnd) {
            if (now < blockInheritedActivationUntil || (!pointerDownAfterOpen && now < blockStrayPointerReleaseUntil)) {
                suppressNextPointerClick = true;
                event.preventDefault();
                event.stopImmediatePropagation();
            }
            return;
        }

        if (shouldBlockInheritedUserPickerActivation(event)) {
            event.preventDefault();
            event.stopImmediatePropagation();
        }
    };

    const guardedActivationEvents = ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'click'];
    if (overlay._doorpiUserPickerActivationGuard) {
        guardedActivationEvents.forEach(type => {
            overlay.removeEventListener(type, overlay._doorpiUserPickerActivationGuard, true);
        });
    }
    overlay._doorpiUserPickerActivationGuard = handleUserPickerActivationGuard;
    overlay._doorpiUserPickerBlockUntil = blockInheritedActivationUntil;
    guardedActivationEvents.forEach(type => {
        overlay.addEventListener(type, handleUserPickerActivationGuard, true);
    });

    overlay.dataset.required = requireSelection ? 'true' : 'false';
    overlay.dataset.returnToQuickPanel = (window._doorpiUserPickerReturnToQuickPanel && !requireSelection) ? 'true' : 'false';
    window._doorpiUserPickerReturnToQuickPanel = false;

    const activeSessionUserId = window._doorpiUserSessionReady
        ? String(window._doorpiCurrentUserId || '').toLowerCase()
        : '';
    const carouselItemCount = users.length + 1;
    const preferredFocusIndex = Math.max(0, Math.floor((carouselItemCount - 1) / 2));
    const orderedUsers = [...users];
    if (activeSessionUserId) {
        const activeUserIndex = orderedUsers.findIndex(user =>
            String(user.Id || '').toLowerCase() === activeSessionUserId
        );
        if (activeUserIndex >= 0 && activeUserIndex !== preferredFocusIndex) {
            const [activeUser] = orderedUsers.splice(activeUserIndex, 1);
            orderedUsers.splice(Math.min(preferredFocusIndex, orderedUsers.length), 0, activeUser);
        }
    }
    const cards = orderedUsers.map((user, idx) => {
        const isCurrent = !!activeSessionUserId && String(user.Id || '').toLowerCase() === activeSessionUserId;
        return `
        <button class="doorpi-user-card${isCurrent ? ' is-current' : ''}" data-user-id="${escapeHtml(user.Id)}" tabindex="0"${isCurrent ? ' aria-current="true"' : ''} style="animation-delay: ${idx * 0.03}s">
            ${avatarMarkup(user)}
            <span class="doorpi-user-name">${escapeHtml(user.Name)}</span>
        </button>`;
    }).join('');

    const createUserDelay = users.length * 0.03;

    const svgExit = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`;
    const svgSleep = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
    const svgRestart = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.84"/></svg>`;
    const svgShutdown = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>`;
    overlay.innerHTML = `
            <div class="doorpi-user-panel">
                <div class="doorpi-user-clock" aria-live="off"></div>
                <div class="doorpi-user-main">
                    <div class="doorpi-panel-head">
                        <h2 class="doorpi-panel-title">${t('whoIsPlaying')}</h2>
                        <p class="doorpi-panel-sub">${t('welcomeBack')}</p>
                    </div>
                    <div class="doorpi-user-picker-layout">
                        <div class="doorpi-user-scroll-area">
                            <div class="doorpi-user-track">
                                <div class="doorpi-user-snap-spacer" aria-hidden="true"></div>
                                ${cards}
                                <button class="doorpi-user-card create-card" id="doorpiCreateUserCard" tabindex="0" style="animation-delay: ${createUserDelay}s">
                                    <div class="doorpi-avatar"><div class="doorpi-create-user-icon">+</div></div>
                                    <span class="doorpi-user-name">${t('newUser')}</span>
                                </button>
                                <div class="doorpi-user-snap-spacer" aria-hidden="true"></div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="doorpi-user-footer">
                    ${requireSelection ? '' : `<button class="doorpi-manager-btn" id="doorpiCloseUsers" tabindex="0" style="animation: doorpiCardRise 0.5s backwards; animation-delay: ${(createUserDelay + 0.1)}s">${t('btnBackLabel')}</button>`}
                    <div class="doorpi-power-row" style="animation: doorpiCardRise 0.5s backwards; animation-delay: ${(createUserDelay + 0.15)}s">
                        <button class="doorpi-power-btn" id="doorpiExitApp" tabindex="0">${svgExit}${t('powerExit', 'Sair')}</button>
                        <div class="doorpi-power-sep"></div>
                        <button class="doorpi-power-btn" id="doorpiSuspend" tabindex="0">${svgSleep}${t('powerSuspend', 'Suspender')}</button>
                        <button class="doorpi-power-btn" id="doorpiRestart" tabindex="0">${svgRestart}${t('powerRestart', 'Reiniciar')}</button>
                        <button class="doorpi-power-btn p-danger" id="doorpiShutdown" tabindex="0">${svgShutdown}${t('powerShutdown', 'Desligar')}</button>
                    </div>
                </div>
            </div>`;

    const pickerClock = overlay.querySelector('.doorpi-user-clock');
    if (pickerClock) pickerClock.innerText = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (typeof applyI18n === 'function') applyI18n();
    overlay.style.display = 'flex';
    window.__doorpiInitialUiReady = true;
    window.dispatchEvent(new CustomEvent('doorpi:initial-ui-ready', { detail: { target: 'user-picker' } }));
    document.body.classList.add('user-picker-open');

    // No retorno da criacao de perfil, o seletor deve estar composto antes de
    // remover o setup. Assim nunca existe um frame intermediario com a Home.
    if (window._doorpiSetupReturningToUserPicker === true) {
        window._doorpiSetupReturningToUserPicker = false;
        closeSetup?.({ force: true, skipHomeFocus: true });
    }

    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();

    const hidePicker = (options = {}) => {
        overlay.style.display = 'none';
        document.body.classList.remove('user-picker-open');
        window.DoorpiIntro?.finishHandoff?.();
        if (options?.returnToQuickPanel !== false && overlay.dataset.returnToQuickPanel === 'true' && overlay.dataset.required !== 'true') {
            overlay.dataset.returnToQuickPanel = 'false';
            window.DoorpiQuickPanel?.openMenu?.();
        }
    };

    let userCenterRaf = 0;
    let userCenterTargetLeft = null;
    let userCenterLastFrameAt = 0;
    const centerUserCard = (card, behavior = 'smooth') => {
        const scrollArea = overlay.querySelector('.doorpi-user-scroll-area');
        if (!card || !scrollArea || !scrollArea.contains(card)) return;
        const cardRect = card.getBoundingClientRect();
        const areaRect = scrollArea.getBoundingClientRect();
        const centerDelta = (cardRect.left + cardRect.width / 2) - (areaRect.left + areaRect.width / 2);
        const maxScrollLeft = Math.max(0, scrollArea.scrollWidth - scrollArea.clientWidth);
        const targetLeft = Math.max(0, Math.min(maxScrollLeft, scrollArea.scrollLeft + centerDelta));
        if (behavior !== 'smooth') {
            cancelAnimationFrame(userCenterRaf);
            userCenterRaf = 0;
            userCenterTargetLeft = null;
            userCenterLastFrameAt = 0;
            scrollArea.scrollLeft = targetLeft;
            return;
        }

        // Um único movimento acompanha o destino mais recente. Entradas rápidas
        // atualizam o alvo sem cancelar o frame atual ou trocar para scroll seco.
        userCenterTargetLeft = targetLeft;
        if (userCenterRaf) return;
        userCenterLastFrameAt = performance.now();
        const animate = frameTime => {
            const destination = userCenterTargetLeft;
            if (destination === null) {
                userCenterRaf = 0;
                return;
            }
            const elapsed = Math.max(1, Math.min(34, frameTime - userCenterLastFrameAt));
            userCenterLastFrameAt = frameTime;
            const distance = destination - scrollArea.scrollLeft;
            if (Math.abs(distance) <= 0.55) {
                scrollArea.scrollLeft = destination;
                userCenterTargetLeft = null;
                userCenterRaf = 0;
                return;
            }
            const follow = 1 - Math.exp(-elapsed / 58);
            scrollArea.scrollLeft += distance * follow;
            userCenterRaf = requestAnimationFrame(animate);
        };
        userCenterRaf = requestAnimationFrame(animate);
    };

    const takeUserCenterBehavior = () => {
        const behavior = overlay._doorpiUserCenterBehavior || 'smooth';
        overlay._doorpiUserCenterBehavior = '';
        return behavior;
    };

    const updateUserCarouselState = (focusedCard) => {
        const carouselCards = Array.from(overlay.querySelectorAll('.doorpi-user-track .doorpi-user-card'));
        const focusedIndex = carouselCards.indexOf(focusedCard);
        if (focusedIndex < 0) return;
        carouselCards.forEach((card, index) => {
            const distance = Math.abs(index - focusedIndex);
            const opacity = distance === 0
                ? 1
                : Math.max(0.22, 0.7 - ((distance - 1) * 0.2));
            card.style.setProperty('--doorpi-card-opacity', String(opacity));
        });
    };

    overlay._doorpiFocusInitialCard = (behavior = 'auto') => {
        const carouselCards = Array.from(overlay.querySelectorAll('.doorpi-user-track .doorpi-user-card'));
        const initialCard = overlay.querySelector('.doorpi-user-card.is-current')
            || carouselCards[preferredFocusIndex]
            || carouselCards[0];
        if (!initialCard) return false;
        initialCard.focus({ preventScroll: true });
        updateUserCarouselState(initialCard);
        centerUserCard(initialCard, behavior);
        return document.activeElement === initialCard;
    };

    overlay.querySelectorAll('[data-user-id]').forEach(btn => {
        btn.addEventListener('click', (event) => {
            if (shouldBlockInheritedUserPickerActivation(event)) {
                event.preventDefault();
                event.stopPropagation();
                return;
            }
            const user = users.find(u => String(u.Id) === String(btn.dataset.userId));
            const selectedUserId = String(btn.dataset.userId || '').toLowerCase();
            const currentUserId = String(window._doorpiCurrentUserId || '').toLowerCase();
            if (window._doorpiUserSessionReady === true && selectedUserId && selectedUserId === currentUserId) {
                window._pendingUserSwitchId = '';
                overlay.dataset.returnToQuickPanel = 'false';
                hidePicker({ returnToQuickPanel: false });
                requestAnimationFrame(() => window.focusFeaturedCard?.());
                return;
            }
            if (user?.HasPin || user?.hasPin) {
                showUserPinPrompt(user);
                return;
            }
            window._pendingUserSwitchId = btn.dataset.userId;
            postToHost({ action: 'selectUser', userId: btn.dataset.userId });
        });
        // Quando a navegação for feita pelo ponteiro (mouse/toque)
        btn.addEventListener('focus', () => {
            updateUserCarouselState(btn);
            centerUserCard(btn, takeUserCenterBehavior());
        });
    });

    const createUserCard = overlay.querySelector('#doorpiCreateUserCard');
    createUserCard?.addEventListener('focus', () => {
        updateUserCarouselState(createUserCard);
        centerUserCard(createUserCard, takeUserCenterBehavior());
    });
    createUserCard?.addEventListener('click', (event) => {
        if (shouldBlockInheritedUserPickerActivation(event)) {
            event.preventDefault();
            event.stopPropagation();
            return;
        }
        hidePicker();
        openCreateUserDialog();
    });

    overlay.querySelector('#doorpiCloseUsers')?.addEventListener('click', hidePicker);
    window._doorpiCloseUserPicker = function () {
        if (overlay.dataset.required === 'true') return false;
        hidePicker();
        return true;
    };

    overlay.querySelector('#doorpiExitApp')?.addEventListener('click', () => postToHost({ action: 'exitApp' }));
    overlay.querySelector('#doorpiSuspend')?.addEventListener('click', () => postToHost({ action: 'suspendSystem' }));
    overlay.querySelector('#doorpiRestart')?.addEventListener('click', () => postToHost({ action: 'restartSystem' }));
    overlay.querySelector('#doorpiShutdown')?.addEventListener('click', () => postToHost({ action: 'shutdownSystem' }));

    requestAnimationFrame(() => requestAnimationFrame(() => {
        overlay._doorpiFocusInitialCard?.('auto');
        window.resetDoorpiGamepadInputState?.();
        try {
            postToHost({
                action: 'doorpiHomeInteractiveReady',
                mode: requireSelection ? 'user-picker-required' : 'user-picker',
                activeTag: document.activeElement?.tagName || '',
                activeId: document.activeElement?.id || '',
                activeClass: document.activeElement?.className || ''
            });
        } catch { }
    }));
}

    function openCreateUserDialog() {
        window.closeDoorpiTopOverlay?.(true);
        if (typeof openSetup === 'function') {
            openSetup(true);
        }
    }

