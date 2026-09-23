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

/**
 * E-mail-kanaler. For de fleste brugere er mail den ENESTE kanal, der virker:
 * push kraever, at appen er installeret som PWA, og det har 2 ud af 98 gjort.
 */
export const NOTIFICATION_EMAIL_CHANNELS = Object.freeze([
  { id: 'opdagelse', label: 'Nye makkere/kampe der passer' },
]);

/** Overordnet niveau for push til telefonen (master over kanal-til/fra). */
export const NOTIFICATION_PUSH_LEVELS = Object.freeze([
  { id: 'all', label: 'Alle' },
  { id: 'important', label: 'Kun det vigtige' },
  { id: 'off', label: 'Fra' },
]);
const VALID_PUSH_LEVELS = new Set(['all', 'important', 'off']);
const VALID_REACTIVATION_OPEN_MATCHES = new Set(['off', 'weekly', 'daily']);

/** Tips om åbne kampe nær brugerens by (genaktivering for 0 kampe). */
export const REACTIVATION_OPEN_MATCHES_OPTIONS = Object.freeze([
  {
    id: 'weekly',
    label: 'Ugentligt',
    description: 'Max én push om ugen, når der er åbne kampe nær dig (standard).',
  },
  {
    id: 'daily',
    label: 'Dagligt',
    description: 'Max én push om dagen, når der er kampe i nærheden.',
  },
  {
    id: 'off',
    label: 'Fra',
    description: 'Ingen tips om åbne kampe — hverken push eller den slags in-app besked.',
  },
]);

/**
 * "Stille om natten": ingen push til telefonen i tidsrummet, undtagen vigtige
 * beskeder. Samme standard som send-push (QUIET_DEFAULT).
 */
export const QUIET_HOURS_DEFAULT = Object.freeze({ enabled: true, start: 22, end: 7 });

function normalizeQuietHours(raw) {
  const q = raw && typeof raw === 'object' ? raw : {};
  const hour = (v, fallback) => (Number.isInteger(v) && v >= 0 && v <= 23 ? v : fallback);
  return {
    enabled: typeof q.enabled === 'boolean' ? q.enabled : QUIET_HOURS_DEFAULT.enabled,
    start: hour(q.start, QUIET_HOURS_DEFAULT.start),
    end: hour(q.end, QUIET_HOURS_DEFAULT.end),
  };
}

/** Er klokken (0-23) inden for det stille tidsrum? Tidsrummet må gå over midnat. */
export function isWithinQuietHours(hour, start, end) {
  if (start === end) return false;
  return start > end ? hour >= start || hour < end : hour >= start && hour < end;
}

const DEFAULT_PREFS = Object.freeze({
  pushLevel: 'all',
  reactivationOpenMatches: 'weekly',
  push: {
    kampe: true,
    opdagelse: true,
    resultat: true,
    liga: true,
    chat: true,
    invitation: true,
    system: true,
  },
  // Mail om nye makkere/kampe er slaaet TIL som standard.
  //
  // Den var fra, og knappen ligger inde i klokke-menuen. Resultat: 1 bruger ud
  // af 98 havde fundet den. Det er samme fejl som med selve makker-beskeden -
  // en indstilling, ingen finder, virker som om funktionen ikke findes.
  //
  // Forudsaetningen for at turde det er paa plads: frameldingen virker med ét
  // klik direkte fra mailen, uden login, og der sendes hoejst én mail per
  // person per uge.
  email: {
    opdagelse: true,
  },
});

export function normalizeNotificationPrefs(raw) {
  const base = {
    pushLevel: 'all',
    reactivationOpenMatches: DEFAULT_PREFS.reactivationOpenMatches,
    push: { ...DEFAULT_PREFS.push },
    email: { ...DEFAULT_PREFS.email },
    quietHours: normalizeQuietHours(null),
  };
  if (!raw || typeof raw !== 'object') return base;
  base.quietHours = normalizeQuietHours(raw.quietHours);
  if (typeof raw.pushLevel === 'string' && VALID_PUSH_LEVELS.has(raw.pushLevel)) {
    base.pushLevel = raw.pushLevel;
  }
  if (
    typeof raw.reactivationOpenMatches === 'string'
    && VALID_REACTIVATION_OPEN_MATCHES.has(raw.reactivationOpenMatches)
  ) {
    base.reactivationOpenMatches = raw.reactivationOpenMatches;
  }
  const push = raw.push && typeof raw.push === 'object' ? raw.push : {};
  for (const ch of NOTIFICATION_PUSH_CHANNELS) {
    if (typeof push[ch.id] === 'boolean') {
      base.push[ch.id] = push[ch.id];
    }
  }
  const email = raw.email && typeof raw.email === 'object' ? raw.email : {};
  for (const ch of NOTIFICATION_EMAIL_CHANNELS) {
    if (typeof email[ch.id] === 'boolean') {
      base.email[ch.id] = email[ch.id];
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

export function isEmailChannelEnabled(prefs, channel) {
  const normalized = normalizeNotificationPrefs(prefs);
  const key = String(channel || '');
  if (!(key in normalized.email)) return false;
  return normalized.email[key] === true;
}

export function mergeNotificationPrefToggle(prefs, channelId, enabled) {
  const normalized = normalizeNotificationPrefs(prefs);
  return {
    pushLevel: normalized.pushLevel,
    reactivationOpenMatches: normalized.reactivationOpenMatches,
    push: {
      ...normalized.push,
      [channelId]: Boolean(enabled),
    },
    email: { ...normalized.email },
    quietHours: { ...normalized.quietHours },
  };
}

export function mergeNotificationEmailToggle(prefs, channelId, enabled) {
  const normalized = normalizeNotificationPrefs(prefs);
  return {
    pushLevel: normalized.pushLevel,
    reactivationOpenMatches: normalized.reactivationOpenMatches,
    push: { ...normalized.push },
    email: {
      ...normalized.email,
      [channelId]: Boolean(enabled),
    },
    quietHours: { ...normalized.quietHours },
  };
}

export function mergeNotificationPushLevel(prefs, level) {
  const normalized = normalizeNotificationPrefs(prefs);
  return {
    pushLevel: VALID_PUSH_LEVELS.has(level) ? level : 'all',
    reactivationOpenMatches: normalized.reactivationOpenMatches,
    push: { ...normalized.push },
    email: { ...normalized.email },
    quietHours: { ...normalized.quietHours },
  };
}

export function getReactivationOpenMatches(prefs) {
  return normalizeNotificationPrefs(prefs).reactivationOpenMatches;
}

export function mergeReactivationOpenMatches(prefs, value) {
  const normalized = normalizeNotificationPrefs(prefs);
  const next = VALID_REACTIVATION_OPEN_MATCHES.has(value) ? value : 'weekly';
  return {
    pushLevel: normalized.pushLevel,
    reactivationOpenMatches: next,
    push: { ...normalized.push },
    email: { ...normalized.email },
    quietHours: { ...normalized.quietHours },
  };
}

/** @param {{ enabled?: boolean, start?: number, end?: number }} patch */
export function mergeQuietHours(prefs, patch) {
  const normalized = normalizeNotificationPrefs(prefs);
  return {
    ...normalized,
    quietHours: normalizeQuietHours({ ...normalized.quietHours, ...(patch || {}) }),
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
