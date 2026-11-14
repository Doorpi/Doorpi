// Exercises the real navigation functions with alternate region geometry; no host/session APIs.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const sourceRoot = path.resolve(__dirname, '../Doorpi/Frontend/scripts/navigation');
function scenario({ home = null, dialog = null, modal = false, withProfile = false } = {}) {
    let menuOpened = 0;
    const attributes = { 'data-doorpi-home-layout': home, 'data-doorpi-dialog-layout': dialog };
    const document = { activeElement: null, documentElement: { getAttribute: key => attributes[key] ?? null },
        querySelector: selector => selector === '.home-tab.active' ? tab : null, getElementById: id => withProfile && id==='btnTopProfile' ? profile : null };
    const grid = { contains: el => cards.includes(el) };
    function item(className, x, y, gridItem = false) {
        const classes = new Set(className.split(' '));
        return { id: '', tagName: 'BUTTON', classList: { contains: name => classes.has(name) },
            getBoundingClientRect: () => ({ x, y, left: x, top: y, right: x + 100, bottom: y + 45, width: 100, height: 45 }),
            closest: selector => selector === '#addGameContainer' ? modal ? {} : null : gridItem && selector.includes('#gameGrid') ? grid : null,
            getAttribute: () => null, matches: () => false, scrollIntoView() {},
            focus() { document.activeElement = this; } };
    }
    const carouselAbove = home === 'library-first' || home === 'custom';
    const tab = item('home-tab', 100, carouselAbove ? 300 : 100);
    const cards = [item('card app-item',100,carouselAbove ? 100 : 300,true), item('card app-item',240,carouselAbove ? 100 : 300,true)];
    const sidebar = item('menu-tab',400,100);
    const app = item('app-item',100,100);
    const profile=item('top-profile-btn',-800,-100);profile.id='btnTopProfile';
    const items = modal ? [sidebar,app] : [tab,...cards,...(withProfile?[profile]:[])];
    const context = { window: { openNavMenu: () => menuOpened++, isGlobalLoading: false }, document,
        isCtxMenuOpen:false,isEditModalOpen:false,isSetupOpen:false,isModalOpen:modal,
        isVkbOpenForNavigation:()=>false,smoothHorizontalScroll:(_,done)=>done?.(),signalNavigation(){},pendingInteractionCard:null,
        _lastFocusedApp:null,_lastFocusedFilter:null,_lastFocusedSidebar:null };
    vm.createContext(context);
    vm.runInContext(fs.readFileSync(path.join(sourceRoot,'020-targets-and-spatial-candidates.js'),'utf8'),context);
    vm.runInContext(fs.readFileSync(path.join(sourceRoot,'050-focus-movement.js'),'utf8'),context);
    context.getNavigableItems=()=>items;
    context.getModalGroups=()=>({sidebar:[sidebar],apps:[app],filters:[],actions:[],activeTab:'view-apps'});
    return { document,tab,cards,sidebar,app,profile,move:direction=>context.moveFocus(direction),menuOpened:()=>menuOpened };
}
const normal=scenario();normal.cards[0].focus();normal.move('UP');assert.equal(normal.document.activeElement,normal.tab);
normal.cards[0].focus();normal.move('DOWN');assert.equal(normal.menuOpened(),1,'Default home shortcut is preserved');
const top=scenario({home:'library-first'});top.cards[0].focus();top.move('DOWN');assert.equal(top.document.activeElement,top.tab);assert.equal(top.menuOpened(),0);
top.move('UP');assert.equal(top.document.activeElement,top.cards[0],'Up follows the carousel now located above tabs');
top.move('RIGHT');assert.equal(top.document.activeElement,top.cards[1],'Horizontal card movement still works');
top.tab.focus();top.move('DOWN');assert.equal(top.menuOpened(),1,'Navigation menu remains reachable below the last home focus region');
const custom=scenario({home:'custom'});custom.cards[0].focus();custom.move('DOWN');assert.equal(custom.document.activeElement,custom.tab,'Custom named-region grids use spatial navigation too');
const right=scenario({dialog:'right',modal:true});right.app.focus();right.move('RIGHT');assert.equal(right.document.activeElement,right.sidebar);
const offset=scenario({home:'custom',withProfile:true});offset.cards[0].focus();offset.move('UP');assert.equal(offset.document.activeElement,offset.tab,'Up reaches categories before profile');
right.move('LEFT');assert.equal(right.document.activeElement,right.app,'Dialog navigation follows the relocated sidebar');
console.log('PASS: unchanged home shortcuts, carousel above tabs, horizontal navigation and right-hand dialog sidebar using real navigation code.');
