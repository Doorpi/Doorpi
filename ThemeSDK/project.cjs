const fs=require('node:fs'),path=require('node:path');
const contract=require('../Doorpi/Frontend/themes/package-contract.json');
const safe=value=>typeof value==='string'&&value.length<=160&&/^[A-Za-z0-9_./-]+$/.test(value)&&value.split('/').every(part=>part&&part!=='.'&&part!=='..'&&!part.endsWith('.')&&!/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(part));
function load(folder){
 const root=fs.realpathSync(folder),files=new Map();let bytes=0;
 function walk(directory){for(const item of fs.readdirSync(directory,{withFileTypes:true})){
  if(item.name.startsWith('.')||item.name.endsWith('~')||/^#.*#$/.test(item.name)||/\.(swp|swo|tmp|bak)$/i.test(item.name))continue;
  const full=path.join(directory,item.name),relative=path.relative(root,full).split(path.sep).join('/');
  if(item.isSymbolicLink())throw Error('Links não são permitidos no projeto: '+relative);
  if(item.isDirectory()){if(!['parts','assets'].some(prefix=>relative===prefix||relative.startsWith(prefix+'/')))throw Error('Pasta não faz parte do pacote: '+relative);walk(full);continue;}
  if(!safe(relative)||!(relative==='theme.json'||/^parts\/[a-zA-Z0-9_./-]+\.(css|json)$/.test(relative)||relative.startsWith('assets/')&&contract.assetTypes[path.extname(relative).toLowerCase()]))throw Error('Arquivo não permitido: '+relative);
  const content=fs.readFileSync(full);bytes+=content.length;
  if(content.length>contract.limits.assetBytes||bytes>contract.limits.expandedBytes||files.size>=contract.limits.files)throw Error('Limites do pacote excedidos.');
  if([...files.keys()].some(key=>key.toLowerCase()===relative.toLowerCase()))throw Error('Nomes duplicados no Windows: '+relative);
  files.set(relative,content);
 }}walk(root);
 if((files.get('theme.json')?.length||0)>contract.limits.cssBytes)throw Error('Manifesto excede 128 KiB.');
 const manifest=JSON.parse(files.get('theme.json')?.toString()||'null');
 if(!manifest||manifest.schemaVersion!==1||manifest.apiVersion!==1||typeof manifest.id!=='string'||!/^[a-z0-9][a-z0-9-]{0,63}$/.test(manifest.id)||typeof manifest.name!=='string'||!manifest.name.trim()||manifest.name.length>100||typeof manifest.author!=='string'||!manifest.author.trim()||manifest.author.length>100||typeof manifest.version!=='string'||!/^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/.test(manifest.version)||!manifest.parts||Array.isArray(manifest.parts)||!Object.keys(manifest.parts).length)throw Error('Manifesto de projeto inválido.');
 if(Object.keys(manifest).some(key=>!['schemaVersion','apiVersion','id','name','version','author','parts'].includes(key)))throw Error('Capacidade não suportada no manifesto.');
 const parts={},assets={};
 for(const [id,part]of Object.entries(manifest.parts)){
  if(!contract.parts[id]||!part||Object.keys(part).some(key=>!['css','appearance'].includes(key))||!safe(part.css)||!part.css.endsWith('.css')||!files.has(part.css)||files.get(part.css).length>contract.limits.cssBytes)throw Error('Componente inválido: '+id);
  const css=files.get(part.css).toString('utf8');
  if(/\\|@import\b|@namespace\b/i.test(css))throw Error('CSS usa imports/escapes não suportados: '+id);
  // Browser CSSOM performs the authoritative stylesheet/scope validation in Studio and Doorpi.
  parts[id]={css,appearance:null};
  if(part.appearance){if(id!=='home'||!safe(part.appearance)||!part.appearance.endsWith('.json')||!files.has(part.appearance)||files.get(part.appearance).length>contract.limits.cssBytes)throw Error('Contrato de aparência inválido.');parts[id].appearance=JSON.parse(files.get(part.appearance).toString());}
 }
 for(const [file,bytes]of files)if(file.startsWith('assets/'))assets[file]='data:'+contract.assetTypes[path.extname(file).toLowerCase()]+';base64,'+bytes.toString('base64');
 return{manifest,parts,assets,files};
}
function create(folder,base='default'){
 if(!['default','empty'].includes(base))throw Error('Use --base default ou --base empty.');
 fs.mkdirSync(folder,{recursive:true});if(fs.readdirSync(folder).length)throw Error('Escolha uma pasta vazia para não sobrescrever trabalho.');
 fs.mkdirSync(path.join(folder,'parts'));fs.mkdirSync(path.join(folder,'assets'));
 const manifest={schemaVersion:1,apiVersion:1,id:'meu-tema',name:'Meu tema',version:'1.0.0',author:'Seu nome',parts:{}};
 for(const [id,part]of Object.entries(contract.parts)){
  manifest.parts[id]={css:'parts/'+id+'.css'};
  let css='/* '+part.label+' — arquivo visual independente. Sem JavaScript. */\n';
  if(base==='default')css+='/* O visual padrão permanece como base. Use :scope para a raiz desta área. */\n:scope { color: #eaf1ff; }\nbutton:focus-visible { outline: 2px solid #a8d7ff; outline-offset: 3px; }\n';
  fs.writeFileSync(path.join(folder,'parts',id+'.css'),css);
 }
 manifest.parts.home.appearance='parts/home.json';
 fs.writeFileSync(path.join(folder,'parts/home.json'),JSON.stringify({schemaVersion:1,apiVersion:1,id:'meu-tema',name:'Meu tema',tokens:{},layout:{}},null,2)+'\n');
 fs.writeFileSync(path.join(folder,'theme.json'),JSON.stringify(manifest,null,2)+'\n');
 return load(folder);
}
function crc32(buffer){let crc=0xffffffff;for(const byte of buffer){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return(crc^0xffffffff)>>>0;}
function archive(project){
 const local=[],central=[];let offset=0;
 for(const [file,data]of [...project.files].sort(([a],[b])=>a.localeCompare(b,'en'))){
  const name=Buffer.from(file),crc=crc32(data),head=Buffer.alloc(30);head.writeUInt32LE(0x04034b50);head.writeUInt16LE(20,4);head.writeUInt16LE(0x800,6);head.writeUInt16LE(0x21,12);head.writeUInt32LE(crc,14);head.writeUInt32LE(data.length,18);head.writeUInt32LE(data.length,22);head.writeUInt16LE(name.length,26);
  const entry=Buffer.alloc(46);entry.writeUInt32LE(0x02014b50);entry.writeUInt16LE(20,4);entry.writeUInt16LE(20,6);entry.writeUInt16LE(0x800,8);entry.writeUInt16LE(0x21,14);entry.writeUInt32LE(crc,16);entry.writeUInt32LE(data.length,20);entry.writeUInt32LE(data.length,24);entry.writeUInt16LE(name.length,28);entry.writeUInt32LE(offset,42);
  local.push(head,name,data);central.push(entry,name);offset+=head.length+name.length+data.length;
 }
 const index=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(project.files.size,8);end.writeUInt16LE(project.files.size,10);end.writeUInt32LE(index.length,12);end.writeUInt32LE(offset,16);
 return Buffer.concat([...local,index,end]);
}
module.exports={load,create,archive,contract};
