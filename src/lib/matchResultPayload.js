import { formatSubmittedPadelScore } from './matchResultScore.js';

function teamOf(player) {
  return Number(player?.team);
}

function finiteNumber(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeSetForPayload(set) {
  const gamesTeam1 = finiteNumber(set?.gamesTeam1);
  const gamesTeam2 = finiteNumber(set?.gamesTeam2);
  const tiebreakTeam1 = finiteNumber(set?.tiebreakTeam1);
  const tiebreakTeam2 = finiteNumber(set?.tiebreakTeam2);

  if (
    gamesTeam1 === 6 &&
    gamesTeam2 === 6 &&
    tiebreakTeam1 != null &&
    tiebreakTeam2 != null
  ) {
    const team1WonTiebreak = tiebreakTeam1 > tiebreakTeam2;
    return {
      ...set,
      gamesTeam1: team1WonTiebreak ? 7 : 6,
      gamesTeam2: team1WonTiebreak ? 6 : 7,
      tiebreakTeam1,
      tiebreakTeam2,
    };
  }

  return { ...set };
}

function submittedSetWinner(set) {
  const gamesTeam1 = finiteNumber(set?.gamesTeam1);
  const gamesTeam2 = finiteNumber(set?.gamesTeam2);
  if (gamesTeam1 == null || gamesTeam2 == null) return null;
  if (gamesTeam1 > gamesTeam2) return 'team1';
  if (gamesTeam2 > gamesTeam1) return 'team2';

  const tiebreakTeam1 = finiteNumber(set?.tiebreakTeam1);
  const tiebreakTeam2 = finiteNumber(set?.tiebreakTeam2);
  if (tiebreakTeam1 == null || tiebreakTeam2 == null) return null;
  if (tiebreakTeam1 > tiebreakTeam2) return 'team1';
  if (tiebreakTeam2 > tiebreakTeam1) return 'team2';
  return null;
}

export function buildMatchResultInsertPayload({ matchId, players, submittedBy, result }) {
  const roster = Array.isArray(players) ? players : [];
  const team1 = roster.filter((player) => teamOf(player) === 1);
  const team2 = roster.filter((player) => teamOf(player) === 2);
  const sets = (Array.isArray(result?.sets) ? result.sets : [])
    .slice(0, 3)
    .map(normalizeSetForPayload);

  const set1 = sets[0] || {};
  const set2 = sets[1] || {};
  const set3 = sets[2] || {};
  const setsWon = sets.reduce(
    (acc, set) => {
      const winner = submittedSetWinner(set);
      if (winner === 'team1') acc.team1 += 1;
      if (winner === 'team2') acc.team2 += 1;
      return acc;
    },
    { team1: 0, team2: 0 },
  );

  return {
    match_id: matchId,
    team1_player1_id: team1[0]?.user_id,
    team1_player2_id: team1[1]?.user_id,
    team2_player1_id: team2[0]?.user_id,
    team2_player2_id: team2[1]?.user_id,
    set1_team1: set1.gamesTeam1,
    set1_team2: set1.gamesTeam2,
    set1_tb1: set1.tiebreakTeam1,
    set1_tb2: set1.tiebreakTeam2,
    set2_team1: set2.gamesTeam1,
    set2_team2: set2.gamesTeam2,
    set2_tb1: set2.tiebreakTeam1,
    set2_tb2: set2.tiebreakTeam2,
    set3_team1: set3.gamesTeam1,
    set3_team2: set3.gamesTeam2,
    set3_tb1: set3.tiebreakTeam1,
    set3_tb2: set3.tiebreakTeam2,
    sets_won_team1: setsWon.team1,
    sets_won_team2: setsWon.team2,
    match_winner: result?.winner,
    score_display: formatSubmittedPadelScore(sets),
    submitted_by: submittedBy,
    confirmed: false,
  };
}
