// Embedded only in the Steam configuration WebView. `nonce` belongs to its host session.
if (window !== window.top || location.origin !== 'https://steamcommunity.com' || location.pathname.replace(/\/$/, '') !== '/dev/apikey') return;
if (window.__doorpiSteamConnectNonce === nonce) return;
window.__doorpiSteamConnectNonce = nonce;
let capturing = false, anchor = null, exportButton = null, status = null, scheduled = false, captureTimer = 0;
function keyParagraph() {
    const containers = document.querySelectorAll('[id^="bodycontent" i]');
    for (const container of containers) {
        for (const paragraph of container.querySelectorAll('p')) {
            const match = paragraph.textContent.trim().match(/^[^:]+:\s*([a-f0-9]{32})\s*$/i);
            if (match) return { paragraph, key:match[1] };
        }
    }
    return null;
}
function feedback(message) {
    if (status) { status.textContent = message; status.hidden = !message; }
    if (exportButton) { exportButton.disabled = capturing; exportButton.textContent = capturing ? copy.exporting : copy.export; }
}
function positionButton() {
    if (!anchor?.isConnected || !exportButton) return;
    let bounds = anchor.getBoundingClientRect();
    try {
        const range = document.createRange();range.selectNodeContents(anchor);
        const textBounds = range.getBoundingClientRect();
        if(textBounds.width>0)bounds=textBounds;
    } catch { }
    const width = exportButton.offsetWidth, height = exportButton.offsetHeight, edge = 12;
    let left = bounds.right + 14, top = bounds.top + (bounds.height-height)/2;
    if (left + width > window.innerWidth-edge) { left = bounds.left; top = bounds.bottom+8; }
    exportButton.style.left = Math.max(edge,Math.min(window.innerWidth-width-edge,left))+'px';
    exportButton.style.top = Math.max(edge,Math.min(window.innerHeight-height-edge,top))+'px';
    if (status) {
        status.style.left = exportButton.style.left;
        status.style.top = Math.min(window.innerHeight-90,Math.max(edge,top+height+8))+'px';
    }
}
function mountButton() {
    scheduled = false;
    const found = keyParagraph();
    anchor = found?.paragraph || null;
    if (!found) { if(exportButton)exportButton.hidden=true; if(status)status.hidden=true; return; }
    if (!exportButton) {
        const style = document.createElement('style'); style.textContent = styles; document.head.appendChild(style);
        exportButton = document.createElement('button'); exportButton.id='doorpi-steam-export'; exportButton.type='button';
        exportButton.textContent=copy.export; exportButton.addEventListener('click',exportKey);
        status = document.createElement('div');status.id='doorpi-steam-export-status';status.setAttribute('role','status');status.hidden=true;
        document.body.append(exportButton,status);
    }
    exportButton.hidden=false;positionButton();
}
function scheduleMount() {
    if(scheduled)return;
    scheduled=true;requestAnimationFrame(mountButton);
}
function initialize() {
    mountButton();
    setTimeout(() => {
        if (keyParagraph() || capturing) return;
        window.chrome?.webview?.postMessage('doorpi_steam_manual:' + nonce);
        const help = document.createElement('p');
        help.textContent = 'Não conseguimos detectar a chave automaticamente. Feche esta tela para colar sua chave manualmente nas configurações do Doorpi.';
        help.setAttribute('role', 'status');
        document.body.append(help);
    }, 8000);
    new MutationObserver(records=>{
        if(records.some(record=>!exportButton?.contains(record.target)&&record.target!==status))scheduleMount();
    }).observe(document.body,{childList:true,subtree:true,characterData:true});
    window.addEventListener('resize',scheduleMount);
    window.addEventListener('scroll',positionButton,true);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});
else initialize();
window.chrome.webview.addEventListener('message',event=>{
    let data=event.data;try{if(typeof data==='string')data=JSON.parse(data);}catch{return;}
    if(data?.type!=='steamConnectResult'||data.nonce!==nonce)return;
    clearTimeout(captureTimer);
    capturing=false;feedback(data.message||copy.captureError);
});
function accountFromUrl(value) {
    try {
        const url = new URL(value, location.origin);
        if (url.origin !== location.origin) return '';
        const match = url.pathname.match(/^\/(profiles\/(7656119\d{10})|id\/([a-zA-Z0-9_-]{2,64}))\/?$/);
        return match ? (match[2] || match[3]) : '';
    } catch { return ''; }
}
async function currentAccount() {
    const steamId = String(window.g_steamID || '');
    if (/^7656119\d{10}$/.test(steamId)) return steamId;
    for (const link of document.querySelectorAll('#global_actions a.user_avatar[href], #account_dropdown a[href], .supernav_container a.username[href]')) {
        const account = accountFromUrl(link.href);
        if (account) return account;
    }
    // /my/ resolves using this WebView's authenticated Steam session. No cookies
    // or login tokens are copied to the Doorpi front-end or an external service.
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 8000);
    try {
        const response = await fetch('/my/', { credentials:'same-origin', signal:controller.signal });
        return response.ok ? accountFromUrl(response.url) : '';
    } finally { clearTimeout(timer); }
}
async function exportKey() {
    const found = keyParagraph();
    if (capturing || !found) return;
    capturing = true;feedback(copy.identifying);
    try {
        const account = await currentAccount();
        if (!account) throw new Error('account-unavailable');
        feedback(copy.saving);
        window.chrome.webview.postMessage('doorpi_steam_connect:' + JSON.stringify({nonce,key:found.key,account}));
        captureTimer=setTimeout(()=>{capturing=false;feedback(copy.captureError);},8000);
    } catch {
        capturing = false;feedback(copy.unavailable);
    }
}
// Preserve the original click shortcut in addition to the explicit export action.
document.addEventListener('click',event=>{
    const found=keyParagraph();
    if(found?.paragraph.contains(event.target)){event.preventDefault();void exportKey();}
},true);
