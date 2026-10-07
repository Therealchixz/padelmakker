/**
 * Rankedin-profil på PadelMakker-profilen (ejeren 7. okt. 2026: "skabe noget
 * troværdighed omkring sin profil").
 *
 * Vi gemmer kun Rankedin-nummeret (fx R000123456) — aldrig en fri URL — og
 * bygger selv adressen. Så kan et felt på en profil aldrig få appen til at
 * vise en vilkårlig side. Formatet er Rankedins eget: et bogstav D–R og 9–14
 * tegn (deres rute er /:lang/player/:id([D-R]\w{9,14})/:name?).
 */

const ID_RE = /^[D-R][A-Za-z0-9]{9,14}$/;

/** Gyldigt Rankedin-nummer? */
export function isRankedinId(value) {
  return ID_RE.test(String(value ?? '').trim());
}

/**
 * Find Rankedin-nummeret i det, brugeren indsætter: et helt link
 * (rankedin.com/en/player/R000123456/navn), et link uden https, eller nummeret alene.
 * @returns {string|null}
 */
export function parseRankedinId(input) {
  const raw = String(input ?? '').trim();
  if (!raw) return null;
  if (isRankedinId(raw.toUpperCase()) && /^[a-z]/i.test(raw)) {
    const id = raw[0].toUpperCase() + raw.slice(1);
    return isRankedinId(id) ? id : null;
  }
  const m = raw.match(/(?:^|\/\/|\.)rankedin\.com\/(?:[a-z]{2}\/)?player\/([A-Za-z][A-Za-z0-9]{9,14})(?:[/?#]|$)/i);
  if (!m) return null;
  const id = m[1][0].toUpperCase() + m[1].slice(1);
  return isRankedinId(id) ? id : null;
}

/** Rankedins spillerside på dansk (Rankedin bruger "dk", ikke "da" — "da" findes ikke og hænger). */
export function rankedinProfileUrl(id) {
  if (!isRankedinId(id)) return null;
  return `https://www.rankedin.com/dk/player/${id}`;
}
