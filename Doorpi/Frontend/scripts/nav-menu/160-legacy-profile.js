    function _renderLegacyProfile(body) {
        const prof = _menuData.user || {};
        const name = prof.Name || '—';
        const photo = prof.PhotoBase64 || '';
        const games = _menuData.games || [];
        const history = (_menuData.history || [])
            .filter(item => item?.Name && (Number(item.TotalPlaytimeMinutes) || 0) >= 1);

        const totalGames = games.length;

        const totalMinutes = history.reduce((sum, g) => sum + (g.TotalPlaytimeMinutes || 0), 0);

        const mostPlayed = [...history]
            .filter(g => (g.TotalPlaytimeMinutes || 0) > 0)
            .sort((a, b) => b.TotalPlaytimeMinutes - a.TotalPlaytimeMinutes)[0];

        const playedGames = history
            .filter(g => (g.TotalPlaytimeMinutes || 0) > 0)
            .sort((a, b) => (b.TotalPlaytimeMinutes || 0) - (a.TotalPlaytimeMinutes || 0));

        const fmtTime = (minutes) => {
            if (!minutes || minutes < 1) return null;
            const h = Math.floor(minutes / 60);
            const m = minutes % 60;
            if (h === 0) return `${m}min`;
            if (m === 0) return `${h}h`;
            return `${h}h ${m}min`;
        };

        const relDate = (dateStr) => {
            if (!dateStr || dateStr.startsWith('0001')) return '';
            const diffDays = Math.floor((Date.now() - new Date(dateStr)) / 86400000);
            if (diffDays === 0) return _t('today', 'hoje');
            if (diffDays === 1) return _t('yesterday', 'ontem');
            if (diffDays < 7) return `há ${diffDays}d`;
            if (diffDays < 30) return `há ${Math.floor(diffDays / 7)}sem`;
            return new Date(dateStr).toLocaleDateString();
        };

        const totalFmt = fmtTime(totalMinutes) || '--';
        const mostPlayedFmt = mostPlayed ? (fmtTime(mostPlayed.TotalPlaytimeMinutes) || '') : '';
        const validDate = (dateStr) => {
            if (!dateStr || String(dateStr).startsWith('0001')) return false;
            const time = new Date(dateStr).getTime();
            return Number.isFinite(time) && time > 0;
        };
        const artFor = (item, wide = false) => {
            if (!item) return '';
            if (wide) {
                return item.HistoryHorizontalLocalImage || item.GridHorizontalStaticImage || item.GridHorizontalImage ||
                    item.HistoryHorizontalImageUrl || item.ShowcaseVerticalLocalImage || item.GridStaticImage ||
                    item.GridImage || item.ShowcaseVerticalImageUrl || '';
            }
            return item.ShowcaseVerticalLocalImage || item.GridStaticImage || item.GridImage ||
                item.ShowcaseVerticalImageUrl || item.HistoryHorizontalLocalImage ||
                item.GridHorizontalStaticImage || item.GridHorizontalImage || item.HistoryHorizontalImageUrl || '';
        };
        const lastPlayed = [...history]
            .filter(g => validDate(g.LastPlayed))
            .sort((a, b) => new Date(b.LastPlayed) - new Date(a.LastPlayed))[0];
        const lastPlayedArt = artFor(lastPlayed, true);
        const lastPlayedPlatform = _getPlatformData(lastPlayed?.Source || '');
        const mostPlayedArt = mostPlayed
            ? (mostPlayed.ProfileBannerLocalImage || mostPlayed.ProfileBannerImageUrl || artFor(mostPlayed, true))
            : '';
        const mostPlayedPlatform = _getPlatformData(mostPlayed?.Source || '');
        const lastPlayedSessionFmt = lastPlayed ? (fmtTime(lastPlayed.LastSessionMinutes) || '') : '';
        const lastPlayedWhen = lastPlayed && validDate(lastPlayed.LastPlayed) ? relDate(lastPlayed.LastPlayed) : '';
        const libraryStatIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="4" width="17" height="16" rx="2.5"/><path d="M8 4v16M12 8h5M12 12h5M12 16h3"/></svg>`;
        const timeStatIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v5l3.5 2"/></svg>`;
        body.innerHTML = `
        <div class="nav-profile-showcase">
            <div class="nav-profile-cover">
                ${mostPlayedArt ? `<img class="nav-profile-cover-art" src="${mostPlayedArt}" alt="" />` : ''}
                <button class="nav-profile-edit-btn" id="btnEditProfileHub" tabindex="-1">
                    ${_t('navEditProfileBtn', 'Editar Perfil')}
                </button>
                <div class="nav-profile-header">
                <div class="nav-profile-avatar-large">
                    ${photo ? `<img src="${window._doorpiUserPhotoSrc?.(photo) || `data:image/png;base64,${photo}`}" />` : '◉'}
                </div>
                <div class="nav-profile-info">
                    <h2 class="nav-profile-name">${name}</h2>
                </div>
                </div>
                ${mostPlayed ? `
                <div class="nav-profile-cover-game">
                    <span class="nav-profile-cover-game-kicker">${_t('navStatMostPlayed', 'Mais jogado')}</span>
                    <strong class="nav-profile-cover-game-title">${_esc(mostPlayed.Name)}</strong>
                    <span class="nav-profile-cover-game-meta">
                        <span class="nav-profile-cover-game-platform">${mostPlayedPlatform.svg}</span>
                        <span>${mostPlayedFmt || '--'} ${_t('navProfileTotalSuffix', 'no total')}</span>
                    </span>
                </div>` : ''}
            </div>

            <div class="nav-profile-stats-row">
                <div class="nav-profile-stat-box">
                    <span class="nav-profile-stat-icon">${libraryStatIcon}</span>
                    <span class="nav-profile-stat-copy">
                        <span class="stat-label">${_t('navStatGames', 'Jogos na Biblioteca')}</span>
                        <span class="stat-value">${totalGames}</span>
                    </span>
                </div>
                <div class="nav-profile-stat-box ${totalMinutes === 0 ? 'future-placeholder' : ''}">
                    <span class="nav-profile-stat-icon">${timeStatIcon}</span>
                    <span class="nav-profile-stat-copy">
                        <span class="stat-label">${_t('navStatTime', 'Horas Jogadas')}</span>
                        <span class="stat-value">${totalFmt}</span>
                    </span>
                </div>
                <div class="nav-profile-stat-box nav-profile-last-stat ${!lastPlayed ? 'future-placeholder' : ''}">
                    <span class="nav-profile-stat-thumb">
                        ${lastPlayedArt
                ? `<img src="${lastPlayedArt}" alt="${lastPlayed ? _esc(lastPlayed.Name) : ''}" />`
                : `<span class="nav-profile-stat-platform">${lastPlayedPlatform.svg}</span>`}
                    </span>
                    <span class="nav-profile-stat-copy">
                        <span class="stat-label">${_t('navLastPlayed', 'Último jogado')}</span>
                        <span class="nav-profile-last-name">${lastPlayed ? _esc(lastPlayed.Name) : '--'}</span>
                    </span>
                    <span class="nav-profile-last-meta">
                        <strong>${lastPlayedSessionFmt || '--'}</strong>
                        <small>${lastPlayedSessionFmt ? `${_t('navLastSession', 'última sessão')} · ` : ''}${lastPlayedWhen || _t('navNoRecentActivity', 'sem atividade recente')}</small>
                    </span>
                </div>
            </div>

            <div class="nav-profile-section-head">
                <div class="nav-profile-section-title">${_t('navMostPlayedGames', 'Mais jogados')}</div>
                <button class="nav-profile-journey-btn" id="btnGameHistory" tabindex="-1">
                    ${_t('navGameHistoryBtn', 'Ver jornada')}
                </button>
            </div>
            <div class="nav-profile-recent-grid" id="profileRecentGrid"></div>
        </div>
    `;

        _contentItems = [];

        const btnEdit = body.querySelector('#btnEditProfileHub');
        if (btnEdit) {
            _contentItems.push(btnEdit);
            btnEdit.addEventListener('click', () => {
                _catIdx = 2;
                _settingsSubView = 'accountHub';
                document.querySelectorAll('.nav-cat-item').forEach((el, i) => el.classList.toggle('active', i === _catIdx));
                _updateTopbarFocusVisual();
                _contentIdx = 0;
                const headerWrap = document.getElementById('navHeaderWrap');
                if (headerWrap) headerWrap.style.display = 'block';
                document.getElementById('navContentTitle').textContent = CATS[_catIdx].label;
                document.getElementById('navContentSub').textContent = _subtitle(CATS[_catIdx].id);
                _renderContent('settings');
                _setTopbarFocus(false);
            });
        }

        const btnHistory = body.querySelector('#btnGameHistory');
        if (btnHistory) {
            _contentItems.push(btnHistory);
            btnHistory.addEventListener('click', () => {
                _profileSubView = 'history';
                _contentIdx = 0;
                _renderContent('profile');
                _setTopbarFocus(false);
            });
        }

        const grid = body.querySelector('#profileRecentGrid');

        const idealCardWidth = Math.max(
            190,
            Math.min(310, window.innerWidth * .15, window.innerHeight * .27)
        );
        const gridGap = Math.max(14, Math.min(24, window.innerWidth * .0115));
        const gridStyle = getComputedStyle(grid);
        const horizontalInsets = (parseFloat(gridStyle.paddingLeft) || 0) + (parseFloat(gridStyle.paddingRight) || 0);
        const verticalInsets = (parseFloat(gridStyle.paddingTop) || 0) + (parseFloat(gridStyle.paddingBottom) || 0);
        const availableGridWidth = Math.max(0, grid.clientWidth - horizontalInsets);
        const availableGridHeight = Math.max(0, grid.clientHeight - verticalInsets);
        const safeBottom = Math.max(14, Math.min(34, window.innerHeight * .022));
        const maxCardWidthByHeight = Math.max(150, (availableGridHeight - safeBottom) * (2 / 3));
        const widthDrivenSlots = Math.floor((availableGridWidth + gridGap) / (idealCardWidth + gridGap));
        const heightDrivenSlots = Math.ceil((availableGridWidth + gridGap) / (maxCardWidthByHeight + gridGap));
        const visibleSlots = Math.max(
            2,
            widthDrivenSlots,
            heightDrivenSlots
        );
        const showcaseGames = playedGames.slice(0, visibleSlots);
        grid.style.gridTemplateColumns = `repeat(${visibleSlots}, minmax(0, 1fr))`;

        if (showcaseGames.length === 0) {
            grid.innerHTML = `<div style="color:rgba(255,255,255,0.3); grid-column:1/-1;">
            ${_t('navNoPlayedGames', 'Nenhum jogo jogado ainda')}
        </div>`;
        } else {
            showcaseGames.forEach((item, index) => {
                const localSrc = item.ShowcaseVerticalLocalImage || item.GridStaticImage || item.GridImage || '';
                const remoteSrc = item.ShowcaseVerticalImageUrl || '';
                const staticSrc = localSrc || remoteSrc;
                const totalFmtItem = fmtTime(item.TotalPlaytimeMinutes);
                const lastFmt = fmtTime(item.LastSessionMinutes);
                const dateStr = relDate(item.LastPlayed);
                const pData = _getPlatformData(item.LaunchUrl || item.Source);

                const card = document.createElement('div');
                card.className = `nav-profile-recent-card${index === 0 ? ' is-top-played' : ''}`;
                card.dataset.historyGameName = item.Name;

                card.innerHTML = staticSrc
                    ? `<img src="${staticSrc}" alt="${item.Name}" />`
                    : `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:rgba(255,255,255,0.1);font-size:2rem;">⊞</div>`;

                if (index === 0) {
                    card.innerHTML += `
                <div class="nav-profile-top-badge" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none">
                        <path d="M7 4h10v3.3c0 3.7-2 6-5 6s-5-2.3-5-6V4Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
                        <path d="M7 6H4.8c0 3.1 1.4 5 3.7 5.5M17 6h2.2c0 3.1-1.4 5-3.7 5.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M12 13.5V17M8.8 20h6.4M10 17h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                    </svg>
                </div>`;
                }

                card.innerHTML += `
                <div class="nav-card-gradient"></div>
                <div class="nav-profile-recent-info">
                    <div class="nav-profile-recent-platform-icon">${pData.svg}</div>
                    <div class="nav-profile-recent-text">
                        <span class="nav-profile-recent-title">${item.Name}</span>
                        <div style="display:flex;flex-direction:column;gap:2px;margin-top:4px;">
                            ${totalFmtItem
                        ? `<span class="nav-profile-recent-date">${totalFmtItem} no total</span>`
                        : ''}
                            ${lastFmt
                        ? `<span class="nav-profile-recent-date" style="color:rgba(255,255,255,0.45);">última: ${lastFmt}</span>`
                        : ''}
                            ${dateStr
                        ? `<span class="nav-profile-recent-date" style="color:rgba(255,255,255,0.35);">${dateStr}</span>`
                        : ''}
                        </div>
                    </div>
                </div>
            `;

                grid.appendChild(card);
                const artworkImage = card.querySelector(':scope > img');
                if (artworkImage && remoteSrc && remoteSrc !== staticSrc) {
                    artworkImage.addEventListener('error', () => {
                        if (artworkImage.src === remoteSrc) return;
                        artworkImage.src = remoteSrc;
                    }, { once: true });
                }
                _contentItems.push(card);

                card.addEventListener('mouseenter', () => {
                    _topbarFocus = false;
                    _contentIdx = _contentItems.indexOf(card);
                    _updateContentFocus();
                });
                card.addEventListener('contextmenu', event => {
                    event.preventDefault();
                    _openHistoryContextMenu(card);
                });
            });
        }
    }

