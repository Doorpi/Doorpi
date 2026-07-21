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
    s.textContent = `
    #setupContainer {
        position: fixed; inset: 0; z-index: 9000; display: none;
        align-items: flex-start; justify-content: center;
        background: #0a0a20; backdrop-filter: blur(40px);
        overflow-y: auto; padding: clamp(36px, 5vh, 72px) clamp(24px, 5vw, 80px);
        box-sizing: border-box; scroll-behavior: auto; align-items: center;
    }
    #setupContainer.visible { animation: setupFadeIn 0.35s ease forwards; }

    #setupBg { position: fixed; inset: 0; width: 100%; height: 100%; z-index: 0; pointer-events: none; }

    .setup-auth-gate { position:relative; z-index:2; width:min(720px,94vw); display:none; flex-direction:column; align-items:center; gap:18px; text-align:center; }
    .setup-auth-gate.visible { display:flex; }
    .setup-auth-title { margin:0; color:#fff; font-size:clamp(2rem,3.4vw,4rem); font-weight:350; letter-spacing:0; }
    .setup-auth-copy { max-width:580px; margin:0 0 12px; color:rgba(255,255,255,.58); font-size:clamp(.95rem,1.05vw,1.2rem); line-height:1.55; }
    .setup-auth-actions { width:min(430px,88vw); display:grid; gap:12px; }
    .setup-auth-btn { min-height:58px; display:flex; align-items:center; justify-content:center; gap:12px; padding:0 26px; border:1px solid rgba(255,255,255,.18); border-radius:999px; background:rgba(255,255,255,.075); color:#fff; font:700 clamp(.94rem,1vw,1.08rem) inherit; cursor:pointer; outline:none; }
    .setup-auth-btn.google { background:rgba(255,255,255,.94); color:#111827; }
    .setup-auth-btn .profile-sync-google { width:22px; height:22px; flex:none; }
    .setup-auth-btn:focus { border-color:#7bbcff; box-shadow:0 0 0 5px rgba(78,157,255,.28); transform:scale(1.025); }
    .setup-auth-btn:disabled { cursor:default; opacity:.78; transform:none; }
    .setup-auth-status { min-height:24px; color:rgba(255,255,255,.58); }
    .setup-auth-status.error { color:#ffb0b0; }
    .setup-auth-loading { position:relative; z-index:2; width:min(620px,90vw); display:none; flex-direction:column; align-items:center; gap:16px; text-align:center; }
    .setup-auth-loading.visible { display:flex; }
    .setup-auth-spinner { width:46px; height:46px; border:3px solid rgba(255,255,255,.16); border-top-color:#8ac8ff; border-radius:50%; animation:setupAuthSpin .85s linear infinite; }
    .setup-auth-loading h2 { margin:4px 0 0; color:#fff; font-size:clamp(1.75rem,2.5vw,3rem); font-weight:400; }
    .setup-auth-loading p { min-height:1.6em; margin:0; color:rgba(255,255,255,.58); font-size:clamp(.92rem,1vw,1.12rem); }
    @keyframes setupAuthSpin { to { transform:rotate(360deg); } }
    .setup-back-auth { position:fixed; top:clamp(26px,4vh,60px); left:clamp(28px,4vw,72px); z-index:4; display:none; align-items:center; gap:9px; min-height:44px; padding:0 22px; border:1px solid rgba(255,255,255,.12); border-radius:999px; background:rgba(255,255,255,.05); color:rgba(255,255,255,.82); font:600 clamp(.9rem,1vw,1.05rem) inherit; cursor:pointer; outline:none; transition:background .18s ease,color .18s ease,border-color .18s ease,transform .18s ease; }
    .setup-back-auth.visible { display:flex; }
    .setup-back-auth:focus,.setup-back-auth:hover { background:#fff; border-color:#fff; color:#08101c; transform:scale(1.04); }
    .setup-back-auth-arrow { font-size:1.55em; font-weight:300; line-height:1; transform:translateY(-1px); }
    .setup-cloud-profile { display:none; width:100%; align-items:center; justify-content:space-between; gap:28px; padding:18px 4px 8px; box-sizing:border-box; }
    .setup-cloud-profile.visible { display:flex; }
    .setup-cloud-identity { min-width:0; display:flex; align-items:center; gap:20px; }
    .setup-cloud-avatar { width:78px; height:78px; flex:none; display:grid; place-items:center; overflow:hidden; border:2px solid rgba(136,190,255,.65); border-radius:50%; background:rgba(255,255,255,.08); color:#fff; font-size:1.8rem; font-weight:700; }
    .setup-cloud-avatar img { width:100%; height:100%; object-fit:cover; }
    .setup-cloud-profile-copy { min-width:0; display:flex; flex-direction:column; gap:5px; }
    .setup-cloud-profile-label { color:rgba(255,255,255,.5); font-size:.82rem; font-weight:700; text-transform:uppercase; }
    .setup-cloud-profile-name { overflow:hidden; color:#fff; font-size:clamp(1.45rem,2vw,2rem); font-weight:650; text-overflow:ellipsis; white-space:nowrap; }
    .setup-cloud-playtime { flex:none; display:flex; flex-direction:column; align-items:flex-end; gap:5px; text-align:right; }
    .setup-cloud-playtime-label { color:rgba(255,255,255,.5); font-size:.82rem; font-weight:700; text-transform:uppercase; }
    .setup-cloud-playtime-value { color:#fff; font-size:clamp(1.45rem,2vw,2rem); font-weight:650; white-space:nowrap; }

    .setup-form { position: relative; z-index: 1; width: min(760px, 96vw); display: flex; flex-direction: column; gap: clamp(8px, 1vw, 14px); margin: 0 auto; }
    @keyframes setupFadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }

    .setup-header { text-align: center; margin-bottom: clamp(16px, 2vw, 28px); }
    .setup-header-eyebrow { display: block; font-size: clamp(0.7rem, 0.9vw, 1.05rem); font-weight: 700; text-transform: uppercase; letter-spacing: 0.3em; color: rgba(255,255,255,0.35); margin: 0 0 clamp(10px, 1.2vw, 16px); }
    .setup-header-title { font-size: clamp(2.4rem, 4.2vw, 5.4rem); font-weight: 200; letter-spacing: -0.03em; color: #ffffff; margin: 0 0 clamp(10px, 1.2vw, 16px); line-height: 1.05; text-shadow: 0 2px 40px rgba(80,100,255,0.25); }
    .setup-header-subtitle { font-size: clamp(0.95rem, 1.1vw, 1.4rem); color: rgba(255,255,255,0.55); margin: 0 auto; max-width: 520px; line-height: 1.6; font-weight: 300; }

    .setup-section { background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.13); border-radius: clamp(14px, 1.6vw, 20px); overflow: hidden; transition: border-color 0.3s, background 0.3s; }
    .setup-section.expanded { background: rgba(255,255,255,0.10); border-color: rgba(255,255,255,0.22); }
    .setup-section-header { display: flex; align-items: center; gap: clamp(10px, 1.1vw, 16px); padding: clamp(18px, 2vw, 28px) clamp(20px, 2.2vw, 32px); cursor: pointer; outline: none; width: 100%; background: none; border: none; text-align: left; font-family: inherit; transition: background 0.2s; border-radius: clamp(14px, 1.6vw, 20px); filter: drop-shadow(2px 3px 0px black); }
    .setup-section-header:focus { background: rgba(255,255,255,0.06); box-shadow: inset 0 0 0 2px rgba(255,255,255,0.30); }
    .setup-section.expanded .setup-section-header { border-radius: clamp(14px, 1.6vw, 20px) clamp(14px, 1.6vw, 20px) 0 0; }
    .setup-section-step { font-size: clamp(0.72rem, 0.82vw, 0.98rem); font-weight: 700; letter-spacing: 0.08em; color: rgba(255,255,255,0.28); flex-shrink: 0; width: 2em; text-align: center; transition: color 0.3s; }
    .setup-section.expanded .setup-section-step { color: rgba(255,255,255,0.55); }
    .setup-section-label { font-size: clamp(0.85rem, 1vw, 1.2rem); font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: rgba(255,255,255,0.60); flex: 1; }
    .setup-section.expanded .setup-section-label { color: rgba(255,255,255,0.92); }
    
    .setup-section-status { width: clamp(20px, 2vw, 28px); height: clamp(20px, 2vw, 28px); border-radius: 50%; border: 2px solid rgba(255,255,255,0.22); display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: clamp(0.6rem, 0.75vw, 0.9rem); color: transparent; transition: all 0.3s; }
    .setup-section-status.done { background: rgba(100,220,120,0.2); border-color: rgba(100,220,120,0.7); color: rgba(100,220,120,1); }
    .setup-section-status.required-empty { border-color: rgba(255,255,255,0.22); }

    .setup-user-bar { padding-top: 20px;display: flex; gap: 10px; margin-bottom: 16px; overflow-x: auto; padding-bottom: 6px; }
    .setup-user-pill { display: flex; align-items: center; gap: 8px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 4px 14px 4px 4px; cursor: pointer; color: rgba(255,255,255,0.7); font-size: clamp(0.8rem, 0.9vw, 1rem); transition: all 0.2s; white-space: nowrap; outline: none; }
    .setup-user-pill:focus { border-color: #fff; box-shadow: 0 0 0 3px rgba(255,255,255,0.2); }
    .setup-user-pill.active { background: rgba(255,255,255,0.15); border-color: #fff; color: #fff; }
    .setup-user-pill-avatar { width: 26px; height: 26px; border-radius: 50%; background: rgba(255,255,255,0.2); overflow: hidden; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .setup-user-pill-avatar img { width: 100%; height: 100%; object-fit: cover; }
    .setup-admin-badge { display: inline-flex; align-items: center; justify-content: center; height: 18px; padding: 0 7px; border-radius: 999px; background: rgba(255,255,255,0.16); border: 1px solid rgba(255,255,255,0.22); color: rgba(255,255,255,0.9); font-size: 0.58rem; font-weight: 900; letter-spacing: 0; text-transform: uppercase; }

    .setup-user-group { display: flex; align-items: center; gap: 6px; }

    .setup-btn-delete {
        display: flex; align-items: center; justify-content: center;
        width: clamp(28px, 3vw, 34px); height: clamp(28px, 3vw, 34px);
        border-radius: 50%; background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.12); color: rgba(255, 255, 255, 0.45);
        cursor: pointer; outline: none; transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
        flex-shrink: 0;
    }
    .setup-btn-delete:focus, .setup-btn-delete:hover {
        background: rgba(235, 60, 60, 0.95); border-color: rgba(255, 120, 120, 1); color: #fff;
        transform: scale(1.15); box-shadow: 0 0 0 4px rgba(235, 60, 60, 0.25), 0 6px 16px rgba(0,0,0,0.4);
    }

    .setup-user-add { display: flex; align-items: center; justify-content: center; flex-shrink: 0; width: 36px; height: 36px; border-radius: 50%; background: rgba(255,255,255,0.05); border: 1px dashed rgba(255,255,255,0.3); cursor: pointer; color: #fff; transition: all 0.2s; outline: none; }
    .setup-user-add:hover, .setup-user-add:focus { background: rgba(255,255,255,0.15); border-color: #fff; box-shadow: 0 0 0 3px rgba(255,255,255,0.2); }

    .setup-section-chevron { width: clamp(18px, 1.8vw, 24px); height: clamp(18px, 1.8vw, 24px); display: flex; align-items: center; justify-content: center; flex-shrink: 0; opacity: 0.30; transition: transform 0.35s cubic-bezier(0.22,1,0.36,1), opacity 0.2s; }
    .setup-section-chevron svg { width: 100%; height: 100%; stroke: #fff; fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .setup-section.expanded .setup-section-chevron { transform: rotate(90deg); opacity: 0.65; }

    .setup-section-body { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 0.4s cubic-bezier(0.22,1,0.36,1); }
    .setup-section.expanded .setup-section-body { grid-template-rows: 1fr; }
    .setup-section-body-inner { overflow: hidden; }
    .setup-section-content { padding: 0 clamp(20px, 2.2vw, 32px) clamp(20px, 2.2vw, 30px); display: flex; flex-direction: column; gap: clamp(14px, 1.5vw, 20px); }
    .setup-section-divider { height: 1px; background: rgba(255,255,255,0.10); margin-bottom: clamp(2px, 0.3vw, 6px); }
    .setup-section-desc { font-size: clamp(0.85rem, 0.95vw, 1.15rem); color: rgba(255,255,255,0.50); margin: 0; line-height: 1.6; font-weight: 300; }
    .setup-sync-actions { display:flex; align-items:center; gap:clamp(12px,1.2vw,18px); }
    .setup-sync-actions .setup-auth-btn { width:min(390px,100%); }
    .setup-sync-message { min-height:1.4em; margin:0; color:rgba(255,255,255,.52); font-size:clamp(.8rem,.9vw,1.05rem); }
    .setup-sync-message.error { color:#ffb0b0; }
    .setup-identity-row { display: flex; align-items: center; gap: clamp(16px, 1.8vw, 26px); }
    
    .setup-photo-btn { width: clamp(68px, 7.5vw, 100px); height: clamp(68px, 7.5vw, 100px); border-radius: 50%; background: rgba(255,255,255,0.07); border: 2px dashed rgba(255,255,255,0.25); display: flex; align-items: center; justify-content: center; overflow: hidden; color: rgba(255,255,255,0.30); cursor: pointer; outline: none; flex-shrink: 0; transition: border-color 0.2s, background 0.2s, transform 0.2s, box-shadow 0.2s; position: relative; }
    .setup-photo-btn svg { width: 38%; height: 38%; stroke: currentColor; fill: none; stroke-width: 1.5; stroke-linecap: round; overflow: visible; }
    .setup-photo-btn img { width:100%; height:100%; object-fit:cover; position:absolute; inset:0; }
    .setup-photo-btn:focus, .setup-photo-btn:hover { border-color: rgba(255,255,255,0.9); background: rgba(255,255,255,0.1); transform: scale(1.05); box-shadow: 0 0 0 4px rgba(255,255,255,0.15); }
    .setup-photo-btn.has-photo { border-style:solid; border-color:rgba(255,255,255,0.35); }

    .setup-name-wrap { flex: 1; display: flex; flex-direction: column; gap: clamp(6px, 0.7vw, 10px); }
    .setup-pin-hint { margin: -2px 0 0; color: rgba(255,255,255,0.34); font-size: clamp(0.72rem, 0.78vw, 0.95rem); line-height: 1.28; }
    .setup-pin-hint.error { color: rgba(255,110,110,0.92); }
    .setup-field-label { font-size: clamp(0.68rem, 0.76vw, 0.9rem); color: rgba(255,255,255,0.45); font-weight: 600; text-transform: uppercase; letter-spacing: 0.12em; }
    
    .setup-input { width: 100%; background: rgba(255,255,255,0.09); border: 1px solid rgba(255,255,255,0.18); border-radius: clamp(10px, 1vw, 13px); padding: clamp(14px, 1.5vw, 20px) clamp(16px, 1.7vw, 22px); color: #fff; font-size: clamp(1rem, 1.15vw, 1.5rem); font-family: inherit; font-weight: 400; outline: none; box-sizing: border-box; cursor: pointer; caret-color: transparent; transition: border-color 0.18s, background 0.18s, box-shadow 0.18s; }
    .setup-input:focus { border-color: rgba(255,255,255,0.9); background: rgba(255,255,255,0.12); box-shadow: 0 0 0 4px rgba(255,255,255,0.12); }
    .setup-input.vkb-active { border-color: rgba(100,160,255,0.7); box-shadow: 0 0 0 4px rgba(100,160,255,0.15); caret-color: rgba(100,160,255,0.9); }
    .setup-input.error { border-color: rgba(255,80,80,0.8); box-shadow: 0 0 0 4px rgba(255,80,80,0.12); }
    .setup-input::placeholder { color: rgba(255,255,255,0.22); }
    @keyframes setupShake { 0%,100% { transform: translateX(0); } 20% { transform: translateX(-8px); } 40% { transform: translateX(8px); } 60% { transform: translateX(-5px); } 80% { transform: translateX(5px); } }
    .shake { animation: setupShake 0.33s ease; }

    .setup-api-row { display: flex; gap: clamp(8px, 0.9vw, 12px); align-items: stretch; }
    .setup-api-row .setup-input { flex: 1; }
    .setup-icon-btn { background: rgba(255,255,255,0.09); border: 1px solid rgba(255,255,255,0.18); border-radius: clamp(10px, 1vw, 13px); color: rgba(255,255,255,0.72); font-size: clamp(0.82rem, 0.92vw, 1.12rem); font-weight: 600; padding: 0 clamp(16px, 1.7vw, 24px); cursor: pointer; outline: none; transition: all 0.15s; display: flex; align-items: center; gap: 7px; }
    .setup-icon-btn:focus, .setup-icon-btn:hover { background: rgba(255,255,255,0.18); border-color: rgba(255,255,255,0.9); color: #fff; box-shadow: 0 0 0 4px rgba(255,255,255,0.12); }
    .setup-api-link-btn { background: rgba(100,160,255,0.09); border: 1px solid rgba(100,160,255,0.25); border-radius: clamp(10px, 1vw, 13px); color: rgba(140,190,255,0.9); font-size: clamp(0.8rem, 0.88vw, 1.08rem); font-weight: 600; padding: 0 clamp(16px, 1.7vw, 24px); cursor: pointer; outline: none; transition: all 0.15s; display: flex; align-items: center; gap: 6px; }
    .setup-api-link-btn:focus, .setup-api-link-btn:hover { background: rgba(100,160,255,0.20); border-color: rgba(100,160,255,0.9); color: rgba(200,225,255,1); box-shadow: 0 0 0 4px rgba(100,160,255,0.15); }
    .setup-api-hint { font-size: clamp(0.8rem, 0.88vw, 1.05rem); color: rgba(255,255,255,0.38); margin: 0; transition: color 0.2s; }
    .setup-api-hint.error { color: rgba(255,100,100,0.9); }

    .setup-layout-panel { display: grid; gap: clamp(14px, 1.5vw, 20px); }
    .setup-layout-preview {
        position: relative;
        height: clamp(210px, 25vh, 320px);
        overflow: hidden;
        border-radius: clamp(12px, 1.3vw, 18px);
        border: 1px solid rgba(255,255,255,0.12);
        background:
            linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px),
            linear-gradient(0deg, rgba(255,255,255,0.035) 1px, transparent 1px),
            linear-gradient(180deg, rgba(8,10,22,0.92), rgba(3,4,12,0.96));
        background-size: 34px 34px, 34px 34px, auto;
    }
    .setup-layout-reference,
    .setup-layout-stage {
        position: absolute;
        left: 50%;
        top: 50%;
        width: min(52%, 280px);
        transform-origin: center center;
    }
    .setup-layout-reference {
        transform: translate(-50%, -50%) scale(var(--setup-reference-inverse-scale, 1));
        opacity: 0.78;
    }
    .setup-layout-stage {
        transform: translate(-50%, -50%) scale(var(--setup-preview-target-inverse-scale, 1));
        opacity: 0.96;
        transition: transform 0.12s ease;
    }
    .setup-layout-stage.is-too-small,
    .setup-layout-stage.is-too-large {
        filter: saturate(1.12);
    }
    .setup-layout-stage.is-too-small .setup-layout-size-sample {
        border-color: rgba(125,190,255,0.85);
    }
    .setup-layout-stage.is-too-large .setup-layout-size-sample {
        border-color: rgba(255,190,120,0.82);
    }
    .setup-layout-size-sample {
        width: 100%;
        aspect-ratio: 16 / 7;
        box-sizing: border-box;
        border-radius: 10px;
    }
    .setup-layout-reference .setup-layout-size-sample {
        border: 1px dashed rgba(210, 230, 255, 0.62);
        background: rgba(120, 180, 255, 0.04);
    }
    .setup-layout-stage .setup-layout-size-sample {
        border: 1px solid rgba(150, 205, 255, 0.76);
        background: rgba(120, 180, 255, 0.30);
        box-shadow: 0 12px 28px rgba(0, 0, 0, 0.30);
    }
    .setup-layout-guide {
        position:absolute;
        left:50%;
        top:50%;
        width:min(88%, 620px);
        height:72%;
        transform:translate(-50%, -50%);
        border:1px solid rgba(255,255,255,0.28);
        border-radius:14px;
        pointer-events:none;
        box-shadow: inset 0 0 0 1px rgba(120,190,255,0.13), 0 0 42px rgba(90,145,255,0.08);
    }
    .setup-layout-guide::before,
    .setup-layout-guide::after {
        content:'';
        position:absolute;
        inset:10px;
        border-radius:10px;
        border:1px dashed rgba(120,190,255,0.24);
    }
    .setup-layout-guide::after {
        inset:auto 14px 14px;
        height:2px;
        border:0;
        background:linear-gradient(90deg, transparent, rgba(120,190,255,0.48), transparent);
    }
    .setup-layout-guide.is-calibrated {
        border-color: rgba(118, 220, 158, 0.72);
        box-shadow: inset 0 0 0 1px rgba(118, 220, 158, 0.18), 0 0 42px rgba(90, 205, 145, 0.10);
    }
    .setup-layout-controls { display:grid; gap:10px; }
    .setup-layout-value { color:rgba(255,255,255,0.74); font-size:clamp(0.84rem,0.95vw,1.05rem); font-weight:700; }
    .setup-range {
        width:100%;
        accent-color:#78beff;
        cursor:pointer;
        outline:none;
    }
    .setup-range:focus { filter:drop-shadow(0 0 10px rgba(120,190,255,0.46)); }
    .setup-folder-list { display: flex; flex-direction: column; gap: clamp(7px, 0.8vw, 11px); }
    .setup-folder-item { display: flex; align-items: center; gap: 12px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.10); border-radius: clamp(8px, 0.9vw, 12px); padding: clamp(11px, 1.2vw, 16px) clamp(14px, 1.5vw, 20px); animation: setupFadeIn 0.2s ease; }
    .setup-folder-path { flex: 1; font-size: clamp(0.82rem, 0.9vw, 1.08rem); color: rgba(255,255,255,0.72); font-family: monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .setup-folder-remove { background: none; border: none; color: rgba(255,80,80,0.40); cursor: pointer; font-size: clamp(0.8rem, 0.88vw, 1.05rem); padding: 4px 10px; border-radius: 6px; outline: none; transition: color 0.15s, box-shadow 0.15s; flex-shrink: 0; }
    .setup-folder-remove:focus, .setup-folder-remove:hover { color: rgba(255,80,80,1); box-shadow: 0 0 0 3px rgba(255,80,80,0.25); }

    .setup-power-btn {
        background: none; border: 1px solid transparent; border-radius: 9px;
        color: rgba(255,255,255,0.38); padding: 7px 13px;
        display: flex; align-items: center; gap: 7px;
        cursor: pointer; outline: none; font: inherit;
        font-size: clamp(0.68rem, 0.8vw, 0.88rem); font-weight: 500;
        letter-spacing: 0.02em;
        transition: all 0.16s cubic-bezier(0.25, 1, 0.5, 1);
        align-self: center;
    }
    .setup-power-btn svg { width: 15px; height: 15px; flex-shrink: 0; stroke-width: 1.6; }
    .setup-power-btn:hover, .setup-power-btn:focus {
        background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.16);
        color: rgba(255,255,255,0.82); transform: translateY(-1px);
    }

    .setup-footer { display: flex; justify-content: center; align-items: center; gap: clamp(14px, 1.2vw, 22px); padding: clamp(12px, 1.2vw, 18px) 0 clamp(16px, 1.8vw, 28px); }
    .setup-footer #btnSetupCancel { min-height: clamp(46px, 3vw, 62px); min-width: clamp(160px, 10vw, 230px); justify-content: center; border-radius: clamp(12px, 1.2vw, 16px); padding: 0 clamp(28px, 2.6vw, 48px); font-size: clamp(0.96rem, 1.05vw, 1.32rem); }
    .setup-finish-btn { background: rgba(255,255,255,0.92); border: 2px solid transparent; border-radius: clamp(12px, 1.2vw, 16px); color: #06060e; font-size: clamp(1rem, 1.15vw, 1.5rem); font-weight: 700; padding: clamp(15px, 1.6vw, 22px) clamp(52px, 5.2vw, 80px); min-width: clamp(260px, 16vw, 390px); cursor: pointer; outline: none; letter-spacing: 0.02em; transition: all 0.2s; box-shadow: 0 6px 24px rgba(0,0,0,0.35); }
    .setup-finish-btn:focus, .setup-finish-btn:hover { background: #fff; transform: translateY(-2px) scale(1.03); box-shadow: 0 0 0 5px rgba(255,255,255,0.2), 0 16px 36px rgba(0,0,0,0.5); }
    `;
    document.head.appendChild(s);
})();

