/** Push-kanaler (matcher notificationPolicy.channel). */
export const NOTIFICATION_PUSH_CHANNELS = Object.freeze([
  { id: 'kampe', label: 'Kampe & Americano/Mexicano' },
  { id: 'opdagelse', label: 'Nye kampe der passer' },
  { id: 'resultat', label: 'Resultater & bekræftelser' },
  { id: 'liga', label: 'Liga & hold' },
  { id: 'chat', label: 'Kamp-chat' },
  { id: 'invitation', label: 'Invitationer' },
  { id: 'system', label: 'Vigtige beskeder (drift)' },
]);

/** Overordnet niveau for push til telefonen (master over kanal-til/fra). */
export const NOTIFICATION_PUSH_LEVELS = Object.freeze([
  { id: 'all', label: 'Alle' },
  { id: 'important', label: 'Kun det vigtige' },
  { id: 'off', label: 'Fra' },
]);
const VALID_PUSH_LEVELS = new Set(['all', 'important', 'off']);

const DEFAULT_PREFS = Object.freeze({
  pushLevel: 'all',
  push: {
    kampe: true,
    opdagelse: true,
    resultat: true,
    liga: true,
    chat: true,
    invitation: true,
    system: true,
  },
});

export function normalizeNotificationPrefs(raw) {
  const base = {
    pushLevel: 'all',
    push: { ...DEFAULT_PREFS.push },
  };
  if (!raw || typeof raw !== 'object') return base;
  if (typeof raw.pushLevel === 'string' && VALID_PUSH_LEVELS.has(raw.pushLevel)) {
    base.pushLevel = raw.pushLevel;
  }
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
    pushLevel: normalized.pushLevel,
    push: {
      ...normalized.push,
      [channelId]: Boolean(enabled),
    },
  };
}

export function mergeNotificationPushLevel(prefs, level) {
  const normalized = normalizeNotificationPrefs(prefs);
  return {
    pushLevel: VALID_PUSH_LEVELS.has(level) ? level : 'all',
    push: { ...normalized.push },
  };
}

export function getNotificationPushLevel(prefs) {
  return normalizeNotificationPrefs(prefs).pushLevel;
}

/**
 * Master-gate: må denne notifikation pushe til telefonen givet brugerens niveau?
 * 'off' → aldrig; 'important' → kun vigtige; 'all' → alt (kanal-til/fra afgør resten).
 */
export function pushLevelAllows(prefs, isImportant) {
  const level = getNotificationPushLevel(prefs);
  if (level === 'off') return false;
  if (level === 'important') return Boolean(isImportant);
  return true;
}
