// =============================================================================
// strings.js — i18n
// Todos os textos visíveis ao usuário ficam aqui.
//
// Uso:
//   t('detectingLibrary')         → 'Detectando Biblioteca'
//   t('selectedMany', 5)          → '5 jogos selecionados'
//   t('filterLabels.all')         → 'Todos'
//   t('platformLabels.Steam')     → 'Steam'
//
// Para adicionar um idioma: copie o bloco 'pt-BR' com a nova chave e traduza.
// Para trocar o idioma ativo: setLang('en-US')
//
// ── Regra para botões com ícones de controle ──────────────────────────────────
// Botões que recebem data-gamepad-hint (e portanto ganham um <span class="gp-hint">
// injetado por navigation.js) devem ter o texto num <span data-i18n> INTERNO.
// Nunca coloque data-i18n no próprio <button>: applyI18n usa textContent e
// destruiria o ícone injetado.
// =============================================================================
const STRINGS = {
    'pt-BR': {
        // ── Modal — loading ───────────────────────────────────────────────────
        detectingLibrary: 'Detectando Biblioteca',
        readingApps: 'Lendo aplicativos instalados',
        waitingFolder: 'Aguardando seleção de pasta...',
        downloadingCovers: 'Baixando capas e adicionando... (Aguarde)',

        // ── Modal — seleção de apps ───────────────────────────────────────────
        selectApps: 'Selecione os aplicativos para adicionar',
        showingStore: (name) => `Mostrando jogos da loja: ${name}`,
        noAppsFound: 'Nenhum aplicativo encontrado',
        noAppsHint: 'Tente escanear uma pasta ou adicionar manualmente',
        selectedOne: '1 jogo selecionado',
        selectedMany: (n) => `${n} jogos selecionados`,

        // ── Sidebar do modal ──────────────────────────────────────────────────
        sidebarEyebrow: 'Menu',
        sidebarTitle: 'Configurações',
        tabApps: 'Aplicativos',
        tabFolders: 'Gerenciar Pastas',

        // ── View: Pastas ──────────────────────────────────────────────────────
        foldersTitle: 'Pastas Monitoradas',
        foldersSubtitle: 'O sistema buscará jogos automaticamente nestes diretórios.',

        // ── Botões — tela principal ───────────────────────────────────────────
        btnAddLabel: 'Adicionar Jogo',

        // ── Botões — modal view-apps ──────────────────────────────────────────
        // Estes textos ficam em <span data-i18n> DENTRO do <button data-gamepad-hint>.
        // O ícone do controle é injetado por navigation.js como irmão anterior ao span.
        btnConfirmLabel: 'Adicionar Selecionados',
        btnSearchLabel: 'Procurar Manualmente',
        btnCancelLabel: 'Voltar',

        // ── Botões — modal view-folders ───────────────────────────────────────
        btnAddFolderLabel: 'Adicionar Nova Pasta',
        btnBackLabel: 'Voltar',

        // ── Unidades de tamanho ───────────────────────────────────────────────
        unitGB: (v) => `${v} GB`,
        unitMB: (v) => `${v} MB`,

        // ── Filtros ───────────────────────────────────────────────────────────
        filterLabels: {
            all: 'Todos',
            Steam: 'Steam',
            Epic: 'Epic',
            GOG: 'GOG',
            Windows: 'Windows & Pastas',
        },

        // ── Badges de plataforma ──────────────────────────────────────────────
        platformLabels: {
            Steam: 'Steam',
            Epic: 'Epic',
            GOG: 'GOG',
            Folder: 'Pasta',
            Windows: 'Windows',
        },

        // ── Labels de scan no loading ─────────────────────────────────────────
        scanLibLabels: {
            Steam: 'Steam',
            Epic: 'Epic',
            GOG: 'GOG',
            Windows: 'Windows',
            Folder: 'Pastas',
        },
    },

    'en-US': {
        // ── Modal — loading ───────────────────────────────────────────────────
        detectingLibrary: 'Detecting Library',
        readingApps: 'Reading installed applications',
        waitingFolder: 'Waiting for folder selection...',
        downloadingCovers: 'Downloading covers and adding... (Please wait)',

        // ── Modal — seleção de apps ───────────────────────────────────────────
        selectApps: 'Select applications to add',
        showingStore: (name) => `Showing games from: ${name}`,
        noAppsFound: 'No applications found',
        noAppsHint: 'Try scanning a folder or adding manually',
        selectedOne: '1 game selected',
        selectedMany: (n) => `${n} games selected`,

        // ── Sidebar do modal ──────────────────────────────────────────────────
        sidebarEyebrow: 'Menu',
        sidebarTitle: 'Settings',
        tabApps: 'Applications',
        tabFolders: 'Manage Folders',

        // ── View: Pastas ──────────────────────────────────────────────────────
        foldersTitle: 'Monitored Folders',
        foldersSubtitle: 'The system will automatically search for games in these directories.',

        // ── Botões — tela principal ───────────────────────────────────────────
        btnAddLabel: 'Add Game',

        // ── Botões — modal view-apps ──────────────────────────────────────────
        btnConfirmLabel: 'Add Selected',
        btnSearchLabel: 'Browse Manually',
        btnCancelLabel: 'Back',

        // ── Botões — modal view-folders ───────────────────────────────────────
        btnAddFolderLabel: 'Add New Folder',
        btnBackLabel: 'Back',

        // ── Unidades de tamanho ───────────────────────────────────────────────
        unitGB: (v) => `${v} GB`,
        unitMB: (v) => `${v} MB`,

        // ── Filtros ───────────────────────────────────────────────────────────
        filterLabels: {
            all: 'All',
            Steam: 'Steam',
            Epic: 'Epic',
            GOG: 'GOG',
            Windows: 'Windows & Folders',
        },

        // ── Badges de plataforma ──────────────────────────────────────────────
        platformLabels: {
            Steam: 'Steam',
            Epic: 'Epic',
            GOG: 'GOG',
            Folder: 'Folder',
            Windows: 'Windows',
        },

        // ── Labels de scan no loading ─────────────────────────────────────────
        scanLibLabels: {
            Steam: 'Steam',
            Epic: 'Epic',
            GOG: 'GOG',
            Windows: 'Windows',
            Folder: 'Folders',
        },
    },
};

