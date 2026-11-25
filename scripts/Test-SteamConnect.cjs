const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'../Doorpi/Frontend/web-scripts/steam-connect.js'),'utf8');
const stringsSource=fs.readFileSync(path.join(__dirname,'../Doorpi/Frontend/scripts/strings/010-implementation.js'),'utf8');
const translations=vm.runInNewContext(stringsSource.slice(0,stringsSource.indexOf('\n};')+3)+';STRINGS');
const key='0123456789abcdef0123456789abcdef',id='76561198000000000';
function page(options={}) {
    const messages=[],handlers={},requests=[],elements=[],timers=[];let observer;
    const target={};
    const element=()=>({style:{},textContent:'',isConnected:true,offsetWidth:160,offsetHeight:44,hidden:false,events:{},setAttribute(){},contains:item=>item===target,addEventListener(name,handler){this.events[name]=handler;},getBoundingClientRect:()=>({left:100,right:440,top:150,bottom:180,width:340,height:30})});
    const paragraph=element();paragraph.textContent=options.text??'Chave: '+key;
    let paragraphs=options.delayed?[]:[paragraph];
    const window={innerWidth:1280,innerHeight:720,addEventListener(){},g_steamID:options.id,chrome:{webview:{addEventListener(){},postMessage:text=>messages.push(text.startsWith('doorpi_steam_manual:') ? {manual:true} : JSON.parse(text.slice('doorpi_steam_connect:'.length)))}}};
    window.top=options.frame?{}:window;
    const context=vm.createContext({window,nonce:'test-session',styles:'',copy:translations[options.lang||'pt-BR'].steam,location:{origin:options.origin??'https://steamcommunity.com',pathname:options.pathname??'/dev/apikey'},
        document:{readyState:'complete',head:{appendChild(){}},body:{append(...items){elements.push(...items);}},createElement:element,
            querySelectorAll:selector=>selector.startsWith('[id^=')?[{querySelectorAll:()=>paragraphs}]:options.links||[],addEventListener:(name,handler)=>handlers[name]=handler},
        MutationObserver:class{constructor(fn){observer=fn;}observe(){}},requestAnimationFrame:fn=>fn(),
        URL,AbortController,setTimeout:(callback,delay)=>{timers.push({callback,delay});return timers.length;},clearTimeout(){},fetch:async url=>{requests.push(url);return {ok:true,url:options.resolved??'https://steamcommunity.com/login/'};}});
    vm.runInContext('(()=>{'+source+'})();',context);
    return {messages,requests,handlers,elements,fallback:()=>timers.find(timer=>timer.delay===8000)?.callback(),click:async()=>{handlers.click?.({target:options.outside?{}:target,preventDefault(){}});await new Promise(resolve=>setImmediate(resolve));},
        export:()=>elements.find(e=>e.id==='doorpi-steam-export')?.events.click(),
        reveal:()=>{paragraphs=[paragraph];observer([{target:{}}]);}};
}
(async()=>{
    const direct=page({id});assert.equal(direct.messages.length,0,'No key capture before intentional click');
    await direct.click();assert.deepEqual(direct.messages,[{nonce:'test-session',key,account:id}]);
    await direct.click();assert.equal(direct.messages.length,1,'Double-click caused duplicate imports');
    const link=page({links:[{href:'https://steamcommunity.com/id/my-profile/'}]});await link.click();assert.equal(link.messages[0].account,'my-profile');
    const redirect=page({resolved:'https://steamcommunity.com/profiles/'+id+'/'});await redirect.click();assert.equal(redirect.messages[0].account,id);assert.deepEqual(redirect.requests,['/my/']);
    for(const options of [{frame:true},{origin:'https://steamcommunity.com.evil.test'},{pathname:'/profiles/'+id}])assert.equal(page(options).handlers.click,undefined,'Capture script installed outside its authorized top-level key page');
    for(const options of [{outside:true,id},{id,text:'Domínio: '+key+' invalid'},{id,text:'Chave: short'}]){const p=page(options);await p.click();assert.equal(p.messages.length,0);}
    const missing=page();await missing.click();assert.equal(missing.messages.length,0);assert.ok(missing.elements.find(e=>e.id==='doorpi-steam-export-status').textContent.includes('Não foi possível'));
    const hostileLink=page({links:[{href:'https://steamcommunity.com.evil.test/profiles/'+id}]});await hostileLink.click();assert.equal(hostileLink.messages.length,0);
    const delayed=page({id,delayed:true});assert.equal(delayed.elements.length,0);delayed.reveal();await delayed.export();assert.equal(delayed.messages[0].account,id);assert.equal(delayed.elements.find(e=>e.id==='doorpi-steam-export').disabled,true);
    const fallback=page({text:'Chave ainda não disponível'});fallback.fallback();assert.deepEqual(fallback.messages,[{manual:true}]);
    const english=page({id,lang:'en-US'});assert.equal(english.elements.find(e=>e.id==='doorpi-steam-export').textContent,'Export key');
    console.log('PASS: explicit key click, Steam identity/global link/session redirect, duplicate capture, exact origin, frame/path restrictions and missing identity.');
})().catch(error=>{console.error(error);process.exitCode=1;});
