    // Remove as propriedades complexas antigas (isMediaAppActive anterior)
    window.isMediaAppActive = false;

    window.DoorpiRuntimeState = {
        running: []
    };
    window._currentWebAppConflictEntry = null;
    window._lastExecutionLockData = null;
    window._executionLockRequestUntil = 0;
    window._executionOverlayCloseTimer = 0;
    window._executionOverlayRefreshTimer = 0;
    window._executionOverlayVisualKey = '';

    function _clearExecutionOverlayCloseTimer() {
        if (window._executionOverlayCloseTimer) {
            clearTimeout(window._executionOverlayCloseTimer);
            window._executionOverlayCloseTimer = 0;
        }
    }

    function _stopExecutionOverlayRefreshLoop() {
        if (window._executionOverlayRefreshTimer) {
            clearInterval(window._executionOverlayRefreshTimer);
            window._executionOverlayRefreshTimer = 0;
        }
    }

    function _bestExecutionLockDataFromRuntime() {
        const candidates = _nonMinimizedRuntimeEntries();
        if (!candidates.length) return null;
        const candidate = candidates
            .slice()
            .sort((a, b) => _runtimeEntryPriority(b) - _runtimeEntryPriority(a))[0];
        return _buildExecutionLockDataFromRuntimeEntry(candidate);
    }

    function _executionStoreGameVisualPair(lockData) {
        if (!lockData) return null;
        const lockIsGame = lockData.channel === 'games' || lockData.kind === 'game';
        if (!lockIsGame) return null;

        const entries = Array.isArray(window.DoorpiRuntimeState?.running) ? window.DoorpiRuntimeState.running : [];
        const gameEntries = entries.filter(e => e && (e.channel === 'games' || e.kind === 'game'));
        const storeEntries = entries.filter(e => e && (e.channel === 'stores' || e.kind === 'store'));
        if (!gameEntries.length || !storeEntries.length) return null;

        const bestGame = gameEntries.slice().sort((a, b) => _runtimeEntryPriority(b) - _runtimeEntryPriority(a))[0];
        const bestStore = storeEntries.slice().sort((a, b) => _runtimeEntryPriority(b) - _runtimeEntryPriority(a))[0];
        const gameVisual = _buildExecutionLockDataFromRuntimeEntry(bestGame) || {};
        const storeVisual = _buildExecutionLockDataFromRuntimeEntry(bestStore) || {};

        const game = {
            name: gameVisual.name || lockData.name || t('genericGameName'),
            image: gameVisual.gridImage || gameVisual.heroImage || lockData.gridImage || lockData.heroImage || ''
        };
        const store = {
            name: storeVisual.name || t('genericStoreName'),
            image: storeVisual.gridImage || storeVisual.heroImage || ''
        };
        return { game, store };
    }

    function _executionOverlayVisualKeyFor(lockData) {
        const base = [
            lockData?.kind || '',
            lockData?.channel || '',
            lockData?.id || '',
            lockData?.url || '',
            lockData?.appType || '',
            lockData?.name || '',
            lockData?.heroImage || '',
            lockData?.gridImage || ''
        ].join('|');
        const pair = _executionStoreGameVisualPair(lockData);
        if (!pair) return `${base}|pair:none`;
        const pairSig = [
            pair.store?.name || '',
            pair.store?.image || '',
            pair.game?.name || '',
            pair.game?.image || ''
        ].join('|');
        return `${base}|pair:${pairSig}`;
    }

    function _executionTargetKey(data) {
        if (!data) return '';
        if (data.url) return `url:${data.url}`;
        if (data.id) return `id:${data.id}`;
        return '';
    }

    function _refreshExecutionOverlayFromRuntime() {
        if (!_isExecutionOverlayVisible()) return false;
        if (!_hasAnyRuntimeSession()) return false;

        const current = window._lastExecutionLockData || {};
        const best = _bestExecutionLockDataFromRuntime();
        let hydrated = null;

        if (best && (best.id || best.url)) {
            hydrated = _hydrateExecutionLockPayload(best);
        } else {
            hydrated = _hydrateExecutionLockPayload(current);
        }

        if (!(hydrated.id || hydrated.url)) return false;

        const prev = window._lastExecutionLockData || {};
        const prevTargetKey = _executionTargetKey(prev);
        const hydratedTargetKey = _executionTargetKey(hydrated);
        const isSameTarget = !!prevTargetKey && !!hydratedTargetKey && prevTargetKey === hydratedTargetKey;

        const next = {
            kind: hydrated.kind || '',
            channel: hydrated.channel || '',
            id: hydrated.id || '',
            url: hydrated.url || '',
            appType: hydrated.appType || '',
            name: hydrated.name || (isSameTarget ? (prev.name || '') : ''),
            heroImage: hydrated.heroImage || (isSameTarget ? (prev.heroImage || '') : ''),
            gridImage: hydrated.gridImage || (isSameTarget ? (prev.gridImage || '') : '')
        };
        const changed =
            (prev.kind || '') !== next.kind ||
            (prev.channel || '') !== next.channel ||
            (prev.id || '') !== next.id ||
            (prev.url || '') !== next.url ||
            (prev.appType || '') !== next.appType ||
            (prev.name || '') !== next.name ||
            (prev.heroImage || '') !== next.heroImage ||
            (prev.gridImage || '') !== next.gridImage;

        const nextVisualKey = _executionOverlayVisualKeyFor(next);
        if (!changed && nextVisualKey === (window._executionOverlayVisualKey || '')) return false;

        window._lastExecutionLockData = next;
        window._executionOverlayVisualKey = nextVisualKey;
        GameLaunchOverlay.showExecutionLock(next);
        return true;
    }

    function _ensureExecutionOverlayRefreshLoop() {
        if (window._executionOverlayRefreshTimer) return;
        window._executionOverlayRefreshTimer = setInterval(() => {
            if (!_hasAnyRuntimeSession()) return;
            if (!_isExecutionOverlayVisible()) return;
            _refreshExecutionOverlayFromRuntime();
        }, 260);
    }

    function _runtimeCardKey(card) {
        if (!card) return '';
        return card.dataset.gameId || card.dataset.appUrl || card.dataset.appId || card.dataset.id || '';
    }

    function _runtimeEntryMatchesCard(entry, card) {
        if (!entry || !card) return false;
        const gameId = card.dataset.gameId || '';
        const appId = card.dataset.appId || '';
        const appUrl = card.dataset.appUrl || '';
        return (!!entry.id && (entry.id === gameId || entry.id === appId || entry.id === card.dataset.id)) ||
            (!!entry.url && entry.url === appUrl);
    }

    function _runtimeEntryForCard(card) {
        return (window.DoorpiRuntimeState?.running || []).find(entry => _runtimeEntryMatchesCard(entry, card));
    }

    window.isCardRuntimeRunning = function isCardRuntimeRunning(card) {
        return !!_runtimeEntryForCard(card);
    };

    window.applyRuntimeStateToCard = function applyRuntimeStateToCard(card) {
        if (!card || card.classList.contains('add-card')) return;

        const entry = _runtimeEntryForCard(card);
        const isRunning = !!entry;
        card.classList.toggle('is-running', isRunning);
        card.dataset.runtimeStatus = isRunning ? (entry.status || 'running') : '';

        const isHomeCard = !!card.closest?.('.home-library-rail');
        let top = card.querySelector('.runtime-badge-top');
        let bottom = card.querySelector('.runtime-badge-bottom');
        let homeMark = card.querySelector('.doorpi-home-card-running-mark');

        if (isRunning) {
            const runningLabel = typeof t === 'function' ? t('runningLabel') : 'Em execução';
            if (isHomeCard) {
                top?.remove();
                bottom?.remove();
                if (!homeMark) {
                    homeMark = document.createElement('div');
                    homeMark.className = 'doorpi-home-card-running-mark';
                    homeMark.setAttribute('role', 'img');
                    homeMark.innerHTML = `
                        <svg class="doorpi-home-card-running-svg" viewBox="0 0 36 36" aria-hidden="true" focusable="false">
                            <circle class="doorpi-home-card-running-surface" cx="18" cy="18" r="16.5"></circle>
                            <path class="doorpi-home-card-running-glyph" d="M14.2 11.9c0-1.06 1.17-1.7 2.06-1.13l9.02 5.85c1 .65 1 2.11 0 2.76l-9.02 5.85c-.89.58-2.06-.06-2.06-1.13V11.9Z"></path>
                        </svg>`;
                    card.appendChild(homeMark);
                }
                homeMark.setAttribute('aria-label', runningLabel);
            } else {
                homeMark?.remove();
                if (!top) {
                    top = document.createElement('div');
                    top.className = 'runtime-badge-top';
                    card.appendChild(top);
                }
                if (!bottom) {
                    bottom = document.createElement('div');
                    bottom.className = 'runtime-badge-bottom';
                    card.appendChild(bottom);
                }

                top.textContent = runningLabel;
                bottom.textContent = typeof t === 'function' ? t('resumeLabel') : 'Retomar';
            }
        } else {
            top?.remove();
            bottom?.remove();
            homeMark?.remove();
        }

        if (isHomeCard) {
            window.updateHomeFeatureRuntimeState?.(card);
        }
    };

    function refreshRuntimeCards() {

        document.querySelectorAll('.card:not(.add-card), .nav-vertical-card').forEach(card => window.applyRuntimeStateToCard(card));
    }

    function _escapeForSelector(value) {
        const raw = String(value ?? '');
        if (!raw) return '';
        if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(raw);
        return raw.replace(/["\\]/g, '\\$&');
    }

    function _runtimeCardFromEntry(entry) {
        if (!entry) return null;
        const selectors = [];
        if (entry.id) {
            const sid = _escapeForSelector(entry.id);
            selectors.push(`.card[data-game-id="${sid}"]`, `.card[data-app-id="${sid}"]`, `.nav-vertical-card[data-game-id="${sid}"]`, `.nav-vertical-card[data-app-id="${sid}"]`);
        }
        if (entry.url) {
            const surl = _escapeForSelector(entry.url);
            selectors.push(`.card[data-app-url="${surl}"]`, `.nav-vertical-card[data-app-url="${surl}"]`);
        }
        for (const selector of selectors) {
            const card = document.querySelector(selector);
            if (card) return card;
        }
        return null;
    }

    function _runtimeEntryPriority(entry) {
        if (!entry) return -9999;
        let score = 0;
        if (entry.status === 'active') score += 120;
        else if (entry.status === 'running') score += 80;
        else if (entry.status === 'minimized') score -= 40;

        if (entry.kind === 'storeInstall' || entry.appType === 'storeInstall') score += 260;
        if (entry.channel === 'games') score += 300;
        else if (entry.channel === 'stores') score += 180;
        else if (entry.channel === 'media') score += 120;

        if (entry.kind === 'game') score += 120;
        else if (entry.kind === 'storeInstall') score += 100;
        else if (entry.kind === 'store') score += 80;
        else if (entry.kind === 'exe') score += 60;
        else if (entry.kind === 'web') score += 40;
        return score;
    }

    function _buildExecutionLockDataFromRuntimeEntry(entry) {
        if (!entry) return null;
        const card = _runtimeCardFromEntry(entry);
        const nameFromCard = card?.querySelector('.title, .nav-vertical-card-title')?.textContent?.trim() || '';
        const cardImg = card?.querySelector('img')?.getAttribute('src') || '';
        const isExecutableMedia = entry.channel === 'media' && entry.kind === 'exe';
        const resolvedId = entry.id || (isExecutableMedia ? '' : (card?.dataset?.gameId || card?.dataset?.appId || ''));
        const resolvedUrl = entry.url || card?.dataset?.appUrl || '';
        const installFallbackName = (entry.kind === 'storeInstall' || entry.appType === 'storeInstall')
            ? t('storeInstallRunning')
            : '';
        const name =
            nameFromCard ||
            entry.name ||
            installFallbackName ||
            (entry.channel === 'games' ? t('runningGameName')
                : entry.channel === 'stores' ? t('runningStoreName')
                    : t('runningSessionName'));

        // Sem alvo acionável (id/url), não promovemos para evitar overlay "órfão".
        if (!resolvedId && !resolvedUrl) return null;

        return {
            kind: entry.kind || '',
            channel: entry.channel || '',
            id: resolvedId,
            url: resolvedUrl,
            appType: entry.appType || (entry.channel === 'games' ? 'game' : (entry.kind || '')),
            name,
            heroImage: card?.dataset?.staticHero || card?.dataset?.hero || entry.heroImage || '',
            gridImage: card?.dataset?.staticVertical || card?.dataset?.vertical || card?.dataset?.staticHorizontal || card?.dataset?.horizontal || entry.gridImage || cardImg || ''
        };
    }

    function _nonMinimizedRuntimeEntries() {
        return (Array.isArray(window.DoorpiRuntimeState?.running) ? window.DoorpiRuntimeState.running : [])
            .filter(entry => entry && entry.status !== 'minimized' && entry.status !== 'launching');
    }

    function _findRuntimeEntryForLockTarget(target) {
        const entries = _nonMinimizedRuntimeEntries();
        if (!entries.length) return null;

        const byId = entries.find(entry => target.id && entry.id && entry.id === target.id);
        if (byId) return byId;

        const byUrl = entries.find(entry => target.url && entry.url && entry.url === target.url);
        if (byUrl) return byUrl;

        const byKindAndChannel = entries.find(entry =>
            (!target.kind || entry.kind === target.kind) &&
            (!target.channel || entry.channel === target.channel));
        if (byKindAndChannel) return byKindAndChannel;

        return entries
            .slice()
            .sort((a, b) => _runtimeEntryPriority(b) - _runtimeEntryPriority(a))[0] || null;
    }

    function _hydrateExecutionLockPayload(raw) {
        const payload = {
            kind: raw.kind || '',
            channel: raw.channel || '',
            id: raw.id || '',
            url: raw.url || '',
            appType: raw.appType || '',
            name: raw.name || raw.gameName || '',
            heroImage: raw.heroImage || '',
            gridImage: raw.gridImage || ''
        };
        const fallbackName =
            payload.kind === 'game' || payload.channel === 'games' ? t('runningGameName') :
                payload.kind === 'storeInstall' || payload.appType === 'storeInstall' ? t('storeInstallRunning') :
                payload.kind === 'store' || payload.channel === 'stores' ? t('runningStoreName') :
                    t('runningSessionName');

        const needsVisualContext = !payload.name || (!payload.heroImage && !payload.gridImage);
        if (!needsVisualContext) return payload;

        const matchedEntry = _findRuntimeEntryForLockTarget(payload);
        const fromRuntime = _buildExecutionLockDataFromRuntimeEntry(matchedEntry);
        if (!fromRuntime) {
            if (!payload.name) payload.name = fallbackName;
            return payload;
        }

        return {
            kind: payload.kind || fromRuntime.kind || '',
            channel: payload.channel || fromRuntime.channel || '',
            id: payload.id || fromRuntime.id || '',
            url: payload.url || fromRuntime.url || '',
            appType: payload.appType || fromRuntime.appType || '',
            name: payload.name || fromRuntime.name || fallbackName,
            heroImage: payload.heroImage || fromRuntime.heroImage || '',
            gridImage: payload.gridImage || fromRuntime.gridImage || ''
        };
    }

    function _tryPromoteRuntimeToExecutionLock(force = false) {
        if (typeof postToHost !== 'function') return false;
        const launchOverlay = document.getElementById('gameLaunchOverlay');
        if (!launchOverlay) return false;
        if (!force && launchOverlay.classList.contains('execution-lock-visible')) return false;
        if (Date.now() < (window._executionLockRequestUntil || 0)) return false;

        const candidates = _nonMinimizedRuntimeEntries();
        if (!candidates.length) return false;

        const candidate = candidates
            .slice()
            .sort((a, b) => _runtimeEntryPriority(b) - _runtimeEntryPriority(a))[0];
        let data = _buildExecutionLockDataFromRuntimeEntry(candidate);
        if (!data || (!data.name && !data.id && !data.url)) return false;

        window._executionLockRequestUntil = Date.now() + 220;
        postToHost({
            action: 'requestExecutionLockFromRuntime',
            kind: data.kind || '',
            channel: data.channel || '',
            id: data.id || '',
            url: data.url || ''
        });
        return true;
    }

    function _hasAnyRuntimeSession() {
        return _nonMinimizedRuntimeEntries().length > 0;
    }

    function _hasActiveGameRuntimeSession() {
        return _nonMinimizedRuntimeEntries().some(entry =>
            entry &&
            (entry.channel === 'games' || entry.kind === 'game') &&
            (entry.status === 'running' || entry.status === 'active'));
    }

    function _shouldKeepExecutionOverlay() {
        if (Date.now() < (window._doorpiOfficialReturnSuppressUntil || 0)) return false;
        return _hasAnyRuntimeSession() || _isGpuUpdaterExecutionLockOwned();
    }

    function _ensureExecutionOverlayForActiveSession() {
        if (typeof GameLaunchOverlay === 'undefined') return false;
        const launchOverlay = document.getElementById('gameLaunchOverlay');
        const isVisibleExecution = !!(launchOverlay &&
            launchOverlay.classList.contains('visible') &&
            launchOverlay.classList.contains('execution-lock-visible'));
        if (isVisibleExecution) {
            if (!_hasAnyRuntimeSession()) {
                if (_isGpuUpdaterExecutionLockOwned()) return true;
                GameLaunchOverlay.hide();
                return false;
            }
            return _tryPromoteRuntimeToExecutionLock(true);
        }
        return _tryPromoteRuntimeToExecutionLock();
    }

    function _isExecutionOverlayVisible() {
        const launchOverlay = document.getElementById('gameLaunchOverlay');
        return !!(launchOverlay &&
            launchOverlay.classList.contains('visible') &&
            launchOverlay.classList.contains('execution-lock-visible'));
    }

    function _isGpuUpdaterExecutionLockOwned() {
        if (!_isExecutionOverlayVisible()) return false;
        const lock = window._lastExecutionLockData || {};
        return lock.kind === 'gpuUpdater' ||
            lock.appType === 'gpuUpdater' ||
            lock.channel === 'gpu';
    }

    function _isWaitingForValidGameWindowOverlayVisible() {
        const launchOverlay = document.getElementById('gameLaunchOverlay');
        if (!launchOverlay) return false;
        if (!launchOverlay.classList.contains('visible')) return false;
        if (!launchOverlay.classList.contains('state-loading')) return false;
        // A tela "aguardando janela do jogo" só aparece quando o botão de cancelar já foi liberado.
        const cancelBtn = document.getElementById('overlayCancelLaunchBtn');
        return !!(cancelBtn && cancelBtn.style.display !== 'none');
    }

    function _isAnyLaunchLoadingOverlayVisible() {
        const launchOverlay = document.getElementById('gameLaunchOverlay');
        if (!launchOverlay) return false;
        if (!launchOverlay.classList.contains('visible')) return false;
        if (launchOverlay.classList.contains('execution-lock-visible')) return false;
        return launchOverlay.classList.contains('state-loading');
    }

    function _resolveRuntimeEntryName(entry) {
        if (!entry) return '';
        if (entry.name) return entry.name;
        const card = _runtimeCardFromEntry(entry);
        return card?.querySelector('.title, .nav-vertical-card-title')?.textContent?.trim() || '';
    }

    function _buildClosePayloadFromRuntimeEntry(entry) {
        if (!entry) return null;
        const kind = (entry.kind || '').toLowerCase();
        const appType = kind === 'web' ? 'webview'
            : kind === 'store' ? 'store'
                : kind === 'game' ? 'game'
                    : 'exe';
        return {
            id: entry.id || '',
            url: entry.url || '',
            channel: entry.channel || '',
            appType
        };
    }

    function _normalizeRuntimeTarget(value) {
        return String(value || '')
            .trim()
            .replace(/^"|"$/g, '')
            .replace(/\\/g, '/')
            .replace(/\/+$/, '')
            .toLowerCase();
    }

    function _runtimeEntryMatchesLaunchTarget(entry, item, launchId) {
        if (!entry) return false;

        const runtimeTargets = [entry.id, entry.url]
            .map(_normalizeRuntimeTarget)
            .filter(Boolean);
        const launchTargets = [item?.id, item?.url, launchId]
            .map(_normalizeRuntimeTarget)
            .filter(Boolean);

        return runtimeTargets.some(runtimeTarget => launchTargets.includes(runtimeTarget));
    }

    function _findSessionConflictEntry(item, launchId) {
        const entries = Array.isArray(window.DoorpiRuntimeState?.running) ? window.DoorpiRuntimeState.running : [];
        const channel = (item?.channel || '').toLowerCase();
        const appType = (item?.appType || '').toLowerCase();

        if (channel === 'games') {
            return entries.find(e =>
                (e.channel === 'games' || e.kind === 'game') &&
                !!e.id &&
                !_runtimeEntryMatchesLaunchTarget(e, item, launchId)
            ) || null;
        }

        if (channel === 'stores') {
            return entries.find(e =>
                (e.channel === 'stores' || e.kind === 'store') &&
                !!e.id &&
                !_runtimeEntryMatchesLaunchTarget(e, item, launchId)
            ) || null;
        }

        if (channel === 'media') {
            if (appType === 'webview' || appType === 'browser') {
                const runningWeb = entries.find(e =>
                    e.channel === 'media' &&
                    e.kind === 'web' &&
                    !_runtimeEntryMatchesLaunchTarget(e, item, launchId)
                );
                if (runningWeb) return runningWeb;

                const rememberedWeb = window._currentWebAppConflictEntry;
                if (rememberedWeb &&
                    rememberedWeb.channel === 'media' &&
                    rememberedWeb.kind === 'web' &&
                    !_runtimeEntryMatchesLaunchTarget(rememberedWeb, item, launchId)) {
                    return rememberedWeb;
                }

                return null;
            }

            if (appType === 'exe') {
                // Executaveis possuem sessoes independentes. Clicar no mesmo alvo
                // restaura a sessao existente; alvos diferentes podem coexistir.
                return null;
            }
        }

        return null;
    }

    let _sessionConflictOverlay = null;
    let _sessionConflictClosePayload = null;
    let _sessionConflictReturnFocusEl = null;

