    window.openExtensionsManager = function () {
        if (window.isDoorpiSessionTransitionActive?.()) return;
        // Se o Nav Menu estiver fechado, manda abrir
        if (!window.isNavMenuOpen) {
            if (typeof window.openNavMenu === 'function') {
                window.openNavMenu();
            }
        }
        setTimeout(() => {
            if (typeof window._navMenuOpenExtensions === 'function') {
                window._navMenuOpenExtensions();
            }
        }, 120);
    };

    window.openCreateUserDialog = openCreateUserDialog;

    // Handler global para atualizar extensões
    window._doorpiUpdateExtension = function (extId) {
        // 1. Altera o texto de Status global
        const statusEl = document.getElementById('navExtensionStatus');
        if (statusEl) {
            statusEl.textContent = typeof t === 'function' ? t('extDownloadingUpdate') : "Baixando atualização...";
            statusEl.className = 'nav-ext-status';
        }

        // 2. Altera visualmente o botão específico que foi clicado
        const btn = document.querySelector(`.nav-ext-btn.primary[data-id="${extId}"]`);
        if (btn) {
            btn.textContent = typeof t === 'function' ? t('extUpdatingBtn') : "Atualizando...";
            btn.style.opacity = "0.5";
            btn.style.pointerEvents = "none";
        }

        // 3. Pede pro C# fazer a atualização
        postToHost({ action: 'updateExtension', id: extId });
    };
    // Handler global para remover extensões
    window._doorpiDeleteExtension = function (extId) {
        postToHost({ action: 'deleteExtension', id: extId });
        setTimeout(() => { postToHost({ action: 'requestExtensions' }); }, 500);
    };


    window.openExtensionsManager = openExtensionsManager;
    window.openCreateUserDialog = openCreateUserDialog;

    let _emulatorDiscSelection = null;

    function _escapeDiscSelectorText(value) {
        return String(value ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
    }

    window.closeEmulatorDiscSelector = function (restoreFocus = true) {
        const overlay = document.getElementById('emulatorDiscSelector');
        const previousFocus = _emulatorDiscSelection?.previousFocus;
        overlay?.remove();
        _emulatorDiscSelection = null;
        if (restoreFocus && previousFocus?.isConnected) {
            requestAnimationFrame(() => previousFocus.focus({ preventScroll: true }));
        }
    };

    window.isEmulatorDiscSelectorOpen = function () {
        return document.getElementById('emulatorDiscSelector') != null;
    };

    window.openEmulatorDiscSelector = function (item, onSelect) {
        const discPaths = Array.isArray(item?.emulatorDiscPaths)
            ? item.emulatorDiscPaths.filter(Boolean)
            : [];
        if (discPaths.length < 2) return false;

        window.closeEmulatorDiscSelector(false);
        const previousFocus = document.activeElement;
        const overlay = document.createElement('div');
        overlay.id = 'emulatorDiscSelector';
        overlay.className = 'doorpi-manager-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:10050;display:flex;align-items:center;justify-content:center;background:rgba(5,7,17,.82);backdrop-filter:blur(14px);padding:36px;';
        const artwork = item.staticVertical || item.vertical || '';
        overlay.innerHTML = `
            <section role="dialog" aria-modal="true" aria-labelledby="emulatorDiscSelectorTitle" style="width:min(760px,92vw);max-height:min(760px,88vh);display:grid;grid-template-columns:${artwork ? '190px minmax(0,1fr)' : 'minmax(0,1fr)'};gap:28px;padding:28px;border:1px solid rgba(255,255,255,.18);border-radius:18px;background:linear-gradient(145deg,rgba(34,39,59,.98),rgba(15,19,34,.98));box-shadow:0 28px 80px rgba(0,0,0,.5);color:#fff;">
                ${artwork ? `<img src="${_escapeDiscSelectorText(artwork)}" alt="" style="width:190px;aspect-ratio:2/3;object-fit:cover;border-radius:12px;background:rgba(255,255,255,.06);">` : ''}
                <div style="min-width:0;display:flex;flex-direction:column;">
                    <div style="font-size:14px;letter-spacing:.09em;text-transform:uppercase;color:rgba(255,255,255,.6);">Selecione o disco</div>
                    <h2 id="emulatorDiscSelectorTitle" style="margin:7px 0 6px;font-size:28px;line-height:1.15;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${_escapeDiscSelectorText(item.name || 'Jogo')}</h2>
                    <p style="margin:0 0 20px;color:rgba(255,255,255,.66);">Qual disco deseja iniciar?</p>
                    <div style="display:flex;flex-direction:column;gap:10px;overflow-y:auto;padding:3px;">
                        ${discPaths.map((path, index) => {
                            const fileName = String(path).split(/[\\/]/).pop() || path;
                            return `<button type="button" class="emulator-disc-option" data-disc-index="${index}" tabindex="0" style="display:flex;align-items:center;gap:16px;width:100%;padding:14px 16px;border:1px solid rgba(255,255,255,.18);border-radius:10px;background:rgba(255,255,255,.055);color:#fff;text-align:left;cursor:pointer;">
                                <strong style="flex:0 0 auto;font-size:16px;">Disco ${index + 1}</strong>
                                <span title="${_escapeDiscSelectorText(fileName)}" style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:rgba(255,255,255,.58);font-size:13px;">${_escapeDiscSelectorText(fileName)}</span>
                            </button>`;
                        }).join('')}
                    </div>
                    <button type="button" id="emulatorDiscSelectorCancel" tabindex="0" data-gamepad-hint="cancel" style="align-self:flex-end;margin-top:20px;padding:10px 18px;border:0;border-bottom:2px solid rgba(255,255,255,.3);background:transparent;color:#fff;font-weight:700;cursor:pointer;">Voltar</button>
                </div>
            </section>`;

        document.body.appendChild(overlay);
        _emulatorDiscSelection = { previousFocus, onSelect, discPaths };
        overlay.querySelectorAll('.emulator-disc-option').forEach(button => {
            button.addEventListener('click', () => {
                const index = Number(button.dataset.discIndex || 0);
                const selectedPath = discPaths[index];
                const callback = _emulatorDiscSelection?.onSelect;
                window.closeEmulatorDiscSelector(false);
                callback?.(selectedPath);
            });
        });
        overlay.querySelector('#emulatorDiscSelectorCancel')?.addEventListener('click', () => window.closeEmulatorDiscSelector(true));
        overlay.addEventListener('keydown', event => {
            if (event.key !== 'Escape' && event.key !== 'Backspace' && event.key !== 'BrowserBack') return;
            event.preventDefault();
            event.stopImmediatePropagation();
            window.closeEmulatorDiscSelector(true);
            window.DoorpiUiSound?.play('back');
        });
        overlay.addEventListener('pointerdown', event => {
            if (event.target === overlay) window.closeEmulatorDiscSelector(true);
        });
        requestAnimationFrame(() => overlay.querySelector('.emulator-disc-option')?.focus());
        window.refreshDoorpiGamepadHints?.();
        return true;
    };

