    function _renderSettingsSystemStorage(body, preferredSelector = '') {
        if (!document.getElementById('nav-system-storage-v3-styles')) {
            const styles = document.createElement('style');
            styles.id = 'nav-system-storage-v3-styles';
            styles.textContent = __doorpiCss("injected-styles/nav-menu/nav-system-storage-v3-styles.css");
            document.head.appendChild(styles);
        }

        body.classList.add('storage-management-active');
        const priorScroll = body.querySelector('.nav-storage-v3-list')?.scrollTop || 0;
        const drives = Array.isArray(_storageStatus?.drives) ? _storageStatus.drives : [];
        if (!_storageSelectedRoot || !drives.some(item => item.root === _storageSelectedRoot))
            _storageSelectedRoot = drives[0]?.root || '';
        const drive = drives.find(item => item.root === _storageSelectedRoot) || drives[0] || null;
        const categories = Array.isArray(drive?.categories) ? drive.categories : [];
        if (!categories.some(item => item.key === _storageSelectedCategoryKey))
            _storageSelectedCategoryKey = categories[0]?.key || '';
        const category = categories.find(item => item.key === _storageSelectedCategoryKey) || categories[0] || null;
        const allPrograms = Array.isArray(_storagePrograms?.programs) ? _storagePrograms.programs : [];
        const selectedRoot = String(drive?.root || '').toUpperCase();
        const primaryRoot = String(drives[0]?.root || '').toUpperCase();
        const programs = allPrograms.filter(program => {
            const root = String(program.installRoot || '').toUpperCase();
            return root ? root === selectedRoot : selectedRoot === primaryRoot;
        }).sort((a, b) => Number(b.sizeBytes || 0) - Number(a.sizeBytes || 0) || String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'));
        if (_storageSelectedProgramId && !programs.some(program => program.id === _storageSelectedProgramId))
            _storageSelectedProgramId = '';
        const selectedProgram = programs.find(program => program.id === _storageSelectedProgramId) || null;
        const total = Math.max(1, Number(drive?.totalBytes || 0));
        const usedPercent = drive ? Math.round(Math.max(0, Math.min(100, Number(drive.usedBytes || 0) / total * 100))) : 0;

        const driveCards = drives.map(item => {
            const itemTotal = Math.max(1, Number(item.totalBytes || 0));
            const itemUsed = Math.round(Math.max(0, Math.min(100, Number(item.usedBytes || 0) / itemTotal * 100)));
            return `<button class="nav-storage-drive-card ${item.root === drive?.root ? 'is-active' : ''}" data-storage-root="${_esc(item.root || '')}" tabindex="-1">${_storageDriveArtwork(item.kind)}<span class="nav-storage-drive-card-copy"><strong>${_esc(item.label || item.root || 'Disco')}</strong><span>${_esc(_storageSizeText(item.availableBytes))} livres de ${_esc(_storageSizeText(item.totalBytes))}</span><span class="nav-storage-drive-mini-track"><i style="width:${itemUsed}%"></i></span></span></button>`;
        }).join('');
        const categoryButtons = categories.map(item => `<button class="nav-storage-v3-category is-${_esc(item.key || 'other')}" data-storage-category="${_esc(item.key || '')}" tabindex="-1"><span class="nav-storage-v3-category-dot"></span><span class="nav-storage-v3-category-copy"><strong>${_esc(item.label || item.key || '')}</strong><small>${_esc(_storageStateLabel(item.state))}</small></span><span class="nav-storage-v3-category-value"><strong>${_esc(_storageSizeText(item.sizeBytes, '0 B'))}</strong><small>›</small></span></button>`).join('');
        const programBytes = programs.reduce((sum, program) => sum + Math.max(0, Number(program.sizeBytes || 0)), 0);
        const programButtons = programs.map(program => {
            const expanded = program.id === _storageSelectedProgramId;
            const status = _storageUninstallStatus?.programId === program.id ? _storageUninstallStatus.message : '';
            const uninstallerActive = _storageUninstallStatus?.programId === program.id && _storageUninstallStatus?.status === 'started';
            const inline = expanded ? `<div class="nav-storage-v3-inline"><div class="nav-storage-v3-inline-copy"><div class="nav-storage-v3-inline-facts"><span>Tamanho · ${_esc(_storageSizeText(program.sizeBytes, 'Não informado'))}</span><span>Unidade · ${_esc(program.installRoot || 'Não informada')}</span>${program.version ? `<span>Versão · ${_esc(program.version)}</span>` : ''}</div><span>${program.canUninstall ? (uninstallerActive ? 'Use Retornar para trazer o desinstalador novamente ao primeiro plano.' : 'O Windows pode remover este item diretamente ou abrir sua ferramenta oficial de desinstalação.') : 'Este programa não informou uma ação de desinstalação ao Windows.'}</span></div><div class="nav-storage-program-actions"><button class="nav-storage-program-action" id="navStorageCancelUninstall" tabindex="-1">Cancelar</button><button class="nav-storage-program-action" id="navStorageConfirmUninstall" data-can-uninstall="${program.canUninstall}" tabindex="-1" ${program.canUninstall ? '' : 'disabled'}>${program.canUninstall ? (uninstallerActive ? 'Retornar' : 'Desinstalar') : 'Indisponível'}</button></div><span class="nav-storage-program-status" ${status ? '' : 'hidden'}>${_esc(status)}</span></div>` : '';
            return `<div class="nav-storage-v3-program-row"><button class="nav-storage-program ${expanded ? 'is-selected' : ''}" data-storage-program="${_esc(program.id)}" tabindex="-1" aria-expanded="${expanded}"><span class="nav-storage-program-mark">${_storageProgramArtwork(program)}</span><span class="nav-storage-program-copy"><strong>${_esc(program.name || 'Programa')}</strong><small>${_esc(program.publisher || 'Programa do Windows')}</small></span><span class="nav-storage-program-intent"><span class="nav-storage-program-size">${_esc(_storageSizeText(program.sizeBytes, '—'))}</span><span class="nav-storage-program-uninstall">${expanded ? 'Opções abertas' : 'Opções  ›'}</span></span></button>${inline}</div>`;
        }).join('');

        let mainMarkup = '';
        if (_storageView === 'overview') {
            mainMarkup = `<main class="nav-storage-v3"><section class="nav-storage-v3-panel nav-storage-v3-overview"><aside class="nav-storage-v3-drives"><div><span class="nav-storage-kicker">Unidades</span><h3>Escolha um disco</h3></div><div class="nav-storage-v3-drive-list">${driveCards || '<div class="nav-storage-empty">Nenhum disco disponível.</div>'}</div><button class="nav-storage-refresh" id="navStorageRefresh" tabindex="-1">${_storageStatus?.calculating ? 'Analisando…' : 'Atualizar análise'}</button></aside><section class="nav-storage-v3-summary"><div class="nav-storage-v3-hero"><div class="nav-storage-v3-free"><span class="nav-storage-kicker">Espaço disponível</span><strong data-nav-storage-available>${_esc(_storageSizeText(drive?.availableBytes))}</strong><span data-nav-storage-percent>${usedPercent}% do disco em uso</span></div><div class="nav-storage-v3-total" data-nav-storage-total>${_esc(_storageSizeText(drive?.usedBytes))} usados<br>de ${_esc(_storageSizeText(drive?.totalBytes))}</div></div><div class="nav-storage-capacity-line" data-nav-storage-bar>${drive ? _storageSegments(drive) : ''}</div><div class="nav-storage-v3-breakdown"><div><span class="nav-storage-kicker">Distribuição</span><h3>O que ocupa espaço</h3></div><div class="nav-storage-v3-category-list">${categoryButtons || '<div class="nav-storage-empty">As categorias aparecerão após a análise.</div>'}</div></div><button class="nav-storage-v3-remove" id="navStorageOpenPrograms" tabindex="-1"><span><strong>Remover programas</strong><small>Jogos, aplicativos e outros programas registrados no Windows</small></span><b>›</b></button></section></section></main>`;
        } else if (_storageView === 'category') {
            const children = Array.isArray(category?.children) ? category.children : [];
            const nodes = (children.length ? children : (category ? [category] : [])).map(node => {
                const nested = Array.isArray(node.children) ? node.children : [];
                return `<article class="nav-storage-v3-node" data-nav-storage-node="${_esc(node.key || '')}"><div class="nav-storage-v3-node-head"><strong>${_esc(node.label || node.key || '')}</strong><span data-nav-storage-node-size>${_esc(_storageSizeText(node.sizeBytes, '—'))}</span></div>${nested.length ? `<div class="nav-storage-v3-node-children">${nested.map(child => `<div class="nav-storage-v3-node-child" data-nav-storage-child="${_esc(child.key || '')}"><span>${_esc(child.label || child.key || '')}</span><strong>${_esc(_storageSizeText(child.sizeBytes, '—'))}</strong></div>`).join('')}</div>` : ''}</article>`;
            }).join('');
            mainMarkup = `<main class="nav-storage-v3"><section class="nav-storage-v3-panel nav-storage-v3-directory" data-nav-storage-category="${_esc(category?.key || '')}"><header class="nav-storage-v3-directory-head"><div><span class="nav-storage-kicker">${_esc(drive?.label || 'Unidade')}</span><h3>${_esc(category?.label || 'Detalhes da categoria')}</h3><p>Distribuição desta categoria no disco selecionado.</p></div><div class="nav-storage-v3-stats"><strong data-nav-storage-category-size>${_esc(_storageSizeText(category?.sizeBytes, '0 B'))}</strong><span data-nav-storage-category-state>${_esc(_storageStateLabel(category?.state))}</span></div></header><div class="nav-storage-v3-list" data-nav-storage-detail-scroll tabindex="-1">${nodes || '<div class="nav-storage-empty">Nenhum detalhe disponível para esta categoria.</div>'}</div></section></main>`;
        } else if (_storageView === 'program-detail') {
            const status = _storageUninstallStatus?.programId === selectedProgram?.id ? _storageUninstallStatus.message : '';
            mainMarkup = `<main class="nav-storage-v3"><section class="nav-storage-v3-panel nav-storage-v3-detail">${selectedProgram ? `<div class="nav-storage-v3-detail-hero"><span class="nav-storage-program-detail-art">${_storageProgramArtwork(selectedProgram, true)}</span><div><span class="nav-storage-kicker">Programa selecionado</span><h3>${_esc(selectedProgram.name || 'Programa')}</h3><p>${_esc(selectedProgram.publisher || 'Editor não informado')}${selectedProgram.version ? ` · versão ${_esc(selectedProgram.version)}` : ''}</p></div></div><div class="nav-storage-v3-facts"><span>Tamanho<strong>${_esc(_storageSizeText(selectedProgram.sizeBytes, 'Não informado'))}</strong></span><span>Unidade<strong>${_esc(selectedProgram.installRoot || 'Não informada')}</strong></span><span>Desinstalação<strong>${selectedProgram.canUninstall ? 'Disponível' : 'Indisponível'}</strong></span></div><div class="nav-storage-program-message nav-storage-program-status" ${status ? '' : 'hidden'}>${_esc(status)}</div><p class="nav-storage-v3-detail-note">${selectedProgram.canUninstall ? 'O desinstalador oficial será aberto em primeiro plano. O controle passará a operar o mouse até você retornar ao Doorpi.' : 'Este programa não informou um desinstalador ao Windows.'}</p><div class="nav-storage-program-actions"><button class="nav-storage-program-action" id="navStorageCancelUninstall" tabindex="-1">Voltar à lista</button><button class="nav-storage-program-action is-danger" id="navStorageConfirmUninstall" tabindex="-1" ${selectedProgram.canUninstall ? '' : 'disabled'}>${selectedProgram.canUninstall ? 'Abrir desinstalador' : 'Indisponível'}</button></div>` : '<div class="nav-storage-empty">O programa selecionado não está mais disponível.</div>'}</section></main>`;
        } else {
            mainMarkup = `<main class="nav-storage-v3"><section class="nav-storage-v3-panel nav-storage-v3-directory"><header class="nav-storage-v3-directory-head"><div><span class="nav-storage-kicker">Remover programas</span><h3>Programas nesta unidade</h3><p>Selecione um item para abrir seus detalhes.</p></div><div class="nav-storage-v3-stats"><strong>${programs.length} ${programs.length === 1 ? 'programa' : 'programas'}</strong><span>${_esc(_storageSizeText(programBytes, 'Tamanho não informado'))} identificados</span></div></header><div class="nav-storage-v3-list nav-storage-program-list" id="navStorageProgramList">${programButtons || `<div class="nav-storage-empty">${_esc(_storagePrograms?.error || (_storagePrograms ? 'Nenhum programa identificado neste disco.' : 'Carregando programas do Windows…'))}</div>`}</div></section></main>`;
        }

        const backLabel = _storageView === 'program-detail' ? 'Remover programas' : _storageView === 'overview' ? _t('navBack', 'Voltar') : 'Uso do disco';
        body.innerHTML = `<div class="nav-settings-subheader"><button class="nav-back-btn" id="setBackSystemStorage" tabindex="-1">‹ ${backLabel}</button><h2>${_storageView === 'programs' ? 'Remover programas' : _storageView === 'category' ? _esc(category?.label || 'Armazenamento') : _storageView === 'program-detail' ? _esc(selectedProgram?.name || 'Programa') : 'Armazenamento'}</h2></div>${mainMarkup}`;

        const rebuildItems = () => {
            _contentItems = [body.querySelector('#setBackSystemStorage'), body.querySelector('[data-nav-storage-detail-scroll]'), ...Array.from(body.querySelectorAll('.nav-storage-drive-card')), body.querySelector('#navStorageRefresh'), ...Array.from(body.querySelectorAll('.nav-storage-v3-category')), body.querySelector('#navStorageOpenPrograms'), ...Array.from(body.querySelectorAll('.nav-storage-program')), body.querySelector('#navStorageCancelUninstall'), body.querySelector('#navStorageConfirmUninstall')].filter(Boolean);
            _contentItems.forEach(element => element.addEventListener('mouseenter', () => { _topbarFocus = false; _contentIdx = _contentItems.indexOf(element); _updateContentFocus(); }, { once:false }));
        };
        rebuildItems();
        const target = preferredSelector ? body.querySelector(preferredSelector) : null;
        _contentIdx = target ? Math.max(0, _contentItems.indexOf(target)) : Math.max(0, Math.min(_contentIdx, _contentItems.length - 1));
        const list = body.querySelector('.nav-storage-v3-list');
        if (list) list.scrollTop = priorScroll;
        _updateContentFocus();

        body.querySelector('#setBackSystemStorage')?.addEventListener('click', () => {
            if (_storageView === 'program-detail') { _storageView = 'programs'; _renderSettingsSystemStorage(body, `[data-storage-program="${CSS.escape(_storageSelectedProgramId)}"]`); }
            else if (_storageView === 'category') { _storageView = 'overview'; _renderSettingsSystemStorage(body, `[data-storage-category="${CSS.escape(_storageSelectedCategoryKey)}"]`); }
            else if (_storageView === 'programs') { _storageView = 'overview'; _renderSettingsSystemStorage(body, '#navStorageOpenPrograms'); }
            else _returnFromSystemDetail();
        });
        body.querySelectorAll('[data-storage-root]').forEach(button => button.addEventListener('click', () => {
            _storageSelectedRoot = button.dataset.storageRoot || '';
            _storageSelectedProgramId = '';
            _renderSettingsSystemStorage(body, `[data-storage-root="${CSS.escape(_storageSelectedRoot)}"]`);
        }));
        body.querySelector('#navStorageRefresh')?.addEventListener('click', () => postToHost?.({ action:'requestStorageStatus', forceRefresh:true }));
        body.querySelectorAll('[data-storage-category]').forEach(button => button.addEventListener('click', () => {
            _storageSelectedCategoryKey = button.dataset.storageCategory || '';
            _storageView = 'category';
            _renderSettingsSystemStorage(body, '[data-nav-storage-detail-scroll]');
        }));
        body.querySelector('#navStorageOpenPrograms')?.addEventListener('click', () => {
            _storageSelectedProgramId = '';
            _storageView = 'programs';
            postToHost?.({ action:'requestStoragePrograms' });
            _renderSettingsSystemStorage(body, '.nav-storage-program');
        });
        body.querySelectorAll('.nav-storage-program').forEach(button => button.addEventListener('click', () => {
            const id = button.dataset.storageProgram || '';
            _storageSelectedProgramId = _storageSelectedProgramId === id ? '' : id;
            _storageView = 'programs';
            _renderSettingsSystemStorage(body, _storageSelectedProgramId ? '#navStorageConfirmUninstall' : `[data-storage-program="${CSS.escape(id)}"]`);
        }));
        body.querySelector('#navStorageCancelUninstall')?.addEventListener('click', () => {
            const id = _storageSelectedProgramId;
            _storageSelectedProgramId = '';
            _storageView = 'programs';
            _renderSettingsSystemStorage(body, `[data-storage-program="${CSS.escape(id)}"]`);
        });
        body.querySelector('#navStorageConfirmUninstall')?.addEventListener('click', () => {
            if (!_storageSelectedProgramId) return;
            if (_storageUninstallStatus?.programId === _storageSelectedProgramId && _storageUninstallStatus?.status === 'started') {
                postToHost?.({ action:'returnToStorageUninstaller', programId:_storageSelectedProgramId });
                return;
            }
            _storageUninstallStatus = { programId:_storageSelectedProgramId, status:'preparing', message:'Solicitando a remoção ao Windows…' };
            postToHost?.({ action:'uninstallStorageProgram', programId:_storageSelectedProgramId });
            const message = body.querySelector('.nav-storage-program-status');
            if (message) { message.hidden = false; message.textContent = _storageUninstallStatus.message; }
            const action = body.querySelector('#navStorageConfirmUninstall');
            if (action) { action.textContent = 'Solicitando…'; action.disabled = true; }
        });

        if (!_storageStatus) postToHost?.({ action:'requestStorageStatus', forceRefresh:false });
        if ((_storageView === 'programs' || _storageView === 'program-detail') && !_storagePrograms)
            postToHost?.({ action:'requestStoragePrograms' });
    }

    function _storageCurrentFocusSelector() {
        const active = document.activeElement;
        if (!active) return '';
        if (active.id) return `#${CSS.escape(active.id)}`;
        if (active.dataset?.storageView) return `[data-storage-view="${CSS.escape(active.dataset.storageView)}"]`;
        if (active.dataset?.storageRoot) return `[data-storage-root="${CSS.escape(active.dataset.storageRoot)}"]`;
        if (active.dataset?.storageCategory) return `[data-storage-category="${CSS.escape(active.dataset.storageCategory)}"]`;
        if (active.dataset?.storageProgram) return `[data-storage-program="${CSS.escape(active.dataset.storageProgram)}"]`;
        return '';
    }

    function _patchNavStorageStatus() {
        if (!window.isNavMenuOpen || _settingsSubView !== 'system' || _systemSubView !== 'storage') return false;
        const body = document.querySelector('.nav-content-body');
        const drives = Array.isArray(_storageStatus?.drives) ? _storageStatus.drives : [];
        const drive = drives.find(item => item.root === _storageSelectedRoot) || drives[0];
        if (!body || !drive) return false;
        if (_storageView === 'overview') {
            const total = Math.max(1, Number(drive.totalBytes || 0));
            const percent = Math.round(Math.max(0, Math.min(100, Number(drive.usedBytes || 0) / total * 100)));
            const available = body.querySelector('[data-nav-storage-available]');
            const percentLabel = body.querySelector('[data-nav-storage-percent]');
            const totalLabel = body.querySelector('[data-nav-storage-total]');
            const bar = body.querySelector('[data-nav-storage-bar]');
            if (available) available.textContent = _storageSizeText(drive.availableBytes);
            if (percentLabel) percentLabel.textContent = `${percent}% do disco em uso`;
            if (totalLabel) totalLabel.innerHTML = `${_esc(_storageSizeText(drive.usedBytes))} usados<br>de ${_esc(_storageSizeText(drive.totalBytes))}`;
            if (bar) bar.innerHTML = _storageSegments(drive);
            const categories = new Map((drive.categories || []).map(item => [String(item.key || ''), item]));
            body.querySelectorAll('[data-storage-category]').forEach(button => {
                const item = categories.get(button.dataset.storageCategory || '');
                const size = button.querySelector('.nav-storage-v3-category-value strong');
                const state = button.querySelector('.nav-storage-v3-category-copy small');
                if (item && size) size.textContent = _storageSizeText(item.sizeBytes, '0 B');
                if (item && state) state.textContent = _storageStateLabel(item.state);
            });
            const refresh = body.querySelector('#navStorageRefresh');
            if (refresh) refresh.textContent = _storageStatus?.calculating ? 'Analisando…' : 'Atualizar análise';
            return true;
        }
        if (_storageView !== 'category') return true;
        const category = (drive.categories || []).find(item => item.key === _storageSelectedCategoryKey);
        const panel = body.querySelector('[data-nav-storage-category]');
        if (!category || !panel) return true;
        const size = panel.querySelector('[data-nav-storage-category-size]');
        const state = panel.querySelector('[data-nav-storage-category-state]');
        if (size) size.textContent = _storageSizeText(category.sizeBytes, '0 B');
        if (state) state.textContent = _storageStateLabel(category.state);
        const list = panel.querySelector('.nav-storage-v3-list');
        const children = Array.isArray(category.children) ? category.children : [];
        const nodes = children.length ? children : [category];
        const currentKeys = Array.from(list?.querySelectorAll('[data-nav-storage-node]') || []).map(item => item.dataset.navStorageNode || '').join('|');
        const nextKeys = nodes.map(item => String(item.key || '')).join('|');
        if (list && currentKeys !== nextKeys) {
            list.innerHTML = nodes.map(node => {
                const nested = Array.isArray(node.children) ? node.children : [];
                return `<article class="nav-storage-v3-node" data-nav-storage-node="${_esc(node.key || '')}"><div class="nav-storage-v3-node-head"><strong>${_esc(node.label || node.key || '')}</strong><span data-nav-storage-node-size>${_esc(_storageSizeText(node.sizeBytes, '—'))}</span></div>${nested.length ? `<div class="nav-storage-v3-node-children">${nested.map(child => `<div class="nav-storage-v3-node-child" data-nav-storage-child="${_esc(child.key || '')}"><span>${_esc(child.label || child.key || '')}</span><strong>${_esc(_storageSizeText(child.sizeBytes, '—'))}</strong></div>`).join('')}</div>` : ''}</article>`;
            }).join('');
        }
        const nodeMap = new Map(nodes.map(node => [String(node.key || ''), node]));
        list?.querySelectorAll('[data-nav-storage-node]').forEach(row => {
            const node = nodeMap.get(row.dataset.navStorageNode || '');
            const nodeSize = row.querySelector('[data-nav-storage-node-size]');
            if (node && nodeSize) nodeSize.textContent = _storageSizeText(node.sizeBytes, '—');
            const childMap = new Map((node?.children || []).map(child => [String(child.key || ''), child]));
            row.querySelectorAll('[data-nav-storage-child]').forEach(childRow => {
                const child = childMap.get(childRow.dataset.navStorageChild || '');
                const childSize = childRow.querySelector('strong');
                if (child && childSize) childSize.textContent = _storageSizeText(child.sizeBytes, '—');
            });
        });
        return true;
    }

    window._navMenuSetStorageStatus = status => {
        _storageStatus = status || null;
        if (window.isNavMenuOpen && _settingsSubView === 'system' && _systemSubView === 'storage') {
            const body = document.querySelector('.nav-content-body');
            if (body && !_patchNavStorageStatus()) _renderSettingsSystemStorage(body, _storageCurrentFocusSelector());
        }
    };
    window._navMenuSetStoragePrograms = status => {
        _storagePrograms = status || { programs:[] };
        if (window.isNavMenuOpen && _settingsSubView === 'system' && _systemSubView === 'storage') {
            const body = document.querySelector('.nav-content-body');
            const focusSelector = _storageView === 'program-detail'
                ? '#navStorageConfirmUninstall'
                : _storageView === 'programs' && _storageSelectedProgramId
                    ? `[data-storage-program="${CSS.escape(_storageSelectedProgramId)}"]`
                    : '#navStorageOpenPrograms';
            if (body) _renderSettingsSystemStorage(body, focusSelector);
        }
    };
    window._navMenuSetStorageUninstallStatus = status => {
        _storageUninstallStatus = status || null;
        if (window.isNavMenuOpen && _settingsSubView === 'system' && _systemSubView === 'storage') {
            const message = document.querySelector('.nav-storage-program-status');
            if (message && (!status?.programId || status.programId === _storageSelectedProgramId)) {
                message.hidden = !status?.message;
                message.textContent = status?.message || '';
            }
            const action = document.querySelector('#navStorageConfirmUninstall');
            if (action && (!status?.programId || status.programId === _storageSelectedProgramId)) {
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
                const note = action.closest('.nav-storage-v3-inline')?.querySelector('.nav-storage-v3-inline-copy > span:last-child');
                if (note && active) note.textContent = 'Use Retornar para trazer o desinstalador novamente ao primeiro plano.';
                else if (note && phase === 'direct') note.textContent = 'O Windows recebeu a solicitação diretamente; nenhum helper foi necessário.';
                if (active) {
                    const list = action.closest('.nav-storage-v3-list');
                    const scrollTop = list?.scrollTop || 0;
                    const index = _contentItems.indexOf(action);
                    if (index >= 0) _contentIdx = index;
                    _updateContentFocus();
                    requestAnimationFrame(() => { if (list) list.scrollTop = scrollTop; });
                }
            }
        }
    };
    window._navMenuFocusStorageUninstallerReturn = programId => {
        if (!window.isNavMenuOpen || _settingsSubView !== 'system' || _systemSubView !== 'storage' || !programId)
            return false;
        const action = document.querySelector('#navStorageConfirmUninstall');
        if (!action || programId !== _storageSelectedProgramId) return false;
        const list = action.closest('.nav-storage-v3-list');
        const scrollTop = list?.scrollTop || 0;
        const index = _contentItems.indexOf(action);
        if (index >= 0) _contentIdx = index;
        _topbarFocus = false;
        _updateContentFocus();
        if (list) list.scrollTop = scrollTop;
        return true;
    };