// ── HTML ──────────────────────────────────────────────────────────────────────
(function buildSetupHTML() {
    const container = document.getElementById('setupContainer');
    if (!container) return;

    const chevron = `<span class="setup-section-chevron"><svg viewBox="0 0 24 24"><polyline points="9 6 15 12 9 18"/></svg></span>`;
    const personSvg = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>`;
    const svgExit = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`;

    container.innerHTML = `
    <canvas id="setupBg"></canvas>
    <button class="setup-back-auth setup-focusable" id="btnSetupBackAuth" tabindex="-1"><span class="setup-back-auth-arrow">‹</span><span data-i18n="profileSyncBack">Voltar</span></button>
    <section class="setup-auth-gate" id="setupAuthGate">
        <h1 class="setup-auth-title" data-i18n="profileSyncSetupTitle">Entre no Doorpi</h1>
        <p class="setup-auth-copy" id="setupAuthCopy" data-i18n="profileSyncSetupCopy">Entre no seu perfil ou cadastre-se.</p>
        <div class="setup-auth-actions">
            <button class="setup-auth-btn google setup-focusable" id="btnSetupGoogle" tabindex="-1"></button>
            <button class="setup-auth-btn setup-focusable" id="btnSetupRegister" tabindex="-1" data-i18n="profileSyncRegister">Cadastrar</button>
        </div>
        <div class="setup-auth-status" id="setupAuthStatus"></div>
    </section>
    <section class="setup-auth-loading" id="setupAuthLoading" aria-live="polite">
        <div class="setup-auth-spinner" aria-hidden="true"></div>
        <h2 data-i18n="profileSyncSigningInTitle">Entrando</h2>
        <p id="setupAuthLoadingCopy" data-i18n="profileSyncSigningInBrowser">Conclua o acesso na janela do navegador.</p>
    </section>
    <div class="setup-form">
        <div class="setup-header">
            <span class="setup-header-eyebrow" data-i18n="setupEyebrow"></span>
            <h1 class="setup-header-title" data-i18n="setupStep1Title"></h1>
            <p class="setup-header-subtitle" data-i18n="setupHeaderSubtitle"></p>
        </div>

        <div class="setup-cloud-profile" id="setupCloudProfile">
            <div class="setup-cloud-identity">
                <div class="setup-cloud-avatar" id="setupCloudAvatar"></div>
                <div class="setup-cloud-profile-copy">
                    <span class="setup-cloud-profile-label" data-i18n="profileSyncSignedInProfile">Seu perfil</span>
                    <strong class="setup-cloud-profile-name" id="setupCloudProfileName"></strong>
                </div>
            </div>
            <div class="setup-cloud-playtime">
                <span class="setup-cloud-playtime-label" data-i18n="profileSyncFieldHours">Horas jogadas</span>
                <strong class="setup-cloud-playtime-value" id="setupCloudPlaytime">0h</strong>
            </div>
        </div>

        <div class="setup-section" id="setupSectionLayout">
            <button class="setup-section-header setup-focusable" data-section="layout">
                <span class="setup-section-step">01</span>
                <span class="setup-section-label" data-i18n="setupSectionLayout">Layout da tela</span>
                <span class="setup-section-status required-empty" id="statusLayout"></span>
                ${chevron}
            </button>
            <div class="setup-section-body">
                <div class="setup-section-body-inner">
                    <div class="setup-section-content">
                        <div class="setup-section-divider"></div>
                        <p class="setup-section-desc" data-i18n="setupLayoutDesc"></p>
                        <div class="setup-layout-panel">
                            <div class="setup-layout-preview" aria-hidden="true">
                                <div class="setup-layout-guide" id="setupLayoutGuide"></div>
                                <div class="setup-layout-reference" id="setupLayoutReference">
                                    <div class="setup-layout-size-sample"></div>
                                </div>
                                <div class="setup-layout-stage" id="setupLayoutPreviewStage">
                                    <div class="setup-layout-size-sample"></div>
                                </div>
                            </div>
                            <div class="setup-layout-controls">
                                <div class="setup-layout-value" id="setupLayoutScaleValue"></div>
                                <input class="setup-range setup-focusable" id="setupLayoutScale" type="range" min="25" max="180" step="5" tabindex="-1" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="setup-section" id="setupSectionIdentity">
            <button class="setup-section-header setup-focusable" data-section="identity">
                <span class="setup-section-step">02</span>
                <span class="setup-section-label" data-i18n="setupSectionIdentity">Identidade</span>
                <span class="setup-section-status required-empty" id="statusIdentity"></span>
                ${chevron}
            </button>
            <div class="setup-section-body">
                <div class="setup-section-body-inner">
                    <div class="setup-section-content">
                        <div class="setup-section-divider"></div>
                        <p class="setup-section-desc" data-i18n="setupIdentityDesc"></p>
                        
                        <div class="setup-user-bar" id="setupUserBar"></div>
                        
                        <div class="setup-identity-row">
                            <button class="setup-photo-btn setup-focusable" id="setupPhotoBtn" tabindex="-1">${personSvg}</button>
                            <div class="setup-name-wrap">
                                <span class="setup-field-label" data-i18n="setupNameLabel"></span>
                                <input class="setup-input setup-focusable" id="setupNameInput" type="text" readonly tabindex="-1" />
                                <span class="setup-field-label" data-i18n="setupPinLabel"></span>
                                <input class="setup-input setup-focusable" id="setupPinInput" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" readonly tabindex="-1" />
                                <p class="setup-pin-hint" data-i18n="setupPinHint"></p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="setup-section" id="setupSectionApiKey">
            <button class="setup-section-header setup-focusable" data-section="apikey">
                <span class="setup-section-step">03</span>
                <span class="setup-section-label" data-i18n="setupSectionApiKey"></span>
                <span class="setup-section-status required-empty" id="statusApiKey"></span>
                ${chevron}
            </button>
            <div class="setup-section-body">
                <div class="setup-section-body-inner">
                    <div class="setup-section-content">
                        <div class="setup-section-divider"></div>
                        <p class="setup-section-desc" data-i18n="setupApiDesc"></p>
                        <div class="setup-api-row">
                            <input class="setup-input setup-focusable" id="setupApiInput" type="text" readonly tabindex="-1" maxlength="32" />
                            <button class="setup-icon-btn setup-focusable" id="btnSetupPaste" tabindex="-1"><span data-i18n="setupStep3PasteMode"></span></button>
                            <button class="setup-api-link-btn setup-focusable" id="btnSetupApiLink" tabindex="-1"><span data-i18n="setupStep3LinkText"></span></button>
                        </div>
                        <p class="setup-api-hint" id="setupApiHint" data-i18n="setupStep3PasteHint"></p>
                    </div>
                </div>
            </div>
        </div>

        <div class="setup-section" id="setupSectionGoogleSync">
            <button class="setup-section-header setup-focusable" data-section="google-sync">
                <span class="setup-section-step">04</span>
                <span class="setup-section-label" data-i18n="setupSectionGoogleSync"></span>
                <span class="setup-section-status" id="statusGoogleSync"></span>
                ${chevron}
            </button>
            <div class="setup-section-body">
                <div class="setup-section-body-inner">
                    <div class="setup-section-content">
                        <div class="setup-section-divider"></div>
                        <p class="setup-section-desc" data-i18n="setupGoogleSyncDesc"></p>
                        <div class="setup-sync-actions">
                            <button class="setup-auth-btn google setup-focusable" id="btnSetupSyncGoogle" tabindex="-1"></button>
                        </div>
                        <p class="setup-sync-message" id="setupSyncMessage" aria-live="polite"></p>
                    </div>
                </div>
            </div>
        </div>

        <div class="setup-section" id="setupSectionFolders">
            <button class="setup-section-header setup-focusable" data-section="folders">
                <span class="setup-section-step">05</span>
                <span class="setup-section-label" data-i18n="setupSectionFolders"></span>
                <span class="setup-section-status" id="statusFolders"></span>
                ${chevron}
            </button>
            <div class="setup-section-body">
                <div class="setup-section-body-inner">
                    <div class="setup-section-content">
                        <div class="setup-section-divider"></div>
                        <p class="setup-section-desc" data-i18n="setupFoldersDesc"></p>
                        <div class="setup-folder-list" id="setupFolderList"></div>
                        <button class="setup-icon-btn setup-focusable" id="btnSetupAddFolder" tabindex="-1" style="width: 100%; justify-content: center; padding-top: clamp(12px, 1.2vw, 16px); padding-bottom: clamp(12px, 1.2vw, 16px); margin-top: 4px;">
                            + <span data-i18n="setupStep4AddFolder"></span>
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <div class="setup-footer">
            <button class="setup-power-btn setup-focusable" id="btnSetupExit" style="display:none;" tabindex="-1">
                ${svgExit} <span data-i18n="powerExit">Sair</span>
            </button>
            <button class="setup-icon-btn setup-focusable" id="btnSetupCancel" style="display:none;" data-i18n="setupBtnCancel">Cancelar</button>
            <button class="setup-finish-btn setup-focusable" id="btnSetupFinish"></button>
        </div>
    </div>`;

    const apiSection = container.querySelector('#setupSectionApiKey');
    const identitySection = container.querySelector('#setupSectionIdentity');
    const layoutSection = container.querySelector('#setupSectionLayout');
    const syncSection = container.querySelector('#setupSectionGoogleSync');
    if (apiSection && identitySection && layoutSection && syncSection) {
        layoutSection.after(apiSection);
        apiSection.after(identitySection);
        identitySection.after(syncSection);
        apiSection.querySelector('.setup-section-step').textContent = '02';
        identitySection.querySelector('.setup-section-step').textContent = '03';
    }

    if (typeof applyI18n === 'function') applyI18n();
    document.getElementById('setupNameInput').placeholder = typeof t === 'function' ? t('setupStep1Placeholder') : 'Seu Nome';
    document.getElementById('setupPinInput').placeholder = typeof t === 'function' ? t('setupPinPlaceholder') : 'Opcional';
    document.getElementById('setupApiInput').placeholder = typeof t === 'function' ? t('setupStep3Placeholder') : 'Chave API';

    _bindSetupEvents();
})();

