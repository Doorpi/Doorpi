window.AppStore = (() => {
    const _state = {
        games: [],
        media: [],
        stores: [],
        featuredId: { games: null, media: null, stores: null },
        newIds: new Set()
    };

    const _subscribers = new Map();

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
                isAnimated: raw.isAnimated || false,
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
            disableGamepadControl: raw.DisableGamepadControl || raw.disableGamepadControl || false,
            isAnimated: raw.isAnimated || false,
        };
    }

    const mutations = {
        setBatch(channel, rawItems) {
            // Apenas repassa a lista mastigada pelo C# (que já tem max 12 itens)
            const items = (rawItems || []).map(r => _normalize(r, channel));
            _state[channel] = items;
            _state.featuredId[channel] = items[0]?.id ?? null;

            _notify(channel, { type: 'reset', items });
            _notify('featured', { channel, id: _state.featuredId[channel] });
        },

        addItem(channel, raw) {
            const item = _normalize(raw, channel);
            let list = _state[channel].filter(i => i.id !== item.id);

           
            if (list.length > 0) {
                list.splice(1, 0, item);
            } else {
                list.push(item);
            }

           
            if (list.length > 12) list.pop();

            _state[channel] = list;
            _state.featuredId[channel] = list[0]?.id ?? null;

            _notify(channel, { type: 'reset', items: list });
            _notify('featured', { channel, id: _state.featuredId[channel] });
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
            if (!item) return;

            const normalizedPatch = {};
            if (patch.name || patch.Name) normalizedPatch.name = patch.name || patch.Name;
            if (patch.staticVertical || patch.GridStaticImage) normalizedPatch.staticVertical = patch.staticVertical || patch.GridStaticImage;
            if (patch.staticHorizontal || patch.GridHorizontalStaticImage) normalizedPatch.staticHorizontal = patch.staticHorizontal || patch.GridHorizontalStaticImage;
            if (patch.staticHero || patch.HeroStaticImage) normalizedPatch.staticHero = patch.staticHero || patch.HeroStaticImage;
            if (patch.staticLogo || patch.LogoStaticImage) normalizedPatch.staticLogo = patch.staticLogo || patch.LogoStaticImage;
            if (patch.disableGamepadControl != null || patch.DisableGamepadControl != null) normalizedPatch.disableGamepadControl = patch.disableGamepadControl ?? patch.DisableGamepadControl;
            if (patch.shareMode || patch.ShareMode) normalizedPatch.shareMode = patch.shareMode || patch.ShareMode;
            if (patch.sharedWithUserIds || patch.SharedWithUserIds) normalizedPatch.sharedWithUserIds = patch.sharedWithUserIds || patch.SharedWithUserIds;
            if (patch.sharedWithUserNames || patch.SharedWithUserNames) normalizedPatch.sharedWithUserNames = patch.sharedWithUserNames || patch.SharedWithUserNames;

            Object.assign(item, normalizedPatch);
            _notify(channel, { type: 'update', id, patch: normalizedPatch });
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
    };

    return { mutations, subscribe, queries };
})();
