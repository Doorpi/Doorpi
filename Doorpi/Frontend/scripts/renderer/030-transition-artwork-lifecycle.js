window.pauseDoorpiArtworkForTransition = function (element) {
    const card = element?.closest?.('.card:not(.add-card):not(.loading-card)');
    if (!card) return;

    CardInteraction.stop(card);

    const heroStatic = card.dataset.staticHero
        || card.dataset.staticHorizontal
        || card.dataset.staticVertical
        || '';
    const heroImg = document.getElementById('heroImage');
    if (heroStatic && heroImg && !(heroImg.src || '').endsWith(heroStatic)) {
        heroImg.src = heroStatic;
    }

    const gridBg = document.getElementById('gridBgImg');
    if (heroStatic && gridBg && !(gridBg.src || '').endsWith(heroStatic)) {
        gridBg.src = heroStatic;
    }

    // stop() restores the static presentation through its single artwork owner.
};

window.resumeDoorpiArtworkAfterTransition = function (element) {
    const card = element?.closest?.('.card:not(.add-card):not(.loading-card)')
        || document.activeElement?.closest?.('.card:not(.add-card):not(.loading-card)');
    if (!card) return;

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            if (!document.contains(card)) return;
            CardInteraction.start(card);
        });
    });
};


