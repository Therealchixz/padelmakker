/**
 * Pulje-model — ren logik (ingen Supabase-import), så den kan unit-testes.
 */

/**
 * Notifikationer der handler om et pulje-forslag. De håndteres på Hjem, hvor
 * kortet med ja/nej-knapperne står — ikke i Kampe-fanen som øvrige kampbeskeder.
 */
export const PROPOSAL_NOTIF_TYPES = Object.freeze([
  'match_proposal',
  'match_proposal_reminder',
  'match_proposal_declined',
]);

export function isProposalNotification(type) {
  return PROPOSAL_NOTIF_TYPES.includes(String(type || ''));
}

/** Kampen kræver mindst 1½ time; hensigten kan godt være længere. */
export const MIN_PLAY_WINDOW_MINUTES = 90;

export function timeToMinutes(hhmm) {
  const [h, m] = String(hhmm || '').split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

export function minutesToTime(total) {
  const n = Number(total);
  if (!Number.isFinite(n) || n < 0) return '';
  const h = Math.floor(n / 60);
  const m = n % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Hvert halve time-slag fra 06:00 til 23:30 — baner åbner tidligt og sent. */
export const PLAY_TIME_SLOTS = Object.freeze(
  Array.from({ length: 36 }, (_, i) => minutesToTime(6 * 60 + i * 30)),
);

const LAST_SLOT_MINUTES = timeToMinutes(PLAY_TIME_SLOTS[PLAY_TIME_SLOTS.length - 1]);

/** Starttider hvor der stadig er mindst 1½ time til sidste slut. */
export const PLAY_START_SLOTS = Object.freeze(
  PLAY_TIME_SLOTS.filter((t) => (timeToMinutes(t) ?? 0) + MIN_PLAY_WINDOW_MINUTES <= LAST_SLOT_MINUTES),
);

/**
 * Hurtige forslag. Ikke-overlappende, så "eftermiddag" ikke æder "aften".
 * De udfylder bare fra/til — brugeren kan stadig vælge 10–12 frit.
 */
export const PLAY_WINDOW_PRESETS = Object.freeze([
  { key: 'tidlig', label: 'Tidlig', start: '06:00', end: '09:00' },
  { key: 'formiddag', label: 'Formiddag', start: '09:00', end: '12:00' },
  { key: 'middag', label: 'Middag', start: '12:00', end: '15:00' },
  { key: 'eftermiddag', label: 'Eftermiddag', start: '15:00', end: '18:00' },
  { key: 'aften', label: 'Aften', start: '18:00', end: '21:00' },
  { key: 'sen', label: 'Sen aften', start: '21:00', end: '23:30' },
]);

/** @deprecated Brug PLAY_WINDOW_PRESETS — beholdt så ældre imports ikke knækker. */
export const PLAY_TIME_BANDS = PLAY_WINDOW_PRESETS;

export function timeBandByKey(key) {
  return PLAY_WINDOW_PRESETS.find((b) => b.key === key) || null;
}

export function windowMinutes(start, end) {
  const a = timeToMinutes(start);
  const b = timeToMinutes(end);
  if (a == null || b == null) return 0;
  return b - a;
}

export function isValidPlayWindow(start, end) {
  return windowMinutes(start, end) >= MIN_PLAY_WINDOW_MINUTES;
}

export function matchingPresetKey(start, end) {
  return PLAY_WINDOW_PRESETS.find((p) => p.start === start && p.end === end)?.key || null;
}

/** Mulige sluttidspunkter: mindst 1½ time efter start. */
export function endSlotsAfter(start) {
  const minEnd = (timeToMinutes(start) ?? 0) + MIN_PLAY_WINDOW_MINUTES;
  return PLAY_TIME_SLOTS.filter((t) => (timeToMinutes(t) ?? 0) >= minEnd);
}

export function clampEndToWindow(start, end) {
  const slots = endSlotsAfter(start);
  if (slots.includes(end)) return end;
  return slots[0] || end;
}

/** ISO-dato (YYYY-MM-DD) i dansk tid, n dage frem. */
export function isoDateOffset(days = 0) {
  const now = new Date();
  const dk = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Copenhagen' }));
  dk.setDate(dk.getDate() + days);
  const y = dk.getFullYear();
  const m = String(dk.getMonth() + 1).padStart(2, '0');
  const d = String(dk.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const WEEKDAYS = ['Søn', 'Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør'];
const MONTHS_SHORT = ['JAN', 'FEB', 'MAR', 'APR', 'MAJ', 'JUN', 'JUL', 'AUG', 'SEP', 'OKT', 'NOV', 'DEC'];

/** "Tir 25/8" — kort og læsbar dag-etiket. */
export function dayLabel(isoDate) {
  const [y, m, d] = String(isoDate || '').split('-').map(Number);
  if (!y || !m || !d) return '';
  const dt = new Date(Date.UTC(y, m - 1, d));
  return `${WEEKDAYS[dt.getUTCDay()]} ${d}/${m}`;
}

/** Datobadge til kort: dagtal + trebogstavs-måned, som på Kommende-listen. */
export function dateBadge(isoDate) {
  const [y, m, d] = String(isoDate || '').split('-').map(Number);
  if (!y || !m || !d) return { day: '', month: '' };
  return { day: String(d), month: MONTHS_SHORT[m - 1] };
}

/** Chip-tekst: "I dag" / "I morgen" slår ugedagen, så man ikke skal tælle. */
export function dayChoiceLabel(isoDate) {
  if (!isoDate) return '';
  if (isoDate === isoDateOffset(0)) return 'I dag';
  if (isoDate === isoDateOffset(1)) return 'I morgen';
  return dayLabel(isoDate);
}

/** Flere dage i én hensigt: slå til/fra, men behold mindst én. */
export function toggleSelectedDay(selected, isoDate) {
  const next = new Set((selected || []).filter(Boolean));
  if (!isoDate) return [...next].sort();
  if (next.has(isoDate)) {
    if (next.size <= 1) return [...next].sort();
    next.delete(isoDate);
  } else {
    next.add(isoDate);
  }
  return [...next].sort();
}

/** "i dag", "i dag og i morgen", "3 dage". */
export function formatSelectedDays(isoDates) {
  const sorted = [...new Set((isoDates || []).filter(Boolean))].sort();
  if (sorted.length === 0) return '';
  if (sorted.length === 1) return dayChoiceLabel(sorted[0]).toLowerCase();
  if (sorted.length === 2) {
    return `${dayChoiceLabel(sorted[0]).toLowerCase()} og ${dayChoiceLabel(sorted[1]).toLowerCase()}`;
  }
  return `${sorted.length} dage`;
}

/** Postgres `time` kommer som "17:00:00" — vi viser kun time og minut. */
export function shortTime(value) {
  return String(value || '').slice(0, 5);
}

/** Chip-tid: "17:00–23:00" bliver "17–23", "17:30–21:00" bliver "17:30–21". */
export function compactHourRange(start, end) {
  const label = (value) => {
    const t = shortTime(value);
    if (!t) return '';
    const [h, m] = t.split(':');
    if (m === '00') return String(Number(h));
    return t;
  };
  const a = label(start);
  const b = label(end);
  if (!a || !b) return '';
  return `${a}–${b}`;
}

/**
 * Resterende svartid på et kampforslag.
 *
 * Fristen er et døgn, men aldrig senere end to timer før spilletid, så den
 * kan sagtens være kort. Derfor markeres de sidste tre timer som `urgent`,
 * så kortet kan skille sig ud, mens der stadig er tid til at booke bane.
 *
 * @returns {{ label: string, urgent: boolean, expired: boolean } | null}
 */
export function deadlineInfo(expiresAt, now = Date.now()) {
  /* new Date(null) er 1970 og dermed "udløbet" — det ville slå Bekræft-knappen
     fra på et gyldigt forslag, hvis fristen manglede. */
  if (expiresAt == null || expiresAt === '') return null;

  const target = new Date(expiresAt).getTime();
  if (!Number.isFinite(target)) return null;

  const ms = target - now;
  if (ms <= 0) return { label: 'Udløbet', urgent: true, expired: true };

  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return { label: 'Under 1 min tilbage', urgent: true, expired: false };
  if (minutes < 60) return { label: `${minutes} min tilbage`, urgent: true, expired: false };

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return {
      label: `${hours} ${hours === 1 ? 'time' : 'timer'} tilbage`,
      urgent: hours < 3,
      expired: false,
    };
  }

  const days = Math.floor(hours / 24);
  return { label: `${days} ${days === 1 ? 'dag' : 'dage'} tilbage`, urgent: false, expired: false };
}
