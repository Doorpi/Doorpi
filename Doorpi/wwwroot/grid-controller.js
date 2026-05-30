// =============================================================================
// grid-controller.js — Orquestra Store → Renderer → DOM
// =============================================================================

window.GridController = (() => {
    let _grids = {};

    function init() {
        _grids = {
            games: {
                el: document.getElementById('gameGrid'),
                anchor: document.getElementById('btnAdd'),
            },
            media: {
                el: document.getElementById('mediaGrid'),
                anchor: document.getElementById('btnAddMedia'),
            },
            stores: {
                el: document.getElementById('storesGrid'),
                anchor: null,
            },
        };

        window.AppStore.subscribe('games', e => _onMutation('games', e));
        window.AppStore.subscribe('media', e => _onMutation('media', e));
        window.AppStore.subscribe('stores', e => _onMutation('stores', e));
        window.AppStore.subscribe('featured', _onFeaturedChange);

        window.focusFeaturedCard = _focusFeatured;
        _patchExecuteDelete();

        ['games', 'media', 'stores'].forEach(channel => {
            const initialItems = window.AppStore.queries.getItems(channel);
            if (initialItems.length > 0) {
                _onMutation(channel, { type: 'reset', items: initialItems });
            }
        });
    }

    function _onMutation(channel, mutation) {
        requestAnimationFrame(() => {
            const { el, anchor } = _grids[channel];
            if (!el) return;

            switch (mutation.type) {
                case 'reset':
                    CardRenderer.syncDOM(channel, mutation.items, el, anchor);
                    break;

                case 'prepend':
                    CardRenderer.prependCard(mutation.item, el, anchor);

                    break;
                case 'remove':
                    CardRenderer.removeCard(mutation.id, el);
                    break;
                case 'reorder':
                    // Usa DOM reordering para evitar bugs de CSS
                    CardRenderer.reorderDOM(mutation.items, el, anchor);
                    break;
                case 'update':
                    CardRenderer.applyPatch(mutation.id, mutation.patch, el);
                    break;
            }
        });
    }

    function _onFeaturedChange({ channel, id }) {
        if (!id) {
            if (typeof clearHero === 'function') clearHero();
            return;
        }

        const { el } = _grids[channel];
        if (!el) return;

        requestAnimationFrame(() => {
            const cards = el.querySelectorAll('.card:not(.add-card):not(.loading-card)');
            let featuredCard = null;

            cards.forEach(card => {
                const isFeatured = card.dataset.id === id;

                if (card.classList.contains('featured') === isFeatured) {
                    if (isFeatured) featuredCard = card;
                    return;
                }

                card.classList.toggle('featured', isFeatured);

                const img = card.querySelector('img');
                if (img) {
                    const src = isFeatured
                        ? (card.dataset.staticHorizontal || card.dataset.horizontal || card.dataset.staticVertical || card.dataset.vertical)
                        : (card.dataset.staticVertical || card.dataset.vertical);
                    if (src) img.src = src;
                }

                if (isFeatured) featuredCard = card;
            });

            if (featuredCard) {
                const item = window.AppStore.queries.getItem(channel, id);
                if (item) {
                    const bgSrc = item.staticVertical || item.vertical;
                    const logoSrc = item.staticLogo || item.logo;
                    const heroSrc = item.staticHero || item.hero || item.staticHorizontal || item.horizontal || bgSrc;

                    if (typeof switchHeroBackground === 'function') {
                        switchHeroBackground(bgSrc, logoSrc, heroSrc);
                    }
                }
            }
        });
    }

    function _focusFeatured() {
        const channel = (typeof window.getCurrentHomeTab === 'function') ? window.getCurrentHomeTab() : 'games';
        const gridId = channel === 'media' ? 'mediaGrid' : 'gameGrid';
        const grid = document.getElementById(gridId);
        if (!grid) return;

        const featured = grid.querySelector('.card.featured:not(.add-card)') || grid.querySelector('.card:not(.add-card)');
        featured?.focus();
    }

    function _patchExecuteDelete() {
        const original = window._executeDelete;
        if (!original) return;

        window._executeDelete = function (card) {
            const id = card.dataset.id || card.dataset.gameId || card.dataset.appId || card.dataset.appUrl;
            const channel = card.dataset.channel || (card.dataset.appId || card.dataset.appUrl ? 'media' : 'games');

            original(card);
            setTimeout(() => window.AppStore.mutations.removeItem(channel, id), 300);
        };
    }

    // Domínio total dos skeletons (Substitui funções de app.js)
    // Domínio total dos skeletons (Substitui funções de app.js)
    window.showLoadingCards = function (count, tab = 'games') {
        const gridId = tab === 'games' ? 'gameGrid' : 'mediaGrid';
        const grid = document.getElementById(gridId);

        if (!grid) return;

        // Se já tiver skeleton, não adiciona mais para não espalhar o erro.
        // Descobre onde inserir (Logo APÓS o hero, que é a posição [1] se existir)
        const firstCard = grid.querySelector('.card:not(.add-card)');
        let insertAnchor = firstCard ? firstCard.nextSibling : grid.firstElementChild;

        for (let i = 0; i < count; i++) {
            const card = document.createElement('div');
            card.className = 'card loading-card';

            const imgDummy = document.createElement('img');
            imgDummy.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 900'%3E%3C/svg%3E";
            imgDummy.style.opacity = '0';
            card.appendChild(imgDummy);

            const titleDummy = document.createElement('div');
            titleDummy.className = 'title';
            titleDummy.style.opacity = '0';
            titleDummy.textContent = '...';
            card.appendChild(titleDummy);

            grid.insertBefore(card, insertAnchor);
        }
    };

    window.clearLoadingCards = function (tab = 'games') {
        const gridId = tab === 'games' ? 'gameGrid' : 'mediaGrid';
        const grid = document.getElementById(gridId);
        if (!grid) return;
        grid.querySelectorAll('.loading-card').forEach(c => c.remove());
    };

    return { init };
})();

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (window.GridController) window.GridController.init();
    });
} else {
    if (window.GridController) window.GridController.init();
}
