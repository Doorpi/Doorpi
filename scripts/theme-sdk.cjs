const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const {load,create,archive,contract}=require('../ThemeSDK/project.cjs');
const root=path.resolve(__dirname,'..'),[command,argument,...flags]=process.argv.slice(2);
function option(name,fallback){const index=flags.indexOf(name);return index>=0?flags[index+1]:fallback;}
try{
 if(!command||!argument)throw Error('Uso: node scripts/theme-sdk.cjs create|check|dev|pack <pasta> [--base default|empty] [--output arquivo.doorpitheme]');
 const folder=path.resolve(argument);
 if(command==='create'){create(folder,option('--base','default'));console.log('Projeto criado: '+folder);}
 else if(command==='check'){const p=load(folder);console.log(`PASS: ${p.manifest.name}, ${Object.keys(p.parts).length} áreas, ${p.files.size} arquivos. Valide CSS e layouts no Studio antes de distribuir.`);}
 else if(command==='pack'){
  const p=load(folder),bytes=archive(p),output=path.resolve(option('--output',p.manifest.id+'-'+p.manifest.version+'.doorpitheme'));
  if(output.startsWith(folder+path.sep))throw Error('Gere o pacote fora da pasta de autoria.');
  fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,bytes,{flag:'wx'});
  console.log(JSON.stringify({file:output,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),apiVersion:1,parts:Object.keys(p.parts),signature:null},null,2));
 }else if(command==='dev'){
  load(folder);let revision=0,timer;const clients=new Set();
  const runtime={'/runtime/style.css':'Doorpi/wwwroot/style.css','/runtime/theme-runtime.js':'Doorpi/Frontend/scripts/themes/010-theme-runtime.js','/runtime/trailer-layout.js':'Doorpi/Frontend/scripts/themes/030-trailer-layout.js','/runtime/package-styles.js':'Doorpi/Frontend/scripts/themes/040-package-styles.js','/themes/contract.json':'Doorpi/wwwroot/themes/contract.json','/themes/package-contract.json':'Doorpi/Frontend/themes/package-contract.json',
   '/runtime/profile.css':'Doorpi/Frontend/injected-styles/nav-menu/doorpi-unified-profile-styles.css','/runtime/nav-menu.css':'Doorpi/Frontend/injected-styles/nav-menu/nav-menu-styles.css','/runtime/login.css':'Doorpi/Frontend/injected-styles/app/doorpi-overlay-styles.css','/runtime/popups.css':'Doorpi/Frontend/injected-styles/app/auxiliary-style-installation-1.css'};
  const server=http.createServer((request,response)=>{
   if(!request.headers.host?.startsWith('127.0.0.1:')||request.method!=='GET'){response.writeHead(403);response.end();return;}
   response.setHeader('Cache-Control','no-store');response.setHeader('Access-Control-Allow-Origin','null');response.setHeader('X-Content-Type-Options','nosniff');
   const url=new URL(request.url,'http://'+request.headers.host),route=url.pathname;
   try{
    if(route==='/events'){response.writeHead(200,{'Content-Type':'text/event-stream'});response.write('data: '+revision+'\n\n');clients.add(response);request.on('close',()=>clients.delete(response));return;}
    if(route==='/api/project'){const p=load(folder);response.setHeader('Content-Type','application/json');response.end(JSON.stringify({manifest:p.manifest,parts:p.parts,assets:p.assets,revision}));return;}
    let file=runtime[route];
    if(route.startsWith('/runtime/fonts/')&&/^[a-zA-Z0-9_.-]+\.woff2$/.test(route.slice(15)))file='Doorpi/wwwroot/fonts/'+route.slice(15);
    if(!file&&['/','/studio.js','/studio.css','/frame.html','/frame.js','/fixtures.js'].includes(route))file='ThemeSDK/studio/'+(route==='/'?'index.html':route.slice(1));
    if(!file){response.writeHead(404);response.end();return;}
    const extension=path.extname(file),mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.woff2':'font/woff2'}[extension]||'application/octet-stream';
    if(extension==='.html')response.setHeader('Content-Security-Policy',"default-src 'none'; script-src http://"+request.headers.host+"; style-src 'unsafe-inline' http://"+request.headers.host+"; connect-src http://"+request.headers.host+"; img-src data:; font-src data: http://"+request.headers.host+"; frame-src http://"+request.headers.host+"; base-uri 'none'; form-action 'none'");
    response.setHeader('Content-Type',mime);response.end(fs.readFileSync(path.join(root,file)));
   }catch(error){response.writeHead(400,{'Content-Type':'application/json'});response.end(JSON.stringify({error:error.message}));}
  });
  const watcher=fs.watch(folder,{recursive:true},()=>{clearTimeout(timer);timer=setTimeout(()=>{revision++;for(const client of clients)client.write('data: '+revision+'\n\n');},150);});
  server.listen(0,'127.0.0.1',()=>console.log('Doorpi Theme Studio: http://127.0.0.1:'+server.address().port+'\nEdite '+folder+'; salve para atualizar. Ctrl+C encerra.'));
  function close(){watcher.close();for(const client of clients)client.end();server.close();}process.on('SIGINT',close);process.on('SIGTERM',close);
 }else throw Error('Comando desconhecido: '+command);
}catch(error){console.error(error.message);process.exitCode=1;}
