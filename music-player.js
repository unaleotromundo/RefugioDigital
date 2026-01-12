// music-player.js - VERSIÓN ULTRA-LIMPIA (Anti-Caché)

const getBasePath = () => {
    const loc = window.location.pathname;
    return loc.includes('/chat/') ? '../' : './';
};

const playlist = ['musica1.mp3', 'musica2.mp3', 'musica3.mp3', 'musica4.mp3'];
let player = null;
let currentTrack = parseInt(localStorage.getItem('musicTrack')) || 0;
let isMuted = localStorage.getItem('musicMuted') === 'true';

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
    const buttons = [
        document.getElementById('music-btn-main'),
        document.getElementById('music-btn-sidebar'),
        document.querySelector('button[onclick*="toggleMusic"]')
    ];
    
    // ICONOS SVG LIMPIOS
    let iconHTML = player && player.muted 
        ? '<path d="M11 5L6 9H2V15H6L11 19V5Z" /><line x1="23" y1="9" x2="17" y2="15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="17" y1="9" x2="23" y2="15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'
        : '<path d="M11 5L6 9H2V15H6L11 19V5Z" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>';

    icons.forEach(icon => { if (icon) icon.innerHTML = iconHTML; });

    buttons.forEach(btn => {
        if (btn) {
            // MATAR EL ROJO DE LA CACHÉ
            btn.style.color = ""; // Limpia estilos inline
            btn.classList.remove('!text-red-500', 'text-red-500', 'dark:!text-red-400', 'text-red-400');
            
            // Aplicar colores según estado
            if (player.muted) {
                btn.classList.add('text-slate-400');
                btn.classList.remove('text-amber-600');
            } else {
                btn.classList.add('text-amber-600');
                btn.classList.remove('text-slate-400');
            }
        }
    });
}

function updateThemeIcons() {
    const isDark = document.documentElement.classList.contains('dark');
    const spans = document.querySelectorAll('button[onclick*="toggleDarkMode"] span');
    if (spans.length > 0) {
        spans.forEach(span => {
            if (span.classList.contains('dark:hidden')) span.style.display = isDark ? 'none' : 'inline-block';
            else span.style.display = isDark ? 'inline-block' : 'none';
        });
    }
    const svgs = document.querySelectorAll('button[onclick*="toggleDarkMode"] svg');
    svgs.forEach(svg => {
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-width', '2');
        svg.innerHTML = isDark ? '<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line>' : '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>';
    });
}

// Sobrescribir toggleDarkMode
setTimeout(() => {
    const originalToggle = window.toggleDarkMode;
    window.toggleDarkMode = function() {
        if (originalToggle) originalToggle();
        else {
            document.documentElement.classList.toggle('dark');
            localStorage.theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
        }
        updateThemeIcons();
    };
    updateThemeIcons();
}, 100);

window.addEventListener('DOMContentLoaded', () => {
    initGlobalAudio();
    updateSpeakerIcon();
    setTimeout(updateThemeIcons, 150);
});