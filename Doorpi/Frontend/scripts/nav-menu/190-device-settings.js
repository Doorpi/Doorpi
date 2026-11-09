    function _renderSettingsDevicesHub(body) {
        const svgBluetooth = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2v20l6-6-6-4 6-4-6-6Z"/><path d="M6.5 6.5 12 12l-5.5 5.5"/></svg>`;
        const svgSound = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9H4Z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/><path d="M19 6a8.5 8.5 0 0 1 0 12"/></svg>`;
        const entries = [
            { id:'setBluetooth', icon:svgBluetooth, title:'Bluetooth', description:_t('bluetoothSettingsDesc', 'Parear e gerenciar controles, áudio, teclados e outros dispositivos') },
            { id:'setSound', icon:svgSound, title:_t('soundTitle', 'Som'), description:_t('soundSettingsDesc', 'Saída de áudio, volume do Windows e sons do Doorpi') }
        ];
        body.innerHTML = _settingsDirectoryMarkup('setBackConnectivity', _t('navSetDevices', 'Dispositivos'), entries);
        _wireSettingsDirectory(body, entries);

        _contentItems = [body.querySelector('#setBackConnectivity'), body.querySelector('#setBluetooth'), body.querySelector('#setSound')].filter(Boolean);
        _contentItems.forEach((el, idx) => el.addEventListener('mouseenter', () => {
            _topbarFocus = false; _contentIdx = idx; _updateContentFocus();
        }));
        body.querySelector('#setBackConnectivity')?.addEventListener('click', () => {
            if (_settingsReturnToRoot) {
                _settingsReturnToRoot = false;
                _settingsSubView = null;
                _systemSubView = null;
            } else {
                _settingsSubView = 'system';
                _systemSubView = null;
            }
            _contentIdx = 0;
            _renderContent('settings');
            _updateContentFocus();
        });
        body.querySelector('#setBluetooth')?.addEventListener('click', () => {
            _settingsSubView = 'bluetooth'; _contentIdx = 0; _renderContent('settings'); _updateContentFocus();
        });
        body.querySelector('#setSound')?.addEventListener('click', () => {
            _settingsSubView = 'sound'; _contentIdx = 0; _renderContent('settings'); _updateContentFocus();
        });
    }

    function _bluetoothFocusSelector() {
        const active = document.activeElement;
        if (active?.dataset?.btMenuId) return `[data-bt-menu-id="${CSS.escape(active.dataset.btMenuId)}"]`;
        if (active?.dataset?.deviceId) return `[data-device-id="${CSS.escape(active.dataset.deviceId)}"]`;
        if (active?.dataset?.btAction) return `[data-bt-action="${active.dataset.btAction}"]`;
        return '';
    }

    function _wireSettingsBluetooth(body, focusSelector = '') {
        const host = body.querySelector('#navBluetoothHost');
        window.DoorpiBluetoothUI?.bind?.(host, 'settings', nextFocus => {
            _refreshSettingsBluetooth(body, nextFocus);
        });
        _contentItems = [body.querySelector('#setBackBluetooth'), ...Array.from(host?.querySelectorAll('.bluetooth-focus') || [])].filter(Boolean);
        _contentItems.forEach((el, idx) => el.addEventListener('mouseenter', () => {
            _topbarFocus = false; _contentIdx = idx; _updateContentFocus();
        }));
        const target = focusSelector ? body.querySelector(focusSelector) : null;
        _contentIdx = target ? _contentItems.indexOf(target) : Math.max(0, Math.min(_contentIdx, _contentItems.length - 1));
        _updateContentFocus();
    }

    function _refreshSettingsBluetooth(body, focusSelector = '') {
        const host = body.querySelector('#navBluetoothHost');
        if (!host) return;
        host.innerHTML = window.DoorpiBluetoothUI?.render?.('settings') || '';
        _wireSettingsBluetooth(body, focusSelector);
    }

    function _scheduleSettingsBluetoothRefresh(focusSelector = '', immediate = false) {
        if (_bluetoothRenderTimer) {
            clearTimeout(_bluetoothRenderTimer);
            _bluetoothRenderTimer = 0;
        }
        const body = document.querySelector('.nav-content-body');
        if (!body) return;
        if (immediate) {
            _refreshSettingsBluetooth(body, focusSelector);
            return;
        }
        _bluetoothRenderTimer = setTimeout(() => {
            _bluetoothRenderTimer = 0;
            const currentBody = document.querySelector('.nav-content-body');
            if (currentBody && window.isNavMenuOpen && _settingsSubView === 'bluetooth')
                _refreshSettingsBluetooth(currentBody, focusSelector);
        }, 120);
    }

    function _renderSettingsBluetooth(body) {
        body.innerHTML = `
            <div class="nav-settings-subheader">
                <button class="nav-back-btn" id="setBackBluetooth" tabindex="-1">‹ ${_t('navBack', 'Voltar')}</button>
                <h2>Bluetooth</h2>
            </div>
            <div id="navBluetoothHost" style="max-width:920px;"></div>`;

        _refreshSettingsBluetooth(body);
        postToHost?.({ action: 'requestBluetoothStatus' });
        body.querySelector('#setBackBluetooth')?.addEventListener('click', () => {
            if (window.DoorpiBluetoothUI?.back?.('settings')) {
                _refreshSettingsBluetooth(body, '.bt-device-card');
                return;
            }
            if (_bluetoothUpdateStatus?.discovering) postToHost?.({ action: 'stopBluetoothDiscovery' });
            _settingsSubView = 'devicesHub'; _contentIdx = 0; _renderContent('settings'); _updateContentFocus();
        });
    }

    window._navMenuSetBluetoothStatus = function (status) {
        _bluetoothUpdateStatus = { ...(_bluetoothUpdateStatus || {}), ...(status || {}) };
        if (!window.isNavMenuOpen || _settingsSubView !== 'bluetooth') return;
        const op = _bluetoothUpdateStatus.operation || '';
        _scheduleSettingsBluetoothRefresh(
            _bluetoothFocusSelector(),
            op === 'pairing' || op === 'removing' || !!_bluetoothUpdateStatus.pairingPrompt);
    };

    function _wifiFocusSelector() {
        const active = document.activeElement;
        if (active?.dataset?.wifiNetworkId) return `[data-wifi-network-id="${CSS.escape(active.dataset.wifiNetworkId)}"]`;
        if (active?.dataset?.wifiAction) return `[data-wifi-action="${active.dataset.wifiAction}"]`;
        return '';
    }

    function _wireSettingsWifi(body, focusSelector = '') {
        const host = body.querySelector('#navWifiHost');
        window.DoorpiWifiUI?.bind?.(host, 'settings', nextFocus => _refreshSettingsWifi(body, nextFocus));
        _contentItems = [body.querySelector('#setBackWifi'), ...Array.from(host?.querySelectorAll('.wifi-focus') || [])].filter(Boolean);
        _contentItems.forEach((el, idx) => el.addEventListener('mouseenter', () => {
            _topbarFocus = false; _contentIdx = idx; _updateContentFocus();
        }));
        const target = focusSelector ? body.querySelector(focusSelector) : null;
        _contentIdx = target ? _contentItems.indexOf(target) : Math.max(0, Math.min(_contentIdx, _contentItems.length - 1));
        _updateContentFocus();
    }

    function _refreshSettingsWifi(body, focusSelector = '') {
        const host = body.querySelector('#navWifiHost');
        if (!host) return;
        host.innerHTML = window.DoorpiWifiUI?.render?.('settings') || '';
        _wireSettingsWifi(body, focusSelector);
    }

    function _renderSettingsWifi(body) {
        body.innerHTML = `
            <div class="nav-settings-subheader">
                <button class="nav-back-btn" id="setBackWifi" tabindex="-1">‹ ${_t('navBack', 'Voltar')}</button>
                <h2>Wi-Fi</h2>
            </div>
            <div id="navWifiHost" style="max-width:920px;"></div>`;
        _refreshSettingsWifi(body);
        postToHost?.({ action: 'requestWifiStatus' });
        body.querySelector('#setBackWifi')?.addEventListener('click', () => {
            if (window.DoorpiWifiUI?.back?.('settings')) {
                _refreshSettingsWifi(body, '.wifi-network-card');
                return;
            }
            _settingsSubView = 'devicesHub'; _contentIdx = 0; _renderContent('settings'); _updateContentFocus();
        });
    }

    window._navMenuSetWifiStatus = function (status) {
        _wifiUpdateStatus = { ...(_wifiUpdateStatus || {}), ...(status || {}) };
        if (!window.isNavMenuOpen || _settingsSubView !== 'wifi') return;
        const body = document.querySelector('.nav-content-body');
        if (body) _refreshSettingsWifi(body, _wifiFocusSelector());
    };

    function _soundFocusSelector() {
        const active = document.activeElement;
        if (active?.dataset?.soundAction) return `[data-sound-action="${CSS.escape(active.dataset.soundAction)}"]`;
        if (active?.dataset?.soundVolumeControl) return `[data-sound-volume-control="${CSS.escape(active.dataset.soundVolumeControl)}"]`;
        if (active?.dataset?.soundDeviceOption) return `[data-sound-device-option="${CSS.escape(active.dataset.soundDeviceOption)}"]`;
        if (active?.dataset?.soundItem) return `[data-sound-item="${CSS.escape(active.dataset.soundItem)}"]`;
        if (active?.dataset?.soundSlider) return `[data-sound-slider="${CSS.escape(active.dataset.soundSlider)}"]`;
        return '';
    }

    function _wireSettingsSound(body, focusSelector = '') {
        const host = body.querySelector('#navSoundHost');
        window.DoorpiSoundUI?.bind?.(host, 'settings', nextFocus => _refreshSettingsSound(body, nextFocus));
        _contentItems = [body.querySelector('#setBackSound'), ...Array.from(host?.querySelectorAll('.sound-focus') || [])].filter(Boolean);
        _contentItems.forEach((el, idx) => el.addEventListener('mouseenter', () => {
            _topbarFocus = false; _contentIdx = idx; _updateContentFocus();
        }));
        const target = focusSelector ? body.querySelector(focusSelector) : null;
        _contentIdx = target ? _contentItems.indexOf(target) : Math.max(0, Math.min(_contentIdx, _contentItems.length - 1));
        _updateContentFocus();
    }

    function _refreshSettingsSound(body, focusSelector = '') {
        const host = body.querySelector('#navSoundHost');
        if (!host) return;
        host.innerHTML = window.DoorpiSoundUI?.render?.('settings') || '';
        _wireSettingsSound(body, focusSelector);
    }

    function _renderSettingsSound(body) {
        body.innerHTML = `
            <div class="nav-settings-subheader">
                <button class="nav-back-btn" id="setBackSound" tabindex="-1">‹ ${_t('navBack', 'Voltar')}</button>
                <h2>${_t('soundTitle', 'Som')}</h2>
            </div>
            <div id="navSoundHost" style="width:100%;"></div>`;
        _refreshSettingsSound(body);
        postToHost?.({ action: 'requestSoundStatus' });
        body.querySelector('#setBackSound')?.addEventListener('click', () => {
            window.DoorpiSoundUI?.closeDrawer?.('settings');
            _settingsSubView = 'devicesHub'; _contentIdx = 0; _renderContent('settings'); _updateContentFocus();
        });
    }

    window._navMenuSetSoundStatus = function (status) {
        if (!window.isNavMenuOpen || _settingsSubView !== 'sound') return;
        const body = document.querySelector('.nav-content-body');
        if (body) _refreshSettingsSound(body, _soundFocusSelector());
    };

