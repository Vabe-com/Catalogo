/**
 * Catálogo Digital Interactivo
 * Lógica de navegación, gestos, carga dinámica de imágenes
 */

// ─── Configuración ───────────────────────────────────
const CONFIG = {
    businessName: 'Mi Catálogo',
    businessTagline: 'Descubre nuestra colección',
    imagesJsonPath: 'images.json',
    imagesFolder: 'images/',
    swipeThreshold: 60, // px mínimos para considerar swipe
    swipeVelocityThreshold: 0.4, // px/ms para swipe rápido
    preloadCount: 2, // cuántas imágenes precargar hacia adelante/atrás
    transitionDuration: 400, // ms, debe coincidir con CSS
};

// ─── Estado ─────────────────────────────────────────
const state = {
    images: [],
    currentIndex: 0,
    isTransitioning: false,
    touchStartX: 0,
    touchStartY: 0,
    touchStartTime: 0,
    touchMoved: false,
};

// ─── Elementos DOM ──────────────────────────────────
const dom = {
    cover: document.getElementById('cover'),
    viewer: document.getElementById('viewer'),
    businessName: document.getElementById('businessName'),
    businessTagline: document.getElementById('businessTagline'),
    mainImage: document.getElementById('mainImage'),
    blurBg: document.querySelector('.viewer__blur-bg'),
    prevBtn: document.getElementById('prevBtn'),
    nextBtn: document.getElementById('nextBtn'),
    dotsContainer: document.getElementById('dotsContainer'),
    imageCounter: document.getElementById('imageCounter'),
    homeBtn: document.getElementById('homeBtn'),
    toast: document.getElementById('toast'),
};

// ─── Utilidades ─────────────────────────────────────
function showToast(message, duration = 2500) {
    dom.toast.textContent = message;
    dom.toast.classList.remove('hidden');
    clearTimeout(dom.toast._timeout);
    dom.toast._timeout = setTimeout(() => {
        dom.toast.classList.add('hidden');
    }, duration);
}

function preloadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`No se pudo cargar: ${src}`));
        img.src = src;
    });
}

// ─── Carga del catálogo ────────────────────────────
async function loadImageList() {
    try {
        const response = await fetch(CONFIG.imagesJsonPath);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (!Array.isArray(data) || data.length === 0) {
            throw new Error('El catálogo está vacío');
        }
        state.images = data.map((filename) => CONFIG.imagesFolder + filename);
        state.currentIndex = 0;
    } catch (error) {
        console.error('Error al cargar la lista de imágenes:', error);
        state.images = [];
        showToast('No se pudieron cargar las imágenes. Verifica la configuración.', 4000);
    }
}

// ─── Renderizado ────────────────────────────────────
function updateImage(index, direction = 'none') {
    if (state.images.length === 0) return;
    if (state.isTransitioning) return;

    state.isTransitioning = true;
    state.currentIndex = index;

    const src = state.images[index];

    // Aplicar clase de transición
    dom.mainImage.classList.add('viewer__image--transitioning');

    // Precargar la imagen antes de mostrarla
    preloadImage(src)
        .then(() => {
            // Actualizar fuentes de imagen
            dom.mainImage.src = src;
            dom.mainImage.alt = `Producto ${index + 1}`;
            dom.blurBg.style.backgroundImage = `url(${src})`;

            // Esperar un frame para que el navegador pinte
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    dom.mainImage.classList.remove('viewer__image--transitioning');
                    state.isTransitioning = false;
                });
            });
        })
        .catch(() => {
            // Si falla, intentar igualmente (mostrar placeholder natural del navegador)
            dom.mainImage.src = src;
            dom.blurBg.style.backgroundImage = `url(${src})`;
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    dom.mainImage.classList.remove('viewer__image--transitioning');
                    state.isTransitioning = false;
                });
            });
        });

    updateDots();
    updateCounter();
    updateNavButtons();
    preloadAdjacent(index);
}

function updateDots() {
    dom.dotsContainer.innerHTML = '';
    if (state.images.length <= 1) return;

    state.images.forEach((_, i) => {
        const dot = document.createElement('button');
        dot.classList.add('viewer__dot');
        if (i === state.currentIndex) {
            dot.classList.add('viewer__dot--active');
        }
        dot.setAttribute('aria-label', `Ir a imagen ${i + 1}`);
        dot.setAttribute('role', 'tab');
        dot.setAttribute('aria-selected', i === state.currentIndex ? 'true' : 'false');
        dot.addEventListener('click', () => {
            if (i !== state.currentIndex) updateImage(i);
        });
        dom.dotsContainer.appendChild(dot);
    });
}

