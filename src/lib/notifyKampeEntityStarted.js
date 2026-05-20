import { supabase } from './supabase';
import { createNotificationsForUsers } from './notifications';

function isMissingEntityRpc(error) {
  const msg = String(error?.message || error || '').toLowerCase();
  return msg.includes('p_entity_type') || msg.includes('could not find the function');
}

/** Deltagere får besked én gang når Americano går i gang (undtagen actor). */
export async function notifyAmericanoTournamentStarted(tournament, actorUserId) {
  if (!tournament?.id) return;
  const { data: parts, error } = await supabase
    .from('americano_participants')
    .select('user_id')
    .eq('tournament_id', tournament.id);
  if (error) {
    console.warn('notifyAmericano started participants:', error.message);
    return;
  }
  const name = String(tournament.name || 'Americano').trim() || 'Americano';
  const ids = [...new Set((parts || []).map((p) => p.user_id).filter(Boolean))]
    .filter((id) => String(id) !== String(actorUserId));
  if (ids.length === 0) return;

  const err = await createNotificationsForUsers(
    ids,
    'americano_started',
    'Americano er startet 🎾',
    `"${name}" er i gang. Se runder og resultater under Kampe → Americano.`,
    null,
    { entityType: 'americano', entityId: tournament.id },
  );
  if (err && isMissingEntityRpc(err)) {
    console.warn('Americano started-notifikation kræver entity RPC i Supabase.');
  }
}

/** Spillere på hold får besked én gang når ligaen startes (undtagen actor). */
export async function notifyLeagueStarted(league, actorUserId) {
  if (!league?.id) return;
  const { data: teams, error } = await supabase
    .from('league_teams')
    .select('player1_id, player2_id')
    .eq('league_id', league.id)
    .eq('status', 'ready');
  if (error) {
    console.warn('notifyLeague started teams:', error.message);
    return;
  }
  const name = String(league.name || 'Liga').trim() || 'Liga';
  const idSet = new Set();
  for (const t of teams || []) {
    if (t.player1_id) idSet.add(t.player1_id);
    if (t.player2_id) idSet.add(t.player2_id);
  }
  const ids = [...idSet].filter((id) => String(id) !== String(actorUserId));
  if (ids.length === 0) return;

  const err = await createNotificationsForUsers(
    ids,
    'league_started',
    'Ligaen er startet 🎾',
    `"${name}" er i gang. Se runde 1 under Kampe → Liga.`,
    null,
    { entityType: 'league', entityId: league.id },
  );
  if (err && isMissingEntityRpc(err)) {
    console.warn('Liga started-notifikation kræver entity RPC i Supabase.');
  }
}
