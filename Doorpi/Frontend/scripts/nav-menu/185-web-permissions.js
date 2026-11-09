    let _webPermissionRequest = '';
    let _webPermissionUser = '';

    function _renderWebPermissions(body) {
        if (!document.getElementById('doorpiWebPermissionStyles')) {
            const style = document.createElement('style');
            style.id = 'doorpiWebPermissionStyles';
            style.textContent = __doorpiCss("injected-styles/nav-menu/web-permissions.css");
            document.head.appendChild(style);
        }
        body.innerHTML = `<div class="nav-settings-subheader"><button class="nav-back-btn" id="webPermissionBack" tabindex="-1">‹ ${_esc(_t('navBack', 'Voltar'))}</button><h2>${_esc(_t('webPermissionsTitle', 'Permissões dos apps'))}</h2></div><p class="web-permission-description">${_esc(_t('webPermissionsDescription', 'Câmera e microfone autorizados ou bloqueados neste perfil. Streamings integrados, localização e notificações continuam bloqueados.'))}</p><div id="webPermissionList" aria-live="polite"></div>`;
        body.querySelector('#webPermissionBack').addEventListener('click', () => {
            _webPermissionRequest = '';
            _settingsSubView = null;
            _contentIdx = 0;
            _renderContent('settings');
            _updateContentFocus();
        });
        _requestWebPermissions('requestWebPermissions');
    }

    function _requestWebPermissions(action, id, userId = window._doorpiCurrentUserId || '') {
        _webPermissionUser = String(userId);
        _webPermissionRequest = `permissions-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const list = document.getElementById('webPermissionList');
        if (list) list.textContent = _t('webPermissionsLoading', 'Carregando permissões…');
        _contentItems = [document.getElementById('webPermissionBack')].filter(Boolean);
        _contentIdx = 0;
        _updateContentFocus();
        postToHost({ action, requestId: _webPermissionRequest, ...(id ? { id } : {}) });
    }

    function _receiveWebPermissions(event) {
        let data = event.data;
        try { if (typeof data === 'string') data = JSON.parse(data); } catch { return; }
        if (data?.type === 'currentUserUpdated' && _settingsSubView === 'webPermissions' && CATS[_catIdx]?.id === 'settings') {
            const nextUser = String(data.currentUserId || data.user?.Id || data.user?.id || '');
            if (nextUser !== _webPermissionUser) _requestWebPermissions('requestWebPermissions', undefined, nextUser);
            return;
        }
        if (data?.type !== 'webPermissionsState' || data.requestId !== _webPermissionRequest ||
            data.profileId !== _webPermissionUser ||
            _settingsSubView !== 'webPermissions' || CATS[_catIdx]?.id !== 'settings') return;
        const list = document.getElementById('webPermissionList');
        if (!list) return;
        list.replaceChildren();
        const decisions = data.ok && Array.isArray(data.decisions) ? data.decisions : [];
        if (!data.ok || decisions.length === 0) {
            list.textContent = data.ok
                ? _t('webPermissionsEmpty', 'Nenhuma decisão salva para este perfil.')
                : _t('webPermissionsError', 'Não foi possível ler ou salvar as permissões. Tente abrir esta tela novamente.');
        }
        for (const decision of decisions) {
            const row = document.createElement('article');
            row.className = 'web-permission-row';
            const detail = document.createElement('div');
            const name = document.createElement('h3');
            name.textContent = decision.appName;
            const site = document.createElement('p');
            site.textContent = decision.origin;
            const state = document.createElement('p');
            const resource = decision.resource === 'camera' ? _t('webPermissionCamera', 'Câmera') : _t('webPermissionMicrophone', 'Microfone');
            state.textContent = `${resource} · ${decision.allowed ? _t('webPermissionAllowed', 'Permitido') : _t('webPermissionBlocked', 'Bloqueado')}`;
            detail.append(name, site, state);
            const revoke = document.createElement('button');
            revoke.className = 'nav-back-btn web-permission-revoke';
            revoke.tabIndex = -1;
            revoke.textContent = decision.allowed
                ? _t('webPermissionRevoke', 'Revogar e fechar app aberto')
                : _t('webPermissionRemoveBlock', 'Remover bloqueio');
            revoke.addEventListener('click', () => _requestWebPermissions('revokeWebPermission', decision.id));
            row.append(detail, revoke);
            list.appendChild(row);
        }
        _contentItems = [document.getElementById('webPermissionBack'), ...list.querySelectorAll('button')].filter(Boolean);
        _contentIdx = 0;
        _contentItems.forEach((button, index) => { button.onmouseenter = () => {
            _topbarFocus = false; _contentIdx = index; _updateContentFocus();
        }; });
        _updateContentFocus();
    }

    window.chrome?.webview?.addEventListener('message', _receiveWebPermissions);

