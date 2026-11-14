// Actual browser/SSE verification with an isolated authored project and browser profile.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const {create}=require('../ThemeSDK/project.cjs');
const root=path.resolve(__dirname,'..'),output=path.join(root,'artifacts','theme-studio-test-'+Date.now()),project=path.join(output,'project');
create(project,'default');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(action,label,timeout=20000){const started=Date.now();while(Date.now()-started<timeout){const value=await action();if(value)return value;await sleep(100);}throw Error('Timed out: '+label);}
async function connect(url){
 const socket=new WebSocket(url),pending=new Map();let next=0;
 socket.addEventListener('message',event=>{const data=JSON.parse(event.data),request=pending.get(data.id);if(!request)return;pending.delete(data.id);clearTimeout(request.timer);data.error?request.reject(Error(JSON.stringify(data.error))):request.resolve(data.result);});
 await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
 return{send(method,params={},sessionId){return new Promise((resolve,reject)=>{const id=++next,timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout: '+method));},20000);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params,sessionId}));});},close:()=>socket.close()};
}
(async()=>{
 let server,chrome,client,serverOutput='';
 try{
  server=spawn(process.execPath,[path.join(root,'scripts/theme-sdk.cjs'),'dev',project],{cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe']});
  server.stdout.on('data',data=>serverOutput+=data);server.stderr.on('data',data=>serverOutput+=data);
  const url=await until(()=>{if(server.exitCode!==null)throw Error(serverOutput);return serverOutput.match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];},'Studio server');
  const profile=path.join(output,'browser-profile');
  chrome=spawn(process.env.DOORPI_PREVIEW_CHROME||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',['--headless=new','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--disable-extensions','--mute-audio','--remote-debugging-port=0','--remote-debugging-address=127.0.0.1','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'});
  const portFile=path.join(profile,'DevToolsActivePort');await until(()=>{if(chrome.exitCode!==null)throw Error('Browser exited');return fs.existsSync(portFile);},'isolated browser');
  const port=fs.readFileSync(portFile,'utf8').split(/\r?\n/)[0],targets=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();
  client=await connect(targets.find(target=>target.type==='page').webSocketDebuggerUrl);
  async function evaluate(expression,contextId,sessionId){const result=await client.send('Runtime.evaluate',{expression,contextId,awaitPromise:true,returnByValue:true},sessionId);if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));return result.result.value;}
  await client.send('Page.enable');await client.send('Emulation.setDeviceMetricsOverride',{width:1600,height:1000,deviceScaleFactor:1,mobile:false});await client.send('Page.navigate',{url});
  await until(()=>evaluate("document.getElementById('status')?.textContent.includes('Prévia atualizada')"),'first frame');
  let frames=await client.send('Page.getFrameTree'),frameId=frames.frameTree.childFrames?.[0]?.frame.id,frameSession;
  if(!frameId){
   const targets=await client.send('Target.getTargets'),target=targets.targetInfos.find(item=>item.type==='iframe'&&item.url.endsWith('/frame.html'));
   assert.ok(target,'Sandboxed frame target must exist: '+JSON.stringify(targets.targetInfos));
   frameSession=(await client.send('Target.attachToTarget',{targetId:target.targetId,flatten:true})).sessionId;
   frames=await client.send('Page.getFrameTree',{},frameSession);frameId=frames.frameTree.frame.id;
  }
  const world=await client.send('Page.createIsolatedWorld',{frameId,worldName:'theme-studio-validation'},frameSession);
  const frameEval=expression=>evaluate(expression,world.executionContextId,frameSession);
  assert.equal(await frameEval("typeof window.chrome?.webview"),'undefined','Studio has no Windows bridge');
  const homeFile=path.join(project,'parts/home.css');
  fs.writeFileSync(path.join(project,'parts/.home.css.swp'),'editor buffer must not enter distribution');
  fs.writeFileSync(homeFile,':scope { --doorpi-home-title-color: rgb(1,222,133); }');
  await until(()=>frameEval("getComputedStyle(document.querySelector('.home-feature-title')).color==='rgb(1, 222, 133)'"),'save updates actual CSS');
  let screenshot=await client.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(output,'studio-home.png'),Buffer.from(screenshot.data,'base64'));
  fs.writeFileSync(homeFile,'button { color:red;');
  await until(()=>evaluate("document.getElementById('status').textContent.includes('CSS incompleto')"),'invalid edit reported');
  assert.equal(await frameEval("getComputedStyle(document.querySelector('.home-feature-title')).color"),'rgb(1, 222, 133)','Invalid edit preserves last valid preview');
  fs.writeFileSync(homeFile,':scope { --doorpi-home-title-color: rgb(1,222,133); }');
  await until(()=>evaluate("document.getElementById('status').textContent.includes('Prévia atualizada')"),'valid edit recovers');
  fs.writeFileSync(path.join(project,'parts/nav-menu.css'),':scope { background-color: rgb(28,42,64); }');
  await evaluate("document.getElementById('part').value='nav-menu';document.getElementById('part').dispatchEvent(new Event('change'));true;");
  await until(()=>frameEval("!!document.getElementById('navMenuOverlay')&&getComputedStyle(document.getElementById('navMenuOverlay')).backgroundColor==='rgb(28, 42, 64)'"),'nav-menu scene and CSS');
  await evaluate("document.getElementById('base').value='bare';document.getElementById('base').dispatchEvent(new Event('change'));true;");
  await until(()=>frameEval("document.querySelectorAll('link[data-base]').length===0"),'unstyled inspection');
  await evaluate("document.getElementById('base').value='default';document.getElementById('base').dispatchEvent(new Event('change'));true;");
  await until(()=>frameEval("document.querySelectorAll('link[data-base]').length===2"),'default base restored');
  for(const part of ['side-panels','popups','login']){
   await evaluate(`document.getElementById('part').value=${JSON.stringify(part)};document.getElementById('part').dispatchEvent(new Event('change'));true;`);
   await until(()=>frameEval(`!!document.querySelector(${JSON.stringify({'side-panels':'#addGameContainer',popups:'.edit-modal-overlay',login:'#doorpiUserPicker'}[part])})`),part+' fixture');
   await until(()=>frameEval(`(()=>{const root=document.querySelector(${JSON.stringify({'side-panels':'#addGameContainer',popups:'.edit-modal-overlay',login:'#doorpiUserPicker'}[part])}),css=getComputedStyle(root),rect=root.getBoundingClientRect();return css.visibility==='visible'&&Number(css.opacity)>.99&&rect.width>100&&rect.height>100;})()`),part+' visible scene');
   if(part==='login')await until(()=>frameEval("Number(getComputedStyle(document.querySelector('.doorpi-user-panel')).opacity)>.99"),'login panel animation');
   screenshot=await client.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(output,'studio-'+part+'.png'),Buffer.from(screenshot.data,'base64'));
  }
  console.log('PASS: Studio initial preview, actual CSS update after save/SSE, invalid CSS recovery, five areas, bare/default inspection, and no native bridge. '+path.relative(root,output));
  await client.send('Browser.close');
 }finally{client?.close();if(chrome&&chrome.exitCode===null)chrome.kill();if(server&&server.exitCode===null)server.kill();}
})().catch(error=>{console.error(error);process.exitCode=1;});
