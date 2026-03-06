let currentHero = "";
let currentLogo = "";
let transitionTimeout = null;
let isModalOpen = false;

let allInstalledApps = []; 
let currentSourceFilter = "all";
function updateToLocalFile(gameId, imageType, newUrl) {
    let targetCard = document.querySelector(`.card[data-game-id="${gameId.replace(/\\/g, '\\\\')}"]`);
    if (!targetCard) return;

    let datasetKey = "";
    if (imageType === "GridStatic") datasetKey = "staticVertical";
    else if (imageType === "HorizontalStatic") datasetKey = "staticHorizontal";
    else if (imageType === "HeroStatic") datasetKey = "staticHero";
    else if (imageType === "LogoStatic") datasetKey = "staticLogo";

    // Salva o caminho do HD no dataset estático
    targetCard.dataset[datasetKey] = newUrl;

    const img = targetCard.querySelector('img');
    const isFeatured = targetCard.classList.contains('featured');

    // MÁGICA: Atualiza visualmente se o card NÃO estiver sendo focado/hover no momento
    // Isso faz a imagem "aparecer do nada" assim que o C# confirmar que salvou
    if (img && document.activeElement !== targetCard && !targetCard.matches(':hover')) {
        if ((isFeatured && datasetKey === "staticHorizontal") || (!isFeatured && datasetKey === "staticVertical")) {
            img.src = newUrl;
            img.style.opacity = "1"; // Revela a imagem que estava vazia
        }
    }

    // Se o jogo recém adicionado já estiver lá no topo como Featured, 
    // atualiza o background pesado do Hero e o Logo em tempo real também.
    const heroImg = document.getElementById('heroImage');
    const logoImg = document.getElementById('gameLogo');

    if (isFeatured) {
        if (datasetKey === "staticHero" && heroImg) {
            heroImg.src = newUrl;
            heroImg.style.opacity = "1";
        }
        if (datasetKey === "staticLogo" && logoImg) {
            logoImg.src = newUrl;
            logoImg.style.opacity = "1";
        }
    }
}

const blobCache = new Set();
setInterval(() => {
    const now = new Date();
    document.getElementById('clock').innerText = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}, 1000);

if (window.chrome && window.chrome.webview) {
    window.chrome.webview.addEventListener('message', event => {
        try {
            const data = JSON.parse(event.data);
            if (data.type === 'newGame') createGameCard(data);
            else if (data.type === 'installedAppsList') {
                allInstalledApps = data.apps;
                applyFilterAndRender();
            }
            else if (data.type === 'staticSaved') {
                updateToLocalFile(data.gameId, data.imageType, data.newUrl);
            }
        } catch (e) { console.error("Erro ao receber dados:", e); }
    });
}

function applyFilterAndRender() {
   
    const filtered = currentSourceFilter === "all"
        ? allInstalledApps
        : allInstalledApps.filter(app => (app.Source || app.source) === currentSourceFilter);

    populateAppModal(filtered);
}


function setupFilterEvents() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
      
        const newBtn = btn.cloneNode(true);
        btn.replaceWith(newBtn);

       
        if (newBtn.dataset.source === currentSourceFilter) {
            newBtn.classList.add('active');
        } else {
            newBtn.classList.remove('active');
        }

        
        newBtn.addEventListener('click', () => {
            currentSourceFilter = newBtn.dataset.source;
            applyFilterAndRender(); 

            
            setTimeout(() => {
                const activeBtn = document.querySelector(`.filter-btn[data-source="${currentSourceFilter}"]`);
                if (activeBtn) activeBtn.focus();
            }, 50);
        });
    });
}
document.getElementById('btnAdd').addEventListener('click', () => {
    window.chrome.webview.postMessage(JSON.stringify({ action: 'requestInstalledApps' }));
    showModalLoading();
});

