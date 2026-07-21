(function () {
    'use strict';

    const state = {
        open: false,
        sessionId: '',
        mode: 'file',
        path: '',
        parentPath: null,
        selectedPath: '',
        initialSelection: '',
        previousFocus: null,
        loading: false,
        entryByPath: new Map(),
        visualObserver: null,
        winRarAvailable: false,
        cutPath: '',
        cutName: '',
        contextPath: '',
        imagePath: '',
        operationBusy: false,
        activeOperation: '',
        dialogConfirm: null,
        dialogAlternate: null
    };

    const post = payload => window.chrome?.webview?.postMessage(JSON.stringify(payload));
    const executableExtensions = new Set([
        '.exe', '.msi', '.msix', '.msixbundle', '.appx', '.appxbundle',
        '.bat', '.cmd', '.com', '.lnk'
    ]);
    const viewableImageExtensions = new Set([
        '.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.svg', '.avif', '.ico'
    ]);

    function ensureOverlay() {
        let overlay = document.getElementById('doorpiFileBrowser');
        if (overlay) return overlay;

        overlay = document.createElement('div');
        overlay.id = 'doorpiFileBrowser';
        overlay.className = 'doorpi-file-browser';
        overlay.setAttribute('aria-hidden', 'true');
        overlay.innerHTML = `
            <div class="dfb-backdrop"></div>
            <section class="dfb-shell" role="dialog" aria-modal="true" aria-labelledby="dfbTitle">
                <svg class="dfb-svg-defs" aria-hidden="true">
                    <defs>
                        <symbol id="dfbDoorpiMark" viewBox="0 0 357 302">
                            <path transform="translate(-357 -366)" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" shape-rendering="geometricPrecision" fill-rule="evenodd" d="M491.466248,448.851471 C491.608276,430.705597 491.779083,413.042450 491.876709,395.378906 C491.981354,376.446472 508.188202,366.194916 525.097473,374.768524 C545.386963,385.055969 565.459961,395.770844 585.616089,406.320831 C594.313293,410.873047 602.936646,415.568481 611.678162,420.033142 C623.370544,426.004913 629.275146,435.542358 629.111328,448.569122 C628.545471,493.556702 627.830200,538.542419 627.159241,583.528687 C626.903259,600.689453 626.754395,617.853821 626.241333,635.007141 C626.110962,639.366943 627.244263,641.305237 631.672974,642.608398 C657.675049,650.259399 683.562744,658.299133 709.485840,666.218262 C710.266846,666.456848 711.013245,666.808777 713.093750,667.624756 C675.661926,667.624756 639.601135,667.624756 602.966492,667.624756 C602.966492,665.443115 602.941467,663.498840 602.970093,661.555298 C603.971924,593.576843 604.936218,525.597778 606.029602,457.620758 C606.198303,447.128326 601.579468,439.620483 592.603638,434.901001 C578.896790,427.694000 565.018494,420.808441 551.135925,413.942352 C543.803528,410.315796 539.581421,412.998871 539.488892,421.233521 C538.822205,480.550201 538.205566,539.867432 537.564026,599.184387 C537.333740,620.477661 536.995544,641.770325 536.914490,663.064087 C536.900513,666.735291 535.945618,667.921204 532.135193,667.910828 C475.811768,667.757141 419.487885,667.758850 363.164154,667.699768 C361.375824,667.697876 359.587738,667.440491 357.704132,666.710815 C365.264282,664.606689 372.823639,662.499756 380.384735,660.398987 C415.153320,650.738831 449.908630,641.030273 484.712067,631.497314 C488.290710,630.517151 489.743225,629.202698 489.761627,625.199585 C489.976105,578.551147 490.385681,531.903442 490.805603,485.256104 C490.913391,473.281097 491.237885,461.308014 491.466248,448.851471 z" />
                        </symbol>
                    </defs>
                </svg>
                <header class="dfb-header">
                    <div>
                        <div class="dfb-eyebrow">DOORPI FILES</div>
                        <h1 id="dfbTitle"></h1>
                    </div>
                </header>
                <nav class="dfb-toolbar" aria-label="Navegação">
                    <button id="dfbBack" class="dfb-tool" type="button" tabindex="0" aria-label="Voltar">
                        <span class="dfb-tool-icon">‹</span><span>Voltar</span>
                    </button>
                    <button id="dfbComputer" class="dfb-tool" type="button" tabindex="0">
                        <span class="dfb-tool-icon">⌂</span><span>Este computador</span>
                    </button>
                    <div id="dfbPath" class="dfb-path">
                        <input id="dfbPathInput" class="dfb-path-input" type="text" spellcheck="false" autocomplete="off" aria-label="Caminho da pasta" tabindex="0" />
                        <button id="dfbCopyPath" class="dfb-path-action" type="button" tabindex="0" aria-label="Copiar caminho" title="Copiar caminho">
                            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>
                        </button>
                        <button id="dfbPastePath" class="dfb-path-action" type="button" tabindex="0" aria-label="Colar caminho" title="Colar caminho">
                            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5H7a2 2 0 0 0-2 2v12h14V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg>
                        </button>
                        <button id="dfbGoPath" class="dfb-path-action go" type="button" tabindex="0" aria-label="Ir para o caminho" title="Ir para o caminho">
                            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
                        </button>
                    </div>
                </nav>
                <div class="dfb-content">
                    <div id="dfbLoading" class="dfb-loading" aria-live="polite">
                        <span class="dfb-spinner"></span><span>Carregando pasta…</span>
                    </div>
                    <div id="dfbError" class="dfb-error" role="alert"></div>
                    <div id="dfbEmpty" class="dfb-empty">Nenhum item corresponde a este filtro.</div>
                    <div id="dfbEntries" class="dfb-entries" role="listbox"></div>
                </div>
                <footer class="dfb-footer">
                    <div class="dfb-hints">
                        <span class="gp-hint-item"><span class="gp-face-btn gp-a">A</span><span>Abrir / selecionar</span></span>
                        <span class="gp-hint-item"><span class="gp-face-btn gp-b">B</span><span>Voltar</span></span>
                        <span class="gp-hint-item"><span class="gp-face-btn gp-x">X</span><span>Opções</span></span>
                        <span class="gp-hint-item"><span class="gp-face-btn gp-y">Y</span><span>Criar pasta</span></span>
                        <span class="gp-hint-item">
                            <span class="gp-face-btn gp-start">
                                <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                                    <rect x="2" y="3.5" width="12" height="2" rx="0.75" fill="currentColor" />
                                    <rect x="2" y="7.25" width="12" height="2" rx="0.75" fill="currentColor" />
                                    <rect x="2" y="11" width="12" height="2" rx="0.75" fill="currentColor" />
                                </svg>
                            </span>
                            <span id="dfbStartHint">Confirmar</span>
                        </span>
                    </div>
                    <div class="dfb-actions">
                        <div class="dfb-filter"><span>Tipo</span><strong id="dfbFilter"></strong></div>
                        <button id="dfbCancel" class="dfb-button secondary" type="button" tabindex="0" data-gamepad-hint="cancel">Cancelar</button>
                        <button id="dfbConfirm" class="dfb-button primary" type="button" tabindex="0" data-gamepad-hint="start">Selecionar</button>
                    </div>
                </footer>
                <section id="dfbContext" class="dfb-context" aria-hidden="true" aria-label="Opções do item">
                    <div class="dfb-context-card">
                        <div class="dfb-context-heading"><small>OPÇÕES</small><strong id="dfbContextName"></strong></div>
                        <div id="dfbContextActions" class="dfb-context-actions"></div>
                    </div>
                </section>
                <section id="dfbDialog" class="dfb-dialog" aria-hidden="true" aria-label="Confirmação">
                    <div class="dfb-dialog-card">
                        <small id="dfbDialogKicker">EXPLORADOR DE ARQUIVOS</small>
                        <h2 id="dfbDialogTitle"></h2>
                        <p id="dfbDialogMessage"></p>
                        <input id="dfbDialogInput" class="dfb-dialog-input" type="text" spellcheck="false" autocomplete="off" tabindex="0" />
                        <div class="dfb-dialog-actions">
                            <button id="dfbDialogCancel" class="dfb-button secondary" type="button" tabindex="0">Cancelar</button>
                            <button id="dfbDialogAlternate" class="dfb-button danger" type="button" tabindex="0" hidden>Substituir</button>
                            <button id="dfbDialogConfirm" class="dfb-button primary" type="button" tabindex="0">Confirmar</button>
                        </div>
                    </div>
                </section>
                <section id="dfbBusy" class="dfb-busy" aria-hidden="true" aria-live="assertive">
                    <div class="dfb-busy-card">
                        <span class="dfb-busy-spinner"></span>
                        <div class="dfb-busy-content">
                            <h2 id="dfbBusyTitle">Processando…</h2>
                            <p id="dfbBusyMessage">Aguarde a operação terminar.</p>
                            <div id="dfbBusyProgress" class="dfb-busy-progress" hidden>
                                <div class="dfb-busy-track"><span id="dfbBusyFill"></span></div>
                                <div class="dfb-busy-progress-row"><strong id="dfbBusyPercent">0%</strong><span id="dfbBusyBytes">Calculando tamanho…</span></div>
                                <div id="dfbBusyCurrent" class="dfb-busy-current"></div>
                            </div>
                        </div>
                    </div>
                </section>
                <section id="dfbImageViewer" class="dfb-image-viewer" aria-hidden="true" aria-label="Visualizador de imagem">
                    <button id="dfbImageBack" class="dfb-image-back" type="button" tabindex="0">
                        <span class="gp-face-btn gp-b">B</span><span class="dfb-image-back-arrow">‹</span><span>Voltar</span>
                    </button>
                    <div class="dfb-image-stage">
                        <div id="dfbImageLoading" class="dfb-image-loading"><span class="dfb-spinner"></span><span>Carregando imagem…</span></div>
                        <div id="dfbImageError" class="dfb-image-error"></div>
                        <img id="dfbImage" alt="" />
                    </div>
                    <div id="dfbImageName" class="dfb-image-name"></div>
                </section>
            </section>`;

        document.body.appendChild(overlay);
        overlay.querySelector('#dfbBack').addEventListener('click', goBack);
        overlay.querySelector('#dfbComputer').addEventListener('click', () => navigate(''));
        overlay.querySelector('#dfbCancel').addEventListener('click', cancel);
        overlay.querySelector('#dfbConfirm').addEventListener('click', confirmSelection);
        overlay.querySelector('#dfbCopyPath').addEventListener('click', copyCurrentPath);
        overlay.querySelector('#dfbPastePath').addEventListener('click', pastePath);
        overlay.querySelector('#dfbGoPath').addEventListener('click', navigatePathInput);
        overlay.querySelector('#dfbPathInput').addEventListener('keydown', event => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            event.stopPropagation();
            navigatePathInput();
        });
        overlay.querySelector('#dfbDialogCancel').addEventListener('click', closeDialog);
        overlay.querySelector('#dfbDialogAlternate').addEventListener('click', confirmAlternateDialog);
        overlay.querySelector('#dfbDialogConfirm').addEventListener('click', confirmDialog);
        overlay.querySelector('#dfbImageBack').addEventListener('click', closeImageViewer);
        return overlay;
    }

    function element(id) {
        return ensureOverlay().querySelector(`#${id}`);
    }

    function openBrowser(data) {
        const overlay = ensureOverlay();
        state.open = true;
        if (window.DoorpiQuickPanel?.isOpen?.())
            window.DoorpiQuickPanel.close();
        state.sessionId = String(data.sessionId || '');
        state.mode = data.mode === 'folder' ? 'folder' : (data.mode === 'explorer' ? 'explorer' : 'file');
        state.path = '';
        state.parentPath = null;
        state.selectedPath = '';
        state.initialSelection = String(data.initialSelection || '');
        state.winRarAvailable = data.winRarAvailable === true;
        state.cutPath = '';
        state.cutName = '';
        state.contextPath = '';
        state.imagePath = '';
        state.operationBusy = false;
        state.activeOperation = '';
        state.dialogConfirm = null;
        state.dialogAlternate = null;
        state.previousFocus = document.activeElement;
        // Os fluxos antigos armavam uma quarentena longa porque o clique acontecia
        // fora do WebView, no diálogo do Windows. O seletor agora vive dentro dele.
        window._doorpiNativeDialogSuppressUntil = 0;
        window._doorpiPointerSuppressUntil = 0;

        element('dfbTitle').textContent = data.title || (state.mode === 'folder' ? 'Selecionar pasta' : 'Selecionar arquivo');
        element('dfbFilter').textContent = state.mode === 'folder' ? 'Pastas' : (data.filterLabel || 'Arquivos');
        element('dfbCancel').textContent = state.mode === 'explorer' ? 'Fechar' : 'Cancelar';
        updateConfirmState();
        window.refreshDoorpiGamepadHints?.();
        overlay.classList.add('visible');
        overlay.setAttribute('aria-hidden', 'false');
        document.body.classList.add('doorpi-file-browser-open');
        navigate(String(data.startPath || ''));
    }

    function closeBrowser(data) {
        if (!state.open || (data?.sessionId && data.sessionId !== state.sessionId)) return;
        const overlay = ensureOverlay();
        state.open = false;
        state.loading = false;
        state.operationBusy = false;
        state.visualObserver?.disconnect();
        state.entryByPath.clear();
        closeContextMenu(false);
        closeDialog(false);
        closeImageViewer(false, false);
        hideBusyOperation();
        overlay.classList.remove('visible');
        overlay.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('doorpi-file-browser-open');
        window._doorpiNativeDialogPending = false;
        window._doorpiNativeDialogActive = false;
        window._doorpiSuppressNativeDialogPointer?.(500);
        window.quarantineDoorpiGamepadActions?.(350);
        const restore = state.previousFocus;
        state.previousFocus = null;
        setTimeout(() => {
            if (restore && restore.isConnected && typeof restore.focus === 'function') restore.focus();
        }, 0);
    }

    function navigate(path) {
        if (!state.open || state.loading || state.operationBusy) return;
        state.loading = true;
        state.selectedPath = '';
        state.visualObserver?.disconnect();
        state.entryByPath.clear();
        element('dfbLoading').classList.add('visible');
        element('dfbError').classList.remove('visible');
        element('dfbEmpty').classList.remove('visible');
        element('dfbEntries').replaceChildren();
        updateConfirmState();
        post({ action: 'doorpiFileBrowserNavigate', sessionId: state.sessionId, path: path || '' });
    }

    function renderEntries(data) {
        if (!state.open || data.sessionId !== state.sessionId) return;
        state.loading = false;
        state.path = String(data.path || '');
        state.parentPath = data.parentPath === null || data.parentPath === undefined
            ? null
            : String(data.parentPath);
        state.selectedPath = '';
        if (data.initialSelection) state.initialSelection = String(data.initialSelection);

        element('dfbLoading').classList.remove('visible');
        element('dfbError').classList.remove('visible');
        element('dfbPathInput').value = state.path || 'Este computador';
        element('dfbBack').disabled = state.parentPath === null;

        const container = element('dfbEntries');
        container.replaceChildren();
        state.entryByPath.clear();
        state.visualObserver?.disconnect();
        state.visualObserver = new IntersectionObserver(observed => {
            for (const item of observed) {
                if (!item.isIntersecting) continue;
                requestEntryVisual(item.target);
                state.visualObserver?.unobserve(item.target);
            }
        }, { root: container, rootMargin: '160px 0px' });
        const entries = Array.isArray(data.entries) ? data.entries : [];
        for (const entry of entries) container.appendChild(createEntry(entry));
        element('dfbEmpty').classList.toggle('visible', entries.length === 0);
        updateConfirmState();

        requestAnimationFrame(() => {
            requestVisibleEntryVisuals(container, !state.path);
            const initial = state.initialSelection
                ? state.entryByPath.get(state.initialSelection.toLowerCase())
                : null;
            if (initial) {
                if (initial.dataset.directory !== 'true') activateEntry(initial);
                initial.focus();
                state.initialSelection = '';
                return;
            }
            const first = container.querySelector('.dfb-entry') || element('dfbConfirm');
            first?.focus();
        });
        setTimeout(() => requestVisibleEntryVisuals(container, !state.path), 80);
    }

    function requestVisibleEntryVisuals(container, requestAll) {
        if (!state.open || !container?.isConnected) return;
        const bounds = container.getBoundingClientRect();
        container.querySelectorAll('.dfb-entry').forEach(button => {
            if (requestAll) {
                requestEntryVisual(button);
                return;
            }
            const item = button.getBoundingClientRect();
            if (item.bottom >= bounds.top - 160 && item.top <= bounds.bottom + 160) requestEntryVisual(button);
        });
    }

    function createEntry(entry) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'dfb-entry';
        button.tabIndex = 0;
        button.dataset.path = String(entry.path || '');
        button.dataset.directory = entry.isDirectory ? 'true' : 'false';
        button.dataset.drive = entry.isDrive ? 'true' : 'false';
        button.dataset.extension = String(entry.extension || '').toLowerCase();
        button.setAttribute('role', 'option');

        const visual = document.createElement('span');
        visual.className = `dfb-entry-visual ${entry.isDrive ? 'drive' : (entry.isDirectory ? 'folder' : 'file')}`;
        const fallback = document.createElement('span');
        fallback.className = 'dfb-entry-fallback';
        fallback.innerHTML = '<svg viewBox="0 0 357 302" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><use href="#dfbDoorpiMark" width="357" height="302"></use></svg>';
        const image = document.createElement('img');
        image.className = 'dfb-entry-image';
        image.alt = '';
        visual.append(fallback, image);

        const text = document.createElement('span');
        text.className = 'dfb-entry-text';
        const name = document.createElement('span');
        name.className = 'dfb-entry-name';
        name.textContent = entry.name || entry.path || '';
        const meta = document.createElement('span');
        meta.className = 'dfb-entry-meta';
        meta.textContent = entry.isDirectory
            ? (entry.isDrive ? 'Unidade' : 'Pasta')
            : [String(entry.extension || '').replace('.', '').toUpperCase(), formatBytes(entry.size)].filter(Boolean).join(' • ');
        text.append(name, meta);
        button.append(visual, text);
        button.addEventListener('click', () => activateEntry(button));
        button.addEventListener('dblclick', () => activateEntry(button, true));
        button.addEventListener('contextmenu', event => {
            event.preventDefault();
            button.focus();
            openContextMenu();
        });
        state.entryByPath.set(button.dataset.path.toLowerCase(), button);
        state.visualObserver?.observe(button);
        return button;
    }

    function requestEntryVisual(button) {
        if (!button || button.dataset.visualRequested === 'true' || button.dataset.visualLoaded === 'true') return;
        const attempt = Number(button.dataset.visualAttempts || 0) + 1;
        if (attempt > 4) return;
        button.dataset.visualAttempts = String(attempt);
        button.dataset.visualRequested = 'true';
        post({
            action: 'doorpiFileBrowserVisualRequest',
            sessionId: state.sessionId,
            path: button.dataset.path || '',
            isDirectory: button.dataset.directory === 'true'
        });
        setTimeout(() => {
            if (!state.open || !button.isConnected || button.dataset.visualLoaded === 'true') return;
            if (Number(button.dataset.visualAttempts || 0) !== attempt) return;
            button.dataset.visualRequested = 'false';
            requestEntryVisual(button);
        }, 4000);
    }

    function applyEntryVisual(data) {
        if (!state.open || data.sessionId !== state.sessionId) return;
        const button = state.entryByPath.get(String(data.path || '').toLowerCase());
        if (!button) return;
        if (!data.dataUrl) {
            button.dataset.visualRequested = 'false';
            if (Number(button.dataset.visualAttempts || 0) < 4)
                setTimeout(() => requestEntryVisual(button), 650);
            return;
        }
        const image = button.querySelector('.dfb-entry-image');
        if (!image) return;
        const visualClass = data.kind === 'preview' ? 'has-preview' : 'has-icon';
        button.classList.remove('has-preview', 'has-icon');
        button.classList.add(visualClass);
        button.dataset.visualLoaded = 'true';
        image.onload = () => { button.dataset.visualLoaded = 'true'; };
        image.onerror = () => {
            button.classList.remove('has-preview', 'has-icon');
            button.dataset.visualLoaded = 'false';
            button.dataset.visualRequested = 'false';
            if (Number(button.dataset.visualAttempts || 0) < 4)
                setTimeout(() => requestEntryVisual(button), 650);
        };
        image.src = data.dataUrl;
    }

    function isContextMenuOpen() {
        return element('dfbContext').classList.contains('visible');
    }

    function isDialogOpen() {
        return element('dfbDialog').classList.contains('visible');
    }

    function isImageViewerOpen() {
        return element('dfbImageViewer').classList.contains('visible');
    }

    function openImageViewer(path) {
        if (!state.open || state.loading || state.operationBusy || !path) return false;
        state.imagePath = path;
        const viewer = element('dfbImageViewer');
        const image = element('dfbImage');
        image.removeAttribute('src');
        image.alt = '';
        element('dfbImageName').textContent = path.split(/[\\/]/).pop() || path;
        element('dfbImageLoading').classList.add('visible');
        element('dfbImageError').classList.remove('visible');
        element('dfbImageError').textContent = '';
        viewer.classList.add('visible');
        viewer.setAttribute('aria-hidden', 'false');
        post({ action: 'doorpiFileBrowserViewImage', sessionId: state.sessionId, path });
        requestAnimationFrame(() => element('dfbImageBack').focus());
        return true;
    }

    function applyImageViewer(data) {
        if (!state.open || data.sessionId !== state.sessionId || !isImageViewerOpen()) return;
        if (String(data.path || '').toLowerCase() !== state.imagePath.toLowerCase()) return;
        const loading = element('dfbImageLoading');
        const error = element('dfbImageError');
        if (!data.success || !data.url) {
            loading.classList.remove('visible');
            error.textContent = data.message || 'Não foi possível abrir esta imagem.';
            error.classList.add('visible');
            return;
        }

        const image = element('dfbImage');
        image.alt = String(data.name || 'Imagem');
        element('dfbImageName').textContent = String(data.name || '');
        image.onload = () => {
            loading.classList.remove('visible');
            error.classList.remove('visible');
            image.classList.add('visible');
        };
        image.onerror = () => {
            loading.classList.remove('visible');
            image.classList.remove('visible');
            error.textContent = 'O WebView não conseguiu renderizar esta imagem.';
            error.classList.add('visible');
        };
        image.src = String(data.url);
    }

    function closeImageViewer(restoreFocus = true, notifyHost = true) {
        const viewer = element('dfbImageViewer');
        if (!viewer.classList.contains('visible')) return false;
        const path = state.imagePath;
        viewer.classList.remove('visible');
        viewer.setAttribute('aria-hidden', 'true');
        const image = element('dfbImage');
        image.removeAttribute('src');
        image.classList.remove('visible');
        image.onload = null;
        image.onerror = null;
        state.imagePath = '';
        if (notifyHost)
            post({ action: 'doorpiFileBrowserCloseImage', sessionId: state.sessionId });
        if (restoreFocus) requestAnimationFrame(() =>
            state.entryByPath.get(path.toLowerCase())?.focus());
        return true;
    }

    function contextEntry() {
        return state.contextPath ? state.entryByPath.get(state.contextPath.toLowerCase()) : null;
    }

    function openContextMenu() {
        if (!state.open || state.loading || state.operationBusy || isDialogOpen() || isImageViewerOpen()) return false;
        const focused = document.activeElement?.closest?.('.dfb-entry');
        if (!focused) return false;
        state.contextPath = focused.dataset.path || '';
        const name = focused.querySelector('.dfb-entry-name')?.textContent || state.contextPath;
        const extension = focused.dataset.extension || '';
        const isDirectory = focused.dataset.directory === 'true';
        const isRootItem = !state.path || focused.dataset.drive === 'true';
        const actions = [];
        const add = (label, action, className = '') => actions.push({ label, action, className });

        if (state.mode === 'explorer' && !isDirectory && viewableImageExtensions.has(extension))
            add('Visualizar imagem', 'viewImage');
        if (state.mode === 'explorer' && !isDirectory && executableExtensions.has(extension))
            add('Executar', 'open');
        add('Copiar caminho', 'copyPath');
        if (!isRootItem) {
            add('Recortar', 'cut');
            add('Renomear', 'rename');

            if (!isDirectory && extension === '.zip') {
                add('Extrair aqui', 'extractHere');
                add(`Extrair para ${name.replace(/\.zip$/i, '')}\\`, 'extractFolder');
                if (state.winRarAvailable) add('Extrair com WinRAR', 'extractWinRarFolder');
            } else if (!isDirectory && ['.rar', '.7z'].includes(extension) && state.winRarAvailable) {
                add('Extrair aqui (WinRAR)', 'extractWinRarHere');
                add(`Extrair para ${name.replace(/\.(rar|7z)$/i, '')}\\ (WinRAR)`, 'extractWinRarFolder');
            }

            if (!isDirectory && ['.exe', '.bat', '.cmd', '.com', '.lnk', '.url'].includes(extension)) {
                add('Adicionar em Jogos', 'addGame');
                add('Adicionar em Apps', 'addApp');
            }

            add('Mover para a Lixeira', 'recycle');
            add('Excluir permanentemente', 'delete', 'danger');
        }

        element('dfbContextName').textContent = name;
        const list = element('dfbContextActions');
        list.replaceChildren();
        for (const item of actions) {
            const button = document.createElement('button');
            button.type = 'button';
            button.tabIndex = 0;
            button.className = `dfb-context-action ${item.className}`.trim();
            button.textContent = item.label;
            button.addEventListener('click', () => handleContextAction(item.action));
            list.appendChild(button);
        }
        const context = element('dfbContext');
        context.classList.add('visible');
        context.setAttribute('aria-hidden', 'false');
        requestAnimationFrame(() => list.querySelector('button')?.focus());
        return true;
    }

    function closeContextMenu(restoreFocus = true) {
        const context = element('dfbContext');
        if (!context.classList.contains('visible')) return false;
        context.classList.remove('visible');
        context.setAttribute('aria-hidden', 'true');
        if (restoreFocus) requestAnimationFrame(() => contextEntry()?.focus());
        return true;
    }

    function handleContextAction(action) {
        const entry = contextEntry();
        if (!entry) { closeContextMenu(false); return; }
        const path = entry.dataset.path || '';
        const name = entry.querySelector('.dfb-entry-name')?.textContent || path;

        if (action === 'copyPath') {
            post({ action: 'doorpiFileBrowserCopyPath', sessionId: state.sessionId, path });
            closeContextMenu();
            return;
        }
        if (action === 'cut') {
            state.cutPath = path;
            state.cutName = name;
            closeContextMenu(false);
            navigate('');
            return;
        }
        if (action === 'rename') {
            closeContextMenu(false);
            openDialog({
                title: 'Renomear item',
                message: 'Digite o novo nome, incluindo a extensão quando for um arquivo.',
                inputValue: name,
                confirmLabel: 'Renomear',
                onConfirm: value => runOperation('rename', path, { newName: value })
            });
            return;
        }
        if (action === 'viewImage') {
            closeContextMenu(false);
            openImageViewer(path);
            return;
        }
        if (action === 'recycle' || action === 'delete') {
            closeContextMenu(false);
            const permanent = action === 'delete';
            openDialog({
                title: permanent ? 'Excluir permanentemente?' : 'Mover para a Lixeira?',
                message: permanent
                    ? `${name} será removido sem passar pela Lixeira. Esta ação não pode ser desfeita.`
                    : `${name} será movido para a Lixeira e poderá ser restaurado pelo Windows.`,
                confirmLabel: permanent ? 'Excluir permanentemente' : 'Mover para a Lixeira',
                danger: permanent,
                onConfirm: () => runOperation(action, path)
            });
            return;
        }
        closeContextMenu(false);
        if (action === 'extractFolder' || action === 'extractWinRarFolder') {
            runExtractionWithConflict(action, path, name);
            return;
        }
        runOperation(action, path);
    }

    function entryNamed(name) {
        const wanted = String(name || '').toLocaleLowerCase();
        return Array.from(element('dfbEntries').querySelectorAll('.dfb-entry')).find(entry =>
            String(entry.querySelector('.dfb-entry-name')?.textContent || '').toLocaleLowerCase() === wanted) || null;
    }

    function runExtractionWithConflict(operation, path, archiveName) {
        const folderName = String(archiveName || '').replace(/\.(zip|rar|7z)$/i, '');
        if (!entryNamed(folderName)) {
            runOperation(operation, path);
            return;
        }
        openDialog({
            title: 'A pasta já existe',
            message: `${folderName} já existe neste local. Manter os dois cria uma pasta numerada. Substituir exclui permanentemente a pasta existente depois que a nova extração estiver pronta.`,
            confirmLabel: 'Manter os dois',
            alternateLabel: 'Substituir permanentemente',
            onConfirm: () => runOperation(operation, path, { conflictMode: 'keepBoth' }),
            onAlternate: () => runOperation(operation, path, { conflictMode: 'replace' })
        });
    }

    function pasteCutItem() {
        if (!state.cutPath || !state.path) return;
        const existing = entryNamed(state.cutName);
        if (!existing) {
            runOperation('move', state.cutPath, { destination: state.path });
            return;
        }
        if (String(existing.dataset.path || '').toLocaleLowerCase() === state.cutPath.toLocaleLowerCase()) {
            state.cutPath = '';
            state.cutName = '';
            updateConfirmState();
            window.showDoorpiToast?.('O item já está nesta pasta.', 'Explorador de arquivos');
            return;
        }
        const cutPath = state.cutPath;
        openDialog({
            title: 'Já existe um item com esse nome',
            message: `${state.cutName} já existe na pasta de destino. Manter os dois cria um nome numerado. Substituir exclui permanentemente o item existente somente depois que o novo estiver pronto.`,
            confirmLabel: 'Manter os dois',
            alternateLabel: 'Substituir permanentemente',
            onConfirm: () => runOperation('move', cutPath, { destination: state.path, conflictMode: 'keepBoth' }),
            onAlternate: () => runOperation('move', cutPath, { destination: state.path, conflictMode: 'replace' })
        });
    }

    function clearCutState() {
        state.cutPath = '';
        state.cutName = '';
        updateConfirmState();
    }

    function createFolder() {
        if (!state.open || state.loading || state.operationBusy) return true;
        if (isDialogOpen() || isContextMenuOpen() || isImageViewerOpen()) return true;
        if (!state.path) {
            window.showDoorpiToast?.(
                'Abra uma unidade ou pasta antes de criar uma nova pasta.',
                'Explorador de arquivos');
            return true;
        }

        openDialog({
            title: 'Criar nova pasta',
            message: 'Digite o nome da pasta que será criada neste local.',
            inputValue: '',
            confirmLabel: 'Criar pasta',
            onConfirm: value => runOperation('createFolder', '', { newName: value })
        });
        return true;
    }

    function openDialog(options) {
        state.dialogConfirm = typeof options.onConfirm === 'function' ? options.onConfirm : null;
        state.dialogAlternate = typeof options.onAlternate === 'function' ? options.onAlternate : null;
        element('dfbDialogTitle').textContent = options.title || 'Confirmar operação';
        element('dfbDialogMessage').textContent = options.message || '';
        const input = element('dfbDialogInput');
        const hasInput = Object.prototype.hasOwnProperty.call(options, 'inputValue');
        input.hidden = !hasInput;
        input.value = hasInput ? String(options.inputValue || '') : '';
        const confirm = element('dfbDialogConfirm');
        confirm.textContent = options.confirmLabel || 'Confirmar';
        confirm.classList.toggle('danger', options.danger === true);
        const alternate = element('dfbDialogAlternate');
        alternate.hidden = !state.dialogAlternate;
        alternate.textContent = options.alternateLabel || 'Substituir';
        const dialog = element('dfbDialog');
        dialog.classList.add('visible');
        dialog.setAttribute('aria-hidden', 'false');
        requestAnimationFrame(() => (hasInput ? input : confirm).focus());
    }

    function closeDialog(restoreFocus = true) {
        const dialog = element('dfbDialog');
        if (!dialog.classList.contains('visible')) return false;
        dialog.classList.remove('visible');
        dialog.setAttribute('aria-hidden', 'true');
        state.dialogConfirm = null;
        state.dialogAlternate = null;
        if (restoreFocus) requestAnimationFrame(() => {
            const entry = contextEntry();
            if (entry) entry.focus();
            else element('dfbBack').focus();
        });
        return true;
    }

    function confirmDialog() {
        if (!isDialogOpen() || state.operationBusy) return;
        const callback = state.dialogConfirm;
        const input = element('dfbDialogInput');
        const value = input.hidden ? undefined : input.value;
        if (!input.hidden && !String(value || '').trim()) return;
        closeDialog(false);
        callback?.(value);
    }

    function confirmAlternateDialog() {
        if (!isDialogOpen() || state.operationBusy || !state.dialogAlternate) return;
        const callback = state.dialogAlternate;
        closeDialog(false);
        callback();
    }

    function runOperation(operation, path, extra = {}) {
        if (state.operationBusy) return;
        state.operationBusy = true;
        state.activeOperation = operation;
        updateConfirmState();
        showBusyOperation(operation);
        post({
            action: 'doorpiFileBrowserOperation',
            sessionId: state.sessionId,
            operation,
            path,
            currentPath: state.path,
            ...extra
        });
    }

    function handleOperationResult(data) {
        if (!state.open || data.sessionId !== state.sessionId) return;
        const completedOperation = String(data.operation || state.activeOperation || '');
        state.operationBusy = false;
        state.activeOperation = '';
        hideBusyOperation();
        const message = data.message || (data.success ? 'Operação concluída.' : 'Não foi possível concluir a operação.');
        window.showDoorpiToast?.(message, data.success ? 'Explorador de arquivos' : 'Erro');
        if (!data.success) {
            updateConfirmState();
            return;
        }

        if (completedOperation === 'move') clearCutState();
        const refreshOperations = new Set([
            'rename', 'move', 'recycle', 'delete', 'extractHere', 'extractFolder',
            'extractWinRarHere', 'extractWinRarFolder', 'createFolder'
        ]);
        if (refreshOperations.has(completedOperation)) {
            state.initialSelection = String(data.resultPath || '');
            state.loading = false;
            navigate(String(data.refreshPath || state.path || ''));
        } else {
            updateConfirmState();
        }
    }

    function showBusyOperation(operation) {
        const labels = {
            rename: ['Renomeando…', 'Atualizando o nome do item.'],
            move: ['Movendo…', 'Arquivos grandes ou movimentos entre unidades podem levar alguns minutos.'],
            recycle: ['Movendo para a Lixeira…', 'Aguarde o Windows concluir a operação.'],
            delete: ['Excluindo permanentemente…', 'Não feche o Doorpi durante esta operação.'],
            extractHere: ['Descompactando…', 'Extraindo os arquivos para esta pasta.'],
            extractFolder: ['Descompactando…', 'Criando a pasta e extraindo seu conteúdo.'],
            extractWinRarHere: ['Descompactando com WinRAR…', 'O WinRAR está trabalhando em segundo plano.'],
            extractWinRarFolder: ['Descompactando com WinRAR…', 'O WinRAR está trabalhando em segundo plano.'],
            createFolder: ['Criando pasta…', 'Aguarde a nova pasta ser criada.'],
            open: ['Executando…', 'Preparando mouse, teclado e controle elevado para esta tarefa.'],
            addGame: ['Adicionando em Jogos…', 'Preparando o arquivo para a biblioteca.'],
            addApp: ['Adicionando em Apps…', 'Preparando o arquivo para a biblioteca.']
        };
        const [title, message] = labels[operation] || ['Processando…', 'Aguarde a operação terminar.'];
        element('dfbBusyTitle').textContent = title;
        element('dfbBusyMessage').textContent = message;
        const progress = element('dfbBusyProgress');
        progress.hidden = operation !== 'move';
        progress.classList.add('indeterminate');
        element('dfbBusyFill').style.width = '0%';
        element('dfbBusyPercent').textContent = '0%';
        element('dfbBusyBytes').textContent = 'Calculando tamanho…';
        element('dfbBusyCurrent').textContent = '';
        const busy = element('dfbBusy');
        busy.classList.add('visible');
        busy.setAttribute('aria-hidden', 'false');
    }

    function hideBusyOperation() {
        const busy = element('dfbBusy');
        busy.classList.remove('visible');
        busy.setAttribute('aria-hidden', 'true');
    }

    function handleOperationProgress(data) {
        if (!state.open || !state.operationBusy || data.sessionId !== state.sessionId) return;
        const processed = Math.max(0, Number(data.processedBytes) || 0);
        const total = Math.max(0, Number(data.totalBytes) || 0);
        const progress = element('dfbBusyProgress');
        progress.hidden = false;
        element('dfbBusyCurrent').textContent = String(data.currentName || '');
        if (total <= 0) {
            progress.classList.add('indeterminate');
            element('dfbBusyBytes').textContent = 'Calculando tamanho…';
            return;
        }
        const percent = Math.max(0, Math.min(100, (processed / total) * 100));
        progress.classList.remove('indeterminate');
        element('dfbBusyFill').style.width = `${percent}%`;
        element('dfbBusyPercent').textContent = `${Math.round(percent)}%`;
        element('dfbBusyBytes').textContent = `${processed > 0 ? formatBytes(processed) : '0 B'} de ${formatBytes(total)}`;
    }

    function copyCurrentPath() {
        const path = state.path || '';
        if (!path) return;
        post({ action: 'doorpiFileBrowserCopyPath', sessionId: state.sessionId, path });
    }

    function pastePath() {
        post({ action: 'doorpiFileBrowserReadClipboard', sessionId: state.sessionId });
    }

    function applyClipboardPath(data) {
        if (!state.open || data.sessionId !== state.sessionId) return;
        const path = String(data.text || '').trim().replace(/^"(.*)"$/, '$1');
        if (!path) {
            window.showDoorpiToast?.('A área de transferência não contém um caminho.', 'Explorador de arquivos');
            return;
        }
        element('dfbPathInput').value = path;
        element('dfbGoPath').focus();
    }

    function navigatePathInput() {
        let path = String(element('dfbPathInput').value || '').trim().replace(/^"(.*)"$/, '$1');
        if (!path || path.toLowerCase() === 'este computador') path = '';
        navigate(path);
    }

    function formatBytes(value) {
        const size = Number(value || 0);
        if (!Number.isFinite(size) || size <= 0) return '';
        if (size < 1024) return `${size} B`;
        if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
        if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
        return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    }

    function activateEntry(button, openInExplorer = false) {
        if (!button || state.loading || state.operationBusy) return;
        const path = button.dataset.path || '';
        if (button.dataset.directory === 'true') {
            navigate(path);
            return;
        }

        if (state.mode === 'explorer' && openInExplorer &&
            viewableImageExtensions.has(button.dataset.extension || '')) {
            openImageViewer(path);
            return;
        }
        if (state.mode === 'explorer' && openInExplorer &&
            executableExtensions.has(button.dataset.extension || '')) {
            runOperation('open', path);
            return;
        }

        element('dfbEntries').querySelectorAll('.dfb-entry.selected').forEach(item => {
            item.classList.remove('selected');
            item.setAttribute('aria-selected', 'false');
        });
        state.selectedPath = path;
        button.classList.add('selected');
        button.setAttribute('aria-selected', 'true');
        updateConfirmState();
    }

    function updateConfirmState() {
        const confirm = element('dfbConfirm');
        if (state.cutPath) {
            confirm.hidden = false;
            confirm.textContent = `Colar ${state.cutName || 'item'} aqui`;
            element('dfbStartHint').textContent = 'Colar aqui';
            confirm.disabled = state.loading || state.operationBusy || !state.path;
        } else if (state.mode === 'explorer') {
            confirm.hidden = true;
            confirm.disabled = true;
            element('dfbStartHint').textContent = 'Confirmar';
        } else {
            confirm.hidden = false;
            confirm.textContent = state.mode === 'folder' ? 'Adicionar esta pasta' : 'Selecionar arquivo';
            element('dfbStartHint').textContent = state.mode === 'folder' ? 'Adicionar esta pasta' : 'Confirmar arquivo';
            confirm.disabled = state.loading || state.operationBusy || (state.mode === 'file' && !state.selectedPath);
        }
        element('dfbPath').classList.toggle('selected-file', !!state.selectedPath);
    }

    function goBack() {
        if (!state.open || state.loading || state.operationBusy) return;
        if (isImageViewerOpen()) { closeImageViewer(); return; }
        if (isDialogOpen()) { closeDialog(); return; }
        if (isContextMenuOpen()) { closeContextMenu(); return; }
        if (state.parentPath === null) {
            cancel();
            return;
        }
        navigate(state.parentPath);
    }

    function confirmSelection() {
        if (!state.open || state.loading || state.operationBusy) return;
        if (isImageViewerOpen()) return;
        if (isDialogOpen()) { confirmDialog(); return; }
        if (isContextMenuOpen()) return;
        if (state.cutPath) {
            if (!state.path) return;
            pasteCutItem();
            return;
        }
        if (state.mode === 'explorer') return;
        let path = state.mode === 'folder' ? state.path : state.selectedPath;
        if (state.mode === 'file' && !path) {
            const focused = document.activeElement;
            if (focused?.classList.contains('dfb-entry') && focused.dataset.directory !== 'true') {
                activateEntry(focused);
                path = state.selectedPath;
            }
        }
        if (!path) return;
        post({ action: 'doorpiFileBrowserConfirm', sessionId: state.sessionId, path });
    }

    function cancel() {
        if (!state.open) return;
        post({ action: 'doorpiFileBrowserCancel', sessionId: state.sessionId });
    }

    function showError(data) {
        if (!state.open || data.sessionId !== state.sessionId) return;
        state.loading = false;
        element('dfbLoading').classList.remove('visible');
        const error = element('dfbError');
        error.textContent = data.message || 'Não foi possível abrir esta pasta.';
        error.classList.add('visible');
        element('dfbBack').focus();
    }

    function moveFocus(direction) {
        if (!state.open) return false;
        if (state.operationBusy) return true;
        const overlay = ensureOverlay();
        const scope = isImageViewerOpen()
            ? element('dfbImageViewer')
            : isDialogOpen()
            ? element('dfbDialog')
            : (isContextMenuOpen() ? element('dfbContext') : overlay);
        if (scope === overlay && (direction === 'LEFT' || direction === 'RIGHT')) {
            const toolbarOrder = ['dfbBack', 'dfbComputer', 'dfbPathInput', 'dfbCopyPath', 'dfbPastePath', 'dfbGoPath']
                .map(id => element(id))
                .filter(item => item && !item.disabled && item.offsetParent !== null);
            const toolbarIndex = toolbarOrder.indexOf(document.activeElement);
            if (toolbarIndex >= 0) {
                const nextIndex = toolbarIndex + (direction === 'RIGHT' ? 1 : -1);
                if (nextIndex >= 0 && nextIndex < toolbarOrder.length) {
                    toolbarOrder[nextIndex].focus();
                    window.DoorpiUiSound?.play?.('move');
                    return true;
                }
            }
        }
        const items = Array.from(scope.querySelectorAll('button:not(:disabled), input:not(:disabled)'))
            .filter(item => item.offsetParent !== null);
        if (!items.length) return true;

        const current = items.includes(document.activeElement) ? document.activeElement : items[0];
        const rect = current.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        let best = null;
        let score = Number.POSITIVE_INFINITY;

        for (const candidate of items) {
            if (candidate === current) continue;
            const target = candidate.getBoundingClientRect();
            const tx = target.left + target.width / 2;
            const ty = target.top + target.height / 2;
            const dx = tx - cx;
            const dy = ty - cy;
            if (direction === 'LEFT' && dx >= -2) continue;
            if (direction === 'RIGHT' && dx <= 2) continue;
            if (direction === 'UP' && dy >= -2) continue;
            if (direction === 'DOWN' && dy <= 2) continue;
            const primary = direction === 'LEFT' || direction === 'RIGHT' ? Math.abs(dx) : Math.abs(dy);
            const secondary = direction === 'LEFT' || direction === 'RIGHT' ? Math.abs(dy) : Math.abs(dx);
            const candidateScore = primary + secondary * 2.2;
            if (candidateScore < score) {
                score = candidateScore;
                best = candidate;
            }
        }

        (best || current).focus();
        best?.scrollIntoView({ block: 'nearest' });
        if (best && best !== current) window.DoorpiUiSound?.play?.('move');
        return true;
    }

    function activateFocused() {
        if (!state.open) return false;
        if (state.operationBusy) return true;
        const focused = document.activeElement;
        if (focused?.classList.contains('dfb-entry')) activateEntry(focused, true);
        else if (focused?.tagName === 'INPUT') window._vkbOpen?.(focused);
        else focused?.click();
        return true;
    }

    function restoreFocus() {
        if (!state.open) return false;
        requestAnimationFrame(() => {
            const selected = state.selectedPath
                ? state.entryByPath.get(state.selectedPath.toLowerCase())
                : null;
            const current = document.activeElement?.closest?.('.dfb-entry');
            (selected || current || element('dfbEntries').querySelector('.dfb-entry') || element('dfbBack'))?.focus();
        });
        return true;
    }

    window.isDoorpiFileBrowserOpen = () => state.open;
    window.DoorpiFileBrowser = {
        moveFocus,
        activate: activateFocused,
        back: goBack,
        confirm: confirmSelection,
        context: openContextMenu,
        createFolder,
        restoreFocus,
        cancel
    };

    if (window.chrome?.webview) {
        window.chrome.webview.addEventListener('message', event => {
            let data = event.data;
            if (typeof data === 'string') {
                try { data = JSON.parse(data); } catch { return; }
            }
            if (!data?.type) return;
            if (data.type === 'doorpiFileBrowserOpen') openBrowser(data);
            else if (data.type === 'doorpiFileBrowserEntries') renderEntries(data);
            else if (data.type === 'doorpiFileBrowserError') showError(data);
            else if (data.type === 'doorpiFileBrowserVisual') applyEntryVisual(data);
            else if (data.type === 'doorpiFileBrowserImage') applyImageViewer(data);
            else if (data.type === 'doorpiFileBrowserOperationResult') handleOperationResult(data);
            else if (data.type === 'doorpiFileBrowserProgress') handleOperationProgress(data);
            else if (data.type === 'doorpiFileBrowserClipboard') applyClipboardPath(data);
            else if (data.type === 'doorpiFileBrowserClose') closeBrowser(data);
        });
    }
})();
