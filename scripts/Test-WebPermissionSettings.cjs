const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

class Element {
    constructor(tagName = 'div') { this.tagName = tagName; this.children = []; this.handlers = {}; }
    append(...children) { this.children.push(...children); }
    appendChild(child) { this.append(child); }
    replaceChildren(...children) { this.children = children; this._text = ''; }
    set textContent(text) { this._text = String(text); this.children = []; }
    get textContent() { return this._text; }
    addEventListener(type, handler) { this.handlers[type] = handler; }
    querySelectorAll(tag) { return this.children.flatMap(child => [...(child.tagName === tag ? [child] : []), ...child.querySelectorAll(tag)]); }
}
const elements = new Map([
    ['webPermissionBack', new Element('button')], ['webPermissionList', new Element()]
]);
const body = new Element();
body.querySelector = selector => elements.get(selector.slice(1));
const requests = [];
const window = { _doorpiCurrentUserId: 'alice', chrome: { webview: { addEventListener() {} } } };
const context = vm.createContext({
    window, document: { head: new Element(), getElementById: id => elements.get(id), createElement: tag => new Element(tag) },
    _settingsSubView: 'webPermissions', CATS: [{ id: 'settings' }], _catIdx: 0,
    _contentItems: [], _contentIdx: 0, _topbarFocus: false,
    _t: (_, fallback) => fallback, _esc: text => text,
    _updateContentFocus() {}, _renderContent() {}, __doorpiCss: () => '',
    postToHost: request => requests.push(request),
});
const source = fs.readFileSync(path.join(__dirname, '../Doorpi/Frontend/scripts/nav-menu/185-web-permissions.js'), 'utf8');
vm.runInContext(source + '\nglobalThis.ui = { render: _renderWebPermissions, receive: _receiveWebPermissions };', context);
const list = elements.get('webPermissionList');
context.ui.render(body);
assert.equal(requests.at(-1).action, 'requestWebPermissions');
const currentResponse = changes => ({ type: 'webPermissionsState', requestId: requests.at(-1).requestId, profileId: 'alice', ok: true, decisions: [], ...changes });
context.ui.receive({ data: currentResponse({ requestId: 'obsolete' }) });
assert.match(list.textContent, /Carregando/);
context.ui.receive({ data: currentResponse({ profileId: 'bob' }) });
assert.match(list.textContent, /Carregando/);

const decision = { id: 'entry-id', appName: '<img src=x onerror=attack()>', origin: 'https://calls.example', resource: 'camera', allowed: true };
context.ui.receive({ data: JSON.stringify(currentResponse({ decisions: [decision] })) });
assert.equal(list.children.length, 1);
assert.equal(list.children[0].children[0].children[0].textContent, decision.appName);
assert.equal(list.children[0].children[0].children[0].innerHTML, undefined, 'App names use text nodes');
assert.match(list.querySelectorAll('button')[0].textContent, /fechar/);
list.querySelectorAll('button')[0].handlers.click();
assert.equal(requests.at(-1).action, 'revokeWebPermission');
assert.equal(requests.at(-1).id, decision.id);
assert.match(list.textContent, /Carregando/);

context.ui.receive({ data: currentResponse({ decisions: [{ ...decision, allowed: false }] }) });
assert.equal(list.querySelectorAll('button')[0].textContent, 'Remover bloqueio');
context.ui.receive({ data: currentResponse({ ok: false, decisions: [decision] }) });
assert.equal(list.children.length, 0, 'Failure does not display stale grants');
assert.match(list.textContent, /Não foi possível/);
context.ui.receive({ data: currentResponse() });
assert.match(list.textContent, /Nenhuma decisão/);

const aliceRequest = requests.at(-1).requestId;
window._doorpiCurrentUserId = 'bob';
context.ui.receive({ data: { type: 'currentUserUpdated', currentUserId: 'bob' } });
assert.notEqual(requests.at(-1).requestId, aliceRequest);
context.ui.receive({ data: { ...currentResponse({ decisions: [decision] }), requestId: aliceRequest } });
assert.equal(list.children.length, 0, 'Old profile response cannot populate new profile');
context.ui.receive({ data: currentResponse({ profileId: 'bob' }) });
assert.match(list.textContent, /Nenhuma decisão/);
context.ui.receive({ data: 'invalid-json' });
elements.get('webPermissionBack').handlers.click();
assert.equal(context._settingsSubView, null);
console.log('PASS: permission settings request/revoke, text rendering, stale-response and profile isolation checks.');
