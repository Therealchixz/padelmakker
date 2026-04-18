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
 *   - ELO inden for ±250 af kampens gennemsnits-ELO
 *   - Samme region som kampopretterens profil (hvis tilgængeligt)
 *
 * Maks. 10 notifikationer pr. kald.
 * Cooldown: kan kun sende én gang pr. 30 min. (håndhæves af seeking_player_notified_at).
 */

import { supabase } from './supabase';
import { createNotification } from './notifications';

const MAX_NOTIFY       = 10;
const ELO_WINDOW       = 250;
const INACTIVE_DAYS    = 21;
const COOLDOWN_MINUTES = 30;

function isActive(profile) {
  if (!profile.last_active_at) return true; // ny bruger = antag aktiv
  const cutoff = Date.now() - INACTIVE_DAYS * 24 * 60 * 60 * 1000;
  return new Date(profile.last_active_at).getTime() >= cutoff;
}

/**
 * Marker kampen som "søger spiller" og send notifikationer.
 *
 * @param {object} match           - matches-rækken
 * @param {object} creatorProfile  - opretterens profil (for ELO + region)
 * @param {object[]} allProfiles   - alle profiler (allerede indlæst i KampeTab)
 * @param {string[]} playerIds     - user_ids allerede i kampen
 * @returns {{ notified: number, error: string|null }}
 */
export async function activateSeekingPlayer(match, creatorProfile, allProfiles, playerIds) {
  // Cooldown-tjek
  if (match.seeking_player_notified_at) {
    const lastSent = new Date(match.seeking_player_notified_at).getTime();
    const minutesSince = (Date.now() - lastSent) / 60000;
    if (minutesSince < COOLDOWN_MINUTES) {
      const wait = Math.ceil(COOLDOWN_MINUTES - minutesSince);
      return { notified: 0, error: `Vent ${wait} min. før du råber op igen.` };
    }
  }

  const matchElo   = Math.round(Number(creatorProfile.elo_rating) || 1000);
  const matchArea  = creatorProfile.area || null;
  const playerIdSet = new Set(playerIds.map(String));

  // Find kandidater
  const candidates = allProfiles
    .filter(p => {
      if (playerIdSet.has(String(p.id))) return false;
      if (p.is_banned) return false;
      if (!isActive(p)) return false;
      const elo = Math.round(Number(p.elo_rating) || 1000);
      if (Math.abs(elo - matchElo) > ELO_WINDOW) return false;
      return true;
    })
    .map(p => {
      // Simpel score: ELO-nærhed (70%) + region-match (20%) + seeking_match bonus (10%)
      const eloDiff   = Math.abs(Math.round(Number(p.elo_rating) || 1000) - matchElo);
      const eloScore  = Math.max(0, 1 - eloDiff / ELO_WINDOW);
      const areaScore = matchArea && p.area === matchArea ? 1 : 0.3;
      const seekScore = p.seeking_match ? 1 : 0;
      const total = eloScore * 0.7 + areaScore * 0.2 + seekScore * 0.1;
      return { profile: p, score: total };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_NOTIFY);

  if (candidates.length === 0) {
    // Sæt seeking_player = true selvom ingen kandidater — kortet vises stadig for alle
    await supabase.from('matches').update({
      seeking_player: true,
      seeking_player_notified_at: new Date().toISOString(),
    }).eq('id', match.id);
    return { notified: 0, error: null };
  }

  // Opdater kamp
  const { error: updateErr } = await supabase.from('matches').update({
    seeking_player: true,
    seeking_player_notified_at: new Date().toISOString(),
  }).eq('id', match.id);

  if (updateErr) return { notified: 0, error: updateErr.message };

  // Byg notifikationstekst
  const courtName = match.court_name || 'en bane';
  const dateTxt   = match.date
    ? new Date(match.date).toLocaleDateString('da-DK', { weekday: 'short', day: 'numeric', month: 'short' })
    : '';
  const timeTxt   = match.time ? match.time.slice(0, 5) : '';
  const title     = '⚡ Mangler 1 spiller!';
  const body      = `Kamp på ${courtName}${dateTxt ? ` · ${dateTxt}` : ''}${timeTxt ? ` kl. ${timeTxt}` : ''} · ELO ~${matchElo}`;

  // Send notifikationer
  let notified = 0;
  await Promise.allSettled(
    candidates.map(async ({ profile }) => {
      await createNotification(profile.id, 'seeking_player', title, body, match.id);
      notified++;
    })
  );

  return { notified, error: null };
}

/**
 * Deaktiver "søger spiller" — fx når en spiller joiner og kampen er fuld.
 */
export async function deactivateSeekingPlayer(matchId) {
  await supabase.from('matches').update({ seeking_player: false }).eq('id', matchId);
}
