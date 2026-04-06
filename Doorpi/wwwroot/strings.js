// =============================================================================
// strings.js — i18n
// =============================================================================
const STRINGS = {
    'pt-BR': {
        detectingLibrary: 'Detectando Biblioteca',
        readingApps: 'Lendo aplicativos instalados',
        analysing: 'Analisando...',
        waitingFolder: 'Aguardando Pasta...',
        waitingWindows: 'Aguardando nova Pasta',
        updatingLibrary: 'Atualizando Biblioteca',
        downloadingCovers: 'Baixando capas e adicionando...',

        dlgBrowseTitle: 'Selecione o executável do jogo',
        dlgBrowseFilter: 'Executáveis (*.exe)|*.exe',
        dlgFolderTitle: 'Selecione a pasta da biblioteca de jogos',
        dlgEditFolderTitle: 'Selecione a nova pasta para substituir',
        msgFolderForbidden: 'Esta pasta ou unidade é protegida pelo sistema e não pode ser adicionada.\n\nTente selecionar uma pasta específica onde seus jogos estão instalados (ex: C:\\Jogos).',
        msgFolderForbiddenTitle: 'Pasta Não Permitida',
        msgErrorOpenFile: 'Erro ao abrir arquivo: ',
        msgErrorOpenFolder: 'Erro ao abrir seletor: ',
        msgErrorEditFolder: 'Erro ao editar pasta: ',
        msgErrorLaunch: 'Erro ao iniciar jogo: ',

        loadingAddingGame: 'Adicionando jogo',
        loadingFetchingCovers: 'Buscando capas e informações...',
        loadingUpdatingLibrary: 'Atualizando biblioteca',
        loadingScanningDoNotClose: 'Procurando aplicativos. NÃO FECHE o aplicativo durante este processo!',
        loadingAnalyzingNewFolder: 'Analisando a nova pasta...',

        selectApps: 'Selecione os jogos para adicionar',
        showingStore: (name) => `Mostrando jogos da loja: ${name}`,
        noAppsFound: 'Nenhum aplicativo encontrado',
        noAppsHint: 'Tente escanear uma pasta ou adicionar manualmente',
        selectedOne: '1 jogo selecionado',
        selectedMany: (n) => `${n} jogos selecionados`,

        sidebarEyebrow: 'Menu',
        sidebarTitle: 'Configurações',
        tabApps: 'Aplicativos',
        tabFolders: 'Gerenciar Pastas',

        foldersTitle: 'Pastas Monitoradas',
        foldersSubtitle: 'O sistema varre estes diretórios sempre que você abre esta tela. Evite adicionar unidades inteiras (ex: C:\\).',
        foldersEmpty: 'Nenhuma pasta configurada',
        foldersEmptyHint: 'Clique em "Adicionar Nova Pasta" para começar',
        folderTotalLabel: 'Custo de tempo total da busca',

        btnEditLabel: 'Editar',
        btnDeleteLabel: 'Remover',

        btnAddLabel: 'Adicionar Jogo',

        statSubfolders: 'Subpastas',
        statExeFiles: 'Executáveis',
        statScanTime: 'Tempo por busca',
        folderWarningSlow: 'Esta pasta possui arquivos demais e vai deixar o menu de "Adicionar Jogos" lento. Tente especificar uma subpasta mais exata.',

        perfFast: 'Rápida',
        perfMedium: 'Moderada',
        perfSlow: 'Lenta',
        perfMs: (ms) => `${ms}ms`,
        perfSec: (s) => `${s}s`,

        btnConfirmLabel: 'Adicionar Selecionados',
        btnSearchLabel: 'Procurar Manualmente',
        btnCancelLabel: 'Voltar',

        btnAddFolderLabel: 'Adicionar Nova Pasta',
        btnBackLabel: 'Voltar',

        unitGB: (v) => `${v} GB`,
        unitMB: (v) => `${v} MB`,

        // Context Menu, Edit Modal e Teclado
        ctxEditName: 'Editar Nome',
        ctxRemoveGame: 'Remover da Biblioteca',

        editModalTitle: 'Editar Jogo',
        editModalSubtitle: 'Clique em um campo para editar',
        editModalFieldName: 'Nome',
        editModalHint: '⌨ Clique para abrir o teclado',
        editModalCancel: 'Cancelar',
        editModalSave: 'Salvar',

        vkbPreviewLabel: 'Editando',
        vkbSpace: 'ESPAÇO',
        vkbCancel: 'CANCELAR',
        vkbOk: 'OK',

        filterLabels: { all: 'Todos', Steam: 'Steam', Epic: 'Epic', GOG: 'GOG', Windows: 'Windows & Pastas' },
        platformLabels: { Steam: 'Steam', Epic: 'Epic', GOG: 'GOG', Folder: 'Pasta', Windows: 'Windows' },
        scanLibLabels: { Steam: 'Steam', Epic: 'Epic', GOG: 'GOG', Windows: 'Windows', Folder: 'Pastas' },


        // Setup
        setupEyebrow: 'Bem-vindo',
        setupStep1Title: 'Doorpi',
        setupStep1Subtitle: 'Seu nome será exibido no launcher.',
        setupStep1Placeholder: 'Seu nome...',
        setupStep1Next: 'Continuar',

        setupStep2Title: 'Foto de perfil',
        setupStep2Subtitle: 'Opcional. Você pode pular esta etapa.',
        setupStep2Choose: 'Escolher Foto',
        setupStep2Skip: 'Pular',
        setupStep2NoPhoto: 'Nenhuma foto selecionada',

        setupStep3Title: 'Chave da API SteamGrid',
        setupStep3Subtitle: 'Necessária para buscar capas e imagens dos seus jogos automaticamente.',
        setupStep3Placeholder: 'API...',
        setupStep3LinkText: 'Criar conta gratuita e obter chave →',
        setupStep3Next: 'Continuar',
        setupStep3Back: 'Voltar',

        setupStep4Title: 'Pastas de Jogos',
        setupStep4Subtitle: 'Steam, Epic, GOG e programas Windows são detectados automaticamente. Adicione pastas extras apenas para jogos locais.',
        setupStep4AddFolder: 'Adicionar Pasta',
        setupStep4Finish: 'Concluir',
        setupStep4Back: 'Voltar',
        setupStep4FoldersHint: 'Esta etapa é opcional — você pode adicionar pastas depois.',

        setupLoadingTitle: 'Preparando sua biblioteca',
        setupLoadingSubtitle: 'Isso pode levar alguns segundos na primeira vez.',
        setupStep3PasteMode: 'Colar Chave',
        setupStep3TypeMode: 'Digitar',
        setupStep3PasteHint: 'Pressione Ctrl+V ou clique em "Colar Chave"',
        setupStep3PasteSuccess: '✓ Chave colada',
        setupSectionIdentity: 'Identidade',
        setupSectionApiKey: 'SteamGrid API Key',
        setupSectionFolders: 'Pastas de jogos locais',
      
        setupHeaderSubtitle: 'Configuração inicial',
        setupIdentityDesc: 'Defina o nome do perfil e a imagem exibidos na tela inicial.',
        setupApiDesc: 'Usado para baixar capas, logos e artes via SteamGrid. \nSem a chave, imagens não serão exibidas.',
        setupFoldersDesc: 'Instalações da Steam, Epic, GOG e a maioria dos aplicativos Windows\nsão detectadas automaticamente.\nAdicione pastas somente para jogos locais, portáteis ou em dispositivos externos.',
        setupSectionIdentity: 'Perfil',
        setupSectionApiKey: 'SteamGrid API Key',
        setupSectionFolders: 'Pastas de jogos',
        setupOptional: 'Opcional',
        setupNameLabel: 'Nome do perfil',

        setupSectionBrowser: 'Navegador para aplicativos',
        setupBrowserDesc: 'Escolha o navegador que será usado para abrir aplicativos de streaming como Netflix, Twitch e Disney+. O Doorpi abre esses serviços em modo tela cheia, sem barras ou abas visíveis.',
        setupBrowserScanning: 'Detectando navegadores instalados...',
        setupBrowserNone: 'Nenhum navegador compatível encontrado.',

        // Home tabs
        tabGames: 'Jogos',
        tabMedia: 'Mídia',
        tabsHint: 'alternar abas',
        btnAddAppLabel: 'Adicionar App',
        // System loading pós-setup
        preparingSystem: 'Preparando o Doorpi',
        preparingSystemSub: 'Baixando artes dos aplicativos...',

        // Lançamento de app de mídia
        msgErrorLaunchMedia: 'Erro ao abrir aplicativo: ',
        // Lançamento de app de mídia
        msgErrorLaunchMedia: 'Erro ao abrir aplicativo: ',

        navGames: 'Jogos',
        navMedia: 'Multimídia',
        navSettings: 'Configurações',
        navProfile: 'Perfil',
        navBack: 'Início',
        navGamesSub: 'Toda a sua biblioteca de jogos',
        navMediaSub: 'Aplicativos e serviços de streaming',
        navSettingsSub: 'Configurações do sistema e do Doorpi OS',
        navProfileSub: 'Sua conta e preferências',
        navNoGames: 'Nenhum jogo na biblioteca',
        navNoMedia: 'Nenhum app configurado',
        navSettingsSoon: 'Em breve',
        navProfileHello: 'Bem-vindo de volta',
        navProfileNameLabel: 'Nome',
        navProfileApiLabel: 'API Key SteamGridDB',


        badgeNew: 'NOVO',      
        navHintMenu: 'Menu',


        webAppNameLabel: 'Nome do aplicativo',
        webAppUrlLabel: 'Link',
        subtabWeb: 'Aplicativos Web',
        subtabExe: 'Aplicativo do sistema',
        pasteAppLink: 'Colar Link',
        webAppErrorName: 'Insira o nome do aplicativo',
        webAppErrorUrl: 'Insira a URL do aplicativo web.',

        apiKeyCopied: 'Chave API copiada!',
        returningToSetup: 'Retornando ao Setup...', 

    },

    'en-US': {
        apiKeyCopied: 'API Key copied!',
        returningToSetup: 'Returning to Setup...',
        webAppNameLabel: 'App Name',
        webAppUrlLabel: 'Link',
        subtabWeb: 'Web App',
        subtabExe: 'System Apps',
        pasteAppLink: 'Paste URL',
        webAppErrorName: 'Invalid Name',
        webAppErrorUrl: 'Insert a valid URL.',


        badgeNew: 'NEW',
        navHintMenu: 'Menu',

        // Lançamento de app de mídia
        msgErrorLaunchMedia: 'Error launching app: ',

        navGames: 'Games',
        navMedia: 'Media',
        navSettings: 'Settings',
        navProfile: 'Profile',
        navBack: 'Home',
        navGamesSub: 'Your entire game library',
        navMediaSub: 'Applications and streaming services',
        navSettingsSub: 'System and Doorpi OS settings',
        navProfileSub: 'Your account and preferences',
        navNoGames: 'No games in library',
        navNoMedia: 'No apps configured',
        navSettingsSoon: 'Coming soon',
        navProfileHello: 'Welcome back',
        navProfileNameLabel: 'Name',
        navProfileApiLabel: 'SteamGridDB API Key',

        // Home tabs
        tabGames: 'Games',
        tabMedia: 'Media',
        tabsHint: 'switch tabs',
        btnAddAppLabel: 'Add App',
        // System loading pós-setup
        preparingSystem: 'Setting up Doorpi',
        preparingSystemSub: 'Downloading app artwork...',

        // Lançamento de app de mídia
        msgErrorLaunchMedia: 'Error launching app: ',
        // Setup

        setupSectionBrowser: 'Apps browser',
        setupBrowserDesc: 'Choose the browser used to open streaming apps like Netflix, Twitch and Disney+. Doorpi launches these services in fullscreen mode, with no visible bars or tabs.',
        setupBrowserScanning: 'Detecting installed browsers...',
        setupBrowserNone: 'No compatible browser found.',

        setupHeaderSubtitle: 'Initial setup',
        setupIdentityDesc: 'Set the profile name and image shown on the home screen.',
        setupApiDesc: 'Used to download covers, logos, and artwork from SteamGrid. Without the key, images will not be displayed.',
        setupFoldersDesc: 'Steam, Epic, GOG and Windows installations are detected automatically. IMPORTANT: Add folders only for local, portable, or external device games.',
        setupSectionIdentity: 'Profile',
        setupSectionApiKey: 'SteamGrid API Key',
        setupSectionFolders: 'Game folders',
        setupOptional: 'Optional',
        setupNameLabel: 'Profile name',
        setupSectionIdentity: 'Identity',
        setupSectionApiKey: 'SteamGrid API Key',
        setupSectionFolders: 'Local game folders',
        setupStep3PasteMode: 'API..',
        setupStep3TypeMode: 'Type',
        setupStep3PasteHint: 'Press Ctrl+V or click "Paste Key"',
        setupStep3PasteSuccess: '✓ Key pasted',
        setupEyebrow: 'Welcome',
        setupStep1Title: 'Doorpi',
        setupStep1Subtitle: 'Your name will be displayed in the launcher.',
        setupStep1Placeholder: 'Your name...',
        setupStep1Next: 'Continue',

        setupStep2Title: 'Profile photo',
        setupStep2Subtitle: 'Optional. You can skip this step.',
        setupStep2Choose: 'Choose Photo',
        setupStep2Skip: 'Skip',
        setupStep2NoPhoto: 'No photo selected',

        setupStep3Title: 'SteamGridDB API Key',
        setupStep3Subtitle: 'Required to automatically fetch covers and images for your games.',
        setupStep3Placeholder: 'Paste your key here...',
        setupStep3LinkText: 'Create a free account and get your key →',
        setupStep3Next: 'Continue',
        setupStep3Back: 'Back',

        setupStep4Title: 'Game Folders',
        setupStep4Subtitle: 'Games from Steam, Epic, GOG, and installed Windows programs are detected automatically. Add folders only if you have local or portable games that don\'t appear in those stores — the system will monitor the executables inside them.',
        setupStep4AddFolder: 'Add Folder',
        setupStep4Finish: 'Finish',
        setupStep4Back: 'Back',
        setupStep4FoldersHint: 'This step is optional — you can add folders later.',

        setupLoadingTitle: 'Preparing your library',
        setupLoadingSubtitle: 'This may take a few seconds the first time.',


        detectingLibrary: 'Detecting Library',
        readingApps: 'Reading installed applications',
        analysing: 'Analysing...',
        waitingFolder: 'Waiting for folder...',
        waitingWindows: 'Waiting for new folder',
        updatingLibrary: 'Updating Library',
        downloadingCovers: 'Downloading covers and adding...',

        // Native Dialogs & Loading
        dlgBrowseTitle: 'Select game executable',
        dlgBrowseFilter: 'Executables (*.exe)|*.exe',
        dlgFolderTitle: 'Select the game library folder',
        dlgEditFolderTitle: 'Select the new folder to replace',
        msgFolderForbidden: 'This folder or drive is protected by the system and cannot be added.\n\nTry selecting a specific folder where your games are installed (e.g., C:\\Games).',
        msgFolderForbiddenTitle: 'Folder Not Allowed',
        msgErrorOpenFile: 'Error opening file: ',
        msgErrorOpenFolder: 'Error opening picker: ',
        msgErrorEditFolder: 'Error editing folder: ',
        msgErrorLaunch: 'Error launching game: ',

        loadingAddingGame: 'Adding game',
        loadingFetchingCovers: 'Fetching covers and info...',
        loadingUpdatingLibrary: 'Updating library',
        loadingScanningDoNotClose: 'Looking for applications. DO NOT CLOSE the app during this process!',
        loadingAnalyzingNewFolder: 'Analyzing the new folder...',

        selectApps: 'Select games to add',
        showingStore: (name) => `Showing games from: ${name}`,
        noAppsFound: 'No applications found',
        noAppsHint: 'Try scanning a folder or adding manually',
        selectedOne: '1 game selected',
        selectedMany: (n) => `${n} games selected`,

        sidebarEyebrow: 'Menu',
        sidebarTitle: 'Settings',
        tabApps: 'Applications',
        tabFolders: 'Manage Folders',

        foldersTitle: 'Monitored Folders',
        foldersSubtitle: 'The system scans these directories every time you open this screen. Avoid adding entire drives (e.g., C:\\).',
        foldersEmpty: 'No folders configured',
        foldersEmptyHint: 'Click "Add New Folder" to get started',
        folderTotalLabel: 'Total estimated scan cost',

        btnEditLabel: 'Edit',
        btnDeleteLabel: 'Remove',

        btnAddLabel: 'Add Game',

        statSubfolders: 'Subfolders',
        statExeFiles: 'Executables',
        statScanTime: 'Time per scan',
        folderWarningSlow: 'This folder has too many files and will make the "Add Games" menu slow. Try specifying a more exact subfolder.',

        perfFast: 'Fast',
        perfMedium: 'Moderate',
        perfSlow: 'Slow',
        perfMs: (ms) => `${ms}ms`,
        perfSec: (s) => `${s}s`,

        btnConfirmLabel: 'Add Selected',
        btnSearchLabel: 'Browse Manually',
        btnCancelLabel: 'Back',

        btnAddFolderLabel: 'Add New Folder',
        btnBackLabel: 'Back',

        unitGB: (v) => `${v} GB`,
        unitMB: (v) => `${v} MB`,

        // Context Menu, Edit Modal and Keyboard
        ctxEditName: 'Edit Name',
        ctxRemoveGame: 'Remove from Library',

        editModalTitle: 'Edit Game',
        editModalSubtitle: 'Click a field to edit',
        editModalFieldName: 'Name',
        editModalHint: '⌨ Click to open the keyboard',
        editModalCancel: 'Cancel',
        editModalSave: 'Save',

        vkbPreviewLabel: 'Editing',
        vkbSpace: 'SPACE',
        vkbCancel: 'CANCEL',
        vkbOk: 'OK',

        filterLabels: { all: 'All', Steam: 'Steam', Epic: 'Epic', GOG: 'GOG', Windows: 'Windows & Folders' },
        platformLabels: { Steam: 'Steam', Epic: 'Epic', GOG: 'GOG', Folder: 'Folder', Windows: 'Windows' },
        scanLibLabels: { Steam: 'Steam', Epic: 'Epic', GOG: 'GOG', Windows: 'Windows', Folder: 'Folders' },

    },
};


