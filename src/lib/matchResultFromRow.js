import { toFiniteNumber } from './matchResultScore.js';

function hasPlayedSet(g1, g2) {
  const a = toFiniteNumber(g1);
  const b = toFiniteNumber(g2);
  return a != null && b != null && (a > 0 || b > 0);
}

/** DB-række → PadelMatchResultInput initialData */
export function matchResultRowToPadelResult(row, team1Label = 'Hold 1', team2Label = 'Hold 2') {
  if (!row) {
    return {
      team1: team1Label,
      team2: team2Label,
      sets: [],
      winner: null,
      completed: false,
    };
  }

  const sets = [];
  for (let n = 1; n <= 3; n += 1) {
    const g1 = row[`set${n}_team1`];
    const g2 = row[`set${n}_team2`];
    if (!hasPlayedSet(g1, g2)) continue;

    let gamesTeam1 = toFiniteNumber(g1);
    let gamesTeam2 = toFiniteNumber(g2);
    const tiebreakTeam1 = toFiniteNumber(row[`set${n}_tb1`]);
    const tiebreakTeam2 = toFiniteNumber(row[`set${n}_tb2`]);

    if (
      gamesTeam1 === 7 &&
      gamesTeam2 === 6 &&
      tiebreakTeam1 != null &&
      tiebreakTeam2 != null
    ) {
      gamesTeam1 = 6;
      gamesTeam2 = 6;
    } else if (
      gamesTeam1 === 6 &&
      gamesTeam2 === 7 &&
      tiebreakTeam1 != null &&
      tiebreakTeam2 != null
    ) {
      gamesTeam1 = 6;
      gamesTeam2 = 6;
    }

    sets.push({
      setNumber: n,
      gamesTeam1: gamesTeam1 ?? 0,
      gamesTeam2: gamesTeam2 ?? 0,
      tiebreakTeam1: tiebreakTeam1 ?? undefined,
      tiebreakTeam2: tiebreakTeam2 ?? undefined,
    });
  }

  const winner =
    row.match_winner === 'team1' || row.match_winner === 'team2' ? row.match_winner : null;

  return {
    team1: team1Label,
    team2: team2Label,
    sets,
    winner,
    completed: sets.length > 0 && winner != null,
  };
}
