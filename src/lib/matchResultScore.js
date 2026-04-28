function toFiniteNumber(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function hasPlayedSet(g1, g2) {
  return g1 != null && g2 != null && (g1 > 0 || g2 > 0);
}

export function formatSetScore(gamesTeam1, gamesTeam2, tiebreakTeam1, tiebreakTeam2) {
  const g1 = toFiniteNumber(gamesTeam1);
  const g2 = toFiniteNumber(gamesTeam2);
  if (!hasPlayedSet(g1, g2)) return null;

  const base = `${g1}-${g2}`;
  const tb1 = toFiniteNumber(tiebreakTeam1);
  const tb2 = toFiniteNumber(tiebreakTeam2);

  if (tb1 != null && tb2 != null) {
    return `${base} (TB ${tb1}-${tb2})`;
  }

  return base;
}

export function formatSubmittedPadelScore(sets) {
  const parts = (sets || [])
    .map((set) => formatSetScore(
      set?.gamesTeam1,
      set?.gamesTeam2,
      set?.tiebreakTeam1,
      set?.tiebreakTeam2,
    ))
    .filter(Boolean);

  return parts.join(', ') || '—';
}

export function formatMatchResultScore(result) {
  const parts = [1, 2, 3]
    .map((setNumber) => formatSetScore(
      result?.[`set${setNumber}_team1`],
      result?.[`set${setNumber}_team2`],
      result?.[`set${setNumber}_tb1`],
      result?.[`set${setNumber}_tb2`],
    ))
    .filter(Boolean);

  return parts.join(', ') || result?.score_display || '—';
}
