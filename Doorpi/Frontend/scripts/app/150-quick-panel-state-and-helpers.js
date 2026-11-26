    function filterStorageProgramsByName(programs, query) {
        const normalize = value => String(value ?? '').normalize('NFD').replace(/\p{M}/gu, '').trim().toLowerCase();
        const term = normalize(query);
        return term ? programs.filter(program => normalize(program.name).includes(term)) : programs;
    }

    window.DoorpiQuickPanel = (() => {
        let doorpiStatus = null;
        let windowsStatus = null;
        let gpuStatus = null;
        let bluetoothStatus = null;
        let wifiStatus = null;
        let soundStatus = null;
        let storageStatus = null;
        let storagePrograms = null;
        let storageProgramQuery = '';
        let storageView = 'overview';
        let selectedStorageRoot = '';
        let selectedStorageCategoryKey = 'applications';
        let selectedStorageProgramId = '';
        let pendingUninstallId = '';
        let uninstallStatus = null;
        const expandedStorageCategories = new Set(['games', 'applications', 'doorpi']);
        let section = null;
        let updateView = 'hub';
        let connectivityView = 'hub';
        let depth = 'menu';
        let bluetoothPatchTimer = 0;

        function ensureStyles() {
            if (document.getElementById('doorpiQuickPanelStyles')) return;
            const s = document.createElement('style');
            s.id = 'doorpiQuickPanelStyles';
            s.textContent = __doorpiCss("injected-styles/app/doorpi-quick-panel-shell.css") +
                __doorpiCss("injected-styles/app/doorpi-quick-panel-styles.css");
            document.head.appendChild(s);
        }

        function esc(value) {
            return typeof escapeHtml === 'function'
                ? escapeHtml(String(value ?? ''))
                : String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
        }

        function canOpen() {
            return window.isDoorpiStableHomeState?.() === true &&
                window.isDoorpiFileBrowserOpen?.() !== true;
        }

        function ensure() {
            ensureStyles();
            let overlay = document.getElementById('doorpiQuickPanel');
            if (overlay) return overlay;
            overlay = document.createElement('div');
            overlay.id = 'doorpiQuickPanel';
            overlay.className = 'doorpi-quick-panel doorpi-manager-overlay';
            overlay.dataset.required = 'false';
            overlay.addEventListener('click', (e) => {
                if (e.target !== overlay) return;
                if (storageUninstallerIsActive(selectedStorageProgramId)) {
                    e.preventDefault();
                    e.stopPropagation();
                    requestAnimationFrame(() => api.focusStorageUninstallerReturn(selectedStorageProgramId));
                    return;
                }
                close();
            });
            document.body.appendChild(overlay);
            return overlay;
        }

        function statusPill(kind, status) {
            if (['error','access-denied'].includes(status?.status)) return `<span class="dq-pill err">${t('quickError')}</span>`;
            const phase = { checking:'quickChecking', downloading:'windowsUpdateDownloading', installing:'windowsUpdateInstalling' }[status?.status];
            if (phase) return `<span class="dq-pill">${t(phase)}</span>`;
            if (kind === 'gpu') {
                const adapters = Array.isArray(status?.adapters) ? status.adapters : [];
                const updaters = Array.isArray(status?.updaters) ? status.updaters : [];
                if (status?.status === 'error') return `<span class="dq-pill err">${t('quickError')}</span>`;
                if (!status?.lastCheckedAt && !adapters.length) return `<span class="dq-pill">${t('updateUnchecked')}</span>`;
                if (!adapters.length) return `<span class="dq-pill warn">${t('quickNoGpu')}</span>`;
                if (!updaters.length) return `<span class="dq-pill warn">${t('quickNoApp')}</span>`;
                return `<span class="dq-pill">${t('quickDetected')}</span>`;
            }
            if (kind === 'doorpi') {
                const available = !!(status?.doorpiUpdateAvailable || status?.updaterUpdateAvailable);
                if (status?.forceUpdate) return `<span class="dq-pill warn">${t('updateRequired')}</span>`;
                if (status?.status === 'not-configured') return `<span class="dq-pill warn">${t('updateSetupNeeded')}</span>`;
                if (available) return `<span class="dq-pill warn">${t('quickAvailable')}</span>`;
                if (status?.status === 'error') return `<span class="dq-pill err">${t('quickError')}</span>`;
                if (status?.status === 'checking') return `<span class="dq-pill">${t('quickChecking')}</span>`;
                return `<span class="dq-pill">${t(status?.lastCheckedAt ? 'quickUpdated' : 'updateUnchecked')}</span>`;
            }
            const updates = Array.isArray(status?.updates) ? status.updates : [];
            if (status?.rebootRequired) return `<span class="dq-pill warn">${t('quickRestart')}</span>`;
            if (status?.status === 'error') return `<span class="dq-pill err">${t('quickError')}</span>`;
            if (status?.status === 'checking' || status?.status === 'downloading' || status?.status === 'installing') return `<span class="dq-pill">${t('quickProcessing')}</span>`;
            if (updates.length) return `<span class="dq-pill warn">${t('quickAvailable')}</span>`;
            return `<span class="dq-pill">${t(status?.lastCheckedAt ? 'quickUpdated' : 'updateUnchecked')}</span>`;
        }

        function dateText(value) {
            if (!value) return t('never');
            const d = new Date(value);
            if (Number.isNaN(d.getTime())) return t('never');
            return d.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit' }) + ' ' +
                d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
        }

        function sizeText(bytes) {
            const value = Number(bytes || 0);
            if (!Number.isFinite(value) || value <= 0) return '';
            if (value >= 1024 * 1024 * 1024) return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`;
            if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(0)} MB`;
            return `${Math.max(1, Math.round(value / 1024))} KB`;
        }

        function windowsActionLabel(status) {
            if (status === 'installing') return t('windowsUpdateInstalling');
            if (status === 'downloading') return t('windowsUpdateDownloading');
            if (status === 'checking') return t('windowsUpdateChecking');
            return t('checkWindows');
        }

        function windowsPackageState(item) {
            if (item?.rebootRequired || item?.status === 'reboot-required')
                return { text: t('windowsUpdateRebootPending'), cls: 'restart' };
            const keys = {
                pending: 'windowsUpdatePending',
                downloading: 'windowsUpdateDownloading',
                downloaded: 'windowsUpdateDownloaded',
                installing: 'windowsUpdateInstalling',
                installed: 'windowsUpdateInstalled',
                error: 'windowsUpdatePackageError'
            };
            return { text: t(keys[item?.status] || 'windowsUpdatePending'), cls: '' };
        }

        function windowsUpdateRows(status, updates) {
            const progress = Array.isArray(status?.packageProgress) ? status.packageProgress : [];
            if (!progress.length) {
                return updates.length
                    ? updates.map(update => `<div class="dq-update-row"><span>${esc(update.title || t('quickWindowsUpdateName'))}</span><span>${esc(sizeText(update.sizeBytes))}</span></div>`).join('')
                    : `<div class="dq-update-row"><span>${t('windowsUpdateNoneListed')}</span></div>`;
            }

            const updatesById = new Map(updates.map(update => [String(update.updateId || '').toLowerCase(), update]));
            return progress.map(item => {
                const update = updatesById.get(String(item.updateId || '').toLowerCase());
                const state = windowsPackageState(item);
                const percent = Math.max(0, Math.min(100, Number(item.percent) || 0));
                const detail = [state.text, `${Math.round(percent)}%`, sizeText(update?.sizeBytes)].filter(Boolean).join(' - ');
                return `<div class="dq-update-progress">
                    <div class="dq-update-progress-head"><span class="dq-update-progress-title">${esc(item.title || update?.title || t('quickWindowsUpdateName'))}</span><span class="dq-update-progress-state ${state.cls}">${esc(detail)}</span></div>
                    <div class="dq-progress-track"><div class="dq-progress-fill" style="--progress:${percent}%"></div></div>
                </div>`;
            }).join('');
        }

        function iconSvg(id, cls = '') {
            const icons = {
                updates: '<path d="M21 12a9 9 0 0 1-15.5 6.2"/><path d="M3 12A9 9 0 0 1 18.5 5.8"/><path d="M18.5 2.8v3h-3"/><path d="M5.5 21.2v-3h3"/>',
                connectivity: '<path d="M12 2v20l6-6-6-4 6-4-6-6Z"/><path d="M6.5 6.5 12 12l-5.5 5.5"/>',
                sound: '<path d="M4 9v6h4l5 4V5L8 9H4Z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/><path d="M19 6a8.5 8.5 0 0 1 0 12"/>',
                storage: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7"/>',
                files: '<path d="M3 7h6l2 2h10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/><path d="M3 11h18"/>',
                users: '<path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="9.5" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.85"/><path d="M16 3.15a4 4 0 0 1 0 7.7"/>',
                power: '<path d="M12 2v10"/><path d="M18.4 6.6a9 9 0 1 1-12.8 0"/>',
                settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.51a2 2 0 0 1 1-1.72l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z"/><circle cx="12" cy="12" r="3"/>',
                arrowRight: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
                refresh: '<path d="M21 12a9 9 0 0 1-15.5 6.2"/><path d="M3 12A9 9 0 0 1 18.5 5.8"/><path d="M18.5 2.8v3h-3"/>',
                external: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/>',
                sleep: '<path d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5 7 7 0 0 0 20.5 14.5Z"/>',
                shutdown: '<path d="M12 2v10"/><path d="M18.4 6.6a9 9 0 1 1-12.8 0"/>',
                close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
                desktop: '<rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>'
            };
            return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[id] || icons.arrowRight}</svg>`;
        }

        function sidebar() {
            const hasDoorpiUpdate = !!(doorpiStatus?.doorpiUpdateAvailable || doorpiStatus?.updaterUpdateAvailable);
            const hasWindowsUpdate = !!windowsStatus?.rebootRequired || ((windowsStatus?.updates || []).length > 0);
            const updateDot = hasDoorpiUpdate || hasWindowsUpdate ? '<span class="dq-dot"></span>' : '';
            const items = [
                ['updates', t('updatesTitle'), updateDot],
                ['storage', t('quickStorageLabel'), ''],
                ['screenshots', t('screenshotGalleryTitle'), ''],
                ['sound', t('soundTitle'), ''],
                ['connectivity', t('navSetConnectivity'), ''],
                ['files', t('fileExplorerTitle'), ''],
                ['settings', t('navSettings'), '']
            ];
            return `
                <aside class="dq-sidebar">
                    <header class="dq-brand"><h2 class="dq-title">${t('quickPanel')}</h2></header>
                    <div class="dq-menu">
                        ${items.map(([id, label, badge]) => `
                            <button class="dq-menu-btn ${section === id ? 'active' : ''}" data-section="${id}" tabindex="0">
                                <span class="dq-menu-label">

                                    <span class="dq-menu-copy"><strong>${label}</strong></span>
                                </span>
                                ${badge}
                            </button>
                        `).join('')}
                    </div>
                    <div class="dq-menu dq-sidebar-bottom">
                        <button class="dq-menu-btn ${section === 'power' ? 'active' : ''}" data-section="power" tabindex="0">
                            <span class="dq-menu-label">
                                <span class="dq-menu-ico">${iconSvg('power')}</span>
                                <span>${t('quickPower', 'Energia')}</span>
                            </span>
                        </button>
                    </div>
                </aside>
            `;
        }

        function powerContent() {
            return `
                <section class="dq-content">
                    <h1 class="dq-heading">${t('quickPower', 'Energia')}</h1>
                    <div class="dq-power-list">
                        <button class="dq-action" data-action="open-users" tabindex="0">
                            <span class="dq-action-ico">${iconSvg('users')}</span>
                            <span class="dq-action-label">${t('navChangeUser', 'Trocar Usuário')}</span>
                        </button>
                        <button class="dq-action" data-action="enter-desktop" tabindex="0">
                            <span class="dq-action-ico">${iconSvg('desktop')}</span>
                            <span class="dq-action-label">${t('sysActionDesktopTitle', 'Acessar Área de Trabalho')}</span>
                        </button>
                        <button class="dq-action" data-action="exit" tabindex="0">
                            <span class="dq-action-ico">${iconSvg('close')}</span>
                            <span class="dq-action-label">${t('quickExitDoorpi', 'Sair do Doorpi')}</span>
                        </button>
                        <button class="dq-action" data-action="suspend" tabindex="0">
                            <span class="dq-action-ico">${iconSvg('sleep')}</span>
                            <span class="dq-action-label">${t('powerSuspend', 'Suspender Sistema')}</span>
                        </button>
                        <button class="dq-action" data-action="restart" tabindex="0">
                            <span class="dq-action-ico">${iconSvg('refresh')}</span>
                            <span class="dq-action-label">${t('powerRestart', 'Reiniciar Sistema')}</span>
                        </button>
                        <button class="dq-action danger" data-action="shutdown" tabindex="0">
                            <span class="dq-action-ico">${iconSvg('shutdown')}</span>
                            <span class="dq-action-label">${t('powerShutdown', 'Desligar Sistema')}</span>
                        </button>
                    </div>
                </section>
            `;
        }

        function bluetoothContent() {
            return `
                <section class="dq-content">
                    <h1 class="dq-heading">Bluetooth</h1>
                    ${window.DoorpiBluetoothUI?.render?.('quick') || ''}
                </section>
            `;
        }

        function wifiContent() {
            return `
                <section class="dq-content">
                    <div class="dq-kicker">${t('connectivityQuickKicker')}</div>
                    <h1 class="dq-heading">Wi-Fi</h1>
                    <p class="dq-sub">${t('wifiQuickDesc')}</p>
                    ${window.DoorpiWifiUI?.render?.('quick') || ''}
                </section>
            `;
        }

        function soundContent() {
            return `
                <section class="dq-content">
                    <div class="dq-kicker">${t('quickPanel')}</div>
                    <h1 class="dq-heading">${t('soundTitle')}</h1>
                    ${window.DoorpiSoundUI?.render?.('quick') || ''}
                </section>
            `;
        }

        function connectivityHub() {
            return `
                <section class="dq-content">
                    <div class="dq-kicker">${t('quickPanel')}</div>
                    <h1 class="dq-heading">${t('navSetConnectivity')}</h1>
                    <p class="dq-sub">${t('quickConnectivityDesc')}</p>
                    <div class="dq-grid connectivity-grid">
                        <button class="dq-card" data-connectivity-view="bluetooth" tabindex="0"><div><h3>Bluetooth</h3><p>${t('bluetoothSettingsDesc')}</p></div></button>
                    </div>
                </section>`;
        }