// ── Multi-user View & Logic ───────────────────────────────────────────────────

function _setupClampLayoutScale(raw) {
    const min = window.DoorpiLayoutScale?.min ?? 0.25;
    const max = window.DoorpiLayoutScale?.max ?? 1.80;
    const n = Number(raw);
    if (!Number.isFinite(n)) return window.DoorpiLayoutScale?.defaultValue ?? 1;
    return Math.max(min, Math.min(max, n));
}

function _setupGetReferenceLayoutScale() {
    const dpiScale = Math.max(0.5, Number(window.DoorpiDisplayMetrics?.dpiScale) || 1);
    return _setupClampLayoutScale(1 / dpiScale);
}

function _setupLayoutScaleMatchesReference(scale = _setupPendingLayoutScale) {
    return Math.abs(Number(scale) - _setupGetReferenceLayoutScale()) <= 0.026;
}

function _setupApplyLayoutScale(raw, commit = false) {
    const api = window.DoorpiLayoutScale;
    const scale = _setupClampLayoutScale(Number(raw) / 100);
    const next = commit ? api?.save?.(scale) : scale;
    _setupPendingLayoutScale = Number(next || scale || 1);
    const normalized = _setupPendingLayoutScale;
    const pct = Math.round(normalized * 100);
    const input = document.getElementById('setupLayoutScale');
    const value = document.getElementById('setupLayoutScaleValue');
    const stage = document.getElementById('setupLayoutPreviewStage');
    const reference = document.getElementById('setupLayoutReference');
    const guide = document.getElementById('setupLayoutGuide');
    const referenceScale = _setupGetReferenceLayoutScale();
    const relativeScale = normalized / referenceScale;
    if (input) input.value = String(pct);
    if (value) value.textContent = typeof t === 'function' ? t('setupLayoutScaleValue', pct) : `Escala da interface: ${pct}%`;
    if (stage) {
        stage.style.setProperty('--setup-preview-target-inverse-scale', (1 / referenceScale).toFixed(4));
        stage.classList.toggle('is-too-small', relativeScale < 0.974);
        stage.classList.toggle('is-too-large', relativeScale > 1.026);
    }
    if (reference) reference.style.setProperty('--setup-reference-inverse-scale', (1 / normalized).toFixed(4));
    const isCalibrated = _setupLayoutScaleMatchesReference(normalized);
    guide?.classList.toggle('is-calibrated', isCalibrated);
    if (!_isAddingUserMode) _setSetupLayoutConfirmed(isCalibrated);
    return normalized;
}

