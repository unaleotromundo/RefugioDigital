// music-player.js - VERSIÓN FINAL UNIFICADA (CHAT + HUB)

const getBasePath = () => {
    const loc = window.location.pathname;
    return loc.includes('/chat/') ? '../' : './';
};

const playlist = ['musica1.mp3', 'musica2.mp3', 'musica3.mp3', 'musica4.mp3'];
let player = null;
let currentTrack = parseInt(localStorage.getItem('musicTrack')) || 0;
let isMuted = localStorage.getItem('musicMuted') === 'true';

// --- LÓGICA DE AUDIO ---
function initGlobalAudio() {
    if (player) return;
    player = new Audio();
    player.src = getBasePath() + playlist[currentTrack];
    player.volume = 0.35;
    player.muted = isMuted;
    
    const savedTime = localStorage.getItem('musicTime');
    if (savedTime) player.currentTime = parseFloat(savedTime);

    setInterval(() => {
        if (player && !player.paused) localStorage.setItem('musicTime', player.currentTime);
    }, 1000);

    player.onended = () => {
        currentTrack = (currentTrack + 1) % playlist.length;
        localStorage.setItem('musicTrack', currentTrack);
        player.src = getBasePath() + playlist[currentTrack];
        player.play();
    };
    attemptPlay();
}

function attemptPlay() {
    player.play().catch(() => {
        const activate = () => {
            player.play();
            window.removeEventListener('click', activate);
        };
        window.addEventListener('click', activate);
    });
}

function toggleMusic() {
    if (!player) return;
    player.muted = !player.muted;
    localStorage.setItem('musicMuted', player.muted);
    updateSpeakerIcon();
}

function updateSpeakerIcon() {
    const icons = [document.getElementById('speaker-icon'), document.getElementById('speaker-icon-sidebar')];
    const buttons = [document.querySelector('button[onclick*="toggleMusic"]')];
    
    let iconHTML = player && player.muted 
        ? '<path d="M11 5L6 9H2V15H6L11 19V5Z" /><line x1="23" y1="9" x2="17" y2="15" stroke="currentColor" stroke-width="2"/><line x1="17" y1="9" x2="23" y2="15" stroke="currentColor" stroke-width="2"/>'
        : '<path d="M11 5L6 9H2V15H6L11 19V5Z" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14" stroke="currentColor" stroke-width="2" fill="none"/>';

    icons.forEach(icon => { if (icon) icon.innerHTML = iconHTML; });
    buttons.forEach(btn => {
        if (btn) {
            btn.classList.toggle('text-slate-400', player.muted);
            btn.classList.toggle('text-amber-600', !player.muted);
        }
    });
}

// --- LÓGICA DE TEMA (SOL / LUNA) - ESTO ES LO QUE BUSCABAS ---
function updateThemeIcons() {
    const isDark = document.documentElement.classList.contains('dark');
    
    // 1. Caso Index: Busca los SPANS (Emojis)
    // El index tiene: <span class="dark:hidden">🌙</span> y <span class="hidden dark:inline">☀️</span>
    const spans = document.querySelectorAll('button[onclick*="toggleDarkMode"] span');
    if (spans.length > 0) {
        spans.forEach(span => {
            if (span.classList.contains('dark:hidden')) {
                // Es la Luna: Se oculta en Dark, se ve en Light
                span.style.display = isDark ? 'none' : 'inline-block';
            } else {
                // Es el Sol: Se ve en Dark, se oculta en Light
                span.style.display = isDark ? 'inline-block' : 'none';
            }
        });
    }

    // 2. Caso Hub: Busca los SVGs
    const svgs = document.querySelectorAll('button[onclick*="toggleDarkMode"] svg');
    const moonPath = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>';
    const sunPath = '<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line>';

    svgs.forEach(svg => {
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-width', '2');
        svg.innerHTML = isDark ? sunPath : moonPath;
    });
}

// Sobrescribir la función toggleDarkMode para que sea universal
// Esperamos un momento para que se cargue la función del HTML y la "atrapamos"
setTimeout(() => {
    const originalToggle = window.toggleDarkMode;
    window.toggleDarkMode = function() {
        // Si hay una función original (la del index.html), la ejecutamos
        if (originalToggle) originalToggle();
        else {
            // Si no, hacemos el cambio nosotros
            document.documentElement.classList.toggle('dark');
            localStorage.theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
        }
        // Actualizamos los iconos manualmente para asegurar el cambio
        updateThemeIcons();
    };
    // Ejecución inicial al cargar
    updateThemeIcons();
}, 100);

window.addEventListener('DOMContentLoaded', () => {
    initGlobalAudio();
    updateSpeakerIcon();
    updateThemeIcons();
});