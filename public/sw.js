/**
 * Service worker: ryd gamle caches + håndter browser push-notifikationer.
 */
const VERSION = 'padelmakker-sw-v39-home-invitationer';

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
  let data = {
    title: 'PadelMakker',
    body: 'Du har en ny notifikation',
    matchId: null,
    unreadCount: null,
    channel: 'system',
    level: 'normal',
    silent: false,
    renotify: false,
    tag: 'pm-notif',
  };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch (err) {
    /* Bevar default-payload men log så vi kan se hvis serveren sender ugyldig JSON. */
    try { console.error('[sw] ugyldig push-payload:', err); } catch { /* ignore */ }
  }

  const notificationTag = typeof data.tag === 'string' && data.tag.trim()
    ? data.tag.trim()
    : (data.matchId ? 'match-' + data.matchId : 'pm-notif');
  const shouldRenotify = Boolean(data.renotify) && notificationTag.length > 0;
  const shouldBeSilent = Boolean(data.silent);

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(data.title, {
        body: data.body,
        icon: '/icon-192-v2.png',
        badge: '/icon-192-v2.png',
        tag: notificationTag,
        renotify: shouldRenotify,
        silent: shouldBeSilent,
        data: { matchId: data.matchId, channel: data.channel, level: data.level },
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
  const d = event.notification.data || {};
  const matchId = d.matchId;
  const entityType = d.entityType;
  const entityId = d.entityId;
  let url = '/dashboard';
  if (entityType === 'americano' && entityId) {
    url = '/dashboard/kampe?format=americano&focus=' + encodeURIComponent(String(entityId));
  } else if (entityType === 'league' && entityId) {
    url = '/dashboard/kampe?format=liga&focus=' + encodeURIComponent(String(entityId));
  } else if (matchId) {
    url = '/dashboard/kampe?focus=' + encodeURIComponent(String(matchId));
  }

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
