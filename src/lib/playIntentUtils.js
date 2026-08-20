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