window._setupAdjustLayoutScale = function (deltaPct = 0, commit = false) {
    const input = document.getElementById('setupLayoutScale');
    if (!input) return false;
    const min = Number(input.min || 25);
    const max = Number(input.max || 180);
    const current = Number(input.value || Math.round(_setupPendingLayoutScale * 100) || 100);
    input.value = String(Math.max(min, Math.min(max, current + Number(deltaPct || 0))));
    _setupApplyLayoutScale(input.value, commit);
    input.focus({ preventScroll: true });
    return true;
};

window._setupRefreshLayoutReference = function () {
    if (!isSetupOpen) return false;
    _setupApplyLayoutScale(Math.round(_setupPendingLayoutScale * 100), false);
    return true;
};

function _setSetupLayoutConfirmed(confirmed) {
    _setupLayoutConfirmed = !!confirmed && _setupLayoutScaleMatchesReference();
    const status = document.getElementById('statusLayout');
    if (!status) return;
    status.className = 'setup-section-status ' + (_setupLayoutConfirmed ? 'done' : 'required-empty');
    status.textContent = _setupLayoutConfirmed ? '✓' : '';
}

function _renderSetupUsers() {
    const bar = document.getElementById('setupUserBar');
    if (!bar) return;
    if (_isAddingUserMode) {
        bar.style.display = 'none';
        return;
    }
    bar.style.display = 'flex';

    // Ícone X em SVG bem clean para o botão de deletar
    const deleteSvg = `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;

    let html = _setupUsers.map((u, i) => `
        <div class="setup-user-group">
            <button class="setup-user-pill ${u === _currUser ? 'active' : ''} setup-focusable" data-idx="${i}" tabindex="-1">
                <div class="setup-user-pill-avatar">
                    ${u.photoBase64 ? `<img src="${window._doorpiUserPhotoSrc?.(u.photoBase64) || `data:image/png;base64,${u.photoBase64}`}" />` : `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>`}
                </div>
                <span>${u.name || (typeof t === 'function' ? t('defaultUserName', i + 1) : `Usuário ${i + 1}`)}</span>
                ${i === 0 ? `<span class="setup-admin-badge">${typeof t === 'function' ? t('adminBadge', 'Admin') : 'Admin'}</span>` : ''}
            </button>
            ${_setupUsers.length > 1 ? `
            <button class="setup-btn-delete setup-focusable" data-idx="${i}" tabindex="-1" title="${typeof t === 'function' ? t('titleRemoveUser') : 'Remover Usuário'}">
                ${deleteSvg}
            </button>` : ''}
        </div>
    `).join('');
    html += `<button class="setup-user-add setup-focusable" id="btnSetupAddUser" tabindex="-1" title="${typeof t === 'function' ? t('titleAddUser') : 'Adicionar Usuário'}">+</button>`;
    bar.innerHTML = html;

    // Ação ao selecionar a pílula do usuário
    bar.querySelectorAll('.setup-user-pill').forEach(btn => {
        btn.addEventListener('click', () => {
            _currUser = _setupUsers[parseInt(btn.dataset.idx)];
            _loadCurrentUserIntoForm();
            _renderSetupUsers();
            if (_currentSection) {
                _currentSection.querySelectorAll('.setup-focusable').forEach(el => el.tabIndex = 0);
            }
        });
    });

    // Nova Ação exclusiva para DELETAR o usuário (Agora foca via controle!)
    bar.querySelectorAll('.setup-btn-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(btn.dataset.idx);
            _setupUsers.splice(idx, 1);
            if (!_setupUsers.includes(_currUser)) {
                _currUser = _setupUsers[0];
            }
            _loadCurrentUserIntoForm();
            _renderSetupUsers();
            if (_currentSection) {
                _currentSection.querySelectorAll('.setup-focusable').forEach(el => el.tabIndex = 0);
            }

            // Retorna o foco pro botão mais próximo para não quebrar a navegação do controle
            const newPills = bar.querySelectorAll('.setup-user-pill');
            if (newPills.length > 0) {
                const focusIdx = Math.min(idx, newPills.length - 1);
                newPills[focusIdx]?.focus();
            }
        });
    });

    // Adicionar Novo Usuário
    bar.querySelector('#btnSetupAddUser').addEventListener('click', () => {
        const newUser = {
            id: Date.now(), name: '', pin: '', photoBase64: '', apiKey: '', folders: [],
            photoSource: '', photoSourceUrl: '', photoSteamGridAssetId: 0,
            photoCropX: 0, photoCropY: 0, photoZoom: 1, totalPlaytimeSeconds: 0
        };
        _setupUsers.push(newUser);
        _currUser = newUser;
        _loadCurrentUserIntoForm();
        _renderSetupUsers();
        const apiSection = document.getElementById('setupSectionApiKey');
        if (apiSection) _expandSection(apiSection);
        document.getElementById('setupApiInput')?.focus();
    });

    const identitySec = document.getElementById('setupSectionIdentity');
    if (identitySec && identitySec.classList.contains('expanded')) {
        bar.querySelectorAll('.setup-focusable').forEach(el => el.tabIndex = 0);
    }
}

function _loadCurrentUserIntoForm() {
    if (!_currUser) return;
    document.getElementById('setupNameInput').value = _currUser.name;
    document.getElementById('setupPinInput').value = _currUser.pin || '';
    _setSetupPinHintError(!_isValidSetupPin(_currUser.pin));
    document.getElementById('setupApiInput').value = _currUser.apiKey;
    const btn = document.getElementById('setupPhotoBtn');
    if (_currUser.photoBase64) {
        btn.innerHTML = `<img src="${window._doorpiUserPhotoSrc?.(_currUser.photoBase64) || `data:image/png;base64,${_currUser.photoBase64}`}" />`;
        btn.classList.add('has-photo');
    } else {
        btn.innerHTML = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>`;
        btn.classList.remove('has-photo');
    }
    _renderSetupFolders();
    _updateStatus();
}

