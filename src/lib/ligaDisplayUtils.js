import { formatMatchDateHeadlineDa } from './matchDisplayUtils';

/** Headline date without weekday prefix, e.g. "lør. 12. jun" → "12. jun" */
export function shortLigaDate(dateVal) {
  const headline = formatMatchDateHeadlineDa(dateVal);
  return headline.replace(/^[^\s]+\s/, '') || headline;
}

const MATCH_SYSTEM_LABELS = {
  round_robin: 'Alle-mod-alle',
  swiss: 'Swiss-system',
  knockout: 'Knockout',
};

/** Kort label til create/summary/kort. */
export function ligaMatchSystemLabel(matchSystem) {
  const key = String(matchSystem || '').toLowerCase().trim();
  if (MATCH_SYSTEM_LABELS[key]) return MATCH_SYSTEM_LABELS[key];
  if (!key) return 'Swiss-system'; // ældre ligaer uden felt
  return key;
}

/**
 * Type-label til liga-kort/detalje, fx "Liga · Alle-mod-alle" eller
 * "Liga · Swiss-system · 2 divisioner". Falder tilbage til bare "Liga" for ældre
 * ligaer uden kampsystem.
 */
export function ligaTypeLabel(league) {
  const raw = league?.match_system;
  if (raw == null || String(raw).trim() === '') {
    const nd = Number(league?.num_divisions);
    return nd > 1 ? `Liga · ${nd} divisioner` : 'Liga';
  }
  const sys = ligaMatchSystemLabel(raw);
  const base = `Liga · ${sys}`;
  const nd = Number(league?.num_divisions);
  return nd > 1 ? `${base} · ${nd} divisioner` : base;
}

/** Bruger ligaen Swiss-parring? (styrer om Swiss-reglerne vises) */
export function ligaIsSwiss(league) {
  // Ældre ligaer uden eksplicit kampsystem brugte Swiss-parring.
  return !league?.match_system || league.match_system === 'swiss';
}

export function ligaIsRoundRobin(league) {
  return String(league?.match_system || '').toLowerCase() === 'round_robin';
}

export function ligaIsKnockout(league) {
  return String(league?.match_system || '').toLowerCase() === 'knockout';
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
