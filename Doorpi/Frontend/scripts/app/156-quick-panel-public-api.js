        const api = {
            open,
            openMenu,
            close,
            toggle,
            back,
            confirm() {
                if (!this.isOpen() || section !== 'sound') return false;
                return !!window.DoorpiSoundUI?.confirm?.('quick');
            },
            handleDirection,
            isOpen: () => {
                const overlay = document.getElementById('doorpiQuickPanel');
                return !!(overlay && overlay.style.display !== 'none' && overlay.offsetWidth > 0);
            },
            setDoorpiUpdateStatus(status) {
                const focusSelector = currentFocusSelector();
                doorpiStatus = status;
                if (this.isOpen() && patchCheckingStatus('doorpi', status)) return;
                if (this.isOpen()) render(focusSelector || contentFocusFor(section));
            },
            setWindowsUpdateStatus(status) {
                const focusSelector = currentFocusSelector();
                windowsStatus = status;
                if (this.isOpen() && patchCheckingStatus('windows', status)) return;
                if (this.isOpen()) render(focusSelector || contentFocusFor(section));
            },
            setGpuUpdateStatus(status) {
                const focusSelector = currentFocusSelector();
                gpuStatus = status;
                if (this.isOpen()) render(focusSelector || contentFocusFor(section));
            },
            setBluetoothStatus(status) {
                bluetoothStatus = { ...(bluetoothStatus || {}), ...(status || {}) };
                if (this.isOpen() && section === 'connectivity') {
                    const op = bluetoothStatus.operation || '';
                    scheduleBluetoothContentPatch(op === 'pairing' || op === 'removing' || !!bluetoothStatus.pairingPrompt);
                }
            },
            setWifiStatus(status) {
                wifiStatus = { ...(wifiStatus || {}), ...(status || {}) };
                if (this.isOpen() && section === 'connectivity' && connectivityView === 'wifi') {
                    patchWifiContent();
                }
            },
            setSoundStatus(status) {
                soundStatus = { ...(soundStatus || {}), ...(status || {}) };
                if (this.isOpen() && section === 'sound') {
                    patchSoundContent();
                }
            },
            setStorageStatus(status) {
                storageStatus = status || null;
                if (this.isOpen() && section === 'storage') {
                    const patched = storageView === 'overview'
                        ? patchStorageOverview()
                        : storageView === 'category'
                            ? patchStorageCategoryDetail()
                            : true;
                    if (!patched) render('.dq-drive-tab.active');
                }
            },
            setStoragePrograms(status) {
                const focusSelector = currentFocusSelector();
                storagePrograms = status || { programs: [] };
                if (this.isOpen() && section === 'storage') {
                    if (storageView === 'programs' && patchStorageProgramsList()) return;
                    if (storageView === 'program-detail') render(focusSelector || '.dq-drive-tab.active');
                }
            },
            setStorageUninstallStatus(status) {
                uninstallStatus = status || null;
                if (this.isOpen() && section === 'storage') {
                    const detailStatus = document.querySelector('#doorpiQuickPanel .dq-storage-program-status');
                    if (detailStatus && (!status?.programId || status.programId === selectedStorageProgramId)) {
                        detailStatus.hidden = !status?.message;
                        detailStatus.textContent = status?.message || '';
                    }
                    const action = status?.programId
                        ? document.querySelector(`#doorpiQuickPanel [data-confirm-uninstall="${CSS.escape(status.programId)}"]`)
                        : null;
                    if (action) {
                        const phase = status?.status || '';
                        const active = phase === 'started';
                        const processing = phase === 'preparing' || phase === 'direct';
                        const canUninstall = action.dataset.canUninstall !== 'false';
                        action.disabled = processing || !canUninstall;
                        action.textContent = active
                            ? 'Retornar'
                            : phase === 'direct'
                                ? 'Remoção solicitada'
                                : phase === 'preparing'
                                    ? 'Solicitando…'
                                    : (canUninstall ? 'Desinstalar' : 'Indisponível');
                        const note = action.closest('.dq-program-inline-detail')?.querySelector('.dq-program-inline-note');
                        if (note && active) note.textContent = 'Use Retornar para trazer o desinstalador novamente ao primeiro plano.';
                        else if (note && phase === 'direct') note.textContent = 'O Windows recebeu a solicitação diretamente; nenhuma ferramenta externa precisa ser controlada.';
                        if (active) {
                            const list = action.closest('.dq-program-list');
                            const scrollTop = list?.scrollTop || 0;
                            requestAnimationFrame(() => {
                                action.focus({ preventScroll:true });
                                if (list) list.scrollTop = scrollTop;
                            });
                        }
                    }
                }
            },
            focusStorageUninstallerReturn(programId) {
                if (!this.isOpen() || section !== 'storage' || !programId) return false;
                const action = document.querySelector(`#doorpiQuickPanel [data-confirm-uninstall="${CSS.escape(programId)}"]`);
                if (!action) return false;
                const list = action.closest('.dq-program-list');
                const scrollTop = list?.scrollTop || 0;
                action.focus({ preventScroll:true });
                if (list) list.scrollTop = scrollTop;
                return document.activeElement === action;
            }
        };
        return api;
    })();

