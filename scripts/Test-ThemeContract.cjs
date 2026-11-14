// Run from any directory. --baseline <folder> also proves this extraction preserves default CSS bytes.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const contract = JSON.parse(fs.readFileSync(path.join(root, 'Doorpi/wwwroot/themes/contract.json')));
const metadata = JSON.parse(fs.readFileSync(path.join(root, 'Doorpi/Frontend/themes/contract.json')));
const withoutDefaults = JSON.parse(JSON.stringify(contract));
for (const token of Object.values(withoutDefaults.tokens)) delete token.default;
assert.deepEqual(withoutDefaults, metadata, 'Distributed contract metadata is stale');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'Doorpi/Frontend/styles/bundle.json')));
const cssRoot = path.join(root, 'Doorpi/Frontend/styles');
const definitions = fs.readFileSync(path.join(cssRoot, 'foundation/015-theme-tokens.css'), 'utf8');
const sources = manifest.sources.filter(source => !['theme-defaults', 'theme-layout'].includes(source.role)).map(source => fs.readFileSync(path.join(cssRoot, source.path), 'utf8')).join('');
for (const [name, token] of Object.entries(contract.tokens)) {
    assert.match(name, /^--doorpi-[a-z0-9-]+$/);
    assert.ok(definitions.includes(`${name}: ${token.default};`), `Default drift: ${name}`);
    assert.ok(sources.includes(`var(${name})`), `Unused public token: ${name}`);
    assert.ok(token.cssProperty && token.bindings.length);
    for (const binding of token.bindings) assert.ok(fs.readFileSync(path.join(cssRoot, binding.file), 'utf8').includes(`var(${name})`));
}
const baselineArgument = process.argv.indexOf('--baseline');
if (baselineArgument >= 0) {
    const baseline = path.resolve(root, process.argv[baselineArgument + 1]);
    const restored = sources.replace(/var\((--doorpi-[a-z0-9-]+)\)/g, (expression, name) => contract.tokens[name]?.default ?? expression);
    assert.equal(restored, fs.readFileSync(path.join(baseline, 'style.css'), 'utf8'), 'Default values, selectors, priorities or cascade changed');
    console.log('PASS: expanding theme defaults exactly reconstructs the CSS before extraction.');
}
const script = fs.readFileSync(path.join(root, 'Doorpi/Frontend/scripts/themes/010-theme-runtime.js'), 'utf8');
const aurora = JSON.parse(fs.readFileSync(path.join(root, 'Doorpi/wwwroot/themes/examples/aurora.json')));
const ember = JSON.parse(fs.readFileSync(path.join(root, 'Doorpi/wwwroot/themes/examples/ember.json')));
function createRuntime(fetcher = async () => ({ ok: true, json: async () => contract }), timers = { setTimeout, clearTimeout }) {
    const values = new Map(), priorities = new Map(), attributes = new Map(), homeValues = new Map();
    let failOnce = null;
    function styleFor(values,priorities){return {
        getPropertyValue: name => values.get(name) ?? '', getPropertyPriority: name => priorities.get(name) ?? '',
        setProperty(name, value, priority = '') {
            if (name === failOnce) { failOnce = null; throw Error('Simulated DOM failure'); }
            values.set(name, value); priorities.set(name, priority);
        },
        removeProperty(name) { values.delete(name); priorities.delete(name); }
    };}
    const style=styleFor(values,priorities),home={style:styleFor(homeValues,new Map())};
    const document = { baseURI: 'https://app.local/index.html', getElementById:id=>id==='doorpi-app-ui'?home:null, documentElement: {
        style, getAttribute: name => attributes.get(name) ?? null,
        setAttribute: (name, value) => attributes.set(name, value), removeAttribute: name => attributes.delete(name)
    } };
    const window = { dispatchEvent() {} };
    vm.runInNewContext(script, { window, document, fetch: fetcher, URL, AbortController, ...timers,
        CSS: { supports: () => true }, CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } } });
    return { api: window.DoorpiThemes, style, values, homeValues, attributes, failOn: name => failOnce = name };
}
(async () => {
    const runtime = createRuntime();
    runtime.style.setProperty('--doorpi-card-radius', '7px', 'important');
    await runtime.api.apply(aurora);
    assert.equal(runtime.api.activeId, 'aurora');
    assert.equal(runtime.attributes.get('data-doorpi-home-layout'), 'custom');
    assert.equal(runtime.attributes.get('data-doorpi-dialog-layout'), 'right');
    assert.equal(runtime.style.getPropertyValue('--doorpi-card-radius'), '22px');
    await runtime.api.apply(ember);
    assert.equal(runtime.attributes.has('data-doorpi-home-layout'), false, 'Theme switches remove previous region layouts');
    assert.equal(runtime.style.getPropertyValue('--doorpi-card-radius'), '2px');
    assert.equal(runtime.style.getPropertyValue('--doorpi-home-feature-gap'), '', 'Theme switches must remove old overrides');
    runtime.api.reset();
    assert.equal(runtime.style.getPropertyValue('--doorpi-card-radius'), '7px');
    assert.equal(runtime.style.getPropertyPriority('--doorpi-card-radius'), 'important');
    assert.equal(runtime.attributes.has('data-doorpi-theme'), false);
    await runtime.api.apply(aurora);
    for (const patch of [
        { apiVersion: 99 }, { script: 'run.js' }, { tokens: { display: 'none' } },
        { layout: { home: 'missing' } }, { layout: { arbitrary: 'remove-controls' } },
        { layout: { home: { areas: ['library','feature'], rows: 'auto auto', columns: '1fr' } } },
        { layout: { home: { areas: ['library','toolbar','feature','controls'], rows: 'auto;display:none', columns: '1fr' } } },
        { tokens: { '--doorpi-layout-scale': '0' } },
        { tokens: { '--doorpi-home-background': 'url(https://example.com/image)' } },
        { tokens: { '--doorpi-home-background': 'image-set("https://example.com/image" 1x)' } },
        { tokens: { '--doorpi-card-radius': '0;display:none' } },
        { tokens: { '--doorpi-card-radius': 'var(--doorpi-card-radius)' } },
        { tokens: { '--doorpi-card-radius': 'initial' } },
        { tokens: { '--doorpi-home-card-ratio': '1' } }
    ]) {
        const before = JSON.stringify([...runtime.values]);
        await assert.rejects(runtime.api.apply({ ...ember, ...patch }));
        assert.equal(runtime.api.activeId, 'aurora');
        assert.equal(JSON.stringify([...runtime.values]), before, 'Invalid themes must leave current appearance intact');
    }
    runtime.style.setProperty('--doorpi-card-radius', '11px');
    runtime.api.reset();
    assert.equal(runtime.style.getPropertyValue('--doorpi-card-radius'), '11px', 'Reset preserves a later app change');
    await runtime.api.apply(aurora);
    const oldValues = JSON.stringify([...runtime.values].sort());
    runtime.failOn('--doorpi-home-meta-color');
    await assert.rejects(runtime.api.apply(ember));
    assert.equal(runtime.api.activeId, 'aurora');
    assert.equal(JSON.stringify([...runtime.values].sort()), oldValues, 'Partial DOM failure rolls back the whole transaction');

    let release;
    const delayed = createRuntime(() => new Promise(resolve => release = () => resolve({ ok: true, json: async () => contract })));
    const oldRequest = delayed.api.apply(aurora);
    const latestRequest = delayed.api.apply(ember);
    release();
    assert.equal((await oldRequest).superseded, true);
    await latestRequest;
    assert.equal(delayed.api.activeId, 'ember');

    let releaseReset;
    const cancelled = createRuntime(() => new Promise(resolve => releaseReset = () => resolve({ ok: true, json: async () => contract })));
    const pending = cancelled.api.apply(aurora);
    cancelled.api.reset(); releaseReset();
    assert.equal((await pending).superseded, true);
    assert.equal(cancelled.values.size, 0, 'Reset cancels a pending theme');

    let releaseCopy;
    const copying = createRuntime(() => new Promise(resolve => releaseCopy = () => resolve({ ok: true, json: async () => contract })));
    const mutable = JSON.parse(JSON.stringify(aurora));
    const copied = copying.api.apply(mutable);
    mutable.tokens['--doorpi-card-radius'] = '999px';
    releaseCopy(); await copied;
    assert.equal(copying.style.getPropertyValue('--doorpi-card-radius'), '22px');
    const scoped=createRuntime();
    scoped.style.setProperty('--doorpi-card-radius','9px');
    await scoped.api.apply(aurora);
    scoped.failOn('--doorpi-home-meta-color');
    await assert.rejects(scoped.api.apply(ember,{scope:'home'}));
    assert.equal(scoped.api.activeId,'aurora');
    assert.equal(scoped.style.getPropertyValue('--doorpi-card-radius'),'22px','Failed scope transition restores global owner');
    assert.equal(scoped.homeValues.size,0,'Failed scope transition restores destination');
    await scoped.api.apply(ember,{scope:'home'});
    assert.equal(scoped.style.getPropertyValue('--doorpi-card-radius'),'9px','Home does not mutate document defaults');
    assert.equal(scoped.homeValues.get('--doorpi-card-radius'),'2px');
    assert.equal(scoped.homeValues.get('--card-radius'),'var(--doorpi-card-radius)');
    scoped.api.reset();assert.equal(scoped.homeValues.size,0);
    let attempts=0;
    const timeoutRuntime=createRuntime((url,options)=>{
        if(attempts++)return Promise.resolve({ok:true,json:async()=>contract});
        return new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(Error('Contract timeout')),{once:true}));
    },{setTimeout:callback=>setTimeout(callback,1),clearTimeout});
    await assert.rejects(timeoutRuntime.api.apply(aurora),/Contract timeout/);
    await timeoutRuntime.api.apply(aurora);
    assert.equal(timeoutRuntime.api.activeId,'aurora','A timed-out contract must be retryable');
    console.log(`PASS: ${Object.keys(contract.tokens).length} token defaults/bindings, theme switching/reset, validation, rollback, stale requests, caller isolation and contract timeout recovery.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