function showModalLoading() {
    isModalOpen = true;

    const container = document.getElementById('addGameContainer');
    document.getElementById('modalTitle').innerText = "Buscando aplicativos instalados...";
    document.getElementById('appList').innerHTML = "";
    document.getElementById('modalActions').style.display = "none";

    document.getElementById("gameGrid").style.overflowX = "hidden";

    container.style.display = 'flex';
}

function closeModal() {
    document.getElementById('addGameContainer').style.display = 'none';
    document.getElementById("gameGrid").style.overflowX = "auto";

    isModalOpen = false;
    focusItemByIndex(0);
}

function formatBytes(kb) {
    if (kb === 0) return "";
    const mb = kb / 1024;
    if (mb > 1024) return (mb / 1024).toFixed(2) + " GB";
    return mb.toFixed(0) + " MB";
}

function populateAppModal(apps) {
  
    const titleEl = document.getElementById('modalTitle');
    if (currentSourceFilter === "all") {
        titleEl.innerText = "Selecione os aplicativos para adicionar";
    } else {
        titleEl.innerText = `Mostrando jogos da loja: ${currentSourceFilter}`;
    }

    const appList = document.getElementById('appList');

   
    const btnSearch = document.getElementById('btnSearch');
    if (btnSearch) {
        const newBtnSearch = btnSearch.cloneNode(true);
        btnSearch.replaceWith(newBtnSearch);
        newBtnSearch.addEventListener('click', () => {
            window.chrome.webview.postMessage(JSON.stringify({ action: 'browseManual' }));
        });
    }

    const btnScan = document.getElementById('btnScanFolder');
    if (btnScan) {
        const newBtnScan = btnScan.cloneNode(true);
        btnScan.replaceWith(newBtnScan);
        newBtnScan.addEventListener('click', () => {
            titleEl.innerText = "Aguardando seleção de pasta...";
            window.chrome.webview.postMessage(JSON.stringify({ action: 'pickFolder' }));
        });
    }

 
    setupFilterEvents();

    
    appList.innerHTML = apps.map(app => {
        const isAppAdded = app.IsAdded === true || app.isAdded === true;
        const iconData = app.IconBase64 || app.iconBase64;
        const appName = app.Name || app.name;
        const appPath = app.Path || app.path;
        const appSize = app.Size !== undefined ? app.Size : app.size;
        const appLaunch = app.LaunchUrl || app.launchUrl || "";

        const addedClass = isAppAdded ? "already-added" : "";
        const tabindex = isAppAdded ? "" : 'tabindex="0"';
        const iconHtml = iconData ? `<img class="app-icon" src="data:image/png;base64,${iconData}" />` : '';

        return `
            <div class="app-item ${addedClass}" ${tabindex} 
                 data-path="${appPath.replace(/\\/g, '\\\\')}" 
                 data-launch="${appLaunch}"
                 data-name="${appName.replace(/"/g, '&quot;')}">
                ${iconHtml}
                ${appName}
                <span class="size">${formatBytes(appSize)}</span>
            </div>
        `;
    }).join('');

    document.getElementById('modalActions').style.display = "flex";

    
    document.querySelectorAll('.app-item:not(.already-added)').forEach(item => {
        item.addEventListener('click', function () {
            this.classList.toggle('selected');
        });
    });

    const btnCancel = document.getElementById('btnCancelAdd');
    const btnConfirm = document.getElementById('btnConfirmAdd');
    btnCancel.replaceWith(btnCancel.cloneNode(true));
    btnConfirm.replaceWith(btnConfirm.cloneNode(true));

    document.getElementById('btnCancelAdd').addEventListener('click', closeModal);
    document.getElementById('btnConfirmAdd').addEventListener('click', () => {
        const selected = Array.from(document.querySelectorAll('.app-item.selected')).map(el => ({
            Name: el.dataset.name,
            Path: el.dataset.path,
            LaunchUrl: el.dataset.launch
        }));

        if (selected.length > 0) {
            window.chrome.webview.postMessage(JSON.stringify({
                action: 'addSelectedGames',
                games: selected
            }));
            titleEl.innerText = "Baixando capas e adicionando... (Aguarde)";
            appList.innerHTML = "";
            document.getElementById('modalActions').style.display = "none";
            setTimeout(closeModal, 3000);
        } else {
            closeModal();
        }
    });

   
    setTimeout(() => {
        const firstItem = document.querySelector('.app-item[tabindex="0"]');
        if (firstItem) {
            firstItem.focus();
        } else {
            const scanBtn = document.getElementById('btnScanFolder');
            if (scanBtn) scanBtn.focus();
        }
    }, 150);
}
function moveFocus(direction) {
    const items = getNavigableItems();
    if (!items.length) return;

    const currentIndex = items.indexOf(document.activeElement);
    if (currentIndex === -1) {
        focusItemByIndex(0);
        return;
    }

    let nextIndex = currentIndex;

    if (direction === 'RIGHT') {
        nextIndex = currentIndex + 1;
    } else if (direction === 'LEFT') {
        nextIndex = currentIndex - 1;
    } else if (direction === 'DOWN' || direction === 'UP') {
        if (!isModalOpen) {
            
            nextIndex = direction === 'DOWN' ? currentIndex + 1 : currentIndex - 1;
        } else {
            
            const rect = items[currentIndex].getBoundingClientRect();
            let closestIndex = currentIndex;
            let minDistance = Infinity;

            for (let i = 0; i < items.length; i++) {
                if (i === currentIndex) continue;
                const otherRect = items[i].getBoundingClientRect();

                let isValid = false;
                
                if (direction === 'DOWN' && otherRect.top > rect.top + 10) isValid = true;
                if (direction === 'UP' && otherRect.bottom < rect.bottom - 10) isValid = true;

                if (isValid) {
                   
                    const dist = Math.abs(otherRect.left - rect.left) * 2 + Math.abs(otherRect.top - rect.top);
                    if (dist < minDistance) {
                        minDistance = dist;
                        closestIndex = i;
                    }
                }
            }
            nextIndex = closestIndex;
        }
    }

    focusItemByIndex(nextIndex);
}
function updateCardLayout(card) {
    const img = card.querySelector('img');
    if (!img) return;

    if (card.classList.contains('featured') && card.dataset.horizontal) {
        img.src = card.dataset.horizontal;
    } else {
        img.src = card.dataset.vertical;
    }
}

