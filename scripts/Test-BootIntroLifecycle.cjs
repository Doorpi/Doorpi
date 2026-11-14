const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../Doorpi/wwwroot/intro-system.js'), 'utf8');

async function scenario({ managed, enabled, skip = false }) {
    const elements = new Map(), listeners = new Map();
    let frames = 0, flushed = 0;
    const classes = () => ({ add() {}, remove() {}, contains() { return false; } });
    const element = tag => ({
        tag, style: {}, classList: classes(), children: [], setAttribute() {},
        addEventListener() {}, remove() {}, appendChild(child) {
            this.children.push(child); if (child.id) elements.set(child.id, child);
            if (child.tag === 'iframe') frames++;
        }
    });
    elements.set('doorpi-app-ui', element('div'));
    const document = {
        body: element('body'), head: element('head'), documentElement: element('html'),
        getElementById: id => elements.get(id) || null, createElement: element,
        addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; }
    };
    const window = {
        __doorpiBootstrapManaged: managed, __doorpiSkipBootIntro: skip,
        __doorpiBootMode: 2, __doorpiConsoleShellExplorerReady: true,
        innerWidth: 1280, innerHeight: 720,
        addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(fn); },
        removeEventListener(type, fn) { listeners.get(type)?.delete(fn); },
        dispatchEvent(event) { for (const fn of [...(listeners.get(event.type) || [])]) fn(event); },
        setTimeout() { return 1; }, clearTimeout() {},
        chrome: { webview: { addEventListener() {}, postMessage() {} } }
    };
    const context = { window, document, console, performance, URL,
        CustomEvent: class { constructor(type) { this.type = type; } },
        Event: class { constructor(type) { this.type = type; } },
        requestAnimationFrame() { return 1; }, cancelAnimationFrame() {},
        setTimeout: window.setTimeout, clearTimeout() {},
        fetch: async url => ({ ok: true, json: async () => url.includes('active-intro.json')
            ? { enabled, manifest: 'doorpi-neon/manifest.json' }
            : { enabled, entry: 'index.html', fallbackTimeoutMs: 12000 } })
    };
    vm.runInNewContext(source, context);
    window.DoorpiIntro.runAfterIntro(() => flushed++);
    await new Promise(setImmediate);
    assert.equal(window.DoorpiIntro.isPrepared(), true);
    if (managed) {
        assert.equal(frames, 0, 'No iframe/timeline/audio before native prelude yields');
        assert.equal(flushed, 0, 'Destination stays queued during preparation');
        window.__doorpiPresentationReleased = true;
        window.dispatchEvent({ type: 'doorpi:boot-presentation-released' });
        await new Promise(setImmediate);
    }
    assert.equal(frames, enabled && !skip ? 1 : 0);
    if (!enabled || skip) {
        assert.equal(window.DoorpiIntro.isComplete(), true);
        assert.equal(flushed, 1, 'Disabled/recovery intro releases queued setup/profile callbacks');
    }
    window.dispatchEvent({ type: 'doorpi:boot-presentation-released' });
    await window.DoorpiIntro.start();
    assert.equal(frames, enabled && !skip ? 1 : 0, 'A repeated handoff cannot replay the intro');
}

(async () => {
    await scenario({ managed: true, enabled: true });
    await scenario({ managed: true, enabled: false });
    await scenario({ managed: true, enabled: true, skip: true });
    await scenario({ managed: false, enabled: true });
    console.log('PASS: intro waits for native release, starts once, preserves unmanaged startup, and releases disabled/recovery destinations.');
})().catch(error => { console.error(error); process.exitCode = 1; });
