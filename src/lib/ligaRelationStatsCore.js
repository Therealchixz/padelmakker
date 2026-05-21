const MIN_MATCHES_TOGETHER = 2;
const TOP_N = 3;

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
      asPartner: { matches: 0, wins: 0 },
      asOpponent: { matches: 0, wins: 0 },
    };
  }
  const row = statsMap[key];
  if (role === 'partner') {
    row.asPartner.matches += 1;
    if (outcome === 'win') row.asPartner.wins += 1;
  } else {
    row.asOpponent.matches += 1;
    if (outcome === 'win') row.asOpponent.wins += 1;
  }
}

function playerMetaFromTeam(team, playerId) {
  if (!team) return { name: 'Ukendt', emoji: '👤' };
  if (String(team.player1_id) === String(playerId)) {
    return { name: team.player1_name || 'Ukendt', emoji: team.player1_avatar || '👤' };
  }
  return { name: team.player2_name || 'Ukendt', emoji: team.player2_avatar || '👤' };
}

/**
 * @param {{
 *   matches: Array<{ id: string, team1_id: string, team2_id?: string | null, winner_id?: string | null, status: string }>,
 *   teamsById: Record<string, { id: string, player1_id: string, player2_id?: string | null, player1_name?: string, player2_name?: string, player1_avatar?: string, player2_avatar?: string, status?: string }>,
 *   userId: string,
 * }} input
 */
export function aggregateLigaRelationStats({ matches, teamsById, userId }) {
  const statsMap = {};
  const uid = String(userId);

  for (const m of matches || []) {
    if (m.status !== 'reported') continue;
    const t1 = teamsById[m.team1_id];
    const t2 = m.team2_id ? teamsById[m.team2_id] : null;
    if (!t1 || !t2) continue;
    if (t1.status && t1.status !== 'ready') continue;
    if (t2.status && t2.status !== 'ready') continue;

    const onT1 = String(t1.player1_id) === uid || String(t1.player2_id) === uid;
    const onT2 = String(t2.player1_id) === uid || String(t2.player2_id) === uid;
    if (!onT1 && !onT2) continue;

    const myTeam = onT1 ? t1 : t2;
    const oppTeam = onT1 ? t2 : t1;
    let outcome = 'tie';
    if (m.winner_id) {
      if (String(m.winner_id) === String(myTeam.id)) outcome = 'win';
      else if (String(m.winner_id) === String(oppTeam.id)) outcome = 'loss';
    }

    const partnerId =
      String(myTeam.player1_id) === uid ? myTeam.player2_id : myTeam.player1_id;
    if (partnerId) {
      bumpStat(statsMap, partnerId, playerMetaFromTeam(myTeam, partnerId), 'partner', outcome);
    }

    for (const oppPlayerId of [oppTeam.player1_id, oppTeam.player2_id]) {
      if (!oppPlayerId || String(oppPlayerId) === uid) continue;
      bumpStat(statsMap, oppPlayerId, playerMetaFromTeam(oppTeam, oppPlayerId), 'opponent', outcome);
    }
  }

  const all = Object.values(statsMap);
  const eligiblePartners = all.filter((p) => p.asPartner.matches >= MIN_MATCHES_TOGETHER);
  const eligibleOpponents = all.filter((p) => p.asOpponent.matches >= MIN_MATCHES_TOGETHER);

  const bestPartners = [...eligiblePartners]
    .sort(
      (a, b) =>
        winRate(b.asPartner.wins, b.asPartner.matches)
        - winRate(a.asPartner.wins, a.asPartner.matches),
    )
    .slice(0, TOP_N);

  const toughestPartners = [...eligiblePartners]
    .sort(
      (a, b) =>
        winRate(a.asPartner.wins, a.asPartner.matches)
        - winRate(b.asPartner.wins, b.asPartner.matches),
    )
    .slice(0, TOP_N);

  const hardestOpponents = [...eligibleOpponents]
    .sort(
      (a, b) =>
        winRate(a.asOpponent.wins, a.asOpponent.matches)
        - winRate(b.asOpponent.wins, b.asOpponent.matches),
    )
    .slice(0, TOP_N);

  const easiestOpponents = [...eligibleOpponents]
    .sort(
      (a, b) =>
        winRate(b.asOpponent.wins, b.asOpponent.matches)
        - winRate(a.asOpponent.wins, a.asOpponent.matches),
    )
    .slice(0, TOP_N);

  return {
    bestPartners,
    toughestPartners,
    hardestOpponents,
    easiestOpponents,
  };
}
