// Profile/device selection; package payloads are visual contracts, never executable scripts.
(() => {
    'use strict';
    const areas=['home','nav-menu','side-panels','popups','login'];
    const systemAreas=areas.filter(part=>part!=='login');
    const supports=(theme,part)=>part==='system'
        ? systemAreas.every(area=>(theme.parts||['home','side-panels']).includes(area))
        : (theme.parts||['home','side-panels']).includes(part);
    const selectionId=parts=>state.part==='system'
        ? (systemAreas.every(part=>parts[part]===parts.home)?parts.home:'') : parts[state.part];
    const fallback={id:'default',name:'Doorpi padrão',description:'O visual original do Doorpi.',manifest:null,parts:areas};
    const bridge=window.chrome?.webview,requests=new Map(),packages=new Map(),desired=new Map(),choices=new Map();
    let epoch=0,sequence=0,running=null,snapshot=null,deviceEpoch=0,configPromise;
    let ready=Promise.resolve(),finishReady=()=>{},deviceReady=Promise.resolve(),devicePending=false;
    const defaults=()=>Object.fromEntries(areas.map(part=>[part,'default']));
    const emptyErrors=()=>Object.fromEntries(areas.map(part=>[part,'']));
    let state={profileId:'',part:'home',activeParts:defaults(),savedParts:defaults(),errors:emptyErrors(),busy:false,error:'',themes:[fallback]};
    function getState(){return {...state,errors:{...state.errors},error:state.error||state.errors[state.part]||(state.part==='login'&&state.deviceError)||state.catalogError||'',activeId:selectionId(state.activeParts),savedId:selectionId(state.savedParts),activeParts:{...state.activeParts},savedParts:{...state.savedParts},themes:state.themes.map(theme=>({...theme,parts:[...(theme.parts||['home','side-panels'])]}))};}
    const emit=()=>window.dispatchEvent(new CustomEvent('doorpi:theme-selection-state',{detail:getState()}));
    const current=(version,profile)=>version===epoch&&profile===state.profileId;
    function call(action,payload={}){
        if(!bridge?.postMessage)return Promise.reject(Error('Abra esta seleção dentro do Doorpi para salvar o tema.'));
        const requestId='theme-'+(++sequence),profileId=payload.profileId??state.profileId;
        return new Promise((resolve,reject)=>{
            const timeout=setTimeout(()=>{requests.delete(requestId);reject(Error('O Doorpi não respondeu. O tema padrão continua disponível.'));},action==='importThemePackage'?600000:action==='readThemePackage'?10000:5000);
            requests.set(requestId,{resolve,reject,timeout,profileId});
            try{bridge.postMessage(JSON.stringify({action,requestId,profileId,...payload}));}
            catch(error){requests.delete(requestId);clearTimeout(timeout);reject(error);}
        });
    }
    function accept(data){
        if(data.revision!=null&&data.profileRevision!=null)snapshot=data;
        if(Array.isArray(data.themes))state.themes=[fallback,...data.themes.filter(theme=>theme.id!=='default')];
        if(data.parts){for(const part of areas)if(part!=='login')state.savedParts[part]=data.parts[part]||'default';}
        else if(data.themeId) {state.savedParts.home=data.themeId;state.savedParts['side-panels']=data.themeId;}
        state.savedParts.login=data.deviceTheme||'default';
        state.deviceError=data.deviceError||'';
        state.catalogError=data.catalogError||'';
    }
    async function config(){
        if(!configPromise)configPromise=Promise.all(['themes/package-contract.json','themes/contract.json'].map(async file=>{
            const response=await fetch(new URL(file,document.baseURI),{cache:'no-cache'});if(!response.ok)throw Error('Contrato de pacote indisponível.');return response.json();
        })).then(([contract,tokens])=>{window.DoorpiThemePackageRuntime.configure(contract,tokens);return contract;}).catch(error=>{configPromise=null;throw error;});
        return configPromise;
    }
    function resetPart(part){
        window.DoorpiThemePackageRuntime?.reset(part);
        if(part==='home')window.DoorpiThemes.reset();
        if(part==='side-panels')document.documentElement.removeAttribute('data-doorpi-dialog-layout');
        state.activeParts[part]='default';
    }
    async function payload(id,profile){
        const key=epoch+'|'+id+'|'+profile;
        if(!packages.has(key)){
            const task=call('readThemePackage',{themeId:id,profileId:profile}).then(data=>{
                if(!data.ok||!data.package)throw Error(data.error||'Pacote indisponível.');return data.package;
            }).catch(error=>{if(packages.get(key)===task)packages.delete(key);throw error;});
            packages.set(key,task);
        }
        return packages.get(key);
    }
    async function apply(id,part,valid,profile=state.profileId){
        if(!valid())return false;
        if(id==='default'){resetPart(part);return true;}
        const theme=state.themes.find(item=>item.id===id);
        if(!theme||!(theme.parts||['home','side-panels']).includes(part))throw Error('O tema salvo não está disponível para esta área.');
        let manifest,css='',packageData;
        if(id.startsWith('pkg-')){
            const [data]=await Promise.all([payload(id,profile),config()]);
            if(!valid())return false;
            packageData=data;
        }else{
            if(!/^themes\/builtin\/[a-z0-9-]+\.json$/.test(theme.manifest||''))throw Error('O tema salvo não está disponível.');
            const response=await fetch(new URL(theme.manifest,document.baseURI),{cache:'no-cache'});
            if(!response.ok)throw Error('Não foi possível carregar o tema.');
            const data=await response.json();if(data.id!==id)throw Error('O pacote de tema possui outra identidade.');
            if(data.manifest?.parts)packageData=data;
            else manifest=data; // Compatibility with token-only built-in themes.
            if(manifest)await window.DoorpiThemes.check?.(manifest);
            if(part==='side-panels'&&manifest){
                const tokens=Object.entries(manifest.tokens).filter(([name])=>name.startsWith('--doorpi-dialog-'));
                css='#addGameContainer{'+tokens.map(([name,value])=>name+':'+value+';').join('')+'}';
            }
        }
        if(packageData){
            const contract=await config();if(!valid())return false;
            const component=packageData.parts[part];if(!component)throw Error('Componente ausente no pacote.');
            css=window.DoorpiThemePackageRuntime.prepare(part,component.css,packageData.assets,contract.parts[part],id);
            if(part==='home'&&component.appearance)manifest={...component.appearance,id};
        }
        if(!valid())return false;
        if(part==='home'){
            if(manifest){
                const home={...manifest,tokens:Object.fromEntries(Object.entries(manifest.tokens||{}).filter(([name])=>!name.startsWith('--doorpi-dialog-'))),layout:Object.fromEntries(Object.entries(manifest.layout||{}).filter(([name])=>name!=='dialog'))};
                const result=await window.DoorpiThemes.apply(home,{scope:'home'});if(!valid()||!result.applied)return false;
            }else window.DoorpiThemes.reset();
        }
        if(!valid())return false;
        window.DoorpiThemePackageRuntime?.install(part,css);
        if(part==='side-panels'){
            document.documentElement.removeAttribute('data-doorpi-dialog-layout');
            if(manifest?.layout?.dialog)document.documentElement.setAttribute('data-doorpi-dialog-layout',manifest.layout.dialog);
        }
        state.activeParts[part]=id;return true;
    }
    async function bindProfile(profile){
        profile=String(profile||'');const version=++epoch;
        desired.clear();choices.clear();snapshot=null;running=null;packages.clear();
        for(const [id,request] of requests)if(request.profileId){clearTimeout(request.timeout);request.reject(Error('O perfil mudou.'));requests.delete(id);}
        finishReady();ready=new Promise(resolve=>finishReady=resolve);
        for(const part of areas)if(part!=='login')resetPart(part);
        state={...state,profileId:profile,savedParts:{...defaults(),login:state.savedParts.login},errors:emptyErrors(),catalogError:'',busy:!!profile,error:'',themes:[fallback]};emit();
        if(!profile){finishReady();return;}
        try{
            const data=await call('requestThemeSettings');if(!current(version,profile))return;accept(data);
            if(!data.ok)throw Error(data.error||'Não foi possível ler a preferência de tema.');
            const started=Date.now();
            for(const part of areas){
                if(!current(version,profile))return;
                if(desired.has(part)||desired.has('__all__')||(part!=='login'&&desired.has('system')))continue;
                if(part==='login'&&state.activeParts.login===state.savedParts.login)continue;
                let cancelled=false,timer;
                try{
                    const remaining=Math.min(3000,6000-(Date.now()-started));
                    if(remaining<=0)throw Error('O tema demorou para carregar. O padrão foi usado nesta sessão.');
                    await Promise.race([apply(state.savedParts[part],part,()=>!cancelled&&current(version,profile)&&!desired.has(part)&&!desired.has('__all__')),
                        new Promise((_,reject)=>timer=setTimeout(()=>{cancelled=true;reject(Error('O tema demorou para carregar. O padrão foi usado nesta sessão.'));},remaining))]);
                }
                catch(error){if(current(version,profile)&&!desired.has(part)&&!desired.has('__all__')){cancelled=true;resetPart(part);state.errors[part]=error.message;}}
                finally{clearTimeout(timer);}
            }
        }catch(error){if(current(version,profile))state.error=error.message;}
        finally{if(current(version,profile)){packages.clear();state.busy=false;finishReady();emit();}}
    }
    async function pump(version,profile){
        await ready;
        let retries=0;
        while(current(version,profile)&&desired.size){
            const [part,id]=desired.entries().next().value,operation=choices.get(part);
            const reset=part==='__all__';
            const targets=part==='system'?systemAreas:[part];
            const valid=()=>current(version,profile)&&choices.get(part)===operation;
            state.busy=true;state.error='';state.errors[part]='';emit();
            try{
                let applied=true;
                if(!reset)for(const target of targets){if(!await apply(id,target,valid)){applied=false;break;}}
                if(!current(version,profile))return;if(!valid())continue;
                if(!applied)throw Error('A aplicação do tema foi cancelada.');emit();
                if(!snapshot)throw Error('O visual foi restaurado nesta sessão, mas a preferência não pôde ser salva.');
                const result=await call(reset?'resetThemeSettings':'saveThemeSettings',{themeId:id,part,generation:snapshot.generation,revision:snapshot.revision,profileRevision:snapshot.profileRevision,deviceRevision:snapshot.deviceRevision});
                if(!current(version,profile))return;accept(result);
                if(!valid()){retries=0;continue;}
                if(!result.ok){if(result.errorCode==='conflict'&&retries++<1)continue;throw Error(result.error||'Não foi possível salvar o tema.');}
                desired.delete(part);retries=0;state.busy=desired.size>0;state.error='';emit();
            }catch(error){
                if(!current(version,profile))return;if(!valid())continue;
                if(id!=='default'){
                    for(const target of targets){
                        try{await apply(state.savedParts[target],target,valid);}catch{if(valid())resetPart(target);}
                    }
                }
                if(!valid())continue;
                desired.delete(part);state.busy=desired.size>0;if(reset)state.error=error.message;else state.errors[part]=error.message;emit();
            }
        }
    }
    function select(id,part=state.part){
        if((part!=='system'&&!areas.includes(part))||(id!=='default'&&!state.themes.some(theme=>theme.id===id&&supports(theme,part))))return Promise.resolve(false);
        choices.set(part,(choices.get(part)||0)+1);desired.set(part,id);
        if(id==='default'){for(const target of part==='system'?systemAreas:[part])resetPart(target);emit();}
        return startPump();
    }
    function startPump(){
        if(!running){const task=pump(epoch,state.profileId);running=task;const done=()=>{if(running===task){running=null;packages.clear();}};task.then(done,done);}
        return running;
    }
    function resetAll(){
        desired.clear();
        choices.set('system',(choices.get('system')||0)+1);
        for(const part of areas){choices.set(part,(choices.get(part)||0)+1);resetPart(part);}
        choices.set('__all__',(choices.get('__all__')||0)+1);desired.set('__all__','default');
        state.errors=emptyErrors();state.error='';state.busy=true;emit();
        return startPump();
    }
    async function importPackage(){
        const version=epoch,profile=state.profileId;state.busy=true;state.error='';emit();
        try{const data=await call('importThemePackage');if(!current(version,profile))return;accept(data);if(!data.ok)throw Error(data.error||'Não foi possível importar.');}
        catch(error){if(current(version,profile))state.error=error.message;}
        finally{if(current(version,profile)){state.busy=false;emit();}}
    }
    bridge?.addEventListener('message',event=>{
        let data=event.data;try{if(typeof data==='string')data=JSON.parse(data);}catch{return;}
        if(data?.type==='themeSettingsState'){
            const request=requests.get(data.requestId);if(!request||data.profileId!==request.profileId)return;
            requests.delete(data.requestId);clearTimeout(request.timeout);request.resolve(data);
        }else if(data?.type==='userSwitchStart')void bindProfile('');
        else if(data?.type==='currentUserUpdated'){
            const profile=String(data.currentUserId||data.user?.Id||data.user?.id||'');if(profile!==state.profileId)void bindProfile(profile);
        }
    });
    window.DoorpiThemeSelection=Object.freeze({getState,select,resetAll,importPackage,selectPart:part=>{if(part==='system'||areas.includes(part)){state.part=part;emit();}},whenReady:()=>ready,whenDeviceReady:()=>deviceReady,get devicePending(){return devicePending;},refresh:()=>bindProfile(window._doorpiCurrentUserId||'')});
    document.addEventListener('keydown',event=>{
        if(!event.ctrlKey||!event.shiftKey||event.code!=='F12')return;
        event.preventDefault();void resetAll();
    },true);
    if(bridge?.postMessage){
        if(window._doorpiCurrentUserId)void bindProfile(window._doorpiCurrentUserId);
        else{
            const version=++deviceEpoch;
            const initialChoice=choices.get('login')||0;
            devicePending=true;
            let timeout;
            const load=call('requestThemeSettings',{profileId:''}).then(async data=>{if(version!==deviceEpoch||state.profileId)return;accept(data);if(!data.ok)throw Error(data.error);await apply(state.savedParts.login,'login',()=>version===deviceEpoch&&!state.profileId&&(choices.get('login')||0)===initialChoice,'');emit();});
            deviceReady=Promise.race([load,new Promise((_,reject)=>timeout=setTimeout(()=>{if(deviceEpoch===version)deviceEpoch++;reject(Error('Tempo de tema excedido.'));},5000))])
                .catch(()=>{if(!state.profileId)resetPart('login');}).finally(()=>{clearTimeout(timeout);devicePending=false;if(!state.profileId)packages.clear();});
        }
    }
})();
