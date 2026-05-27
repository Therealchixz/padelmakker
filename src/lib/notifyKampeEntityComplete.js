import { supabase } from './supabase';
import { createNotificationsForUsers } from './notifications';
import { TOURNAMENT_ELO_LABEL, TOURNAMENT_KAMPE_PATH, tournamentDefaultName } from './tournamentCopy';

function isMissingEntityRpc(error) {
  const msg = String(error?.message || error || '').toLowerCase();
  return msg.includes('p_entity_type') || msg.includes('could not find the function');
}

/** Underret alle deltagere i en afsluttet Americano (undtagen actor). */
export async function notifyAmericanoTournamentCompleted(tournament, actorUserId) {
  if (!tournament?.id) return;
  const { data: parts, error } = await supabase
    .from('americano_participants')
    .select('user_id')
    .eq('tournament_id', tournament.id);
  if (error) {
    console.warn('notifyAmericano participants:', error.message);
    return;
  }
  const name = tournamentDefaultName(tournament);
  const ids = [...new Set((parts || []).map((p) => p.user_id).filter(Boolean))]
    .filter((id) => String(id) !== String(actorUserId));
  if (ids.length === 0) return;

  const title = 'Turnering afsluttet 🏆';
  const body = `"${name}" er afsluttet. Se resultater og ${TOURNAMENT_ELO_LABEL} under ${TOURNAMENT_KAMPE_PATH}.`;

  const err = await createNotificationsForUsers(ids, 'americano_completed', title, body, null, {
    entityType: 'americano',
    entityId: tournament.id,
  });
  if (err && isMissingEntityRpc(err)) {
    console.warn(
      'Americano-notifikationer kræver notifications_kampe_entity_focus.sql i Supabase.',
    );
  }
}

/** Underret alle spillere i en afsluttet liga (undtagen actor). */
export async function notifyLeagueCompleted(league, actorUserId) {
  if (!league?.id) return;
  const { data: teams, error } = await supabase
    .from('league_teams')
    .select('player1_id, player2_id')
    .eq('league_id', league.id);
  if (error) {
    console.warn('notifyLeague teams:', error.message);
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

  const title = 'Liga afsluttet 🏆';
  const body = `"${name}" er afsluttet. Se ranglisten under Kampe → Liga.`;

  const err = await createNotificationsForUsers(ids, 'league_completed', title, body, null, {
    entityType: 'league',
    entityId: league.id,
  });
  if (err && isMissingEntityRpc(err)) {
    console.warn(
      'Liga-notifikationer kræver notifications_kampe_entity_focus.sql i Supabase.',
    );
  }
}
