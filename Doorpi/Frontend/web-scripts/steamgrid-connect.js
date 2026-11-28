if (window.top !== window || !['www.steamgriddb.com', 'steamgriddb.com'].includes(location.hostname)) return;

document.addEventListener('DOMContentLoaded', () => {
    const panel = document.createElement('div');
    panel.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483647;display:flex;flex-wrap:wrap;align-items:center;gap:8px;max-width:calc(100% - 32px);padding:10px;border-radius:12px;background:#131e2e;color:#fff;font:600 16px system-ui;box-shadow:0 4px 20px #000a';
    const button = (label, primary, onClick) => {
        const element = document.createElement('button');
        element.type = 'button';
        element.textContent = label;
        element.style.cssText = `padding:10px 14px;border-radius:8px;border:1px solid #7190be;background:${primary ? '#245aa3' : '#223148'};color:white;font:inherit;cursor:pointer`;
        element.onclick = onClick;
        return element;
    };
    const bridge = window.chrome.webview;
    const isKeyPage = () => location.pathname.replace(/\/$/, '') === '/profile/preferences/api';
    const findKey = () => {
        if (!isKeyPage()) return '';
        const keys = new Set();
        for (const element of document.querySelectorAll('code, input[readonly]')) {
            if (!element.getClientRects().length) continue;
            const value = (element.value ?? element.textContent ?? '').trim();
            if (/^[a-z0-9]{32}$/i.test(value)) keys.add(value);
        }
        return keys.size === 1 ? keys.values().next().value : '';
    };
    const copy = button(labels.copy, true, () => {
        if (copy.disabled) return;
        const key = findKey();
        if (!key) return;
        copy.disabled = true;
        bridge.postMessage(`doorpi_steamgrid_copy:${key}`);
    });
    const open = button(labels.open, true, () => bridge.postMessage('doorpi_steamgrid_open'));
    const back = button(labels.back, false, () => bridge.postMessage('doorpi_steamgrid_back'));
    const status = document.createElement('span');
    status.setAttribute('role', 'status');
    status.hidden = true;
    panel.append(status, copy, open, back);
    document.body.append(panel);

    let reportedReady = false;
    const refresh = () => {
        const keyPage = isKeyPage();
        const hasKey = !!findKey();
        copy.hidden = !hasKey;
        open.hidden = keyPage;
        if (!keyPage) reportedReady = false;
        if (!keyPage || reportedReady) return;

        const canGenerateKey = Array.from(document.querySelectorAll('button, input[type=submit]')).some(element =>
            element.getClientRects().length && /^(generate|create) (?:an? )?(?:api )?key$/i.test((element.value || element.textContent || '').trim()));
        if (hasKey || canGenerateKey) {
            reportedReady = true;
            bridge.postMessage('doorpi_steamgrid_key_page_ready');
        }
    };
    new MutationObserver(records => {
        if (records.some(record => !panel.contains(record.target))) refresh();
    }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['value', 'class', 'hidden'] });
    bridge.addEventListener('message', event => {
        if (event.data !== 'doorpi_steamgrid_clipboard_error') return;
        copy.disabled = false;
        status.textContent = labels.clipboardError;
        status.hidden = false;
    });
    refresh();
}, { once: true });