function _updateStatus() {
    if (!_currUser) return;
    _setSetupLayoutConfirmed(_setupLayoutConfirmed);

    const nameDone = !!_currUser.name.trim();
    const statusId = document.getElementById('statusIdentity');
    if (statusId) {
        statusId.textContent = nameDone ? '✓' : '';
        statusId.className = 'setup-section-status ' + (nameDone ? 'done' : 'required-empty');
    }

    const apiDone = !!_currUser.apiKey.trim();
    const statusApi = document.getElementById('statusApiKey');
    if (statusApi) {
        statusApi.textContent = apiDone ? '✓' : '';
        statusApi.className = 'setup-section-status ' + (apiDone ? 'done' : 'required-empty');
    }

    const folderCount = _currUser.folders.length;
    const statusFolders = document.getElementById('statusFolders');
    if (statusFolders) {
        statusFolders.textContent = folderCount > 0 ? '✓' : '';
        statusFolders.className = 'setup-section-status ' + (folderCount > 0 ? 'done' : '');
    }

    _renderSetupGoogleSync();

    const label = document.querySelector('#setupSectionIdentity .setup-section-label');
    if (label) {
        label.innerHTML = _currUser.name ? `Identidade - <span style="color:#aaccff">${_currUser.name}</span>` : (typeof t === 'function' ? t('setupSectionIdentity') : 'Identidade');
    }
}

let _currentSection = null;

function _expandSection(sectionEl) {
    if (_currentSection && _currentSection !== sectionEl) _collapseSection(_currentSection);
    sectionEl.classList.add('expanded');
    _currentSection = sectionEl;

    sectionEl.querySelectorAll('.setup-focusable:not(.setup-section-header)').forEach(el => { el.tabIndex = 0; });
}

function _collapseSection(sectionEl) {
    sectionEl.classList.remove('expanded');
    if (_currentSection === sectionEl) _currentSection = null;

    sectionEl.querySelectorAll('.setup-focusable:not(.setup-section-header)').forEach(el => { el.tabIndex = -1; });
}

function _toggleSection(sectionEl) {
    if (sectionEl.classList.contains('expanded')) {
        _collapseSection(sectionEl);
    } else {
        _expandSection(sectionEl);
        setTimeout(() => {
            const first = sectionEl.querySelector('.setup-focusable:not(.setup-section-header)');
            first?.focus();
        }, 50);
    }
}

// Variável global para armazenar a animação atual
let _setupScrollRafId = null;

function _smoothScrollSetup(container, targetScrollTop, duration = 250) { // <-- Reduzi a duração para não brigar com os 80ms do C#
    const start = container.scrollTop;
    const delta = targetScrollTop - start;
    if (Math.abs(delta) < 2) return;

    // Cancela a animação anterior se o usuário segurar o direcional no controle
    if (_setupScrollRafId) {
        cancelAnimationFrame(_setupScrollRafId);
        _setupScrollRafId = null;
    }

    const t0 = performance.now();
    const ease = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    (function step(now) {
        const p = Math.min((now - t0) / duration, 1);
        container.scrollTop = start + delta * ease(p);
        if (p < 1) {
            _setupScrollRafId = requestAnimationFrame(step);
        } else {
            _setupScrollRafId = null;
        }
    })(performance.now());
}
window._setupSmoothScroll = (targetScrollTop) => {
    const container = document.getElementById('setupContainer');
    if (container) _smoothScrollSetup(container, targetScrollTop);
};

// ── Lógica Restaurada do Canvas de Fundo (Exclusivo e Isolado do Setup) ────────
let _bgRaf = null;

function _startSetupBg() {
    if (_bgRaf) return; // Evita empilhar o requestAnimationFrame
    const canvas = document.getElementById('setupBg');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const blobs = [
        { px: 0.0, py: 0.3, sx: 0.00016, sy: 0.00011, r: 0.78, color: [82, 105, 230] },
        { px: 1.4, py: 2.2, sx: 0.00012, sy: 0.00017, r: 0.72, color: [48, 112, 235] },
        { px: 2.8, py: 0.8, sx: 0.00019, sy: 0.00010, r: 0.68, color: [106, 82, 210] },
        { px: 0.8, py: 3.8, sx: 0.00014, sy: 0.00021, r: 0.66, color: [34, 132, 205] },
        { px: 3.4, py: 1.8, sx: 0.00010, sy: 0.00015, r: 0.60, color: [118, 92, 220] },
        { px: 1.9, py: 4.5, sx: 0.00018, sy: 0.00013, r: 0.58, color: [42, 145, 200] },
    ];
    let t = 0;

    function resize() {
        if (!canvas) return;
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resize();

    // Anexa evento resize de modo seguro
    if (!canvas._hasResize) {
        window.addEventListener('resize', resize);
        canvas._hasResize = true;
    }

    function frame() {
        if (!window.isSetupOpen) return;
        const W = canvas.width, H = canvas.height;
        ctx.clearRect(0, 0, W, H);

        ctx.fillStyle = '#090b22';
        ctx.fillRect(0, 0, W, H);

        blobs.forEach(b => {
            const x = W * (0.15 + 0.7 * (0.5 + 0.5 * Math.sin(t * b.sx + b.px)));
            const y = H * (0.10 + 0.8 * (0.5 + 0.5 * Math.sin(t * b.sy + b.py)));
            const r = Math.min(W, H) * b.r;
            const g = ctx.createRadialGradient(x, y, 0, x, y, r);
            const [cr, cg, cb] = b.color;
            g.addColorStop(0, `rgba(${cr},${cg},${cb},0.48)`);
            g.addColorStop(0.42, `rgba(${cr},${cg},${cb},0.19)`);
            g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.ellipse(x, y, r, r * 0.72, t * 0.00004, 0, Math.PI * 2);
            ctx.fill();
        });

        const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.85);
        vig.addColorStop(0, 'rgba(0,0,0,0)');
        vig.addColorStop(1, 'rgba(0,0,18,0.54)');
        ctx.fillStyle = vig;
        ctx.fillRect(0, 0, W, H);

        t++;
        _bgRaf = requestAnimationFrame(frame);
    }
    frame();
}

function _stopSetupBg() {
    if (_bgRaf) {
        cancelAnimationFrame(_bgRaf);
        _bgRaf = null;
    }
}

function _setupApplyPhaseVisibility() {
    const form = document.querySelector('#setupContainer .setup-form');
    const gate = document.getElementById('setupAuthGate');
    const authLoading = document.getElementById('setupAuthLoading');
    const layout = document.getElementById('setupSectionLayout');
    const cloudProfile = document.getElementById('setupCloudProfile');
    const backToAuth = document.getElementById('btnSetupBackAuth');
    const isAuth = _setupPhase === 'auth';
    const isAuthenticating = _setupPhase === 'authenticating';
    const isRegistration = _setupPhase === 'registration';
    const isCloudProfile = isRegistration && !!_currUser?.importCloud;
    if (gate) gate.classList.toggle('visible', isAuth);
    if (authLoading) authLoading.classList.toggle('visible', isAuthenticating);
    gate?.querySelectorAll('.setup-focusable').forEach(item => { item.tabIndex = isAuth ? 0 : -1; });
    if (form) form.style.display = (isAuth || isAuthenticating) ? 'none' : 'flex';
    if (layout) layout.style.display = _setupPhase === 'layout' ? '' : 'none';
    if (cloudProfile) cloudProfile.classList.toggle('visible', isCloudProfile);
    if (backToAuth) {
        backToAuth.classList.toggle('visible', isRegistration);
        backToAuth.tabIndex = isRegistration ? 0 : -1;
    }
    const apiSection = document.getElementById('setupSectionApiKey');
    const identitySection = document.getElementById('setupSectionIdentity');
    const syncSection = document.getElementById('setupSectionGoogleSync');
    const foldersSection = document.getElementById('setupSectionFolders');
    if (apiSection) apiSection.style.display = isRegistration && !isCloudProfile ? '' : 'none';
    if (identitySection) identitySection.style.display = isRegistration && !isCloudProfile ? '' : 'none';
    if (syncSection) syncSection.style.display = isRegistration && !isCloudProfile ? '' : 'none';
    if (foldersSection) foldersSection.style.display = isRegistration ? '' : 'none';
}

function _renderSetupGoogleSync(isError = false) {
    const connected = !!_currUser?.syncConnected;
    const status = document.getElementById('statusGoogleSync');
    const button = document.getElementById('btnSetupSyncGoogle');
    const message = document.getElementById('setupSyncMessage');
    if (status) {
        status.textContent = connected ? '✓' : '';
        status.className = 'setup-section-status ' + (connected ? 'done' : '');
    }
    if (button) {
        button.innerHTML = `${window.DoorpiProfileSync?.googleIcon || ''}<span>${typeof t === 'function'
            ? t(connected ? 'setupGoogleSyncEnabled' : 'setupGoogleSyncConnect', connected ? 'Sincronização ativada' : 'Sincronizar com Google')
            : (connected ? 'Sincronização ativada' : 'Sincronizar com Google')}</span>`;
        button.disabled = connected;
    }
    if (message) {
        message.textContent = _setupSyncMessage || (connected
            ? (typeof t === 'function' ? t('profileSyncConnected', 'Sincronizado') : 'Sincronizado')
            : '');
        message.classList.toggle('error', !!isError);
    }
}

