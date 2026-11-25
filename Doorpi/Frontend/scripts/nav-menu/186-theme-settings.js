    function _renderThemes(body) {
        if (!document.getElementById('doorpiThemeSettingsStyles')) {
            const style = document.createElement('style');
            style.id = 'doorpiThemeSettingsStyles';
            style.textContent = __doorpiCss("injected-styles/nav-menu/theme-settings.css");
            document.head.appendChild(style);
        }
        body.innerHTML = `<section id="themeSettingsRoot" class="theme-settings">
            <header class="theme-settings-header"><div class="nav-settings-subheader"><button class="nav-back-btn" id="themeSettingsBack" tabindex="-1">‹ ${_esc(_t('navBack', 'Voltar'))}</button><h2>Temas</h2></div><div class="theme-settings-actions"><button id="themeImportPackage" class="nav-back-btn" tabindex="-1">Adicionar pacote</button><button id="themeRestoreDefault" class="nav-back-btn theme-restore" tabindex="-1">Restaurar padrão</button></div></header>
            <div class="theme-settings-areas theme-settings-groups" role="group" aria-label="Escopo do tema">
                <button id="theme-group-system" data-theme-group="system" class="theme-area" tabindex="-1">Temas do sistema</button>
                <button id="theme-area-login" data-theme-area="login" class="theme-area" tabindex="-1">Tela de Perfis</button>
            </div>
            <div class="theme-settings-areas theme-settings-modules" role="group" aria-label="Módulos do sistema">${[['system','Temas'],['home','Home'],['nav-menu','Menu principal'],['profile',_t('navProfile')],['side-panels','Menus laterais'],['popups','Popups']].map(([id,label])=>`<button id="theme-area-${id}" data-theme-area="${id}" class="theme-area" tabindex="-1">${label}</button>`).join('')}</div>
            <p class="theme-settings-description" id="themeSettingsOwner"></p>
            <div class="theme-settings-status-row"><p id="themeSettingsStatus" class="theme-settings-status" role="status" aria-live="polite"></p><button id="themeSettingsRetry" class="nav-back-btn" tabindex="-1" hidden>Tentar novamente</button></div>
            <div id="themeSettingsList" class="theme-settings-list" role="group" aria-label="Temas instalados"></div>
        </section>`;
        body.querySelector('#themeSettingsBack').addEventListener('click', () => {
            _leaveThemeSettings();
        });
        body.querySelector('#themeRestoreDefault').addEventListener('click', () => { void window.DoorpiThemeSelection?.resetAll(); });
        body.querySelector('#themeImportPackage').addEventListener('click', () => { if(!window.DoorpiThemeSelection?.getState().busy) void window.DoorpiThemeSelection?.importPackage(); });
        body.querySelector('#themeSettingsRetry').addEventListener('click',()=>{void window.DoorpiThemeSelection?.refresh();});
        body.querySelectorAll('[data-theme-area]').forEach(button=>button.addEventListener('click',()=>window.DoorpiThemeSelection?.selectPart(button.dataset.themeArea)));
        body.querySelector('[data-theme-group]').addEventListener('click',()=>window.DoorpiThemeSelection?.selectPart('system'));
        window.DoorpiThemeSelection?.selectPart('system');
        if (window.DoorpiThemeSelection?.getState().profileId !== String(window._doorpiCurrentUserId || ''))
            void window.DoorpiThemeSelection?.refresh();
        _refreshThemeSettings();
        const selected = _contentItems.findIndex(button => button.dataset.themeId === window.DoorpiThemeSelection?.getState().activeId);
        if (selected >= 0) { _contentIdx = selected; _updateContentFocus(); }
    }

    function _leaveThemeSettings() {
        _settingsSubView = null; _contentIdx = 0; _renderContent('settings');
        const index = _contentItems.findIndex(button => button.id === 'setThemes');
        if (index >= 0) _contentIdx = index;
        _setTopbarFocus(false); _updateContentFocus();
    }

    function _refreshThemeSettings() {
        if (!window.isNavMenuOpen || _settingsSubView !== 'themes' || CATS[_catIdx]?.id !== 'settings') return;
        const root = document.getElementById('themeSettingsRoot');
        if (!root) return;
        const state = window.DoorpiThemeSelection?.getState() || { themes: [], activeId: 'default', busy: false, error: 'Não foi possível carregar a seleção de temas.' };
        const list = root.querySelector('#themeSettingsList');
        const part=state.part||'home';
        const themes=state.themes.filter(theme=>theme.id==='default'||(part==='system'
            ? ['home','nav-menu','side-panels','popups'].every(area=>(theme.parts||[]).includes(area))
            : (theme.parts||['home','side-panels']).includes(part)));
        const key = part+'|'+themes.map(theme => theme.id).join('|');
        root.querySelectorAll('[data-theme-area]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.themeArea===part)));
        root.querySelector('[data-theme-group]').setAttribute('aria-pressed',String(part!=='login'));
        root.querySelector('.theme-settings-modules').hidden=part==='login';
        root.querySelector('#themeSettingsOwner').textContent=part==='login'?'Tela de perfis: escolha geral deste dispositivo.':part==='system'
            ? 'Aplica Home, menu principal, menus laterais e popups neste perfil. Você pode personalizar cada módulo depois.'+(state.activeId?'':' Combinação personalizada em uso.')
            : 'Escolha salva neste perfil, apenas para este módulo.';
        const activeId = document.activeElement?.id;
        if (list.dataset.catalog !== key) {
            list.replaceChildren(); list.dataset.catalog = key;
            for (const theme of themes) {
                const button = document.createElement('button');
                button.id = `theme-choice-${theme.id}`;
                button.className = 'theme-choice'; button.tabIndex = -1;
                button.dataset.themeId = theme.id;
                const title = document.createElement('span'); title.className = 'theme-choice-name'; title.textContent = theme.name;
                const selected = document.createElement('span'); selected.className = 'theme-choice-state';
                button.append(title, selected); list.appendChild(button);
                button.addEventListener('click', () => {
                    if (theme.id === 'default' || !window.DoorpiThemeSelection.getState().busy)
                        void window.DoorpiThemeSelection.select(theme.id);
                });
            }
        }
        for (const button of list.querySelectorAll('.theme-choice')) {
            const selected = button.dataset.themeId === state.activeId;
            button.classList.toggle('is-selected', selected);
            button.setAttribute('aria-pressed', String(selected));
            button.setAttribute('aria-busy', String(state.busy && selected));
            button.querySelector('.theme-choice-state').textContent = state.busy && selected ? 'Aplicando…' : selected ? 'Em uso' : '';
        }
        const status = root.querySelector('#themeSettingsStatus');
        status.classList.toggle('is-error', !!state.error);
        status.textContent = state.error || (state.busy ? 'Aplicando e salvando o tema…' : '');
        root.querySelector('#themeSettingsRetry').hidden=!state.error||state.busy;
        _contentItems = [...root.querySelectorAll('button')].filter(item => item && !item.disabled && !item.closest('[hidden]'));
        const remembered = _contentItems.findIndex(item => item.id === activeId);
        _contentIdx = remembered >= 0 ? remembered : Math.max(0, Math.min(_contentIdx, _contentItems.length - 1));
        _contentItems.forEach((button, index) => {
            button.onmouseenter = () => { _topbarFocus = false; _contentIdx = index; _updateContentFocus(); };
        });
        if (!_topbarFocus && !window.isDoorpiFileBrowserOpen?.()) _updateContentFocus();
    }
    window.addEventListener('doorpi:theme-selection-state', _refreshThemeSettings);

    function _navLineTarget(items, current, direction) {
        const origin = current.getBoundingClientRect();
        const x = origin.left + origin.width / 2, y = origin.top + origin.height / 2;
        const sign = direction === 'UP' ? -1 : 1;
        const candidates = items.filter(item => item && item !== current && !item.hidden && !item.disabled)
            .map(item => ({ item, rect: item.getBoundingClientRect() }))
            .filter(({ rect }) => rect.width > 0 && rect.height > 0 && (rect.top + rect.height / 2 - y) * sign > 4);
        if (!candidates.length) return null;
        const distance = Math.min(...candidates.map(({ rect }) => Math.abs(rect.top + rect.height / 2 - y)));
        return candidates.filter(({ rect }) => Math.abs(Math.abs(rect.top + rect.height / 2 - y) - distance) < 8)
            .sort((a, b) => Math.abs(a.rect.left + a.rect.width / 2 - x) - Math.abs(b.rect.left + b.rect.width / 2 - x))[0]?.item || null;
    }

    function _navigateThemeSettings(key) {
        if(key==='Escape'||key==='Backspace'){_leaveThemeSettings();return true;}
        const current=_contentItems[_contentIdx];if(!current)return true;
        const rows=_contentItems.filter(item=>item.classList.contains('theme-choice'));
        const headers=_contentItems.filter(item=>item.closest('.theme-settings-header'));
        const areas=_contentItems.filter(item=>item.dataset.themeArea||item.dataset.themeGroup);
        const retry=_contentItems.find(item=>item.id==='themeSettingsRetry');
        const selected=rows.find(item=>item.dataset.themeId===window.DoorpiThemeSelection?.getState().activeId)||rows[0];
        const index=rows.indexOf(current),direction={ArrowUp:'UP',ArrowDown:'DOWN',ArrowLeft:'LEFT',ArrowRight:'RIGHT'}[key];
        let target=null;
        if(index>=0){
            if(key==='ArrowUp')target=index>0?rows[index-1]:retry||document.getElementById('theme-area-'+(window.DoorpiThemeSelection?.getState().part||'home'));
            if(key==='ArrowDown')target=rows[Math.min(rows.length-1,index+1)];
        }else if(headers.includes(current)){
            if(key==='ArrowUp'){
                target=_navLineTarget(headers,current,'UP');
                if(!target){_setTopbarFocus(true);return true;}
            }else if(key==='ArrowDown')target=_navLineTarget(headers,current,'DOWN')||_navLineTarget(areas,current,'DOWN')||selected;
            else target=findSpatialCandidate(headers,current,direction);
        }else if(areas.includes(current)){
            if(key==='ArrowUp')target=_navLineTarget(areas,current,'UP')||_navLineTarget(headers,current,'UP');
            else if(key==='ArrowDown')target=_navLineTarget(areas,current,'DOWN')||retry||selected;
            else target=findSpatialCandidate(areas,current,direction);
        }else if(current===retry){
            if(key==='ArrowUp')target=_navLineTarget(areas,current,'UP');
            else if(key==='ArrowDown')target=selected;
        }
        if(target){_contentIdx=_contentItems.indexOf(target);_updateContentFocus();}
        return true;
    }

