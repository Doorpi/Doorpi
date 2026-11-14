        function simpleContent(title, sub, actionLabel, action) {
            return `
                <section class="dq-content">
                    <div class="dq-kicker">${t('quickPanel')}</div>
                    <h1 class="dq-heading">${title}</h1>
                    <p class="dq-sub">${sub}</p>
                    <div class="dq-actions">
                        <button class="dq-action primary" data-action="${action}" tabindex="0"><span class="dq-action-label">${actionLabel}</span><span class="dq-action-ico">${iconSvg('arrowRight')}</span></button>
                    </div>
                </section>
            `;
        }

        function content() {
            if (!section) return '';
            if (section === 'updates') {
                if (updateView === 'doorpi') return doorpiDetail();
                if (updateView === 'windows') return windowsDetail();
                if (updateView === 'gpu') return gpuDetail();
                updateView = 'doorpi';
                return doorpiDetail();
            }
            if (section === 'users') return simpleContent(t('navChangeUser'), t('quickSwitchUserDesc'), t('navChangeUser'), 'open-users');
            if (section === 'storage') return storageContent();
            if (section === 'sound') return soundContent();
            if (section === 'connectivity') {
                if (connectivityView === 'bluetooth') return bluetoothContent();
                if (connectivityView === 'wifi') return wifiContent();
                return connectivityHub();
            }
            if (section === 'power') return powerContent();
            return simpleContent(t('navSettings'), t('quickSettingsDesc'), t('quickOpenSettings'), 'open-settings');
        }

        function contentFocusFor(sectionId) {
            if (!sectionId) return '.dq-menu-btn';
            if (sectionId === 'updates') {
                if (updateView === 'doorpi' || updateView === 'windows' || updateView === 'gpu') return `[data-update-view="${updateView}"]`;
                return '.dq-card';
            }
            if (sectionId === 'power') return '.dq-action';
            if (sectionId === 'storage') {
                if (storageView === 'programs') return '.dq-program-main';
                if (storageView === 'program-detail') return '[data-storage-view="programs"]';
                if (storageView === 'category') return '[data-storage-detail-scroll]';
                return '.dq-drive-tab.active';
            }
            if (sectionId === 'sound') return '.sound-focus';
            if (sectionId === 'connectivity') {
                if (connectivityView === 'bluetooth') return '.bluetooth-focus';
                if (connectivityView === 'wifi') return '.wifi-focus';
                return '.dq-card';
            }
            return `.dq-menu-btn[data-section="${sectionId}"]`;
        }

        function currentFocusSelector() {
            const el = document.activeElement;
            if (!el?.closest?.('#doorpiQuickPanel')) return null;
            if (el.dataset?.action) return `[data-action="${el.dataset.action}"]`;
            if (el.dataset?.updateView) return `[data-update-view="${el.dataset.updateView}"]`;
            if (el.dataset?.storageView) return `[data-storage-view="${el.dataset.storageView}"]`;
            if (el.dataset?.storageRoot) return `[data-storage-root="${CSS.escape(el.dataset.storageRoot)}"]`;
            if (el.dataset?.storageCategory) return `[data-storage-category="${CSS.escape(el.dataset.storageCategory)}"]`;
            if (el.dataset?.storageProgram) return `[data-storage-program="${CSS.escape(el.dataset.storageProgram)}"]`;
            if (el.dataset?.cancelStorageProgram) return `[data-cancel-storage-program="${CSS.escape(el.dataset.cancelStorageProgram)}"]`;
            if (el.dataset?.uninstallProgram) return `[data-uninstall-program="${CSS.escape(el.dataset.uninstallProgram)}"]`;
            if (el.dataset?.confirmUninstall) return `[data-confirm-uninstall="${CSS.escape(el.dataset.confirmUninstall)}"]`;
            if (el.dataset?.cancelUninstall) return `[data-cancel-uninstall="${CSS.escape(el.dataset.cancelUninstall)}"]`;
            if (el.dataset?.section) return `.dq-menu-btn[data-section="${el.dataset.section}"]`;
            if (el.dataset?.connectivityView) return `[data-connectivity-view="${el.dataset.connectivityView}"]`;
            if (el.dataset?.wifiNetworkId) return `[data-wifi-network-id="${CSS.escape(el.dataset.wifiNetworkId)}"]`;
            if (el.dataset?.wifiAction) return `[data-wifi-action="${el.dataset.wifiAction}"]`;
            if (el.dataset?.soundAction) return `[data-sound-action="${CSS.escape(el.dataset.soundAction)}"]`;
            if (el.dataset?.soundVolumeControl) return `[data-sound-volume-control="${CSS.escape(el.dataset.soundVolumeControl)}"]`;
            if (el.dataset?.soundDeviceOption) return `[data-sound-device-option="${CSS.escape(el.dataset.soundDeviceOption)}"]`;
            if (el.dataset?.soundItem) return `[data-sound-item="${CSS.escape(el.dataset.soundItem)}"]`;
            if (el.dataset?.soundSlider) return `[data-sound-slider="${CSS.escape(el.dataset.soundSlider)}"]`;
            if (el.dataset?.btMenuId) return `[data-bt-menu-id="${CSS.escape(el.dataset.btMenuId)}"]`;
            if (el.dataset?.deviceId) return `[data-device-id="${CSS.escape(el.dataset.deviceId)}"]`;
            if (el.dataset?.btAction) return `[data-bt-action="${el.dataset.btAction}"]`;
            if (el.classList.contains('dq-card')) return '.dq-card';
            if (el.classList.contains('dq-action')) return '.dq-action';
            if (el.classList.contains('dq-app-card')) return '.dq-app-card';
            return null;
        }

        function openNavSettings() {
            close();
            if (typeof window._navMenuOpenSettings === 'function') window._navMenuOpenSettings();
            else window.openNavMenu?.(2);
        }

        function requestStorageDataAfterPaint() {
            requestAnimationFrame(() => {
                postToHost?.({ action: 'requestStorageStatus', forceRefresh: false });
                postToHost?.({ action: 'requestStoragePrograms' });
            });
        }

        function enterSection(sectionId = section) {
            const sameSection = section === sectionId;
            if (section === 'connectivity' && sectionId !== 'connectivity' && bluetoothStatus?.discovering)
                postToHost?.({ action: 'stopBluetoothDiscovery' });
            if (section === 'sound' && sectionId !== 'sound') window.DoorpiSoundUI?.closeDrawer?.('quick');
            section = sectionId || 'updates';
            if (section === 'users') {
                window._doorpiUserPickerReturnToQuickPanel = true;
                close();
                postToHost?.({ action: 'requestUsers' });
                return;
            }
            if (section === 'files') {
                close();
                postToHost?.({ action: 'openDoorpiFileExplorer' });
                return;
            }
            if (section === 'settings') {
                openNavSettings();
                return;
            }
            if (section === 'connectivity' && !sameSection) connectivityView = 'hub';
            if (section === 'updates' && !sameSection) updateView = 'doorpi';
            if (section === 'sound') postToHost?.({ action: 'requestSoundStatus' });
            depth = 'content';
            if (sameSection && depth === 'content') {
                const target = document.getElementById('doorpiQuickPanel')?.querySelector(contentFocusFor(section));
                if (target) {
                    target.focus();
                    return;
                }
            }
            render(contentFocusFor(section));
            if (section === 'storage') requestStorageDataAfterPaint();
        }

        function render(focusSelector) {
            const overlay = ensure();
            overlay.classList.toggle('is-menu-only', !section);
            overlay.innerHTML = `${sidebar()}${content()}`;
            wire(overlay);
            const sidebarEl = overlay.querySelector('.dq-sidebar');
            if (sidebarEl && overlay.style.display !== 'none' && overlay.classList.contains('visible') && !overlay.classList.contains('has-opened')) {
                sidebarEl.addEventListener('animationend', () => overlay.classList.add('has-opened'), { once: true });
            }
            const target = (focusSelector ? overlay.querySelector(focusSelector) : null) || overlay.querySelector('.dq-menu-btn.active, button');
            requestAnimationFrame(() => {
                const executionLockOpen = document.getElementById('gameLaunchOverlay')
                    ?.classList.contains('execution-lock-visible');
                if (!window.isSessionConflictPopupOpen?.() && !executionLockOpen) target?.focus();
            });
        }

