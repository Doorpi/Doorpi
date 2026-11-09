    function runAmbientPhysics() {
        if (!state.ambient || !state.handoffActive) return;
        const w = window.innerWidth, h = window.innerHeight;

        for (const blob of state.ambientBlobs) {
            if (blob.phase === 'burst') {
                blob.vx *= 0.985; blob.vy *= 0.985; blob.x += blob.vx; blob.y += blob.vy;
                const margin = blob.size * 0.4;
                if (blob.x < -margin) { blob.x = -margin; blob.vx *= -1; }
                if (blob.x > w + margin) { blob.x = w + margin; blob.vx *= -1; }
                if (blob.y < -margin) { blob.y = -margin; blob.vy *= -1; }
                if (blob.y > h + margin) { blob.y = h + margin; blob.vy *= -1; }
                if (Math.hypot(blob.vx, blob.vy) < 0.45) blob.phase = 'wander';
            } else {
                blob.wanderAngle += blob.wanderDelta || 0.004;
                blob.vx = Math.cos(blob.wanderAngle) * 0.85; blob.vy = Math.sin(blob.wanderAngle) * 0.85;
                blob.x += blob.vx; blob.y += blob.vy;
                if (blob.x > w + blob.size / 2) blob.x = -blob.size / 2;
                if (blob.x < -blob.size / 2) blob.x = w + blob.size / 2;
                if (blob.y > h + blob.size / 2) blob.y = -blob.size / 2;
                if (blob.y < -blob.size / 2) blob.y = h + blob.size / 2;
            }
            blob.el.style.transform = `translate3d(${blob.x - blob.size / 2}px, ${blob.y - blob.size / 2}px, 0)`;
        }
        state.ambientRaf = requestAnimationFrame(runAmbientPhysics);
    }

    function freezeAmbient() {
        if (state.ambientRaf) cancelAnimationFrame(state.ambientRaf);
        state.ambientRaf = 0;
        state.ambientBlobs.forEach(blob => {
            blob.el.style.willChange = 'auto';
        });
    }

    function resumeAmbient() {
        if (!state.ambient || !state.handoffActive || state.ambientRaf) return;
        state.ambientBlobs.forEach(blob => {
            blob.el.style.willChange = 'transform';
        });
        state.ambientRaf = requestAnimationFrame(runAmbientPhysics);
    }

    function finishHandoff() {
        if (!state.handoffActive) return;
        state.handoffActive = false;
        document.body.classList.remove('doorpi-intro-handoff-active');
        clearHandoffAssets();

        revealMainSystemUI();
        try {
            const bgBlur = document.getElementById('bgBlur');
            const heroReady = !!(bgBlur?.src && bgBlur.style.opacity !== '0');
            if (heroReady) window._stopBlobBg?.();
            else window._startBlobBg?.();
        } catch { }

        if (state.ambientRaf) cancelAnimationFrame(state.ambientRaf);
        state.ambientRaf = 0;
        const layer = state.ambient;
        state.ambient = null; state.ambientBlobs = [];
        if (!layer) return;
        layer.classList.remove('is-active');
        layer.classList.add('is-ending');
        window.setTimeout(() => layer.remove(), 950);
    }

