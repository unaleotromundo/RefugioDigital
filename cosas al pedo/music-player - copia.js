// music-player.js

// 1. Función para detectar la ruta correcta (Raíz o Subcarpeta)
const getBasePath = () => {
    const loc = window.location.pathname;
    // Si la URL contiene "/chat/", los archivos de música están un nivel arriba (../)
    return loc.includes('/chat/') ? '../' : './';
};

const playlist = ['musica1.mp3', 'musica2.mp3', 'musica3.mp3', 'musica4.mp3'];
let player = null;
let currentTrack = parseInt(localStorage.getItem('musicTrack')) || 0;
let isMuted = localStorage.getItem('musicMuted') === 'true';

function initGlobalAudio() {
    if (player) return;

    player = new Audio();
    // Aplicamos la ruta dinámica al cargar la canción
    player.src = getBasePath() + playlist[currentTrack];
    player.volume = 0.35;
    player.muted = isMuted;
    player.loop = false;

    // Recuperar tiempo guardado para dar continuidad
    const savedTime = localStorage.getItem('musicTime');
    if (savedTime) {
        player.currentTime = parseFloat(savedTime);
    }

    // Guardar el segundo actual cada segundo para la siguiente página
    setInterval(() => {
        if (player && !player.paused) {
            localStorage.setItem('musicTime', player.currentTime);
        }
    }, 1000);

    // Al terminar una canción, pasar a la siguiente con la ruta correcta
    player.onended = () => {
        currentTrack = (currentTrack + 1) % playlist.length;
        localStorage.setItem('musicTrack', currentTrack);
        player.src = getBasePath() + playlist[currentTrack];
        player.play();
    };

    // Intentar reproducir
    attemptPlay();
}

function attemptPlay() {
    // Los navegadores bloquean el sonido hasta que el usuario interactúa
    player.play().catch(() => {
        console.log("Esperando interacción para activar música...");
        
        // Escuchamos clic, scroll o teclas para activar el sonido
        const activate = () => {
            player.play();
            // Limpiamos los eventos una vez que arranca
            window.removeEventListener('click', activate);
            window.removeEventListener('scroll', activate);
            window.removeEventListener('keydown', activate);
        };

        window.addEventListener('click', activate);
        window.addEventListener('scroll', activate);
        window.addEventListener('keydown', activate);
    });
}

function toggleMusic() {
    if (!player) return;
    player.muted = !player.muted;
    localStorage.setItem('musicMuted', player.muted);
    updateSpeakerIcon();
}

function updateSpeakerIcon() {
    const icon = document.getElementById('speaker-icon');
    if (!icon) return; // Evita errores si la página no tiene el botón

    if (player.muted) {
        icon.innerHTML = '<path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM4.34 2.93L2.93 4.34 7.29 8.7 7 9H3v6h4l5 5v-6.59l4.18 4.18c-.49.37-1.02.68-1.6.89v2.06c1.13-.23 2.18-.7 3.1-1.35l3.07 3.07 1.41-1.41L4.34 2.93zM10 15.17L7.83 13H5v-2h2.83l.88-.88L10 11.41v3.76zM19 12c0 .82-.15 1.61-.41 2.34l1.53 1.53c.56-1.17.88-2.48.88-3.87 0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zm-7-8l-2.18 2.18L12 8.36V4z"/>';
    } else {
        icon.innerHTML = '<path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77zM3 9v6h4l5 5V4L7 9H3z"/>';
    }
}

// Iniciar al cargar cualquier página
window.addEventListener('DOMContentLoaded', () => {
    initGlobalAudio();
    updateSpeakerIcon();
});