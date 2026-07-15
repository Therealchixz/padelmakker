export function isTiebreakScore(scoreText) {
  return !!(scoreText && /7-6|6-7/.test(scoreText));
}

export function parseGameDiff(scoreText, winnerId, team1Id) {
  if (!scoreText) return 0;
  const m = scoreText.trim().match(/^(\d+)-(\d+)$/);
  if (!m) return 0;
  const a = parseInt(m[1], 10);
  const b = parseInt(m[2], 10);
  const winnerGames = Math.max(a, b);
  const loserGames = Math.min(a, b);
  return winnerId === team1Id ? winnerGames - loserGames : loserGames - winnerGames;
}

export function computeStandings(teams, matches, opts = {}) {
  const pointsWin = Number.isFinite(opts.pointsWin) ? opts.pointsWin : 3;
  const pointsDraw = Number.isFinite(opts.pointsDraw) ? opts.pointsDraw : 1;
  const pointsLoss = Number.isFinite(opts.pointsLoss) ? opts.pointsLoss : 0;
  const map = {};
  for (const t of teams) map[t.id] = { ...t, points: 0, wins: 0, losses: 0, played: 0, gameDiff: 0 };
  for (const m of matches) {
    if (m.status !== 'reported' || !m.winner_id) continue;
    const winner = map[m.winner_id];
    const loserId = m.winner_id === m.team1_id ? m.team2_id : m.team1_id;
    const loser = loserId ? map[loserId] : null;
    const tb = isTiebreakScore(m.score_text);
    const diffT1 = parseGameDiff(m.score_text, m.winner_id, m.team1_id);
    if (winner) {
      winner.wins++;
      winner.points += pointsWin;
      winner.played++;
      winner.gameDiff += m.winner_id === m.team1_id ? diffT1 : -diffT1;
    }
    if (loser) {
      loser.losses++;
      loser.points += tb ? pointsDraw : pointsLoss;
      loser.played++;
      loser.gameDiff += loserId === m.team1_id ? diffT1 : -diffT1;
    }
  }
  return Object.values(map).sort((a, b) =>
    b.points !== a.points ? b.points - a.points :
    b.gameDiff !== a.gameDiff ? b.gameDiff - a.gameDiff :
    b.wins !== a.wins ? b.wins - a.wins :
    b.elo_combined - a.elo_combined
  );
}

/** Swiss-parring (nærmeste ubrugte modstander uden rematch). */
export function generatePairings(standings, allMatches) {
  const played = new Set(
    allMatches
      .filter((m) => m.team1_id && m.team2_id)
      .map((m) => [m.team1_id, m.team2_id].sort().join('|'))
  );
  const pairings = [];
  const used = new Set();
  for (let i = 0; i < standings.length; i++) {
    if (used.has(standings[i].id)) continue;
    const t1 = standings[i];
    let paired = false;
    for (let j = i + 1; j < standings.length; j++) {
      if (used.has(standings[j].id)) continue;
      const t2 = standings[j];
      if (played.has([t1.id, t2.id].sort().join('|'))) continue;
      pairings.push({ team1_id: t1.id, team2_id: t2.id });
      used.add(t1.id);
      used.add(t2.id);
      paired = true;
      break;
    }
    if (!paired && !used.has(t1.id)) {
      pairings.push({ team1_id: t1.id, team2_id: null });
      used.add(t1.id);
    }
  }
  return pairings;
}

/** Eksplicit alias — samme algoritme som generatePairings. */
export function generateSwissPairings(standings, allMatches) {
  return generatePairings(standings, allMatches);
}

export function validatePadelScore(score) {
  const s = score.trim();
  if (!s) return 'Angiv scoren før du indberetter resultatet.';
  const m = s.match(/^(\d+)-(\d+)$/);
  if (!m) return 'Scoren skal skrives som X-Y, f.eks. 6-4';
  const a = parseInt(m[1], 10);
  const b = parseInt(m[2], 10);
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  if ((hi === 6 && lo <= 4) || (hi === 7 && (lo === 5 || lo === 6))) return null;
  return 'Ugyldig padel-score. Gyldige resultater: 6-0 → 6-4, 7-5 eller 7-6';
}

/**
 * Inddel hold i divisioner efter niveau (elo_combined). Division 1 = højeste
 * niveau. Grupperne gøres så jævnstore som muligt.
 * @returns {Map<string, number>} teamId → division (1-baseret)
 */
export function assignDivisionsByElo(teams, numDivisions) {
  const n = teams.length;
  const divs = Math.max(1, Math.min(numDivisions || 1, n));
  const sorted = [...teams].sort((a, b) => (b.elo_combined || 0) - (a.elo_combined || 0));
  const base = Math.floor(n / divs);
  const rem = n % divs;
  const map = new Map();
  let idx = 0;
  for (let d = 1; d <= divs; d++) {
    const size = base + (d <= rem ? 1 : 0);
    for (let k = 0; k < size; k++) {
      if (idx < sorted.length) map.set(sorted[idx].id, d);
      idx++;
    }
  }
  return map;
}

/** Grupperer hold/standings-rækker efter deres division-felt (default 1). */
export function groupByDivision(teamsOrStandings) {
  const groups = new Map();
  for (const t of teamsOrStandings) {
    const d = Number(t.division) || 1;
    if (!groups.has(d)) groups.set(d, []);
    groups.get(d).push(t);
  }
  return [...groups.entries()].sort((a, b) => a[0] - b[0]); // [[1, rows], [2, rows], ...]
}