function _setupShowRegistrationSyncError(message) {
    _setupSyncMessage = message || (typeof t === 'function'
        ? t('profileSyncFailed', 'Falha na sincronização')
        : 'Falha na sincronização');
    _setupShowRegistration('setupSectionGoogleSync');
    _renderSetupGoogleSync(true);
    _setupSyncConnectFromRegistration = false;
}

function _setupSetAuthBusy(busy, message = '', isError = false) {
    const google = document.getElementById('btnSetupGoogle');
    const register = document.getElementById('btnSetupRegister');
    const status = document.getElementById('setupAuthStatus');
    if (google) google.disabled = !!busy;
    if (register) register.disabled = !!busy;
    if (status) {
        status.textContent = message || (busy ? (typeof t === 'function' ? t('profileSyncConnecting', 'Abrindo o Google...') : 'Abrindo o Google...') : '');
        status.classList.toggle('error', !!isError);
    }
}

function _setupShowAuthGate() {
    _setupPhase = 'auth';
    _currentSection = null;
    _setupApplyPhaseVisibility();
    _setupSetAuthBusy(false);
    requestAnimationFrame(() => document.getElementById('btnSetupGoogle')?.focus());
}

function _setupShowAuthError(message) {
    _setupShowAuthGate();
    _setupSetAuthBusy(false, message, true);
}

function _setupShowAuthenticating(message = '') {
    _setupPhase = 'authenticating';
    _currentSection = null;
    _setupApplyPhaseVisibility();
    _setupSetAuthBusy(true);
    const copy = document.getElementById('setupAuthLoadingCopy');
    if (copy) copy.textContent = message || (typeof t === 'function'
        ? t('profileSyncSigningInBrowser', 'Conclua o acesso na janela do navegador.')
        : 'Conclua o acesso na janela do navegador.');
}

function _setupSetAuthenticatingMessage(message) {
    const copy = document.getElementById('setupAuthLoadingCopy');
    if (copy && message) copy.textContent = message;
}

function _setupReturnToAuth() {
    const wasCloudProfile = !!_currUser?.importCloud;
    if (_setupCloudProfileId && _currUser?.syncConnected) {
        postToHost({ action: 'profileSyncDisconnect', profileId: _setupCloudProfileId, deleteCloud: false });
    }
    _setupCloudProfileId = '';
    if (wasCloudProfile) {
        _setupUsers = [{
            id: '', name: '', pin: '', photoBase64: '', apiKey: '', folders: [],
            photoSource: '', photoSourceUrl: '', photoSteamGridAssetId: 0,
            photoCropX: 0, photoCropY: 0, photoZoom: 1, totalPlaytimeSeconds: 0,
            syncConnected: false, importCloud: false
        }];
        _currUser = _setupUsers[0];
    } else if (_currUser) {
        _currUser.id = '';
        _currUser.syncConnected = false;
        _currUser.importCloud = false;
    }
    _setupSyncConnectFromRegistration = false;
    _setupSyncMessage = '';
    _loadCurrentUserIntoForm();
    _renderSetupUsers();
    _renderSetupCloudProfile();
    _setupShowAuthGate();
}

function _setupShowRegistration(preferredSectionId = '') {
    _setupPhase = 'registration';
    _currentSection = null;
    _setupApplyPhaseVisibility();
    _renderSetupGoogleSync();
    const finish = document.getElementById('btnSetupFinish');
    if (finish) finish.textContent = _isAddingUserMode
        ? (typeof t === 'function' ? t('addUsuario', 'Adicionar usuário') : 'Adicionar usuário')
        : (typeof t === 'function' ? t('setupStep4Finish', 'Concluir') : 'Concluir');
    const firstSection = document.getElementById(preferredSectionId || (_currUser?.importCloud ? 'setupSectionFolders' : 'setupSectionApiKey'));
    if (firstSection) _expandSection(firstSection);
    requestAnimationFrame(() => firstSection?.querySelector('.setup-section-header')?.focus());
}

function _setupApplyRemoteProfile(data) {
    const profile = data.profile || {};
    const photo = profile.profilePhoto || profile.ProfilePhoto || {};
    _setupCloudProfileId = data.profileId || _setupCloudProfileId;
    if (!_currUser) return;
    _currUser.id = _setupCloudProfileId;
    _currUser.name = profile.profileName || profile.ProfileName || '';
    _currUser.pin = profile.pinCode || profile.PinCode || '';
    _currUser.apiKey = profile.steamGridApiKey || profile.SteamGridApiKey || '';
    _currUser.photoBase64 = data.photoBase64 || '';
    _currUser.photoSource = photo.source || photo.Source || '';
    _currUser.photoSourceUrl = photo.sourceUrl || photo.SourceUrl || '';
    _currUser.photoSteamGridAssetId = Number(photo.steamGridAssetId || photo.SteamGridAssetId || 0);
    _currUser.photoCropX = Number(photo.cropX ?? photo.CropX ?? 0);
    _currUser.photoCropY = Number(photo.cropY ?? photo.CropY ?? 0);
    _currUser.photoZoom = Number(photo.zoom || photo.Zoom || 1);
    _currUser.totalPlaytimeSeconds = Math.max(0, Number(profile.totalPlaytimeSeconds ?? profile.TotalPlaytimeSeconds ?? 0));
    _currUser.syncConnected = true;
    _currUser.importCloud = true;
    _loadCurrentUserIntoForm();
    _renderSetupUsers();
    _renderSetupCloudProfile();
    _setupShowRegistration();
}

function _renderSetupCloudProfile() {
    const avatar = document.getElementById('setupCloudAvatar');
    const name = document.getElementById('setupCloudProfileName');
    const playtime = document.getElementById('setupCloudPlaytime');
    if (!avatar || !name || !playtime || !_currUser) return;
    name.textContent = _currUser.name || 'Doorpi';
    if (_currUser.photoBase64) {
        const src = window._doorpiUserPhotoSrc?.(_currUser.photoBase64) || `data:image/png;base64,${_currUser.photoBase64}`;
        avatar.innerHTML = `<img src="${src}" alt="" />`;
    } else {
        avatar.textContent = (_currUser.name || 'D').trim().charAt(0).toUpperCase();
    }
    const totalMinutes = Math.floor(Math.max(0, Number(_currUser.totalPlaytimeSeconds) || 0) / 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    playtime.textContent = hours === 0
        ? (minutes > 0 ? `${minutes}min` : '0h')
        : (minutes > 0 ? `${hours}h ${minutes}min` : `${hours}h`);
    const folderSection = document.getElementById('setupSectionFolders');
    const folderStep = folderSection?.querySelector('.setup-section-step');
    const folderLabel = folderSection?.querySelector('.setup-section-label');
    const folderDesc = folderSection?.querySelector('.setup-section-desc');
    if (folderStep) folderStep.textContent = _currUser.importCloud ? '01' : '05';
    if (folderLabel) folderLabel.textContent = _currUser.importCloud
        ? (typeof t === 'function' ? t('profileSyncFoldersTitle', 'Pastas para monitorar') : 'Pastas para monitorar')
        : (typeof t === 'function' ? t('setupSectionFolders', 'Pastas de jogos locais') : 'Pastas de jogos locais');
    if (folderDesc) folderDesc.textContent = _currUser.importCloud
        ? (typeof t === 'function'
            ? t('profileSyncFoldersCopy', 'Deseja monitorar alguma pasta de jogos locais ou portáteis neste dispositivo? Esta etapa é opcional.')
            : 'Deseja monitorar alguma pasta de jogos locais ou portáteis neste dispositivo? Esta etapa é opcional.')
        : (typeof t === 'function' ? t('setupFoldersDesc', '') : '');
}

// ──────────────────────────────────────────────────────────────────────────────

function openSetup(isAddingUser = false) {
    if (document.activeElement && document.activeElement !== document.body) {
        document.activeElement.blur();
    }
    _isAddingUserMode = isAddingUser;
    _setupPhase = isAddingUser ? 'auth' : 'layout';
    _setupCloudProfileId = '';
    _setupSyncConnectFromRegistration = false;
    _setupSyncMessage = '';
    _setupLayoutConfirmed = !!isAddingUser;
    _setupUsers = [{
        id: '', name: '', pin: '', photoBase64: '', apiKey: '', folders: [],
        photoSource: '', photoSourceUrl: '', photoSteamGridAssetId: 0,
        photoCropX: 0, photoCropY: 0, photoZoom: 1, totalPlaytimeSeconds: 0,
        syncConnected: false, importCloud: false
    }];
    _currUser = _setupUsers[0];
    _currentSection = null;
    document.querySelectorAll('.setup-section').forEach(sec => sec.classList.remove('expanded'));
    document.querySelectorAll('.setup-focusable:not(.setup-section-header)').forEach(el => el.tabIndex = -1);
    _setupApplyPhaseVisibility();
    _setupApplyLayoutScale(Math.round((window.DoorpiLayoutScale?.get?.() || 1) * 100), false);
    _setSetupLayoutConfirmed(_setupLayoutConfirmed);

    document.querySelectorAll('.setup-footer .setup-focusable').forEach(el => el.tabIndex = 0);

    _loadCurrentUserIntoForm();
    _renderSetupUsers();
    _renderSetupCloudProfile();

    const btnCancel = document.getElementById('btnSetupCancel');
    if (btnCancel) btnCancel.style.display = isAddingUser ? 'block' : 'none';

    // MOSTRA O BOTÃO "SAIR" SE FOR O PRIMEIRO SETUP
    const btnExit = document.getElementById('btnSetupExit');
    if (btnExit) btnExit.style.display = isAddingUser ? 'none' : 'flex';

    document.getElementById('btnSetupFinish').textContent = _setupPhase === 'layout'
        ? (typeof t === 'function' ? t('btnContinue', 'Continuar') : 'Continuar')
        : (isAddingUser ? (typeof t === 'function' ? t('addUsuario', 'Adicionar Usuário') : 'Adicionar Usuário') : (typeof t === 'function' ? t('setupStep4Finish') : 'Concluir'));
    window.isSetupOpen = true;
    isSetupOpen = true;
    document.body.classList.add('setup-active');
    window.updateDoorpiQuickMenuAvailability?.();
    const c = document.getElementById('setupContainer');
    if (c.dataset.introSetupClasses) {
        c.classList.remove(...c.dataset.introSetupClasses.split(/\s+/).filter(Boolean));
    }
    const introSetupClasses = window.DoorpiIntro?.isHandoffActive?.()
        ? (window.DoorpiIntro.getSetupClasses?.() || [])
        : [];
    if (introSetupClasses.length) c.classList.add(...introSetupClasses);
    c.dataset.introSetupClasses = introSetupClasses.join(' ');

    c.style.display = 'flex';
    requestAnimationFrame(() => {
        c.classList.add('visible');
        const header = document.querySelector('#setupSectionLayout .setup-section-header');
        if (_setupPhase === 'layout') {
            if (header && !_currentSection) _toggleSection(header.parentElement);
            header?.focus();
        } else {
            document.getElementById('btnSetupGoogle')?.focus();
        }
        _startSetupBg(); // Inicia o background animado nativo
        requestAnimationFrame(() => window.DoorpiIntro?.finishHandoff?.());
    });
}

function closeSetup() {
    isSetupOpen = false;
    const c = document.getElementById('setupContainer');
    c.style.display = 'none';
    c.classList.remove('visible');
    if (c.dataset.introSetupClasses) {
        c.classList.remove(...c.dataset.introSetupClasses.split(/\s+/).filter(Boolean));
        delete c.dataset.introSetupClasses;
    }
    _stopSetupBg(); // Para a animação do Setup ao fechar para poupar recursos
    window.focusFeaturedCard?.();
    window.isSetupOpen = false;
    document.body.classList.remove('setup-active');
    window.updateDoorpiQuickMenuAvailability?.();
}

function setupBack() {
    if (_setupPhase === 'registration') {
        _setupReturnToAuth();
        return;
    }
    closeSetup();
}

function getSetupItems() {
    const c = document.getElementById('setupContainer');
    if (!c || c.style.display === 'none') return [];
    return Array.from(c.querySelectorAll('.setup-focusable'))
        .filter(el => el.offsetWidth > 0 && el.offsetHeight > 0 && el.tabIndex !== -1);
}

window._resolveSetupNavigationTarget = function (current, direction, items) {
    if (_setupPhase !== 'registration') return null;
    const back = document.getElementById('btnSetupBackAuth');
    if (!back?.classList.contains('visible')) return null;
    const registrationEntry = items.find(item => item !== back && item.closest('.setup-form'));
    if (current === back && direction === 'DOWN') return registrationEntry || null;
    if (current === registrationEntry && direction === 'UP') return back;
    return null;
};

window.addEventListener('doorpi:native-focus-restored', () => {
    if (!window.isSetupOpen) return;
    requestAnimationFrame(() => {
        if (_setupFolderDialogPending) {
            document.getElementById('btnSetupAddFolder')?.focus({ preventScroll: true });
            return;
        }
        const items = getSetupItems().filter(item => !item.disabled);
        if (!items.length || items.includes(document.activeElement)) return;

        const preferred = _setupPhase === 'auth'
            ? document.getElementById('btnSetupGoogle')
            : document.querySelector('#setupContainer .setup-section.expanded .setup-section-header');
        const target = preferred && !preferred.disabled && items.includes(preferred)
            ? preferred
            : items[0];
        target?.focus({ preventScroll: true });
    });
});

function _shakeField(el) {
    if (!el) return;
    el.classList.remove('shake', 'error');
    el.classList.add('error');
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('shake')));
    el.addEventListener('animationend', () => el.classList.remove('shake'), { once: true });
}

