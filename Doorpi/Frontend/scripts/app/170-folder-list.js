function renderFolderList(folders) {
    const list = document.getElementById('folderList');
    const totalBar = document.getElementById('folderTotalTime');
    if (!list) return;

    // Oculta a barra de tempo total que existia no design antigo
    if (totalBar) totalBar.style.display = 'none';

    if (!folders || folders.length === 0) {
        list.innerHTML = `
                <div class="folder-empty">
                    <div class="folder-empty-icon">◫</div>
                    <div class="folder-empty-text">${t('foldersEmpty')}</div>
                    <div class="folder-empty-hint">${t('foldersEmptyHint')}</div>
                </div>`;
        return;
    }

    list.innerHTML = folders.map(folder => {
        const isAnalyzing = folder.EstimatedMs === -1;
        const folderPath = folder.Path || folder.path || '';
        const pSafe = folderPath.replace(/\\/g, '\\\\').replace(/"/g, '&quot;');

        // Se ainda estiver na fase de engate, mostra uma opacidade leve para indicar que está sendo lido
        const analyzingClass = isAnalyzing ? 'is-analyzing' : '';

        return `
            <div class="folder-item ${analyzingClass}" data-path="${pSafe}">
                <div class="folder-item-header">
                    <div class="folder-info">
                        <span class="folder-icon">◫</span>
                        <span class="folder-path" title="${folderPath}">${folderPath}</span>
                    </div>
                    <div class="folder-actions">
                        <button class="icon-btn edit-btn" tabindex="0" data-path="${pSafe}">${t('btnEditLabel')}</button>
                        <button class="icon-btn delete-btn" tabindex="0" data-path="${pSafe}">${t('btnDeleteLabel')}</button>
                    </div>
                </div>
            </div>`;
    }).join('');

    list.querySelectorAll('.edit-btn').forEach(btn =>
        btn.addEventListener('click', e => {
            e.stopPropagation();
            window.setInlineScanStatus?.(true, t('inlineScanWaitingWindows'));
            postToHost({
                action: 'editFolder',
                path: btn.dataset.path.replace(/\\\\/g, '\\'),
                dialogTitle: t('dlgEditFolderTitle'),
                forbiddenMsg: t('msgFolderForbidden'),
                forbiddenTitle: t('msgFolderForbiddenTitle'),
                errorMsg: t('msgErrorEditFolder')
            });
        })
    );

    list.querySelectorAll('.delete-btn').forEach(btn =>
        btn.addEventListener('click', e => {
            e.stopPropagation();
            window.setInlineScanStatus?.(true, t('inlineScanUpdatingList'));
            postToHost({ action: 'deleteFolder', path: btn.dataset.path.replace(/\\\\/g, '\\') });
        })
    );
}

