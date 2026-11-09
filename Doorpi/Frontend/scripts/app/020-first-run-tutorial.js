    window.DoorpiFirstRunTutorial = (() => {
        let page = 0;

        function storageGet(key) {
            try { return localStorage.getItem(key); }
            catch { return null; }
        }

        function storageSet(key, value) {
            try { localStorage.setItem(key, value); }
            catch { }
        }

        function storageRemove(key) {
            try { localStorage.removeItem(key); }
            catch { }
        }

        function shouldShow() {
            return storageGet(FIRST_RUN_TUTORIAL_PENDING_KEY) === 'true' &&
                storageGet(FIRST_RUN_TUTORIAL_DONE_KEY) !== 'true';
        }

        function ensureStyles() {
            if (document.getElementById('doorpiFirstRunTutorialStyles')) return;
            const s = document.createElement('style');
            s.id = 'doorpiFirstRunTutorialStyles';
            s.textContent = __doorpiCss("injected-styles/app/doorpi-first-run-tutorial-styles.css");
            document.head.appendChild(s);
        }

        function xboxLogoSvg() {
            return `<svg viewBox="1 1 30 30" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M11.9 9.3c-5.1-5.1-6.4-4-6.4-4C2.7 8 1 11.8 1 16c0 3.4 1.1 6.6 3.1 9.1h.1V25C3 21.5 8.9 12.9 11.9 9.3zm14.6-4s-1.3-1.1-6.4 3.9c3 3.6 8.9 12.2 7.7 15.7v.1h.1c1.9-2.5 3.1-5.7 3.1-9.1 0-4.1-1.7-7.9-4.5-10.6zM16 5.4c.5-.2 4.9-2.8 7.8-2.1h.1v-.1C21.5 1.8 19 1 16 1s-5.5.8-7.8 2.2v.1h.1c2.5-.6 6.6 1.5 7.7 2.1zm0 7.7c0-.1 0-.1 0 0C11.4 16.5 3.7 25 6.1 27.3 8.8 29.6 12.2 31 16 31s7.2-1.4 9.9-3.7c2.3-2.4-5.4-10.8-9.9-14.2z"/></svg>`;
        }

        function shortcutHtml() {
            return `<span class="doorpi-shortcut-combo" aria-label="Xbox ou LB + RB + R3">
                <span class="doorpi-xbox-logo-btn">${xboxLogoSvg()}</span>
                <span class="doorpi-shortcut-plus">/</span>
                <span class="doorpi-keycap">LB</span>
                <span class="doorpi-shortcut-plus">+</span>
                <span class="doorpi-keycap">RB</span>
                <span class="doorpi-shortcut-plus">+</span>
                <span class="doorpi-stickcap">R3</span>
            </span>`;
        }

        function closeButtonHtml() {
            return `<span class="doorpi-face-x">X</span>`;
        }

        function formatTutorialText(text) {
            return escapeHtml(text)
                .replaceAll('__DOORPI_RETURN_SHORTCUT__', shortcutHtml())
                .replaceAll('__DOORPI_CLOSE_BUTTON__', closeButtonHtml())
                .replace(/\b(YouTube|Discord|GitHub|Doorpi|multitarefas|beta)\b/g, '<span class="first-run-em">$1</span>');
        }

        function pages() {
            const shortcutToken = '__DOORPI_RETURN_SHORTCUT__';
            const closeToken = '__DOORPI_CLOSE_BUTTON__';
            return [
                [
                    typeof t === 'function' ? t('firstRunPage1', shortcutToken, closeToken) : `Para sair de qualquer jogo ou aplicativo, pressione ${shortcutToken} a qualquer momento para retornar ao Doorpi. Você pode fechar qualquer aplicativo pelas opções pressionando ${closeToken}.`
                ],
                [
                    typeof t === 'function' ? t('firstRunPage2a') : 'O Doorpi permite multitarefas, você é livre para ouvir YouTube, usar Discord e jogar tudo ao mesmo tempo!',
                    typeof t === 'function' ? t('firstRunPage2b', shortcutToken) : `Pressione ${shortcutToken} para minimizar e abrir outra aplicação quando quiser.`,
                    typeof t === 'function' ? t('firstRunPage2c') : 'Esta é uma versão beta. Caso encontre algum problema, reporte no GitHub do projeto.',
                    typeof t === 'function' ? t('firstRunPage2d') : 'Divirta-se!'
                ]
            ];
        }

        function render() {
            const overlay = document.getElementById('doorpiFirstRunTutorial');
            if (!overlay) return;
            const tr = (key, ...args) => typeof t === 'function' ? t(key, ...args) : key;
            const allPages = pages();
            const copy = allPages[Math.min(page, allPages.length - 1)] || [];
            const isLast = page >= allPages.length - 1;
            overlay.innerHTML = `
                <section class="first-run-panel" aria-live="polite">
                    <h1 class="first-run-title">${tr('firstRunTitle')}</h1>
                    <div class="first-run-copy">
                        ${copy.map(text => `<p>${formatTutorialText(text)}</p>`).join('')}
                    </div>
                    <button class="first-run-action" type="button" tabindex="0">
                        ${isLast ? tr('firstRunFinish') : tr('firstRunNext')}
                    </button>
                    <div class="first-run-hint">${tr('firstRunHint')}</div>
                </section>
            `;
            overlay.querySelector('.first-run-action')?.addEventListener('click', confirm);
            requestAnimationFrame(() => overlay.querySelector('.first-run-action')?.focus());
        }

        function show() {
            if (!shouldShow()) return false;
            if (window._userSwitching || window.isDoorpiSessionTransitionActive?.()) {
                window._doorpiFirstRunTutorialDeferred = true;
                return false;
            }
            if (isOpen()) return true;
            ensureStyles();
            let overlay = document.getElementById('doorpiFirstRunTutorial');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.id = 'doorpiFirstRunTutorial';
                overlay.className = 'doorpi-first-run-tutorial doorpi-manager-overlay';
                overlay.dataset.required = 'true';
                document.body.appendChild(overlay);
            }
            page = 0;
            render();
            overlay.classList.add('visible');
            overlay.style.display = 'flex';
            window.updateDoorpiQuickMenuAvailability?.();
            return true;
        }

        function finish() {
            const overlay = document.getElementById('doorpiFirstRunTutorial');
            window.quarantineDoorpiGamepadActions?.(500);
            window._doorpiSuppressPointer?.(320);
            storageSet(FIRST_RUN_TUTORIAL_DONE_KEY, 'true');
            storageRemove(FIRST_RUN_TUTORIAL_PENDING_KEY);
            if (overlay) {
                overlay.classList.remove('visible');
                overlay.style.display = 'none';
            }
            window.updateDoorpiQuickMenuAvailability?.();
            requestAnimationFrame(async () => {
                await _waitForDoorpiInteractiveReady({ mode: 'first-run-tutorial-finished' });
                scheduleDoorpiFocusRecovery?.();
            });
            return true;
        }

        function confirm() {
            if (!isOpen()) return false;
            const allPages = pages();
            if (page < allPages.length - 1) {
                page += 1;
                render();
                return true;
            }
            return finish();
        }

        function isOpen() {
            const overlay = document.getElementById('doorpiFirstRunTutorial');
            return !!(overlay && overlay.style.display !== 'none' && overlay.classList.contains('visible'));
        }

        return { maybeShow: show, confirm, isOpen };
    })();

