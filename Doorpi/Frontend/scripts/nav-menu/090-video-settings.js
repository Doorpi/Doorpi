    function _renderSettingsSystemVideo(body) {
        if (!document.getElementById('nav-system-video-styles')) {
            const s = document.createElement('style');
            s.id = 'nav-system-video-styles';
            s.textContent = __doorpiCss("injected-styles/nav-menu/nav-system-video-styles.css");
            document.head.appendChild(s);
        }

        const scale = window.DoorpiLayoutScale?.get?.() || 1;
        const pct = Math.round(scale * 100);
        const minScale = window.DoorpiLayoutScale?.min ?? 0.25;
        const maxScale = window.DoorpiLayoutScale?.max ?? 1.80;
        const clampScale = raw => Math.max(minScale, Math.min(maxScale, Number(raw) || 1));
        const dpiScale = Math.max(0.5, Number(window.DoorpiDisplayMetrics?.dpiScale) || 1);
        const referenceScale = clampScale(1 / dpiScale);
        const compactScale = clampScale(referenceScale * .9);
        const enlargedScale = clampScale(referenceScale * 1.15);
        const refPct = Math.round(referenceScale * 100);
        const compactPct = Math.round(compactScale * 100);
        const enlargedPct = Math.round(enlargedScale * 100);
        const viewportLabel = `${Math.round(window.innerWidth)} × ${Math.round(window.innerHeight)}`;
        body.innerHTML = `
        <div class="nav-settings-subheader">
            <button class="nav-back-btn" id="setBackSystemVideo" tabindex="-1">‹ ${_t('navBack', 'Voltar')}</button>
            <h2>Tela e interface</h2>
        </div>
        <div class="nav-video-panel">
            <section class="nav-video-controls">
                <div class="nav-video-intro">
                    <span class="nav-video-kicker">Tamanho da interface</span>
                    <div class="nav-video-value" id="navVideoScaleValue">${pct}%</div>
                    <p class="nav-video-description">A escala altera cartões, textos, espaçamentos e alvos de foco em todo o Doorpi.</p>
                </div>
                <div class="nav-video-metrics">
                    <span class="nav-video-metric"><small>Área do Doorpi</small><strong>${viewportLabel}</strong></span>
                    <span class="nav-video-metric"><small>Escala do Windows</small><strong>${Math.round(dpiScale * 100)}%</strong></span>
                    <span class="nav-video-metric"><small>Base recomendada</small><strong>${refPct}%</strong></span>
                </div>
                <div class="nav-video-adjustment">
                    <span class="nav-video-adjustment-title">Escolha um perfil ou faça o ajuste fino</span>
                    <div class="nav-video-presets">
                        <button class="nav-video-preset" id="navVideoPresetCompact" data-video-scale="${compactPct}" tabindex="-1"><strong>Compacta</strong><small>${compactPct}% · mais conteúdo</small></button>
                        <button class="nav-video-preset" id="navVideoPresetRecommended" data-video-scale="${refPct}" tabindex="-1"><strong>Recomendada</strong><small>${refPct}% · equilibrada</small></button>
                        <button class="nav-video-preset" id="navVideoPresetEnlarged" data-video-scale="${enlargedPct}" tabindex="-1"><strong>Ampliada</strong><small>${enlargedPct}% · leitura distante</small></button>
                    </div>
                    <div class="nav-video-range-wrap">
                        <div class="nav-video-range-labels"><span>Menor</span><span>Ajuste fino</span><span>Maior</span></div>
                        <input class="nav-video-range" id="navVideoScale" type="range" min="25" max="180" step="5" value="${pct}" tabindex="-1">
                    </div>
                    <div class="nav-video-recommendation" id="navVideoRecommendation">A recomendação considera a escala configurada no Windows.</div>
                </div>
            </section>
            <aside class="nav-video-guidance">
                <div>
                    <span class="nav-video-kicker">Escolha com confiança</span>
                    <h3>Legibilidade ou espaço útil</h3>
                    <p>Em uma TV vista à distância, prefira alvos maiores. Em um monitor próximo, uma escala compacta mostra mais conteúdo sem alterar a resolução do Windows.</p>
                    <div class="nav-video-guide" id="navVideoGuide" aria-hidden="true">
                        <div class="nav-video-guide-status">
                            <span class="nav-video-guide-check">✓</span>
                            <span class="nav-video-guide-copy"><strong id="navVideoGuideTitle">Ajuste de referência</strong><span id="navVideoGuideText">Base recomendada: ${refPct}%</span></span>
                        </div>
                    </div>
                    <div class="nav-video-facts">
                        <span class="nav-video-fact"><span>Perfil equilibrado</span><strong>${refPct}%</strong></span>
                        <span class="nav-video-fact"><span>Mais conteúdo</span><strong>${compactPct}%</strong></span>
                        <span class="nav-video-fact"><span>Leitura à distância</span><strong>${enlargedPct}%</strong></span>
                    </div>
                </div>
                <div class="nav-video-live-note">A alteração é aplicada diretamente à interface.</div>
            </aside>
        </div>`;

        const sync = raw => {
            const next = window.DoorpiLayoutScale?.save?.(Number(raw) / 100) || 1;
            const nextPct = Math.round(next * 100);
            const value = body.querySelector('#navVideoScaleValue');
            if (value) value.textContent = `${nextPct}%`;
            body.querySelectorAll('[data-video-scale]').forEach(button => button.classList.toggle('active', Math.abs(Number(button.dataset.videoScale) - nextPct) <= 2));
            const recommendation = body.querySelector('#navVideoRecommendation');
            const calibrated = Math.abs(next - referenceScale) <= .026;
            if (recommendation) recommendation.textContent = calibrated
                ? 'Escala equilibrada para a configuração atual do Windows.'
                : next < referenceScale
                    ? 'Mais conteúdo visível, com textos e alvos de foco menores.'
                    : 'Textos e alvos maiores para uso em TV ou maior distância.';
            const guide = body.querySelector('#navVideoGuide');
            const guideTitle = body.querySelector('#navVideoGuideTitle');
            const guideText = body.querySelector('#navVideoGuideText');
            guide?.classList.toggle('is-calibrated', calibrated);
            if (guideTitle) guideTitle.textContent = calibrated ? 'Escala recomendada' : 'Ajuste de referência';
            if (guideText) guideText.textContent = calibrated ? 'Proporção equilibrada para esta tela' : `Base recomendada: ${refPct}%`;
        };

        _wireSystemItems(body, ['#setBackSystemVideo', '#navVideoPresetCompact', '#navVideoPresetRecommended', '#navVideoPresetEnlarged', '#navVideoScale']);
        body.querySelector('#setBackSystemVideo')?.addEventListener('click', () => {
            _returnFromSystemDetail();
        });
        body.querySelector('#navVideoScale')?.addEventListener('input', e => sync(e.currentTarget.value));
        body.querySelectorAll('[data-video-scale]').forEach(button => button.addEventListener('click', () => {
            const range = body.querySelector('#navVideoScale');
            if (range) range.value = button.dataset.videoScale;
            sync(button.dataset.videoScale);
            _contentIdx = Math.max(0, _contentItems.indexOf(button));
            _updateContentFocus();
        }));
        sync(pct);
    }

