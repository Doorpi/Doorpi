    function clearHandoffAssets() {
        state.handoffStyleEl?.remove();
        state.handoffStyleEl = null;
        if (state.handoffBodyClasses.length) {
            document.body.classList.remove(...state.handoffBodyClasses);
            state.handoffBodyClasses = [];
        }
    }

    function injectHandoffAssets(cfg) {
        clearHandoffAssets();
        const userPicker = cfg.userPicker || {};
        const bodyClasses = [...classListFrom(cfg.bodyClass), ...classListFrom(cfg.bodyClasses), ...classListFrom(userPicker.bodyClass), ...classListFrom(userPicker.bodyClasses)];

        if (bodyClasses.length) {
            document.body.classList.add(...bodyClasses);
            state.handoffBodyClasses = bodyClasses;
        }

        const cssText = userPicker.css || cfg.css || '';
        const cssFile = userPicker.style || userPicker.cssFile || cfg.style || cfg.cssFile || '';

        if (cssText) {
            const style = document.createElement('style');
            style.id = 'doorpiIntroHandoffStyle';
            style.textContent = String(cssText);
            document.head.appendChild(style);
            state.handoffStyleEl = style;
        } else if (cssFile) {
            const link = document.createElement('link');
            link.id = 'doorpiIntroHandoffStyle';
            link.rel = 'stylesheet';
            link.href = cssFile;
            document.head.appendChild(link);
            state.handoffStyleEl = link;
        }
    }

    function syncExistingUserPickerHandoffClasses() {
        const overlay = document.getElementById('doorpiUserPicker');
        if (!overlay) return;
        const cfg = state.handoffConfig || {};
        const userPicker = cfg.userPicker || {};
        const transparent = userPicker.transparentBackdrop ?? cfg.transparentBackdrop ?? true;
        if (!transparent) return;
        overlay.classList.add('doorpi-intro-handoff');
        classListFrom(userPicker.className || userPicker.class || cfg.userPickerClass)
            .forEach(cls => overlay.classList.add(cls));
    }

    const AMBIENT_BLOB_MOTION = [
        { size: 0.94, angle: 5.12, speed: 11.2, wander: -0.006 },
        { size: 1.06, angle: 4.06, speed: 9.4, wander: 0.005 },
        { size: 0.88, angle: 5.84, speed: 12.1, wander: -0.004 },
        { size: 1.12, angle: 2.56, speed: 8.8, wander: 0.006 },
        { size: 0.78, angle: 0.68, speed: 10.6, wander: 0.004 },
        { size: 1.00, angle: 1.88, speed: 9.8, wander: -0.005 },
        { size: 0.82, angle: 3.34, speed: 11.6, wander: 0.003 },
        { size: 0.98, angle: 0.12, speed: 8.6, wander: -0.004 }
    ];

    function createAmbient(handoff = {}) {
        if (state.handoffActive) return;
        const cfg = { ...(state.config?.handoff || {}), ...handoff, userPicker: { ...(state.config?.handoff?.userPicker || {}), ...(handoff.userPicker || {}) } };
        if (cfg.enabled === false) return;

        state.handoffConfig = cfg;
        state.handoffActive = true;
        document.body.classList.add('doorpi-intro-handoff-active');
        injectHandoffAssets(cfg);
        syncExistingUserPickerHandoffClasses();

        if (cfg.ambient === false || cfg.ambient === 'none') return;
        const colors = Array.isArray(cfg.colors) && cfg.colors.length ? cfg.colors : DEFAULT_CONFIG.handoff.colors;

        const layer = document.createElement('div');
        layer.id = 'doorpiIntroAmbient';
        layer.style.setProperty('--doorpi-intro-bg', cfg.background || '#0b1232');
        if (cfg.vignette) layer.style.setProperty('--doorpi-intro-vignette', cfg.vignette);
        layer.innerHTML = '<div class="doorpi-intro-ambient-vig"></div>';
        document.body.appendChild(layer);

        state.ambientBlobs = [];

        const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
        const ratio = Math.max(1, window.innerWidth / Math.max(1, window.innerHeight));
        for (let i = 0; i < Math.max(4, colors.length); i++) {
            const motion = AMBIENT_BLOB_MOTION[i % AMBIENT_BLOB_MOTION.length];
            const blob = document.createElement('div');
            blob.className = 'doorpi-intro-ambient-blob';
            const size = Math.min(window.innerWidth, window.innerHeight) * motion.size;
            const color = colors[i % colors.length];
            blob.style.width = `${size}px`; blob.style.height = `${size}px`;
            blob.style.background = `radial-gradient(circle, ${color} 0%, transparent 70%)`;
            layer.insertBefore(blob, layer.firstChild);

            const angle = motion.angle, speed = motion.speed;
            state.ambientBlobs.push({ el: blob, x: cx, y: cy, size, vx: Math.cos(angle) * speed * (ratio * 0.8), vy: Math.sin(angle) * speed, phase: 'burst', wanderAngle: angle, wanderDelta: motion.wander });
        }

        state.ambient = layer;
        requestAnimationFrame(() => layer.classList.add('is-active'));
        if (state.ambientBlobs.length) runAmbientPhysics();
    }

    function createNativeHandoffAmbient() {
        createAmbient({
            background: '#0b1232',
            vignette: 'radial-gradient(circle at 50% 50%, transparent 28%, rgba(0,0,18,0.66) 92%)',
            colors: [
                'rgba(42,58,170,0.68)', 'rgba(28,78,185,0.62)',
                'rgba(62,46,150,0.64)', 'rgba(20,96,165,0.58)',
                'rgba(76,58,176,0.56)', 'rgba(28,112,178,0.54)',
                'rgba(92,122,178,0.42)', 'rgba(68,96,194,0.48)'
            ],
            userPicker: {
                transparentBackdrop: true
            }
        });
    }

