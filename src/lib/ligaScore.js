/** Samme regler som LigaTab validatePadelScore */
export function validatePadelScore(score) {
  const s = String(score || '').trim();
  if (!s) return 'Angiv scoren.';
  const m = s.match(/^(\d+)-(\d+)$/);
  if (!m) return 'Scoren skal skrives som X-Y, f.eks. 6-4';
  const a = parseInt(m[1], 10);
  const b = parseInt(m[2], 10);
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  if ((hi === 6 && lo <= 4) || (hi === 7 && (lo === 5 || lo === 6))) return null;
  return 'Ugyldig padel-score. Gyldige resultater: 6-0 → 6-4, 7-5 eller 7-6';
}
