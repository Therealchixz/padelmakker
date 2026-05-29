/** @param {(row: unknown) => number} rateFn returns win rate 0–1 */
export function pickToughestByWinRate(eligible, rateFn, topN = 3) {
  if (eligible.length < 2) return [];
  const peak = Math.max(...eligible.map(rateFn));
  return [...eligible]
    .filter((p) => rateFn(p) < peak - 1e-9)
    .sort((a, b) => rateFn(a) - rateFn(b))
    .slice(0, topN);
}

/** Modstandere hvor du taber oftest — ekskl. dem du slår oftest. */
export function pickHardestOpponents(eligible, rateFn, topN = 3) {
  if (eligible.length < 2) return [];
  const peak = Math.max(...eligible.map(rateFn));
  return [...eligible]
    .filter((p) => rateFn(p) < peak - 1e-9)
    .sort((a, b) => rateFn(a) - rateFn(b))
    .slice(0, topN);
}
