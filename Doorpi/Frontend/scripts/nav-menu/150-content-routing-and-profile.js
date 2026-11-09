    // ── Renderização Central ──────────────────────────────────────────────────
    function _clearProfileOverviewCarousel() {
        if (!_profileOverviewCarouselTimer) return;
        clearTimeout(_profileOverviewCarouselTimer);
        _profileOverviewCarouselTimer = 0;
    }

    function _persistProfileOverviewCarousel(kind = '') {
        try {
            localStorage.setItem('doorpi.profile.hero.paused', _profileOverviewCarouselPaused ? '1' : '0');
            if (kind) localStorage.setItem('doorpi.profile.hero.kind', kind);
        } catch (_) {}
    }

    function _renderProfileWithTransition(direction = 'forward', focusIndex = _contentIdx) {
        _profileTabTransitionDirection = direction;
        const hadTopbarFocus = _topbarFocus;
        const update = () => {
            _renderContent('profile');
            _contentIdx = Math.max(0, Math.min(_contentItems.length - 1, focusIndex));
            if (!hadTopbarFocus) {
                _setTopbarFocus(false);
                _updateContentFocus();
            }
        };
        const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
        if (!reduceMotion && typeof document.startViewTransition === 'function') {
            document.documentElement.dataset.profileTransition = direction;
            try {
                const transition = document.startViewTransition(update);
                transition.finished.finally(() => {
                    delete document.documentElement.dataset.profileTransition;
                });
                return;
            } catch (_) {
                delete document.documentElement.dataset.profileTransition;
            }
        }
        update();
    }

    function _scheduleProfileOverviewCarousel(highlightCount) {
        _clearProfileOverviewCarousel();
        if (highlightCount < 2 || _profileSubView || _profileOverviewCarouselPaused ||
            window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return;
        _profileOverviewCarouselTimer = setTimeout(() => {
            _profileOverviewCarouselTimer = 0;
            if (!window.isNavMenuOpen || CATS[_catIdx]?.id !== 'profile' || _profileSubView || document.hidden) return;
            _profileOverviewAdvance?.(1, true);
        }, 8000);
    }

    function _renderContent(id) {
        const body = document.getElementById('navContentBody');
        if (!body) return;
        if (id !== 'profile' || _profileSubView) {
            _clearProfileOverviewCarousel();
            _profileOverviewAdvance = null;
        }
        _overlay?.classList.toggle('settings-ambient-active', id === 'settings');
        body.classList.toggle('profile-showcase-active', id === 'profile' && _profileSubView !== 'history');
        body.classList.toggle('settings-home-active', id === 'settings' && !_settingsSubView);
        body.classList.toggle('storage-management-active', id === 'settings' && _settingsSubView === 'system' && _systemSubView === 'storage');

        switch (id) {
            case 'games':
            case 'media':
                _contentItems = [];
                _attachDualPane(body);
                _switchDualPane(id);
                break;
            case 'settings':
                _contentItems = [];
                _detachDualPane(body);
                body.innerHTML = '';
                _renderSettings(body);
                break;
            case 'profile':
                _contentItems = [];
                _detachDualPane(body);
                body.innerHTML = '';
                if (_profileSubView === 'history') _renderProfileHistory(body);
                else _renderProfile(body);
                break;
        }
    }

    // ── Vitrine de Perfil ─────────────────────────────────────────────────────
    function _ensureUnifiedProfileStyles() {
        if (document.getElementById('doorpiUnifiedProfileStyles')) return;
        const style = document.createElement('style');
        style.id = 'doorpiUnifiedProfileStyles';
        style.textContent = __doorpiCss("injected-styles/nav-menu/doorpi-unified-profile-styles.css");
        document.head.appendChild(style);
    }

    function _renderProfile(body) {
        _ensureUnifiedProfileStyles();
        const prof = _menuData.user || {};
        const games = _menuData.games || [];
        const gameHistory = (_menuData.history || []).filter(item => item?.Name && Number(item.TotalPlaytimeMinutes) >= 1);
        const mediaHistory = (_menuData.mediaHistory || []).filter(item => item?.ContentTitle && Number(item.TotalPlaybackSeconds) >= 1);
        const mediaApps = _menuData.media || [];
        const tab = ['gaming', 'film-series', 'streaming', 'music'].includes(_profileSubView) ? _profileSubView : 'overview';
        const trackingEnabled = prof.ApplicationHistoryEnabled !== false && prof.applicationHistoryEnabled !== false;
        const name = prof.Name || 'Doorpi';
        const photo = prof.PhotoBase64 || '';

        const fmtSeconds = value => {
            const total = Math.max(0, Math.round(Number(value) || 0));
            if (total < 60) return total ? '< 1 min' : '--';
            const hours = Math.floor(total / 3600);
            const minutes = Math.floor((total % 3600) / 60);
            if (!hours) return `${minutes} min`;
            return `${hours}h ${String(minutes).padStart(2, '0')}min`;
        };
        const relDate = value => {
            const time = new Date(value || 0).getTime();
            if (!Number.isFinite(time) || time <= 0) return '';
            const days = Math.max(0, Math.floor((Date.now() - time) / 86400000));
            if (days === 0) return _t('today', 'hoje');
            if (days === 1) return _t('yesterday', 'ontem');
            if (days < 7) return `há ${days} dias`;
            return new Date(time).toLocaleDateString();
        };
        const isToday = value => {
            const date = new Date(value || 0);
            if (!Number.isFinite(date.getTime()) || date.getTime() <= 0) return false;
            const now = new Date();
            return date.getFullYear() === now.getFullYear() &&
                date.getMonth() === now.getMonth() &&
                date.getDate() === now.getDate();
        };
        const nowForTodayKey = new Date();
        const todayKey = `${nowForTodayKey.getFullYear()}-${String(nowForTodayKey.getMonth() + 1).padStart(2,'0')}-${String(nowForTodayKey.getDate()).padStart(2,'0')}`;
        const appFor = id => mediaApps.find(app => String(app.Id || app.id || '').toLowerCase() === String(id || '').toLowerCase()) || {};
        const appName = id => appFor(id).Name || mediaHistory.find(item => item.AppId === id)?.AppName || id || 'Doorpi';
        const appArt = app => app.HeroStaticImage || app.HeroImage || app.GridHorizontalStaticImage || app.GridHorizontalImage || app.GridStaticImage || app.GridImage || '';
        const appThumb = app => app.GridHorizontalStaticImage || app.GridHorizontalImage || app.HeroStaticImage || app.HeroImage || app.GridStaticImage || app.GridImage || '';
        const gameArt = item => item?.ProfileBannerLocalImage || item?.ProfileBannerImageUrl || item?.HistoryHorizontalLocalImage || item?.GridHorizontalStaticImage || item?.GridHorizontalImage || item?.HistoryHorizontalImageUrl || item?.GridStaticImage || item?.GridImage || '';
        const mediaArtChain = item => [...new Set([
            item?.ArtworkLocalUrl,
            item?.ArtworkRemoteUrl,
            appThumb(appFor(item?.AppId))
        ].filter(Boolean))];
        const isEpisode = item => String(item?.Category || '').toLowerCase() !== 'music' &&
            (String(item?.ContentType || '').toLowerCase() === 'episode' ||
             !!(item?.SeriesTitle && item.SeriesTitle !== item.ContentTitle));
        const mediaPrimaryTitle = item => isEpisode(item)
            ? (item?.SeriesTitle || item?.ContentTitle || appName(item?.AppId))
            : (item?.ContentTitle || item?.SeriesTitle || appName(item?.AppId));
        const mediaSecondaryTitle = item => {
            if (!isEpisode(item)) return '';
            if (item?.ContentTitle && item.ContentTitle !== mediaPrimaryTitle(item)) return item.ContentTitle;
            const episode = item?.EpisodeNumber ? `${_t('navEpisodeShort','Ep.')} ${item.EpisodeNumber}` : '';
            return [item?.SeasonTitle, episode].filter(Boolean).join(' · ');
        };
        const isLiveActivity = item => String(item?.Category || '').toLowerCase() === 'live' ||
            ['twitch', 'kick'].includes(String(item?.AppId || '').toLowerCase());
        const mediaActivityLabel = item => {
            if (!item) return '';
            if (String(item.Category || '').toLowerCase() === 'music') {
                return [item.ContentTitle, item.CreatorName, appName(item.AppId)].filter(Boolean).join(' · ');
            }
            if (isLiveActivity(item)) {
                const creator = String(item.CreatorName || '').trim();
                return creator
                    ? `${_t('navWatchedCreator','Assistiu')} ${creator} · ${appName(item.AppId)}`
                    : appName(item.AppId);
            }
            return [mediaPrimaryTitle(item), mediaSecondaryTitle(item), appName(item.AppId)]
                .filter(Boolean)
                .join(' · ');
        };
        const filmHighlightMeta = group => {
            if (!group) return '';
            const lastEpisode = isEpisode(group.latest) ? mediaSecondaryTitle(group.latest) : '';
            const watched = `${fmtSeconds(group.seconds)} ${_t('navProfileTotalSuffix','no total')}`;
            return lastEpisode
                ? `${_t('navLastEpisode','Último episódio')}: ${lastEpisode} · ${watched}`
                : watched;
        };
        const artImage = (chain, lazy = false, fallbackLabel = '', imageClass = '') => {
            const candidates = Array.isArray(chain) ? chain.filter(Boolean) : [];
            const fallback = `<span class="nav-unified-art-fallback"><span>${_esc(fallbackLabel || 'Doorpi')}</span></span>`;
            if (!candidates.length) return fallback;
            const fallbacks = encodeURIComponent(JSON.stringify(candidates.slice(1)));
            return `${fallback}<img${imageClass ? ` class="${_esc(imageClass)}"` : ''} src="${_esc(candidates[0])}" data-art-fallbacks="${_esc(fallbacks)}"${lazy ? ' loading="lazy" decoding="async"' : ''} alt="" />`;
        };
        const gameMinutes = gameHistory.reduce((sum, item) => sum + (Number(item.TotalPlaytimeMinutes) || 0), 0);
        const mediaSeconds = mediaHistory.reduce((sum, item) => sum + (Number(item.TotalPlaybackSeconds) || 0), 0);
        const films = mediaHistory.filter(item => item.Category === 'film-series');
        const streams = mediaHistory.filter(item => item.Category === 'live' || item.Category === 'video');
        const music = mediaHistory.filter(item => item.Category === 'music');
        const groupPlatforms = entries => [...entries.reduce((map, item) => {
            const key = item.AppId || 'unknown';
            const current = map.get(key) || { id:key, seconds:0, entries:[] };
            current.seconds += Number(item.TotalPlaybackSeconds) || 0;
            current.entries.push(item);
            map.set(key, current);
            return map;
        }, new Map()).values()].sort((a,b) => b.seconds - a.seconds);
        const groupFilmTitles = entries => [...entries.reduce((map, item) => {
            const title = mediaPrimaryTitle(item);
            const key = `${String(item.AppId || '').toLowerCase()}\u001f${title.toLocaleLowerCase()}`;
            const current = map.get(key) || { title, seconds:0, entries:[], latest:null };
            current.seconds += Number(item.TotalPlaybackSeconds) || 0;
            current.entries.push(item);
            if (!current.latest || new Date(item.LastPlayed || 0) > new Date(current.latest.LastPlayed || 0)) current.latest = item;
            map.set(key, current);
            return map;
        }, new Map()).values()].sort((a,b) => b.seconds - a.seconds);
        const mostPlayedGame = [...gameHistory].sort((a,b) => Number(b.TotalPlaytimeMinutes) - Number(a.TotalPlaytimeMinutes))[0];
        const latestGame = [...gameHistory].sort((a,b) => new Date(b.LastPlayed || 0) - new Date(a.LastPlayed || 0))[0];
        const latestMedia = [...mediaHistory].sort((a,b) => new Date(b.LastPlayed || 0) - new Date(a.LastPlayed || 0))[0];
        const filmPlatform = groupPlatforms(films)[0];
        const streamPlatform = groupPlatforms(streams)[0];

        const gameHighlight = mostPlayedGame ? {
            kind:'gaming',
            kicker:_t('navGamingHighlight','Destaque em jogos'),
            title:mostPlayedGame.Name,
            meta:`${fmtSeconds(Number(mostPlayedGame.TotalPlaytimeMinutes) * 60)} ${_t('navProfileTotalSuffix','no total')}`,
            art:gameArt(mostPlayedGame),
            artChain:[gameArt(mostPlayedGame)].filter(Boolean),
            appId:''
        } : null;
        const topFilm = groupFilmTitles(filmPlatform?.entries || [])[0];
        const filmHighlight = topFilm?.latest ? (() => {
            const chain = mediaArtChain(topFilm.latest);
            return {
                kind:'film-series',
                kicker:`${_t('navMostWatched','Mais assistido')} · ${appName(filmPlatform.id)}`,
                title:topFilm.title,
                meta:filmHighlightMeta(topFilm),
                art:chain[0] || appArt(appFor(filmPlatform.id)),
                artChain:chain,
                appId:filmPlatform.id
            };
        })() : null;
        const streamCreatorGroups = [...streams.reduce((map,item) => {
            const label = (item.CreatorName || item.ContentTitle || '').trim();
            const key = label.toLocaleLowerCase();
            if (label) {
                const current = map.get(key) || { label, seconds:0, entries:[] };
                current.seconds += Number(item.TotalPlaybackSeconds || 0);
                current.entries.push(item);
                map.set(key, current);
            }
            return map;
        }, new Map()).values()].sort((a,b) => b.seconds - a.seconds);
        const favoriteCreator = streamCreatorGroups[0];
        const favoriteCreatorEntry = favoriteCreator ? favoriteCreator.entries
            .sort((a,b) => {
                const aHasContentArt = !!(a.ArtworkLocalUrl || a.ArtworkRemoteUrl);
                const bHasContentArt = !!(b.ArtworkLocalUrl || b.ArtworkRemoteUrl);
                if (aHasContentArt !== bHasContentArt) return bHasContentArt - aHasContentArt;
                return new Date(b.LastPlayed || 0) - new Date(a.LastPlayed || 0);
            })[0] : null;
        const streamHighlight = favoriteCreator && favoriteCreatorEntry ? (() => {
            const chain = mediaArtChain(favoriteCreatorEntry);
            return {
                kind:'streaming',
                kicker:`${_t('navMostWatched','Mais assistido')} · ${appName(favoriteCreatorEntry.AppId)}`,
                title:favoriteCreator.label,
                meta:`${fmtSeconds(favoriteCreator.seconds)} ${_t('navProfileTotalSuffix','no total')}`,
                art:chain[0] || appArt(appFor(favoriteCreatorEntry.AppId)),
                artChain:chain,
                appId:favoriteCreatorEntry.AppId,
                channelHub:String(favoriteCreatorEntry.AppId || '').toLowerCase() === 'twitch' &&
                    String(favoriteCreatorEntry.ArtworkSource || '').toLowerCase() === 'channel-avatar',
                hubBackdrop:appArt(appFor(favoriteCreatorEntry.AppId))
            };
        })() : null;
        const musicArtistGroups = [...music.reduce((map,item) => {
            const label = (item.CreatorName || item.ContentTitle || '').trim();
            if (label) map.set(label, (map.get(label) || 0) + Number(item.TotalPlaybackSeconds || 0));
            return map;
        }, new Map()).entries()].sort((a,b) => b[1] - a[1]);
        const topMusicArtist = musicArtistGroups[0];
        const topMusicEntry = topMusicArtist ? music
            .filter(item => (item.CreatorName || item.ContentTitle || '').trim() === topMusicArtist[0])
            .sort((a,b) => new Date(b.LastPlayed || 0) - new Date(a.LastPlayed || 0))[0] : null;
        const musicHighlight = topMusicArtist && topMusicEntry ? (() => {
            const chain = mediaArtChain(topMusicEntry);
            return {
                kind:'music',
                kicker:`${_t('navMostListened','Mais ouvido')} · ${appName(topMusicEntry.AppId)}`,
                title:topMusicArtist[0],
                meta:`${fmtSeconds(topMusicArtist[1])} ${_t('navProfileTotalSuffix','no total')}`,
                art:chain[0] || appArt(appFor(topMusicEntry.AppId)),
                artChain:chain,
                appId:topMusicEntry.AppId
            };
        })() : null;
        const overviewHighlights = [gameHighlight, filmHighlight, streamHighlight, musicHighlight].filter(Boolean);

        let hero = {
            kicker:_t('navProfileEmptyKicker','Seu perfil'),
            title:_t('navProfileEmptyTitle','Nenhuma atividade registrada'),
            meta:_t('navProfileEmptyHint','Jogue ou assista para começar'),
            art:'', appId:'', isEmpty:true
        };
        let rows = [];
        let stats = [];
        let sectionTitle = _t('navTodayActivity', 'Atividade de hoje');
        const gameRows = gameHistory.map(item => ({ title:item.Name, sub:_t('navGames','Jogos'), seconds:Number(item.TotalPlaytimeMinutes) * 60, recentSeconds:Number(item.LastSessionMinutes) * 60, date:item.LastPlayed, artChain:[gameArt(item)].filter(Boolean), platform:_t('navGames','Jogos') }));
        const mediaRows = entries => entries.map(item => ({
            title:mediaPrimaryTitle(item),
            sub:item.Category === 'music'
                ? [item.CreatorName, item.AlbumTitle, appName(item.AppId)].filter(Boolean).join(' · ')
                : isEpisode(item)
                ? [mediaSecondaryTitle(item), appName(item.AppId)].filter(Boolean).join(' · ')
                : [item.CreatorName, appName(item.AppId)].filter(Boolean).join(' · '),
            seconds:Number(item.TotalPlaybackSeconds),
            recentSeconds:isToday(item.LastPlayed) && String(item.DailyPlaybackDate || '') === todayKey
                ? Number(item.DailyPlaybackSeconds)
                : 0,
            date:item.LastPlayed,
            artChain:mediaArtChain(item),
            platform:appName(item.AppId),
            source:item
        }));
        const filmRows = groupFilmTitles(films).map(group => ({
            title:group.title,
            sub:[isEpisode(group.latest) ? mediaSecondaryTitle(group.latest) : '', appName(group.latest?.AppId)].filter(Boolean).join(' · '),
            seconds:group.seconds,
            date:group.latest?.LastPlayed,
            artChain:mediaArtChain(group.latest),
            platform:appName(group.latest?.AppId)
        }));
        const streamRows = [...streams.reduce((map, item) => {
            const title = String(item.CreatorName || item.ContentTitle || appName(item.AppId)).trim();
            const key = title.toLocaleLowerCase();
            const current = map.get(key) || { title, seconds:0, date:item.LastPlayed, latest:item, platforms:new Set() };
            current.seconds += Number(item.TotalPlaybackSeconds) || 0;
            current.platforms.add(appName(item.AppId));
            if (new Date(item.LastPlayed || 0) > new Date(current.date || 0)) {
                current.date = item.LastPlayed;
                current.latest = item;
            }
            map.set(key, current);
            return map;
        }, new Map()).values()].map(item => ({
            ...item,
            sub:[...item.platforms].join(' · '),
            platform:appName(item.latest?.AppId),
            artChain:mediaArtChain(item.latest)
        }));
        const musicRows = mediaRows(music);

        if (tab === 'gaming') {
            if (gameHighlight) hero = { ...gameHighlight, kicker:_t('navStatMostPlayed','Mais jogado') };
            rows = gameRows.sort((a,b) => b.seconds - a.seconds);
            sectionTitle = _t('navMostPlayedGames', 'Mais jogados');
            stats = [
                [_t('navStatGames','Jogos na biblioteca'), String(games.length)],
                [_t('navStatTime','Tempo jogado'), fmtSeconds(gameMinutes * 60)],
                [_t('navLastPlayed','Último jogado'), latestGame?.Name || '--', true]
            ];
        } else if (tab === 'film-series') {
            if (filmHighlight) hero = filmHighlight;
            rows = filmRows.sort((a,b) => b.seconds - a.seconds);
            sectionTitle = _t('navMostWatchedTitles', 'Mais assistidos');
            stats = [
                [_t('navWatchTime','Tempo assistido'), fmtSeconds(films.reduce((s,i) => s + Number(i.TotalPlaybackSeconds || 0), 0))],
                [_t('navTitlesWatched','Séries/filmes assistidos'), String(groupFilmTitles(films).length)],
                [_t('navFavoritePlatform','Plataforma principal'), filmPlatform ? appName(filmPlatform.id) : '--', true]
            ];
        } else if (tab === 'streaming') {
            if (streamHighlight) hero = streamHighlight;
            rows = streamRows.sort((a,b) => b.seconds - a.seconds);
            sectionTitle = _t('navMostWatchedCreators', 'Mais assistidos');
            stats = [
                [_t('navWatchTime','Tempo assistido'), fmtSeconds(streams.reduce((s,i) => s + Number(i.TotalPlaybackSeconds || 0), 0))],
                [_t('navCreatorsWatched','Criadores acompanhados'), String(new Set(streams.map(i => i.CreatorName).filter(Boolean)).size)],
                [_t('navFavoritePlatform','Plataforma principal'), streamPlatform ? appName(streamPlatform.id) : '--', true]
            ];
        } else if (tab === 'music') {
            if (musicHighlight) hero = musicHighlight;
            rows = musicRows.sort((a,b) => b.seconds - a.seconds);
            sectionTitle = _t('navMostListenedTracks', 'Mais ouvidos');
            stats = [
                [_t('navListeningTime','Tempo ouvido'), fmtSeconds(music.reduce((s,i) => s + Number(i.TotalPlaybackSeconds || 0), 0))],
                [_t('navTracksListened','Faixas ouvidas'), String(new Set(music.map(i => `${i.ContentTitle}\u001f${i.CreatorName}`)).size)],
                [_t('navMostListenedArtist','Artista mais ouvido'), topMusicArtist?.[0] || '--', true]
            ];
        } else {
            if (overviewHighlights.length) {
                if (_profileOverviewCarouselPaused && _profileOverviewStoredKind) {
                    const storedIndex = overviewHighlights.findIndex(item => item.kind === _profileOverviewStoredKind);
                    if (storedIndex >= 0) _profileOverviewHeroIndex = storedIndex;
                }
                _profileOverviewHeroIndex %= overviewHighlights.length;
                hero = overviewHighlights[_profileOverviewHeroIndex];
            }
            rows = [...gameRows, ...mediaRows(mediaHistory)]
                .filter(item => isToday(item.date))
                .map(item => ({ ...item, seconds:Math.max(0, Number(item.recentSeconds) || 0) }))
                .sort((a,b) => new Date(b.date || 0) - new Date(a.date || 0));
            const latestGameToday = isToday(latestGame?.LastPlayed) ? latestGame : null;
            const latestMediaToday = isToday(latestMedia?.LastPlayed) ? latestMedia : null;
            const latestIsMedia = new Date(latestMediaToday?.LastPlayed || 0) > new Date(latestGameToday?.LastPlayed || 0);
            stats = [
                [_t('navGamingTime','Tempo em jogos'), fmtSeconds(gameMinutes * 60)],
                [_t('navWatchTime','Tempo assistido'), fmtSeconds(mediaSeconds)],
                [_t('navLastActivity','Última atividade'), (latestIsMedia ? mediaActivityLabel(latestMediaToday) : latestGameToday?.Name) || '--', true]
            ];
        }

        const accentByApp = { youtube:'255,68,68', netflix:'229,9,20', twitch:'145,70,255', kick:'83,252,24', disneyplus:'63,117,255', primevideo:'0,168,225', appletv:'235,235,240', max:'116,63,255', crunchyroll:'244,117,33' };
        const accentForHero = item => accentByApp[item?.appId] || (item?.kind === 'music' || tab === 'music' ? '52,211,120' : item?.kind === 'gaming' || tab === 'gaming' ? '92,154,255' : '110,156,255');
        const accent = accentForHero(hero);
        const applyChannelBackdrop = (element, item) => {
            if (!element) return;
            const backdrop = item?.channelHub ? String(item.hubBackdrop || '').trim() : '';
            if (backdrop) element.style.setProperty('--twitch-channel-backdrop', `url(${JSON.stringify(backdrop)})`);
            else element.style.removeProperty('--twitch-channel-backdrop');
        };
        const tabs = [
            ['overview', _t('navProfileOverview','Visão geral')],
            ['gaming', _t('navGames','Jogos')],
            ['film-series', _t('navFilmsSeries','Filmes e séries')],
            ['streaming', _t('navStreamingVideos','Ao vivo e vídeos')],
            ['music', _t('navMusic','Música')]
        ];
        const rowHtml = rows.map((item, index) => `
            <div class="nav-unified-row${index === 0 ? ' is-current' : ''}" data-profile-recent-index="${index}" role="option" aria-selected="${index === 0 ? 'true' : 'false'}">
                <span class="nav-unified-row-art">${artImage(item.artChain, true, item.platform)}</span>
                <span class="nav-unified-row-copy"><strong>${_esc(item.title)}</strong><small>${_esc(item.sub || '')}</small></span>
                <span class="nav-unified-row-time"><strong>${fmtSeconds(item.seconds)}</strong><small>${relDate(item.date)}</small></span>
            </div>`).join('');
        const heroCarouselEnabled = tab === 'overview' && overviewHighlights.length > 1;
        const heroPager = heroCarouselEnabled
            ? `<span class="nav-unified-hero-pager" aria-hidden="true"><b class="nav-unified-hero-state${_profileOverviewCarouselPaused ? ' is-paused' : ''}"><svg class="icon-play" viewBox="0 0 12 12"><path d="M2.4 1.4 10 6l-7.6 4.6z"/></svg><svg class="icon-pause" viewBox="0 0 12 12"><path d="M2.2 1.5h2.6v9H2.2zm5 0h2.6v9H7.2z"/></svg></b>${overviewHighlights.map((_, index) => `<i class="${index === _profileOverviewHeroIndex ? 'is-active' : ''}"></i>`).join('')}</span>`
            : '';
        const profileEntryClass = document.documentElement.dataset.profileTransition
            ? ''
            : ` is-entering-${_profileTabTransitionDirection}`;

        body.innerHTML = `
            <div class="nav-unified-profile${profileEntryClass}" style="--profile-accent:${accent}">
                <header class="nav-unified-identity">
                    <div class="nav-unified-avatar">${photo ? `<img src="${window._doorpiUserPhotoSrc?.(photo) || `data:image/png;base64,${photo}`}" alt="" />` : '◎'}</div>
                    <div class="nav-unified-name"><h2>${_esc(name)}</h2></div>
                    <button class="nav-unified-edit" id="btnEditProfileHub" tabindex="-1">${_t('navEditProfileBtn','Editar perfil')}</button>
                </header>
                <nav class="nav-unified-tabs" aria-label="${_t('navProfileSections','Seções do perfil')}">${tabs.map(([id,label]) => `<button class="nav-unified-tab${tab === id ? ' is-active' : ''}" data-profile-tab="${id}" tabindex="-1">${label}</button>`).join('')}</nav>
                <div class="nav-unified-main">
                    <section class="nav-unified-hero${hero.isEmpty ? ' is-empty' : ''}${heroCarouselEnabled ? ' is-carousel' : ''}${hero.channelHub ? ' is-twitch-channel' : ''}"${heroCarouselEnabled ? ` id="btnProfileHero" role="button" aria-label="${_esc(_profileOverviewCarouselPaused ? _t('navPlayHighlights','Retomar troca automática') : _t('navPauseHighlights','Pausar troca automática'))}" tabindex="-1"` : ''}>${artImage(hero.artChain?.length ? hero.artChain : [hero.art].filter(Boolean), false, hero.appId ? appName(hero.appId) : _t('navGames','Jogos'), hero.channelHub ? 'is-channel-avatar' : '')}<div class="nav-unified-hero-copy"><span class="nav-unified-kicker">${_esc(hero.kicker)}</span><h3>${_esc(hero.title)}</h3><span class="nav-unified-hero-meta">${_esc(hero.meta)}</span></div>${heroPager}</section>
                    <aside class="nav-unified-recent"${rows.length ? ` id="btnProfileRecent" role="listbox" aria-label="${_esc(sectionTitle)}" tabindex="-1"` : ''}><div class="nav-unified-section-head"><strong>${sectionTitle}</strong>${tab === 'gaming' && gameHistory.length ? `<button class="nav-unified-journey" id="btnGameHistory" tabindex="-1">${_t('navGameHistoryBtn','Ver jornada')}</button>` : ''}</div><div class="nav-unified-list">${rowHtml || `<div class="nav-unified-empty">${tab === 'overview' && trackingEnabled ? _t('navNoActivityToday','Nenhuma atividade hoje.') : trackingEnabled || tab === 'gaming' ? _t('navNoCategoryActivity','Nenhuma atividade nesta categoria ainda.') : _t('navHistoryPausedHint','A coleta está pausada nas configurações do perfil.')}</div>`}</div></aside>
                </div>
                <footer class="nav-unified-stats">${stats.map(([label,value,compact]) => `<div class="nav-unified-stat${compact ? ' is-compact' : ''}"><small>${label}</small><strong>${_esc(value)}</strong></div>`).join('')}</footer>
            </div>`;

        applyChannelBackdrop(body.querySelector('.nav-unified-hero'), hero);

        const bindArtFallback = image => {
            let fallbacks = [];
            try { fallbacks = JSON.parse(decodeURIComponent(image.dataset.artFallbacks || '[]')); } catch (_) {}
            image.addEventListener('error', () => {
                const next = fallbacks.shift();
                if (next) image.src = next;
                else image.remove();
            });
        };
        body.querySelectorAll('img[data-art-fallbacks]').forEach(bindArtFallback);

        _contentItems = [...body.querySelectorAll('.nav-unified-tab')];
        const heroButton = body.querySelector('#btnProfileHero');
        const recent = body.querySelector('#btnProfileRecent');
        const edit = body.querySelector('#btnEditProfileHub');
        const journey = body.querySelector('#btnGameHistory');
        if (heroButton) _contentItems.push(heroButton);
        if (recent) _contentItems.push(recent);
        if (edit) _contentItems.push(edit);
        if (journey) _contentItems.push(journey);
        if (recent) {
            const recentRows = [...recent.querySelectorAll('.nav-unified-row')];
            const recentList = recent.querySelector('.nav-unified-list');
            let recentIndex = 0;
            const selectRecent = (index, smooth = true) => {
                const next = Math.max(0, Math.min(recentRows.length - 1, index));
                const changed = next !== recentIndex;
                recentIndex = next;
                recentRows.forEach((row, rowIndex) => {
                    const selected = rowIndex === recentIndex;
                    row.classList.toggle('is-current', selected);
                    row.setAttribute('aria-selected', selected ? 'true' : 'false');
                });
                const row = recentRows[recentIndex];
                if (row && recentList) {
                    const rowRect = row.getBoundingClientRect();
                    const listRect = recentList.getBoundingClientRect();
                    if (rowRect.bottom > listRect.bottom)
                        recentList.scrollBy({ top: rowRect.bottom - listRect.bottom, behavior: smooth ? 'smooth' : 'auto' });
                    else if (rowRect.top < listRect.top)
                        recentList.scrollBy({ top: rowRect.top - listRect.top, behavior: smooth ? 'smooth' : 'auto' });
                }
                return changed;
            };
            recent._profileRecentStep = direction => selectRecent(recentIndex + direction);
            recent._profileRecentAtStart = () => recentIndex <= 0;
        }
        if (heroButton) {
            let requestedHeroIndex = _profileOverviewHeroIndex;
            let highlightRequestToken = 0;
            let cancelActiveTransition = () => {};
            const resolveLoadedArt = sources => new Promise(resolve => {
                const candidates = [...new Set((sources || []).filter(Boolean))];
                const tryCandidate = index => {
                    if (index >= candidates.length) {
                        resolve('');
                        return;
                    }
                    const source = candidates[index];
                    const probe = new Image();
                    let active = true;
                    const timeout = setTimeout(() => {
                        if (!active) return;
                        active = false;
                        tryCandidate(index + 1);
                    }, 4000);
                    probe.onload = async () => {
                        if (!active) return;
                        active = false;
                        clearTimeout(timeout);
                        try { await probe.decode?.(); } catch (_) {}
                        resolve(source);
                    };
                    probe.onerror = () => {
                        if (!active) return;
                        active = false;
                        clearTimeout(timeout);
                        tryCandidate(index + 1);
                    };
                    probe.src = source;
                };
                tryCandidate(0);
            });
            const applyHighlightPresentation = (next, index) => {
                const profile = heroButton.closest('.nav-unified-profile');
                heroButton.classList.toggle('is-empty', !!next.isEmpty);
                heroButton.classList.toggle('is-twitch-channel', !!next.channelHub);
                applyChannelBackdrop(heroButton, next);
                heroButton.querySelector('.nav-unified-kicker').textContent = next.kicker || '';
                heroButton.querySelector('h3').textContent = next.title || '';
                heroButton.querySelector('.nav-unified-hero-meta').textContent = next.meta || '';
                const fallbackLabel = heroButton.querySelector('.nav-unified-art-fallback span');
                if (fallbackLabel) fallbackLabel.textContent = next.appId ? appName(next.appId) : _t('navGames','Jogos');
                profile?.style.setProperty('--profile-accent', accentForHero(next));
                heroButton.querySelectorAll('.nav-unified-hero-pager i').forEach((dot, dotIndex) => {
                    dot.classList.toggle('is-active', dotIndex === index);
                });
            };
            const commitHighlightArt = (loadedSource, durationMs, token, automatic, channelHub = false) => new Promise(resolve => {
                if (!heroButton.isConnected || token !== highlightRequestToken) {
                    resolve(false);
                    return;
                }
                const oldImages = [...heroButton.children].filter(element => element.tagName === 'IMG');
                if (!automatic) {
                    oldImages.forEach(image => image.remove());
                    if (loadedSource) {
                        const image = document.createElement('img');
                        image.src = loadedSource;
                        image.alt = '';
                        if (channelHub) image.classList.add('is-channel-avatar');
                        heroButton.insertBefore(image, heroButton.firstChild);
                    }
                    heroButton.style.setProperty('--hero-fade-duration', '1600ms');
                    resolve(true);
                    return;
                }

                let nextImage = null;
                heroButton.style.setProperty('--hero-fade-duration', `${durationMs}ms`);
                if (loadedSource) {
                    nextImage = document.createElement('img');
                    nextImage.src = loadedSource;
                    nextImage.alt = '';
                    nextImage.className = `is-next-art${channelHub ? ' is-channel-avatar' : ''}`;
                    heroButton.insertBefore(nextImage, heroButton.firstChild);
                }

                let cleaned = false;
                const finish = () => {
                    if (cleaned) return;
                    cleaned = true;
                    oldImages.forEach(image => image.remove());
                    nextImage?.classList.remove('is-next-art', 'is-visible');
                    if (cancelActiveTransition === cancel) cancelActiveTransition = () => {};
                    resolve(token === highlightRequestToken);
                };
                const cancel = () => {
                    if (cleaned) return;
                    cleaned = true;
                    nextImage?.remove();
                    oldImages.forEach(image => {
                        image.style.transition = 'none';
                        image.classList.remove('is-leaving-art');
                        requestAnimationFrame(() => image.style.removeProperty('transition'));
                    });
                    if (cancelActiveTransition === cancel) cancelActiveTransition = () => {};
                    resolve(false);
                };
                cancelActiveTransition = cancel;
                requestAnimationFrame(() => requestAnimationFrame(() => {
                    if (token !== highlightRequestToken) {
                        cancel();
                        return;
                    }
                    oldImages.forEach(image => image.classList.add('is-leaving-art'));
                    nextImage?.classList.add('is-visible');
                    if (durationMs === 0) finish();
                }));
                nextImage?.addEventListener('transitionend', event => {
                    if (event.propertyName === 'opacity') {
                        if (token === highlightRequestToken) finish();
                        else cancel();
                    }
                }, { once:true });
                setTimeout(() => token === highlightRequestToken ? finish() : cancel(), durationMs + 280);
            });
            const applyHighlight = (step, automatic = false) => {
                _clearProfileOverviewCarousel();
                if (!automatic) cancelActiveTransition();
                requestedHeroIndex = (requestedHeroIndex + step + overviewHighlights.length) % overviewHighlights.length;
                _profileOverviewHeroIndex = requestedHeroIndex;
                const next = overviewHighlights[requestedHeroIndex];
                applyHighlightPresentation(next, requestedHeroIndex);
                const chain = next.artChain?.length ? next.artChain : [next.art].filter(Boolean);
                const token = ++highlightRequestToken;
                resolveLoadedArt(chain).then(async loadedSource => {
                    if (token !== highlightRequestToken || !heroButton.isConnected) return;
                    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
                    const completed = await commitHighlightArt(loadedSource, reduceMotion ? 0 : 1600, token, automatic, !!next.channelHub);
                    if (completed && token === highlightRequestToken && heroButton.isConnected)
                        _scheduleProfileOverviewCarousel(overviewHighlights.length);
                });

                if (_profileOverviewCarouselPaused && !automatic) {
                    _profileOverviewStoredKind = next.kind || '';
                    _persistProfileOverviewCarousel(_profileOverviewStoredKind);
                }
            };
            const toggleCarousel = () => {
                _profileOverviewCarouselPaused = !_profileOverviewCarouselPaused;
                const current = overviewHighlights[requestedHeroIndex];
                if (_profileOverviewCarouselPaused) _profileOverviewStoredKind = current?.kind || '';
                _persistProfileOverviewCarousel(_profileOverviewStoredKind);
                heroButton.querySelector('.nav-unified-hero-state')?.classList.toggle('is-paused', _profileOverviewCarouselPaused);
                heroButton.setAttribute('aria-label', _profileOverviewCarouselPaused
                    ? _t('navPlayHighlights','Retomar troca automática')
                    : _t('navPauseHighlights','Pausar troca automática'));
                _scheduleProfileOverviewCarousel(overviewHighlights.length);
            };
            heroButton._profileHeroStep = applyHighlight;
            heroButton.addEventListener('click', toggleCarousel);
            _profileOverviewAdvance = applyHighlight;
        } else {
            _profileOverviewAdvance = null;
        }
        body.querySelectorAll('.nav-unified-tab').forEach(button => button.addEventListener('click', () => {
            const currentTabIndex = tabs.findIndex(([id]) => id === tab);
            const nextTabIndex = tabs.findIndex(([id]) => id === button.dataset.profileTab);
            const direction = nextTabIndex < currentTabIndex ? 'back' : 'forward';
            _profileSubView = button.dataset.profileTab === 'overview' ? null : button.dataset.profileTab;
            _contentIdx = nextTabIndex;
            _renderProfileWithTransition(direction, nextTabIndex);
        }));
        edit?.addEventListener('click', () => {
            _catIdx = CATS.findIndex(cat => cat.id === 'settings');
            _settingsSubView = 'accountHub';
            document.querySelectorAll('.nav-cat-item').forEach((el, i) => el.classList.toggle('active', i === _catIdx));
            _updateTopbarFocusVisual();
            _contentIdx = 0;
            const headerWrap = document.getElementById('navHeaderWrap');
            if (headerWrap) headerWrap.style.display = 'block';
            document.getElementById('navContentTitle').textContent = CATS[_catIdx].label;
            document.getElementById('navContentSub').textContent = _subtitle('settings');
            _renderContent('settings');
            _setTopbarFocus(false);
        });
        journey?.addEventListener('click', () => {
            _profileSubView = 'history';
            _contentIdx = 0;
            _renderContent('profile');
            _setTopbarFocus(false);
        });
        if (tab === 'overview') {
            overviewHighlights.forEach((item, index) => {
                if (index === _profileOverviewHeroIndex) return;
                const source = item.artChain?.[0] || item.art;
                if (source) {
                    const preload = new Image();
                    preload.src = source;
                }
            });
        }
        _scheduleProfileOverviewCarousel(tab === 'overview' ? overviewHighlights.length : 0);
    }

