    // ── Bridge Update ─────────────────────────────────────────────────────────
    if (window.chrome?.webview) {
        window.chrome.webview.addEventListener('message', e => {
            try {
                const data = JSON.parse(e.data);

                if (data.type === 'gameHistoryDeleted' && data.removed) {
                    const deletedName = String(data.gameName || '');
                    _menuData.history = (_menuData.history || []).filter(entry =>
                        String(entry?.Name || '').localeCompare(
                            deletedName,
                            undefined,
                            { sensitivity: 'base' }) !== 0);

                    if (window.isNavMenuOpen && CATS[_catIdx]?.id === 'profile') {
                        const previousIndex = _contentIdx;
                        _renderContent('profile');
                        _contentIdx = Math.max(0, Math.min(previousIndex, _contentItems.length - 1));
                        _setTopbarFocus(false);
                        _updateContentFocus();
                    }
                }

                if (data.type === 'clipboardText' && window._isPastingApiKey) {
                    window._isPastingApiKey = false;
                    const text = data.text.trim();
                    if (text) {
                        window._updatePendingApiKey?.(text);
                        if (text !== _menuData.user.SteamGridApiKey) {
                            _menuData.user.SteamGridApiKey = text;
                        }
                    }
                }
                
                if (data.type === 'bootModeState') {
                    window._doorpiBootMode = data.mode || 0;
                    if (typeof window._updateBootModeUI === 'function') {
                        window._updateBootModeUI();
                    }
                }

                if (data.type === 'systemUpdateStatus') {
                    _systemUpdateStatus = { ..._systemUpdateStatus, ...data };
                    _updateSystemUpdateUI();
                    if (_settingsSubView === 'system' && typeof window._updateBootModeUI === 'function') {
                        window._updateBootModeUI();
                    }
                }

                if (data.type === 'windowsUpdateStatus') {
                    _windowsUpdateStatus = { ..._windowsUpdateStatus, ...data };
                    _updateWindowsUpdateUI();
                }

                if (data.type === 'gpuUpdateStatus') {
                    _gpuUpdateStatus = { ..._gpuUpdateStatus, ...data };
                    _updateGpuUpdateUI();
                }
                
                if (data.type === 'autoStartState') {
                    _autoStartEnabled = !!data.enabled;
                    _updateAutoStartUI();
                }
                
                if (data.type === 'profilePhotoSelected' && data.base64) {
                    if (typeof isSetupOpen !== 'undefined' && isSetupOpen) return;

                    _menuData.user.PhotoBase64 = data.base64;
                    if (window._doorpiProfile) window._doorpiProfile.PhotoBase64 = data.base64;
                    window._applyDoorpiTopProfile?.(window._doorpiProfile || _menuData.user);

                    const name = _menuData.user.Name || '';
                    postToHost({ action: 'saveUserProfile', name: name, photoBase64: data.base64, skipTasks: true });

                    if (!window.isNavMenuOpen) return;

                    const imgTag = `<img src="${window._doorpiUserPhotoSrc?.(data.base64) || `data:image/png;base64,${data.base64}`}" />`;

                    const photoBtn = document.getElementById('navProfilePhoto');
                    if (photoBtn) photoBtn.innerHTML = imgTag;

                    const hubAvatar = document.querySelector('.nav-profile-avatar-large');
                    if (hubAvatar) hubAvatar.innerHTML = imgTag;

                    const status = document.getElementById('navSaveStatus');
                    if (status) {
                        status.style.opacity = '1';
                        clearTimeout(status._hideTimer);
                        status._hideTimer = setTimeout(() => { status.style.opacity = '0'; }, 3000);
                    }
                }

                // showSetup é uma transição global e é tratada exclusivamente
                // por app.js. Mantê-la aqui abria o setup duas vezes e encerrava
                // o handoff da intro antes do conteúdo estar visível.
            } catch { }
        });
    }

