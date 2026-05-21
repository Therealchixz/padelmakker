const MIN_ROUNDS_TOGETHER = 1;
const TOP_N = 3;

/**
 * @param {Map<string, string>} participantUserById participant id → user id
 * @returns {'win' | 'loss' | 'tie' | null}
 */
export function outcomeForUserInAmericanoRound(match, participantUserById, userId, pointsPerMatch) {
  const a = match.team_a_score;
  const b = match.team_b_score;
  if (a == null || b == null) return null;
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) return null;
  if (a + b !== pointsPerMatch) return null;

  const uid = String(userId);
  const onA =
    participantUserById.get(match.team_a_p1) === uid
    || participantUserById.get(match.team_a_p2) === uid;
  const onB =
    participantUserById.get(match.team_b_p1) === uid
    || participantUserById.get(match.team_b_p2) === uid;
  if (!onA && !onB) return null;

  if (a === b) return 'tie';
  if (onA) return a > b ? 'win' : 'loss';
  return b > a ? 'win' : 'loss';
}

function winRate(wins, games) {
  return games > 0 ? wins / games : 0;
}

function bumpStat(statsMap, otherUserId, meta, role, outcome) {
  const key = String(otherUserId);
  if (!statsMap[key]) {
    statsMap[key] = {
      userId: otherUserId,
      name: meta?.name || 'Ukendt',
      emoji: meta?.emoji || '👤',
      asPartner: { rounds: 0, wins: 0 },
      asOpponent: { rounds: 0, wins: 0 },
    };
  }
  const row = statsMap[key];
  if (role === 'partner') {
    row.asPartner.rounds += 1;
    if (outcome === 'win') row.asPartner.wins += 1;
  } else {
    row.asOpponent.rounds += 1;
    if (outcome === 'win') row.asOpponent.wins += 1;
  }
}

/**
 * @param {{
 *   matches: Array<{
 *     tournament_id: string,
 *     team_a_p1: string, team_a_p2: string, team_b_p1: string, team_b_p2: string,
 *     team_a_score: number | null, team_b_score: number | null,
 *   }>,
 *   participants: Array<{ id: string, tournament_id: string, user_id: string, display_name?: string | null }>,
 *   pointsPerMatchByTournamentId: Record<string, number>,
 *   userId: string,
 * }} input
 */
export function aggregateAmericanoRelationStats({
  matches,
  participants,
  pointsPerMatchByTournamentId,
  userId,
}) {
  const participantUserById = new Map(
    (participants || []).map((p) => [p.id, String(p.user_id)]),
  );
  const metaByUserId = new Map();
  for (const p of participants || []) {
    const key = String(p.user_id);
    if (!metaByUserId.has(key)) {
      metaByUserId.set(key, { name: p.display_name || 'Ukendt', emoji: '👤' });
    }
  }

  const statsMap = {};
  const uid = String(userId);

  for (const m of matches || []) {
    const ppm = pointsPerMatchByTournamentId[m.tournament_id];
    if (!ppm) continue;
    const outcome = outcomeForUserInAmericanoRound(m, participantUserById, uid, ppm);
    if (!outcome) continue;

    const onA =
      participantUserById.get(m.team_a_p1) === uid
      || participantUserById.get(m.team_a_p2) === uid;
    const partnerSlots = onA ? [m.team_a_p1, m.team_a_p2] : [m.team_b_p1, m.team_b_p2];
    const opponentSlots = onA ? [m.team_b_p1, m.team_b_p2] : [m.team_a_p1, m.team_a_p2];

    for (const slot of partnerSlots) {
      const otherUid = participantUserById.get(slot);
      if (!otherUid || otherUid === uid) continue;
      bumpStat(statsMap, otherUid, metaByUserId.get(otherUid), 'partner', outcome);
    }
    for (const slot of opponentSlots) {
      const otherUid = participantUserById.get(slot);
      if (!otherUid) continue;
      bumpStat(statsMap, otherUid, metaByUserId.get(otherUid), 'opponent', outcome);
    }
  }

  const all = Object.values(statsMap);
  const eligiblePartners = all.filter((p) => p.asPartner.rounds >= MIN_ROUNDS_TOGETHER);
  const eligibleOpponents = all.filter((p) => p.asOpponent.rounds >= MIN_ROUNDS_TOGETHER);

  const bestPartners = [...eligiblePartners]
    .sort(
      (a, b) =>
        winRate(b.asPartner.wins, b.asPartner.rounds)
        - winRate(a.asPartner.wins, a.asPartner.rounds),
    )
    .slice(0, TOP_N);

  const toughestPartners = [...eligiblePartners]
    .sort(
      (a, b) =>
        winRate(a.asPartner.wins, a.asPartner.rounds)
        - winRate(b.asPartner.wins, b.asPartner.rounds),
    )
    .slice(0, TOP_N);

  const hardestOpponents = [...eligibleOpponents]
    .sort(
      (a, b) =>
        winRate(a.asOpponent.wins, a.asOpponent.rounds)
        - winRate(b.asOpponent.wins, b.asOpponent.rounds),
    )
    .slice(0, TOP_N);

  const easiestOpponents = [...eligibleOpponents]
    .sort(
      (a, b) =>
        winRate(b.asOpponent.wins, b.asOpponent.rounds)
        - winRate(a.asOpponent.wins, a.asOpponent.rounds),
    )
    .slice(0, TOP_N);

  return {
    bestPartners,
    toughestPartners,
    hardestOpponents,
    easiestOpponents,
  };
}
