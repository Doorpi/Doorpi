// Semantic focus regions belong to the application; themes only position them.
window.DoorpiNavigation = (() => {
    const home = Object.freeze({
        id: 'home', entryRegion: 0,
        regions: Object.freeze([
            Object.freeze({ id: 0, key: 'carousel', layoutRegion: 'library' }),
            Object.freeze({ id: 1, key: 'tabs', layoutRegion: 'toolbar' }),
            Object.freeze({ id: 2, key: 'system', layoutRegion: 'header' })
        ])
    });
    const remembered = new Map();
    function activeHome() {
        const channel = window.getCurrentHomeTab?.() || 'games';
        const gridId = window.getHomeGridId?.(channel) || (channel === 'media' ? 'mediaGrid' : channel === 'stores' ? 'storesGrid' : 'gameGrid');
        return { grid: document.getElementById(gridId), scope: String(window._doorpiCurrentUserId || '') + '\0' + channel };
    }
    function cardKey(card) {
        return String(card?.dataset?.id || card?.dataset?.gameId || card?.dataset?.appId || card?.dataset?.appUrl || card?.id || '');
    }
    function available(card) {
        return !!card && card.offsetWidth > 0 && card.offsetHeight > 0 && !card.disabled &&
            card.getAttribute('aria-disabled') !== 'true' && !card.classList.contains('loading-card');
    }
    function cardsIn(grid) {
        return grid ? [...grid.querySelectorAll('.card, .store-card')].filter(available) : [];
    }
    function remember(card, scope) {
        // Transitional DOM may still contain cards from the previous profile.
        // Preparing focus/art behind the transition remains allowed.
        if (window._userSwitching === true) return;
        // Add is the empty-state entry target, not a selected game to restore
        // after the first real library arrives. Explicit Add selection in a
        // populated library still participates in normal return navigation.
        if (card?.classList.contains('add-card') &&
            !cardsIn(activeHome().grid).some(item => !item.classList.contains('add-card'))) return;
        const key = cardKey(card);
        if (!key) return;
        remembered.delete(scope);
        remembered.set(scope, key);
        if (remembered.size > 48) remembered.delete(remembered.keys().next().value);
    }
    function blocked() {
        return isModalOpen || isEditModalOpen || isSetupOpen || isCtxMenuOpen ||
            isVkbOpenForNavigation() || window.isNavMenuOpen === true || window.isGlobalLoading === true ||
            window.isDoorpiOverlayOpen?.() === true || document.body.classList.contains('user-picker-open');
    }
    function entryTarget() {
        const { grid, scope } = activeHome();
        const cards = cardsIn(grid);
        return cards.find(card => cardKey(card) === remembered.get(scope)) ||
            cards.find(card => card.classList.contains('featured') && !card.classList.contains('add-card')) ||
            cards.find(card => !card.classList.contains('add-card')) || cards[0];
    }
    function focusRegion(screenId, regionId) {
        if (screenId !== 'home' || blocked()) return false;
        const { grid, scope } = activeHome();
        let target;
        if (regionId === 0) {
            target = entryTarget();
        } else if (regionId === 1) {
            target = [...document.querySelectorAll('.home-tab')].filter(available).find(tab => tab.classList.contains('active')) ||
                [...document.querySelectorAll('.home-tab')].find(available);
        } else if (regionId === 2) {
            target = [document.getElementById('btnTopProfile'), document.getElementById('doorpiNotificationButton')].find(available);
        }
        if (!target) return false;
        target.focus({ preventScroll: true });
        if (document.activeElement !== target) return false;
        if (regionId === 0) {
            remember(target, scope);
            target.scrollIntoView?.({ behavior: 'instant', block: 'nearest', inline: 'nearest' });
            target._startInteraction?.();
        }
        return true;
    }
    function getRegionId(element = document.activeElement) {
        const { grid } = activeHome();
        if (grid?.contains(element)) return 0;
        if (element?.closest?.('#homeTabs')) return 1;
        if (element?.id === 'btnTopProfile' || element?.id === 'doorpiNotificationButton') return 2;
        return null;
    }
    document.addEventListener('focusin', event => {
        const { grid, scope } = activeHome();
        const card = event.target?.closest?.('.card, .store-card');
        if (grid?.contains(card) && available(card)) remember(card, scope);
    });
    return Object.freeze({
        getScreen: id => id === 'home' ? home : null,
        getRegionId,
        focusRegion,
        getEntryTarget: screenId => screenId === 'home' ? entryTarget() : null,
        enter: screenId => screenId === 'home' && focusRegion('home', home.entryRegion)
    });
})();
