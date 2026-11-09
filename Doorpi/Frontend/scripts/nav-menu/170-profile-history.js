    function _openHistoryArtworkPicker(item, element) {
        if (!item || !element || typeof window.openDoorpiHistoryArtworkPicker !== 'function') return;
        window.openDoorpiHistoryArtworkPicker(element, item, images => {
            if (images.verticalSourceUrl) {
                item.ShowcaseVerticalImageUrl = images.verticalSourceUrl;
                item.ShowcaseVerticalLocalImage = '';
            } else if (images.vertical) {
                item.ShowcaseVerticalLocalImage = images.vertical;
            }
            if (images.horizontalSourceUrl) {
                item.HistoryHorizontalImageUrl = images.horizontalSourceUrl;
                item.HistoryHorizontalLocalImage = '';
            } else if (images.horizontal) {
                item.HistoryHorizontalLocalImage = images.horizontal;
            }
            if (images.bannerSourceUrl) {
                item.ProfileBannerImageUrl = images.bannerSourceUrl;
                item.ProfileBannerLocalImage = '';
            } else if (images.banner) {
                item.ProfileBannerLocalImage = images.banner;
            }
            const previousIndex = _contentIdx;
            _renderContent('profile');
            _contentIdx = Math.max(0, Math.min(previousIndex, _contentItems.length - 1));
            _updateContentFocus();
        });
    }

    function _openHistoryContextMenu(element) {
        if (!element || typeof window._ctxMenuOpen !== 'function') return;
        const rect = element.getBoundingClientRect();
        window._ctxMenuOpen(element, rect.right + 2, rect.top);
    }

    function _findHistoryItem(element) {
        const name = element?.dataset?.historyGameName || '';
        return (_menuData.history || []).find(entry =>
            String(entry?.Name || '').localeCompare(name, undefined, { sensitivity: 'base' }) === 0);
    }

    function _renderProfileHistory(body) {
        const history = [...(_menuData.history || [])]
            .filter(item => item?.Name && (Number(item.TotalPlaytimeMinutes) || 0) >= 1)
            .sort((a, b) => (b.TotalPlaytimeMinutes || 0) - (a.TotalPlaytimeMinutes || 0));
        const fmtTime = (minutes) => {
            const total = Math.max(0, Number(minutes) || 0);
            const h = Math.floor(total / 60);
            const m = total % 60;
            if (h === 0) return `${m} min`;
            if (m === 0) return `${h} h`;
            return `${h} h ${m} min`;
        };

        body.innerHTML = `
            <div class="nav-profile-history-view">
                <div class="nav-profile-history-head">
                    <button class="nav-back-btn" id="profileHistoryBack" tabindex="-1">‹ ${_t('navBack', 'Voltar')}</button>
                    <div>
                        <h2>${_t('navGameHistoryTitle', 'Minha jornada')}</h2>
                        <p>${_t('navGameHistorySub', 'Todos os jogos registrados neste perfil')}</p>
                    </div>
                </div>
                <div class="nav-profile-history-list" id="profileHistoryList"></div>
            </div>`;

        const back = body.querySelector('#profileHistoryBack');
        const list = body.querySelector('#profileHistoryList');
        _contentItems = [back];

        back?.addEventListener('click', () => {
            _profileSubView = null;
            _contentIdx = 0;
            _renderContent('profile');
            _setTopbarFocus(false);
        });

        if (history.length === 0) {
            list.innerHTML = `<div class="nav-profile-history-empty">${_t('navGameHistoryEmpty', 'Nenhum jogo foi jogado ainda')}</div>`;
        } else {
            history.forEach(item => {
                const localImage = item.HistoryHorizontalLocalImage || item.GridHorizontalStaticImage || item.GridHorizontalImage || item.ShowcaseVerticalLocalImage || item.GridStaticImage || item.GridImage || '';
                const remoteImage = item.HistoryHorizontalImageUrl || item.ShowcaseVerticalImageUrl || '';
                const image = localImage || remoteImage;
                const icon = item.IconBase64 ? `data:image/png;base64,${item.IconBase64}` : '';
                const row = document.createElement('button');
                row.type = 'button';
                row.tabIndex = -1;
                row.className = 'nav-profile-history-row';
                row.dataset.historyGameName = item.Name;
                row.innerHTML = `
                    <span class="nav-profile-history-art">
                        ${image ? `<img src="${_esc(image)}" alt="" />` : icon ? `<img class="is-icon" src="${_esc(icon)}" alt="" />` : ''}
                    </span>
                    <span class="nav-profile-history-name">${_esc(item.Name)}</span>
                    <span class="nav-profile-history-time">${fmtTime(item.TotalPlaytimeMinutes)}</span>`;
                list.appendChild(row);
                const artworkImage = row.querySelector('.nav-profile-history-art img:not(.is-icon)');
                if (artworkImage && remoteImage && remoteImage !== image) {
                    artworkImage.addEventListener('error', () => {
                        if (artworkImage.src === remoteImage) return;
                        artworkImage.src = remoteImage;
                    }, { once: true });
                }
                _contentItems.push(row);
                row.addEventListener('contextmenu', event => {
                    event.preventDefault();
                    _openHistoryContextMenu(row);
                });
            });
        }

        _contentItems.forEach((element, index) => element?.addEventListener('mouseenter', () => {
            _topbarFocus = false;
            _contentIdx = index;
            _updateContentFocus();
        }));
    }

