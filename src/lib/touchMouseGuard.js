/**
 * Efter et tryk paa en touch-skaerm udsender browseren et sæt EKSTRA muse-
 * hændelser (mousemove, mouseover, mousedown ...) for at efterligne en computer.
 * Et element der lytter paa baade touch og mus, faar derfor samme tryk to gange.
 *
 * I ELO-grafen saa det saadan ud: tryk viste vaerdien, fingeren blev loeftet og
 * vaerdien blev ryddet, og bagefter satte den efterlignede musehændelse den igen.
 * Tænd-sluk-tænd et par gange - et synligt blink.
 *
 * Loesningen er at huske, hvornaar der sidst blev roert ved skaermen, og se bort
 * fra musehændelser der kommer lige efter. Alternativet - preventDefault paa
 * touchstart - ville ogsaa spærre for at kunne scrolle henover grafen.
 */

/**
 * Vinduet skal daekke browserens efterligning uden at spærre for en rigtig mus
 * bagefter. iOS sender typisk sine muse-hændelser under et halvt sekund efter,
 * at fingeren slipper; 700 ms giver luft uden at være mærkbart for en bruger,
 * der skifter fra finger til mus.
 */
export const SYNTHETIC_MOUSE_WINDOW_MS = 700;

/**
 * Er denne musehændelse browserens efterligning af et tryk, der lige er sket?
 *
 * @param {number|null|undefined} lastTouchAt tidsstempel for seneste touch, eller null
 * @param {number} now nu (millisekunder)
 * @param {number} windowMs hvor laenge efter en touch muse-hændelser ignoreres
 */
export function isSyntheticMouseAfterTouch(
  lastTouchAt,
  now = Date.now(),
  windowMs = SYNTHETIC_MOUSE_WINDOW_MS,
) {
  if (typeof lastTouchAt !== 'number' || !Number.isFinite(lastTouchAt)) return false;
  const siden = now - lastTouchAt;
  // Negativ forskel betyder et ur der er hoppet baglaens. Det er ikke en
  // efterligning, saa haendelsen skal igennem frem for at blive slugt.
  if (siden < 0) return false;
  return siden < windowMs;
}

/**
 * Naeste valgte punkt, naar brugeren trykker paa grafen.
 *
 * Et nyt tryk paa det punkt der allerede er valgt, fjerner valget igen - saa
 * man kan trykke sig vaek fra datoen uden at skulle ramme ved siden af.
 * Et traek hen over grafen (touchmove) maa derimod aldrig slaa valget fra,
 * ellers forsvinder boblen midt i bevaegelsen.
 *
 * @param {number|null} nuvaerende valgt indeks, eller null
 * @param {number} trykket indekset der blev trykket paa
 * @param {boolean} erNytTryk true ved touchstart, false ved touchmove
 * @returns {number|null}
 */
export function nextSelectedIndex(nuvaerende, trykket, erNytTryk) {
  if (erNytTryk && nuvaerende === trykket) return null;
  return trykket;
}
