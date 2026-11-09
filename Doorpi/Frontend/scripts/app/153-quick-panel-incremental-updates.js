        function wireBluetooth(root) {
            if (section !== 'connectivity' || connectivityView !== 'bluetooth') return;
            window.DoorpiBluetoothUI?.bind?.(root, 'quick', focusSelector => render(focusSelector));
        }

        function wireWifi(root) {
            if (section !== 'connectivity' || connectivityView !== 'wifi') return;
            window.DoorpiWifiUI?.bind?.(root, 'quick', focusSelector => render(focusSelector));
        }

        function wireSound(root) {
            if (section !== 'sound') return;
            window.DoorpiSoundUI?.bind?.(root, 'quick', focusSelector => render(focusSelector));
        }

        function patchBluetoothContent() {
            const overlay = document.getElementById('doorpiQuickPanel');
            const current = overlay?.querySelector('.dq-content');
            if (!current || section !== 'connectivity' || connectivityView !== 'bluetooth') return;
            const focusSelector = currentFocusSelector();
            const template = document.createElement('template');
            template.innerHTML = bluetoothContent().trim();
            const next = template.content.firstElementChild;
            current.replaceWith(next);
            wireBluetooth(next);
            requestAnimationFrame(() => {
                const target = (focusSelector && next.querySelector(focusSelector)) || next.querySelector('.bluetooth-focus');
                target?.focus();
            });
        }

        function scheduleBluetoothContentPatch(immediate = false) {
            if (bluetoothPatchTimer) {
                clearTimeout(bluetoothPatchTimer);
                bluetoothPatchTimer = 0;
            }
            if (immediate) {
                patchBluetoothContent();
                return;
            }
            bluetoothPatchTimer = setTimeout(() => {
                bluetoothPatchTimer = 0;
                patchBluetoothContent();
            }, 120);
        }

        function patchWifiContent() {
            const overlay = document.getElementById('doorpiQuickPanel');
            const current = overlay?.querySelector('.dq-content');
            if (!current || section !== 'connectivity' || connectivityView !== 'wifi') return;
            const focusSelector = currentFocusSelector();
            const template = document.createElement('template');
            template.innerHTML = wifiContent().trim();
            const next = template.content.firstElementChild;
            current.replaceWith(next);
            wireWifi(next);
            requestAnimationFrame(() => {
                const target = (focusSelector && next.querySelector(focusSelector)) || next.querySelector('.wifi-focus');
                target?.focus();
            });
        }

        function patchSoundContent() {
            const overlay = document.getElementById('doorpiQuickPanel');
            const current = overlay?.querySelector('.dq-content');
            if (!current || section !== 'sound') return;
            const focusSelector = currentFocusSelector();
            const template = document.createElement('template');
            template.innerHTML = soundContent().trim();
            const next = template.content.firstElementChild;
            current.replaceWith(next);
            wireSound(next);
            requestAnimationFrame(() => {
                const target = (focusSelector && next.querySelector(focusSelector)) || next.querySelector('.sound-focus');
                target?.focus();
            });
        }

        function wireStorageCategoryButtons(root) {
            root?.querySelectorAll?.('[data-storage-category]').forEach(btn => {
                btn.onclick = () => {
                    const key = btn.dataset.storageCategory || '';
                    if (expandedStorageCategories.has(key)) expandedStorageCategories.delete(key);
                    else expandedStorageCategories.add(key);
                    render(`[data-storage-category="${CSS.escape(key)}"]`);
                };
            });
        }

        function storageNodeMap(categories) {
            const result = new Map();
            (categories || []).forEach(category => {
                result.set(`category|${category?.key || ''}`, category);
                (category?.children || []).forEach(child => {
                    result.set(`child|${category?.key || ''}|${child?.key || ''}`, child);
                    (child?.children || []).forEach(item => {
                        result.set(`item|${category?.key || ''}|${child?.key || ''}|${item?.key || ''}`, item);
                    });
                });
            });
            return result;
        }

        function patchStorageOverview() {
            const overlay = document.getElementById('doorpiQuickPanel');
            const contentEl = overlay?.querySelector('.dq-content');
            if (!contentEl || section !== 'storage' || storageView !== 'overview') return false;
            const drives = Array.isArray(storageStatus?.drives) ? storageStatus.drives : [];
            const drive = drives.find(item => item.root === selectedStorageRoot) || drives[0];
            if (!drive) return false;
            if (!selectedStorageRoot) selectedStorageRoot = drive.root || '';

            const progress = contentEl.querySelector('.dq-storage-progress');
            if (progress) progress.textContent = storageStatusMessage();
            contentEl.querySelectorAll('.dq-drive-tab[data-storage-root]').forEach(tab => {
                const item = drives.find(candidate => candidate.root === tab.dataset.storageRoot);
                if (!item) return;
                const free = tab.querySelector('[data-storage-drive-free]');
                if (free) free.textContent = `${storageSizeText(item.availableBytes)} livres de ${storageSizeText(item.totalBytes)}`;
                const itemTotal = Math.max(1, Number(item.totalBytes || 0));
                const itemUsedPercent = Math.round(Math.max(0, Math.min(100, Number(item.usedBytes || 0) / itemTotal * 100)));
                const track = tab.querySelector('[data-storage-drive-track]');
                if (track) track.style.width = `${itemUsedPercent}%`;
            });
            ['totalBytes', 'usedBytes', 'availableBytes', 'reservedBytes'].forEach(key => {
                const value = contentEl.querySelector(`[data-storage-stat="${key}"] strong`);
                if (value) value.textContent = storageSizeText(drive[key]);
            });
            const usedPercent = Math.round(Math.max(0, Math.min(100, Number(drive.usedBytes || 0) / Math.max(1, Number(drive.totalBytes || 0)) * 100)));
            const usedPercentLabel = contentEl.querySelector('[data-storage-used-percent]');
            if (usedPercentLabel) usedPercentLabel.textContent = `${usedPercent}% do disco em uso`;
            const bar = contentEl.querySelector('.dq-storage-bar');
            if (bar) bar.innerHTML = storageSegmentsMarkup(drive);
            const legend = contentEl.querySelector('.dq-storage-legend');
            if (legend) legend.innerHTML = storageLegendMarkup();
            const refreshIcon = contentEl.querySelector('[data-action="refresh-storage"] .dq-action-ico svg');
            refreshIcon?.classList.toggle('dq-spin', !!storageStatus?.calculating);

            const categories = Array.isArray(drive.categories) ? drive.categories : [];
            const consoleList = contentEl.querySelector('.dq-storage-console-list');
            if (consoleList) {
                const categoryMap = new Map(categories.map(category => [category?.key || '', category]));
                consoleList.querySelectorAll('[data-storage-overview-category]').forEach(row => {
                    const category = categoryMap.get(row.dataset.storageOverviewCategory || '');
                    const value = row.querySelector('.dq-storage-console-value strong');
                    if (category && value) value.textContent = storageNodeSizeText(category);
                });
                return true;
            }
            const list = contentEl.querySelector('.dq-storage-list');
            if (!list) return false;
            const nextStructure = storageStructureSignature(categories);
            if (list.dataset.storageStructure !== nextStructure) {
                const active = document.activeElement;
                const focusSelector = active?.closest?.('.dq-storage-list') ? currentFocusSelector() : '';
                const previousScrollTop = contentEl.scrollTop;
                list.innerHTML = categories.map(storageCategoryMarkup).join('');
                list.dataset.storageStructure = nextStructure;
                wireStorageCategoryButtons(list);
                contentEl.scrollTop = previousScrollTop;
                if (focusSelector) requestAnimationFrame(() => list.querySelector(focusSelector)?.focus());
                return true;
            }

            const nodes = storageNodeMap(categories);
            list.querySelectorAll('[data-storage-node]').forEach(element => {
                const node = nodes.get(element.dataset.storageNode || '');
                if (!node) return;
                const size = element.querySelector(':scope > .dq-storage-node-size, :scope > button .dq-storage-node-size');
                const state = element.querySelector(':scope > span .dq-storage-node-state, :scope > button .dq-storage-node-state');
                if (size) size.textContent = storageNodeSizeText(node);
                if (state) state.textContent = storageStateText(node.state);
            });
            return true;
        }

        function patchStorageCategoryDetail() {
            const overlay = document.getElementById('doorpiQuickPanel');
            const panel = overlay?.querySelector('[data-storage-detail-category]');
            if (!panel || section !== 'storage' || storageView !== 'category') return false;
            const drives = Array.isArray(storageStatus?.drives) ? storageStatus.drives : [];
            const drive = drives.find(item => item.root === selectedStorageRoot) || drives[0];
            const categories = Array.isArray(drive?.categories) ? drive.categories : [];
            const category = categories.find(item => item.key === selectedStorageCategoryKey);
            if (!category) return true;

            const total = panel.querySelector('[data-storage-category-total]');
            if (total) total.textContent = storageNodeSizeText(category);
            const driveLabel = panel.querySelector('[data-storage-detail-drive]');
            if (driveLabel) driveLabel.textContent = drive?.label || 'Unidade';
            const list = panel.querySelector('.dq-storage-vertical-list');
            if (!list) return true;
            const nextStructure = storageStructureSignature([category]);
            if (list.dataset.storageDetailStructure !== nextStructure) {
                const focusedKey = document.activeElement?.closest?.('[data-storage-detail-node]')?.dataset.storageDetailNode || '';
                const scrollTop = list.scrollTop;
                list.innerHTML = storageCategoryDetailRowsMarkup(category);
                list.dataset.storageDetailStructure = nextStructure;
                list.scrollTop = scrollTop;
                if (focusedKey) requestAnimationFrame(() => list.querySelector(`[data-storage-detail-node="${CSS.escape(focusedKey)}"]`)?.focus());
                return true;
            }

            const children = Array.isArray(category.children) ? category.children : [];
            const nodes = new Map((children.length ? children : [category]).map(node => [children.length ? String(node?.key || '') : '__self__', node]));
            list.querySelectorAll('[data-storage-detail-node]').forEach(row => {
                const node = nodes.get(row.dataset.storageDetailNode || '');
                if (!node) return;
                const size = row.querySelector('[data-storage-detail-size]');
                if (size) size.textContent = storageNodeSizeText(node);
                const items = new Map((node.children || []).map(item => [String(item?.key || ''), item]));
                row.querySelectorAll('[data-storage-detail-item]').forEach(itemRow => {
                    const item = items.get(itemRow.dataset.storageDetailItem || '');
                    const itemSize = itemRow.querySelector('strong');
                    if (item && itemSize) itemSize.textContent = storageNodeSizeText(item);
                });
            });
            return true;
        }

        function patchStorageProgramsList() {
            const overlay = document.getElementById('doorpiQuickPanel');
            const contentEl = overlay?.querySelector('.dq-storage-programs-page');
            const list = contentEl?.querySelector('.dq-program-list');
            if (!contentEl || !list || section !== 'storage' || storageView !== 'programs') return false;
            const programs = storageProgramsForSelectedDrive();
            if (selectedStorageProgramId && !programs.some(program => program.id === selectedStorageProgramId))
                selectedStorageProgramId = '';
            const bytes = programs.reduce((sum, program) => sum + Math.max(0, Number(program.sizeBytes || 0)), 0);
            const count = contentEl.querySelector('[data-storage-program-count]');
            const total = contentEl.querySelector('[data-storage-program-total]');
            if (count) count.textContent = `${programs.length} ${programs.length === 1 ? 'programa' : 'programas'}`;
            if (total) total.textContent = storageSizeText(bytes, 'Tamanho não informado');
            const focusedId = document.activeElement?.closest?.('[data-storage-program]')?.dataset.storageProgram || '';
            const scrollTop = list.scrollTop;
            list.innerHTML = storageProgramRowsMarkup(programs) || `<div class="dq-storage-message">${esc(storagePrograms?.error || (storagePrograms ? 'Nenhum programa identificado nesta unidade.' : 'Carregando programas do Windows…'))}</div>`;
            list.scrollTop = scrollTop;
            if (focusedId) requestAnimationFrame(() => list.querySelector(`[data-storage-program="${CSS.escape(focusedId)}"]`)?.focus());
            return true;
        }

        function setBusyAction(btn, message) {
            btn.dataset.busy = 'true';
            const label = btn.querySelector('.dq-action-label');
            const icon = btn.querySelector('.dq-action-ico');
            if (label) label.textContent = t('quickChecking');
            if (icon) icon.innerHTML = iconSvg('refresh', 'dq-spin');
            const sub = document.getElementById('doorpiQuickPanel')?.querySelector('.dq-sub');
            if (sub && message) sub.textContent = message;
            btn.focus();
        }

        function patchCheckingStatus(kind, status) {
            if (status?.status !== 'checking') return false;
            if (section !== 'updates' || updateView !== kind) return false;
            const action = kind === 'windows' ? 'check-windows' : 'check-doorpi';
            const btn = document.getElementById('doorpiQuickPanel')?.querySelector(`[data-action="${action}"]`);
            if (!btn) return false;
            const fallback = kind === 'windows'
                ? t('quickCheckingWindows')
                : t('quickCheckingDoorpi');
            setBusyAction(btn, status.message || fallback);
            return true;
        }

