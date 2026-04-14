/**
 * Service worker: ryd gamle caches + håndter browser push-notifikationer.
 */
const VERSION = 'padelmakker-sw-v6-badge';

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

/* ── Push notification modtaget fra server ── */
self.addEventListener('push', (event) => {
  let data = { title: 'PadelMakker', body: 'Du har en ny notifikation', matchId: null };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch { /* brug default */ }

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(data.title, {
        body: data.body,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: data.matchId ? 'match-' + data.matchId : 'pm-notif',
        renotify: true,
        data: { matchId: data.matchId },
      }),
      // Sæt badge på app-ikonet (virker på Android og iOS 16.4+ PWA)
      self.navigator?.setAppBadge?.().catch?.(() => {}),
    ])
  );
});

/* ── Bruger trykker på en push-notifikation ── */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const matchId = event.notification.data?.matchId;
  const url = matchId
    ? '/dashboard/kampe?focus=' + encodeURIComponent(String(matchId))
    : '/dashboard';

  event.waitUntil(
    Promise.all([
      // Ryd badge når brugeren klikker notifikationen
      self.navigator?.clearAppBadge?.().catch?.(() => {}),
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
        for (const client of clients) {
          if (client.url.includes('/dashboard') && 'focus' in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        if (self.clients.openWindow) return self.clients.openWindow(url);
      }),
    ])
  );
});
