    // ── Build overlay DOM ─────────────────────────────────────────────────────
    function _buildOverlay() {
        if (_overlay) return;

        _overlay = document.createElement('div');
        _overlay.id = 'navMenuOverlay';

        _overlay.innerHTML = `
            <canvas id="navMenuBg"></canvas>
            <div class="nav-layout">
                <div class="nav-topbar" id="navTopbar">
                    <div class="nav-cat-list" id="navCatList"></div>
                </div>
                <div class="nav-content" id="navContent">
                    <div class="nav-content-header" id="navHeaderWrap">
                        <h2 class="nav-content-title" id="navContentTitle"></h2>
                        <p class="nav-content-subtitle" id="navContentSub"></p>
                    </div>
                    <div class="nav-content-body" id="navContentBody"></div>
                </div>
            </div>`;

        document.body.appendChild(_overlay);

        _buildCatList();
    }

    function _buildCatList() {
        const list = document.getElementById('navCatList');
        if (!list) return;

        list.innerHTML = CATS.map((cat, i) => `
            <button class="nav-cat-item" data-idx="${i}" tabindex="-1">
                <span class="nav-cat-label">${cat.label}</span>
            </button>`).join('');

        list.querySelectorAll('.nav-cat-item').forEach(btn => {
            btn.addEventListener('click', () => {
                _catIdx = parseInt(btn.dataset.idx);
                _selectCat(_catIdx);
                _setTopbarFocus(true);
            });
        });
    }

    // ── Seleção de categoria ──────────────────────────────────────────────────
    function _selectCat(idx) {
        if (_navMenuPhase === 'closing') return;
        if (CATS[_catIdx]?.id === 'settings' && _settingsSubView === 'sound' && Number(idx) !== _catIdx) {
            window.DoorpiSoundUI?.closeDrawer?.('settings');
        }
        _catIdx = Number(idx);

        if (_preserveSettingsSubViewOnce) {
            _preserveSettingsSubViewOnce = false;
        } else {
            _settingsSubView = null;
            _profileSubView = null;
            _systemSubView = null;
            _settingsReturnToRoot = false;
        }

        document.querySelectorAll('.nav-cat-item').forEach((el, i) => {
            el.classList.toggle('active', i === _catIdx);
        });
        _updateTopbarFocusVisual();

        const cat = CATS[_catIdx];
        if (!cat) return;

        const titleEl = document.getElementById('navContentTitle');
        const subEl = document.getElementById('navContentSub');
        const headerWrap = document.getElementById('navHeaderWrap');

        const isProfile = cat.id === 'profile';

        if (headerWrap) headerWrap.style.display = isProfile ? 'none' : 'block';

        const header = document.querySelector('.nav-content-header');
        if (header) {
            header.style.animation = 'none';
            setTimeout(() => { if (header) header.style.animation = ''; }, 10);
        }

        if (titleEl) titleEl.textContent = cat.label;
        if (subEl) subEl.textContent = _subtitle(cat.id);

        _contentIdx = 0;
        _renderContent(cat.id);
    }

    function _subtitle(id) {
        const map = {
            games: _t('navGamesSub', 'Toda a sua biblioteca de jogos e títulos instalados'),
            media: _t('navMediaSub', 'Aplicativos e serviços de entretenimento'),
            settings: _t('navSettingsSub', 'Ajustes do sistema e preferências do console'),
            profile: _t('navProfileSub', 'Gerenciamento da sua conta e dados pessoais'),
        };
        return map[id] || '';
    }

    // ── Renderização Genérica de Grid (Jogos/Multimidia) com Lazy Loading ──
    function _renderGrid(body, items, catId, emptyText, emptyIcon) {
        _destroyLazyGrid();

        if (!items.length) {
            body.innerHTML = `<div class="nav-placeholder">
                <div class="nav-placeholder-icon">${emptyIcon}</div>
                <div class="nav-placeholder-text">${emptyText}</div>
            </div>`;
            _contentItems = [];
            return;
        }

        body.innerHTML = '';
        const scrollRoot = document.getElementById('navContentBody');

        _lazyGrid = new _NavLazyGrid({
            body,
            scrollRoot,
            items,
            catId,
            emptyIcon,
            onLaunchAction: (globalIdx) => _launchAction(catId, globalIdx),
            onFocusUpdate: (cards, globalIdx) => {
                _contentItems = cards;
                if (globalIdx >= 0) {
                    _topbarFocus = false;
                    _contentIdx  = globalIdx;
                    _updateContentFocus();
                }
            }
        });
    }

    // ── Launch ────────────────────────────────────────────────────────────────

    function _launchAction(catId, idx, itemList = null) {
        const items = itemList || (catId === 'games' ? _menuData.games : _menuData.media);
        const item = items[idx];
        if (!item) return;
        if (catId === 'games' && _isAdminLockedGame(item)) {
            window.showDoorpiToast?.(
                _t('adminBlockedTitle', 'Bloqueado pelo administrador'),
                _t('adminBlockedSubtitle', 'Esta loja foi privada para esta conta.')
            );
            return;
        }

        if (typeof postToHost === 'function') {
            if (catId === 'games') {
                const targetPath = item.LaunchUrl || item.Path || '';
                const completeLaunch = (discPath = '') => {
                    window.trackGameOpened?.(targetPath);
                    window.suspendDoorpiGameInput?.();
                    postToHost({
                        action: 'launch',
                        path: targetPath,
                        discPath,
                        errorMsg: _t('msgErrorLaunch', 'Erro ao abrir')
                    });

                    const tabBtn = document.querySelector('.home-tab[data-tab="games"]')
                        ?? document.querySelector('.home-tab:not(.active)');
                    tabBtn?.click();
                    close();
                };
                const emulatorDiscPaths = Array.isArray(item.EmulatorDiscPaths)
                    ? item.EmulatorDiscPaths.filter(Boolean)
                    : (Array.isArray(item.emulatorDiscPaths)
                        ? item.emulatorDiscPaths.filter(Boolean)
                        : []);
                const selectorItem = {
                    ...item,
                    name: item.Name || item.name || 'Jogo',
                    emulatorDiscPaths,
                    staticVertical: item.GridStaticImage || item.staticVertical || '',
                    vertical: item.GridImage || item.vertical || ''
                };
                if (emulatorDiscPaths.length > 1 &&
                    window.openEmulatorDiscSelector?.(selectorItem, completeLaunch)) {
                    return;
                }
                completeLaunch();
                return;
            } else if (catId === 'media') {
                const targetUrl = item.Url || '';
                const appType = item.Type || 'browser';
                postToHost({ action: 'launchMediaApp', url: targetUrl, appType: appType });
            }
        }

        // Troca a aba enquanto o nav menu ainda cobre a tela — sem ninguém ver
        const targetTab = catId === 'media' ? 'media' : 'games';
        const tabBtn = document.querySelector(`.home-tab[data-tab="${targetTab}"]`)
            ?? document.querySelector(`.home-tab:not(.active)`);
        tabBtn?.click();

        close();
    }

