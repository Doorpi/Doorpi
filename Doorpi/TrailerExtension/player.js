(() => {
    'use strict';

    const hiddenSelectors = [
        '.ytp-large-play-button',
        '.ytp-large-play-button-red-bg',
        '.ytp-cued-thumbnail-overlay button',
        '.ytp-play-button',
        '.ytp-bezel',
        '.ytp-bezel-text-wrapper',
        '.ytp-spinner',
        '.ytp-spinner-container',
        '.ytp-chrome-top',
        '.ytp-chrome-bottom',
        '.ytp-gradient-top',
        '.ytp-gradient-bottom',
        '.ytp-title',
        '.ytp-watermark',
        '.ytp-youtube-button',
        '.ytp-share-button',
        '.ytp-watch-later-button',
        '.ytp-impression-link',
        '.ytp-paid-content-overlay',
        '.ytp-cards-button',
        '.ytp-cards-teaser',
        '.ytp-show-cards-title',
        '.ytp-tooltip',
        '.ytp-pause-overlay',
        '.ytp-ce-element',
        '.ytp-ce-element-show',
        '.ytp-ce-covering-overlay',
        '.ytp-ce-element-shadow',
        '.ytp-ce-expanding-image',
        '.ytp-ce-video',
        '.ytp-ce-channel',
        '.ytp-ce-playlist',
        '.ytp-ce-website',
        '.ytp-endscreen-content',
        '.ytp-endscreen-previous',
        '.ytp-endscreen-next',
        '.ytp-endscreen-paginate',
        '.ytp-suggestion-set',
        '.ytp-autonav-endscreen',
        '.ytp-autonav-endscreen-upnext-container',
        '.ytp-autonav-endscreen-video-info',
        '.ytp-videowall-still',
        '.html5-endscreen',
        '.videowall-endscreen'
    ];

    const selector = hiddenSelectors.join(',');
    const transparentSelectors = [
        '#player-controls',
        '#player-control-overlay',
        '#player-controls-a11y-toggle',
        '.ytPlayerControlsContainerHost',
        '.new-controls',
        '.player-controls-background-container'
    ];
    const transparentSelector = transparentSelectors.join(',');
    const backgroundId = 'doorpi-trailer-player-bg';
    let backgroundCanvas = null;
    let backgroundContext = null;
    let backgroundSource = null;
    let currentVideo = null;

    function findVideo() {
        return document.querySelector('video.html5-main-video, video');
    }

    function ensureVideoBackground() {
        if (backgroundCanvas || !document.body) return;
        const background = document.createElement('div');
        background.id = backgroundId;
        background.setAttribute('aria-hidden', 'true');
        backgroundCanvas = document.createElement('canvas');
        backgroundCanvas.width = window.innerWidth || 1920;
        backgroundCanvas.height = window.innerHeight || 1080;
        backgroundContext = backgroundCanvas.getContext('2d');
        background.appendChild(backgroundCanvas);
        document.body.prepend(background);

        window.addEventListener('resize', () => {
            if (!backgroundCanvas) return;
            backgroundCanvas.width = window.innerWidth || 1920;
            backgroundCanvas.height = window.innerHeight || 1080;
        }, { passive: true });
    }

    function bindVideoBackground() {
        const video = findVideo();
        if (video === currentVideo) return;
        currentVideo = video;
        backgroundSource = video || null;
    }

    function prepareVideoBackground() {
        ensureVideoBackground();
        bindVideoBackground();
    }

    function drawVideoBackground() {
        window.requestAnimationFrame(drawVideoBackground);
        if (!backgroundSource || !backgroundContext || !backgroundCanvas || backgroundSource.readyState < 2)
            return;
        try {
            backgroundContext.drawImage(
                backgroundSource,
                0,
                0,
                backgroundCanvas.width,
                backgroundCanvas.height
            );
        } catch { }
    }

    function hideElement(element) {
        if (!(element instanceof HTMLElement)) return;
        // O player recria e reativa estes nós durante a reprodução. O atributo
        // nativo `hidden` é o sinal mais estável e acompanha o comportamento que
        // o próprio YouTube usa para desativar cards de tela final.
        if (!element.hidden) element.hidden = true;
        if (element.getAttribute('aria-hidden') !== 'true')
            element.setAttribute('aria-hidden', 'true');

        const forceStyle = (property, value) => {
            if (element.style.getPropertyValue(property) !== value ||
                element.style.getPropertyPriority(property) !== 'important') {
                element.style.setProperty(property, value, 'important');
            }
        };
        forceStyle('display', 'none');
        forceStyle('visibility', 'hidden');
        forceStyle('opacity', '0');
        forceStyle('pointer-events', 'none');
    }

    function suppress(root) {
        if (!(root instanceof Element || root instanceof Document)) return;
        if (root instanceof Element && root.matches(selector)) hideElement(root);
        root.querySelectorAll(selector).forEach(hideElement);

        const makeTransparent = element => {
            if (!(element instanceof HTMLElement)) return;
            if (element.style.getPropertyValue('opacity') !== '0' ||
                element.style.getPropertyPriority('opacity') !== 'important') {
                element.style.setProperty('opacity', '0', 'important');
            }
            if (element.style.getPropertyValue('pointer-events') !== 'none' ||
                element.style.getPropertyPriority('pointer-events') !== 'important') {
                element.style.setProperty('pointer-events', 'none', 'important');
            }
        };
        if (root instanceof Element && root.matches(transparentSelector)) makeTransparent(root);
        root.querySelectorAll(transparentSelector).forEach(makeTransparent);
    }

    const start = () => {
        suppress(document);
        const observer = new MutationObserver(records => {
            for (const record of records) {
                for (const node of record.addedNodes) {
                    if (node instanceof Element) suppress(node);
                }
                if (record.target instanceof Element && record.target.matches(selector))
                    hideElement(record.target);
            }
            prepareVideoBackground();
        });
        observer.observe(document.documentElement, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: [ 'class', 'hidden', 'style' ]
        });

        // Confirma para a página hospedeira que o conteúdo interno do iframe foi
        // alcançado; útil para distinguir instalação da extensão de injeção real.
        try {
            window.parent.postMessage({
                type: 'doorpiTrailerCleanerReady',
                version: '1.0.5'
            }, '*');
        } catch { }

        prepareVideoBackground();
        drawVideoBackground();
        const videoProbe = window.setInterval(prepareVideoBackground, 400);
        window.setTimeout(() => window.clearInterval(videoProbe), 12000);
    };

    if (document.documentElement) start();
    else document.addEventListener('DOMContentLoaded', start, { once: true });
})();
