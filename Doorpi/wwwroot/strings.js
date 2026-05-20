// =============================================================================
// strings.js — i18n
// =============================================================================
const STRINGS = {
    'pt-BR': {
        // ---- Adições de media.js ----
        sysMediaFolders: 'Pastas',
        sysMediaDownloadingCovers: 'Baixando capas dos jogos...',
        sharedFromOther: 'Compartilhado',
        sharedAccount: 'Conta compartilhada',
        appNamePrimeVideo: 'Prime Vídeo',

        // ---- Adições de app.js e Extensões ----
        noOptionsAvailable: 'Nenhuma opção disponível',
        badgeCurrent: 'Atual',
        extManagerTitle: 'Gerenciador de Extensões',
        extManagerSubtitle: 'Adicione ou gerencie recursos adicionais do sistema.',
        extManagerInputPlaceholder: 'Cole o link da extensão aqui...',
        btnPaste: 'Colar',
        btnStore: 'Loja',
        btnInstall: 'Instalar',
        btnUpdate: 'Atualizar',
        btnRemove: 'Remover',
        loadingExtensions: 'Carregando extensões...',
        extInstalledCount: (n) => `${n} extensão(ões) instalada(s)`,
        extNoneInstalled: 'Nenhuma extensão instalada.',
        extInstalled: 'Instalada',
        extPasteLinkError: 'Insira um link válido.',
        extInstallingStatus: 'Baixando e instalando...',
        extDownloadingUpdate: 'Baixando atualização...',
        extUpdatingBtn: 'Atualizando...',
        manageExtensions: 'Gerenciar Extensões',
        extUnknown: 'Extensão desconhecida',
        extInstallSuccess: 'Extensão instalada. Reabra o aplicativo web para carregar.',
        extStoreAddBtn: 'Adicionar extensão ao Doorpi',
        extStoreAddSub: 'Instalar via Doorpi Browser',
        extAlreadyInstalledBtn: 'Já instalada no Doorpi',
        extAlreadyInstalledSub: 'Em uso no seu navegador',

        // ---- Compartilhamento ----
        shareModePrivate: 'Separado por usuário',
        shareModeAll: 'Compartilhar com todos',
        shareModeUser: 'Compartilhar com usuários',
        shareChooseUser: 'Escolha o usuário',
        defaultUser: 'Usuário',
        accountSharingLabel: 'Compartilhamento de conta',
        sharedByInfo: (name) => `Compartilhado por ${name}.`,
        defaultOtherUser: 'outro usuário',
        systemAppLabel: 'APP DO SISTEMA',
        btnAddWebApp: 'Adicionar App Web',

        // ---- Textos Novos (Perfil e Settings) ----
        navEditProfileBtn: 'Editar Perfil',
        navStatGames: 'Jogos na Biblioteca',
        navStatTrophies: 'Troféus Conquistados',
        navStatTime: 'Horas Jogadas',
        navStatMostPlayed: 'Mais Jogado',
        navRecentGames: 'Jogados Recentemente',
        navNoRecentGames: 'Nenhum jogo recente',
        today: 'hoje',
        yesterday: 'ontem',
        navSetAccount: 'Conta e Perfil',
        navSetAccountDesc: 'Editar avatar, nome, API Key e usuários',
        navSetSystem: 'Sistema e Inicialização',
        navSetSystemDesc: 'Ajustes de inicialização do console e acesso à área de trabalho',
        sysActionDesktopTitle: 'Acessar Área de Trabalho',
        sysBootBehavior: 'Comportamento de Inicialização',
        sysBootNoneTitle: 'Não Iniciar Automaticamente',
        sysBootNoneDesc: 'O aplicativo deve ser aberto manualmente pelo usuário.',
        sysBootRunTitle: 'Iniciar com Windows (Padrão)',
        sysBootRunDesc: 'Inicia junto com o sistema operacional, mantendo a Área de Trabalho acessível ao fundo.',
        sysBootShellTitle: 'Modo Console (Imersivo)',
        sysBootShellDesc: 'Inicializa diretamente na interface do Doorpi, ocultando elementos padrão do Windows.',
        sysBootNoticeText: 'Para o acesso direto à interface principal, você pode desativar a opção "Exigir o Windows Hello" e remover a senha de acesso nas configurações do sistema.',
        sysSuggestion: 'Sugestão',
        sysBootNoticeBtn: 'Opções de Entrada',
        sysActionsHeader: 'Ações do Sistema',
        sysActionDesktopDesc: 'Acesse a interface padrão do Windows para gerenciamento do sistema. O controle assume a função de mouse e teclado com uma disposição de botões específica para este modo.',

        navSetExt: 'Extensões',
        navSetExtDesc: 'Gerenciar plugins do navegador',
        navChangeUser: 'Trocar Usuário',
        navSetSharing: 'Contas dos apps',
        navSetSharingDesc: 'Configurações de compartilhamento entre contas',
        navAccountProfileData: 'Dados do perfil',
        navAccountProfileDataDesc: 'Alterar avatar, nome e API Key',
        shareStatusAll: 'Este app esta publico para todos os usuarios atuais e futuros.',
        navSharingSaved: 'Compartilhamento salvo.',
        navAvatarChange: 'Alterar Avatar',

        // ---- Existentes ----
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

        ctxEditName: 'Editar',
        ctxRemoveGame: 'Remover da Biblioteca',
        // ---- Edição de App/Jogo ----

        editGameTitle: 'Editar Jogo',
        editAppTitle: 'Editar App',
        editGameSubtitle: 'Ajuste os detalhes deste jogo.',
        editAppSubtitle: 'Ajuste os detalhes deste aplicativo.',
        editShortcutsLabel: 'Atalhos do Sistema',
        manageExtensionsDesc: 'Gerenciar plugins nativos',

        editModalTitle: 'Editar Jogo', // 
        editModalSubtitle: 'Clique em um campo para editar',
        editModalFieldName: 'NOME NA BIBLIOTECA',
        editModalHint: '⌨ Clique para abrir o teclado',
        editModalCancel: 'Cancelar',
        editModalSave: 'Salvar',

        // ---- Teclado Virtual ----
        vkbPreviewLabel: 'Editando',
        vkbSpace: 'Espaço',
        vkbCancel: 'Cancelar',
        vkbOk: 'OK',
        vkbBackspace: 'Apagar',
        vkbEnter: 'Enter',
        vkbClose: 'Fechar',
        vkbShift: 'Maiúsc',
        vkbSym: '&123',
        vkbAbc: 'ABC',

        filterLabels: { all: 'Todos', Steam: 'Steam', Epic: 'Epic', GOG: 'GOG', Riot: 'Riot Games', Windows: 'Windows & Pastas' },
        platformLabels: { Steam: 'Steam', Epic: 'Epic', GOG: 'GOG', Riot: 'Riot Games', Folder: 'Pasta', Windows: 'Windows' },
        scanLibLabels: { Steam: 'Steam', Epic: 'Epic', GOG: 'GOG', Riot: 'Riot Games', Windows: 'Windows', Folder: 'Pastas' },

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
        setupOptional: 'Opcional',
        setupNameLabel: 'Nome do perfil',
        setupSectionBrowser: 'Navegador para aplicativos',
        setupBrowserDesc: 'Escolha o navegador que será usado para abrir aplicativos de streaming como Netflix, Twitch e Disney+. O Doorpi abre esses serviços em modo tela cheia, sem barras ou abas visíveis.',
        setupBrowserScanning: 'Detectando navegadores instalados...',
        setupBrowserNone: 'Nenhum navegador compatível encontrado.',

        tabGames: 'Jogos',
        tabMedia: 'Mídia',
        tabsHint: 'alternar abas',
        btnAddAppLabel: 'Adicionar App',
        preparingSystem: 'Preparando o Doorpi',
        preparingSystemSub: 'Baixando artes dos aplicativos...',
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

        whoIsPlaying: 'Quem está jogando?',
        welcomeBack: 'Bem-vindo de volta',
        newUser: 'Novo usuário',
        addUsuario: 'Adicionar Usuário',
        dlgPhotoTitle: 'Selecionar foto de perfil',
        dlgPhotoFilter: 'Imagens (*.png;*.jpg;*.jpeg;*.webp;*.gif)|*.png;*.jpg;*.jpeg;*.webp;*.gif',
        toastCopied: 'Copiado!',
        toastReturning: 'Retornando...',
        toastExtSent: 'Extensão enviada ao Doorpi!',
        toastDoorpi: 'Doorpi',

        gamepadControlLabel: 'Controle via gamepad',
        disableGamepadControlLabel: 'Desabilitar mouse e teclado via controle',
        disableGamepadControlHint: 'Útil para apps que já usam o controle nativamente (emuladores, jogos, etc.)',

        hintOptions: 'Opções',
        hintConfirm: 'Confirmar',
        hintBack: 'Voltar',
        hintAdd: 'Adicionar',
        hintStartBtn: 'START',

        powerExit: 'Sair',
        powerSuspend: 'Suspender',
        powerRestart: 'Reiniciar',
        powerShutdown: 'Desligar',

        // ---- Textos Dinâmicos do Painel de Conta / Compartilhamento ----
        shareStatusUser: (names) => `Compartilhado com ${names}.`,
        shareStatusUserEmpty: 'Escolha um ou mais usuários.',
        shareStatusPrivate: 'Este app usa uma conta separada para cada usuário.',
        btnViewKey: 'Ver Chave',
        btnDeleteProfile: 'Excluir Perfil',
        btnDeleteProfileConfirm: 'Tem certeza? Pressione novamente para excluir',
        toastChangesSaved: '✓ Alterações Salvas',
        titleRemoveUser: 'Remover Usuário',
        titleAddUser: 'Adicionar Usuário',
        titleRemoveFolder: 'Remover Pasta',
        defaultUserName: (n) => `Usuário ${n}`,
        playedOn: (date) => `Jogado em ${date}`,
        setupBtnCancel: 'Cancelar',

        navSetAutoStart: 'Iniciar com o Windows',
        navSetAutoStartLoading: 'Verificando...',
        autoStartOn: 'Ativo — o app inicia automaticamente com o Windows',
        autoStartOff: 'Desativado — não inicia automaticamente',

        sysTaskbarNoticeText: 'Para uma experiência visual contínua, configure a Barra de Tarefas do Windows para "Ocultar automaticamente".',
        sysTaskbarNoticeBtn: 'Barra de Tarefas',

        // ---- Popup Aviso Modo Desktop ----
        dwTitle: 'Modo Área de Trabalho',
        dwSubtitle: 'Seu controle assumirá temporariamente a função de mouse e teclado. Conheça os comandos:',
        dwBtnMouse: 'Mover Mouse',
        dwBtnScroll: 'Rolar a Tela (Scroll)',
        dwBtnLClick: 'Clique Esquerdo / Teclado Virtual (Em campos de texto)',
        dwBtnRClick: 'Clique Direito',
        dwBtnVkb: 'Teclado Virtual (Avulso)',
        dwBtnBack: 'Voltar',
        dwBtnExit: 'Sair e retornar ao Doorpi',
        dwSettingsExit: 'Feche a janela de configuração ao finalizar para retornar ao Doorpi', 
        dwBtnConfirm: 'Entendi e Continuar',
        dwBtnCancel: 'Cancelar',
        dwDontShowAgain: 'Não mostrar novamente',
    },

    'en-US': {
        // ---- Popup Aviso Modo Desktop ----
        dwTitle: 'Desktop Mode',
        dwSubtitle: 'Your controller will temporarily act as a mouse and keyboard. Learn the controls:',
        dwBtnMouse: 'Move Mouse',
        dwBtnScroll: 'Scroll Page',
        dwBtnLClick: 'Left Click / Virtual Keyboard (In text fields)',
        dwBtnRClick: 'Right Click',
        dwBtnVkb: 'Virtual Keyboard (Standalone)',
        dwBtnBack: 'Back',
        dwBtnExit: 'Exit to Doorpi',
        dwSettingsExit: 'Close the settings window when finished to return to Doorpi', 
        dwBtnConfirm: 'Got it, Continue',
        dwBtnCancel: 'Cancel',
        dwDontShowAgain: 'Do not show again',

        sysTaskbarNoticeText: 'For a cleaner visual experience, set the Windows Taskbar to "Automatically hide".',
        sysTaskbarNoticeBtn: 'Taskbar Settings',

        powerExit: 'Exit',
        powerSuspend: 'Sleep',
        powerRestart: 'Restart',
        powerShutdown: 'Shut down',

        navSetAutoStart: 'Launch with Windows',
        navSetAutoStartLoading: 'Checking...',
        autoStartOn: 'Active — the app starts automatically with Windows',
        autoStartOff: 'Disabled — does not start automatically',
        // ---- Textos Dinâmicos do Painel de Conta / Compartilhamento ----
        shareStatusUser: (names) => `Shared with ${names}.`,
        shareStatusUserEmpty: 'Choose one or more users.',
        shareStatusPrivate: 'This app uses a separate account for each user.',
        btnViewKey: 'View Key',
        btnDeleteProfile: 'Delete Profile',
        btnDeleteProfileConfirm: 'Are you sure? Press again to delete',
        toastChangesSaved: '✓ Changes Saved',
        titleRemoveUser: 'Remove User',
        titleAddUser: 'Add User',
        titleRemoveFolder: 'Remove Folder',
        defaultUserName: (n) => `User ${n}`,
        playedOn: (date) => `Played on ${date}`,
        setupBtnCancel: 'Cancel',

        hintOptions: 'Options',
        hintConfirm: 'Confirm',
        hintBack: 'Back',
        hintAdd: 'Add',
        hintStartBtn: 'START',

        gamepadControlLabel: 'Gamepad control',
        disableGamepadControlLabel: 'Disable mouse and keyboard via controller',
        disableGamepadControlHint: 'Useful for apps that natively use the controller (emulators, games, etc.)',
        // ---- Adições de media.js ----
        sysMediaFolders: 'Folders',
        sysMediaDownloadingCovers: 'Downloading game covers...',
        sharedFromOther: 'Shared',
        sharedAccount: 'Shared Account',
        appNamePrimeVideo: 'Prime Video',

        // ---- Adições de app.js e Extensões ----
        noOptionsAvailable: 'No options available',
        badgeCurrent: 'Current',
        extManagerTitle: 'Extension Manager',
        extManagerSubtitle: 'Add or manage additional system features.',
        extManagerInputPlaceholder: 'Paste the extension link here...',
        btnPaste: 'Paste',
        btnStore: 'Store',
        btnInstall: 'Install',
        btnUpdate: 'Update',
        btnRemove: 'Remove',
        loadingExtensions: 'Loading extensions...',
        extInstalledCount: (n) => `${n} extension(s) installed`,
        extNoneInstalled: 'No extensions installed.',
        extInstalled: 'Installed',
        extPasteLinkError: 'Insert a valid link.',
        extInstallingStatus: 'Downloading and installing...',
        extDownloadingUpdate: 'Downloading update...',
        extUpdatingBtn: 'Updating...',
        manageExtensions: 'Manage Extensions',
        extUnknown: 'Unknown extension',
        extInstallSuccess: 'Extension installed. Reopen the web app to load.',
        extStoreAddBtn: 'Add extension to Doorpi',
        extStoreAddSub: 'Install via Doorpi Browser',
        extAlreadyInstalledBtn: 'Already installed in Doorpi',
        extAlreadyInstalledSub: 'In use in your browser',

        // ---- Compartilhamento ----
        shareModePrivate: 'Separated by user',
        shareModeAll: 'Share with everyone',
        shareModeUser: 'Share with specific users',
        shareChooseUser: 'Choose the user',
        defaultUser: 'User',
        accountSharingLabel: 'Account sharing',
        sharedByInfo: (name) => `Shared by ${name}.`,
        defaultOtherUser: 'another user',
        systemAppLabel: 'SYSTEM APP',
        btnAddWebApp: 'Add Web App',

        // ---- Textos Novos (Perfil e Settings) ----
        navEditProfileBtn: 'Edit Profile',
        navStatGames: 'Games in Library',
        navStatTrophies: 'Trophies Earned',
        navStatTime: 'Hours Played',
        navStatMostPlayed: 'Most Played',
        navRecentGames: 'Recently Played',
        navNoRecentGames: 'No recent games',
        today: 'today',
        yesterday: 'yesterday',
        navSetAccount: 'Account & Profile',
        navSetAccountDesc: 'Edit avatar, name, API Key and users',
        navSetSystem: 'System & Startup',
        navSetSystemDesc: 'Manage console startup and desktop access',
        sysActionDesktopTitle: 'Access Desktop',
        sysBootBehavior: 'Startup Behavior',
        sysBootNoneTitle: 'Do Not Start Automatically',
        sysBootNoneDesc: 'The application must be launched manually by the user.',
        sysBootRunTitle: 'Start with Windows (Default)',
        sysBootRunDesc: 'Starts alongside the operating system, keeping the Desktop accessible in the background.',
        sysBootShellTitle: 'Console Mode (Immersive)',
        sysBootShellDesc: 'Launches directly into the Doorpi interface while hiding standard Windows elements.',
        sysSuggestion: 'Suggestion',
        sysBootNoticeText: 'For direct access to the main interface, you may disable the "Require Windows Hello" option and remove the account password in system settings.',
        sysBootNoticeBtn: 'Sign-in Options',
        sysActionsHeader: 'System Actions',
        sysActionDesktopDesc: 'Minimizes the app temporarily so you can install programs, update the system, or manage important files. Your controller will act as a mouse and keyboard in this mode.',

        navSetExt: 'Extensions',
        navSetExtDesc: 'Manage browser plugins',
        navChangeUser: 'Switch User',
        navSetSharing: 'App accounts',
        navSetSharingDesc: 'Set separate, shared, or public cache',
        navAccountProfileData: 'Profile data',
        navAccountProfileDataDesc: 'Change avatar, name, and API key',
        shareStatusAll: 'This app is public for all current and future users.',
        navSharingSaved: 'Sharing saved.',
        navAvatarChange: 'Change Avatar',

        // ---- Existentes ----
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

        tabGames: 'Games',
        tabMedia: 'Media',
        tabsHint: 'switch tabs',
        btnAddAppLabel: 'Add App',
        preparingSystem: 'Setting up Doorpi',
        preparingSystemSub: 'Downloading app artwork...',

        setupSectionBrowser: 'Apps browser',
        setupBrowserDesc: 'Choose the browser used to open streaming apps like Netflix, Twitch and Disney+. Doorpi launches these services in fullscreen mode, with no visible bars or tabs.',
        setupBrowserScanning: 'Detecting installed browsers...',
        setupBrowserNone: 'No compatible browser found.',

        setupHeaderSubtitle: 'Initial setup',
        setupIdentityDesc: 'Set the profile name and image shown on the home screen.',
        setupApiDesc: 'Used to download covers, logos, and artwork from SteamGrid. Without the key, images will not be displayed.',
        setupFoldersDesc: 'Steam, Epic, GOG and Windows installations are detected automatically. IMPORTANT: Add folders only for local, portable, or external device games.',
        setupSectionIdentity: 'Identity',
        setupSectionApiKey: 'SteamGrid API Key',
        setupSectionFolders: 'Local game folders',
        setupOptional: 'Optional',
        setupNameLabel: 'Profile name',
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

        ctxEditName: 'Edit',
        ctxRemoveGame: 'Remove from Library',

        // ---- Edição de App/Jogo ----
        editGameTitle: 'Edit Game',
        editAppTitle: 'Edit App',
        editGameSubtitle: 'Adjust the details of this game.',
        editAppSubtitle: 'Adjust the details of this application.',
        editShortcutsLabel: 'System Shortcuts',
        manageExtensionsDesc: 'Manage native plugins',

        editModalTitle: 'Edit Game',
        editModalSubtitle: 'Click a field to edit',
        editModalFieldName: 'Name',
        editModalHint: '⌨ Click to open the keyboard',
        editModalCancel: 'Cancel',
        editModalSave: 'Save',

        // ---- Teclado Virtual ----
        vkbPreviewLabel: 'Editing',
        vkbSpace: 'Space',
        vkbCancel: 'Cancel',
        vkbOk: 'OK',
        vkbBackspace: 'Backspace',
        vkbEnter: 'Enter',
        vkbClose: 'Close',
        vkbShift: 'Shift',
        vkbSym: '&123',
        vkbAbc: 'ABC',

        filterLabels: { all: 'All', Steam: 'Steam', Epic: 'Epic', GOG: 'GOG', Riot: 'Riot Games', Windows: 'Windows & Folders' },
        platformLabels: { Steam: 'Steam', Epic: 'Epic', GOG: 'GOG', Riot: 'Riot Games', Folder: 'Folder', Windows: 'Windows' },
        scanLibLabels: { Steam: 'Steam', Epic: 'Epic', GOG: 'GOG', Riot: 'Riot Games', Windows: 'Windows', Folder: 'Folders' },

        whoIsPlaying: 'Who is playing?',
        welcomeBack: 'Welcome back',
        newUser: 'New user',
        addUsuario: 'Add User',
        dlgPhotoTitle: 'Select profile photo',
        dlgPhotoFilter: 'Images (*.png;*.jpg;*.jpeg;*.webp;*.gif)|*.png;*.jpg;*.jpeg;*.webp;*.gif',
        toastCopied: 'Copied!',
        toastReturning: 'Returning...',
        toastExtSent: 'Extension sent to Doorpi!',
        toastDoorpi: 'Doorpi',
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

const DEFAULT_LANG = detectSystemLanguage() ;
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


    if (window.chrome && window.chrome.webview) {

        window.chrome.webview.postMessage(JSON.stringify({
            action: "updateVkbTranslations",
            vkbBackspace: t('vkbBackspace'),
            vkbEnter: t('vkbEnter'),
            vkbClose: t('vkbClose'),
            vkbShift: t('vkbShift'),
            vkbSpace: t('vkbSpace'),
            vkbSym: t('vkbSym'),
            vkbAbc: t('vkbAbc')
        }));
    }
}

if (document.readyState !== 'loading') applyI18n();
else document.addEventListener('DOMContentLoaded', applyI18n);
