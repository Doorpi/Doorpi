    // ── Fundo animado (blobs) — aparece quando não há hero ativo ──────────────────
    // ── Fundo animado (blobs) — Renderizado via GPU (Zero Stutter/Sem Pausas) ────
    (function initBlobBackground() {
        // 1. Remove qualquer canvas antigo para evitar lixo
        const oldCanvas = document.getElementById('appBlobBg');
        if (oldCanvas) oldCanvas.remove();

        // 2. Injeta as Animações CSS (Roda direto na Compositor Thread)
        const s = document.createElement('style');
        s.textContent = __doorpiCss("injected-styles/app/ambient-background-1.css");
        document.head.appendChild(s);

        // 3. Monta o HTML dos Blobs (Bolas puxadas mais pra dentro da tela)
        const container = document.createElement('div');
        container.id = 'appBlobBg';

        const blobDefs = [
            // Canto Superior Esquerdo
            { kf: 'ab1', dur: '70s', delay: '0s', top: '-18%', left: '-18%', w: '155vmin', h: '116vmin', color: '82,105,230' },
            // Canto Superior Direito
            { kf: 'ab2', dur: '82s', delay: '-12s', top: '-16%', left: '62%', w: '150vmin', h: '110vmin', color: '48,112,235' },
            // Canto Inferior Esquerdo
            { kf: 'ab3', dur: '92s', delay: '-7s', top: '60%', left: '-22%', w: '145vmin', h: '105vmin', color: '106,82,210' },
            // Canto Inferior Direito
            { kf: 'ab4', dur: '76s', delay: '-20s', top: '58%', left: '64%', w: '140vmin', h: '104vmin', color: '34,132,205' },
            // Lateral Esquerda (Meio)
            { kf: 'ab5', dur: '88s', delay: '-25s', top: '22%', left: '-24%', w: '136vmin', h: '98vmin', color: '118,92,220' },
            // Lateral Direita (Meio)
            { kf: 'ab6', dur: '66s', delay: '-15s', top: '28%', left: '72%', w: '132vmin', h: '96vmin', color: '42,145,200' },
        ];

        function getIntroOffsetForBlob(index) {
            const throwVectors = [
                [-118, -86],
                [112, -90],
                [-116, 94],
                [118, 96],
                [-142, 8],
                [142, -8]
            ];
            const [dx, dy] = throwVectors[index] || [0, 0];
            return { dx: `${dx}vw`, dy: `${dy}vh` };
        }

        function renderBlobLayerHtml(options = {}) {
            const fromIntro = !!options.fromIntro;
            const includeVigId = options.includeVigId !== false;
            const blobs = blobDefs.map((b, index) => {
                const offset = fromIntro ? getIntroOffsetForBlob(index) : { dx: '0px', dy: '0px' };
                return `
            <div class="app-blob${fromIntro ? ' doorpi-from-intro' : ''}" style="
                width:${b.w}; height:${b.h}; top:${b.top}; left:${b.left};
                background:radial-gradient(circle, rgba(${b.color},0.46) 0%, rgba(${b.color},0.18) 42%, transparent 72%);
                animation-name:${b.kf}; animation-duration:${fromIntro ? '4.4s' : b.dur}; animation-delay:${fromIntro ? '0s' : b.delay};
                --intro-dx:${offset.dx}; --intro-dy:${offset.dy};
            "></div>`;
            }).join('');
            return blobs + `<div ${includeVigId ? 'id="appBlobVig"' : ''} class="app-blob-vig"></div>`;
        }

        window.DoorpiBlobBackground = {
            renderInnerHtml: renderBlobLayerHtml,
            finishIntroArrival(root) {
                const scope = root || document;
                scope.querySelectorAll?.('.app-blob.doorpi-from-intro').forEach((blob, index) => {
                    const def = blobDefs[index] || blobDefs[0];
                    blob.classList.remove('doorpi-from-intro');
                    blob.style.animationName = def.kf;
                    blob.style.animationDuration = def.dur;
                    blob.style.animationDelay = def.delay;
                });
            }
        };

        container.innerHTML = renderBlobLayerHtml({ includeVigId: true });

        document.body.appendChild(container);

        // 4. Controle puramente por Opacidade
        let _blobShowTimer = null;
        let _blobHideTimer = null;

        function checkHeroState() {
            const bgBlur = document.getElementById('bgBlur');
            const heroInactive = !bgBlur?.src || bgBlur.style.opacity === '0';

            if (heroInactive) {
                if (_blobHideTimer) { clearTimeout(_blobHideTimer); _blobHideTimer = null; }
                if (!_blobShowTimer) {
                    _blobShowTimer = setTimeout(() => {
                        _blobShowTimer = null;
                        const bg = document.getElementById('bgBlur');
                        if (!bg?.src || bg?.style.opacity === '0') {
                            container.style.opacity = '1';
                        }
                    }, 400);
                }
            } else {
                if (_blobShowTimer) { clearTimeout(_blobShowTimer); _blobShowTimer = null; }
                container.style.opacity = '0';
            }
        }

        window._startBlobBg = () => {
            if (_blobHideTimer) { clearTimeout(_blobHideTimer); _blobHideTimer = null; }
            container.style.opacity = '1';
        };

        window._stopBlobBg = () => {
            if (_blobShowTimer) { clearTimeout(_blobShowTimer); _blobShowTimer = null; }
            container.style.opacity = '0';
        };

        const bgBlur = document.getElementById('bgBlur');
        if (bgBlur) {
            new MutationObserver(checkHeroState).observe(bgBlur, {
                attributes: true,
                attributeFilter: ['src', 'style']
            });
        }

        const _origSwitch = window.switchHeroBackground;
        window.switchHeroBackground = function (...args) {
            _origSwitch?.(...args);
            setTimeout(checkHeroState, 0);
        };

        checkHeroState();
    })();

    document.addEventListener('focusin', () => {
        const focused = document.activeElement;
        const isCard = focused?.classList?.contains('card');
        const isInGrid = focused?.closest('#gameGrid');
        const keepPreparedHomeVisual = window.DoorpiFirstRunTutorial?.isOpen?.() === true
            || window._userSwitching === true
            || document.body.classList.contains('doorpi-session-transition');

        const isNavMenuActive =
            document.body.classList.contains('nav-menu-active') ||
            document.body.classList.contains('nav-menu-closing') ||
            window.isNavMenuOpen;

        if (!isCard && !isInGrid && !isNavMenuActive && !keepPreparedHomeVisual) {
            window._heroCleanupTimer = setTimeout(() => {
                const bgBlur = document.getElementById('bgBlur');
                const heroImg = document.getElementById('heroImage');
                const logoEl = document.getElementById('gameLogo');
                const gridBgImg = document.getElementById('gridBgImg');

                if (bgBlur) bgBlur.style.opacity = '0';
                if (heroImg) heroImg.style.opacity = '0';
                if (logoEl) { logoEl.classList.remove('visible'); logoEl.style.opacity = ''; }
                if (gridBgImg) gridBgImg.removeAttribute('src');

                _currentBgSrc = '';
                if (typeof _heroReqId !== 'undefined') _heroReqId++;
                if (typeof window._startBlobBg === 'function') window._startBlobBg();
            }, 80);
        }
    });
