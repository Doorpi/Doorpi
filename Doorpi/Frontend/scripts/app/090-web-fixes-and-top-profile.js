    // ── ANTI-WEB FIXES (Impede bordas brancas e força Loading na GPU corretamente) ───────────
    (function applyAntiWebFixes() {
        const s = document.createElement('style');
        s.textContent = __doorpiCss("injected-styles/app/web-fixes-and-top-profile-1.css");
        document.head.appendChild(s);
    })();
    // 🔹 INJEÇÃO DA FOTO DE PERFIL NO CANTO SUPERIOR ESQUERDO
    (function injectTopProfile() {
        const cluster = document.createElement('div');
        cluster.id = 'doorpiTopCluster';
        cluster.className = 'doorpi-top-cluster';

        const btn = document.createElement('button');
        btn.id = 'btnTopProfile';
        btn.className = 'top-profile-btn';
        btn.tabIndex = 0;
        btn.innerHTML = `
            <span class="top-quick-menu-cue" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M5 7h14" stroke-linecap="round"/>
                    <path d="M5 12h14" stroke-linecap="round"/>
                    <path d="M5 17h14" stroke-linecap="round"/>
                </svg>
                <span class="top-quick-menu-label">MENU</span>
            </span>
            <div class="doorpi-avatar"></div>
            <span class="top-profile-name"></span>`;
        cluster.appendChild(btn);
        document.body.appendChild(cluster);

        btn.addEventListener('click', () => {
            postToHost({ action: 'requestUsers' });
        });

        const fallbackUserIcon = `
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="8.2" r="3.6" stroke="currentColor" stroke-width="1.8"/>
                <path d="M5.8 19.2c1-3.2 3.2-5 6.2-5s5.2 1.8 6.2 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            </svg>`;

        function truncateTopProfileName(value, maxLength = 22) {
            const text = String(value || '').trim();
            if (text.length <= maxLength) return text;
            return text.slice(0, Math.max(0, maxLength - 1)).trimEnd() + '…';
        }

        function applyTopProfileUser(user) {
            const u = user || window._doorpiProfile || {};
            const avatar = btn.querySelector('.doorpi-avatar');
            const name = btn.querySelector('.top-profile-name');
            if (avatar) {
                avatar.innerHTML = u?.PhotoBase64
                    ? `<img src="${_normalizeUserPhotoSrc(u.PhotoBase64)}" />`
                    : (u?.Name ? u.Name.charAt(0).toUpperCase() : '•');
            }
            if (avatar && !u?.PhotoBase64) avatar.innerHTML = fallbackUserIcon;
            if (name) {
                const fullName = u?.Name ?? '';
                name.textContent = truncateTopProfileName(fullName);
                name.title = fullName;
            }
            btn.classList.add('is-loaded');
        }

        window._doorpiTopCluster = cluster;
        window._applyDoorpiTopProfile = applyTopProfileUser;
        requestAnimationFrame(() => applyTopProfileUser(window._doorpiProfile));

        function isCleanHomeTopState() {
            const body = document.body;
            const launchOverlay = document.getElementById('gameLaunchOverlay');
            const userPicker = document.getElementById('doorpiUserPicker');
            const userPickerOpen = body.classList.contains('user-picker-open') ||
                !!(userPicker && userPicker.style.display !== 'none' && userPicker.offsetWidth > 0 && userPicker.offsetHeight > 0);

            if (!window._doorpiUserSessionReady) return false;
            if (userPickerOpen) return false;
            if (window._userSwitching || window.isDoorpiSessionTransitionActive?.()) return false;
            if (window.DoorpiIntro?.isRunning?.()) return false;
            if (window.isGlobalLoading) return false;
            if (window.isModalOpen || window.isSetupOpen || window._vkbIsOpen) return false;
            // Uma sessao minimizada continua viva para preservar processo e audio,
            // mas nao deve esconder nem bloquear os controles globais da Home.
            if (window.isMediaAppActive) return false;
            if (window.isDoorpiUpdatePromptOpen?.()) return false;
            if (window.isDoorpiOverlayOpen?.()) return false;
            if (window.isNavMenuOpen || ['opening', 'closing'].includes(window._navMenuPhase || 'closed')) return false;
            if (window.DoorpiQuickPanel?.isOpen?.()) return false;
            if (typeof isCtxMenuOpen !== 'undefined' && isCtxMenuOpen) return false;
            if (typeof isEditModalOpen !== 'undefined' && isEditModalOpen) return false;
            if (launchOverlay && launchOverlay.classList.contains('visible')) return false;
            if (body.classList.contains('nav-menu-active') ||
                body.classList.contains('nav-menu-closing') ||
                body.classList.contains('setup-active') ||
                body.classList.contains('quick-panel-open') ||
                body.classList.contains('quick-menu-unavailable') ||
                body.classList.contains('doorpi-session-transition')) return false;

            return true;
        }

        window.isDoorpiStableHomeState = isCleanHomeTopState;

        function updateTopClusterVisibility() {
            document.body.classList.toggle('doorpi-home-top-visible', isCleanHomeTopState());
        }

        window.updateDoorpiTopClusterVisibility = updateTopClusterVisibility;
        new MutationObserver(updateTopClusterVisibility).observe(document.body, {
            attributes: true,
            attributeFilter: ['class']
        });
        window.addEventListener('message', () => setTimeout(updateTopClusterVisibility, 0));
        window.addEventListener('focus', () => setTimeout(updateTopClusterVisibility, 0));
        document.addEventListener('visibilitychange', () => setTimeout(updateTopClusterVisibility, 0));
        setInterval(updateTopClusterVisibility, 300);
        requestAnimationFrame(updateTopClusterVisibility);

        const s = document.createElement('style');
        s.textContent = __doorpiCss("injected-styles/app/web-fixes-and-top-profile-2.css");
        document.head.appendChild(s);
    })();

