window.AppStore = (() => {
    const _state = {
        games: [],
        media: [],
        stores: [],
        featuredId: { games: null, media: null, stores: null },
        newIds: new Set(),
        pendingArtwork: { games: new Map(), media: new Map() }
    };

    const _subscribers = new Map();
    const _artworkRequests = new Map();

    function _notify(channel, payload) {
        (_subscribers.get(channel) || []).forEach(fn => {
            try { fn(payload); } catch (e) { console.error('[Store] subscriber error:', e); }
        });
    }

    function _normalize(raw, channel) {
        let id = raw.id || raw.Id || raw.appId || raw.launchUrl || raw.LaunchUrl || raw.path || raw.Path || raw.Url || raw.url || '';

        const possibleIds = [raw.id, raw.Id, raw.appId, raw.launchUrl, raw.LaunchUrl, raw.path, raw.Path, raw.Url, raw.url, id].filter(Boolean);
        const isSessionNew = possibleIds.some(pid => window.newGameIdsThisSession?.has(pid) || window.newGameIdsThisSession?.has(pid.replace(/\/$/, '')));

        if ((raw.isNew || raw.IsNew) || isSessionNew) _state.newIds.add(id);
        else _state.newIds.delete(id);

        if (channel === 'games') {
            return {
                id, name: raw.name || raw.Name || '', path: raw.path || raw.Path || '',
                launchUrl: raw.launchUrl || raw.LaunchUrl || '', channel: 'games', appType: 'game',
                staticVertical: raw.staticImageData || raw.GridStaticImage || raw.staticVertical || '',
                staticHorizontal: raw.staticHorizontalImage || raw.GridHorizontalStaticImage || raw.staticHorizontal || '',
                staticHero: raw.staticHero || raw.HeroStaticImage || '', staticLogo: raw.staticLogo || raw.LogoStaticImage || '',
                vertical: raw.imageData || raw.GridImage || raw.vertical || '',
                horizontal: raw.horizontalImage || raw.GridHorizontalImage || raw.horizontal || '',
                hero: raw.hero || raw.HeroImage || '', logo: raw.logo || raw.LogoImage || '',
                iconBase64: raw.iconBase64 || raw.IconBase64 || '',
                isAnimated: raw.isAnimated || false,
                source: raw.source || raw.Source || '',
                isAdminLocked: raw.isAdminLocked || raw.IsAdminLocked || false,
                adminLockReason: raw.adminLockReason || raw.AdminLockReason || '',
            };
        }

        if (channel === 'stores') {
            return {
                id, name: raw.Name || raw.name || '', url: raw.Id || raw.id || id, channel: 'stores',
                appType: 'store',
                staticVertical: raw.GridStaticImage || raw.gridStaticImage || '',
                staticHorizontal: raw.GridHorizontalStaticImage || raw.gridHorizontalStaticImage || '',
                staticHero: raw.HeroStaticImage || raw.heroStaticImage || '',
                staticLogo: raw.LogoStaticImage || raw.logoStaticImage || '',
                vertical: raw.GridImage || raw.gridImage || '',
                horizontal: raw.GridHorizontalImage || raw.gridHorizontalImage || '',
                hero: raw.HeroImage || raw.heroImage || '',
                logo: raw.LogoImage || raw.logoImage || '',
                disableGamepadControl: raw.DisableGamepadControl || raw.disableGamepadControl || false,
                isAdminLocked: raw.isAdminLocked || raw.IsAdminLocked || false,
                adminStoreBlocked: raw.adminStoreBlocked || raw.AdminStoreBlocked || false,
                steamForceAccountSelection: raw.steamForceAccountSelection || raw.SteamForceAccountSelection || false,
                adminLockReason: raw.adminLockReason || raw.AdminLockReason || '',
                isAnimated: false,
            };
        }

        return {
            id, name: raw.Name || raw.name || '', url: raw.Url || raw.url || '', channel: 'media',
            appType: raw.Type || raw.type || raw.appType || 'browser', shareMode: raw.ShareMode || raw.shareMode || 'private',
            sharedFromOther: raw.IsSharedFromOtherUser || raw.isSharedFromOtherUser || false,
            sharedFromName: raw.SharedFromUserName || raw.sharedFromName || '',
            sharedWithUserId: raw.SharedWithUserId || raw.sharedWithUserId || '',
            sharedWithUserIds: raw.SharedWithUserIds || raw.sharedWithUserIds || [],
            sharedWithUserNames: raw.SharedWithUserNames || raw.sharedWithUserNames || [],
            ownerUserId: raw.OwnerUserId || raw.ownerUserId || '',
            staticVertical: raw.GridStaticImage || raw.gridStaticImage || raw.staticImageData || '',
            staticHorizontal: raw.GridHorizontalStaticImage || raw.gridHorizontalStaticImage || '',
            staticHero: raw.HeroStaticImage || raw.heroStaticImage || raw.staticHero || '',
            staticLogo: raw.LogoStaticImage || raw.logoStaticImage || raw.staticLogo || '',
            vertical: raw.GridImage || raw.gridImage || raw.imageData || '',
            horizontal: raw.GridHorizontalImage || raw.gridHorizontalImage || '',
            hero: raw.HeroImage || raw.heroImage || raw.hero || '', logo: raw.LogoImage || raw.logoImage || raw.logo || '',
            iconBase64: raw.IconBase64 || raw.iconBase64 || '',
            assetQuery: raw.AssetQuery || raw.assetQuery || '',
            disableGamepadControl: raw.DisableGamepadControl || raw.disableGamepadControl || false,
            isAnimated: raw.isAnimated || false,
        };
    }

    function _requiresStaticBeforeRender(channel, item) {
        if (channel !== 'games' && channel !== 'media') return false;
        return !!(item && item.isAnimated && item.vertical && !item.staticVertical);
    }

    function _requestStaticArtwork(channel, item) {
        if (!_requiresStaticBeforeRender(channel, item)) return;

        const key = `${channel}:${item.id}:GridStatic`;
        const req = _artworkRequests.get(key);
        if (req?.inFlight) return;

        const run = async () => {
            if (!_state.pendingArtwork[channel]?.has(item.id)) {
                _artworkRequests.delete(key);
                return;
            }

            const extractor = window.requestStaticFrameExtraction;
            if (typeof extractor !== 'function') {
                _artworkRequests.set(key, { inFlight: false });
                setTimeout(run, 450);
                return;
            }

            _artworkRequests.set(key, { inFlight: true });
            let ok = false;
            try {
                ok = await extractor({
                    gameId: item.id,
                    entityId: item.id,
                    src: item.vertical,
                    imageType: 'GridStatic'
                });
            } catch (_) {
                ok = false;
            }

            _artworkRequests.set(key, { inFlight: false });
            if (_state.pendingArtwork[channel]?.has(item.id)) {
                setTimeout(run, ok ? 3200 : 1600);
            }
        };

        setTimeout(run, 0);
    }

    function _visibleItems(channel, items, opts = {}) {
        if (channel !== 'games' && channel !== 'media') return items;

        const pending = _state.pendingArtwork[channel];
        pending.clear();

        const visible = [];
        items.forEach((item, index) => {
            item._pendingIndex = index;
            if (_requiresStaticBeforeRender(channel, item)) {
                item._silentPending = !!opts.silent;
                pending.set(item.id, item);
                _requestStaticArtwork(channel, item);
            } else {
                visible.push(item);
            }
        });
        return visible;
    }

    function _insertVisible(channel, item, preferredIndex = null, opts = {}) {
        let list = _state[channel].filter(i => i.id !== item.id);
        const index = Number.isInteger(preferredIndex)
            ? Math.max(0, Math.min(preferredIndex, list.length))
            : (list.length > 0 ? 1 : 0);

        list.splice(index, 0, item);
        if (list.length > 12) list.pop();

        _state[channel] = list;
        _state.featuredId[channel] = list[0]?.id ?? null;

        _notify(channel, { type: 'reset', items: list, silent: !!opts.silent });
        _notify('featured', { channel, id: _state.featuredId[channel], silent: !!opts.silent });
    }

    const mutations = {
        setBatch(channel, rawItems, opts = {}) {
            // Apenas repassa a lista mastigada pelo C# (que já tem max 12 itens)
            const items = _visibleItems(channel, (rawItems || []).map(r => _normalize(r, channel)), opts);
            _state[channel] = items;
            _state.featuredId[channel] = items[0]?.id ?? null;

            _notify(channel, { type: 'reset', items, silent: !!opts.silent });
            _notify('featured', { channel, id: _state.featuredId[channel], silent: !!opts.silent });
        },

        addItem(channel, raw, opts = {}) {
            const item = _normalize(raw, channel);
            if (_requiresStaticBeforeRender(channel, item)) {
                item._silentPending = !!opts.silent;
                _state.pendingArtwork[channel]?.set(item.id, item);
                _requestStaticArtwork(channel, item);
                return;
            }

            _insertVisible(channel, item, null, opts);
        },

        addItems(channel, rawItems, opts = {}) {
            const visibleToInsert = [];
            (rawItems || []).forEach(raw => {
                const item = _normalize(raw, channel);
                if (_requiresStaticBeforeRender(channel, item)) {
                    item._silentPending = !!opts.silent;
                    _state.pendingArtwork[channel]?.set(item.id, item);
                    _requestStaticArtwork(channel, item);
                } else {
                    visibleToInsert.push(item);
                }
            });

            if (visibleToInsert.length === 0) return;

            let list = _state[channel].filter(existing =>
                !visibleToInsert.some(item => item.id === existing.id));
            const insertAt = list.length > 0 ? 1 : 0;
            list.splice(insertAt, 0, ...visibleToInsert);
            if (list.length > 12) list = list.slice(0, 12);

            _state[channel] = list;
            _state.featuredId[channel] = list[0]?.id ?? null;

            _notify(channel, { type: 'reset', items: list, silent: !!opts.silent });
            _notify('featured', { channel, id: _state.featuredId[channel], silent: !!opts.silent });
        },

        removeItem(channel, id) {
            const idx = _state[channel].findIndex(i => i.id === id);
            if (idx === -1) return;
            _state[channel].splice(idx, 1);

            if (_state.featuredId[channel] === id) {
                _state.featuredId[channel] = _state[channel][0]?.id ?? null;
                _notify('featured', { channel, id: _state.featuredId[channel] });
            }
            _notify(channel, { type: 'remove', id });
        },

        trackOpened(id) {
            ['games', 'media'].forEach(channel => {
                const idx = _state[channel].findIndex(i => i.id === id);
                if (idx > -1) {
                    const item = _state[channel][idx];
                    _state[channel].splice(idx, 1);
                    _state[channel].unshift(item); 

                    _state.featuredId[channel] = item.id;
                    _notify(channel, { type: 'reorder', items: _state[channel] });
                    _notify('featured', { channel, id: item.id });
                }
            });
        },

        patchItem(channel, id, patch) {
            const item = _state[channel].find(i => i.id === id);
            const pending = _state.pendingArtwork[channel]?.get(id);
            if (!item && !pending) return;

            const normalizedPatch = {};
            if (patch.name || patch.Name) normalizedPatch.name = patch.name || patch.Name;
            if (patch.staticVertical || patch.GridStaticImage) normalizedPatch.staticVertical = patch.staticVertical || patch.GridStaticImage;
            if (patch.staticHorizontal || patch.GridHorizontalStaticImage) normalizedPatch.staticHorizontal = patch.staticHorizontal || patch.GridHorizontalStaticImage;
            if (patch.staticHero || patch.HeroStaticImage) normalizedPatch.staticHero = patch.staticHero || patch.HeroStaticImage;
            if (patch.staticLogo || patch.LogoStaticImage) normalizedPatch.staticLogo = patch.staticLogo || patch.LogoStaticImage;
            if (patch.vertical || patch.imageData || patch.GridImage) normalizedPatch.vertical = patch.vertical || patch.imageData || patch.GridImage;
            if (patch.horizontal || patch.horizontalImage || patch.GridHorizontalImage) normalizedPatch.horizontal = patch.horizontal || patch.horizontalImage || patch.GridHorizontalImage;
            if (patch.hero || patch.HeroImage) normalizedPatch.hero = patch.hero || patch.HeroImage;
            if (patch.logo || patch.LogoImage) normalizedPatch.logo = patch.logo || patch.LogoImage;
            if (patch.iconBase64 || patch.IconBase64) normalizedPatch.iconBase64 = patch.iconBase64 || patch.IconBase64;
            if (patch.disableGamepadControl != null || patch.DisableGamepadControl != null) normalizedPatch.disableGamepadControl = patch.disableGamepadControl ?? patch.DisableGamepadControl;
            if (patch.isAdminLocked != null || patch.IsAdminLocked != null) normalizedPatch.isAdminLocked = patch.isAdminLocked ?? patch.IsAdminLocked;
            if (patch.adminStoreBlocked != null || patch.AdminStoreBlocked != null) normalizedPatch.adminStoreBlocked = patch.adminStoreBlocked ?? patch.AdminStoreBlocked;
            if (patch.steamForceAccountSelection != null || patch.SteamForceAccountSelection != null) normalizedPatch.steamForceAccountSelection = patch.steamForceAccountSelection ?? patch.SteamForceAccountSelection;
            if (patch.shareMode || patch.ShareMode) normalizedPatch.shareMode = patch.shareMode || patch.ShareMode;
            if (patch.sharedWithUserIds || patch.SharedWithUserIds) normalizedPatch.sharedWithUserIds = patch.sharedWithUserIds || patch.SharedWithUserIds;
            if (patch.sharedWithUserNames || patch.SharedWithUserNames) normalizedPatch.sharedWithUserNames = patch.sharedWithUserNames || patch.SharedWithUserNames;

            const target = item || pending;
            Object.assign(target, normalizedPatch);

            if (!item && pending) {
                if (_requiresStaticBeforeRender(channel, pending)) {
                    _requestStaticArtwork(channel, pending);
                    return;
                }

                _state.pendingArtwork[channel].delete(id);
                const preferredIndex = Number.isInteger(pending._pendingIndex) ? pending._pendingIndex : null;
                delete pending._pendingIndex;
                const silent = !!pending._silentPending;
                delete pending._silentPending;
                _insertVisible(channel, pending, preferredIndex, { silent });
                window._navMenuDataChanged?.(channel);
                return;
            }

            _notify(channel, { type: 'update', id, patch: normalizedPatch });
        },

        clearNewIds() {
            _state.newIds.clear();
            ['games', 'media'].forEach(channel => _notify(channel, { type: 'refresh-new-state' }));
        },
    };

    function subscribe(channel, fn) {
        if (!_subscribers.has(channel)) _subscribers.set(channel, []);
        _subscribers.get(channel).push(fn);
        return () => {
            const arr = _subscribers.get(channel);
            const i = arr.indexOf(fn);
            if (i > -1) arr.splice(i, 1);
        };
    }

    const queries = {
        getItems: (channel) => [..._state[channel]],
        getFeaturedId: (channel) => _state.featuredId[channel],
        isNew: (id) => _state.newIds.has(id),
        getItem: (channel, id) => _state[channel].find(i => i.id === id),
        hasItem: (channel, id) => _state[channel].some(i => i.id === id),
        isArtworkPending: (channel, id) => !!_state.pendingArtwork[channel]?.has(id),
    };

    return { mutations, subscribe, queries };
})();
