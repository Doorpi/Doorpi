// Full shipped document/bundles, isolated browser and fake native transport.
// No installed Doorpi state or user browser profile is read.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..'),web=path.join(root,'Doorpi/wwwroot'),output=path.join(root,'artifacts/full-startup');
fs.mkdirSync(output,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label){for(let i=0;i<200;i++){if(await fn())return;await sleep(100);}throw Error('Timed out: '+label);}
async function connect(url){
 const socket=new WebSocket(url),pending=new Map();let next=0;
 socket.addEventListener('message',event=>{const data=JSON.parse(event.data),request=pending.get(data.id);if(!request)return;pending.delete(data.id);clearTimeout(request.timer);data.error?request.reject(Error(JSON.stringify(data.error))):request.resolve(data.result);});
 await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
 return {send(method,params={}){return new Promise((resolve,reject)=>{const id=++next,timer=setTimeout(()=>reject(Error('CDP timeout: '+method)),15000);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));});},close:()=>socket.close()};
}
(async()=>{
 let chrome,client;
 const server=http.createServer((req,res)=>{
  const file=path.resolve(web,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
  if(!file.startsWith(web+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end();return;}
  const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.wav':'audio/wav','.woff2':'font/woff2'}[path.extname(file)]||'application/octet-stream';
  res.writeHead(200,{'Content-Type':mime,'Cache-Control':'no-store'});res.end(fs.readFileSync(file));
 });
 try{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const profile=path.join(output,'browser-'+Date.now());
  chrome=spawn(process.env.DOORPI_PREVIEW_CHROME||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',['--headless=new','--no-first-run','--disable-background-networking','--disable-extensions','--mute-audio','--remote-debugging-port=0','--remote-debugging-address=127.0.0.1','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'});
  const portFile=path.join(profile,'DevToolsActivePort');await until(()=>fs.existsSync(portFile),'browser');
  const port=fs.readFileSync(portFile,'utf8').split(/\r?\n/)[0],targets=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();
  client=await connect(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
  const evaluate=async expression=>{const r=await client.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
  await client.send('Page.enable');
  await client.send('Page.addScriptToEvaluateOnNewDocument',{source:`
   if(window===top){
    window.testErrors=[];window.testMessages=[];const listeners=[];
    addEventListener('error',e=>testErrors.push(e.message));addEventListener('unhandledrejection',e=>testErrors.push(String(e.reason)));
    window.testHost=data=>listeners.forEach(fn=>fn({data:JSON.stringify(data)}));
    window.chrome=window.chrome||{};chrome.webview={addEventListener:(name,fn)=>listeners.push(fn),postMessage:text=>{
     const m=typeof text==='string'?JSON.parse(text):text;testMessages.push(m);
     if(m.action==='requestThemeSettings')setTimeout(()=>testHost({type:'themeSettingsState',requestId:m.requestId,profileId:m.profileId,ok:true,revision:'1',profileRevision:'1',generation:'1',deviceRevision:'1',deviceTheme:'default',themes:[],parts:{}}),20);
    }};
    const originalFetch=fetch;window.fetch=(url,...args)=>{
     const address=String(url);if(address.startsWith('https://app.local/'))return originalFetch(address.replace('https://app.local',location.origin),...args);
     if(address.startsWith('https://data.local/'))return Promise.resolve(new Response('[]',{headers:{'Content-Type':'application/json'}}));
     return originalFetch(url,...args);
    };
    window.__doorpiConsoleShellExplorerReady=true;
   }
  `});
  await client.send('Page.navigate',{url:base+'/index.html'});
  await until(()=>evaluate("document.readyState==='complete'&&typeof showUserPicker==='function'"),'full document');
  console.log('Document ready',await evaluate('testErrors'));
  await until(()=>evaluate('DoorpiIntro.isComplete()'),'real intro completion without profiles');
  console.log('Intro complete',await evaluate('testErrors'));
  await evaluate("testHost({type:'usersList',users:[{Id:'test',Name:'Teste'}],currentUserId:'test',sessionActive:false,requireSelection:true})");
  await until(()=>evaluate("document.body.classList.contains('user-picker-open')&&document.activeElement?.classList.contains('doorpi-user-card')"),'late profile picker');
  const result=await evaluate("({errors:testErrors,active:document.activeElement.className,picker:getComputedStyle(document.getElementById('doorpiUserPicker')).display,messages:testMessages.map(m=>m.action)})");
  fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(result,null,2));
  assert.deepEqual(result.errors,[]);console.log('PASS full-document startup and profiles arriving after intro');
  await client.send('Browser.close');
 }finally{client?.close();if(chrome&&chrome.exitCode===null)chrome.kill();server.closeAllConnections();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
