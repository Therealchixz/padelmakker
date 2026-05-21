/**
 * "Mangler 1 spiller" — notifikationslogik
 *
 * Når en kamp-opretter råber op, finder vi de mest relevante
 * spillere og sender dem in-app + push notifikation.
 *
 * Kriterier for kandidater:
 *   - Ikke allerede i kampen
 *   - Ikke banned
 *   - Aktiv inden for 21 dage (eller last_active_at mangler = ny bruger)
 *   - ELO inden for ±250 af opretterens ELO (fra elo_history, som Find Makker)
 *   - Samme region som kampopretterens profil (hvis tilgængeligt)
 *
 * Maks. 10 notifikationer pr. kald.
 * Cooldown: kan kun sende én gang pr. 30 min. (håndhæves af seeking_player_notified_at).
 */

import { supabase } from './supabase';
import { createNotificationsForUsers } from './notifications';
import { fetchEloByUserIdFromHistory } from './eloHistoryUtils';
import { resolveElo } from './matchmakingUtils';
import { PROFILE_KAMPE_SELECT } from './profileQueries';
import { normalizeProfileRow } from './profileUtils';

const MAX_NOTIFY       = 10;
const ELO_WINDOW       = 250;
const INACTIVE_DAYS    = 21;
const COOLDOWN_MINUTES = 30;
const CANDIDATE_LIMIT  = 120;

function isActive(profile) {
  if (!profile.last_active_at) return true; // ny bruger = antag aktiv
  const cutoff = Date.now() - INACTIVE_DAYS * 24 * 60 * 60 * 1000;
  return new Date(profile.last_active_at).getTime() >= cutoff;
}

function displayElo(profile, eloByUserId) {
  return resolveElo(profile, eloByUserId);
}

async function fetchSeekingPlayerCandidateProfiles(matchArea, playerIdSet) {
  let query = supabase
    .from('profiles')
    .select(PROFILE_KAMPE_SELECT)
    .eq('is_banned', false)
    .limit(CANDIDATE_LIMIT);

  if (matchArea) {
    query = query.eq('area', matchArea);
  }

  const { data, error } = await query;
  if (error) {
    console.warn('seeking_player candidates:', error.message);
    return [];
  }

  return (data || [])
    .map((row) => normalizeProfileRow(row))
    .filter((p) => p?.id != null && !playerIdSet.has(String(p.id)));
}

/**
 * Marker kampen som "søger spiller" og send notifikationer.
 *
 * @param {object} match           - matches-rækken
 * @param {object} creatorProfile  - opretterens profil (for ELO + region)
 * @param {string[]} playerIds     - user_ids allerede i kampen
 * @param {{ eloByUserId?: Record<string, number> }} [options] - evt. forudhentet elo_history (fx fra KampeTab)
 * @returns {{ notified: number, error: string|null, matchElo: number, matchArea: string|null }}
 */
export async function activateSeekingPlayer(match, creatorProfile, playerIds, options = {}) {
  // Cooldown-tjek
  if (match.seeking_player_notified_at) {
    const lastSent = new Date(match.seeking_player_notified_at).getTime();
    const minutesSince = (Date.now() - lastSent) / 60000;
    if (minutesSince < COOLDOWN_MINUTES) {
      const wait = Math.ceil(COOLDOWN_MINUTES - minutesSince);
      return { notified: 0, error: `Vent ${wait} min. før du råber op igen.`, matchElo: 1000, matchArea: null };
    }
  }

  const matchArea = creatorProfile.area || null;
  const playerIdSet = new Set(playerIds.map(String));
  const creatorId = String(creatorProfile?.id || '');

  const pool = await fetchSeekingPlayerCandidateProfiles(matchArea, playerIdSet);

  const idsForElo = [
    creatorId,
    ...pool.map((p) => String(p.id)),
  ].filter(Boolean);

  const fetchedElo = idsForElo.length > 0
    ? await fetchEloByUserIdFromHistory(idsForElo)
    : {};
  const eloByUserId = { ...(options.eloByUserId || {}), ...fetchedElo };

  const matchElo = displayElo(creatorProfile, eloByUserId);

  const candidates = pool
    .filter((p) => {
      if (!isActive(p)) return false;
      const elo = displayElo(p, eloByUserId);
      return Math.abs(elo - matchElo) <= ELO_WINDOW;
    })
    .map((p) => {
      const elo = displayElo(p, eloByUserId);
      const eloDiff = Math.abs(elo - matchElo);
      const eloScore = Math.max(0, 1 - eloDiff / ELO_WINDOW);
      const areaScore = matchArea && p.area === matchArea ? 1 : 0.3;
      const seekScore = p.seeking_match ? 1 : 0;
      const total = eloScore * 0.7 + areaScore * 0.2 + seekScore * 0.1;
      return { profile: p, score: total };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_NOTIFY);

  if (candidates.length === 0) {
    await supabase.from('matches').update({
      seeking_player: true,
      seeking_player_notified_at: new Date().toISOString(),
    }).eq('id', match.id);
    return { notified: 0, error: null, matchElo, matchArea };
  }

  const { error: updateErr } = await supabase.from('matches').update({
    seeking_player: true,
    seeking_player_notified_at: new Date().toISOString(),
  }).eq('id', match.id);

  if (updateErr) {
    return { notified: 0, error: updateErr.message, matchElo, matchArea };
  }

  const courtName = match.court_name || 'en bane';
  const dateTxt = match.date
    ? new Date(match.date).toLocaleDateString('da-DK', { weekday: 'short', day: 'numeric', month: 'short' })
    : '';
  const timeTxt = match.time ? match.time.slice(0, 5) : '';
  const title = '⚡ Mangler 1 spiller!';
  const body = `Kamp på ${courtName}${dateTxt ? ` · ${dateTxt}` : ''}${timeTxt ? ` kl. ${timeTxt}` : ''} · ELO ~${matchElo}`;

  const recipientIds = candidates.map(({ profile }) => profile.id);
  const notifyError = await createNotificationsForUsers(
    recipientIds,
    'seeking_player',
    title,
    body,
    match.id,
  );

  return {
    notified: notifyError ? 0 : recipientIds.length,
    error: notifyError ? (notifyError.message || String(notifyError)) : null,
    matchElo,
    matchArea,
  };
}

/**
 * Deaktiver "søger spiller" — fx når en spiller joiner og kampen er fuld.
 */
export async function deactivateSeekingPlayer(matchId) {
  await supabase.from('matches').update({ seeking_player: false }).eq('id', matchId);
}
