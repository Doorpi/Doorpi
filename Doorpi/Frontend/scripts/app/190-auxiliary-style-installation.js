    const s = document.createElement('style');

    document.head.appendChild(s);
    /* Seção: Injeção de estilos e elementos auxiliares */
    (function injectStyles() {
        const s = document.createElement('style');
        s.textContent = __doorpiCss("injected-styles/app/auxiliary-style-installation-1.css");
        document.head.appendChild(s);
    })();

