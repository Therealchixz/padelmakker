/**
 * Hvilke handlinger vises på en afsluttet 2v2-kamp?
 *
 * Ligger her i stedet for inde i KampeTab, så reglen kan testes uden at
 * rendre hele fanen. To handlinger:
 *
 * - "Spil igen": opretter en ny kamp med samme bane og niveau. Kun for dem
 *   der var med (spiller eller opretter) — en tilfældig forbipasserende skal
 *   ikke kunne starte en revanche på andres kamp.
 * - Fejlindberetning: kræver et BEKRÆFTET resultat. Er resultatet endnu ikke
 *   bekræftet, hører indsigelsen hjemme i godkend/afvis-flowet i stedet.
 */

/** @param {{ status?: string, resultConfirmed?: boolean, joined?: boolean, isCreator?: boolean }} ctx */
export function completedMatchActions(ctx = {}) {
  const isCompleted = ctx.status === 'completed';
  const canRematch = isCompleted && Boolean(ctx.joined || ctx.isCreator);
  const canReportResultError = isCompleted && Boolean(ctx.resultConfirmed);
  return {
    canRematch,
    canReportResultError,
    hasAny: canRematch || canReportResultError,
  };
}
