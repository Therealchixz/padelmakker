/**
 * @typedef {{ player_count: number; open_matches: number; matches_last_30_days: number }} LandingPublicStats
 */

/** @param {unknown} raw */
export function normalizeLandingPublicStats(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const o = /** @type {Record<string, unknown>} */ (raw);
  const toCount = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.floor(n);
  };
  return {
    player_count: toCount(o.player_count),
    open_matches: toCount(o.open_matches),
    matches_last_30_days: toCount(o.matches_last_30_days),
  };
}

/** @param {number} n */
export function formatLandingStatCount(n) {
  if (!Number.isFinite(n) || n <= 0) return '—';
  return n.toLocaleString('da-DK');
}
