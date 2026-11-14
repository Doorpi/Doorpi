    function installStyles() {
        if (document.getElementById('doorpi-controls-v2-styles')) return;
        const style = document.createElement('style');
        style.id = 'doorpi-controls-v2-styles';
        style.textContent = __doorpiCss("injected-styles/controls/doorpi-controls-v2-styles.css");
        document.head.appendChild(style);
    }

