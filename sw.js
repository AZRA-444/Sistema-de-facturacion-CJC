const CACHE_NAME = 'facturacion-cjc-v1';

// Archivos que se guardan en caché para funcionar offline
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/factura.html',
  '/assets/pages/facturacion.html',
  '/assets/pages/historial.html',
  '/assets/pages/administrador.html',
  '/assets/pages/login.html',
  '/assets/css/main.css',
  '/assets/css/global.css',
  '/assets/css/facturacion.css',
  '/assets/css/factura.css',
  '/assets/css/admin-panel.css',
  '/assets/css/home.css',
  '/assets/img/logo-jenk.png',
  '/js/utils.js',
  '/js/auth-guard.js',
  '/js/facturacion.js',
  '/js/facturasRecientes.js',
  '/js/generarFactura.js',
  '/js/admin-panel.js',
  '/js/supabase-config.js',
  '/manifest.json'
];

// ── INSTALL: guarda todos los archivos estáticos ──────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: elimina cachés viejos ──────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: estrategia por tipo de recurso ─────────────────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Supabase y CDNs externos → siempre red (no cachear datos ni libs externas)
  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('supabase.io') ||
    url.hostname.includes('cdn.jsdelivr.net') ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com') ||
    url.hostname.includes('cdnjs.cloudflare.com')
  ) {
    event.respondWith(fetch(event.request).catch(() => new Response('', { status: 503 })));
    return;
  }

  // Solo peticiones GET locales
  if (event.request.method !== 'GET') return;

  // Archivos estáticos → Cache First (rápido)
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      // Si no está en caché, buscar en red y guardar
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
        return response;
      }).catch(() => {
        // Offline fallback: si piden un HTML y no hay red, mostrar index
        if (event.request.destination === 'document') {
          return caches.match('/index.html');
        }
      });
    })
  );
});

// ── MENSAJE: forzar actualización del SW ─────────────────────────────────────
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
