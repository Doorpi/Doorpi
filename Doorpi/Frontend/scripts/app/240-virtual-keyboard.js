    // ══════════════════════════════════════════════════════════════════════════
    // Teclado Virtual
    // ══════════════════════════════════════════════════════════════════════════

    window._vkbIsOpen = false;
    window._doorpiShouldOpenVkbFromEvent = () =>
        window._doorpiIsControllerActivation?.() === true;

    const VKB = (() => {
        const ALPHA_ROWS = [
            ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', 'BKSP'],
            ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', '´', 'ENTER'],
            ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'ç', '~', 'CANCEL'],
            ['SHIFT', 'z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '^', '?'],
            ['SYM', 'CURSOR_LEFT', 'SPACE', 'CURSOR_RIGHT', '.com']
        ];
        const SPECIAL_ROWS = [
            ['!', '@', '#', '$', '%', '&', '*', '(', ')', '_', '+', 'BKSP'],
            ['/', '\\', '|', '=', '÷', '×', '{', '}', '[', ']', '`', 'ENTER'],
            [':', ';', '"', "'", '€', '£', '¥', '©', '®', '°', '¨', 'CANCEL'],
            ['SHIFT', '<', '>', '¿', '¡', '~', '´', '^', ',', '.', '?', '-'],
            ['ABC', 'CURSOR_LEFT', 'SPACE', 'CURSOR_RIGHT', '.com']
        ];
        const NUMERIC_ROWS = [
            ['1', '2', '3'],
            ['4', '5', '6'],
            ['7', '8', '9'],
            ['BKSP', '0', 'ENTER'],
            ['CANCEL']
        ];
        const ACCENT_KEYS = new Set(['´', '~', '^', '`', '¨']);
        const CONTROLLER_HINTS = {
            BKSP: 'X',
            ENTER: 'START',
            CANCEL: 'B',
            SHIFT: 'L3',
            SYM: 'LT',
            ABC: 'LT',
            SPACE: 'Y',
            CURSOR_LEFT: 'LB',
            CURSOR_RIGHT: 'RB'
        };
        const KEY_UNITS = {
            BKSP: 2,
            ENTER: 2,
            CANCEL: 2,
            SHIFT: 2,
            SYM: 2,
            ABC: 2,
            SPACE: 7,
            CURSOR_LEFT: 1,
            CURSOR_RIGHT: 1,
            '.com': 2
        };

        let _el = null;
        let _callbacks = {};
        let _returnFocusEl = null;
        let _shifted = false;
        let _inputEl = null;
        let _cursorPos = 0;
        let _mode = 'text';
        let _pendingAccent = null;

        function _rowsForMode() {
            if (_mode === 'numeric') return NUMERIC_ROWS;
            return _mode === 'special' ? SPECIAL_ROWS : ALPHA_ROWS;
        }

        function _labelForKey(key) {
            switch (key) {
                case 'BKSP': return t('vkbBackspace');
                case 'ENTER': return t('vkbEnter');
                case 'CANCEL': return t('vkbClose');
                case 'SHIFT': return t('vkbShift');
                case 'SYM': return t('vkbSym');
                case 'ABC': return t('vkbAbc');
                case 'SPACE': return t('vkbSpace');
                case 'CURSOR_LEFT': return '←';
                case 'CURSOR_RIGHT': return '→';
                default:
                    if (_mode === 'text' && key.length === 1 && /[a-zç]/i.test(key)) {
                        return _shifted ? key.toLocaleUpperCase() : key.toLocaleLowerCase();
                    }
                    return key;
            }
        }

        function _buttonHtml(key, row, col) {
            const label = _labelForKey(key);
            const hint = CONTROLLER_HINTS[key] || '';
            const isAction = !!hint || ['BKSP', 'ENTER', 'CANCEL', 'SHIFT', 'SYM', 'ABC', 'SPACE', 'CURSOR_LEFT', 'CURSOR_RIGHT'].includes(key);
            const classes = ['vkb-key'];
            if (isAction) classes.push('action');
            if (key === 'SPACE') classes.push('space-key');
            if (key === _pendingAccent) classes.push('accent-pending');
            if (key === 'SHIFT' && _shifted) classes.push('shifted');
            return `<button class="${classes.join(' ')}" data-key="${_esc(key)}" data-row="${row}" data-col="${col}" style="--vkb-unit:${KEY_UNITS[key] || 1}" tabindex="0">
                <span class="vkb-key-label">${_esc(label)}</span>
                ${hint ? `<span class="vkb-pad-icon ${hint === 'START' ? 'start' : ''}">${_esc(hint)}</span>` : ''}
            </button>`;
        }

        function _build() {
            if (_el) return;
            _el = document.createElement('div');
            _el.className = 'vkb-overlay';
            _el.innerHTML = `
                <div class="vkb-preview-wrap">
                    <span class="vkb-preview-label">${t('vkbPreviewLabel')}</span>
                    <div class="vkb-preview-text" id="vkbPreview"></div>
                </div>
                <div class="vkb-grid"></div>
            `;
            document.body.appendChild(_el);
        }

        function _wireKeys() {
            _el?.querySelectorAll('.vkb-key').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    _pressKey(btn.dataset.key);
                });
            });
        }

        function _renderKeys(mode, preferredFocusKey = '') {
            if (!_el) return;
            _mode = mode === 'numeric' ? 'numeric' : mode === 'special' ? 'special' : 'text';
            _el.classList.toggle('numeric', _mode === 'numeric');
            _el.classList.toggle('special', _mode === 'special');
            const grid = _el.querySelector('.vkb-grid');
            if (!grid) return;

            const rows = _rowsForMode();
            grid.innerHTML = rows.map((row, r) =>
                `<div class="vkb-row">${row.map((key, c) => _buttonHtml(key, r, c)).join('')}</div>`
            ).join('');
            _wireKeys();
            _setShiftVisual(_shifted, false);
            _syncAccentVisual();

            const focusKey = preferredFocusKey || (_mode === 'numeric' ? '1' : rows[0][0]);
            requestAnimationFrame(() => {
                _el?.querySelector(`[data-key="${CSS.escape(focusKey)}"]`)?.focus();
                _positionOverlay();
            });
        }

        function _syncCursorToInput() {
            if (!_inputEl) return;
            try { _inputEl.setSelectionRange(_cursorPos, _cursorPos); } catch (_) { }
        }

        function _dispatchInputChange() {
            if (!_inputEl) return;
            _inputEl.dispatchEvent(new Event('input', { bubbles: true }));
            _inputEl.dispatchEvent(new Event('change', { bubbles: true }));
        }

        function _insertText(text) {
            if (!_inputEl || text == null) return;
            const val = _inputEl.value || '';
            const maxLen = Number.parseInt(_inputEl.getAttribute('maxlength') || '', 10);
            if (Number.isFinite(maxLen) && maxLen > 0 && val.length + text.length > maxLen) return;
            _inputEl.value = val.substring(0, _cursorPos) + text + val.substring(_cursorPos);
            _cursorPos += text.length;
            _syncCursorToInput();
            _dispatchInputChange();
        }

        function _deleteText() {
            if (!_inputEl) return;
            if (_pendingAccent) {
                _pendingAccent = null;
                _syncAccentVisual();
                _renderPreview();
                return;
            }
            if (_cursorPos <= 0) return;
            const val = _inputEl.value || '';
            _inputEl.value = val.substring(0, _cursorPos - 1) + val.substring(_cursorPos);
            _cursorPos--;
            _syncCursorToInput();
            _dispatchInputChange();
        }

        function _getAccentedCharacter(accent, letter) {
            if (!letter || letter.length !== 1) return null;
            const upper = letter === letter.toLocaleUpperCase() && letter !== letter.toLocaleLowerCase();
            const base = letter.toLocaleLowerCase();
            const map = {
                '´': { a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú', c: 'ç' },
                '~': { a: 'ã', o: 'õ', n: 'ñ' },
                '^': { a: 'â', e: 'ê', i: 'î', o: 'ô', u: 'û' },
                '`': { a: 'à', e: 'è', i: 'ì', o: 'ò', u: 'ù' },
                '¨': { a: 'ä', e: 'ë', i: 'ï', o: 'ö', u: 'ü', y: 'ÿ' }
            };
            const result = map[accent]?.[base];
            return result ? (upper ? result.toLocaleUpperCase() : result) : null;
        }

        function _flushPendingAccent() {
            if (!_pendingAccent) return;
            const accent = _pendingAccent;
            _pendingAccent = null;
            _insertText(accent);
            _syncAccentVisual();
        }

        function _syncAccentVisual() {
            _el?.querySelectorAll('.vkb-key').forEach(btn => {
                btn.classList.toggle('accent-pending', !!_pendingAccent && btn.dataset.key === _pendingAccent);
            });
        }

        function _inputCharacter(raw) {
            if (!_inputEl || raw == null) return;
            let value = raw;
            if (_mode === 'numeric' && !/^\d$/.test(value)) return;
            if (_mode === 'text' && value.length === 1 && /[a-zç]/i.test(value)) {
                value = _shifted ? value.toLocaleUpperCase() : value.toLocaleLowerCase();
            }

            if (_pendingAccent) {
                const composed = value.length === 1 ? _getAccentedCharacter(_pendingAccent, value) : null;
                if (composed) _insertText(composed);
                else {
                    const accent = _pendingAccent;
                    _pendingAccent = null;
                    _insertText(accent);
                    _insertText(value);
                }
                _pendingAccent = null;
                _syncAccentVisual();
            } else {
                _insertText(value);
            }
        }

        function _pressKey(key) {
            if (!_inputEl || !key) return;
            if (_mode === 'numeric' && !/^\d$/.test(key) && !['BKSP', 'ENTER', 'CANCEL'].includes(key)) return;

            if (ACCENT_KEYS.has(key)) {
                if (_pendingAccent === key) {
                    _insertText(key);
                    _pendingAccent = null;
                } else {
                    _pendingAccent = key;
                }
                _syncAccentVisual();
                _renderPreview();
                return;
            }

            if (key === 'BKSP') _deleteText();
            else if (key === 'SHIFT') { _setShiftVisual(!_shifted); return; }
            else if (key === 'SYM') { _renderKeys('special', '!'); _renderPreview(); return; }
            else if (key === 'ABC') { _renderKeys('text', 'q'); _renderPreview(); return; }
            else if (key === 'CURSOR_LEFT') { _flushPendingAccent(); _moveCursor(-1); return; }
            else if (key === 'CURSOR_RIGHT') { _flushPendingAccent(); _moveCursor(1); return; }
            else if (key === 'SPACE') {
                if (_pendingAccent) _flushPendingAccent();
                else _insertText(' ');
            }
            else if (key === 'ENTER') { _submitEnter(); return; }
            else if (key === 'CANCEL') { _pendingAccent = null; _cancelWithCallback(); return; }
            else _inputCharacter(key);

            _renderPreview();
        }

        function _renderPreview() {
            const el = document.getElementById('vkbPreview');
            if (!el || !_inputEl) return;
            const val = _inputEl.value || '';
            const previewVal = _inputEl.type === 'password' ? '*'.repeat(val.length) : val;
            const formatHtml = (text) => _esc(text).replace(/ /g, '&nbsp;');
            const left = previewVal.substring(0, _cursorPos);
            const right = previewVal.substring(_cursorPos);
            const accent = _pendingAccent ? `<span class="vkb-pending-accent">${_esc(_pendingAccent)}</span>` : '';
            el.innerHTML = `${formatHtml(left)}<span class="vkb-cursor"></span>${formatHtml(right)}${accent}`;
        }

        function _moveCursor(dir) {
            if (!_inputEl) return;
            _flushPendingAccent();
            const newPos = _cursorPos + dir;
            if (newPos >= 0 && newPos <= (_inputEl.value || '').length) _cursorPos = newPos;
            _syncCursorToInput();
            _renderPreview();
        }

        function _setShiftVisual(on, rerender = true) {
            _shifted = !!on;
            _el?.querySelector('[data-key="SHIFT"]')?.classList.toggle('shifted', _shifted);
            _el?.querySelectorAll('.vkb-key').forEach(k => {
                const key = k.dataset.key;
                const label = k.querySelector('.vkb-key-label');
                if (label && key && _mode === 'text' && key.length === 1 && /[a-zç]/i.test(key)) {
                    label.textContent = _shifted ? key.toLocaleUpperCase() : key.toLocaleLowerCase();
                }
            });
            if (rerender) _renderPreview();
        }

        function _positionOverlay() {
            if (!_el || !_inputEl || _el.style.display === 'none') return;
            const anchor = _callbacks.anchorElement?.isConnected ? _callbacks.anchorElement : _inputEl;
            const rect = anchor.getBoundingClientRect();
            const margin = 14;
            const numeric = _mode === 'numeric';
            const width = numeric
                ? Math.min(360, Math.max(280, window.innerWidth - 32))
                : Math.min(window.innerWidth - 32, Math.max(620, Math.min(1080, window.innerWidth * 0.72)));
            _el.style.width = `${Math.round(width)}px`;
            const measured = _el.getBoundingClientRect();
            const height = measured.height || 300;
            const offsetX = Number(_callbacks.offsetX) || 0;
            const desiredCenter = _callbacks.align === 'start'
                ? rect.left + width / 2
                : _callbacks.align === 'end'
                    ? rect.right - width / 2
                    : rect.left + rect.width / 2;
            const center = Math.max(16 + width / 2, Math.min(window.innerWidth - 16 - width / 2, desiredCenter + offsetX));
            const above = rect.top - height - margin;
            const below = rect.bottom + margin + (Number(_callbacks.offsetY) || 0);
            const forceBelow = _callbacks.placement === 'below';
            const forceTop = _callbacks.placement === 'top';
            const top = forceTop
                ? 12
                : forceBelow
                    ? Math.min(Math.max(12, below), Math.max(12, window.innerHeight - height - 12))
                    : (above >= 12 ? above : Math.min(Math.max(12, below), Math.max(12, window.innerHeight - height - 12)));
            _el.style.left = `${Math.round(center)}px`;
            _el.style.top = `${Math.round(top)}px`;
        }

        function _open(targetInput, callbacks = {}) {
            if (_inputEl && _inputEl !== targetInput) _inputEl.classList.remove('vkb-active');
            _callbacks = callbacks || {};
            _returnFocusEl = targetInput?._doorpiVkbReturnFocus || targetInput || document.activeElement;
            _inputEl = targetInput || document.getElementById('editNameInput');
            if (!_inputEl) return;

            _pendingAccent = null;
            _build();
            _renderKeys(_callbacks.mode || (window._vkbIsNumericInput?.(_inputEl) ? 'numeric' : 'text'));
            _el.querySelector('.vkb-preview-label').textContent = t('vkbPreviewLabel');

            _cursorPos = _inputEl.selectionStart ?? (_inputEl.value || '').length;
            _cursorPos = Math.max(0, Math.min((_inputEl.value || '').length, _cursorPos));
            _inputEl.classList.add('vkb-active');
            if (typeof _editOverlay !== 'undefined' && _editOverlay) _editOverlay.classList.add('vkb-active');

            _el.style.display = 'block';
            _renderPreview();
            _syncCursorToInput();
            _positionOverlay();

            requestAnimationFrame(() => {
                _positionOverlay();
                _el.classList.add('visible');
                window._vkbIsOpen = true;
                _el.querySelector(`[data-key="${_mode === 'numeric' ? '1' : 'q'}"]`)?.focus();
            });
        }

        function _forceClose(options = {}) {
            if (!_el) return;
            const immediate = options?.immediate === true;
            const restoreFocus = options?.restoreFocus !== false && document.visibilityState !== 'hidden';
            const closedInput = _inputEl;
            _callbacks = {};
            _pendingAccent = null;
            window._vkbIsOpen = false;
            _el.classList.remove('visible');
            if (immediate) _el.style.display = 'none';

            if (_inputEl) { _inputEl.classList.remove('vkb-active'); _inputEl = null; }
            if (typeof _editOverlay !== 'undefined' && _editOverlay) _editOverlay.classList.remove('vkb-active');

            const returnTo = _returnFocusEl;
            _returnFocusEl = null;
            if (restoreFocus) {
                setTimeout(() => { returnTo?.focus?.(); window.updateNavHint?.(); }, 180);
            } else {
                window.resetDoorpiGamepadInputState?.();
            }
            document.dispatchEvent(new CustomEvent('doorpi-vkb-closed', { detail: { input: closedInput } }));
            if (!immediate)
                setTimeout(() => { if (_el && !_el.classList.contains('visible')) _el.style.display = 'none'; }, 180);
        }

        function _cancelWithCallback() {
            const fn = _callbacks.onCancel ?? window._editModalClose;
            _forceClose();
            fn?.();
        }

        function _submitEnter() {
            _flushPendingAccent();
            if (window._doorpiVkbConfirmOverride?.() === true) {
                _forceClose();
                return;
            }
            const fn = _callbacks.onEnter ?? _callbacks.onOk ?? window._editModalSave;
            if (fn) {
                _forceClose();
                fn();
                return;
            }
            if (!_inputEl) {
                _forceClose();
                return;
            }
            const down = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter', code: 'Enter' });
            _inputEl.dispatchEvent(down);
            _inputEl.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Enter', code: 'Enter' }));
            _forceClose();
        }

        function _physicalKey(key) {
            if (!_inputEl) return;
            if (key === 'Backspace') _pressKey('BKSP');
            else if (key === 'Enter') _pressKey('ENTER');
            else if (key === ' ') _pressKey('SPACE');
            else if (key?.length === 1) _inputCharacter(key);
            _renderPreview();
        }

        function _toggleLayer() {
            _pressKey(_mode === 'special' ? 'ABC' : 'SYM');
        }

        window.addEventListener('resize', () => {
            if (window._vkbIsOpen) _positionOverlay();
        });

        const _closeForPageTransition = () => {
            if (!window._vkbIsOpen) return;
            _forceClose({ restoreFocus: false });
        };
        window.addEventListener('pagehide', _closeForPageTransition);
        window.addEventListener('beforeunload', _closeForPageTransition);
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') _closeForPageTransition();
        });

        return {
            open: _open,
            forceClose: _forceClose,
            cancel: _forceClose,
            physicalKey: _physicalKey,
            confirm: () => _pressKey('ENTER'),
            toggleShift: () => _setShiftVisual(!_shifted),
            toggleLayer: _toggleLayer,
            moveCursor: _moveCursor
        };
    })();

    const _TEXT_INPUT_TYPES = new Set(['text', 'search', 'email', 'password', 'url', 'tel', '']);
    const _NUMERIC_INPUT_TYPES = new Set(['number']);
    window._vkbIsNumericInput = (el) => {
        if (!el || el.tagName !== 'INPUT') return false;
        const type = (el.type || '').toLowerCase();
        const inputMode = (el.getAttribute('inputmode') || '').toLowerCase();
        return _NUMERIC_INPUT_TYPES.has(type)
            || inputMode === 'numeric'
            || inputMode === 'decimal'
            || el.dataset?.vkbMode === 'numeric';
    };
    window._vkbOpen = (el, callbacks) => {
        const opts = { ...((callbacks || el?._doorpiVkbCallbacks) || {}) };
        const allowProgrammatic = opts.allowProgrammatic === true;
        delete opts.allowProgrammatic;
        if (!allowProgrammatic && window._doorpiIsControllerActivation?.() !== true) return false;
        if (el?.dataset?.vkbDisabled === 'true') return false;
        if (el && el.tagName === 'INPUT') {
            const type = (el.type || '').toLowerCase();
            if (!_TEXT_INPUT_TYPES.has(type) && !window._vkbIsNumericInput(el)) return false;
        }
        if (!opts.mode && window._vkbIsNumericInput(el)) opts.mode = 'numeric';
        VKB.open(el, opts);
        return true;
    };
    window._vkbCancel = () => VKB.cancel();
    window._vkbConfirm = () => VKB.confirm();
    window._vkbForceClose = (options) => VKB.forceClose(options);
    window._vkbPhysicalKey = (k) => VKB.physicalKey(k);
    window._vkbToggleShift = () => VKB.toggleShift();
    window._vkbToggleLayer = () => VKB.toggleLayer();
    window._vkbMoveCursor = (dir) => VKB.moveCursor(dir);
    window._vkbClearFocus = () => {
        const el = document.activeElement;
        if (el && el.classList.contains('vkb-key')) el.blur();
    };
    window._vkbHasFocus = () => {
        const el = document.activeElement;
        return el && el.classList.contains('vkb-key');
    };

    const _tryOpenNumericVkb = (target, event = null) => {
        if (event && !window._doorpiShouldOpenVkbFromEvent?.(event)) return;
        const input = target?.closest?.('input');
        if (!input || !window._vkbIsNumericInput?.(input)) return;
        if (input.closest?.('.vkb-overlay')) return;
        if (window._vkbIsOpen) return;
        input.removeAttribute('readonly');
        window._vkbOpen?.(input, { mode: 'numeric' });
    };
    document.addEventListener('click', (e) => _tryOpenNumericVkb(e.target, e), true);

