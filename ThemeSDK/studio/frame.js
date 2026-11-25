'use strict';
let revision=0,part='home';
const tokens=fetch('/themes/contract.json').then(response=>response.json());
window.addEventListener('message',async event=>{
 if(event.source!==parent||event.data?.type!=='doorpi-theme-preview')return;
 const data=event.data,request=++revision;
 try{
  const defaults=await tokens;DoorpiThemePackageRuntime.configure(data.contract,defaults);
  const component=data.project.parts[data.part];
  const css=DoorpiThemePackageRuntime.prepare(data.part,component.css,data.project.assets,data.contract.parts[data.part],data.project.manifest.id);
  if(component.appearance)await DoorpiThemes.check(component.appearance);
  if(request!==revision)return;
  const same=part===data.part&&document.body.dataset.base===data.base;
  if(!same||!document.body.children.length){
   for(const area of Object.keys(data.contract.parts))DoorpiThemePackageRuntime.reset(area);
   DoorpiThemes.reset();part=data.part;document.body.dataset.base=data.base;
   document.querySelectorAll('link[data-base]').forEach(link=>link.remove());
   const styles=[];
   if(data.base==='default')for(const file of ['/runtime/style.css',...(part==='profile'?['/runtime/nav-menu.css','/runtime/profile.css']:part==='nav-menu'?['/runtime/nav-menu.css']:part==='login'?['/runtime/login.css']:part==='popups'?['/runtime/popups.css']:[])]){
    const link=document.createElement('link');link.rel='stylesheet';link.href=file;link.dataset.base='true';
    styles.push(new Promise((resolve,reject)=>{link.onload=resolve;link.onerror=()=>reject(Error('Não foi possível carregar o CSS de referência.'));}));document.head.appendChild(link);
   }
   document.body.innerHTML=DoorpiThemeFixtures[part];
   await Promise.all(styles);await document.fonts.ready;
   if(request!==revision)return;
  }
  if(part==='home'){if(component.appearance)await DoorpiThemes.apply(component.appearance,{scope:'home'});else DoorpiThemes.reset();}
  if(request!==revision)return;
  DoorpiThemePackageRuntime.install(part,css);
  document.body.classList.toggle('home-trailer-playing',part==='home'&&data.scene!=='normal');document.body.classList.toggle('home-trailer-cinema',part==='home'&&data.scene==='cinema');
  document.body.classList.toggle('nav-menu-active',part==='nav-menu');
  window.DoorpiTrailerLayout?.refresh();
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  if(request!==revision)return;
  parent.postMessage({type:'doorpi-theme-preview-result',ok:true,note:'Foco e estados usam dados de demonstração.'},'*');
 }catch(error){parent.postMessage({type:'doorpi-theme-preview-result',ok:false,error:error.message},'*');}
});
document.addEventListener('keydown',event=>{
 if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key))return;
 const buttons=[...document.querySelectorAll('button,[tabindex="0"]')].filter(el=>el.getBoundingClientRect().width>0),index=buttons.indexOf(document.activeElement);
 buttons[Math.max(0,Math.min(buttons.length-1,index+(['ArrowUp','ArrowLeft'].includes(event.key)?-1:1)))]?.focus();event.preventDefault();
});
