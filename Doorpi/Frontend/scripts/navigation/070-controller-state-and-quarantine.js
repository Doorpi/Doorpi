let _controllerType = 'generic', _btnCooldown = {}, _lastMoveTime = 0, _moveState = 0, _currentDirection = null, _sessionConflictHeldDir = null, _gameFocusFallbackHeldDir = null;
let _cursorHoldState = { l1: 0, r1: 0 }, _cursorLastTime = { l1: 0, r1: 0 };
let _doorpiActionQuarantineUntil = 0;
let _doorpiActionReleaseGate = false;
let _doorpiActionReleaseGateStartedAt = 0;
let _doorpiControllerActivationToken = 0;
let _doorpiControllerActivationActive = false;
let _doorpiNativeController = {
    connected: false, buttons: 0, pendingPressed: 0, dpad: 0,
    leftX: 0, leftY: 0, rightX: 0, rightY: 0
};
let _controlsDirectionStartedAt = 0;
let _controlsDirectionLastMoveAt = 0;

function markDoorpiControllerActivation() {
    const token = ++_doorpiControllerActivationToken;
    _doorpiControllerActivationActive = true;
    queueMicrotask(() => {
        if (_doorpiControllerActivationToken === token)
            _doorpiControllerActivationActive = false;
    });
}

window._doorpiIsControllerActivation = () => _doorpiControllerActivationActive;

window._gpNavigating = false;
let _gpNavigatingTimeout = null;
window._doorpiGameInputSuppressedUntil = 0;
let _lastDoorpiInputBlockReason = '';
let _lastDoorpiInputBlockLogAt = 0;

function logDoorpiInputBlock(reason) {
    const now = performance.now();
    if (reason === _lastDoorpiInputBlockReason && now - _lastDoorpiInputBlockLogAt < 900) return;
    _lastDoorpiInputBlockReason = reason;
    _lastDoorpiInputBlockLogAt = now;
    console.debug(`[DoorpiInput] blocked: ${reason}`, {
        isGlobalLoading: !!window.isGlobalLoading,
        mediaActive: !!window.isMediaAppActive,
        gameLaunchActive: !!window.isGameLaunchActive,
        suppressedUntil: window._doorpiGameInputSuppressedUntil || 0,
        sessionTransition: window.isDoorpiSessionTransitionActive?.() === true,
        focused: document.hasFocus()
    });
}

function seedDoorpiHeldButtonState() {
    _btnCooldown = {};
    _doorpiNativeController.pendingPressed = 0;
}

window.resetDoorpiGamepadInputState = function () {
    seedDoorpiHeldButtonState();
    _moveState = 0;
    _currentDirection = null;
    _controlsDirectionStartedAt = 0;
    _controlsDirectionLastMoveAt = 0;
    _sessionConflictHeldDir = null;
    _gameFocusFallbackHeldDir = null;
    _cursorHoldState = { l1: 0, r1: 0, sq: 0 };
    _cursorLastTime = { l1: 0, r1: 0, sq: 0 };
    window._gpNavigating = false;
    if (_gpNavigatingTimeout) {
        clearTimeout(_gpNavigatingTimeout);
        _gpNavigatingTimeout = null;
    }
};

function isDoorpiActionQuarantineActive() {
    if (performance.now() < _doorpiActionQuarantineUntil) return true;
    _doorpiActionQuarantineUntil = 0;
    return false;
}

window.quarantineDoorpiGamepadActions = function (durationMs = 450) {
    const boundedDuration = Math.max(0, Math.min(1500, Number(durationMs) || 0));
    _doorpiActionQuarantineUntil = Math.max(
        _doorpiActionQuarantineUntil,
        performance.now() + boundedDuration
    );
    window.resetDoorpiGamepadInputState?.();
};

window.clearDoorpiInputQuarantine = function (options = {}) {
    _doorpiActionQuarantineUntil = 0;
    window._doorpiGameInputSuppressedUntil = 0;
    window._doorpiIntroInputBlockUntil = 0;
    if (options?.dropPending === true) {
        _doorpiActionReleaseGate = false;
        _doorpiActionReleaseGateStartedAt = 0;
        _doorpiNativeController.pendingPressed = 0;
        window.resetDoorpiGamepadInputState?.();
    } else if (options?.releaseGate === true) {
        window.armDoorpiGamepadReleaseGate?.();
    } else {
        _doorpiActionReleaseGate = false;
        _doorpiActionReleaseGateStartedAt = 0;
        window.resetDoorpiGamepadInputState?.();
    }
};

window.armDoorpiGamepadReleaseGate = function () {
    _doorpiActionReleaseGate = true;
    _doorpiActionReleaseGateStartedAt = performance.now();
    seedDoorpiHeldButtonState();
};

function isVkbOpenForNavigation() {
    if (!window._vkbIsOpen) return false;
    const overlay = document.querySelector('.vkb-overlay.visible');
    if (overlay && overlay.offsetWidth > 0 && overlay.offsetHeight > 0) return true;

    window._vkbIsOpen = false;
    window.resetDoorpiGamepadInputState?.();
    return false;
}

window.suspendDoorpiGameInput = function (durationMs = 15000) {
    window._doorpiGameInputSuppressedUntil = performance.now() + durationMs;
    window.isGameLaunchActive = true;
};

function isDoorpiGameInputSuppressed() {
    if (!window.isGameLaunchActive && !window._doorpiGameInputSuppressedUntil) return false;
    if (performance.now() < (window._doorpiGameInputSuppressedUntil || 0)) return true;
    window.isGameLaunchActive = false;
    window._doorpiGameInputSuppressedUntil = 0;
    return false;
}

