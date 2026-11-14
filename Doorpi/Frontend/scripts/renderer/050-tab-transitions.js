    return { renderBatch, prependCard, removeCard, reorderDOM, applyPatch, syncDOM };
})();
// Short directional feedback; changing tabs never waits for its animation.
(function injectScrollTabTransitions() {
    if (document.getElementById('doorpiTabTransitions')) {
        document.getElementById('doorpiTabTransitions').remove();
    }

    const style = document.createElement('style');
    style.id = 'doorpiTabTransitions';
    style.textContent = __doorpiCss("injected-styles/renderer/doorpi-tab-transitions.css");
    document.head.appendChild(style);
})();

// ── Reseta o fundo imediatamente ao clicar ou focar em qualquer aba/menu lateral ───────────
document.addEventListener('mousedown', (e) => {
    if (e.target.closest('.nav-menu, .menu-tab, .nav-item, .nav-btn')) {
        if (typeof clearHero === 'function') {
            clearHero(true); 
        }
    }
}, true);

document.addEventListener('focusin', (e) => {

    if (e.target.closest('.nav-menu, .menu-tab, .nav-item, .nav-btn')) {
        if (typeof clearHero === 'function') {
            clearHero(true);
        }
    }
}, true);
