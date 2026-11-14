// Isolated headless Chrome fixture. Does not start Doorpi or use the user's browser profile/data.
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const output = path.resolve(root, process.argv[2] || 'artifacts/theme-preview');
if (!output.startsWith(root + path.sep)) throw Error('Preview output must stay inside the workspace.');
fs.mkdirSync(output, { recursive: true });
const contract = JSON.parse(fs.readFileSync(path.join(root, 'Doorpi/wwwroot/themes/contract.json')));
const themes = Object.fromEntries(['aurora', 'ember'].map(id => [id, JSON.parse(fs.readFileSync(path.join(root, `Doorpi/wwwroot/themes/examples/${id}.json`)))]));
const orbitPackage = JSON.parse(fs.readFileSync(path.join(root, 'Doorpi/wwwroot/themes/builtin/orbit.json')));
themes.orbit = orbitPackage.parts.home.appearance;
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'Doorpi/wwwroot/themes/catalog.json'))).themes;
const packageContract=JSON.parse(fs.readFileSync(path.join(root,'Doorpi/Frontend/themes/package-contract.json')));
const webRoot = pathToFileURL(path.join(root, 'Doorpi/wwwroot/')).href;
const fixturePath = path.join(output, 'fixture.html');
const regionScript = fs.readFileSync(path.join(root,'Doorpi/Frontend/scripts/navigation/015-region-contract.js'),'utf8');
const spatialScript = fs.readFileSync(path.join(root,'Doorpi/Frontend/scripts/navigation/020-targets-and-spatial-candidates.js'),'utf8');
// Expose a fixture-only entry into the real menu, avoiding unrelated library I/O.
const navFixture = path.join(output, 'nav-fixture.js');
const navSource = fs.readFileSync(path.join(root, 'Doorpi/wwwroot/nav-menu.js'), 'utf8');
const notificationFixture=path.join(output,'notifications-fixture.js');
const frontend=path.join(root,'Doorpi/Frontend');
const opener=fs.readFileSync(path.join(frontend,'scripts/app/157-extension-and-disc-dialogs.js'),'utf8').split('    window.openCreateUserDialog')[0];
const notifications=fs.readFileSync(path.join(frontend,'scripts/app/100-notifications.js'),'utf8').replace(/__doorpiCss\("([^"]+)"\)/g,(_,file)=>JSON.stringify(fs.readFileSync(path.join(frontend,file),'utf8')));
fs.writeFileSync(notificationFixture,'let _doorpiSessionTransitionVersion=0;window.isDoorpiSessionTransitionActive=()=>false;window._doorpiUserSessionReady=true;\n'+notifications+'\n'+opener);
const closeScope = navSource.lastIndexOf('})();');
assert.ok(closeScope > 0);
fs.writeFileSync(navFixture, navSource.slice(0, closeScope) + `
window.previewResetClosedMenu=()=>{++_navMenuLifecycleToken;window.isNavMenuOpen=false;_navMenuPhase='closed';window._navMenuPhase='closed';_preserveSettingsSubViewOnce=false;_overlay.style.display='none';document.body.classList.remove('nav-menu-active','nav-menu-closing');};
window.previewClearLibrary=()=>_destroyLazyGrid();

window.previewOpenSettings = () => {
 _catIdx=CATS.findIndex(cat=>cat.id==='settings');_settingsSubView=null;_contentIdx=0;_topbarFocus=false;
 _buildOverlay();window.isNavMenuOpen=true;_navMenuPhase='open';_overlay.style.display='flex';_overlay.classList.add('visible');
 _overlay.style.background='#0b1222';document.body.classList.add('nav-menu-active');
 _renderContent('settings');_updateContentFocus();
};
window.previewFocusTheme = id => {const index=_contentItems.findIndex(el=>el.id===id);if(index<0)return false;_contentIdx=index;_topbarFocus=false;_updateContentFocus();return true;};
` + navSource.slice(closeScope));
const art = (name, color) => 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="920" height="430"><defs><linearGradient id="g"><stop stop-color="${color}"/><stop offset="1" stop-color="#071326"/></linearGradient></defs><rect width="920" height="430" fill="url(#g)"/><circle cx="640" cy="160" r="130" fill="#fff" opacity=".13"/><path d="M0 430L230 140L470 430L720 180L920 430" fill="#071326" opacity=".6"/><text x="55" y="340" fill="#fff" font-family="sans-serif" font-size="68" font-weight="700" letter-spacing="7">${name}</text></svg>`);
const portraitArt = (name, color) => 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900"><defs><linearGradient id="g" x2=".8" y2="1"><stop stop-color="${color}"/><stop offset="1" stop-color="#09152b"/></linearGradient></defs><rect width="600" height="900" fill="url(#g)"/><circle cx="420" cy="260" r="175" fill="#fff" opacity=".13"/><path d="M0 740L210 290L465 740L600 490V900H0Z" fill="#08162b" opacity=".55"/><text x="44" y="785" fill="#fff" font-family="sans-serif" font-size="49" font-weight="700" letter-spacing="4">${name}</text><text x="46" y="825" fill="#fff" opacity=".55" font-family="sans-serif" font-size="17" letter-spacing="6">DOORPI COLLECTION</text></svg>`);
const games = [['NORTHSTAR','#327d90'],['ORBIT','#7667b4'],['TIDELINE','#287882'],['ASCENT','#9b664b'],['VECTOR','#4e769f'],['HORIZON','#77657f']];
fs.writeFileSync(fixturePath, `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><link id="sheet" rel="stylesheet" href="${webRoot}style.css"><style>*{animation:none!important;transition:none!important}#doorpi-app-ui{display:block;opacity:1}</style></head>
<body style="background:#020309;margin:0;overflow:hidden"><div id="doorpi-app-ui">
<div class="top-bar"><div id="clock">20:42</div></div><div class="home-top-shade"></div><div class="capaJogo"><img id="heroImage" src="${art('',games[0][1])}"><img id="bgBlur"></div>
<div class="grid-bg"><div class="main-content-wrapper">
<div class="home-feature-stage has-art has-scene-art"><div class="home-feature-art-shell"><img id="homeFeatureArt" src="${art(...games[0])}"></div><div class="home-feature-copy"><div class="home-feature-eyebrow">SUA BIBLIOTECA · AMOSTRA DE TEMA</div><h1 class="home-feature-title">Uma nova jornada</h1><div class="home-feature-meta"><span>Aventura</span><span>Instalado</span></div><div class="home-feature-playtime"><span class="home-feature-playtime-label">Tempo de jogo</span><strong>24 h</strong><small>Seu progresso</small></div><div class="home-feature-primary"><span class="home-feature-a">A</span>Continuar jogando</div></div></div>
<div class="home-library-toolbar"><div class="home-tabs"><div class="home-tabs-group"><button class="home-tab nav-focused-el">Jogos</button><button class="home-tab">Multimídia</button></div></div><div class="home-library-head"><span class="home-library-title">Biblioteca</span><span class="home-library-count">6 jogos</span></div></div>
<div class="home-library-rail"><div class="game-grid" id="gameGrid">${games.map(([name,color],i)=>`<div class="card ${i===0?'nav-focused-el':''}" data-id="${name}" tabindex="0"><img src="${portraitArt(name,color)}"><span class="title">${name}</span></div>`).join('')}</div></div>
<div class="home-controls-bar"><span class="gp-hint-label">A · Abrir</span><span class="gp-hint-label">B · Voltar</span><span class="gp-hint-label">Y · Buscar</span></div>
</div></div></div>
<div id="addGameContainer"><div class="modal-layout"><div class="modal-sidebar"><h1 class="sidebar-title">Biblioteca</h1><div class="sidebar-menu"><div><button class="menu-tab active" tabindex="0">Jogos</button><button class="menu-tab" tabindex="0">Aplicativos</button><button class="menu-tab" tabindex="0">Pastas</button></div></div></div><div class="modal-content-area"><div class="view-section active"><div class="view-header"><h2>Adicionar à biblioteca</h2><p class="subtitle">Os mesmos componentes e comandos em outra disposição.</p></div><div class="filter-bar"><button class="filter-btn active" tabindex="0">Instalados</button><button class="filter-btn" tabindex="0">Todos</button></div></div></div></div></div>
<script>
const previewOrbitPackage=${JSON.stringify(orbitPackage)};const previewContract=${JSON.stringify(contract)};window.previewThemes=${JSON.stringify(themes)};
const previewCatalog=${JSON.stringify(catalog)},previewHostListeners=[],previewPackageContract=${JSON.stringify(packageContract)};
let previewSavedTheme='default',previewRevision=1,previewDeviceTheme='default',previewParts=Object.fromEntries(Object.keys(previewPackageContract.parts).filter(part=>part!=='login').map(part=>[part,'default']));
window.chrome.webview={addEventListener:(name,listener)=>previewHostListeners.push(listener),postMessage:text=>{
 const request=JSON.parse(text);if(!['requestThemeSettings','saveThemeSettings','resetThemeSettings','readThemePackage'].includes(request.action))return;
 if(request.action==='resetThemeSettings'){for(const part of Object.keys(previewParts))previewParts[part]='default';previewDeviceTheme='default';previewSavedTheme='default';previewRevision++;}
 if(request.action==='saveThemeSettings'){if(request.part==='login')previewDeviceTheme=request.themeId;else if(request.part==='system'){for(const part of Object.keys(previewParts))previewParts[part]=request.themeId;}else previewParts[request.part||'home']=request.themeId;previewSavedTheme=previewParts.home;previewRevision++;}
 queueMicrotask(()=>previewHostListeners.forEach(listener=>listener({data:{type:'themeSettingsState',requestId:request.requestId,profileId:request.profileId,
 ok:!(window.previewRejectSettingsRead&&request.action==='requestThemeSettings'),generation:'1',revision:String(previewRevision),profileRevision:'1',deviceRevision:String(previewRevision),deviceTheme:previewDeviceTheme,parts:{...previewParts},themeId:previewSavedTheme,themes:previewCatalog,package:request.action==='readThemePackage'?window.previewPackagePayload:undefined}})));
}};
function postToHost(payload){window.chrome.webview.postMessage(JSON.stringify(payload));}
let isModalOpen=false,isEditModalOpen=false,isSetupOpen=false,isCtxMenuOpen=false;
function isVkbOpenForNavigation(){return false;}
${regionScript}
${spatialScript}
window.fetch=async url=>{
 if(String(url).endsWith('themes/contract.json'))return{ok:true,json:async()=>previewContract};
 if(String(url).endsWith('themes/package-contract.json'))return{ok:true,json:async()=>previewPackageContract};
 if(String(url).endsWith('themes/builtin/orbit.json'))return{ok:true,json:async()=>previewOrbitPackage};
 throw Error('Unexpected preview request: '+url);
};
window.previewReady=document.fonts.ready.then(()=>true);
window.previewSetSheet=async href=>{
 const sheet=document.getElementById('sheet');
 if(sheet.href!==href || !sheet.sheet) await new Promise((resolve,reject)=>{sheet.onload=()=>resolve();sheet.onerror=()=>reject(Error('Stylesheet did not load'));sheet.href=href;});
 await document.fonts.ready;
 return true;
};
</script><script src="${webRoot}themes.js"></script><script>window._doorpiCurrentUserId='preview-profile';</script></body></html>`);

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitFor(action, description, timeout = 20000) {
    const started = Date.now();
    while (Date.now() - started < timeout) { const result = await action(); if (result) return result; await sleep(100); }
    throw Error('Timed out: ' + description);
}
async function connect(url) {
    const socket = new WebSocket(url);
    const pending = new Map();
    let next = 0;
    socket.addEventListener('message', event => {
        const response = JSON.parse(event.data);
        const request = pending.get(response.id);
        if (!request) return;
        pending.delete(response.id);
        clearTimeout(request.timeout);
        if (response.error) request.reject(Error(JSON.stringify(response.error))); else request.resolve(response.result);
    });
    await new Promise((resolve,reject) => { socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true}); });
    return {
        send(method, params = {}) { return new Promise((resolve,reject) => {
            const id=++next;
            const timeout=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout: '+method));},20000);
            pending.set(id,{resolve,reject,timeout});socket.send(JSON.stringify({id,method,params}));
        }); },
        close: () => socket.close()
    };
}
const measure = `(() => {
 const properties=['display','visibility','pointer-events','position','width','height','padding','margin','font-family','font-size','font-weight','line-height','letter-spacing','color','background-color','background-image','border-radius','border-color','border-width','filter','box-shadow','opacity','transform','grid-template-rows','grid-template-columns','gap','overflow'];
 return [...document.querySelectorAll('body, #doorpi-app-ui *, #addGameContainer, #addGameContainer *')].map((el,i)=>{const css=getComputedStyle(el),rect=el.getBoundingClientRect();return {i,tag:el.tagName,id:el.id,class:el.className,rect:[rect.x,rect.y,rect.width,rect.height].map(n=>Math.round(n*100)/100),css:Object.fromEntries(properties.map(p=>[p,css.getPropertyValue(p)]))};});
})()`;
(async () => {
    const chromePath = process.env.DOORPI_PREVIEW_CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    if (!fs.existsSync(chromePath)) throw Error('Set DOORPI_PREVIEW_CHROME to a Chromium browser executable.');
    const profile = path.join(output,'browser-profile-'+Date.now());
    const log = fs.openSync(path.join(output,'browser.log'),'a');
    const chrome = spawn(chromePath, ['--headless=new','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--disable-extensions','--mute-audio','--allow-file-access-from-files','--remote-debugging-port=0','--remote-debugging-address=127.0.0.1','--user-data-dir='+profile,'about:blank'], {windowsHide:true,stdio:['ignore','ignore',log]});
    let launchError;
    chrome.on('error', error => launchError = error);
    let client;
    try {
        const portFile = path.join(profile,'DevToolsActivePort');
        await waitFor(()=>{
            if (launchError) throw launchError;
            if (chrome.exitCode !== null) throw Error('Chromium exited before debugging was available. See browser.log.');
            return fs.existsSync(portFile);
        },'isolated Chromium startup');
        let port;
        await waitFor(()=>{try{port=fs.readFileSync(portFile,'utf8').split(/\r?\n/)[0];return /^\d+$/.test(port);}catch(error){if(['EBUSY','ENOENT'].includes(error.code))return false;throw error;}},'debugging port file ready');
        const targets=await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
        client=await connect(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
        async function evaluate(expression) {
            const result=await client.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
            if(result.exceptionDetails) throw Error(result.exceptionDetails.text+' '+JSON.stringify(result.exceptionDetails.exception));
            return result.result.value;
        }
        await client.send('Page.enable');
        // Headless tabs can have an inactive document: .focus() then changes
        // activeElement without focusin. Exercise the foreground input context.
        await client.send('Emulation.setFocusEmulationEnabled',{enabled:true});
        await client.send('Page.navigate',{url:pathToFileURL(fixturePath).href});
        await waitFor(()=>evaluate("document.readyState==='complete' && !!window.DoorpiThemes"),'theme fixture');
        await evaluate('window.previewReady');
        assert.equal(await evaluate(`(async()=>{
            try { await DoorpiThemes.apply({...previewThemes.aurora,tokens:{'--doorpi-home-title-color':'42px'}});return false; }
            catch { return DoorpiThemes.activeId===null; }
        })()`),true,'The real CSS parser must reject a value with the wrong type');
        // Historical extraction proofs are opt-in after authorized default redesigns.
        const baseline=process.env.DOORPI_THEME_BASELINE_CSS
            ? path.resolve(root,process.env.DOORPI_THEME_BASELINE_CSS)
            : path.join(output,'no-historical-baseline-selected.css');
        const baselinePreview=path.join(output,'baseline-preview.css');
        if(fs.existsSync(baseline)) fs.writeFileSync(baselinePreview,fs.readFileSync(baseline,'utf8').replace(/url\('fonts\//g,`url('${webRoot}fonts/`));
        const report=[];
        for(const [width,height] of [[1280,720],[1920,1080],[1024,768],[3840,2160]]) {
            console.log(`Checking ${width}x${height}...`);
            await client.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
            await evaluate('DoorpiThemes.reset()');
            await evaluate(`previewSetSheet(${JSON.stringify(webRoot+'style.css')})`);
            const current=await evaluate(measure);
            if(fs.existsSync(baseline)) {
                await evaluate(`previewSetSheet(${JSON.stringify(pathToFileURL(baselinePreview).href)})`);
                const before=await evaluate(measure);
                assert.deepEqual(current,before,`Default appearance/layout changed at ${width}x${height}`);
                await evaluate(`previewSetSheet(${JSON.stringify(webRoot+'style.css')})`);
            }
            for(const id of ['default','aurora','ember','orbit']) {
                await evaluate("DoorpiThemePackageRuntime.reset('home')");
                if(id==='default') await evaluate('DoorpiThemes.reset()');
                else await evaluate(`DoorpiThemes.apply(previewThemes.${id})`);
                await evaluate('document.fonts.ready.then(()=>true)');
                const entryCheck=await evaluate(`(()=>{
                    const cards=[...document.querySelectorAll('#gameGrid .card')];
                    cards[1].focus();document.querySelector('.home-tab').focus();
                    const entered=DoorpiNavigation.enter('home');
                    const result={entered,restored:document.activeElement===cards[1],region:DoorpiNavigation.getRegionId(),active:document.activeElement?.outerHTML?.slice(0,200),dimensions:cards.map(c=>[c.offsetWidth,c.offsetHeight])};
                    cards[0].focus();return result;
                })()`);
                assert.ok(entryCheck.entered && entryCheck.restored && entryCheck.region===0,'Home entry must restore carousel region 0: '+JSON.stringify(entryCheck));
                for (const [w,h] of entryCheck.dimensions) assert.ok(Math.abs(h/w-1.5)<.02,`Portrait SteamGrid 2:3 required: ${id} ${w}x${h}`);
                if(id!=='default') {
                    const family=themes[id].tokens['--doorpi-font-family'].split(',')[0].replace(/['"]/g,'');
                    assert.ok((await evaluate('getComputedStyle(document.body).fontFamily')).includes(family),'Theme typography must reach the effective body declaration');
                }
                const metrics=await evaluate(measure);
                assert.equal(metrics.length,current.length,'Theme must preserve the component tree');
                const focus=metrics.find(el=>el.class.includes('card nav-focused-el'));
                assert.ok(focus && focus.rect[2]>0 && focus.rect[3]>0 && focus.rect[0]<width && focus.rect[1]<height,'Focused card stays visible');
                assert.notEqual(focus.css.visibility,'hidden');
                assert.notEqual(focus.css['pointer-events'],'none');
                if(id==='aurora') {
                    const region=selector=>evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom};})()`);
                    const library=await region('.home-library-rail'),feature=await region('.home-feature-stage');
                    const art=await region('.home-feature-art-shell'),copy=await region('.home-feature-copy');
                    const meta=await region('.home-feature-meta'),title=await region('.home-feature-title');
                    assert.ok(library.bottom<=feature.y,'The carousel must actually move above the feature');
                    assert.ok(art.x>=copy.right-1,'Art must actually move to the right of the text');
                    if(id==='aurora') assert.ok(meta.bottom<=title.y,'Metadata must actually move above the title');
                }
                if(id==='orbit') {
                    const background=await evaluate("(()=>{const el=document.getElementById('heroImage'),css=getComputedStyle(el);return {height:el.getBoundingClientRect().height,opacity:css.opacity,mask:css.maskImage,loaded:el.complete&&el.naturalWidth>0};})()");
                    assert.ok(background.loaded && Math.abs(background.height-height)<1,'Orbit atmosphere must cover the viewport with a real hero image');
                    assert.equal(background.opacity,'0.12');
                    assert.ok(background.mask.includes('90deg'),'Orbit keeps its dossier clear of the background');
                    await evaluate("DoorpiThemePackageRuntime.configure(previewPackageContract,previewContract);DoorpiThemePackageRuntime.install('home',DoorpiThemePackageRuntime.prepare('home',previewOrbitPackage.parts.home.css,previewOrbitPackage.assets,previewPackageContract.parts.home,'orbit'))");
                }
                const image=await client.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
                fs.writeFileSync(path.join(output,`${id}-${width}x${height}.png`),Buffer.from(image.data,'base64'));
                report.push({id,width,height,elements:metrics.length,focusedCard:focus.rect});
                await evaluate("(()=>{const modal=document.getElementById('addGameContainer');modal.style.display='flex';modal.classList.add('is-open');isModalOpen=true;})()");
                assert.equal(await evaluate("(()=>{const tab=document.querySelector('#addGameContainer .menu-tab');tab.focus();return DoorpiNavigation.enter('home')===false && document.activeElement===tab;})()"),true,'Region 0 must not steal focus from a modal');
                const sidebar=await evaluate("(()=>{const a=document.querySelector('.modal-sidebar').getBoundingClientRect(),b=document.querySelector('.modal-content-area').getBoundingClientRect();return {sidebar:a.x,content:b.x,width:a.width};})()");
                assert.ok(sidebar.width>0);
                assert.ok(themes[id]?.layout?.dialog==='right'?sidebar.sidebar>sidebar.content:sidebar.sidebar<sidebar.content,'Sidebar must follow the selected dialog layout');
                const dialogImage=await client.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
                fs.writeFileSync(path.join(output,`${id}-dialog-${width}x${height}.png`),Buffer.from(dialogImage.data,'base64'));
                report.push({id,screen:'add-dialog',width,height,sidebar});
                await evaluate("(()=>{const modal=document.getElementById('addGameContainer');modal.style.display='none';modal.classList.remove('is-open');isModalOpen=false;DoorpiNavigation.enter('home');})()");
            }
        }
        await evaluate(`(async()=>{await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=${JSON.stringify(pathToFileURL(navFixture).href)};script.onload=resolve;script.onerror=reject;document.body.appendChild(script);});
            previewHostListeners.forEach(listener=>listener({data:{type:'currentUserUpdated',currentUserId:'preview-profile'}}));
            await DoorpiThemeSelection.whenReady();return true;})()`);
        for (const [width,height] of [[1280,720],[1920,1080],[1024,768],[3840,2160]]) {
            await client.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
            const hub=await evaluate(`(()=>{
                previewOpenSettings();
                const visual=[...document.querySelectorAll('.nav-settings-home-item')].map(el=>el.id),down=[document.activeElement.id],up=[];
                for(let i=1;i<visual.length;i++){_navMenuHandleKey('ArrowDown');down.push(document.activeElement.id);}
                for(let i=1;i<visual.length;i++){_navMenuHandleKey('ArrowUp');up.push(document.activeElement.id);}
                return {visual,down,up};
            })()`);
            assert.deepEqual(hub.down,hub.visual,'Settings Down must follow displayed group order, including Themes');
            assert.deepEqual(hub.up,hub.visual.slice(0,-1).reverse(),'Settings Up must reverse the displayed order');
            await evaluate("_navMenuHandleKey('ArrowDown');");
            assert.equal(await evaluate('document.activeElement.id'),'setThemes','Account Down must reach Themes');
            await evaluate("_navMenuHandleKey('Enter');");
            const headerNavigation=await evaluate(`(()=>{
                const headers=['themeSettingsBack','themeImportPackage','themeRestoreDefault'];
                const result=[];
                for(const button of document.querySelectorAll('[data-theme-area]')){
                    previewFocusTheme(button.id);_navMenuHandleKey('ArrowUp');result.push({area:button.id,up:document.activeElement.id});
                }
                previewFocusTheme(headers[0]);_navMenuHandleKey('ArrowRight');const right1=document.activeElement.id;
                _navMenuHandleKey('ArrowRight');const right2=document.activeElement.id;
                _navMenuHandleKey('ArrowUp');const topbar=!!document.querySelector('.nav-cat-item.nav-focused')&&!document.querySelector('#themeSettingsRoot .nav-focused-el');
                _navMenuHandleKey('ArrowDown');const down=document.activeElement.id;
                window.isDoorpiFileBrowserOpen=()=>true;
                const focus=document.activeElement.id,handled=_navMenuHandleKey('ArrowRight');
                const event=new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true});document.dispatchEvent(event);
                const pickerPriority=!handled&&document.activeElement.id===focus&&!event.defaultPrevented;
                delete window.isDoorpiFileBrowserOpen;
                return {result,right1,right2,topbar,down,pickerPriority};
            })()`);
            for(const step of headerNavigation.result)assert.ok(['themeSettingsBack','themeImportPackage','themeRestoreDefault','theme-group-system','theme-area-login','theme-area-system','theme-area-home','theme-area-nav-menu','theme-area-side-panels','theme-area-popups'].includes(step.up),'Up must pass through scope/module/header rows from '+step.area+': '+JSON.stringify(headerNavigation));
            assert.equal(headerNavigation.right1,'themeImportPackage');assert.equal(headerNavigation.right2,'themeRestoreDefault');
            assert.ok(headerNavigation.topbar);assert.equal(headerNavigation.down,'themeSettingsBack');assert.ok(headerNavigation.pickerPriority,'File browser owns input above theme settings');
            assert.equal(await evaluate("document.querySelectorAll('.theme-choice').length"),2,'Actual settings entry must show Default and Orbit');
            assert.equal(await evaluate("document.querySelectorAll('.theme-choice-preview,.theme-mini-carousel').length"),0,'Installed theme selection has names, without mockups');
            await evaluate("previewFocusTheme('theme-choice-default');_navMenuHandleKey('ArrowDown');");
            assert.equal(await evaluate('document.activeElement.id'),'theme-choice-orbit','Controller Down must reach the next theme row');
            await evaluate("_navMenuHandleKey('Enter');true;");
            await waitFor(()=>evaluate("!DoorpiThemeSelection.getState().busy && DoorpiThemeSelection.getState().savedId==='orbit'"),'Orbit selection saved');
            assert.equal(await evaluate("document.querySelector('.theme-choice.is-selected').dataset.themeId"),'orbit');
            const selected=await client.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
            fs.writeFileSync(path.join(output,`settings-orbit-${width}x${height}.png`),Buffer.from(selected.data,'base64'));
            await evaluate("previewFocusTheme('themeRestoreDefault');_navMenuHandleKey('Enter');");
            assert.equal(await evaluate('DoorpiThemes.activeId'),null,'Restore Default applies immediately');
            await waitFor(()=>evaluate("!DoorpiThemeSelection.getState().busy && DoorpiThemeSelection.getState().savedId==='default'"),'Default selection saved');
            const restored=await client.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
            fs.writeFileSync(path.join(output,`settings-default-${width}x${height}.png`),Buffer.from(restored.data,'base64'));
            report.push({screen:'theme-settings',width,height,checks:['real settings entry','controller direction/Enter','Orbit saved','Default restored']});
            await evaluate("_navMenuHandleKey('Escape');");
            assert.equal(await evaluate('document.activeElement.id'),'setThemes','Back restores Themes in the settings hub');
        }
        // Community packages are fixture descriptors only: no downloads/installation.
        await evaluate(`(async()=>{previewCatalog.push(...Array.from({length:30},(_,i)=>({id:'community-'+(i+1),name:'Tema da comunidade '+String(i+1).padStart(2,'0'),description:'Fixture',parts:['home','nav-menu','side-panels','popups'],manifest:'themes/builtin/community-'+(i+1)+'.json'})));await DoorpiThemeSelection.refresh();return true;})()`);
        for (const [width,height] of [[1280,720],[1920,1080],[1024,768],[3840,2160]]) {
            await client.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
            await evaluate("previewOpenSettings();_navMenuHandleKey('ArrowDown');_navMenuHandleKey('Enter');");
            await evaluate("window.previewListHeaderTop=document.querySelector('.theme-settings-header').getBoundingClientRect().top;for(let i=1;i<previewCatalog.length;i++)_navMenuHandleKey('ArrowDown');");
            await waitFor(()=>evaluate("(()=>{const item=document.activeElement.getBoundingClientRect(),list=document.getElementById('themeSettingsList').getBoundingClientRect();return item.top>=list.top-1&&item.bottom<=list.bottom+1;})()"),'Last installed theme revealed by smooth scrolling');
            const many=await evaluate(`(()=>{
                const list=document.getElementById('themeSettingsList'),header=document.querySelector('.theme-settings-header');
                const active=document.activeElement.getBoundingClientRect(),viewport=list.getBoundingClientRect();
                const restore=document.getElementById('themeRestoreDefault'),rect=restore.getBoundingClientRect(),css=getComputedStyle(restore);
                return {count:list.children.length,id:document.activeElement.id,scroll:list.scrollTop,active:[active.top,active.bottom],viewport:[viewport.top,viewport.bottom],headerBefore:previewListHeaderTop,headerAfter:header.getBoundingClientRect().top,bodyScroll:document.getElementById('navContentBody').scrollTop,
                  restore:{x:rect.x,y:rect.y,width:rect.width,height:rect.height,right:rect.right,bottom:rect.bottom,opacity:css.opacity,visibility:css.visibility,display:css.display,hit:document.elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2)?.closest('#themeRestoreDefault')===restore}};
            })()`);
            assert.equal(many.count,32);assert.equal(many.id,'theme-choice-community-30');
            assert.ok(many.scroll>0 && many.active[0]>=many.viewport[0]-1 && many.active[1]<=many.viewport[1]+1,'Last of 32 theme names must remain visible: '+JSON.stringify(many));
            assert.equal(many.headerAfter,many.headerBefore,'Theme list scroll must not move the restore controls');
            assert.equal(many.bodyScroll,0,'Only the installed theme list scrolls');
            assert.ok(many.restore.hit && many.restore.x>=0 && many.restore.right<=width && many.restore.y>=0 && many.restore.bottom<=height && many.restore.width>0 && Number(many.restore.opacity)>0 && many.restore.visibility==='visible','Restore Default stays visibly available and clickable: '+JSON.stringify(many.restore));
            await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
            const screenshot=await client.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
            fs.writeFileSync(path.join(output,`settings-many-${width}x${height}.png`),Buffer.from(screenshot.data,'base64'));
            await evaluate("for(let i=1;i<previewCatalog.length;i++)_navMenuHandleKey('ArrowUp');");
            assert.equal(await evaluate('document.activeElement.id'),'theme-choice-default','Up must revisit every installed theme through Default');
            await evaluate("_navMenuHandleKey('ArrowUp');");
            assert.equal(await evaluate('document.activeElement.id'),'theme-area-system','Up returns to the selected area');
            assert.equal(await evaluate("previewFocusTheme('themeRestoreDefault')"),true,'Restore remains in the controller focus inventory');
            await evaluate("_navMenuHandleKey('Escape');");
            assert.equal(await evaluate('document.activeElement.id'),'setThemes');
            report.push({screen:'theme-settings-many',width,height,themes:32,checks:['visual hub order both directions','scroll last/first','fixed restore controls','Back focus restored']});
        }
        // Real package compiler: scoping, blocked resources/code, and independent area selection.
        await evaluate(`(()=>{
            Object.assign(DoorpiThemePackageRuntime.tokenDefaults,previewContract.tokens);
            const definition=previewPackageContract.parts['nav-menu'];
            const rejected=['@import "https://example.com/a.css";','button{background:url(https://example.com/a.png)}','button{background:image-set("https://example.com/a.png" 1x)}','button { color:red;','@namespace x "http://example.com";'];
            for(const css of rejected){let failed=false;try{DoorpiThemePackageRuntime.prepare('nav-menu',css,{},definition,'test');}catch{failed=true;}if(!failed)throw Error('Invalid CSS accepted: '+css);}
            return true;
        })()`);
        const testId='pkg-0123456789abcdef01234567';
        const payload={id:testId,parts:{home:{css:'.card{height:80px!important;aspect-ratio:1!important}',appearance:{schemaVersion:1,apiVersion:1,id:'fixture',name:'Fixture',tokens:{'--doorpi-font-family':'Georgia, serif','--doorpi-card-radius':'22px'}}},'nav-menu':{css:':scope{background-color:rgb(31,44,60)}button{color:rgb(55,210,160)}',appearance:null},popups:{css:':scope{background:rgb(62,28,80)!important}',appearance:null}},assets:{}};
        await evaluate(`(async()=>{
            previewCatalog.push({id:${JSON.stringify(testId)},name:'Fixture modular',description:'Fixture',manifest:null,parts:['home','nav-menu','popups']});
            window.previewPackagePayload=${JSON.stringify(payload)};
            document.getElementById('navMenuOverlay').style.removeProperty('background');
            await DoorpiThemeSelection.refresh();
            window.previewOriginalBodyFont=getComputedStyle(document.body).fontFamily;
            await DoorpiThemeSelection.select(${JSON.stringify(testId)},'nav-menu');
            await DoorpiThemeSelection.select(${JSON.stringify(testId)},'popups');
            await DoorpiThemeSelection.select(${JSON.stringify(testId)},'home');
            const popup=document.createElement('div');popup.id='fixturePopup';popup.className='edit-modal-overlay';popup.innerHTML='<button id="fixturePopupButton">Popup fixture</button>';document.getElementById('navMenuOverlay').appendChild(popup);
            return true;
        })()`);
        assert.equal(await evaluate("getComputedStyle(document.getElementById('navMenuOverlay')).backgroundColor"),'rgb(31, 44, 60)',JSON.stringify(await evaluate("({state:DoorpiThemeSelection.getState(),css:[...document.querySelectorAll('[data-doorpi-theme-part]')].map(el=>el.textContent)})")));
        assert.equal(await evaluate("getComputedStyle(document.getElementById('fixturePopup')).backgroundColor"),'rgb(62, 28, 80)',JSON.stringify(await evaluate("({state:DoorpiThemeSelection.getState(),css:[...document.querySelectorAll('[data-doorpi-theme-part]')].map(el=>el.textContent)})")));
        assert.equal(await evaluate("[...document.querySelectorAll('#gameGrid .card')].every(card=>Math.abs(card.offsetHeight/card.offsetWidth-1.5)<.02)"),true,'Core ratio guard must override a package requesting square cards');
        assert.equal(await evaluate("getComputedStyle(document.body).fontFamily===previewOriginalBodyFont"),true,'Home typography stays local');
        assert.equal(await evaluate("getComputedStyle(document.getElementById('doorpi-app-ui')).fontFamily.includes('Georgia')"),true,'Home receives its chosen typography');
        assert.equal(await evaluate("getComputedStyle(document.querySelector('#gameGrid .card')).borderRadius"),'22px','Home radius alias is resolved within its owner');
        assert.notEqual(await evaluate("getComputedStyle(document.getElementById('fixturePopupButton')).color"),'rgb(55, 210, 160)','Nested popup is excluded from nav-menu selectors');
        await evaluate("DoorpiThemeSelection.select('orbit','home')");
        await evaluate("previewOpenSettings();_navMenuHandleKey('ArrowDown');_navMenuHandleKey('Enter');");
        assert.equal(await evaluate("previewFocusTheme('themeRestoreDefault')"),true,'Bulk reset is exercised through the actual settings button');
        await evaluate("previewFocusTheme('themeRestoreDefault');_navMenuHandleKey('Enter');");
        await waitFor(()=>evaluate("!DoorpiThemeSelection.getState().busy&&Object.values(DoorpiThemeSelection.getState().savedParts).every(id=>id==='default')"),'Global theme restoration');
        assert.equal(await evaluate("Object.values(DoorpiThemeSelection.getState().activeParts).every(id=>id==='default')"),true,'Restore Default resets every active area');
        await evaluate(`(async()=>{await DoorpiThemeSelection.select(${JSON.stringify(testId)},'nav-menu');await DoorpiThemeSelection.select(${JSON.stringify(testId)},'popups');await DoorpiThemeSelection.select('orbit','home');})()`);
        await evaluate("DoorpiThemeSelection.select('default','home')");
        assert.equal(await evaluate("DoorpiThemeSelection.getState().activeParts['nav-menu']"),testId,'Reset Home preserves nav-menu package');
        assert.equal(await evaluate("DoorpiThemeSelection.getState().activeParts.popups"),testId,'Reset Home preserves popup package');
        const outside=await evaluate("getComputedStyle(document.querySelector('.home-tab')).color");
        assert.notEqual(outside,'rgb(55, 210, 160)','Package CSS cannot reach another area');
        await evaluate("previewOpenSettings();_navMenuHandleKey('ArrowDown');_navMenuHandleKey('Enter');");
        assert.notEqual(await evaluate("getComputedStyle(document.getElementById('themeRestoreDefault')).color"),'rgb(55, 210, 160)','Theme settings remain core-owned inside nav-menu');
        await evaluate("(async()=>{await DoorpiThemeSelection.select('default','nav-menu');await DoorpiThemeSelection.select('default','popups');document.getElementById('fixturePopup').remove();document.getElementById('navMenuOverlay').style.display='none';window.isNavMenuOpen=false;document.body.classList.remove('nav-menu-active');})()");
        await evaluate("(async()=>{previewOpenSettings();_navMenuHandleKey('ArrowDown');_navMenuHandleKey('Enter');window.previewRejectSettingsRead=true;await DoorpiThemeSelection.refresh();return true;})()");
        assert.equal(await evaluate("!document.getElementById('themeSettingsRetry').hidden"),true,'Preference loading error offers Retry');
        await evaluate("window.previewRejectSettingsRead=false;document.getElementById('themeSettingsRetry').click();");
        await waitFor(()=>evaluate("!DoorpiThemeSelection.getState().busy&&!DoorpiThemeSelection.getState().error"),'Theme settings retry');
        assert.equal(await evaluate("document.getElementById('themeSettingsRetry').hidden"),true);
        await evaluate("document.getElementById('navMenuOverlay').style.display='none';window.isNavMenuOpen=false;document.body.classList.remove('nav-menu-active');");
        report.push({screen:'modular-package',checks:['CSS scoping','blocked network/imports/incomplete CSS','independent Home/menu/popup','protected settings','card aspect protection','retry recovery']});
        // Trailer uses the same media nodes while changing theme and cinema geometry.
        await evaluate(`(()=>{
            const layer=document.createElement('div');layer.className='home-trailer-layer';layer.innerHTML='<div id="homeTrailerBackdrop" class="home-trailer-backdrop"><video class="home-trailer-media is-active" poster="'+document.getElementById('homeFeatureArt').src+'"></video><div class="home-trailer-embed"><iframe title="player fixture" srcdoc="player fixture"></iframe></div></div>';
            document.getElementById('doorpi-app-ui').appendChild(layer);window.fixturePlayer=document.querySelector('.home-trailer-embed iframe');return true;
        })()`);
        for(const [width,height] of [[1280,720],[1920,1080],[1024,768],[3840,2160]]){
            await client.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
            await evaluate("DoorpiThemes.apply(previewThemes.orbit).then(()=>{DoorpiThemePackageRuntime.install('home',DoorpiThemePackageRuntime.prepare('home',previewOrbitPackage.parts.home.css,{},previewPackageContract.parts.home,'orbit'));document.body.classList.add('home-trailer-playing');DoorpiTrailerLayout.refresh();return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));})");
            const trailer=await evaluate("(()=>{const a=document.querySelector('.home-feature-art-shell').getBoundingClientRect(),b=document.getElementById('homeTrailerBackdrop').getBoundingClientRect();return {art:[a.x,a.y,a.width,a.height],player:[b.x,b.y,b.width,b.height],same:fixturePlayer===document.querySelector('.home-trailer-embed iframe')};})()");
            assert.ok(trailer.same);trailer.art.forEach((value,index)=>assert.ok(Math.abs(value-trailer.player[index])<1,'Trailer must occupy the actual art region: '+JSON.stringify(trailer)));
            const shot=await client.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(output,`orbit-trailer-${width}x${height}.png`),Buffer.from(shot.data,'base64'));
            const cinema=await evaluate("(()=>{document.body.classList.add('home-trailer-cinema');const rect=document.getElementById('homeTrailerBackdrop').getBoundingClientRect();return [rect.x,rect.y,rect.width,rect.height];})()");
            assert.deepEqual(cinema,[0,0,width,height]);
            assert.ok(await evaluate("(()=>{const r=document.querySelector('.home-feature-copy').getBoundingClientRect();return r.width<=innerWidth*.45+1&&r.x>=0&&r.right<=innerWidth&&r.y>=0&&r.bottom<=innerHeight;})()"),'Orbit manual cinema keeps a compact information panel');
            await evaluate("document.body.classList.remove('home-trailer-cinema','home-trailer-playing');DoorpiThemePackageRuntime.reset('home');DoorpiThemes.reset();");
            report.push({screen:'trailer',width,height,checks:['art region','same iframe','cinema viewport','Default reset']});
        }
        // Exercise the real notification and menu, including the deferred category
        // render that previously reset the destination after the opener returned.
        await evaluate(`(async()=>{
            for(const src of [${JSON.stringify(webRoot+'strings.js')},${JSON.stringify(pathToFileURL(notificationFixture).href)}]){
                await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=src;script.onload=resolve;script.onerror=reject;document.body.appendChild(script);});
            }
            setLang('pt-BR');window._doorpiProfile={Id:'preview-profile',Name:'Fixture'};
            const previousFetch=window.fetch;
            window.fetch=async url=>{
                if(!String(url).startsWith('https://data.local/'))return previousFetch(url);
                const pathname=new URL(url).pathname;
                const value=pathname==='/games.json'?Array.from({length:50},(_,i)=>({Name:'Fixture '+i,Path:'fixture-'+i,Source:'Steam',GridImage:${JSON.stringify(games.map(([name,color])=>portraitArt(name,color)))}[i%6],IsPendingArtwork:i===49}))
                    :pathname==='/user.json'?window._doorpiProfile:[];
                return {ok:true,json:async()=>value};
            };
            previewResetClosedMenu();DoorpiNotifications.setExtensionUpdates({'fixture-extension':{version:'2'}});
            DoorpiNotifications.open();document.querySelector('[data-notification-id=extension-updates]').click();
        })()`);
        await waitFor(()=>evaluate("!!document.getElementById('navExtStoreBtn')&&!!document.getElementById('navExtManualBtn')"),'notification lands inside Extensions');
        await sleep(300);
        assert.ok(await evaluate("!!document.getElementById('navExtensionsList')&&!document.getElementById('setExt')&&!isDoorpiNotificationCenterOpen()"),'Deferred selection cannot replace Extensions with the settings root');
        await evaluate("previewOpenSettings();document.getElementById('setExt').click()");
        await waitFor(()=>evaluate("!!document.getElementById('navExtensionsList')"),'existing settings button still opens Extensions');
        report.push({screen:'extension-notification',checks:['real notification click','real menu open','extension subview remains after RAF','settings button retained']});
        await evaluate("previewResetClosedMenu();openNavMenu(0)");
        assert.equal(await evaluate("document.getElementById('navContentSub').textContent"),'50 jogos na biblioteca','Complete library total includes artwork-pending items');
        await evaluate("document.querySelector('#navPaneGames [data-library-action=search]').click();const search=document.querySelector('#navPaneGames input[type=search]');search.value='Fixture 1';search.dispatchEvent(new Event('input',{bubbles:true}));");
        assert.equal(await evaluate("document.getElementById('navContentSub').textContent"),'11 de 50 jogos','Search shows matches against the complete collection');
        report.push({screen:'library-total',checks:['complete total exceeds Home carousel','pending artwork counted','filtered matches versus total']});
        await evaluate(`(async()=>{
            for(const part of Object.keys(previewOrbitPackage.parts))await DoorpiThemeSelection.select('orbit',part);
            const search=document.querySelector('#navPaneGames input[type=search]');search.value='';search.dispatchEvent(new Event('input',{bubbles:true}));
            document.querySelector('#navPaneGames .nav-library-search-cancel').click();
        })()`);
        assert.deepEqual(await evaluate('DoorpiThemeSelection.getState().activeParts'),Object.fromEntries(Object.keys(packageContract.parts).map(part=>[part,'orbit'])),'Every built-in component goes through the SDK selector');
        for(const [width,height] of [[1280,720],[1920,1080],[2560,1440],[1024,768],[3840,2160]]){
            await client.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
            await evaluate("document.getElementById('navPaneGames').scrollTop=0;document.querySelector('#navPaneGames .nav-vertical-card').dispatchEvent(new Event('mouseenter'))");await sleep(180);
            const geometry=await evaluate(`(()=>{const box=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};return {tool:box('#navPaneGames .nav-library-actions'),card:box('#navPaneGames .nav-vertical-card'),header:box('#navHeaderWrap'),columns:getComputedStyle(document.querySelector('#navPaneGames .nav-big-grid')).gridTemplateColumns.split(' ').length};})()`);
            assert.ok(geometry.tool.right<=geometry.card.x&&geometry.tool.x>=0,'Library tools must clear the catalogue: '+JSON.stringify({width,height,geometry}));
            assert.ok(geometry.tool.right<=geometry.header.x,'Library tools do not cover its heading');
            assert.ok(geometry.card.y>=0&&geometry.card.right<=width,'First library card fits');
            await evaluate("document.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true}))");
            assert.equal(await evaluate("Number(document.querySelector('#navPaneGames .nav-vertical-card.nav-focused').dataset.idx)"),geometry.columns,'Down follows the actual theme columns');
            await evaluate("document.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowUp',bubbles:true,cancelable:true}))");
            assert.equal(await evaluate("Number(document.querySelector('#navPaneGames .nav-vertical-card.nav-focused').dataset.idx)"),0);
            await evaluate("document.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowUp',bubbles:true,cancelable:true}))");
            assert.equal(await evaluate("document.activeElement.matches('.nav-cat-item.nav-focused')&&!document.querySelector('.nav-vertical-card.nav-focused,.nav-vertical-card:focus')"),true,'Returning to categories removes visual and DOM focus from cards');
            await evaluate("document.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true}))");
            const shot=await client.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(output,`orbit-library-${width}x${height}.png`),Buffer.from(shot.data,'base64'));
            report.push({screen:'orbit-library',width,height,checks:['all five SDK areas','labelled tools','responsive columns','real Down/Up navigation'],geometry});
        }
        await client.send('Emulation.setDeviceMetricsOverride',{width:2560,height:1440,deviceScaleFactor:1,mobile:false});
        await evaluate("document.querySelector('#navPaneGames [data-library-action=filters]').click()");
        assert.ok(await evaluate("(()=>{const r=document.querySelector('.nav-library-filter-panel.is-open').getBoundingClientRect();return r.x>=0&&r.right<=innerWidth&&r.y>=0&&r.bottom<=innerHeight;})()"),'Filters fit the themed library');
        let orbitShot=await client.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(output,'orbit-library-filters-1440p.png'),Buffer.from(orbitShot.data,'base64'));
        await evaluate("document.querySelector('[data-filter-command=done]').click();previewResetClosedMenu();document.getElementById('navMenuOverlay').style.removeProperty('background');openNavMenu(2)");
        orbitShot=await client.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(output,'orbit-settings-1440p.png'),Buffer.from(orbitShot.data,'base64'));
        await evaluate("previewResetClosedMenu();const modal=document.getElementById('addGameContainer');modal.style.display='flex';modal.classList.add('is-open')");
        orbitShot=await client.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(output,'orbit-add-library-1440p.png'),Buffer.from(orbitShot.data,'base64'));
        await evaluate(`(async()=>{
            document.getElementById('addGameContainer').style.display='none';
            const style=document.createElement('style');style.textContent=${JSON.stringify(fs.readFileSync(path.join(frontend,'injected-styles/app/auxiliary-style-installation-1.css'),'utf8'))};document.head.appendChild(style);
            await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=${JSON.stringify(pathToFileURL(path.join(root,'ThemeSDK/studio/fixtures.js')).href)};script.onload=resolve;script.onerror=reject;document.body.appendChild(script);});
            const host=document.createElement('div');host.innerHTML=DoorpiThemeFixtures.popups;const popup=host.firstElementChild;popup.id='orbitPopup';document.body.appendChild(popup);
            popup.querySelector('input').focus();
        })()`);
        for(const [width,height] of [[1280,720],[2560,1440]]){
            await client.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
            assert.ok(await evaluate("(()=>{const r=document.querySelector('#orbitPopup .edit-modal').getBoundingClientRect(),a=document.querySelector('#orbitPopup .edit-modal-actions').getBoundingClientRect();return r.x>=0&&r.right<=innerWidth&&r.y>=0&&r.bottom<=innerHeight&&a.bottom<=r.bottom;})()"),'Orbit editor and its actions fit the viewport');
            orbitShot=await client.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(output,`orbit-popup-${width}x${height}.png`),Buffer.from(orbitShot.data,'base64'));
            report.push({screen:'orbit-popup',width,height,checks:['right sheet','fields and actions remain visible']});
        }
        // Actual editor and artwork wizard, with only native persistence stubbed.
        await evaluate(`(()=>{
            document.getElementById('orbitPopup').remove();window.isNavMenuOpen=false;
            window.ensureDoorpiOverlayStyles=()=>{};window.escapeHtml=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
            window._vkbForceClose=()=>{};window.focusFeaturedCard=()=>{};window.getCurrentHomeTab=()=> 'games';
            window.AppStore={queries:{getItem:()=>null},mutations:{patchItem:()=>{}}};
            window.previewEditorMessages=[];postToHost=data=>previewEditorMessages.push(data);
            ${fs.readFileSync(path.join(frontend,'scripts/app/220-artwork-wizard.js'),'utf8')}
            ${fs.readFileSync(path.join(frontend,'scripts/app/230-item-editor.js'),'utf8')}
            const card=document.createElement('div');card.className='card';card.dataset.gameId='fixture-editor';card.dataset.path='fixture.exe';card.dataset.channel='games';card.innerHTML='<span class="title">Fixture game</span>';document.body.appendChild(card);
            window.previewEdit=()=>openEditGameModal(card);
        })()`);
        await evaluate('previewEdit()');
        assert.equal(await evaluate("document.getElementById('editSaveBtn').hidden"),true,'No Save action without changes');
        await evaluate("document.getElementById('editTrailerUrlBtn').click();const field=document.getElementById('editTrailerUrlInput');field.value='https://youtube.com/watch?v=fixture';field.dispatchEvent(new Event('input',{bubbles:true}));");
        assert.equal(await evaluate("document.getElementById('editSaveBtn').hidden"),false,'Trailer edit exposes Save');
        await evaluate("window._editModalSave()");await sleep(160);
        assert.equal(await evaluate("previewEditorMessages.find(m=>m.action==='editGame').newTrailerSource"),'https://youtube.com/watch?v=fixture');
        await evaluate("previewEdit();document.getElementById('editArtworkLocalBtn').click();_artworkWizardHandleApplied({images:{vertical:'fixture.png'}})");
        assert.equal(await evaluate('isEditModalOpen'),false,'Committed art closes a clean editor');await sleep(160);
        await evaluate("previewEdit();const nameField=document.getElementById('editNameInput');nameField.value='Unsaved name';nameField.dispatchEvent(new Event('input',{bubbles:true}));document.getElementById('editArtworkLocalBtn').click();_artworkWizardHandleApplied({images:{vertical:'fixture.png'}})");
        assert.equal(await evaluate("isEditModalOpen&&document.getElementById('editNameInput').value==='Unsaved name'&&!document.getElementById('editSaveBtn').hidden"),true,'Committed art preserves pending field drafts');
        await evaluate("document.getElementById('editNameInput').value='Fixture game';document.getElementById('editNameInput').dispatchEvent(new Event('input',{bubbles:true}));");
        assert.equal(await evaluate("document.getElementById('editSaveBtn').hidden"),true,'Reverting a field clears pending state');
        await evaluate("document.getElementById('editArtworkLocalBtn').click();document.getElementById('artworkCancelBtn').click()");
        assert.equal(await evaluate('isEditModalOpen'),true,'Cancelled art returns to the editor');
        await evaluate('window._editModalClose()');await sleep(160);
        report.push({screen:'actual-item-editor',checks:['Save only when dirty','trailer persistence payload','art returns Home without draft','art preserves draft','cancel art preserves editor','revert clears pending state']});
        // Re-enable the actual transitions after the deterministic screenshots.
        console.log('Checking actual menu motion...');
        await evaluate("document.querySelector('head style').textContent='#doorpi-app-ui{display:block;opacity:1}';previewResetClosedMenu();window.previewMotionStarted=performance.now();openNavMenu(0)");
        await waitFor(()=>evaluate("window._navMenuPhase==='open'"),'nav-menu finishes its actual opening animation');
        const motion=await evaluate("({openingMs:performance.now()-previewMotionStarted,transition:getComputedStyle(document.getElementById('navMenuOverlay')).transitionDuration})");
        assert.equal(motion.transition,'0.18s','Nav-menu uses the shared short panel duration');
        await evaluate("window.previewMotionStarted=performance.now();closeNavMenu()");
        await waitFor(()=>evaluate("window._navMenuPhase==='closed'"),'nav-menu releases input after its actual closing animation');
        motion.closingMs=await evaluate('performance.now()-previewMotionStarted');
        assert.ok(motion.closingMs<500,'No old 600ms closing wait remains: '+JSON.stringify(motion));
        report.push({screen:'actual-nav-menu-motion',...motion,checks:['actual transitionend','input released after close','shared 180ms duration']});
        console.log('Checking bounded session preparation...');
        await evaluate(`(async()=>{
            previewResetClosedMenu();previewClearLibrary();
            window.previewWarmRequests=[];window.previewWarmFetch=fetch;window.previewWarmFocus=document.activeElement;
            window.fetch=(url,...args)=>{previewWarmRequests.push(String(url));return previewWarmFetch(url,...args);};
            window._userSwitching=true;
            await prepareDoorpiNavMenuEntry(()=>true);
            window._userSwitching=false;window.fetch=previewWarmFetch;
            window.previewWarmCard=document.querySelector('#navPaneGames .nav-vertical-card');
        })()`);
        const warm=await evaluate(`({requests:previewWarmRequests,cards:document.querySelectorAll('#navPaneGames .nav-vertical-card').length,
            images:document.querySelectorAll('#navPaneGames img').length,apps:document.querySelectorAll('#navPaneMedia .nav-vertical-card').length,
            focusKept:document.activeElement===previewWarmFocus,hidden:getComputedStyle(document.getElementById('navMenuOverlay')).display==='none'})`);
        assert.equal(warm.requests.length,1,'Preparation only reads the games index');
        assert.ok(warm.requests[0].includes('/games.json'));
        assert.ok(warm.cards>0&&warm.cards<=40&&warm.images>0&&warm.images<warm.cards,'Only initial viewport artwork is warmed: '+JSON.stringify(warm));
        assert.equal(warm.apps,0);assert.ok(warm.hidden&&warm.focusKept,'Preparation never opens the menu or takes focus');
        await evaluate('openNavMenu(0)');
        assert.equal(await evaluate("previewWarmCard===document.querySelector('#navPaneGames .nav-vertical-card')"),true,'Opening reuses prepared DOM');
        await waitFor(()=>evaluate("window._navMenuPhase==='open'"),'prepared menu opens');
        await evaluate('closeNavMenu()');
        await waitFor(()=>evaluate("window._navMenuPhase==='closed'"),'prepared menu closes');
        await evaluate(`(async()=>{
            previewClearLibrary();window._userSwitching=true;window.previewWarmValid=true;
            window.fetch=async(...args)=>{const response=await previewWarmFetch(...args);previewWarmValid=false;return response;};
            await prepareDoorpiNavMenuEntry(()=>previewWarmValid);
            window.fetch=previewWarmFetch;window._userSwitching=false;
        })()`);
        assert.equal(await evaluate("document.querySelectorAll('#navPaneGames .nav-vertical-card').length"),0,'Stale session preparation cannot commit cards');
        report.push({screen:'session-nav-preparation',...warm,checks:['games index only','bounded first batch','visible artwork only','no app grid','no focus change','DOM reused','stale session discarded']});
        console.log('Checking cold menu loading...');
        await evaluate(`(()=>{
            window.previewMenuOriginalFetch=window.fetch;window.previewColdResolvers=[];
            window.fetch=async(url,...args)=>{if(String(url).startsWith('https://data.local/'))await new Promise(resolve=>previewColdResolvers.push(resolve));return previewMenuOriginalFetch(url,...args);};
            previewResetClosedMenu();previewClearLibrary();window.previewColdOpen=openNavMenu(0);
        })()`);
        await waitFor(()=>evaluate('previewColdResolvers.length>=6'),'cold nav-menu reads pending');
        assert.equal(await evaluate("!document.body.classList.contains('nav-menu-active')&&!document.getElementById('navMenuOverlay').classList.contains('visible')&&!document.getElementById('btnTopProfile')?.classList.contains('nav-menu-hidden')"),true,'Cold reads keep Home visible until menu composition is ready');
        await evaluate('previewColdResolvers.splice(0).forEach(resolve=>resolve());window.fetch=previewMenuOriginalFetch;true');
        await evaluate('previewColdOpen');
        assert.equal(await evaluate("document.body.classList.contains('nav-menu-active')&&document.getElementById('navContentTitle').textContent.length>0&&document.querySelectorAll('#navPaneGames .nav-vertical-card').length>0"),true,'First reveal includes its header and cards');
        await waitFor(()=>evaluate("window._navMenuPhase==='open'"),'cold nav-menu opening complete');
        await sleep(300);
        const loading=await evaluate("({total:document.querySelectorAll('#navPaneGames .nav-vertical-card').length,loaded:document.querySelectorAll('#navPaneGames .nav-vertical-card img').length,hiddenLoaded:document.querySelectorAll('#navPaneMedia .nav-vertical-card img').length})");
        assert.ok(loading.loaded>0&&loading.loaded<loading.total,'Cold open does not hydrate the entire library: '+JSON.stringify(loading));
        assert.equal(loading.hiddenLoaded,0,'Inactive app pane does not fetch artwork');
        await evaluate("const pane=document.getElementById('navPaneGames');pane.scrollTop=pane.scrollHeight;pane.dispatchEvent(new Event('scroll'))");
        await waitFor(()=>evaluate("!!document.querySelector('#navPaneGames .nav-vertical-card:last-child img')"),'remaining art loads as scrolling reaches it');
        await evaluate('closeNavMenu();window.fetch=previewMenuOriginalFetch');
        await waitFor(()=>evaluate("window._navMenuPhase==='closed'"),'cold nav-menu closing complete');
        report.push({screen:'cold-nav-menu',loading,checks:['delayed native reads','Home visible during preparation','header and cards composed before reveal','partial artwork hydration','inactive pane does not load artwork','last artwork loads on scroll']});
        fs.writeFileSync(path.join(output,'validation.json'),JSON.stringify({renderer:'isolated headless Chromium',defaultComparedWithBaseline:fs.existsSync(baseline),limitations:['Fixture with actual CSS/runtime; not a complete Doorpi/controller/WebView2 session.','Animations disabled only in the fixture for deterministic comparison.','Trailer geometry/identity checked without external streaming playback.'],cases:report},null,2));
        console.log(`PASS: ${report.length} cases, real settings selection, portrait cards, CSS validation and component/focus geometry${fs.existsSync(baseline)?'; exact computed default-style comparison at four resolutions':''}. Output: ${path.relative(root,output)}`);
        await client.send('Browser.close');
    } finally {
        client?.close();
        if(chrome.exitCode===null) chrome.kill();
        fs.closeSync(log);
    }
})().catch(error=>{console.error(error);process.exitCode=1;});
