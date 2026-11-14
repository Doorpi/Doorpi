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
