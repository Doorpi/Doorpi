    // ── Teclado / gamepad ────────────────────────────────────────────────────
    window._navMenuCycleTab = function (delta) {
        const tabs = Array.from(document.querySelectorAll('.nav-cat-item'));
        if (!tabs || tabs.length === 0) return;

        let currentIdx = tabs.findIndex(tab => tab.classList.contains('active'));
        if (currentIdx === -1) currentIdx = 0;

        let nextIdx = currentIdx + parseInt(delta);
        if (nextIdx < 0 || nextIdx >= tabs.length) return;

        tabs[nextIdx].click();
    };

    window._navMenuCycleSharingSubtab = function (delta) {
        if (CATS[_catIdx]?.id !== 'settings' || _settingsSubView !== 'sharing') return false;
        if (_topbarFocus) return false;
        const focused = _contentItems[_contentIdx];
        if (focused?.id === 'setBackSharing') return false;

        const tabs = Array.from(document.querySelectorAll('.nav-sharing-tab'));
        if (tabs.length <= 1) return false;

        let currentIdx = tabs.findIndex(tab => tab.classList.contains('active'));
        if (currentIdx === -1) currentIdx = 0;

        const nextIdx = Math.max(0, Math.min(tabs.length - 1, currentIdx + parseInt(delta)));
        if (nextIdx === currentIdx) return true;

        tabs[nextIdx].click();
        return true;
    };

    window._navMenuExitReleaseNotesScroll = function () {
        if (!_releaseNotesScrollActive) return false;

        const notes = document.getElementById('systemUpdateChangelog');
        if (!notes || notes.offsetParent === null) {
            _releaseNotesScrollActive = false;
            return false;
        }
        _releaseNotesScrollActive = false;
        notes?.classList.remove('is-scroll-active');
        notes?.focus({ preventScroll: true });
        return true;
    };

    window._navMenuHandleKey = function (key) {
        if (window._vkbIsOpen) return false;
        if (_navMenuPhase === 'closing') return false;
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
            _trackLibraryDirectionHold(key);
        }
        if ((key === 'Escape' || key === 'Backspace') && _libraryInteractionMode === 'filters' &&
            _closeLibraryFilters()) return true;
        if ((key === 'Escape' || key === 'Backspace') && window._navMenuExitReleaseNotesScroll?.()) return true;
        if ((key === 'L1' || key === 'R1') && window._navMenuCycleSharingSubtab?.(key === 'R1' ? 1 : -1)) return true;
        if (key === 'L1') { window._navMenuCycleTab(-1); return true; }
        if (key === 'R1') { window._navMenuCycleTab(1); return true; }

        if (_topbarFocus) return _navTopbar(key) === true;
        return _navContent(key) === true;
    };

    document.addEventListener('keydown', e => {
        // Modais de sincronizacao ficam acima do nav-menu e recebem a navegacao primeiro.
        // O controlador global trata as setas; nao as consuma neste listener de captura.
        if (window.DoorpiProfileSync?.isOpen?.()) return;
        // O seletor de discos também fica acima do nav-menu. As direções do
        // controle chegam como teclas e precisam alcançar a navegação global.
        if (window.isEmulatorDiscSelectorOpen?.()) return;
        // O popup de conflito possui prioridade no controlador global de navegacao.
        if (window.isSessionConflictPopupOpen?.()) return;
        const executionOverlay = document.getElementById('gameLaunchOverlay');
        if (executionOverlay?.classList.contains('visible') &&
            executionOverlay.classList.contains('execution-lock-visible')) return;

        if (window.isDoorpiSessionTransitionActive?.()) {
            e.preventDefault();
            e.stopImmediatePropagation();
            return true;
        }

        if (window.isDesktopWarningOpen) {
            e.preventDefault();
            e.stopImmediatePropagation();
            if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') window._dwMoveFocus?.(-1);
            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') window._dwMoveFocus?.(1);
            if (e.key === 'Enter') window._dwAction?.('CONFIRM');
            if (e.key === 'Escape' || e.key === 'Backspace') window._dwAction?.('CANCEL');
            return;
        }

        const _addModalVisible = () => {
            const el = document.getElementById('addGameContainer');
            return !!(el && el.style.display !== 'none');
        };

        if (!window.isNavMenuOpen && !isSetupOpen && !window._vkbIsOpen && !isCtxMenuOpen && !isEditModalOpen && !_addModalVisible()) {
            return;
        }

        if (window._vkbIsOpen) {
            e.preventDefault();
            e.stopImmediatePropagation();
            if (['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
                const dirMap = { 'ArrowRight': 'RIGHT', 'ArrowLeft': 'LEFT', 'ArrowDown': 'DOWN', 'ArrowUp': 'UP' };
                moveFocus(dirMap[e.key]);
            }
            else if (e.key === 'Escape') { window._vkbCancel?.(); }
            else if (e.key === 'Enter') { window._vkbConfirm?.(); }
            else if (e.key === 'Backspace') { window._vkbPhysicalKey?.('Backspace'); }
            else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
                window._vkbPhysicalKey?.(e.key);
            }
            return;
        }

        if (_addModalVisible() && !window.isNavMenuOpen) {
            const mediaView = document.getElementById('view-media-apps');
            if (mediaView?.classList.contains('active') && (e.key === 'L1' || e.key === 'R1')) {
                e.preventDefault();
                e.stopImmediatePropagation();
                window._cycleMediaSubtab?.(e.key === 'R1' ? 1 : -1);
                return;
            }
        }

        if (window.isNavMenuOpen) {
            if (document.querySelector('.profile-photo-picker-overlay, .artwork-wizard-overlay')) return;
            if (typeof isCtxMenuOpen !== 'undefined' && isCtxMenuOpen) return;
            if (typeof isEditModalOpen !== 'undefined' && isEditModalOpen) return;

            e.preventDefault();
            e.stopImmediatePropagation();
            if (CATS[_catIdx]?.id === 'settings' && _settingsSubView === 'sound' &&
                ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
                const dirMap = { 'ArrowRight': 'RIGHT', 'ArrowLeft': 'LEFT', 'ArrowDown': 'DOWN', 'ArrowUp': 'UP' };
                if (window.DoorpiSoundUI?.handleDirection?.('settings', dirMap[e.key])) {
                    const focusedIdx = _contentItems.indexOf(document.activeElement);
                    if (focusedIdx >= 0) {
                        _contentIdx = focusedIdx;
                        _contentItems.forEach((el, i) => el?.classList.toggle('nav-focused-el', i === _contentIdx));
                    }
                    return;
                }
            }
            if (e.key === 'Escape' || e.key === 'Backspace') {
                if (window._navMenuExitReleaseNotesScroll?.()) return;
                if (window._closeNavExtensionInline?.()) return;
                if (window.requestDoorpiBackAction?.()) return;
                return;
            }
            window._navMenuHandleKey(e.key);
            return;
        }
    }, true);

    function _navTopbar(key) {
        switch (key) {
            case 'ArrowLeft':
                if (_catIdx > 0) { _catIdx--; _selectCat(_catIdx); }
                return true;
            case 'ArrowRight':
                if (_catIdx < CATS.length - 1) { _catIdx++; _selectCat(_catIdx); }
                return true;
            case 'ArrowDown':
            case 'Enter':
                if (_contentItems.length > 0) {
                    _setTopbarFocus(false);
                    if (_isLazyCat()) {
                        const catId = CATS[_catIdx]?.id;
                        const actionCount = _libraryActionItems(catId).length;
                        const cards = _libraryGrid(catId)?._cards || [];
                        _contentIdx = cards.length
                            ? _rememberedLibraryContentIndex(catId, actionCount, cards)
                            : 0;
                    } else if (CATS[_catIdx]?.id === 'profile' && _profileSubView !== 'history') {
                        const editIndex = _contentItems.findIndex(item => item?.id === 'btnEditProfileHub');
                        _contentIdx = editIndex >= 0 ? editIndex : 0;
                    } else {
                        _contentIdx = 0;
                    }
                    _updateContentFocus();
                }
                return true;
            case 'ArrowUp':
            case 'Escape':
            case 'Backspace':
                close();
                return true;
        }
        return false;
    }

    function _navLibraryContent(key) {
        const catId = CATS[_catIdx]?.id;
        if (catId !== 'games' && catId !== 'media') return false;
        const total = _contentItems.length;
        if (!total) {
            if (key === 'ArrowUp' || key === 'Escape' || key === 'Backspace') _setTopbarFocus(true);
            return true;
        }

        if (_libraryInteractionMode === 'filters' && catId === 'games') {
            const footerStart = _contentItems.findIndex(item => item?.dataset?.filterCommand);
            const onFooter = footerStart >= 0 && _contentIdx >= footerStart;
            if (key === 'Enter') _contentItems[_contentIdx]?.click();
            else if (key === 'ArrowLeft' || key === 'ArrowRight') {
                if (onFooter) {
                    const resetIdx = _contentItems.findIndex(item => item?.dataset?.filterCommand === 'reset');
                    const doneIdx = _contentItems.findIndex(item => item?.dataset?.filterCommand === 'done');
                    if (resetIdx >= 0 && doneIdx >= 0) {
                        const nextIdx = _contentIdx === resetIdx ? doneIdx : resetIdx;
                        if (nextIdx !== _contentIdx) _contentIdx = nextIdx;
                    }
                } else if (key === 'ArrowLeft') {
                    _closeLibraryFilters();
                }
            }
            else if (key === 'ArrowUp') {
                if (onFooter && footerStart > 0) _contentIdx = Math.max(0, footerStart - 1);
                else _contentIdx = Math.max(0, _contentIdx - 1);
            }
            else if (key === 'ArrowDown') {
                if (!onFooter) _contentIdx = Math.min(total - 1, _contentIdx + 1);
            }
            else if (key === 'Escape' || key === 'Backspace') _closeLibraryFilters();
            else return true;
            _updateContentFocus();
            return true;
        }

        const actions = _libraryActionItems(catId);
        const actionCount = actions.length;
        const grid = _libraryGrid(catId);
        const cards = grid?._cards || [];
        const current = _contentItems[_contentIdx];
        const onAction = current?.classList?.contains('nav-library-action');

        if (key === 'Enter') {
            current?.click();
            return true;
        }
        if (key === 'Escape' || key === 'Backspace') {
            _setTopbarFocus(true);
            return true;
        }

        if (onAction) {
            if (key === 'ArrowUp') {
                if (_contentIdx > 0) _contentIdx--;
                else _setTopbarFocus(true);
            } else if (key === 'ArrowDown') {
                if (_contentIdx + 1 < actionCount) _contentIdx++;
                else if (cards.length) _contentIdx = actionCount;
            } else if (key === 'ArrowRight' && cards.length) {
                _contentIdx = actionCount;
            }
            _updateContentFocus();
            return true;
        }

        const cols = _gridCols(current?.closest?.('.nav-big-grid'));
        const cardIdx = Math.max(0, _contentIdx - actionCount);
        if (key === 'ArrowLeft') {
            if (cardIdx % cols === 0) _contentIdx = 0;
            else _contentIdx--;
        } else if (key === 'ArrowRight') {
            if (cardIdx + 1 < cards.length) _contentIdx++;
        } else if (key === 'ArrowUp') {
            if (cardIdx < cols) {
                _setTopbarFocus(true);
                return true;
            }
            else _contentIdx -= cols;
        } else if (key === 'ArrowDown') {
            const nextRowStart = (Math.floor(cardIdx / cols) + 1) * cols;
            if (nextRowStart < cards.length) {
                const exactBelow = cardIdx + cols;
                const nextCardIdx = exactBelow < cards.length ? exactBelow : nextRowStart;
                _contentIdx = actionCount + nextCardIdx;
            }
        } else if (key === ' ' || key === 'Square') {
            window._navMenuTriggerCtxMenu();
            return true;
        } else {
            return false;
        }
        _updateContentFocus();
        return true;
    }

    function _navContent(key) {
        const cols = _gridCols();
        const total = _contentItems.length;

        if (CATS[_catIdx]?.id === 'settings' &&
            _settingsSubView === 'system' &&
            _systemSubView === 'updates' &&
            _systemUpdatesSubView === 'doorpi') {
            const notes = document.getElementById('systemUpdateChangelog');
            const focusedNotes = _contentItems[_contentIdx] === notes;

            if (_releaseNotesScrollActive && notes) {
                const delta = key === 'ArrowDown' ? 96
                    : key === 'ArrowUp' ? -96
                    : key === 'ArrowRight' ? 320
                    : key === 'ArrowLeft' ? -320
                    : 0;
                if (delta !== 0) {
                    notes.scrollBy({ top: delta, behavior: 'smooth' });
                    return true;
                }
                if (key === 'Enter') return true;
            }

            if (focusedNotes && key === 'Enter') {
                notes?.click();
                return true;
            }
        }

        if (CATS[_catIdx]?.id === 'settings' &&
            !_settingsSubView &&
            ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
            if (key === 'ArrowUp') {
                if (_contentIdx <= 0) {
                    _setTopbarFocus(true);
                    return true;
                }
                _contentIdx--;
                _updateContentFocus();
            } else if (key === 'ArrowDown' && _contentIdx < total - 1) {
                _contentIdx++;
                _updateContentFocus();
            }
            return true;
        }

        if (CATS[_catIdx]?.id === 'settings' && _settingsSubView === 'bluetooth' &&
            ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
            const active = _contentItems[_contentIdx];
            if (!active) return true;
            if (_contentIdx === 0 && key === 'ArrowUp') {
                _setTopbarFocus(true);
                return true;
            }

            const rect = active.getBoundingClientRect();
            const originX = rect.left + rect.width / 2;
            const originY = rect.top + rect.height / 2;
            const vertical = key === 'ArrowUp' || key === 'ArrowDown';
            const sign = (key === 'ArrowRight' || key === 'ArrowDown') ? 1 : -1;
            let nextIndex = -1;
            let bestScore = Number.POSITIVE_INFINITY;

            _contentItems.forEach((candidate, index) => {
                if (!candidate || candidate === active) return;
                const candidateRect = candidate.getBoundingClientRect();
                const x = candidateRect.left + candidateRect.width / 2;
                const y = candidateRect.top + candidateRect.height / 2;
                const primary = vertical ? (y - originY) * sign : (x - originX) * sign;
                if (primary <= 4) return;
                const secondary = vertical ? Math.abs(x - originX) : Math.abs(y - originY);
                const score = primary + secondary * 1.65;
                if (score < bestScore) { bestScore = score; nextIndex = index; }
            });

            if (nextIndex >= 0) {
                _contentIdx = nextIndex;
                _updateContentFocus();
            } else if (key === 'ArrowLeft' && _contentIdx > 0) {
                _contentIdx = 0;
                _updateContentFocus();
            }
            return true;
        }

        if (_isLazyCat()) return _navLibraryContent(key);

        if (CATS[_catIdx]?.id === 'profile' && _profileSubView !== 'history') {
            const active = _contentItems[_contentIdx];
            const heroIndex = _contentItems.findIndex(item => item?.id === 'btnProfileHero');
            const recentIndex = _contentItems.findIndex(item => item?.id === 'btnProfileRecent');
            const journeyIndex = _contentItems.findIndex(item => item?.id === 'btnGameHistory');
            const editIndex = _contentItems.findIndex(item => item?.id === 'btnEditProfileHub');
            const activeTabIndex = _contentItems.findIndex(item => item?.classList?.contains('nav-unified-tab') && item.classList.contains('is-active'));
            const onTab = active?.classList?.contains('nav-unified-tab');

            if (key === 'ArrowUp') {
                if (active?.id === 'btnProfileRecent') {
                    if (!active._profileRecentAtStart?.()) {
                        active._profileRecentStep?.(-1);
                    } else {
                        _contentIdx = journeyIndex >= 0
                            ? journeyIndex
                            : heroIndex >= 0
                                ? heroIndex
                                : (activeTabIndex >= 0 ? activeTabIndex : 0);
                        _updateContentFocus();
                    }
                } else if (active?.id === 'btnGameHistory') {
                    _contentIdx = activeTabIndex >= 0 ? activeTabIndex : 0;
                    _updateContentFocus();
                } else if (active?.id === 'btnProfileHero') {
                    _contentIdx = activeTabIndex >= 0 ? activeTabIndex : 0;
                    _updateContentFocus();
                } else if (onTab && editIndex >= 0) {
                    _contentIdx = editIndex;
                    _updateContentFocus();
                } else {
                    _setTopbarFocus(true);
                }
                return true;
            }
            if (key === 'ArrowDown') {
                if (active?.id === 'btnEditProfileHub') {
                    _contentIdx = activeTabIndex >= 0 ? activeTabIndex : 0;
                    _updateContentFocus();
                } else if (onTab && (journeyIndex >= 0 || heroIndex >= 0 || recentIndex >= 0)) {
                    _contentIdx = journeyIndex >= 0 ? journeyIndex : (heroIndex >= 0 ? heroIndex : recentIndex);
                    _updateContentFocus();
                } else if (active?.id === 'btnGameHistory' && recentIndex >= 0) {
                    _contentIdx = recentIndex;
                    _updateContentFocus();
                } else if (active?.id === 'btnProfileHero' && recentIndex >= 0) {
                    _contentIdx = recentIndex;
                    _updateContentFocus();
                } else if (active?.id === 'btnProfileRecent') {
                    active._profileRecentStep?.(1);
                }
                return true;
            }
            if (active?.id === 'btnProfileRecent' && (key === 'ArrowLeft' || key === 'ArrowRight')) {
                if (key === 'ArrowLeft') {
                    _contentIdx = journeyIndex >= 0
                        ? journeyIndex
                        : heroIndex >= 0
                            ? heroIndex
                            : (activeTabIndex >= 0 ? activeTabIndex : 0);
                    _updateContentFocus();
                }
                return true;
            }
            if (active?.id === 'btnGameHistory' && (key === 'ArrowLeft' || key === 'ArrowRight')) return true;
            if (active?.id === 'btnProfileHero' && (key === 'ArrowLeft' || key === 'ArrowRight')) {
                active._profileHeroStep?.(key === 'ArrowLeft' ? -1 : 1);
                return true;
            }
            if (active?.id === 'btnEditProfileHub' && (key === 'ArrowLeft' || key === 'ArrowRight')) return true;
        }

        // Navegação Complexa nos menus de Settings da Conta
        if (CATS[_catIdx]?.id === 'settings' && _settingsSubView === 'account') {
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
                const byId = Object.fromEntries(_contentItems.map((item, index) => [item.id, index]));
                const activeId = _contentItems[_contentIdx]?.id;
                const syncPrimaryId = byId.navProfileSyncNow !== undefined ? 'navProfileSyncNow' : 'navProfileSyncConnect';
                const routes = {
                    setBack: { ArrowDown: 'navProfilePhoto', ArrowRight: 'navProfilePhoto' },
                    navProfilePhoto: { ArrowUp: 'setBack', ArrowDown: 'navProfName', ArrowRight: 'navProfName' },
                    navProfName: { ArrowUp: 'navProfilePhoto', ArrowDown: 'navProfPin', ArrowLeft: 'navProfilePhoto' },
                    navProfPin: { ArrowUp: 'navProfName', ArrowDown: 'navProfApi', ArrowLeft: 'navProfilePhoto' },
                    navProfApi: { ArrowUp: 'navProfPin', ArrowDown: syncPrimaryId, ArrowRight: 'navApiPaste', ArrowLeft: 'navProfilePhoto' },
                    navApiPaste: { ArrowUp: 'navProfPin', ArrowDown: syncPrimaryId, ArrowLeft: 'navProfApi', ArrowRight: 'navApiLink' },
                    navApiLink: { ArrowUp: 'navProfPin', ArrowDown: syncPrimaryId, ArrowLeft: 'navApiPaste' },
                    navProfileSyncConnect: { ArrowUp: 'navProfApi', ArrowDown: 'navApplicationHistory' },
                    navProfileSyncNow: { ArrowUp: 'navProfApi', ArrowDown: 'navApplicationHistory', ArrowRight: 'navProfileSyncDisconnect' },
                    navProfileSyncDisconnect: { ArrowUp: 'navApiPaste', ArrowDown: 'navApplicationHistory', ArrowLeft: 'navProfileSyncNow' },
                    navApplicationHistory: { ArrowUp: syncPrimaryId, ArrowDown: 'navAccountSharing' },
                    navAccountSharing: { ArrowUp: 'navApplicationHistory', ArrowDown: 'navDeleteUser' },
                    navDeleteUser: { ArrowUp: 'navAccountSharing' }
                };
                const nextId = routes[activeId]?.[key];
                if (nextId && byId[nextId] !== undefined) {
                    _contentIdx = byId[nextId];
                    _updateContentFocus();
                } else if (key === 'ArrowUp' && activeId === 'setBack') {
                    _setTopbarFocus(true);
                }
                return true;
            }
        }
        if (CATS[_catIdx]?.id === 'settings' && document.querySelector('.nav-settings-directory')) {
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
                if (_contentIdx === 0) {
                    if (key === 'ArrowUp' || key === 'ArrowLeft') _setTopbarFocus(true);
                    else if (key === 'ArrowDown' || key === 'ArrowRight') _contentIdx = Math.min(1, total - 1);
                } else if (key === 'ArrowUp') {
                    _contentIdx = Math.max(0, _contentIdx - 1);
                } else if (key === 'ArrowDown') {
                    _contentIdx = Math.min(total - 1, _contentIdx + 1);
                } else if (key === 'ArrowLeft') {
                    _contentIdx = 0;
                }
                _updateContentFocus();
                return;
            }
        }
        if (CATS[_catIdx]?.id === 'settings' && _settingsSubView === 'accountHub') {
            const map = {
                0: { ArrowUp: 'top', ArrowDown: 1, ArrowRight: 1 },
                1: { ArrowUp: 0, ArrowRight: 2 },
                2: { ArrowUp: 0, ArrowLeft: 1 }
            };

            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
                const next = map[_contentIdx]?.[key];
                if (next === 'top') {
                    _setTopbarFocus(true);
                } else if (next !== undefined && next < total) {
                    _contentIdx = next;
                    _updateContentFocus();
                }
                return;
            }
        }

        if (CATS[_catIdx]?.id === 'settings' && _settingsSubView === 'sharing') {
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
                const current = _contentItems[_contentIdx];
                const tabs = Array.from(document.querySelectorAll('.nav-sharing-tab'));
                const apps = Array.from(document.querySelectorAll('.nav-sharing-app'));
                const modes = Array.from(document.querySelectorAll('.nav-sharing-mode'));
                const users = Array.from(document.querySelectorAll('.nav-sharing-user')).filter(el => el.offsetParent !== null);
                const toggles = Array.from(document.querySelectorAll('.nav-sharing-toggle')).filter(el => el.offsetParent !== null);
                const save = document.querySelector('#navSharingSave:not([disabled])');
                const activeTab = tabs.find(el => el.classList.contains('active')) || tabs[0];
                const activeApp = apps.find(el => el.classList.contains('active')) || apps[0];
                const moveTo = element => {
                    const idx = element ? _contentItems.indexOf(element) : -1;
                    if (idx >= 0) _contentIdx = idx;
                };

                if (current?.id === 'setBackSharing') {
                    if (key === 'ArrowUp' || key === 'ArrowLeft') _setTopbarFocus(true);
                    else moveTo(activeTab || activeApp || modes[0] || toggles[0]);
                } else if (current?.classList.contains('nav-sharing-tab')) {
                    const idx = tabs.indexOf(current);
                    if (key === 'ArrowLeft') moveTo(tabs[Math.max(0, idx - 1)]);
                    else if (key === 'ArrowRight') moveTo(tabs[Math.min(tabs.length - 1, idx + 1)]);
                    else if (key === 'ArrowUp') moveTo(document.querySelector('#setBackSharing'));
                    else if (key === 'ArrowDown') moveTo(activeApp || modes[0] || toggles[0]);
                } else if (current?.classList.contains('nav-sharing-app')) {
                    const idx = apps.indexOf(current);
                    if (key === 'ArrowUp') moveTo(idx > 0 ? apps[idx - 1] : activeTab);
                    else if (key === 'ArrowDown') moveTo(apps[Math.min(apps.length - 1, idx + 1)]);
                    else if (key === 'ArrowLeft') moveTo(document.querySelector('#setBackSharing'));
                    else if (key === 'ArrowRight') moveTo(modes[0] || toggles[0] || save);
                } else if (current?.classList.contains('nav-sharing-mode')) {
                    const idx = modes.indexOf(current);
                    if (key === 'ArrowUp') moveTo(idx > 0 ? modes[idx - 1] : activeTab);
                    else if (key === 'ArrowDown') moveTo(idx < modes.length - 1 ? modes[idx + 1] : (users[0] || save));
                    else if (key === 'ArrowLeft') moveTo(activeApp);
                } else if (current?.classList.contains('nav-sharing-user')) {
                    const idx = users.indexOf(current);
                    if (key === 'ArrowLeft') moveTo(idx % 2 ? users[idx - 1] : activeApp);
                    else if (key === 'ArrowRight' && idx % 2 === 0) moveTo(users[idx + 1] || current);
                    else if (key === 'ArrowUp') moveTo(idx >= 2 ? users[idx - 2] : modes[modes.length - 1]);
                    else if (key === 'ArrowDown') moveTo(users[idx + 2] || save || current);
                } else if (current?.classList.contains('nav-sharing-toggle')) {
                    const idx = toggles.indexOf(current);
                    if (key === 'ArrowUp') moveTo(idx > 0 ? toggles[idx - 1] : activeTab);
                    else if (key === 'ArrowDown') moveTo(toggles[Math.min(toggles.length - 1, idx + 1)]);
                    else if (key === 'ArrowLeft') moveTo(activeApp);
                } else if (current === save) {
                    if (key === 'ArrowUp') moveTo(users[users.length - 1] || modes[modes.length - 1]);
                    else if (key === 'ArrowLeft') moveTo(activeApp);
                }
                _updateContentFocus();
                return;
            }
        }

        if (CATS[_catIdx]?.id === 'settings' && _settingsSubView === 'extensions') {
            const extensionDialog = document.getElementById('navExtDialog');
            const extensionDialogOpen = extensionDialog?.classList.contains('visible');
            if (extensionDialogOpen && (key === 'Escape' || key === 'Backspace')) {
                document.getElementById('navExtDialogClose')?.click();
                return true;
            }
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
                const current = _contentItems[_contentIdx];
                const moveToExtensionElement = targetOrSelector => {
                    const target = typeof targetOrSelector === 'string'
                        ? document.querySelector(targetOrSelector)
                        : targetOrSelector;
                    const index = target ? _contentItems.indexOf(target) : -1;
                    if (index < 0) return false;
                    _contentIdx = index;
                    _updateContentFocus();
                    return true;
                };

                if (extensionDialogOpen) {
                    const dialogNavigation = extensionDialog.classList.contains('has-candidate') ? {
                        navExtCandidateBack: { ArrowRight: '#navExtInstallBtn' },
                        navExtInstallBtn: { ArrowLeft: '#navExtCandidateBack' }
                    } : {
                        navExtDialogClose: { ArrowRight: '#navExtUrlInput', ArrowDown: '#navExtUrlInput' },
                        navExtUrlInput: { ArrowLeft: '#navExtDialogClose', ArrowUp: '#navExtDialogClose', ArrowDown: '#navExtPasteBtn', ArrowRight: '#navExtPasteBtn' },
                        navExtPasteBtn: { ArrowLeft: '#navExtUrlInput', ArrowUp: '#navExtUrlInput', ArrowRight: '#navExtReviewBtn' },
                        navExtReviewBtn: { ArrowUp: '#navExtUrlInput', ArrowLeft: '#navExtPasteBtn' }
                    };
                    const target = dialogNavigation[current?.id]?.[key];
                    if (target) moveToExtensionElement(target);
                    return true;
                }

                const back = document.getElementById('setBackExt');
                const store = document.getElementById('navExtStoreBtn');
                const manual = document.getElementById('navExtManualBtn');
                const list = document.getElementById('navExtensionsList');
                const cards = Array.from(list?.querySelectorAll('.nav-ext-card') || []);
                const card = current?.closest?.('.nav-ext-card');

                if (current === back) {
                    if (key === 'ArrowUp' || key === 'ArrowLeft') _setTopbarFocus(true);
                    else moveToExtensionElement(store);
                    return true;
                }
                if (current === store || current === manual) {
                    if (key === 'ArrowUp') moveToExtensionElement(back);
                    else if (key === 'ArrowLeft') moveToExtensionElement(current === manual ? store : back);
                    else if (key === 'ArrowRight' && current === store) moveToExtensionElement(manual);
                    else if (key === 'ArrowDown' && cards.length) {
                        const targetCard = current === manual && cards.length > 1 ? cards[1] : cards[0];
                        moveToExtensionElement(targetCard.querySelector('.nav-ext-btn'));
                    }
                    return true;
                }

                if (card) {
                    const cardIndex = cards.indexOf(card);
                    const actions = Array.from(card.querySelectorAll('.nav-ext-btn'));
                    const actionIndex = Math.max(0, actions.indexOf(current));
                    const columns = Math.max(1, String(getComputedStyle(list).gridTemplateColumns || '').split(' ').filter(Boolean).length);
                    const moveToCard = targetIndex => {
                        if (targetIndex < 0 || targetIndex >= cards.length) return false;
                        const targetActions = Array.from(cards[targetIndex].querySelectorAll('.nav-ext-btn'));
                        return moveToExtensionElement(targetActions[Math.min(actionIndex, targetActions.length - 1)] || targetActions[0]);
                    };

                    if (key === 'ArrowRight') {
                        if (!moveToExtensionElement(actions[actionIndex + 1])) moveToCard(cardIndex + 1);
                    } else if (key === 'ArrowLeft') {
                        if (!moveToExtensionElement(actions[actionIndex - 1])) moveToCard(cardIndex - 1);
                    } else if (key === 'ArrowDown') {
                        moveToCard(cardIndex + columns);
                    } else if (key === 'ArrowUp') {
                        if (!moveToCard(cardIndex - columns)) {
                            moveToExtensionElement(cardIndex % columns === 0 ? store : manual);
                        }
                    }
                }
                return true;
            }
        }

        if (CATS[_catIdx]?.id === 'settings' && _settingsSubView === 'system') {
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
                if (!_systemSubView) {
                    if (key === 'ArrowUp') {
                        if (_contentIdx <= 0) {
                            _setTopbarFocus(true);
                            return;
                        }
                        _contentIdx = 0;
                    } else if (key === 'ArrowDown') {
                        if (_contentIdx === 0) _contentIdx = 1;
                    } else if (key === 'ArrowLeft') {
                        if (_contentIdx > 1) _contentIdx--;
                        else if (_contentIdx === 1) _contentIdx = 0;
                        else {
                            _setTopbarFocus(true);
                            return;
                        }
                    } else if (key === 'ArrowRight') {
                        if (_contentIdx >= 1 && _contentIdx < total - 1) _contentIdx++;
                    }

                    _contentIdx = Math.max(0, Math.min(total - 1, _contentIdx));
                    _updateContentFocus();
                    return;
                }

                if (_systemSubView === 'storage') {
                    const active = _contentItems[_contentIdx];
                    if (!active) return true;
                    const back = document.getElementById('setBackSystemStorage');
                    const drives = Array.from(document.querySelectorAll('.nav-storage-drive-card'));
                    const refresh = document.getElementById('navStorageRefresh');
                    const categories = Array.from(document.querySelectorAll('.nav-storage-v3-category'));
                    const openPrograms = document.getElementById('navStorageOpenPrograms');
                    const detailScroll = document.querySelector('[data-nav-storage-detail-scroll]');
                    const programs = Array.from(document.querySelectorAll('.nav-storage-program'));
                    const selectedProgram = programs.find(item => item.dataset.storageProgram === _storageSelectedProgramId) || null;
                    const selectedProgramIndex = programs.indexOf(selectedProgram);
                    const cancel = document.getElementById('navStorageCancelUninstall');
                    const confirm = document.getElementById('navStorageConfirmUninstall');
                    const moveTo = element => {
                        const index = _contentItems.indexOf(element);
                        if (index >= 0 && element && !element.disabled) {
                            _contentIdx = index;
                            _updateContentFocus();
                        }
                    };

                    if (active === back) {
                        if (key === 'ArrowUp' || key === 'ArrowLeft') _setTopbarFocus(true);
                        else if (key === 'ArrowDown' || key === 'ArrowRight') moveTo(detailScroll || drives[0] || programs[0] || cancel || confirm);
                        return true;
                    }

                    if (active === detailScroll) {
                        if (key === 'ArrowUp' && detailScroll.scrollTop <= 1) moveTo(back);
                        else if (key === 'ArrowUp' || key === 'ArrowDown') {
                            const amount = Math.max(96, Math.round(detailScroll.clientHeight * .24));
                            detailScroll.scrollTop += key === 'ArrowDown' ? amount : -amount;
                        }
                        return true;
                    }

                    const driveIndex = drives.indexOf(active);
                    if (driveIndex >= 0) {
                        if (key === 'ArrowUp') moveTo(back);
                        else if (key === 'ArrowDown') moveTo(categories[0] || openPrograms || refresh);
                        else if (key === 'ArrowLeft') moveTo(drives[driveIndex - 1] || back);
                        else if (key === 'ArrowRight') moveTo(drives[driveIndex + 1] || refresh || categories[0] || openPrograms);
                        return true;
                    }

                    if (active === refresh) {
                        if (key === 'ArrowUp') moveTo(back);
                        else if (key === 'ArrowLeft') moveTo(drives[drives.length - 1] || back);
                        else if (key === 'ArrowDown' || key === 'ArrowRight') moveTo(categories[0] || openPrograms);
                        return true;
                    }

                    const categoryIndex = categories.indexOf(active);
                    if (categoryIndex >= 0) {
                        if (key === 'ArrowUp') moveTo(categories[categoryIndex - 1] || drives[0] || back);
                        else if (key === 'ArrowDown') moveTo(categories[categoryIndex + 1] || openPrograms);
                        else if (key === 'ArrowLeft') moveTo(back);
                        return true;
                    }

                    if (active === openPrograms) {
                        if (key === 'ArrowUp') moveTo(categories[categories.length - 1] || drives[0] || back);
                        else if (key === 'ArrowLeft') moveTo(back);
                        return true;
                    }

                    const programIndex = programs.indexOf(active);
                    if (programIndex >= 0) {
                        if (key === 'ArrowUp') moveTo(programs[programIndex - 1] || back);
                        else if (key === 'ArrowDown') moveTo(active === selectedProgram ? (cancel || confirm || programs[programIndex + 1]) : programs[programIndex + 1]);
                        else if (key === 'ArrowLeft') moveTo(back);
                        return true;
                    }

                    if (active === cancel) {
                        if (key === 'ArrowRight') moveTo(confirm);
                        else if (key === 'ArrowUp') moveTo(selectedProgram || back);
                        else if (key === 'ArrowDown') moveTo(programs[selectedProgramIndex + 1]);
                        else if (key === 'ArrowLeft') moveTo(back);
                        return true;
                    }
                    if (active === confirm) {
                        if (key === 'ArrowLeft') moveTo(cancel);
                        else if (key === 'ArrowUp') moveTo(selectedProgram || back);
                        else if (key === 'ArrowDown') moveTo(programs[selectedProgramIndex + 1]);
                        return true;
                    }
                    return true;
                }

                if (_systemSubView === 'video') {
                    const activeItem = _contentItems[_contentIdx];
                    const presets = Array.from(document.querySelectorAll('.nav-video-preset'));
                    const range = document.getElementById('navVideoScale');
                    const back = document.getElementById('setBackSystemVideo');
                    const moveTo = element => {
                        const idx = _contentItems.indexOf(element);
                        if (idx >= 0) { _contentIdx = idx; _updateContentFocus(); }
                    };
                    if (activeItem === back) {
                        if (key === 'ArrowDown' || key === 'ArrowRight') moveTo(presets[0] || range);
                        else if (key === 'ArrowUp' || key === 'ArrowLeft') _setTopbarFocus(true);
                        return;
                    }
                    if (activeItem?.classList.contains('nav-video-preset')) {
                        const idx = presets.indexOf(activeItem);
                        if (key === 'ArrowLeft') moveTo(presets[Math.max(0, idx - 1)]);
                        else if (key === 'ArrowRight') moveTo(presets[Math.min(presets.length - 1, idx + 1)]);
                        else if (key === 'ArrowUp') moveTo(back);
                        else if (key === 'ArrowDown') moveTo(range);
                        return;
                    }
                    if (activeItem?.id === 'navVideoScale' && (key === 'ArrowLeft' || key === 'ArrowRight')) {
                        const delta = key === 'ArrowRight' ? 5 : -5;
                        const min = Number(activeItem.min || 25);
                        const max = Number(activeItem.max || 180);
                        const next = Math.max(min, Math.min(max, Number(activeItem.value || 100) + delta));
                        activeItem.value = String(next);
                        activeItem.dispatchEvent(new Event('input', { bubbles: true }));
                        _updateContentFocus();
                        return;
                    }
                    if (activeItem === range && key === 'ArrowUp') {
                        moveTo(presets[1] || presets[0] || back);
                        return;
                    }
                    if (activeItem === range && key === 'ArrowDown') return;
                }

                if (_systemSubView === 'updates') {
                    const tabDoorpiIdx = _contentItems.findIndex(el => el?.id === 'updatesTabDoorpi');
                    const tabWindowsIdx = _contentItems.findIndex(el => el?.id === 'updatesTabWindows');
                    const tabGpuIdx = _contentItems.findIndex(el => el?.id === 'updatesTabGpu');
                    const activeTabIdx = _systemUpdatesSubView === 'gpu'
                        ? tabGpuIdx
                        : (_systemUpdatesSubView === 'windows' ? tabWindowsIdx : tabDoorpiIdx);
                    const firstActionIdx = _contentItems.findIndex(el =>
                        el?.classList?.contains('nav-suggestion-card') ||
                        el?.classList?.contains('nav-gpu-app-card'));
                    const releaseNotesIdx = _contentItems.findIndex(el => el?.id === 'systemUpdateChangelog');
                    const actionIndices = _contentItems
                        .map((el, idx) => el?.classList?.contains('nav-suggestion-card') ? idx : -1)
                        .filter(idx => idx >= 0);
                    const actionPosition = actionIndices.indexOf(_contentIdx);
                    const onTabs = _contentIdx === tabDoorpiIdx || _contentIdx === tabWindowsIdx || _contentIdx === tabGpuIdx;
                    const gpuCardIndices = _contentItems
                        .map((el, idx) => el?.classList?.contains('nav-gpu-app-card') ? idx : -1)
                        .filter(idx => idx >= 0);
                    const gpuCardPosition = gpuCardIndices.indexOf(_contentIdx);

                    if (_systemUpdatesSubView === 'gpu' && gpuCardPosition >= 0) {
                        if (key === 'ArrowLeft') {
                            _contentIdx = gpuCardIndices[(gpuCardPosition - 1 + gpuCardIndices.length) % gpuCardIndices.length];
                        } else if (key === 'ArrowRight') {
                            _contentIdx = gpuCardIndices[(gpuCardPosition + 1) % gpuCardIndices.length];
                        } else if (key === 'ArrowUp') {
                            _contentIdx = tabGpuIdx;
                        }
                        _updateContentFocus();
                        return;
                    }

                    if (actionPosition >= 0) {
                        if (key === 'ArrowLeft' && actionPosition % 2 === 1) _contentIdx = actionIndices[actionPosition - 1];
                        else if (key === 'ArrowRight' && actionPosition % 2 === 0 && actionIndices[actionPosition + 1] !== undefined) _contentIdx = actionIndices[actionPosition + 1];
                        else if (key === 'ArrowUp') _contentIdx = actionPosition >= 2
                            ? actionIndices[actionPosition - 2]
                            : activeTabIdx;
                        else if (key === 'ArrowDown') {
                            if (actionIndices[actionPosition + 2] !== undefined) _contentIdx = actionIndices[actionPosition + 2];
                            else if (releaseNotesIdx >= 0 && _systemUpdatesSubView === 'doorpi') _contentIdx = releaseNotesIdx;
                        }
                        _updateContentFocus();
                        return;
                    }

                    if (_contentIdx === releaseNotesIdx) {
                        if (key === 'ArrowUp') _contentIdx = actionIndices[actionIndices.length - 1] ?? activeTabIdx;
                        _updateContentFocus();
                        return;
                    }

                    if (key === 'ArrowUp') {
                        if (_contentIdx <= 0) {
                            _setTopbarFocus(true);
                            return;
                        }
                        if (onTabs) _contentIdx = 0;
                        else if (_contentIdx === firstActionIdx) _contentIdx = activeTabIdx;
                        else _contentIdx--;
                    } else if (key === 'ArrowDown') {
                        if (_contentIdx === 0) _contentIdx = activeTabIdx;
                        else if (onTabs && firstActionIdx !== -1) _contentIdx = firstActionIdx;
                        else if (onTabs && releaseNotesIdx >= 0 && _systemUpdatesSubView === 'doorpi') _contentIdx = releaseNotesIdx;
                        else if (_contentIdx < total - 1) _contentIdx++;
                    } else if (key === 'ArrowLeft') {
                        if (_contentIdx === tabGpuIdx) _contentIdx = tabWindowsIdx;
                        else if (_contentIdx === tabWindowsIdx) _contentIdx = tabDoorpiIdx;
                    } else if (key === 'ArrowRight') {
                        if (_contentIdx === tabDoorpiIdx) _contentIdx = tabWindowsIdx;
                        else if (_contentIdx === tabWindowsIdx) _contentIdx = tabGpuIdx;
                    }

                    _contentIdx = Math.max(0, Math.min(total - 1, _contentIdx));
                    _updateContentFocus();
                    return;
                }

                if (key === 'ArrowUp') {
                    if (_contentIdx <= 0) {
                        _setTopbarFocus(true);
                        return;
                    }
                    _contentIdx--;
                } else if (key === 'ArrowDown') {
                    if (_contentIdx < total - 1) {
                        _contentIdx++;
                    }
                } else if (key === 'ArrowLeft') {
                    if (_contentIdx > 0) {
                        _contentIdx--;
                    } else {
                        _setTopbarFocus(true);
                        return;
                    }
                } else if (key === 'ArrowRight') {
                    return true;
                }

                _contentIdx = Math.max(0, Math.min(total - 1, _contentIdx));
                _updateContentFocus();
                return;
            }
        }

        if (CATS[_catIdx]?.id === 'settings' && (_settingsSubView === 'devicesHub' || _settingsSubView === 'connectivityHub')) {
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
                if (key === 'ArrowUp') {
                    if (_contentIdx <= 0) {
                        _setTopbarFocus(true);
                        return;
                    }
                    _contentIdx = 0;
                } else if (key === 'ArrowDown') {
                    if (_contentIdx === 0) _contentIdx = 1;
                } else if (key === 'ArrowLeft') {
                    if (_contentIdx > 1) _contentIdx--;
                    else if (_contentIdx === 1) _contentIdx = 0;
                    else {
                        _setTopbarFocus(true);
                        return;
                    }
                } else if (key === 'ArrowRight') {
                    if (_contentIdx >= 1 && _contentIdx < total - 1) _contentIdx++;
                }

                _contentIdx = Math.max(0, Math.min(total - 1, _contentIdx));
                _updateContentFocus();
                return;
            }
        }

        // Navegação Comum Padrão (Sem Lazy Load)
        switch (key) {
            case 'ArrowLeft':
                if (_contentIdx > 0) { _contentIdx--; _updateContentFocus(); }
                break;
            case 'ArrowRight':
                if (_contentIdx < total - 1) { _contentIdx++; _updateContentFocus(); }
                break;
            case 'ArrowUp':
                if (CATS[_catIdx]?.id === 'profile' && !_profileSubView && _contentIdx > 0) {
                    _contentIdx = _contentIdx >= 2 ? 1 : 0; _updateContentFocus(); break;
                }
                if (_contentIdx < cols) { _setTopbarFocus(true); }
                else { _contentIdx = Math.max(0, _contentIdx - cols); _updateContentFocus(); }
                break;
            case 'ArrowDown':
                if (CATS[_catIdx]?.id === 'profile' && !_profileSubView && _contentIdx <= 1 && total > 1) {
                    _contentIdx = _contentIdx === 0 ? 1 : (total > 2 ? 2 : 1); _updateContentFocus(); break;
                }
                if (_contentIdx + cols < total) { _contentIdx += cols; _updateContentFocus(); }
                break;
            case 'Enter': {
                if (CATS[_catIdx]?.id === 'settings' && _settingsSubView === 'sound') {
                    if (window.DoorpiSoundUI?.confirm?.('settings')) return true;
                    const active = document.activeElement;
                    if (active?.closest?.('#navSoundHost') && active.classList.contains('sound-focus')) {
                        active.click();
                        const focusedIdx = _contentItems.indexOf(document.activeElement);
                        if (focusedIdx >= 0) _contentIdx = focusedIdx;
                        return true;
                    }
                }
                const target = _contentItems[_contentIdx];
                if (target) target.click();
                break;
            }
            case 'Escape':
            case 'Backspace':
                if (CATS[_catIdx]?.id === 'settings' && _settingsSubView === 'system' && _systemSubView === 'storage' && _storageView !== 'overview') {
                    document.getElementById('setBackSystemStorage')?.click();
                    return true;
                } else if (CATS[_catIdx]?.id === 'settings' && _settingsSubView === 'system' && _systemSubView === 'storage' && _storagePendingUninstallId) {
                    _storagePendingUninstallId = '';
                    const body = document.querySelector('.nav-content-body');
                    if (body) _renderSettingsSystemStorage(body, `[data-storage-program="${CSS.escape(_storageSelectedProgramId || '')}"]`);
                    return true;
                } else if (CATS[_catIdx]?.id === 'profile' && _profileSubView === 'history') {
                    _profileSubView = null;
                    _contentIdx = 0;
                    _renderContent('profile');
                    _setTopbarFocus(false);
                } else if (CATS[_catIdx]?.id === 'settings' && _settingsSubView) {
                    if (_settingsSubView === 'bluetooth' && _bluetoothUpdateStatus?.pairingPrompt) {
                        postToHost?.({ action: 'respondBluetoothPairing', accepted: false, pin: '' });
                        return true;
                    } else if (_settingsSubView === 'bluetooth' && window.DoorpiBluetoothUI?.back?.('settings')) {
                        const body = document.querySelector('.nav-content-body');
                        if (body) _refreshSettingsBluetooth(body, '.bt-device-card');
                        return true;
                    } else if (_settingsSubView === 'bluetooth') {
                        if (_bluetoothUpdateStatus?.discovering) postToHost?.({ action: 'stopBluetoothDiscovery' });
                        _settingsSubView = 'devicesHub';
                    } else if (_settingsSubView === 'wifi' && window.DoorpiWifiUI?.back?.('settings')) {
                        const body = document.querySelector('.nav-content-body');
                        if (body) _refreshSettingsWifi(body, '.wifi-network-card');
                        return true;
                    } else if (_settingsSubView === 'wifi') {
                        _settingsSubView = 'devicesHub';
                    } else if (_settingsSubView === 'sound') {
                        const soundFocusSelector = window.DoorpiSoundUI?.back?.('settings');
                        if (soundFocusSelector) {
                            if (typeof soundFocusSelector === 'string') {
                                const body = document.querySelector('.nav-content-body');
                                if (body) _refreshSettingsSound(body, soundFocusSelector);
                            }
                            return true;
                        }
                        window.DoorpiSoundUI?.closeDrawer?.('settings');
                        _settingsSubView = 'devicesHub';
                    } else if (_settingsSubView === 'devicesHub' || _settingsSubView === 'connectivityHub') {
                        if (_settingsReturnToRoot) {
                            _settingsReturnToRoot = false;
                            _settingsSubView = null;
                            _systemSubView = null;
                        } else {
                            _settingsSubView = 'system';
                            _systemSubView = null;
                        }
                    } else if (_settingsSubView === 'system' && _systemSubView) {
                        if (_settingsReturnToRoot) {
                            _settingsReturnToRoot = false;
                            _settingsSubView = null;
                        }
                        _systemSubView = null;
                    } else {
                        _settingsSubView = (_settingsSubView === 'account' || _settingsSubView === 'sharing') ? 'accountHub' : null;
                        if (_settingsSubView !== 'system') _systemSubView = null;
                    }
                    _contentIdx = 0;
                    _renderContent('settings');
                    _updateContentFocus();
                } else { _setTopbarFocus(true); }
                return true;
            case ' ':
            case 'Square':
                window._navMenuTriggerCtxMenu();
                return true;
        }
        return false;
    }

    window.addEventListener('doorpi:profile-sync-message', event => {
        const data = event.detail || {};
        if (data.setup) return;
        if (data.type === 'profileSyncDataApplied') {
            const profileId = data.profileId || window._doorpiCurrentUserId || '';
            if (_sameId(profileId, window._doorpiCurrentUserId || _menuDataUserId)) {
                _setMenuUserContext(window._doorpiProfile || _menuData.user, profileId, true);
            }
            return;
        }
        if (data.type === 'profileSyncArtworkUpdated') {
            const item = (_menuData.history || []).find(entry =>
                String(entry?.Name || '').localeCompare(String(data.gameName || ''), undefined, { sensitivity: 'base' }) === 0);
            if (!item) return;
            if (data.verticalUrl) item.ShowcaseVerticalImageUrl = data.verticalUrl;
            if (data.horizontalUrl) item.HistoryHorizontalImageUrl = data.horizontalUrl;
            if (data.bannerUrl) item.ProfileBannerImageUrl = data.bannerUrl;
            if (data.category === 'vertical') {
                if (data.remoteUrl) item.ShowcaseVerticalImageUrl = data.remoteUrl;
                if (data.localUrl) item.ShowcaseVerticalLocalImage = data.localUrl;
            } else if (data.category === 'horizontal') {
                if (data.remoteUrl) item.HistoryHorizontalImageUrl = data.remoteUrl;
                if (data.localUrl) item.HistoryHorizontalLocalImage = data.localUrl;
            } else if (data.category === 'banner') {
                if (data.remoteUrl) item.ProfileBannerImageUrl = data.remoteUrl;
                if (data.localUrl) item.ProfileBannerLocalImage = data.localUrl;
            }
            document.querySelectorAll('[data-history-game-name]').forEach(element => {
                if (String(element.dataset.historyGameName || '').localeCompare(String(data.gameName || ''), undefined, { sensitivity: 'base' }) !== 0) return;
                const image = element.querySelector(':scope > img, .nav-profile-history-art img:not(.is-icon)');
                const source = element.classList.contains('nav-profile-history-row')
                    ? (item.HistoryHorizontalLocalImage || item.HistoryHorizontalImageUrl || item.ShowcaseVerticalLocalImage || item.ShowcaseVerticalImageUrl)
                    : (item.ShowcaseVerticalLocalImage || item.ShowcaseVerticalImageUrl);
                if (image && source) image.src = source;
            });
            return;
        }
        if (data.type === 'profileSyncBusy') {
            _profileSyncUi.busy = !!data.busy;
        } else if (data.type === 'profileSyncStatus') {
            _profileSyncUi.status = data.status || 'Disconnected';
            _profileSyncUi.connected = !!data.connected;
            _profileSyncUi.busy = false;
            _profileSyncUi.message = _profileSyncUi.connected
                ? _t('profileSyncConnected', 'Sincronizado')
                : _t('profileSyncDisconnected', 'Não conectado');
        } else if (data.type === 'profileSyncResult' || data.type === 'profileSyncConflict') {
            _profileSyncUi.status = data.status || _profileSyncUi.status;
            _profileSyncUi.busy = false;
            if (data.status === 'Disconnected') _profileSyncUi.connected = false;
            else if (['Synced', 'Uploaded', 'Downloaded', 'Conflict'].includes(data.status)) _profileSyncUi.connected = true;
            _profileSyncUi.message = data.message || (data.status === 'Offline'
                ? _t('profileSyncOffline', 'Sem conexão. Os dados locais foram mantidos.')
                : data.status === 'AuthenticationRequired'
                    ? _t('profileSyncAuthRequired', 'Entre novamente para sincronizar.')
                    : data.status === 'Failed'
                        ? _t('profileSyncFailed', 'Falha na sincronização')
                        : (_profileSyncUi.connected ? _t('profileSyncConnected', 'Sincronizado') : _t('profileSyncDisconnected', 'Não conectado')));
        }
        window._refreshProfileSyncAccountUi?.();
        if (window.isNavMenuOpen && _settingsSubView === 'account') _updateContentFocus();
    });

