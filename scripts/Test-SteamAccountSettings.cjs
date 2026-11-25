const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
class Element {
    constructor() { this.value = ''; this.children = []; this.handlers = {}; this.dataset = {}; this.hidden = true; }
    addEventListener(name, callback) { this.handlers[name] = callback; }
    append(...items) { this.children.push(...items); }
    replaceChildren() { this.children = []; }
    setAttribute(name, value) { this[name] = value; }
    removeAttribute(name) { delete this[name]; }
}
const ids = new Map(['navSteamAccount', 'navSteamStatus', 'navSteamTotals', 'navSteamData', 'navSteamView', 'navSteamManualKey', 'navSteamSaveManualKey', 'navSteamControls', 'navSteamManual'].map(id => [id, new Element()]));
const actions = ['getKey', 'pasteKey', 'pasteAccount', 'import', 'disconnect'].map(action => Object.assign(new Element(), { dataset: { steamAction: action } }));
const requests = [];
const context = vm.createContext({
    window: {}, document: { createElement: () => new Element() },
    body: { querySelector: selector => ids.get(selector.slice(1)), querySelectorAll: () => actions },
    _t:key=>key,_steamConnectPayload:()=>({action:'steamConnect'}),
    _menuData: { user: { Id: 'alice' } }, refreshSyncUi() {}, postToHost: request => requests.push(request),
});
const source = fs.readFileSync(path.join(__dirname, '../Doorpi/Frontend/scripts/nav-menu/210-account-settings.js'), 'utf8');
const start = source.indexOf('        const steamAccount =');
const end = source.indexOf("        postToHost?.({ action: 'steamProfileStatus' });", start);
assert.ok(start > 0 && end > start);
vm.runInContext(source.slice(start, end) + "postToHost?.({ action: 'steamProfileStatus' });", context);
const receive = data => context.window._refreshSteamAccountUi(data);
receive({profileId:'alice',manualKeyRequired:true,busy:false});
assert.equal(ids.get('navSteamControls').hidden,false);
ids.get('navSteamManualKey').value='0123456789abcdef0123456789abcdef';
ids.get('navSteamSaveManualKey').handlers.click();
assert.equal(requests.at(-1).action,'steamSaveManualKey');
assert.equal(ids.get('navSteamManualKey').value,'');
const button = action => actions.find(item => item.dataset.steamAction === action);
assert.equal(requests[0].action, 'steamProfileStatus');
assert.equal(button('import').disabled, true);
button('getKey').handlers.click();
assert.equal(requests.at(-1).action, 'steamConnect');
button('pasteKey').handlers.click();
assert.equal(requests.at(-1).action, 'steamPasteKey');
assert.equal(requests.at(-1).apiKey, undefined, 'Raw keys never pass through this UI');
receive({ profileId: 'bob', hasKey: true, steamId: 'wrong-account' });
assert.equal(ids.get('navSteamAccount').value, '', 'Another profile response was displayed');
receive({ profileId: 'alice', hasKey: true, busy: false, steamId: '76561198000000000', displayName: '<img onerror=attack()>', gameCount: 1, achievementCount: 1, games: [{ Name: '<script>attack()</script>', PlaytimeMinutes: 7200, unlocked: 1, total: 2, achievements: ['<img onerror=attack()>'] }] });
assert.equal(button('import').disabled, false);
assert.equal(ids.get('navSteamData').children[1].children[0].textContent, '<script>attack()</script>');
assert.equal(ids.get('navSteamData').children[1].children[0].innerHTML, undefined);
button('import').handlers.click();
assert.equal(requests.at(-1).action, 'steamImport');
assert.equal(requests.at(-1).account, '76561198000000000');
assert.equal(button('pasteKey').disabled, true, 'Busy import allows replacing credentials');
receive({ profileId: 'alice', hasKey: true, account: 'new-profile', busy: false });
assert.equal(ids.get('navSteamAccount').value, 'new-profile', 'Pasted profile did not replace the old field');
const oldStatus = ids.get('navSteamStatus');
ids.set('navSteamAccount', new Element());
receive({ profileId: 'alice', message: 'late-response' });
assert.notEqual(oldStatus.textContent, 'late-response', 'Detached account view accepted a stale response');
console.log('PASS: Steam settings actions, official key URL, profile isolation, busy state, safe text rendering and detached-view responses.');
