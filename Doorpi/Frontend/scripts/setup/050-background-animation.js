// ── Lógica Restaurada do Canvas de Fundo (Exclusivo e Isolado do Setup) ────────
let _bgRaf = null;

function _startSetupBg() {
    if (_bgRaf) return; // Evita empilhar o requestAnimationFrame
    const canvas = document.getElementById('setupBg');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const blobs = [
        { px: 0.0, py: 0.3, sx: 0.00016, sy: 0.00011, r: 0.78, color: [82, 105, 230] },
        { px: 1.4, py: 2.2, sx: 0.00012, sy: 0.00017, r: 0.72, color: [48, 112, 235] },
        { px: 2.8, py: 0.8, sx: 0.00019, sy: 0.00010, r: 0.68, color: [106, 82, 210] },
        { px: 0.8, py: 3.8, sx: 0.00014, sy: 0.00021, r: 0.66, color: [34, 132, 205] },
        { px: 3.4, py: 1.8, sx: 0.00010, sy: 0.00015, r: 0.60, color: [118, 92, 220] },
        { px: 1.9, py: 4.5, sx: 0.00018, sy: 0.00013, r: 0.58, color: [42, 145, 200] },
    ];
    let t = 0;

    function resize() {
        if (!canvas) return;
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resize();

    // Anexa evento resize de modo seguro
    if (!canvas._hasResize) {
        window.addEventListener('resize', resize);
        canvas._hasResize = true;
    }

    function frame() {
        if (!window.isSetupOpen) return;
        const W = canvas.width, H = canvas.height;
        ctx.clearRect(0, 0, W, H);

        ctx.fillStyle = '#090b22';
        ctx.fillRect(0, 0, W, H);

        blobs.forEach(b => {
            const x = W * (0.15 + 0.7 * (0.5 + 0.5 * Math.sin(t * b.sx + b.px)));
            const y = H * (0.10 + 0.8 * (0.5 + 0.5 * Math.sin(t * b.sy + b.py)));
            const r = Math.min(W, H) * b.r;
            const g = ctx.createRadialGradient(x, y, 0, x, y, r);
            const [cr, cg, cb] = b.color;
            g.addColorStop(0, `rgba(${cr},${cg},${cb},0.48)`);
            g.addColorStop(0.42, `rgba(${cr},${cg},${cb},0.19)`);
            g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.ellipse(x, y, r, r * 0.72, t * 0.00004, 0, Math.PI * 2);
            ctx.fill();
        });

        const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.85);
        vig.addColorStop(0, 'rgba(0,0,0,0)');
        vig.addColorStop(1, 'rgba(0,0,18,0.54)');
        ctx.fillStyle = vig;
        ctx.fillRect(0, 0, W, H);

        t++;
        _bgRaf = requestAnimationFrame(frame);
    }
    frame();
}

function _stopSetupBg() {
    if (_bgRaf) {
        cancelAnimationFrame(_bgRaf);
        _bgRaf = null;
    }
}

