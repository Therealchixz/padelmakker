/** Point på de to hold skal summere til formatet P (16/24/32). */
export function isValidAmericanoScore(a, b, P) {
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) return false;
  return a + b === P;
}

export function complementAmericanoScore(raw, P) {
  const t = String(raw || '').trim();
  if (t === '') return null;
  const n = parseInt(t, 10);
  if (!Number.isInteger(n) || n < 0 || n > P) return null;
  return P - n;
}
