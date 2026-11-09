    function _startBlobBg() {
        const canvas = document.getElementById('navMenuBg');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        const blobs = [
            { px: 0.0, py: 0.3, sx: 0.00018, sy: 0.00013, r: 0.62, color: [45, 65, 185] },
            { px: 1.2, py: 2.1, sx: 0.00014, sy: 0.00019, r: 0.56, color: [28, 85, 210] },
            { px: 2.5, py: 0.8, sx: 0.00022, sy: 0.00011, r: 0.52, color: [70, 50, 165] },
            { px: 0.7, py: 3.4, sx: 0.00016, sy: 0.00024, r: 0.50, color: [22, 110, 175] },
            { px: 3.1, py: 1.6, sx: 0.00012, sy: 0.00017, r: 0.46, color: [90, 70, 195] },
            { px: 1.8, py: 4.2, sx: 0.00020, sy: 0.00015, r: 0.42, color: [30, 130, 190] },
        ];

        let t = 0;

        function resize() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }
        resize();
        window.addEventListener('resize', resize);

        function frame() {
            const W = canvas.width, H = canvas.height;
            ctx.clearRect(0, 0, W, H);
            ctx.fillStyle = '#07071a';
            ctx.fillRect(0, 0, W, H);

            blobs.forEach(b => {
                const x = W * (0.15 + 0.7 * (0.5 + 0.5 * Math.sin(t * b.sx + b.px)));
                const y = H * (0.10 + 0.8 * (0.5 + 0.5 * Math.sin(t * b.sy + b.py)));
                const r = Math.min(W, H) * b.r;
                const g = ctx.createRadialGradient(x, y, 0, x, y, r);
                const [cr, cg, cb] = b.color;
                g.addColorStop(0, `rgba(${cr},${cg},${cb},0.55)`);
                g.addColorStop(0.4, `rgba(${cr},${cg},${cb},0.22)`);
                g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
                ctx.fillStyle = g;
                ctx.beginPath();
                ctx.ellipse(x, y, r, r * 0.72, t * 0.00004, 0, Math.PI * 2);
                ctx.fill();
            });

            const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.85);
            vig.addColorStop(0, 'rgba(0,0,0,0)');
            vig.addColorStop(1, 'rgba(0,0,18,0.62)');
            ctx.fillStyle = vig;
            ctx.fillRect(0, 0, W, H);

            t++;
            _bgRaf = requestAnimationFrame(frame);
        }
        frame();
    }

    function _stopBlobBg() {
        if (_bgRaf) { cancelAnimationFrame(_bgRaf); _bgRaf = null; }
    }

    function _t(key, fallback, ...args) {
        try {
            if (typeof t === 'function') {
                const res = t(key, ...args);
                if (res) return res;
            }
            if (args.length > 0 && fallback) {
                return fallback.replace(/\{0\}|%d/g, args[0]);
            }
            return fallback;
        }
        catch { return fallback; }
    }

    function _esc(value) {
        return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    }

    function _storePolicyKeyFromGame(item) {
        const source = item?.Source || item?.source || '';
        if (source) return source;
        const launch = item?.LaunchUrl || item?.launchUrl || '';
        if (/^steam:/i.test(launch)) return 'Steam';
        if (/^com\.epicgames\.launcher:/i.test(launch)) return 'Epic';
        if (/^goggalaxy:/i.test(launch)) return 'GOG';
        if (/^riot/i.test(launch)) return 'Riot';
        if (/^(xbox:|ms-xbl-)/i.test(launch)) return 'Xbox';
        return '';
    }

    function _isAdminLockedGame(item) {
        if (item?.IsAdminLocked || item?.isAdminLocked) return true;
        if (window._doorpiIsAdmin || window._doorpiProfile?.IsAdmin || window._doorpiProfile?.isAdmin) return false;
        const key = _storePolicyKeyFromGame(item);
        return !!key && window._adminBlockedStoreIds instanceof Set && window._adminBlockedStoreIds.has(key);
    }

    const ADMIN_LOCK_ICON_SVG = `
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="5.5" y="10" width="13" height="10" rx="2.2" stroke="currentColor" stroke-width="2"/>
            <path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>`;

    function _userId(user) {
        if (typeof user === 'string') return user;
        return user?.Id || user?.id || user?.UserId || user?.userId || '';
    }

    function _userName(user) {
        return user?.Name || user?.name || _t('defaultUser', 'Usuario');
    }

    function _sameId(a, b) {
        return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
    }

    function _appId(app) {
        return app?.Id || app?.id || app?.Url || app?.url || '';
    }

    function _appName(app) {
        return app?.Name || app?.name || _appId(app);
    }

    function _appType(app) {
        return String(app?.Type || app?.type || app?.appType || 'browser').toLowerCase();
    }

    function _isWebAccountApp(app) {
        const type = _appType(app);
        return type === 'browser' || type === 'webview';
    }

    // ── Categorias ────────────────────────────────────────────────────────────
    const CATS = [
        { id: 'games', icon: '⊞', get label() { return _t('navGames', 'Jogos'); } },
        { id: 'media', icon: '▶', get label() { return _t('navMedia', 'Aplicativos'); } },
        { id: 'settings', icon: '⚙', get label() { return _t('navSettings', 'Configurações'); } },
        { id: 'profile', icon: '◉', get label() { return _t('navProfile', 'Perfil'); } },
    ];

    // ── Estado ────────────────────────────────────────────────────────────────
    let _catIdx = 0;
    let _topbarFocus = true;
    let _contentIdx = 0;
    let _contentItems = [];
    const _libraryFocusMemory = {
        games: { key: '', index: 0 },
        media: { key: '', index: 0 }
    };
    let _libraryHoldDirection = '';
    let _libraryHoldStartedAt = 0;
    let _libraryHoldSawNativeInput = false;
    let _libraryRapidNavigation = false;
    let _libraryHoldRaf = 0;
    let _libraryRapidScrollPane = null;
    let _libraryRapidScrollTarget = 0;
    let _libraryRapidScrollRaf = 0;
    let _overlay = null;
    let _bgRaf = null;
    let _lastFocus = null;
    let _settingsSubView = null;
    let _profileSubView = null;
    let _profileTabTransitionDirection = 'forward';
    let _profileOverviewHeroIndex = 0;
    let _profileOverviewCarouselTimer = 0;
    let _profileOverviewAdvance = null;
    let _profileOverviewCarouselPaused = false;
    let _profileOverviewStoredKind = '';
    try {
        _profileOverviewCarouselPaused = localStorage.getItem('doorpi.profile.hero.paused') === '1';
        _profileOverviewStoredKind = localStorage.getItem('doorpi.profile.hero.kind') || '';
    } catch (_) {}
    let _systemSubView = null;
    let _settingsReturnToRoot = false;
    let _systemUpdatesSubView = 'doorpi';
    let _releaseNotesScrollActive = false;
    let _sharingFocusAppId = '';
    let _sharingSubView = 'apps';
    let _sharingFocusStoreId = 'Steam';
    let _preserveSettingsSubViewOnce = false;
    let _autoStartEnabled = false;
    let _systemUpdateStatus = {
        status: 'idle',
        message: 'Atualizações ainda não verificadas.',
        localDoorpiVersion: '',
        localUpdaterVersion: '',
        remoteDoorpiVersion: '',
        remoteUpdaterVersion: '',
        doorpiUpdateAvailable: false,
        updaterUpdateAvailable: false,
        forceUpdate: false,
        lastCheckedAt: '',
        changelog: []
    };
    let _windowsUpdateStatus = {
        status: 'idle',
        message: 'Atualizações do Windows ainda não verificadas.',
        lastCheckedAt: '',
        rebootRequired: false,
        updates: [],
        packageProgress: [],
        error: ''
    };
    let _gpuUpdateStatus = {
        status: 'idle',
        message: 'Dados de placa de vídeo ainda não carregados.',
        lastCheckedAt: '',
        adapters: [],
        updaters: []
    };
    let _bluetoothUpdateStatus = null;
    let _bluetoothRenderTimer = 0;
    let _wifiUpdateStatus = null;
    let _storageStatus = null;
    let _storagePrograms = null;
    let _storageView = 'overview';
    let _storageSelectedRoot = '';
    let _storageSelectedCategoryKey = 'applications';
    let _storageSelectedProgramId = '';
    let _storagePendingUninstallId = '';
    let _storageUninstallStatus = null;
    const _storageExpandedCategories = new Set();
    const NAV_MENU_TRANSITION_MS = 600;
    let _navMenuTransitionTimer = 0;
    let _navMenuTransitionToken = 0;
    let _navMenuTransitionCleanup = null;
    let _navMenuPhase = 'closed';
    window._navMenuPhase = _navMenuPhase;
    let _navMenuLifecycleToken = 0;

