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
    // Iconos para todos los botones posibles
    const iconSidebar = document.getElementById('speaker-icon-sidebar');
    const iconMobile = document.getElementById('speaker-icon-mobile');
    const iconRegular = document.getElementById('speaker-icon');
    
    // Todos los botones de música
    const btnSidebar = document.getElementById('music-btn-sidebar');
    const btnMobile = document.getElementById('music-btn-mobile');
    const btnRegular = document.querySelector('button[onclick*="toggleMusic"]');
    
    // SVG del icono según el estado
    let iconHTML;
    
    if (player && player.muted) {
        // ICONO MUTEADO (con X)
        iconHTML = '<path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM4.34 2.93L2.93 4.34 7.29 8.7 7 9H3v6h4l5 5v-6.59l4.18 4.18c-.49.37-1.02.68-1.6.89v2.06c1.13-.23 2.18-.7 3.1-1.35l3.07 3.07 1.41-1.41L4.34 2.93zM10 15.17L7.83 13H5v-2h2.83l.88-.88L10 11.41v3.76zM19 12c0 .82-.15 1.61-.41 2.34l1.53 1.53c.56-1.17.88-2.48.88-3.87 0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zm-7-8l-2.18 2.18L12 8.36V4z"/>';
        
        // Cambiar color a ROJO cuando está muteado
        [btnSidebar, btnMobile, btnRegular].forEach(btn => {
            if (btn) {
                btn.classList.remove('text-amber-600', 'dark:text-amber-400');
                btn.classList.add('!text-red-500', 'dark:!text-red-400');
            }
        });
        
    } else {
        // ICONO NORMAL (con ondas de sonido)
        iconHTML = '<path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>';
        
        // Cambiar color a AMBER cuando está sonando
        [btnSidebar, btnMobile, btnRegular].forEach(btn => {
            if (btn) {
                btn.classList.remove('!text-red-500', 'dark:!text-red-400');
                btn.classList.add('text-amber-600', 'dark:text-amber-400');
            }
        });
    }
    
    // Actualizar el SVG de todos los iconos
    if (iconSidebar) iconSidebar.innerHTML = iconHTML;
    if (iconMobile) iconMobile.innerHTML = iconHTML;
    if (iconRegular) iconRegular.innerHTML = iconHTML;
}

// Función para actualizar iconos de tema (sol/luna)
function updateThemeIcons() {
    const isDark = document.documentElement.classList.contains('dark');
    
    // SVG para modo CLARO (mostrar luna para cambiar a oscuro)
    const moonIcon = '<path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"/>';
    
    // SVG para modo OSCURO (mostrar sol para cambiar a claro)
    const sunIcon = '<path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"/>';
    
    // Buscar TODOS los posibles SVGs de tema
    const svgs = document.querySelectorAll('button[onclick*="toggleDarkMode"] svg, .sidebar-controls svg, .mobile-header svg');
    
    svgs.forEach(svg => {
        // Solo actualizar si el SVG es parte de un botón de tema (no del botón de música)
        const btn = svg.closest('button');
        if (btn && btn.onclick && btn.onclick.toString().includes('toggleDarkMode')) {
            svg.innerHTML = isDark ? sunIcon : moonIcon;
        }
    });
    
    // TAMBIÉN buscar por estructura específica (botones sin onclick inline)
    document.querySelectorAll('.sidebar-controls button:last-child svg, button[class*="dark:text-amber"] svg').forEach(svg => {
        const btn = svg.closest('button');
        // Verificar que NO sea el botón de música
        if (btn && !btn.id?.includes('music')) {
            svg.innerHTML = isDark ? sunIcon : moonIcon;
        }
    });
}

// SOBRESCRIBIR COMPLETAMENTE la función toggleDarkMode
// Este código se ejecuta DESPUÉS de que se carguen otros scripts
setTimeout(() => {
    const originalToggle = window.toggleDarkMode;
    
    window.toggleDarkMode = function() {
        // Ejecutar la función original si existe
        if (originalToggle && originalToggle !== window.toggleDarkMode) {
            originalToggle();
        } else {
            // Si no existe, hacer el toggle manualmente
            document.documentElement.classList.toggle('dark');
            localStorage.theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
        }
        
        // SIEMPRE actualizar los iconos después
        updateThemeIcons();
    };
    
    // Forzar actualización inicial
    updateThemeIcons();
}, 100);

// Iniciar al cargar cualquier página
window.addEventListener('DOMContentLoaded', () => {
    initGlobalAudio();
    updateSpeakerIcon();
    updateThemeIcons(); // Actualizar iconos de tema al cargar
});