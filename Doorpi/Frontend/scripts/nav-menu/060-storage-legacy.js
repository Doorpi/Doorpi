    function _storageSizeText(value, fallback = '—') {
        const bytes = Number(value || 0);
        if (!Number.isFinite(bytes) || bytes <= 0) return fallback;
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        const order = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
        const amount = bytes / Math.pow(1024, order);
        const digits = order >= 3 && amount < 10 ? 1 : 0;
        return `${amount.toFixed(digits)} ${units[order]}`;
    }

    function _storageStateLabel(state) {
        if (state === 'informed') return 'Informado pelo aplicativo';
        if (state === 'mixed') return 'Valores combinados';
        if (state === 'estimated') return 'Estimativa';
        if (state === 'partial') return 'Análise parcial';
        if (state === 'pending') return 'Aguardando análise';
        if (state === 'unavailable') return 'Tamanho indisponível';
        if (state === 'residual') return 'Fora das categorias';
        return 'Calculado pelo Doorpi';
    }

    function _storageCategoryIcon(key) {
        const icons = {
            games: '<path d="M7.5 9.5h9a4.5 4.5 0 0 1 4.2 6.1l-1 2.6a2 2 0 0 1-3.2.8L14.8 17H9.2l-1.7 2a2 2 0 0 1-3.2-.8l-1-2.6a4.5 4.5 0 0 1 4.2-6.1Z"/><path d="M7 13.3h3M8.5 11.8v3M15.8 13h.1M18 15h.1"/>',
            applications: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>',
            doorpi: '<path d="M7 3h10v18H7z"/><path d="M11 7h2M11 17h2"/>',
            windows: '<path d="m3 5 8-1v8H3V5Zm10-1.2 8-1.1V12h-8V3.8ZM3 14h8v8l-8-1v-7Zm10 0h8v9.3l-8-1.1V14Z"/>',
            other: '<path d="M4 7h6l2 2h8v10H4V7Z"/><path d="M4 7V5h6l2 2"/>'
        };
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[key] || icons.other}</svg>`;
    }

    function _storageStatusText() {
        if (_storageStatus?.error) return _storageStatus.error;
        if (_storageStatus?.calculating) {
            const current = Number(_storageStatus.progressCurrent || 0);
            const total = Number(_storageStatus.progressTotal || 0);
            return total > 0 ? `Analisando ${current} de ${total} · ${_storageStatus.progressLabel || 'Lendo arquivos'}` : 'Preparando análise dos discos…';
        }
        if (_storageStatus?.complete === false && _storageStatus?.scannedAt) return 'Análise parcial preservada. Atualize para continuar.';
        if (_storageStatus?.scannedAt) return `Analisado em ${new Date(_storageStatus.scannedAt).toLocaleString()}`;
        return 'Os valores são calculados em segundo plano.';
    }

    function _storageSegments(drive) {
        const total = Math.max(1, Number(drive?.totalBytes || 0));
        const categories = Array.isArray(drive?.categories) ? drive.categories : [];
        const used = categories.map(category => {
            const width = Math.max(0, Math.min(100, Number(category?.sizeBytes || 0) / total * 100));
            return width > 0 ? `<span class="nav-storage-segment is-${_esc(category.key || 'other')}" style="width:${width}%"></span>` : '';
        }).join('');
        const available = Math.max(0, Math.min(100, Number(drive?.availableBytes || 0) / total * 100));
        return `${used}<span class="nav-storage-segment is-available" style="width:${available}%"></span>`;
    }

    function _renderSettingsSystemStorageLegacy(body, preferredSelector = '') {
        if (!document.getElementById('nav-system-storage-styles')) {
            const s = document.createElement('style');
            s.id = 'nav-system-storage-styles';
            s.textContent = __doorpiCss("injected-styles/nav-menu/nav-system-storage-styles.css");
            document.head.appendChild(s);
        }

        const drives = Array.isArray(_storageStatus?.drives) ? _storageStatus.drives : [];
        if (!_storageSelectedRoot || !drives.some(drive => drive.root === _storageSelectedRoot))
            _storageSelectedRoot = drives[0]?.root || '';
        const drive = drives.find(item => item.root === _storageSelectedRoot) || drives[0] || null;
        const programs = Array.isArray(_storagePrograms?.programs) ? _storagePrograms.programs : [];
        if (_storageSelectedProgramId && !programs.some(program => program.id === _storageSelectedProgramId))
            _storageSelectedProgramId = '';

        const tabs = `
            <div class="nav-storage-tabs" role="tablist" aria-label="Seções de armazenamento">
                <button class="nav-storage-tab ${_storageView === 'overview' ? 'is-active' : ''}" id="navStorageTabOverview" data-storage-view="overview" tabindex="-1">Uso do disco</button>
                <button class="nav-storage-tab ${_storageView === 'programs' ? 'is-active' : ''}" id="navStorageTabPrograms" data-storage-view="programs" tabindex="-1">Programas instalados</button>
            </div>`;

        let viewMarkup = '';
        if (_storageView === 'overview') {
            if (!drive) {
                viewMarkup = `<div class="nav-storage-capacity"><span class="nav-storage-kicker">Discos</span><div class="nav-storage-available"><strong>—</strong><span>Nenhum disco disponível</span></div></div>`;
            } else {
                const categories = Array.isArray(drive.categories) ? drive.categories : [];
                const total = Math.max(1, Number(drive.totalBytes || 0));
                const usedPercent = Math.round(Math.max(0, Math.min(100, Number(drive.usedBytes || 0) / total * 100)));
                const categoryMarkup = categories.map(category => {
                    const expanded = _storageExpandedCategories.has(category.key);
                    const children = Array.isArray(category.children) ? category.children : [];
                    return `<article class="nav-storage-category">
                        <button class="nav-storage-category-button" data-storage-category="${_esc(category.key || '')}" tabindex="-1" aria-expanded="${expanded}">
                            <span class="nav-storage-category-icon">${_storageCategoryIcon(category.key)}</span>
                            <span class="nav-storage-category-copy"><strong>${_esc(category.label || category.key || '')}</strong><small>${_esc(_storageStateLabel(category.state))}</small></span>
                            <span class="nav-storage-category-size">${_esc(_storageSizeText(category.sizeBytes, '0 B'))}</span>
                        </button>
                        ${expanded && children.length ? `<div class="nav-storage-category-children">${children.map(child => `<div class="nav-storage-category-child"><span>${_esc(child.label || child.key || '')}</span><strong>${_esc(_storageSizeText(child.sizeBytes, '—'))}</strong></div>`).join('')}</div>` : ''}
                    </article>`;
                }).join('');
                viewMarkup = `<div class="nav-storage-overview">
                    <section class="nav-storage-capacity">
                        <div class="nav-storage-drive-tabs">${drives.map(item => `<button class="nav-storage-drive ${item.root === drive.root ? 'is-active' : ''}" data-storage-root="${_esc(item.root)}" tabindex="-1">${_esc(item.label || item.root)}</button>`).join('')}</div>
                        <div><span class="nav-storage-kicker">Espaço disponível</span><div class="nav-storage-available"><strong>${_esc(_storageSizeText(drive.availableBytes))}</strong><span>${usedPercent}% do disco em uso</span></div></div>
                        <div class="nav-storage-track" aria-label="Distribuição do espaço">${_storageSegments(drive)}</div>
                        <div class="nav-storage-capacity-meta">
                            <div><span>Capacidade</span><strong>${_esc(_storageSizeText(drive.totalBytes))}</strong></div>
                            <div><span>Em uso</span><strong>${_esc(_storageSizeText(drive.usedBytes))}</strong></div>
                            <div><span>Reservado</span><strong>${_esc(_storageSizeText(drive.reservedBytes, '0 B'))}</strong></div>
                        </div>
                        <div class="nav-storage-analysis"><p>${_esc(_storageStatusText())}</p><button class="nav-storage-refresh" id="navStorageRefresh" tabindex="-1">${_storageStatus?.calculating ? 'Analisando…' : 'Atualizar análise'}</button></div>
                    </section>
                    <section class="nav-storage-categories"><div class="nav-storage-section-head"><h3>Distribuição do conteúdo</h3><span>Selecione para ver detalhes</span></div><div class="nav-storage-category-list">${categoryMarkup || '<p class="nav-storage-program-message">As categorias serão exibidas após a primeira análise.</p>'}</div></section>
                </div>`;
            }
        } else {
            const selected = programs.find(program => program.id === _storageSelectedProgramId) || programs[0] || null;
            const listMarkup = programs.map(program => {
                const meta = [program.publisher, program.version].filter(Boolean).join(' · ') || 'Programa do Windows';
                return `<button class="nav-storage-program ${program.id === selected?.id ? 'is-selected' : ''}" data-storage-program="${_esc(program.id)}" tabindex="-1">
                    <span class="nav-storage-program-mark">${_esc((program.name || '?').trim().charAt(0).toUpperCase())}</span>
                    <span class="nav-storage-program-copy"><strong>${_esc(program.name || 'Programa')}</strong><small>${_esc(meta)}</small></span>
                    <span class="nav-storage-program-size">${_esc(_storageSizeText(program.sizeBytes, '—'))}</span>
                </button>`;
            }).join('');
            viewMarkup = `<div class="nav-storage-programs">
                <section class="nav-storage-program-list" id="navStorageProgramList">${listMarkup || `<p class="nav-storage-program-message">${_esc(_storagePrograms?.error || (_storagePrograms ? 'Nenhum programa encontrado.' : 'Carregando programas do Windows…'))}</p>`}</section>
                <section class="nav-storage-program-detail" id="navStorageProgramDetail"></section>
            </div>`;
        }

        body.innerHTML = `<div class="nav-settings-subheader"><button class="nav-back-btn" id="setBackSystemStorage" tabindex="-1">‹ ${_t('navBack', 'Voltar')}</button><h2>Armazenamento</h2></div><main class="nav-storage-shell">${tabs}${viewMarkup}</main>`;

        const renderProgramDetail = program => {
            const detail = body.querySelector('#navStorageProgramDetail');
            if (!detail) return;
            if (!program) {
                detail.innerHTML = '<span class="nav-storage-kicker">Programas instalados</span><h3>Nenhum programa selecionado</h3><p>Os programas reconhecidos pelo Windows aparecerão nesta lista.</p>';
                return;
            }
            _storageSelectedProgramId = program.id;
            const confirming = _storagePendingUninstallId === program.id;
            const status = _storageUninstallStatus?.programId === program.id ? _storageUninstallStatus.message : '';
            detail.innerHTML = `<div class="nav-storage-program-detail-mark">${_esc((program.name || '?').trim().charAt(0).toUpperCase())}</div>
                <div><span class="nav-storage-kicker">Programa selecionado</span><h3>${_esc(program.name || 'Programa')}</h3></div>
                <p>A remoção será concluída pelo desinstalador oficial deste programa fora do Doorpi.</p>
                <div class="nav-storage-program-facts"><div><span>Editor</span><strong>${_esc(program.publisher || 'Não informado')}</strong></div><div><span>Versão</span><strong>${_esc(program.version || 'Não informada')}</strong></div><div><span>Tamanho</span><strong>${_esc(_storageSizeText(program.sizeBytes, 'Não informado'))}</strong></div><div><span>Origem</span><strong>Windows</strong></div></div>
                ${status ? `<div class="nav-storage-program-message">${_esc(status)}</div>` : ''}
                <div class="nav-storage-program-actions">${confirming
                    ? `<button class="nav-storage-program-action" id="navStorageCancelUninstall" tabindex="-1">Cancelar</button><button class="nav-storage-program-action is-danger" id="navStorageConfirmUninstall" tabindex="-1">Confirmar remoção</button>`
                    : `<button class="nav-storage-program-action wide is-danger" id="navStorageUninstall" tabindex="-1" ${program.canUninstall ? '' : 'disabled'}>${program.canUninstall ? 'Abrir desinstalador' : 'Desinstalação indisponível'}</button>`}</div>`;
        };

        const wire = (focusSelector = preferredSelector) => {
            const selected = programs.find(program => program.id === _storageSelectedProgramId) || programs[0] || null;
            renderProgramDetail(selected);
            const collect = () => {
                _contentItems = [
                    body.querySelector('#setBackSystemStorage'),
                    ...Array.from(body.querySelectorAll('.nav-storage-tab')),
                    ...Array.from(body.querySelectorAll('.nav-storage-drive')),
                    body.querySelector('#navStorageRefresh'),
                    ...Array.from(body.querySelectorAll('.nav-storage-category-button')),
                    ...Array.from(body.querySelectorAll('.nav-storage-program')),
                    body.querySelector('#navStorageUninstall'),
                    body.querySelector('#navStorageCancelUninstall'),
                    body.querySelector('#navStorageConfirmUninstall')
                ].filter(Boolean);
                _contentItems.forEach((element, index) => element.addEventListener('mouseenter', () => { _topbarFocus = false; _contentIdx = index; _updateContentFocus(); }));
            };
            collect();
            const target = focusSelector ? body.querySelector(focusSelector) : null;
            _contentIdx = target ? Math.max(0, _contentItems.indexOf(target)) : Math.max(0, Math.min(_contentIdx, _contentItems.length - 1));
            _updateContentFocus();

            body.querySelectorAll('.nav-storage-program').forEach(button => {
                const select = () => {
                    const program = programs.find(item => item.id === button.dataset.storageProgram);
                    if (!program) return;
                    body.querySelectorAll('.nav-storage-program').forEach(item => item.classList.toggle('is-selected', item === button));
                    renderProgramDetail(program);
                    collect();
                };
                button.addEventListener('focus', select);
                button.addEventListener('click', () => {
                    select();
                    const action = body.querySelector('#navStorageUninstall');
                    if (action && !action.disabled) { _contentIdx = _contentItems.indexOf(action); _updateContentFocus(); }
                });
            });
        };

        body.querySelector('#setBackSystemStorage')?.addEventListener('click', _returnFromSystemDetail);
        body.querySelectorAll('[data-storage-view]').forEach(button => button.addEventListener('click', () => {
            _storageView = button.dataset.storageView || 'overview';
            _storagePendingUninstallId = '';
            if (_storageView === 'programs') postToHost?.({ action: 'requestStoragePrograms' });
            _contentIdx = 1;
            _renderSettingsSystemStorage(body, _storageView === 'programs' ? '#navStorageTabPrograms' : '#navStorageTabOverview');
        }));
        body.querySelectorAll('[data-storage-root]').forEach(button => button.addEventListener('click', () => {
            _storageSelectedRoot = button.dataset.storageRoot || '';
            _renderSettingsSystemStorage(body, `[data-storage-root="${CSS.escape(_storageSelectedRoot)}"]`);
        }));
        body.querySelector('#navStorageRefresh')?.addEventListener('click', () => postToHost?.({ action:'requestStorageStatus', forceRefresh:true }));
        body.querySelectorAll('[data-storage-category]').forEach(button => button.addEventListener('click', () => {
            const key = button.dataset.storageCategory || '';
            if (_storageExpandedCategories.has(key)) _storageExpandedCategories.delete(key); else _storageExpandedCategories.add(key);
            _renderSettingsSystemStorage(body, `[data-storage-category="${CSS.escape(key)}"]`);
        }));
        wire();
        if (body._doorpiStorageClickHandler)
            body.removeEventListener('click', body._doorpiStorageClickHandler);
        body._doorpiStorageClickHandler = event => {
            if (event.target.closest('#navStorageUninstall')) {
                _storagePendingUninstallId = _storageSelectedProgramId;
                _renderSettingsSystemStorage(body, '#navStorageConfirmUninstall');
            } else if (event.target.closest('#navStorageCancelUninstall')) {
                _storagePendingUninstallId = '';
                _renderSettingsSystemStorage(body, `[data-storage-program="${CSS.escape(_storageSelectedProgramId)}"]`);
            } else if (event.target.closest('#navStorageConfirmUninstall')) {
                const id = _storagePendingUninstallId;
                _storagePendingUninstallId = '';
                _storageUninstallStatus = { programId:id, status:'starting', message:'Preparando o desinstalador e os controles…' };
                postToHost?.({ action:'uninstallStorageProgram', programId:id });
                _renderSettingsSystemStorage(body, `[data-storage-program="${CSS.escape(id)}"]`);
            }
        };
        body.addEventListener('click', body._doorpiStorageClickHandler);

        if (_storageView === 'overview' && !_storageStatus)
            postToHost?.({ action:'requestStorageStatus', forceRefresh:false });
        else if (_storageView === 'programs' && !_storagePrograms)
            postToHost?.({ action:'requestStoragePrograms' });
    }

