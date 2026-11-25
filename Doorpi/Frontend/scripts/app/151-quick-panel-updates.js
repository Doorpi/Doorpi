        function updatesHub() {
            return `
                <section class="dq-content dq-update-index">
                    <h1 class="dq-heading">${t('updatesTitle')}</h1>
                    <div class="dq-update-directory">
                        <button class="dq-card dq-update-entry" data-update-view="doorpi" tabindex="0">
                            <div><h3>Doorpi</h3><p>${esc(doorpiStatus?.localDoorpiVersion || t('quickDoorpiDesc'))}</p></div>
                            ${statusPill('doorpi', doorpiStatus)}
                        </button>
                        <button class="dq-card dq-update-entry" data-update-view="windows" tabindex="0">
                            <div><h3>Windows</h3><p>${windowsStatus?.lastCheckedAt ? esc(t('windowsUpdateLastCheck', dateText(windowsStatus.lastCheckedAt))) : esc(t('quickWindowsDesc'))}</p></div>
                            ${statusPill('windows', windowsStatus)}
                        </button>
                        <button class="dq-card dq-update-entry" data-update-view="gpu" tabindex="0">
                            <div><h3>${t('videoCardTitle')}</h3><p>${esc((gpuStatus?.adapters || []).map(adapter => readGpuProp(adapter, 'name')).filter(Boolean).join(' · ') || t('quickGpuDesc'))}</p></div>
                            ${statusPill('gpu', gpuStatus)}
                        </button>
                    </div>
                </section>
            `;
        }

        function updateDetailHeading(label) {
            return `<header class="dq-update-heading"><button class="dq-update-back" data-update-view="hub" tabindex="0">‹ ${t('updatesTitle')}</button>
                <h1 class="dq-heading">${esc(label)}</h1></header>`;
        }

        function doorpiReleaseNotes(status) {
            const entries = Array.isArray(status?.changelog) ? status.changelog : [];
            const markup = entries
                .filter(entry => entry && (entry.title || entry.version || (entry.items || []).length))
                .map(entry => {
                    const items = Array.isArray(entry.items) ? entry.items : [];
                    return `<article class="dq-release-entry">
                        <div class="dq-release-title"><span>${esc(entry.title || 'Doorpi')}</span>${entry.version ? `<span class="dq-release-version">${esc(entry.version)}</span>` : ''}</div>
                        ${items.length ? `<ul>${items.map(item => `<li>${esc(item)}</li>`).join('')}</ul>` : ''}
                    </article>`;
                }).join('');
            return `<div class="dq-release-notes" role="region" aria-label="${esc(t('sysUpdateReleaseNotes'))}" ${markup ? 'tabindex="0"' : ''}>
                <div class="dq-release-head">${t('sysUpdateReleaseNotes')}</div>
                ${markup || `<div class="dq-release-entry"><span>${t('quickNoReleaseNotes')}</span></div>`}
            </div>`;
        }

        function doorpiDetail() {
            const s = doorpiStatus || {};
            const hasUpdate = !!(s.doorpiUpdateAvailable || s.updaterUpdateAvailable);
            const active = s.status === 'checking' || s.status === 'downloading' || s.status === 'installing';
            return `
                <section class="dq-content dq-updates-page dq-doorpi-updates">
                    ${updateDetailHeading('Doorpi')}

                    <p class="dq-sub">${esc(s.message || t('sysUpdateIdle'))}</p>
                    <div class="dq-panel">
                        <div class="dq-meta">
                            <span>Doorpi ${esc(s.localDoorpiVersion || '--')}${s.doorpiUpdateAvailable && s.remoteDoorpiVersion ? ' → ' + esc(s.remoteDoorpiVersion) : ''}</span>
                            ${s.updaterUpdateAvailable ? '<span>Updater '+esc(s.localUpdaterVersion || '—')+' → '+esc(s.remoteUpdaterVersion || '—')+'</span>' : ''}
                            <span>${t('windowsUpdateLastCheck', dateText(s.lastCheckedAt))}</span>
                        </div>
                    </div>
                    <div class="dq-actions">
                        <button class="dq-action" data-action="check-doorpi" tabindex="0" ${active ? 'data-busy="true"' : ''}><span class="dq-action-label">${active ? t({ checking:'quickChecking', downloading:'windowsUpdateDownloading', installing:'windowsUpdateInstalling' }[s.status]) : t('checkDoorpi')}</span><span class="dq-action-ico">${iconSvg('refresh', active ? 'dq-spin' : '')}</span></button>
                        <button class="dq-action primary" data-action="install-doorpi" tabindex="0" ${hasUpdate && !active ? '' : 'hidden disabled'}><span class="dq-action-label">${t('updateDoorpi')}</span><span class="dq-action-ico">${iconSvg('arrowRight')}</span></button>
                    </div>
                    ${doorpiReleaseNotes(s)}
                </section>
            `;
        }

        function windowsDetail() {
            const s = windowsStatus || {};
            const updates = Array.isArray(s.updates) ? s.updates : [];
            const packageProgress = Array.isArray(s.packageProgress) ? s.packageProgress : [];
            const active = s.status === 'checking' || s.status === 'downloading' || s.status === 'installing';
            return `
                <section class="dq-content dq-updates-page">
                    ${updateDetailHeading('Windows')}

                    <p class="dq-sub">${esc(s.message || t('windowsUpdateIdle'))}</p>
                    <div class="dq-panel">
                        <div class="dq-meta">
                            <span>${t('windowsUpdatePackages', packageProgress.length || updates.length)}</span>
                            ${active ? `<span>${t('windowsUpdateOverall', Math.max(0, Math.min(100, Number(s.overallPercent) || 0)))}</span>` : ''}
                            <span>${t('windowsUpdateLastCheck', dateText(s.lastCheckedAt))}</span>
                        </div>

                    </div>
                    <div class="dq-windows-guidance" ${updates.length && !s.rebootRequired ? '' : 'hidden'}>
                        <p><strong>${esc(t('windowsUpdateAdminNoticeTitle'))}</strong> ${esc(t('windowsUpdateAdminNoticeText'))}</p>
                    </div>
                    <div class="dq-actions windows-update-actions">
                        <button class="dq-action verify" data-action="check-windows" tabindex="0" ${active ? 'data-busy="true"' : ''}><span class="dq-action-label">${esc(windowsActionLabel(s.status))}</span><span class="dq-action-ico">${iconSvg('refresh', active ? 'dq-spin' : '')}</span></button>
                        <button class="dq-action manual" data-action="open-windows-update" tabindex="0"><span class="dq-action-label">${t('quickOpenWindowsUpdate')}</span><span class="dq-action-ico">${iconSvg('external')}</span></button>
                        <button class="dq-action primary install" data-action="install-windows" tabindex="0" ${(updates.length && !s.rebootRequired && !active) ? '' : 'hidden disabled'}><span class="dq-action-label">${t('windowsUpdateInstall')}</span><span class="dq-action-ico">${iconSvg('arrowRight')}</span></button>
                        <button class="dq-action primary restart" data-action="restart" tabindex="0" ${s.rebootRequired ? '' : 'disabled'}><span class="dq-action-label">${t('restartNow')}</span><span class="dq-action-ico">${iconSvg('shutdown')}</span></button>
                    </div>
                    <div class="dq-list">${windowsUpdateRows(s, updates)}</div>
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
                <section class="dq-content dq-updates-page">
                    ${updateDetailHeading(t('videoCardTitle'))}

                    <p class="dq-sub">${esc(s.message || t('quickGpuIdle'))}</p>
                    <div class="dq-panel">
                        <div class="dq-meta">
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
                    <h2 class="dq-update-section-title">${t('updateDriverTools')}</h2>
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
                    <div class="dq-gpu-guidance">
                        <p><strong>${esc(t('gpuUpdaterAdminNoticeTitle'))}</strong> ${esc(t('gpuUpdaterAdminNoticeText'))}</p>
                        <p><strong>${esc(t('gpuUpdaterSessionNoticeTitle'))}</strong> ${esc(t('gpuUpdaterSessionNoticeText'))}</p>
                    </div>
                </section>
            `;
        }
