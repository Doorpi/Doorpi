window.addEventListener('load', () => {
    refreshGamepadPresence();
    setTimeout(() => window.focusFeaturedCard(), 600);
});

const CURSOR_IDLE_MS = 3000;
let _cursorIdleTimeout = null;
function showCursor() {
    document.body.style.cursor = '';
    if (_cursorIdleTimeout) clearTimeout(_cursorIdleTimeout);
    _cursorIdleTimeout = setTimeout(() => { document.body.style.cursor = 'none'; }, CURSOR_IDLE_MS);
}
document.body.style.cursor = 'none';
document.addEventListener('mousemove', showCursor);


