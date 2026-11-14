const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'../Doorpi/Frontend/scripts/nav-menu/250-focus-and-scrolling.js'),'utf8');
let now=0,queue=new Map(),sequence=0;
const pane={scrollHeight:4000,clientHeight:800,scrollTop:0,getBoundingClientRect:()=>({top:0,bottom:800})};
let top=900,height=300;
const card={getBoundingClientRect:()=>({top:top-pane.scrollTop,bottom:top+height-pane.scrollTop,height})};
const context={pane,card,performance:{now:()=>now},Math,requestAnimationFrame:fn=>{queue.set(++sequence,fn);return sequence;},cancelAnimationFrame:id=>queue.delete(id)};
vm.createContext(context);
vm.runInContext('let _libraryRapidScrollRaf=0,_libraryRapidScrollPane=null,_libraryRapidScrollTarget=0,_libraryRapidNavigation=false;'+source.slice(source.indexOf('    function _stopRapidLibraryScrollAnimation'),source.indexOf('    function _cancelLibraryScrollAnimation')),context);
function frames(count){for(let i=0;i<count;i++){now+=16.67;const callbacks=[...queue.values()];queue.clear();callbacks.forEach(fn=>fn(now));}}
function reveal(first=false){vm.runInContext(`_revealLibraryCard(card,pane,${first})`,context);}
function visible(){const r=card.getBoundingClientRect();assert(r.top>=0&&r.bottom<=800,JSON.stringify({r,scroll:pane.scrollTop}));}
reveal();frames(120);visible();
// A downward target remains pending when the user reverses to a visible card.
top=2100;reveal();frames(3);top=900;reveal();frames(120);visible();
// Releasing rapid navigation must finish the same destination.
vm.runInContext('_libraryRapidNavigation=true',context);top=2600;reveal();frames(4);
vm.runInContext('_libraryRapidNavigation=false',context);frames(120);visible();
// Focus grows after measurement; reserved space keeps the final scale visible.
top=3000;height=300;reveal();height=315;frames(120);visible();
top=24;height=300;reveal(true);frames(120);visible();assert.equal(pane.scrollTop,0);
console.log('PASS: card visibility after direction reversal, pending targets, rapid release, focus growth and first-row return.');
