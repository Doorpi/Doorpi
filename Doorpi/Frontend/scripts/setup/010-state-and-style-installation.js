// =============================================================================
// setup.js — Formulário de primeira configuração (TV-friendly, accordion)
// =============================================================================

let _setupUsers = [];
let _currUser = null;
let _isAddingUserMode = false;
let _setupLayoutConfirmed = false;
let _setupPendingLayoutScale = 1;
let _setupPhase = 'layout';
let _setupCloudProfileId = '';
let _setupFolderDialogPending = false;
let _setupSyncConnectFromRegistration = false;
let _setupSyncMessage = '';

// ── Estilos ───────────────────────────────────────────────────────────────────
(function injectSetupStyles() {
    const s = document.createElement('style');
    s.textContent = __doorpiCss("injected-styles/setup/implementation-1.css");
    document.head.appendChild(s);
})();

