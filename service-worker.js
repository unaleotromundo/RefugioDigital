const CACHE_NAME = 'refugio-digital-v2';
const DYNAMIC_CACHE = 'refugio-dynamic-v1';

// Archivos críticos para cachear en la instalación
const urlsToCache = [
  '/',
  '/index.html',
  '/crisis.html',
  '/recomendaciones.html',
  '/refugio.html',
  '/reflexiones.html',
  '/music-player.js',
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.css',
  'https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js',
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;600;800&display=swap'
];

// Instalación del Service Worker
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Instalando...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Cache abierto');
        // Intentar cachear todos, pero no fallar si alguno falla
        return Promise.allSettled(
          urlsToCache.map(url => 
            cache.add(url).catch(err => console.log(`Error cacheando ${url}:`, err))
          )
        );
      })
      .then(() => self.skipWaiting()) // Activar inmediatamente
  );
});

// Activación y limpieza de caché antiguo
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activando...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== DYNAMIC_CACHE) {
            console.log('[Service Worker] Eliminando caché antiguo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // Tomar control de todas las páginas
  );
});

// Estrategia de caching
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorar peticiones que no sean GET
  if (request.method !== 'GET') return;

  // Ignorar peticiones a APIs externas (Supabase, Blogger)
  if (url.origin.includes('supabase.co') || 
      url.origin.includes('blogspot.com') ||
      url.origin.includes('blogger.com')) {
    // Network only para APIs
    event.respondWith(fetch(request));
    return;
  }

  // Para recursos estáticos: Cache First
  if (request.destination === 'style' || 
      request.destination === 'script' || 
      request.destination === 'font' ||
      request.destination === 'image') {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Para páginas HTML: Network First
  if (request.destination === 'document') {
    event.respondWith(networkFirst(request));
    return;
  }

  // Por defecto: Cache First
  event.respondWith(cacheFirst(request));
});

// Estrategia Cache First
async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.log('[Service Worker] Fetch falló:', error);
    // Si es una imagen, podríamos retornar una imagen placeholder
    return new Response('Offline', { status: 503 });
  }
}

// Estrategia Network First
async function networkFirst(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.log('[Service Worker] Network falló, usando cache:', error);
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }
    
    // Página offline básica
    return new Response(
      `<!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Sin conexión - Tu Refugio Digital</title>
        <style>
          body {
            font-family: system-ui, -apple-system, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #fffcf7 0%, #fef3c7 100%);
            padding: 20px;
          }
          .container {
            text-align: center;
            max-width: 500px;
          }
          h1 {
            font-size: 2.5rem;
            color: #f59e0b;
            margin-bottom: 1rem;
          }
          p {
            font-size: 1.1rem;
            color: #64748b;
            line-height: 1.6;
          }
          button {
            margin-top: 2rem;
            padding: 1rem 2rem;
            background: #f59e0b;
            color: white;
            border: none;
            border-radius: 9999px;
            font-weight: bold;
            cursor: pointer;
            font-size: 1rem;
          }
          button:hover {
            background: #d97706;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🌟 Sin conexión</h1>
          <p>Parece que no tienes conexión a internet en este momento. Tu Refugio Digital estará aquí cuando vuelvas a conectarte.</p>
          <button onclick="window.location.reload()">Intentar de nuevo</button>
        </div>
      </body>
      </html>`,
      {
        headers: { 'Content-Type': 'text/html' }
      }
    );
  }
}