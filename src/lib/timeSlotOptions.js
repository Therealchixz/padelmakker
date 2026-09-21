/**
 * Halvtimes-tidspunkter til kamp- og turneringsoprettelse.
 *
 * Fandtes i to identiske udgaver - i KampeTab og i
 * CreateAmericanoTournamentForm - saa en aendring ét sted ville have efterladt
 * det andet sted bagud. Nu ét sted.
 */

/** Naermeste halve time fra nu, afrundet som brugeren forventer. */
export function nearestHalfHour() {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  if (m < 15) return `${String(h).padStart(2, '0')}:00`;
  if (m < 45) return `${String(h).padStart(2, '0')}:30`;
  return `${String((h + 1) % 24).padStart(2, '0')}:00`;
}

/** 06:00 til 23:30 i spring paa 30 minutter. */
export const TIME_OPTIONS = [];
for (let h = 6; h <= 23; h++) {
  TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:00`);
  TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:30`);
}
