/**
 * Service worker: ryd gamle caches + håndter browser push-notifikationer.
 */
const VERSION = 'padelmakker-sw-v5-push';

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
  let data = { title: 'PadelMakker', body: 'Du har en ny notifikation', matchId: null, unreadCount: null };
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
      (async () => {
        // App icon badge (hvis browser/OS understøtter Badging API)
        try {
          const reg = self.registration;
          const canSetOnRegistration = reg && typeof reg.setAppBadge === 'function';
          const canClearOnRegistration = reg && typeof reg.clearAppBadge === 'function';
          const canSetOnNavigator = self.navigator && typeof self.navigator.setAppBadge === 'function';
          const canClearOnNavigator = self.navigator && typeof self.navigator.clearAppBadge === 'function';

          if (!canSetOnRegistration && !canSetOnNavigator) return;

          if (typeof data.unreadCount === 'number') {
            if (data.unreadCount > 0) {
              if (canSetOnRegistration) await reg.setAppBadge(data.unreadCount);
              else await self.navigator.setAppBadge(data.unreadCount);
            } else if (data.unreadCount === 0) {
              if (canClearOnRegistration) await reg.clearAppBadge();
              else if (canClearOnNavigator) await self.navigator.clearAppBadge();
            }
          } else {
            // Fallback: vis "dot" badge uden count
            if (canSetOnRegistration) await reg.setAppBadge();
            else await self.navigator.setAppBadge();
          }
        } catch {
          /* ignorer badge fejl */
        }
      })(),
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
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      /* Fokusér eksisterende fane hvis muligt */
      for (const client of clients) {
        if (client.url.includes('/dashboard') && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      /* Ellers åbn ny fane */
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
