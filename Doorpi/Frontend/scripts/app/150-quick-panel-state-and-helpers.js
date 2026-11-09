    window.DoorpiQuickPanel = (() => {
        let doorpiStatus = null;
        let windowsStatus = null;
        let gpuStatus = null;
        let bluetoothStatus = null;
        let wifiStatus = null;
        let soundStatus = null;
        let storageStatus = null;
        let storagePrograms = null;
        let storageView = 'overview';
        let selectedStorageRoot = '';
        let selectedStorageCategoryKey = 'applications';
        let selectedStorageProgramId = '';
        let pendingUninstallId = '';
        let uninstallStatus = null;
        const expandedStorageCategories = new Set(['games', 'applications', 'doorpi']);
        let section = null;
        let updateView = 'doorpi';
        let connectivityView = 'hub';
        let depth = 'menu';
        let bluetoothPatchTimer = 0;

        function ensureStyles() {
            if (document.getElementById('doorpiQuickPanelStyles')) return;
            const s = document.createElement('style');
            s.id = 'doorpiQuickPanelStyles';
            s.textContent = __doorpiCss("injected-styles/app/doorpi-quick-panel-styles.css");
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
            if (kind === 'gpu') {
                const adapters = Array.isArray(status?.adapters) ? status.adapters : [];
                const updaters = Array.isArray(status?.updaters) ? status.updaters : [];
                if (status?.status === 'error') return `<span class="dq-pill err">${t('quickError')}</span>`;
                if (!adapters.length) return `<span class="dq-pill warn">${t('quickNoGpu')}</span>`;
                if (!updaters.length) return `<span class="dq-pill warn">${t('quickNoApp')}</span>`;
                return `<span class="dq-pill">${t('quickDetected')}</span>`;
            }
            if (kind === 'doorpi') {
                const available = !!(status?.doorpiUpdateAvailable || status?.updaterUpdateAvailable);
                if (available) return `<span class="dq-pill warn">${t('quickAvailable')}</span>`;
                if (status?.status === 'error') return `<span class="dq-pill err">${t('quickError')}</span>`;
                if (status?.status === 'checking') return `<span class="dq-pill">${t('quickChecking')}</span>`;
                return `<span class="dq-pill">${t('quickUpdated')}</span>`;
            }
            const updates = Array.isArray(status?.updates) ? status.updates : [];
            if (status?.rebootRequired) return `<span class="dq-pill warn">${t('quickRestart')}</span>`;
            if (status?.status === 'error') return `<span class="dq-pill err">${t('quickError')}</span>`;
            if (status?.status === 'checking' || status?.status === 'downloading' || status?.status === 'installing') return `<span class="dq-pill">${t('quickProcessing')}</span>`;
            if (updates.length) return `<span class="dq-pill warn">${t('quickAvailable')}</span>`;
            return `<span class="dq-pill">${t('quickUpdated')}</span>`;
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
                ['storage', 'Armazenamento', ''],
                ['sound', t('soundTitle'), ''],
                ['connectivity', t('navSetConnectivity'), ''],
                ['files', t('fileExplorerTitle'), ''],
                ['settings', t('navSettings'), '']
            ];
            return `
                <aside class="dq-sidebar">
                    <div class="dq-brand" aria-hidden="true"></div>
                    <div class="dq-menu">
                        ${items.map(([id, label, badge]) => `
                            <button class="dq-menu-btn ${section === id ? 'active' : ''}" data-section="${id}" tabindex="0">
                                <span class="dq-menu-label">
                                    <span class="dq-menu-ico">${iconSvg(id)}</span>
                                    <span>${label}</span>
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

        function updatesHub() {
            return `
                <section class="dq-content">
                    <div class="dq-kicker">${t('quickPanel')}</div>
                    <h1 class="dq-heading">${t('updatesTitle')}</h1>
                    <p class="dq-sub">${t('quickUpdatesDesc')}</p>
                    <div class="dq-update-directory">
                        <button class="dq-card dq-update-entry" data-update-view="doorpi" tabindex="0">
                            <div><h3>Doorpi</h3><p>${t('quickDoorpiDesc')}</p></div>
                            ${statusPill('doorpi', doorpiStatus)}
                        </button>
                        <button class="dq-card dq-update-entry" data-update-view="windows" tabindex="0">
                            <div><h3>Windows</h3><p>${t('quickWindowsDesc')}</p></div>
                            ${statusPill('windows', windowsStatus)}
                        </button>
                        <button class="dq-card dq-update-entry" data-update-view="gpu" tabindex="0">
                            <div><h3>${t('videoCardTitle')}</h3><p>${t('quickGpuDesc')}</p></div>
                            ${statusPill('gpu', gpuStatus)}
                        </button>
                    </div>
                </section>
            `;
        }

        function updateTabsMarkup(activeView) {
            const tabs = [
                ['doorpi', 'Doorpi', doorpiStatus],
                ['windows', 'Windows', windowsStatus],
                ['gpu', t('videoCardTitle'), gpuStatus]
            ];
            return `<div class="dq-tabs dq-update-tabs" role="tablist" aria-label="${t('updatesTitle')}">
                ${tabs.map(([id, label, status]) => `
                    <button class="dq-tab ${activeView === id ? 'active' : ''}" data-update-view="${id}" tabindex="0" role="tab" aria-selected="${activeView === id}">
                        <strong>${esc(label)}</strong>${statusPill(id, status)}
                    </button>`).join('')}
            </div>`;
        }

        function doorpiReleaseNotes(status) {
            const entries = Array.isArray(status?.changelog) ? status.changelog : [];
            const markup = entries
                .filter(entry => entry && (entry.title || entry.version || (entry.items || []).length))
                .slice(0, 2)
                .map(entry => {
                    const items = Array.isArray(entry.items) ? entry.items.slice(0, 6) : [];
                    return `<article class="dq-release-entry">
                        <div class="dq-release-title"><span>${esc(entry.title || 'Doorpi')}</span>${entry.version ? `<span class="dq-release-version">${esc(entry.version)}</span>` : ''}</div>
                        ${items.length ? `<ul>${items.map(item => `<li>${esc(item)}</li>`).join('')}</ul>` : ''}
                    </article>`;
                }).join('');
            return `<div class="dq-release-notes">
                <div class="dq-release-head">${t('sysUpdateReleaseNotes')}</div>
                ${markup || `<div class="dq-release-entry"><span>${t('quickNoReleaseNotes')}</span></div>`}
            </div>`;
        }

        function doorpiDetail() {
            const s = doorpiStatus || {};
            const hasUpdate = !!(s.doorpiUpdateAvailable || s.updaterUpdateAvailable);
            const active = s.status === 'checking' || s.status === 'downloading' || s.status === 'installing';
            return `
                <section class="dq-content">
                    <div class="dq-kicker">${t('updatesTitle')}</div>
                    <h1 class="dq-heading">Doorpi</h1>
                    <p class="dq-sub">${esc(s.message || t('sysUpdateIdle'))}</p>
                    ${updateTabsMarkup('doorpi')}
                    <div class="dq-panel">
                        ${statusPill('doorpi', s)}
                        <div class="dq-meta">
                            <span>Doorpi ${esc(s.localDoorpiVersion || '--')}${s.remoteDoorpiVersion ? ' -> ' + esc(s.remoteDoorpiVersion) : ''}</span>
                            <span>Updater ${esc(s.localUpdaterVersion || '--')}${s.remoteUpdaterVersion ? ' -> ' + esc(s.remoteUpdaterVersion) : ''}</span>
                            <span>${t('windowsUpdateLastCheck', dateText(s.lastCheckedAt))}</span>
                        </div>
                        ${doorpiReleaseNotes(s)}
                    </div>
                    <div class="dq-actions">
                        <button class="dq-action" data-action="check-doorpi" tabindex="0" ${active ? 'data-busy="true"' : ''}><span class="dq-action-label">${active ? t('quickChecking') : t('checkDoorpi')}</span><span class="dq-action-ico">${iconSvg('refresh', active ? 'dq-spin' : '')}</span></button>
                        <button class="dq-action primary" data-action="install-doorpi" tabindex="0" ${(hasUpdate && !active) ? '' : 'disabled'}><span class="dq-action-label">${t('updateDoorpi')}</span><span class="dq-action-ico">${iconSvg('arrowRight')}</span></button>
                    </div>
                </section>
            `;
        }

        function windowsDetail() {
            const s = windowsStatus || {};
            const updates = Array.isArray(s.updates) ? s.updates : [];
            const packageProgress = Array.isArray(s.packageProgress) ? s.packageProgress : [];
            const active = s.status === 'checking' || s.status === 'downloading' || s.status === 'installing';
            return `
                <section class="dq-content">
                    <div class="dq-kicker">${t('updatesTitle')}</div>
                    <h1 class="dq-heading">Windows</h1>
                    <p class="dq-sub">${esc(s.message || t('windowsUpdateIdle'))}</p>
                    ${updateTabsMarkup('windows')}
                    <div class="dq-panel">
                        ${statusPill('windows', s)}
                        <div class="dq-meta">
                            <span>${t('windowsUpdatePackages', packageProgress.length || updates.length)}</span>
                            ${active ? `<span>${t('windowsUpdateOverall', Math.max(0, Math.min(100, Number(s.overallPercent) || 0)))}</span>` : ''}
                            <span>${t('windowsUpdateLastCheck', dateText(s.lastCheckedAt))}</span>
                        </div>
                        <div class="dq-list">
                            ${windowsUpdateRows(s, updates)}
                        </div>
                    </div>
                    <div class="dq-windows-guidance">
                        <p><strong>${esc(t('windowsUpdateAdminNoticeTitle'))}</strong> ${esc(t('windowsUpdateAdminNoticeText'))}</p>
                    </div>
                    <div class="dq-actions windows-update-actions">
                        <button class="dq-action verify" data-action="check-windows" tabindex="0" ${active ? 'data-busy="true"' : ''}><span class="dq-action-label">${esc(windowsActionLabel(s.status))}</span><span class="dq-action-ico">${iconSvg('refresh', active ? 'dq-spin' : '')}</span></button>
                        <button class="dq-action manual" data-action="open-windows-update" tabindex="0"><span class="dq-action-label">${t('quickOpenWindowsUpdate')}</span><span class="dq-action-ico">${iconSvg('external')}</span></button>
                        <button class="dq-action primary install" data-action="install-windows" tabindex="0" ${(updates.length && !s.rebootRequired && !active) ? '' : 'disabled'}><span class="dq-action-label">${t('windowsUpdateInstall')}</span><span class="dq-action-ico">${iconSvg('arrowRight')}</span></button>
                        <button class="dq-action primary restart" data-action="restart" tabindex="0" ${s.rebootRequired ? '' : 'disabled'}><span class="dq-action-label">${t('restartNow')}</span><span class="dq-action-ico">${iconSvg('shutdown')}</span></button>
                    </div>
                </section>
            `;
        }

        function vendorName(vendor) {
            const v = String(vendor || '').toLowerCase();
            if (v === 'nvidia') return 'NVIDIA';
            if (v === 'amd') return 'AMD';
            if (v === 'intel') return 'Intel';
            return vendor || 'GPU';
        }

        function updaterInitials(app) {
            const base = vendorName(readGpuProp(app, 'vendor')) || readGpuProp(app, 'name') || 'APP';
            return String(base).replace(/[^a-z0-9]/gi, '').slice(0, 3).toUpperCase() || 'APP';
        }

        function readGpuProp(obj, key) {
            if (!obj) return '';
            const pascal = key.charAt(0).toUpperCase() + key.slice(1);
            return obj[key] ?? obj[pascal] ?? '';
        }

        function gpuDetail() {
            const s = gpuStatus || {};
            const adapters = Array.isArray(s.adapters) ? s.adapters : [];
            const updaters = Array.isArray(s.updaters) ? s.updaters : [];
            return `
                <section class="dq-content">
                    <div class="dq-kicker">${t('updatesTitle')}</div>
                    <h1 class="dq-heading">${t('videoCardTitle')}</h1>
                    <p class="dq-sub">${esc(s.message || t('quickGpuIdle'))}</p>
                    ${updateTabsMarkup('gpu')}
                    <div class="dq-panel">
                        ${statusPill('gpu', s)}
                        <div class="dq-meta">
                            <span>${t('quickGpuAdapters', adapters.length)}</span>
                            <span>${t('quickGpuApps', updaters.length)}</span>
                            <span>${t('quickLastReading', dateText(s.lastCheckedAt))}</span>
                        </div>
                        <div class="dq-list">
                            ${adapters.length ? adapters.map(adapter => `
                                <div class="dq-update-row">
                                    <span>${esc(readGpuProp(adapter, 'name') || vendorName(readGpuProp(adapter, 'vendor')))}</span>
                                    <span>${esc([vendorName(readGpuProp(adapter, 'vendor')), readGpuProp(adapter, 'driverVersion') || '--'].filter(Boolean).join(' - '))}</span>
                                </div>
                            `).join('') : `<div class="dq-update-row"><span>${t('quickNoVideoDriver')}</span></div>`}
                        </div>
                    </div>
                    <div class="dq-gpu-guidance">
                        <p><strong>${esc(t('gpuUpdaterAdminNoticeTitle'))}</strong> ${esc(t('gpuUpdaterAdminNoticeText'))}</p>
                        <p><strong>${esc(t('gpuUpdaterSessionNoticeTitle'))}</strong> ${esc(t('gpuUpdaterSessionNoticeText'))}</p>
                    </div>
                    <div class="dq-app-grid">
                        ${updaters.map(app => {
                            const id = readGpuProp(app, 'id');
                            const name = readGpuProp(app, 'name') || t('quickUpdater');
                            const vendor = readGpuProp(app, 'vendor');
                            const source = readGpuProp(app, 'source');
                            const imageUrl = readGpuProp(app, 'imageUrl');
                            const iconDataUrl = readGpuProp(app, 'iconDataUrl');
                            return `
                            <div class="dq-app-card" data-action="open-gpu-updater" data-updater-id="${esc(id)}" data-gpu-updater-card="true" tabindex="0" role="button">
                                <div class="dq-app-art">
                                    ${imageUrl ? `<div class="dq-app-cover" style="background-image:url('${esc(imageUrl)}')"></div>` : (iconDataUrl ? `<img src="${esc(iconDataUrl)}" alt="">` : `<div class="dq-app-fallback">${esc(updaterInitials(app))}</div>`)}
                                </div>
                                <div class="dq-app-copy">
                                    <div class="dq-app-name">${esc(name)}</div>
                                    <div class="dq-app-meta">${esc(vendorName(vendor))} · ${esc(source === 'manual' ? t('quickAddedManually') : t('quickDetectedAutomatically'))}</div>
                                </div>
                            </div>
                        `}).join('')}
                        <div class="dq-app-card dq-app-add" data-action="add-gpu-updater" tabindex="0" role="button">
                            <div class="dq-app-art"><div class="dq-app-fallback">+</div></div>
                            <div class="dq-app-copy">
                                <div class="dq-app-name">${t('quickAddApp')}</div>
                                <div class="dq-app-meta">${t('quickAddUpdaterDesc')}</div>
                            </div>
                        </div>
                    </div>
                </section>
            `;
        }

        function powerContent() {
            return `
                <section class="dq-content">
                    <div class="dq-kicker">${t('quickSystem')}</div>
                    <h1 class="dq-heading">${t('quickPower', 'Energia')}</h1>
                    <p class="dq-sub">${t('quickPowerExpandedDesc', 'Opções de energia, perfis e sistema.')}</p>
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
                    <div class="dq-kicker">${t('bluetoothQuickKicker')}</div>
                    <h1 class="dq-heading">Bluetooth</h1>
                    <p class="dq-sub">${t('bluetoothQuickDesc')}</p>
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
                    <p class="dq-sub">${t('soundQuickDesc')}</p>
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

