    (function initSystemUpdatePrompt() {
        const DISMISSED_KEY = 'doorpi.updatePrompt.dismissedTarget';
        let latestStatus = null;
        let retryTimer = 0;
        let isVisible = false;

        function esc(value) {
            return String(value ?? '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        function hasUpdate(status) {
            return !!(status && (status.doorpiUpdateAvailable || status.updaterUpdateAvailable));
        }

        function targetKey(status) {
            if (!hasUpdate(status)) return '';
            const doorpi = status.remoteDoorpiVersion || status.localDoorpiVersion || '';
            const updater = status.remoteUpdaterVersion || status.localUpdaterVersion || '';
            return `${doorpi}|${updater}|${status.doorpiUpdateAvailable ? 'doorpi' : ''}|${status.updaterUpdateAvailable ? 'updater' : ''}`;
        }

        function dismissedTarget() {
            try { return localStorage.getItem(DISMISSED_KEY) || ''; }
            catch { return ''; }
        }

        function dismissCurrentTarget() {
            const key = targetKey(latestStatus);
            if (!key) return;
            try { localStorage.setItem(DISMISSED_KEY, key); }
            catch { }
        }

        function clearDismissalIfResolved(status) {
            if (hasUpdate(status)) return;
            if (status?.status !== 'up-to-date') return;
            try { localStorage.removeItem(DISMISSED_KEY); }
            catch { }
        }

        function isLaunchOverlayVisible() {
            const overlay = document.getElementById('gameLaunchOverlay');
            return !!(overlay && overlay.classList.contains('visible'));
        }

        function hasRuntimeSession() {
            try {
                if (typeof _hasAnyRuntimeSession === 'function' && _hasAnyRuntimeSession()) return true;
            } catch { }

            const running = window.DoorpiRuntimeState?.running;
            return Array.isArray(running) && running.length > 0;
        }

        function shouldDeferAutoPrompt(status = latestStatus) {
            const force = !!status?.forceUpdate;
            if (isVisible) return false;
            if (!window._isIntroComplete) return true;
            if (!window._doorpiUserSessionReady) return true;
            if (document.body.classList.contains('user-picker-open')) return true;
            if (document.getElementById('doorpiUserPicker')?.style.display === 'flex') return true;
            if (window._isExternalAppRunning) return true;
            if (hasRuntimeSession()) return true;
            if (window.isDoorpiSessionTransitionActive?.()) return true;
            if (window.isGlobalLoading) return true;

            if (force) return false;

            if (document.querySelector('.profile-sync-overlay')) {
                window.DoorpiProfileSync?.deferConflictForUpdate?.();
            }
            if (window.isNavMenuOpen || ['opening', 'closing'].includes(window._navMenuPhase || 'closed')) return true;
            if (window.isModalOpen || window.isSetupOpen || window._vkbIsOpen) return true;
            if (typeof isCtxMenuOpen !== 'undefined' && isCtxMenuOpen) return true;
            if (typeof isEditModalOpen !== 'undefined' && isEditModalOpen) return true;
            if (window.isDoorpiOverlayOpen?.()) return true;
            if (isLaunchOverlayVisible()) return true;
            return false;
        }

        function scheduleEvaluate(delay = 1200) {
            if (retryTimer) clearTimeout(retryTimer);
            retryTimer = setTimeout(() => {
                retryTimer = 0;
                evaluate();
            }, delay);
        }

        function ensureBadge() {
            let badge = document.getElementById('doorpiUpdateBadge');
            if (badge) return badge;

            badge = document.createElement('button');
            badge.id = 'doorpiUpdateBadge';
            badge.className = 'doorpi-update-badge';
            badge.type = 'button';
            badge.tabIndex = 0;
            badge.innerHTML = `
                <span class="doorpi-update-badge-dot"></span>
                <span class="doorpi-update-badge-text">${t('updateBadgeText')}</span>
            `;
            badge.addEventListener('click', () => show(true));
            badge.addEventListener('keydown', (e) => {
                if (e.key !== 'Enter' && e.key !== ' ') return;
                e.preventDefault();
                show(true);
            });

            const profile = document.getElementById('btnTopProfile');
            if (profile && profile.parentNode) {
                profile.insertAdjacentElement('afterend', badge);
            } else {
                document.body.appendChild(badge);
            }
            return badge;
        }

        function updateBadge() {
            window.DoorpiNotifications?.setSystemUpdateStatus?.(latestStatus || {});
        }

        function ensurePrompt() {
            let prompt = document.getElementById('doorpiUpdatePrompt');
            if (prompt) return prompt;

            prompt = document.createElement('div');
            prompt.id = 'doorpiUpdatePrompt';
            prompt.className = 'doorpi-update-prompt';
            prompt.setAttribute('role', 'dialog');
            prompt.setAttribute('aria-modal', 'true');
            prompt.setAttribute('aria-labelledby', 'doorpiUpdatePromptTitle');
            prompt.innerHTML = `
                <div class="doorpi-update-shell">
                    <div class="doorpi-update-header">
                        <div>
                            <div class="doorpi-update-kicker">${t('updatePromptKicker')}</div>
                            <h2 id="doorpiUpdatePromptTitle">${t('updatePromptInitialTitle')}</h2>
                        </div>
                    </div>
                    <div class="doorpi-update-version-row" id="doorpiUpdateVersionRow"></div>
                    <p id="doorpiUpdatePromptSubtitle" class="doorpi-update-subtitle"></p>
                    <div class="doorpi-update-warning">${t('updatePromptWarning')}</div>
                    <div class="doorpi-update-actions">
                        <button id="doorpiUpdateStartBtn" class="doorpi-update-primary" type="button">${t('updatePromptStart')}</button>
                        <button id="doorpiUpdateLaterBtn" class="doorpi-update-secondary" type="button">${t('updatePromptLater')}</button>
                    </div>
                </div>
            `;
            document.body.appendChild(prompt);

            prompt.querySelector('#doorpiUpdateStartBtn')?.addEventListener('click', () => {
                hide(false, false);
                if (typeof postToHost === 'function') {
                    postToHost({ action: 'startSystemUpdate' });
                }
            });

            prompt.querySelector('#doorpiUpdateLaterBtn')?.addEventListener('click', () => {
                if (latestStatus?.forceUpdate) return;
                dismissCurrentTarget();
                hide(true);
            });

            prompt.addEventListener('keydown', (e) => {
                if (!isVisible) return;
                const buttons = Array.from(prompt.querySelectorAll('button'))
                    .filter(btn => !btn.hidden && !btn.disabled);
                const current = buttons.indexOf(document.activeElement);
                if (e.key === 'Escape' || e.key === 'Backspace') {
                    e.preventDefault();
                    if (latestStatus?.forceUpdate) return;
                    dismissCurrentTarget();
                    hide(true);
                    return;
                }
                if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
                    e.preventDefault();
                    const dir = (e.key === 'ArrowLeft' || e.key === 'ArrowUp') ? -1 : 1;
                    const next = buttons[(Math.max(0, current) + dir + buttons.length) % buttons.length];
                    next?.focus();
                }
            });

            return prompt;
        }

        function promptIsOpen() {
            const prompt = document.getElementById('doorpiUpdatePrompt');
            return !!(isVisible || prompt?.classList.contains('is-visible'));
        }

        function focusPromptPrimary() {
            const prompt = ensurePrompt();
            const active = document.activeElement;
            if (prompt.contains(active)) return;
            prompt.querySelector('#doorpiUpdateStartBtn')?.focus({ preventScroll: true });
        }

        function handlePromptKey(e) {
            if (!promptIsOpen()) return false;

            const prompt = ensurePrompt();
            const buttons = Array.from(prompt.querySelectorAll('button'))
                .filter(btn => !btn.hidden && !btn.disabled);
            const current = buttons.indexOf(document.activeElement);

            e.preventDefault();
            e.stopImmediatePropagation();

            if (e.key === 'Escape' || e.key === 'Backspace') {
                if (latestStatus?.forceUpdate) {
                    focusPromptPrimary();
                    return true;
                }
                dismissCurrentTarget();
                hide(true);
                return true;
            }

            if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
                const dir = (e.key === 'ArrowLeft' || e.key === 'ArrowUp') ? -1 : 1;
                const idx = current >= 0 ? current : 0;
                buttons[(idx + dir + buttons.length) % buttons.length]?.focus({ preventScroll: true });
                return true;
            }

            if (e.key === 'Enter' || e.key === ' ') {
                const activeButton = buttons.includes(document.activeElement)
                    ? document.activeElement
                    : prompt.querySelector('#doorpiUpdateStartBtn');
                activeButton?.click();
                return true;
            }

            focusPromptPrimary();
            return true;
        }

        function handlePromptPointer(e) {
            if (!promptIsOpen()) return false;

            const prompt = ensurePrompt();
            const button = e.target?.closest?.('#doorpiUpdatePrompt button');
            if (button && prompt.contains(button)) return false;

            e.preventDefault();
            e.stopImmediatePropagation();
            focusPromptPrimary();
            return true;
        }

        function renderPrompt() {
            const prompt = ensurePrompt();
            const title = prompt.querySelector('#doorpiUpdatePromptTitle');
            const sub = prompt.querySelector('#doorpiUpdatePromptSubtitle');
            const versions = prompt.querySelector('#doorpiUpdateVersionRow');
            const kicker = prompt.querySelector('.doorpi-update-kicker');
            const startBtn = prompt.querySelector('#doorpiUpdateStartBtn');
            const laterBtn = prompt.querySelector('#doorpiUpdateLaterBtn');

            const status = latestStatus || {};
            const force = !!status.forceUpdate;
            const parts = [];
            if (status.doorpiUpdateAvailable) parts.push('Doorpi');
            if (status.updaterUpdateAvailable) parts.push(t('updatePromptSystemComponents'));
            const scope = parts.length ? parts.join(' + ') : 'Doorpi';

            prompt.classList.toggle('is-force', force);
            if (kicker) kicker.textContent = force ? t('updatePromptForceKicker') : t('updatePromptKicker');
            if (title) title.textContent = force ? t('updatePromptForceTitle') : t('updatePromptInitialTitle');
            if (sub) {
                sub.textContent = force ? t('updatePromptForceSubtitle') : t('updatePromptSubtitle');
            }
            if (startBtn) startBtn.textContent = force ? t('updatePromptForceContinue') : t('updatePromptStart');
            if (laterBtn) {
                laterBtn.hidden = force;
                laterBtn.disabled = force;
            }

            if (versions) {
                const doorpi = status.doorpiUpdateAvailable
                    ? `<span>Doorpi ${esc(status.localDoorpiVersion || '--')} -> ${esc(status.remoteDoorpiVersion || '--')}</span>`
                    : '';
                const updater = status.updaterUpdateAvailable
                    ? `<span>Updater ${esc(status.localUpdaterVersion || '--')} -> ${esc(status.remoteUpdaterVersion || '--')}</span>`
                    : '';
                versions.innerHTML = [doorpi, updater].filter(Boolean).join('');
            }
        }

        function show(manual = false) {
            if (!hasUpdate(latestStatus)) return;

            if (!manual) {
                if (!latestStatus?.forceUpdate && targetKey(latestStatus) === dismissedTarget()) return;
                if (shouldDeferAutoPrompt()) {
                    scheduleEvaluate(1500);
                    return;
                }
            }

            window.DoorpiProfileSync?.deferConflictForUpdate?.();
            renderPrompt();
            const prompt = ensurePrompt();
            isVisible = true;
            prompt.classList.add('is-visible');
            document.body.classList.add('doorpi-update-modal-open');
            window.updateDoorpiQuickMenuAvailability?.();
            window.DoorpiUiSound?.play('confirm');
            requestAnimationFrame(() => {
                focusPromptPrimary();
                window.updateNavHint?.();
            });
        }

        function hide(refocus = false, resumeProfileConflict = true) {
            const prompt = document.getElementById('doorpiUpdatePrompt');
            isVisible = false;
            prompt?.classList.remove('is-visible');
            document.body.classList.remove('doorpi-update-modal-open');
            window.updateDoorpiQuickMenuAvailability?.();
            if (refocus) setTimeout(() => recoverGlobalFocus?.(), 60);
            if (resumeProfileConflict) window.DoorpiProfileSync?.resumePendingConflict?.();
        }

        function evaluate() {
            if (!hasUpdate(latestStatus)) {
                hide(false);
                return;
            }
            updateBadge();
            show(false);
        }

        function setStatus(status) {
            latestStatus = { ...(latestStatus || {}), ...(status || {}) };
            clearDismissalIfResolved(latestStatus);
            updateBadge();
            evaluate();
        }

        function injectStyles() {
            if (document.getElementById('doorpi-update-prompt-styles')) return;
            const style = document.createElement('style');
            style.id = 'doorpi-update-prompt-styles';
            style.textContent = __doorpiCss("injected-styles/app/doorpi-update-prompt-styles.css");
            document.head.appendChild(style);
        }

        injectStyles();
        ensureBadge();

        window.isDoorpiUpdatePromptOpen = promptIsOpen;
        document.addEventListener('keydown', handlePromptKey, true);
        document.addEventListener('keyup', (e) => {
            if (!promptIsOpen()) return;
            e.preventDefault();
            e.stopImmediatePropagation();
        }, true);
        ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'dblclick', 'touchstart', 'touchend'].forEach(type => {
            document.addEventListener(type, handlePromptPointer, true);
        });

        window.DoorpiUpdatePrompt = {
            setStatus,
            evaluate,
            show: () => show(true),
            hide: () => hide(true),
            hasPendingUpdate: () => hasUpdate(latestStatus) && (
                !!latestStatus?.forceUpdate || targetKey(latestStatus) !== dismissedTarget()
            ),
            refreshBadge: updateBadge
        };

        window.addEventListener('message', (event) => {
            const data = event.data;
            const type = typeof data === 'string' ? data : data?.type;
            if (type === 'doorpi:intro:complete') scheduleEvaluate(120);
            if (type === 'currentUserUpdated') scheduleEvaluate(420);
            if (type === 'userSwitchComplete') scheduleEvaluate(520);
        });

        window.addEventListener('focus', () => scheduleEvaluate(220));
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) scheduleEvaluate(220);
        });
    })();
    

