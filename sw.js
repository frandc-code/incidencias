const CACHE = 'incidencias-v2';
const ASSETS = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap'
];

// Instalar y cachear recursos
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => {
      // Cachear recursos propios de forma fiable
      // Los CDN externos se cachean bajo demanda (algunos bloquean precache)
      return c.addAll(['./index.html', './manifest.json']);
    })
  );
  self.skipWaiting();
});

// Limpiar caches antiguas
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Estrategia: Cache first para recursos propios, Network first para CDN
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  const isOwn = url.origin === self.location.origin;
  const isCDN = url.hostname.includes('cdnjs') || url.hostname.includes('fonts');

  if (isOwn) {
    // Recursos propios: cache first, fallback a network
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
          }
          return res;
        }).catch(() => caches.match('./index.html'));
      })
    );
  } else if (isCDN) {
    // CDN: network first, cache fallback
    e.respondWith(
      fetch(e.request).then(res => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => caches.match(e.request))
    );
  }
  // Resto: dejar pasar sin modificar
});
