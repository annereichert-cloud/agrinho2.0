const CACHE_NAME = 'minhoca-vision-cache-v37';
const ASSETS = [
  '/',
  '/app',
  '/pages/creditos',
  '/css/styles.css',
  '/js/script.js',
  '/js/groq-api.js',
  '/js/app.js',
  '/manifest.webmanifest',
  '/pages/offline',
  '/assets/icone.png',
  '/assets/logomarca.png',
  '/prompts/laudo_solo.json',
  '/prompts/manuais/Fertilidade_Solo_Parana_Resumo_Expandido.md',
  '/prompts/manuais/Manual_Calagem_Adubacao_Resumo_Expandido.md'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    event.respondWith(fetch(event.request));
    return;
  }

  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          if (!response || response.status !== 200 || response.type !== 'basic' || response.redirected) {
            return response;
          }
          const cloned = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned));
          return response;
        })
        .catch(() => {
          const acceptsHtml = event.request.headers.get('accept')?.includes('text/html');
          if (event.request.mode === 'navigate' || acceptsHtml) {
            return caches.match('/pages/offline') || caches.match('/pages/offline.html');
          }
          return new Response('Recurso indisponivel offline.', {
            status: 503,
            statusText: 'Service Unavailable'
          });
        });
    })
  );
});