    function requestClose() { guardDirty(close); }

    function openPopup(html, kind) { closePopup(); const shade = document.createElement('div'); shade.className='cc-shade'; shade.innerHTML=html; state.overlay.appendChild(shade); state.popup={kind,element:shade}; shade.querySelectorAll('[data-popup-close]').forEach(button => button.addEventListener('click', closePopup)); }
    function closePopup() { state.popup?.element?.remove(); state.popup=null; focusDefault(); }
    function toast(message) { const el=document.createElement('div'); el.style.cssText='position:fixed;z-index:17000;left:50%;bottom:90px;transform:translateX(-50%);padding:12px 18px;border-radius:10px;background:#eef7ff;color:#14243d;font-weight:800'; el.textContent=message; document.body.appendChild(el); setTimeout(()=>el.remove(),1800); }

