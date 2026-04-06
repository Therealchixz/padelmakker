/**
 * PWA service worker — undgå at cache index.html (forårsager hvid skærm efter deploy:
 * gammel HTML peger på slettede hashed JS-filer).
 */
const CACHE_NAME = 'padelmakker-assets-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE_NAME)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = event.request.url;
  if (url.includes('supabase.co')) return;
  if (url.includes('googleapis.com')) return;
  if (url.includes('gstatic.com')) return;

  /* Lad browseren hente dokumenter direkte — altid frisk index.html fra serveren */
  if (event.request.mode === 'navigate') return;

  /* Statiske assets: netværk først, cache som fallback (offline) */
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (
          response.ok &&
          url.startsWith(self.location.origin) &&
          !url.endsWith('.html')
        ) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
