/**
 * Minimal service worker: ryd gamle caches, ingen fetch-intercept.
 * Tidligere versioner kunne kalde respondWith(undefined) ved netværksfejl +
 * tom cache → intermittent hvid skærm på mobil.
 */
const VERSION = 'padelmakker-sw-v4-eu-datetime';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Ingen 'fetch' handler — browseren håndterer alt (altid friske bundles efter deploy). */
