    let _profileCardReturn = null;
    function _profileMediaPicture(id,highlight) {
        const app = String(highlight.appId || '').toLowerCase();
        const native = ['youtube','twitch','kick','netflix','primevideo','crunchyroll','max','appletv','disneyplus'].includes(app)
            ? 'https://app.local/native-assets/'+app+'/grid-horizontal.'+(['youtube','kick'].includes(app)?'jpg':'png') : '';
        const sources = [...new Set([...(highlight.artChain || []),highlight.art,highlight.hubBackdrop,native].filter(Boolean))];
        const glyph = id==='film-series' ? '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 4l3 5m3-5 3 5"/>'
            : id==='music' ? '<path d="M9 18V6l10-2v12M9 8l10-2"/><ellipse cx="6" cy="18" rx="3" ry="2"/><ellipse cx="16" cy="16" rx="3" ry="2"/>'
            : '<rect x="2" y="5" width="20" height="14" rx="3"/><path d="m10 9 5 3-5 3z"/>';
        return `<span class="profile-media-picture"><svg viewBox="0 0 24 24" aria-hidden="true">${glyph}</svg>
            ${sources.length?'<img alt="" loading="lazy" decoding="async" data-media-sources="'+_esc(JSON.stringify(sources))+'">':''}</span>`;
    }
    function _returnToProfileCard() {
        if (!_profileCardReturn || _profileSubView !== _profileCardReturn.tab) return false;
        const {id} = _profileCardReturn;
        _profileCardReturn = null;
        _profileSubView = null;
        _renderContent('profile');
        _contentIdx = Math.max(0,_contentItems.findIndex(item=>item.dataset.profileCard===id));
        _setTopbarFocus(false);
        return true;
    }
    function _renderProfileCards(body, tabs, library, fmtSeconds, today, media, trackingEnabled, adaptive) {
        const labels = new Map(tabs);
        const image = src => src ? '<img loading="lazy" decoding="async" alt="" src="'+_esc(src)+'">' : '';
        const card = (id,title,content) => `<button type="button" tabindex="-1" class="nav-profile-card" data-profile-card="${id}">
            <span class="profile-card-body">${content}</span><strong class="profile-card-label">${_esc(title)}</strong></button>`;
        const highlights = media.filter(([,highlight])=>highlight);
        const mediaCards = (adaptive || highlights.length ? highlights : [media[0]]).map(([id,highlight])=>{
            const content = highlight
                ? (adaptive?_profileMediaPicture(id,highlight):image(highlight.art)) + '<strong>'+_esc(highlight.title)+'</strong><small>'+_esc(highlight.meta)+'</small>'
                : '<small>'+_esc(_t(trackingEnabled?'navNoCategoryActivity':'navHistoryPausedHint'))+'</small>';
            return card(id,labels.get(id),content);
        }).join('');
        const activity = adaptive ? '' : today.slice(0,3).map(row=>`<li>${image(row.artChain?.[0])}<span>${_esc(row.title)}</span><small>${_esc(fmtSeconds(row.seconds))}</small></li>`).join('');
        body.innerHTML = `<div class="nav-unified-profile${adaptive?' profile-standard':''}">
            <header class="nav-unified-identity">${_profileIdentityMarkup()}
                <button class="nav-unified-edit" id="btnEditProfileHub" tabindex="-1">${_esc(_t('navEditProfileBtn'))}</button></header>
            <nav class="nav-unified-tabs" aria-label="${_esc(_t('navProfileSections'))}">
                ${tabs.map(([id,label])=>`<button type="button" tabindex="-1" data-profile-tab="${id}" class="nav-unified-tab${id==='overview'?' is-active':''}">${_esc(label)}</button>`).join('')}</nav>
            <div class="profile-card-scroll"><div class="profile-card-grid">
                ${card('trophies',_t('steam.achievements'),'')}${card('gaming',_t('navMostPlayedGames'),'')}${mediaCards}
            </div>${adaptive ? `<p class="profile-card-empty" hidden>${_esc(_t('navProfileSummaryEmpty'))}</p>` : `<section class="profile-card-activity"><h3>${_esc(_t('navTodayActivity'))}</h3>
            ${activity?'<ul>'+activity+'</ul>':'<small>'+_esc(_t(trackingEnabled?'navNoActivityToday':'navHistoryPausedHint'))+'</small>'}</section>`}</div></div>`;
        const buttons = [...body.querySelectorAll('[data-profile-tab]')];
        const cards = [...body.querySelectorAll('[data-profile-card]')];
        const edit = body.querySelector('#btnEditProfileHub');
        _contentItems = [...buttons,...cards,edit];
        _contentItems.forEach(item=>item.onmouseenter=()=>{
            const index = _contentItems.indexOf(item);
            if (index < 0) return;
            _contentIdx = index;
            _setTopbarFocus(false);
        });
        buttons.forEach((button,index)=>button.onclick=()=>{
            if (button.dataset.profileTab==='overview') return;
            _profileSubView = button.dataset.profileTab;
            _renderProfileWithTransition('forward',index);
        });
        cards.forEach(button=>button.onclick=()=>{
            const id = button.dataset.profileCard==='trophies' ? 'gaming' : button.dataset.profileCard;
            _profileCardReturn = {id:button.dataset.profileCard,tab:id};
            buttons.find(tab=>tab.dataset.profileTab===id)?.click();
        });
        edit.onclick = _openProfileEditor;
        body.querySelector('.profile-card-scroll').addEventListener('error',event=>{
            if (event.target.tagName==='IMG' && !event.target.hasAttribute('data-media-sources')) event.target.hidden=true;
        },true);
        body.querySelectorAll('img[data-media-sources]').forEach(img=>{
            const sources = JSON.parse(img.dataset.mediaSources);
            const advance = () => {
                if (sources.length) img.src=sources.shift();
                else img.hidden=true;
            };
            img.addEventListener('error',advance);
            advance();
        });
        _bindProfileFavorites(body,library,fmtSeconds,(ranked,state)=>{
            const previous = _contentItems[_contentIdx];
            const hadFocus = previous === document.activeElement;
            const top = ranked.filter(game=>game.minutes>0).slice(0,3);
            const libraryPreview = adaptive && !top.length
                ? (_menuData.games || []).filter(item=>item?.Name).slice(0,3).map(item=>({
                    name:item.Name,art:item.GridHorizontalStaticImage || item.GridHorizontalImage || item.GridStaticImage || item.GridImage
                })) : [];
            const games = top.length ? top : libraryPreview;
            cards[1].lastElementChild.textContent = _t(libraryPreview.length?'navProfileLibrarySize':'navMostPlayedGames');
            cards[1].firstElementChild.innerHTML = games.map(game=>`<span class="profile-card-game">${image(_profileGameArt(game))}<span>${adaptive?'<strong>'+_esc(game.name)+'</strong>':_esc(game.name)}${game.minutes ? '<small>'+fmtSeconds(game.minutes*60)+'</small>' : ''}</span></span>`).join('')
                || '<small>'+_esc(_t('navGameHistoryEmpty'))+'</small>';
            const known = Number.isSafeInteger(state.achievementCount);
            if (!adaptive) {
                cards[0].firstElementChild.innerHTML = '<span class="profile-card-cup">'+_trophySvg('gold')+'</span>'
                + (known?'<b>'+state.achievementCount.toLocaleString()+'</b>'+_steamSummaryMarkup()
                    : '<small>'+_esc(_t('steam.noTrophies'))+'</small>');
                return;
            }
            if (known && state.achievementCount>0) {
                cards[0].firstElementChild.innerHTML = _steamSummaryMarkup(state.completedGames>0);
                cards[0].lastElementChild.textContent = _t('navProfileAchievementTotal','',state.achievementCount);
            }
            cards[0].hidden = !(known && state.achievementCount>0);
            cards[1].hidden = !games.length;
            const visible = cards.filter(button=>!button.hidden);
            body.querySelector('.profile-card-empty').hidden = visible.length>0;
            _contentItems = [...buttons,...visible,edit];
            _contentIdx = Math.max(0,_contentItems.indexOf(previous));
            if (hadFocus && previous.hidden) _updateContentFocus();
        });
    }