function moveCardToTop(card) {
    if (!card) return;
    const grid = document.getElementById('gameGrid');

    // Remove o destaque dos outros cards e volta para a imagem estática deles
    document.querySelectorAll('.card.featured').forEach(c => {
        c.classList.remove('featured');
        const img = c.querySelector('img');
        if (img) img.src = c.dataset.staticVertical || c.dataset.vertical;
    });

    // Adiciona destaque ao card atual
    card.classList.add('featured');
    grid.prepend(card);

    // CORREÇÃO APLICADA AQUI: Força o uso da imagem ESTÁTICA horizontal
    const img = card.querySelector('img');
    if (img) {
        img.src = card.dataset.staticHorizontal || card.dataset.horizontal || card.dataset.staticVertical || card.dataset.vertical;
    }
}


// Função auxiliar para extrair o primeiro frame (congelar) da animação

function getStaticFrame(imgElement) {
    const canvas = document.createElement('canvas');
    canvas.width = imgElement.naturalWidth;
    canvas.height = imgElement.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(imgElement, 0, 0);
    return canvas.toDataURL('image/png'); // Retorna a imagem estática como texto
}



let animationTimeout = null;

// Função "Detetive" de Animações
async function getAnimatedBlob(url) {
    if (!url) return null;
    try {
        const response = await fetch(url);
        if (!response.ok) return null;
        const blob = await response.blob();

        // Lemos só o comecinho do arquivo para ver se tem animação
        const buffer = await blob.slice(0, 256).arrayBuffer();
        const bytes = new Uint8Array(buffer);
        const APNG_SIGNATURE = [0x61, 0x63, 0x54, 0x4C];
        const WEBP_ANIM_SIGNATURE = [0x41, 0x4E, 0x49, 0x4D];

        let isAnim = false;
        for (let i = 0; i < bytes.length - 4; i++) {
            if (bytes.slice(i, i + 4).every((val, index) => val === APNG_SIGNATURE[index])) { isAnim = true; break; }
            if (bytes.slice(i, i + 4).every((val, index) => val === WEBP_ANIM_SIGNATURE[index])) { isAnim = true; break; }
        }
        if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) isAnim = true; // GIF

        return isAnim ? blob : null; // Se for animado, entrega o arquivo cru
    } catch { return null; }
}



