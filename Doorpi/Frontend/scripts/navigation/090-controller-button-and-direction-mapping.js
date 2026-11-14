function buttonJustPressed(btn, index) {
    if (btn && Object.prototype.hasOwnProperty.call(btn, 'justPressed')) {
        if (btn.justPressed && !btn._consumed) {
            btn._consumed = true;
            return true;
        }
        return false;
    }

    if (btn?.pressed) {
        if (!_btnCooldown[index]) {
            _btnCooldown[index] = true;
            return true;
        }
        return false;
    }
    _btnCooldown[index] = false; return false;
}

function primaryJustPressed(buttons, gamepad = NAV.GAMEPAD) {
    const confirmPressed = buttonJustPressed(buttons[gamepad.BTN_CONFIRM], gamepad.BTN_CONFIRM);
    const r2Pressed = buttonJustPressed(buttons[gamepad.BTN_R2], gamepad.BTN_R2);
    const pressed = confirmPressed || r2Pressed;
    if (pressed) {
        markDoorpiControllerActivation();
        window.DoorpiUiSound?.play('confirm');
    }
    return pressed;
}

function axisDirection(gamepad, threshold = NAV.GAMEPAD.AXIS_THRESHOLD) {
    const axes = Array.from(gamepad?.axes || []);
    let bestDir = null;
    let bestMag = 0;
    const pairs = [[0, 1], [2, 3], [4, 5]];

    for (const [xIndex, yIndex] of pairs) {
        const x = Number(axes[xIndex] || 0);
        const y = Number(axes[yIndex] || 0);
        const absX = Math.abs(x);
        const absY = Math.abs(y);
        const mag = Math.max(absX, absY);
        if (mag < threshold || mag <= bestMag) continue;

        bestMag = mag;
        bestDir = absX >= absY ? (x > 0 ? 'RIGHT' : 'LEFT') : (y > 0 ? 'DOWN' : 'UP');
    }

    const hatDirections = [
        'UP', 'UP_RIGHT', 'RIGHT', 'DOWN_RIGHT',
        'DOWN', 'DOWN_LEFT', 'LEFT', 'UP_LEFT'
    ];
    const hatValues = [-1, -5 / 7, -3 / 7, -1 / 7, 1 / 7, 3 / 7, 5 / 7, 1];

    for (const value of axes) {
        if (typeof value !== 'number') continue;
        if (Math.abs(value) < 0.08) continue;

        let bestHat = -1;
        let bestHatDistance = Number.POSITIVE_INFINITY;
        for (let i = 0; i < hatValues.length; i++) {
            const distance = Math.abs(value - hatValues[i]);
            if (distance < bestHatDistance) {
                bestHatDistance = distance;
                bestHat = i;
            }
        }

        if (bestHat < 0 || bestHatDistance > 0.08) continue;

        const mapped = hatDirections[bestHat];
        if (!mapped) continue;
        if (mapped.includes('UP')) return 'UP';
        if (mapped.includes('DOWN')) return 'DOWN';
        if (mapped.includes('LEFT')) return 'LEFT';
        if (mapped.includes('RIGHT')) return 'RIGHT';
    }

    return bestDir;
}

function gamepadDirection(gamepad, buttons, threshold = NAV.GAMEPAD.AXIS_THRESHOLD) {
    const { GAMEPAD } = NAV;
    if (buttons[GAMEPAD.BTN_RIGHT]?.pressed) return 'RIGHT';
    if (buttons[GAMEPAD.BTN_LEFT]?.pressed) return 'LEFT';
    if (buttons[GAMEPAD.BTN_DOWN]?.pressed) return 'DOWN';
    if (buttons[GAMEPAD.BTN_UP]?.pressed) return 'UP';
    return axisDirection(gamepad, threshold);
}

function nativeControllerDirection(threshold = NAV.GAMEPAD.AXIS_THRESHOLD) {
    const dpad = _doorpiNativeController.dpad >>> 0;
    if ((dpad & 0x0008) !== 0) return 'RIGHT';
    if ((dpad & 0x0004) !== 0) return 'LEFT';
    if ((dpad & 0x0002) !== 0) return 'DOWN';
    if ((dpad & 0x0001) !== 0) return 'UP';

    const x = Number(_doorpiNativeController.leftX || 0);
    const y = Number(_doorpiNativeController.leftY || 0);
    if (Math.abs(x) >= Math.abs(y) && Math.abs(x) > threshold)
        return x > 0 ? 'RIGHT' : 'LEFT';
    if (Math.abs(y) > threshold)
        return y > 0 ? 'UP' : 'DOWN';
    return null;
}

window.isDoorpiNativeDirectionHeld = direction =>
    nativeControllerDirection() === String(direction || '').toUpperCase();

function handleArtworkWizardGamepadShortcuts(buttons) {
    if (isVkbOpenForNavigation() || !window._artworkWizardIsOpen?.()) return false;

    if (buttonJustPressed(buttons[NAV.GAMEPAD.BTN_TRIANGLE], NAV.GAMEPAD.BTN_TRIANGLE)) {
        return window._artworkWizardShortcut?.('search') === true;
    }
    if (buttonJustPressed(buttons[NAV.GAMEPAD.BTN_SQUARE], NAV.GAMEPAD.BTN_SQUARE)) {
        return window._artworkWizardShortcut?.('skip') === true;
    }
    if (buttonJustPressed(buttons[NAV.GAMEPAD.BTN_CANCEL], NAV.GAMEPAD.BTN_CANCEL)) {
        return window._artworkWizardShortcut?.('cancel') === true;
    }
    return false;
}

