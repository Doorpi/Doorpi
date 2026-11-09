    function navigate(direction) {
        // A queued focusDefault from a render must never overwrite a direction
        // the user has already chosen on the next animation frame.
        state.focusRequestGeneration++;
        if (state.capture) return; const items=focusables(); if (!items.length) return; const active=document.activeElement;
        if (state.adjustingRange) {
            if (active !== state.adjustingRange) state.adjustingRange.focus({preventScroll:true});
            if (direction==='LEFT'||direction==='RIGHT') { const range=state.adjustingRange,step=Number(range.step)||1,previous=range.value; range.value=String(Math.max(Number(range.min),Math.min(Number(range.max),Number(range.value)+(direction==='RIGHT'?step:-step)))); range.dispatchEvent(new Event('input',{bubbles:true})); if(range.value!==previous)window.DoorpiUiSound?.play('move'); }
            return;
        }
        const candidates = state.popup ? itemsIn('.cc-shade') : items;
        if (!candidates.includes(active)) { focusItemWithSound(candidates[0], active); return; }
        if (state.popup) {
            const keyboardTarget = state.popup.kind === 'keyboard' ? keyboardPopupNavigation(active, direction) : null;
            focusItemWithSound(keyboardTarget || spatialPopupNavigation(candidates, active, direction) || active, active); return;
        }

        const modes=itemsIn('.cc-mode-switch'),top=itemsIn('.cc-top'),topActions=top.filter(item=>!modes.includes(item)),context=itemsIn('.cc-context'),tabs=itemsIn('.cc-tabs'),headActions=itemsIn('.cc-command-panel .cc-section-head'),rows=itemsIn('.cc-list'),detail=itemsIn('.cc-detail-panel'),pointer=itemsIn('.cc-pointer-panel'),footer=itemsIn('.cc-footer');
        const activeTab=tabs.find(item=>item.classList.contains('active'))||tabs[0];
        const activeMode=modes.find(item=>item.classList.contains('active'))||modes[0];
        const selectedRow=rows.find(item=>item.classList.contains('selected'))||rows.find(item=>item.hasAttribute('data-binding-select'))||rows[0];
        let target=null;
        if (modes.includes(active)) {
            if (direction==='RIGHT'&&active===modes[modes.length-1]) target=topActions[0]||active;
            else if (direction==='LEFT'||direction==='RIGHT') target=moveWithin(modes,active,direction==='RIGHT'?1:-1);
            else if (direction==='DOWN') target=state.mode==='global'?(headActions[0]||rows[0]||detail[0]||footer[0]):(context[0]||activeTab);
        } else if (top.includes(active)) {
            if (direction==='LEFT') target=modes[modes.length-1]||activeMode;
            else if (direction==='DOWN') target=state.mode==='global'?(rows[0]||detail[0]):(context[context.length-1]||activeTab);
        } else if (context.includes(active)) {
            const index=context.indexOf(active);
            if (direction==='LEFT'||direction==='RIGHT') target=moveWithin(context,active,direction==='RIGHT'?1:-1);
            else if (direction==='DOWN') target=activeTab||rows[0];
            else if (direction==='UP') target=activeMode;
        } else if (tabs.includes(active)) {
            const index=tabs.indexOf(active);
            if (direction==='LEFT'||direction==='RIGHT') target=moveWithin(tabs,active,direction==='RIGHT'?1:-1);
            else if (direction==='DOWN') target=headActions[0]||rows[0]||detail[0]||pointer[0]||footer[0];
            else if (direction==='UP') target=context[Math.min(index,Math.max(0,context.length-1))]||activeMode;
        } else if (headActions.includes(active)) {
            if (direction==='UP') target=activeTab||context[0]||activeMode;
            else if (direction==='DOWN') target=rows[0]||detail[0]||pointer[0]||footer[0];
            else if (direction==='RIGHT') target=detail[0]||pointer[0]||active;
            else target=active;
        } else if (rows.includes(active)) {
            const index=rows.indexOf(active);
            if (direction==='UP') target=index===0?(headActions[0]||activeTab||context[0]):rows[index-1];
            else if (direction==='DOWN') target=index===rows.length-1?(pointer[0]||footer[0]||active):rows[index+1];
            else if (direction==='RIGHT') target=active.classList.contains('cc-add-row')?active:(detail[0]||active);
            else target=active;
        } else if (detail.includes(active)) {
            const triggerItems = focusItemsWithin(active.closest('.cc-trigger-grid'));
            const actionItems = focusItemsWithin(active.closest('.cc-detail-actions'));
            const rangePairItems = focusItemsWithin(active.closest('.cc-pointer'));
            const spatialTarget = spatialDirectionalCandidate(detail,active,direction);
            const detailIndex = detail.indexOf(active);
            const previousDetail = detailIndex>0 ? detail[detailIndex-1] : null;
            const nextDetail = detailIndex>=0 ? detail[detailIndex+1] : null;
            const upperTarget = activeTab||activeMode;
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
        focusItemWithSound(target||active, active);
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
