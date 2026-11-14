    // ── Estilos ────────────────────────────────────────
    (function injectStyles() {
        if (document.getElementById('nav-menu-styles')) return;
        const s = document.createElement('style');
        s.id = 'nav-menu-styles';
        s.textContent = __doorpiCss("injected-styles/nav-menu/nav-menu-styles.css");
        document.head.appendChild(s);
    })();

