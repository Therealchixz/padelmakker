/**
 * Pulje-model — ren logik (ingen Supabase-import), så den kan unit-testes.
 */

/** Faste tidsbånd — to tryk er nok til at melde sig klar. */
export const PLAY_TIME_BANDS = [
  { key: 'morgen', label: 'Morgen', start: '07:00', end: '11:00' },
  { key: 'middag', label: 'Middag', start: '11:00', end: '15:00' },
  { key: 'eftermiddag', label: 'Eftermiddag', start: '15:00', end: '18:30' },
  { key: 'aften', label: 'Aften', start: '17:00', end: '21:30' },
];

export function timeBandByKey(key) {
  return PLAY_TIME_BANDS.find((b) => b.key === key) || null;
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

/** "Tir 25/8" — kort og læsbar dag-etiket. */
export function dayLabel(isoDate) {
  const [y, m, d] = String(isoDate || '').split('-').map(Number);
  if (!y || !m || !d) return '';
  const dt = new Date(Date.UTC(y, m - 1, d));
  return `${WEEKDAYS[dt.getUTCDay()]} ${d}/${m}`;
}

/** Postgres `time` kommer som "17:00:00" — vi viser kun time og minut. */
export function shortTime(value) {
  return String(value || '').slice(0, 5);
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
