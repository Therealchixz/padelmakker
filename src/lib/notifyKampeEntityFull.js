import { createNotification } from './notifications';
import { TOURNAMENT_KAMPE_PATH, tournamentDefaultName } from './tournamentCopy';

function isMissingEntityRpc(error) {
  const msg = String(error?.message || error || '').toLowerCase();
  return msg.includes('p_entity_type') || msg.includes('could not find the function');
}

/** Underret opretter når alle pladser er tilmeldt (status registration). */
export async function notifyAmericanoTournamentFull(tournament, actorUserId) {
  const creatorId = tournament?.creator_id;
  if (!creatorId || !tournament?.id) return;
  if (String(tournament.status || '').toLowerCase() !== 'registration') return;
  if (String(actorUserId) === String(creatorId)) return;

  const name = tournamentDefaultName(tournament);
  const slots = Number(tournament.player_slots) || 0;
  const slotsLabel = slots > 0 ? `${slots} ` : '';

  const err = await createNotification(
    creatorId,
    'americano_full',
    'Turneringen er fuld! 🎾',
    `Alle ${slotsLabel}pladser er tilmeldt i "${name}". Du kan starte turneringen under ${TOURNAMENT_KAMPE_PATH}.`,
    null,
    { entityType: 'americano', entityId: tournament.id },
  );
  if (err && isMissingEntityRpc(err)) {
    console.warn(
      'Americano fuld-notifikation kræver notifications_kampe_entity_focus.sql i Supabase.',
    );
  }
}

/** Underret opretter når maks. antal hold er tilmeldt (status registration). */
export async function notifyLeagueFull(league) {
  const creatorId = league?.created_by;
  if (!creatorId || !league?.id) return;
  if (String(league.status || '').toLowerCase() !== 'registration') return;
  const maxTeams = Number(league.max_teams);
  if (!Number.isFinite(maxTeams) || maxTeams <= 0) return;

  const name = String(league.name || 'Liga').trim() || 'Liga';

  const err = await createNotification(
    creatorId,
    'league_full',
    'Ligaen er fuld! 🎾',
    `Der er tilmeldt ${maxTeams} hold i "${name}". Du kan starte ligaen under Kampe → Liga.`,
    null,
    { entityType: 'league', entityId: league.id },
  );
  if (err && isMissingEntityRpc(err)) {
    console.warn(
      'Liga fuld-notifikation kræver notifications_kampe_entity_focus.sql i Supabase.',
    );
  }
}
