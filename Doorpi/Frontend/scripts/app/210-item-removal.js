    // ══════════════════════════════════════════════════════════════════════════
    // Deleção
    // ══════════════════════════════════════════════════════════════════════════
    function _executeDelete(card) {
        const id1 = card.dataset.gameId;
        const id2 = card.dataset.appId;
        const id3 = card.dataset.appUrl;

        const searchKeys = [id1, id2, id3].filter(Boolean);
        if (searchKeys.length === 0) return;

        if (searchKeys.some(k => String(k).toLowerCase() === 'youtube')) return;

        const isMedia = card.hasAttribute('data-app-id') || card.closest('#mediaGrid') !== null;

        const allCards = Array.from(document.querySelectorAll('.card, .nav-vertical-card')).filter(c => {
            const cId1 = c.dataset.gameId;
            const cId2 = c.dataset.appId;
            const cId3 = c.dataset.appUrl;
            return searchKeys.some(k => k === cId1 || k === cId2 || k === cId3);
        });

        allCards.forEach(c => {
            if (c.classList.contains('featured')) {
                const grid = c.closest('#gameGrid') || c.closest('#mediaGrid');
                const next = Array.from(grid.querySelectorAll('.card:not(.add-card)')).find(sib => sib !== c);
                if (next) {
                    next.classList.add('featured');
                    const img = next.querySelector('img');
                    if (img) img.src = next.dataset.staticVertical || next.dataset.vertical || next.dataset.staticHorizontal || '';
                    window.syncFeaturedCardArt?.(grid);
                    next._startInteraction?.();
                } else {
                    if (typeof clearHero === 'function') clearHero();
                }
            }

            c.classList.add('removing');
            setTimeout(() => c.remove(), 280);
        });

        const _navCatId = isMedia ? 'media' : 'games';
        [id1, id2, id3].filter(Boolean).forEach(key => {
            window._navMenuRemoveItem?.(_navCatId, key);
        });

        postToHost({
            action: 'deleteGame',
            gameId: id1 || id2,
            isMedia: isMedia
        });
    }

