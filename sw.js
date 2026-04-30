const CACHE = 'incidencias-v4';
const ASSETS = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Instalar: cachear recursos esenciales
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS))
  );
  // NO llamar skipWaiting aquí — esperar a que el usuario confirme
});

// Activar: limpiar caches antiguas y tomar control
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Escuchar mensaje SKIP_WAITING del cliente (cuando el usuario pulsa "Actualizar")
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Estrategia: Network first para recursos propios, cache fallback
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  const isOwn = url.origin === self.location.origin;
  const isCDN = url.hostname.includes('cdnjs') || url.hostname.includes('fonts') || url.hostname.includes('jsdelivr');

  if (isOwn || isCDN) {
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
});
