import { createNotification } from './notifications';

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

  const name = String(tournament.name || 'Americano').trim() || 'Americano';
  const remaining = Math.max(0, max - (before - 1));

  await createNotification(
    creatorId,
    'americano_spot_open',
    'Plads frigjort i Americano',
    wasFull
      ? `"${name}" er ikke længere fuld — ${remaining} ${remaining === 1 ? 'plads' : 'pladser'} tilbage.`
      : `"${name}" har nu ${remaining} ${remaining === 1 ? 'plads' : 'pladser'} tilbage.`,
    null,
    { entityType: 'americano', entityId: tournament.id },
  );
}
