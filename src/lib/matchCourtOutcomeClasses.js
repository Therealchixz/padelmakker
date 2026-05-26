/**
 * CSS-klasser til afsluttede 2v2-kampe på banen.
 * Deltagere: eget hold fremhæves (grøn ved sejr, rød ved tab); modstander subtil.
 * Tilskuere: balanceret objektiv visning uden stærk grøn dominans.
 */
export function getMatchCourtOutcomeClasses(teamNum, {
  status,
  winnerTeam = null,
  joined = false,
  myTeam = null,
} = {}) {
  const num = Number(teamNum);
  const empty = { side: '', header: '' };

  if (status !== 'completed' || !winnerTeam) return empty;

  const isWinnerSide = winnerTeam === num;
  const viewerTeam = Number(myTeam);
  const isParticipant = joined && (viewerTeam === 1 || viewerTeam === 2);

  if (isParticipant) {
    const isMySide = viewerTeam === num;
    if (isMySide) {
      return isWinnerSide
        ? { side: ' pm-court-side--mine-won', header: ' pm-court-header-team--mine-won' }
        : { side: ' pm-court-side--mine-lost', header: ' pm-court-header-team--mine-lost' };
    }
    return isWinnerSide
      ? { side: ' pm-court-side--opp-won', header: ' pm-court-header-team--opp-won' }
      : { side: ' pm-court-side--opp-lost', header: ' pm-court-header-team--opp-lost' };
  }

  return {
    side: isWinnerSide ? ' pm-court-side--winner-neutral' : ' pm-court-side--loser-neutral',
    header: isWinnerSide ? ' pm-court-header-team--winner-neutral' : ' pm-court-header-team--loser-neutral',
  };
}

export function getMatchCourtHeaderLabel(teamNum, { winnerTeam = null, joined = false, myTeam = null } = {}) {
  const base = `Hold ${teamNum}`;
  if (!winnerTeam || winnerTeam !== teamNum) return base;
  return `🏆 ${base}`;
}
