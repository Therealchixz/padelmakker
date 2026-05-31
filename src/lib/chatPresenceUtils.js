/** Online presence from profiles.last_active_at (updated by AuthContext). */
export const ONLINE_WINDOW_MS = 5 * 60 * 1000;

export function isUserOnline(lastActiveAt, nowMs = Date.now()) {
  if (!lastActiveAt) return false;
  const t = new Date(lastActiveAt).getTime();
  if (Number.isNaN(t)) return false;
  return nowMs - t <= ONLINE_WINDOW_MS;
}

export function onlineStatusLabel(lastActiveAt, { elo, level } = {}) {
  if (isUserOnline(lastActiveAt)) return 'Aktiv nu';
  if (elo && level) return `${elo} ELO · Niveau ${level}`;
  if (elo) return `${elo} ELO`;
  if (level) return `Niveau ${level}`;
  return 'Offline';
}
