    function _storageDriveArtwork(kind = 'fixed', large = false) {
        const removable = kind === 'removable';
        return `<svg class="${large ? 'is-large' : ''}" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="8" y="8" width="32" height="32" rx="7"/>
            <path d="M13 30h22M15 15h18l3 12H12l3-12Z"/>
            <circle cx="32.5" cy="34.5" r="1.5" fill="currentColor" stroke="none"/>
            ${removable ? '<path d="M21 34h6M24 27v7M21.5 29.5 24 27l2.5 2.5"/>' : '<path d="M15 35h9"/>'}
        </svg>`;
    }

    function _storageProgramArtwork(program, large = false) {
        const icon = String(program?.iconBase64 || '').trim();
        if (icon)
            return `<img src="data:image/png;base64,${_esc(icon)}" alt="" loading="lazy" />`;
        return `<svg class="${large ? 'is-large' : ''}" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="5" width="22" height="22" rx="5"/><path d="M10 10h5v5h-5zM17 10h5v5h-5zM10 17h5v5h-5zM17 17h5v5h-5z"/></svg>`;
    }

    function _renderSettingsSystemStorageV2Legacy(body, preferredSelector = '') {
        if (!document.getElementById('nav-system-storage-v2-styles')) {
            const styles = document.createElement('style');
            styles.id = 'nav-system-storage-v2-styles';
            styles.textContent = __doorpiCss("injected-styles/nav-menu/nav-system-storage-v2-styles.css");
            document.head.appendChild(styles);
        }

        body.classList.add('storage-management-active');
        const priorScroll = body.querySelector('#navStorageProgramList')?.scrollTop || 0;
        const drives = Array.isArray(_storageStatus?.drives) ? _storageStatus.drives : [];
        if (!_storageSelectedRoot || !drives.some(item => item.root === _storageSelectedRoot))
            _storageSelectedRoot = drives[0]?.root || '';
        const drive = drives.find(item => item.root === _storageSelectedRoot) || drives[0] || null;
        const allPrograms = Array.isArray(_storagePrograms?.programs) ? _storagePrograms.programs : [];
        const selectedRoot = String(drive?.root || '').toUpperCase();
        const primaryRoot = String(drives[0]?.root || '').toUpperCase();
        const programs = allPrograms.filter(program => {
            const root = String(program.installRoot || '').toUpperCase();
            return root ? root === selectedRoot : selectedRoot === primaryRoot;
        }).sort((a, b) => Number(b.sizeBytes || 0) - Number(a.sizeBytes || 0) || String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'));
        if (!_storageSelectedProgramId || !programs.some(program => program.id === _storageSelectedProgramId))
            _storageSelectedProgramId = programs[0]?.id || '';

        const total = Math.max(1, Number(drive?.totalBytes || 0));
        const usedPercent = drive ? Math.round(Math.max(0, Math.min(100, Number(drive.usedBytes || 0) / total * 100))) : 0;
        const categories = Array.isArray(drive?.categories) ? drive.categories : [];
        const knownProgramBytes = programs.reduce((sum, program) => sum + Math.max(0, Number(program.sizeBytes || 0)), 0);
        const driveRail = drives.map(item => {
            const itemTotal = Math.max(1, Number(item.totalBytes || 0));
            const itemUsed = Math.round(Math.max(0, Math.min(100, Number(item.usedBytes || 0) / itemTotal * 100)));
            return `<button class="nav-storage-drive-card ${item.root === drive?.root ? 'is-active' : ''}" data-storage-root="${_esc(item.root || '')}" tabindex="-1">
                ${_storageDriveArtwork(item.kind)}<span class="nav-storage-drive-card-copy"><strong>${_esc(item.label || item.root || 'Disco')}</strong><span>${_esc(_storageSizeText(item.availableBytes))} livres de ${_esc(_storageSizeText(item.totalBytes))}</span><span class="nav-storage-drive-mini-track"><i style="width:${itemUsed}%"></i></span></span>
            </button>`;
        }).join('');
        const categoryMarkup = categories.map(category => `<article class="nav-storage-category is-${_esc(category.key || 'other')}">
            <div class="nav-storage-category-static"><span class="nav-storage-category-dot"></span><strong>${_esc(category.label || category.key || '')}</strong><span>${_esc(_storageSizeText(category.sizeBytes, '0 B'))}</span></div>
        </article>`).join('');
        const programMarkup = programs.map(program => `<button class="nav-storage-program ${program.id === _storageSelectedProgramId ? 'is-selected' : ''}" data-storage-program="${_esc(program.id)}" tabindex="-1">
            <span class="nav-storage-program-mark">${_storageProgramArtwork(program)}</span><span class="nav-storage-program-copy"><strong>${_esc(program.name || 'Programa')}</strong><small>${_esc(program.publisher || 'Aplicativo do Windows')}</small></span><span class="nav-storage-program-intent"><span class="nav-storage-program-size">${_esc(_storageSizeText(program.sizeBytes, '—'))}</span><span class="nav-storage-program-uninstall ${program.canUninstall ? '' : 'is-disabled'}">${program.canUninstall ? 'Desinstalar  ›' : 'Indisponível'}</span></span>
        </button>`).join('');

        const overviewMarkup = `<section class="nav-storage-overview-panel">
                    <div class="nav-storage-drive-column"><div class="nav-storage-drive-column-head"><div><span class="nav-storage-kicker">Unidades</span><h3>Escolha um disco</h3></div></div><section class="nav-storage-drive-rail" aria-label="Discos disponíveis">${driveRail || '<div class="nav-storage-empty">Nenhum disco disponível.</div>'}</section><button class="nav-storage-refresh" id="navStorageRefresh" tabindex="-1">${_storageStatus?.calculating ? 'Analisando…' : 'Atualizar análise'}</button></div>
                    <div class="nav-storage-summary"><div class="nav-storage-usage-hero"><div class="nav-storage-usage-visual">${_storageDriveArtwork(drive?.kind, true)}</div><div class="nav-storage-usage-copy"><span class="nav-storage-kicker">${_esc(drive?.label || 'Armazenamento')}</span><strong>${_esc(_storageSizeText(drive?.availableBytes))} livres</strong><span>${usedPercent}% do disco está em uso</span><span class="nav-storage-total">${_esc(_storageSizeText(drive?.usedBytes))} usados de ${_esc(_storageSizeText(drive?.totalBytes))}${drive?.format ? ` · ${_esc(drive.format)}` : ''}</span></div></div><div class="nav-storage-breakdown"><div class="nav-storage-capacity-line" aria-label="Distribuição do espaço">${drive ? _storageSegments(drive) : ''}</div><div class="nav-storage-category-list">${categoryMarkup || '<div class="nav-storage-empty">As categorias aparecerão após a análise.</div>'}</div><div class="nav-storage-usage-meta"><span>Em uso <strong>${_esc(_storageSizeText(drive?.usedBytes))}</strong></span><span>Reservado <strong>${_esc(_storageSizeText(drive?.reservedBytes, '0 B'))}</strong></span><span>${_esc(_storageStatusText())}</span></div></div></div>
                </section>`;
        const programsMarkup = `<section class="nav-storage-library-panel">
                    <header class="nav-storage-library-head"><div><span class="nav-storage-kicker">Gerenciamento de aplicativos</span><h3>Desinstalar programas</h3><p>Selecione um programa para revisar os detalhes e removê-lo deste computador.</p></div><div class="nav-storage-library-stats"><strong>${programs.length} ${programs.length === 1 ? 'programa' : 'programas'}</strong><span>${_esc(_storageSizeText(knownProgramBytes, 'Tamanho não informado'))} identificados</span></div></header>
                    <div class="nav-storage-manager"><section class="nav-storage-program-list" id="navStorageProgramList">${programMarkup || `<div class="nav-storage-empty">${_esc(_storagePrograms?.error || (_storagePrograms ? 'Nenhum programa identificado neste disco.' : 'Carregando programas e ícones do Windows…'))}</div>`}</section><section class="nav-storage-program-detail" id="navStorageProgramDetail"></section></div>
                </section>`;
        const modeTabs = `<div class="nav-storage-mode-tabs"><button class="nav-storage-mode-tab ${_storageView === 'overview' ? 'is-active' : ''}" data-storage-view="overview" tabindex="-1">Uso do disco</button><button class="nav-storage-mode-tab ${_storageView === 'programs' ? 'is-active' : ''}" data-storage-view="programs" tabindex="-1">Programas instalados</button></div>`;
        body.innerHTML = `<div class="nav-settings-subheader"><button class="nav-back-btn" id="setBackSystemStorage" tabindex="-1">‹ ${_t('navBack', 'Voltar')}</button><h2>Armazenamento</h2></div>${modeTabs}<main class="nav-storage-console is-${_storageView}">${_storageView === 'programs' ? programsMarkup : overviewMarkup}</main>`;

        const renderProgramDetail = program => {
            const detail = body.querySelector('#navStorageProgramDetail');
            if (!detail) return;
            if (!program) {
                detail.innerHTML = `<span class="nav-storage-program-detail-art">${_storageProgramArtwork(null, true)}</span><div class="nav-storage-program-detail-copy"><span class="nav-storage-kicker">Gerenciador</span><h4>Nenhum programa selecionado</h4><p>Escolha um item da lista para conferir seus dados e iniciar a desinstalação.</p></div>`;
                return;
            }
            _storageSelectedProgramId = program.id;
            const status = _storageUninstallStatus?.programId === program.id ? _storageUninstallStatus.message : '';
            detail.innerHTML = `<span class="nav-storage-program-detail-art">${_storageProgramArtwork(program, true)}</span><div class="nav-storage-program-detail-copy"><span class="nav-storage-kicker">Programa selecionado</span><h4>${_esc(program.name || 'Programa')}</h4><p>${_esc(program.publisher || 'Editor não informado')}${program.version ? ` · versão ${_esc(program.version)}` : ''}</p><span class="nav-storage-program-detail-meta"><span>Tamanho · ${_esc(_storageSizeText(program.sizeBytes, 'Não informado'))}</span><span>Unidade · ${_esc(program.installRoot || 'Não informada')}</span><span class="nav-storage-program-status" ${status ? '' : 'hidden'}>${_esc(status)}</span></span></div><p class="nav-storage-program-prompt">${program.canUninstall ? 'O desinstalador oficial será aberto em primeiro plano. O controle passa a operar o mouse até você voltar ao Doorpi.' : 'Este programa não informou um desinstalador ao Windows.'}</p><div class="nav-storage-program-actions"><button class="nav-storage-program-action" id="navStorageCancelUninstall" tabindex="-1">Cancelar</button><button class="nav-storage-program-action is-danger" id="navStorageConfirmUninstall" tabindex="-1" ${program.canUninstall ? '' : 'disabled'}>${program.canUninstall ? 'Abrir desinstalador' : 'Indisponível'}</button></div>`;
        };

        const rebuildItems = () => {
            _contentItems = [body.querySelector('#setBackSystemStorage'), ...Array.from(body.querySelectorAll('.nav-storage-mode-tab')), ...Array.from(body.querySelectorAll('.nav-storage-drive-card')), body.querySelector('#navStorageRefresh'), ...Array.from(body.querySelectorAll('.nav-storage-program')), body.querySelector('#navStorageCancelUninstall'), body.querySelector('#navStorageConfirmUninstall')].filter(Boolean);
            _contentItems.forEach((element, index) => {
                if (element.dataset.storageHoverBound) return;
                element.dataset.storageHoverBound = '1';
                element.addEventListener('mouseenter', () => { _topbarFocus = false; _contentIdx = _contentItems.indexOf(element); _updateContentFocus(); });
            });
        };
        const selected = programs.find(program => program.id === _storageSelectedProgramId) || programs[0] || null;
        renderProgramDetail(selected);
        rebuildItems();
        const target = preferredSelector ? body.querySelector(preferredSelector) : null;
        _contentIdx = target ? Math.max(0, _contentItems.indexOf(target)) : Math.max(0, Math.min(_contentIdx, _contentItems.length - 1));
        const programList = body.querySelector('#navStorageProgramList');
        if (programList) programList.scrollTop = priorScroll;
        _updateContentFocus();

        body.querySelector('#setBackSystemStorage')?.addEventListener('click', _returnFromSystemDetail);
        body.querySelectorAll('[data-storage-view]').forEach(button => button.addEventListener('click', () => {
            const nextView = button.dataset.storageView || 'overview';
            if (_storageView === nextView) return;
            _storageView = nextView;
            _storagePendingUninstallId = '';
            if (_storageView === 'programs') postToHost?.({ action:'requestStoragePrograms' });
            _renderSettingsSystemStorage(body, `.nav-storage-mode-tab[data-storage-view="${CSS.escape(_storageView)}"]`);
        }));
        body.querySelectorAll('[data-storage-root]').forEach(button => button.addEventListener('click', () => {
            _storageSelectedRoot = button.dataset.storageRoot || '';
            _storageSelectedProgramId = '';
            _renderSettingsSystemStorage(body, `[data-storage-root="${CSS.escape(_storageSelectedRoot)}"]`);
        }));
        body.querySelector('#navStorageRefresh')?.addEventListener('click', () => postToHost?.({ action:'requestStorageStatus', forceRefresh:true }));
        body.querySelectorAll('.nav-storage-program').forEach(button => {
            const select = () => {
                const program = programs.find(item => item.id === button.dataset.storageProgram);
                if (!program) return;
                body.querySelectorAll('.nav-storage-program').forEach(item => item.classList.toggle('is-selected', item === button));
                renderProgramDetail(program);
                rebuildItems();
            };
            button.addEventListener('focus', select);
            button.addEventListener('click', () => {
                select();
                const action = body.querySelector('#navStorageConfirmUninstall');
                if (action && !action.disabled) { _contentIdx = _contentItems.indexOf(action); _updateContentFocus(); }
            });
        });
        if (body._doorpiStorageClickHandler) body.removeEventListener('click', body._doorpiStorageClickHandler);
        body._doorpiStorageClickHandler = event => {
            if (event.target.closest('#navStorageCancelUninstall')) {
                _storagePendingUninstallId = '';
                const selectedButton = body.querySelector(`[data-storage-program="${CSS.escape(_storageSelectedProgramId)}"]`);
                if (selectedButton) {
                    _contentIdx = _contentItems.indexOf(selectedButton);
                    _updateContentFocus();
                }
            } else if (event.target.closest('#navStorageConfirmUninstall')) {
                const id = _storageSelectedProgramId;
                if (!id) return;
                _storagePendingUninstallId = '';
                _storageUninstallStatus = { programId:id, status:'starting', message:'Preparando o desinstalador e liberando o mouse…' };
                postToHost?.({ action:'uninstallStorageProgram', programId:id });
                const program = programs.find(item => item.id === id);
                renderProgramDetail(program);
                rebuildItems();
            }
        };
        body.addEventListener('click', body._doorpiStorageClickHandler);
        if (!_storageStatus) postToHost?.({ action:'requestStorageStatus', forceRefresh:false });
        if (!_storagePrograms) postToHost?.({ action:'requestStoragePrograms' });
    }

