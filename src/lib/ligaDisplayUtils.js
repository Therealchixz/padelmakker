import { formatMatchDateHeadlineDa } from './matchDisplayUtils';

/** Headline date without weekday prefix, e.g. "lør. 12. jun" → "12. jun" */
export function shortLigaDate(dateVal) {
  const headline = formatMatchDateHeadlineDa(dateVal);
  return headline.replace(/^[^\s]+\s/, '') || headline;
}

/**
 * Badge label + tone for liga list cards and detail sheet headers.
 * @returns {{ label: string, tone: 'open'|'live'|'closed'|'full'|'neutral' }}
 */
export function getLigaBadge(league, { regTeamCount = 0, maxTeams = 0, totalRounds = null } = {}) {
  const filled = regTeamCount;
  const max = maxTeams || filled;
  const rounds = totalRounds || league.total_rounds;

  if (league.status === 'completed') {
    return { label: 'Afsluttet', tone: 'closed' };
  }
  if (league.status === 'active') {
    const label = league.current_round && rounds
      ? `Runde ${league.current_round}/${rounds}`
      : 'Live';
    return { label, tone: 'live' };
  }
  if (max && filled >= max) {
    return { label: 'Fuld', tone: 'full' };
  }
  return { label: 'Åben', tone: 'open' };
}
