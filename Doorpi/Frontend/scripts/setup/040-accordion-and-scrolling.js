let _currentSection = null;

function _expandSection(sectionEl) {
    if (_currentSection && _currentSection !== sectionEl) _collapseSection(_currentSection);
    sectionEl.classList.add('expanded');
    _currentSection = sectionEl;

    sectionEl.querySelectorAll('.setup-focusable:not(.setup-section-header)').forEach(el => { el.tabIndex = 0; });
}

function _collapseSection(sectionEl) {
    sectionEl.classList.remove('expanded');
    if (_currentSection === sectionEl) _currentSection = null;

    sectionEl.querySelectorAll('.setup-focusable:not(.setup-section-header)').forEach(el => { el.tabIndex = -1; });
}

function _toggleSection(sectionEl) {
    if (sectionEl.classList.contains('expanded')) {
        _collapseSection(sectionEl);
    } else {
        _expandSection(sectionEl);
        setTimeout(() => {
            const first = sectionEl.querySelector('.setup-focusable:not(.setup-section-header)');
            first?.focus();
        }, 50);
    }
}

// Variável global para armazenar a animação atual
let _setupScrollRafId = null;

function _smoothScrollSetup(container, targetScrollTop, duration = 250) { // <-- Reduzi a duração para não brigar com os 80ms do C#
    const start = container.scrollTop;
    const delta = targetScrollTop - start;
    if (Math.abs(delta) < 2) return;

    // Cancela a animação anterior se o usuário segurar o direcional no controle
    if (_setupScrollRafId) {
        cancelAnimationFrame(_setupScrollRafId);
        _setupScrollRafId = null;
    }

    const t0 = performance.now();
    const ease = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    (function step(now) {
        const p = Math.min((now - t0) / duration, 1);
        container.scrollTop = start + delta * ease(p);
        if (p < 1) {
            _setupScrollRafId = requestAnimationFrame(step);
        } else {
            _setupScrollRafId = null;
        }
    })(performance.now());
}
window._setupSmoothScroll = (targetScrollTop) => {
    const container = document.getElementById('setupContainer');
    if (container) _smoothScrollSetup(container, targetScrollTop);
};

