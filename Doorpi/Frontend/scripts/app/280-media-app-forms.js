    // ══════════════════════════════════════════════════════════════════════════
    // View: Aplicativos (App Web + Executável)
    // ══════════════════════════════════════════════════════════════════════════

    let _activeMediaSubtab = 'web';

    function _initMediaAppsView() {
        _switchMediaSubtab(_activeMediaSubtab);

        document.getElementById('mediaAppSubtabs')
            ?.querySelectorAll('.subtab')
            .forEach(btn => {
                const fresh = btn.cloneNode(true);
                btn.replaceWith(fresh);
                fresh.addEventListener('click', () => _switchMediaSubtab(fresh.dataset.subtab));
            });
    }

    function _switchMediaSubtab(subtab) {
        _activeMediaSubtab = subtab;

        document.querySelectorAll('#mediaAppSubtabs .subtab').forEach(b =>
            b.classList.toggle('active', b.dataset.subtab === subtab));

        document.getElementById('subview-web')?.classList.toggle('hidden', subtab !== 'web');
        document.getElementById('subview-web')?.classList.toggle('active', subtab === 'web');
        document.getElementById('subview-exe')?.classList.toggle('hidden', subtab !== 'exe');
        document.getElementById('subview-exe')?.classList.toggle('active', subtab === 'exe');

        if (subtab === 'web') {
            _renderWebAppActions();
            _modalReady = true;
            setTimeout(() => document.getElementById('webAppNameInput')?.focus(), 150);
        } else {
            _renderExeAppModal();

            setTimeout(() => {
                const firstApp = document.querySelector('#appListMedia .app-item');
                if (firstApp) firstApp.focus();
                else document.getElementById('btnSearchMedia')?.focus();
            }, 150);
        }
    }

    // ← ADICIONAR AQUI, logo após o } acima
    window._cycleMediaSubtab = function (delta) {
        const tabs = ['web', 'exe'];
        const currentIdx = tabs.indexOf(_activeMediaSubtab || 'web');
        const nextIdx = (currentIdx + delta + tabs.length) % tabs.length;
        _switchMediaSubtab(tabs[nextIdx]);
    };

    function _renderWebAppActions() {
        const bar = document.getElementById('mediaAppActions');
        bar.innerHTML = `
            <div class="action-buttons">
                <button class="modal-btn primary" id="btnAddWebApp" tabindex="0" data-gamepad-hint="start">
                    <span data-i18n="btnAddWebApp">${t('btnAddWebApp')}</span>
                </button>
                <button class="modal-btn cancel" id="btnCancelWebApp" tabindex="0" data-gamepad-hint="cancel">
                    <span data-i18n="btnCancelLabel">${t('btnCancelLabel')}</span>
                </button>
            </div>`;

        document.getElementById('btnAddWebApp').addEventListener('click', _submitWebApp);
        document.getElementById('btnCancelWebApp').addEventListener('click', closeModal);

        const btnPaste = document.getElementById('btnWebAppPaste');
        if (btnPaste) {
            const freshBtn = btnPaste.cloneNode(true);
            btnPaste.replaceWith(freshBtn);

            freshBtn.addEventListener('click', () => {
                window._isPastingWebAppUrl = true;
                postToHost({ action: 'readClipboard' });
            });
        }

        const btnBrowser = document.getElementById('btnWebAppBrowser');
        if (btnBrowser) {
            const freshBtn = btnBrowser.cloneNode(true);
            btnBrowser.replaceWith(freshBtn);

            freshBtn.addEventListener('click', () => {
                postToHost({ action: 'openWebAppBrowserCapture' });
            });
        }

        ['webAppNameInput', 'webAppUrlInput'].forEach(id => {
            const input = document.getElementById(id);
            if (!input) return;

            input.removeAttribute('readonly');
            input.setAttribute('tabindex', '0');

            const fresh = input.cloneNode(true);
            input.replaceWith(fresh);

            fresh.addEventListener('focus', () => { if (!window._vkbIsOpen) fresh.style.caretColor = ''; });
            fresh.addEventListener('blur', () => { if (!window._vkbIsOpen) fresh.style.caretColor = 'transparent'; });
            fresh.addEventListener('click', (event) => {
                if (!window._doorpiShouldOpenVkbFromEvent?.(event)) return;
                if (!window._vkbIsOpen) window._vkbOpen?.(fresh);
            });

        });

        if (typeof updateGamepadUI === 'function') updateGamepadUI(isGamepadConnected, _controllerType);
    }

    function _submitWebApp() {
        const nameInput = document.getElementById('webAppNameInput');
        const urlInput = document.getElementById('webAppUrlInput');
        const hint = document.getElementById('webAppHint');

        const name = nameInput?.value.trim() || '';
        let url = urlInput?.value.trim() || '';

        nameInput?.classList.remove('error');
        urlInput?.classList.remove('error');
        if (hint) { hint.textContent = ''; hint.classList.remove('error'); }

        if (!name) {
            nameInput?.classList.add('error');
            nameInput?.focus();
            if (hint) {
                hint.textContent = t('webAppErrorName');
                hint.classList.add('error');
            }
            return;
        }

        if (!url || url === 'https://' || url === 'http://') {
            urlInput?.classList.add('error');
            urlInput?.focus();
            if (hint) {
                hint.textContent = t('webAppErrorUrl');
                hint.classList.add('error');
            }
            return;
        }

        if (!/^https?:\/\//i.test(url)) {
            url = 'https://' + url;
        }

        // Adiciona ao set de IDs para marcar como "novo"
        window.newGameIdsThisSession.add(url);
        // Mostra 1 skeleton para o webapp que será adicionado
        showLoadingCards(1, 'media');
        postToHost({ action: 'addWebApp', name, url });
        closeModal(); // Fecha o modal imediatamente
    }

    function _shakeWebField(inputId, hintEl, msg) {
        const input = document.getElementById(inputId);
        if (!input) return;
        input.classList.add('error');
        input.addEventListener('input', () => input.classList.remove('error'), { once: true });
        if (hintEl) { hintEl.textContent = msg; hintEl.classList.add('error'); }
    }

    function _renderExeAppModal() {
        const bar = document.getElementById('mediaAppActions');
        bar.innerHTML = `
            <div class="selection-counter" id="selectionCounterMedia">
                <span class="counter-dot"></span>
                <span id="selectionCounterMediaText"></span>
            </div>
            <div class="action-buttons">
                <button class="modal-btn primary" id="btnConfirmAddMedia" tabindex="0" data-gamepad-hint="start">
                    <span data-i18n="btnConfirmLabel">${t('btnConfirmLabel')}</span>
                </button>
                <button class="modal-btn secondary" id="btnSearchMedia" tabindex="0" data-gamepad-hint="triangle">
                    <span data-i18n="btnSearchLabel">${t('btnSearchLabel')}</span>
                </button>
                <button class="modal-btn cancel" id="btnCancelAddMedia" tabindex="0" data-gamepad-hint="cancel">
                    <span data-i18n="btnCancelLabel">${t('btnCancelLabel')}</span>
                </button>
            </div>`;

        document.getElementById('btnCancelAddMedia').addEventListener('click', closeModal);
        document.getElementById('btnSearchMedia').addEventListener('click', () => window.openManualMediaAppDialog?.());
        document.getElementById('btnConfirmAddMedia').addEventListener('click', () => {
            const selected = Array.from(
                document.querySelectorAll('#appListMedia .app-item.selected')
            ).map(el => ({ Name: el.dataset.name, Path: el.dataset.path, LaunchUrl: el.dataset.launch, IconBase64: el.dataset.iconBase64 || '' }));

            if (selected.length > 0) {
                selected.forEach(app => newGameIdsThisSession.add(app.LaunchUrl || app.Path));
                postToHost({ action: 'addSelectedMediaApps', apps: selected });
                showLoadingCards(selected.length, 'media');
                closeModal(); // Fecha instantaneamente
            } else {
                closeModal();
            }
        });

        const availableApps = allInstalledApps.filter(a => (a.AddedTo || a.addedTo) !== 'game');
        _populateExeList(availableApps);
        _modalReady = true;

        if (typeof updateGamepadUI === 'function') updateGamepadUI(isGamepadConnected, _controllerType);
    }

    window.openManualMediaAppDialog = function () {
        if (window._doorpiNativeDialogPending) return;
        window._doorpiNativeDialogPending = true;
        window.setInlineScanStatus?.(true, t('inlineScanWaitingWindows'));
        window._doorpiSuppressNativeDialogPointer?.(10 * 60 * 1000);
        window.quarantineDoorpiGamepadActions?.(300);
        postToHost({
            action: 'browseManualMedia',
            dialogTitle: t('dlgBrowseTitle'),
            dialogFilter: t('dlgBrowseFilter'),
            loadingTitle: t('loadingAddingGame'),
            loadingSub: t('loadingFetchingCovers'),
            errorMsg: t('msgErrorOpenFile')
        });
    };

    function _populateExeList(apps) {
        const appList = document.getElementById('appListMedia');
        if (!appList) return;

        if (!apps || apps.length === 0) {
            appList.innerHTML = `
            <div class="app-scan-empty">
                <div class="app-scan-pulse"></div>
                <div>
                    <strong>Procurando aplicativos executáveis</strong>
                    <span>Os resultados aparecem aqui assim que a leitura terminar.</span>
                </div>
            </div>`;
            return;
        }

        _syncModalAppList(appList, apps, {
            media: true,
            counterId: 'selectionCounterMedia',
            textId: 'selectionCounterMediaText'
        });
        if (false) {
        appList.innerHTML = apps.map(app => {
            const icon = app.IconBase64 || app.iconBase64;
            const name = app.Name || app.name;
            const path = app.Path || app.path;
            const launch = app.LaunchUrl || app.launchUrl || '';
            const source = app.Source || app.source;
            const isAdded = app.IsAdded === true || app.isAdded === true;

            return `
            <div class="app-item ${isAdded ? 'already-added' : ''}" ${isAdded ? '' : 'tabindex="0"'}
                 data-path="${path.replace(/\\/g, '\\\\')}"
                 data-launch="${launch}"
                 data-name="${name.replace(/"/g, '&quot;')}" data-icon-base64="${icon || ''}">
                ${icon ? `<img class="app-icon" src="data:image/png;base64,${icon}" />` : ''}
                <div class="app-item-info">
                    <span class="app-name">${name}</span>
                </div>
                ${getPlatformBadge(source)}
            </div>`;
        }).join('');

        appList.querySelectorAll('.app-item:not(.already-added)').forEach(item =>
            item.addEventListener('click', function () {
                this.classList.toggle('selected');
                const count = appList.querySelectorAll('.app-item.selected').length;
                const counter = document.getElementById('selectionCounterMedia');
                const text = document.getElementById('selectionCounterMediaText');
                if (text) text.innerText = count === 1 ? t('selectedOne') : t('selectedMany', count);
                counter?.classList.toggle('visible', count > 0);
            })
        );
        }
    }

    // Solicita o status de atualizações de extensões após o carregamento inicial da UI
