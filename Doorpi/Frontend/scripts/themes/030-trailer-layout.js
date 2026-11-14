// Core presentation adapter. Never changes media URLs, player identity or playback policy.
(() => {
    'use strict';
    let pending = 0, observer, observed;
    function measure() {
        pending = 0;
        const layer = document.querySelector('.home-trailer-layer');
        const target = document.querySelector('.home-feature-art-shell');
        if (!layer || !target) return;
        if (observed !== target) {
            observer?.disconnect();
            observer = new ResizeObserver(schedule);
            observer.observe(target);
            const stage = target.closest('.home-feature-stage');
            if (stage) observer.observe(stage);
            observed = target;
        }
        if (document.documentElement.getAttribute('data-doorpi-trailer-layout') !== 'feature-art') {
            for (const key of ['x','y','width','height']) layer.style.removeProperty('--doorpi-trailer-' + key);
            return;
        }
        const art = target.getBoundingClientRect(), bounds = layer.getBoundingClientRect();
        const scale = bounds.width / layer.clientWidth || 1;
        for (const [key, value] of Object.entries({ x: (art.left-bounds.left)/scale, y: (art.top-bounds.top)/scale, width: art.width/scale, height: art.height/scale }))
            layer.style.setProperty('--doorpi-trailer-' + key, Math.max(0, value) + 'px');
    }
    function schedule() { if (!pending) pending = requestAnimationFrame(measure); }
    window.addEventListener('doorpi:theme-changed', schedule);
    window.addEventListener('resize', schedule);
    new MutationObserver(schedule).observe(document.documentElement, { attributes: true, attributeFilter: ['data-doorpi-trailer-layout','data-doorpi-home-layout','data-doorpi-feature-layout'] });
    if (document.body) new MutationObserver(schedule).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    window.DoorpiTrailerLayout = Object.freeze({ refresh: schedule });
    schedule();
})();
