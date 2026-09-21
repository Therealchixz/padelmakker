/**
 * Holdinddeling for 2v2-kampe.
 *
 * Laa i KampeTab. Ren logik uden React eller komponenttilstand.
 */
import { sortPlayersByCourtSide } from './matchPlayerCourtSide.js';

export function matchPlayerTeam(p) {
  return Number(p?.team);
}

/**
 * Deler spillere i hold 1 og 2. Spillere uden hold fordeles paa den side der
 * har plads - og ved lige stand paa hold 1 foerst, saa raekkefoelgen er stabil.
 */
export function splitPlayersByTeam(players) {
  const list = players || [];
  const t1 = sortPlayersByCourtSide(list.filter((p) => matchPlayerTeam(p) === 1));
  const t2 = sortPlayersByCourtSide(list.filter((p) => matchPlayerTeam(p) === 2));
  const unassigned = list.filter((p) => {
    const team = matchPlayerTeam(p);
    return team !== 1 && team !== 2;
  });
  for (const p of unassigned) {
    if (t1.length < 2 && t1.length <= t2.length) t1.push(p);
    else if (t2.length < 2) t2.push(p);
    else if (t1.length <= t2.length) t1.push(p);
    else t2.push(p);
  }
  return { t1, t2 };
}

/** Oversaetter fejlkoder fra set_match_player_team til dansk. */
export function teamMoveErrorMessage(data, fallbackTeam) {
  const code = data?.error;
  if (code === 'team_full') return `Hold ${data?.team ?? fallbackTeam} er fuldt.`;
  if (code === 'match_not_open') return 'Hold kan kun skiftes før kampen er startet.';
  if (code === 'not_authorized') return 'Du har ikke lov til at flytte denne spiller.';
  if (code === 'player_not_in_match') return 'Spilleren er ikke i kampen.';
  if (code === 'match_not_found') return 'Kampen blev ikke fundet.';
  return code || 'Ukendt fejl';
}
