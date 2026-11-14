    function _formatWindowsUpdateSize(bytes) {
        const value = Number(bytes || 0);
        if (!Number.isFinite(value) || value <= 0) return '';
        if (value >= 1024 * 1024 * 1024) return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`;
        if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(0)} MB`;
        return `${Math.max(1, Math.round(value / 1024))} KB`;
    }

    function _formatWindowsUpdateDate(value) {
        if (!value) return _t('never', 'Nunca');
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return _t('never', 'Nunca');
        return date.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit' })
            + ' '
            + date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    }

    function _windowsUpdateActionLabel(status) {
        if (status === 'installing') return _t('windowsUpdateInstalling', 'Instalando');
        if (status === 'downloading') return _t('windowsUpdateDownloading', 'Baixando');
        if (status === 'checking') return _t('windowsUpdateChecking', 'Verificando');
        return _t('checkWindows', 'Verificar Windows');
    }

    function _windowsUpdatePackageState(item) {
        if (item?.rebootRequired || item?.status === 'reboot-required') {
            return { text: _t('windowsUpdateRebootPending', 'Reinicialização pendente'), color: '#ffd872' };
        }
        const keys = {
            pending: ['windowsUpdatePending', 'Pendente'],
            downloading: ['windowsUpdateDownloading', 'Baixando'],
            downloaded: ['windowsUpdateDownloaded', 'Baixado'],
            installing: ['windowsUpdateInstalling', 'Instalando'],
            installed: ['windowsUpdateInstalled', 'Instalado'],
            error: ['windowsUpdatePackageError', 'Falha']
        };
        const [key, fallback] = keys[item?.status] || keys.pending;
        return { text: _t(key, fallback), color: 'rgba(255,255,255,.48)' };
    }

    function _renderWindowsUpdatePackages(status, updates) {
        const progress = Array.isArray(status.packageProgress) ? status.packageProgress : [];
        if (!progress.length) {
            if (!updates.length)
                return `<div style="padding-top:4px;color:rgba(255,255,255,.42);">${_t('windowsUpdateNoneListed', 'Nenhuma atualização listada.')}</div>`;
            return updates.map(update => {
                const size = _formatWindowsUpdateSize(update.sizeBytes);
                const downloaded = update.isDownloaded
                    ? _t('windowsUpdateDownloaded', 'Baixado')
                    : _t('windowsUpdatePending', 'Pendente');
                return `
                    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:7px 0;border-top:1px solid rgba(255,255,255,.06);">
                        <span style="min-width:0;color:rgba(255,255,255,.72);">${_esc(update.title || 'Atualização do Windows')}</span>
                        <span style="flex:0 0 auto;color:rgba(255,255,255,.42);">${_esc([downloaded, size].filter(Boolean).join(' - '))}</span>
                    </div>`;
            }).join('');
        }

        const updatesById = new Map(updates.map(update => [String(update.updateId || '').toLowerCase(), update]));
        return progress.map(item => {
            const update = updatesById.get(String(item.updateId || '').toLowerCase());
            const state = _windowsUpdatePackageState(item);
            const percent = Math.max(0, Math.min(100, Number(item.percent) || 0));
            const detail = [state.text, `${Math.round(percent)}%`, _formatWindowsUpdateSize(update?.sizeBytes)]
                .filter(Boolean)
                .join(' - ');
            return `
                <div style="display:grid;gap:7px;padding:10px 0;border-top:1px solid rgba(255,255,255,.06);">
                    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:14px;">
                        <span style="min-width:0;color:rgba(255,255,255,.72);line-height:1.35;">${_esc(item.title || update?.title || 'Atualização do Windows')}</span>
                        <span style="flex:0 0 auto;color:${state.color};font-size:.8rem;">${_esc(detail)}</span>
                    </div>
                    <div style="height:4px;overflow:hidden;border-radius:2px;background:rgba(255,255,255,.10);">
                        <div style="height:100%;width:${percent}%;background:rgba(255,255,255,.72);transition:width .18s linear;"></div>
                    </div>
                </div>`;
        }).join('');
    }

    function _updateWindowsUpdateUI() {
        const status = _windowsUpdateStatus || {};
        const updates = Array.isArray(status.updates) ? status.updates : [];
        const badge = document.getElementById('windowsUpdateBadge');
        const title = document.getElementById('windowsUpdateTitle');
        const sub = document.getElementById('windowsUpdateSub');
        const meta = document.getElementById('windowsUpdateMeta');
        const list = document.getElementById('windowsUpdateList');
        const checkBtn = document.getElementById('navCardCheckWindowsUpdates');
        const startBtn = document.getElementById('navCardStartWindowsUpdate');
        const restartBtn = document.getElementById('navCardRestartWindows');

        const active = ['checking', 'downloading', 'installing'].includes(status.status);
        const hasUpdates = updates.length > 0;
        const tabState = document.getElementById('updatesTabWindowsState');

        if (tabState) {
            tabState.textContent = status.rebootRequired
                ? 'Reinício pendente'
                : active
                    ? 'Atualização em andamento'
                    : hasUpdates
                        ? `${updates.length} atualização(ões)`
                        : status.status === 'error'
                            ? 'Falha na verificação'
                            : 'Windows atualizado';
        }

        if (badge) {
            badge.textContent = status.rebootRequired
                ? _t('restartNow', 'Reiniciar agora').toUpperCase()
                : active
                    ? _t('windowsUpdateProcessing', 'PROCESSANDO')
                    : hasUpdates
                        ? _t('windowsUpdateAvailable', 'DISPONÍVEL')
                        : status.status === 'error'
                            ? 'ERRO'
                            : status.status === 'access-denied'
                                ? 'WINDOWS'
                                : _t('windowsUpdateUpdated', 'ATUALIZADO');
            badge.dataset.state = status.status || 'idle';
        }

        if (title) {
            title.textContent = status.rebootRequired
                ? _t('windowsUpdateRestartTitle', 'Windows Update - reinício pendente')
                : hasUpdates
                    ? _t('windowsUpdateFoundTitle', 'Windows Update - atualizações encontradas')
                    : 'Windows Update';
        }

        if (sub) {
            sub.textContent = status.message || _t('windowsUpdateIdle', 'Atualizações do Windows ainda não verificadas.');
        }

        if (meta) {
            const visiblePackageCount = Array.isArray(status.packageProgress) && status.packageProgress.length
                ? status.packageProgress.length
                : updates.length;
            meta.innerHTML = `
                <span>${_t('windowsUpdatePackages', `${visiblePackageCount} pacote(s)`, visiblePackageCount)}</span>
                ${active ? `<span>${_t('windowsUpdateOverall', `${Math.max(0, Math.min(100, Number(status.overallPercent) || 0))}% geral`, Math.max(0, Math.min(100, Number(status.overallPercent) || 0)))}</span>` : ''}
                <span>${_t('windowsUpdateLastCheck', `Última verificação: ${_formatWindowsUpdateDate(status.lastCheckedAt)}`, _esc(_formatWindowsUpdateDate(status.lastCheckedAt)))}</span>
            `;
        }

        if (list) {
            list.innerHTML = _renderWindowsUpdatePackages(status, updates);
        }

        if (checkBtn) {
            const label = checkBtn.querySelector('.nav-suggestion-card-btn');
            if (label) label.textContent = _windowsUpdateActionLabel(status.status);
            checkBtn.dataset.busy = active ? 'true' : 'false';
            checkBtn.setAttribute('aria-disabled', active ? 'true' : 'false');
        }

        if (startBtn) {
            const visible = hasUpdates && !active && !status.rebootRequired;
            startBtn.classList.toggle('visible', visible);
            startBtn.style.display = visible ? '' : 'none';
        }

        if (restartBtn) {
            const visible = !!status.rebootRequired;
            restartBtn.classList.toggle('visible', visible);
            restartBtn.style.display = visible ? '' : 'none';
        }

        if (window._updateBootModeUI && document.getElementById('windowsUpdatePanel')) {
            window._updateBootModeUI();
        }
    }

    function _gpuVendorName(vendor) {
        const v = String(vendor || '').toLowerCase();
        if (v === 'nvidia') return 'NVIDIA';
        if (v === 'amd') return 'AMD';
        if (v === 'intel') return 'Intel';
        return vendor || 'GPU';
    }

    function _gpuUpdaterInitials(app) {
        const base = _gpuVendorName(_readGpuProp(app, 'vendor')) || _readGpuProp(app, 'name') || 'APP';
        return String(base).replace(/[^a-z0-9]/gi, '').slice(0, 3).toUpperCase() || 'APP';
    }

    function _readGpuProp(obj, key) {
        if (!obj) return '';
        const pascal = key.charAt(0).toUpperCase() + key.slice(1);
        return obj[key] ?? obj[pascal] ?? '';
    }

    function _updateGpuUpdateUI() {
        const status = _gpuUpdateStatus || {};
        const adapters = Array.isArray(status.adapters) ? status.adapters : [];
        const updaters = Array.isArray(status.updaters) ? status.updaters : [];
        const badge = document.getElementById('gpuUpdateBadge');
        const title = document.getElementById('gpuUpdateTitle');
        const sub = document.getElementById('gpuUpdateSub');
        const meta = document.getElementById('gpuUpdateMeta');
        const list = document.getElementById('gpuAdapterList');
        const actions = document.getElementById('gpuUpdateActionsGrid');
        const tabState = document.getElementById('updatesTabGpuState');

        if (tabState) {
            tabState.textContent = status.status === 'error'
                ? 'Falha na detecção'
                : !adapters.length
                    ? 'Nenhuma GPU detectada'
                    : !updaters.length
                        ? 'Atualizador não configurado'
                        : `${updaters.length} atualizador(es)`;
        }

        if (badge) {
            badge.textContent = status.status === 'error'
                ? 'ERRO'
                : !adapters.length
                    ? 'SEM GPU'
                    : !updaters.length
                        ? 'SEM APP'
                        : 'DETECTADO';
            badge.dataset.state = status.status || 'idle';
        }

        if (title) title.textContent = 'Placa de vídeo';
        if (sub) sub.textContent = status.message || 'Dados de placa de vídeo ainda não carregados.';

        if (meta) {
            meta.innerHTML = `
                <span>${adapters.length} adaptador(es)</span>
                <span>${updaters.length} app(s) configurado(s)</span>
                <span>Última leitura: ${_esc(_formatWindowsUpdateDate(status.lastCheckedAt))}</span>
            `;
        }

        if (list) {
            list.innerHTML = adapters.length
                ? adapters.map(adapter => `
                    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:7px 0;border-top:1px solid rgba(255,255,255,.06);">
                        <span style="min-width:0;color:rgba(255,255,255,.72);">${_esc(_readGpuProp(adapter, 'name') || _gpuVendorName(_readGpuProp(adapter, 'vendor')))}</span>
                        <span style="flex:0 0 auto;color:rgba(255,255,255,.42);">${_esc([_gpuVendorName(_readGpuProp(adapter, 'vendor')), _readGpuProp(adapter, 'driverVersion') || '--'].filter(Boolean).join(' - '))}</span>
                    </div>
                `).join('')
                : `<div style="padding-top:4px;color:rgba(255,255,255,.42);">Nenhum driver de vídeo detectado.</div>`;
        }

        if (actions) {
            actions.innerHTML = `
                <div class="nav-gpu-app-grid">
                    ${updaters.map(app => {
                        const id = _readGpuProp(app, 'id');
                        const name = _readGpuProp(app, 'name') || 'Atualizador';
                        const vendor = _readGpuProp(app, 'vendor');
                        const source = _readGpuProp(app, 'source');
                        const imageUrl = _readGpuProp(app, 'imageUrl');
                        const iconDataUrl = _readGpuProp(app, 'iconDataUrl');
                        return `
                        <div class="nav-gpu-app-card" data-gpu-action="open" data-updater-id="${_esc(id)}" data-gpu-updater-card="true" tabindex="-1" role="button">
                            <div class="nav-gpu-app-art">
                                ${imageUrl ? `<div class="nav-gpu-app-cover" style="background-image:url('${_esc(imageUrl)}')"></div>` : (iconDataUrl ? `<img src="${_esc(iconDataUrl)}" alt="">` : `<div class="nav-gpu-app-fallback">${_esc(_gpuUpdaterInitials(app))}</div>`)}
                            </div>
                            <div class="nav-gpu-app-copy">
                                <div class="nav-gpu-app-name">${_esc(name)}</div>
                                <div class="nav-gpu-app-meta">${_esc(_gpuVendorName(vendor))} · ${_esc(source === 'manual' ? 'Adicionado manualmente' : 'Detectado automaticamente')}</div>
                            </div>
                        </div>
                    `}).join('')}
                    <div class="nav-gpu-app-card nav-gpu-app-add" data-gpu-action="add" tabindex="-1" role="button">
                        <div class="nav-gpu-app-art"><div class="nav-gpu-app-fallback">+</div></div>
                        <div class="nav-gpu-app-copy">
                            <div class="nav-gpu-app-name">Adicionar app</div>
                            <div class="nav-gpu-app-meta">Escolha outro atualizador instalado no Windows.</div>
                        </div>
                    </div>
                </div>
            `;
        }

        if (window._updateBootModeUI && document.getElementById('gpuUpdatePanel')) {
            window._updateBootModeUI();
        }
    }

    window._navMenuSetGpuUpdateStatus = function (status) {
        _gpuUpdateStatus = { ..._gpuUpdateStatus, ...(status || {}) };
        _updateGpuUpdateUI();
    };

