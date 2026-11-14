// Profile/request races for the real selection controller; no installed app data.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(path.join(__dirname, '../Doorpi/Frontend/scripts/themes/020-theme-selection.js'), 'utf8');
const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, '../Doorpi/wwwroot/themes/catalog.json'))).themes;
const tick = () => new Promise(resolve => setImmediate(resolve));
async function until(check) { for (let i = 0; i < 100; i++) { if (check()) return; await tick(); } throw Error('Controller did not settle'); }
function fixture(initialProfile = 'bootstrap') {
    const sent = [], events = new EventTarget();
    let receive, pendingFetch, active = 'default';
    const window = {
        _doorpiCurrentUserId: initialProfile,
        chrome: { webview: { postMessage: text => sent.push(JSON.parse(text)), addEventListener: (_, fn) => receive = fn } },
        DoorpiThemes: { reset: () => { active = 'default'; }, apply: async manifest => { active = manifest.id; return { applied: true }; } },
        dispatchEvent: event => events.dispatchEvent(event)
    };
    const context = vm.createContext({ window, document: { baseURI: 'https://doorpi.local/index.html',addEventListener(){},documentElement:{removeAttribute(){},setAttribute(){}} }, URL, CustomEvent, setTimeout, clearTimeout,
        fetch: () => new Promise(resolve => pendingFetch = () => resolve({ ok: true, json: async () => ({ id: 'orbit', tokens:{} }) })) });
    vm.runInContext(source, context);
    if(initialProfile)sent.splice(0); // The first fixture profile is replaced before its response arrives.
    function reply(request, values = {}) {
        receive({ data: { type: 'themeSettingsState', requestId: request.requestId, profileId: request.profileId,
            ok: true, themeId: request.themeId || 'default', generation: '1', revision: '2', profileRevision: '1', themes: catalog, ...values } });
    }
    function profile(id) { window._doorpiCurrentUserId = id; receive({ data: { type: 'currentUserUpdated', currentUserId: id } }); }
    return { api: window.DoorpiThemeSelection, sent, profile, reply, resolveFetch: () => { const fn = pendingFetch; pendingFetch = null; fn(); },
        get fetching() { return !!pendingFetch; }, get active() { return active; } };
}
(async () => {
    let f = fixture();
    f.profile('alice'); f.reply(f.sent.shift()); await f.api.whenReady();
    assert.equal(f.api.getState().activeId, 'default');
    const pending = f.api.select('orbit'); await until(() => f.fetching);
    f.api.select('default'); assert.equal(f.active, 'default');
    f.resolveFetch(); await until(() => f.sent.length);
    assert.equal(f.sent[0].themeId, 'default', 'A late manifest must never override Restore Default');
    f.reply(f.sent.shift()); await pending;
    assert.equal(f.active, 'default');

    const applying = f.api.select('orbit'); await until(() => f.fetching); f.resolveFetch();
    await until(() => f.sent.length); const orbitSave = f.sent.shift();
    assert.equal(orbitSave.themeId, 'orbit');
    f.api.select('default'); assert.equal(f.active, 'default');
    f.reply(orbitSave, { revision: '3' }); await until(() => f.sent.length);
    assert.equal(f.sent[0].themeId, 'default');
    assert.equal(f.sent[0].revision, '3', 'Queued choice must use acknowledged revision');
    f.reply(f.sent.shift(), { revision: '4' }); await applying;
    assert.equal(f.api.getState().savedId, 'default');
    f.profile('alice'); await tick();
    assert.equal(f.sent.length, 0, 'Repeated user metadata must not reset/reload the theme');

    const staleFetch = f.api.select('orbit'); await until(() => f.fetching);
    f.profile('bob'); const bob = f.sent.shift(); f.reply(bob); await f.api.whenReady();
    f.resolveFetch(); await staleFetch;
    assert.equal(f.active, 'default'); assert.equal(f.sent.length, 0, 'Previous profile must not save after await');

    f.profile('alice'); const oldAlice = f.sent.shift();
    f.profile('bob'); const newBob = f.sent.shift();
    f.profile('alice'); const newAlice = f.sent.shift();
    f.reply(oldAlice, { themeId: 'orbit' }); f.reply(newBob, { themeId: 'orbit' });
    f.reply(newAlice); await f.api.whenReady();
    assert.equal(f.active, 'default', 'Profile ABA must ignore obsolete request generations');

    const conflict = f.api.select('orbit'); await until(() => f.fetching); f.resolveFetch(); await until(() => f.sent.length);
    f.reply(f.sent.shift(), { ok: false, errorCode: 'conflict', revision: '9' });
    await until(() => f.fetching); f.resolveFetch(); await until(() => f.sent.length);
    assert.equal(f.sent[0].revision, '9'); f.reply(f.sent.shift()); await conflict;
    assert.equal(f.active, 'orbit');

    f.profile('broken'); f.reply(f.sent.shift(), { ok: false, revision: null, profileRevision: null, error: 'Corrupt preference' });
    await f.api.whenReady(); await f.api.select('default');
    assert.equal(f.active, 'default'); assert.equal(f.sent.length, 0, 'Corruption cannot be overwritten as empty preferences');
    assert.match(f.api.getState().error, /sessão/);

    f = fixture(); f.profile('missing'); f.reply(f.sent.shift(), { themeId: 'uninstalled' }); await f.api.whenReady();
    assert.equal(f.active, 'default'); assert.match(f.api.getState().error, /não está disponível/);
    const restore = f.api.select('default'); await until(() => f.sent.length); f.reply(f.sent.shift()); await restore;
    assert.equal(f.api.getState().savedId, 'default');
    f=fixture('');
    f.reply(f.sent.shift(), {revision:null,profileRevision:null,deviceTheme:'orbit',themes:[{id:'orbit',name:'Login fixture',manifest:'themes/builtin/orbit.json',parts:['login']}]});
    await until(()=>f.fetching);
    await f.api.select('default','login');
    f.resolveFetch();await f.api.whenDeviceReady();
    assert.equal(f.api.getState().activeParts.login,'default','Late pre-login theme cannot undo device Default recovery');
    f=fixture();f.profile('reset');f.reply(f.sent.shift(),{deviceRevision:'8'});await f.api.whenReady();
    const oldSave=f.api.select('orbit');await until(()=>f.fetching);f.resolveFetch();await until(()=>f.sent.length);
    const saving=f.sent.shift();
    const resetting=f.api.resetAll();
    assert.ok(Object.values(f.api.getState().activeParts).every(id=>id==='default'),'Reset all restores every area immediately');
    f.reply(saving,{revision:'9',deviceRevision:'8'});await until(()=>f.sent.length);
    const resetRequest=f.sent.shift();
    assert.equal(resetRequest.action,'resetThemeSettings');assert.equal(resetRequest.revision,'9','Reset waits for the in-flight save revision');
    assert.equal(resetRequest.deviceRevision,'8');
    const defaultParts=Object.fromEntries(['home','nav-menu','side-panels','popups'].map(part=>[part,'default']));
    f.reply(resetRequest,{revision:'10',deviceRevision:'9',parts:defaultParts,deviceTheme:'default'});await resetting;await oldSave;
    assert.ok(Object.values(f.api.getState().savedParts).every(id=>id==='default'),'One bulk acknowledgement covers all profile areas and device login');
    assert.equal(f.sent.length,0,'Bulk reset does not issue five separate saves');
    const pendingReset=f.api.resetAll();await until(()=>f.sent.length);const staleReset=f.sent.shift();
    f.profile('another');f.reply(f.sent.shift());await f.api.whenReady();f.reply(staleReset,{parts:{home:'orbit'}});await pendingReset;
    assert.equal(f.api.getState().profileId,'another');assert.equal(f.api.getState().savedParts.home,'default','Stale bulk reset acknowledgement cannot affect a different profile');
    f=fixture();f.profile('system');f.reply(f.sent.shift());await f.api.whenReady();
    f.api.selectPart('system');
    const all=f.api.select('orbit');
    for(let i=0;i<4;i++){await until(()=>f.fetching);f.resolveFetch();}
    await until(()=>f.sent.length);const bulk=f.sent.shift();assert.equal(bulk.part,'system');
    const orbitParts=Object.fromEntries(Object.keys(defaultParts).map(part=>[part,'orbit']));
    f.reply(bulk,{parts:orbitParts,deviceTheme:'default'});await all;
    assert.equal(f.api.getState().activeId,'orbit');assert.equal(f.api.getState().activeParts.login,'default');
    assert.equal(f.sent.length,0,'System theme uses one atomic profile save');
    const override=f.api.select('default','popups');await until(()=>f.sent.length);
    f.reply(f.sent.shift(),{parts:{...orbitParts,popups:'default'}});await override;
    assert.equal(f.api.getState().activeId,'','Mixed system parts have no misleading active full theme');
    assert.equal(f.api.getState().activeParts.home,'orbit');
    console.log('PASS: selection races, recovery, atomic system theme, independent override and device isolation.');
})().catch(error => { console.error(error); process.exitCode = 1; });
