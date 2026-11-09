    let allInstalledApps = [];
    let cachedFolders = null;
    let supportedStores = [];
    let currentSourceFilter = ['all'];
    let isFolderOperationInProgress = false;
    window.newGameIdsThisSession = new Set();
    window.recentlyOpenedIds = [];
    window.isGlobalLoading = false;
    window._doorpiUsers = [];
    window._doorpiCurrentUserId = '';
    window._pendingExtensionUpdates = {};
    window.DoorpiDisplayMetrics = { dpiScale: 1 };

    window.setDoorpiSessionLocked = function (locked) {
        const shouldLock = locked === true;
        document.body.classList.toggle('doorpi-session-locked', shouldLock);
        if (shouldLock) {
            window.stopHomeFeatureTrailer?.({ resumeAudio: false });
        }
    };

    window.DoorpiLayoutScale = (() => {
        const KEY = 'doorpi.layoutScale.v1';
        const MIN = 0.25;
        const MAX = 1.80;
        const DEFAULT = 1;
        let value = DEFAULT;

        function clamp(raw) {
            const n = Number(raw);
            if (!Number.isFinite(n)) return DEFAULT;
            return Math.max(MIN, Math.min(MAX, n));
        }

        function apply(raw, persistLocal = true) {
            value = clamp(raw);
            document.documentElement.style.setProperty('--doorpi-layout-scale', value.toFixed(2));
            if (persistLocal) {
                try { localStorage.setItem(KEY, value.toFixed(2)); } catch { }
            }
            window.dispatchEvent(new CustomEvent('doorpi:layout-scale-changed', { detail: { scale: value } }));
            return value;
        }

        function save(raw) {
            const next = apply(raw, true);
            if (typeof postToHost === 'function') {
                postToHost({ action: 'saveDisplaySettings', layoutScale: next });
            }
            return next;
        }

        function get() {
            return value;
        }

        function reset() {
            return save(DEFAULT);
        }

        try {
            const saved = localStorage.getItem(KEY);
            if (saved) value = clamp(saved);
        } catch { }
        apply(value, false);

        return { min: MIN, max: MAX, defaultValue: DEFAULT, apply, save, get, reset };
    })();

    document.addEventListener('contextmenu', event => event.preventDefault(), true);
    document.addEventListener('keydown', event => {
        const key = (event.key || '').toLowerCase();
        const blocked =
            event.key === 'F12' ||
            (event.ctrlKey && event.shiftKey && ['i', 'j', 'c'].includes(key)) ||
            (event.ctrlKey && key === 'u');
        if (!blocked) return;
        event.preventDefault();
        event.stopPropagation();
    }, true);

    const DOORPI_BULK_LIBRARY_THRESHOLD = 3;
    let _pendingNewGameQueue = [];
    let _pendingNewGameTimer = 0;
    let _pendingRenderGamesPayload = null;
    let _pendingRenderGamesTimer = 0;
    const FIRST_RUN_TUTORIAL_PENDING_KEY = 'doorpi.firstRunTutorial.pending.v1';
    const FIRST_RUN_TUTORIAL_DONE_KEY = 'doorpi.firstRunTutorial.done.v1';

