    function lang() {
        try { return typeof currentLang !== 'undefined' && currentLang === 'pt-BR' ? 'pt' : 'en'; }
        catch { return /^pt/i.test(navigator.language || '') ? 'pt' : 'en'; }
    }
    function tx(key) { return COPY[lang()][key] || COPY.en[key] || key; }
    function keyboardKeyLabel(code, label = KEY_NAMES.get(Number(code))) {
        return [173,174,175].includes(Number(code)) ? tx(label) : label;
    }
    function esc(value) { const span = document.createElement('span'); span.textContent = String(value ?? ''); return span.innerHTML; }
    function clone(value) { return JSON.parse(JSON.stringify(value)); }
    function post(payload) {
        if (typeof window.postToHost === 'function') window.postToHost(payload);
        else window.chrome?.webview?.postMessage(JSON.stringify(payload));
    }
    function targetKey(target) { return `${String(target?.kind || '').toLowerCase()}:${String(target?.id || '')}`; }
    function mouseKeyboardEnabled() { return !state.target || state.target.mouseKeyboardEnabled !== false; }
    function isBuiltIn(profile = state.draft) { return !!profile?.isBuiltIn || String(profile?.id || '').startsWith('builtin-'); }
    function isGlobalProfile(profile) {
        const id = String(profile?.id || '').toLowerCase();
        const category = String(profile?.category || '').toLowerCase();
        const targetKind = String(profile?.targetKind || '').toLowerCase();
        const bindings = Array.isArray(profile?.bindings) ? profile.bindings : [];
        return id === 'global-default' || category === 'global' || targetKind === 'global' ||
            (bindings.length > 0 && bindings.every(binding => binding?.action?.type === 'system' && ['task-switcher','doorpi-return'].includes(binding?.action?.systemCommand)));
    }
    function isYouTubeProfile(profile = state.draft) {
        const id = String(profile?.id || '').toLowerCase();
        const base = String(profile?.baseProfileId || '').toLowerCase();
        return id === 'builtin-youtube' || base === 'builtin-youtube';
    }
    function profileDisplayName(profile) {
        if (profile?.id === 'builtin-web') return tx('genericWeb');
        if (profile?.id === 'builtin-youtube') return tx('genericYouTube');
        if (profile?.id === 'builtin-executable') return tx('genericExe');
        if (profile?.id === 'builtin-store') return tx('genericStore');
        return profile?.name || '';
    }
