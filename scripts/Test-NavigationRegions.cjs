const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const handlers = new Map(), flags = new Set();
const grids = new Map();
const document = { activeElement: null, readyState: 'loading',
    body: { classList: { contains: value => flags.has(value) } },
    addEventListener(type, handler) { if (!handlers.has(type)) handlers.set(type, []); handlers.get(type).push(handler); },
    getElementById: id => grids.get(id) || null,
    querySelectorAll: () => [] };
function card(id, classes = 'card', hidden = false) {
    const names = new Set(classes.split(' '));
    const item = { id, dataset: { id }, offsetWidth: hidden ? 0 : 100, offsetHeight: hidden ? 0 : 150,
        classList: { contains: name => names.has(name) }, getAttribute: () => null,
        scrollIntoView() {}, _startInteraction() {}, closest: () => item,
        focus() { document.activeElement = item; for (const handler of handlers.get('focusin') || []) handler({target:item}); } };
    return item;
}
function grid(id, cards) {
    const result = { cards, querySelectorAll: () => result.cards, contains: item => result.cards.includes(item) };
    grids.set(id,result); return result;
}
const first=card('first','card featured'),second=card('second'),add=card('btnAdd','card add-card');
const games=grid('gameGrid',[add,first,second]);
const mediaFirst=card('media-first'),mediaSecond=card('media-second');
grid('mediaGrid',[mediaFirst,mediaSecond]);grid('storesGrid',[card('store-first','store-card')]);
let channel='games',vkb=false;
const window={_doorpiCurrentUserId:'profile-a',getCurrentHomeTab:()=>channel,isDoorpiOverlayOpen:()=>false};
const context={window,document,isModalOpen:false,isEditModalOpen:false,isSetupOpen:false,isCtxMenuOpen:false,isVkbOpenForNavigation:()=>vkb};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root,'Doorpi/Frontend/scripts/navigation/015-region-contract.js'),'utf8'),context);
const api=window.DoorpiNavigation;
assert.equal(api.getScreen('home').entryRegion,0);
assert.equal(api.getScreen('home').regions[0].key,'carousel');
assert.ok(Object.isFrozen(api.getScreen('home').regions));
assert.equal(api.enter('home'),true);assert.equal(document.activeElement,first,'Entry chooses the carousel, not DOM order or the first add button');
second.focus();assert.equal(api.enter('home'),true);assert.equal(document.activeElement,second,'Return restores the selected card');
window._doorpiCurrentUserId='profile-b';api.enter('home');assert.equal(document.activeElement,first,'Another profile has its own focus memory');
window._doorpiCurrentUserId='profile-a';api.enter('home');assert.equal(document.activeElement,second);
window._userSwitching=true;first.focus();window._userSwitching=false;api.enter('home');assert.equal(document.activeElement,second,'Transitional DOM cannot replace profile focus memory');
channel='media';api.enter('home');assert.equal(document.activeElement,mediaFirst);mediaSecond.focus();channel='games';api.enter('home');assert.equal(document.activeElement,second);
channel='media';api.enter('home');assert.equal(document.activeElement,mediaSecond,'Tabs have separate carousel memory');
channel='games';games.cards=[add,first];api.enter('home');assert.equal(document.activeElement,first,'Removed cards fall back to an available card');
games.cards=[add,card('skeleton','card loading-card'),card('hidden','card',true)];api.enter('home');assert.equal(document.activeElement,add,'Empty libraries retain a usable region 0');
assert.equal(api.getRegionId(add),0);
games.cards=[add,first,second];api.enter('home');assert.equal(document.activeElement,first,'The empty-state Add target cannot displace games when the library arrives');
add.focus();api.enter('home');assert.equal(document.activeElement,add,'An explicit Add selection in a populated library is preserved');
for (const flag of ['isModalOpen','isEditModalOpen','isSetupOpen','isCtxMenuOpen']) {
    context[flag]=true;document.activeElement=null;assert.equal(api.enter('home'),false);assert.equal(document.activeElement,null);context[flag]=false;
}
for(const flag of ['isNavMenuOpen','isGlobalLoading']){window[flag]=true;assert.equal(api.enter('home'),false);window[flag]=false;}
vkb=true;assert.equal(api.enter('home'),false);vkb=false;flags.add('user-picker-open');assert.equal(api.enter('home'),false);flags.clear();
assert.equal(api.enter('unknown'),false);

// Grid initialization must not silently replace the owner of the focus policy.
const adapter=()=>api.enter('home');window.focusFeaturedCard=adapter;
window.AppStore={subscribe(){},queries:{getItems:()=>[]}};
vm.runInContext(fs.readFileSync(path.join(root,'Doorpi/Frontend/scripts/grid-controller/010-implementation.js'),'utf8').replace(/__doorpiCss\("[^"]+"\)/g,'``'),context);
for(const handler of handlers.get('DOMContentLoaded') || [])handler();
assert.equal(window.focusFeaturedCard,adapter,'GridController preserves the navigation contract');
console.log('PASS: carousel entry region 0, selected-card restoration, profile/tab isolation, removed/empty/hidden items, overlay priority and one focus-policy owner.');
