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
