    /* ── Menu de Contexto & Outros ── */
    // ══════════════════════════════════════════════════════════════════════════
    // Context Menu
    // ══════════════════════════════════════════════════════════════════════════

    const _ctxMenu = (() => {
        const el = document.createElement('div');
        el.className = 'context-menu';
        el.setAttribute('role', 'menu');
        el.innerHTML = `
            <div class="ctx-game-name" id="ctxGameName"></div>
            <button class="ctx-item ctx-primary-action" id="ctxRuntimeAction" role="menuitem">
                <span class="ctx-icon">▶</span> <span id="ctxRuntimeActionText">${t('ctxStart')}</span>
            </button>
            <button class="ctx-item ctx-toggle-item" id="ctxStoreGamepadControl" role="menuitem">
                <span id="ctxStoreGamepadControlText">${t('storeDisableGamepadControl')}</span> <span class="ctx-icon"></span>
            </button>
            <button class="ctx-item ctx-toggle-item" id="ctxStoreAutoAdd" role="menuitem">
                <span id="ctxStoreAutoAddText">${t('storeAutoAddQuickToggle')}</span> <span class="ctx-icon"></span>
            </button>
            <div class="ctx-separator"></div>
            <button class="ctx-item" id="ctxExtensions" role="menuitem">
                <span class="ctx-icon">+</span> <span data-i18n="manageExtensions">${t('manageExtensions')}</span>
            </button>
            <button class="ctx-item" id="ctxSharing" role="menuitem">
                <span class="ctx-icon">=</span> <span data-i18n="accountSharingLabel">${t('accountSharingLabel')}</span>
            </button>
            <div class="ctx-separator"></div>
            <button class="ctx-item" id="ctxEdit" role="menuitem">
                <span class="ctx-icon">✎</span> <span data-i18n="ctxEditName">${t('ctxEditName')}</span>
            </button>
            <div class="ctx-separator"></div>
            <button class="ctx-item ctx-danger" id="ctxDelete" role="menuitem">
                <span class="ctx-icon">✕</span> <span data-i18n="ctxRemoveGame">${t('ctxRemoveGame')}</span>
            </button>
        `;
        document.body.appendChild(el);
        return el;
    })();

    let _ctxCard = null;
    let _ctxReturnKey = null;

    function _getCtxReturnKey(card) {
        if (!card) return null;
        return {
            gridId: card.closest?.('#gameGrid, #mediaGrid, #storesGrid')?.id || '',
            gameId: card.dataset.gameId || '',
            appId: card.dataset.appId || '',
            appUrl: card.dataset.appUrl || '',
            id: card.dataset.id || '',
            channel: card.dataset.channel || '',
            updaterId: card.dataset.updaterId || '',
            deviceId: card.dataset.deviceId || '',
            historyGameName: card.dataset.historyGameName || ''
        };
    }

    function _findCtxReturnCard(key) {
        if (!key) return null;
        const root = key.gridId ? document.getElementById(key.gridId) : document;
        const cards = Array.from((root || document).querySelectorAll('.card, [data-gpu-updater-card="true"], [data-bluetooth-device-card="true"], [data-history-game-name]'));
        return cards.find(card => {
            if (key.gameId && card.dataset.gameId === key.gameId) return true;
            if (key.appId && card.dataset.appId === key.appId) return true;
            if (key.appUrl && card.dataset.appUrl === key.appUrl) return true;
            if (key.id && card.dataset.id === key.id) return true;
            if (key.updaterId && card.dataset.updaterId === key.updaterId) return true;
            if (key.deviceId && card.dataset.deviceId === key.deviceId) return true;
            if (key.historyGameName && card.dataset.historyGameName === key.historyGameName) return true;
            return false;
        }) || null;
    }

    function _restoreCtxReturnFocus(card, key) {
        const target = (card && card.isConnected) ? card : _findCtxReturnCard(key);
        if (!target) return false;
        target.focus({ preventScroll: true });
        target.scrollIntoView?.({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        target._startInteraction?.();
        return document.activeElement === target;
    }

    function _isCtxItemVisible(el) {
        return !!el && el.style.display !== 'none' && getComputedStyle(el).display !== 'none';
    }

    function _syncCtxMenuSeparators() {
        const children = Array.from(_ctxMenu.children);
        const separators = children.filter(child => child.classList?.contains('ctx-separator'));
        separators.forEach(separator => { separator.style.display = 'none'; });

        const visibleItems = children.filter(child =>
            child.classList?.contains('ctx-item') && _isCtxItemVisible(child));
        for (let i = 1; i < visibleItems.length; i++) {
            const previousIndex = children.indexOf(visibleItems[i - 1]);
            const currentIndex = children.indexOf(visibleItems[i]);
            const separator = children
                .slice(previousIndex + 1, currentIndex)
                .filter(child => child.classList?.contains('ctx-separator'))
                .at(-1);
            if (separator) separator.style.display = 'block';
        }
    }

    function _openCtxMenu(card, x, y) {
        _ctxCard = card;
        _ctxReturnKey = _getCtxReturnKey(card);
        _ctxCard.classList.add('ctx-active');


        if (typeof applyI18n === 'function') applyI18n();
        const updateCount = Object.keys(window._pendingExtensionUpdates || {}).length;

        const gameId = card.dataset.gameId || card.dataset.appId || card.dataset.appUrl;
        const isStoreCard = card.dataset.channel === 'stores' || card.closest('#storesGrid') !== null;
        const isYoutube = [card.dataset.gameId, card.dataset.appId]
            .filter(Boolean)
            .some(id => String(id).toLowerCase() === 'youtube');
        const isGpuUpdaterCard = card.dataset.gpuUpdaterCard === 'true';
        const isBluetoothDeviceCard = card.dataset.bluetoothDeviceCard === 'true';
        const isHistoryCard = !!card.dataset.historyGameName;
        _ctxMenu.classList.toggle('gpu-updater-context', isGpuUpdaterCard);
        _ctxMenu.classList.toggle('bluetooth-device-context', isBluetoothDeviceCard);

        const ctxEditBtn = _ctxMenu.querySelector('#ctxEdit');
        const ctxDeleteBtn = _ctxMenu.querySelector('#ctxDelete');
        const ctxSharingBtn = _ctxMenu.querySelector('#ctxSharing');
        const ctxRuntimeBtn = _ctxMenu.querySelector('#ctxRuntimeAction');
        const ctxRuntimeText = _ctxMenu.querySelector('#ctxRuntimeActionText');
        const ctxStoreGamepadBtn = _ctxMenu.querySelector('#ctxStoreGamepadControl');
        const ctxStoreGamepadText = _ctxMenu.querySelector('#ctxStoreGamepadControlText');
        const ctxStoreAutoAddBtn = _ctxMenu.querySelector('#ctxStoreAutoAdd');
        const ctxStoreAutoAddText = _ctxMenu.querySelector('#ctxStoreAutoAddText');
        const storeId = card.dataset.appId || card.dataset.id || card.dataset.appUrl || '';
        const isRunning = window.isCardRuntimeRunning?.(card) === true;
        const ctxEditText = ctxEditBtn?.querySelector('[data-i18n], span:last-child');
        if (ctxEditText) ctxEditText.textContent = t('ctxEditName');
        if (ctxRuntimeBtn && ctxRuntimeText) {
            ctxRuntimeBtn.classList.toggle('ctx-danger', isRunning);
            ctxRuntimeText.textContent = isGpuUpdaterCard
                ? 'Abrir'
                : isBluetoothDeviceCard
                ? (card.dataset.paired === 'true' ? t('bluetoothDetails') : t('bluetoothPair'))
                : isStoreCard && !isRunning
                ? (typeof t === 'function' ? t('storeOpenBtn') : 'Abrir')
                : (isRunning
                    ? (typeof t === 'function' ? t('ctxCloseRunning') : 'Fechar')
                    : (typeof t === 'function' ? t('ctxStart') : 'Iniciar'));
            ctxRuntimeBtn.querySelector('.ctx-icon').textContent = isRunning ? '×' : '▶';
        }
        if (ctxStoreGamepadBtn && ctxStoreGamepadText) {
            const disabled = card.dataset.disableGamepadControl === 'true';
            ctxStoreGamepadBtn.style.display = 'none';
            ctxStoreGamepadBtn.classList.toggle('on', !disabled);
            ctxStoreGamepadBtn.querySelector('.ctx-icon').textContent = !disabled ? '\u2713' : '';
            ctxStoreGamepadText.textContent = t('storeDisableGamepadControl');
        }
        if (ctxStoreAutoAddBtn && ctxStoreAutoAddText) {
            if (isStoreCard && typeof postToHost === 'function' && !window._storeAutoAddSettings) {
                postToHost({ action: 'requestStoreAutoAddSettings' });
            }
            const settings = window._storeAutoAddSettings || {};
            const autoAdd = Object.prototype.hasOwnProperty.call(settings, storeId) ? !!settings[storeId] : true;
            ctxStoreAutoAddBtn.style.display = 'none';
            ctxStoreAutoAddBtn.classList.toggle('on', autoAdd);
            ctxStoreAutoAddBtn.querySelector('.ctx-icon').textContent = autoAdd ? '\u2713' : '';
            ctxStoreAutoAddText.textContent = t('storeAutoAddQuickToggle');
        }
        const isBrowserMedia = (card.hasAttribute('data-app-id') || card.closest('#mediaGrid')) &&
            ['browser', 'webview'].includes((card.dataset.appType || 'browser').toLowerCase());

        const dotHtml = updateCount > 0
            ? `<span class="update-dot" style="display:inline-flex; align-items:center; justify-content:center; min-width:18px; height:18px; padding:0 6px 0px 5px; background:#ff4444; color:#fff; font-size:11px; font-weight:800; line-height:0; letter-spacing:0; border-radius:10px; margin-left:8px; box-shadow: 0 0 10px rgba(255,68,68,0.4); flex-shrink:0; box-sizing:border-box;">${updateCount}</span>`
            : '';

        const ctxExtensionsBtn = _ctxMenu.querySelector('#ctxExtensions');

        if (ctxExtensionsBtn) {
            // Recria o conteúdo completo para garantir que o span será inserido
            const btnText = t('manageExtensions');
            ctxExtensionsBtn.innerHTML = `
                <span class="ctx-icon">+</span> 
                <span>${escapeHtml(btnText)}</span>
                ${dotHtml}
            `;
            console.log("DEBUG: innerHTML do botão:", ctxExtensionsBtn.innerHTML);
        }
        let ctxCloseBtn = _ctxMenu.querySelector('#ctxClose');
        if (!ctxCloseBtn) {
            ctxCloseBtn = document.createElement('button');
            ctxCloseBtn.className = 'ctx-item';
            ctxCloseBtn.id = 'ctxClose';
            ctxCloseBtn.innerHTML = `<span class="ctx-icon">↩</span> <span>${t('btnBackLabel')}</span>`;
            ctxCloseBtn.addEventListener('click', _closeCtxMenu);
            _ctxMenu.appendChild(ctxCloseBtn);
        }

        if (isHistoryCard) {
            if (ctxRuntimeBtn) ctxRuntimeBtn.style.display = 'none';
            if (ctxStoreGamepadBtn) ctxStoreGamepadBtn.style.display = 'none';
            if (ctxStoreAutoAddBtn) ctxStoreAutoAddBtn.style.display = 'none';
            if (ctxEditBtn) {
                ctxEditBtn.style.display = 'flex';
                const text = ctxEditBtn.querySelector('[data-i18n], span:last-child');
                if (text) text.textContent = t('historyContextArtwork');
            }
            if (ctxExtensionsBtn) ctxExtensionsBtn.style.display = 'none';
            if (ctxSharingBtn) ctxSharingBtn.style.display = 'none';
            if (ctxDeleteBtn) {
                ctxDeleteBtn.style.display = 'flex';
                const text = ctxDeleteBtn.querySelector('[data-i18n], span:last-child');
                if (text) text.textContent = t('historyContextDelete');
            }
            ctxCloseBtn.style.display = 'none';
            _ctxMenu.querySelector('#ctxGameName').textContent = card.dataset.historyGameName;
        } else if (isBluetoothDeviceCard) {
            if (ctxRuntimeBtn) ctxRuntimeBtn.style.display = 'flex';
            if (ctxStoreGamepadBtn) ctxStoreGamepadBtn.style.display = 'none';
            if (ctxStoreAutoAddBtn) ctxStoreAutoAddBtn.style.display = 'none';
            if (ctxEditBtn) ctxEditBtn.style.display = 'none';
            if (ctxExtensionsBtn) ctxExtensionsBtn.style.display = 'none';
            if (ctxSharingBtn) ctxSharingBtn.style.display = 'none';
            if (ctxDeleteBtn) {
                ctxDeleteBtn.style.display = card.dataset.paired === 'true' ? 'flex' : 'none';
                const text = ctxDeleteBtn.querySelector('[data-i18n], span:last-child');
                if (text) text.textContent = t('bluetoothRemoveDevice');
            }
            ctxCloseBtn.style.display = 'none';
            _ctxMenu.querySelector('#ctxGameName').textContent =
                card.querySelector('.bt-device-copy strong')?.innerText?.trim() || 'Bluetooth';
        } else if (isGpuUpdaterCard) {
            if (ctxRuntimeBtn) ctxRuntimeBtn.style.display = 'flex';
            if (ctxStoreGamepadBtn) ctxStoreGamepadBtn.style.display = 'none';
            if (ctxStoreAutoAddBtn) ctxStoreAutoAddBtn.style.display = 'none';
            if (ctxEditBtn) ctxEditBtn.style.display = 'none';
            if (ctxExtensionsBtn) ctxExtensionsBtn.style.display = 'none';
            if (ctxSharingBtn) ctxSharingBtn.style.display = 'none';
            if (ctxDeleteBtn) {
                ctxDeleteBtn.style.display = 'flex';
                const text = ctxDeleteBtn.querySelector('[data-i18n], span:last-child');
                if (text) text.textContent = 'Remover atualizador';
            }
            ctxCloseBtn.style.display = 'none';
            _ctxMenu.querySelector('#ctxGameName').textContent =
                card.querySelector('.dq-app-name, .nav-gpu-app-name')?.innerText?.trim() || 'Atualizador';
        } else if (isStoreCard) {
            if (ctxRuntimeBtn) ctxRuntimeBtn.style.display = 'flex';
            if (ctxEditBtn) ctxEditBtn.style.display = 'flex';
            if (ctxExtensionsBtn) ctxExtensionsBtn.style.display = 'none';
            if (ctxSharingBtn) ctxSharingBtn.style.display = 'none';
            if (ctxDeleteBtn) ctxDeleteBtn.style.display = 'none';
            ctxCloseBtn.style.display = 'none';
            _ctxMenu.querySelector('#ctxGameName').textContent = card.querySelector('.title, .nav-vertical-card-title')?.innerText?.trim() || '';
        } else if (isYoutube) {
            if (ctxRuntimeBtn) ctxRuntimeBtn.style.display = 'flex';
            if (ctxEditBtn) ctxEditBtn.style.display = 'none';
            if (ctxExtensionsBtn) ctxExtensionsBtn.style.display = isBrowserMedia ? 'flex' : 'none';
            if (ctxSharingBtn) ctxSharingBtn.style.display = isBrowserMedia ? 'flex' : 'none';
            if (ctxDeleteBtn) ctxDeleteBtn.style.display = 'none';
            ctxCloseBtn.style.display = 'flex';
            _ctxMenu.querySelector('#ctxGameName').textContent = t('systemAppLabel');
        } else {
            if (ctxRuntimeBtn) ctxRuntimeBtn.style.display = 'flex';
            if (ctxEditBtn) ctxEditBtn.style.display = 'flex';
            if (ctxExtensionsBtn) ctxExtensionsBtn.style.display = isBrowserMedia ? 'flex' : 'none';
            if (ctxSharingBtn) ctxSharingBtn.style.display = isBrowserMedia ? 'flex' : 'none';
            if (ctxDeleteBtn) {
                ctxDeleteBtn.style.display = 'flex';
                const text = ctxDeleteBtn.querySelector('[data-i18n], span:last-child');
                if (text) text.textContent = t('ctxRemoveGame');
            }
            ctxCloseBtn.style.display = 'none';
            _ctxMenu.querySelector('#ctxGameName').textContent = card.querySelector('.title, .nav-vertical-card-title')?.innerText?.trim() || '';
        }

        _syncCtxMenuSeparators();
        _ctxMenu.style.display = 'flex';
        requestAnimationFrame(() => {
            const w = _ctxMenu.offsetWidth, h = _ctxMenu.offsetHeight, m = 10;
            _ctxMenu.style.left = Math.min(x, window.innerWidth - w - m) + 'px';
            _ctxMenu.style.top = Math.min(y, window.innerHeight - h - m) + 'px';
            _ctxMenu.classList.add('visible');
            isCtxMenuOpen = true;

            const firstVisibleItem = Array.from(_ctxMenu.querySelectorAll('.ctx-item'))
                .find(item => _isCtxItemVisible(item));
            firstVisibleItem?.focus();
        });
    }
    function _closeCtxMenu(options = {}) {
        const restoreFocus = options.restoreFocus !== false;
        isCtxMenuOpen = false;
        _ctxMenu.classList.remove('visible');

        if (_ctxCard) _ctxCard.classList.remove('ctx-active');

        setTimeout(() => { if (!_ctxMenu.classList.contains('visible')) _ctxMenu.style.display = 'none'; }, 160);
        const card = _ctxCard;
        const key = _ctxReturnKey;
        _ctxCard = null;
        _ctxReturnKey = null;
        if (restoreFocus) {
            requestAnimationFrame(() => _restoreCtxReturnFocus(card, key));
            setTimeout(() => _restoreCtxReturnFocus(card, key), 180);
        }
    }

    window._ctxMenuOpen = _openCtxMenu;
    window._ctxMenuClose = _closeCtxMenu;

    document.addEventListener('mousedown', e => {
        if (isCtxMenuOpen && !_ctxMenu.contains(e.target)) _closeCtxMenu();
    }, true);

    document.getElementById('ctxEdit').addEventListener('click', () => {
        const card = _ctxCard; _closeCtxMenu({ restoreFocus: false });
        if (!card) return;
        if (card.dataset.historyGameName) {
            window._navMenuEditHistoryArtwork?.(card);
            return;
        }
        openEditGameModal(card);
    });

    document.getElementById('ctxExtensions').addEventListener('click', () => {
        _closeCtxMenu({ restoreFocus: false });
        openExtensionsManager();
    });

    document.getElementById('ctxSharing').addEventListener('click', () => {
        const card = _ctxCard;
        const appId = card?.dataset.appId || card?.dataset.gameId || '';
        _closeCtxMenu({ restoreFocus: false });
        if (appId) window._navMenuOpenAccountSharing?.(appId);
    });

    document.getElementById('ctxStoreGamepadControl').addEventListener('click', (event) => {
        event?.preventDefault?.();
        event?.stopPropagation?.();
        const card = _ctxCard;
        if (!card) return;

        const btn = document.getElementById('ctxStoreGamepadControl');
        const storeId = card.dataset.appId || card.dataset.id || card.dataset.appUrl || '';
        const nextDisabled = card.dataset.disableGamepadControl !== 'true';
        card.dataset.disableGamepadControl = String(nextDisabled);
        if (window.AppStore?.mutations?.patchItem && storeId) {
            window.AppStore.mutations.patchItem('stores', storeId, { disableGamepadControl: nextDisabled });
        }
        if (typeof postToHost === 'function' && storeId) {
            postToHost({ action: 'setStoreGamepadControl', storeId, disabled: nextDisabled });
        }

        if (btn) {
            btn.classList.toggle('on', !nextDisabled);
            const icon = btn.querySelector('.ctx-icon');
            if (icon) icon.textContent = !nextDisabled ? '\u2713' : '';
            requestAnimationFrame(() => btn.focus({ preventScroll: true }));
            setTimeout(() => btn.focus({ preventScroll: true }), 80);
        }
    });

    document.getElementById('ctxStoreAutoAdd')?.addEventListener('click', (event) => {
        event?.preventDefault?.();
        event?.stopPropagation?.();
        const card = _ctxCard;
        if (!card) return;

        const btn = document.getElementById('ctxStoreAutoAdd');
        const storeId = card.dataset.appId || card.dataset.id || card.dataset.appUrl || '';
        if (!storeId) return;

        const settings = window._storeAutoAddSettings || {};
        const current = Object.prototype.hasOwnProperty.call(settings, storeId) ? !!settings[storeId] : true;
        const next = !current;

        window._storeAutoAddSettings = window._storeAutoAddSettings || {};
        window._storeAutoAddSettings[storeId] = next;

        if (typeof postToHost === 'function') {
            postToHost({ action: 'setStoreAutoAdd', store: storeId, enabled: next });
        }

        if (btn) {
            btn.classList.toggle('on', next);
            const icon = btn.querySelector('.ctx-icon');
            if (icon) icon.textContent = next ? '\u2713' : '';
            requestAnimationFrame(() => btn.focus({ preventScroll: true }));
            setTimeout(() => btn.focus({ preventScroll: true }), 80);
        }

        document.querySelector('#ctxStoreAutoAdd .ctx-icon').textContent = next ? '\u2713' : '';
    });

    document.getElementById('ctxRuntimeAction').addEventListener('click', event => {
        event?.preventDefault?.();
        event?.stopPropagation?.();
        window._doorpiSuppressPointer?.(360);
        const card = _ctxCard;
        const isRunning = window.isCardRuntimeRunning?.(card) === true;
        _closeCtxMenu({ restoreFocus: false });
        if (!card) return;

        if (card.dataset.gpuUpdaterCard === 'true' || card.dataset.bluetoothDeviceCard === 'true') {
            card.click();
        } else if (isRunning) {
            postToHost({
                action: 'closeRunningItem',
                id: card.dataset.gameId || card.dataset.appId || card.dataset.id || '',
                url: card.dataset.appUrl || '',
                channel: card.dataset.channel || '',
                appType: card.dataset.appType || ''
            });
        } else {
            card.click();
        }
    });

    document.getElementById('ctxDelete').addEventListener('click', () => {
        const card = _ctxCard; _closeCtxMenu({ restoreFocus: false });
        if (!card) return;
        if (card.dataset.gpuUpdaterCard === 'true') {
            const updaterId = card.dataset.updaterId || '';
            if (updaterId) postToHost?.({ action: 'removeGpuUpdater', updaterId });
            return;
        }
        if (card.dataset.bluetoothDeviceCard === 'true') {
            window.DoorpiBluetoothUI?.remove?.(card.dataset.deviceId || '');
            return;
        }
        if (card.dataset.historyGameName) {
            window._navMenuDeleteHistory?.(card);
            return;
        }
        _executeDelete(card);
    });