function createGameCard(data) {
    const grid = document.getElementById('gameGrid');
    const card = document.createElement('div');
    card.className = 'card';
    card.tabIndex = 0;

    const gameId = data.launchUrl || data.path;
    card.dataset.gameId = gameId;

    // Armazena todas as URLs, tanto as originais quanto as estáticas
    card.dataset.hero = data.hero || "";
    card.dataset.logo = data.logo || "";
    card.dataset.vertical = data.imageData;
    card.dataset.horizontal = data.horizontalImage || "";
    card.dataset.staticVertical = data.staticImageData || "";
    card.dataset.staticHorizontal = data.staticHorizontalImage || "";
    card.dataset.staticHero = data.staticHero || "";
    card.dataset.staticLogo = data.staticLogo || "";

    const img = document.createElement('img');
    img.decoding = "async";


    if (data.isFeatured) card.classList.add('featured');

   
    const processImage = async (sourceUrl, targetDatasetKey, imageTypeStr) => {
        // Se não tiver imagem ou se já tiver lido do HD, aborta.
        if (!sourceUrl || card.dataset[targetDatasetKey]) return;

        const animBlob = await getAnimatedBlob(sourceUrl);

        if (!animBlob) {
            // Não tem animação! Salva no dataset normal e fim de papo.
            card.dataset[targetDatasetKey] = sourceUrl;
            return;
        }

        // É ANIMADA! 
        return new Promise(resolve => {
            const tempImg = new Image();

            // Transforma a memória num link virtual (Isso burla a proteção de CORS do navegador)
            const blobUrl = URL.createObjectURL(animBlob);

            tempImg.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = tempImg.naturalWidth;
                    canvas.height = tempImg.naturalHeight;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(tempImg, 0, 0);

                    // Gira pro C# resolver o arquivo físico
                    window.chrome.webview.postMessage(JSON.stringify({
                        action: 'saveStaticFrame',
                        gameId: gameId,
                        imageType: imageTypeStr,
                        base64: canvas.toDataURL('image/png')
                    }));
                } catch (e) {
                    console.error("Falha ao desenhar imagem:", e);
                    // Em caso de erro extremo, pelo menos mostra a imagem animada pra não ficar preto
                    card.dataset[targetDatasetKey] = sourceUrl;
                } finally {
                    // Limpa a memória RAM e segue o fluxo
                    URL.revokeObjectURL(blobUrl);
                    resolve();
                }
            };

            tempImg.onerror = () => {
                card.dataset[targetDatasetKey] = sourceUrl;
                URL.revokeObjectURL(blobUrl);
                resolve();
            };

            tempImg.src = blobUrl;
        });
    };

    Promise.all([
        processImage(card.dataset.vertical, 'staticVertical', 'GridStatic'),
        processImage(card.dataset.horizontal, 'staticHorizontal', 'HorizontalStatic'),
        processImage(card.dataset.hero, 'staticHero', 'HeroStatic'),
        processImage(card.dataset.logo, 'staticLogo', 'LogoStatic')
    ]).then(() => {
        // Aqui garantimos que ele SÓ carrega a imagem se existir a estática!
        // Se era uma imagem animada, essas variáveis estarão VAZIAS, então a imagem não vai carregar (e está tudo bem).
        const initialStaticSrc = card.classList.contains('featured') ?
            card.dataset.staticHorizontal :
            card.dataset.staticVertical;

        if (initialStaticSrc) {
            img.src = initialStaticSrc;
            img.style.opacity = "1";
        }
    });

  
