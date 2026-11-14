function refreshGamepadPresence() {
    isGamepadConnected = !!_doorpiNativeController.connected;
    _controllerType = 'xbox';
    updateGamepadUI(isGamepadConnected, _controllerType);
}
window.refreshDoorpiGamepadHints = refreshGamepadPresence;

function readAllGamepadInput() {
    if (!_doorpiNativeController.connected) return null;

    const held = _doorpiNativeController.buttons >>> 0;
    let pressedThisFrame = _doorpiNativeController.pendingPressed >>> 0;
    _doorpiNativeController.pendingPressed = 0;
    if (_doorpiActionReleaseGate) {
        pressedThisFrame = 0;
        const releaseGateTimedOut = performance.now() - _doorpiActionReleaseGateStartedAt > 900;
        if ((held & 0xFFF0) === 0 || releaseGateTimedOut) {
            _doorpiActionReleaseGate = false;
            _doorpiActionReleaseGateStartedAt = 0;
        }
    }

    const buttons = Array.from({ length: 17 }, () => ({ pressed: false, justPressed: false }));
    const mapping = [
        [0, 0x1000], // A / gatilho direito
        [1, 0x2000], // B
        [2, 0x4000], // X
        [3, 0x8000], // Y
        [4, 0x0100], // L1
        [5, 0x0200], // R1
        [6, 0x0800], // L2
        [8, 0x0020], // View
        [9, 0x0010], // Menu
        [10, 0x0040], // L3
        [11, 0x0080], // R3
        [16, 0x0400] // Guide
    ];

    for (const [index, mask] of mapping) {
        buttons[index] = {
            pressed: (held & mask) !== 0,
            justPressed: (pressedThisFrame & mask) !== 0
        };
    }

    const dpad = _doorpiNativeController.dpad >>> 0;
    buttons[NAV.GAMEPAD.BTN_UP] = { pressed: (dpad & 0x0001) !== 0, justPressed: false };
    buttons[NAV.GAMEPAD.BTN_DOWN] = { pressed: (dpad & 0x0002) !== 0, justPressed: false };
    buttons[NAV.GAMEPAD.BTN_LEFT] = { pressed: (dpad & 0x0004) !== 0, justPressed: false };
    buttons[NAV.GAMEPAD.BTN_RIGHT] = { pressed: (dpad & 0x0008) !== 0, justPressed: false };

    const controlsOpen = window.DoorpiControls?.isOpen?.() === true;

    return {
        id: 'Doorpi XInput',
        index: -1,
        buttons,
        // O editor usa o XInput diretamente; as demais telas continuam usando o
        // loop direcional nativo para preservar o comportamento já existente.
        axes: controlsOpen
            ? [_doorpiNativeController.leftX, -_doorpiNativeController.leftY, 0, 0]
            : [0, 0, 0, 0],
        connectedGamepads: []
    };
}

if (window.chrome?.webview) {
    window.chrome.webview.addEventListener('message', event => {
        let data = event.data;
        if (typeof data === 'string') {
            try { data = JSON.parse(data); } catch { return; }
        }
        if (!data || data.type !== 'nativeControllerSnapshot') return;

        const wasConnected = _doorpiNativeController.connected;
        _doorpiNativeController.connected = !!data.connected;
        _doorpiNativeController.buttons = Number(data.buttons || 0) >>> 0;
        _doorpiNativeController.dpad = Number(data.dpad || 0) >>> 0;
        // Durante "Aguardando a janela", a sessÃ£o ainda Ã© marcada como mÃ­dia
        // ativa, mas o Doorpi estÃ¡ na frente e precisa receber o A de Retornar.
        // Antes disso o bridge descartava esse pressionamento e sÃ³ o mouse
        // conseguia acionar o botÃ£o.
        const launchOverlay = document.getElementById('gameLaunchOverlay');
        const isWaitingLaunch = !!(launchOverlay &&
            launchOverlay.classList.contains('visible') &&
            launchOverlay.classList.contains('state-loading'));
        const isExecutionLock = !!(launchOverlay &&
            launchOverlay.classList.contains('visible') &&
            launchOverlay.classList.contains('execution-lock-visible'));
        const isControlEditor = window.DoorpiControls?.isOpen?.() === true;
        if (document.hasFocus() && window.isDoorpiFocused &&
            (!window.isMediaAppActive || isWaitingLaunch || isExecutionLock || isControlEditor))
            _doorpiNativeController.pendingPressed |= Number(data.pressed || 0) >>> 0;
        else
            _doorpiNativeController.pendingPressed = 0;
        _doorpiNativeController.rightX = Number(data.rightX || 0);
        _doorpiNativeController.rightY = Number(data.rightY || 0);
        _doorpiNativeController.leftX = Number(data.leftX || 0);
        _doorpiNativeController.leftY = Number(data.leftY || 0);
        if (window._profilePhotoPickerIsOpen?.())
            window._profilePhotoPickerAdjustZoom?.(_doorpiNativeController.rightY);
        if (window.DoorpiProfileSync?.isOpen?.())
            window.DoorpiProfileSync.scrollDifferences?.(_doorpiNativeController.rightY);
        if (!_doorpiNativeController.connected) {
            _doorpiNativeController.buttons = 0;
            _doorpiNativeController.pendingPressed = 0;
            _doorpiNativeController.dpad = 0;
            _doorpiNativeController.leftX = 0;
            _doorpiNativeController.leftY = 0;
            _doorpiNativeController.rightX = 0;
            _doorpiNativeController.rightY = 0;
        }
        window.releaseHomeTrailerCinemaControllerKeys?.(nativeControllerDirection());
        if (wasConnected !== _doorpiNativeController.connected)
            refreshGamepadPresence();
    });
}

window.addEventListener('gamepadconnected', e => {
    refreshGamepadPresence();
});
window.addEventListener('gamepaddisconnected', e => {
    refreshGamepadPresence();
});


window.isDoorpiFocused = document.hasFocus();


window.addEventListener('focus', () => {
    window.isDoorpiFocused = true;
    window.clearDoorpiInputQuarantine?.({ dropPending: true });
});
window.addEventListener('blur', () => { window.isDoorpiFocused = false; });
