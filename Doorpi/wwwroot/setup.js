// =============================================================================
// setup.js — Formulário de primeira configuração (TV-friendly, accordion)
// =============================================================================

const _setupData = { name: '', photoBase64: '', apiKey: '', browserPath: '', browserExe: '', folders: [] };

// ── Estilos ───────────────────────────────────────────────────────────────────
(function injectSetupStyles() {
    const s = document.createElement('style');
    s.textContent = `
    #setupContainer {
        position: fixed;
        inset: 0;
        z-index: 9000;
        display: none;
        align-items: flex-start;
        justify-content: center;
        background: #0a0a20;
        backdrop-filter: blur(40px);
        overflow-y: auto;
        padding: clamp(36px, 5vh, 72px) clamp(24px, 5vw, 80px);
        box-sizing: border-box;
        scroll-behavior: auto;
        align-items: center;
    }

    #setupContainer.visible { animation: setupFadeIn 0.35s ease forwards; }

    #setupBg {
        position: fixed;
        inset: 0;
        width: 100%;
        height: 100%;
        z-index: 0;
        pointer-events: none;
    }
    .setup-form {
        position: relative;
        z-index: 1;
    }
    @keyframes setupFadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }

    .setup-form {
        width: min(760px, 96vw);
        display: flex;
        flex-direction: column;
        gap: clamp(8px, 1vw, 14px);
        margin: 0 auto;
    }

    /* ── Cabeçalho ── */
    .setup-header {
        text-align: center;
        margin-bottom: clamp(16px, 2vw, 28px);
    }
    .setup-header-eyebrow {
        display: block;
        font-size: clamp(0.7rem, 0.9vw, 1.05rem);
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.3em;
        color: rgba(255,255,255,0.35);
        margin: 0 0 clamp(10px, 1.2vw, 16px);
    }
    .setup-header-title {
        font-size: clamp(2.4rem, 4.2vw, 5.4rem);
        font-weight: 200;
        letter-spacing: -0.03em;
        color: #ffffff;
        margin: 0 0 clamp(10px, 1.2vw, 16px);
        line-height: 1.05;
        text-shadow: 0 2px 40px rgba(80,100,255,0.25);
    }
    .setup-header-subtitle {
        font-size: clamp(0.95rem, 1.1vw, 1.4rem);
        color: rgba(255,255,255,0.55);
        margin: 0 auto;
        max-width: 520px;
        line-height: 1.6;
        font-weight: 300;
    }

    /* ── Seções — accordion ── */
    .setup-section {
        background: rgba(255,255,255,0.07);
        border: 1px solid rgba(255,255,255,0.13);
        border-radius: clamp(14px, 1.6vw, 20px);
        overflow: hidden;
        transition: border-color 0.3s, background 0.3s;
    }
    .setup-section.expanded {
        background: rgba(255,255,255,0.10);
        border-color: rgba(255,255,255,0.22);
    }

    /* ── Cabeçalho da seção (focusável) ── */
    .setup-section-header {
        display: flex;
        align-items: center;
        gap: clamp(10px, 1.1vw, 16px);
        padding: clamp(18px, 2vw, 28px) clamp(20px, 2.2vw, 32px);
        cursor: pointer;
        outline: none;
        width: 100%;
        background: none;
        border: none;
        text-align: left;
        font-family: 'Outfit', sans-serif;
        transition: background 0.2s;
        border-radius: clamp(14px, 1.6vw, 20px);
        filter: drop-shadow(2px 3px 0px black);
    }
    .setup-section-header:focus {
        background: rgba(255,255,255,0.06);
        box-shadow: inset 0 0 0 2px rgba(255,255,255,0.30);
    }
    .setup-section.expanded .setup-section-header {
        border-radius: clamp(14px, 1.6vw, 20px) clamp(14px, 1.6vw, 20px) 0 0;
    }

    /* Número do passo */
    .setup-section-step {
        font-size: clamp(0.72rem, 0.82vw, 0.98rem);
        font-weight: 700;
        letter-spacing: 0.08em;
        color: rgba(255,255,255,0.28);
        flex-shrink: 0;
        width: 2em;
        text-align: center;
        transition: color 0.3s;
    }
    .setup-section.expanded .setup-section-step {
        color: rgba(255,255,255,0.55);
    }

    .setup-section-label {
        font-size: clamp(0.85rem, 1vw, 1.2rem);
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: rgba(255,255,255,0.60);
        flex: 1;
    }
    .setup-section.expanded .setup-section-label {
        color: rgba(255,255,255,0.92);
    }

    /* Status indicator */
    .setup-section-status {
        width: clamp(20px, 2vw, 28px);
        height: clamp(20px, 2vw, 28px);
        border-radius: 50%;
        border: 2px solid rgba(255,255,255,0.22);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        font-size: clamp(0.6rem, 0.75vw, 0.9rem);
        color: transparent;
        transition: all 0.3s;
    }
    .setup-section-status.done {
        background: rgba(100,220,120,0.2);
        border-color: rgba(100,220,120,0.7);
        color: rgba(100,220,120,1);
    }
    .setup-section-status.required-empty {
        border-color: rgba(255,255,255,0.22);
    }

    .setup-optional-badge {
        font-size: clamp(0.6rem, 0.68vw, 0.82rem);
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: rgba(255,255,255,0.28);
        background: rgba(255,255,255,0.07);
        border: 1px solid rgba(255,255,255,0.14);
        border-radius: 5px;
        padding: 3px 8px;
        flex-shrink: 0;
    }

    /* Chevron SVG — sem emoji */
    .setup-section-chevron {
        width: clamp(18px, 1.8vw, 24px);
        height: clamp(18px, 1.8vw, 24px);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        opacity: 0.30;
        transition: transform 0.35s cubic-bezier(0.22,1,0.36,1), opacity 0.2s;
    }
    .setup-section-chevron svg {
        width: 100%; height: 100%;
        stroke: #fff; fill: none;
        stroke-width: 2;
        stroke-linecap: round;
        stroke-linejoin: round;
    }
    .setup-section.expanded .setup-section-chevron {
        transform: rotate(90deg);
        opacity: 0.65;
    }

    /* ── Corpo colapsável (grid trick) ── */
    .setup-section-body {
        display: grid;
        grid-template-rows: 0fr;
        transition: grid-template-rows 0.4s cubic-bezier(0.22,1,0.36,1);
    }
    .setup-section.expanded .setup-section-body {
        grid-template-rows: 1fr;
    }
    .setup-section-body-inner {
        overflow: hidden;
    }
    .setup-section-content {
        padding: 0 clamp(20px, 2.2vw, 32px) clamp(20px, 2.2vw, 30px);
        display: flex;
        flex-direction: column;
        gap: clamp(14px, 1.5vw, 20px);
    }

    /* Divisor interno */
    .setup-section-divider {
        height: 1px;
        background: rgba(255,255,255,0.10);
        margin-bottom: clamp(2px, 0.3vw, 6px);
    }

    /* Descrição curta */
    .setup-section-desc {
        font-size: clamp(0.85rem, 0.95vw, 1.15rem);
        color: rgba(255,255,255,0.50);
        margin: 0;
        line-height: 3.6;
        font-weight: 300;
    }
    .setup-section-desc strong { color: rgba(255,255,255,0.78); font-weight: 500; }

    /* ── Identidade ── */
    .setup-identity-row {
        display: flex;
        align-items: center;
        gap: clamp(16px, 1.8vw, 26px);
    }
    .setup-photo-btn {
        width: clamp(68px, 7.5vw, 100px);
        height: clamp(68px, 7.5vw, 100px);
        border-radius: 50%;
        background: rgba(255,255,255,0.07);
        border: 2px dashed rgba(255,255,255,0.25);
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        color: rgba(255,255,255,0.30);
        cursor: pointer;
        outline: none;
        flex-shrink: 0;
        transition: border-color 0.2s, background 0.2s, transform 0.2s, box-shadow 0.2s;
        position: relative;
    }
    .setup-photo-btn svg {
        width: 38%; height: 38%;
        stroke: currentColor; fill: none;
        stroke-width: 1.5; stroke-linecap: round;
        overflow: visible;
    }
    .setup-photo-btn img { width:100%; height:100%; object-fit:cover; position:absolute; inset:0; }
    .setup-photo-btn:focus, .setup-photo-btn:hover {
        border-color: rgba(255,255,255,0.9);
        background: rgba(255,255,255,0.1);
        transform: scale(1.05);
        box-shadow: 0 0 0 4px rgba(255,255,255,0.15);
    }
    .setup-photo-btn.has-photo { border-style:solid; border-color:rgba(255,255,255,0.35); }

    .setup-name-wrap {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: clamp(6px, 0.7vw, 10px);
    }
    .setup-field-label {
        font-size: clamp(0.68rem, 0.76vw, 0.9rem);
        color: rgba(255,255,255,0.45);
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.12em;
    }

    /* ── Inputs ── */
    .setup-input {
        width: 100%;
        background: rgba(255,255,255,0.09);
        border: 1px solid rgba(255,255,255,0.18);
        border-radius: clamp(10px, 1vw, 13px);
        padding: clamp(14px, 1.5vw, 20px) clamp(16px, 1.7vw, 22px);
        color: #fff;
        font-size: clamp(1rem, 1.15vw, 1.5rem);
        font-family: 'Outfit', sans-serif;
        font-weight: 400;
        outline: none;
        box-sizing: border-box;
        cursor: pointer;
        caret-color: transparent;
        transition: border-color 0.18s, background 0.18s, box-shadow 0.18s;
    }
    .setup-input:focus {
        border-color: rgba(255,255,255,0.9);
        background: rgba(255,255,255,0.12);
        box-shadow: 0 0 0 4px rgba(255,255,255,0.12);
    }
    .setup-input.vkb-active {
        border-color: rgba(100,160,255,0.7);
        box-shadow: 0 0 0 4px rgba(100,160,255,0.15);
        caret-color: rgba(100,160,255,0.9);
    }
    .setup-input.error {
        border-color: rgba(255,80,80,0.8);
        box-shadow: 0 0 0 4px rgba(255,80,80,0.12);
    }
    .setup-input::placeholder { color: rgba(255,255,255,0.22); }

    @keyframes setupShake {
        0%,100% { transform: translateX(0); }
        20% { transform: translateX(-8px); }
        40% { transform: translateX(8px); }
        60% { transform: translateX(-5px); }
        80% { transform: translateX(5px); }
    }
    .shake { animation: setupShake 0.33s ease; }

    /* ── API row ── */
    .setup-api-row {
        display: flex;
        gap: clamp(8px, 0.9vw, 12px);
        align-items: stretch;
    }
    .setup-api-row .setup-input { flex: 1; }

    .setup-icon-btn {
        background: rgba(255,255,255,0.09);
        border: 1px solid rgba(255,255,255,0.18);
        border-radius: clamp(10px, 1vw, 13px);
        color: rgba(255,255,255,0.72);
        font-size: clamp(0.82rem, 0.92vw, 1.12rem);
        font-family: 'Outfit', sans-serif;
        font-weight: 600;
        padding: 0 clamp(16px, 1.7vw, 24px);
        cursor: pointer;
        outline: none;
        white-space: nowrap;
        transition: all 0.15s;
        display: flex;
        align-items: center;
        gap: 7px;
    }
    .setup-icon-btn:focus, .setup-icon-btn:hover {
        background: rgba(255,255,255,0.18);
        border-color: rgba(255,255,255,0.9);
        color: #fff;
        box-shadow: 0 0 0 4px rgba(255,255,255,0.12);
    }
    .setup-api-link-btn {
        background: rgba(100,160,255,0.09);
        border: 1px solid rgba(100,160,255,0.25);
        border-radius: clamp(10px, 1vw, 13px);
        color: rgba(140,190,255,0.9);
        font-size: clamp(0.8rem, 0.88vw, 1.08rem);
        font-family: 'Outfit', sans-serif;
        font-weight: 600;
        padding: 0 clamp(16px, 1.7vw, 24px);
        cursor: pointer;
        outline: none;
        white-space: nowrap;
        transition: all 0.15s;
        display: flex;
        align-items: center;
        gap: 6px;
    }
    .setup-api-link-btn:focus, .setup-api-link-btn:hover {
        background: rgba(100,160,255,0.20);
        border-color: rgba(100,160,255,0.9);
        color: rgba(200,225,255,1);
        box-shadow: 0 0 0 4px rgba(100,160,255,0.15);
    }
    .setup-api-hint {
        font-size: clamp(0.8rem, 0.88vw, 1.05rem);
        color: rgba(255,255,255,0.38);
        margin: 0;
        transition: color 0.2s;
    }
    .setup-api-hint.success { color: rgba(100,220,120,0.9); }
    .setup-api-hint.error   { color: rgba(255,100,100,0.9); }

    /* ── Pastas ── */
    .setup-folder-list {
        display: flex;
        flex-direction: column;
        gap: clamp(7px, 0.8vw, 11px);
    }
    .setup-folder-item {
        display: flex;
        align-items: center;
        gap: 12px;
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.10);
        border-radius: clamp(8px, 0.9vw, 12px);
        padding: clamp(11px, 1.2vw, 16px) clamp(14px, 1.5vw, 20px);
        animation: setupFadeIn 0.2s ease;
    }
    .setup-folder-path {
        flex: 1;
        font-size: clamp(0.82rem, 0.9vw, 1.08rem);
        color: rgba(255,255,255,0.72);
        font-family: 'Cascadia Code', 'SF Mono', monospace;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .setup-folder-remove {
        background: none;
        border: none;
        color: rgba(255,80,80,0.40);
        cursor: pointer;
        font-size: clamp(0.8rem, 0.88vw, 1.05rem);
        padding: 4px 10px;
        border-radius: 6px;
        outline: none;
        transition: color 0.15s, box-shadow 0.15s;
        flex-shrink: 0;
        font-family: inherit;
    }
    .setup-folder-remove:focus, .setup-folder-remove:hover {
        color: rgba(255,80,80,1);
        box-shadow: 0 0 0 3px rgba(255,80,80,0.25);
    }

    /* ── Browser list ── */
    .setup-browser-list {
        display: flex;
        flex-direction: column;
        gap: clamp(8px, 0.9vw, 12px);
    }
    .setup-browser-empty {
        font-size: clamp(0.85rem, 0.95vw, 1.15rem);
        color: rgba(255,255,255,0.38);
        font-style: italic;
    }
    .setup-browser-item {
        display: flex;
        align-items: center;
        gap: clamp(14px, 1.4vw, 20px);
        background: rgba(255,255,255,0.06);
        border: 2px solid rgba(255,255,255,0.13);
        border-radius: clamp(10px, 1vw, 14px);
        padding: clamp(14px, 1.5vw, 20px) clamp(18px, 1.8vw, 26px);
        cursor: pointer;
        outline: none;
        text-align: left;
        transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
        width: 100%;
        box-sizing: border-box;
        font-family: 'Outfit', sans-serif;
    }
    .setup-browser-item:focus, .setup-browser-item:hover {
        background: rgba(255,255,255,0.10);
        border-color: rgba(255,255,255,0.9);
        box-shadow: 0 0 0 4px rgba(255,255,255,0.12);
    }
    .setup-browser-item.selected {
        background: rgba(255,255,255,0.11);
        border-color: rgba(255,255,255,0.9);
        box-shadow: 0 0 0 4px rgba(255,255,255,0.12);
    }
    .setup-browser-radio {
        width: clamp(18px, 1.8vw, 24px);
        height: clamp(18px, 1.8vw, 24px);
        border-radius: 50%;
        border: 2px solid rgba(255,255,255,0.35);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        transition: border-color 0.15s;
    }
    .setup-browser-item.selected .setup-browser-radio { border-color: #fff; }
    .setup-browser-radio-dot {
        width: clamp(8px, 0.9vw, 11px);
        height: clamp(8px, 0.9vw, 11px);
        border-radius: 50%;
        background: #fff;
        opacity: 0;
        transform: scale(0.3);
        transition: opacity 0.15s, transform 0.2s cubic-bezier(0.22,1,0.36,1);
    }
    .setup-browser-item.selected .setup-browser-radio-dot { opacity: 1; transform: scale(1); }
    .setup-browser-info { flex: 1; min-width: 0; }
    .setup-browser-name {
        font-size: clamp(0.95rem, 1.05vw, 1.3rem);
        font-weight: 600;
        color: rgba(255,255,255,0.92);
        display: block;
        margin-bottom: 3px;
    }
    .setup-browser-path {
        font-size: clamp(0.7rem, 0.78vw, 0.92rem);
        color: rgba(255,255,255,0.38);
        font-family: 'Cascadia Code', 'SF Mono', monospace;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        display: block;
    }

    /* ── Rodapé ── */
    .setup-footer {
        display: flex;
        justify-content: center;
        padding: clamp(8px, 1vw, 14px) 0 clamp(16px, 1.8vw, 28px);
    }
    .setup-finish-btn {
        background: rgba(255,255,255,0.92);
        border: 2px solid transparent;
        border-radius: clamp(12px, 1.2vw, 16px);
        color: #06060e;
        font-family: 'Outfit', sans-serif;
        font-size: clamp(1rem, 1.15vw, 1.5rem);
        font-weight: 700;
        padding: clamp(15px, 1.6vw, 22px) clamp(52px, 5.2vw, 80px);
        cursor: pointer;
        outline: none;
        letter-spacing: 0.02em;
        transition: all 0.2s cubic-bezier(0.22,1,0.36,1);
        box-shadow: 0 6px 24px rgba(0,0,0,0.35);
    }
    .setup-finish-btn:focus, .setup-finish-btn:hover {
        background: #fff;
        transform: translateY(-2px) scale(1.03);
        box-shadow: 0 0 0 5px rgba(255,255,255,0.2), 0 16px 36px rgba(0,0,0,0.5);
    }

    /* ── Escalonamento para resoluções até 900p (≤1600px × ≤900px) ── */
    @media (max-height: 900px), (max-width: 1600px) {
        .setup-form {
            width: min(620px, 92vw);
            gap: 7px;
        }
        .setup-header {
            margin-bottom: 14px;
        }
        .setup-header-eyebrow {
            font-size: 0.68rem;
            margin-bottom: 8px;
        }
        .setup-header-title {
            font-size: clamp(1.7rem, 3vw, 2.8rem);
            margin-bottom: 8px;
        }
        .setup-header-subtitle {
            font-size: clamp(0.82rem, 1vw, 1.05rem);
        }
        .setup-section-header {
            padding: 14px 20px;
            gap: 10px;
        }
        .setup-section-label {
            font-size: clamp(0.72rem, 0.85vw, 0.95rem);
        }
        .setup-section-step {
            font-size: 0.68rem;
        }
        .setup-section-status {
            width: 18px;
            height: 18px;
            font-size: 0.58rem;
        }
        .setup-section-chevron {
            width: 16px;
            height: 16px;
        }
        .setup-optional-badge {
            font-size: 0.56rem;
            padding: 2px 6px;
        }
        .setup-section-content {
            padding: 0 20px 18px;
            gap: 12px;
        }
        .setup-section-desc {
            font-size: clamp(0.76rem, 0.88vw, 0.95rem);
        }
        .setup-input {
            font-size: clamp(0.85rem, 1vw, 1.1rem);
            padding: 11px 14px;
        }
        .setup-icon-btn,
        .setup-api-link-btn {
            font-size: clamp(0.72rem, 0.82vw, 0.92rem);
            padding: 0 14px;
        }
        .setup-api-hint {
            font-size: 0.76rem;
        }
        .setup-field-label {
            font-size: 0.62rem;
        }
        .setup-photo-btn {
            width: 56px;
            height: 56px;
        }
        .setup-browser-item {
            padding: 12px 16px;
            gap: 12px;
        }
        .setup-browser-name {
            font-size: clamp(0.82rem, 0.92vw, 1rem);
        }
        .setup-browser-path {
            font-size: 0.64rem;
        }
        .setup-browser-radio {
            width: 16px;
            height: 16px;
        }
        .setup-browser-radio-dot {
            width: 7px;
            height: 7px;
        }
        .setup-folder-path {
            font-size: 0.76rem;
        }
        .setup-finish-btn {
            font-size: clamp(0.88rem, 1vw, 1.1rem);
            padding: 13px 48px;
        }
        .setup-footer {
            padding: 8px 0 16px;
        }
    }

    /* ── 720p exato — aperto extra ── */
    @media (max-height: 768px) {
        .setup-header-title {
            font-size: clamp(1.45rem, 2.6vw, 2.2rem);
        }
        .setup-header {
            margin-bottom: 10px;
        }
        .setup-section-header {
            padding: 19px 20px;
        }
        .setup-section-content {
            padding: 0 18px 14px;
            gap: 10px;
        }
        .setup-input {
            padding: 9px 13px;
        }
        .setup-form {
            gap: 5px;
        }
    }
    `;
    document.head.appendChild(s);
})();

