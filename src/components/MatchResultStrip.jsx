import { theme } from '../lib/platformTheme';
import { formatMatchResultScore } from '../lib/matchResultScore';

/**
 * Kompakt resultat under 2v2-banen (score + status/ELO på få linjer).
 */
export function MatchResultStrip({ matchResult, eloChange, myTeam }) {
  if (!matchResult) return null;

  const confirmed = Boolean(matchResult.confirmed);
  const score = formatMatchResultScore(matchResult);
  const iWon = confirmed && myTeam === matchResult.match_winner;
  const iLost = confirmed && myTeam && myTeam !== matchResult.match_winner;

  const toneClass = !confirmed
    ? 'pm-match-result-strip--pending'
    : iWon
      ? 'pm-match-result-strip--won'
      : iLost
        ? 'pm-match-result-strip--lost'
        : 'pm-match-result-strip--neutral';

  /* Ved sejr: header + grøn bane siger det — vis kun score og ELO */
  const showPersonalOutcome = confirmed && myTeam && iLost;
  const showWinnerLabel =
    confirmed &&
    !myTeam &&
    (matchResult.match_winner === 'team1' || matchResult.match_winner === 'team2');

  return (
    <div className={`pm-match-result-strip ${toneClass}`}>
      <span className="pm-match-result-strip__score">{score}</span>
      <div className="pm-match-result-strip__aside">
        {!confirmed ? (
          <span className="pm-match-result-strip__status">Venter på bekræftelse</span>
        ) : null}
        {showPersonalOutcome ? (
          <span className="pm-match-result-strip__status">
            {iWon ? 'Du vandt' : 'Du tabte'}
          </span>
        ) : null}
        {showWinnerLabel ? (
          <span className="pm-match-result-strip__status">
            Hold {matchResult.match_winner === 'team1' ? 1 : 2} vandt
          </span>
        ) : null}
        {confirmed && eloChange != null ? (
          <span
            className="pm-match-result-strip__elo"
            style={{ color: eloChange >= 0 ? theme.green : theme.red }}
          >
            {eloChange >= 0 ? '+' : ''}
            {eloChange} ELO
          </span>
        ) : null}
      </div>
    </div>
  );
}
