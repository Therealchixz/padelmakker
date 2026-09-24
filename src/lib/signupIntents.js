/**
 * "Hvad søger du mest?" – de tre hovedvalg ved oprettelse og i profilen.
 *
 * Gemmes i profiles.intent_now, som makker-filteret og matchningen allerede
 * bruger (INTENTS i platformConstants.js). Feltet kunne ikke sættes nogen
 * steder i appen, så kun 5 af 99 havde det (24. sep. 2026). Research viser,
 * at "hygge eller konkurrence" betyder mest for et godt match efter niveau,
 * sted og tid.
 */
export const SIGNUP_INTENTS = [
  { value: 'hygge', label: 'Hyggekampe' },
  { value: 'træning', label: 'Blive bedre' },
  { value: 'konkurrence', label: 'Konkurrence' },
];