const FALLBACK_LANG = 'en-US';


function detectSystemLanguage() {
    const navLang = navigator.language || FALLBACK_LANG;

  
    if (STRINGS[navLang]) return navLang;

   
    const baseLang = navLang.split('-')[0];
    const match = Object.keys(STRINGS).find(key => key.startsWith(baseLang));

    return match || FALLBACK_LANG;
}


const DEFAULT_LANG = detectSystemLanguage();
let currentLang = DEFAULT_LANG;

function t(key, ...args) {
    const locale = STRINGS[currentLang] ?? STRINGS[FALLBACK_LANG];
    const fallback = STRINGS[FALLBACK_LANG];
    const resolve = (obj, keys) => keys.reduce((v, k) => v?.[k], obj);
    const parts = key.split('.');
    const val = resolve(locale, parts) ?? resolve(fallback, parts);
    if (typeof val === 'function') return val(...args);
    return val ?? key;
}

function setLang(lang) {
    if (STRINGS[lang]) {
        currentLang = lang;
        applyI18n();
    } else {
        console.warn(`[strings] Idioma '${lang}' não encontrado. Mantendo ${currentLang}.`);
    }
}

function applyI18n() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        el.textContent = t(el.dataset.i18n);
    });
}

if (document.readyState !== 'loading') applyI18n();
else document.addEventListener('DOMContentLoaded', applyI18n);