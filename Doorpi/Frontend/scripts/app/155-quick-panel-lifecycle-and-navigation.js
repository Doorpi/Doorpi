        function open(initialSection = null) {
            if (!canOpen()) return;
            const requestedSection = ['updates', 'storage', 'sound', 'connectivity', 'power'].includes(initialSection)
                ? initialSection
                : null;
            section = requestedSection;
            updateView = 'doorpi';
            connectivityView = 'hub';
            depth = requestedSection ? 'content' : 'menu';
            const overlay = ensure();
            overlay.classList.remove('has-opened');
            overlay.classList.add('visible');
            overlay.style.display = 'flex';
            document.body.classList.remove('quick-menu-unavailable');
            document.body.classList.add('quick-panel-open');
            postToHost?.({ action: 'requestUpdateStatus' });
            postToHost?.({ action: 'requestWindowsUpdateStatus' });
            postToHost?.({ action: 'requestGpuUpdateStatus' });
            postToHost?.({ action: 'requestSoundStatus' });
            render(requestedSection ? contentFocusFor(requestedSection) : '.dq-menu-btn');
            if (requestedSection === 'storage') requestStorageDataAfterPaint();
        }

        function openMenu() {
            if (!canOpen()) return;
            section = null;
            updateView = 'doorpi';
            connectivityView = 'hub';
            depth = 'menu';
            const overlay = ensure();
            overlay.classList.add('visible', 'has-opened');
            overlay.style.display = 'flex';
            document.body.classList.remove('quick-menu-unavailable');
            document.body.classList.add('quick-panel-open');
            postToHost?.({ action: 'requestUpdateStatus' });
            postToHost?.({ action: 'requestWindowsUpdateStatus' });
            postToHost?.({ action: 'requestGpuUpdateStatus' });
            postToHost?.({ action: 'requestSoundStatus' });
            render('.dq-menu-btn');
        }

        function toggle() {
            if (api.isOpen()) close();
            else open();
        }

        function close() {
            if (section === 'connectivity' && bluetoothStatus?.discovering)
                postToHost?.({ action: 'stopBluetoothDiscovery' });
            if (section === 'sound') window.DoorpiSoundUI?.closeDrawer?.('quick');
            if (document.querySelector('.context-menu.visible')) window._ctxMenuClose?.();
            const overlay = document.getElementById('doorpiQuickPanel');
            if (overlay) {
                overlay.classList.remove('visible');
                overlay.style.display = 'none';
            }
            document.body.classList.remove('quick-panel-open');
            window.updateDoorpiQuickMenuAvailability?.();
            window.focusFeaturedCard?.();
        }

        function back() {
            if (section === 'storage' && storageView === 'program-detail') {
                storageView = 'programs';
                render(`[data-storage-program="${CSS.escape(selectedStorageProgramId || '')}"]`);
                return true;
            }
            if (section === 'storage' && storageView === 'category') {
                storageView = 'overview';
                render(`[data-storage-open-category="${CSS.escape(selectedStorageCategoryKey || '')}"]`);
                return true;
            }
            if (section === 'storage' && storageView === 'programs') {
                storageView = 'overview';
                pendingUninstallId = '';
                render('[data-storage-open-programs]');
                return true;
            }
            if (section === 'storage' && pendingUninstallId) {
                const id = pendingUninstallId;
                pendingUninstallId = '';
                render(`[data-uninstall-program="${CSS.escape(id)}"]`);
                return true;
            }
            if (section === 'sound') {
                const soundFocusSelector = window.DoorpiSoundUI?.back?.('quick');
                if (soundFocusSelector) {
                    if (typeof soundFocusSelector === 'string') render(soundFocusSelector);
                    return true;
                }
            }
            if (section === 'connectivity' && connectivityView === 'bluetooth' && bluetoothStatus?.pairingPrompt) {
                postToHost?.({ action: 'respondBluetoothPairing', accepted: false, pin: '' });
                return true;
            }
            if (section === 'connectivity' && connectivityView === 'bluetooth' && window.DoorpiBluetoothUI?.back?.('quick')) {
                render('.bt-device-card');
                return true;
            }
            if (section === 'connectivity' && connectivityView === 'wifi' && window.DoorpiWifiUI?.back?.('quick')) {
                render('.wifi-network-card');
                return true;
            }
            if (section === 'connectivity' && connectivityView !== 'hub') {
                connectivityView = 'hub';
                depth = 'content';
                render('.dq-card');
                return true;
            }
            if (depth === 'content') {
                depth = 'menu';
                const focusSelector = section ? `.dq-menu-btn[data-section="${section}"]` : '.dq-menu-btn';
                if (section === 'sound') window.DoorpiSoundUI?.closeDrawer?.('quick');
                section = null;
                updateView = 'doorpi';
                render(focusSelector);
                return true;
            }
            close();
            return true;
        }

        function handleDirection(direction) {
            if (!api.isOpen()) return false;
            if (section === 'sound' && window.DoorpiSoundUI?.handleDirection?.('quick', direction)) return true;
            const active = document.activeElement;
            if (section === 'storage' && direction === 'UP' && active?.matches?.('[data-confirm-uninstall]')) {
                document.querySelector(`#doorpiQuickPanel [data-storage-program="${CSS.escape(selectedStorageProgramId || '')}"]`)?.focus();
                return true;
            }
            if (section === 'storage' && storageView === 'category') {
                const panel = document.getElementById('doorpiQuickPanel');
                const list = panel?.querySelector('[data-storage-detail-scroll]');
                if (active === list && (direction === 'UP' || direction === 'DOWN')) {
                    if (direction === 'UP' && list.scrollTop <= 1) {
                        panel.querySelector('.dq-storage-back')?.focus();
                    } else {
                        const amount = Math.max(96, Math.round(list.clientHeight * .24));
                        list.scrollTop += direction === 'DOWN' ? amount : -amount;
                    }
                    return true;
                }
                if ((active?.classList?.contains('dq-storage-back') || active?.classList?.contains('dq-drive-tab')) && direction === 'DOWN') {
                    list?.focus();
                    return true;
                }
            }
            if (section === 'storage' && active?.closest?.('.dq-storage-vertical-list')) {
                const list = active.closest('.dq-storage-vertical-list');
                const items = Array.from(list.querySelectorAll('button:not([disabled])'));
                const index = items.indexOf(active);
                if (index >= 0 && (direction === 'UP' || direction === 'DOWN')) {
                    const target = items[index + (direction === 'DOWN' ? 1 : -1)];
                    if (target) target.focus();
                    else if (direction === 'UP') list.closest('.dq-content')?.querySelector('.dq-storage-back')?.focus();
                    return true;
                }
            }
            if (section === 'storage' && storageView === 'overview') {
                const panel = document.getElementById('doorpiQuickPanel');
                const refresh = panel?.querySelector('[data-action="refresh-storage"]');
                const drives = Array.from(panel?.querySelectorAll('.dq-drive-tab') || []);
                const activeDrive = panel?.querySelector('.dq-drive-tab.active');
                const firstCategory = panel?.querySelector('.dq-storage-console-row');
                const focusDrive = target => {
                    if (!target) return;
                    target.focus();
                    requestAnimationFrame(() => target.scrollIntoView?.({ block:'nearest', inline:'nearest' }));
                };
                const driveIndex = drives.indexOf(active);
                if (driveIndex >= 0 && direction === 'LEFT') {
                    focusDrive(drives[driveIndex - 1]);
                    return true;
                }
                if (driveIndex >= 0 && direction === 'RIGHT') {
                    const nextDrive = drives[driveIndex + 1];
                    if (nextDrive) focusDrive(nextDrive);
                    else refresh?.focus();
                    return true;
                }
                if (driveIndex >= 0 && direction === 'DOWN') {
                    firstCategory?.focus();
                    return true;
                }
                if (active === refresh && direction === 'UP') {
                    activeDrive?.focus();
                    return true;
                }
                if (active === refresh && direction === 'LEFT') {
                    (drives[drives.length - 1] || activeDrive)?.focus();
                    return true;
                }
                if (active === refresh && direction === 'DOWN') {
                    firstCategory?.focus();
                    return true;
                }
            }
            if (section === 'storage' && active?.closest?.('.dq-storage-console-list')) {
                const list = active.closest('.dq-storage-console-list');
                const items = Array.from(list.querySelectorAll('.dq-storage-console-row'));
                const index = items.indexOf(active);
                if (index >= 0 && direction === 'UP') (items[index - 1] || document.querySelector('#doorpiQuickPanel [data-action="refresh-storage"]') || document.querySelector('#doorpiQuickPanel .dq-drive-tab.active'))?.focus();
                else if (index >= 0 && direction === 'DOWN') (items[index + 1] || document.querySelector('#doorpiQuickPanel .dq-storage-remove-programs'))?.focus();
                else return false;
                return true;
            }
            if (section === 'storage' && active?.classList?.contains('dq-storage-remove-programs') && direction === 'UP') {
                const rows = Array.from(document.querySelectorAll('#doorpiQuickPanel .dq-storage-console-row'));
                rows[rows.length - 1]?.focus();
                return true;
            }
            if (section === 'storage' && active?.closest?.('.dq-storage-program-manager')) {
                const manager = active.closest('.dq-storage-program-manager');
                const list = manager.querySelector('.dq-program-list');
                const programs = Array.from(list?.querySelectorAll('.dq-program-main') || []);
                const cancel = manager.querySelector('[data-cancel-storage-program]');
                const confirm = manager.querySelector('[data-confirm-uninstall]');
                const selectedProgram = manager.querySelector(`[data-storage-program="${CSS.escape(selectedStorageProgramId || '')}"]`) || programs[0];
                const programIndex = programs.indexOf(active);
                if (programIndex >= 0 && (direction === 'UP' || direction === 'DOWN')) {
                    programs[programIndex + (direction === 'DOWN' ? 1 : -1)]?.focus();
                    return true;
                }
                if (programIndex >= 0 && direction === 'RIGHT') {
                    (cancel || confirm)?.focus();
                    return true;
                }
                if (active === cancel) {
                    if (direction === 'RIGHT') confirm?.focus();
                    else if (direction === 'LEFT' || direction === 'UP' || direction === 'DOWN') selectedProgram?.focus();
                    return true;
                }
                if (active === confirm) {
                    if (direction === 'LEFT') cancel?.focus();
                    else if (direction === 'UP' || direction === 'DOWN') selectedProgram?.focus();
                    return true;
                }
            }
            if (active?.closest?.('#doorpiQuickPanel .dq-content')) {
                if (direction === 'LEFT') {
                    if (hasContentTargetToLeft(active)) return false;
                    depth = 'menu';
                    const sidebarTarget = document.querySelector(
                        `#doorpiQuickPanel .dq-menu-btn[data-section="${section}"]`);
                    sidebarTarget?.focus();
                    return true;
                }
                if (direction === 'RIGHT') {
                    const contentItems = getQuickPanelContentItems();
                    const target = findContentTargetToRight(active, contentItems) || contentItems[0];
                    target?.focus();
                    return true;
                }
            }
            if (active?.closest?.('#doorpiQuickPanel .dq-sidebar') && direction === 'RIGHT') {
                const contentItems = getQuickPanelContentItems();
                if (section && contentItems.length) {
                    depth = 'content';
                    const preferred = document.querySelector(
                        `#doorpiQuickPanel ${contentFocusFor(section)}`);
                    (preferred && contentItems.includes(preferred) ? preferred : contentItems[0])?.focus();
                    return true;
                }
                close();
                return true;
            }
            return false;
        }

