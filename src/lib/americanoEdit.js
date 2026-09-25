/**
 * Ret en Americano/Mexicano: bane, dato og tid (ejeren 25. sep. 2026).
 * Samme regler som for kampe (matchEdit.js): kun opretteren, kun mens
 * tilmeldingen er åben, ikke tilbage i tiden. Valgt bane kan være fra listen
 * eller skrevet selv ("Anden bane – skriv selv").
 *
 * Ren logik uden supabase, så den kan testes fra node.
 */

import {
  MATCH_VENUE_CUSTOM,
  MATCH_VENUE_TBD,
  cleanCustomCourtName,
  courtIdFromVenueSelection,
  courtNameFromVenueSelection,
  isMatchVenueCustom,
  isMatchVenueTbd,
} from './matchVenueOptions.js';
import { shareWhenLabel } from './matchShareText.js';

export const AMERICANO_EDIT_DURATIONS = [60, 90, 120, 150, 180];

function clock(value) {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(value || ''));
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : '';
}

/** Kun opretteren, og kun mens tilmeldingen er åben. */
export function canEditTournament({ isCreator, status }) {
  return Boolean(isCreator) && status === 'registration';
}

/**
 * @param {object} t række fra americano_tournaments
 * @param {{ id: string, label: string, courtId: string | null }[]} venueOptions
 */
export function initialTournamentEditForm(t, venueOptions = []) {
  const courtId = t?.court_id ? String(t.court_id) : '';
  const rawName = String(t?.court_name || '').trim();
  const byId = courtId ? venueOptions.find((o) => String(o.courtId || '') === courtId) : null;
  const byName = !byId && rawName
    ? venueOptions.find((o) => String(o.label || '').trim().toLowerCase() === rawName.toLowerCase())
    : null;
  const venue = (byId || byName)?.id || (rawName ? MATCH_VENUE_CUSTOM : MATCH_VENUE_TBD);
  const dur = Number(t?.duration_minutes);
  return {
    venue,
    custom_court: isMatchVenueCustom(venue) ? rawName : '',
    date: String(t?.tournament_date || '').slice(0, 10),
    time: clock(t?.time_slot) || '18:00',
    duration: String(AMERICANO_EDIT_DURATIONS.includes(dur) ? dur : 120),
  };
}

/**
 * Ændringerne til update_americano_details.
 * @returns {{ patch: { date: string, time_slot: string, duration_minutes: number, court_id: string | null, court_name: string } | null, error: string }}
 */
export function buildTournamentEditPatch(form, t, venueOptions = [], now = new Date()) {
  const date = String(form?.date || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { patch: null, error: 'Vælg en dato.' };
  const time = clock(form?.time);
  if (!time) return { patch: null, error: 'Vælg en starttid.' };
  const duration = parseInt(form?.duration, 10);
  if (!duration || duration < 60) return { patch: null, error: 'Varighed skal være mindst 1 time.' };

  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  if (new Date(y, mo - 1, d, h, mi).getTime() < now.getTime()) {
    return { patch: null, error: 'Tidspunktet er allerede passeret. Vælg et senere tidspunkt.' };
  }

  const venue = form?.venue || MATCH_VENUE_TBD;
  const custom = isMatchVenueCustom(venue) ? cleanCustomCourtName(form?.custom_court) : '';
  if (isMatchVenueCustom(venue) && !custom) return { patch: null, error: 'Skriv navnet på banen.' };
  const chosen = !isMatchVenueTbd(venue);
  const courtId = chosen && !custom ? courtIdFromVenueSelection(venue, venueOptions) : null;
  const courtName = custom || (chosen ? courtNameFromVenueSelection(venue, venueOptions) : '');

  const patch = { date, time_slot: time, duration_minutes: duration, court_id: courtId, court_name: courtName };
  const before = {
    date: String(t?.tournament_date || '').slice(0, 10),
    time_slot: clock(t?.time_slot),
    duration_minutes: Number(t?.duration_minutes) || 120,
    court_id: t?.court_id || null,
    court_name: String(t?.court_name || ''),
  };
  const changed = Object.keys(patch).some((k) => String(patch[k] ?? '') !== String(before[k] ?? ''));
  if (!changed) return { patch: null, error: 'Du har ikke ændret noget.' };
  return { patch, error: '' };
}

function endClock(time, minutes) {
  const [h, m] = String(time || '').split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return '';
  const end = h * 60 + m + (Number(minutes) || 0);
  return `${String(Math.floor(end / 60) % 24).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`;
}

/** "torsdag 1. okt kl. 18:00–20:00 · Skansen Padel" */
export function tournamentEditSummary(patch) {
  const when = shareWhenLabel({
    date: patch?.date,
    time: patch?.time_slot,
    time_end: endClock(patch?.time_slot, patch?.duration_minutes),
  });
  const court = String(patch?.court_name || '').trim() || 'Bane ikke valgt endnu';
  return `${when} · ${court}`;
}

/** Beskeden i Americano-chatten. */
export function tournamentEditChatMessage(patch) {
  return `📅 Turneringen er ændret: ${tournamentEditSummary(patch)}`;
}

/** Teksten i notifikationen. */
export function tournamentEditNotificationBody(patch, creatorName, formatLabel = 'Americano') {
  const who = String(creatorName || '').trim().split(/\s+/)[0] || 'Opretteren';
  return `${who} har ændret ${formatLabel}: ${tournamentEditSummary(patch)}`;
}
