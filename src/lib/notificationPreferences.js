/** Push-kanaler (matcher notificationPolicy.channel). */
export const NOTIFICATION_PUSH_CHANNELS = Object.freeze([
  { id: 'kampe', label: 'Kampe & turneringer' },
  { id: 'resultat', label: 'Resultater & bekræftelser' },
  { id: 'liga', label: 'Liga & hold' },
  { id: 'chat', label: 'Kamp-chat' },
  { id: 'invitation', label: 'Invitationer' },
  { id: 'system', label: 'Vigtige beskeder (drift)' },
]);

const DEFAULT_PREFS = Object.freeze({
  push: {
    kampe: true,
    resultat: true,
    liga: true,
    chat: true,
    invitation: true,
    system: true,
  },
});

export function normalizeNotificationPrefs(raw) {
  const base = {
    push: { ...DEFAULT_PREFS.push },
  };
  if (!raw || typeof raw !== 'object') return base;
  const push = raw.push && typeof raw.push === 'object' ? raw.push : {};
  for (const ch of NOTIFICATION_PUSH_CHANNELS) {
    if (typeof push[ch.id] === 'boolean') {
      base.push[ch.id] = push[ch.id];
    }
  }
  return base;
}

/** Admin-kanal mappes til system-toggle for almindelige brugere. */
export function isPushChannelEnabled(prefs, channel) {
  const normalized = normalizeNotificationPrefs(prefs);
  const key = channel === 'admin' ? 'system' : String(channel || 'system');
  if (!(key in normalized.push)) return true;
  return normalized.push[key] !== false;
}

export function mergeNotificationPrefToggle(prefs, channelId, enabled) {
  const normalized = normalizeNotificationPrefs(prefs);
  return {
    push: {
      ...normalized.push,
      [channelId]: Boolean(enabled),
    },
  };
}
