    function _esc(str) {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // =============================================================================
    // Indicador Flutuante (Menu Seta para Baixo)
    // =============================================================================

    (function initNavHint() {
        const navHint = document.createElement('div');
        navHint.id = 'navHintDown';
        navHint.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <polyline points="6 9 12 15 18 9" stroke="rgba(255,255,255,0.45)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        `;
        document.body.appendChild(navHint);

        window.updateNavHint = function () {
            const hint = document.getElementById('navHintDown');
            if (!hint) return;

            if (window.isNavMenuOpen) {
                hint.classList.add('visible', 'nav-open');
                return;
            }

            hint.classList.remove('nav-open');

            const focused = document.activeElement;
            const isCard = focused?.classList?.contains('card') && !focused?.classList?.contains('add-card');
            const inGrid = focused?.closest('#gameGrid') || focused?.closest('#mediaGrid');

            const isOverlayOpen = window.isModalOpen || window.isSetupOpen ||
                window._vkbIsOpen || window.isGlobalLoading ||
                (typeof isCtxMenuOpen !== 'undefined' && isCtxMenuOpen) ||
                (typeof isEditModalOpen !== 'undefined' && isEditModalOpen);

            if (isOverlayOpen) {
                hint.classList.remove('visible');
                return;
            }
            hint.classList.toggle('visible', !!(isCard && inGrid));
        };

        document.addEventListener('focusin', window.updateNavHint);
        document.addEventListener('focusout', window.updateNavHint);
    })();

