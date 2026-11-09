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

    const logoStatic = card.dataset.staticLogo || '';
    const logoEl = document.getElementById('gameLogo');
    if (logoStatic && logoEl && !(logoEl.src || '').endsWith(logoStatic)) {
        logoEl.src = logoStatic;
    }
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


