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
    function focusItemWithSound(item, previous = document.activeElement) {
        focusItem(item);
        if (item && document.activeElement === item && item !== previous)
            window.DoorpiUiSound?.play('move');
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
