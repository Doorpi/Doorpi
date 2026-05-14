// =============================================================================
// store.js — Single Source of Truth para games e media
// =============================================================================

window.AppStore = (() => {
    const _state = {
        games: [],
        media: [],
        featuredId: { games: null, media: null },
        newIds: new Set(),
        recentlyOpened: [],
    };

    // 1. MEMÓRIA IMPLACÁVEL: Restaura o histórico de últimos abertos do front-end.
    // Isso garante que a ordem de Jogos e Mídias seja IDÊNTICA e lembrada entre reinicializações.
    try {
        const saved = localStorage.getItem('doorpi_recently_opened');
        if (saved) _state.recentlyOpened = JSON.parse(saved);
    } catch (e) { console.error('[Store] Erro ao restaurar recentlyOpened', e); }

    const _subscribers = new Map();

    function _notify(channel, payload) {
        (_subscribers.get(channel) || []).forEach(fn => {
            try { fn(payload); } catch (e) { console.error('[Store] subscriber error:', e); }
        });
    }

    function _normalize(raw, channel) {
        // 2. CORREÇÃO DO BADGE "NOVO": Lê a flag corretamente do servidor.
        const isNewFromServer = raw.isNew || raw.IsNew || false;

        let id = raw.id || raw.Id || raw.appId || raw.launchUrl || raw.LaunchUrl || raw.path || raw.Path || raw.Url || raw.url || '';

        // Monta um array com TODAS as variações de IDs ou URLs possíveis
        const possibleIds = [
            raw.id, raw.Id, raw.appId, raw.launchUrl, raw.LaunchUrl,
            raw.path, raw.Path, raw.Url, raw.url, id
        ].filter(Boolean);

        // Verifica se QUALQUER variação de ID foi adicionada na sessão atual da UI
        const isSessionNew = possibleIds.some(pid =>
            window.newGameIdsThisSession?.has(pid) ||
            window.newGameIdsThisSession?.has(pid.replace(/\/$/, ''))
        );

        // COMBINAÇÃO: Se o C# diz que é novo (< 48h) OU se foi adicionado agora, MARCA COMO NOVO.
        if (isNewFromServer || isSessionNew) {
            _state.newIds.add(id);
        } else {
            _state.newIds.delete(id); // Agora só deleta se realmente não for novo em nenhum lugar
        }

        if (channel === 'games') {
            return {
                id,
                name: raw.name || raw.Name || '',
                path: raw.path || raw.Path || '',
                launchUrl: raw.launchUrl || raw.LaunchUrl || '',
                channel: 'games',
                appType: 'game',
                staticVertical: raw.staticImageData || raw.GridStaticImage || raw.staticVertical || '',
                staticHorizontal: raw.staticHorizontalImage || raw.GridHorizontalStaticImage || raw.staticHorizontal || '',
                staticHero: raw.staticHero || raw.HeroStaticImage || '',
                staticLogo: raw.staticLogo || raw.LogoStaticImage || '',
                vertical: raw.imageData || raw.GridImage || raw.vertical || '',
                horizontal: raw.horizontalImage || raw.GridHorizontalImage || raw.horizontal || '',
                hero: raw.hero || raw.HeroImage || '',
                logo: raw.logo || raw.LogoImage || '',
                isAnimated: raw.isAnimated || false,
            };
        }

        return {
            id,
            name: raw.Name || raw.name || '',
            url: raw.Url || raw.url || '',
            channel: 'media',
            appType: raw.Type || raw.type || raw.appType || 'browser',
            shareMode: raw.ShareMode || raw.shareMode || 'private',
            sharedFromOther: raw.IsSharedFromOtherUser || raw.isSharedFromOtherUser || false,
            sharedFromName: raw.SharedFromUserName || raw.sharedFromName || '',
            sharedWithUserId: raw.SharedWithUserId || raw.sharedWithUserId || '',
            staticVertical: raw.GridStaticImage || raw.gridStaticImage || raw.staticImageData || '',
            staticHorizontal: raw.GridHorizontalStaticImage || raw.gridHorizontalStaticImage || '',
            staticHero: raw.HeroStaticImage || raw.heroStaticImage || raw.staticHero || '',
            staticLogo: raw.LogoStaticImage || raw.logoStaticImage || raw.staticLogo || '',
            vertical: raw.GridImage || raw.gridImage || raw.imageData || '',
            horizontal: raw.GridHorizontalImage || raw.gridHorizontalImage || '',
            hero: raw.HeroImage || raw.heroImage || raw.hero || '',
            logo: raw.LogoImage || raw.logoImage || raw.logo || '',
            isAnimated: raw.isAnimated || false,
        };
    }

    function _sortByRecency(items) {
        return [...items].sort((a, b) => {
            const ai = _state.recentlyOpened.indexOf(a.id);
            const bi = _state.recentlyOpened.indexOf(b.id);
            const ar = ai === -1 ? 999 : ai;
            const br = bi === -1 ? 999 : bi;
            return ar - br; // Os recém abertos sobem pro topo com prioridade máxima
        });
    }

    const mutations = {
        setBatch(channel, rawItems) {
            const LIMIT = 12;
            const items = (rawItems || []).map(r => _normalize(r, channel)).slice(0, LIMIT);

            const ordered = _sortByRecency(items);
            _state[channel] = ordered;
            _state.featuredId[channel] = ordered[0]?.id ?? null;

            _notify(channel, { type: 'reset', items: ordered });
            _notify('featured', { channel, id: _state.featuredId[channel] });
        },

        addItem(channel, raw) {
            const LIMIT = 12;
            const item = _normalize(raw, channel);

            _state[channel] = _state[channel].filter(i => i.id !== item.id);
            _state[channel].unshift(item);
            if (_state[channel].length > LIMIT) _state[channel].pop();

            _state.featuredId[channel] = item.id;

            _notify(channel, { type: 'prepend', item });
            _notify('featured', { channel, id: item.id });
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
            // Mantém os 50 últimos jogados na memória
            _state.recentlyOpened = [id, ..._state.recentlyOpened.filter(x => x !== id)].slice(0, 50);

            // 3. SALVA O ESTADO: Sempre que abrir um App ou Jogo, salva no navegador.
            try {
                localStorage.setItem('doorpi_recently_opened', JSON.stringify(_state.recentlyOpened));
            } catch (e) { }

            ['games', 'media'].forEach(channel => {
                if (!_state[channel].some(i => i.id === id)) return;

                const reordered = _sortByRecency(_state[channel]);
                _state[channel] = reordered;
                _state.featuredId[channel] = reordered[0]?.id ?? null;

                _notify(channel, { type: 'reorder', items: reordered });
                _notify('featured', { channel, id: _state.featuredId[channel] });
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
            if (patch.shareMode || patch.ShareMode) normalizedPatch.shareMode = patch.shareMode || patch.ShareMode;

            Object.assign(item, normalizedPatch);
            _notify(channel, { type: 'update', id, patch: normalizedPatch });
        },

        markNew(id) {
            if (id) _state.newIds.add(id);
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

window.trackGameOpened = function (id) {
    window.AppStore.mutations.trackOpened(id);
};