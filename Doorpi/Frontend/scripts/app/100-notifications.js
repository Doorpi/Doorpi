    window.DoorpiNotifications = (() => {
        const items = new Map();
        const toastQueue = [];
        const updateDismissalKeys = {
            'doorpi-system-update': 'doorpi.notifications.dismissedSystemUpdate',
            'windows-update': 'doorpi.notifications.dismissedWindowsUpdate',
        };
        const activeUpdateTargets = new Map();
        let isOpen = false;
        let toastTimer = 0;
        let activeToastTimer = 0;

        function esc(value) {
            return String(value ?? '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        function iconSvg() {
            return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/>
                <path d="M10 21h4"/>
            </svg>`;
        }

        function isHomeReady() {
            if (!window._doorpiUserSessionReady) return false;
            if (document.body.classList.contains('user-picker-open')) return false;
            if (window.isModalOpen || window.isSetupOpen || window._vkbIsOpen) return false;
            if (window.isNavMenuOpen || ['opening', 'closing'].includes(window._navMenuPhase || 'closed')) return false;
            if (window.isDoorpiOverlayOpen?.()) return false;
            if (window.isGlobalLoading || window.isDoorpiSessionTransitionActive?.()) return false;
            return true;
        }

        function isForCurrentProfile(notification) {
            const profileId = String(notification?.profileId || '').trim().toLowerCase();
            if (!profileId) return true;
            const currentId = String(window._doorpiCurrentUserId || '').trim().toLowerCase();
            return !!currentId && profileId === currentId;
        }

        function ensureRoot() {
            let root = document.getElementById('doorpiNotificationCenter');
            if (root) return root;

            root = document.createElement('div');
            root.id = 'doorpiNotificationCenter';
            root.className = 'doorpi-notification-center is-visible';
            root.innerHTML = `
                <button id="doorpiNotificationButton" class="doorpi-notification-button" type="button" tabindex="0" title="${esc(t('notificationsTitle'))}">
                    <span class="doorpi-notification-icon">${iconSvg()}</span>
                    <span id="doorpiNotificationCount" class="doorpi-notification-count"></span>
                </button>
                <div id="doorpiNotificationToast" class="doorpi-notification-toast"></div>
                <div id="doorpiNotificationPanel" class="doorpi-notification-panel" role="dialog" aria-label="${esc(t('notificationsTitle'))}">
                    <div class="doorpi-notification-panel-title">${esc(t('notificationsTitle'))}</div>
                    <div id="doorpiNotificationList" class="doorpi-notification-list"></div>
                </div>
            `;

            const cluster = document.getElementById('doorpiTopCluster') || window._doorpiTopCluster;
            const profile = document.getElementById('btnTopProfile');
            if (cluster) cluster.appendChild(root);
            else if (profile && profile.parentNode) profile.insertAdjacentElement('afterend', root);
            else document.body.appendChild(root);

            const button = root.querySelector('#doorpiNotificationButton');
            button?.addEventListener('click', toggle);
            button?.addEventListener('keydown', (e) => {
                if (e.key !== 'Enter' && e.key !== ' ') return;
                e.preventDefault();
                e.stopPropagation();
                toggle();
            });

            root.addEventListener('click', (e) => {
                const close = e.target?.closest?.('[data-notification-close]');
                if (close) {
                    e.preventDefault();
                    e.stopPropagation();
                    remove(close.dataset.notificationClose || '');
                    return;
                }

                const row = e.target?.closest?.('.doorpi-notification-item');
                if (row?.dataset.action === 'doorpi-update') {
                    window.DoorpiUpdatePrompt?.show?.();
                } else if (row?.dataset.action === 'windows-update') {
                    window.DoorpiQuickPanel?.open?.('updates');
                } else if (row?.dataset.action === 'profile-sync-conflict') {
                    close();
                    postToHost?.({
                        action: 'profileSyncNow',
                        profileId: row.dataset.profileId || window._doorpiCurrentUserId || ''
                    });
                }
            });

            root.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' || e.key === 'Backspace') {
                    if (isOpen) {
                        e.preventDefault();
                        e.stopPropagation();
                        close();
                    }
                    return;
                }

                const closeBtn = e.target?.closest?.('[data-notification-close]');
                if (!closeBtn || (e.key !== 'Enter' && e.key !== ' ')) return;
                e.preventDefault();
                e.stopPropagation();
                remove(closeBtn.dataset.notificationClose || '');
            });

            document.addEventListener('pointerdown', (e) => {
                if (!isOpen || root.contains(e.target)) return;
                close();
            }, true);

            document.addEventListener('keydown', (e) => {
                if (!isOpen) return;
                if (e.key !== 'Escape' && e.key !== 'Backspace') return;
                e.preventDefault();
                e.stopImmediatePropagation();
                close();
            }, true);

            injectStyles();
            render();
            return root;
        }

        function injectStyles() {
            if (document.getElementById('doorpi-notification-styles')) return;
            const style = document.createElement('style');
            style.id = 'doorpi-notification-styles';
            style.textContent = __doorpiCss("injected-styles/app/doorpi-notification-styles.css");
            document.head.appendChild(style);
        }

        function pendingCount() {
            return Array.from(items.values()).filter(n => isForCurrentProfile(n) && (!n.read || n.persistent)).length;
        }

        function render() {
            const root = ensureRoot();
            const countEl = root.querySelector('#doorpiNotificationCount');
            const list = root.querySelector('#doorpiNotificationList');
            const count = pendingCount();
            root.classList.add('is-visible');
            if (countEl) {
                countEl.textContent = String(Math.min(count, 99));
                countEl.classList.toggle('is-visible', count > 0);
            }
            if (list) {
                const rows = Array.from(items.values())
                    .filter(isForCurrentProfile)
                    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
                list.innerHTML = rows.length
                    ? rows.map(n => `
                        <button class="doorpi-notification-item" type="button" tabindex="0" data-notification-id="${esc(n.id)}" data-action="${esc(n.action || '')}" data-profile-id="${esc(n.profileId || '')}">
                            <span>
                                <span class="doorpi-notification-title">${esc(n.title)}</span>
                                <span class="doorpi-notification-message">${esc(n.message)}</span>
                            </span>
                            <span class="doorpi-notification-close" role="button" tabindex="0" data-notification-close="${esc(n.id)}" aria-label="${esc(t('notificationsDismiss'))}">&times;</span>
                        </button>
                    `).join('')
                    : `<div class="doorpi-notification-empty">${esc(t('notificationsEmpty'))}</div>`;
            }
        }

        function showToast(notification) {
            const root = ensureRoot();
            const toast = root.querySelector('#doorpiNotificationToast');
            if (!toast || !notification?.message) return;
            toast.textContent = notification.toast || notification.message;
            toast.classList.add('is-visible');
            clearTimeout(activeToastTimer);
            activeToastTimer = setTimeout(() => {
                toast.classList.remove('is-visible');
                activeToastTimer = setTimeout(processToastQueue, 260);
            }, 4300);
        }

        function processToastQueue() {
            if (!toastQueue.length) return;
            if (!isHomeReady()) {
                scheduleToast();
                return;
            }
            const index = toastQueue.findIndex(isForCurrentProfile);
            if (index < 0) return;
            showToast(toastQueue.splice(index, 1)[0]);
        }

        function scheduleToast() {
            clearTimeout(toastTimer);
            toastTimer = setTimeout(processToastQueue, isHomeReady() ? 120 : 1200);
        }

        function upsert(notification = {}) {
            if (!notification.id) return;
            const existing = items.get(notification.id);
            const next = {
                ...existing,
                ...notification,
                title: notification.title || existing?.title || t('notificationsTitle'),
                message: notification.message || existing?.message || '',
                createdAt: existing?.createdAt || Date.now(),
                read: notification.read ?? existing?.read ?? false,
                persistent: !!(notification.persistent ?? existing?.persistent),
            };
            items.set(next.id, next);
            render();
            if (!existing && next.message) {
                toastQueue.push(next);
                scheduleToast();
            }
        }

        function readDismissedUpdateTarget(id) {
            const key = updateDismissalKeys[id];
            if (!key) return '';
            try { return localStorage.getItem(key) || ''; }
            catch { return ''; }
        }

        function rememberDismissedUpdateTarget(id) {
            const key = updateDismissalKeys[id];
            const target = activeUpdateTargets.get(id) || '';
            if (!key || !target) return;
            try { localStorage.setItem(key, target); }
            catch { }
        }

        function remove(id, options = {}) {
            if (!id) return;
            if (options.rememberDismissal !== false) rememberDismissedUpdateTarget(id);
            items.delete(id);
            for (let i = toastQueue.length - 1; i >= 0; i--) {
                if (toastQueue[i]?.id === id) toastQueue.splice(i, 1);
            }
            render();
        }

        function open() {
            const root = ensureRoot();
            isOpen = true;
            root.classList.add('is-open');
            items.forEach(n => {
                if (isForCurrentProfile(n) && !n.persistent) n.read = true;
            });
            render();
            requestAnimationFrame(() => {
                root.querySelector('#doorpiNotificationList .doorpi-notification-item')?.focus?.({ preventScroll: true });
            });
        }

        function close() {
            const root = ensureRoot();
            const restoreButtonFocus = root.querySelector('#doorpiNotificationPanel')?.contains(document.activeElement);
            isOpen = false;
            root.classList.remove('is-open');
            Array.from(items.values()).forEach(n => {
                if (isForCurrentProfile(n) && !n.persistent && n.read) items.delete(n.id);
            });
            render();
            if (restoreButtonFocus) {
                requestAnimationFrame(() => root.querySelector('#doorpiNotificationButton')?.focus?.({ preventScroll: true }));
            }
        }

        function toggle() {
            if (isOpen) close();
            else open();
        }

        function setSystemUpdateStatus(status = {}) {
            const hasUpdate = !!(status.doorpiUpdateAvailable || status.updaterUpdateAvailable);
            if (!hasUpdate) {
                activeUpdateTargets.delete('doorpi-system-update');
                remove('doorpi-system-update', { rememberDismissal: false });
                return;
            }
            const target = [
                status.doorpiUpdateAvailable ? (status.remoteDoorpiVersion || 'doorpi') : '',
                status.updaterUpdateAvailable ? (status.remoteUpdaterVersion || 'updater') : '',
            ].join('|');
            activeUpdateTargets.set('doorpi-system-update', target);
            if (readDismissedUpdateTarget('doorpi-system-update') === target) {
                remove('doorpi-system-update', { rememberDismissal: false });
                return;
            }
            const parts = [];
            if (status.doorpiUpdateAvailable) parts.push('Doorpi');
            if (status.updaterUpdateAvailable) parts.push(t('updatePromptSystemComponents'));
            upsert({
                id: 'doorpi-system-update',
                title: t('updatePromptInitialTitle'),
                message: t('updatePromptTitle', parts.join(' + ') || 'Doorpi'),
                toast: t('updateBadgeAvailableTitle'),
                persistent: true,
                action: 'doorpi-update',
            });
        }

        function setWindowsUpdateStatus(status = {}) {
            const updates = Array.isArray(status.updates) ? status.updates : [];
            const hasUpdate = !!status.rebootRequired || updates.length > 0;
            if (!hasUpdate) {
                activeUpdateTargets.delete('windows-update');
                remove('windows-update', { rememberDismissal: false });
                return;
            }
            const updateTargets = updates
                .map(update => `${update.updateId || update.title || 'update'}:${update.revisionNumber || 0}`)
                .sort();
            const resultTargets = (Array.isArray(status.packageResults) ? status.packageResults : [])
                .map(result => result.updateId || result.title || '')
                .filter(Boolean)
                .sort();
            const target = [
                status.rebootRequired ? 'reboot' : 'updates',
                ...(updateTargets.length ? updateTargets : resultTargets),
                (!updateTargets.length && !resultTargets.length) ? (status.lastCheckedAt || status.lastInstallPhase || 'windows') : '',
            ].join('|');
            activeUpdateTargets.set('windows-update', target);
            if (readDismissedUpdateTarget('windows-update') === target) {
                remove('windows-update', { rememberDismissal: false });
                return;
            }
            upsert({
                id: 'windows-update',
                title: status.rebootRequired ? t('windowsUpdateRestartTitle') : t('windowsUpdateFoundTitle'),
                message: updates.length ? t('windowsUpdatePackages', updates.length) : t('windowsRestartDesc'),
                toast: status.rebootRequired ? t('windowsUpdateRestartTitle') : t('windowsUpdateFoundTitle'),
                persistent: true,
                action: 'windows-update',
            });
        }

        function setExtensionUpdates(updates = {}) {
            const count = Object.keys(updates || {}).length;
            if (!count) {
                remove('extension-updates');
                return;
            }
            upsert({
                id: 'extension-updates',
                title: t('notificationsExtensionUpdateTitle'),
                message: t('notificationsExtensionUpdateMessage', count),
                toast: t('notificationsExtensionUpdateTitle'),
                persistent: true,
            });
        }

        function notifySteamGridDownloadFailure() {
            upsert({
                id: 'steamgrid-download-failed',
                title: t('notificationsSteamGridDownloadTitle'),
                message: t('notificationsSteamGridDownloadMessage'),
                toast: t('notificationsSteamGridDownloadMessage'),
                persistent: false,
            });
        }

        function notifySteamGridNotFound(name) {
            const safeName = String(name || '').trim();
            upsert({
                id: `steamgrid-not-found-${safeName.toLowerCase()}`,
                title: t('notificationsSteamGridNotFoundTitle'),
                message: t('notificationsSteamGridNotFoundMessage', safeName || t('genericGameName')),
                persistent: false,
            });
        }

        window.addEventListener('message', (event) => {
            const data = event.data;
            const type = typeof data === 'string' ? data : data?.type;
            if (type === 'currentUserUpdated' || type === 'userSwitchComplete') {
                setTimeout(() => {
                    render();
                    scheduleToast();
                }, 250);
            }
        });

        window.isDoorpiNotificationCenterOpen = () => isOpen;

        return {
            upsert,
            remove,
            open,
            close,
            toggle,
            render,
            setSystemUpdateStatus,
            setWindowsUpdateStatus,
            setExtensionUpdates,
            notifySteamGridDownloadFailure,
            notifySteamGridNotFound,
        };
    })();

