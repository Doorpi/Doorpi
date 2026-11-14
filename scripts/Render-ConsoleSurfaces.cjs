// Actual picker/quick-panel controllers in an isolated Chromium fixture; no Windows bridge.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process'),{pathToFileURL}=require('node:url');
const http=require('node:http');
const root=path.resolve(__dirname,'..'),output=path.join(root,'artifacts/console-surfaces');
fs.mkdirSync(output,{recursive:true});
const source=relative=>fs.readFileSync(path.join(root,'Doorpi/Frontend',relative),'utf8');
const orbit=JSON.parse(fs.readFileSync(path.join(root,'Doorpi/wwwroot/themes/builtin/orbit.json')));
const orbitContract=JSON.parse(fs.readFileSync(path.join(root,'Doorpi/wwwroot/themes/contract.json')));
const orbitPackageContract=JSON.parse(fs.readFileSync(path.join(root,'Doorpi/wwwroot/themes/package-contract.json')));
fs.writeFileSync(path.join(output,'orbit-runtime.js'),['010-theme-runtime.js','030-trailer-layout.js','040-package-styles.js'].map(file=>source('scripts/themes/'+file)).join('\n'));
const expand=text=>text.replace(/__doorpiCss\("([^"]+)"\)/g,(_,file)=>JSON.stringify(source(file)));
const app=path.join(root,'Doorpi/Frontend/scripts/app');
const focusSource=source('scripts/app/040-audio-and-focus.js');
const blocker=focusSource.slice(focusSource.indexOf('    window._setDoorpiHomeInteractionBlocked ='),focusSource.indexOf('    window._doorpiNativeDialogSuppressUntil ='));