const handleStartInteraction = async () => {
        const staticGrid = card.classList.contains('featured')
            ? (card.dataset.staticHorizontal || card.dataset.horizontal || card.dataset.staticVertical || card.dataset.vertical)
            : (card.dataset.staticVertical || card.dataset.vertical);

        const animGrid = card.classList.contains('featured')
            ? (card.dataset.horizontal || card.dataset.vertical)
            : card.dataset.vertical;

        const staticHero = card.dataset.staticHero || card.dataset.hero;
        const animHero = card.dataset.hero;
        const staticLogo = card.dataset.staticLogo || card.dataset.logo;
        const animLogo = card.dataset.logo;

        // 1. Troca o fundo lá de trás para ESTÁTICO IMEDIATAMENTE (com fade bonito)
        switchHeroBackground(staticHero, staticLogo);

        // 2. Prepara o gatilho da Animação
        if (animationTimeout) clearTimeout(animationTimeout);

        // Mudei para apenas 100ms! Extremamente rápido, mas preserva a fluidez da rolagem.
        animationTimeout = setTimeout(async () => {
            if (document.activeElement === card || card.matches(':hover')) {

                // A) Decodifica e injeta o Grid Animado (a caixinha)
                if (animGrid && img.src !== animGrid) {
                    const tempGrid = new Image();
                    tempGrid.src = animGrid;
                    try { await tempGrid.decode(); } catch(e){}
                    if (document.activeElement === card || card.matches(':hover')) img.src = animGrid;
                }

                // B) Injeta o Hero Animado (Lá no fundo gigante)
                // Detalhe: Trocamos direto o SRC sem Fade, assim a imagem acorda na mesma hora!
                if (animHero && animHero !== staticHero) {
                    const tempHero = new Image();
                    tempHero.src = animHero;
                    try { await tempHero.decode(); } catch(e){}
                    if (document.activeElement === card || card.matches(':hover')) {
                        const heroImg = document.getElementById('heroImage');
                        if (heroImg && !heroImg.src.endsWith(animHero)) heroImg.src = animHero;
                    }
                }

                // C) Injeta o Logo Animado
                if (animLogo && animLogo !== staticLogo) {
                    const tempLogo = new Image();
                    tempLogo.src = animLogo;
                    try { await tempLogo.decode(); } catch(e){}
                    if (document.activeElement === card || card.matches(':hover')) {
                        const logoImg = document.getElementById('gameLogo');
                        if (logoImg && !logoImg.src.endsWith(animLogo)) logoImg.src = animLogo;
                    }
                }
            }
        }, 400); 
    };

    const handleStopInteraction = () => {
        if (animationTimeout) clearTimeout(animationTimeout);
        setTimeout(() => {
            if (document.activeElement !== card && !card.matches(':hover')) {
                // Voltar grid pra estático
                const staticGrid = card.classList.contains('featured') ?
                    (card.dataset.staticHorizontal || card.dataset.horizontal || card.dataset.staticVertical || card.dataset.vertical) :
                    (card.dataset.staticVertical || card.dataset.vertical);

                if (staticGrid) {
                    if (img.src !== staticGrid) img.src = staticGrid;
                } else {
                    img.removeAttribute('src');
                }

                // Desligar as animações do Hero/Logo de fundo para salvar memória/CPU do PC
                const heroImg = document.getElementById('heroImage');
                const logoImg = document.getElementById('gameLogo');
                const staticHero = card.dataset.staticHero || card.dataset.hero;
                const staticLogo = card.dataset.staticLogo || card.dataset.logo;

                if (heroImg && heroImg.src.endsWith(card.dataset.hero) && card.dataset.hero !== staticHero) {
                    heroImg.src = staticHero;
                }
                if (logoImg && logoImg.src.endsWith(card.dataset.logo) && card.dataset.logo !== staticLogo) {
                    logoImg.src = staticLogo;
                }
            }
        }, 0);
    };

    card.appendChild(img);
    card.addEventListener('mouseenter', handleStartInteraction);
    card.addEventListener('focus', handleStartInteraction);
    card.addEventListener('mouseleave', handleStopInteraction);
    card.addEventListener('blur', handleStopInteraction);

    const title = document.createElement('div');
    title.className = 'title';
    title.innerText = data.name;
    card.appendChild(title);

    const launch = () => {
        window.chrome.webview.postMessage(JSON.stringify({ action: 'launch', path: gameId }));
        moveCardToTop(card);
    };

    card.addEventListener('click', launch);
    grid.insertBefore(card, btnAdd);

    if (data.isFeatured) {
       
        handleStartInteraction();
    }
}

