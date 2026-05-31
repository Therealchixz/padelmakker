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

export function computeStandings(teams, matches) {
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
      winner.points += 3;
      winner.played++;
      winner.gameDiff += m.winner_id === m.team1_id ? diffT1 : -diffT1;
    }
    if (loser) {
      loser.losses++;
      if (tb) loser.points += 1;
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
