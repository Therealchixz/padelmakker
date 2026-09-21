/**
 * Visning af brugeroplysninger i admin-panelets brugerliste.
 *
 * Ligger i lib frem for inde i AdminTab, saa formateringen kan afproeves uden
 * at hele admin-panelet skal indlaeses.
 */

/**
 * PadelMakker er en dansk app, og datoer skal laeses som dansk tid uanset hvad
 * enhedens ur staar paa. Uden dette ville en bruger oprettet 21. sep. kl. 23:30
 * dansk tid staa som 21. sep. i Danmark og 21. sep. i UTC - men 22. sep. for en
 * admin med telefonen paa Tokyo-tid. Resten af appen pinner samme zone.
 */
const DANSK_TIDSZONE = 'Europe/Copenhagen';

/**
 * Oprettelsesdato i brugerlisten: kort og uden klokkeslaet.
 * Det er signup-DAGEN der betyder noget, ikke minuttet.
 *
 * @param {string|Date|number|null|undefined} value
 * @returns {string} fx "7. apr. 2026", eller "ukendt dato" naar datoen mangler
 */
export function formatSignupDateDa(value) {
  // 0 og tom streng er ikke oprettelsesdatoer. Uden denne kontrol bliver 0 til
  // "1. jan. 1970" og ser ud som en rigtig dato i listen.
  if (value == null || value === '' || value === 0) return 'ukendt dato';

  const dt = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(dt.getTime())) return 'ukendt dato';

  return new Intl.DateTimeFormat('da-DK', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: DANSK_TIDSZONE,
  }).format(dt);
}
