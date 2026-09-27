import { createNotification, createNotificationsForUsers } from './notifications';
import { tournamentDefaultName } from './tournamentCopy.js';

/**
 * Underret deltagere når opretter sletter en Americano/Mexicano under tilmelding.
 */
export async function notifyAmericanoTournamentCancelled(tournament, actorUserId, participantUserIds) {
  if (!tournament?.id) return;
  const name = tournamentDefaultName(tournament);
  const ids = [...new Set((participantUserIds || []).filter(Boolean))]
    .filter((id) => String(id) !== String(actorUserId));
  if (!ids.length) return;
  const err = await createNotificationsForUsers(
    ids,
    'americano_cancelled',
    'Americano/Mexicano aflyst',
    `"${name}" er slettet af opretteren. Tilmeldingen er annulleret.`,
    null,
    { entityType: 'americano', entityId: tournament.id },
  );
  if (err) console.warn('notifyAmericano cancelled:', err.message || err);
}

/**
 * Opretter: plads åbnet igen — kun ved tilmelding og når turneringen var/næsten fuld.
 * (Undgår støj ved tidlig afmelding.)
 */
export async function notifyAmericanoSpotOpened(
  tournament,
  actorUserId,
  { countBeforeLeave, maxSlots },
) {
  const creatorId = tournament?.creator_id;
  if (!creatorId || !tournament?.id) return;
  if (String(tournament.status || '').toLowerCase() !== 'registration') return;
  if (String(actorUserId) === String(creatorId)) return;

  const max = Number(maxSlots) || 0;
  const before = Number(countBeforeLeave) || 0;
  if (max <= 0) return;

  const wasFull = before >= max;
  const wasAlmostFull = before >= max - 1;
  if (!wasFull && !wasAlmostFull) return;

  const name = tournamentDefaultName(tournament);
  const remaining = Math.max(0, max - (before - 1));

  await createNotification(
    creatorId,
    'americano_spot_open',
    'Plads frigjort i Americano/Mexicano',
    wasFull
      ? `"${name}" er ikke længere fuld — ${remaining} ${remaining === 1 ? 'plads' : 'pladser'} tilbage.`
      : `"${name}" har nu ${remaining} ${remaining === 1 ? 'plads' : 'pladser'} tilbage.`,
    null,
    { entityType: 'americano', entityId: tournament.id },
  );
}

/**
 * Underret holdenes spillere, når en liga slettes (ejeren 27. sep. 2026).
 * Skal kaldes, før ligaen slettes, mens holdene stadig findes.
 */
export async function notifyLeagueCancelled(league, actorUserId, playerUserIds) {
  if (!league?.id) return;
  const name = String(league.name || 'Liga').trim() || 'Liga';
  const ids = [...new Set((playerUserIds || []).filter(Boolean))]
    .filter((id) => String(id) !== String(actorUserId));
  if (!ids.length) return;
  const err = await createNotificationsForUsers(
    ids,
    'league_cancelled',
    'Liga aflyst',
    `"${name}" er slettet. Jeres tilmelding er annulleret.`,
    null,
    { entityType: 'league', entityId: league.id },
  );
  if (err) console.warn('notifyLeague cancelled:', err.message || err);
}