// === GERENCIADOR DE BACKGROUND UNIFICADO ===
let heroFadeTimeout = null;
let currentHeroSrc = "";

function switchHeroBackground(newHero, newLogo) {
    const heroImg = document.getElementById('heroImage');
    const logoImg = document.getElementById('gameLogo');

    if (!heroImg || !logoImg || !newHero) return;

    // Se já estamos focados nesse jogo, ignora o comando pra não piscar a tela à toa!
    const cleanCurrent = currentHeroSrc.split('?')[0];
    const cleanNew = newHero.split('?')[0];
    if (cleanCurrent === cleanNew) return;

    currentHeroSrc = newHero;

    // Inicia o Fade Out
    heroImg.style.opacity = "0";
    logoImg.style.opacity = "0";

    if (heroFadeTimeout) clearTimeout(heroFadeTimeout);

    // Espera o Fade Out (150ms) e troca pra estática
    heroFadeTimeout = setTimeout(() => {
        heroImg.src = newHero;
        logoImg.src = newLogo;

        // Assim que carregar no PC, Fade In
        heroImg.onload = () => heroImg.style.opacity = "1";
        logoImg.onload = () => logoImg.style.opacity = "1";

        if (heroImg.complete) heroImg.style.opacity = "1";
        if (logoImg.complete) logoImg.style.opacity = "1";
    }, 150);
}


function updateHeroSection(card) {
    const heroBg = document.getElementById('hero-background');
    const heroTitle = document.getElementById('focused-game-title');

    if (!heroBg || !heroTitle) return;

    if (card.dataset.hero) {
        heroBg.style.backgroundImage = `url('${card.dataset.hero}')`;
    } else {
        heroBg.style.backgroundImage = 'none';
    }
    heroTitle.innerText = card.dataset.title;
}

function getNavigableItems() {
    if (isModalOpen) {
        const modal = document.getElementById('addGameContainer');
        return Array.from(modal.querySelectorAll('[tabindex="0"]:not(.already-added)'));
    } else {
        const grid = document.getElementById('gameGrid');
        if (!grid) return [];
        return Array.from(grid.children);
    }
}

function focusItemByIndex(index) {
    const items = getNavigableItems();
    if (!items.length) return;

    index = (index + items.length) % items.length;
    const el = items[index];
    el.focus();

    if (isModalOpen) {
        ensureModalItemVisible(el);
    } else {
        smoothHorizontalScroll(el);
    }
}
function smoothHorizontalScroll(element) {

    if (isModalOpen) return;

    const container = document.getElementById("gameGrid");

    const containerRect = container.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();

    const elementCenter = elementRect.left + elementRect.width / 2;
    const containerCenter = containerRect.left + containerRect.width / 2;

    const offset = elementCenter - containerCenter;

    const start = container.scrollLeft;
    const target = Math.max(
    0,
    Math.min(container.scrollWidth - container.clientWidth, start + offset)
);

    const duration = 450; 
    const startTime = performance.now();

    function animate(time) {
        const elapsed = time - startTime;
        const progress = Math.min(elapsed / duration, 1);

        
        const ease = 1 - Math.pow(1 - progress, 3);

        container.scrollLeft = start + (target - start) * ease;

        if (progress < 1) {
            requestAnimationFrame(animate);
        }
    }

    requestAnimationFrame(animate);
}
const container = document.getElementById("gameGrid");