// ── HTML ──────────────────────────────────────────────────────────────────────
(function buildSetupHTML() {
    const container = document.getElementById('setupContainer');
    if (!container) return;

    const chevron = `<span class="setup-section-chevron"><svg viewBox="0 0 24 24"><polyline points="9 6 15 12 9 18"/></svg></span>`;
    const personSvg = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>`;

    container.innerHTML = `
    <canvas id="setupBg"></canvas>
    <div class="setup-form">

        <div class="setup-header">
            <span class="setup-header-eyebrow" data-i18n="setupEyebrow"></span>
            <h1 class="setup-header-title" data-i18n="setupStep1Title"></h1>
            <p class="setup-header-subtitle" data-i18n="setupHeaderSubtitle"></p>
        </div>

        <!-- Seção 1: Identidade (opcional) -->
        <div class="setup-section" id="setupSectionIdentity">
            <button class="setup-section-header setup-focusable" data-section="identity">
                <span class="setup-section-step">01</span>
                <span class="setup-section-label" data-i18n="setupSectionIdentity"></span>
                <span class="setup-section-status" id="statusIdentity"></span>
                <span class="setup-optional-badge" data-i18n="setupOptional"></span>
                ${chevron}
            </button>
            <div class="setup-section-body">
                <div class="setup-section-body-inner">
                    <div class="setup-section-content">
                        <div class="setup-section-divider"></div>
                        <p class="setup-section-desc" data-i18n="setupIdentityDesc"></p>
                        <div class="setup-identity-row">
                            <button class="setup-photo-btn setup-focusable" id="setupPhotoBtn" tabindex="-1">${personSvg}</button>
                            <div class="setup-name-wrap">
                                <span class="setup-field-label" data-i18n="setupNameLabel"></span>
                                <input class="setup-input setup-focusable" id="setupNameInput" type="text" readonly tabindex="-1" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Seção 2: API Key (obrigatório) -->
        <div class="setup-section" id="setupSectionApiKey">
            <button class="setup-section-header setup-focusable" data-section="apikey">
                <span class="setup-section-step">02</span>
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
                            <input class="setup-input setup-focusable" id="setupApiInput" type="text" readonly tabindex="-1" />
                            <button class="setup-icon-btn setup-focusable" id="btnSetupPaste" tabindex="-1"><span data-i18n="setupStep3PasteMode"></span></button>
                            <button class="setup-api-link-btn setup-focusable" id="btnSetupApiLink" tabindex="-1"><span data-i18n="setupStep3LinkText"></span></button>
                        </div>
                        <p class="setup-api-hint" id="setupApiHint" data-i18n="setupStep3PasteHint"></p>
                    </div>
                </div>
            </div>
        </div>

        <!-- Seção 3: Navegador (obrigatório) -->
        <div class="setup-section" id="setupSectionBrowser">
            <button class="setup-section-header setup-focusable" data-section="browser">
                <span class="setup-section-step">03</span>
                <span class="setup-section-label" data-i18n="setupSectionBrowser"></span>
                <span class="setup-section-status required-empty" id="statusBrowser"></span>
                ${chevron}
            </button>
            <div class="setup-section-body">
                <div class="setup-section-body-inner">
                    <div class="setup-section-content">
                        <div class="setup-section-divider"></div>
                        <p class="setup-section-desc" data-i18n="setupBrowserDesc"></p>
                        <div class="setup-browser-list" id="setupBrowserList">
                            <span class="setup-browser-empty" data-i18n="setupBrowserScanning"></span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Seção 4: Pastas (opcional) -->
        <div class="setup-section" id="setupSectionFolders">
            <button class="setup-section-header setup-focusable" data-section="folders">
                <span class="setup-section-step">04</span>
                <span class="setup-section-label" data-i18n="setupSectionFolders"></span>
                <span class="setup-section-status" id="statusFolders"></span>
                <span class="setup-optional-badge" data-i18n="setupOptional"></span>
                ${chevron}
            </button>
            <div class="setup-section-body">
                <div class="setup-section-body-inner">
                    <div class="setup-section-content">
                        <div class="setup-section-divider"></div>
                        <p class="setup-section-desc" data-i18n="setupFoldersDesc"></p>
                        <div class="setup-folder-list" id="setupFolderList"></div>
                        <button class="setup-icon-btn setup-focusable" id="btnSetupAddFolder" tabindex="-1" style="align-self:flex-start">
                            + <span data-i18n="setupStep4AddFolder"></span>
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <div class="setup-footer">
            <button class="setup-finish-btn setup-focusable" id="btnSetupFinish" data-i18n="setupStep4Finish"></button>
        </div>

    </div>`;

    applyI18n();
    document.getElementById('setupNameInput').placeholder = t('setupStep1Placeholder');
    document.getElementById('setupApiInput').placeholder = t('setupStep3Placeholder');

    _bindSetupEvents();
})();

// ── Accordion ─────────────────────────────────────────────────────────────────
let _currentSection = null;

function _expandSection(sectionEl) {
    if (_currentSection && _currentSection !== sectionEl) {
        _collapseSection(_currentSection);
    }
    sectionEl.classList.add('expanded');
    _currentSection = sectionEl;
    sectionEl.querySelectorAll('.setup-focusable:not(.setup-section-header)').forEach(el => {
        el.tabIndex = 0;
    });
}

function _collapseSection(sectionEl) {
    sectionEl.classList.remove('expanded');
    if (_currentSection === sectionEl) _currentSection = null;
    sectionEl.querySelectorAll('.setup-focusable:not(.setup-section-header)').forEach(el => {
        el.tabIndex = -1;
    });
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

function _updateStatus() {
    const apiDone = !!document.getElementById('setupApiInput')?.value.trim();
    const statusApi = document.getElementById('statusApiKey');
    if (statusApi) {
        statusApi.textContent = apiDone ? '✓' : '';
        statusApi.className = 'setup-section-status ' + (apiDone ? 'done' : 'required-empty');
    }
    const browserDone = !!_setupData.browserPath;
    const statusBrowser = document.getElementById('statusBrowser');
    if (statusBrowser) {
        statusBrowser.textContent = browserDone ? '✓' : '';
        statusBrowser.className = 'setup-section-status ' + (browserDone ? 'done' : 'required-empty');
    }
    const nameDone = !!document.getElementById('setupNameInput')?.value.trim();
    const photoDone = !!_setupData.photoBase64;
    const statusId = document.getElementById('statusIdentity');
    if (statusId) {
        statusId.textContent = (nameDone || photoDone) ? '✓' : '';
        statusId.className = 'setup-section-status ' + ((nameDone || photoDone) ? 'done' : '');
    }
    const folderCount = _setupData.folders.length;
    const statusFolders = document.getElementById('statusFolders');
    if (statusFolders) {
        statusFolders.textContent = folderCount > 0 ? '✓' : '';
        statusFolders.className = 'setup-section-status ' + (folderCount > 0 ? 'done' : '');
    }
}

// ── Scroll suave ──────────────────────────────────────────────────────────────
function _smoothScrollSetup(container, targetScrollTop, duration = 440) {
    const start = container.scrollTop;
    const delta = targetScrollTop - start;
    if (Math.abs(delta) < 2) return;
    const t0 = performance.now();
    const ease = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    (function step(now) {
        const p = Math.min((now - t0) / duration, 1);
        container.scrollTop = start + delta * ease(p);
        if (p < 1) requestAnimationFrame(step);
    })(performance.now());
}

window._setupSmoothScroll = (targetScrollTop) => {
    const container = document.getElementById('setupContainer');
    if (container) _smoothScrollSetup(container, targetScrollTop);
};

// ── Background canvas — blobs Lissajous (animação original restaurada) ────────
// Fundo escurecido para melhor contraste com o UI. Opacidade dos blobs
// levemente reduzida para não brigar com o texto, vignette mais forte.
let _bgRaf = null;

function _startSetupBg() {
    const canvas = document.getElementById('setupBg');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const blobs = [
        { px: 0.0, py: 0.3, sx: 0.00018, sy: 0.00013, r: 0.62, color: [45, 65, 185] },
        { px: 1.2, py: 2.1, sx: 0.00014, sy: 0.00019, r: 0.56, color: [28, 85, 210] },
        { px: 2.5, py: 0.8, sx: 0.00022, sy: 0.00011, r: 0.52, color: [70, 50, 165] },
        { px: 0.7, py: 3.4, sx: 0.00016, sy: 0.00024, r: 0.50, color: [22, 110, 175] },
        { px: 3.1, py: 1.6, sx: 0.00012, sy: 0.00017, r: 0.46, color: [90, 70, 195] },
        { px: 1.8, py: 4.2, sx: 0.00020, sy: 0.00015, r: 0.42, color: [30, 130, 190] },
    ];

    let t = 0;

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    function frame() {
        const W = canvas.width, H = canvas.height;
        ctx.clearRect(0, 0, W, H);

        // Base um pouco mais escura que o original para o UI respirar melhor
        ctx.fillStyle = '#07071a';
        ctx.fillRect(0, 0, W, H);

        blobs.forEach(b => {
            const x = W * (0.15 + 0.7 * (0.5 + 0.5 * Math.sin(t * b.sx + b.px)));
            const y = H * (0.10 + 0.8 * (0.5 + 0.5 * Math.sin(t * b.sy + b.py)));
            const r = Math.min(W, H) * b.r;

            const g = ctx.createRadialGradient(x, y, 0, x, y, r);
            const [cr, cg, cb] = b.color;
            g.addColorStop(0, `rgba(${cr},${cg},${cb},0.55)`);
            g.addColorStop(0.4, `rgba(${cr},${cg},${cb},0.22)`);
            g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);

            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.ellipse(x, y, r, r * 0.72, t * 0.00004, 0, Math.PI * 2);
            ctx.fill();
        });

        // Vignette mais forte para isolar o formulário do fundo animado
        const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.85);
        vig.addColorStop(0, 'rgba(0,0,0,0)');
        vig.addColorStop(1, 'rgba(0,0,18,0.62)');
        ctx.fillStyle = vig;
        ctx.fillRect(0, 0, W, H);

        t++;
        _bgRaf = requestAnimationFrame(frame);
    }

    frame();
}

function _stopSetupBg() {
    if (_bgRaf) { cancelAnimationFrame(_bgRaf); _bgRaf = null; }
}

// ── Abrir / Fechar ────────────────────────────────────────────────────────────
function openSetup() {
    isSetupOpen = true;
    const c = document.getElementById('setupContainer');
    c.style.display = 'flex';
    requestAnimationFrame(() => {
        c.classList.add('visible');
        document.querySelector('.setup-section-header')?.focus();
        postToHost({ action: 'detectBrowsers' });
        _startSetupBg();
    });
}

function closeSetup() {
    isSetupOpen = false;
    const c = document.getElementById('setupContainer');
    c.style.display = 'none';
    c.classList.remove('visible');
    _stopSetupBg();
}

function setupBack() { closeSetup(); }

function getSetupItems() {
    const c = document.getElementById('setupContainer');
    if (!c || c.style.display === 'none') return [];
    return Array.from(c.querySelectorAll('.setup-focusable'))
        .filter(el => el.offsetWidth > 0 && el.offsetHeight > 0 && el.tabIndex !== -1);
}

// ── Validação & envio ─────────────────────────────────────────────────────────
function _shakeField(el) {
    if (!el) return;
    el.classList.remove('shake', 'error');
    el.classList.add('error');
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('shake')));
    el.addEventListener('animationend', () => el.classList.remove('shake'), { once: true });
}

function _validateAndFinish() {
    const apiInput = document.getElementById('setupApiInput');
    const apiKey = apiInput?.value.trim();

    if (!apiKey) {
        _expandSection(document.getElementById('setupSectionApiKey'));
        setTimeout(() => {
            _shakeField(apiInput);
            const hint = document.getElementById('setupApiHint');
            if (hint) { hint.textContent = t('setupStep3PasteHint'); hint.className = 'setup-api-hint error'; }
            apiInput?.focus();
        }, 80);
        return;
    }
    if (!_setupData.browserPath) {
        _expandSection(document.getElementById('setupSectionBrowser'));
        setTimeout(() => {
            const first = document.querySelector('.setup-browser-item');
            if (first) _shakeField(first);
        }, 80);
        return;
    }

    _setupData.name = document.getElementById('setupNameInput')?.value.trim() ?? '';
    _setupData.apiKey = apiKey;

    postToHost({
        action: 'saveUserProfile',
        name: _setupData.name,
        photoBase64: _setupData.photoBase64,
        apiKey: _setupData.apiKey,
        browserPath: _setupData.browserPath,
        browserExe: _setupData.browserExe,
        folders: _setupData.folders,
    });
    closeSetup();
    showGlobalLoading(t('setupLoadingTitle'), t('setupLoadingSubtitle'));
}

// ── Eventos ───────────────────────────────────────────────────────────────────
function _bindSetupEvents() {

    document.querySelectorAll('.setup-section-header').forEach(header => {
        header.addEventListener('click', () => {
            const section = header.closest('.setup-section');
            _toggleSection(section);
        });
    });

    document.getElementById('setupPhotoBtn').addEventListener('click', () => {
        postToHost({ action: 'pickProfilePhoto' });
    });

    document.getElementById('setupNameInput').addEventListener('click', () => {
        if (!window._vkbIsOpen) {
            window._vkbOpen?.(document.getElementById('setupNameInput'), {
                onOk: () => {
                    _setupData.name = document.getElementById('setupNameInput').value.trim();
                    _updateStatus();
                    window._vkbForceClose?.();
                },
                onCancel: () => window._vkbForceClose?.(),
            });
        }
    });

    document.getElementById('btnSetupPaste').addEventListener('click', () => {
        postToHost({ action: 'readClipboard' });
    });

    document.getElementById('setupApiInput').addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'v') { e.preventDefault(); postToHost({ action: 'readClipboard' }); }
    });

    document.getElementById('setupApiInput').addEventListener('click', () => {
        if (!window._vkbIsOpen) {
            window._vkbOpen?.(document.getElementById('setupApiInput'), {
                onOk: () => {
                    _setupData.apiKey = document.getElementById('setupApiInput').value.trim();
                    _updateStatus();
                    window._vkbForceClose?.();
                },
                onCancel: () => window._vkbForceClose?.(),
            });
        }
    });

    document.getElementById('btnSetupApiLink').addEventListener('click', () => {
        postToHost({ action: 'openUrl', url: 'https://www.steamgriddb.com/profile/preferences/api' });
    });

    document.getElementById('btnSetupAddFolder').addEventListener('click', () => {
        postToHost({
            action: 'pickFolderForSetup',
            dialogTitle: t('dlgFolderTitle'),
            forbiddenMsg: t('msgFolderForbidden'),
            forbiddenTitle: t('msgFolderForbiddenTitle'),
        });
    });

    document.getElementById('btnSetupFinish').addEventListener('click', _validateAndFinish);
}

// ── Render de pastas ──────────────────────────────────────────────────────────
function _renderSetupFolders() {
    const list = document.getElementById('setupFolderList');
    if (!list) return;
    list.innerHTML = _setupData.folders.map((f, i) => `
        <div class="setup-folder-item">
            <span class="setup-folder-path" title="${f}">${f}</span>
            <button class="setup-folder-remove" data-idx="${i}">✕</button>
        </div>`).join('');
    list.querySelectorAll('.setup-folder-remove').forEach(btn =>
        btn.addEventListener('click', () => {
            _setupData.folders.splice(parseInt(btn.dataset.idx), 1);
            _renderSetupFolders();
            _updateStatus();
        })
    );
}

// ── Handlers do bridge ────────────────────────────────────────────────────────
window._setupRenderBrowsers = (browsers) => {
    const list = document.getElementById('setupBrowserList');
    if (!list) return;
    if (!browsers || browsers.length === 0) {
        list.innerHTML = '<span class="setup-browser-empty" data-i18n="setupBrowserNone"></span>';
        applyI18n(list);
        return;
    }
    list.innerHTML = browsers.map((b) => `
        <button class="setup-browser-item setup-focusable" data-path="${b.path}" data-exe="${b.exe}" tabindex="-1">
            <span class="setup-browser-radio"><span class="setup-browser-radio-dot"></span></span>
            <span class="setup-browser-info">
                <span class="setup-browser-name">${b.name}</span>
                <span class="setup-browser-path">${b.path}</span>
            </span>
        </button>`).join('');

    list.querySelectorAll('.setup-browser-item').forEach(btn => {
        btn.addEventListener('click', () => {
            list.querySelectorAll('.setup-browser-item').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            _setupData.browserPath = btn.dataset.path;
            _setupData.browserExe = btn.dataset.exe;
            _updateStatus();
        });
    });

    const section = document.getElementById('setupSectionBrowser');
    if (!section.classList.contains('expanded')) {
        list.querySelectorAll('.setup-browser-item').forEach(b => b.tabIndex = -1);
    }

    const first = list.querySelector('.setup-browser-item');
    if (first) first.click();
};

window._setupHandlePhotoSelected = (base64) => {
    _setupData.photoBase64 = base64;
    const btn = document.getElementById('setupPhotoBtn');
    if (btn) {
        btn.innerHTML = `<img src="data:image/png;base64,${base64}" />`;
        btn.classList.add('has-photo');
    }
    _updateStatus();
};

window._setupHandleFolderAdded = (path) => {
    if (!_setupData.folders.includes(path)) {
        _setupData.folders.push(path);
        _renderSetupFolders();
        _updateStatus();
    }
};