function _normalizeSetupPin(value) {
    return String(value || '').replace(/\D/g, '').slice(0, 4);
}

function _isValidSetupPin(value) {
    const pin = _normalizeSetupPin(value);
    return pin.length === 0 || pin.length === 4;
}

function _setSetupPinHintError(isError) {
    const hint = document.querySelector('.setup-pin-hint');
    if (!hint) return;
    hint.textContent = typeof t === 'function'
        ? t(isError ? 'setupPinLengthError' : 'setupPinHint')
        : (isError ? 'Use 4 dígitos ou deixe vazio.' : 'Use apenas números. Deixe vazio para entrar sem PIN.');
    hint.classList.toggle('error', !!isError);
}

function _validateAndFinish() {
    if (_setupPhase === 'layout') {
        if (!_setupLayoutConfirmed) {
            _expandSection(document.getElementById('setupSectionLayout'));
            setTimeout(() => document.getElementById('setupLayoutScale')?.focus(), 80);
            return;
        }
        _setupApplyLayoutScale(Math.round(_setupPendingLayoutScale * 100), true);
        _setupShowAuthGate();
        return;
    }
    if (_setupPhase === 'auth') return;

    if (!_isAddingUserMode && !_setupLayoutConfirmed) {
        _expandSection(document.getElementById('setupSectionLayout'));
        setTimeout(() => {
            const target = document.getElementById('setupLayoutScale');
            target?.focus();
        }, 80);
        return;
    }

    for (let i = 0; i < _setupUsers.length; i++) {
        const u = _setupUsers[i];
        if (u.importCloud) continue;
        if (!u.apiKey) {
            _currUser = u; _loadCurrentUserIntoForm(); _renderSetupUsers();
            _expandSection(document.getElementById('setupSectionApiKey'));
            setTimeout(() => { _shakeField(document.getElementById('setupApiInput')); document.getElementById('setupApiInput')?.focus(); }, 80);
            return;
        }
        if (!u.name) {
            _currUser = u; _loadCurrentUserIntoForm(); _renderSetupUsers();
            _expandSection(document.getElementById('setupSectionIdentity'));
            setTimeout(() => { _shakeField(document.getElementById('setupNameInput')); document.getElementById('setupNameInput')?.focus(); }, 80);
            return;
        }
        u.pin = _normalizeSetupPin(u.pin);
        if (!_isValidSetupPin(u.pin)) {
            _currUser = u; _loadCurrentUserIntoForm(); _renderSetupUsers();
            _expandSection(document.getElementById('setupSectionIdentity'));
            _setSetupPinHintError(true);
            setTimeout(() => { _shakeField(document.getElementById('setupPinInput')); document.getElementById('setupPinInput')?.focus(); }, 80);
            return;
        }
    }

    if (!_isAddingUserMode) {
        try {
            localStorage.setItem('doorpi.firstRunTutorial.pending.v1', 'true');
            localStorage.removeItem('doorpi.firstRunTutorial.done.v1');
        } catch { }
        _setupApplyLayoutScale(Math.round(_setupPendingLayoutScale * 100), true);
    }

    if (!_isAddingUserMode) {
        window._userSwitching = true;
        window._doorpiAllowLibraryRenderDuringSessionTransition = true;
        window._userSwitchStartedAt = performance.now();
        document.body.classList.add('doorpi-session-transition');
    }

    closeSetup();

    setTimeout(() => {
        postToHost({
            action: 'saveSetupUsers',
            activeIndex: 0,
            createAll: _isAddingUserMode,
            users: _setupUsers.map(u => ({
                id: u.id || '',
                name: u.name,
                pin: u.pin || '',
                photoBase64: u.photoBase64,
                photoSource: u.photoSource || '',
                photoSourceUrl: u.photoSourceUrl || '',
                photoSteamGridAssetId: Number(u.photoSteamGridAssetId || 0),
                photoCropX: Number(u.photoCropX || 0),
                photoCropY: Number(u.photoCropY || 0),
                photoZoom: Number(u.photoZoom || 1),
                apiKey: u.apiKey,
                folders: u.folders,
                syncConnected: !!u.syncConnected,
                importCloud: !!u.importCloud
            }))
        });
    }, 150);
}

function _setupBeginGoogleConnect(fromRegistration) {
    const randomId = typeof crypto?.randomUUID === 'function'
        ? crypto.randomUUID().replaceAll('-', '')
        : `${Date.now()}${Math.floor(Math.random() * 100000)}`;
    _setupCloudProfileId = _setupCloudProfileId || `profile-${randomId}`;
    _setupSyncConnectFromRegistration = !!fromRegistration;
    _setupSyncMessage = '';
    _setupShowAuthenticating();
    postToHost({ action: 'profileSyncConnect', setup: true, profileId: _setupCloudProfileId });
}