const extensionStartup=source('scripts/app/290-launch-overlay.js').slice(source('scripts/app/290-launch-overlay.js').indexOf('    let _extensionUpdateTimer'));
const quick=fs.readdirSync(app).filter(name=>/^15[0-6]-/.test(name)).sort().map(name=>source('scripts/app/'+name)).join('\n');
fs.writeFileSync(path.join(output,'controllers.js'),expand(source('scripts/app/030-library-update-queue.js')+'\n'+blocker+'\n'+source('scripts/app/130-global-focus-and-profile-overlays.js')+'\n'+source('scripts/app/140-user-picker.js')+'\n'+quick+'\n'+source('scripts/app/158-overlay-routing-and-loading.js')+'\n'+source('scripts/app/157-extension-and-disc-dialogs.js')+'\n'+source('scripts/app/100-notifications.js')+'\n'+source('scripts/app/120-clock-fallbacks-and-host-messages.js')+'\n'+source('scripts/app/180-artwork-and-hero.js')+'\n'+source('scripts/app/260-ambient-background.js')+'\n'+source('scripts/app/270-session-transition.js')+'\n'+extensionStartup));
fs.writeFileSync(path.join(output,'pipeline.js'),expand(['store/010-implementation.js','renderer/020-card-interaction.js','renderer/040-card-renderer.js','renderer/050-tab-transitions.js','grid-controller/010-implementation.js'].map(file=>source('scripts/'+file)).join('\n')));
fs.writeFileSync(path.join(output,'profile.js'),expand(source('scripts/app/090-web-fixes-and-top-profile.js')));
fs.writeFileSync(path.join(output,'regions.js'),source('scripts/navigation/015-region-contract.js'));
// Optional local review art is copied into artifacts; no runtime state is read here.
const artCatalogPath=path.join(output,'art-fixture.json');
const artCatalog=fs.existsSync(artCatalogPath)?JSON.parse(fs.readFileSync(artCatalogPath,'utf8').replace(/^\uFEFF/,'')):[];
const homeDocument=fs.readFileSync(path.join(root,'Doorpi/wwwroot/index.html'),'utf8');
fs.writeFileSync(path.join(output,'home-review.js'),source('scripts/renderer/010-featured-presentation.js')+`
window.previewLoadHome=async()=>{
 document.getElementById('doorpi-app-ui')?.remove();
 const doc=new DOMParser().parseFromString(${JSON.stringify(homeDocument)},'text/html');
 const ui=doc.getElementById('doorpi-app-ui');document.body.appendChild(ui);ui.style.transition='none';ui.style.display='block';ui.style.opacity='1';
 ui.querySelector('#mediaGrid').style.display='none';ui.querySelector('#storesGrid').style.display='none';
 ui.querySelector('#clock').textContent='20:42';
 const grid=ui.querySelector('#gameGrid');grid.replaceChildren();
 for(const [i,item] of ${JSON.stringify(artCatalog)}.entries()){
  const card=document.createElement('button');card.className='card';card.tabIndex=0;
  Object.assign(card.dataset,{id:'review-'+i,channel:'games',source:'Biblioteca',staticVertical:item.vertical||'',staticHorizontal:item.horizontal||'',staticHero:item.hero||'',staticLogo:item.logo||'',totalPlaytimeMinutes:'173',lastSessionMinutes:'83'});
  const img=document.createElement('img');img.src=item.vertical;const title=document.createElement('span');title.className='title';title.textContent=item.name;card.append(img,title);
  const present=()=>{
   grid.querySelectorAll('.featured').forEach(other=>other.classList.remove('featured'));card.classList.add('featured');
   updateHomeFeatureStage(card);const hero=ui.querySelector('#heroImage');hero.src=item.hero||item.horizontal||item.vertical;hero.style.opacity='1';
  };card.addEventListener('focus',present);card._startInteraction=present;grid.appendChild(card);
 }
 DoorpiNavigation.enter('home');
 applyI18n();
 await Promise.all([...ui.querySelectorAll('img[src]')].map(image=>image.decode().catch(()=>{})));
 await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
};
`);
const web=pathToFileURL(path.join(root,'Doorpi/wwwroot/')).href;
fs.writeFileSync(path.join(output,'fixture.html'),`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><link rel="stylesheet" href="${web}style.css"></head><body>
<div style="position:fixed;inset:0;background:radial-gradient(ellipse at 75% 35%,#326677,transparent 45%),linear-gradient(130deg,#071321,#243c50);display:grid;place-items:center;color:white;font:60px 'Segoe UI'"></div>
<script>window.previewMessages=[];window.previewHostListeners=[];window.chrome=window.chrome||{};window.chrome.webview={postMessage:value=>previewMessages.push(JSON.parse(value)),addEventListener:(type,listener)=>previewHostListeners.push(listener)};
window.isDoorpiStableHomeState=()=>true;window.isDoorpiFileBrowserOpen=()=>false;window._stopSystemAudio=()=>{};
window._pendingRenderGamesPayload=null;window._pendingRenderGamesTimer=0;window._pendingNewGameQueue=[];window._pendingNewGameTimer=0;window.DOORPI_BULK_LIBRARY_THRESHOLD=3;
window.previewErrors=[];window.addEventListener('error',event=>previewErrors.push(event.message));const previewConsoleError=console.error.bind(console);console.error=(...args)=>{previewErrors.push(args.map(String).join(' '));previewConsoleError(...args);};
window._normalizeUserPhotoSrc=value=>value;window._doorpiCurrentUserId='2';window._doorpiUserSessionReady=true;
window._currentBgSrc='';window._doorpiUsers=window.previewUsers;window._doorpiPreferredUserId='2';window.findSpatialCandidate=()=>null;
window.cancelHeroTransition=()=>{};
window.isModalOpen=false;window.isEditModalOpen=false;window.isSetupOpen=false;window.isCtxMenuOpen=false;window.isVkbOpenForNavigation=()=>false;
window.previewUsers=Array.from({length:7},(_,i)=>({Id:String(i+1),Name:['Marina','Rafael','Alex','Júlia','Gabriel','Sofia','Um nome de perfil mais longo'][i],PhotoBase64:'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="'+['#3e9ba6','#446fba','#9471bb'][i%3]+'"/><stop offset="1" stop-color="#10253e"/></linearGradient></defs><rect width="400" height="400" fill="url(#g)"/><circle cx="200" cy="156" r="66" fill="#e5f7f9"/><path d="M68 400v-32a132 116 0 0 1 264 0v32" fill="#b8e5ed"/></svg>')}));
</script><script src="${web}strings.js"></script><script src="regions.js"></script><script src="controllers.js"></script><script src="home-review.js"></script><script>setLang('pt-BR');window._doorpiUsers=previewUsers;</script></body></html>`);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn,label,timeout=15000){const start=Date.now();while(Date.now()-start<timeout){const result=await fn();if(result)return result;await sleep(80);}throw Error('Timed out: '+label);}
async function connect(url){
 const socket=new WebSocket(url),pending=new Map();let next=0;
 socket.addEventListener('message',event=>{const data=JSON.parse(event.data),request=pending.get(data.id);if(!request)return;pending.delete(data.id);clearTimeout(request.timer);data.error?request.reject(Error(JSON.stringify(data.error))):request.resolve(data.result);});
 await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
 return {send(method,params={}){return new Promise((resolve,reject)=>{const id=++next,timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout: '+method));},20000);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));});},close:()=>socket.close()};
}
(async()=>{
 let chrome,client,server;const report=[];
 try{
  const profile=path.join(output,'browser-profile-'+Date.now());
  chrome=spawn(process.env.DOORPI_PREVIEW_CHROME||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',['--headless=new','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--disable-extensions','--mute-audio','--allow-file-access-from-files','--remote-debugging-port=0','--remote-debugging-address=127.0.0.1','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'});
  let launchError;chrome.on('error',error=>launchError=error);
  const portFile=path.join(profile,'DevToolsActivePort');await until(()=>{if(launchError)throw launchError;if(chrome.exitCode!==null)throw Error('Browser exited');return fs.existsSync(portFile);},'isolated browser');
  const port=fs.readFileSync(portFile,'utf8').split(/\r?\n/)[0],targets=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();
  client=await connect(targets.find(target=>target.type==='page').webSocketDebuggerUrl);
  const evaluate=async expression=>{const result=await client.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));return result.result.value;};
  await client.send('Page.enable');await client.send('Emulation.setFocusEmulationEnabled',{enabled:true});
  await client.send('Page.navigate',{url:pathToFileURL(path.join(output,'fixture.html')).href});
  await until(()=>evaluate("document.readyState==='complete'&&!!window.DoorpiQuickPanel&&typeof showUserPicker==='function'"),'controllers');
  await evaluate('document.fonts.ready');
  await evaluate("window._doorpiUserSessionReady=false;ensureDoorpiHomeAmbient();scheduleDoorpiExtensionUpdateCheck();previewHostListeners.forEach(listener=>listener({data:JSON.stringify({type:'renderGames',games:[{id:'prelogin',name:'Não deve renderizar',imageData:''}]})}))");
  await sleep(1600);
  assert.equal(await evaluate("!!document.getElementById('appBlobBg')||!!getDoorpiGamesPresentation()||previewMessages.some(message=>message.action==='requestExtensionUpdates')"),false,'Home artwork/ambient and extension checks wait for login');
  await evaluate("window._doorpiUserSessionReady=true;ensureDoorpiHomeAmbient()");
  assert.equal(await evaluate("!!document.getElementById('appBlobBg')"),true,'Home ambient initializes only for a chosen session');
  const capture=async name=>{const shot=await client.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(output,name+'.png'),Buffer.from(shot.data,'base64'));};
  for(const [width,height] of [[1280,720],[1920,1080],[2560,1440],[1024,768],[3840,2160]]){
   console.log('Checking console surfaces '+width+'x'+height);
   await client.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
   await evaluate('showUserPicker(previewUsers,false)');
   await until(()=>evaluate("document.activeElement?.classList.contains('doorpi-user-card')&&Number(getComputedStyle(document.activeElement).opacity)>.99"),'picker focus');
   await sleep(420);
   const picker=await evaluate(`(()=>{const root=document.getElementById('doorpiUserPicker'),active=document.activeElement,rect=active.getBoundingClientRect(),name=active.querySelector('.doorpi-user-name'),footer=root.querySelector('.doorpi-power-row').getBoundingClientRect();return {id:active.dataset.userId,rect:[rect.left,rect.top,rect.right,rect.bottom],footer:[footer.left,footer.top,footer.right,footer.bottom],nameSize:parseFloat(getComputedStyle(name).fontSize),minOpacity:Math.min(...[...root.querySelectorAll('.doorpi-user-card')].map(el=>Number(getComputedStyle(el).opacity))),blur:getComputedStyle(root).backdropFilter};})()`);
   assert.equal(picker.id,'2','Current profile retains initial focus');assert.ok(picker.minOpacity>=.81,'Other profiles remain readable');
   assert.ok(picker.rect[0]>=0&&picker.rect[2]<=width&&picker.rect[1]>0&&picker.rect[3]<picker.footer[1],'Focused profile clears footer');
   assert.ok(picker.footer[0]>=0&&picker.footer[2]<=width&&picker.footer[3]<=height,'Power actions stay on screen');
   assert.ok(picker.nameSize>=19);assert.equal(picker.blur,'none');
   await capture('profiles-'+width+'x'+height);
   await evaluate("document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));");
   assert.notEqual(await evaluate('document.activeElement.dataset.userId'),'2','Actual picker Right moves to another profile');
   await evaluate("document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));");
   assert.equal(await evaluate('document.activeElement.id'),'doorpiExitApp','Down reaches existing power controls');
   await evaluate("document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowUp',bubbles:true}));");
   assert.equal(await evaluate("document.activeElement.classList.contains('doorpi-user-card')"),true,'Up returns to profiles');
   await evaluate("document.querySelector('.doorpi-user-card.create-card').focus();");
   await sleep(450);
   assert.ok(await evaluate("(()=>{const r=document.activeElement.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;})()"),'Last profile/create option scrolls into view');
   await evaluate("_doorpiCloseUserPicker();DoorpiQuickPanel.openMenu();");await sleep(300);
   const menu=await evaluate(`(()=>{const panel=document.getElementById('doorpiQuickPanel'),side=panel.querySelector('.dq-sidebar'),buttons=[...side.querySelectorAll('button')];return {count:buttons.length,title:side.querySelector('h2').textContent,labelSize:parseFloat(getComputedStyle(buttons[0].querySelector('.dq-menu-label')).fontSize),rows:buttons.map(el=>{const r=el.getBoundingClientRect();return {id:el.dataset.section,rect:[r.left,r.top,r.right,r.bottom],overflow:el.scrollWidth>el.clientWidth+1};}),blur:getComputedStyle(side).backdropFilter};})()`);
   assert.equal(menu.count,7,'All six sections and Power retained');assert.equal(menu.title,'Painel rápido');assert.ok(menu.labelSize>=18);assert.equal(menu.blur,'none');
   if(width===2560){
    assert.ok(picker.nameSize<=28,'1440p profile names use a desktop cap');
    assert.ok(menu.labelSize<=26,'1440p menu labels do not scale indefinitely with width');
    assert.ok(menu.rows[0].rect[2]<=550,'1440p menu stays below 550 CSS pixels');
   }
   for(const row of menu.rows)assert.ok(row.rect[0]>=0&&row.rect[2]<width&&row.rect[1]>=0&&row.rect[3]<=height&&!row.overflow,'Menu action visible: '+JSON.stringify(row));
   assert.equal(await evaluate("document.activeElement.dataset.section"),'updates');
   await capture('quick-menu-'+width+'x'+height);
   await evaluate("document.querySelector('[data-section=connectivity]').click()");await sleep(250);
   assert.equal(await evaluate("document.querySelector('.dq-menu-btn.active')?.dataset.section"),'connectivity');
   assert.ok(await evaluate("parseFloat(getComputedStyle(document.querySelector('.dq-card h3')).fontSize)>=20&&parseFloat(getComputedStyle(document.querySelector('.dq-card p')).fontSize)>=17"),'Content hierarchy remains readable beside the menu');
   await capture('quick-connectivity-'+width+'x'+height);
   await evaluate('DoorpiQuickPanel.back()');await sleep(100);
   assert.equal(await evaluate("document.activeElement.dataset.section"),'connectivity','Back retains the section in the menu');
   await evaluate('DoorpiQuickPanel.close()');
   report.push({width,height,picker,menu});
  }
  // Required boot destination, photo-less profile and existing intro handoff guards.
  await evaluate("window.previewIntroBeforeReopen=window.DoorpiIntro;window.previewAmbientReopens=0;window.DoorpiIntro={isRunning:()=>false,isHandoffActive:()=>false,startUserPickerAmbient:()=>previewAmbientReopens++};showUserPicker(previewUsers,false)");
  assert.equal(await evaluate('previewAmbientReopens'),0,'Reopening profiles from Home must not recreate the 900ms intro ambient');
  assert.equal(await evaluate("getComputedStyle(document.getElementById('doorpiUserPicker')).animationName"),'none','Picker backdrop appears immediately');
  assert.equal(await evaluate("getComputedStyle(document.getElementById('doorpiUserPicker')).opacity"),'1');
  await evaluate("window.DoorpiIntro=previewIntroBeforeReopen;_doorpiCloseUserPicker()");
  await evaluate("showUserPicker([{Id:'2',Name:'Rafael',PhotoBase64:''}],true)");await sleep(300);
  assert.equal(await evaluate("!!document.getElementById('doorpiCloseUsers')"),false,'Required selection retains its existing non-dismissable behavior');
  assert.ok(await evaluate("document.querySelector('.doorpi-avatar svg').getBoundingClientRect().width>60"),'Photo-less avatar scales with the profile');
  await evaluate("document.body.classList.add('doorpi-intro-handoff-active');document.getElementById('doorpiUserPicker').classList.add('doorpi-intro-handoff');");
  assert.equal(await evaluate("getComputedStyle(document.getElementById('doorpiUserPicker')).backgroundColor"),'rgba(0, 0, 0, 0)','Intro ambient remains visible behind the picker');
  assert.equal(await evaluate("getComputedStyle(document.querySelector('.doorpi-user-panel')).opacity"),'1');
  await evaluate("document.getElementById('doorpiUserPicker').classList.add('doorpi-switching-out')");
  await until(()=>evaluate("getComputedStyle(document.querySelector('.doorpi-user-panel')).visibility==='hidden'"),'session handoff hides the picker after its existing transition');
  await evaluate("document.getElementById('doorpiUserPicker').style.display='none';document.body.classList.remove('user-picker-open','doorpi-intro-handoff-active');setLang('en-US');DoorpiQuickPanel.openMenu()");await sleep(200);
  assert.equal(await evaluate("document.querySelector('.dq-title').textContent"),'Quick panel');
  assert.equal(await evaluate("!!document.querySelector('.dq-menu-context, .dq-menu-copy small')"),false,'Sidebar contains actions without detached explanatory text');
  await evaluate('DoorpiQuickPanel.close()');
  await client.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await evaluate('showUserPicker(previewUsers,false)');
  assert.equal(await evaluate("getComputedStyle(document.querySelector('.doorpi-user-card')).animationName"),'none');
  await evaluate('_doorpiCloseUserPicker();DoorpiQuickPanel.openMenu()');
  assert.equal(await evaluate("getComputedStyle(document.querySelector('.dq-sidebar')).animationName"),'none');
  await client.send('Emulation.setEmulatedMedia',{features:[]});
  await client.send('Emulation.setDeviceMetricsOverride',{width:2560,height:1440,deviceScaleFactor:1,mobile:false});
  await evaluate(`(async()=>{
   setLang('pt-BR');DoorpiQuickPanel.close();document.getElementById('doorpiUserPicker').style.display='none';document.body.classList.remove('user-picker-open');
   const root=document.createElement('section');root.id='entryTestRoot';root.className='main-content-wrapper';root.innerHTML='<button id="entryTab">Aba anterior</button><div class="game-grid" id="gameGrid"><button id="btnAdd" class="card add-card">Adicionar</button></div>';document.body.appendChild(root);
   await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='pipeline.js';script.onload=resolve;script.onerror=reject;document.body.appendChild(script);});
   document.getElementById('entryTab').focus();window.isGlobalLoading=false;
   _userSwitchFadeOut({mode:'initial',user:{Name:'Rafael'}});
   // This is the real clear -> queued host batch -> store -> RAF renderer path.
   AppStore.mutations.setBatch('games',[]);window._navMenuPhase='opening';
   _scheduleRenderGamesBatch({games:[{id:'entry-first',name:'Primeiro jogo'},{id:'entry-second',name:'Segundo jogo'}],silent:true});
   window.previewEntering=_userSwitchFadeIn({mode:'initial',showTransition:true,waitForHomeReady:true});
   window.previewEntryFrames=[];
   const sample=()=>{if(!window._userSwitching)return;previewEntryFrames.push({inert:root.inert,opacity:Number(getComputedStyle(root).opacity)});requestAnimationFrame(sample);};requestAnimationFrame(sample);
  })()`);
  await sleep(400);
  assert.equal(await evaluate("document.getElementById('entryTestRoot').inert&&window._userSwitching&&document.getElementById('doorpiUserSwitchLogout').classList.contains('visible')"),true,'Entrando remains visible and input locked while the carousel is loading');
  assert.equal(await evaluate("document.querySelector('#doorpiUserSwitchLogout .logout-sub').hidden"),true,'Entering hides implementation details');
  assert.equal(await evaluate("getDoorpiGamesPresentation().committed"),false,'Add alone cannot release the queued initial batch');
  await evaluate("window._navMenuPhase='closed'");
  await until(()=>evaluate("!window._userSwitching&&DoorpiNavigation.getRegionId()===0&&previewMessages.some(message=>message.mode==='initial'&&message.activeRegion===0)"),'Entrando reveals a prepared carousel before releasing navigation');
  assert.ok(await evaluate("previewEntryFrames.every(frame=>frame.inert)&&previewEntryFrames.some(frame=>frame.opacity>0&&frame.opacity<1)"),'Input remains locked throughout the animated crossfade');
  assert.equal(await evaluate("!!document.querySelector('#gameGrid .bulk-silent-card')"),false,'Initial cards cannot animate in after Entrando exits');
  await evaluate("document.querySelector('[data-id=entry-second]').focus();document.getElementById('entryTab').focus();DoorpiNavigation.enter('home')");
  assert.equal(await evaluate('document.activeElement.dataset.id'),'entry-second','Session entry retains carousel selection');
  await evaluate("window._doorpiUserSessionReady=true;resetDoorpiGamesPresentation();showUserPicker(previewUsers,false)");
  await sleep(460);
  await evaluate("window._navMenuPhase='opening';_scheduleRenderGamesBatch({games:[{id:'same-profile-card',name:'Perfil atual'}],silent:true});document.querySelector('.doorpi-user-card[data-user-id=\"2\"]').click()");
  await sleep(350);
  assert.equal(await evaluate("window._userSwitching&&document.getElementById('entryTestRoot').inert&&document.getElementById('doorpiUserSwitchLogout').classList.contains('visible')"),true,'Selecting an already-active profile still prepares its unfinished library behind Entrando');
  await evaluate("window._navMenuPhase='closed'");
  await until(()=>evaluate("!window._userSwitching&&document.activeElement.dataset.id==='same-profile-card'"),'same-profile entry delivers focus to the carousel');
  await evaluate(`(()=>{AppStore.mutations.setBatch('games',[],{silent:true});window.isGlobalLoading=true;_userSwitchFadeOut({mode:'initial'});window.previewFailedEntry=_userSwitchFadeIn({mode:'initial',showTransition:true});})()`);
  await sleep(400);await capture('login-preparing-1440p');
  await until(()=>evaluate('isDoorpiHomeEntryRecoveryOpen()'),'failed readiness offers recovery instead of releasing an incomplete home',12000);
  assert.equal(await evaluate("document.getElementById('entryTestRoot').inert&&document.activeElement.textContent==='Tentar novamente'"),true);
  await evaluate("window.isGlobalLoading=false;_scheduleRenderGamesBatch({games:[{id:'retry-card',name:'Jogo'}],silent:true});document.querySelector('.logout-recovery-actions button').click()");
  await until(()=>evaluate("!window._userSwitching&&document.activeElement.dataset.id==='retry-card'"),'recovery retry reveals the prepared home');
  await evaluate("_userSwitchFadeOut({mode:'initial'});_scheduleRenderGamesBatch({games:[],silent:true});window.previewEmptyEntry=_userSwitchFadeIn({mode:'initial',showTransition:true})");
  await until(()=>evaluate("!window._userSwitching&&document.activeElement.id==='btnAdd'"),'an empty committed library enters region zero through Add');
  await evaluate("_userSwitchFadeOut({mode:'initial'});_scheduleRenderGamesBatch({games:[{id:'animated-entry',name:'Arte pendente',vertical:'animated.webp',isAnimated:true}],silent:true});window.previewAnimatedEntry=_userSwitchFadeIn({mode:'initial',showTransition:true});void 0");
  await until(()=>evaluate('getDoorpiGamesPresentation().committed'),'pending-art batch committed');
  await sleep(400);
  assert.equal(await evaluate("window._userSwitching&&AppStore.queries.getItems('games').length===0"),true,'A nonempty batch waiting for static artwork cannot masquerade as an empty library');
  await evaluate("AppStore.mutations.patchItem('games','animated-entry',{staticVertical:previewUsers[1].PhotoBase64})");
  await until(()=>evaluate("!window._userSwitching&&document.activeElement.dataset.id==='animated-entry'"),'static artwork reaches the actual renderer before entry');
  assert.equal(await evaluate("(async()=>{await _userSwitchFadeIn({mode:'initial',showTransition:true,_transitionVersion:_doorpiSessionTransitionVersion-1,_transitionProfileId:'2'});return !window._userSwitching&&!document.getElementById('entryTestRoot').inert;})()"),true,'A delayed obsolete callback cannot reopen Entrando over the current session');
  await evaluate("document.getElementById('gameGrid').innerHTML='<button class=\"card loading-card\">Aguardando</button>';window.isGlobalLoading=true;_userSwitchFadeOut({mode:'initial'});window.previewStaleEntry=_userSwitchFadeIn({mode:'initial',showTransition:true});window._doorpiCurrentUserId='new-profile';_userSwitchFadeOut({mode:'initial'})");
  await evaluate('previewStaleEntry');
  assert.equal(await evaluate("window._userSwitching&&document.getElementById('entryTestRoot').inert"),true,'A stale transition cannot unlock a different profile');
  await evaluate("window._doorpiCurrentUserId='2';window.isGlobalLoading=false;_releaseDoorpiSessionInputNow('test-cleanup')");
  assert.equal(await evaluate("previewMessages.filter(message=>message.action==='requestExtensionUpdates').length"),1,'Extension checks run once after a session becomes interactive');
  await evaluate("document.getElementById('entryTestRoot').remove()");
  report.push({scenario:'session-entry',checks:['real queue/store/grid/renderer commit','same active profile entry','pending static artwork','empty Add does not replace game focus','Entrando stays visible while loading','inert until crossfade ends','carousel region 0','selected-card restoration','timeout stays blocked with retry','retry succeeds','empty library uses Add','stale profile cannot unlock home']});
  if(artCatalog.length){
   await client.send('Emulation.setDeviceMetricsOverride',{width:2560,height:1440,deviceScaleFactor:1,mobile:false});
   await evaluate("setLang('pt-BR');previewLoadHome()");
   await until(()=>evaluate("document.querySelector('#homeFeatureStage.has-scene-art')&&getComputedStyle(document.querySelector('.home-feature-art-shell')).opacity==='0'"),'single-image home composition');
   assert.equal(await evaluate("document.getElementById('homeFeaturePlaytimeValue').textContent"),'2h 53min','Total hours remain visible');
   assert.equal(await evaluate("!!document.getElementById('homeFeatureLastSession')||!!document.getElementById('homeLibraryPosition')||!!document.getElementById('homeLibraryTitle')"),false,'Home omits last session and carousel position');
   assert.equal(await evaluate('DoorpiNavigation.getRegionId()'),0);
   assert.equal(await evaluate("getComputedStyle(document.querySelector('.home-feature-primary')).visibility"),'visible','Play is available for the focused game');
   assert.equal(await evaluate("getComputedStyle(document.getElementById('homeFeatureEyebrow')).display"),'none');
   assert.equal(await evaluate("getComputedStyle(document.querySelector('#gameGrid .card:not(.featured) .title')).opacity"),'0','Unfocused cards show only their art');
   assert.equal(await evaluate("getComputedStyle(document.querySelector('#gameGrid .featured .title')).opacity"),'1','The selected card remains identifiable');
   assert.equal(await evaluate("(()=>{const root=document.documentElement;root.style.setProperty('--doorpi-home-secondary-title-size','37px');const size=getComputedStyle(document.getElementById('homeFeatureTitle')).fontSize;root.style.removeProperty('--doorpi-home-secondary-title-size');return size;})()"),'37px','The new composition preserves the public typography token');
   await capture('home-real-art-1440p');
   for(const [width,height] of [[1280,720],[1920,1080],[2560,1440],[1024,768],[3840,2160]]){
    await client.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
    const metrics=await evaluate("(()=>{const box=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};return {copy:box('.home-feature-copy'),logo:box('#gameLogo'),title:box('#homeFeatureTitle'),stats:box('.home-feature-playtime'),toolbar:box('.home-library-toolbar')};})()");
    assert.ok(metrics.copy.x>=0&&metrics.copy.right<=width+1,'Home copy stays in the viewport: '+JSON.stringify({width,height,metrics}));
    assert.ok(metrics.copy.y>=70&&metrics.copy.bottom<metrics.toolbar.y-6,'Information clears system header and carousel navigation: '+JSON.stringify({width,height,metrics}));
    assert.ok(metrics.logo.bottom<=metrics.title.y+1&&metrics.stats.right<=metrics.copy.right+1,'Logo/title and statistics retain their hierarchy');
    report.push({scenario:'home-composition',width,height,metrics});
    if(width===1280||width===3840)await capture('home-real-art-'+width+'x'+height);
   }
   await client.send('Emulation.setDeviceMetricsOverride',{width:2560,height:1440,deviceScaleFactor:1,mobile:false});
   const copyGeometry=()=>evaluate(`['.home-feature-copy','#gameLogo','#homeFeatureTitle','.home-feature-playtime','.home-feature-primary'].map(selector=>{const el=document.querySelector(selector),r=el.getBoundingClientRect(),s=getComputedStyle(el);return {selector,rect:[r.x,r.y,r.width,r.height],font:s.fontSize,display:s.display,text:el.textContent};})`);
   const beforeTrailer=await copyGeometry();
   await evaluate("(()=>{const layer=document.createElement('div');layer.id='previewTrailer';layer.className='home-trailer-layer';const backdrop=document.createElement('div');backdrop.className='home-trailer-backdrop';const video=document.createElement('video');video.className='home-trailer-media is-active';video.poster=document.getElementById('heroImage').src;backdrop.appendChild(video);layer.appendChild(backdrop);document.getElementById('doorpi-app-ui').appendChild(layer);document.body.classList.add('home-trailer-playing');})()");
   await sleep(650);
   assert.deepEqual(await copyGeometry(),beforeTrailer,'Trailer playback preserves the complete left-hand information layout');
   await capture('home-trailer-real-art-1440p');
   await evaluate("document.body.classList.remove('home-trailer-playing');document.getElementById('previewTrailer').remove();window._doorpiUserSessionReady=true;window._doorpiProfile=previewUsers[1];new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='profile.js';script.onload=resolve;script.onerror=reject;document.body.appendChild(script);})");
   await evaluate("_applyDoorpiTopProfile(previewUsers[1]);DoorpiNotifications.render();updateDoorpiTopClusterVisibility();document.getElementById('btnTopProfile').focus()");
   await sleep(300);
   assert.equal(await evaluate('DoorpiNavigation.getRegionId()'),2);
   assert.equal(await evaluate("getComputedStyle(document.getElementById('btnTopProfile'),'::before').borderTopWidth"),'0px');
   assert.notEqual(await evaluate("getComputedStyle(document.querySelector('#btnTopProfile .doorpi-avatar')).boxShadow"),'none','Only the avatar has the profile focus ring');
   assert.ok(await evaluate("(()=>{const avatar=document.querySelector('#btnTopProfile .doorpi-avatar').getBoundingClientRect(),menu=document.querySelector('.top-quick-menu-cue').getBoundingClientRect(),notifications=document.getElementById('doorpiNotificationButton').getBoundingClientRect();return avatar.left-5>menu.right&&avatar.right+5<notifications.left;})()"),'Profile focus does not cover menu or notification icons');
   assert.equal(await evaluate("getComputedStyle(document.querySelector('.home-feature-primary')).visibility"),'hidden','System focus hides Play');
   assert.equal(await evaluate("document.getElementById('gameLogo').classList.contains('visible')"),true,'The last game logo remains visible after focus leaves the carousel');
   await capture('home-profile-focus-1440p');
   await evaluate("DoorpiNotifications.setExtensionUpdates({'fixture-extension':{version:'2'}});DoorpiNotifications.open();window.previewExtensionsDestination=false;window.openNavMenu=async category=>{window.previewMenuCategory=category;await new Promise(resolve=>setTimeout(resolve,180));window.isNavMenuOpen=true;};window._navMenuOpenExtensions=()=>{window.previewExtensionsDestination=true;document.getElementById('entryTab')?.focus();};");
   await evaluate("document.querySelector('[data-notification-id=extension-updates]').click()");
   await until(()=>evaluate("previewExtensionsDestination"),'extension notification routes through the real manager opener');
   assert.equal(await evaluate('previewMenuCategory'),2);
   assert.equal(await evaluate('isDoorpiNotificationCenterOpen()'),false);
   await evaluate("window.isNavMenuOpen=false;delete window.openNavMenu;delete window._navMenuOpenExtensions;DoorpiNotifications.remove('extension-updates')");
   await evaluate("DoorpiNavigation.enter('home')");
   await evaluate('DoorpiQuickPanel.openMenu()');await sleep(250);
   assert.equal(await evaluate("!!document.getElementById('doorpiQuickMenuContext')"),false,'Contextual sidebar text removed');
   await capture('menu-real-art-1440p');
   await evaluate("DoorpiQuickPanel.close()");
   await evaluate(`window.previewOrbit=${JSON.stringify(orbit)};window.previewOrbitContract=${JSON.stringify(orbitContract)};window.previewOrbitPackageContract=${JSON.stringify(orbitPackageContract)};
    window.previewOriginalFetch=window.fetch;window.fetch=(url,...args)=>String(url).endsWith('themes/contract.json')?Promise.resolve({ok:true,json:async()=>previewOrbitContract}):previewOriginalFetch(url,...args);
    new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='orbit-runtime.js';script.onload=resolve;script.onerror=reject;document.body.appendChild(script);})`);
   await evaluate(`(async()=>{DoorpiThemePackageRuntime.configure(previewOrbitPackageContract,previewOrbitContract);
    for(const [part,component] of Object.entries(previewOrbit.parts))DoorpiThemePackageRuntime.install(part,DoorpiThemePackageRuntime.prepare(part,component.css,previewOrbit.assets,previewOrbitPackageContract.parts[part],'orbit'));
    await DoorpiThemes.apply(previewOrbit.parts.home.appearance,{scope:'home'});DoorpiNavigation.enter('home');})()`);
   for(const [width,height] of [[1280,720],[1920,1080],[2560,1440],[1024,768],[3840,2160]]){
    await client.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await sleep(100);
    const metrics=await evaluate(`(()=>{const box=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};return {copy:box('.home-feature-copy'),art:box('.home-feature-art-shell'),rail:box('.home-library-rail'),card:box('#gameGrid .card'),profile:box('#btnTopProfile'),toolbar:box('.home-library-toolbar'),controls:box('.home-controls-bar')};})()`);
    assert.ok(metrics.card.y>=metrics.profile.bottom+20,'Orbit carousel clears profile: '+JSON.stringify({width,height,metrics}));
    assert.ok(metrics.copy.bottom<=metrics.art.y+1&&metrics.copy.x>=0&&metrics.copy.y>=metrics.profile.bottom,'Orbit information and trailer do not overlap: '+JSON.stringify({width,height,metrics}));
    assert.ok(metrics.art.right<=metrics.rail.x&&metrics.art.bottom<=metrics.controls.y+1,'Orbit trailer stays in its own column');
    assert.ok(Math.abs(metrics.card.height/metrics.card.width-1.5)<.02,'Orbit keeps SteamGrid 2:3');
    assert.equal(await evaluate('DoorpiNavigation.getRegionId()'),0);
    await capture('orbit-home-'+width+'x'+height);report.push({scenario:'orbit-sdk',width,height,metrics});
   }
   await client.send('Emulation.setDeviceMetricsOverride',{width:2560,height:1440,deviceScaleFactor:1,mobile:false});
   await evaluate("DoorpiQuickPanel.openMenu()");await sleep(250);await capture('orbit-quick-menu-1440p');
   await evaluate("DoorpiQuickPanel.close()");
   await evaluate(`Promise.all(['sound-ui.js','wifi-ui.js','bluetooth-ui.js'].map(file=>new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=${JSON.stringify(pathToFileURL(path.join(root,'Doorpi/wwwroot')).href+'/')}+file;script.onload=resolve;script.onerror=reject;document.body.appendChild(script);})))`);
   for(const section of ['updates','sound','connectivity','power']){
    await evaluate(`DoorpiQuickPanel.open(${JSON.stringify(section)})`);await sleep(250);
    assert.equal(await evaluate("getComputedStyle(document.querySelector('#doorpiQuickPanel .dq-content')).backgroundColor"),'rgb(12, 18, 21)','Quick content follows Orbit palette');
    await capture('orbit-quick-'+section+'-1440p');
    await evaluate('DoorpiQuickPanel.close()');
   }
   for(const [width,height] of [[1280,720],[1920,1080],[2560,1440],[1024,768],[3840,2160]]){
    await client.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
    await evaluate('showUserPicker(previewUsers,false)');
    await until(()=>evaluate("Number(getComputedStyle(document.querySelector('#doorpiUserPicker .doorpi-power-row')).opacity)>.99&&!!document.querySelector('#doorpiUserPicker .doorpi-user-card:focus')"),'Orbit login focus and footer');
    const metrics=await evaluate(`(()=>{const box=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom};};return {heading:box('#doorpiUserPicker .doorpi-panel-head'),avatar:box('#doorpiUserPicker .doorpi-user-card:focus .doorpi-avatar'),footer:box('#doorpiUserPicker .doorpi-power-row')};})()`);
    assert.ok(metrics.heading.bottom<metrics.avatar.y&&metrics.avatar.bottom<metrics.footer.y,'Orbit login separates heading, identities and power actions');
    assert.ok(metrics.avatar.x>=0&&metrics.avatar.right<=width&&metrics.footer.x>=0&&metrics.footer.right<=width&&metrics.footer.bottom<=height,'Orbit login stays on screen');
    assert.ok(await evaluate("(()=>{const a=document.querySelector('.create-card .doorpi-avatar').getBoundingClientRect(),p=document.querySelector('.doorpi-create-user-icon').getBoundingClientRect();return Math.abs(a.x+a.width/2-p.x-p.width/2)<1&&Math.abs(a.y+a.height/2-p.y-p.height/2)<1;})()"),'New-profile plus is centered in square portrait');
    await capture('orbit-login-'+width+'x'+height);report.push({scenario:'orbit-login',width,height,metrics});
   }
   await evaluate("_doorpiCloseUserPicker();for(const part of Object.keys(previewOrbit.parts))DoorpiThemePackageRuntime.reset(part);DoorpiThemes.reset();window.fetch=previewOriginalFetch;document.getElementById('doorpi-app-ui').remove()");
  }
  await client.send('Emulation.setEmulatedMedia',{features:[]});
  // Serve the real intro/assets locally. Only app.local is mapped to loopback;
  // the package timeline, messages, controller and CSS are unchanged.
  let base;
  const webRoot=path.join(root,'Doorpi/wwwroot');
  server=http.createServer((request,response)=>{
   try{
    if(request.method!=='GET'){response.writeHead(405).end();return;}
    const pathname=new URL(request.url,'http://127.0.0.1').pathname;
    if(pathname==='/runtime/intros/active-intro.json'){
     response.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify({enabled:true,manifest:'doorpi-neon/manifest.json'}));return;
    }
    const runtime=pathname.startsWith('/runtime/');
    const directory=runtime?webRoot:output;
    const file=path.resolve(directory,decodeURIComponent(runtime?pathname.slice(9):pathname.slice(1)));
    if(!file.startsWith(directory+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){response.writeHead(404).end();return;}
    let bytes=fs.readFileSync(file);
    if(file===path.join(webRoot,'intro-system.js'))bytes=Buffer.from(bytes.toString('utf8').replaceAll('https://app.local',base+'/runtime'));
    const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.css':'text/css','.wav':'audio/wav','.woff2':'font/woff2'}[path.extname(file)]||'application/octet-stream';
    response.writeHead(200,{'Content-Type':mime,'Cache-Control':'no-store'}).end(bytes);
   }catch{response.writeHead(500).end();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+server.address().port;
  let introFixture=fs.readFileSync(path.join(output,'fixture.html'),'utf8').replaceAll(web,base+'/runtime/');
  introFixture=introFixture.replace('</head>','<script src="/runtime/intro-system.js"></script></head>');
  introFixture=introFixture.replace("setLang('pt-BR');","setLang('pt-BR');showUserPicker(previewUsers,true);");
  fs.writeFileSync(path.join(output,'intro-fixture.html'),introFixture);
  await client.send('Network.enable');
  await client.send('Network.setBlockedURLs',{urls:['https://fonts.googleapis.com/*','https://fonts.gstatic.com/*']});
  await client.send('Emulation.setDeviceMetricsOverride',{width:2560,height:1440,deviceScaleFactor:1,mobile:false});
  await client.send('Page.navigate',{url:base+'/intro-fixture.html'});
  await until(()=>evaluate("!!document.getElementById('doorpiIntroFrame')&&!!document.getElementById('doorpiUserPicker')"),'real intro and precomposed picker');
  await evaluate(`(()=>{
   window.previewHandoffSamples=[];window.previewIntroEvents=[];
   window.addEventListener('message',event=>{if(event.data?.type?.startsWith('doorpi:intro:'))previewIntroEvents.push(event.data.type);});
   const sample=()=>{
    const root=document.getElementById('doorpiUserPicker'),ambient=document.getElementById('doorpiIntroAmbient');
    if(ambient&&root){const frame=document.getElementById('doorpiIntroFrame'),avatar=root.querySelector('.is-current .doorpi-avatar')||root.querySelector('.doorpi-avatar'),r=avatar.getBoundingClientRect(),css=getComputedStyle(root);previewHandoffSamples.push({frame:!!frame,frameOpacity:frame?Number(getComputedStyle(frame).opacity):0,ambientOpacity:Number(getComputedStyle(ambient).opacity),before:getComputedStyle(root,'::before').content,background:css.backgroundColor,image:css.backgroundImage,avatar:[r.x,r.y,r.width,r.height]});}
    if(!DoorpiIntro.isComplete()||document.getElementById('doorpiIntroFrame'))requestAnimationFrame(sample);
    else window.previewHandoffFinished=true;
   };requestAnimationFrame(sample);
  })()`);
  await until(()=>evaluate("previewHandoffSamples?.some(sample=>sample.frameOpacity>0&&sample.frameOpacity<.9)"),'actual intro fade',20000);
  await capture('intro-handoff-1440p');
  await until(()=>evaluate('window.previewHandoffFinished===true'),'actual intro completion');
  await capture('intro-profiles-1440p');
  const handoff=await evaluate('({events:previewIntroEvents,samples:previewHandoffSamples})');
  assert.ok(handoff.events.includes('doorpi:intro:handoff')&&handoff.events.includes('doorpi:intro:complete'),'Real package emits handoff and completion');
  assert.ok(handoff.samples.length>2,'Observe multiple frames of the real sequence');
  const last=handoff.samples.at(-1);
  for(const sample of handoff.samples){
   assert.equal(sample.before,'none','No new decorative layer covers the intro ambient');
   assert.equal(sample.background,'rgba(0, 0, 0, 0)');assert.equal(sample.image,'none');
   assert.ok(sample.avatar.every((value,i)=>Math.abs(value-last.avatar[i])<1),'Profile geometry remains stable through the fade');
  }
  assert.ok(last.ambientOpacity>.99&&!last.frame,'Ambient continues after the iframe exits');
  report.push({scenario:'actual-intro-1440p',...handoff});
  if(artCatalog.length){
   await evaluate(`(async()=>{
    await previewLoadHome();
    const games=[...document.querySelectorAll('#gameGrid .card')].map(card=>({...card.dataset,name:card.querySelector('.title').textContent}));
    await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='pipeline.js';script.onload=resolve;script.onerror=reject;document.body.appendChild(script);});
    _userSwitchFadeOut({mode:'initial',user:previewUsers[1]});
    _scheduleRenderGamesBatch({games,silent:true});
    document.getElementById('doorpiUserPicker').style.display='none';document.body.classList.remove('user-picker-open');
    window.previewFullLogin=_userSwitchFadeIn({mode:'initial',showTransition:true});
   })()`);
   await until(()=>evaluate("!window._userSwitching&&DoorpiNavigation.getRegionId()===0&&previewMessages.some(message=>message.mode==='initial'&&message.activeRegion===0)"),'real ambient-to-Home login');
   const ambientAtReady=await evaluate("(()=>{const ambient=document.getElementById('doorpiIntroAmbient');return ambient?Number(getComputedStyle(ambient).opacity):0;})()");
   assert.ok(ambientAtReady<.02,'The old ambient cannot cover the Home after input is released: '+ambientAtReady);
   await capture('login-home-ready-1440p');
   report.push({scenario:'real-ambient-login',ambientOpacityAtReady:ambientAtReady,region:0});
  }
  await client.send('Page.navigate',{url:base+'/intro-fixture.html'});
  await until(()=>evaluate("!!document.getElementById('doorpiIntroFrame')&&!!document.getElementById('doorpiUserPicker')"),'early skip destination prepared');
  const skip=await evaluate(`(()=>{
   DoorpiIntro.skip();
   const frame=document.getElementById('doorpiIntroFrame'),ambient=document.getElementById('doorpiIntroAmbient');
   return {frameRetained:!!frame,duration:frame?.style.transitionDuration,ambientOpacity:ambient?Number(getComputedStyle(ambient).opacity):0,
    blobs:ambient?.querySelectorAll('.doorpi-intro-ambient-blob').length};
  })()`);
  assert.ok(skip.frameRetained,'Skip retains the cover during its dissolve');
  assert.equal(skip.duration,'180ms');assert.equal(skip.blobs,0,'Skip does not spawn a moving blob backdrop');
  assert.equal(skip.ambientOpacity,1,'Destination backdrop is fully painted before the cover fades');
  await until(()=>evaluate("!document.getElementById('doorpiIntroFrame')&&DoorpiIntro.isComplete()"),'skip completes');
  await capture('intro-skip-profiles-1440p');report.push({scenario:'early-skip-1440p',...skip});
  assert.deepEqual(await evaluate('previewErrors'),[],'The fixture cannot pass with uncaught runtime or renderer errors');
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
  const oldFailure=path.join(output,'failure.json');if(fs.existsSync(oldFailure))fs.unlinkSync(oldFailure);
  console.log('PASS: five resolutions, Entrando waits/crossfades before region 0, empty/late library, failure/retry, stale profile, public typography tokens, real-art Home, PT/EN, reduced motion and real intro sequence. '+path.relative(root,output));
  await client.send('Browser.close');
 }catch(error){
  if(client){try{const result=await client.send('Runtime.evaluate',{expression:"JSON.stringify({errors:window.previewErrors,batch:window.getDoorpiGamesPresentation?.(),items:window.AppStore?.queries.getItems('games'),grid:document.getElementById('gameGrid')?.outerHTML,active:document.activeElement?.outerHTML,loading:window.isGlobalLoading,switching:window._userSwitching})",returnByValue:true});fs.writeFileSync(path.join(output,'failure.json'),result.result.value||'{}');console.error('Fixture details: '+path.join(output,'failure.json'));}catch{}}
  throw error;
 }finally{client?.close();if(chrome&&chrome.exitCode===null)chrome.kill();server?.closeAllConnections();server?.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
