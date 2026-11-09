    function _renderSettingsSystemUpdatesV2(body) {
        const active = _systemUpdatesSubView || 'doorpi';
        if (active !== 'doorpi') _releaseNotesScrollActive = false;
        const doorpiActive = active === 'doorpi';
        const windowsActive = active === 'windows';
        const gpuActive = active === 'gpu';
        if (!document.getElementById('nav-system-update-tabs-styles')) {
            const s = document.createElement('style');
            s.id = 'nav-system-update-tabs-styles';
            s.textContent = __doorpiCss("injected-styles/nav-menu/nav-system-update-tabs-styles.css");
            document.head.appendChild(s);
        }

        body.innerHTML = `
        <div class="nav-settings-subheader">
            <button class="nav-back-btn" id="setBackSystemUpdates" tabindex="-1">‹ ${_t('navBack', 'Voltar')}</button>
            <h2>${_t('updatesTitle', 'Atualizações')}</h2>
        </div>

        <div class="nav-updates-shell">
            <div class="nav-system-tabs">
                <button class="nav-system-tab ${doorpiActive ? 'active' : ''}" id="updatesTabDoorpi" data-updates-tab="doorpi" tabindex="-1"><strong>Doorpi</strong><small id="updatesTabDoorpiState">Sistema e componentes</small></button>
                <button class="nav-system-tab ${windowsActive ? 'active' : ''}" id="updatesTabWindows" data-updates-tab="windows" tabindex="-1"><strong>Windows</strong><small id="updatesTabWindowsState">Sistema operacional</small></button>
                <button class="nav-system-tab ${gpuActive ? 'active' : ''}" id="updatesTabGpu" data-updates-tab="gpu" tabindex="-1"><strong>${_t('videoCardTitle', 'Placa de vídeo')}</strong><small id="updatesTabGpuState">Drivers e atualizadores</small></button>
            </div>

            <section class="nav-update-view" data-update-panel="doorpi" ${doorpiActive ? '' : 'hidden'}>
            <div class="nav-update-panel" id="systemUpdatePanel">
                <div class="nav-update-overview">
                    <div class="nav-update-heading">
                        <span class="nav-update-state" id="systemUpdateBadge">${_t('sysUpdateBadgeUpdated', 'ATUALIZADO')}</span>
                        <h3 id="systemUpdateTitle">Doorpi</h3>
                        <p id="systemUpdateSub">${_t('sysUpdateIdle', 'Atualizações ainda não verificadas.')}</p>
                    </div>
                    <div class="nav-update-meta" id="systemUpdateVersions"></div>
                </div>
            </div>

            <div class="nav-suggestions-grid nav-update-actions" id="navUpdateActionsGrid">
                <button class="nav-suggestion-card visible" id="navCardCheckUpdates" tabindex="-1">
                    <div class="nav-suggestion-card-btn">${_t('checkDoorpi', 'Verificar Doorpi')}</div>
                    <span class="nav-suggestion-card-text">${_t('checkDoorpiDesc', 'Consulta atualizações do Doorpi, Updater e changelog.')}</span>
                </button>
                <button class="nav-suggestion-card nav-update-primary" id="navCardStartUpdate" tabindex="-1" style="display:none;">
                    <div class="nav-suggestion-card-btn">${_t('updateDoorpi', 'Atualizar Doorpi')}</div>
                    <span class="nav-suggestion-card-text">${_t('updateDoorpiDesc', 'Baixa o pacote validado, atualiza componentes e reinicia o Doorpi se necessário.')}</span>
                </button>
            </div>
            <section class="nav-release-notes" id="systemUpdateChangelog" role="region" aria-label="Notas da versão"></section>
            </section>

            <section class="nav-update-view" data-update-panel="windows" ${windowsActive ? '' : 'hidden'}>
            <div class="nav-update-panel" id="windowsUpdatePanel">
                <div class="nav-update-overview">
                    <div class="nav-update-heading">
                        <span class="nav-update-state" id="windowsUpdateBadge">WINDOWS</span>
                        <h3 id="windowsUpdateTitle">Windows Update</h3>
                        <p id="windowsUpdateSub">${_t('windowsUpdateIdle', 'Atualizações do Windows ainda não verificadas.')}</p>
                    </div>
                    <div class="nav-update-meta" id="windowsUpdateMeta"></div>
                </div>
                <div class="nav-update-list" id="windowsUpdateList"></div>
            </div>

            <div class="nav-windows-guidance">
                <p style="margin:0;color:rgba(255,255,255,.56);font-size:.84rem;line-height:1.42;"><strong style="color:rgba(255,255,255,.84);font-weight:650;">${_t('windowsUpdateAdminNoticeTitle', 'Permiss\u00e3o administrativa necess\u00e1ria.')}</strong> ${_t('windowsUpdateAdminNoticeText', 'O Windows solicitar\u00e1 autoriza\u00e7\u00e3o antes de baixar e instalar os pacotes selecionados.')}</p>
            </div>

            <div class="nav-suggestions-grid nav-update-actions" id="windowsUpdateActionsGrid">
                <button class="nav-suggestion-card visible" id="navCardCheckWindowsUpdates" tabindex="-1">
                    <div class="nav-suggestion-card-btn">${_t('checkWindows', 'Verificar Windows')}</div>
                    <span class="nav-suggestion-card-text">${_t('checkWindowsDesc', 'Consulta o Windows Update e lista os pacotes encontrados.')}</span>
                </button>
                <button class="nav-suggestion-card nav-update-primary" id="navCardStartWindowsUpdate" tabindex="-1" style="display:none;">
                    <div class="nav-suggestion-card-btn">${_t('windowsUpdateInstall', 'Baixar e instalar')}</div>
                    <span class="nav-suggestion-card-text">${_t('windowsUpdateInstallDesc', 'Usa a API do Windows Update para baixar e instalar em segundo plano.')}</span>
                </button>
                <button class="nav-suggestion-card nav-update-primary" id="navCardRestartWindows" tabindex="-1" style="display:none;">
                    <div class="nav-suggestion-card-btn">${_t('restartNow', 'Reiniciar agora')}</div>
                    <span class="nav-suggestion-card-text">${_t('windowsRestartDesc', 'Reinicia o computador para concluir atualizações pendentes.')}</span>
                </button>
                <button class="nav-suggestion-card visible" id="navCardOpenWindowsUpdate" tabindex="-1">
                    <div class="nav-suggestion-card-btn">${_t('quickOpenWindowsUpdate', 'Abrir Windows Update')}</div>
                    <span class="nav-suggestion-card-text">${_t('windowsOpenNativeDesc', 'Abre a tela nativa do Windows com mouse e teclado pelo controle.')}</span>
                </button>
            </div>
            </section>

            <section class="nav-update-view" data-update-panel="gpu" ${gpuActive ? '' : 'hidden'}>
            <div class="nav-update-panel" id="gpuUpdatePanel">
                <div class="nav-update-overview">
                    <div class="nav-update-heading">
                        <span class="nav-update-state" id="gpuUpdateBadge">GPU</span>
                        <h3 id="gpuUpdateTitle">Placa de vídeo</h3>
                        <p id="gpuUpdateSub">Dados de placa de vídeo ainda não carregados.</p>
                    </div>
                    <div class="nav-update-meta" id="gpuUpdateMeta"></div>
                </div>
                <div class="nav-update-list" id="gpuAdapterList"></div>
            </div>

            <div class="nav-gpu-guidance">
                <p><strong>${_t('gpuUpdaterAdminNoticeTitle', 'Permiss\u00e3o tempor\u00e1ria.')}</strong> ${_t('gpuUpdaterAdminNoticeText', 'Se o Windows pedir permiss\u00e3o, autorize o assistente do Doorpi para controlar instaladores elevados.')}</p>
                <p><strong>${_t('gpuUpdaterSessionNoticeTitle', 'Durante a atualiza\u00e7\u00e3o.')}</strong> ${_t('gpuUpdaterSessionNoticeText', 'N\u00e3o feche nem minimize o atualizador. Ao final, o Doorpi ser\u00e1 reiniciado para restaurar o renderizador.')}</p>
            </div>

            <div class="nav-suggestions-grid nav-update-actions" id="gpuUpdateActionsGrid"></div>
            </section>
        </div>`;

        const refreshItems = () => _wireSystemItems(body, [
            '#setBackSystemUpdates',
            '#updatesTabDoorpi',
            '#updatesTabWindows',
            '#updatesTabGpu',
            '#navCardCheckUpdates',
            '#navCardStartUpdate',
            '#navCardCheckWindowsUpdates',
            '#navCardStartWindowsUpdate',
            '#navCardRestartWindows',
            '#navCardOpenWindowsUpdate',
            '#gpuUpdateActionsGrid .nav-gpu-app-card'
        ]);

        window._updateBootModeUI = refreshItems;
        refreshItems();
        _updateSystemUpdateUI();
        _updateWindowsUpdateUI();
        _updateGpuUpdateUI();
        if (typeof postToHost === 'function') postToHost({ action: 'requestUpdateStatus' });
        if (typeof postToHost === 'function') postToHost({ action: 'requestWindowsUpdateStatus' });
        if (typeof postToHost === 'function') postToHost({ action: 'requestGpuUpdateStatus' });

        body.querySelector('#setBackSystemUpdates')?.addEventListener('click', () => {
            _returnFromSystemDetail();
        });
        body.querySelectorAll('[data-updates-tab]').forEach(btn => {
            btn.addEventListener('click', () => {
                _releaseNotesScrollActive = false;
                _systemUpdatesSubView = btn.dataset.updatesTab || 'doorpi';
                _contentIdx = _systemUpdatesSubView === 'gpu' ? 3 : (_systemUpdatesSubView === 'windows' ? 2 : 1);
                _renderContent('settings');
                _updateContentFocus();
            });
        });
        body.querySelector('#navCardCheckUpdates')?.addEventListener('click', () => {
            _systemUpdateStatus = { ..._systemUpdateStatus, status: 'checking', message: _t('quickCheckingDoorpi', 'Verificando atualizações do Doorpi...') };
            _updateSystemUpdateUI();
            postToHost?.({ action: 'checkSystemUpdates' });
        });
        body.querySelector('#navCardStartUpdate')?.addEventListener('click', () => {
            _systemUpdateStatus = { ..._systemUpdateStatus, status: 'installing', message: _t('sysUpdatePreparing', 'Preparando atualização...') };
            _updateSystemUpdateUI();
            postToHost?.({ action: 'startSystemUpdate' });
        });
        body.querySelector('#navCardCheckWindowsUpdates')?.addEventListener('click', () => {
            if (['checking', 'downloading', 'installing'].includes(_windowsUpdateStatus.status)) return;
            _windowsUpdateStatus = { ..._windowsUpdateStatus, status: 'checking', message: _t('quickCheckingWindows', 'Verificando atualizações do Windows...') };
            _updateWindowsUpdateUI();
            postToHost?.({ action: 'checkWindowsUpdates' });
        });
        body.querySelector('#navCardStartWindowsUpdate')?.addEventListener('click', () => {
            _windowsUpdateStatus = { ..._windowsUpdateStatus, status: 'downloading', message: _t('windowsUpdateDownloadingInstalling', 'Baixando e instalando atualizações do Windows...') };
            _updateWindowsUpdateUI();
            postToHost?.({ action: 'startWindowsUpdateInstall' });
        });
        body.querySelector('#navCardRestartWindows')?.addEventListener('click', () => {
            postToHost?.({ action: 'restartSystem' });
        });
        body.querySelector('#navCardOpenWindowsUpdate')?.addEventListener('click', () => {
            _showDesktopWarning('settings', () => postToHost?.({ action: 'openWindowsUpdateSettings' }));
        });
        body.querySelector('#gpuUpdateActionsGrid')?.addEventListener('click', (event) => {
            const card = event.target.closest?.('.nav-gpu-app-card');
            if (!card) return;
            const action = card.dataset.gpuAction || '';
            const updaterId = card.dataset.updaterId || '';
            if (action === 'open') {
                if (updaterId) postToHost?.({ action: 'openGpuUpdater', updaterId });
            } else if (action === 'add') {
                postToHost?.({ action: 'addGpuUpdater' });
            }
        });
    }

    async function _loadJSONs() {
        const domCards = Array.from(document.querySelectorAll('#gameGrid .card:not(.add-card)'));
        if (domCards.length > 0 && _menuData.games.length > 0) {
            const domMeta = new Map();
            domCards.forEach((c, i) => {
                domMeta.set(c.dataset.gameId, {
                    idx: i,
                    isNew: c.classList.contains('new-game')
                });
            });

            _menuData.games.forEach(item => {
                const key = item.LaunchUrl || item.Path || '';
                const meta = domMeta.get(key);
                if (meta?.isNew) item._isNew = true;
            });

            _menuData.games.sort((a, b) => {
                const aKey = a.LaunchUrl || a.Path || '';
                const bKey = b.LaunchUrl || b.Path || '';
                const aIdx = domMeta.get(aKey)?.idx ?? 999999;
                const bIdx = domMeta.get(bKey)?.idx ?? 999999;
                return aIdx - bIdx;
            });
        }
        let loadedGamesFromJson = false;
        let loadedMediaFromJson = false;
        try {
            const ts = new Date().getTime();
            const [uRes, gRes, hRes, mhRes, mRes, eRes] = await Promise.allSettled([
                fetch(`https://data.local/user.json?t=${ts}`),
                fetch(`https://data.local/games.json?t=${ts}`),
                fetch(`https://data.local/game-history.json?t=${ts}`),
                fetch(`https://data.local/media-history.json?t=${ts}`),
                fetch(`https://data.local/media.json?t=${ts}`),
                fetch(`https://data.local/emulators.json?t=${ts}`)
            ]);

            if (uRes.status === 'fulfilled' && uRes.value.ok) {
                const storedUser = await uRes.value.json();
                const liveUser = window._doorpiProfile || {};
                _menuData.user = {
                    ...storedUser,
                    ...liveUser,
                    HasSteamGridApiKey: !!(liveUser.HasSteamGridApiKey ?? storedUser.SteamGridApiKey),
                    HasPin: !!(liveUser.HasPin ?? storedUser.PinCode),
                    SteamGridApiKey: '',
                    PinCode: ''
                };
            }
            if (gRes.status === 'fulfilled' && gRes.value.ok) {
                const games = await gRes.value.json();
                _menuData.games = Array.isArray(games)
                    ? games.filter(g => !(g.IsPendingArtwork || g.isPendingArtwork) && !_isArtworkPending(g, 'games'))
                    : games;
                loadedGamesFromJson = true;
            }
            if (hRes.status === 'fulfilled' && hRes.value.ok) {
                const history = await hRes.value.json();
                _menuData.history = Array.isArray(history) ? history : [];
            }
            if (mhRes.status === 'fulfilled' && mhRes.value.ok) {
                const mediaHistory = await mhRes.value.json();
                _menuData.mediaHistory = Array.isArray(mediaHistory) ? mediaHistory : [];
            }
            if (mRes.status === 'fulfilled' && mRes.value.ok) {
                _menuData.media = await mRes.value.json();
                loadedMediaFromJson = true;
            }
            if (eRes.status === 'fulfilled' && eRes.value.ok) {
                const emulators = await eRes.value.json();
                _menuData.emulators = Array.isArray(emulators) ? emulators : [];
            }
            if ((!_menuData.emulators || _menuData.emulators.length === 0) && window._doorpiCurrentUserId) {
                try {
                    const userId = encodeURIComponent(String(window._doorpiCurrentUserId));
                    const userEmulators = await fetch(`https://data.local/users/${userId}/emulators.json?t=${ts}`);
                    if (userEmulators.ok) {
                        const emulators = await userEmulators.json();
                        _menuData.emulators = Array.isArray(emulators) ? emulators : [];
                    }
                } catch (_) { }
            }
        } catch (e) {
            console.warn("Fetch bloqueado pelo WebView (CORS). Usando fallback local...", e);
        }

        if (!_menuData.user || Object.keys(_menuData.user).length === 0) {
            _menuData.user = window._doorpiProfile || {};
        }
        const loadedUserId = _userId(_menuData.user) || window._doorpiCurrentUserId || '';
        if (loadedUserId) _menuDataUserId = loadedUserId;

        if (!loadedGamesFromJson && (!_menuData.games || _menuData.games.length === 0)) {
            const gameCards = Array.from(document.querySelectorAll('#gameGrid .card:not(.add-card)'));
            _menuData.games = gameCards.map(c => {
                let emulatorDiscPaths = [];
                try {
                    emulatorDiscPaths = JSON.parse(c.dataset.emulatorDiscPaths || '[]');
                } catch (_) { }
                return {
                    Name: c.querySelector('.title')?.innerText || '',
                    Path: c.dataset.path || c.dataset.gameId || '',
                    LaunchUrl: c.dataset.launchUrl || '',
                    EmulatorDiscPaths: Array.isArray(emulatorDiscPaths) ? emulatorDiscPaths : [],
                    GridImage: c.dataset.vertical || '',
                    GridStaticImage: c.dataset.staticVertical || ''
                };
            });
        }

        if (!loadedMediaFromJson && (!_menuData.media || _menuData.media.length === 0)) {
            const mediaCards = Array.from(document.querySelectorAll('#mediaGrid .card:not(.add-card)'));
            _menuData.media = mediaCards.map(c => ({
                Name: c.querySelector('.title')?.innerText || '',
                Url: c.dataset.gameId || c.dataset.appId || '',
                Type: 'browser',
                GridImage: c.dataset.vertical || '',
                GridStaticImage: c.dataset.staticVertical || ''
            }));
        }
    }

