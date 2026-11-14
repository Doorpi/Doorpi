const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'../Doorpi/Frontend/scripts');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
function element(){
 const classes=new Set(),attrs=new Map();
 return {dataset:{},style:{},complete:true,naturalWidth:100,
  classList:{add:(...names)=>names.forEach(name=>classes.add(name)),remove:(...names)=>names.forEach(name=>classes.delete(name)),contains:name=>classes.has(name),toggle(name,force){const on=force??!classes.has(name);on?classes.add(name):classes.delete(name);return on;}},
  getAttribute:name=>attrs.get(name)||null,setAttribute:(name,value)=>attrs.set(name,String(value)),removeAttribute:name=>attrs.delete(name),
  get src(){return attrs.get('src')||'';},set src(value){attrs.set('src',value);}};
}
const nodes=Object.fromEntries(['homeFeatureStage','homeTrailerFullscreenHint','homeTrailerFullscreenHintLabel'].map(id=>[id,element()]));
const body=element(),loads=[],timers=[],window={addEventListener(){},_doorpiCurrentUserId:'a',DoorpiSoundSettings:{getInternalVolumes:()=>({trailer:0})}};
const document={body,getElementById:id=>nodes[id],addEventListener(){},querySelector(){return null;}};
const context=vm.createContext({window,document,Image:class{set src(value){this.url=value;loads.push(this);}},setTimeout:(fn,delay)=>{timers.push({fn,delay});return timers.length;},clearTimeout(){},clearInterval(){},URL,console,performance});
vm.runInContext(read('renderer/010-featured-presentation.js'),context);
const logo=element(),stage=element();stage.dataset.cardId='one';
const card={dataset:{id:'one',channel:'games',staticLogo:'static.png'}};
context.logo=logo;context.stage=stage;context.card=card;
const request=src=>vm.runInContext(`_doorpiSetFeatureLogo(logo,stage,card,${JSON.stringify(src)})`,context);
request('static.png');loads.pop().onload();assert.equal(logo.src,'static.png');
request('animated.webp');assert.equal(logo.src,'static.png');loads.pop().onerror();loads.pop().onload();
assert.equal(logo.src,'static.png');assert.ok(logo.classList.contains('visible'),'Broken animated logo preserves the static one');
request('slow.webp');const stale=loads.pop();stage.dataset.cardId='two';card.dataset.id='two';request('two.png');loads.pop().onload();stale.onload();
assert.equal(logo.src,'two.png','Late image cannot overwrite another selection');
request('previous-profile.png');const previous=loads.pop();window._doorpiCurrentUserId='b';previous.onload();assert.equal(logo.src,'two.png');
request('');assert.equal(logo.src,'');assert.equal(stage.classList.contains('has-logo'),false);
request('cleared.png');const cleared=loads.pop();nodes.gameLogo=logo;
window.clearHomeFeatureLogo();cleared.onload();assert.equal(logo.src,'','Clearing Home invalidates pending logo loads');
const interaction=read('renderer/020-card-interaction.js').replace('return { start, stop };','return { start, stop, testActivate(card) { currentActiveCard=card; activateTrailer(card); } };');
vm.runInContext(interaction,context);nodes.homeFeatureStage.dataset.cardId='one';card.dataset.id='one';
vm.runInContext('CardInteraction.testActivate(card)',context);
assert.ok(body.classList.contains('home-trailer-playing'));
assert.equal(body.classList.contains('home-trailer-cinema'),false);
assert.equal(timers.length,1,'Playing schedules only the brief hint dismissal');
assert.equal(timers[0].delay,4000);
assert.equal(nodes.homeTrailerFullscreenHint.getAttribute('aria-hidden'),'false');
timers[0].fn();
assert.equal(nodes.homeTrailerFullscreenHint.getAttribute('aria-hidden'),'true');
assert.equal(body.classList.contains('home-trailer-cinema'),false,'Hint expiry never enters fullscreen');
vm.runInContext('CardInteraction.testActivate(card)',context);
assert.equal(timers.length,1,'Repeated playback events do not bring the hint back');
assert.equal(window.toggleHomeTrailerFullscreen(),true);assert.ok(body.classList.contains('home-trailer-cinema'));
assert.equal(nodes.homeTrailerFullscreenHint.getAttribute('aria-hidden'),'false','Manual entry briefly explains how to exit');
timers.at(-1).fn();
assert.equal(nodes.homeTrailerFullscreenHint.getAttribute('aria-hidden'),'true');
assert.ok(body.classList.contains('home-trailer-cinema'),'Dismissing hint keeps manual fullscreen');
window.toggleHomeTrailerFullscreen();assert.equal(body.classList.contains('home-trailer-cinema'),false);
const count=timers.length;
vm.runInContext('CardInteraction.testActivate(card)',context);assert.equal(timers.length,count);
body.classList.remove('home-trailer-playing');
assert.equal(window.toggleHomeTrailerFullscreen(),false);
assert.ok(!interaction.includes('localStorage'),'Old saved auto-fullscreen preference is neither read nor written');
console.log('PASS: logo fallback, stale images, manual fullscreen, transient hint and no automatic entry.');