function updateCounter() {
    if (state.images.length === 0) {
        dom.imageCounter.textContent = '0 / 0';
        return;
    }
    dom.imageCounter.textContent = `${state.currentIndex + 1} / ${state.images.length}`;
}

function updateNavButtons() {
    if (state.images.length <= 1) {
        dom.prevBtn.disabled = true;
        dom.nextBtn.disabled = true;
        return;
    }
    dom.prevBtn.disabled = state.currentIndex === 0;
    dom.nextBtn.disabled = state.currentIndex === state.images.length - 1;
}

function preloadAdjacent(index) {
    const start = Math.max(0, index - CONFIG.preloadCount);
    const end = Math.min(state.images.length - 1, index + CONFIG.preloadCount);
    for (let i = start; i <= end; i++) {
        if (i !== index) {
            preloadImage(state.images[i]).catch(() => {});
        }
    }
}

// ─── Navegación ─────────────────────────────────────
function goToNext() {
    if (state.currentIndex < state.images.length - 1) {
        updateImage(state.currentIndex + 1, 'forward');
    }
}

function goToPrev() {
    if (state.currentIndex > 0) {
        updateImage(state.currentIndex - 1, 'backward');
    }
}

// ─── Gestos táctiles ───────────────────────────────
function handleTouchStart(e) {
    if (state.images.length === 0) return;
    const touch = e.touches[0];
    state.touchStartX = touch.clientX;
    state.touchStartY = touch.clientY;
    state.touchStartTime = Date.now();
    state.touchMoved = false;
}

function handleTouchMove(e) {
    if (state.images.length === 0) return;
    state.touchMoved = true;
    // Prevenir scroll del navegador mientras se navega el catálogo
    const touch = e.touches[0];
    const deltaX = Math.abs(touch.clientX - state.touchStartX);
    const deltaY = Math.abs(touch.clientY - state.touchStartY);
    if (deltaX > deltaY && deltaX > 8) {
        e.preventDefault();
    }
}

function handleTouchEnd(e) {
    if (!state.touchMoved || state.images.length === 0) return;

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - state.touchStartX;
    const deltaY = touch.clientY - state.touchStartY;
    const deltaTime = Date.now() - state.touchStartTime;
    const velocity = Math.abs(deltaX) / (deltaTime || 1);

    // Solo procesar swipes horizontales significativos
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
        const isFastSwipe = velocity > CONFIG.swipeVelocityThreshold;
        const exceedsThreshold = Math.abs(deltaX) > CONFIG.swipeThreshold;

        if (isFastSwipe || exceedsThreshold) {
            if (deltaX < 0) {
                goToNext();
            } else {
                goToPrev();
            }
        }
    }

    state.touchMoved = false;
}

// ─── Mouse drag (escritorio) ────────────────────────
let isDragging = false;
let dragStartX = 0;

function handleMouseDown(e) {
    if (state.images.length === 0) return;
    if (e.target.closest('button')) return; // No interferir con botones
    isDragging = true;
    dragStartX = e.clientX;
    dom.mainImage.style.cursor = 'grabbing';
}

function handleMouseMove(e) {
    if (!isDragging) return;
    // Opcional: efecto de arrastre visual
}

function handleMouseUp(e) {
    if (!isDragging) return;
    isDragging = false;
    dom.mainImage.style.cursor = '';

    const deltaX = e.clientX - dragStartX;
    if (Math.abs(deltaX) > CONFIG.swipeThreshold) {
        if (deltaX < 0) {
            goToNext();
        } else {
            goToPrev();
        }
    }
}

// ─── Rueda del mouse ────────────────────────────────
let wheelDebounce = 0;
function handleWheel(e) {
    if (state.images.length === 0) return;
    if (state.isTransitioning) return;

    // Solo interceptar si el scroll es predominantemente horizontal
    // o si estamos en el visor (prevenir scroll vertical de página)
    const now = Date.now();
    if (now - wheelDebounce < 500) return;

    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        e.preventDefault();
        wheelDebounce = now;
        if (e.deltaX > 30) {
            goToNext();
        } else if (e.deltaX < -30) {
            goToPrev();
        }
    }
}

