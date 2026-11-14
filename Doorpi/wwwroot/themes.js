/* Appearance API only. No profile persistence, host commands or community code execution. */
(() => {
    'use strict';
    let contractPromise;
    let generation = 0;
    let activeId = null;
    const owned = new Map();
    const ownedAttributes = new Map();
    const root = document.documentElement;
    const appearanceFunctions = new Set([
        'rgb', 'rgba', 'hsl', 'hsla', 'hwb', 'lab', 'lch', 'oklab', 'oklch', 'color', 'color-mix', 'light-dark',
        'linear-gradient', 'radial-gradient', 'conic-gradient', 'repeating-linear-gradient', 'repeating-radial-gradient',
        'repeating-conic-gradient', 'calc', 'min', 'max', 'clamp', 'blur', 'brightness', 'contrast', 'grayscale',
        'hue-rotate', 'invert', 'opacity', 'saturate', 'sepia', 'drop-shadow', 'minmax', 'repeat', 'fit-content'
    ]);

    async function getContract() {
        if (!contractPromise) {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5000);
            contractPromise = fetch(new URL('themes/contract.json', document.baseURI), { cache: 'no-cache', signal: controller.signal }).then(response => {
                if (!response.ok) throw new Error('Theme contract could not be loaded.');
                return response.json();
            }).then(contract => {
                if (contract.schemaVersion !== 1 || contract.apiVersion !== 1 || !contract.tokens)
                    throw new Error('Unsupported theme contract.');
                return contract;
            }).catch(error => { contractPromise = null; throw error; }).finally(() => clearTimeout(timeout));
        }
        return contractPromise;
    }

    function validate(theme, contract) {
        if (!theme || theme.schemaVersion !== 1 || theme.apiVersion !== contract.apiVersion ||
            typeof theme.id !== 'string' || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(theme.id) ||
            typeof theme.name !== 'string' || !theme.name.trim() || theme.name.length > 100 ||
            !theme.tokens || typeof theme.tokens !== 'object' || Array.isArray(theme.tokens))
            throw new Error('Invalid theme manifest.');
        if (Object.keys(theme).some(key => !['schemaVersion', 'apiVersion', 'id', 'name', 'tokens', 'layout'].includes(key)))
            throw new Error('Unsupported theme capability.');
        const entries = Object.entries(theme.tokens);
        if (entries.length > Object.keys(contract.tokens).length) throw new Error('Too many theme tokens.');
        for (const [name, value] of entries) {
            const token = Object.hasOwn(contract.tokens, name) ? contract.tokens[name] : null;
            if (!token || typeof value !== 'string' || !value.trim() || value.length > 2048 ||
                (token.fixed === true && value !== token.default) ||
                /[;{}@!\\]/.test(value) || /\/\*|\*\//.test(value) ||
                [...value.matchAll(/([a-z][a-z0-9-]*)\s*\(/gi)].some(match => !appearanceFunctions.has(match[1].toLowerCase())) ||
                /^(?:initial|inherit|unset|revert|revert-layer)$/i.test(value.trim()) ||
                !CSS.supports(token.cssProperty, value))
                throw new Error('Invalid theme token: ' + name);
        }
        const layout = theme.layout ?? {};
        if (typeof layout !== 'object' || Array.isArray(layout)) throw new Error('Invalid theme layout.');
        const attributes = [['data-doorpi-theme', theme.id]];
        for (const [region, variant] of Object.entries(layout)) {
            const definition = Object.hasOwn(contract.layouts, region) ? contract.layouts[region] : null;
            if (!definition) throw new Error('Unsupported layout region: ' + region);
            if (typeof variant === 'string' && definition.variants.includes(variant)) {
                attributes.push([definition.attribute, variant]);
                continue;
            }
            if (!definition.customGrid || !variant || typeof variant !== 'object' || Array.isArray(variant) ||
                Object.keys(variant).some(key => !['areas','rows','columns'].includes(key)) ||
                !Array.isArray(variant.areas) || !variant.areas.length || variant.areas.length > 8)
                throw new Error('Invalid layout template: ' + region);
            const rows = variant.areas.map(row => typeof row === 'string' ? row.trim().split(/\s+/) : []);
            if (!rows[0].length || rows[0].length > 8 || rows.some(row => row.length !== rows[0].length ||
                row.some(cell => cell !== '.' && !definition.regions.includes(cell))) ||
                definition.regions.some(required => !rows.some(row => row.includes(required))))
                throw new Error('Layout must preserve every region: ' + region);
            const areas = rows.map(row => '"' + row.join(' ') + '"').join(' ');
            if (!CSS.supports('grid-template-areas', areas)) throw new Error('Non-rectangular layout region: ' + region);
            for (const [field, property] of [['rows','grid-template-rows'],['columns','grid-template-columns']]) {
                const value = variant[field];
                if (typeof value !== 'string' || !value.trim() || value.length > 512 || /[;{}@!\\]/.test(value) ||
                    /\/\*|\*\//.test(value) || /^(?:initial|inherit|unset|revert|revert-layer)$/i.test(value.trim()) ||
                    [...value.matchAll(/([a-z][a-z0-9-]*)\s*\(/gi)].some(match => !appearanceFunctions.has(match[1].toLowerCase())) ||
                    !CSS.supports(property, value)) throw new Error('Invalid layout tracks: ' + region);
                entries.push(['--doorpi-region-' + region + '-' + field, value]);
            }
            entries.push(['--doorpi-region-' + region + '-areas', areas]);
            attributes.push([definition.attribute, 'custom']);
        }
        return { entries, attributes };
    }

    function restoreOwnedProperties() {
        for (const [name, saved] of owned) {
            // Do not overwrite a later change made by the application.
            const target = saved.target;
            if (target.style.getPropertyValue(name) !== saved.applied || target.style.getPropertyPriority(name) !== '') continue;
            if (saved.value) target.style.setProperty(name, saved.value, saved.priority);
            else target.style.removeProperty(name);
        }
        owned.clear();
        for (const [name, saved] of ownedAttributes) {
            if (root.getAttribute(name) !== saved.applied) continue;
            if (saved.value === null) root.removeAttribute(name);
            else root.setAttribute(name, saved.value);
        }
        ownedAttributes.clear();
        activeId = null;
    }

    async function apply(theme, options = {}) {
        const request = ++generation;
        const scope = options.scope ?? 'global';
        if (!['global','home'].includes(scope)) throw new Error('Unsupported theme scope.');
        // Copy before awaiting: caller mutation cannot change the validated request.
        const snapshot = JSON.parse(JSON.stringify(theme));
        const contract = await getContract();
        if (request !== generation) return { applied: false, superseded: true };
        const { entries, attributes } = validate(snapshot, contract); // Validate everything before touching the current theme.
        const target = scope === 'home' ? document.getElementById('doorpi-app-ui') : root;
        if (!target) throw new Error('Home theme root is unavailable.');
        if (scope === 'home') {
            // Bridge aliases at their actual owner, rather than changing the document/body.
            for (const [token, alias] of [['--doorpi-font-family','font-family'],['--doorpi-text-primary','color'],['--doorpi-card-radius','--card-radius'],['--doorpi-card-gap','--card-gap'],['--doorpi-library-side-padding','--grid-pad-side'],['--doorpi-accent','--accent']])
                if (Object.hasOwn(snapshot.tokens,token)) entries.push([alias,'var('+token+')']);
        }
        const capture = (element,name) => [element,name,element.style.getPropertyValue(name),element.style.getPropertyPriority(name)];
        const before = [...owned].map(([name,saved])=>capture(saved.target,name)).concat(entries.map(([name])=>capture(target,name)));
        const affectedAttributes = new Set([...ownedAttributes.keys(), ...attributes.map(([name]) => name)]);
        const beforeAttributes = [...affectedAttributes].map(name => [name, root.getAttribute(name)]);
        const oldOwnedAttributes = new Map(ownedAttributes);
        const oldOwned = new Map(owned);
        const oldId = activeId;
        try {
            restoreOwnedProperties();
            for (const [name, value] of entries) {
                const saved = { target, value: target.style.getPropertyValue(name), priority: target.style.getPropertyPriority(name) };
                target.style.setProperty(name, value);
                owned.set(name, { ...saved, applied: target.style.getPropertyValue(name) });
            }
            for (const [name, value] of attributes) {
                const previous = root.getAttribute(name);
                root.setAttribute(name, value);
                ownedAttributes.set(name, { value: previous, applied: value });
            }
            activeId = snapshot.id;
        } catch (error) {
            // Restore the exact pre-transaction state, including later app writes.
            for (const [element, name, value, priority] of before) {
                if (value) element.style.setProperty(name, value, priority); else element.style.removeProperty(name);
            }
            owned.clear();
            for (const [name, saved] of oldOwned) owned.set(name, saved);
            for (const [name, value] of beforeAttributes) {
                if (value === null) root.removeAttribute(name); else root.setAttribute(name, value);
            }
            ownedAttributes.clear();
            for (const [name, saved] of oldOwnedAttributes) ownedAttributes.set(name, saved);
            activeId = oldId;
            throw error;
        }
        window.dispatchEvent(new CustomEvent('doorpi:theme-changed', { detail: { id: activeId } }));
        return { applied: true, id: activeId };
    }

    function reset() {
        ++generation; // Cancels a pending asynchronous application too.
        restoreOwnedProperties();
        window.dispatchEvent(new CustomEvent('doorpi:theme-changed', { detail: { id: null } }));
    }

    window.DoorpiThemes = Object.freeze({ apiVersion: 1, apply, reset, check: async theme => validate(JSON.parse(JSON.stringify(theme)),await getContract()), get activeId() { return activeId; } });
})();
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
// Core presentation adapter. Never changes media URLs, player identity or playback policy.
(() => {
    'use strict';
    let pending = 0, observer, observed;
    function measure() {
        pending = 0;
        const layer = document.querySelector('.home-trailer-layer');
        const target = document.querySelector('.home-feature-art-shell');
        if (!layer || !target) return;
        if (observed !== target) {
            observer?.disconnect();
            observer = new ResizeObserver(schedule);
            observer.observe(target);
            const stage = target.closest('.home-feature-stage');
            if (stage) observer.observe(stage);
            observed = target;
        }
        if (document.documentElement.getAttribute('data-doorpi-trailer-layout') !== 'feature-art') {
            for (const key of ['x','y','width','height']) layer.style.removeProperty('--doorpi-trailer-' + key);
            return;
        }
        const art = target.getBoundingClientRect(), bounds = layer.getBoundingClientRect();
        const scale = bounds.width / layer.clientWidth || 1;
        for (const [key, value] of Object.entries({ x: (art.left-bounds.left)/scale, y: (art.top-bounds.top)/scale, width: art.width/scale, height: art.height/scale }))
            layer.style.setProperty('--doorpi-trailer-' + key, Math.max(0, value) + 'px');
    }
    function schedule() { if (!pending) pending = requestAnimationFrame(measure); }
    window.addEventListener('doorpi:theme-changed', schedule);
    window.addEventListener('resize', schedule);
    new MutationObserver(schedule).observe(document.documentElement, { attributes: true, attributeFilter: ['data-doorpi-trailer-layout','data-doorpi-home-layout','data-doorpi-feature-layout'] });
    if (document.body) new MutationObserver(schedule).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    window.DoorpiTrailerLayout = Object.freeze({ refresh: schedule });
    schedule();
})();
// Trusted compiler for visual packages. Community JavaScript/HTML never executes here.
(() => {
    'use strict';
    const sheets = new Map();
    function complete(source) {
        let quote='',comment=false,braces=0,parens=0,brackets=0;
        for(let i=0;i<source.length;i++){
            const c=source[i],next=source[i+1];
            if(comment){if(c==='*'&&next==='/'){comment=false;i++;}continue;}
            if(quote){if(c===quote)quote='';continue;}
            if(c==='/'&&next==='*'){comment=true;i++;continue;}
            if(c==='"'||c==="'"){quote=c;continue;}
            if(c==='@'){
                const name=source.slice(i).match(/^@([a-z-]+)/i)?.[1]?.toLowerCase();
                if(!['media','supports','font-face','keyframes'].includes(name))throw Error('Regra CSS não suportada: @'+(name||'?'));
            }
            if(c==='{')braces++;if(c==='}')braces--;
            if(c==='(')parens++;if(c===')')parens--;
            if(c==='[')brackets++;if(c===']')brackets--;
            if(braces<0||parens<0||brackets<0)throw Error('CSS incompleto: revise as chaves e parênteses.');
        }
        if(quote||comment||braces||parens||brackets)throw Error('CSS incompleto: revise as chaves, comentários e aspas.');
    }
    function split(value) {
        const out = []; let start = 0, depth = 0, quote = '';
        for (let i = 0; i < value.length; i++) {
            const c = value[i];
            if (quote) { if (c === quote) quote = ''; continue; }
            if (c === '"' || c === "'") quote = c;
            else if (c === '(' || c === '[') depth++;
            else if (c === ')' || c === ']') depth--;
            else if (c === ',' && !depth) { out.push(value.slice(start,i).trim()); start=i+1; }
        }
        out.push(value.slice(start).trim()); return out;
    }
    function prepare(part, source, assets, definition, identity) {
        if (!definition || typeof source !== 'string' || source.length > 131072 || /\\|@import\b|@namespace\b/i.test(source))
            throw Error('CSS de tema não suportado. Imports, escapes e código não são permitidos.');
        complete(source);
        const parsed = new CSSStyleSheet(); parsed.replaceSync(source);
        const prefix = 'dp-' + identity.replace(/[^a-z0-9-]/gi,'-') + '-' + part + '-';
        const names = new Map(), fonts = new Map();
        function gather(rules) {
            for (const rule of rules) {
                if (rule.type === CSSRule.KEYFRAMES_RULE) names.set(rule.name, prefix+rule.name);
                else if (rule.type === CSSRule.FONT_FACE_RULE) {
                    const name=rule.style.getPropertyValue('font-family').replace(/^["']|["']$/g,'');
                    if (!/^[a-z0-9 -]{1,80}$/i.test(name)) throw Error('Nome de fonte inválido.');
                    fonts.set(name.toLowerCase(),prefix+name.replace(/ /g,'-'));
                } else if (rule.type === CSSRule.MEDIA_RULE || rule.type === CSSRule.SUPPORTS_RULE) gather(rule.cssRules);
            }
        }
        gather(parsed.cssRules);
        function declarations(style) {
            const output=[];
            for (const property of style) {
                let value=style.getPropertyValue(property);
                if(/(?:https?:|file:|javascript:|data:|image-set\s*\()/i.test(value))throw Error('Recursos remotos/embutidos devem ser substituídos por arquivos em assets/.');
                if (/url\s*\(/i.test(value)) {
                    value=value.replace(/url\(\s*(["']?)([^"'()\s]+)\1\s*\)/gi,(_,quote,file)=>{
                        if (!/^assets\/[a-zA-Z0-9_./-]+$/.test(file) || file.split('/').some(segment=>!segment || segment==='.' || segment==='..') || !assets[file])
                            throw Error('Recurso deve pertencer ao pacote: '+file);
                        const asset=assets[file];
                        if (!/^data:(?:image\/(?:png|jpeg|webp|avif)|font\/woff2?);base64,[A-Za-z0-9+/=]+$/.test(asset)) throw Error('Recurso visual inválido.');
                        return 'url("'+asset+'")';
                    });
                    if (/url\s*\(/i.test(value.replace(/url\("data:[^"]+"\)/g,''))) throw Error('URL de tema não suportada.');
                }
                if (property==='font-family') value=split(value).map(name=>fonts.get(name.replace(/^["']|["']$/g,'').toLowerCase()) || name).join(',');
                if (property.startsWith('animation')) {
                    for (const [name,replacement] of names) {
                        if (!/^[a-zA-Z][a-zA-Z0-9-]*$/.test(name)) throw Error('Nome de animação inválido.');
                        value=value.replace(new RegExp('(^|[\\s,])'+name+'(?=$|[\\s,])','g'),'$1'+replacement);
                    }
                }
                // A part cannot rewrite another part's private theme/runtime variables.
                if (property.startsWith('--doorpi-') && part!=='home') throw Error('Use propriedades locais; tokens globais pertencem à Home.');
                if (property.startsWith('--doorpi-') && !(property in window.DoorpiThemePackageRuntime.tokenDefaults)) throw Error('Token de tema desconhecido: '+property);
                if (property==='--doorpi-home-card-ratio' && value.trim()!=='1.5') throw Error('As capas devem manter a proporção 2:3.');
                output.push(property+':'+value+(style.getPropertyPriority(property)?' !important':'')+';');
            }
            return output.join('');
        }
        const globals=[];
        function rules(list) {
            return [...list].map(rule=>{
                if (rule.type===CSSRule.STYLE_RULE) {
                    if(rule.cssRules?.length)throw Error('Use seletores planos nesta versão do pacote, sem nesting CSS.');
                    const target=':scope'+scope;
                    const selectors=split(rule.selectorText).map(selector=>selector.includes(':scope')?selector.replace(/:scope/g,target):target+' '+selector).join(',');
                    return selectors+'{'+declarations(rule.style)+'}';
                }
                if (rule.type===CSSRule.MEDIA_RULE) return '@media '+rule.conditionText+'{'+rules(rule.cssRules)+'}';
                if (rule.type===CSSRule.SUPPORTS_RULE) return '@supports '+rule.conditionText+'{'+rules(rule.cssRules)+'}';
                if (rule.type===CSSRule.KEYFRAMES_RULE) { globals.push('@keyframes '+names.get(rule.name)+'{'+[...rule.cssRules].map(frame=>frame.keyText+'{'+declarations(frame.style)+'}').join('')+'}'); return ''; }
                if (rule.type===CSSRule.FONT_FACE_RULE) { globals.push('@font-face{'+declarations(rule.style)+'}'); return ''; }
                throw Error('Regra CSS não suportada pelo contrato visual: '+rule.cssText.slice(0,60));
            }).join('');
        }
        const scope=':is('+definition.roots.join(',')+')';
        // The settings/recovery screen remains core-owned even under a nav-menu theme.
        const ends=['#themeSettingsRoot',...Object.entries(surfaceRoots).filter(([id])=>id!==part).flatMap(([,roots])=>roots)];
        const scoped='@scope ('+scope+') to (:is('+ends.join(',')+')) {'+rules(parsed.cssRules)+'}';
        const check=new CSSStyleSheet();check.replaceSync(scoped);
        if (!check.cssRules.length || !('start' in check.cssRules[0])) throw Error('Este WebView2 precisa ser atualizado para usar pacotes visuais.');
        return globals.join('')+scoped;
    }
    function install(part, css) {
        let style=sheets.get(part);
        if (!style) { style=document.createElement('style');style.dataset.doorpiThemePart=part;document.head.appendChild(style);sheets.set(part,style); }
        style.textContent=css;
        if(part==='home'){
            let guard=document.getElementById('doorpiThemeCardGuard');
            if(!guard){guard=document.createElement('style');guard.id='doorpiThemeCardGuard';document.head.appendChild(guard);}
            guard.textContent='@layer doorpi-card-contract { #doorpi-app-ui :is(#gameGrid,#mediaGrid,#storesGrid) .card { aspect-ratio:2/3!important;height:auto!important;min-height:0!important;max-height:none!important; } }';
        }
        window.dispatchEvent(new CustomEvent('doorpi:theme-changed',{detail:{part}}));
    }
    function reset(part) { sheets.get(part)?.remove(); sheets.delete(part);if(part==='home')document.getElementById('doorpiThemeCardGuard')?.remove(); }
    const tokenDefaults=Object.create(null),surfaceRoots=Object.create(null);
    function configure(contract,tokens){
        Object.assign(tokenDefaults,tokens.tokens);
        for(const [part,definition] of Object.entries(contract.parts))surfaceRoots[part]=definition.roots;
    }
    window.DoorpiThemePackageRuntime=Object.freeze({ prepare, install, reset, configure, tokenDefaults });
})();
