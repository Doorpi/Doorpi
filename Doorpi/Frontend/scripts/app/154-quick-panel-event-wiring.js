        function hasContentTargetToLeft(active) {
            const contentEl = active?.closest?.('#doorpiQuickPanel .dq-content');
            if (!contentEl) return false;
            const ar = active.getBoundingClientRect();
            const activeCenterY = ar.top + ar.height / 2;
            return Array.from(contentEl.querySelectorAll('button, input, select, [tabindex="0"]'))
                .filter(el => el !== active && !el.disabled && el.offsetWidth > 0 && el.offsetHeight > 0)
                .some(el => {
                    const r = el.getBoundingClientRect();
                    const centerX = r.left + r.width / 2;
                    const centerY = r.top + r.height / 2;
                    const verticalOverlap = Math.abs(centerY - activeCenterY) <= Math.max(ar.height, r.height) * 0.9;
                    return centerX < ar.left && verticalOverlap;
                });
        }

        function getQuickPanelContentItems() {
            const contentEl = document.querySelector('#doorpiQuickPanel .dq-content');
            if (!contentEl) return [];
            return Array.from(contentEl.querySelectorAll('button, input, select, [tabindex="0"]'))
                .filter(el => !el.disabled && el.offsetWidth > 0 && el.offsetHeight > 0);
        }

        function findContentTargetToRight(active, items) {
            if (!active || !items.length) return null;
            const activeRect = active.getBoundingClientRect();
            const activeCenterX = activeRect.left + activeRect.width / 2;
            const activeCenterY = activeRect.top + activeRect.height / 2;
            let best = null;
            let bestScore = Number.POSITIVE_INFINITY;

            items.forEach(item => {
                if (item === active) return;
                const rect = item.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;
                if (centerX <= activeCenterX) return;
                const verticalOverlap = Math.min(activeRect.bottom, rect.bottom) - Math.max(activeRect.top, rect.top);
                if (verticalOverlap <= -10) return;
                const score = (centerX - activeCenterX) + Math.abs(centerY - activeCenterY) * 0.25;
                if (score < bestScore) {
                    best = item;
                    bestScore = score;
                }
            });

            return best;
        }

        function wire(overlay) {
            wireBluetooth(overlay.querySelector('.dq-content'));
            wireWifi(overlay.querySelector('.dq-content'));
            wireSound(overlay.querySelector('.dq-content'));
            wireStorageCategoryButtons(overlay);
            overlay.onfocusin = event => {
                const target = event.target;
                if (!(target instanceof HTMLElement) || !target.closest('.dq-content')) return;
                requestAnimationFrame(() => {
                    const programList = target.closest('.dq-storage-vertical-list');
                    if (programList) {
                        const itemRect = target.getBoundingClientRect();
                        const listRect = programList.getBoundingClientRect();
                        const maxScroll = Math.max(0, programList.scrollHeight - programList.clientHeight);
                        const top = Math.max(0, Math.min(maxScroll,
                            programList.scrollTop + itemRect.top - listRect.top
                            - (programList.clientHeight - itemRect.height) / 2));
                        programList.scrollTop = top;
                        return;
                    }
                    target.scrollIntoView?.({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
                });
            };
            overlay.querySelectorAll('[data-section]').forEach(btn => {
                btn.addEventListener('click', () => {
                    enterSection(btn.dataset.section || 'updates');
                });
            });
            overlay.querySelectorAll('[data-storage-view]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const previousView = storageView;
                    storageView = btn.dataset.storageView || 'overview';
                    pendingUninstallId = '';
                    if (storageView === 'programs') postToHost?.({ action: 'requestStoragePrograms' });
                    const focusSelector = storageView === 'programs'
                        ? `[data-storage-program="${CSS.escape(selectedStorageProgramId || '')}"]`
                        : previousView === 'category'
                            ? `[data-storage-open-category="${CSS.escape(selectedStorageCategoryKey || '')}"]`
                            : '[data-storage-open-programs]';
                    render(focusSelector);
                });
            });
            overlay.querySelectorAll('[data-storage-open-programs]').forEach(btn => {
                btn.addEventListener('click', () => {
                    storageView = 'programs';
                    pendingUninstallId = '';
                    postToHost?.({ action: 'requestStoragePrograms' });
                    render('.dq-program-main');
                });
            });
            overlay.querySelectorAll('[data-storage-open-category]').forEach(btn => {
                btn.addEventListener('click', () => {
                    selectedStorageCategoryKey = btn.dataset.storageOpenCategory || '';
                    storageView = 'category';
                    render('[data-storage-detail-scroll]');
                });
            });
            overlay.querySelectorAll('[data-storage-root]').forEach(btn => {
                btn.addEventListener('click', () => {
                    selectedStorageRoot = btn.dataset.storageRoot || '';
                    selectedStorageProgramId = '';
                    overlay.querySelectorAll('[data-storage-root]').forEach(item => item.classList.toggle('active', item === btn));
                    if (storageView === 'overview') patchStorageOverview();
                    else if (storageView === 'programs') patchStorageProgramsList();
                    else if (storageView === 'category') patchStorageCategoryDetail();
                    btn.focus();
                });
            });
            if (overlay._doorpiStorageActionHandler)
                overlay.removeEventListener('click', overlay._doorpiStorageActionHandler);
            overlay._doorpiStorageActionHandler = event => {
                const programButton = event.target.closest?.('[data-storage-program]');
                if (programButton) {
                    storageView = 'programs';
                    toggleStorageProgramExpansion(overlay, programButton.dataset.storageProgram || '', true);
                    return;
                }
                const cancel = event.target.closest?.('[data-cancel-storage-program]');
                if (cancel) {
                    const id = cancel.dataset.cancelStorageProgram || selectedStorageProgramId;
                    storageView = 'programs';
                    toggleStorageProgramExpansion(overlay, id, false);
                    return;
                }
                const confirm = event.target.closest?.('[data-confirm-uninstall]');
                if (!confirm || confirm.disabled) return;
                const id = confirm.dataset.confirmUninstall || selectedStorageProgramId;
                if (!id) return;
                selectedStorageProgramId = id;
                if (storageUninstallerIsActive(id)) {
                    const list = overlay.querySelector('.dq-program-list');
                    const scrollTop = list?.scrollTop || 0;
                    confirm.focus({ preventScroll:true });
                    if (list) list.scrollTop = scrollTop;
                    postToHost?.({ action: 'returnToStorageUninstaller', programId: id });
                    return;
                }
                pendingUninstallId = '';
                uninstallStatus = { status: 'preparing', message: 'Solicitando a remoção ao Windows…', programId: id };
                const status = overlay.querySelector('.dq-storage-program-status');
                if (status) { status.hidden = false; status.textContent = uninstallStatus.message; }
                confirm.textContent = 'Solicitando…';
                confirm.disabled = true;
                postToHost?.({ action: 'uninstallStorageProgram', programId: id });
            };
            overlay.addEventListener('click', overlay._doorpiStorageActionHandler);
            overlay.querySelectorAll('[data-update-view]').forEach(btn => {
                btn.addEventListener('click', () => {
                    section = 'updates';
                    depth = 'content';
                    const nextView = btn.dataset.updateView || 'hub';
                    if (updateView === nextView) {
                        btn.focus();
                        return;
                    }
                    updateView = nextView;
                    render(`[data-update-view="${updateView}"]`);
                });
            });
            overlay.querySelectorAll('[data-connectivity-view]').forEach(btn => {
                btn.addEventListener('click', () => {
                    connectivityView = btn.dataset.connectivityView || 'hub';
                    depth = 'content';
                    if (connectivityView === 'bluetooth') postToHost?.({ action: 'requestBluetoothStatus' });
                    if (connectivityView === 'wifi') postToHost?.({ action: 'requestWifiStatus' });
                    render(contentFocusFor('connectivity'));
                });
            });
            overlay.querySelectorAll('[data-action]').forEach(btn => {
                btn.addEventListener('click', (event) => {
                    event.stopPropagation();
                    const action = btn.dataset.action;
                    if (action === 'check-doorpi') {
                        if (btn.dataset.busy === 'true') return;
                        const message = t('quickCheckingDoorpi');
                        doorpiStatus = { ...(doorpiStatus || {}), status: 'checking', message };
                        setBusyAction(btn, message);
                        postToHost?.({ action: 'checkSystemUpdates' });
                    }
                    else if (action === 'install-doorpi') postToHost?.({ action: 'startSystemUpdate' });
                    else if (action === 'check-windows') {
                        if (btn.dataset.busy === 'true') return;
                        const message = t('quickCheckingWindows');
                        windowsStatus = { ...(windowsStatus || {}), status: 'checking', message };
                        setBusyAction(btn, message);
                        postToHost?.({ action: 'checkWindowsUpdates' });
                    }
                    else if (action === 'install-windows') postToHost?.({ action: 'startWindowsUpdateInstall' });
                    else if (action === 'open-windows-update') { close(); postToHost?.({ action: 'openWindowsUpdateSettings' }); }
                    else if (action === 'open-gpu-updater') { postToHost?.({ action: 'openGpuUpdater', updaterId: btn.dataset.updaterId || '' }); }
                    else if (action === 'add-gpu-updater') postToHost?.({ action: 'addGpuUpdater' });
                    else if (action === 'remove-gpu-updater') postToHost?.({ action: 'removeGpuUpdater', updaterId: btn.dataset.updaterId || '' });
                    else if (action === 'refresh-storage') postToHost?.({ action: 'requestStorageStatus', forceRefresh: true });
                    else if (action === 'refresh-programs') postToHost?.({ action: 'requestStoragePrograms' });
                    else if (action === 'restart') postToHost?.({ action: 'restartSystem' });
                    else if (action === 'suspend') postToHost?.({ action: 'suspendSystem' });
                    else if (action === 'shutdown') postToHost?.({ action: 'shutdownSystem' });
                    else if (action === 'exit') postToHost?.({ action: 'exitApp' });
                    else if (action === 'open-users') {
                        window._doorpiUserPickerReturnToQuickPanel = true;
                        close();
                        postToHost?.({ action: 'requestUsers' });
                    }
                    else if (action === 'enter-desktop') {
                        close();
                        if (typeof window.showDesktopWarning === 'function') {
                            window.showDesktopWarning('desktop', () => postToHost?.({ action: 'enterDesktopMode' }));
                        } else {
                            postToHost?.({ action: 'enterDesktopMode' });
                        }
                    }
                    else if (action === 'open-settings') openNavSettings();
                });
            });
        }

