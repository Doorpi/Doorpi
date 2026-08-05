(() => {
    'use strict';

    const COPY = {
        pt: {
            title: 'Controles', subtitle: 'Escolha um aplicativo, aplique um perfil e personalize cada comando.',
            app: 'Aplicativo', profile: 'Perfil de controle', change: 'Alterar',
            keyboard: 'Teclado', mouse: 'Mouse', systemCommands: 'Comandos do sistema',
            systemDesc: 'Ações essenciais do Doorpi. Você pode mudar a combinação do controle.',
            customCommands: 'Comandos de teclado', customDesc: 'Teclas e atalhos enviados somente para este aplicativo.',
            mouseCommands: 'Botões do mouse', mouseDesc: 'Cliques e rolagem enviados pelo controle.',
            scrollSpeed: 'Rolagem',
            addKeyboard: 'Adicionar comando de teclado', addMouse: 'Adicionar ação do mouse',
            configure: 'Configurar controle', editKeys: 'Alterar teclas', remove: 'Remover',
            notAssigned: 'Controle ainda não configurado', press: 'Ao pressionar', hold: 'Enquanto segurar', release: 'Ao soltar',
            save: 'Salvar controles', saved: 'Perfil salvo', unsaved: 'Alterações não salvas',
            genericWeb: 'Controles essenciais para web apps', genericExe: 'Controles essenciais para aplicativos',
            genericStore: 'Controles essenciais para lojas', genericYouTube: 'YouTube TV · controle remoto', systemProfile: 'Perfil do sistema · somente leitura',
            youtubeCommands: 'Controle remoto do YouTube TV', youtubeDesc: 'Comandos nativos de navegação e reprodução usados pelo YouTube TV.', remoteControl: 'Controle remoto', addRemoteCommand: 'Adicionar comando',
            ytNavigateUp: 'Navegar para cima', ytNavigateDown: 'Navegar para baixo', ytNavigateLeft: 'Navegar para esquerda', ytNavigateRight: 'Navegar para direita',
            ytSelect: 'Selecionar', ytBack: 'Voltar', ytPlayPause: 'Reproduzir ou pausar', ytRewind: 'Retroceder', ytFastForward: 'Avançar', ytPrevious: 'Vídeo anterior', ytNext: 'Próximo vídeo', ytClose: 'Fechar YouTube TV',
            customProfile: 'Perfil personalizado', selectProfile: 'Selecionar perfil', selectApp: 'Selecionar aplicativo',
            searchProfiles: 'Pesquisar perfis...', searchApps: 'Pesquisar aplicativos...', noResults: 'Nenhum resultado encontrado.',
            captureTitle: 'Gravar combinação do controle', captureIdle: 'Mova um analógico ou pressione e segure um botão.',
            captureRelease: 'Solte todos os botões para começar.', captureHolding: 'Continue segurando para confirmar',
            captureDone: 'Combinação gravada', cancel: 'Cancelar', back: 'Voltar', close: 'Fechar',
            saveTitle: 'Salvar perfil de controle', saveDesc: 'Escolha um nome para encontrar este perfil nesta máquina e na nuvem.',
            profileName: 'Nome do perfil', confirmSave: 'Salvar perfil',
            customSuffix: 'Controles personalizados', chooseKeys: 'Escolha as teclas do comando',
            chooseKeysDesc: 'Selecione uma tecla ou combinação no teclado abaixo.', apply: 'Aplicar', clear: 'Limpar',
            chooseMouse: 'Escolha a ação do mouse', left: 'Clique esquerdo', right: 'Clique direito',
            middle: 'Clique do meio', backMouse: 'Voltar', forwardMouse: 'Avançar', wheelUp: 'Rolar para cima', wheelDown: 'Rolar para baixo',
            emptyKeyboard: 'Nenhum comando de teclado personalizado.', emptyMouse: 'Nenhuma ação de mouse personalizada.',
            profileFork: 'Ao editar, será criado um novo perfil e o original do sistema continuará intacto.',
            trigger: 'Modo de acionamento', tabHint: 'LB / RB alterna entre as abas',
            appsGroup: 'Apps e web apps', storesGroup: 'Lojas', loading: 'Carregando perfis...',
            syncOn: 'Será sincronizado com a conta conectada.', syncOff: 'Salvo localmente; sincroniza quando a conta estiver conectada.',
            inputModeTitle: 'Mouse e teclado pelo controle', inputModeDesc: 'Permite enviar teclas, cliques, movimento do ponteiro e rolagem para este aplicativo.',
            inputModeOn: 'Ativado', inputModeOff: 'Desativado', inputModeRequired: 'Sempre ativo para web apps do Doorpi.',
            inputModeShared: 'Definido pelo proprietário deste aplicativo compartilhado.', inputModeLocked: 'Mouse e teclado estão desativados',
            inputModeLockedDesc: 'Ative a opção acima para editar comandos de teclado, mouse, ponteiro e rolagem.',
            globalShortcuts: 'Atalhos globais', appControls: 'Controles de aplicativos',
            globalDesc: 'Atalhos aplicados ao sistema inteiro, independentemente do aplicativo aberto.',
            noApp: 'Selecionar aplicativo', noAppDesc: 'Escolha onde este perfil de controle será usado.',
            longPress: 'Depois de segurar', holdDuration: 'Tempo de espera', holdDurationDesc: 'A ação será executada uma vez após esse período.', adjustRange: 'Pressione A para ajustar', adjustingRange: 'Ajustando · pressione A para concluir',
            closeWebApp: 'Fechar web app', saveGlobals: 'Salvar atalhos globais', resetDefaults: 'Restaurar padrão',
            cancelDoubleB: 'Pressione B duas vezes pra cancelar', cancelDoubleBArmed: 'Pressione B novamente para cancelar',
            discardTitle: 'Descartar alterações?', discardDesc: 'As edições deste perfil ainda não foram salvas.', discard: 'Descartar', keepEditing: 'Continuar editando',
            settings: 'Configurações', activeSetup: 'Configuração ativa', commands: 'Comandos', commandCount: 'comandos',
            selectedCommand: 'Comando selecionado', controllerShortcut: 'Atalho no controle', outputAction: 'Ação executada',
            controllerActivations: 'Comandos de ativação', primaryShortcut: 'Comando primário', secondaryShortcut: 'Comando secundário', secondaryEmpty: 'Sem comando secundário', clearSecondary: 'Limpar secundário', eitherCommand: 'ou',
            activation: 'Acionamento', addGlobal: 'Adicionar atalho global', chooseGlobal: 'Escolha uma ação do sistema',
            chooseGlobalDesc: 'Você poderá gravar a combinação do controle na etapa seguinte.', noSelection: 'Selecione um comando para editar',
            noSelectionDesc: 'Escolha um item da lista para alterar a combinação, o acionamento ou a ação executada.',
            appliedProfile: 'Perfil aplicado',
            assignedTo: 'Aplicado em', builtInBadge: 'Padrão Doorpi', customBadge: 'Personalizado',
            keyboardAction: 'Teclado', mouseAction: 'Mouse', systemAction: 'Sistema',
            navigateHint: 'Navegar', selectHint: 'Selecionar', backHint: 'Voltar',
            configureShortcut: 'Gravar combinação', editOutput: 'Alterar ação', currentShortcut: 'Combinação atual',
            mute: 'Mudo', volumeDown: 'Volume -', volumeUp: 'Volume +',
            pointerFree: 'Mover ponteiro', pointerUp: 'Mover para cima', pointerDown: 'Mover para baixo', pointerLeft: 'Mover para esquerda', pointerRight: 'Mover para direita',
            pointerDistance: 'Distância por toque', pointerDistanceDesc: 'Usado com botões e D-Pad. Cada acionamento move esta quantidade.', pixels: 'pixels',
            wheelAmount: 'Quantidade de rolagem', wheelAmountDesc: '120 unidades equivalem a um entalhe da roda; o aplicativo decide quantas linhas ou pixels isso representa.', wheelNotch: 'entalhe', wheelNotches: 'entalhes',
            analogSensitivity: 'Velocidade analógica', analogDeadzone: 'Zona morta do analógico', analogContinuous: 'Analógico · movimento contínuo',
            pointerChoiceDesc: 'Use movimento livre com um analógico ou direções individuais com botões e D-Pad.'
        },
        en: {
            title: 'Controls', subtitle: 'Choose an application, apply a profile and customize each command.',
            app: 'Application', profile: 'Control profile', change: 'Change',
            keyboard: 'Keyboard', mouse: 'Mouse', systemCommands: 'System commands',
            systemDesc: 'Essential Doorpi actions. You can change the controller combination.',
            customCommands: 'Keyboard commands', customDesc: 'Keys and shortcuts sent only to this application.',
            mouseCommands: 'Mouse buttons', mouseDesc: 'Clicks and scrolling sent by the controller.',
            scrollSpeed: 'Scrolling',
            addKeyboard: 'Add keyboard command', addMouse: 'Add mouse action',
            configure: 'Configure controller', editKeys: 'Change keys', remove: 'Remove',
            notAssigned: 'Controller input not configured', press: 'On press', hold: 'While held', release: 'On release',
            save: 'Save controls', saved: 'Profile saved', unsaved: 'Unsaved changes',
            genericWeb: 'Essential controls for web apps', genericExe: 'Essential controls for applications',
            genericStore: 'Essential controls for stores', genericYouTube: 'YouTube TV · remote control', systemProfile: 'System profile · read only',
            youtubeCommands: 'YouTube TV remote control', youtubeDesc: 'Native navigation and playback commands used by YouTube TV.', remoteControl: 'Remote control', addRemoteCommand: 'Add command',
            ytNavigateUp: 'Navigate up', ytNavigateDown: 'Navigate down', ytNavigateLeft: 'Navigate left', ytNavigateRight: 'Navigate right',
            ytSelect: 'Select', ytBack: 'Back', ytPlayPause: 'Play or pause', ytRewind: 'Rewind', ytFastForward: 'Fast-forward', ytPrevious: 'Previous video', ytNext: 'Next video', ytClose: 'Close YouTube TV',
            customProfile: 'Custom profile', selectProfile: 'Select profile', selectApp: 'Select application',
            searchProfiles: 'Search profiles...', searchApps: 'Search applications...', noResults: 'No results found.',
            captureTitle: 'Record controller combination', captureIdle: 'Move a stick or press and hold a button.',
            captureRelease: 'Release every button to begin.', captureHolding: 'Keep holding to confirm',
            captureDone: 'Combination recorded', cancel: 'Cancel', back: 'Back', close: 'Close',
            saveTitle: 'Save control profile', saveDesc: 'Choose a name to find this profile on this machine and in the cloud.',
            profileName: 'Profile name', confirmSave: 'Save profile',
            customSuffix: 'Custom controls', chooseKeys: 'Choose command keys',
            chooseKeysDesc: 'Select a key or combination on the keyboard below.', apply: 'Apply', clear: 'Clear',
            chooseMouse: 'Choose mouse action', left: 'Left click', right: 'Right click',
            middle: 'Middle click', backMouse: 'Back', forwardMouse: 'Forward', wheelUp: 'Scroll up', wheelDown: 'Scroll down',
            emptyKeyboard: 'No custom keyboard commands.', emptyMouse: 'No custom mouse actions.',
            profileFork: 'Editing creates a new profile and keeps the original system profile unchanged.',
            trigger: 'Activation mode', tabHint: 'LB / RB switches tabs',
            appsGroup: 'Apps and web apps', storesGroup: 'Stores', loading: 'Loading profiles...',
            syncOn: 'It will sync with the connected account.', syncOff: 'Saved locally; syncs when the account is connected.',
            inputModeTitle: 'Controller mouse and keyboard', inputModeDesc: 'Allows this profile to send keys, clicks, pointer movement and scrolling to the application.',
            inputModeOn: 'Enabled', inputModeOff: 'Disabled', inputModeRequired: 'Always enabled for Doorpi web apps.',
            inputModeShared: 'Defined by the owner of this shared application.', inputModeLocked: 'Mouse and keyboard are disabled',
            inputModeLockedDesc: 'Enable the option above to edit keyboard, mouse, pointer and scrolling commands.',
            globalShortcuts: 'Global shortcuts', appControls: 'Application controls',
            globalDesc: 'Shortcuts applied to the entire system, regardless of the open application.',
            noApp: 'Select application', noAppDesc: 'Choose where this control profile will be used.',
            longPress: 'After holding', holdDuration: 'Hold time', holdDurationDesc: 'The action runs once after this period.', adjustRange: 'Press A to adjust', adjustingRange: 'Adjusting · press A when done',
            closeWebApp: 'Close web app', saveGlobals: 'Save global shortcuts', resetDefaults: 'Restore defaults',
            cancelDoubleB: 'Press B twice to cancel', cancelDoubleBArmed: 'Press B again to cancel',
            discardTitle: 'Discard changes?', discardDesc: 'This profile still has unsaved edits.', discard: 'Discard', keepEditing: 'Keep editing',
            settings: 'Settings', activeSetup: 'Active configuration', commands: 'Commands', commandCount: 'commands',
            selectedCommand: 'Selected command', controllerShortcut: 'Controller shortcut', outputAction: 'Output action',
            controllerActivations: 'Activation commands', primaryShortcut: 'Primary command', secondaryShortcut: 'Secondary command', secondaryEmpty: 'No secondary command', clearSecondary: 'Clear secondary', eitherCommand: 'or',
            activation: 'Activation', addGlobal: 'Add global shortcut', chooseGlobal: 'Choose a system action',
            chooseGlobalDesc: 'You can record the controller combination in the next step.', noSelection: 'Select a command to edit',
            noSelectionDesc: 'Choose an item from the list to change its combination, activation mode or output action.',
            appliedProfile: 'Applied profile',
            assignedTo: 'Applied to', builtInBadge: 'Doorpi default', customBadge: 'Custom',
            keyboardAction: 'Keyboard', mouseAction: 'Mouse', systemAction: 'System',
            navigateHint: 'Navigate', selectHint: 'Select', backHint: 'Back',
            configureShortcut: 'Record combination', editOutput: 'Change action', currentShortcut: 'Current combination',
            mute: 'Mute', volumeDown: 'Volume -', volumeUp: 'Volume +',
            pointerFree: 'Move pointer', pointerUp: 'Move up', pointerDown: 'Move down', pointerLeft: 'Move left', pointerRight: 'Move right',
            pointerDistance: 'Distance per press', pointerDistanceDesc: 'Used with buttons and D-Pad. Each activation moves this amount.', pixels: 'pixels',
            wheelAmount: 'Scroll amount', wheelAmountDesc: '120 units equal one wheel notch; the application decides how many lines or pixels that represents.', wheelNotch: 'notch', wheelNotches: 'notches',
            analogSensitivity: 'Analog speed', analogDeadzone: 'Analog deadzone', analogContinuous: 'Analog · continuous movement',
            pointerChoiceDesc: 'Use free movement with a stick or individual directions with buttons and D-Pad.'
        }
    };

    const PAD_LABELS = {
        a: 'A', b: 'B', x: 'X', y: 'Y', lb: 'LB', rb: 'RB', lt: 'LT', rt: 'RT',
        back: 'View', guide: 'Xbox', start: 'Menu', l3: 'L3', r3: 'R3',
        'dpad-up': 'D-Pad ↑', 'dpad-down': 'D-Pad ↓', 'dpad-left': 'D-Pad ←', 'dpad-right': 'D-Pad →',
        'left-stick': 'Analógico L', 'right-stick': 'Analógico R',
        'left-stick-up': 'Analógico L ↑', 'left-stick-down': 'Analógico L ↓',
        'left-stick-left': 'Analógico L ←', 'left-stick-right': 'Analógico L →',
        'right-stick-up': 'Analógico R ↑', 'right-stick-down': 'Analógico R ↓',
        'right-stick-left': 'Analógico R ←', 'right-stick-right': 'Analógico R →'
    };

    const KEY_ROWS = [
        [[27,'Esc'],[112,'F1'],[113,'F2'],[114,'F3'],[115,'F4'],[116,'F5'],[117,'F6'],[118,'F7'],[119,'F8'],[120,'F9'],[121,'F10'],[122,'F11'],[123,'F12']],
        [[192,'`'],[49,'1'],[50,'2'],[51,'3'],[52,'4'],[53,'5'],[54,'6'],[55,'7'],[56,'8'],[57,'9'],[48,'0'],[189,'−'],[187,'='],[8,'Backspace','wide']],
        [[9,'Tab','wide'],[81,'Q'],[87,'W'],[69,'E'],[82,'R'],[84,'T'],[89,'Y'],[85,'U'],[73,'I'],[79,'O'],[80,'P'],[219,'['],[221,']'],[220,'\\']],
        [[20,'Caps','wide'],[65,'A'],[83,'S'],[68,'D'],[70,'F'],[71,'G'],[72,'H'],[74,'J'],[75,'K'],[76,'L'],[186,';'],[222,"'"],[13,'Enter','wide']],
        [[16,'Shift','xwide'],[90,'Z'],[88,'X'],[67,'C'],[86,'V'],[66,'B'],[78,'N'],[77,'M'],[188,','],[190,'.'],[191,'/']],
        [[17,'Ctrl','wide'],[91,'Win','wide'],[18,'Alt','wide'],[32,'Space','space'],[18,'Alt','wide'],[93,'Menu','wide'],[17,'Ctrl','wide']],
        [[37,'←'],[38,'↑'],[40,'↓'],[39,'→'],[45,'Ins'],[36,'Home'],[33,'PgUp'],[46,'Del'],[35,'End'],[34,'PgDn'],[173,'mute','wide'],[174,'volumeDown','wide'],[175,'volumeUp','wide']]
    ];
    const KEY_NAMES = new Map(KEY_ROWS.flat().map(([code, label]) => [code, label]));

    const state = {
        overlay: null, targets: [], profiles: [], profileOwners: [], assignments: [], target: null,
        profile: null, draft: null, tab: 'keyboard', dirty: false, popup: null,
        capture: null, captureSuppressed: false, requestedTarget: null, returnFocus: '', savePending: false,
        mode: 'apps', adjustingRange: null, selectedBindingIndex: -1, lastTarget: null, inputModePending: false,
        focusRequestGeneration: 0
    };

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
    function keyLabel(code) { return keyboardKeyLabel(code) || `VK ${code}`; }
    function actionLabel(action) {
        if (action?.type === 'keyboard') return (action.virtualKeys || []).map(keyLabel).join(' + ') || tx('chooseKeys');
        if (action?.type === 'mouse') return ({left:tx('left'),right:tx('right'),middle:tx('middle'),x1:tx('backMouse'),x2:tx('forwardMouse')})[action.mouseButton] || tx('left');
        if (action?.type === 'wheel') return Number(action.wheelDelta) < 0 ? tx('wheelDown') : tx('wheelUp');
        if (action?.type === 'pointer') return ({free:tx('pointerFree'),up:tx('pointerUp'),down:tx('pointerDown'),left:tx('pointerLeft'),right:tx('pointerRight')})[action.pointerDirection] || tx('pointerFree');
        if (action?.systemCommand === 'task-switcher') return 'Alt + Tab';
        if (action?.systemCommand === 'doorpi-return') return lang() === 'pt' ? 'Voltar ao Doorpi' : 'Return to Doorpi';
        if (action?.systemCommand === 'close-web-app') return tx('closeWebApp');
        if (action?.systemCommand === 'youtube-play-pause') return tx('ytPlayPause');
        return action?.systemCommand || 'System';
    }
    function triggerLabel(value) { return value === 'hold' ? tx('hold') : value === 'release' ? tx('release') : value === 'long-press' ? tx('longPress') : tx('press'); }
    function longPressLimit(binding, slot = 'primary') {
        const buttons = slot === 'secondary' ? binding?.secondaryControllerButtons : binding?.controllerButtons;
        return (buttons || []).some(button => String(button).toLowerCase() === 'guide') ? 3000 : 5000;
    }
    function longPressDuration(binding, slot = 'primary') { const value=slot === 'secondary' ? binding?.secondaryLongPressDurationMs : binding?.longPressDurationMs; return Math.max(500, Math.min(longPressLimit(binding,slot), Number(value) || 1200)); }
    function formatDuration(milliseconds) {
        const seconds = milliseconds / 1000;
        return `${seconds.toLocaleString(lang() === 'pt' ? 'pt-BR' : 'en-US', {minimumFractionDigits:seconds % 1 ? 1 : 0, maximumFractionDigits:1})} s`;
    }
    function activationTrigger(binding, slot = 'primary') { return slot === 'secondary' ? (binding?.secondaryTrigger || 'press') : (binding?.trigger || 'press'); }
    function triggerSummary(binding, slot = 'primary') { const trigger=activationTrigger(binding,slot); return trigger === 'long-press' ? `${triggerLabel(trigger)} · ${formatDuration(longPressDuration(binding,slot))}` : triggerLabel(trigger); }
    function chordHtml(buttons) {
        if (!buttons?.length) return `<span class="cc-unassigned">${tx('notAssigned')}</span>`;
        return `<span class="cc-chord">${buttons.map(button => `<kbd>${esc(PAD_LABELS[button] || button)}</kbd>`).join('<b>+</b>')}</span>`;
    }

    function controllerInputVisualHtml(buttons) {
        const active = new Set((buttons || []).map(button => String(button).toLowerCase()));
        const marker = (id,x,y,label,kind='') => active.has(id)
            ? `<span class="cc-control-marker ${kind}" style="--cc-x:${x}%;--cc-y:${y}%">${label}</span>`
            : '';
        const stickMarker = side => {
            const prefix = `${side}-stick`;
            const click = side === 'left' ? 'l3' : 'r3';
            const value = [...active].find(input => input === prefix || input.startsWith(`${prefix}-`) || input === click);
            if (!value) return '';
            const labels = { [`${prefix}-up`]:'↑', [`${prefix}-down`]:'↓', [`${prefix}-left`]:'←', [`${prefix}-right`]:'→' };
            const text = value === click ? (side === 'left' ? 'L3' : 'R3') : (labels[value] || (side === 'left' ? 'L' : 'R'));
            return `<span class="cc-control-marker stick" style="--cc-x:${side === 'left' ? 24.5 : 63}%;--cc-y:${side === 'left' ? 32.9 : 54.3}%">${text}</span>`;
        };
        const shoulder = (id,side,level) => active.has(id)
            ? `<span class="cc-control-outer ${side} ${level}">${id.toUpperCase()}</span>`
            : '';
        return `<span class="cc-controller-visual">
            ${shoulder('lt','left','trigger')}${shoulder('lb','left','bumper')}${shoulder('rt','right','trigger')}${shoulder('rb','right','bumper')}
            <span class="cc-controller-frame">${controllerSvg('cc-controller-map')}
            ${marker('y',75.5,24.1,'','face')}${marker('x',69,33.2,'','face')}${marker('b',82.6,33.2,'','face')}${marker('a',75.5,42.7,'','face')}
            ${marker('back',42.9,33.2,'','center')}${marker('guide',50,18,'','guide')}${marker('start',57.3,33.2,'','center')}
            ${marker('dpad-up',37.2,48,'↑','dpad')}${marker('dpad-down',37.2,63,'↓','dpad')}${marker('dpad-left',31.5,55.5,'←','dpad')}${marker('dpad-right',42.9,55.5,'→','dpad')}
            ${stickMarker('left')}${stickMarker('right')}
            </span>
        </span>`;
    }

    function controllerChordHtml(buttons, variant = '') {
        if (!buttons?.length) return `<span class="cc-unassigned">${tx('notAssigned')}</span>`;
        const text = buttons.map(button => PAD_LABELS[button] || button).join(' + ');
        return `<span class="cc-control-chord ${variant}">${controllerInputVisualHtml(buttons)}<span class="cc-control-chord-label">${esc(text)}</span></span>`;
    }

    function iconSvg(kind, className = '') {
        const icons = {
            keyboard: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M6 9h1m3 0h1m3 0h1m3 0h0M6 12h1m3 0h1m3 0h1m3 0h0M7 15h10"/>',
            mouse: '<path d="M12 3a6 6 0 0 0-6 6v6a6 6 0 0 0 12 0V9a6 6 0 0 0-6-6Z"/><path d="M12 3v6m-6 1h12"/>',
            system: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8v8m-4-4h8"/>',
            dpad: '<path d="M9 4h6v5h5v6h-5v5H9v-5H4V9h5V4Z"/>',
            plus: '<path d="M12 5v14M5 12h14"/>',
            close: '<path d="m7 7 10 10M17 7 7 17"/>',
            chevron: '<path d="m9 6 6 6-6 6"/>',
            arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
            edit: '<path d="M4 20h4l11-11-4-4L4 16v4Z"/><path d="m13 7 4 4"/>',
            trash: '<path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5"/>',
            profile: '<circle cx="12" cy="8" r="4"/><path d="M4 21c.8-5 3.5-7 8-7s7.2 2 8 7"/>',
            lock: '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>'
        };
        return `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">${icons[kind] || icons.system}</svg>`;
    }
    function mouseActionSvg(action, className = 'cc-mouse-action') {
        const type = action?.type;
        const key = type === 'wheel' ? (Number(action?.wheelDelta) < 0 ? 'wheel-down' : 'wheel-up') : (action?.mouseButton || 'left');
        const leftFill = key === 'left' ? '<path class="cc-mouse-fill" d="M15 4.1C9.8 4.5 7 8.3 6.6 13H15Z"/>' : '';
        const rightFill = key === 'right' ? '<path class="cc-mouse-fill" d="M17 4.1c5.2.4 8 4.2 8.4 8.9H17Z"/>' : '';
        const wheelFill = key === 'middle' || key.startsWith('wheel-') ? '<rect class="cc-mouse-fill" x="14" y="5.2" width="4" height="6.8" rx="2"/>' : '';
        const side = key === 'x1' ? '<rect class="cc-mouse-fill" x="2.2" y="14" width="5" height="5" rx="1.4"/><path d="m5.8 15.5-1.8 1 1.8 1"/>' : key === 'x2' ? '<rect class="cc-mouse-fill" x="2.2" y="20.2" width="5" height="5" rx="1.4"/><path d="m3.6 21.7 1.8 1-1.8 1"/>' : '';
        const wheelArrow = key === 'wheel-up' ? '<path d="m16 8.5-2.2 2.3M16 8.5l2.2 2.3M16 8.5v7"/>' : key === 'wheel-down' ? '<path d="m16 15.5-2.2-2.3M16 15.5l2.2-2.3M16 15.5v-7"/>' : '';
        return `<svg class="${className}" viewBox="0 0 32 32" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${leftFill}${rightFill}${wheelFill}<path d="M16 2.8C9.2 2.8 5.3 7.9 5.3 15v3c0 7 4.2 11.2 10.7 11.2S26.7 25 26.7 18v-3C26.7 7.9 22.8 2.8 16 2.8Z"/><path d="M5.8 13.5h20.4M16 3v10.5"/>${side}${wheelArrow}</svg>`;
    }
    function bindingKind(binding) {
        const type = binding?.action?.type;
        return type === 'keyboard' ? 'keyboard' : (type === 'mouse' || type === 'wheel' || type === 'pointer') ? 'mouse' : 'system';
    }
    function bindingIcon(binding) { return binding?.action?.type === 'pointer' ? stickSvg(binding.action.pointerDirection !== 'free') : bindingKind(binding) === 'mouse' ? mouseActionSvg(binding.action) : iconSvg(bindingKind(binding)); }
    function stickSvg(verticalOnly = false) {
        const arrows = verticalOnly ? '<path d="M16 5v22m0-22-3 3m3-3 3 3m-3 19-3-3m3 3 3-3"/>' : '<path d="M16 4v24M4 16h24m-12-12-2.8 2.8M16 4l2.8 2.8M28 16l-2.8-2.8M28 16l-2.8 2.8M16 28l-2.8-2.8M16 28l2.8-2.8M4 16l2.8-2.8M4 16l2.8 2.8"/>';
        return `<svg class="cc-stick-svg" viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="16" cy="16" r="8" fill="currentColor" fill-opacity=".12"/>${arrows}</svg>`;
    }
    function bindingTypeLabel(binding) {
        if (isYouTubeProfile()) return tx('remoteControl');
        return tx(`${bindingKind(binding)}Action`);
    }
    function youtubeBindingTitle(binding) {
        const id = String(binding?.id || '').toLowerCase();
        const labels = {
            'builtin-youtube-up':'ytNavigateUp', 'builtin-youtube-down':'ytNavigateDown',
            'builtin-youtube-left':'ytNavigateLeft', 'builtin-youtube-right':'ytNavigateRight',
            'builtin-youtube-select':'ytSelect', 'builtin-youtube-back':'ytBack',
            'builtin-youtube-play-pause':'ytPlayPause', 'builtin-youtube-rewind':'ytRewind',
            'builtin-youtube-fast-forward':'ytFastForward', 'builtin-youtube-previous':'ytPrevious',
            'builtin-youtube-next':'ytNext', 'builtin-youtube-close':'ytClose'
        };
        return labels[id] ? tx(labels[id]) : (binding?.name || actionLabel(binding?.action));
    }
    function bindingTitle(binding) {
        if (isYouTubeProfile()) return youtubeBindingTitle(binding);
        if (binding?.action?.type === 'system' && lang() === 'pt' && binding?.name) return binding.name;
        if (binding?.action?.type === 'wheel' && [...(binding.controllerButtons || []),...(binding.secondaryControllerButtons || [])].some(input => input === 'left-stick' || input === 'right-stick')) return tx('scrollSpeed');
        return actionLabel(binding?.action);
    }
    function visibleBindings() {
        if (!state.draft?.bindings) return [];
        if (state.mode === 'global') return state.draft.bindings.filter(binding => binding.action?.type === 'system');
        if (isYouTubeProfile()) return state.tab === 'keyboard' ? state.draft.bindings : [];
        if (state.tab === 'mouse') return state.draft.bindings.filter(binding => binding.action?.type === 'mouse' || binding.action?.type === 'wheel' || binding.action?.type === 'pointer' || binding.action?.systemCommand === 'close-web-app');
        return state.draft.bindings.filter(binding => binding.action?.type === 'keyboard');
    }
    function normalizeSelectedBinding() {
        const bindings = visibleBindings();
        if (!bindings.length) { state.selectedBindingIndex = -1; return; }
        if (!bindings.some(binding => state.draft.bindings.indexOf(binding) === state.selectedBindingIndex))
            state.selectedBindingIndex = state.draft.bindings.indexOf(bindings[0]);
    }

    function installStyles() {
        if (document.getElementById('doorpi-controls-v2-styles')) return;
        const style = document.createElement('style');
        style.id = 'doorpi-controls-v2-styles';
        style.textContent = `
            body.doorpi-controls-open{overflow:hidden}.cc-overlay{--cc-line:rgba(255,255,255,.125);--cc-soft:rgba(255,255,255,.055);--cc-muted:rgba(255,255,255,.54);position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:50000;isolation:isolate;color:#f7f9ff;background:rgba(10,15,28,.46);font-family:'Outfit','Segoe UI',sans-serif;backdrop-filter:blur(30px) saturate(1.08) brightness(1.08)}.cc-overlay::before{content:'';position:absolute;inset:0;z-index:-1;background:radial-gradient(ellipse at 78% 0%,rgba(91,130,190,.19),transparent 48%),linear-gradient(115deg,rgba(10,15,28,.58),rgba(21,31,52,.28) 58%,rgba(9,13,24,.46))}.cc-shell{width:100%;height:100%;min-height:0;display:grid;grid-template-rows:auto auto auto auto minmax(0,1fr) auto;overflow:hidden}
            .cc-top{display:grid;grid-template-columns:minmax(360px,1fr) auto auto;align-items:end;gap:clamp(22px,2.5vw,48px);padding:clamp(26px,3.4vh,48px) clamp(38px,4vw,76px) clamp(18px,2.3vh,30px)}.cc-breadcrumb{margin-bottom:7px;color:rgba(255,255,255,.38);font-size:.72rem;font-weight:620;letter-spacing:.12em;text-transform:uppercase}.cc-breadcrumb span{color:rgba(255,255,255,.78)}.cc-brand h1{margin:0;color:#fff;font-size:clamp(2rem,2.8vw,3.35rem);font-weight:300;letter-spacing:-.025em;line-height:1}.cc-brand p{max-width:720px;margin:9px 0 0;color:var(--cc-muted);font-size:clamp(.78rem,.92vw,1.05rem);line-height:1.35}.cc-mode-switch{display:flex;align-items:center;gap:clamp(10px,1.1vw,18px);padding-bottom:2px}.cc-mode-btn{position:relative;min-height:48px;padding:0 5px;border:0;background:transparent;color:rgba(255,255,255,.42);font:inherit;font-size:clamp(.78rem,.88vw,1rem);font-weight:560}.cc-mode-btn::after{content:'';position:absolute;left:4px;right:4px;bottom:-10px;height:2px;background:#fff;opacity:0;transform:scaleX(.35);transition:opacity .18s,transform .18s}.cc-mode-btn.active{color:#fff}.cc-mode-btn.active::after{opacity:1;transform:none}.cc-close{width:48px;padding:0}.cc-close svg{width:20px;height:20px}
            .cc-context{display:grid;grid-template-columns:auto minmax(260px,1fr) auto minmax(260px,1fr);align-items:center;gap:clamp(12px,1.2vw,22px);padding:14px clamp(38px,4vw,76px) 18px;border-top:1px solid rgba(255,255,255,.045);border-bottom:1px solid var(--cc-line);background:rgba(255,255,255,.018)}.cc-context-title{color:rgba(255,255,255,.4);font-size:.68rem;font-weight:650;letter-spacing:.12em;text-transform:uppercase;writing-mode:vertical-rl;transform:rotate(180deg)}.cc-context-link{display:grid;place-items:center;color:rgba(255,255,255,.24)}.cc-context-link svg{width:22px;height:22px}.cc-select-wrap{min-width:0}.cc-label{display:block;margin-bottom:6px;color:rgba(255,255,255,.42);font-size:.66rem;font-weight:650;letter-spacing:.105em;text-transform:uppercase}.cc-selector{width:100%;min-height:66px;display:grid;grid-template-columns:50px minmax(0,1fr) auto;align-items:center;gap:13px;padding:7px 12px 7px 7px;border:1px solid transparent;border-radius:8px;background:rgba(255,255,255,.035);color:#fff;font:inherit;text-align:left}.cc-selector>span:not(.cc-app-art):not(.cc-profile-art){min-width:0}.cc-selector strong,.cc-selector>span>span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.cc-selector strong{font-size:.92rem;font-weight:560}.cc-selector>span>span{margin-top:2px;color:var(--cc-muted);font-size:.7rem}.cc-selector em{font-style:normal;color:rgba(255,255,255,.58);font-size:.72rem;font-weight:600}.cc-selector em::after{content:'›';margin-left:8px;font-size:1rem}.cc-app-art,.cc-profile-art{position:relative;display:grid;place-items:center;width:50px;height:50px;overflow:hidden;border-radius:7px;background:#1b2230;color:#dce6f5;font-weight:650}.cc-app-art img,.cc-picker-icon img{width:100%;height:100%;object-fit:cover}.cc-app-art svg{width:29px;height:29px}.cc-profile-owner{display:grid;place-items:center;width:100%;height:100%;overflow:hidden}.cc-profile-owner img{width:100%;height:100%;object-fit:cover}.cc-profile-owner svg{width:28px;height:28px}.cc-profile-art.system{background:linear-gradient(145deg,#1a2940,#101722);color:#dbeaff}.cc-profile-art.system>.cc-doorpi-mark{width:27px;height:24px;transform:translate(-5px,-3px)}.cc-system-controller,.cc-controller-badge{position:absolute;right:2px;bottom:3px;display:grid;place-items:center;width:23px;height:17px;border:1px solid rgba(255,255,255,.55);border-radius:5px;background:#0a101a;color:#fff}.cc-system-controller svg,.cc-controller-badge svg{width:19px;height:14px}
            .cc-tabs{display:flex;align-items:center;gap:22px;padding:0 clamp(38px,4vw,76px);min-height:58px;border-bottom:1px solid var(--cc-line)}.cc-tab{position:relative;align-self:stretch;min-width:105px;padding:0 4px;border:0;background:transparent;color:rgba(255,255,255,.42);font:inherit;font-size:.82rem;font-weight:560}.cc-tab::after{content:'';position:absolute;left:0;right:0;bottom:-1px;height:2px;background:#fff;opacity:0;transform:scaleX(.35);transition:opacity .18s,transform .18s}.cc-tab.active{color:#fff}.cc-tab.active::after{opacity:1;transform:none}.cc-tab-hint{margin-left:auto;color:rgba(255,255,255,.35);font-size:.7rem}.cc-tab-hint kbd{padding:4px 7px;border:1px solid rgba(255,255,255,.18);border-radius:4px;color:rgba(255,255,255,.68);font:600 .66rem inherit}
            .cc-content{min-height:0;overflow:hidden;padding:clamp(18px,2.6vh,32px) clamp(38px,4vw,76px) clamp(20px,2.8vh,38px)}.cc-content-inner{width:100%;height:100%;max-width:1680px;margin:0 auto}.cc-workspace{height:100%;min-height:0;display:grid;grid-template-columns:minmax(520px,1.45fr) minmax(360px,.8fr);gap:clamp(18px,1.7vw,30px)}.cc-command-panel,.cc-detail-panel,.cc-pointer-panel{min-height:0;border:1px solid var(--cc-line);border-radius:10px;background:rgba(255,255,255,.025)}.cc-command-panel{display:grid;grid-template-rows:auto minmax(0,1fr);overflow:hidden}.cc-section-head{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:18px 20px;border-bottom:1px solid var(--cc-line)}.cc-section-head h2,.cc-detail-panel h2,.cc-pointer-panel h2{margin:0;color:#fff;font-size:clamp(1rem,1.2vw,1.35rem);font-weight:470}.cc-section-head p,.cc-pointer-panel p{margin:4px 0 0;color:var(--cc-muted);font-size:.73rem;line-height:1.35}.cc-section-head .cc-fork-inline{color:rgba(255,255,255,.68);font-size:.66rem}.cc-command-count{color:rgba(255,255,255,.34);font-size:.7rem}.cc-list{min-height:0;display:flex;flex-direction:column;gap:3px;padding:7px;overflow-y:auto;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.22) transparent}.cc-row{position:relative;width:100%;min-height:74px;display:grid;grid-template-columns:42px minmax(0,1fr) auto 18px;align-items:center;gap:13px;padding:9px 12px;border:1px solid transparent;border-radius:7px;background:transparent;color:#fff;font:inherit;text-align:left}.cc-row::before{content:'';position:absolute;left:-1px;top:14px;bottom:14px;width:2px;background:#fff;opacity:0}.cc-row.selected{border-color:rgba(255,255,255,.13);background:rgba(255,255,255,.07)}.cc-row.selected::before{opacity:1}.cc-row-icon{display:grid;place-items:center;width:38px;height:38px;border-radius:7px;background:rgba(255,255,255,.055);color:rgba(255,255,255,.63)}.cc-row-icon svg{width:21px;height:21px}.cc-row-copy{min-width:0}.cc-row-title{overflow:hidden;color:#fff;font-size:.88rem;font-weight:540;text-overflow:ellipsis;white-space:nowrap}.cc-row-sub{display:flex;align-items:center;gap:7px;margin-top:4px;color:rgba(255,255,255,.4);font-size:.67rem}.cc-row-shortcut{justify-self:end}.cc-row-chevron{color:rgba(255,255,255,.22)}.cc-row-chevron svg{width:16px;height:16px}.cc-chord{display:inline-flex;align-items:center;gap:4px}.cc-chord kbd{min-width:27px;box-sizing:border-box;padding:4px 6px;border:1px solid rgba(255,255,255,.28);border-bottom-color:rgba(255,255,255,.5);border-radius:5px;background:rgba(255,255,255,.075);color:#fff;font:650 .63rem inherit;text-align:center}.cc-chord b{color:rgba(255,255,255,.28);font-size:.62rem}.cc-unassigned{color:#d6b28b;font-size:.68rem}.cc-empty{display:grid;place-items:center;min-height:150px;padding:24px;color:rgba(255,255,255,.37);font-size:.8rem;text-align:center}.cc-list>.cc-empty{height:100%;box-sizing:border-box}
            .cc-detail-stack{min-height:0;display:grid;grid-template-rows:minmax(0,1fr) auto;gap:14px}.cc-detail-panel{min-height:0;overflow-y:auto;padding:22px;scrollbar-width:none}.cc-detail-panel::-webkit-scrollbar{display:none}.cc-eyebrow{display:block;margin-bottom:8px;color:rgba(255,255,255,.38);font-size:.65rem;font-weight:650;letter-spacing:.12em;text-transform:uppercase}.cc-detail-title-row{display:flex;align-items:flex-start;gap:13px;padding-bottom:19px;border-bottom:1px solid var(--cc-line)}.cc-detail-title-row .cc-row-icon{flex:0 0 auto}.cc-detail-title-row p{margin:5px 0 0;color:var(--cc-muted);font-size:.72rem}.cc-detail-block{padding:17px 0;border-bottom:1px solid var(--cc-line)}.cc-detail-label{display:block;margin-bottom:10px;color:rgba(255,255,255,.42);font-size:.66rem;font-weight:650;letter-spacing:.09em;text-transform:uppercase}.cc-row-shortcuts{display:grid;gap:5px;justify-items:end}.cc-row-shortcut-line{display:flex;align-items:center;gap:7px}.cc-row-shortcut-line>small{width:14px;color:rgba(255,255,255,.34);font-size:.55rem;font-weight:700;text-align:right}.cc-row-shortcut-line.secondary{opacity:.72}.cc-row-shortcut-line .cc-unassigned{font-size:.62rem}.cc-activation-stack{display:grid;gap:9px}.cc-activation-card{display:grid;gap:9px;padding:10px;border:1px solid rgba(255,255,255,.09);border-radius:8px;background:rgba(255,255,255,.022)}.cc-activation-head{display:flex;align-items:center;justify-content:space-between;gap:10px}.cc-activation-head strong{font-size:.69rem;font-weight:620}.cc-activation-head small{color:rgba(255,255,255,.42);font-size:.61rem}.cc-activation-actions{display:flex;justify-content:flex-end}.cc-activation-actions .cc-btn{min-height:32px}.cc-capture-btn{width:100%;min-height:66px;display:flex;align-items:center;justify-content:space-between;gap:14px;padding:10px 14px;border:1px solid rgba(255,255,255,.13);border-radius:7px;background:rgba(255,255,255,.045);color:#fff;font:inherit;text-align:left}.cc-capture-btn-copy{display:grid;gap:5px}.cc-capture-btn-copy small{color:var(--cc-muted);font-size:.66rem}.cc-capture-btn-action{display:flex;align-items:center;gap:7px;color:rgba(255,255,255,.62);font-size:.7rem;font-weight:600}.cc-capture-btn-action svg{width:16px;height:16px}.cc-trigger-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.cc-trigger-option{min-height:39px;padding:0 8px;border:1px solid rgba(255,255,255,.1);border-radius:6px;background:transparent;color:rgba(255,255,255,.46);font:inherit;font-size:.65rem}.cc-trigger-option.active{border-color:rgba(255,255,255,.34);background:rgba(255,255,255,.1);color:#fff}.cc-detail-actions{display:flex;gap:8px;padding-top:17px}.cc-detail-actions .cc-btn{flex:1}.cc-detail-empty{height:100%;display:grid;place-content:center;justify-items:center;gap:8px;color:var(--cc-muted);text-align:center}.cc-detail-empty svg{width:42px;height:42px;margin-bottom:8px;color:rgba(255,255,255,.25)}.cc-detail-empty strong{color:#fff;font-size:1rem;font-weight:500}.cc-detail-empty span{max-width:310px;font-size:.73rem;line-height:1.45}.cc-pointer-panel{padding:17px 20px}.cc-pointer-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:14px}.cc-pointer{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px}.cc-range-card{display:grid;gap:8px}.cc-range-head{display:flex;justify-content:space-between;gap:12px;color:rgba(255,255,255,.68);font-size:.69rem}.cc-range-head output{color:#fff;font-variant-numeric:tabular-nums}.cc-range{width:100%;height:5px;accent-color:#dce8f8}.cc-range-help{color:rgba(255,255,255,.35);font-size:.62rem}.cc-range.adjusting{outline:2px solid #fff;outline-offset:7px;border-radius:2px}.cc-fork-note{margin:0 0 12px;padding:10px 13px;border-left:2px solid rgba(255,255,255,.5);background:rgba(255,255,255,.035);color:rgba(255,255,255,.57);font-size:.68rem;line-height:1.4}
            .cc-btn{min-height:43px;display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:0 15px;border:1px solid rgba(255,255,255,.14);border-radius:7px;background:rgba(255,255,255,.055);color:#fff;font:inherit;font-size:.74rem;font-weight:580}.cc-btn svg{width:17px;height:17px}.cc-btn.primary{border-color:rgba(255,255,255,.86);background:#f3f6fb;color:#0a0d14}.cc-btn.quiet{background:transparent}.cc-btn.danger{color:#eab6b6}.cc-btn:disabled{opacity:.3}.cc-btn.compact{min-height:37px;padding:0 12px;font-size:.68rem}.cc-btn:hover,.cc-btn:focus,.cc-btn.cc-focused,.cc-selector:hover,.cc-selector:focus,.cc-selector.cc-focused,.cc-tab:focus,.cc-tab.cc-focused,.cc-mode-btn:focus,.cc-mode-btn.cc-focused,.cc-row:focus,.cc-row.cc-focused,.cc-capture-btn:focus,.cc-capture-btn.cc-focused,.cc-trigger-option:focus,.cc-trigger-option.cc-focused,.cc-picker-item:focus,.cc-picker-item.cc-focused,.cc-key:focus,.cc-key.cc-focused{outline:0;border-color:#fff;box-shadow:0 0 0 2px rgba(255,255,255,.22);background-color:rgba(255,255,255,.13)}.cc-btn.primary:focus,.cc-btn.primary.cc-focused{background:#fff;color:#070a12;box-shadow:0 0 0 3px rgba(255,255,255,.24)}
            .cc-footer{min-height:64px;display:flex;align-items:center;gap:12px;padding:8px clamp(38px,4vw,76px);border-top:1px solid var(--cc-line);background:rgba(5,7,12,.92)}.cc-dirty{display:flex;align-items:center;gap:9px;color:rgba(255,255,255,.42);font-size:.7rem}.cc-dirty::before{content:'';width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,.25)}.cc-dirty.active{color:#fff}.cc-dirty.active::before{background:#fff}.cc-footer-hints{display:flex;align-items:center;gap:14px;margin-left:auto;margin-right:18px;color:rgba(255,255,255,.4);font-size:.65rem}.cc-footer-hints span{display:flex;align-items:center;gap:6px}.cc-footer-hints kbd,.cc-dpad-hint{min-width:21px;min-height:21px;box-sizing:border-box;padding:3px 5px;border:1px solid rgba(255,255,255,.22);border-radius:4px;color:rgba(255,255,255,.7);font:650 .62rem inherit;text-align:center}.cc-dpad-hint{display:grid!important;place-items:center;padding:3px}.cc-dpad-hint svg{width:13px;height:13px}.cc-footer .cc-btn.primary{min-width:160px}
            .cc-shade{position:absolute;inset:0;z-index:4;display:grid;place-items:center;padding:40px;background:rgba(2,4,9,.76);backdrop-filter:blur(14px)}.cc-dialog{width:min(680px,100%);max-height:min(780px,88vh);overflow:auto;padding:25px;border:1px solid rgba(255,255,255,.16);border-radius:10px;background:#151a25;box-shadow:0 35px 90px rgba(0,0,0,.6);box-sizing:border-box}.cc-dialog.wide{width:min(1180px,100%)}.cc-dialog-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:20px}.cc-dialog h2{margin:0 0 5px;font-size:1.35rem;font-weight:470}.cc-dialog p{margin:0;color:var(--cc-muted);font-size:.78rem;line-height:1.45}.cc-search,.cc-name-input{width:100%;height:50px;padding:0 15px;border:1px solid rgba(255,255,255,.14);border-radius:7px;background:rgba(255,255,255,.05);color:#fff;font:inherit;box-sizing:border-box}.cc-search:focus,.cc-name-input:focus{outline:0;border-color:#fff;box-shadow:0 0 0 2px rgba(255,255,255,.2)}.cc-picker-list{display:grid;gap:5px;margin-top:13px}.cc-picker-item{min-height:58px;display:grid;grid-template-columns:42px minmax(0,1fr) auto;align-items:center;gap:12px;padding:7px 10px;border:1px solid transparent;border-radius:7px;background:rgba(255,255,255,.025);color:#fff;font:inherit;text-align:left}.cc-picker-item.active{border-color:rgba(255,255,255,.3);background:rgba(255,255,255,.09)}.cc-picker-item>span:not(.cc-picker-icon){min-width:0}.cc-picker-item>span>span{display:block;margin-top:3px;color:var(--cc-muted);font-size:.68rem}.cc-picker-item strong{font-size:.82rem;font-weight:550}.cc-picker-icon{display:grid;place-items:center;width:42px;height:42px;overflow:hidden;border-radius:6px;background:rgba(255,255,255,.07);color:rgba(255,255,255,.75);font-size:.68rem}.cc-picker-icon svg{width:24px;height:24px}.cc-profile-art.cc-picker-icon{position:relative}
            .cc-capture{display:grid;justify-items:center;padding:12px 10px 4px;text-align:center}.cc-capture-ring{position:relative;width:176px;height:176px;display:grid;place-items:center;margin:8px;border-radius:50%;background:conic-gradient(#f2f5fa calc(var(--progress,0)*1turn),rgba(255,255,255,.08) 0)}.cc-capture-ring::after{content:'';position:absolute;inset:8px;border-radius:50%;background:#151a25}.cc-capture-chord{position:relative;z-index:1;max-width:145px}.cc-progress{width:min(430px,100%);height:5px;margin:18px 0;border-radius:999px;background:rgba(255,255,255,.08);overflow:hidden}.cc-progress span{display:block;width:calc(var(--progress,0)*100%);height:100%;background:#f2f5fa;transition:width .06s linear}.cc-capture-status{min-height:40px}.cc-keyboard{min-width:950px;display:grid;gap:6px}.cc-key-row{display:grid;grid-template-columns:repeat(18,minmax(38px,1fr));gap:5px}.cc-key{height:44px;border:1px solid rgba(255,255,255,.14);border-bottom-color:rgba(255,255,255,.35);border-radius:6px;background:#242a37;color:#fff;font:650 .67rem inherit}.cc-key.wide,.cc-key.xwide{grid-column:span 2}.cc-key.space{grid-column:span 6}.cc-key.selected{border-color:#fff;background:rgba(255,255,255,.18)}.cc-keyboard-scroll{overflow:auto;padding:3px 3px 8px}.cc-key-summary{min-height:34px;display:flex;flex-wrap:wrap;gap:5px;margin:14px 0}.cc-dialog-actions{display:flex;justify-content:flex-end;gap:9px;margin-top:20px}.cc-no-icon{display:none}
            .cc-workspace{grid-template-rows:minmax(0,1fr);gap:clamp(14px,1.5vw,26px) clamp(18px,1.7vw,30px)}.cc-workspace.with-pointer{grid-template-rows:minmax(0,1fr) auto}.cc-workspace.with-pointer .cc-command-panel{grid-row:1/-1}.cc-detail-panel{grid-column:2;grid-row:1}.cc-pointer-panel{grid-column:2;grid-row:2;border-color:rgba(255,255,255,.18);background:rgba(255,255,255,.038)}.cc-pointer-context{display:inline-flex;align-items:center;gap:8px;margin-bottom:6px;color:rgba(255,255,255,.43);font-size:.61rem;font-weight:650;letter-spacing:.1em;text-transform:uppercase}.cc-pointer-context::after{content:'';width:28px;height:1px;background:rgba(255,255,255,.22)}.cc-pointer-scope{display:block;margin-top:4px;color:rgba(255,255,255,.4);font-size:.62rem}.cc-range-card{padding:10px 11px;border:1px solid transparent;border-radius:7px;transition:border-color .14s,background .14s,box-shadow .14s}.cc-range-card:focus-within{border-color:#fff;background:rgba(255,255,255,.1);box-shadow:0 0 0 2px rgba(255,255,255,.2)}.cc-range-card:focus-within .cc-range-head{color:#fff}.cc-range-card:focus-within .cc-range-help{color:rgba(255,255,255,.7)}.cc-range:focus{outline:none}
            .cc-workspace.with-pointer .cc-command-panel{grid-column:1;grid-row:1}.cc-workspace.with-pointer .cc-detail-panel{grid-column:2;grid-row:1/-1}.cc-workspace.with-pointer .cc-pointer-panel{grid-column:1;grid-row:2;display:grid;grid-template-columns:minmax(250px,.8fr) minmax(390px,1.2fr);align-items:center;gap:14px;padding:13px 16px}.cc-workspace.with-pointer .cc-pointer-head{margin:0}.cc-workspace.with-pointer .cc-pointer{grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.cc-workspace.with-pointer .cc-range-card{padding:8px}.cc-range-card.cc-focused-card{border-color:#fff;background:rgba(255,255,255,.1);box-shadow:0 0 0 2px rgba(255,255,255,.2)}.cc-range-card.cc-focused-card .cc-range-head{color:#fff}.cc-range-card.cc-focused-card .cc-range-help{color:rgba(255,255,255,.7)}
            .cc-mouse-action .cc-mouse-fill{fill:currentColor;stroke:none;opacity:.78}.cc-row-icon .cc-mouse-action{width:27px;height:27px}.cc-picker-icon .cc-mouse-action{width:29px;height:29px}.cc-axis-mappings{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin-top:9px}.cc-axis-mappings>span{min-width:0;display:flex;align-items:center;gap:7px;color:rgba(255,255,255,.62)}.cc-axis-mappings>span>span{min-width:0;display:grid}.cc-axis-mappings strong{overflow:hidden;color:#fff;font-size:.61rem;font-weight:570;text-overflow:ellipsis;white-space:nowrap}.cc-axis-mappings small{overflow:hidden;color:rgba(255,255,255,.4);font-size:.56rem;text-overflow:ellipsis;white-space:nowrap}.cc-stick-svg{flex:0 0 auto;width:26px;height:26px}
            .cc-axis-row{border-bottom:1px solid rgba(255,255,255,.06)}.cc-axis-row .cc-row-sub{gap:11px}.cc-axis-badges{display:flex;gap:5px}.cc-axis-badges kbd{min-width:28px;padding:4px 6px;border:1px solid rgba(255,255,255,.28);border-radius:5px;background:rgba(255,255,255,.07);color:#fff;font:650 .62rem inherit;text-align:center}.cc-analog-detail .cc-axis-mappings{margin:17px 0 6px;padding-bottom:14px;border-bottom:1px solid var(--cc-line)}.cc-analog-detail .cc-pointer-scope{margin-bottom:12px}.cc-analog-detail .cc-pointer{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.cc-analog-detail .cc-pointer .cc-range-card:last-child{grid-column:1/-1}.cc-analog-detail .cc-range-card{padding:12px 13px;border-color:rgba(255,255,255,.08);background:rgba(255,255,255,.025)}
            .cc-input-mode{display:grid;grid-template-columns:42px minmax(0,1fr) auto;align-items:center;gap:14px;padding:11px clamp(38px,4vw,76px);border-bottom:1px solid var(--cc-line);background:rgba(255,255,255,.022)}.cc-input-mode[hidden]{display:none}.cc-input-mode-icon{display:grid;place-items:center;width:38px;height:38px;color:rgba(255,255,255,.72)}.cc-input-mode-icon svg{width:26px;height:26px}.cc-input-mode-copy{display:grid;gap:3px}.cc-input-mode-copy strong{font-size:.79rem;font-weight:580}.cc-input-mode-copy span{color:var(--cc-muted);font-size:.67rem}.cc-input-mode-toggle{min-width:116px;min-height:40px;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 12px;border:1px solid rgba(255,255,255,.18);border-radius:6px;background:transparent;color:rgba(255,255,255,.62);font:600 .7rem inherit}.cc-input-mode-toggle::after{content:'—';color:rgba(255,255,255,.45);font-size:.85rem}.cc-input-mode-toggle.on{border-color:rgba(255,255,255,.42);color:#fff;background:rgba(255,255,255,.08)}.cc-input-mode-toggle.on::after{content:'✓';color:#fff}.cc-input-mode-toggle:disabled{opacity:.5}.cc-input-mode-toggle:focus,.cc-input-mode-toggle.cc-focused{outline:0;border-color:#fff;box-shadow:0 0 0 2px rgba(255,255,255,.22)}.cc-selector:disabled{opacity:.4}.cc-input-lock{height:100%;display:grid;place-content:center;justify-items:center;gap:10px;border:1px solid var(--cc-line);border-radius:10px;background:rgba(255,255,255,.018);color:var(--cc-muted);text-align:center}.cc-input-lock svg{width:38px;height:38px;color:rgba(255,255,255,.32)}.cc-input-lock strong{color:#fff;font-size:1rem;font-weight:520}.cc-input-lock span{max-width:470px;font-size:.74rem;line-height:1.5}.cc-controller-context-icon{display:grid!important;place-items:center;width:25px!important}.cc-controller-context-icon svg{width:25px;height:19px}
            .cc-shell{height:100%;min-height:0}.cc-overlay.cc-global-mode .cc-shell{grid-template-rows:auto minmax(0,1fr) auto}.cc-footer{height:64px;min-height:64px;box-sizing:border-box}.cc-dirty::before{content:'✓';width:auto;height:auto;border-radius:0;background:none;color:rgba(255,255,255,.5);font-size:.72rem;font-weight:700}.cc-dirty.active::before{content:'—';background:none;color:#fff}.cc-long-press-config{margin-top:10px;padding:12px 13px}.cc-long-press-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}.cc-long-press-copy{display:grid;gap:3px}.cc-long-press-copy strong{color:#fff;font-size:.7rem;font-weight:580}.cc-long-press-copy small{color:rgba(255,255,255,.4);font-size:.62rem;line-height:1.35}.cc-long-press-head output{color:#fff;font-size:.76rem;font-weight:620;font-variant-numeric:tabular-nums}.cc-long-press-config .cc-range{margin-top:2px}
            .cc-overlay:not(.cc-global-mode) .cc-top{grid-row:1}.cc-overlay:not(.cc-global-mode) .cc-context{grid-row:2}.cc-overlay:not(.cc-global-mode) .cc-input-mode{grid-row:3}.cc-overlay:not(.cc-global-mode) .cc-tabs{grid-row:4}.cc-overlay:not(.cc-global-mode) .cc-content{grid-row:5}.cc-overlay:not(.cc-global-mode) .cc-footer{grid-row:6}.cc-overlay.cc-global-mode .cc-top{grid-row:1}.cc-overlay.cc-global-mode .cc-content{grid-row:2}.cc-overlay.cc-global-mode .cc-footer{grid-row:3}
            .cc-control-chord{min-width:0;display:inline-flex;align-items:center;gap:8px}.cc-controller-visual{position:relative;flex:0 0 auto;width:84px;height:47px;color:rgba(255,255,255,.34)}.cc-controller-frame{position:absolute;left:12px;top:2px;width:60px;aspect-ratio:580/420}.cc-controller-map{display:block;width:100%;height:100%}.cc-control-marker{position:absolute;left:var(--cc-x);top:var(--cc-y);width:8px;height:8px;display:grid;place-items:center;box-sizing:border-box;border:1px solid #fff;border-radius:50%;background:#f5f7fb;color:#0b0f16;font:750 4.5px/1 'Outfit','Segoe UI',sans-serif;transform:translate(-50%,-50%);box-shadow:0 0 0 1px rgba(5,8,14,.4)}.cc-control-marker.face{width:4px;height:4px;border:0;box-shadow:0 0 0 1px rgba(5,8,14,.55)}.cc-control-marker.center{width:6px;height:4px;border-radius:2px}.cc-control-marker.guide{width:7px;height:7px}.cc-control-marker.dpad{width:7px;height:7px;font-size:5px}.cc-control-marker.stick{width:11px;height:11px;font-size:4.5px}.cc-control-outer{position:absolute;z-index:1;width:15px;height:8px;display:grid;place-items:center;box-sizing:border-box;border:1px solid rgba(255,255,255,.72);border-radius:2px;background:rgba(255,255,255,.1);color:#fff;font:700 5px/1 'Outfit','Segoe UI',sans-serif;letter-spacing:.02em}.cc-control-outer.left{left:0}.cc-control-outer.right{right:0}.cc-control-outer.trigger{top:3px}.cc-control-outer.bumper{top:14px}.cc-control-chord-label{min-width:0;overflow:hidden;color:rgba(255,255,255,.76);font-size:.62rem;font-weight:560;text-overflow:ellipsis;white-space:nowrap}.cc-row-shortcuts{min-width:165px;gap:1px}.cc-row-shortcut-line{min-height:29px;gap:5px}.cc-row-shortcut-line>small{opacity:.68}.cc-control-chord.compact{gap:5px}.cc-control-chord.compact .cc-controller-visual{width:66px;height:36px}.cc-control-chord.compact .cc-controller-frame{left:10px;top:2px;width:46px}.cc-control-chord.compact .cc-control-marker{transform:translate(-50%,-50%) scale(.72)}.cc-control-chord.compact .cc-control-marker.face{width:3px;height:3px}.cc-control-chord.compact .cc-control-outer{width:12px;height:6px;font-size:4px}.cc-control-chord.compact .cc-control-outer.trigger{top:2px}.cc-control-chord.compact .cc-control-outer.bumper{top:10px}.cc-control-chord.compact .cc-control-chord-label{max-width:106px;font-size:.58rem}.cc-control-chord.detail .cc-controller-visual{width:94px;height:52px}.cc-control-chord.detail .cc-controller-frame{left:13px;width:68px}.cc-control-chord.detail .cc-control-outer{width:17px;height:9px;font-size:5.5px}.cc-control-chord.detail .cc-control-outer.bumper{top:15px}.cc-control-chord.detail .cc-control-chord-label{max-width:150px;font-size:.66rem}.cc-capture-btn-copy .cc-control-chord{margin-top:1px}.cc-control-chord.capture{display:grid;justify-items:center;gap:3px}.cc-control-chord.capture .cc-controller-visual{width:125px;height:70px}.cc-control-chord.capture .cc-controller-frame{left:17px;top:3px;width:91px}.cc-control-chord.capture .cc-control-marker{transform:translate(-50%,-50%) scale(1.3)}.cc-control-chord.capture .cc-control-marker.face{width:5px;height:5px}.cc-control-chord.capture .cc-control-outer{width:22px;height:11px;font-size:6.5px}.cc-control-chord.capture .cc-control-outer.trigger{top:4px}.cc-control-chord.capture .cc-control-outer.bumper{top:18px}.cc-control-chord.capture .cc-control-chord-label{max-width:140px;text-align:center}.cc-capture-chord{display:grid;place-items:center;max-width:150px}
            .cc-controller-visual{width:90px}.cc-controller-frame{left:15px}.cc-control-chord.compact .cc-controller-visual{width:70px}.cc-control-chord.compact .cc-controller-frame{left:12px}.cc-control-chord.detail .cc-controller-visual{width:102px}.cc-control-chord.detail .cc-controller-frame{left:17px}.cc-control-chord.capture .cc-controller-visual{width:135px}.cc-control-chord.capture .cc-controller-frame{left:22px}
            .cc-system-controller,.cc-controller-badge{right:3px;bottom:3px;width:24px;height:18px;overflow:hidden;border:0;border-radius:0;background:transparent}.cc-profile-art .cc-system-controller svg,.cc-profile-art .cc-controller-badge svg{display:block;width:100%;height:100%;overflow:hidden}.cc-profile-badged{position:relative;overflow:visible}.cc-profile-purpose-main{width:100%;height:100%;display:grid;place-items:center;padding:9px;box-sizing:border-box;color:rgba(238,244,252,.72)}.cc-profile-purpose-main>svg{display:block;width:30px!important;height:30px!important}.cc-profile-purpose-main.controller>svg{width:35px!important;height:26px!important}.cc-profile-author-badge{position:absolute;right:-6px;top:-6px;bottom:auto;width:23px;height:23px;display:grid;place-items:center;overflow:hidden;box-sizing:border-box;border:2px solid #151b28;border-radius:50%;background:#26364e;box-shadow:0 3px 10px rgba(0,0,0,.5)}.cc-profile-author-badge.doorpi .cc-doorpi-mark{width:11px;height:14px;color:#eef5ff}.cc-profile-author-badge.user img{width:100%;height:100%;object-fit:cover}.cc-profile-author-badge.user svg{width:16px;height:16px}.cc-dialog.cc-picker-dialog{width:min(920px,calc(100vw - 80px));padding:30px}.cc-picker-dialog .cc-search{height:56px;font-size:.86rem}.cc-picker-dialog .cc-picker-list{gap:7px;margin-top:16px}.cc-picker-dialog .cc-picker-item{min-height:78px;grid-template-columns:58px minmax(0,1fr) auto;gap:17px;padding:10px 15px}.cc-picker-dialog .cc-picker-icon{width:56px;height:56px}.cc-picker-dialog .cc-picker-item strong{font-size:.9rem}.cc-picker-dialog .cc-picker-item>span>span{font-size:.72rem}.cc-picker-dialog .cc-profile-purpose-main{padding:10px}.cc-picker-dialog .cc-profile-purpose-main>svg{width:35px!important;height:35px!important}.cc-picker-dialog .cc-profile-purpose-main.controller>svg{width:40px!important;height:30px!important}.cc-picker-dialog .cc-profile-author-badge{right:-7px;top:-7px;width:25px;height:25px}.cc-picker-dialog .cc-profile-author-badge.doorpi .cc-doorpi-mark{width:12px;height:15px}body.doorpi-controls-open .vkb-overlay{z-index:50010}
            .cc-profile-row-trailing{display:flex;align-items:center;justify-content:flex-end;gap:13px}.cc-profile-owner-chip{min-height:32px;display:inline-flex;align-items:center;box-sizing:border-box;padding:4px 10px;border:1px solid rgba(255,255,255,.12);border-radius:999px;background:rgba(255,255,255,.045);color:rgba(244,247,252,.78);white-space:nowrap}.cc-picker-item>.cc-profile-row-trailing>.cc-profile-owner-chip{display:inline-flex;margin-top:0;color:rgba(244,247,252,.78)}.cc-profile-owner-chip strong{font-size:.68rem!important;font-weight:590}.cc-profile-saved-label{color:rgba(255,255,255,.72);font-size:.72rem;white-space:nowrap}.cc-picker-item>.cc-profile-row-trailing>.cc-profile-saved-label{display:inline;margin-top:0;color:rgba(255,255,255,.72)}.cc-profile-art>.cc-profile-purpose-main{padding:8px}.cc-profile-art>.cc-profile-purpose-main>svg{margin:auto}
            @media(max-width:1120px){.cc-top{grid-template-columns:1fr auto}.cc-mode-switch{grid-row:2;grid-column:1/-1}.cc-context{grid-template-columns:minmax(0,1fr) auto minmax(0,1fr)}.cc-context-title{display:none}.cc-workspace{grid-template-columns:minmax(430px,1.2fr) minmax(320px,.8fr)}.cc-workspace.with-pointer .cc-pointer-panel{grid-template-columns:1fr}}
            @media(max-height:820px){.cc-top{padding-top:20px;padding-bottom:15px}.cc-brand h1{font-size:1.8rem}.cc-brand p{display:none}.cc-context{padding-top:9px;padding-bottom:11px}.cc-selector{min-height:56px}.cc-app-art,.cc-profile-art{width:42px;height:42px}.cc-tabs{min-height:48px}.cc-content{padding-top:14px;padding-bottom:16px}.cc-row{min-height:61px}.cc-footer{min-height:54px}}
        `;
        document.head.appendChild(style);
    }

    function syncOverlayViewport() {
        if (!state.overlay) return;
        const scale = Math.max(.25, Math.min(1.8, Number(window.DoorpiLayoutScale?.get?.()) || 1));
        state.overlay.style.width = `${100 / scale}vw`;
        state.overlay.style.height = `${100 / scale}vh`;
    }

    function createOverlay() {
        close(); installStyles();
        const overlay = document.createElement('div');
        overlay.className = 'cc-overlay';
        overlay.innerHTML = `<div class="cc-shell">
            <header class="cc-top">
                <div class="cc-brand"><div class="cc-breadcrumb">Doorpi&nbsp;&nbsp;/&nbsp;&nbsp;<span>${tx('settings')}</span></div><h1>${tx('title')}</h1><p>${tx('subtitle')}</p></div>
                <nav class="cc-mode-switch" aria-label="${tx('title')}"><button class="cc-mode-btn ${state.mode === 'apps' ? 'active' : ''}" data-cc-focus data-mode="apps">${tx('appControls')}</button><button class="cc-mode-btn ${state.mode === 'global' ? 'active' : ''}" data-cc-focus data-mode="global">${tx('globalShortcuts')}</button></nav>
                <button class="cc-btn quiet cc-close" data-cc-focus data-close aria-label="${tx('close')}">${iconSvg('close')}</button>
            </header>
            <section class="cc-context" data-context>
                <span class="cc-context-title">${tx('activeSetup')}</span>
                <div class="cc-select-wrap" data-app-wrap><span class="cc-label">${tx('assignedTo')}</span><button class="cc-selector" data-cc-focus data-app-selector>${targetArtHtml(null)}<span><strong>${tx('noApp')}</strong><span>${tx('noAppDesc')}</span></span><em>${tx('change')}</em></button></div>
                <span class="cc-context-link" aria-hidden="true">${iconSvg('arrow')}</span>
                <div class="cc-select-wrap" data-profile-wrap><span class="cc-label">${tx('appliedProfile')}</span><button class="cc-selector" data-cc-focus data-profile-selector>${profileArtHtml(null)}<span><strong>—</strong><span>${tx('loading')}</span></span><em>${tx('change')}</em></button></div>
            </section>
            <section class="cc-input-mode" data-input-mode hidden>
                <span class="cc-input-mode-icon" aria-hidden="true">${iconSvg('keyboard')}</span>
                <span class="cc-input-mode-copy"><strong>${tx('inputModeTitle')}</strong><span data-input-mode-desc>${tx('inputModeDesc')}</span></span>
                <button class="cc-input-mode-toggle" type="button" role="switch" data-cc-focus data-input-mode-toggle aria-checked="false">${tx('inputModeOff')}</button>
            </section>
            <div class="cc-tabs"><button class="cc-tab active" data-cc-focus data-tab="keyboard">${tx('keyboard')}</button><button class="cc-tab" data-cc-focus data-tab="mouse">${tx('mouse')}</button><span class="cc-tab-hint"><kbd>LB</kbd>&nbsp; <kbd>RB</kbd>&nbsp;&nbsp;${tx('tabHint').replace('LB / RB ', '')}</span></div>
            <main class="cc-content"><div class="cc-content-inner" data-content><div class="cc-empty">${tx('loading')}</div></div></main>
            <footer class="cc-footer"><span class="cc-dirty" data-dirty>${tx('saved')}</span><div class="cc-footer-hints"><span><span class="cc-dpad-hint">${iconSvg('dpad')}</span>${tx('navigateHint')}</span><span><kbd>A</kbd>${tx('selectHint')}</span><span><kbd>B</kbd>${tx('backHint')}</span></div><button class="cc-btn quiet" data-cc-focus data-reset>${tx('back')}</button><button class="cc-btn primary" data-cc-focus data-save disabled>${tx('save')}</button></footer>
        </div>`;
        document.body.appendChild(overlay); state.overlay = overlay; syncOverlayViewport(); document.body.classList.add('doorpi-controls-open');
        overlay.querySelector('[data-close]').addEventListener('click', requestClose);
        overlay.querySelector('[data-reset]').addEventListener('click', () => {
            if (state.mode === 'global') guardDirty(() => post({action:'resetGlobalControlProfile'}));
            else back();
        });
        overlay.querySelector('[data-app-selector]').addEventListener('click', () => openPicker('apps'));
        overlay.querySelector('[data-profile-selector]').addEventListener('click', () => openPicker('profiles'));
        overlay.querySelector('[data-input-mode-toggle]').addEventListener('click', () => {
            if (!state.target?.canChangeMouseKeyboardMode || state.inputModePending) return;
            const apply = () => {
                state.inputModePending = true;
                renderHeader(); renderContent(); renderFooter();
                post({action:'setControlTargetMouseKeyboard',target:state.target,enabled:!mouseKeyboardEnabled()});
            };
            if (mouseKeyboardEnabled()) guardDirty(apply); else apply();
        });
        overlay.querySelector('[data-save]').addEventListener('click', () => {
            if (state.mode === 'global') {
                state.savePending = true; renderFooter();
                post({action:'saveControlProfile',target:null,profile:state.draft});
            } else openSaveDialog();
        });
        overlay.querySelectorAll('[data-tab]').forEach(button => button.addEventListener('click', () => setTab(button.dataset.tab)));
        overlay.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => setMode(button.dataset.mode)));
        overlay.addEventListener('focusin', event => { overlay.querySelectorAll('.cc-focused').forEach(item => item.classList.remove('cc-focused')); overlay.querySelectorAll('.cc-focused-card').forEach(item => item.classList.remove('cc-focused-card')); event.target?.classList?.add('cc-focused'); event.target?.closest?.('.cc-range-card')?.classList.add('cc-focused-card'); });
    }

    function open(target = null) {
        window.DoorpiQuickPanel?.close?.();
        const quickPanel = document.getElementById('doorpiQuickPanel');
        quickPanel?.classList.remove('visible');
        if (quickPanel) quickPanel.style.display = 'none';
        document.body.classList.remove('quick-panel-open');
        state.requestedTarget = target; state.targets = []; state.profiles = []; state.profileOwners = []; state.assignments = [];
        state.target = null; state.lastTarget = target || null; state.profile = null; state.draft = null; state.tab = 'keyboard'; state.mode = target ? 'apps' : 'global'; state.adjustingRange = null; state.selectedBindingIndex = -1; state.dirty = false; state.popup = null; state.capture = null; state.captureSuppressed = false; state.inputModePending = false;
        createOverlay(); window.resetDoorpiGamepadInputState?.(); window.armDoorpiGamepadReleaseGate?.();
        renderHeader(); post({ action: 'controlEditorOpened' }); post({ action: 'requestControlCatalog' });
        if (!target) post({action:'requestGlobalControlEditor'});
        focusDefault();
    }
    function close() {
        if (state.capture) post({ action: 'cancelControlCapture', captureId: state.capture.id });
        if (state.overlay) post({ action: 'controlEditorClosed' });
        state.overlay?.remove(); state.overlay = null; state.popup = null; state.capture = null; document.body.classList.remove('doorpi-controls-open');
    }

    function selectTarget(target) {
        if (!target) return; state.target = target; state.lastTarget = target; state.dirty = false; state.popup = null; state.capture = null; state.selectedBindingIndex = -1;
        post({ action: 'requestControlEditor', targetKind: target.kind, targetId: target.id, targetName: target.name });
        renderHeader(); renderLoading();
    }
    function selectTemplate(profile) {
        if (!profile) return; state.target = null; state.profile = profile; state.draft = clone(profile);
        state.dirty = false; state.savePending = false; state.selectedBindingIndex = -1; renderAll();
    }
    function setMode(mode) {
        if (!['apps','global'].includes(mode) || state.mode === mode) return;
        guardDirty(() => {
            state.mode = mode; state.tab = 'keyboard'; state.adjustingRange = null; state.selectedBindingIndex = -1;
            state.overlay?.querySelectorAll('[data-mode]').forEach(button => button.classList.toggle('active', button.dataset.mode === mode));
            if (mode === 'global') { if (state.target) state.lastTarget = state.target; renderLoading(); post({action:'requestGlobalControlEditor'}); }
            else {
                if (state.lastTarget) selectTarget(state.lastTarget);
                else {
                    const template = state.profiles.find(profile => profile.id === 'builtin-web');
                    selectTemplate(template);
                }
            }
            renderHeader();
        });
    }
    function receive(event) {
        let data = event?.data; if (typeof data === 'string') { try { data = JSON.parse(data); } catch { return; } }
        if (!data || !state.overlay) return;
        if (data.type === 'nativeControllerSnapshot') {
            state.captureSuppressed = !!data.controlCaptureSuppressed;
            if (state.capture && (Number(data.pressed || 0) & 0x2000) !== 0)
                handleCaptureCancelPress();
            return;
        }
        if (data.type === 'controlCatalog') {
            state.targets = (data.targets || []).filter(target => target.kind === 'media' || target.kind === 'store');
            state.profiles = (data.profiles || []).filter(profile => !isGlobalProfile(profile)); state.profileOwners = data.profileOwners || []; state.assignments = data.assignments || [];
            let target = state.requestedTarget && state.targets.find(item => targetKey(item) === targetKey(state.requestedTarget));
            if (!target && state.requestedTarget) {
                target = state.targets.find(item => item.id === state.requestedTarget.id) || state.requestedTarget;
                if (!state.targets.some(item => targetKey(item) === targetKey(target))) state.targets.push(target);
            }
            if (target) selectTarget(target);
            else if (state.mode !== 'global') selectTemplate(state.profiles.find(profile => profile.id === 'builtin-web'));
            else renderHeader();
        } else if (data.type === 'controlEditor') {
            const restoreInputModeFocus = state.inputModePending;
            state.mode = 'apps';
            state.target = data.target; state.profile = data.profile; state.draft = clone(data.profile); state.dirty = false; state.savePending = false; state.inputModePending = false; state.selectedBindingIndex = -1;
            const index = state.profiles.findIndex(profile => profile.id === data.profile.id); if (index >= 0) state.profiles[index] = data.profile;
            else state.profiles.push(data.profile);
            renderAll();
            if (restoreInputModeFocus) focusDefault('[data-input-mode-toggle]');
        } else if (data.type === 'globalControlEditor') {
            state.mode = 'global'; state.target = null; state.profile = data.profile; state.draft = clone(data.profile);
            state.dirty = false; state.savePending = false; state.selectedBindingIndex = -1; renderAll();
        } else if (data.type === 'controlProfileSaved') {
            state.profile = data.profile; state.draft = clone(data.profile); state.dirty = false; state.savePending = false;
            const index = state.profiles.findIndex(profile => profile.id === data.profile.id); if (index >= 0) state.profiles[index] = data.profile; else state.profiles.push(data.profile);
            renderAll(); toast(tx('saved'));
        } else if (data.type === 'controlCaptureProgress' || data.type === 'controlCaptureCompleted') {
            updateCapture(data);
        } else if (data.type === 'controlCaptureCanceled') {
            if (state.capture?.id === data.captureId) { state.capture = null; closePopup(); }
        }
    }

    function renderLoading() { const host = state.overlay?.querySelector('[data-content]'); if (host) host.innerHTML = `<div class="cc-empty">${tx('loading')}</div>`; }
    function renderAll() { normalizeSelectedBinding(); renderHeader(); renderTabs(); renderContent(); renderFooter(); focusDefault(); }
    function renderHeader() {
        if (!state.overlay) return;
        state.overlay.classList.toggle('cc-global-mode', state.mode === 'global');
        state.overlay.querySelectorAll('[data-mode]').forEach(button => button.classList.toggle('active', button.dataset.mode === state.mode));
        state.overlay.querySelector('[data-context]').style.display = state.mode === 'global' ? 'none' : '';
        state.overlay.querySelector('.cc-tabs').style.display = state.mode === 'global' ? 'none' : '';
        const subtitle = state.overlay.querySelector('.cc-brand p');
        if (subtitle) subtitle.textContent = state.mode === 'global' ? tx('globalDesc') : tx('subtitle');
        const app = state.overlay.querySelector('[data-app-selector]');
        const profile = state.overlay.querySelector('[data-profile-selector]');
        if (app) app.innerHTML = `${targetArtHtml(state.target)}<span><strong>${esc(state.target?.name || tx('noApp'))}</strong><span>${esc(state.target ? (state.target.category === 'store' ? tx('storesGroup') : state.target.category === 'executable' ? 'Executable' : 'Web app') : tx('noAppDesc'))}</span></span><em>${tx('change')}</em>`;
        if (profile) profile.innerHTML = `${profileArtHtml(state.draft)}<span><strong>${esc(profileDisplayName(state.draft) || '—')}</strong><span>${esc(profileAuthorSummary(state.draft))}</span></span><em>${tx('change')}</em>`;
        if (profile) profile.disabled = !!state.target && (!mouseKeyboardEnabled() || state.inputModePending);
        renderInputMode();
    }
    function renderInputMode() {
        const section = state.overlay?.querySelector('[data-input-mode]');
        const button = section?.querySelector('[data-input-mode-toggle]');
        const description = section?.querySelector('[data-input-mode-desc]');
        const visible = state.mode === 'apps' && !!state.target;
        if (!section || !button) return;
        section.hidden = !visible;
        if (!visible) {
            state.overlay?.classList.remove('cc-input-disabled');
            return;
        }
        const enabled = mouseKeyboardEnabled();
        const canChange = state.target.canChangeMouseKeyboardMode === true;
        button.classList.toggle('on', enabled);
        button.textContent = tx(enabled ? 'inputModeOn' : 'inputModeOff');
        button.setAttribute('aria-checked', String(enabled));
        button.disabled = !canChange || state.inputModePending;
        if (description) description.textContent = canChange
            ? tx('inputModeDesc')
            : state.target.category === 'web' ? tx('inputModeRequired') : tx('inputModeShared');
        state.overlay?.classList.toggle('cc-input-disabled', !enabled);
    }
    function renderTabs() {
        const youtube = state.mode !== 'global' && isYouTubeProfile();
        if (youtube) state.tab = 'keyboard';
        state.overlay?.querySelectorAll('[data-tab]').forEach(button => {
            const mouse = button.dataset.tab === 'mouse';
            button.hidden = youtube && mouse;
            button.classList.toggle('active', button.dataset.tab === state.tab);
            if (button.dataset.tab === 'keyboard') button.textContent = tx(youtube ? 'remoteControl' : 'keyboard');
        });
        const hint = state.overlay?.querySelector('.cc-tab-hint');
        if (hint) hint.hidden = youtube;
    }
    function renderFooter() {
        const dirty = state.overlay?.querySelector('[data-dirty]'); const save = state.overlay?.querySelector('[data-save]');
        dirty?.classList.toggle('active', state.dirty); if (dirty) dirty.textContent = state.dirty ? tx('unsaved') : tx('saved'); if (save) { save.disabled = !state.dirty || state.savePending || state.inputModePending || (state.mode !== 'global' && !mouseKeyboardEnabled()); save.textContent = state.mode === 'global' ? tx('saveGlobals') : tx('save'); }
        const reset = state.overlay?.querySelector('[data-reset]'); if (reset) reset.textContent = state.mode === 'global' ? tx('resetDefaults') : tx('back');
    }
    function renderContent() {
        const host = state.overlay?.querySelector('[data-content]'); if (!host || !state.draft) return;
        if (state.inputModePending) {
            host.innerHTML = `<div class="cc-empty">${tx('loading')}</div>`;
            return;
        }
        if (state.mode !== 'global' && state.target && !mouseKeyboardEnabled()) {
            state.selectedBindingIndex = -1;
            host.innerHTML = `<div class="cc-input-lock">${iconSvg('lock')}<strong>${tx('inputModeLocked')}</strong><span>${tx('inputModeLockedDesc')}</span></div>`;
            return;
        }
        normalizeSelectedBinding();
        const bindings = visibleBindings();
        const heading = state.mode === 'global' ? tx('globalShortcuts') : isYouTubeProfile() ? tx('youtubeCommands') : state.tab === 'mouse' ? tx('mouseCommands') : tx('customCommands');
        const description = state.mode === 'global' ? tx('systemDesc') : isYouTubeProfile() ? tx('youtubeDesc') : state.tab === 'mouse' ? tx('mouseDesc') : tx('customDesc');
        const addAction = state.mode === 'global'
            ? `<button class="cc-btn compact" data-cc-focus data-add-global>${iconSvg('plus')}${tx('addGlobal')}</button>`
            : state.tab === 'mouse'
                ? `<button class="cc-btn compact" data-cc-focus data-add-mouse>${iconSvg('plus')}${tx('addMouse')}</button>`
                : `<button class="cc-btn compact" data-cc-focus data-add-keyboard>${iconSvg('plus')}${tx(isYouTubeProfile() ? 'addRemoteCommand' : 'addKeyboard')}</button>`;
        host.innerHTML = `<div class="cc-workspace">
            <section class="cc-command-panel"><div class="cc-section-head"><div><h2>${heading}</h2><p>${description}</p>${isBuiltIn() && state.mode !== 'global' ? `<p class="cc-fork-inline">${tx('profileFork')}</p>` : ''}</div><div>${addAction}</div></div><div class="cc-list">${bindings.length ? bindings.map(bindingRow).join('') : `<div class="cc-empty">${state.tab === 'mouse' ? tx('emptyMouse') : tx('emptyKeyboard')}</div>`}</div></section>
            ${detailPanelHtml()}
        </div>`;
        wireContent();
    }
    function bindingRow(binding) {
        const index = state.draft.bindings.indexOf(binding); const selected = index === state.selectedBindingIndex;
        const secondary=(binding.secondaryControllerButtons || []);
        const primarySummary=triggerSummary(binding),secondarySummary=triggerSummary(binding,'secondary'),activationSummary=secondary.length && secondarySummary !== primarySummary ? `${primarySummary} / ${secondarySummary}` : primarySummary;
        const primaryNumber = secondary.length ? '<small>1</small>' : '';
        const secondaryRow = secondary.length ? `<span class="cc-row-shortcut-line secondary"><small>2</small>${controllerChordHtml(secondary,'compact')}</span>` : '';
        return `<button class="cc-row ${selected ? 'selected' : ''}" data-cc-focus data-binding-select="${index}" aria-pressed="${selected}"><span class="cc-row-icon">${bindingIcon(binding)}</span><span class="cc-row-copy"><span class="cc-row-title">${esc(bindingTitle(binding))}</span><span class="cc-row-sub"><span>${bindingTypeLabel(binding)}</span><span>·</span><span data-trigger-summary>${activationSummary}</span></span></span><span class="cc-row-shortcuts"><span class="cc-row-shortcut-line">${primaryNumber}${controllerChordHtml(binding.controllerButtons,'compact')}</span>${secondaryRow}</span><span class="cc-row-chevron">${iconSvg('chevron')}</span></button>`;
    }

    function activationCardHtml(binding,index,slot) {
        const secondary=slot === 'secondary';
        const buttons=secondary ? (binding.secondaryControllerButtons || []) : (binding.controllerButtons || []);
        const trigger=activationTrigger(binding,slot);
        const duration=longPressDuration(binding,slot);
        const analog=buttons.some(input => input === 'left-stick' || input === 'right-stick') && (binding.action?.type === 'pointer' || binding.action?.type === 'wheel');
        const triggerConfig=!buttons.length ? '' : analog
            ? `<div class="cc-fork-note">${tx('analogContinuous')}</div>`
            : `<div class="cc-trigger-grid">${['press','hold','long-press','release'].map(mode => `<button class="cc-trigger-option ${trigger === mode ? 'active' : ''}" data-cc-focus data-trigger-value="${mode}" data-trigger-slot="${slot}" data-binding-index="${index}">${triggerLabel(mode)}</button>`).join('')}</div>${trigger === 'long-press' ? `<div class="cc-range-card cc-long-press-config"><div class="cc-long-press-head"><span class="cc-long-press-copy"><strong>${tx('holdDuration')}</strong><small>${tx('holdDurationDesc')}</small></span><output data-long-press-duration-out>${formatDuration(duration)}</output></div><input class="cc-range" data-cc-focus data-long-press-duration data-duration-slot="${slot}" data-binding-index="${index}" type="range" min="500" max="${longPressLimit(binding,slot)}" step="100" value="${duration}"><span class="cc-range-help" data-range-help>${tx('adjustRange')}</span></div>` : ''}`;
        return `<section class="cc-activation-card"><div class="cc-activation-head"><strong>${tx(secondary ? 'secondaryShortcut' : 'primaryShortcut')}</strong><small>${buttons.length ? triggerSummary(binding,slot) : tx('secondaryEmpty')}</small></div><button class="cc-capture-btn" data-cc-focus data-capture="${index}" data-capture-slot="${slot}"><span class="cc-capture-btn-copy"><small>${tx('currentShortcut')}</small>${buttons.length ? controllerChordHtml(buttons,'detail') : `<span class="cc-unassigned">${tx('secondaryEmpty')}</span>`}</span><span class="cc-capture-btn-action">${tx('configureShortcut')}${iconSvg('chevron')}</span></button>${triggerConfig}${secondary && buttons.length ? `<div class="cc-activation-actions"><button class="cc-btn quiet compact" data-cc-focus data-clear-secondary="${index}">${tx('clearSecondary')}</button></div>` : ''}</section>`;
    }

    function detailPanelHtml() {
        const binding = state.draft?.bindings?.[state.selectedBindingIndex];
        if (!binding) return `<aside class="cc-detail-panel"><div class="cc-detail-empty">${iconSvg('system')}<strong>${tx('noSelection')}</strong><span>${tx('noSelectionDesc')}</span></div></aside>`;
        const index = state.selectedBindingIndex;
        const canRemove = state.mode === 'global' || binding.action?.type !== 'system';
        const analogInput = [...(binding.controllerButtons || []),...(binding.secondaryControllerButtons || [])].some(input => input === 'left-stick' || input === 'right-stick');
        const continuousAnalog = analogInput && (binding.action?.type === 'pointer' || binding.action?.type === 'wheel');
        const pointerDistance = Math.max(4, Math.min(128, Number(binding.action?.pointerDistance) || 24));
        const wheelDelta = Math.max(120, Math.min(1200, Math.abs(Number(binding.action?.wheelDelta) || 120)));
        const amountConfig = binding.action?.type === 'pointer' && binding.action?.pointerDirection !== 'free'
            ? `<div class="cc-detail-block"><span class="cc-detail-label">${tx('pointerDistance')}</span><div class="cc-range-card"><div class="cc-range-head"><strong>${tx('pointerDistance')}</strong><output data-pointer-distance-out>${pointerDistance} ${tx('pixels')}</output></div><input class="cc-range" data-cc-focus data-pointer-distance data-binding-index="${index}" type="range" min="4" max="128" step="4" value="${pointerDistance}"><span class="cc-range-help">${tx('pointerDistanceDesc')}</span></div></div>`
            : binding.action?.type === 'wheel'
                ? `<div class="cc-detail-block"><span class="cc-detail-label">${tx('wheelAmount')}</span><div class="cc-range-card"><div class="cc-range-head"><strong>${tx('wheelAmount')}</strong><output data-wheel-amount-out>${wheelDelta / 120} ${tx(wheelDelta === 120 ? 'wheelNotch' : 'wheelNotches')} · ${wheelDelta}</output></div><input class="cc-range" data-cc-focus data-wheel-amount data-binding-index="${index}" type="range" min="120" max="1200" step="120" value="${wheelDelta}"><span class="cc-range-help">${tx('wheelAmountDesc')}</span></div></div>`
                : '';
        const analogConfig = continuousAnalog ? `<div class="cc-detail-block"><span class="cc-detail-label">${tx('analogContinuous')}</span><div class="cc-pointer"><div class="cc-range-card"><div class="cc-range-head"><strong>${binding.action?.type === 'wheel' ? tx('scrollSpeed') : tx('analogSensitivity')}</strong><output data-action-sensitivity-out>${Math.round(((binding.action?.type === 'wheel' ? state.draft.scrollSensitivity : state.draft.mouseSensitivity) || 1) * 100)}%</output></div><input class="cc-range" data-cc-focus data-action-sensitivity="${binding.action?.type}" type="range" min="25" max="300" step="5" value="${Math.round(((binding.action?.type === 'wheel' ? state.draft.scrollSensitivity : state.draft.mouseSensitivity) || 1) * 100)}"><span class="cc-range-help" data-range-help>${tx('adjustRange')}</span></div><div class="cc-range-card"><div class="cc-range-head"><strong>${tx('analogDeadzone')}</strong><output data-action-deadzone-out>${Math.round((state.draft.mouseDeadZone || .14) * 100)}%</output></div><input class="cc-range" data-cc-focus data-action-deadzone type="range" min="5" max="50" step="1" value="${Math.round((state.draft.mouseDeadZone || .14) * 100)}"><span class="cc-range-help" data-range-help>${tx('adjustRange')}</span></div></div></div>` : '';
        return `<aside class="cc-detail-panel"><span class="cc-eyebrow">${tx('selectedCommand')}</span><div class="cc-detail-title-row"><span class="cc-row-icon">${bindingIcon(binding)}</span><div><h2>${esc(bindingTitle(binding))}</h2><p>${bindingTypeLabel(binding)} · ${esc(bindingTitle(binding))}</p></div></div>
            <div class="cc-detail-block"><span class="cc-detail-label">${tx('controllerActivations')}</span><div class="cc-activation-stack">${activationCardHtml(binding,index,'primary')}${activationCardHtml(binding,index,'secondary')}</div></div>${amountConfig}${analogConfig}
            <div class="cc-detail-actions">${binding.action?.type === 'keyboard' ? `<button class="cc-btn" data-cc-focus data-edit-keys="${index}">${iconSvg('edit')}${tx('editOutput')}</button>` : ''}${canRemove ? `<button class="cc-btn danger" data-cc-focus data-remove="${index}">${iconSvg('trash')}${tx('remove')}</button>` : ''}</div>
        </aside>`;
    }

    function wireContent() {
        const host = state.overlay?.querySelector('[data-content]'); if (!host) return;
        host.querySelector('[data-add-keyboard]')?.addEventListener('click', () => openKeyboard(-1));
        host.querySelector('[data-add-mouse]')?.addEventListener('click', openMousePicker);
        host.querySelector('[data-add-global]')?.addEventListener('click', openGlobalPicker);
        host.querySelectorAll('[data-binding-select]').forEach(button => button.addEventListener('click', () => {
            state.selectedBindingIndex = Number(button.dataset.bindingSelect); renderContent(); focusDefault(`[data-binding-select="${state.selectedBindingIndex}"]`);
        }));
        host.querySelectorAll('[data-edit-keys]').forEach(button => button.addEventListener('click', () => openKeyboard(Number(button.dataset.editKeys))));
        host.querySelectorAll('[data-capture]').forEach(button => button.addEventListener('click', () => openCapture(Number(button.dataset.capture),button.dataset.captureSlot || 'primary')));
        host.querySelectorAll('[data-clear-secondary]').forEach(button => button.addEventListener('click', () => { ensureFork(); const index=Number(button.dataset.clearSecondary),binding=state.draft.bindings[index]; if (!binding) return; binding.secondaryControllerButtons=[]; binding.secondaryTrigger='press'; binding.secondaryLongPressDurationMs=1200; state.selectedBindingIndex=index; markDirty(); renderContent(); focusDefault(`[data-capture="${index}"][data-capture-slot="secondary"]`); }));
        host.querySelectorAll('[data-remove]').forEach(button => button.addEventListener('click', () => { ensureFork(); const index=Number(button.dataset.remove); state.draft.bindings.splice(index, 1); state.selectedBindingIndex = -1; normalizeSelectedBinding(); markDirty(); renderContent(); }));
        host.querySelectorAll('[data-trigger-value]').forEach(button => button.addEventListener('click', () => { ensureFork(); const index=Number(button.dataset.bindingIndex),binding=state.draft.bindings[index],slot=button.dataset.triggerSlot || 'primary',triggerProp=slot === 'secondary' ? 'secondaryTrigger' : 'trigger',durationProp=slot === 'secondary' ? 'secondaryLongPressDurationMs' : 'longPressDurationMs'; if (!binding || binding[triggerProp] === button.dataset.triggerValue) return; binding[triggerProp]=button.dataset.triggerValue; if (binding[triggerProp] === 'long-press') binding[durationProp]=longPressDuration(binding,slot); state.selectedBindingIndex=index; markDirty(); renderContent(); focusDefault(`[data-trigger-value="${binding[triggerProp]}"][data-trigger-slot="${slot}"]`); }));
        const sensitivity = host.querySelector('[data-sensitivity]'); const scrollSensitivity = host.querySelector('[data-scroll-sensitivity]'); const deadzone = host.querySelector('[data-deadzone]');
        sensitivity?.addEventListener('input', () => { ensureFork(); state.draft.mouseSensitivity = Number(sensitivity.value)/100; host.querySelector('[data-sensitivity-out]').textContent = `${sensitivity.value}%`; markDirty(); });
        scrollSensitivity?.addEventListener('input', () => { ensureFork(); state.draft.scrollSensitivity = Number(scrollSensitivity.value)/100; host.querySelector('[data-scroll-sensitivity-out]').textContent = `${scrollSensitivity.value}%`; markDirty(); });
        deadzone?.addEventListener('input', () => { ensureFork(); state.draft.mouseDeadZone = Number(deadzone.value)/100; host.querySelector('[data-deadzone-out]').textContent = `${deadzone.value}%`; markDirty(); });
        host.querySelectorAll('[data-pointer-distance]').forEach(range => range.addEventListener('input', () => { ensureFork(); const binding=state.draft.bindings[Number(range.dataset.bindingIndex)]; if (!binding) return; binding.action.pointerDistance=Number(range.value); host.querySelector('[data-pointer-distance-out]').textContent=`${range.value} ${tx('pixels')}`; markDirty(); }));
        host.querySelectorAll('[data-wheel-amount]').forEach(range => range.addEventListener('input', () => { ensureFork(); const binding=state.draft.bindings[Number(range.dataset.bindingIndex)]; if (!binding) return; const sign=Number(binding.action.wheelDelta)<0?-1:1; binding.action.wheelDelta=sign*Number(range.value); const notches=Number(range.value)/120; host.querySelector('[data-wheel-amount-out]').textContent=`${notches} ${tx(notches === 1 ? 'wheelNotch' : 'wheelNotches')} · ${range.value}`; markDirty(); }));
        host.querySelectorAll('[data-action-sensitivity]').forEach(range => range.addEventListener('input', () => { ensureFork(); if (range.dataset.actionSensitivity === 'wheel') state.draft.scrollSensitivity=Number(range.value)/100; else state.draft.mouseSensitivity=Number(range.value)/100; host.querySelector('[data-action-sensitivity-out]').textContent=`${range.value}%`; markDirty(); }));
        host.querySelectorAll('[data-action-deadzone]').forEach(range => range.addEventListener('input', () => { ensureFork(); state.draft.mouseDeadZone=Number(range.value)/100; host.querySelector('[data-action-deadzone-out]').textContent=`${range.value}%`; markDirty(); }));
        host.querySelectorAll('[data-long-press-duration]').forEach(range => range.addEventListener('input', () => { ensureFork(); const index=Number(range.dataset.bindingIndex),binding=state.draft.bindings[index],slot=range.dataset.durationSlot || 'primary',durationProp=slot === 'secondary' ? 'secondaryLongPressDurationMs' : 'longPressDurationMs'; if (!binding) return; binding[durationProp]=Number(range.value); const output=range.parentElement?.querySelector('[data-long-press-duration-out]'); if (output) output.textContent=formatDuration(binding[durationProp]); const summary=host.querySelector(`[data-binding-select="${index}"] [data-trigger-summary]`); if (summary) { const primary=triggerSummary(binding),secondary=triggerSummary(binding,'secondary'); summary.textContent=(binding.secondaryControllerButtons || []).length && secondary !== primary ? `${primary} / ${secondary}` : primary; } markDirty(); }));
    }

    function ensureFork() {
        if (!isBuiltIn()) return;
        const baseId = state.draft.id; state.draft.id = `controls-${Date.now()}-${Math.random().toString(16).slice(2)}`; state.draft.baseProfileId = baseId;
        state.draft.isBuiltIn = false; state.draft.createdAtUtc = new Date().toISOString(); state.draft.updatedAtUtc = state.draft.createdAtUtc;
        state.draft.name = state.target ? `${state.target.name} — ${tx('customSuffix')}` : ''; renderHeader();
    }
    function markDirty() { state.dirty = true; state.draft.updatedAtUtc = new Date().toISOString(); renderFooter(); }
    function setTab(tab) { if (!['keyboard','mouse'].includes(tab) || state.mode === 'global' || (isYouTubeProfile() && tab === 'mouse')) return; finishRangeAdjustment(); state.tab = tab; state.selectedBindingIndex = -1; normalizeSelectedBinding(); renderTabs(); renderContent(); focusDefault(); }
    function switchTab(direction) { if (!state.popup && !state.adjustingRange) setTab(direction === 'left' ? 'keyboard' : 'mouse'); }

    function openPicker(kind) {
        if (kind === 'profiles' && state.target && !mouseKeyboardEnabled()) return;
        const profiles = state.profiles.filter(profile => !isGlobalProfile(profile) && (!isBuiltIn(profile) || !state.target || (state.target.isYouTubeTv ? ['builtin-youtube','builtin-web'].includes(profile.id) : profile.id === `builtin-${state.target.category}`)));
        const items = kind === 'apps' ? state.targets : profiles;
        const searchKey = kind === 'apps' ? 'searchApps' : 'searchProfiles'; const titleKey = kind === 'apps' ? 'selectApp' : 'selectProfile';
        openPopup(`<div class="cc-dialog cc-picker-dialog"><div class="cc-dialog-head"><div><h2>${tx(titleKey)}</h2></div><button class="cc-btn" data-cc-focus data-popup-close>${tx('close')}</button></div><input class="cc-search" data-cc-focus data-picker-search placeholder="${tx(searchKey)}"><div class="cc-picker-list" data-picker-list></div></div>`, kind);
        const render = () => {
            const query = state.overlay.querySelector('[data-picker-search]').value.trim().toLowerCase();
            const filtered = items.filter(item => (kind === 'apps' ? item.name : profileDisplayName(item)).toLowerCase().includes(query));
            state.overlay.querySelector('[data-picker-list]').innerHTML = filtered.length ? filtered.map(item => {
                const active = kind === 'apps' ? targetKey(item) === targetKey(state.target) : item.id === state.draft?.id;
                const name = kind === 'apps' ? item.name : profileDisplayName(item); const sub = kind === 'apps' ? item.category : (isBuiltIn(item) ? tx('systemProfile') : tx('customProfile'));
                const key = kind === 'apps' ? targetKey(item) : item.id;
                const art = kind === 'apps' ? targetArtHtml(item, 'cc-picker-icon') : profileArtHtml(item, 'cc-picker-icon cc-profile-art');
                const trailing = kind === 'profiles' ? `<span class="cc-profile-row-trailing">${profileAuthorChipHtml(item)}${active ? `<span class="cc-profile-saved-label">${tx('saved')}</span>` : ''}</span>` : `<span>${active ? tx('saved') : ''}</span>`;
                return `<button class="cc-picker-item ${active ? 'active' : ''}" data-cc-focus data-pick="${esc(key)}">${art}<span><strong>${esc(name)}</strong><span>${esc(sub)}</span></span>${trailing}</button>`;
            }).join('') : `<div class="cc-empty">${tx('noResults')}</div>`;
            state.overlay.querySelectorAll('[data-pick]').forEach(button => button.addEventListener('click', () => {
                if (kind === 'apps') { const target = state.targets.find(item => targetKey(item) === button.dataset.pick); closePopup(); guardDirty(() => selectTarget(target)); }
                else { const profile = state.profiles.find(item => item.id === button.dataset.pick); if (!profile) return; closePopup(); guardDirty(() => state.target ? post({ action:'assignControlProfile', target:state.target, profileId:profile.id }) : selectTemplate(profile)); }
            }));
        };
        state.overlay.querySelector('[data-picker-search]').addEventListener('input', render); render(); focusDefault('[data-picker-search]');
    }

    function openKeyboard(index) {
        const current = index >= 0 ? state.draft.bindings[index]?.action?.virtualKeys || [] : []; const selected = [...current];
        openPopup(`<div class="cc-dialog wide"><div class="cc-dialog-head"><div><h2>${tx('chooseKeys')}</h2><p>${tx('chooseKeysDesc')}</p></div><button class="cc-btn" data-cc-focus data-popup-close>${tx('close')}</button></div><div class="cc-key-summary" data-key-summary></div><div class="cc-keyboard-scroll"><div class="cc-keyboard">${KEY_ROWS.map((row,rowIndex) => `<div class="cc-key-row" data-key-row="${rowIndex}">${row.map(([code,label,size],colIndex) => `<button class="cc-key ${size || ''}" data-cc-focus data-key="${code}" data-key-row="${rowIndex}" data-key-col="${colIndex}">${esc(keyboardKeyLabel(code,label))}</button>`).join('')}</div>`).join('')}</div></div><div class="cc-dialog-actions"><button class="cc-btn" data-cc-focus data-clear-keys>${tx('clear')}</button><button class="cc-btn primary" data-cc-focus data-apply-keys>${tx('apply')}</button></div></div>`, 'keyboard');
        const update = () => { state.overlay.querySelector('[data-key-summary]').innerHTML = selected.length ? chordHtml(selected.map(keyLabel)) : `<span class="cc-unassigned">${tx('chooseKeys')}</span>`; state.overlay.querySelectorAll('[data-key]').forEach(button => button.classList.toggle('selected', selected.includes(Number(button.dataset.key)))); };
        state.overlay.querySelectorAll('[data-key]').forEach(button => button.addEventListener('click', () => { const code = Number(button.dataset.key); const at = selected.indexOf(code); if (at >= 0) selected.splice(at,1); else if (selected.length < 6) selected.push(code); update(); }));
        state.overlay.querySelector('[data-clear-keys]').addEventListener('click', () => { selected.splice(0); update(); });
        state.overlay.querySelector('[data-apply-keys]').addEventListener('click', () => { if (!selected.length) return; ensureFork(); if (index >= 0) { state.draft.bindings[index].action.virtualKeys = selected; state.selectedBindingIndex=index; } else { state.draft.bindings.push(newBinding({type:'keyboard',virtualKeys:selected,mouseButton:'left',wheelDelta:120,systemCommand:''})); state.selectedBindingIndex=state.draft.bindings.length-1; } markDirty(); closePopup(); renderContent(); });
        update(); focusDefault('[data-key]');
    }

    function openMousePicker() {
        const choices = [['pointer','free','pointerFree'],['pointer','up','pointerUp'],['pointer','down','pointerDown'],['pointer','left','pointerLeft'],['pointer','right','pointerRight'],['mouse','left','left'],['mouse','right','right'],['mouse','middle','middle'],['mouse','x1','backMouse'],['mouse','x2','forwardMouse'],['wheel',120,'wheelUp'],['wheel',-120,'wheelDown']];
        openPopup(`<div class="cc-dialog"><div class="cc-dialog-head"><div><h2>${tx('chooseMouse')}</h2><p>${tx('pointerChoiceDesc')}</p></div><button class="cc-btn" data-cc-focus data-popup-close>${tx('close')}</button></div><div class="cc-picker-list">${choices.map(([type,value,label]) => { const action={type,mouseButton:type === 'mouse' ? value : 'left',wheelDelta:type === 'wheel' ? Number(value) : 120,pointerDirection:type === 'pointer' ? value : 'free',pointerDistance:24}; const icon=type === 'pointer' ? stickSvg(value !== 'free') : mouseActionSvg(action); return `<button class="cc-picker-item" data-cc-focus data-mouse-choice="${type}:${value}"><span class="cc-picker-icon">${icon}</span><span><strong>${tx(label)}</strong></span></button>`; }).join('')}</div></div>`, 'mouse');
        state.overlay.querySelectorAll('[data-mouse-choice]').forEach(button => button.addEventListener('click', () => { const [type,value] = button.dataset.mouseChoice.split(':'); ensureFork(); state.draft.bindings.push(newBinding({type,virtualKeys:[],mouseButton:type === 'mouse' ? value : 'left',wheelDelta:type === 'wheel' ? Number(value) : 120,pointerDirection:type === 'pointer' ? value : 'free',pointerDistance:24,systemCommand:''})); state.selectedBindingIndex=state.draft.bindings.length-1; markDirty(); closePopup(); renderContent(); }));
        focusDefault('[data-mouse-choice]');
    }
    function openGlobalPicker() {
        const choices = [
            ['doorpi-return', lang() === 'pt' ? 'Voltar ao Doorpi' : 'Return to Doorpi'],
            ['task-switcher', lang() === 'pt' ? 'Alternar entre janelas' : 'Switch windows']
        ];
        openPopup(`<div class="cc-dialog"><div class="cc-dialog-head"><div><h2>${tx('chooseGlobal')}</h2><p>${tx('chooseGlobalDesc')}</p></div><button class="cc-btn" data-cc-focus data-popup-close>${tx('close')}</button></div><div class="cc-picker-list">${choices.map(([command,label]) => `<button class="cc-picker-item" data-cc-focus data-global-choice="${command}"><span class="cc-picker-icon">${iconSvg('system')}</span><span><strong>${label}</strong><span>${tx('systemAction')}</span></span>${iconSvg('chevron')}</button>`).join('')}</div></div>`, 'global');
        state.overlay.querySelectorAll('[data-global-choice]').forEach(button => button.addEventListener('click', () => {
            const command = button.dataset.globalChoice;
            const binding = newBinding({type:'system',virtualKeys:[],mouseButton:'left',wheelDelta:120,systemCommand:command});
            binding.name = actionLabel(binding.action); state.draft.bindings.push(binding); state.selectedBindingIndex=state.draft.bindings.length-1;
            markDirty(); closePopup(); renderContent();
        }));
        focusDefault('[data-global-choice]');
    }
    function newBinding(action) { return { id:`binding-${Date.now()}-${Math.random().toString(16).slice(2)}`, name:actionLabel(action), enabled:true, controllerButtons:[], trigger:'press', longPressDurationMs:1200, secondaryControllerButtons:[], secondaryTrigger:'press', secondaryLongPressDurationMs:1200, action }; }

    function openCapture(index,slot='primary') {
        const id = `capture-${Date.now()}-${Math.random().toString(16).slice(2)}`; state.capture = { id, index, slot, progress:0, buttons:[], lastBPressAt:0 };
        openPopup(`<div class="cc-dialog"><div class="cc-dialog-head"><div><h2>${tx('captureTitle')}</h2><p>${tx(slot === 'secondary' ? 'secondaryShortcut' : 'primaryShortcut')} · ${esc(actionLabel(state.draft.bindings[index].action))}</p></div></div><div class="cc-capture"><div class="cc-capture-ring" data-capture-ring style="--progress:0"><div class="cc-capture-chord" data-capture-chord>${controllerChordHtml([],'capture')}</div></div><div class="cc-progress" style="--progress:0" data-capture-progress><span></span></div><p class="cc-capture-status" data-capture-status>${tx('captureIdle')}</p><p class="cc-range-help" data-capture-cancel-hint>${tx('cancelDoubleB')}</p><button class="cc-btn" data-cc-focus data-cancel-capture>${tx('cancel')}</button></div></div>`, 'capture');
        state.overlay.querySelector('[data-cancel-capture]').addEventListener('click', cancelCapture);
        post({ action:'startControlCapture', captureId:id }); focusDefault('[data-cancel-capture]');
    }
    function cancelCapture() {
        if (!state.capture) return;
        post({action:'cancelControlCapture',captureId:state.capture.id}); state.capture=null; state.captureSuppressed=true; closePopup();
    }
    function handleCaptureCancelPress() {
        if (!state.capture) return;
        const now = performance.now();
        if (state.capture.lastBPressAt && now - state.capture.lastBPressAt <= 700) { cancelCapture(); return; }
        state.capture.lastBPressAt = now;
        const hint = state.overlay?.querySelector('[data-capture-cancel-hint]');
        if (hint) hint.textContent = tx('cancelDoubleBArmed');
    }
    function updateCapture(data) {
        if (!state.capture || data.captureId !== state.capture.id) return; const progress = Math.max(0,Math.min(1,Number(data.progress)||0)); const buttons = data.buttons || [];
        state.capture.progress = progress; state.capture.buttons = buttons;
        const ring = state.overlay.querySelector('[data-capture-ring]'); const bar = state.overlay.querySelector('[data-capture-progress]'); if (ring) ring.style.setProperty('--progress',progress); if (bar) bar.style.setProperty('--progress',progress);
        const chord = state.overlay.querySelector('[data-capture-chord]'); if (chord) chord.innerHTML = controllerChordHtml(buttons,'capture');
        const status = state.overlay.querySelector('[data-capture-status]'); if (status) status.textContent = data.waitingForRelease ? tx('captureRelease') : progress >= 1 ? tx('captureDone') : buttons.length ? tx('captureHolding') : tx('captureIdle');
        if (data.type === 'controlCaptureCompleted' && buttons.length) {
            ensureFork(); const binding=state.draft.bindings[state.capture.index],slot=state.capture.slot || 'primary',buttonsProp=slot === 'secondary' ? 'secondaryControllerButtons' : 'controllerButtons',triggerProp=slot === 'secondary' ? 'secondaryTrigger' : 'trigger',durationProp=slot === 'secondary' ? 'secondaryLongPressDurationMs' : 'longPressDurationMs'; binding[buttonsProp] = buttons; binding[durationProp]=longPressDuration(binding,slot);
            const analog=buttons.some(input => input === 'left-stick' || input === 'right-stick');
            if (binding.action?.type === 'pointer' || binding.action?.type === 'wheel') binding[triggerProp]=analog?'hold':'press';
            if (!analog && binding.action?.type === 'pointer' && binding.action.pointerDirection === 'free') {
                const direction=buttons.find(input => input.startsWith('dpad-'))?.slice(5);
                if (direction) binding.action.pointerDirection=direction;
            }
            markDirty(); state.capture = null; state.captureSuppressed = true;
            setTimeout(() => { closePopup(); renderContent(); }, 280);
        }
    }

    function openSaveDialog() {
        if (!state.dirty || !state.draft) return; const suggested = state.draft.name || (state.target ? `${state.target.name} — ${tx('customSuffix')}` : '');
        openPopup(`<div class="cc-dialog"><div class="cc-dialog-head"><div><h2>${tx('saveTitle')}</h2><p>${tx('saveDesc')}</p></div><button class="cc-btn" data-cc-focus data-popup-close>${tx('close')}</button></div><label class="cc-label" for="ccProfileName">${tx('profileName')}</label><input id="ccProfileName" class="cc-name-input" data-cc-focus value="${esc(suggested)}"><p style="margin-top:12px">${tx('syncOn')}</p><div class="cc-dialog-actions"><button class="cc-btn" data-cc-focus data-popup-close>${tx('cancel')}</button><button class="cc-btn primary" data-cc-focus data-confirm-save>${tx('confirmSave')}</button></div></div>`, 'save');
        const input = state.overlay.querySelector('#ccProfileName'); state.overlay.querySelector('[data-confirm-save]').addEventListener('click', () => { const name = input.value.trim(); if (!name) { input.focus(); return; } state.draft.name = name; state.draft.updatedAtUtc = new Date().toISOString(); state.savePending = true; renderFooter(); closePopup(); post({action:'saveControlProfile',target:state.target,profile:state.draft}); }); focusDefault('#ccProfileName');
    }

    function guardDirty(action) {
        if (!state.dirty) { action(); return; }
        openPopup(`<div class="cc-dialog"><div class="cc-dialog-head"><div><h2>${tx('discardTitle')}</h2><p>${tx('discardDesc')}</p></div></div><div class="cc-dialog-actions"><button class="cc-btn" data-cc-focus data-keep-editing>${tx('keepEditing')}</button><button class="cc-btn danger" data-cc-focus data-discard>${tx('discard')}</button></div></div>`, 'discard');
        state.overlay.querySelector('[data-keep-editing]').addEventListener('click', closePopup);
        state.overlay.querySelector('[data-discard]').addEventListener('click', () => { state.dirty=false; closePopup(); action(); });
        focusDefault('[data-keep-editing]');
    }
    function requestClose() { guardDirty(close); }

    function openPopup(html, kind) { closePopup(); const shade = document.createElement('div'); shade.className='cc-shade'; shade.innerHTML=html; state.overlay.appendChild(shade); state.popup={kind,element:shade}; shade.querySelectorAll('[data-popup-close]').forEach(button => button.addEventListener('click', closePopup)); }
    function closePopup() { state.popup?.element?.remove(); state.popup=null; focusDefault(); }
    function toast(message) { const el=document.createElement('div'); el.style.cssText='position:fixed;z-index:17000;left:50%;bottom:90px;transform:translateX(-50%);padding:12px 18px;border-radius:10px;background:#eef7ff;color:#14243d;font-weight:800'; el.textContent=message; document.body.appendChild(el); setTimeout(()=>el.remove(),1800); }

    function focusables() { return state.overlay ? [...state.overlay.querySelectorAll('[data-cc-focus]')].filter(item => !item.disabled && item.offsetParent !== null) : []; }
    function focusDefault(selector='') {
        const generation=++state.focusRequestGeneration;
        requestAnimationFrame(() => {
            if(generation!==state.focusRequestGeneration||!state.overlay)return;
            const preferred=state.mode === 'global' ? state.overlay.querySelector('[data-mode="global"]') : state.overlay.querySelector('[data-app-selector]');
            const item=(selector&&state.overlay.querySelector(selector)) || (state.popup?.element?.querySelector('[data-cc-focus]')) || (preferred?.offsetParent !== null ? preferred : null) || focusables()[0];
            item?.focus({preventScroll:true});
        });
    }
    function finishRangeAdjustment() {
        const range = state.adjustingRange; if (!range) return;
        range.classList.remove('adjusting'); const help = range.parentElement?.querySelector('[data-range-help]'); if (help) help.textContent = tx('adjustRange');
        state.adjustingRange = null;
    }
    function toggleRangeAdjustment(range) {
        if (!range?.matches?.('input[type="range"]')) return false;
        if (state.adjustingRange === range) { finishRangeAdjustment(); return true; }
        finishRangeAdjustment(); state.adjustingRange = range; range.classList.add('adjusting');
        const help = range.parentElement?.querySelector('[data-range-help]'); if (help) help.textContent = tx('adjustingRange');
        return true;
    }
    function focusItem(item) {
        item?.focus?.({preventScroll:true});
        const detailScroller=item?.closest?.('.cc-detail-panel');
        if (detailScroller) {
            const scrollerRect=detailScroller.getBoundingClientRect(),itemRect=item.getBoundingClientRect();
            const centerOffset=(itemRect.top+itemRect.height/2)-(scrollerRect.top+scrollerRect.height/2);
            const maxScroll=Math.max(0,detailScroller.scrollHeight-detailScroller.clientHeight);
            detailScroller.scrollTop=Math.max(0,Math.min(maxScroll,detailScroller.scrollTop+centerOffset));
        } else item?.scrollIntoView?.({block:'nearest',inline:'nearest'});
    }
    function itemsIn(selector) {
        return state.overlay ? [...state.overlay.querySelectorAll(`${selector} [data-cc-focus]`)].filter(item => !item.disabled && item.offsetParent !== null) : [];
    }
    function moveWithin(items, active, delta) {
        if (!items.length) return null;
        const index = Math.max(0, items.indexOf(active));
        return items[Math.max(0, Math.min(items.length - 1, index + delta))];
    }
    function focusItemsWithin(element) {
        return element ? [...element.querySelectorAll('[data-cc-focus]')].filter(item => !item.disabled && item.offsetParent !== null) : [];
    }
    function spatialDirectionalCandidate(items, active, direction) {
        if (!items.includes(active)) return null;
        const rect=active.getBoundingClientRect(),cx=rect.left+rect.width/2,cy=rect.top+rect.height/2;let best=null,score=Infinity;
        items.forEach(item=>{if(item===active)return;const next=item.getBoundingClientRect(),dx=next.left+next.width/2-cx,dy=next.top+next.height/2-cy;const valid=direction==='RIGHT'?dx>4:direction==='LEFT'?dx<-4:direction==='DOWN'?dy>4:dy<-4;if(!valid)return;const primary=(direction==='RIGHT'||direction==='LEFT')?Math.abs(dx):Math.abs(dy),cross=(direction==='RIGHT'||direction==='LEFT')?Math.abs(dy):Math.abs(dx),value=primary+cross*.35;if(value<score){score=value;best=item;}});
        return best;
    }
    function spatialPopupNavigation(items, active, direction) {
        if (!items.includes(active)) return items[0];
        return spatialDirectionalCandidate(items,active,direction) || moveWithin(items,active,(direction==='RIGHT'||direction==='DOWN')?1:-1);
    }
    function keyboardPopupNavigation(active, direction) {
        const rows = [...state.popup.element.querySelectorAll('.cc-key-row')]
            .map(row => [...row.querySelectorAll('.cc-key')].filter(key => key.offsetParent !== null))
            .filter(row => row.length);
        const actions = [...state.popup.element.querySelectorAll('.cc-dialog-actions [data-cc-focus]')]
            .filter(item => !item.disabled && item.offsetParent !== null);
        const closeButton = state.popup.element.querySelector('.cc-dialog-head [data-popup-close]');
        const nearestTo = (items, source) => {
            if (!items.length) return null;
            const rect = source.getBoundingClientRect(), center = rect.left + rect.width / 2;
            return items.reduce((closest, item) => {
                const next = item.getBoundingClientRect();
                const distance = Math.abs(next.left + next.width / 2 - center);
                return !closest || distance < closest.distance ? { item, distance } : closest;
            }, null)?.item || null;
        };
        if (actions.includes(active)) {
            if (direction === 'LEFT' || direction === 'RIGHT')
                return moveWithin(actions, active, direction === 'RIGHT' ? 1 : -1);
            if (direction === 'UP') return nearestTo(rows[rows.length - 1] || [], active) || active;
            return active;
        }
        if (active === closeButton) {
            if (direction === 'DOWN') return nearestTo(rows[0] || [], active) || actions[0] || active;
            return active;
        }
        if (!active?.matches?.('.cc-key')) return null;
        const currentRow = rows.findIndex(row => row.includes(active));
        if (currentRow < 0) return null;
        const row = rows[currentRow], currentCol = row.indexOf(active);
        if (direction === 'LEFT' || direction === 'RIGHT') {
            const delta = direction === 'RIGHT' ? 1 : -1;
            return row[(currentCol + delta + row.length) % row.length];
        }
        if (direction === 'UP' && currentRow === 0) return closeButton || active;
        if (direction === 'DOWN' && currentRow === rows.length - 1) return nearestTo(actions, active) || active;
        const nextRowIndex = currentRow + (direction === 'DOWN' ? 1 : -1);
        const currentRect = active.getBoundingClientRect();
        const currentCenter = currentRect.left + currentRect.width / 2;
        return rows[nextRowIndex].reduce((closest, key) => {
            const rect = key.getBoundingClientRect();
            const distance = Math.abs(rect.left + rect.width / 2 - currentCenter);
            return !closest || distance < closest.distance ? { key, distance } : closest;
        }, null)?.key || active;
    }
    function gridGroupNavigation(items, active, direction, columns) {
        const index = items.indexOf(active); if (index < 0) return null;
        const column = index % columns;
        if (direction === 'LEFT') return column > 0 ? items[index - 1] : active;
        if (direction === 'RIGHT') return column < columns - 1 && items[index + 1] ? items[index + 1] : active;
        const next = index + (direction === 'DOWN' ? columns : -columns);
        return items[next] || null;
    }
    function contentGridNavigation(active, direction, contentItems, footerItems, upperItem, leftBoundaryItem) {
        const row = active?.closest?.('.cc-row');
        if (!row) return null;
        const rows = [...state.overlay.querySelectorAll('.cc-content .cc-row')].filter(item => item.offsetParent !== null);
        const rowIndex = rows.indexOf(row);
        const rowActions = [...row.querySelectorAll('[data-cc-focus]')].filter(item => !item.disabled && item.offsetParent !== null);
        const column = Math.max(0, rowActions.indexOf(active));
        if (direction === 'LEFT' || direction === 'RIGHT') {
            if (direction === 'LEFT' && column === 0) return leftBoundaryItem || active;
            return moveWithin(rowActions, active, direction === 'RIGHT' ? 1 : -1);
        }
        if (direction === 'UP' || direction === 'DOWN') {
            const nextIndex = rowIndex + (direction === 'DOWN' ? 1 : -1);
            if (nextIndex >= 0 && nextIndex < rows.length) {
                const nextActions = [...rows[nextIndex].querySelectorAll('[data-cc-focus]')].filter(item => !item.disabled && item.offsetParent !== null);
                return nextActions[Math.min(column, Math.max(0, nextActions.length - 1))] || null;
            }
            if (direction === 'DOWN') {
                const lastRowActionIndex = Math.max(...rowActions.map(item => contentItems.indexOf(item)));
                const afterRows = contentItems.slice(lastRowActionIndex + 1).find(item => !item.closest('.cc-row'));
                return afterRows || footerItems[0] || active;
            }
            const beforeRows = contentItems.filter(item => !item.closest('.cc-row'));
            return beforeRows[beforeRows.length - 1] || upperItem || active;
        }
        return null;
    }
    function navigate(direction) {
        // A queued focusDefault from a render must never overwrite a direction
        // the user has already chosen on the next animation frame.
        state.focusRequestGeneration++;
        if (state.capture) return; const items=focusables(); if (!items.length) return; const active=document.activeElement;
        if (state.adjustingRange) {
            if (active !== state.adjustingRange) state.adjustingRange.focus({preventScroll:true});
            if (direction==='LEFT'||direction==='RIGHT') { const range=state.adjustingRange,step=Number(range.step)||1; range.value=String(Math.max(Number(range.min),Math.min(Number(range.max),Number(range.value)+(direction==='RIGHT'?step:-step)))); range.dispatchEvent(new Event('input',{bubbles:true})); }
            return;
        }
        const candidates = state.popup ? itemsIn('.cc-shade') : items;
        if (!candidates.includes(active)) { focusItem(candidates[0]); return; }
        if (state.popup) {
            const keyboardTarget = state.popup.kind === 'keyboard' ? keyboardPopupNavigation(active, direction) : null;
            focusItem(keyboardTarget || spatialPopupNavigation(candidates, active, direction) || active); return;
        }

        const modes=itemsIn('.cc-mode-switch'),top=itemsIn('.cc-top'),topActions=top.filter(item=>!modes.includes(item)),context=itemsIn('.cc-context'),inputMode=itemsIn('.cc-input-mode'),tabs=itemsIn('.cc-tabs'),headActions=itemsIn('.cc-command-panel .cc-section-head'),rows=itemsIn('.cc-list'),detail=itemsIn('.cc-detail-panel'),pointer=itemsIn('.cc-pointer-panel'),footer=itemsIn('.cc-footer');
        const activeTab=tabs.find(item=>item.classList.contains('active'))||tabs[0];
        const activeMode=modes.find(item=>item.classList.contains('active'))||modes[0];
        const selectedRow=rows.find(item=>item.classList.contains('selected'))||rows[0];
        let target=null;
        if (modes.includes(active)) {
            if (direction==='RIGHT'&&active===modes[modes.length-1]) target=topActions[0]||active;
            else if (direction==='LEFT'||direction==='RIGHT') target=moveWithin(modes,active,direction==='RIGHT'?1:-1);
            else if (direction==='DOWN') target=state.mode==='global'?(headActions[0]||rows[0]||detail[0]||footer[0]):(context[0]||inputMode[0]||activeTab);
        } else if (top.includes(active)) {
            if (direction==='LEFT') target=modes[modes.length-1]||activeMode;
            else if (direction==='DOWN') target=state.mode==='global'?(detail[0]||rows[0]):(context[context.length-1]||inputMode[0]||activeTab);
        } else if (context.includes(active)) {
            const index=context.indexOf(active);
            if (direction==='LEFT'||direction==='RIGHT') target=moveWithin(context,active,direction==='RIGHT'?1:-1);
            else if (direction==='DOWN') target=inputMode[0]||activeTab||rows[0];
            else if (direction==='UP') target=activeMode;
        } else if (inputMode.includes(active)) {
            if (direction==='UP') target=context[context.length-1]||activeMode;
            else if (direction==='DOWN') target=activeTab||footer[0]||active;
            else target=active;
        } else if (tabs.includes(active)) {
            const index=tabs.indexOf(active);
            if (direction==='LEFT'||direction==='RIGHT') target=moveWithin(tabs,active,direction==='RIGHT'?1:-1);
            else if (direction==='DOWN') target=headActions[0]||rows[0]||detail[0]||pointer[0]||footer[0];
            else if (direction==='UP') target=inputMode[0]||context[Math.min(index,Math.max(0,context.length-1))]||activeMode;
        } else if (headActions.includes(active)) {
            if (direction==='UP') target=activeTab||context[0]||activeMode;
            else if (direction==='DOWN') target=rows[0]||detail[0]||pointer[0]||footer[0];
            else if (direction==='RIGHT') target=detail[0]||pointer[0]||active;
            else target=active;
        } else if (rows.includes(active)) {
            const index=rows.indexOf(active);
            if (direction==='UP') target=index===0?(headActions[0]||activeTab||context[0]):rows[index-1];
            else if (direction==='DOWN') target=index===rows.length-1?(pointer[0]||footer[0]||active):rows[index+1];
            else if (direction==='RIGHT') target=detail[0]||active;
            else target=active;
        } else if (detail.includes(active)) {
            const triggerItems = focusItemsWithin(active.closest('.cc-trigger-grid'));
            const actionItems = focusItemsWithin(active.closest('.cc-detail-actions'));
            const rangePairItems = focusItemsWithin(active.closest('.cc-pointer'));
            const spatialTarget = spatialDirectionalCandidate(detail,active,direction);
            const detailIndex = detail.indexOf(active);
            const previousDetail = detailIndex>0 ? detail[detailIndex-1] : null;
            const nextDetail = detailIndex>=0 ? detail[detailIndex+1] : null;
            const upperTarget = state.mode === 'global' ? activeMode : (context[context.length-1]||activeMode);
            if (triggerItems.length && direction==='LEFT') {
                const triggerIndex=triggerItems.indexOf(active);
                target=triggerIndex%2===1 ? triggerItems[triggerIndex-1] : (selectedRow||active);
            }
            else if (triggerItems.length) target=gridGroupNavigation(triggerItems,active,direction,2)||spatialTarget||(direction==='UP'?(previousDetail||upperTarget):direction==='DOWN'?(nextDetail||footer[0]||active):active);
            else if (actionItems.length && (direction==='LEFT'||direction==='RIGHT')) {
                const actionIndex=actionItems.indexOf(active);
                target=direction==='LEFT' ? (actionIndex>0?actionItems[actionIndex-1]:(selectedRow||active)) : (actionItems[actionIndex+1]||active);
            }
            else if (rangePairItems.length && (direction==='LEFT'||direction==='RIGHT')) {
                const rangeIndex=rangePairItems.indexOf(active);
                target=direction==='LEFT' ? (rangeIndex>0?rangePairItems[rangeIndex-1]:(selectedRow||active)) : (rangePairItems[rangeIndex+1]||active);
            }
            else if (direction==='LEFT') target=selectedRow||active;
            else if (direction==='UP') {
                target=spatialTarget||previousDetail;
                if (!target) { active.closest('.cc-detail-panel').scrollTop=0; target=upperTarget||active; }
            }
            else if (direction==='DOWN') {
                target=spatialTarget||nextDetail;
                if (!target) { const scroller=active.closest('.cc-detail-panel'); scroller.scrollTop=scroller.scrollHeight; target=footer[0]||active; }
            }
            else target=spatialTarget||active;
        } else if (pointer.includes(active)) {
            if (direction==='LEFT'||direction==='RIGHT') target=moveWithin(pointer,active,direction==='RIGHT'?1:-1)||active;
            else if (direction==='UP') target=rows[rows.length-1]||headActions[0]||active;
            else if (direction==='DOWN') target=footer[0]||active;
        } else if (footer.includes(active)) {
            const index=footer.indexOf(active);
            if (direction==='LEFT'||direction==='RIGHT') target=moveWithin(footer,active,direction==='RIGHT'?1:-1);
            else if (direction==='UP') target=pointer[pointer.length-1]||detail[detail.length-1]||rows[rows.length-1]||headActions[0]||activeTab;
        }
        // Every transition in the main editor is defined above. Falling back to
        // DOM order here turns UP/LEFT into "previous element" and DOWN/RIGHT
        // into "next element", crossing columns and sections at their edges.
        // At a boundary, staying put is the only predictable console behavior.
        focusItem(target||active);
    }
    function activate() {
        if (state.capture) return;
        const active=document.activeElement;
        if (active?.matches?.('[data-picker-search]')) {
            active._doorpiVkbReturnFocus = active;
            window._vkbOpen?.(active, { placement:'below' });
            return;
        }
        if (toggleRangeAdjustment(active)) return;
        active?.click?.();
    }
    function back() { if (state.adjustingRange) { finishRangeAdjustment(); return; } if (state.capture) { cancelCapture(); return; } if(state.popup){closePopup();return;} requestClose(); }
    function handleKey(event) { if(!state.overlay||window._vkbIsOpen)return; const dir={ArrowUp:'UP',ArrowDown:'DOWN',ArrowLeft:'LEFT',ArrowRight:'RIGHT'}[event.key]; if(dir){event.preventDefault();event.stopImmediatePropagation();navigate(dir);return;} if(event.key==='Enter'||event.key===' '){if(document.activeElement?.matches('input:not([type="range"]),select'))return;event.preventDefault();event.stopImmediatePropagation();activate();return;} if(event.key==='Escape'||event.key==='Backspace'){if(document.activeElement?.matches('input:not([type="range"])'))return;event.preventDefault();event.stopImmediatePropagation();back();} }

    function contextTarget(card) {
        if(!card || card.dataset.channel==='games' || card.closest('#gamesGrid'))return null; const store=!!card.closest('#storesGrid')||card.dataset.channel==='stores'; if(store){const id=card.dataset.appId||card.dataset.id||card.dataset.appUrl||'';const name=card.querySelector('.title,.nav-vertical-card-title')?.textContent?.trim()||id;return id?{kind:'store',id,name}:null;}
        const media=card.hasAttribute('data-app-id')||!!card.closest('#mediaGrid')||card.dataset.channel==='media'; if(!media)return null; const id=card.dataset.appId||card.dataset.appUrl||'';const name=card.querySelector('.title,.nav-vertical-card-title')?.textContent?.trim()||id;return id?{kind:'media',id,name}:null;
    }
    function enhanceContextMenu(){const menu=document.querySelector('.context-menu');if(!menu||menu.querySelector('#ctxControls'))return;const button=document.createElement('button');button.className='ctx-item';button.id='ctxControls';button.innerHTML='<span class="ctx-icon cc-controller-context-icon">'+controllerSvg()+'</span><span>'+tx('title')+'</span>';menu.insertBefore(button,menu.querySelector('#ctxEdit')||null);button.addEventListener('click',()=>{const target=contextTarget(document.querySelector('.card.ctx-active,.nav-vertical-card.ctx-active'));window._ctxMenuClose?.({restoreFocus:false});if(target)open(target);});const update=()=>{const card=document.querySelector('.card.ctx-active,.nav-vertical-card.ctx-active');button.style.display=contextTarget(card)?'flex':'none';};new MutationObserver(update).observe(menu,{attributes:true,attributeFilter:['class','style']});update();}
    function enhanceQuickPanel(){document.querySelectorAll('.doorpi-quick-panel .dq-sidebar .dq-menu').forEach(menu=>{if(menu.querySelector('[data-section="controls"]')||!menu.querySelector('[data-section="settings"]'))return;const button=document.createElement('button');button.className='dq-menu-btn';button.dataset.section='controls';button.tabIndex=0;button.innerHTML='<span class="dq-menu-label"><span class="dq-menu-ico">'+controllerSvg('doorpi-controller-icon')+'</span><span>'+tx('title')+'</span></span>';menu.insertBefore(button,menu.querySelector('[data-section="settings"]'));button.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();window.DoorpiQuickPanel?.close?.();open();},true);});}

    window.DoorpiControls={open,close,back,navigate,activate,switchTab,controllerIcon:controllerSvg,isOpen:()=>!!state.overlay,isCapturing:()=>!!state.capture||state.captureSuppressed};
    window.chrome?.webview?.addEventListener('message',receive); window.addEventListener('keydown',handleKey,true); window.addEventListener('doorpi:layout-scale-changed',syncOverlayViewport);
    installStyles();
    const observer=new MutationObserver(()=>{enhanceContextMenu();enhanceQuickPanel();});observer.observe(document.documentElement,{childList:true,subtree:true});enhanceContextMenu();enhanceQuickPanel();
})();
