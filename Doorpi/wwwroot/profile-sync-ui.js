(() => {
    'use strict';

    const tr = (key, fallback, ...args) => typeof window.t === 'function' ? window.t(key, ...args) : fallback;
    let overlay = null;
    let returnFocus = null;
    let activeProfileId = '';
    let activeConflictData = null;
    let pendingConflictData = null;
    let conflictRetryTimer = 0;
    let activeBackAction = null;
    let lastAnalogScrollAt = 0;
    let lastModalFocus = null;
    let focusTrapHandler = null;

    function ensureStyles() {
        if (document.getElementById('profile-sync-styles')) return;
        const style = document.createElement('style');
        style.id = 'profile-sync-styles';
        style.textContent = `
            .profile-sync-overlay { position:fixed; inset:0; z-index:30000; display:flex; align-items:center; justify-content:center; padding:5vh 5vw; box-sizing:border-box; background:rgba(2,5,14,.82); }
            .profile-sync-dialog { width:min(920px,92vw); max-height:84vh; overflow:hidden; display:flex; flex-direction:column; background:#111725; border:1px solid rgba(255,255,255,.16); border-radius:8px; box-shadow:0 28px 80px rgba(0,0,0,.62); color:#fff; }
            .profile-sync-head { padding:28px 32px 18px; border-bottom:1px solid rgba(255,255,255,.09); }
            .profile-sync-kicker { color:#78b7ff; font-size:.76rem; font-weight:800; text-transform:uppercase; letter-spacing:.12em; }
            .profile-sync-title { margin:8px 0 6px; font-size:clamp(1.55rem,2.2vw,2.35rem); letter-spacing:0; }
            .profile-sync-copy { margin:0; color:rgba(255,255,255,.62); line-height:1.5; }
            .profile-sync-differences { padding:12px 32px; overflow-y:auto; display:grid; gap:8px; }
            .profile-sync-difference { display:grid; grid-template-columns:minmax(150px,.8fr) 1fr 1fr; gap:12px; align-items:center; padding:13px 14px; border:1px solid rgba(255,255,255,.08); background:rgba(255,255,255,.035); border-radius:6px; }
            .profile-sync-difference strong { font-size:.91rem; }
            .profile-sync-value { min-width:0; color:rgba(255,255,255,.68); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
            .profile-sync-value span { display:block; color:rgba(255,255,255,.35); font-size:.68rem; font-weight:700; text-transform:uppercase; margin-bottom:3px; }
            .profile-sync-actions { display:flex; justify-content:flex-end; gap:12px; padding:20px 32px 28px; }
            .profile-sync-btn { min-width:170px; min-height:52px; border-radius:6px; border:1px solid rgba(255,255,255,.22); background:rgba(255,255,255,.08); color:#fff; font:700 1rem inherit; cursor:pointer; outline:none; }
            .profile-sync-btn.primary { background:#eaf3ff; color:#08111e; }
            .profile-sync-btn:focus { border-color:#79b9ff; box-shadow:0 0 0 4px rgba(67,151,255,.32); transform:scale(1.025); }
            .profile-sync-btn.danger { color:#ffb8b8; border-color:rgba(255,105,105,.4); }
            .profile-sync-google { width:22px; height:22px; flex:none; }
            @media (max-width:760px) { .profile-sync-difference { grid-template-columns:1fr; } .profile-sync-actions { flex-direction:column; } .profile-sync-btn { width:100%; } }
        `;
        document.head.appendChild(style);
    }

    function close(restore = true) {
        if (!overlay) return;
        if (focusTrapHandler) document.removeEventListener('focusin', focusTrapHandler, true);
        focusTrapHandler = null;
        lastModalFocus = null;
        overlay.remove();
        overlay = null;
        activeConflictData = null;
        activeBackAction = null;
        lastAnalogScrollAt = 0;
        const target = returnFocus;
        returnFocus = null;
        if (restore && target?.isConnected) requestAnimationFrame(() => target.focus());
    }

    function bindDialog(dialog, buttons, onBack) {
        activeBackAction = onBack || null;
        const focusable = () => buttons.filter(button => button?.isConnected);
        lastModalFocus = buttons[0] || null;
        if (focusTrapHandler) document.removeEventListener('focusin', focusTrapHandler, true);
        focusTrapHandler = event => {
            if (!overlay) return;
            if (overlay.contains(event.target)) {
                if (event.target?.classList?.contains('profile-sync-btn')) lastModalFocus = event.target;
                return;
            }
            event.stopImmediatePropagation();
            const target = lastModalFocus?.isConnected ? lastModalFocus : getItems()[0];
            if (target) queueMicrotask(() => {
                if (overlay && !overlay.contains(document.activeElement))
                    target.focus({ preventScroll: true });
            });
        };
        document.addEventListener('focusin', focusTrapHandler, true);
        dialog.addEventListener('keydown', event => {
            const items = focusable();
            let index = Math.max(0, items.indexOf(document.activeElement));
            if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') index = (index - 1 + items.length) % items.length;
            else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') index = (index + 1) % items.length;
            else if (event.key === 'Escape' || event.key === 'Backspace') {
                event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
                onBack?.();
                return;
            } else return;
            event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
            lastModalFocus = items[index] || lastModalFocus;
            items[index]?.focus({ preventScroll: true });
        }, true);
        requestAnimationFrame(() => buttons[0]?.focus({ preventScroll: true }));
    }

    function getItems() {
        if (!overlay) return [];
        return Array.from(overlay.querySelectorAll('.profile-sync-btn'))
            .filter(button => button.isConnected && !button.disabled && button.offsetWidth > 0 && button.offsetHeight > 0);
    }

    function moveFocus(direction) {
        const items = getItems();
        if (!items.length) return false;
        let index = items.indexOf(document.activeElement);
        if (index < 0) {
            items[0].focus({ preventScroll: true });
            return true;
        }
        const delta = direction === 'LEFT' || direction === 'UP' ? -1 : 1;
        index = (index + delta + items.length) % items.length;
        items[index].focus({ preventScroll: true });
        return true;
    }

    function confirm() {
        const items = getItems();
        const active = items.includes(document.activeElement) ? document.activeElement : items[0];
        if (!active) return false;
        active.click();
        return true;
    }

    function back() {
        if (!overlay) return false;
        activeBackAction?.();
        return true;
    }

    function scrollDifferences(rightY) {
        const scroller = activeConflictData ? overlay?.querySelector('.profile-sync-differences') : null;
        const axis = Number(rightY || 0);
        if (!scroller || Math.abs(axis) < .18 || scroller.scrollHeight <= scroller.clientHeight) {
            lastAnalogScrollAt = 0;
            return false;
        }
        const now = performance.now();
        const elapsed = lastAnalogScrollAt ? Math.min(48, now - lastAnalogScrollAt) : 16;
        lastAnalogScrollAt = now;
        scroller.scrollTop += -axis * elapsed * 1.05;
        return true;
    }

    function updatePromptBlocksConflict() {
        return !!(
            window.isDoorpiUpdatePromptOpen?.() ||
            window.DoorpiUpdatePrompt?.hasPendingUpdate?.() ||
            document.querySelector('.doorpi-update-prompt.is-visible')
        );
    }

    function schedulePendingConflict(delay = 300) {
        clearTimeout(conflictRetryTimer);
        conflictRetryTimer = setTimeout(() => {
            conflictRetryTimer = 0;
            if (!pendingConflictData) return;
            const conflictProfileId = String(pendingConflictData.profileId || '').toLowerCase();
            const currentProfileId = String(window._doorpiCurrentUserId || '').toLowerCase();
            if (conflictProfileId && !currentProfileId) {
                schedulePendingConflict();
                return;
            }
            if (conflictProfileId && conflictProfileId !== currentProfileId) {
                pendingConflictData = null;
                return;
            }
            if (updatePromptBlocksConflict() || (overlay && !activeConflictData)) {
                schedulePendingConflict();
                return;
            }
            const data = pendingConflictData;
            pendingConflictData = null;
            renderConflict(data);
        }, delay);
    }

    function showConflict(data) {
        if (!Array.isArray(data?.differences) || data.differences.length === 0) {
            pendingConflictData = null;
            return;
        }
        pendingConflictData = data;
        schedulePendingConflict(updatePromptBlocksConflict() ? 300 : 180);
    }

    function deferConflictForUpdate() {
        if (activeConflictData) {
            pendingConflictData = activeConflictData;
            close(false);
        }
        if (pendingConflictData) schedulePendingConflict();
    }

    function resumePendingConflict() {
        if (pendingConflictData) schedulePendingConflict(180);
    }

    function renderConflict(data) {
        if (!Array.isArray(data?.differences) || data.differences.length === 0) return;
        ensureStyles();
        close(false);
        activeConflictData = data;
        activeProfileId = data.profileId || '';
        returnFocus = document.activeElement;
        overlay = document.createElement('div');
        overlay.className = 'profile-sync-overlay';
        const differences = Array.isArray(data.differences) ? data.differences : [];
        const rows = differences.map(item => `
            <div class="profile-sync-difference">
                <strong>${escapeHtml(labelDifference(item))}</strong>
                <div class="profile-sync-value"><span>${escapeHtml(tr('profileSyncThisDevice', 'Este dispositivo'))}</span>${escapeHtml(item.local || '—')}</div>
                <div class="profile-sync-value"><span>${escapeHtml(tr('profileSyncCloud', 'Nuvem'))}</span>${escapeHtml(item.cloud || '—')}</div>
            </div>`).join('');
        overlay.innerHTML = `
            <section class="profile-sync-dialog" role="dialog" aria-modal="true">
                <header class="profile-sync-head">
                    <div class="profile-sync-kicker">${escapeHtml(tr('profileSyncKicker', 'Sincronização'))}</div>
                    <h2 class="profile-sync-title">${escapeHtml(tr('profileSyncConflictTitle', 'Escolha qual versão manter'))}</h2>
                    <p class="profile-sync-copy">${escapeHtml(tr('profileSyncConflictCopy', 'Somente os dados diferentes estão listados abaixo.'))}</p>
                </header>
                <div class="profile-sync-differences">${rows}</div>
                <footer class="profile-sync-actions">
                    <button class="profile-sync-btn" data-choice="later">${escapeHtml(tr('profileSyncLater', 'Decidir depois'))}</button>
                    <button class="profile-sync-btn" data-choice="cloud">${escapeHtml(tr('profileSyncUseCloud', 'Usar nuvem'))}</button>
                    <button class="profile-sync-btn primary" data-choice="local">${escapeHtml(tr('profileSyncUseDevice', 'Usar este dispositivo'))}</button>
                </footer>
            </section>`;
        document.body.appendChild(overlay);
        const dialog = overlay.querySelector('.profile-sync-dialog');
        const buttons = Array.from(overlay.querySelectorAll('.profile-sync-btn'));
        const choose = choice => {
            postToHost({ action: 'profileSyncResolve', profileId: activeProfileId, choice });
            close();
        };
        buttons.forEach(button => button.addEventListener('click', () => choose(button.dataset.choice)));
        bindDialog(dialog, buttons, () => choose('later'));
    }

    function confirmDisconnect(profileId, callback) {
        ensureStyles();
        close(false);
        returnFocus = document.activeElement;
        overlay = document.createElement('div');
        overlay.className = 'profile-sync-overlay';
        overlay.innerHTML = `
            <section class="profile-sync-dialog" role="dialog" aria-modal="true">
                <header class="profile-sync-head">
                    <div class="profile-sync-kicker">${escapeHtml(tr('profileSyncKicker', 'Sincronização'))}</div>
                    <h2 class="profile-sync-title">${escapeHtml(tr('profileSyncDisconnectTitle', 'Desconectar conta Google?'))}</h2>
                    <p class="profile-sync-copy">${escapeHtml(tr('profileSyncDisconnectCopy', 'Os dados locais permanecem neste dispositivo.'))}</p>
                </header>
                <footer class="profile-sync-actions">
                    <button class="profile-sync-btn" data-delete="cancel">${escapeHtml(tr('btnCancel', 'Cancelar'))}</button>
                    <button class="profile-sync-btn" data-delete="false">${escapeHtml(tr('profileSyncDisconnectOnly', 'Somente desconectar'))}</button>
                    <button class="profile-sync-btn danger" data-delete="true">${escapeHtml(tr('profileSyncDeleteCloud', 'Desconectar e apagar da nuvem'))}</button>
                </footer>
            </section>`;
        document.body.appendChild(overlay);
        const dialog = overlay.querySelector('.profile-sync-dialog');
        const buttons = Array.from(overlay.querySelectorAll('.profile-sync-btn'));
        const choose = value => {
            if (value !== 'cancel') callback?.(value === 'true');
            close();
        };
        buttons.forEach(button => button.addEventListener('click', () => choose(button.dataset.delete)));
        bindDialog(dialog, buttons, () => choose('cancel'));
    }

    function labelDifference(item) {
        if (item.gameName) return item.gameName;
        const labels = {
            ProfileName: tr('profileSyncFieldName', 'Nome'),
            PinCode: tr('profileSyncFieldPin', 'PIN'),
            SteamGridApiKey: tr('profileSyncFieldApi', 'Chave SteamGridDB'),
            ProfilePhoto: tr('profileSyncFieldPhoto', 'Foto de perfil'),
            TotalPlaytime: tr('profileSyncFieldHours', 'Horas jogadas'),
            CreatedAt: tr('profileSyncFieldCreated', 'Data de criação')
        };
        return labels[item.kind] || tr('profileSyncFieldProfile', 'Dados do perfil');
    }

    function escapeHtml(value) {
        const div = document.createElement('div');
        div.textContent = String(value ?? '');
        return div.innerHTML;
    }

    window.DoorpiProfileSync = {
        googleIcon: `<svg class="profile-sync-google" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.41Z"/><path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.62-2.36l-3.24-2.54c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H3.06v2.62A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.41 13.94A6 6 0 0 1 6.1 12c0-.67.11-1.32.31-1.94V7.44H3.06A10 10 0 0 0 2 12c0 1.64.39 3.19 1.06 4.56l3.35-2.62Z"/><path fill="#EA4335" d="M12 5.94c1.47 0 2.79.51 3.83 1.5l2.87-2.88A9.64 9.64 0 0 0 12 2a10 10 0 0 0-8.94 5.44l3.35 2.62C7.2 7.7 9.4 5.94 12 5.94Z"/></svg>`,
        showConflict,
        deferConflictForUpdate,
        resumePendingConflict,
        confirmDisconnect,
        isOpen: () => !!overlay,
        getItems,
        moveFocus,
        confirm,
        back,
        scrollDifferences,
        close
    };

    if (window.chrome?.webview) {
        window.chrome.webview.addEventListener('message', event => {
            let data = event.data;
            try { if (typeof data === 'string') data = JSON.parse(data); } catch { return; }
            if (!data || typeof data !== 'object') return;
            if (data.type === 'profileSyncConflict') showConflict(data);
            if (data.type === 'profileSyncConflictClosed') {
                pendingConflictData = null;
                close();
            }
            if (String(data.type || '').startsWith('profileSync')) {
                window.dispatchEvent(new CustomEvent('doorpi:profile-sync-message', { detail: data }));
            }
        });
    }
})();