function _bindSetupEvents() {
    const googleButton = document.getElementById('btnSetupGoogle');
    if (googleButton) {
        googleButton.innerHTML = `${window.DoorpiProfileSync?.googleIcon || ''}<span>${typeof t === 'function' ? t('profileSyncLoginGoogle', 'Entrar com Google') : 'Entrar com Google'}</span>`;
        googleButton.addEventListener('click', () => _setupBeginGoogleConnect(false));
    }
    document.getElementById('btnSetupSyncGoogle')?.addEventListener('click', () => _setupBeginGoogleConnect(true));
    document.getElementById('btnSetupRegister')?.addEventListener('click', () => {
        _setupShowRegistration();
    });

    document.querySelectorAll('.setup-section-header').forEach(header => {
        header.addEventListener('click', () => {
            const section = header.closest('.setup-section');
            _toggleSection(section);
        });
    });

    const layoutRange = document.getElementById('setupLayoutScale');
    layoutRange?.addEventListener('input', e => {
        _setupApplyLayoutScale(e.currentTarget.value, true);
    });
    layoutRange?.addEventListener('keydown', e => {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            const delta = e.key === 'ArrowRight' ? 5 : -5;
            window._setupAdjustLayoutScale?.(delta, true);
            return;
        }
    }, true);

    ['setupNameInput', 'setupPinInput', 'setupApiInput'].forEach(id => {
        const input = document.getElementById(id);
        input.addEventListener('focus', () => {
            if (!window._vkbIsOpen) {
                input.removeAttribute('readonly');
                input.style.caretColor = '';
            }
        });
        input.addEventListener('blur', () => {
            if (!window._vkbIsOpen) {
                input.setAttribute('readonly', true);
                input.style.caretColor = 'transparent';
            }
        });
        input.addEventListener('click', (e) => {
            input.removeAttribute('readonly');
            if (!window._doorpiShouldOpenVkbFromEvent?.(e)) return;
            if (!window._vkbIsOpen) window._vkbOpen?.(e.currentTarget);
        });
    });

    // EVENTO DE FECHAR O APP - Removido de dentro do forEach
    document.getElementById('btnSetupExit')?.addEventListener('click', () => {
        postToHost({ action: 'exitApp' });
    });

    document.getElementById('setupPhotoBtn').addEventListener('click', event => {
        if (typeof window.openDoorpiProfilePhotoPicker !== 'function') {
            console.error('[ProfilePhoto] Seletor de foto não foi carregado.');
            return;
        }
        window.openDoorpiProfilePhotoPicker({
            apiKey: _currUser?.apiKey || '',
            returnFocus: event.currentTarget,
            onApply: result => window._setupHandlePhotoSelected?.(result)
        });
    });
    document.getElementById('btnSetupPaste').addEventListener('click', () => { postToHost({ action: 'readClipboard' }); });

    document.getElementById('setupNameInput').addEventListener('input', (e) => {
        if (_currUser) _currUser.name = e.target.value;
        _renderSetupUsers();
        _updateStatus();
    });

    document.getElementById('setupApiInput').addEventListener('input', (e) => {
        if (_currUser) _currUser.apiKey = e.target.value;
        _updateStatus();
    });

    document.getElementById('setupPinInput').addEventListener('input', (e) => {
        const digits = _normalizeSetupPin(e.target.value);
        if (e.target.value !== digits) e.target.value = digits;
        if (_currUser) _currUser.pin = digits;
        _setSetupPinHintError(digits.length > 0 && digits.length < 4);
    });

    document.getElementById('btnSetupApiLink').addEventListener('click', () => {
        postToHost({ action: 'launchMediaApp', url: 'https://www.steamgriddb.com/profile/preferences/api', appType: 'webview' });
    });

    document.getElementById('btnSetupAddFolder').addEventListener('click', () => {
        _setupFolderDialogPending = true;
        postToHost({
            action: 'pickFolderForSetup',
            dialogTitle: typeof t === 'function' ? t('dlgFolderTitle') : 'Selecionar',
            forbiddenMsg: typeof t === 'function' ? t('msgFolderForbidden') : 'Proibido',
            forbiddenTitle: typeof t === 'function' ? t('msgFolderForbiddenTitle') : 'Aviso',
        });
    });

    document.getElementById('btnSetupCancel')?.addEventListener('click', () => {
        closeSetup();
        if (_isAddingUserMode) {
            postToHost({ action: 'requestUsers' });
        }
    });

    document.getElementById('btnSetupBackAuth')?.addEventListener('click', _setupReturnToAuth);

    document.getElementById('btnSetupFinish').addEventListener('click', _validateAndFinish);

    // CORREÇÕES DE NAVEGAÇÃO PRO RODAPÉ (Forçar botão Concluir primeiro)

    // 1. Ao descer pelo botão de Adicionar Pasta
    document.getElementById('btnSetupAddFolder').addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            e.stopPropagation();
            document.getElementById('btnSetupFinish')?.focus();
        }
    });

    // 2. Ao descer pela barra do Passo 03 (quando fechada)
    const folderHeader = document.querySelector('[data-section="folders"]');
    if (folderHeader) {
        folderHeader.addEventListener('keydown', (e) => {
            const section = document.getElementById('setupSectionFolders');
            if (e.key === 'ArrowDown' && !section.classList.contains('expanded')) {
                e.preventDefault();
                e.stopPropagation();
                document.getElementById('btnSetupFinish')?.focus();
            }
        });
    }

    // 3. Ao subir pelo botão Concluir (para garantir que a volta funcione perfeita)
    document.getElementById('btnSetupFinish').addEventListener('keydown', (e) => {
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            e.stopPropagation();
            const section = document.getElementById('setupSectionFolders');
            if (section && section.classList.contains('expanded')) {
                document.getElementById('btnSetupAddFolder')?.focus();
            } else {
                folderHeader?.focus();
            }
        }
    });
}


function _renderSetupFolders() {
    const list = document.getElementById('setupFolderList');
    if (!list || !_currUser) return;

    const deleteSvg = `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;

    list.innerHTML = _currUser.folders.map((f, i) => `
        <div class="setup-folder-item">
            <span class="setup-folder-path" title="${f}">${f}</span>
            <button class="setup-btn-delete setup-focusable" data-idx="${i}" tabindex="-1" title="${typeof t === 'function' ? t('titleRemoveFolder') : 'Remover Pasta'}">
                ${deleteSvg}
            </button>
        </div>`).join('');

    list.querySelectorAll('.setup-btn-delete').forEach((btn, idx, allBtns) => {
        // CORREÇÃO: Força o foco correto nas pastas e impede que o sistema intercepte
        btn.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                e.stopPropagation(); // Trava a navegação global
                // Se houver mais pastas abaixo, desce pro próximo X, senão vai pro Adicionar
                if (idx < allBtns.length - 1) {
                    allBtns[idx + 1].focus();
                } else {
                    document.getElementById('btnSetupAddFolder')?.focus();
                }
            } else if (e.key === 'ArrowUp' && idx > 0) {
                e.preventDefault();
                e.stopPropagation();
                allBtns[idx - 1].focus(); // Volta pro X da pasta acima
            }
        });

        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.idx);
            _currUser.folders.splice(idx, 1);
            _renderSetupFolders();
            _updateStatus();

            setTimeout(() => {
                const newBtns = document.getElementById('setupFolderList').querySelectorAll('.setup-btn-delete');
                if (newBtns.length > 0) {
                    const focusIdx = Math.min(idx, newBtns.length - 1);
                    newBtns[focusIdx]?.focus();
                } else {
                    document.getElementById('btnSetupAddFolder')?.focus();
                }
            }, 50);
        });
    });

    const folderSec = document.getElementById('setupSectionFolders');
    if (folderSec && folderSec.classList.contains('expanded')) {
        list.querySelectorAll('.setup-focusable').forEach(el => el.tabIndex = 0);
    }
}
window._setupHandlePhotoSelected = (photo) => {
    if (!_currUser) return;
    if (typeof photo === 'string') {
        _currUser.photoBase64 = photo;
    } else if (photo) {
        _currUser.photoBase64 = photo.base64 || '';
        _currUser.photoSource = photo.photoSource || '';
        _currUser.photoSourceUrl = photo.photoSourceUrl || '';
        _currUser.photoSteamGridAssetId = Number(photo.photoSteamGridAssetId || 0);
        _currUser.photoCropX = Number(photo.photoCropX || 0);
        _currUser.photoCropY = Number(photo.photoCropY || 0);
        _currUser.photoZoom = Number(photo.photoZoom || 1);
    }
    _loadCurrentUserIntoForm();
    _renderSetupUsers();
};

window._setupHandleFolderDialogClosed = (path) => {
    _setupFolderDialogPending = false;
    if (_currUser && !_currUser.folders.includes(path)) {
        if (path) _currUser.folders.push(path);
        _renderSetupFolders();
        _updateStatus();
    }
    requestAnimationFrame(() => {
        const addFolder = document.getElementById('btnSetupAddFolder');
        addFolder?.focus({ preventScroll: true });
        addFolder?.scrollIntoView({ block: 'nearest' });
    });
};

window._setupHandleFolderAdded = path => window._setupHandleFolderDialogClosed?.(path);

window.addEventListener('doorpi:profile-sync-message', event => {
    const data = event.detail || {};
    if (!window.isSetupOpen) return;
    if (!data.setup && data.type !== 'profileSyncSetupResult') return;
    if (data.type === 'profileSyncBusy') {
        if (data.busy && _setupPhase === 'authenticating') {
            _setupSetAuthenticatingMessage(data.message || '');
            return;
        }
        if (!data.busy && _setupPhase === 'authenticating') {
            setTimeout(() => {
                if (_setupPhase !== 'authenticating') return;
                const failure = typeof t === 'function'
                    ? t('profileSyncFailed', 'Não foi possível conectar.')
                    : 'Não foi possível conectar.';
                if (_setupSyncConnectFromRegistration) _setupShowRegistrationSyncError(failure);
                else _setupShowAuthError(failure);
            }, 180);
            return;
        }
        const authStatus = document.getElementById('setupAuthStatus');
        if (!data.busy && _setupPhase === 'auth' && authStatus?.classList.contains('error')) {
            return;
        }
        _setupSetAuthBusy(!!data.busy, data.message || '');
        return;
    }
    if (data.type === 'profileSyncSetupResult') {
        _setupSetAuthBusy(false);
        _setupCloudProfileId = data.profileId || _setupCloudProfileId;
        if (data.alreadyLocal) {
            _setupCloudProfileId = '';
            const message = typeof t === 'function'
                ? t('profileSyncAlreadyLocal', 'Esta conta Google já está vinculada a um perfil neste dispositivo.')
                : 'Esta conta Google já está vinculada a um perfil neste dispositivo.';
            if (_currUser) {
                _currUser.id = '';
                _currUser.syncConnected = false;
                _currUser.importCloud = false;
            }
            if (_setupSyncConnectFromRegistration) _setupShowRegistrationSyncError(message);
            else _setupShowAuthError(message);
            return;
        }
        if (!data.remoteExists) {
            if (_currUser) {
                _currUser.id = _setupCloudProfileId;
                _currUser.syncConnected = true;
                _currUser.importCloud = false;
            }
            _setupSyncMessage = typeof t === 'function'
                ? t('setupGoogleSyncEnabled', 'Sincronização ativada')
                : 'Sincronização ativada';
            const preferredSection = _setupSyncConnectFromRegistration ? 'setupSectionGoogleSync' : '';
            _setupSyncConnectFromRegistration = false;
            _setupShowRegistration(preferredSection);
            return;
        }

        _setupSyncConnectFromRegistration = false;
        _setupApplyRemoteProfile(data);
        return;
    }
    if (data.type === 'profileSyncResult' && data.status && !['Synced', 'Uploaded', 'Downloaded', 'Disconnected'].includes(data.status)) {
        const failure = data.message || (data.status === 'Offline'
            ? (typeof t === 'function' ? t('profileSyncOffline', 'Sem conexão. Os dados locais foram mantidos.') : 'Sem conexão. Os dados locais foram mantidos.')
            : data.status === 'AuthenticationRequired'
                ? (typeof t === 'function' ? t('profileSyncAuthRequired', 'Entre novamente para sincronizar.') : 'Entre novamente para sincronizar.')
                : (typeof t === 'function' ? t('profileSyncFailed', 'Não foi possível conectar.') : 'Não foi possível conectar.'));
        if (_setupSyncConnectFromRegistration) _setupShowRegistrationSyncError(failure);
        else _setupShowAuthError(failure);
    }
});