const DEFAULT_LANG = 'en-US';
let currentLang = DEFAULT_LANG;

function t(key, ...args) {
    const locale = STRINGS[currentLang] ?? STRINGS[DEFAULT_LANG];
    const fallback = STRINGS[DEFAULT_LANG];
    const resolve = (obj, keys) => keys.reduce((v, k) => v?.[k], obj);
    const parts = key.split('.');
    const val = resolve(locale, parts) ?? resolve(fallback, parts);
    if (typeof val === 'function') return val(...args);
    return val ?? key;
}

function setLang(lang) {
    if (STRINGS[lang]) { currentLang = lang; applyI18n(); }
    else console.warn(`[strings] Idioma '${lang}' não encontrado. Disponíveis: ${Object.keys(STRINGS).join(', ')}`);
}

// ── i18n automático via data-i18n ─────────────────────────────────────────────
// Coloque data-i18n="chave" em elementos FOLHA (sem filhos que precisem sobreviver).
//
// Em botões que recebem ícones de controle (data-gamepad-hint), aplique data-i18n
// no <span> INTERNO, não no <button> — para que o ícone injetado por navigation.js
// não seja destruído ao trocar o idioma.
//
// Exemplo correto:
//   <button data-gamepad-hint="start">
//       <span data-i18n="btnConfirmLabel">Adicionar Selecionados</span>
//   </button>
function applyI18n() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        el.textContent = t(el.dataset.i18n);
    });
}

// Aplica ao carregar (scripts ficam no final do body, DOM já está pronto)
if (document.readyState !== 'loading') applyI18n();
else document.addEventListener('DOMContentLoaded', applyI18n);