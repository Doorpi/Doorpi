// Emulator setup, ROM preview and configured-emulator library.
(() => {
    'use strict';

    const state = {
        mode: 'list',
        emulators: [],
        catalog: [],
        draft: null,
        games: [],
        requestId: '',
        scanTimer: 0,
        scanRunning: false,
        scanComplete: false,
        setupStep: 1,
        returnFocusSelector: '#emulatorAddButton'
    };

    const content = () => document.getElementById('emulatorViewContent');
    const actions = () => document.getElementById('emulatorActions');
    const isViewActive = () => document.getElementById('view-emulators')?.classList.contains('active');
    const text = (key, fallback, ...args) => {
        const translated = typeof window.t === 'function' ? window.t(key, ...args) : '';
        return translated && translated !== key ? translated : fallback;
    };
    const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    })[char]);
    const prop = (object, camel, pascal) => object?.[camel] ?? object?.[pascal] ?? '';
    const postToHost = payload => window.chrome?.webview?.postMessage(JSON.stringify(payload));

    function focusSoon(target, scroll = false) {
        requestAnimationFrame(() => requestAnimationFrame(() => {
            const element = typeof target === 'string' ? document.querySelector(target) : target;
            if (!element || element.disabled || element.offsetWidth <= 0 || element.offsetHeight <= 0) return;
            element.focus({ preventScroll: !scroll });
            if (scroll) element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }));
    }

    function normalizeEmulator(raw) {
        return {
            id: prop(raw, 'id', 'Id'),
            catalogId: prop(raw, 'catalogId', 'CatalogId') || 'custom',
            name: prop(raw, 'name', 'Name'),
            detectedName: prop(raw, 'detectedName', 'DetectedName') || prop(raw, 'name', 'Name'),
            executablePath: prop(raw, 'executablePath', 'ExecutablePath'),
            launchTemplate: prop(raw, 'launchTemplate', 'LaunchTemplate'),
            romFolders: prop(raw, 'romFolders', 'RomFolders') || [],
            extensions: prop(raw, 'extensions', 'Extensions') || [],
            gridImage: prop(raw, 'gridImage', 'GridImage'),
            gridSourceUrl: prop(raw, 'gridSourceUrl', 'GridSourceUrl')
        };
    }

    function normalizeGame(raw) {
        return {
            id: prop(raw, 'id', 'Id'),
            name: prop(raw, 'name', 'Name'),
            romPath: prop(raw, 'romPath', 'RomPath'),
            launchValue: prop(raw, 'launchValue', 'LaunchValue'),
            discPaths: prop(raw, 'discPaths', 'DiscPaths') || [],
            titleId: prop(raw, 'titleId', 'TitleId'),
            gridUrl: prop(raw, 'gridUrl', 'GridUrl'),
            horizontalUrl: prop(raw, 'horizontalUrl', 'HorizontalUrl'),
            heroUrl: prop(raw, 'heroUrl', 'HeroUrl'),
            logoUrl: prop(raw, 'logoUrl', 'LogoUrl'),
            artworkResolved: false
        };
    }

    function blankDraft(source = null) {
        const emulator = source ? normalizeEmulator(source) : null;
        return {
            id: emulator?.id || '',
            catalogId: emulator?.catalogId || 'custom',
            executablePath: emulator?.executablePath || '',
            name: emulator?.name || '',
            launchTemplate: emulator?.launchTemplate || '',
            extensions: emulator?.extensions?.join?.(', ') || '',
            romFolders: emulator?.romFolders?.length ? [...emulator.romFolders] : [''],
            gridImage: emulator?.gridImage || '',
            gridSourceUrl: emulator?.gridSourceUrl || ''
        };
    }

    function catalogForPath(path) {
        const filename = String(path || '').split(/[\\/]/).pop().toLowerCase();
        return state.catalog.find(entry => {
            const names = entry.executableNames || entry.ExecutableNames || [];
            return names.some(name => String(name).toLowerCase() === filename);
        }) || null;
    }

    function catalogForDraft() {
        return state.catalog.find(entry => String(entry.id || entry.Id).toLowerCase() === String(state.draft?.catalogId || '').toLowerCase()) || null;
    }

    function supportsInternalLibrary() {
        const entry = catalogForDraft();
        return entry?.supportsInternalLibrary === true || entry?.SupportsInternalLibrary === true;
    }

    function emulatorArtworkQuery() {
        return state.draft?.catalogId === 'eden' ? 'Eden emulator' : state.draft?.name || '';
    }

    function applyDetectedEmulator(entry) {
        if (!entry || !state.draft) return;
        state.draft.catalogId = entry.id || entry.Id;
        state.draft.name = entry.name || entry.Name;
        state.draft.launchTemplate = entry.launchTemplate || entry.LaunchTemplate;
        state.draft.extensions = (entry.extensions || entry.Extensions || []).join(', ');
    }

    function noArtworkMarkup(name, extraClass = '') {
        return `<div class="emulator-art-placeholder no-result ${extraClass}"><span class="emulator-art-fallback-name" title="${esc(name)}">${esc(name)}</span></div>`;
    }

    function renderList() {
        state.mode = 'list';
        const root = content();
        const bar = actions();
        if (!root || !bar) return;
        root.classList.remove('wizard-active');
        root.innerHTML = `
            <div class="emulator-library-grid">
                <button class="emulator-add-card emulator-nav" id="emulatorAddButton" type="button" tabindex="0">
                    <span class="emulator-add-card-plus">+</span>
                    <strong>${text('emulatorAdd', 'Adicionar emulador')}</strong>
                    <small>${text('emulatorAddHint', 'Configure o programa e encontre suas ROMs')}</small>
                </button>
                ${state.emulators.map(raw => {
                    const emulator = normalizeEmulator(raw);
                    const artwork = emulator.gridImage
                        ? `<img src="${esc(emulator.gridImage)}" alt="" loading="lazy" decoding="async" />`
                        : noArtworkMarkup(emulator.name, 'emulator-card-fallback');
                    return `<article class="emulator-library-card" data-emulator-id="${esc(emulator.id)}">
                        <button class="emulator-card-launch emulator-nav" type="button" tabindex="0" aria-label="${esc(text('emulatorOpen', 'Abrir emulador'))}: ${esc(emulator.name)}">
                            <span class="emulator-card-art">${artwork}</span>
                            <span class="emulator-card-copy"><strong title="${esc(emulator.name)}">${esc(emulator.name)}</strong><small title="${esc(emulator.executablePath)}">${esc(emulator.executablePath)}</small></span>
                        </button>
                        <button class="emulator-card-menu emulator-nav" type="button" tabindex="0" aria-label="${esc(text('emulatorOptions', 'Opções'))}">•••</button>
                    </article>`;
                }).join('')}
            </div>`;
        bar.innerHTML = `<div class="action-buttons"><button class="modal-btn cancel emulator-nav" id="emulatorCloseButton" type="button" tabindex="0" data-gamepad-hint="cancel">${text('btnBackLabel', 'Voltar')}</button></div>`;

        root.querySelector('#emulatorAddButton')?.addEventListener('click', () => openSetup());
        root.querySelectorAll('.emulator-library-card').forEach(card => {
            const emulatorId = card.dataset.emulatorId;
            card.querySelector('.emulator-card-launch')?.addEventListener('click', () => postToHost({ action: 'openConfiguredEmulator', emulatorId }));
            card.querySelector('.emulator-card-menu')?.addEventListener('click', event => openContextMenu(card, event.currentTarget));
            card.addEventListener('contextmenu', event => {
                event.preventDefault();
                openContextMenu(card, card.querySelector('.emulator-card-menu'));
            });
            card.querySelector('img')?.addEventListener('error', event => {
                event.currentTarget.replaceWith(document.createRange().createContextualFragment(noArtworkMarkup(normalizeEmulator(state.emulators.find(item => prop(item, 'id', 'Id') === emulatorId)).name, 'emulator-card-fallback')));
            }, { once: true });
        });
        bar.querySelector('#emulatorCloseButton')?.addEventListener('click', () => window.closeModal?.());
        const rememberListFocus = event => {
            if (event.target.id === 'emulatorAddButton') state.returnFocusSelector = '#emulatorAddButton';
            else if (event.target.id === 'emulatorCloseButton') state.returnFocusSelector = '#emulatorCloseButton';
            else {
                const card = event.target.closest?.('.emulator-library-card');
                if (!card) return;
                const buttonClass = event.target.classList.contains('emulator-card-menu') ? '.emulator-card-menu' : '.emulator-card-launch';
                state.returnFocusSelector = `.emulator-library-card[data-emulator-id="${CSS.escape(card.dataset.emulatorId)}"] ${buttonClass}`;
            }
        };
        root.onfocusin = rememberListFocus;
        bar.onfocusin = rememberListFocus;
        const rememberedFocus = state.returnFocusSelector ? document.querySelector(state.returnFocusSelector) : null;
        focusSoon(rememberedFocus || root.querySelector('#emulatorAddButton') || bar.querySelector('#emulatorCloseButton'));
        window.refreshDoorpiGamepadHints?.();
    }

    function openContextMenu(card, returnFocus) {
        window.closeEmulatorContextMenu?.(false);
        const emulator = state.emulators.find(item => prop(item, 'id', 'Id') === card.dataset.emulatorId);
        if (!emulator) return;
        const menu = document.createElement('div');
        menu.className = 'emulator-context-popover';
        menu.setAttribute('role', 'menu');
        menu.innerHTML = `
            <button class="emulator-context-action emulator-nav" data-action="edit" type="button" tabindex="0">${text('btnEditLabel', 'Editar')}</button>
            <button class="emulator-context-action danger emulator-nav" data-action="delete" type="button" tabindex="0">${text('btnDeleteLabel', 'Excluir')}</button>`;
        card.appendChild(menu);
        const close = (restoreFocus = true) => {
            menu.remove();
            if (restoreFocus) focusSoon(returnFocus);
        };
        menu.querySelector('[data-action="edit"]')?.addEventListener('click', () => {
            close(false);
            openSetup(emulator, `.emulator-library-card[data-emulator-id="${CSS.escape(prop(emulator, 'id', 'Id'))}"] .emulator-card-launch`);
        });
        menu.querySelector('[data-action="delete"]')?.addEventListener('click', () => { menu.remove(); confirmDeleteEmulator(emulator, returnFocus); });
        menu.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
        window.setTimeout(() => document.addEventListener('pointerdown', event => {
            if (!menu.contains(event.target)) close();
        }, { once: true }), 0);
        focusSoon(menu.querySelector('button'));
    }

    window.openFocusedEmulatorContextMenu = function () {
        if (!isViewActive() || state.mode !== 'list') return false;
        const focused = document.activeElement;
        const card = focused?.closest?.('.emulator-library-card');
        if (!card) return false;
        openContextMenu(card, card.querySelector('.emulator-card-menu') || focused);
        return true;
    };

    window.closeEmulatorContextMenu = function (restoreFocus = true) {
        const menu = document.querySelector('.emulator-context-popover');
        if (!menu) return false;
        const returnFocus = menu.closest('.emulator-library-card')?.querySelector('.emulator-card-menu');
        menu.remove();
        if (restoreFocus) focusSoon(returnFocus);
        return true;
    };

    window.handleEmulatorBack = function () {
        if (!isViewActive()) return false;
        const overlay = document.querySelector('#view-emulators .emulator-editor-overlay');
        if (overlay) {
            const cancel = overlay.querySelector('#emulatorCancelEdit, #emulatorDeleteCancel');
            if (cancel) cancel.click();
            else overlay.remove();
            return true;
        }
        if (window.closeEmulatorContextMenu?.()) return true;
        if (state.mode !== 'setup') return false;
        if (state.draft?.id || state.setupStep <= 1) cancelSetup();
        else goToSetupStep(state.setupStep - 1);
        return true;
    };

    function confirmDeleteEmulator(raw, returnFocus) {
        const emulator = normalizeEmulator(raw);
        const overlay = document.createElement('div');
        overlay.className = 'emulator-editor-overlay';
        overlay.innerHTML = `<div class="emulator-editor emulator-delete-dialog" role="dialog" aria-modal="true">
            <h3>${text('emulatorDeleteTitle', 'Excluir emulador?')}</h3>
            <p>${text('emulatorDeleteWarning', `Todos os jogos de ${emulator.name} serão removidos da biblioteca do Doorpi. Os arquivos das ROMs não serão apagados.`)}</p>
            <div class="emulator-editor-actions">
                <button class="modal-btn danger emulator-nav" id="emulatorDeleteConfirm" type="button" tabindex="0">${text('btnDeleteLabel', 'Excluir')}</button>
                <button class="modal-btn cancel emulator-nav" id="emulatorDeleteCancel" type="button" tabindex="0">${text('btnCancelLabel', 'Cancelar')}</button>
            </div>
        </div>`;
        document.getElementById('view-emulators')?.appendChild(overlay);
        const close = () => { overlay.remove(); focusSoon(returnFocus); };
        overlay.querySelector('#emulatorDeleteCancel')?.addEventListener('click', close);
        overlay.querySelector('#emulatorDeleteConfirm')?.addEventListener('click', () => {
            overlay.querySelector('#emulatorDeleteConfirm').disabled = true;
            postToHost({ action: 'deleteConfiguredEmulator', emulatorId: emulator.id });
        });
        focusSoon(overlay.querySelector('#emulatorDeleteCancel'));
    }

    function openSetup(source = null, returnFocusSelector = '#emulatorAddButton') {
        state.mode = 'setup';
        state.setupStep = 1;
        state.returnFocusSelector = returnFocusSelector;
        state.draft = blankDraft(source);
        state.games = [];
        state.scanComplete = false;
        state.scanRunning = false;
        renderSetup();
    }

    function syncDraftFromInputs() {
        if (!state.draft) return;
        const executable = document.getElementById('emulatorExecutablePath');
        const name = document.getElementById('emulatorName');
        const launchTemplate = document.getElementById('emulatorLaunchTemplate');
        const extensions = document.getElementById('emulatorExtensions');
        const romInputs = Array.from(document.querySelectorAll('.emulator-rom-input'));
        if (executable) state.draft.executablePath = executable.value.trim();
        if (name) state.draft.name = name.value.trim();
        if (launchTemplate) state.draft.launchTemplate = launchTemplate.value.trim();
        if (extensions) state.draft.extensions = extensions.value.trim();
        if (romInputs.length) state.draft.romFolders = romInputs.map(input => input.value.trim());
    }

    const parseExtensions = () => (state.draft?.extensions || '').split(/[;,\s]+/).map(value => value.trim()).filter(Boolean);
    const requiredFieldsReady = () => !!state.draft?.executablePath && !!state.draft?.name && !!state.draft?.launchTemplate &&
        (supportsInternalLibrary() || state.draft.romFolders.some(Boolean)) &&
        (state.draft.launchTemplate.includes('{rom}') || state.draft.launchTemplate.includes('{titleId}'));
    const identityFieldsReady = () => !!state.draft?.executablePath && !!state.draft?.name && !!state.draft?.launchTemplate &&
        (state.draft.launchTemplate.includes('{rom}') || state.draft.launchTemplate.includes('{titleId}'));

    function invalidateAndScheduleScan(delay = 420) {
        syncDraftFromInputs();
        state.requestId = '';
        state.scanComplete = false;
        state.games = [];
        window.clearTimeout(state.scanTimer);
        renderPreviewGrid();
        updateSetupState();
        if (!requiredFieldsReady() || state.setupStep !== 3) return;
        state.scanTimer = window.setTimeout(startLibraryScan, delay);
    }

    function renderFolderRows() {
        const host = document.getElementById('emulatorRomFolders');
        if (!host || !state.draft) return;
        host.innerHTML = state.draft.romFolders.map((folder, index) => `<div class="emulator-path-row" data-folder-index="${index}">
            <input class="setup-input emulator-rom-input emulator-nav" type="text" value="${esc(folder)}" tabindex="0" autocomplete="off" spellcheck="false" />
            <button class="setup-icon-btn emulator-folder-browse emulator-nav" type="button" tabindex="0" data-folder-index="${index}">${text('emulatorBrowse', 'Procurar')}</button>
            ${state.draft.romFolders.length > 1 ? `<button class="emulator-remove-folder emulator-nav" type="button" tabindex="0" data-folder-index="${index}" aria-label="${text('emulatorRemoveFolder', 'Remover pasta')}">×</button>` : ''}
        </div>`).join('');
        host.querySelectorAll('.emulator-rom-input').forEach(input => input.addEventListener('input', () => invalidateAndScheduleScan()));
        host.querySelectorAll('.emulator-folder-browse').forEach(button => button.addEventListener('click', () => postToHost({
            action: 'browseEmulatorRomFolder', slotId: button.dataset.folderIndex,
            dialogTitle: text('emulatorRomFolderDialog', 'Selecione a pasta das ROMs')
        })));
        host.querySelectorAll('.emulator-remove-folder').forEach(button => button.addEventListener('click', () => {
            syncDraftFromInputs();
            state.draft.romFolders.splice(Number(button.dataset.folderIndex), 1);
            renderFolderRows();
            invalidateAndScheduleScan();
        }));
    }

    function cancelSetup() {
        window.clearTimeout(state.scanTimer);
        state.requestId = '';
        state.scanRunning = false;
        renderList();
    }

    function goToSetupStep(step) {
        syncDraftFromInputs();
        const nextStep = Math.max(1, Math.min(3, Number(step) || 1));
        if (nextStep > 1 && !identityFieldsReady()) return;
        if (nextStep > 2 && !requiredFieldsReady()) return;
        state.setupStep = nextStep;
        renderSetup();
        if (nextStep === 3 && !state.scanRunning && !state.scanComplete) startLibraryScan();
    }

    function renderSetup(focusSelector = '') {
        const root = content();
        const bar = actions();
        if (!root || !bar || !state.draft) return;
        const custom = state.draft.catalogId === 'custom';
        const editing = !!state.draft.id;
        root.classList.add('wizard-active');
        root.onfocusin = null;
        bar.onfocusin = null;
        root.innerHTML = `<div class="emulator-setup emulator-wizard wizard-step-${state.setupStep}">
            <div class="emulator-wizard-progress">
                <div class="emulator-wizard-progress-item ${state.setupStep === 1 ? 'active' : state.setupStep > 1 ? 'complete' : ''}"><span>1</span><strong>${text('emulatorWizardIdentity', 'Emulador')}</strong></div>
                <div class="emulator-wizard-progress-item ${state.setupStep === 2 ? 'active' : state.setupStep > 2 ? 'complete' : ''}"><span>2</span><strong>${text('emulatorWizardFolders', 'Jogos')}</strong></div>
                <div class="emulator-wizard-progress-item ${state.setupStep === 3 ? 'active' : ''}"><span>3</span><strong>${text('emulatorWizardReview', 'Biblioteca')}</strong></div>
            </div>
            <div class="emulator-wizard-body">
            <section class="emulator-setup-section emulator-wizard-identity">
                <div class="emulator-step-label">01</div>
                <div class="emulator-setup-copy"><h3>${text('emulatorExecutableTitle', 'Caminho do emulador')}</h3><p>${text('emulatorExecutableHint', 'Selecione o executável. Emuladores conhecidos serão configurados automaticamente.')}</p></div>
                <div class="emulator-path-row emulator-full-row">
                    <input class="setup-input emulator-nav" id="emulatorExecutablePath" type="text" value="${esc(state.draft.executablePath)}" tabindex="0" autocomplete="off" spellcheck="false" />
                    <button class="setup-icon-btn emulator-nav" id="emulatorExecutableBrowse" type="button" tabindex="0">${text('emulatorBrowse', 'Procurar')}</button>
                </div>
            </section>
            <section class="emulator-setup-section emulator-details-section emulator-wizard-identity ${state.draft.executablePath ? 'visible' : ''}">
                <div class="emulator-step-label">02</div>
                <div class="emulator-setup-copy"><h3>${text('emulatorDetailsTitle', 'Identificação e execução')}</h3><p id="emulatorDetectionStatus">${custom ? text('emulatorCustomDetected', 'Emulador não identificado. Preencha os dados abaixo.') : text('emulatorKnownDetected', 'Emulador reconhecido e configurado automaticamente.')}</p></div>
                <div class="emulator-fields-grid">
                    <label><span>${text('emulatorNameLabel', 'Nome')}</span><input class="setup-input emulator-nav" id="emulatorName" type="text" value="${esc(state.draft.name)}" tabindex="0" autocomplete="off" /></label>
                    <label class="emulator-command-field"><span>${text('emulatorExecutionLabel', 'Execução')}</span><input class="setup-input emulator-nav" id="emulatorLaunchTemplate" type="text" value="${esc(state.draft.launchTemplate)}" tabindex="0" autocomplete="off" spellcheck="false" /></label>
                    <label class="emulator-extensions-field"><span>${text('emulatorExtensionsLabel', 'Extensões das ROMs')}</span><input class="setup-input emulator-nav" id="emulatorExtensions" type="text" value="${esc(state.draft.extensions)}" tabindex="0" autocomplete="off" spellcheck="false" /></label>
                    ${editing ? `<div class="emulator-config-artwork">
                        <div class="emulator-editor-preview" id="emulatorConfigArtworkPreview">${state.draft.gridImage ? `<img src="${esc(state.draft.gridImage)}" alt="" />` : noArtworkMarkup(state.draft.name)}</div>
                        <div class="emulator-config-artwork-copy">
                            <strong>${text('emulatorArtworkLabel', 'Arte do emulador')}</strong>
                            <span>${text('emulatorArtworkHint', 'Escolha o grid vertical exibido na lista de emuladores.')}</span>
                            <button class="modal-btn secondary emulator-nav" id="emulatorChangeArtwork" type="button" tabindex="0">${text('emulatorChangeArtwork', 'Alterar arte no SteamGrid')}</button>
                        </div>
                    </div>` : ''}
                </div>
            </section>
            <section class="emulator-setup-section emulator-details-section emulator-wizard-folders ${state.draft.executablePath ? 'visible' : ''}">
                <div class="emulator-step-label">03</div>
                <div class="emulator-setup-copy"><h3>${text('emulatorRomsTitle', 'Pastas das ROMs')}</h3><p>${supportsInternalLibrary() ? text('emulatorRomsOptionalHint', 'Opcional. O Doorpi também verifica automaticamente a biblioteca interna deste emulador.') : text('emulatorRomsHint', 'O Doorpi verificará estas pastas sempre que atualizar a biblioteca.')}</p></div>
                <div id="emulatorRomFolders"></div>
                <button class="emulator-add-folder emulator-nav" id="emulatorAddFolder" type="button" tabindex="0">+ ${text('emulatorAddFolder', 'Adicionar outra pasta')}</button>
            </section>
            <section class="emulator-library-section emulator-wizard-library">
                <div class="emulator-library-heading"><div><h3 id="emulatorLibraryTitle">${text('emulatorGamesFound', 'Jogos encontrados')} (0)</h3><p id="emulatorLibraryStatus">${text('emulatorLibraryWaiting', 'Preencha os campos para carregar a biblioteca.')}</p></div><div class="emulator-scan-spinner" id="emulatorScanSpinner"></div></div>
                <div class="emulator-preview-grid" id="emulatorPreviewGrid"></div>
            </section></div>
        </div>`;
        if (state.setupStep === 1) bar.innerHTML = `<div class="action-buttons"><button class="modal-btn primary emulator-nav" id="emulatorWizardNext" type="button" tabindex="0" data-gamepad-hint="start">${text('btnNextLabel', 'Avançar')}</button><button class="modal-btn cancel emulator-nav" id="emulatorSetupCancel" type="button" tabindex="0" data-gamepad-hint="cancel">${text('btnCancelLabel', 'Cancelar')}</button></div>`;
        else if (state.setupStep === 2) bar.innerHTML = `<div class="action-buttons"><button class="modal-btn primary emulator-nav" id="emulatorWizardReview" type="button" tabindex="0" data-gamepad-hint="start">${text('emulatorLoadLibrary', 'Carregar biblioteca')}</button><button class="modal-btn cancel emulator-nav" id="emulatorWizardBack" type="button" tabindex="0" data-gamepad-hint="cancel">${text('btnBackLabel', 'Voltar')}</button></div>`;
        else bar.innerHTML = `<div class="action-buttons"><button class="modal-btn primary emulator-nav" id="emulatorSetupConfirm" type="button" tabindex="0" data-gamepad-hint="start" disabled>${editing ? text('emulatorConfirmEdit', 'Salvar alterações') : text('emulatorConfirmAdd', 'Adicionar emulador')}</button><button class="modal-btn cancel emulator-nav" id="emulatorWizardBack" type="button" tabindex="0" data-gamepad-hint="cancel">${text('btnBackLabel', 'Voltar')}</button></div>`;
        renderFolderRows();
        renderPreviewGrid();
        if (state.setupStep === 3 && state.scanComplete) {
            const status = document.getElementById('emulatorLibraryStatus');
            if (status) status.textContent = state.games.length
                ? text('emulatorLibraryReady', 'Biblioteca pronta para adicionar.')
                : text('emulatorNoGamesFound', 'Nenhum jogo compatível foi encontrado.');
        }
        document.getElementById('emulatorExecutableBrowse')?.addEventListener('click', () => postToHost({ action: 'browseEmulatorExecutable', dialogTitle: text('emulatorExecutableDialog', 'Selecione o executável do emulador') }));
        document.getElementById('emulatorExecutablePath')?.addEventListener('input', event => {
            state.draft.executablePath = event.target.value.trim();
            const detected = catalogForPath(state.draft.executablePath);
            if (detected) applyDetectedEmulator(detected); else state.draft.catalogId = 'custom';
            if (detected) {
                document.getElementById('emulatorName').value = state.draft.name;
                document.getElementById('emulatorLaunchTemplate').value = state.draft.launchTemplate;
                document.getElementById('emulatorExtensions').value = state.draft.extensions;
            }
            document.querySelectorAll('.emulator-details-section').forEach(section => section.classList.toggle('visible', !!state.draft.executablePath));
            const detection = document.getElementById('emulatorDetectionStatus');
            if (detection) detection.textContent = detected ? text('emulatorKnownDetected', 'Emulador reconhecido e configurado automaticamente.') : text('emulatorCustomDetected', 'Emulador não identificado. Preencha os dados abaixo.');
            invalidateAndScheduleScan();
        });
        ['emulatorName', 'emulatorLaunchTemplate', 'emulatorExtensions'].forEach(id => document.getElementById(id)?.addEventListener('input', () => invalidateAndScheduleScan()));
        document.getElementById('emulatorChangeArtwork')?.addEventListener('click', event => {
            syncDraftFromInputs();
            const button = event.currentTarget;
            const bridge = document.createElement('div');
            bridge.dataset.gameId = state.draft.id;
            window.openDoorpiArtworkWizard?.(bridge, 'steamgrid', emulatorArtworkQuery(), {
                clientOnly: true,
                gameName: emulatorArtworkQuery(),
                categories: ['vertical'],
                returnFocus: button,
                onApplied: images => {
                    if (!images.vertical) return;
                    state.draft.gridImage = images.vertical;
                    state.draft.gridSourceUrl = images.vertical;
                    const preview = document.getElementById('emulatorConfigArtworkPreview');
                    if (preview) preview.innerHTML = `<img src="${esc(images.vertical)}" alt="" />`;
                }
            });
        });
        document.getElementById('emulatorAddFolder')?.addEventListener('click', () => {
            syncDraftFromInputs(); state.draft.romFolders.push(''); renderFolderRows();
            focusSoon(document.querySelector('.emulator-path-row:last-child input'), true);
        });
        document.getElementById('emulatorWizardNext')?.addEventListener('click', () => goToSetupStep(2));
        document.getElementById('emulatorWizardReview')?.addEventListener('click', () => goToSetupStep(3));
        document.getElementById('emulatorWizardBack')?.addEventListener('click', () => goToSetupStep(state.setupStep - 1));
        document.getElementById('emulatorSetupCancel')?.addEventListener('click', cancelSetup);
        document.getElementById('emulatorSetupConfirm')?.addEventListener('click', saveConfiguration);
        updateSetupState();
        const defaultFocus = state.setupStep === 1
            ? '#emulatorExecutablePath'
            : state.setupStep === 2
                ? '.emulator-rom-input, #emulatorWizardReview'
                : '#emulatorSetupConfirm:not(:disabled), #emulatorWizardBack';
        focusSoon(focusSelector || defaultFocus, true);
        window.refreshDoorpiGamepadHints?.();
    }

    window.advanceEmulatorSetup = function () {
        if (!isViewActive() || state.mode !== 'setup') return false;
        const button = state.setupStep === 1
            ? document.getElementById('emulatorWizardNext')
            : state.setupStep === 2
                ? document.getElementById('emulatorWizardReview')
                : document.getElementById('emulatorSetupConfirm');
        if (button && !button.disabled) button.click();
        return true;
    };

    function updateSetupState() {
        const next = document.getElementById('emulatorWizardNext');
        if (next) next.disabled = !identityFieldsReady();
        const review = document.getElementById('emulatorWizardReview');
        if (review) review.disabled = !requiredFieldsReady();
        const button = document.getElementById('emulatorSetupConfirm');
        if (button) button.disabled = !requiredFieldsReady() || !state.scanComplete || state.scanRunning;
        document.getElementById('emulatorScanSpinner')?.classList.toggle('visible', state.scanRunning);
        const title = document.getElementById('emulatorLibraryTitle');
        if (title) title.textContent = `${text('emulatorGamesFound', 'Jogos encontrados')} (${state.games.length})`;
    }

    function startLibraryScan() {
        syncDraftFromInputs();
        if (!requiredFieldsReady()) return;
        state.requestId = `emu_${Date.now()}_${Math.random().toString(16).slice(2)}`;
        state.scanRunning = true;
        state.scanComplete = false;
        state.games = [];
        const status = document.getElementById('emulatorLibraryStatus');
        if (status) status.textContent = text('emulatorLibraryLoading', 'Lendo os metadados da biblioteca...');
        renderPreviewGrid();
        updateSetupState();
        postToHost({ action: 'previewEmulatorLibrary', requestId: state.requestId, executablePath: state.draft.executablePath, catalogId: state.draft.catalogId, romFolders: state.draft.romFolders.filter(Boolean), extensions: parseExtensions() });
    }

    function renderPreviewGrid() {
        const grid = document.getElementById('emulatorPreviewGrid');
        if (!grid) return;
        grid.innerHTML = state.games.map(game => `<article class="emulator-game-preview" data-game-id="${esc(game.id)}">
            <div class="emulator-game-art ${game.gridUrl ? 'loaded' : ''}">${game.gridUrl ? `<img src="${esc(game.gridUrl)}" alt="" />` : (game.artworkResolved ? noArtworkMarkup(game.name) : '<div class="emulator-art-placeholder"></div>')}</div>
            <div class="emulator-game-info"><strong title="${esc(game.name)}">${esc(game.name)}</strong><span title="${esc(game.romPath)}">${esc(game.romPath)}</span></div>
            <button class="emulator-edit-game emulator-nav" type="button" tabindex="0" data-game-id="${esc(game.id)}">${text('btnEditLabel', 'Editar')}</button>
        </article>`).join('');
        grid.querySelectorAll('.emulator-edit-game').forEach(button => button.addEventListener('click', () => openGameEditor(button.dataset.gameId)));
        grid.querySelectorAll('.emulator-game-preview img').forEach(image => image.addEventListener('error', () => updatePreviewArtwork(image.closest('[data-game-id]')?.dataset.gameId, ''), { once: true }));
    }

    function updatePreviewArtwork(gameId, gridUrl) {
        const game = state.games.find(item => item.id === gameId);
        if (!game) return;
        game.gridUrl = gridUrl || '';
        game.artworkResolved = true;
        const card = document.querySelector(`.emulator-game-preview[data-game-id="${CSS.escape(gameId)}"]`);
        const art = card?.querySelector('.emulator-game-art');
        if (!art) return;
        art.classList.toggle('loaded', !!game.gridUrl);
        art.innerHTML = game.gridUrl ? `<img src="${esc(game.gridUrl)}" alt="" />` : noArtworkMarkup(game.name);
    }

    function openGameEditor(gameId) {
        const game = state.games.find(item => item.id === gameId);
        if (!game) return;
        const overlay = document.createElement('div');
        overlay.className = 'emulator-editor-overlay';
        overlay.innerHTML = `<div class="emulator-editor" role="dialog" aria-modal="true">
            <h3>${text('emulatorEditGameTitle', 'Editar jogo encontrado')}</h3>
            <label><span>${text('emulatorNameLabel', 'Nome')}</span><input class="setup-input emulator-nav" id="emulatorEditName" type="text" value="${esc(game.name)}" tabindex="0" /></label>
            <div class="emulator-editor-preview">${game.gridUrl ? `<img src="${esc(game.gridUrl)}" alt="" />` : noArtworkMarkup(game.name)}</div>
            <div class="emulator-editor-actions">
                <button class="modal-btn secondary emulator-nav" id="emulatorArtworkWizard" type="button" tabindex="0">${text('emulatorChooseArtwork', 'Escolher artes no SteamGrid')}</button>
                <button class="modal-btn primary emulator-nav" id="emulatorApplyEdit" type="button" tabindex="0" data-gamepad-hint="confirm">${text('emulatorApplyEdit', 'Aplicar')}</button>
                <button class="modal-btn cancel emulator-nav" id="emulatorCancelEdit" type="button" tabindex="0" data-gamepad-hint="cancel">${text('btnCancelLabel', 'Cancelar')}</button>
            </div>
        </div>`;
        document.getElementById('view-emulators')?.appendChild(overlay);
        window.refreshDoorpiGamepadHints?.();
        const close = () => { overlay.remove(); document.querySelector(`.emulator-edit-game[data-game-id="${CSS.escape(gameId)}"]`)?.focus(); };
        overlay.querySelector('#emulatorArtworkWizard')?.addEventListener('click', () => {
            const query = overlay.querySelector('#emulatorEditName')?.value.trim() || game.name;
            const bridge = document.createElement('div');
            bridge.dataset.gameId = game.id;
            window.openDoorpiArtworkWizard?.(bridge, 'steamgrid', query, {
                clientOnly: true,
                gameName: query,
                categories: ['vertical', 'horizontal', 'banner', 'logo'],
                returnFocus: overlay.querySelector('#emulatorArtworkWizard'),
                onApplied: images => {
                    if (images.vertical) game.gridUrl = images.vertical;
                    if (images.horizontal) game.horizontalUrl = images.horizontal;
                    if (images.banner) game.heroUrl = images.banner;
                    if (images.logo) game.logoUrl = images.logo;
                    const preview = overlay.querySelector('.emulator-editor-preview');
                    if (preview) preview.innerHTML = game.gridUrl ? `<img src="${esc(game.gridUrl)}" alt="" />` : noArtworkMarkup(query);
                }
            });
        });
        overlay.querySelector('#emulatorApplyEdit')?.addEventListener('click', () => {
            game.name = overlay.querySelector('#emulatorEditName')?.value.trim() || game.name;
            renderPreviewGrid(); close();
        });
        overlay.querySelector('#emulatorCancelEdit')?.addEventListener('click', close);
        requestAnimationFrame(() => requestAnimationFrame(() => {
            const input = overlay.querySelector('#emulatorEditName');
            if (!input) return;
            input.focus({ preventScroll: true });
            const end = input.value.length;
            input.setSelectionRange(end, end);
            input.scrollLeft = input.scrollWidth;
        }));
    }

    function saveConfiguration() {
        syncDraftFromInputs();
        if (!requiredFieldsReady() || !state.scanComplete || state.scanRunning) return;
        document.getElementById('emulatorSetupConfirm').disabled = true;
        postToHost({
            action: 'saveEmulatorConfiguration',
            config: { id: state.draft.id, catalogId: state.draft.catalogId, name: state.draft.name, executablePath: state.draft.executablePath, launchTemplate: state.draft.launchTemplate, extensions: parseExtensions(), romFolders: state.draft.romFolders.filter(Boolean), gridImage: state.draft.gridImage, gridSourceUrl: state.draft.gridSourceUrl },
            games: state.games
        });
    }

    window.openEmulatorsView = function () {
        state.mode = 'list';
        const root = content();
        if (root) {
            root.classList.remove('wizard-active');
            root.innerHTML = `<div class="emulator-loading"><div class="emulator-scan-spinner visible"></div><span>${text('emulatorsLoading', 'Carregando emuladores...')}</span></div>`;
        }
        postToHost({ action: 'requestEmulators' });
    };

    window._emulatorsHandleMessage = function (data) {
        if (!data?.type) return;
        if (data.type === 'emulatorsLoaded') {
            state.emulators = Array.isArray(data.emulators) ? data.emulators : [];
            state.catalog = Array.isArray(data.catalog) ? data.catalog : [];
            if (isViewActive() && state.mode === 'list') renderList();
            return;
        }
        if (data.type === 'emulatorExecutableSelected' && state.mode === 'setup') {
            if (!data.path) return;
            state.draft.executablePath = data.path;
            if (data.detected) applyDetectedEmulator(data.detected);
            else { state.draft.catalogId = 'custom'; state.draft.name = ''; state.draft.launchTemplate = ''; state.draft.extensions = ''; }
            renderSetup();
            invalidateAndScheduleScan(80);
            return;
        }
        if (data.type === 'emulatorRomFolderSelected' && state.mode === 'setup') {
            if (!data.path) return;
            syncDraftFromInputs();
            const index = Number(data.slotId);
            if (Number.isInteger(index) && index >= 0) state.draft.romFolders[index] = data.path;
            renderFolderRows();
            invalidateAndScheduleScan(80);
            focusSoon(document.querySelector(`.emulator-path-row[data-folder-index="${index}"] .emulator-rom-input`), true);
            return;
        }
        if (data.requestId && data.requestId !== state.requestId && data.type.startsWith('emulatorLibrary')) return;
        if (data.type === 'emulatorLibraryDiscovered') {
            state.games = Array.isArray(data.games) ? data.games.map(normalizeGame) : [];
            renderPreviewGrid(); updateSetupState(); return;
        }
        if (data.type === 'emulatorLibraryScanComplete') {
            state.scanRunning = false;
            state.scanComplete = true;
            const status = document.getElementById('emulatorLibraryStatus');
            if (status) status.textContent = state.games.length ? text('emulatorLibraryReadySearching', 'Biblioteca pronta. As capas continuam sendo buscadas em segundo plano.') : text('emulatorNoGamesFound', 'Nenhum jogo compatível foi encontrado nesta pasta.');
            updateSetupState(); return;
        }
        if (data.type === 'emulatorGameArtworkFound') {
            updatePreviewArtwork(data.gameId, data.gridUrl);
            const status = document.getElementById('emulatorLibraryStatus');
            if (status && state.games.length) status.textContent = `${text('emulatorArtworkSearching', 'Buscando capas')} ${data.completed}/${data.total} — ${text('emulatorCanAddNow', 'você já pode adicionar')}`;
            return;
        }
        if (data.type === 'emulatorLibraryArtworkComplete') {
            state.games.filter(game => !game.artworkResolved).forEach(game => updatePreviewArtwork(game.id, game.gridUrl));
            const status = document.getElementById('emulatorLibraryStatus');
            if (status && state.games.length) status.textContent = text('emulatorLibraryReady', 'Biblioteca pronta para adicionar.');
            return;
        }
        if (data.type === 'emulatorLibraryPreviewFailed') {
            state.scanRunning = false; state.scanComplete = false;
            const status = document.getElementById('emulatorLibraryStatus');
            if (status) status.textContent = data.message || text('emulatorLibraryFailed', 'Não foi possível ler esta biblioteca.');
            updateSetupState(); return;
        }
        if (data.type === 'emulatorConfigurationSaved') {
            (data.gameIds || []).forEach(id => {
                window.newGameIdsThisSession?.add(id);
                window.AppStore?.mutations?.markNew?.(id);
            });
            if (data.emulator) {
                const savedId = prop(data.emulator, 'id', 'Id');
                const index = state.emulators.findIndex(item => prop(item, 'id', 'Id') === savedId);
                if (index >= 0) state.emulators[index] = data.emulator;
                else state.emulators.push(data.emulator);
            }
            state.mode = 'list';
            window.showDoorpiToast?.(text('emulatorSavedTitle', 'Emulador salvo'), `${data.total || 0} ${text('emulatorSavedGames', 'jogo(s) adicionados à biblioteca')}`);
            if ((data.artworkTotal || 0) > 0) window.DoorpiNotifications?.upsert?.({ id: 'emulator-artwork-download', title: text('emulatorCoversDownloadingTitle', 'Baixando artes'), message: `0/${data.artworkTotal}`, persistent: true });
            renderList(); return;
        }
        if (data.type === 'emulatorLibraryReconciled') {
            (data.gameIds || []).forEach(id => {
                window.newGameIdsThisSession?.add(id);
                window.AppStore?.mutations?.markNew?.(id);
            });
            return;
        }
        if (data.type === 'emulatorArtworkDownloadProgress') {
            const finished = data.completed >= data.total;
            window.DoorpiNotifications?.upsert?.({ id: 'emulator-artwork-download', title: finished ? text('emulatorCoversReadyTitle', 'Artes salvas') : text('emulatorCoversDownloadingTitle', 'Baixando artes'), message: finished ? text('emulatorCoversReadyHint', 'As artes dos jogos foram armazenadas no Doorpi.') : `${data.completed}/${data.total}`, persistent: !finished });
            if (finished) window.setTimeout(() => window.DoorpiNotifications?.remove?.('emulator-artwork-download'), 6500);
            return;
        }
        if (data.type === 'emulatorDeleted') {
            document.querySelector('.emulator-editor-overlay')?.remove();
            window.showDoorpiToast?.(text('emulatorDeletedTitle', 'Emulador excluído'), `${data.removed || 0} ${text('emulatorDeletedGames', 'jogo(s) removidos da biblioteca')}`);
            return;
        }
        if (data.type === 'emulatorOpenResult' && !data.success) window.showDoorpiToast?.(text('emulatorOpenFailed', 'Não foi possível abrir o emulador'), data.message || '');
    };
})();
