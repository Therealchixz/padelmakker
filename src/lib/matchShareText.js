/**
 * Tekst og link, når en kamp deles med venner (WhatsApp, Messenger, SMS …).
 *
 * Før stod der "En spiller inviterer dig til en padel-kamp på padel. Log ind
 * eller opret gratis profil på PadelMakker for at se kampen". Det siger ikke,
 * hvornår, hvilket niveau eller hvor mange der mangler - det er det, en ven
 * skal bruge for at sige ja.
 *
 * Linket får ?kilde=deling, så admin-kortet kan vise, hvor mange der kommer
 * ind via delte kampe (samme måling som mails, se log_app_return).
 *
 * Ingen supabase- eller vite-imports: bruges også af serveren til
 * link-forhåndsvisningen (padelmakker-server/routes/matchPreview.js).
 */

import { parseMatchLevelRange } from './matchLevelRange.js';
import { formatMatchLevelRangeLabel } from './padelLevelUtils.js';

export const SHARE_KILDE = 'deling';

const WEEKDAYS = ['søndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag'];
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

function clock(value) {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(value || ''));
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : '';
}

/** "mandag 28. sep kl. 21:00–23:30" (tom streng uden dato). */
export function shareWhenLabel(match) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(match?.date || ''));
  const start = clock(match?.time);
  const end = clock(match?.time_end);
  const time = start ? `kl. ${start}${end ? `–${end}` : ''}` : '';
  if (!m) return time;
  const y = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const weekday = new Date(Date.UTC(y, month - 1, day)).getUTCDay();
  return [`${WEEKDAYS[weekday]} ${day}. ${MONTHS[month - 1]}`, time].filter(Boolean).join(' ');
}

export function shareSpotsLeft(match) {
  const max = Number(match?.max_players) || 4;
  const cur = Number(match?.current_players) || 0;
  return Math.max(0, max - cur);
}

/** "Niveau 3.0 – 4.0" eller tom streng. */
export function shareLevelLabel(match) {
  const r = parseMatchLevelRange(match?.level_range);
  return (r && formatMatchLevelRangeLabel(r.min, r.max)) || '';
}

/** Kampens bane, eller tom streng hvis der ikke er valgt en endnu. */
export function shareCourtLabel(match) {
  const c = String(match?.court_name || '').trim();
  return c && c.toLowerCase() !== 'padel' ? c : '';
}

/** Offentligt link til kampen med ?kilde=deling. */
export function shareMatchUrl(origin, matchId) {
  const base = String(origin || '').replace(/\/+$/, '');
  return `${base}/kamp/${encodeURIComponent(String(matchId))}?kilde=${SHARE_KILDE}`;
}

/**
 * Beskeden, der sendes sammen med linket (linket sendes for sig, så
 * Messenger laver et kort ud fra det).
 * Fx "Vi mangler 3 spillere til padel mandag 28. sep kl. 21:00–23:30 🎾"
 */
export function buildMatchShareText(match) {
  const left = shareSpotsLeft(match);
  const when = shareWhenLabel(match);
  const first = left > 0
    ? `Vi mangler ${left} ${left === 1 ? 'spiller' : 'spillere'} til padel${when ? ` ${when}` : ''} 🎾`
    : `Padel${when ? ` ${when}` : ''} 🎾`;
  const details = [shareLevelLabel(match), shareCourtLabel(match)].filter(Boolean).join(' · ');
  return [first, details, 'Meld dig til gratis på PadelMakker.'].filter(Boolean).join('\n');
}

/**
 * Titel og beskrivelse til kortet, WhatsApp/Messenger viser under linket.
 * @param {{ creator_first_name?: string } & Record<string, unknown>} row fra public_match_preview
 */
export function matchPreviewMeta(row) {
  const left = shareSpotsLeft(row);
  const when = shareWhenLabel(row);
  const title = [
    `Padel${when ? ` ${when}` : ''}`,
    left > 0 ? `mangler ${left} ${left === 1 ? 'spiller' : 'spillere'}` : 'fuld',
  ].join(' · ');
  const creator = String(row?.creator_first_name || '').trim();
  const description = [
    shareLevelLabel(row),
    shareCourtLabel(row) || 'Bane ikke valgt endnu',
    creator ? `Oprettet af ${creator}` : '',
  ].filter(Boolean).join(' · ') + '. Meld dig til gratis på PadelMakker.';
  return { title, description };
}