// ─── Teclado ────────────────────────────────────────
function handleKeyDown(e) {
    if (dom.viewer.classList.contains('hidden')) return;

    switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
            e.preventDefault();
            goToNext();
            break;
        case 'ArrowLeft':
        case 'ArrowUp':
            e.preventDefault();
            goToPrev();
            break;
        case 'Escape':
            e.preventDefault();
            showCover();
            break;
        case 'Home':
            e.preventDefault();
            if (state.images.length > 0) updateImage(0);
            break;
        case 'End':
            e.preventDefault();
            if (state.images.length > 0) updateImage(state.images.length - 1);
            break;
    }
}

// ─── Transición Portada ↔ Visor ────────────────────
function showViewer() {
    if (state.images.length === 0) {
        showToast('No hay imágenes disponibles en el catálogo.', 3000);
        return;
    }
    dom.cover.classList.add('cover--dismissed');
    dom.viewer.classList.remove('hidden');
    updateImage(state.currentIndex);
    document.body.style.cursor = '';
}

function showCover() {
    dom.viewer.classList.add('hidden');
    dom.cover.classList.remove('cover--dismissed');
    document.body.style.cursor = '';
}

// ─── Eventos de portada ────────────────────────────
function setupCoverEvents() {
    // Clic/toque en la portada abre el catálogo
    dom.cover.addEventListener('click', (e) => {
        // No activar si se hizo swipe (touchmove)
        if (state.touchMoved) return;
        showViewer();
    });

    // Swipe hacia arriba en la portada también abre
    let coverTouchStartY = 0;
    let coverTouchMoved = false;

    dom.cover.addEventListener(
        'touchstart',
        (e) => {
            coverTouchStartY = e.touches[0].clientY;
            coverTouchMoved = false;
        },
        { passive: true }
    );

    dom.cover.addEventListener(
        'touchmove',
        (e) => {
            coverTouchMoved = true;
        },
        { passive: true }
    );

    dom.cover.addEventListener('touchend', (e) => {
        if (!coverTouchMoved) return;
        const deltaY = e.changedTouches[0].clientY - coverTouchStartY;
        // Swipe hacia arriba (deltaY negativo)
        if (deltaY < -50) {
            showViewer();
        }
    });
}

// ─── Inicialización ────────────────────────────────
async function init() {
    // Aplicar configuración
    dom.businessName.textContent = CONFIG.businessName;
    dom.businessTagline.textContent = CONFIG.businessTagline;
    document.title = CONFIG.businessName;

    // Cargar lista de imágenes
    await loadImageList();

    if (state.images.length === 0) {
        showToast(
            'El catálogo está vacío. Sube imágenes a la carpeta /images para comenzar.',
            6000
        );
        // Mostrar el visor igualmente con estado vacío
        dom.imageCounter.textContent = '0 / 0';
        dom.prevBtn.disabled = true;
        dom.nextBtn.disabled = true;
    }

    // Configurar eventos
    setupCoverEvents();

    // Eventos del visor
    dom.prevBtn.addEventListener('click', goToPrev);
    dom.nextBtn.addEventListener('click', goToNext);
    dom.homeBtn.addEventListener('click', showCover);

    // Gestos táctiles en el visor
    dom.viewer.addEventListener('touchstart', handleTouchStart, { passive: false });
    dom.viewer.addEventListener('touchmove', handleTouchMove, { passive: false });
    dom.viewer.addEventListener('touchend', handleTouchEnd);

    // Mouse drag
    dom.viewer.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    // Rueda
    dom.viewer.addEventListener('wheel', handleWheel, { passive: false });

    // Teclado
    window.addEventListener('keydown', handleKeyDown);

    // Navegación por teclado en portada
    dom.cover.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            showViewer();
        }
    });

    // Hacer la portada focuseable para teclado
    dom.cover.setAttribute('tabindex', '0');

    // Si hay imágenes, precargar la primera
    if (state.images.length > 0) {
        preloadImage(state.images[0]).catch(() => {});
        updateNavButtons();
        updateCounter();
        updateDots();
    }

    console.log(
        `📸 Catálogo listo — ${state.images.length} imágenes cargadas · "${CONFIG.businessName}"`
    );
}

// Arrancar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}