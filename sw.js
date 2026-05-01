// ─────────────────────────────────────────────────────────────
// sw.js — Analizador de Incidencias
// Estrategia: Network-first para index.html, cache-first para libs
// skipWaiting: BAJO DEMANDA (solo cuando el usuario lo pide)
// ─────────────────────────────────────────────────────────────

// Cambia este número cada vez que subas una versión a GitHub.
// El navegador detectará que sw.js cambió y descargará el nuevo.
const SW_VERSION = '2.0.0';
const CACHE_NAME = 'gfd-incidencias-v' + SW_VERSION;

// Recursos que siempre se cachean en el install
const PRECACHE = [
  './',
  './index.html',
  'https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
];

// ── INSTALL: precachear recursos ──────────────────────────────
self.addEventListener('install', event => {
  console.log('[SW] Install v' + SW_VERSION);
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRECACHE).catch(err => {
        // Si alguna lib falla (offline), continuar igualmente
        console.warn('[SW] Precache parcial:', err);
      });
    })
    // NO llamamos a self.skipWaiting() aquí — esperamos el mensaje del usuario
  );
});

// ── ACTIVATE: limpiar cachés viejos ──────────────────────────
self.addEventListener('activate', event => {
  console.log('[SW] Activate v' + SW_VERSION);
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] Borrando caché antiguo:', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim()) // tomar control de todas las pestañas
  );
});

// ── MENSAJE desde la app (skipWaiting bajo demanda) ───────────
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] skipWaiting solicitado por el usuario');
    self.skipWaiting();
  }
});

// ── FETCH: estrategia según tipo de recurso ───────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Solo manejar GET
  if (event.request.method !== 'GET') return;

  // Recursos externos (CDN): cache-first — raramente cambian
  if (url.origin !== location.origin) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  // index.html y raíz: network-first — siempre queremos la última versión
  if (url.pathname === '/' || url.pathname.endsWith('index.html') || url.pathname.endsWith('/')) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // sw.js: siempre de red (para detectar actualizaciones)
  if (url.pathname.endsWith('sw.js')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Resto (manifest, iconos, etc.): network-first
  event.respondWith(networkFirst(event.request));
});

// ── Estrategia Network-First ──────────────────────────────────
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    // Si la respuesta es válida, actualizamos el caché
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    // Sin red → fallback al caché
    const cached = await caches.match(request);
    if (cached) return cached;
    // Último recurso: devolver index.html para rutas desconocidas
    return caches.match('./index.html');
  }
}

// ── Estrategia Cache-First ─────────────────────────────────────
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    return new Response('', { status: 408, statusText: 'Offline' });
  }
}
