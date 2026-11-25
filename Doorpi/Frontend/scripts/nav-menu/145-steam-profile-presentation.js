    // Steam presentation owns only transient view data. Persistence stays in the host.
    let _steamProfileView = { profileId:'', requested:false, games:[] };
    let _steamAchievementRequest = 0;
    let _steamAchievementGame = 0;
    let _steamAchievementOffset = 0;
    let _steamAchievementDetail = null;
    // Resolve only visible images that failed. Share each public store lookup across cards.
    const steamHeaderCache = new Map();
    function acceptSteamHeader(data) {
        steamHeaderCache.set(data.appId, { image: data.image, at: Date.now() });
        if (!data.image) return;
        document.querySelectorAll('img[data-steam-header]').forEach(img => {
            if (Number(img.dataset.steamHeader) === data.appId && img.src !== data.image) img.src = data.image;
        });
    }
    document.addEventListener('error', event => {
        const img = event.target;
        if (!(img instanceof HTMLImageElement)) return;
        if (img.closest('.nav-trophy-art')) {
            const url = new URL(img.src);
            if (url.hostname === 'cdn.cloudflare.steamstatic.com') {
                url.hostname = 'cdn.fastly.steamstatic.com';
                img.src = url.href;
            } else {
                img.remove();
            }
            return;
        }
        const match = /^https:\/\/cdn\.cloudflare\.steamstatic\.com\/steam\/apps\/(\d+)\/header\.jpg$/.exec(img.src);
        if (img.dataset.steamHeader) return;
        const id = Number(match?.[1] || img.closest('[data-steam-game]')?.dataset.steamGame);
        if (!Number.isSafeInteger(id) || id <= 0) return;
        img.dataset.steamHeader = String(id);
        const cached = steamHeaderCache.get(id);
        if (cached?.image && cached.image !== img.src) img.src = cached.image;
        else if (!cached || Date.now() - cached.at > 300000) {
            steamHeaderCache.set(id, { at: Date.now() });
            postToHost?.({ action: 'steamGameHeader', appId: id });
        }
    }, true);
    function _steamConnectPayload() {
        const keys=['export','exporting','identifying','saving','unavailable','captureError','changed','openError','title'];
        return {action:'steamConnect',texts:Object.fromEntries(keys.map(key=>[key,_t('steam.'+key)]))};
    }
    function _steamView() {
        const profileId = String(window._doorpiCurrentUserId || _menuData.user?.Id || '');
        if (_steamProfileView.profileId !== profileId) {
            _steamProfileView = { profileId, requested:false, games:[] };
            _steamAchievementGame = 0; _steamAchievementOffset = 0; _steamAchievementDetail = null;
            ++_steamAchievementRequest;
        }
        if (profileId && !_steamProfileView.requested) {
            _steamProfileView.requested = true;
            postToHost?.({ action:'steamProfileStatus' });
        }
        return _steamProfileView;
    }
    const _steamMedalNames = () => Object.fromEntries(['gold','silver','bronze','iron'].map(key=>[key,_t('steam.'+key)]));
    function _setProfileArtwork(part,value,metadata={}) {
        const user = _menuData.user;
        if (!user.Id || user.Id !== window._doorpiCurrentUserId) return;
        if (part === 'avatarGame' && value && !/^https:\/\/[^"<>\s]+$/i.test(value)) value = '';
        if (part === 'avatarGame' && user.AvatarFromGame && user.GameAvatarUrl === value) return;
        const patch = part === 'cover' ? {
            CoverBase64:value, CoverSource:metadata.source || '', CoverSourceUrl:metadata.sourceUrl || '',
            CoverSteamGridAssetId:Number(metadata.steamGridAssetId || 0),
            CoverUsesMostPlayedGame:!!metadata.useMostPlayedGame
        } : {AvatarFromGame:true,GameAvatarUrl:value};
        Object.assign(user,patch);
        if (window._doorpiProfile?.Id === user.Id) Object.assign(window._doorpiProfile,patch);
        postToHost({action:'setProfileArtwork',userId:user.Id,part,value,...(part==='cover'?{
            source:patch.CoverSource, sourceUrl:patch.CoverSourceUrl, steamGridAssetId:patch.CoverSteamGridAssetId,
            useMostPlayedGame:patch.CoverUsesMostPlayedGame
        }:{})});
        if (part === 'avatarGame') window._applyDoorpiTopProfile?.(user);
    }
    function _profileIdentityMarkup() {
        const user = _menuData.user || {};
        const photo = user.AvatarFromGame && user.GameAvatarUrl || user.PhotoBase64;
        const src = photo && (window._doorpiUserPhotoSrc?.(photo) || 'data:image/png;base64,'+photo);
        return `<div class="nav-unified-avatar">${src?'<img alt="" src="'+_esc(src)+'">':'◎'}</div>
            <div class="nav-unified-name"><h2>${_esc(user.Name || 'Doorpi')}</h2></div>
            <dl class="nav-profile-record"></dl>
            <section class="nav-profile-favorites"><h3>${_esc(_t('navMostPlayedGames'))}</h3><ol></ol></section>`;
    }
    function _bindProfileFavorites(body, library, fmtSeconds, onRanked) {
        const list = body.querySelector('.nav-profile-favorites ol');
        list.refreshFavorites = () => {
            const state = _steamView();
            const ranked = _profileGameRows(library,{...state,gameOrder:'hours'});
            onRanked?.(ranked,state);
            const record = body.querySelector('.nav-profile-record');
            const minutes = ranked.reduce((sum,game)=>sum+game.minutes,0);
            const librarySize = _menuData.gamesTotal ?? _menuData.games?.length ?? 0;
            const [label,value] = minutes > 0 ? ['navGamingTime',fmtSeconds(minutes*60)] : ['navProfileLibrarySize',librarySize.toLocaleString()];
            record.innerHTML = `<div><dt>${_esc(_t(label))}</dt><dd>${_esc(value)}</dd></div>`;
            const games = ranked.filter(game=>game.minutes>0).slice(0,3);
            const user = _menuData.user;
            const gameArt = games.length ? _profileGameArt(games[0]) : '';
            if (user.AvatarFromGame && gameArt && gameArt !== user.GameAvatarUrl) {
                _setProfileArtwork('avatarGame',gameArt);
                const avatar = body.querySelector('.nav-unified-avatar');
                const img = document.createElement('img');
                img.src = gameArt;
                img.alt = '';
                avatar?.replaceChildren(img);
            }
            list.parentElement.querySelector('.nav-profile-cover')?.remove();
            if (user.CoverBase64 || user.CoverSourceUrl) {
                const cover = document.createElement('img');
                cover.alt = '';
                cover.className = 'nav-profile-cover';
                cover.src = user.CoverBase64 ? 'data:image/jpeg;base64,' + user.CoverBase64 : user.CoverSourceUrl;
                list.before(cover);
            }
            list.replaceChildren(...games.map((game,index)=>{
                const item = document.createElement('li');
                const title = document.createElement('strong');
                const time = document.createElement('small');
                title.textContent = game.name;
                time.textContent = fmtSeconds(game.minutes*60);
                const art = _profileGameArt(game);
                if (art) {
                    const img = document.createElement('img');
                    img.alt = '';
                    img.loading = 'lazy';
                    img.decoding = 'async';
                    img.onerror = () => { if (!img.dataset.steamHeader) img.remove(); };
                    img.src = art;
                    item.append(img);
                    if (index===0 && !user.CoverBase64 && !user.CoverSourceUrl) {
                        const cover = img.cloneNode();
                        cover.src = _profileBanner(game);
                        cover.className = 'nav-profile-cover';
                        cover.onerror = () => {
                            cover.onerror = () => cover.remove();
                            cover.src = art;
                        };
                        list.before(cover);
                    }
                }
                item.append(title,time);
                return item;
            }));
        };
        list.refreshFavorites();
    }
    function _steamSummaryMarkup(showPlatinum=true) {
        const state = _steamView();
        const value = count => count == null ? '—' : Math.max(0,Number(count)||0).toLocaleString();
        return `<div class="nav-achievement-summary" title="${_t('steam.medalsNote')}" aria-label="${_t('steam.steamAchievements')}">
            ${showPlatinum?`<span class="nav-medal nav-medal-platinum" title="${_t('steam.platinumTitle')}">${_trophySvg('platinum')}<strong>${value(state.completedGames)}</strong><small>${_t('steam.platinum')}</small></span>`:''}
            ${Object.entries(_steamMedalNames()).map(([key,name])=>`<span class="nav-medal nav-medal-${key}" title="${name}"><i>${_trophySvg(key)}</i><strong>${value(state.medals?.[key])}</strong><small>${name}</small></span>`).join('')}</div>`;
    }

    function _steamTier(percent) {
        if (percent == null || !Number.isFinite(Number(percent)) || percent < 0 || percent > 100) return 'unknown';
        return percent<=5?'gold':percent<=15?'silver':percent<=30?'bronze':'iron';
    }
    function _steamMedal(percent) {
        const key = _steamTier(percent);
        if (key === 'unknown') return _t('steam.medalUnknown');
        return _steamMedalNames()[key]+' · '+Number(percent).toLocaleString(undefined,{maximumFractionDigits:2})+_t('steam.players');
    }
    function _requestSteamAchievements(appId, offset = 0) {
        _steamAchievementGame = appId;
        _steamAchievementOffset = offset;
        if (!offset) _steamAchievementDetail = null;
        const pendingId = ++_steamAchievementRequest;
        if (_steamAchievementDetail) _steamAchievementDetail.pending = true;
        postToHost?.({ action:'steamProfileAchievements', appId, offset, requestId:String(pendingId) });
        const request = _steamAchievementRequest, profile = _steamView().profileId;
        setTimeout(()=>{
            if(request!==_steamAchievementRequest || profile!==_steamView().profileId || (_steamAchievementDetail && !_steamAchievementDetail.pending)) return;
            _acceptSteamPresentation({type:'steamProfileAchievements',profileId:profile,requestId:String(request),appId,items:[],error:_t('steam.loadError')});
        },8000);
    }
    function _acceptSteamPresentation(data) {
        const state = _steamView();
        if (!state.profileId || String(data.profileId) !== state.profileId) return;
        if (data.type === 'steamProfileStatus') {
            for (const key of ['hasKey','steamId','displayName','gameCount','achievementCount','completedGames','achievementGames','medals','busy','message','phase','progressCurrent','progressTotal','progressPercent','firstSync','pending'])
                if (data[key] != null) state[key] = data[key];
            window._refreshSteamProfileSyncUi?.();
            if (Array.isArray(data.achievementIndex)) state.games = [...data.achievementIndex].sort((a,b) => b.unlocked-a.unlocked || b.total-a.total || a.Name.localeCompare(b.Name));
            if (Array.isArray(data.achievementIndex) && !state.games.some(game => game.AppId === _steamAchievementGame)) {
                if (_steamAchievementGame) state.openGame = null;
                _steamAchievementGame = 0;
                _steamAchievementDetail = null;
                ++_steamAchievementRequest;
            }
            document.querySelector('.nav-profile-favorites ol')?.refreshFavorites?.();
            if (data.busy || !Array.isArray(data.achievementIndex)) return;
            document.querySelector('[data-profile-gaming-time]')?.refreshGamingTime?.();
        } else {
            if (data.requestId !== String(_steamAchievementRequest) || data.appId !== _steamAchievementGame) return;
            if (_steamAchievementOffset && _steamAchievementDetail) {
                if (!_steamAchievementDetail.pending) return;
                _steamAchievementDetail.pending = false;
                _steamAchievementDetail.items.push(...(data.items || []));
                _steamAchievementDetail.error = data.error;
                if (data.total != null) _steamAchievementDetail.total = data.total;
                const list = document.querySelector('.nav-achievement-detail-list');
                if (list && data.items?.length && !data.error) {
                    const cards = data.items.map((item,index) => _steamTrophyCard(item,_steamAchievementOffset+index)).join('');
                    list.insertAdjacentHTML('beforeend',cards);
                    for (const card of Array.from(list.children).slice(-data.items.length)) {
                        _bindSteamFocus(card,_contentItems.length);
                        _contentItems.push(card);
                    }
                    return;
                }
                if (!data.items?.length && !data.error) _steamAchievementDetail.total = _steamAchievementDetail.items.length;
            } else _steamAchievementDetail = data;
        }
        if (window.isNavMenuOpen && CATS[_catIdx]?.id === 'profile' && _profileSubView === 'gaming') {
            const sortDialog = document.querySelector('.nav-profile-sort-dialog[open]');
            if (sortDialog) {
                sortDialog.dataset.refreshOnClose = 'true';
                return;
            }
            const active = document.activeElement;
            const enterTrophies = active?.dataset.enterTrophies === data.requestId && data.type === 'steamProfileAchievements' && data.items?.length;
            const focusKey = enterTrophies ? 'trophy-0' : active?.dataset.steamFocus;
            const gameScroll = document.querySelector('.nav-achievement-game-list')?.scrollTop || 0;
            const detailScroll = document.querySelector('.nav-achievement-detail-list')?.scrollTop || 0;
            _renderContent('profile');
            const games = document.querySelector('.nav-achievement-game-list'), details = document.querySelector('.nav-achievement-detail-list');
            if(games) games.scrollTop = gameScroll;
            if(details) details.scrollTop = detailScroll;
            if (!_topbarFocus) {
                const index = _contentItems.findIndex(item => item.dataset.steamFocus === focusKey);
                if (index >= 0) _contentIdx = index;
                _contentIdx = Math.max(0,Math.min(_contentIdx,_contentItems.length-1));
                _updateContentFocus();
            }
        }
    }
    function trophyImage(item, appId) {
        if (item.IconUrl) {
            try {
                const url = new URL(item.IconUrl);
                if (url.protocol === 'https:' && (url.hostname.endsWith('.steamstatic.com') || ['media.steampowered.com','steamcdn-a.akamaihd.net'].includes(url.hostname))) return url.href;
            } catch {}
        }
        return /^[a-f0-9]{40}\.(jpg|png)$/i.test(item.IconFile || '')
            ? 'https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/'+Number(appId)+'/'+item.IconFile : '';
    }
    function _steamTrophyCard(item,index) {
        const tier = _steamTier(item.GlobalUnlockPercent);
        const src = trophyImage(item, _steamAchievementGame);
        const art = src ? '<img loading="'+(index < 6 ? 'eager' : 'lazy')+'" decoding="async" alt="" src="'+_esc(src)+'">' : '';
        const date = item.Unlocked && item.UnlockTimeUnix > 0 ? ' · '+new Date(item.UnlockTimeUnix*1000).toLocaleDateString() : '';
        return `<article class="nav-achievement-item nav-medal-${tier}${item.Unlocked?' is-unlocked':''}" tabindex="-1" data-steam-focus="trophy-${index}">
            <span class="nav-trophy-art">${_trophySvg(tier)}${art}</span>
            <small>${_steamMedal(item.GlobalUnlockPercent)}</small><h4>${_esc(item.Name)}</h4>
            ${item.Description ? '<p>'+_esc(item.Description)+'</p>' : ''}
            <small>${_t(item.Unlocked?'steam.unlocked':'steam.locked')}${date}</small></article>`;
    }
    function _loadMoreTrophies() {
        const detail = _steamAchievementDetail;
        if (detail && !detail.pending && !detail.error && detail.items.length < detail.total)
            _requestSteamAchievements(_steamAchievementGame,detail.items.length);
    }
    function _bindSteamFocus(item,index) {
        item.addEventListener('mouseenter',() => {
            _contentIdx=index;
            _setTopbarFocus(false);
        });
    }
    function _profileGameRows(library,state) {
        const rows = new Map();
        for (const game of state.games) {
            const key = 'steam:'+game.AppId;
            rows.set(key,{key, name:game.Name, minutes:game.PlaytimeMinutes || 0, lastPlayed:(game.LastPlayedUnix || 0)*1000, steam:game});
        }
        for (const [key,item] of library) {
            const row = rows.get(key) || {key,name:item.Name};
            row.minutes = Math.max(row.minutes || 0,Number(item.TotalPlaytimeMinutes) || 0);
            row.lastPlayed = Math.max(row.lastPlayed || 0,Date.parse(item.LastPlayed) || 0);
            row.banner = item.ProfileBannerLocalImage || item.ProfileBannerImageUrl;
            row.art = item.GridHorizontalStaticImage || item.HistoryHorizontalLocalImage || item.GridHorizontalImage || item.HistoryHorizontalImageUrl || item.GridStaticImage || item.GridImage;
            const historyMatch = (_menuData.history || []).find(history =>
                history?.Name && String(history.Name).normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase() ===
                    String(item.Name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase());
            if (historyMatch) {
                row.historyId = historyMatch.Id || '';
                row.historyName = historyMatch.Name;
            }
            rows.set(key,row);
        }
        const score = row => {
            if (state.gameOrder === 'recent') return row.lastPlayed;
            if (state.gameOrder === 'hours') return row.minutes;
            return row.steam?.unlocked || 0;
        };
        return [...rows.values()].sort((a,b) => score(b)-score(a) || b.minutes-a.minutes || a.name.localeCompare(b.name));
    }
    function _gameProgress(row) {
        const game = row.steam;
        if (!game?.total) return _t('steam.noTrophies');
        return _t('steam.progress','',game.unlocked,game.total)+' · '+_t('steam.remaining','',game.total-game.unlocked);
    }
    function _gameTiers(game) {
        if (!game?.total) return '';
        const tiers = Object.entries(_steamMedalNames());
        if (game.total === game.unlocked) tiers.unshift(['platinum',_t('steam.platinum')]);
        return tiers.map(([tier,label]) => `<span class="nav-game-tier nav-medal-${tier}" title="${label}" aria-label="${label} · ${tier==='platinum'?1:game.medals?.[tier]??'—'}">${_trophySvg(tier)}<b>${tier==='platinum'?1:game.medals?.[tier]??'—'}</b></span>`).join('');
    }
    function _profileBanner(row) {
        return row?.banner || (row?.steam ? 'https://cdn.cloudflare.steamstatic.com/steam/apps/'+Number(row.steam.AppId)+'/library_hero.jpg' : row && _profileGameArt(row));
    }
    function _profileGameArt(row) {
        return row.art || (row.steam ? 'https://cdn.cloudflare.steamstatic.com/steam/apps/'+Number(row.steam.AppId)+'/header.jpg' : '');
    }
    function _profileGameRow(row,index,fmtSeconds) {
        const game = row.steam;
        const art = _profileGameArt(row);
        return `<button class="nav-achievement-game" data-game-row="${index}" ${game?'data-steam-game="'+Number(game.AppId)+'"':''} ${row.historyName?`data-history-game-name="${_esc(row.historyName)}" data-history-game-id="${_esc(row.historyId || '')}"`:''} data-steam-focus="${_esc(row.key)}" tabindex="-1">
            <span class="nav-profile-game-art" aria-hidden="true"><i>${_esc(row.name.trim().slice(0,2).toLocaleUpperCase())}</i>${art?'<img loading="lazy" alt="" src="'+_esc(art)+'">':''}</span>
            <span class="nav-profile-game-title"><strong>${_esc(row.name)}</strong><small>${row.minutes?fmtSeconds(row.minutes*60):_t('steam.zeroHours')}</small></span>
            <span class="nav-game-progress" aria-label="${_gameProgress(row)}" title="${_gameProgress(row)}">${game?.total?`<b>${Math.floor(game.unlocked/game.total*100)}%</b><progress aria-hidden="true" max="${game.total}" value="${game.unlocked}"></progress>`:'—'}</span>
            <span class="nav-game-tier-list">${_gameTiers(game)}</span></button>`;
    }
    function _renderProfileGames(body,library,fmtSeconds,entry) {
        const gamesFirst = entry === 'games';
        const compact = gamesFirst || entry === 'cards' || entry === 'standard';
        const state = _steamView();
        const rows = _profileGameRows(library,state);
        const selected = rows.find(row=>row.key===state.openGame);
        const tabs = [...(gamesFirst?[]:[['overview','navProfileOverview']]),['gaming','navGames'],['film-series','navFilmsSeries'],['streaming','navStreamingVideos'],['music','navMusic']];
        const detail = selected?.steam ? _steamAchievementDetail : null;
        const items = detail?.items || [];
        const orders = [['earned','steam.achievements'],['recent','steam.recentOrder'],['hours','steam.hoursOrder']];
        const sortOptions = `<div class="nav-game-sort" role="group" aria-label="${_t('steam.sortBy')}">
            ${orders.map(([key,label])=>`<button type="button" tabindex="-1" data-game-order="${key}" ${compact?'':'data-steam-focus="order-'+key+'"'} aria-pressed="${(state.gameOrder || 'earned')===key}">${_t(label)}</button>`).join('')}</div>`;
        const sortBar = compact ? `<button class="nav-profile-sort-trigger" type="button" tabindex="-1" aria-haspopup="dialog"><kbd>Y</kbd> ${_esc(_t('steam.sortBy'))}</button>
            <dialog class="nav-profile-sort-dialog" aria-label="${_esc(_t('steam.sortBy'))}"><h3>${_esc(_t('steam.sortBy'))}</h3>${sortOptions}</dialog>` : sortOptions;
        const back = '<button class="nav-back-btn" data-steam-focus="back" tabindex="-1">‹ '+_t('navGames')+'</button>';
        const content = selected ? `<section class="nav-achievement-details">
            <header>${back}<div><h3>${_esc(selected.name)}</h3><p>${_gameProgress(selected)}${selected.steam?.total?' · '+_t(selected.steam.unlocked ? 'steam.earnedByRarity' : 'steam.rarestFirst'):''}</p></div><span class="nav-game-tier-list">${_gameTiers(selected.steam)}</span></header>
            <div class="nav-achievement-detail-list nav-profile-grid" aria-label="${_t('steam.list')}">
            ${items.map(_steamTrophyCard).join('') || '<p class="nav-achievement-empty" role="status">'+_esc(detail?.error || (selected.steam?.total && !detail?_t('steam.loading'):_t('steam.noTrophies')))+'</p>'}</div>
            ${items.length && detail.error?'<p role="status">'+_esc(detail.error)+'</p>':''}</section>`
            : `<section class="nav-achievement-games"><header><div class="nav-steam-games-heading"><span class="nav-steam-games-logo" aria-hidden="true">${PLATFORM_ICONS.Steam}</span><div><h3>${_t('steam.yourGames')}</h3><small id="navSteamGamesStatus" role="status" aria-live="polite"></small></div>${state.steamId?'<button type="button" data-steam-focus="sync" id="btnSteamSyncNow" class="nav-steam-sync-button" tabindex="-1" aria-label="'+_esc(_t('steam.syncNow'))+'" title="'+_esc(_t('steam.syncNow'))+'">↻ <span>'+_esc(_t('steam.syncNow'))+'</span></button>':'<button data-steam-focus="connect" class="nav-icon-btn" tabindex="-1">'+_t('steam.connect')+'</button>'}</div>${compact?'':_steamSummaryMarkup()}${sortBar}</header>
            <div class="nav-steam-games-progress" id="navSteamGamesProgress" hidden><progress id="navSteamGamesProgressBar" max="100" value="0" aria-label="${_esc(_t('steam.syncProgress'))}"></progress><small id="navSteamGamesProgressHint"></small><span id="navSteamGamesFirstSyncHint" hidden>${_esc(_t('steam.firstSyncHint'))}</span></div>
            <div class="nav-achievement-game-list nav-profile-grid">${rows.map((row,i)=>_profileGameRow(row,i,fmtSeconds)).join('') || '<p class="nav-achievement-empty">'+_t('navGameHistoryEmpty')+'</p>'}</div></section>`;
        body.innerHTML = `<div class="nav-unified-profile nav-achievements-profile${entry==='standard'?' profile-standard':''}">
            <header class="nav-unified-identity">${_profileIdentityMarkup()}${compact?'<button class="nav-unified-edit" data-steam-focus="edit" tabindex="-1">'+_esc(_t('navEditProfileBtn'))+'</button>':''}</header>
            <nav class="nav-unified-tabs" aria-label="${_t('navProfileSections')}">${tabs.map(([id,label])=>`<button class="nav-unified-tab${id==='gaming'?' is-active':''}" data-profile-tab="${id}" data-steam-focus="tab-${id}" tabindex="-1">${_t(label)}</button>`).join('')}</nav>
            ${content}</div>`;
        _bindProfileFavorites(body,library,fmtSeconds);
        _contentItems = [...body.querySelectorAll('[data-steam-focus]:not([data-steam-focus=edit])')];
        const editButton = body.querySelector('[data-steam-focus=edit]');
        if (editButton) _contentItems.push(editButton);
        _contentItems.forEach(_bindSteamFocus);
        const syncButton = body.querySelector('#btnSteamSyncNow');
        if (syncButton) syncButton.onclick = () => {
            if (state.busy) return;
            state.busy = true;
            state.phase = 'starting';
            state.progressPercent = 0;
            state.message = state.firstSync ? _t('steam.firstSyncStarting') : _t('steam.syncStarting');
            window._refreshSteamProfileSyncUi?.();
            postToHost?.({action:'steamImport'});
        };
        window._refreshSteamProfileSyncUi = () => {
            const activeState = _steamView();
            const status = document.querySelector('#navSteamGamesStatus');
            if (status) status.textContent = activeState.busy ? activeState.message || _t('steam.updating') : activeState.pending ? activeState.message || _t('steam.resumeHint') : '';
            const progress = document.querySelector('#navSteamGamesProgress');
            const bar = document.querySelector('#navSteamGamesProgressBar');
            const hint = document.querySelector('#navSteamGamesProgressHint');
            const firstHint = document.querySelector('#navSteamGamesFirstSyncHint');
            const isRunning = !!activeState.busy;
            if (progress) progress.hidden = !isRunning && !activeState.pending;
            if (bar) {
                bar.value = Math.max(0, Math.min(100, Number(activeState.progressPercent) || 0));
                bar.classList.toggle('is-pending', !isRunning && !!activeState.pending);
            }
            if (hint) hint.textContent = activeState.progressTotal > 0
                ? `${activeState.progressCurrent || 0} / ${activeState.progressTotal} · ${activeState.message || ''}`
                : activeState.message || '';
            if (firstHint) {
                firstHint.hidden = !activeState.firstSync || (!isRunning && !activeState.pending);
                firstHint.textContent = activeState.pending && !isRunning ? _t('steam.resumeHint') : _t('steam.firstSyncHint');
            }
            if (syncButton) syncButton.disabled = !!activeState.busy || !activeState.hasKey;
        };
        window._refreshSteamProfileSyncUi();
        editButton?.addEventListener('click',_openProfileEditor);
        const dialog = body.querySelector('.nav-profile-sort-dialog');
        const trigger = body.querySelector('.nav-profile-sort-trigger');
        if (trigger) trigger.onclick = () => {
            if (dialog.open) return;
            dialog.showModal();
            const place = () => {
                const anchor = trigger.getBoundingClientRect();
                const gap = 8;
                const below = anchor.bottom + gap;
                const top = below + dialog.offsetHeight <= innerHeight - gap ? below : anchor.top - dialog.offsetHeight - gap;
                dialog.style.top = Math.max(gap, top) + 'px';
                dialog.style.left = Math.max(gap, Math.min(anchor.right - dialog.offsetWidth, innerWidth - dialog.offsetWidth - gap)) + 'px';
            };
            place();
            const tracking = new AbortController();
            window.addEventListener('resize', place, {signal:tracking.signal});
            dialog.addEventListener('close', () => tracking.abort(), {once:true});
            dialog.querySelector('[aria-pressed=true]').focus();
        };
        const focus = key => {
            _contentIdx = Math.max(0,_contentItems.findIndex(item=>item.dataset.steamFocus===key));
            _setTopbarFocus(false);
        };
        dialog?.addEventListener('close',()=>{
            if (!dialog.isConnected || !dialog.dataset.refreshOnClose) return;
            const key = _contentItems[_contentIdx]?.dataset.steamFocus;
            state.gameScroll = body.querySelector('.nav-achievement-game-list')?.scrollTop || 0;
            _renderContent('profile');
            if (!_topbarFocus) focus(key);
        });
        const closeDetail = () => {
            state.openGame = null;
            _steamAchievementGame = 0; _steamAchievementDetail = null; ++_steamAchievementRequest;
        };
        body.querySelectorAll('[data-profile-tab]').forEach(button=>button.onclick=()=>{
            _profileCardReturn = null;
            closeDetail();
            _profileSubView = button.dataset.profileTab==='overview'?null:button.dataset.profileTab;
            _contentIdx = Math.max(0,_contentItems.indexOf(button));
            _renderContent('profile'); _setTopbarFocus(false);
        });
        const games = body.querySelector('.nav-achievement-game-list');
        if (games) games.scrollTop = state.gameScroll || 0;
        body.querySelectorAll('[data-game-row]').forEach(button=>button.onclick=()=>{
            const row = rows[Number(button.dataset.gameRow)];
            state.gameScroll = games.scrollTop;
            state.openGame = row.key;
            if (row.steam?.total) _requestSteamAchievements(row.steam.AppId);
            _renderContent('profile');
            focus('back');
            _contentItems[_contentIdx].dataset.enterTrophies = String(_steamAchievementRequest);
        });
        const backButton = body.querySelector('[data-steam-focus=back]');
        if (backButton) backButton.onclick = () => {
            closeDetail();
            _renderContent('profile'); focus(selected.key);
            const item = _contentItems[_contentIdx];
            if (item.matches('[data-game-row]')) _revealInsideScrollContainer(item,item.parentElement);
        };
        body.querySelectorAll('[data-game-order]').forEach(button=>button.onclick=()=>{
            state.gameOrder = button.dataset.gameOrder;
            state.gameScroll = 0;
            dialog?.close();
            _renderContent('profile'); focus(compact ? body.querySelector('[data-game-row]')?.dataset.steamFocus || 'tab-gaming' : button.dataset.steamFocus);
        });
        body.querySelector('[data-steam-focus=connect]')?.addEventListener('click',()=>{
            _initialAccountSection='connections'; _settingsSubView='account'; _preserveSettingsSubViewOnce=true; _selectCat(CATS.findIndex(cat=>cat.id==='settings')); _setTopbarFocus(false);
        });
        const list = body.querySelector('.nav-achievement-detail-list');
        list?.addEventListener('scroll', () => {
            if (list.isConnected && list.scrollHeight-list.clientHeight-list.scrollTop < list.clientHeight/2) _loadMoreTrophies();
        }, {passive:true});
        let previewTimer;
        games?.addEventListener('focusin', event => {
            clearTimeout(previewTimer);
            const row = event.target.closest('[data-steam-game]');
            if (!row) return;
            previewTimer = setTimeout(() => {
                if (!row.isConnected || document.activeElement !== row) return;
                const id = Number(row.dataset.steamGame);
                const game = state.games.find(game => game.AppId === id);
                for (const item of game?.previewIcons || []) {
                    const src = trophyImage(item, id);
                    if (src) new Image().src = src;
                }
            }, 220);
        });
        (games||list)?.addEventListener('load', event => {
            if (event.target.tagName === 'IMG') event.target.hidden = false;
        }, true);
        (games||list)?.addEventListener('error', event => {
            if (event.target.tagName === 'IMG' && !event.target.closest('.nav-trophy-art')) event.target.hidden = true;
        }, true);
    }
    function _navigateSteamAchievements(key, repeat) {
        const active = _contentItems[_contentIdx];
        const back = document.querySelector('[data-steam-focus=back]');
        if ((key==='Escape' || key==='Backspace') && back) { back.click(); return true; }
        if (!active || !key.startsWith('Arrow')) return false;
        const direction = key.slice(5).toUpperCase();
        const tabs = _contentItems.filter(item=>item.dataset.profileTab);
        const edit = _contentItems.find(item=>item.dataset.steamFocus==='edit');
        const content = _contentItems.filter(item=>!item.dataset.profileTab && item!==edit);
        let target;
        if (active===edit) {
            if (direction==='UP') _setTopbarFocus(true);
            if (direction==='DOWN') target=tabs.find(item=>item.classList.contains('is-active'));
        } else if (tabs.includes(active)) {
            if (direction==='UP') { if(edit){_contentIdx=_contentItems.indexOf(edit);_updateContentFocus();}else _setTopbarFocus(true); return true; }
            target = direction==='DOWN'?(content.find(item=>item.dataset.gameOrder && item.getAttribute('aria-pressed')==='true') || content[0]):findSpatialCandidate(tabs,active,direction);
        } else if (active.hasAttribute('data-game-row')) {
            const games = active.parentElement.children;
            const index = Number(active.dataset.gameRow);
            const columns = getComputedStyle(active.parentElement).gridTemplateColumns.split(' ').length;
            if (direction==='LEFT' && index%columns>0) target=games[index-1];
            if (direction==='RIGHT' && index%columns<columns-1) target=games[index+1];
            if (direction==='UP') target=games[index-columns] || content.find(item=>item.dataset.gameOrder && item.getAttribute('aria-pressed')==='true') || content.find(item=>item.dataset.steamFocus==='connect') || tabs.find(item=>item.classList.contains('is-active'));
            if (direction==='DOWN' && Math.floor(index/columns)<Math.floor((games.length-1)/columns))
                target=games[Math.min(index+columns,games.length-1)];
        } else if (active.matches('.nav-achievement-item') && (direction==='UP' || direction==='DOWN')) {
            const grid = active.parentElement;
            const columns = getComputedStyle(grid).gridTemplateColumns.split(' ').length;
            const index = Number(active.dataset.steamFocus.slice('trophy-'.length));
            if (direction==='UP') target = grid.children[index-columns] || back;
            else if (Math.floor(index/columns) < Math.floor((grid.childElementCount-1)/columns))
                target = grid.children[Math.min(index+columns,grid.childElementCount-1)];
            if (direction==='DOWN' && index+2*columns>=grid.childElementCount) _loadMoreTrophies();
        } else {
            target = findSpatialCandidate(content,active,direction);
            if (!target && direction==='UP') target = back && active!==back ? back : tabs.find(item=>item.dataset.profileTab==='gaming');
            if (!target && direction==='DOWN' && !active.matches('[data-game-row],.nav-achievement-item'))
                target=content.find(item=>item.matches('[data-game-row],.nav-achievement-item'));
            if (active.matches('.nav-achievement-item') && _contentIdx>=_contentItems.length-5) _loadMoreTrophies();
        }
        if (target) {
            _contentIdx=_contentItems.indexOf(target);
            _updateContentFocus();
            const list=target.closest('.nav-profile-grid');
            if(list) {
                const rapid = (direction==='UP' || direction==='DOWN') && (repeat || _libraryRapidNavigation);
                _revealInsideScrollContainer(target,list,12,rapid);
            }
        }
        return true;
    }
