    // ── Foco ──────────────────────────────────────────────────────────────────
    function _libraryCardKey(card) {
        return card?.dataset?.gameId || card?.dataset?.appId || card?.dataset?.path || '';
    }

    function _rememberLibraryCard(catId, card, cardIdx) {
        const memory = _libraryFocusMemory[catId];
        if (!memory || !card?.classList?.contains('nav-vertical-card')) return;
        memory.key = _libraryCardKey(card);
        memory.index = Math.max(0, Number(cardIdx) || 0);
    }

    function _rememberedLibraryContentIndex(catId, actionCount, cards) {
        const memory = _libraryFocusMemory[catId];
        if (!memory || !cards?.length) return actionCount;
        let cardIdx = memory.key
            ? cards.findIndex(card => _libraryCardKey(card) === memory.key)
            : -1;
        if (cardIdx < 0) cardIdx = Math.min(memory.index, cards.length - 1);
        return actionCount + Math.max(0, cardIdx);
    }

    function _activeLibraryCard() {
        if (_topbarFocus || !_isLazyCat()) return null;
        const card = _contentItems[_contentIdx];
        return card?.classList?.contains('nav-vertical-card') ? card : null;
    }

    function _stopRapidLibraryScrollAnimation() {
        if (_libraryRapidScrollRaf) cancelAnimationFrame(_libraryRapidScrollRaf);
        _libraryRapidScrollRaf = 0;
        _libraryRapidScrollPane = null;
        _libraryRapidScrollTarget = 0;
    }

    function _animateRapidLibraryScroll(pane, targetTop) {
        if (!pane) return;
        const maxTop = Math.max(0, pane.scrollHeight - pane.clientHeight);
        const nextTarget = Math.max(0, Math.min(maxTop, targetTop));

        if (_libraryRapidScrollPane !== pane) {
            _stopRapidLibraryScrollAnimation();
            _libraryRapidScrollPane = pane;
        }
        _libraryRapidScrollTarget = nextTarget;
        if (_libraryRapidScrollRaf) return;

        const step = () => {
            const activePane = _libraryRapidScrollPane;
            if (!activePane || !_libraryRapidNavigation) {
                _stopRapidLibraryScrollAnimation();
                return;
            }

            const distance = _libraryRapidScrollTarget - activePane.scrollTop;
            if (Math.abs(distance) <= 0.7) {
                activePane.scrollTop = _libraryRapidScrollTarget;
                _libraryRapidScrollRaf = 0;
                return;
            }

            // Um único movimento segue o alvo mais recente. O fator alto mantém
            // resposta imediata sem os saltos do scroll instantâneo.
            activePane.scrollTop += distance * 0.38;
            _libraryRapidScrollRaf = requestAnimationFrame(step);
        };

        _libraryRapidScrollRaf = requestAnimationFrame(step);
    }

    function _cancelLibraryScrollAnimation() {
        const pane = _libraryPane(CATS[_catIdx]?.id);
        if (!pane) return;
        _stopRapidLibraryScrollAnimation();
        pane.classList.add('nav-rapid-navigation');
        pane.scrollTo({ top: pane.scrollTop, behavior: 'auto' });
    }

    function _settleLibraryScroll() {
        const card = _activeLibraryCard();
        const pane = card?.closest?.('#navPaneGames, #navPaneMedia');
        if (!card || !pane) return;
        const paneRect = pane.getBoundingClientRect();
        const cardRect = card.getBoundingClientRect();
        const centeredTop = pane.scrollTop + (cardRect.top - paneRect.top)
            - ((paneRect.height - cardRect.height) / 2);
        const maxTop = Math.max(0, pane.scrollHeight - pane.clientHeight);
        pane.scrollTo({ top: Math.max(0, Math.min(maxTop, centeredTop)), behavior: 'smooth' });
    }

    function _stopLibraryDirectionHold({ settle = true } = {}) {
        if (_libraryHoldRaf) cancelAnimationFrame(_libraryHoldRaf);
        _libraryHoldRaf = 0;
        const wasRapid = _libraryRapidNavigation;
        _libraryHoldDirection = '';
        _libraryHoldStartedAt = 0;
        _libraryHoldSawNativeInput = false;
        _libraryRapidNavigation = false;
        _stopRapidLibraryScrollAnimation();
        document.querySelectorAll('.nav-library-pane.nav-rapid-navigation')
            .forEach(pane => pane.classList.remove('nav-rapid-navigation'));
        if (settle && wasRapid) requestAnimationFrame(_settleLibraryScroll);
    }

    function _trackLibraryDirectionHold(key) {
        const direction = {
            ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT'
        }[key];
        if (!direction || !_isLazyCat()) return;
        if (_libraryHoldDirection === direction && _libraryHoldRaf) return;

        _stopLibraryDirectionHold({ settle: false });
        _libraryHoldDirection = direction;
        _libraryHoldStartedAt = performance.now();

        const poll = () => {
            if (!window.isNavMenuOpen || !_isLazyCat() || _libraryHoldDirection !== direction) {
                _stopLibraryDirectionHold();
                return;
            }

            const elapsed = performance.now() - _libraryHoldStartedAt;
            const held = window.isDoorpiNativeDirectionHeld?.(direction) === true;
            if (held) _libraryHoldSawNativeInput = true;

            if (held) {
                if (!_libraryRapidNavigation && elapsed >= 120) {
                    _libraryRapidNavigation = true;
                    _cancelLibraryScrollAnimation();
                }
                _libraryHoldRaf = requestAnimationFrame(poll);
                return;
            }

            // O snapshot nativo pode chegar alguns frames depois do primeiro
            // evento de teclado sintetizado pelo controle.
            if (!_libraryHoldSawNativeInput && elapsed < 110) {
                _libraryHoldRaf = requestAnimationFrame(poll);
                return;
            }
            _stopLibraryDirectionHold();
        };

        _libraryHoldRaf = requestAnimationFrame(poll);
    }

    function _setTopbarFocus(val) {
        _topbarFocus = val;
        _updateTopbarFocusVisual();
        _updateContentFocus();
    }

    function _updateTopbarFocusVisual() {
        document.querySelectorAll('.nav-cat-item').forEach((el, i) => {
            el.classList.toggle('nav-focused', _topbarFocus && i === _catIdx);
        });
    }

    function _revealInsideScrollContainer(element, container, edge = 12) {
        if (!element || !container) return;

        const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight);
        if (maxScroll <= 1) {
            // Evita preservar um deslocamento residual criado pelo navegador quando
            // todo o conteudo ja cabe no painel.
            if (container.scrollTop !== 0) container.scrollTop = 0;
            return;
        }

        const itemRect = element.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        let delta = 0;
        if (itemRect.top < containerRect.top + edge)
            delta = itemRect.top - containerRect.top - edge;
        else if (itemRect.bottom > containerRect.bottom - edge)
            delta = itemRect.bottom - containerRect.bottom + edge;

        if (Math.abs(delta) > 0.5)
            container.scrollBy({ top: delta, behavior: 'smooth' });
    }

    function _centerInsideScrollContainer(element, container) {
        if (!element || !container) return;
        const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight);
        if (maxScroll <= 1) {
            if (container.scrollTop !== 0) container.scrollTop = 0;
            return;
        }
        const itemRect = element.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const target = Math.max(0, Math.min(maxScroll,
            container.scrollTop + itemRect.top - containerRect.top
            - (container.clientHeight - itemRect.height) / 2));
        if (Math.abs(target - container.scrollTop) > 0.5)
            container.scrollTo({ top: target, behavior: 'smooth' });
    }

    function _updateContentFocus() {
        if (_topbarFocus) {
   
            const _lg = _currentLazyGrid();
            if (_isLazyCat() && _lg) {
                for (const card of _lg._cards) {
                    if (card && card.classList.contains('nav-focused')) {
                        card.classList.remove('nav-focused');
                        card._stopInteraction?.();
                    }
                }
            }
            // Remove o foco dos botões de settings e profile
            _contentItems.forEach(el => el?.classList.remove('nav-focused-el'));
            return;
        }
        const _lg = _currentLazyGrid();
        if (_isLazyCat() && _lg) {
            // Garante que o indice não passe dos limites
            const globalIdx = Math.max(0, Math.min((_contentItems.length || 1) - 1, _contentIdx));
            _contentItems.forEach(el => el?.classList.remove('nav-focused-el'));

            // Remove dos anteriores
            for (const card of _lg._cards) {
                if (card && card.classList.contains('nav-focused')) {
                    card.classList.remove('nav-focused');
                    card._stopInteraction?.();
                }
            }

            const card = _contentItems[globalIdx];
            if (card) {
                if (!card.classList.contains('nav-vertical-card')) {
                    card.classList.add('nav-focused-el');
                    card.focus?.({ preventScroll: true });
                    const filterList = card.closest?.('.nav-library-filter-list');
                    if (filterList) {
                        const itemRect = card.getBoundingClientRect();
                        const listRect = filterList.getBoundingClientRect();
                        const edgePadding = 8;
                        if (itemRect.bottom > listRect.bottom - edgePadding) {
                            filterList.scrollBy({
                                top: itemRect.bottom - listRect.bottom + edgePadding,
                                behavior: 'smooth'
                            });
                        } else if (itemRect.top < listRect.top + edgePadding) {
                            filterList.scrollBy({
                                top: itemRect.top - listRect.top - edgePadding,
                                behavior: 'smooth'
                            });
                        }
                    }
                    return;
                }
         
                const cols = _gridCols();
                const container = card.closest('#navPaneGames, #navPaneMedia');
                const cardIdx = _lg._cards.indexOf(card);
                _rememberLibraryCard(CATS[_catIdx]?.id, card, cardIdx);

    
                if (cardIdx >= 0 && cardIdx < cols && container) {
                   
                    if (container.scrollTop > 4) {
                        if (_libraryRapidNavigation) _animateRapidLibraryScroll(container, 0);
                        else container.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                } else {
                    
                    const paneRect = container?.getBoundingClientRect();
                    const cardRect = card.getBoundingClientRect();
                    const PADDING = 10; 

                    if (paneRect && cardRect.bottom > paneRect.bottom - PADDING) {
                        const delta = cardRect.bottom - paneRect.bottom + PADDING;
                        if (_libraryRapidNavigation) _animateRapidLibraryScroll(container, container.scrollTop + delta);
                        else container.scrollBy({ top: delta, behavior: 'smooth' });
                    } else if (paneRect && cardRect.top < paneRect.top + PADDING) {
                        const delta = cardRect.top - paneRect.top - PADDING;
                        if (_libraryRapidNavigation) _animateRapidLibraryScroll(container, container.scrollTop + delta);
                        else container.scrollBy({ top: delta, behavior: 'smooth' });
                    }
                }

             
                card.classList.add('nav-focused');
                if (document.activeElement !== card) card.focus?.({ preventScroll: true });
                card._startInteraction?.();

                _lg._loadCard(card);
                _lg.hydrateViewportBand?.();
                requestAnimationFrame(() => _lg.hydrateViewportBand?.());
            }
       
        } else {
            _contentItems.forEach((el, i) => {
                if (!el) return;
                el.classList.toggle('nav-focused-el', !_topbarFocus && i === _contentIdx);
            });

            const focused = _contentItems[_contentIdx];
            if (focused && typeof focused.focus === 'function' && document.activeElement !== focused) {
                focused.focus({ preventScroll: true });
                const isProfileShowcase = CATS[_catIdx]?.id === 'profile' && _profileSubView !== 'history';
                const isExtensionsView = CATS[_catIdx]?.id === 'settings' && _settingsSubView === 'extensions';
                const isSettingsHome = CATS[_catIdx]?.id === 'settings' && !_settingsSubView;
                const isStorageView = CATS[_catIdx]?.id === 'settings'
                    && _settingsSubView === 'system'
                    && _systemSubView === 'storage';
                if (isSettingsHome) {
                    // O hub possui seu proprio painel de rolagem. Nao use
                    // scrollIntoView aqui: ele tenta centralizar o item e acaba
                    // deslocando a pagina mesmo quando a opcao ja esta visivel.
                    _revealInsideScrollContainer(focused, focused.closest?.('.nav-settings-home-nav'));
                } else if (isExtensionsView) {
                    const list = focused.closest?.('.nav-ext-list');
                    if (list) {
                        const itemRect = focused.getBoundingClientRect();
                        const listRect = list.getBoundingClientRect();
                        const edge = 10;
                        if (itemRect.bottom > listRect.bottom - edge) {
                            list.scrollBy({ top: itemRect.bottom - listRect.bottom + edge, behavior: 'smooth' });
                        } else if (itemRect.top < listRect.top + edge) {
                            list.scrollBy({ top: itemRect.top - listRect.top - edge, behavior: 'smooth' });
                        }
                    }
                } else if (isStorageView) {
                    const list = focused.closest?.('.nav-storage-v3-list, .nav-storage-v3-category-list, .nav-storage-v3-drive-list');
                    if (list) {
                        const itemRect = focused.getBoundingClientRect();
                        const listRect = list.getBoundingClientRect();
                        const edge = 10;
                        if (list.classList.contains('nav-storage-v3-drive-list')) {
                            if (itemRect.right > listRect.right - edge)
                                list.scrollLeft += itemRect.right - listRect.right + edge;
                            else if (itemRect.left < listRect.left + edge)
                                list.scrollLeft += itemRect.left - listRect.left - edge;
                        } else if (itemRect.bottom > listRect.bottom - edge) {
                            list.scrollTop += itemRect.bottom - listRect.bottom + edge;
                        } else if (itemRect.top < listRect.top + edge) {
                            list.scrollTop += itemRect.top - listRect.top - edge;
                        }
                    }
                } else if (!isProfileShowcase) {
                    focused.scrollIntoView({ block: 'center', behavior: 'smooth' });
                }
            }
        }
    }

    function _gridCols(referenceGrid = null) {
        const grid = referenceGrid
            || (_isLazyCat() ? _currentLazyGrid()?._grid : null)
            || document.querySelector('.nav-big-grid, .nav-settings-grid, .nav-profile-recent-grid');
        if (!grid) return 1;
        return Math.max(1, getComputedStyle(grid).gridTemplateColumns.split(' ').length);
    }

    function _runNavMenuTransition(afterDone) {
        if (!_overlay) return;

        const token = ++_navMenuTransitionToken;
        if (_navMenuTransitionTimer) {
            clearTimeout(_navMenuTransitionTimer);
            _navMenuTransitionTimer = 0;
        }
        _navMenuTransitionCleanup?.();
        _navMenuTransitionCleanup = null;

        _overlay.classList.add('nav-menu-animating');
        _overlay.style.willChange = 'transform';

        const finish = () => {
            if (token !== _navMenuTransitionToken) return;
            if (_navMenuTransitionTimer) {
                clearTimeout(_navMenuTransitionTimer);
                _navMenuTransitionTimer = 0;
            }
            _navMenuTransitionCleanup?.();
            _navMenuTransitionCleanup = null;
            _overlay?.classList.remove('nav-menu-animating');
            if (_overlay) _overlay.style.willChange = 'auto';
            afterDone?.();
        };

        const onEnd = (event) => {
            if (event.target === _overlay && event.propertyName === 'transform') finish();
        };

        _overlay.addEventListener('transitionend', onEnd);
        _navMenuTransitionCleanup = () => _overlay?.removeEventListener('transitionend', onEnd);
        _navMenuTransitionTimer = setTimeout(finish, NAV_MENU_TRANSITION_MS + 90);
    }

    function _releaseNavMenuInput(lifecycleToken) {
        if (lifecycleToken !== _navMenuLifecycleToken || _navMenuPhase !== 'closing') return;
        if (!window.isNavMenuOpen) return false;

        window.isNavMenuOpen = false;

        if (_lastFocus && document.contains(_lastFocus)) {
            _lastFocus.focus();
        } else {
            document.querySelector('#gameGrid .card:not(.add-card)')?.focus();
        }

        window.updateNavHint?.();
    }

