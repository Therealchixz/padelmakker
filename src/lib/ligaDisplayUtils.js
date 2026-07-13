import { formatMatchDateHeadlineDa } from './matchDisplayUtils';

/** Headline date without weekday prefix, e.g. "lør. 12. jun" → "12. jun" */
export function shortLigaDate(dateVal) {
  const headline = formatMatchDateHeadlineDa(dateVal);
  return headline.replace(/^[^\s]+\s/, '') || headline;
}

const MATCH_SYSTEM_LABELS = {
  round_robin: 'Alle mod alle',
  swiss: 'Swiss',
  knockout: 'Knockout',
};

/**
 * Type-label til liga-kort/detalje, fx "Liga · Alle mod alle" eller
 * "Liga · Swiss · 2 divisioner". Falder tilbage til bare "Liga" for ældre
 * ligaer uden kampsystem.
 */
export function ligaTypeLabel(league) {
  const sys = MATCH_SYSTEM_LABELS[league?.match_system];
  const base = sys ? `Liga · ${sys}` : 'Liga';
  const nd = Number(league?.num_divisions);
  return nd > 1 ? `${base} · ${nd} divisioner` : base;
}

/** Bruger ligaen Swiss-parring? (styrer om Swiss-reglerne vises) */
export function ligaIsSwiss(league) {
  // Ældre ligaer uden eksplicit kampsystem brugte Swiss-parring.
  return !league?.match_system || league.match_system === 'swiss';
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