const speed = 1.2;

container.addEventListener("wheel", (e) => {

    if (isModalOpen) return;

    e.preventDefault();
    container.scrollLeft += e.deltaY * speed;

}, { passive: false });

document.addEventListener('keydown', (e) => {

    const items = getNavigableItems();
    if (!items.length) return;

    // se o modal estiver aberto, só permite navegação do modal
    if (isModalOpen) {

        if (e.key === 'ArrowRight') { e.preventDefault(); moveFocus('RIGHT'); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); moveFocus('LEFT'); }
        else if (e.key === 'ArrowDown') { e.preventDefault(); moveFocus('DOWN'); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); moveFocus('UP'); }
        else if (e.key === 'Enter') {
            e.preventDefault();
            if (document.activeElement) document.activeElement.click();
        }

        return;
    }

    
    if (e.key === 'ArrowRight') { e.preventDefault(); moveFocus('RIGHT'); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); moveFocus('LEFT'); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); moveFocus('DOWN'); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); moveFocus('UP'); }
    else if (e.key === 'Enter') {
        e.preventDefault();
        if (document.activeElement) document.activeElement.click();
    }

});
let gamepadIndex = null;
let buttonCooldown = false;

let lastMoveTime = 0;
let moveState = 0; 
let currentDirection = null;
const INITIAL_DELAY = 400; 
const REPEAT_DELAY = 80;   

window.addEventListener("gamepadconnected", (e) => {
    gamepadIndex = e.gamepad.index;
});
function ensureModalItemVisible(element) {
    if (!element) return;
    element.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest', // Garante que apareça sem pular muito a tela
        inline: 'nearest'
    });
}
function handleGamepad() {



    if (gamepadIndex === null) {
        requestAnimationFrame(handleGamepad);
        return;
    }

    const gamepad = navigator.getGamepads()[gamepadIndex];
    if (!gamepad) {
        requestAnimationFrame(handleGamepad);
        return;
    }

    const items = getNavigableItems();
    if (!items.length) {
        requestAnimationFrame(handleGamepad);
        return;
    }

    let currentIndex = items.indexOf(document.activeElement);
    if (currentIndex === -1) {
        focusItemByIndex(0);
        requestAnimationFrame(handleGamepad);
        return;
    }

    const axisX = gamepad.axes[0];
    const axisY = gamepad.axes[1];
    const dpadRight = gamepad.buttons[15]?.pressed;
    const dpadLeft = gamepad.buttons[14]?.pressed;
    const dpadUp = gamepad.buttons[12]?.pressed;
    const dpadDown = gamepad.buttons[13]?.pressed;

    const now = performance.now();
    let newDirection = null;

   
    if (axisX > 0.6 || dpadRight) newDirection = 'RIGHT';
    else if (axisX < -0.6 || dpadLeft) newDirection = 'LEFT';
    else if (axisY > 0.6 || dpadDown) newDirection = 'DOWN';
    else if (axisY < -0.6 || dpadUp) newDirection = 'UP';

    
    if (newDirection) {
        if (newDirection !== currentDirection) {
            
            moveFocus(newDirection);
            lastMoveTime = now;
            moveState = 1;
            currentDirection = newDirection;
        } else {
           
            if (moveState === 1 && (now - lastMoveTime > INITIAL_DELAY)) {
               
                moveFocus(newDirection);
                lastMoveTime = now;
                moveState = 2;
            } else if (moveState === 2 && (now - lastMoveTime > REPEAT_DELAY)) {
               
                moveFocus(newDirection);
                lastMoveTime = now;
            }
        }
    } else {
  
        moveState = 0;
        currentDirection = null;
    }


  
    if (gamepad.buttons[0].pressed) {
        if (!buttonCooldown) {
            document.activeElement.click();
            buttonCooldown = true;
        }
    } else {
       
        buttonCooldown = false;
    }

    requestAnimationFrame(handleGamepad);
}

requestAnimationFrame(handleGamepad);