/**
 * Online-status til chatten.
 *
 * "Online" afgøres nu af ægte realtime-presence (se lib/presence.js), ikke af
 * last_active_at. last_active_at bruges fortsat til "Sidst aktiv …"-teksten,
 * når brugeren IKKE er online lige nu.
 */
export const ONLINE_WINDOW_MS = 5 * 60 * 1000;

// Bagudkompatibel fallback (bruges hvis presence ikke er tilgængelig).
export function isUserOnline(lastActiveAt, nowMs = Date.now()) {
  if (!lastActiveAt) return false;
  const t = new Date(lastActiveAt).getTime();
  if (Number.isNaN(t)) return false;
  return nowMs - t <= ONLINE_WINDOW_MS;
}

/** Dansk "sidst aktiv"-tekst ud fra last_active_at. */
export function lastSeenLabel(lastActiveAt, nowMs = Date.now()) {
  if (!lastActiveAt) return 'Offline';
  const t = new Date(lastActiveAt).getTime();
  if (Number.isNaN(t)) return 'Offline';
  const diff = Math.max(0, nowMs - t);

  const min = Math.floor(diff / 60000);
  if (min < 1) return 'Sidst aktiv lige nu';
  if (min < 60) return `Sidst aktiv for ${min} min. siden`;

  const hours = Math.floor(min / 60);
  if (hours < 24) return `Sidst aktiv for ${hours} ${hours === 1 ? 'time' : 'timer'} siden`;

  const then = new Date(t);
  const now = new Date(nowMs);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const hhmm = then.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' });

  if (t >= startOfToday - 86400000 && t < startOfToday) {
    return `Sidst aktiv i går kl. ${hhmm}`;
  }

  const days = Math.floor(diff / 86400000);
  if (days < 7) return `Sidst aktiv for ${days} dage siden`;

  const dateStr = then.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' });
  return `Sidst aktiv ${dateStr}`;
}

/**
 * Status-label til chat-headeren.
 * @param {boolean} isOnline – fra realtime-presence
 * @param {string}  lastActiveAt – profilens last_active_at (til "sidst aktiv")
 */
export function onlineStatusLabel(isOnline, lastActiveAt, { elo, level } = {}) {
  if (isOnline) return 'Aktiv nu';
  const seen = lastSeenLabel(lastActiveAt);
  if (seen && seen !== 'Offline') return seen;
  if (elo && level) return `${elo} ELO · ≈ Niveau ${level}`;
  if (elo) return `${elo} ELO`;
  if (level) return `≈ Niveau ${level}`;
  return 'Offline';
}
