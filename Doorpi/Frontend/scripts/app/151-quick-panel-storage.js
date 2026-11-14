        function storageSizeText(bytes, empty = '0 B') {
            const value = Number(bytes || 0);
            if (!Number.isFinite(value) || value <= 0) return empty;
            const units = ['B', 'KB', 'MB', 'GB', 'TB'];
            let amount = value;
            let index = 0;
            while (amount >= 1024 && index < units.length - 1) {
                amount /= 1024;
                index++;
            }
            const digits = index >= 3 ? 1 : index >= 2 ? 0 : 0;
            return `${amount.toFixed(digits)} ${units[index]}`;
        }

        function storageStateText(state) {
            if (state === 'informed') return 'informado pela origem';
            if (state === 'mixed') return 'valores mistos';
            if (state === 'estimated') return 'estimativa';
            if (state === 'partial') return 'cálculo parcial';
            if (state === 'pending') return 'pendente';
            if (state === 'unavailable') return 'não calculado';
            if (state === 'residual') return 'não classificado';
            return 'calculado';
        }

        function storageNodeSizeText(node) {
            const size = Number(node?.sizeBytes || 0);
            if (node?.state === 'unavailable' && size <= 0) return 'Não calculado';
            if (node?.state === 'pending' && size <= 0) return 'Pendente';
            if (node?.state === 'partial') return size > 0 ? `${storageSizeText(size)}+` : 'Parcial';
            return storageSizeText(size);
        }

        function storageTabs() {
            return `<div class="dq-storage-tabs" role="tablist" aria-label="Armazenamento">
                <button class="dq-storage-tab ${storageView === 'overview' ? 'active' : ''}" data-storage-view="overview" tabindex="0">Uso do disco</button>
                <button class="dq-storage-tab ${storageView === 'programs' ? 'active' : ''}" data-storage-view="programs" tabindex="0">Programas instalados</button>
            </div>`;
        }

        function storageStructureSignature(categories) {
            return (categories || []).map(category => {
                const children = Array.isArray(category?.children) ? category.children : [];
                return `${category?.key || ''}:${children.map(child => {
                    const items = Array.isArray(child?.children) ? child.children : [];
                    return `${child?.key || ''}[${items.map(item => item?.key || '').join(',')}]`;
                }).join(';')}`;
            }).join('|');
        }

        function storageStatusMessage() {
            if (storageStatus?.error) return storageStatus.error;
            if (storageStatus?.calculating) {
                if (Number(storageStatus?.progressTotal || 0) > 0)
                    return `${Number(storageStatus?.progressCurrent || 0)}/${Number(storageStatus?.progressTotal || 0)} · ${storageStatus?.progressLabel || 'Lendo…'}`;
                return 'Preparando leitura…';
            }
            if (storageStatus?.complete === false && storageStatus?.scannedAt)
                return 'Leitura parcial salva; ela continuará na próxima atualização.';
            if (storageStatus?.scannedAt) return `Última análise: ${dateText(storageStatus.scannedAt)}`;
            return 'Os valores conhecidos serão calculados em segundo plano.';
        }

        function storageSegmentsMarkup(drive) {
            const categories = Array.isArray(drive?.categories) ? drive.categories : [];
            const total = Math.max(Number(drive?.totalBytes || 0), 1);
            const known = categories.reduce((sum, item) => sum + Number(item?.sizeBytes || 0), 0);
            const categorized = categories.filter(item => Number(item?.sizeBytes || 0) > 0).map(item => {
                const width = Math.max(0, Math.min(100, Number(item.sizeBytes || 0) / total * 100));
                return `<span class="dq-storage-segment ${esc(item.key || '')}" style="width:${width}%" title="${esc(item.label || '')}: ${esc(storageSizeText(item.sizeBytes))}"></span>`;
            }).join('');
            const readingBytes = storageStatus?.calculating
                ? Math.max(0, Number(drive?.usedBytes || 0) - known)
                : 0;
            const reading = readingBytes > 0
                ? `<span class="dq-storage-segment reading" style="width:${Math.min(100, readingBytes / total * 100)}%" title="Lendo: ${esc(storageSizeText(readingBytes))}"></span>`
                : '';
            const availableBytes = Math.max(0, Number(drive?.availableBytes || 0));
            const available = `<span class="dq-storage-segment available" style="width:${Math.min(100, availableBytes / total * 100)}%" title="Disponível: ${esc(storageSizeText(availableBytes))}"></span>`;
            return categorized + reading + available;
        }

        function storageLegendMarkup() {
            const entries = [
                ['games', 'Jogos'],
                ['applications', 'Aplicativos'],
                ['doorpi', 'Doorpi'],
                ['windows', 'Windows e sistema'],
                ['other', 'Outros arquivos'],
                ['available', 'Disponível']
            ];
            if (storageStatus?.calculating) entries.push(['reading', 'Lendo']);
            return entries.map(([key, label]) => `<span class="dq-storage-legend-item"><span class="dq-storage-legend-dot ${key}"></span>${label}</span>`).join('');
        }

        function storageDriveArtwork(kind = 'fixed') {
            const removable = kind === 'removable';
            return `<span class="dq-storage-drive-art" aria-hidden="true"><svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="8" width="32" height="32" rx="7"/><path d="M13 30h22M15 15h18l3 12H12l3-12Z"/><circle cx="32.5" cy="34.5" r="1.5" fill="currentColor" stroke="none"/>${removable ? '<path d="M21 34h6M24 27v7M21.5 29.5 24 27l2.5 2.5"/>' : '<path d="M15 35h9"/>'}</svg></span>`;
        }

        function storageDriveTabMarkup(item, selectedDrive, compact = false) {
            const total = Math.max(1, Number(item?.totalBytes || 0));
            const usedPercent = Math.round(Math.max(0, Math.min(100, Number(item?.usedBytes || 0) / total * 100)));
            return `<button class="dq-drive-tab ${compact ? 'compact ' : ''}${item?.root === selectedDrive?.root ? 'active' : ''}" data-storage-root="${esc(item?.root || '')}" tabindex="0">${storageDriveArtwork(item?.kind)}<span class="dq-storage-drive-copy"><strong>${esc(item?.label || item?.root || 'Disco')}</strong><small data-storage-drive-free>${esc(storageSizeText(item?.availableBytes))} livres de ${esc(storageSizeText(item?.totalBytes))}</small><span class="dq-storage-drive-track"><i data-storage-drive-track style="width:${usedPercent}%"></i></span></span></button>`;
        }

        function storageCategoryMarkup(category) {
            const children = Array.isArray(category?.children) ? category.children : [];
            const expanded = expandedStorageCategories.has(category?.key);
            const childrenMarkup = expanded && children.length
                ? `<div class="dq-storage-children">${children.map(child => {
                    const grandchildren = Array.isArray(child?.children) ? child.children : [];
                    const childNodeKey = `child|${category?.key || ''}|${child?.key || ''}`;
                    return `<div class="dq-storage-child" data-storage-node="${esc(childNodeKey)}">
                        <span>${esc(child.label || child.key || '')}<small class="dq-storage-state dq-storage-node-state">${esc(storageStateText(child.state))}</small></span>
                        <span class="dq-storage-node-size">${esc(storageNodeSizeText(child))}</span>
                        ${grandchildren.length ? `<div class="dq-storage-grandchildren">${grandchildren.map(item => `
                            <div class="dq-storage-grandchild" data-storage-node="${esc(`item|${category?.key || ''}|${child?.key || ''}|${item?.key || ''}`)}"><span>${esc(item.label || item.key || '')}<small class="dq-storage-state dq-storage-node-state">${esc(storageStateText(item.state))}</small></span><span class="dq-storage-node-size">${esc(storageNodeSizeText(item))}</span></div>
                        `).join('')}</div>` : ''}
                    </div>`;
                }).join('')}</div>`
                : '';
            return `<div class="dq-storage-category is-${esc(category?.key || 'other')}" data-storage-node="${esc(`category|${category?.key || ''}`)}">
                <button class="dq-storage-category-head" data-storage-category="${esc(category?.key || '')}" tabindex="0" aria-expanded="${expanded}">
                    <span class="dq-storage-name">${esc(category?.label || category?.key || '')}<small class="dq-storage-state dq-storage-node-state">${esc(storageStateText(category?.state))}</small></span>
                    <span class="dq-storage-value dq-storage-node-size">${esc(storageNodeSizeText(category))}</span>
                </button>
                ${childrenMarkup}
            </div>`;
        }

        function storageProgramArtwork(program) {
            const icon = String(program?.iconBase64 || '').trim();
            return icon
                ? `<img src="data:image/png;base64,${esc(icon)}" alt="" loading="lazy" />`
                : `<span>${esc((program?.name || '?').trim().charAt(0).toUpperCase())}</span>`;
        }

        function storageUninstallerIsActive(programId) {
            return uninstallStatus?.programId === programId && uninstallStatus?.status === 'started';
        }

        function storageProgramDetailMarkup(program) {
            if (!program) {
                return `<span class="dq-kicker">Gerenciador</span><h3>Nenhum programa selecionado</h3><p>Escolha um item da lista para conferir seus dados.</p>`;
            }
            const status = uninstallStatus?.programId === program.id ? uninstallStatus.message : '';
            const uninstallerActive = storageUninstallerIsActive(program.id);
            return `<span class="dq-program-mark">${storageProgramArtwork(program)}</span>
                <span class="dq-kicker">Programa selecionado</span>
                <h3>${esc(program.name || 'Programa')}</h3>
                <p>${esc(program.publisher || 'Editor não informado')}${program.version ? ` · versão ${esc(program.version)}` : ''}</p>
                <div class="dq-storage-program-facts"><span>Tamanho · ${esc(storageSizeText(program.sizeBytes, 'Não informado'))}</span><span>Unidade · ${esc(program.installRoot || 'Não informada')}</span><span class="dq-storage-program-status" ${status ? '' : 'hidden'}>${esc(status)}</span></div>
                <p>${program.canUninstall ? 'O desinstalador oficial abrirá em primeiro plano e o controle passará a operar o mouse.' : 'Este programa não informou um desinstalador ao Windows.'}</p>
                <div class="dq-storage-program-actions"><button class="dq-program-action" data-cancel-storage-program="${esc(program.id)}" tabindex="0">Cancelar</button><button class="dq-program-action danger" data-confirm-uninstall="${esc(program.id)}" tabindex="0" ${program.canUninstall ? '' : 'disabled'}>${program.canUninstall ? (uninstallerActive ? 'Retornar' : 'Abrir desinstalador') : 'Indisponível'}</button></div>`;
        }

        function storageProgramsForSelectedDrive() {
            const drives = Array.isArray(storageStatus?.drives) ? storageStatus.drives : [];
            const drive = drives.find(item => item.root === selectedStorageRoot) || drives[0] || null;
            const primaryRoot = String(drives[0]?.root || '').toUpperCase();
            const currentRoot = String(drive?.root || '').toUpperCase();
            return (Array.isArray(storagePrograms?.programs) ? storagePrograms.programs : [])
                .filter(program => {
                    const root = String(program.installRoot || '').toUpperCase();
                    return root ? root === currentRoot : currentRoot === primaryRoot;
                })
                .sort((a, b) => Number(b.sizeBytes || 0) - Number(a.sizeBytes || 0) || String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'));
        }

        function storageProgramRowsMarkup(programs) {
            return programs.map(program => {
                const expanded = program.id === selectedStorageProgramId;
                const details = expanded ? storageProgramInlineDetailMarkup(program) : '';
                return `<div class="dq-program-row ${expanded ? 'is-selected' : ''}"><button class="dq-program-main" data-storage-program="${esc(program.id)}" tabindex="0" aria-expanded="${expanded}"><span class="dq-program-mark">${storageProgramArtwork(program)}</span><span class="dq-program-copy"><span class="dq-program-name">${esc(program.name || 'Programa')}</span><span class="dq-program-meta">${esc(program.publisher || 'Aplicativo do Windows')}</span></span><span class="dq-program-intent"><span class="dq-storage-value">${esc(storageSizeText(program.sizeBytes, '—'))}</span><small>${expanded ? 'Opções abertas' : 'Opções  ›'}</small></span></button>${details}</div>`;
            }).join('');
        }

        function storageProgramInlineDetailMarkup(program) {
            const status = uninstallStatus?.programId === program.id ? uninstallStatus.message : '';
            const uninstallerActive = storageUninstallerIsActive(program.id);
            return `<div class="dq-program-inline-detail" data-storage-program-detail="${esc(program.id)}"><div class="dq-program-inline-copy"><div class="dq-program-inline-facts"><span>Tamanho · ${esc(storageSizeText(program.sizeBytes, 'Não informado'))}</span><span>Unidade · ${esc(program.installRoot || 'Não informada')}</span>${program.version ? `<span>Versão · ${esc(program.version)}</span>` : ''}</div><p class="dq-program-inline-note">${program.canUninstall ? (uninstallerActive ? 'Use Retornar para trazer o desinstalador novamente ao primeiro plano.' : 'O Windows pode remover este item diretamente ou abrir sua ferramenta oficial de desinstalação.') : 'Este programa não informou uma ação de desinstalação ao Windows.'}</p></div><div class="dq-storage-program-actions"><button class="dq-program-action" data-cancel-storage-program="${esc(program.id)}" tabindex="0">Cancelar</button><button class="dq-program-action danger" data-confirm-uninstall="${esc(program.id)}" data-can-uninstall="${program.canUninstall}" tabindex="0" ${program.canUninstall ? '' : 'disabled'}>${program.canUninstall ? (uninstallerActive ? 'Retornar' : 'Desinstalar') : 'Indisponível'}</button></div><span class="dq-storage-program-status" ${status ? '' : 'hidden'}>${esc(status)}</span></div>`;
        }

        function toggleStorageProgramExpansion(overlay, id, focusAction = true) {
            const programs = storageProgramsForSelectedDrive();
            const program = programs.find(item => item.id === id);
            if (!program) return;
            const opening = selectedStorageProgramId !== id;
            selectedStorageProgramId = opening ? id : '';
            overlay.querySelectorAll('.dq-program-row').forEach(row => {
                const main = row.querySelector('[data-storage-program]');
                const rowId = main?.dataset.storageProgram || '';
                const expanded = opening && rowId === id;
                row.classList.toggle('is-selected', expanded);
                main?.setAttribute('aria-expanded', String(expanded));
                const label = main?.querySelector('.dq-program-intent small');
                if (label) label.textContent = expanded ? 'Opções abertas' : 'Opções  ›';
                row.querySelector('.dq-program-inline-detail')?.remove();
                if (expanded) row.insertAdjacentHTML('beforeend', storageProgramInlineDetailMarkup(program));
            });
            requestAnimationFrame(() => {
                const target = opening && focusAction
                    ? overlay.querySelector(`[data-confirm-uninstall="${CSS.escape(id)}"]`)
                    : overlay.querySelector(`[data-storage-program="${CSS.escape(id)}"]`);
                target?.focus();
            });
        }

        function storageOverviewContent() {
            const drives = Array.isArray(storageStatus?.drives) ? storageStatus.drives : [];
            if (!selectedStorageRoot || !drives.some(drive => drive.root === selectedStorageRoot))
                selectedStorageRoot = drives[0]?.root || '';
            const drive = drives.find(item => item.root === selectedStorageRoot) || drives[0];
            if (!drive) {
                const loading = !storageStatus;
                return `<section class="dq-content dq-storage-page"><div class="dq-kicker">Sistema</div><h1 class="dq-heading">Armazenamento</h1><p class="dq-sub">${loading ? 'Lendo unidades, capacidade e distribuição do conteúdo.' : 'Não foi possível encontrar uma unidade de armazenamento.'}</p><section class="dq-storage-loading-panel" aria-live="polite"><div class="dq-storage-loading-state">${loading ? '<span class="dq-storage-loading-ring" aria-hidden="true"></span>' : ''}<strong>${loading ? 'Carregando armazenamento…' : esc(storageStatus?.error || 'Nenhum disco disponível.')}</strong></div></section></section>`;
            }
            const categories = Array.isArray(drive.categories) ? drive.categories : [];
            const structure = storageStructureSignature(categories);
            const total = Math.max(1, Number(drive.totalBytes || 0));
            const usedPercent = Math.round(Math.max(0, Math.min(100, Number(drive.usedBytes || 0) / total * 100)));
            const programs = storageProgramsForSelectedDrive();
            const categoryRows = categories.map(category => {
                const detail = category?.state === 'pending' ? 'Análise em andamento' : 'Ver detalhes desta categoria';
                return `<button class="dq-storage-console-row" data-storage-overview-category="${esc(category?.key || '')}" data-storage-open-category="${esc(category?.key || '')}" tabindex="0"><span class="dq-storage-legend-dot ${esc(category?.key || 'other')}"></span><span class="dq-storage-console-copy"><strong>${esc(category?.label || category?.key || '')}</strong><small>${esc(detail)}</small></span><span class="dq-storage-console-value"><strong>${esc(storageNodeSizeText(category))}</strong><small>›</small></span></button>`;
            }).join('');
            return `<section class="dq-content dq-storage-page">
                <div class="dq-kicker">Sistema</div>
                <h1 class="dq-heading">Armazenamento</h1>
                <p class="dq-sub">Veja o uso desta unidade ou abra uma categoria para entender seus detalhes.</p>
                <div class="dq-storage-overview-console">
                    <section class="dq-storage-capacity-panel">
                        <div class="dq-storage-drive-strip"><div class="dq-storage-drive-strip-title"><span>Unidades</span><strong>Escolha um disco</strong></div><div class="dq-drive-tabs">${drives.map(item => storageDriveTabMarkup(item, drive)).join('')}</div><button class="dq-action compact" data-action="refresh-storage" tabindex="0"><span class="dq-action-label">Atualizar análise</span><span class="dq-action-ico">${iconSvg('refresh', storageStatus?.calculating ? 'dq-spin' : '')}</span></button></div>
                        <div class="dq-storage-capacity-main" data-storage-stat="availableBytes"><span>Espaço disponível</span><strong>${esc(storageSizeText(drive.availableBytes))}</strong><small data-storage-used-percent>${usedPercent}% do disco em uso</small></div>
                        <div class="dq-storage-bar" aria-label="Distribuição do disco">${storageSegmentsMarkup(drive)}</div>
                        <div class="dq-storage-summary">
                            <div class="dq-storage-stat" data-storage-stat="totalBytes"><span>Capacidade</span><strong>${esc(storageSizeText(drive.totalBytes))}</strong></div>
                            <div class="dq-storage-stat" data-storage-stat="usedBytes"><span>Em uso</span><strong>${esc(storageSizeText(drive.usedBytes))}</strong></div>
                            <div class="dq-storage-stat" data-storage-stat="reservedBytes"><span>Reservado</span><strong>${esc(storageSizeText(drive.reservedBytes))}</strong></div>
                        </div>
                        <div class="dq-storage-toolbar"><span class="dq-storage-message dq-storage-progress">${esc(storageStatusMessage())}</span></div>
                    </section>
                    <section class="dq-storage-category-panel"><div class="dq-storage-category-title"><strong>O que ocupa espaço</strong><span>Selecione uma categoria para detalhar</span></div><div class="dq-storage-console-list">${categoryRows || `<div class="dq-storage-message">${esc(storageStatus?.error || 'Calculando categorias…')}</div>`}</div><div class="dq-storage-category-actions"><button class="dq-storage-remove-programs" data-storage-open-programs="true" tabindex="0"><span><strong>Remover programas</strong><small>Software registrado no Windows, incluindo jogos e aplicativos</small></span><b>›</b></button></div></section>
                </div>
            </section>`;
        }

        function storageProgramsContent() {
            const drives = Array.isArray(storageStatus?.drives) ? storageStatus.drives : [];
            if (!selectedStorageRoot || !drives.some(drive => drive.root === selectedStorageRoot))
                selectedStorageRoot = drives[0]?.root || '';
            const drive = drives.find(item => item.root === selectedStorageRoot) || drives[0] || null;
            const programs = storageProgramsForSelectedDrive();
            if (selectedStorageProgramId && !programs.some(program => program.id === selectedStorageProgramId))
                selectedStorageProgramId = '';
            const knownProgramBytes = programs.reduce((sum, program) => sum + Math.max(0, Number(program.sizeBytes || 0)), 0);
            return `<section class="dq-content dq-storage-page dq-storage-programs-page">
                <div class="dq-kicker">Armazenamento</div>
                <h1 class="dq-heading">Remover programas</h1>
                <p class="dq-sub">Software registrado no Windows. Selecione um item para ver seus detalhes e opções.</p>
                <div class="dq-storage-level-toolbar"><button class="dq-storage-back" data-storage-view="overview" tabindex="0">‹ Uso do disco</button><div class="dq-drive-tabs">${drives.map(item => storageDriveTabMarkup(item, drive, true)).join('')}</div><button class="dq-action compact" data-action="refresh-programs" tabindex="0"><span class="dq-action-label">Atualizar</span><span class="dq-action-ico">${iconSvg('refresh')}</span></button></div>
                <section class="dq-storage-category-detail-panel"><header class="dq-storage-category-detail-head"><div><span class="dq-storage-kicker">Nesta unidade</span><h2 data-storage-program-count>${programs.length} ${programs.length === 1 ? 'programa' : 'programas'}</h2></div><strong data-storage-program-total>${esc(storageSizeText(knownProgramBytes, 'Tamanho não informado'))}</strong></header><div class="dq-storage-vertical-list dq-program-list">${storageProgramRowsMarkup(programs) || `<div class="dq-storage-message">${esc(storagePrograms?.error || (storagePrograms ? 'Nenhum programa identificado nesta unidade.' : 'Carregando programas do Windows…'))}</div>`}</div></section>
            </section>`;
        }

        function storageCategoryDetailRowsMarkup(category) {
            const children = Array.isArray(category?.children) ? category.children : [];
            if (!children.length) {
                return `<article class="dq-storage-node-group" data-storage-detail-node="__self__"><span class="dq-storage-node-group-head"><strong>${esc(category?.label || 'Categoria')}</strong><span data-storage-detail-size>${esc(storageNodeSizeText(category))}</span></span><span class="dq-storage-node-items"><span class="dq-storage-node-item"><span>Nenhuma subdivisão disponível para esta categoria.</span></span></span></article>`;
            }
            return children.map(child => {
                const items = Array.isArray(child?.children) ? child.children : [];
                return `<article class="dq-storage-node-group" data-storage-detail-node="${esc(child?.key || '')}"><span class="dq-storage-node-group-head"><strong>${esc(child?.label || child?.key || 'Conteúdo')}</strong><span data-storage-detail-size>${esc(storageNodeSizeText(child))}</span></span>${items.length ? `<span class="dq-storage-node-items">${items.map(item => `<span class="dq-storage-node-item" data-storage-detail-item="${esc(item?.key || '')}"><span>${esc(item?.label || item?.key || 'Item')}</span><strong>${esc(storageNodeSizeText(item))}</strong></span>`).join('')}</span>` : ''}</article>`;
            }).join('');
        }

        function storageCategoryContent() {
            const drives = Array.isArray(storageStatus?.drives) ? storageStatus.drives : [];
            const drive = drives.find(item => item.root === selectedStorageRoot) || drives[0] || null;
            const categories = Array.isArray(drive?.categories) ? drive.categories : [];
            const category = categories.find(item => item.key === selectedStorageCategoryKey) || categories[0] || null;
            if (category) selectedStorageCategoryKey = category.key || '';
            const rows = storageCategoryDetailRowsMarkup(category);
            return `<section class="dq-content dq-storage-page dq-storage-category-view"><div class="dq-kicker">Armazenamento</div><h1 class="dq-heading">${esc(category?.label || 'Detalhes da categoria')}</h1><p class="dq-sub">Veja como esta categoria está distribuída na unidade selecionada.</p><div class="dq-storage-level-toolbar"><button class="dq-storage-back" data-storage-view="overview" tabindex="0">‹ Uso do disco</button><div class="dq-drive-tabs">${drives.map(item => storageDriveTabMarkup(item, drive, true)).join('')}</div></div><section class="dq-storage-category-detail-panel" data-storage-detail-category="${esc(category?.key || '')}"><header class="dq-storage-category-detail-head"><div><span class="dq-storage-kicker" data-storage-detail-drive>${esc(drive?.label || 'Unidade')}</span><h2>Distribuição da categoria</h2></div><strong data-storage-category-total>${esc(storageNodeSizeText(category))}</strong></header><div class="dq-storage-vertical-list" data-storage-detail-scroll tabindex="0" data-storage-detail-structure="${esc(storageStructureSignature([category]))}">${rows}</div></section></section>`;
        }

        function storageProgramDetailContent() {
            const programs = storageProgramsForSelectedDrive();
            const program = programs.find(item => item.id === selectedStorageProgramId) || programs[0] || null;
            if (!program) { storageView = 'programs'; return storageProgramsContent(); }
            selectedStorageProgramId = program.id;
            const status = uninstallStatus?.programId === program.id ? uninstallStatus.message : '';
            return `<section class="dq-content dq-storage-page dq-storage-program-detail-view"><div class="dq-kicker">Remover programas</div><h1 class="dq-heading">Detalhes do programa</h1><p class="dq-sub">Confira o item antes de abrir o desinstalador fornecido pelo Windows.</p><div class="dq-storage-level-toolbar"><button class="dq-storage-back" data-storage-view="programs" tabindex="0">‹ Lista de programas</button></div><section class="dq-storage-program-detail-page"><div class="dq-storage-program-hero"><span class="dq-program-mark">${storageProgramArtwork(program)}</span><div class="dq-storage-program-hero-copy"><span class="dq-storage-kicker">Programa selecionado</span><h2>${esc(program.name || 'Programa')}</h2><p>${esc(program.publisher || 'Editor não informado')}${program.version ? ` · versão ${esc(program.version)}` : ''}</p></div></div><div class="dq-storage-program-facts"><span>Tamanho · ${esc(storageSizeText(program.sizeBytes, 'Não informado'))}</span><span>Unidade · ${esc(program.installRoot || 'Não informada')}</span><span class="dq-storage-program-status" ${status ? '' : 'hidden'}>${esc(status)}</span></div><p class="dq-storage-program-guidance">${program.canUninstall ? 'O Doorpi abrirá o desinstalador oficial em primeiro plano e liberará o mouse. Ao voltar, a lista será atualizada automaticamente.' : 'Este item não informou uma ação de desinstalação ao Windows.'}</p><div class="dq-storage-program-actions"><button class="dq-program-action" data-cancel-storage-program="${esc(program.id)}" tabindex="0">Cancelar</button><button class="dq-program-action danger" data-confirm-uninstall="${esc(program.id)}" tabindex="0" ${program.canUninstall ? '' : 'disabled'}>${program.canUninstall ? 'Abrir desinstalador' : 'Indisponível'}</button></div></section></section>`;
        }

        function storageContent() {
            if (storageView === 'category') return storageCategoryContent();
            if (storageView === 'programs') return storageProgramsContent();
            if (storageView === 'program-detail') return storageProgramDetailContent();
            return storageOverviewContent();
        }

