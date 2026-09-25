/**
 * Tekst og kort, når en Americano/Mexicano deles med venner.
 *
 * Før stod der fx 'En spiller inviterer dig til "Test" (25.09.2026 kl. 11:00)
 * på Ikke valgt / anden bane.' og kortet i Messenger var forsidens standard-
 * kort. Nu: hvem inviterer, hvornår, hvor mange der mangler - og kortet viser
 * det samme (padelmakker-server/routes/matchPreview.js).
 *
 * Ingen supabase- eller vite-imports: bruges også af serveren.
 */

import { SHARE_KILDE, shareWhenLabel } from './matchShareText.js';

/** Banenavne, der betyder "ingen bane valgt". */
const NO_COURT = new Set(['', 'padel', 'ikke valgt / anden bane', 'bane ikke angivet']);

export function tournamentFormatLabel(t) {
  return String(t?.format || '').toLowerCase() === 'mexicano' ? 'Mexicano' : 'Americano';
}

/** "torsdag 1. okt kl. 18:00" (tom streng uden dato og tid). */
export function tournamentWhenLabel(t) {
  return shareWhenLabel({ date: t?.tournament_date, time: t?.time_slot });
}

/** Banens navn, eller tom streng hvis der ikke er valgt en. */
export function tournamentCourtLabel(t) {
  const c = String(t?.court_name || '').trim();
  return NO_COURT.has(c.toLowerCase()) ? '' : c;
}

/** Turneringens eget navn, hvis det siger mere end "Americano"/"Mexicano". */
export function tournamentNameLabel(t) {
  const n = String(t?.name || '').trim();
  if (!n) return '';
  return ['americano', 'mexicano', 'americano/mexicano'].includes(n.toLowerCase()) ? '' : n;
}

/**
 * @param {{ player_slots?: number, participant_count?: number }} t
 * @param {number} [participantCount] tilmeldte (ellers t.participant_count)
 */
export function tournamentSpotsLeft(t, participantCount) {
  const slots = Number(t?.player_slots) || 0;
  const count = Number(participantCount ?? t?.participant_count) || 0;
  return Math.max(0, slots - count);
}

/** Offentligt link til turneringen med ?kilde=deling. */
export function shareTournamentUrl(origin, tournamentId) {
  const base = String(origin || '').replace(/\/+$/, '');
  return `${base}/turnering/${encodeURIComponent(String(tournamentId))}?kilde=${SHARE_KILDE}`;
}

/**
 * Beskeden, der sendes sammen med linket.
 * Fx "Mike inviterer dig til Americano torsdag 1. okt kl. 18:00 🎾"
 * @param {object} t turneringen
 * @param {{ hostName?: string, participantCount?: number }} [opts]
 */
export function buildTournamentShareText(t, opts = {}) {
  const format = tournamentFormatLabel(t);
  const when = tournamentWhenLabel(t);
  const host = String(opts.hostName || '').trim().split(/\s+/)[0] || '';
  const first = `${host ? `${host} inviterer dig til ` : ''}${format}${when ? ` ${when}` : ''} 🎾`;
  const details = [tournamentNameLabel(t) ? `"${tournamentNameLabel(t)}"` : '', tournamentCourtLabel(t)]
    .filter(Boolean)
    .join(' · ');
  const left = tournamentSpotsLeft(t, opts.participantCount);
  const slots = Number(t?.player_slots) || 0;
  const spots = slots > 0 ? (left > 0 ? `Mangler ${left} ${left === 1 ? 'spiller' : 'spillere'} (${slots} i alt)` : 'Fuldt booket') : '';
  return [first, details, spots, 'Meld dig til gratis på PadelMakker.'].filter(Boolean).join('\n');
}

/**
 * Titel og beskrivelse til kortet under linket.
 * @param {Record<string, unknown>} row fra public_americano_preview
 */
export function tournamentPreviewMeta(row) {
  const format = tournamentFormatLabel(row);
  const when = tournamentWhenLabel(row);
  const left = tournamentSpotsLeft(row);
  const title = [
    `${format}${when ? ` ${when}` : ''}`,
    left > 0 ? `mangler ${left} ${left === 1 ? 'spiller' : 'spillere'}` : 'fuldt booket',
  ].join(' · ');
  const slots = Number(row?.player_slots) || 0;
  const count = Number(row?.participant_count) || 0;
  const description = [
    tournamentNameLabel(row) ? `"${tournamentNameLabel(row)}"` : '',
    tournamentCourtLabel(row) || 'Bane ikke valgt endnu',
    slots > 0 ? `${count}/${slots} tilmeldt` : '',
  ].filter(Boolean).join(' · ') + '. Meld dig til gratis på PadelMakker.';
  return { title, description };
}
