/** @param {string} matchId */
export function buildPublicMatchPath(matchId) {
  return `/kamp/${encodeURIComponent(String(matchId))}`;
}

/** @param {string} tournamentId */
export function buildPublicTournamentPath(tournamentId) {
  return `/turnering/${encodeURIComponent(String(tournamentId))}`;
}
