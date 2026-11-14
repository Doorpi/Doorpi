    function initials(value) {
        const words = String(value || '').trim().split(/\s+/).filter(Boolean);
        return (words.slice(0, 2).map(word => word[0]).join('') || 'AP').toUpperCase();
    }
    function targetImageSource(target) {
        const icon = String(target?.iconBase64 || '').trim();
        if (icon) return icon.startsWith('data:') ? icon : `data:image/png;base64,${icon}`;
        const artwork = String(target?.artwork || '').trim();
        if (/^(data:|https?:|file:|doorpi:)/i.test(artwork)) return artwork;
        return '';
    }
    function targetFallbackSvg(target) {
        const category = String(target?.category || '').toLowerCase();
        if (category === 'web') return `<svg viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3.5" y="5" width="25" height="21" rx="3"/><path d="M4 10h24M9 7.5h.01M12 7.5h.01" stroke-linecap="round"/><circle cx="16" cy="18" r="5"/><path d="M11 18h10M16 13c1.5 1.5 2.2 3.2 2.2 5S17.5 21.5 16 23c-1.5-1.5-2.2-3.2-2.2-5s.7-3.5 2.2-5Z"/></svg>`;
        if (category === 'store') return `<svg viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"><path d="M7 12h18l-1.4 15H8.4L7 12Z"/><path d="M11.5 13V9.5a4.5 4.5 0 0 1 9 0V13"/><path d="m12.5 20 2.3 2.3 4.9-5" stroke-linecap="round"/></svg>`;
        if (category === 'executable') return `<svg viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="5" width="24" height="21" rx="3"/><path d="M4 11h24M9 8h.01M12 8h.01M10 17l3 3-3 3M16 23h6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
        return `<svg viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="4" width="10" height="10" rx="2"/><rect x="18" y="4" width="10" height="10" rx="2"/><rect x="4" y="18" width="10" height="10" rx="2"/><rect x="18" y="18" width="10" height="10" rx="2"/></svg>`;
    }
    function targetArtHtml(target, className = 'cc-app-art') {
        const source = targetImageSource(target);
        return `<span class="${className}">${source ? `<img src="${esc(source)}" alt="">` : targetFallbackSvg(target)}</span>`;
    }
    function controllerSvg(className = '') {
        return `<svg class="${className}" viewBox="0 72 580 420" aria-hidden="true" focusable="false" fill="none">
            <path fill="currentColor" fill-opacity=".34" stroke="currentColor" stroke-width="14" stroke-linejoin="round" fill-rule="evenodd" d="M505.765 150.961c-16.255-10.392-4.528-16.328-21.353-29.192s-85.104-34.639-96.983-24.743-25.233 11.873-25.233 11.873h-72.234-72.118s-13.36-1.977-25.233-11.873-80.16 11.873-96.983 24.743-5.098 18.801-21.353 29.192S15.467 304.843 15.467 304.843-39.95 464.666 59.011 483.963c0 0 24.241-15.337 45.025-40.08 7.778-9.26 18.33-19.97 29.627-29.78v-3.794c0-20.569 16.738-37.308 37.308-37.308h233.967c18.514 0 33.923 13.556 36.818 31.261 8.213 3.825 14.309 11.42 16.188 20.453 6.812 6.573 13.017 13.177 18.054 19.168 20.783 24.743 45.024 40.08 45.024 40.08 98.961-19.297 43.544-179.12 43.544-179.12s-42.546-143.496-58.801-153.882ZM438.047 148.335a24.89 24.89 0 1 1 0 49.78 24.89 24.89 0 0 1 0-49.78Zm-38.115 38.098a24.89 24.89 0 1 1 0 49.78 24.89 24.89 0 0 1 0-49.78Zm-67.786 8.965a15.927 15.927 0 1 1 0 31.854 15.927 15.927 0 0 1 0-31.854Zm-190.007-34.143a49.08 49.08 0 1 1 0 98.159 49.08 49.08 0 0 1 0-98.159Zm114.26 155.552a3.06 3.06 0 0 1-3.06 3.061h-22.448v22.454a3.06 3.06 0 0 1-3.06 3.06h-24.235a3.06 3.06 0 0 1-3.06-3.06v-22.454h-22.448a3.06 3.06 0 0 1-3.06-3.061v-24.235a3.06 3.06 0 0 1 3.06-3.06h22.448v-22.454a3.06 3.06 0 0 1 3.06-3.06h24.235a3.06 3.06 0 0 1 3.06 3.06v22.454h22.448a3.06 3.06 0 0 1 3.06 3.06v24.235Zm-7.38-89.56a15.927 15.927 0 1 1 0-31.855 15.927 15.927 0 0 1 0 31.855Zm41.003-49.976a29.841 29.841 0 1 1 0-59.682 29.841 29.841 0 0 1 0 59.682Zm75.277 171.703a49.08 49.08 0 1 1 0-98.159 49.08 49.08 0 0 1 0 98.159Zm72.748-72.663a24.89 24.89 0 1 1 0-49.78 24.89 24.89 0 0 1 0 49.78Zm41.059-40.098a24.89 24.89 0 1 1 0-49.78 24.89 24.89 0 0 1 0 49.78Z"/>
            <circle cx="142.139" cy="210.337" r="28" stroke="currentColor" stroke-width="14"/><circle cx="365.299" cy="299.897" r="28" stroke="currentColor" stroke-width="14"/>
        </svg>`;
    }
    function doorpiMarkSvg(className = '') {
        return `<svg class="${className}" viewBox="0 0 357 302" aria-hidden="true" focusable="false" fill="none"><path transform="translate(-357 -366)" stroke="currentColor" stroke-width="13" stroke-linecap="round" stroke-linejoin="round" fill-rule="evenodd" d="M491.466248 448.851471c.142028-18.145874.312835-35.809021.410461-53.472565.104645-18.932434 16.311493-29.18399 33.220764-20.610382 20.28949 10.287445 40.362488 21.00232 60.518616 31.552307 8.697204 4.552216 17.320557 9.24765 26.062073 13.712311 11.692382 5.971771 17.597 15.509216 17.433166 28.53598-.565857 44.98758-1.281128 89.973297-1.952087 134.959565-.255982 17.160766-.404846 34.325134-.917908 51.478454-.130371 4.359802 1.00293 6.298096 5.431641 7.601257 26.002075 7.651001 51.889771 15.690735 77.813507 23.609864.781006.238586 1.527405.590515 3.60791 1.406739h-110.127258c0-2.181641-.025025-4.125916.003601-6.069458 1.001831-67.978455 1.966125-135.95752 3.059509-203.93454.168701-10.492432-4.450134-18.000275-13.425964-22.719757-13.706848-7.207001-27.585144-14.09256-41.467713-20.958649-7.332397-3.626556-11.554199-.943481-11.64673 7.291169-.666687 59.31668-1.283326 118.633911-1.924866 177.950866-.230286 21.293274-.568359 42.585938-.649536 63.8797-.013977 3.671204-.968872 4.857117-4.778687 4.846741-56.323425-.153687-112.647308-.151978-168.971741-.21106-1.78833-.001892-3.576416-.259277-5.460022-.988953 7.56015-2.104126 15.119507-4.211059 22.680603-6.311828 34.768585-9.660156 69.523895-19.368714 104.327332-28.901673 3.578643-.980163 5.031158-2.294616 5.04956-6.297485.214478-46.648438.624054-93.296143 1.043976-139.943481.107788-11.975006.432282-23.94809.660858-36.404633Z"/></svg>`;
    }
    function profileOwner(profile) {
        const ownerId = String(profile?.ownerUserId || '').toLowerCase();
        return state.profileOwners.find(owner => String(owner?.id || '').toLowerCase() === ownerId) || null;
    }
    function profilePurposeHtml(profile) {
        const identity = `${profile?.id || ''} ${profile?.baseProfileId || ''}`.toLowerCase();
        if (identity.includes('youtube')) {
            return `<span class="cc-profile-purpose-main youtube"><svg viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3.5" y="6" width="25" height="20" rx="4"/><path d="m13.5 11.5 8 4.5-8 4.5v-9Z" fill="currentColor" stroke="none"/></svg></span>`;
        }
        const category = String(profile?.category || '').toLowerCase();
        if (['web','store','executable'].includes(category)) {
            return `<span class="cc-profile-purpose-main ${category}">${targetFallbackSvg({category})}</span>`;
        }
        return `<span class="cc-profile-purpose-main controller">${controllerSvg()}</span>`;
    }
    function profileArtHtml(profile, className = 'cc-profile-art') {
        if (isBuiltIn(profile)) {
            return `<span class="${className} system">${profilePurposeHtml(profile)}</span>`;
        }
        return `<span class="${className} custom">${profilePurposeHtml(profile)}</span>`;
    }
    function profileAuthorChipHtml(profile) {
        if (isBuiltIn(profile)) return `<span class="cc-profile-owner-chip doorpi"><strong>Doorpi</strong></span>`;
        const owner = profileOwner(profile);
        const name = owner?.name || tx('customBadge');
        return `<span class="cc-profile-owner-chip user"><strong>${esc(name)}</strong></span>`;
    }
    function profileAuthorSummary(profile) {
        if (isBuiltIn(profile)) return tx('builtInBadge');
        const owner = profileOwner(profile);
        return `${tx('customBadge')}${owner?.name ? ` · ${owner.name}` : ''}`;
    }
