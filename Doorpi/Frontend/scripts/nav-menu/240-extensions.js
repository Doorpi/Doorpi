    function _renderSettingsExtensions(body) {
        if (!document.getElementById('nav-ext-styles')) {
            const s = document.createElement('style');
            s.id = 'nav-ext-styles';
            s.textContent = __doorpiCss("injected-styles/nav-menu/nav-ext-styles.css");
            document.head.appendChild(s);
        }

        body.innerHTML = `
            <div class="nav-settings-subheader">
                <button class="nav-back-btn" id="setBackExt" tabindex="-1">‹ ${_t('navBack', 'Voltar')}</button>
                <h2>${_t('extManagerTitle', 'Extensões')}</h2>
            </div>
            <main class="nav-ext-hub">
                <div class="nav-ext-entry-stage" id="navExtEntryStage">
                    <div class="nav-ext-entry-grid">
                        <button class="nav-ext-store-card" id="navExtStoreBtn" tabindex="-1">
                            <span class="nav-ext-store-symbol" aria-hidden="true">
                                <svg viewBox="0 0 64 64">
                                    <path d="M13 25h38l-3.8-11H16.8L13 25Z"/>
                                    <path d="M16 25v27h32V25M24 52V39h16v13"/>
                                    <path d="M20 25v3.5a4 4 0 0 0 8 0V25m0 0v3.5a4 4 0 0 0 8 0V25m0 0v3.5a4 4 0 0 0 8 0V25"/>
                                    <path d="M24 14c.7-4 3.3-6 8-6s7.3 2 8 6"/>
                                </svg>
                            </span>
                            <span class="nav-ext-store-copy">
                                <span class="nav-ext-kicker">Catálogo</span>
                                <h3>Explorar loja</h3>
                                <p>Encontre recursos compatíveis e envie a instalação diretamente para o Doorpi.</p>
                            </span>
                            <span class="nav-ext-chevron" aria-hidden="true">›</span>
                        </button>

                        <button class="nav-ext-manual-card" id="navExtManualBtn" tabindex="-1">
                            <span class="nav-ext-manual-symbol" aria-hidden="true"><svg viewBox="0 0 48 48"><path d="M19.5 29.5 28.8 20a6.5 6.5 0 0 1 9.2 9.2l-7.1 7.1a6.5 6.5 0 0 1-9.2 0"/><path d="m28.5 18.5-9.3 9.5a6.5 6.5 0 0 1-9.2-9.2l7.1-7.1a6.5 6.5 0 0 1 9.2 0"/></svg></span>
                            <span class="nav-ext-manual-copy"><span class="nav-ext-kicker">Outra origem</span><strong>Instalar por link</strong><span>Opção manual para links compatíveis.</span></span>
                        </button>
                    </div>

                    <section class="nav-ext-dialog" id="navExtDialog" aria-hidden="true" aria-labelledby="navExtDialogTitle">
                        <div class="nav-ext-dialog-panel">
                            <header class="nav-ext-dialog-head">
                                <span class="nav-ext-dialog-title"><span class="nav-ext-kicker">Instalação manual</span><h3 id="navExtDialogTitle">Adicionar extensão</h3><p id="navExtDialogDescription">Cole um link compatível da Chrome Web Store.</p></span>
                                <button class="nav-ext-dialog-close" id="navExtDialogClose" tabindex="-1">Cancelar</button>
                            </header>
                            <div class="nav-ext-dialog-entry">
                                <input class="nav-ext-url" id="navExtUrlInput" readonly placeholder="${_t('extManagerInputPlaceholder', 'Cole o link da extensão aqui...')}" tabindex="-1" />
                                <div class="nav-ext-dialog-entry-actions">
                                    <button class="nav-ext-action" id="navExtPasteBtn" tabindex="-1">${_t('btnPaste', 'Colar link')}</button>
                                    <button class="nav-ext-action primary" id="navExtReviewBtn" tabindex="-1">Continuar</button>
                                </div>
                                <span class="nav-ext-dialog-hint">O Doorpi valida o endereço antes de iniciar a instalação.</span>
                            </div>
                            <div class="nav-ext-candidate">
                                <div class="nav-ext-candidate-art" id="navExtCandidateArt"></div>
                                <div class="nav-ext-candidate-copy">
                                    <span class="nav-ext-kicker">Pronta para instalar</span>
                                    <h4 id="navExtCandidateName">Extensão selecionada</h4>
                                    <p id="navExtCandidateDescription">Confirme para adicionar este recurso ao navegador do Doorpi.</p>
                                    <span class="nav-ext-candidate-source" id="navExtCandidateSource"></span>
                                    <div class="nav-ext-candidate-actions">
                                        <button class="nav-ext-action" id="navExtCandidateBack" tabindex="-1">Cancelar</button>
                                        <button class="nav-ext-action primary" id="navExtInstallBtn" tabindex="-1">${_t('btnInstall', 'Instalar extensão')}</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>
                </div>

                <section class="nav-ext-library">
                    <header class="nav-ext-library-heading">
                        <span class="nav-ext-library-title">
                            <h3>Instaladas</h3>
                            <span class="nav-ext-status" id="navExtensionStatus">${_t('loadingExtensions', 'Carregando extensões...')}</span>
                        </span>
                        <span class="nav-ext-count" id="navExtensionCount"></span>
                    </header>
                    <div class="nav-ext-list" id="navExtensionsList"></div>
                </section>
            </main>`;

        _contentItems = [
            body.querySelector('#setBackExt'),
            body.querySelector('#navExtStoreBtn'),
            body.querySelector('#navExtManualBtn')
        ].filter(Boolean);

        body.querySelector('#setBackExt')?.addEventListener('click', () => {
            _settingsSubView = null;
            _contentIdx = 0;
            document.activeElement?.blur();
            requestAnimationFrame(() => {
                _renderContent('settings');
                _updateContentFocus();
            });
        });

        const dialog = body.querySelector('#navExtDialog');
        const entryStage = body.querySelector('#navExtEntryStage');
        const urlInput = body.querySelector('#navExtUrlInput');
        const dialogDescription = body.querySelector('#navExtDialogDescription');
        let extensionCandidate = null;
        let extensionReturnIndex = 2;
        const candidateFallbackIcon = `
            <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M18 9h8v6.2a4.8 4.8 0 1 0 6 0V9h7v10h-5.2a4.8 4.8 0 1 0 0 6H39v14H25v-5.2a4.8 4.8 0 1 0-6 0V39H9V25h5.2a4.8 4.8 0 1 0 0-6H9V9h9Z"/></svg>`;

        const bindExtensionHover = items => items.forEach((element, index) => {
            if (!element || element.dataset.navExtHoverBound === 'true') return;
            element.dataset.navExtHoverBound = 'true';
            element.addEventListener('mouseenter', () => {
                _topbarFocus = false;
                const currentIndex = _contentItems.indexOf(element);
                _contentIdx = currentIndex >= 0 ? currentIndex : index;
                _updateContentFocus();
            });
        });

        const extensionBaseItems = () => [
            body.querySelector('#setBackExt'),
            body.querySelector('#navExtStoreBtn'),
            body.querySelector('#navExtManualBtn'),
            ...body.querySelectorAll('#navExtensionsList .nav-ext-btn')
        ].filter(Boolean);

        const setExtensionItems = (items, preferred = 0) => {
            _contentItems = items.filter(Boolean);
            _contentIdx = Math.max(0, Math.min(preferred, _contentItems.length - 1));
            bindExtensionHover(_contentItems);
            _updateContentFocus();
        };

        const showExtensionEntry = (focusInput = true, message = '') => {
            extensionCandidate = null;
            dialog?.classList.remove('has-candidate');
            if (dialogDescription) dialogDescription.textContent = message || 'Cole um link compatível da Chrome Web Store.';
            setExtensionItems([
                body.querySelector('#navExtDialogClose'),
                urlInput,
                body.querySelector('#navExtPasteBtn'),
                body.querySelector('#navExtReviewBtn')
            ], focusInput ? 1 : 0);
        };

        const openExtensionDialog = () => {
            if (!dialog) return;
            extensionReturnIndex = 2;
            entryStage?.classList.add('is-inline-open');
            dialog.classList.add('visible');
            dialog.setAttribute('aria-hidden', 'false');
            showExtensionEntry(true);
        };

        const closeExtensionDialog = () => {
            if (!dialog) return;
            entryStage?.classList.remove('is-inline-open');
            dialog.classList.remove('visible', 'has-candidate');
            dialog.setAttribute('aria-hidden', 'true');
            extensionCandidate = null;
            setExtensionItems(extensionBaseItems(), extensionReturnIndex);
        };

        const showExtensionCandidate = data => {
            const url = String(data?.url || urlInput?.value || '').trim();
            const extensionId = url.match(/[a-p]{32}/i)?.[0] || '';
            if (!url || !extensionId) {
                if (!dialog?.classList.contains('visible')) openExtensionDialog();
                showExtensionEntry(true, 'Esse endereço não corresponde a uma extensão válida da Chrome Web Store.');
                return false;
            }

            const rawName = String(data?.name || '').trim();
            const genericName = !rawName || /^chrome web store(?:\s*[-|].*)?$/i.test(rawName) ||
                /^(extensões|extensions)$/i.test(rawName);
            const pathParts = (() => {
                try { return new URL(url).pathname.split('/').filter(Boolean); }
                catch { return []; }
            })();
            const idIndex = pathParts.findIndex(part => part.toLocaleLowerCase() === extensionId.toLocaleLowerCase());
            const slugName = idIndex > 0
                ? decodeURIComponent(pathParts[idIndex - 1]).replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim()
                : '';
            const resolvedName = genericName
                ? (slugName.replace(/\b\p{L}/gu, letter => letter.toLocaleUpperCase()) || 'Extensão selecionada')
                : rawName;

            extensionCandidate = {
                url,
                name: resolvedName,
                description: String(data?.description || 'Confirme para adicionar este recurso ao navegador do Doorpi.').trim(),
                imageUrl: String(data?.imageUrl || '').trim()
            };
            extensionReturnIndex = data?.name || data?.imageUrl ? 1 : 2;
            if (urlInput) urlInput.value = url;
            if (!dialog?.classList.contains('visible')) {
                entryStage?.classList.add('is-inline-open');
                dialog?.classList.add('visible');
                dialog?.setAttribute('aria-hidden', 'false');
            }
            dialog?.classList.add('has-candidate');
            const art = body.querySelector('#navExtCandidateArt');
            const safeImage = /^(https?:\/\/|data:image\/)/i.test(extensionCandidate.imageUrl) ? extensionCandidate.imageUrl : '';
            if (art) {
                art.innerHTML = safeImage ? `<img src="${_esc(safeImage)}" alt="" />` : candidateFallbackIcon;
                art.querySelector('img')?.addEventListener('error', () => { art.innerHTML = candidateFallbackIcon; }, { once: true });
            }
            const name = body.querySelector('#navExtCandidateName');
            const description = body.querySelector('#navExtCandidateDescription');
            const source = body.querySelector('#navExtCandidateSource');
            if (name) name.textContent = extensionCandidate.name;
            if (description) description.textContent = extensionCandidate.description;
            if (source) source.textContent = `Chrome Web Store · ${extensionId}`;
            setExtensionItems([
                body.querySelector('#navExtCandidateBack'),
                body.querySelector('#navExtInstallBtn')
            ], 1);
            return true;
        };

        window._showNavExtensionInstallCandidate = showExtensionCandidate;
        window._closeNavExtensionInline = () => {
            if (!dialog?.classList.contains('visible')) return false;
            closeExtensionDialog();
            return true;
        };

        body.querySelector('#navExtManualBtn')?.addEventListener('click', openExtensionDialog);
        body.querySelector('#navExtDialogClose')?.addEventListener('click', closeExtensionDialog);
        body.querySelector('#navExtCandidateBack')?.addEventListener('click', closeExtensionDialog);
        body.querySelector('#navExtPasteBtn')?.addEventListener('click', () => {
            window._isPastingExtensionUrl = true;
            if (typeof postToHost === 'function') postToHost({ action: 'readClipboard' });
        });
        body.querySelector('#navExtReviewBtn')?.addEventListener('click', () => showExtensionCandidate({ url: urlInput?.value }));

        body.querySelector('#navExtStoreBtn')?.addEventListener('click', () => {
            if (typeof postToHost === 'function') {
                postToHost({
                    action: 'openExtensionStore',
                    extBtnTitle: _t('extStoreAddBtn'),
                    extBtnSub: _t('extStoreAddSub'),
                    toastTitle: _t('toastDoorpi'),
                    toastSub: _t('toastExtSent'),
                    extInstalledTitle: _t('extAlreadyInstalledBtn'),
                    extInstalledSub: _t('extAlreadyInstalledSub')
                });
            }
        });

        urlInput?.addEventListener('click', event => {
            urlInput.removeAttribute('readonly');
            if (!window._doorpiShouldOpenVkbFromEvent?.(event)) return;
            window._vkbOpen?.(urlInput, {
                onOk: () => {
                    urlInput.setAttribute('readonly', '');
                    window._vkbForceClose?.();
                    requestAnimationFrame(() => showExtensionCandidate({ url: urlInput.value }));
                },
                onCancel: () => {
                    urlInput.setAttribute('readonly', '');
                    window._vkbForceClose?.();
                }
            });
        });

        body.querySelector('#navExtInstallBtn')?.addEventListener('click', () => {
            const url = extensionCandidate?.url || urlInput?.value.trim();
            const status = document.getElementById('navExtensionStatus');
            if (!url) {
                if (status) { status.textContent = _t('extPasteLinkError', 'Insira um link válido.'); status.className = 'nav-ext-status error'; }
                return;
            }
            if (status) { status.textContent = _t('extInstallingStatus', 'Instalando...'); status.className = 'nav-ext-status'; }
            closeExtensionDialog();
            if (typeof postToHost === 'function') postToHost({ action: 'installExtension', url, successMsg: _t('extInstallSuccess', 'Extensão Instalada') });
        });

        window._renderNavExtensionsList = function (extensions, statusClass, message, updates) {
            const listEl = document.getElementById('navExtensionsList');
            const statusEl = document.getElementById('navExtensionStatus');
            const countEl = document.getElementById('navExtensionCount');
            if (!listEl) return;
            extensions = Array.isArray(extensions) ? extensions : [];
            updates = updates || {};

            if (statusEl) {
                statusEl.textContent = message || (extensions.length
                    ? 'Recursos adicionais disponíveis no navegador do Doorpi.'
                    : _t('extNoneInstalled', 'Nenhuma extensão instalada.'));
                statusEl.className = `nav-ext-status ${statusClass || ''}`.trim();
            }
            if (countEl) countEl.textContent = extensions.length === 1 ? '1 extensão' : `${extensions.length} extensões`;

            const fallbackIcon = `
                <svg viewBox="0 0 48 48" aria-hidden="true">
                    <path d="M18 9h8v6.2a4.8 4.8 0 1 0 6 0V9h7v10h-5.2a4.8 4.8 0 1 0 0 6H39v14H25v-5.2a4.8 4.8 0 1 0-6 0V39H9V25h5.2a4.8 4.8 0 1 0 0-6H9V9h9Z"/>
                </svg>`;

            listEl.innerHTML = extensions.length ? extensions.map(ext => {
                const updateVersion = updates[ext.Id];
                const hasUpdate = !!updateVersion;
                const id = _esc(ext.Id || '');
                const name = _esc(ext.Name || _t('extUnknown', 'Extensão'));
                const version = _esc(ext.Version || '—');
                const description = _esc(ext.Description || 'Recurso adicional instalado no navegador do Doorpi.');
                const iconData = String(ext.IconDataUrl || '');
                const icon = /^data:image\/[a-z0-9.+-]+;base64,/i.test(iconData)
                    ? `<img src="${_esc(iconData)}" alt="" />`
                    : fallbackIcon;

                return `
                <article class="nav-ext-card">
                    <div class="nav-ext-card-main">
                        <span class="nav-ext-icon">${icon}</span>
                        <div class="nav-ext-info">
                            <strong>${name}</strong>
                            <p>${description}</p>
                            <div class="nav-ext-meta">
                                <span>${_t('extInstalled', 'Instalada')} · v${version}</span>
                                ${hasUpdate ? `<span class="nav-ext-update-label">Atualização v${_esc(updateVersion)}</span>` : ''}
                            </div>
                        </div>
                    </div>
                    <div class="nav-ext-card-footer">
                        ${hasUpdate ? `
                        <button class="nav-ext-btn primary" data-action="update" data-id="${id}" tabindex="-1" title="${_t('btnUpdate', 'Atualizar')}">
                            ${_t('btnUpdate', 'Atualizar')}
                        </button>` : ''}
                        <button class="nav-ext-btn danger" data-action="delete" data-id="${id}" tabindex="-1" title="${_t('btnRemove', 'Remover')}">
                            ${_t('btnRemove', 'Remover')}
                        </button>
                    </div>
                </article>`;
            }).join('') : `
                <div class="nav-ext-empty">
                    <div><strong>Sua biblioteca está vazia</strong><span>Abra a loja ou instale uma extensão por link.</span></div>
                </div>`;

            listEl.querySelectorAll('.nav-ext-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const action = btn.dataset.action;
                    const id = btn.dataset.id;
                    if (action === 'update') window._doorpiUpdateExtension(id);
                    if (action === 'delete') window._doorpiDeleteExtension(id);
                });
            });

            _contentItems = extensionBaseItems();
            bindExtensionHover(_contentItems);

            _contentIdx = Math.min(_contentIdx, Math.max(0, _contentItems.length - 1));
            _updateContentFocus();
        };

        if (typeof postToHost === 'function') postToHost({ action: 'requestExtensions' });

        bindExtensionHover(_contentItems);
    }

