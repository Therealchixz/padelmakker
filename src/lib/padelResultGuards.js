function isValidTiebreak(t1, t2) {
  if (t1 < 0 || t2 < 0) return false;
  const hi = Math.max(t1, t2);
  const lo = Math.min(t1, t2);
  return hi >= 7 && hi - lo >= 2;
}

function isValidGamesWithoutTiebreak(g1, g2) {
  if (g1 < 0 || g2 < 0) return false;
  const hi = Math.max(g1, g2);
  const lo = Math.min(g1, g2);
  if (g1 === 6 && g2 === 6) return false;
  if (hi === 6 && lo <= 4) return true;
  if (hi === 7 && lo === 5) return true;
  return false;
}

function isSevenSixScore(g1, g2) {
  return (g1 === 7 && g2 === 6) || (g1 === 6 && g2 === 7);
}

function validatePadelSetForSubmit(set) {
  const a = Number(set?.gamesTeam1);
  const b = Number(set?.gamesTeam2);
  const t1 = set?.tiebreakTeam1 == null ? undefined : Number(set.tiebreakTeam1);
  const t2 = set?.tiebreakTeam2 == null ? undefined : Number(set.tiebreakTeam2);

  if (!Number.isInteger(a) || !Number.isInteger(b)) return 'Ugyldigt sæt: begge hold skal have et heltal.';
  if (a < 0 || b < 0) return 'Ugyldigt sæt: games kan ikke være negative.';

  if (a === 6 && b === 6) {
    if (t1 === undefined || t2 === undefined) return 'Ugyldigt sæt: 6-6 kræver tiebreak.';
    if (!isValidTiebreak(t1, t2)) return 'Ugyldigt tiebreak: mindst 7 point og 2 points forspring.';
    return null;
  }

  if (isSevenSixScore(a, b)) {
    if (t1 === undefined || t2 === undefined) return 'Ugyldigt sæt: 7-6 kræver tiebreak-point.';
    if (!isValidTiebreak(t1, t2)) return 'Ugyldigt tiebreak: mindst 7 point og 2 points forspring.';
    return null;
  }

  if (t1 !== undefined || t2 !== undefined) return 'Ugyldigt sæt: tiebreak må kun bruges ved 6-6 eller 7-6.';
  if (!isValidGamesWithoutTiebreak(a, b)) return 'Ugyldigt sæt. Brug 6-0 til 6-4, 7-5 eller 7-6 med tiebreak.';
  return null;
}

function getSetWinnerForSubmit(set) {
  const error = validatePadelSetForSubmit(set);
  if (error) return null;
  const a = Number(set.gamesTeam1);
  const b = Number(set.gamesTeam2);
  if (a === 6 && b === 6) {
    return Number(set.tiebreakTeam1) > Number(set.tiebreakTeam2) ? 'team1' : 'team2';
  }
  return a > b ? 'team1' : 'team2';
}

export function validateSubmittedPadelResult(result) {
  const sets = Array.isArray(result?.sets)
    ? result.sets.filter((s) => Number(s?.gamesTeam1) > 0 || Number(s?.gamesTeam2) > 0)
    : [];

  if (result?.completed !== true) return { ok: false, reason: 'Resultatet er ikke markeret som færdigt.' };
  if (result?.winner !== 'team1' && result?.winner !== 'team2') {
    return { ok: false, reason: 'Resultatet skal have en tydelig vinder.' };
  }
  if (sets.length < 1 || sets.length > 3) {
    return { ok: false, reason: 'Resultatet skal indeholde 1 til 3 gyldige sæt.' };
  }

  let team1Sets = 0;
  let team2Sets = 0;
  for (const set of sets) {
    const error = validatePadelSetForSubmit(set);
    if (error) return { ok: false, reason: error };
    const winner = getSetWinnerForSubmit(set);
    if (winner === 'team1') team1Sets += 1;
    if (winner === 'team2') team2Sets += 1;
  }

  const derivedWinner = team1Sets > team2Sets ? 'team1' : team2Sets > team1Sets ? 'team2' : null;
  if (!derivedWinner || derivedWinner !== result.winner) {
    return { ok: false, reason: 'Den valgte vinder matcher ikke sættene.' };
  }

  const winnerSetCount = Math.max(team1Sets, team2Sets);
  if (sets.length === 1) return { ok: true, team1Sets, team2Sets };
  if (sets.length === 2 && winnerSetCount === 2) return { ok: true, team1Sets, team2Sets };
  if (sets.length === 3 && winnerSetCount === 2) return { ok: true, team1Sets, team2Sets };

  return { ok: false, reason: 'Kampen skal afgøres som ét sæt eller bedst af tre sæt.' };
}

export function validateMatchRosterForElo(players, getTeam = (player) => Number(player?.team)) {
  const roster = Array.isArray(players) ? players.filter((p) => p?.user_id != null) : [];
  const ids = roster.map((p) => String(p.user_id));
  if (ids.length !== new Set(ids).size) {
    return { ok: false, reason: 'Samme spiller ligger på kampen mere end én gang. ELO er ikke gemt.' };
  }

  const team1 = roster.filter((p) => Number(getTeam(p)) === 1);
  const team2 = roster.filter((p) => Number(getTeam(p)) === 2);
  if (team1.length !== 2 || team2.length !== 2) {
    return { ok: false, reason: 'ELO kræver præcis 2 spillere på hvert hold.' };
  }

  return { ok: true, team1, team2 };
}
