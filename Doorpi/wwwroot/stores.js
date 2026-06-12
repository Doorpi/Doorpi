// =============================================================================
// stores.js - Aba Lojas, menu de sessao e bridge
// =============================================================================

(function injectStoreMenuStyles() {
    const s = document.createElement('style');
    s.textContent = `
    #storesGrid { display: none; }
    #storesGrid.active { display: flex; }
    #gameGrid.tab-hidden, #mediaGrid.tab-hidden { display: none !important; }

    #storeSessionMenu.context-menu { min-width: 280px; z-index: 12000; }
    #storeSessionMenu .ctx-game-name { font-size: 1.1rem; margin-bottom: 8px; }
    #storeSessionMenu .ctx-item.on { color: #fff; background: rgba(255,255,255,0.08); }
    `;
    document.head.appendChild(s);
})();

const _storeSessionMenu = (() => {
    const el = document.createElement('div');
    el.id = 'storeSessionMenu';
    el.className = 'context-menu';
    el.style.display = 'none';
    el.innerHTML = `
        <div class="ctx-game-name" id="storeMenuTitle"></div>
        <button class="ctx-item" id="storeMenuResume" type="button">
            <span class="ctx-icon">▶</span>
            <span data-i18n="storeMenuResume">Retomar loja</span>
        </button>
        <button class="ctx-item" id="storeMenuGamepadControl" type="button">
            <span class="ctx-icon" id="storeMenuGamepadIcon">✓</span>
            <span data-i18n="storeDisableGamepadControl">Iniciar com modo mouse habilitado</span>
        </button>
        <p class="store-menu-hint" style="margin:10px 0 0;font-size:0.75rem;color:rgba(255,255,255,0.45);">
            <span data-i18n="storeMenuHintSquare">□</span> <span data-i18n="storeMenuResume">Retomar loja</span>
        </p>`;
    document.body.appendChild(el);

    el.querySelector('#storeMenuResume')?.addEventListener('click', () => {
        hideStoreSessionMenu();
        postToHost?.({ action: 'resumeStore' });
    });
    el.querySelector('#storeMenuGamepadControl')?.addEventListener('click', () => {
        if (!_storeMenuStoreId) return;
        _storeMenuDisableGamepadControl = !_storeMenuDisableGamepadControl;
        const icon = document.getElementById('storeMenuGamepadIcon');
        const toggle = document.getElementById('storeMenuGamepadControl');
        if (toggle) toggle.classList.toggle('on', !_storeMenuDisableGamepadControl);
        if (icon) icon.textContent = !_storeMenuDisableGamepadControl ? '✓' : '';
        postToHost?.({ action: 'setStoreGamepadControl', storeId: _storeMenuStoreId, disabled: _storeMenuDisableGamepadControl });
    });

    return el;
})();

let _storeMenuOpen = false;
let _storeMenuStoreId = '';
let _storeMenuDisableGamepadControl = false;

function showStoreSessionMenu(data) {
    _storeMenuStoreId = data.storeId || '';
    _storeMenuDisableGamepadControl = !!data.disableGamepadControl;

    const title = document.getElementById('storeMenuTitle');
    if (title) title.textContent = data.storeName || data.storeId || 'Loja';

    const toggle = document.getElementById('storeMenuGamepadControl');
    const icon = document.getElementById('storeMenuGamepadIcon');
    if (toggle) toggle.classList.toggle('on', !_storeMenuDisableGamepadControl);
    if (icon) icon.textContent = !_storeMenuDisableGamepadControl ? '✓' : '';
    if (typeof applyI18n === 'function') applyI18n();

    _storeSessionMenu.style.display = 'flex';
    requestAnimationFrame(() => {
        _storeSessionMenu.style.left = '50%';
        _storeSessionMenu.style.top = '50%';
        _storeSessionMenu.style.transform = 'translate(-50%, -50%)';
        _storeSessionMenu.classList.add('visible');
        _storeMenuOpen = true;
        document.getElementById('storeMenuResume')?.focus();
    });
}

function hideStoreSessionMenu() {
    window.isStoreSessionActive = false;
    _storeMenuOpen = false;
    _storeSessionMenu.classList.remove('visible');
    setTimeout(() => { _storeSessionMenu.style.display = 'none'; }, 160);
}

window._storesHandleMessage = (data) => {
    if (data.type === 'storesAppsLoaded' && Array.isArray(data.apps)) {
        window._doorpiIsAdmin = !!data.isAdmin;
        window._adminBlockedStoreIds = new Set(data.blockedStoreIds || []);
        window._steamForceAccountSelection = !!data.steamForceAccountSelection;
        window._supportedStoresCatalog = Array.isArray(data.supportedStores) ? data.supportedStores : [];
        if (typeof window.setSupportedStoresForModal === 'function') {
            window.setSupportedStoresForModal(window._supportedStoresCatalog);
        }
        if (window.AppStore) window.AppStore.mutations.setBatch('stores', data.apps);
    }

    if (data.type === 'storeSessionMenu') {
        window.isStoreSessionActive = true;
        showStoreSessionMenu(data);
    }

    if (data.type === 'hideStoreSessionMenu') {
        hideStoreSessionMenu();
    }

    if (data.type === 'mediaAppClosed' && window.isStoreSessionActive) {
        window.isStoreSessionActive = false;
        hideStoreSessionMenu();
    }

    const games = data.games || (data.type === 'libraryRevalidated' ? data.games : null);
    const hasNew = data.type === 'newGamesDetected' || (data.type === 'libraryRevalidated' && data.hasNewGames);

    if (hasNew && Array.isArray(games) && games.length > 0) {
        const names = games.map(g => g.Name || g.name).filter(Boolean);
        const title = typeof t === 'function' ? t('storeNewGamesTitle') : 'Novos jogos detectados';
        const sub = names.length === 1
            ? names[0]
            : (typeof t === 'function' ? t('storeNewGamesCount', names.length) : `${names.length} jogos novos`);

        if (typeof window.showDoorpiToast === 'function') {
            window.showDoorpiToast(title, sub);
        }

        games.forEach(game => {
            if (!game.autoAdded) return;
            const url = game.LaunchUrl || game.launchUrl || game.Path || game.path;
            if (url) window.newGameIdsThisSession?.add(url);
        });
    }
};

window.showStoreSessionMenu = showStoreSessionMenu;
window.hideStoreSessionMenu = hideStoreSessionMenu;
window.isStoreSessionMenuOpen = () => _storeMenuOpen;
