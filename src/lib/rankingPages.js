/**
 * "Alle tider"-ranglisten hentes i to trin: først dem, der har spillet
 * (sorteret efter ELO og nummereret), derefter dem uden kampe (uden nummer).
 *
 * Alle starter på 1000 ELO, så en samlet ELO-sortering satte spillere uden
 * kampe over alle, der havde tabt en kamp.
 *
 * Cursoren fortæller, hvor næste side skal fortsætte:
 *   phase 'ranked'   → offset i listen over spillede
 *   phase 'unranked' → offset i listen over dem uden kampe
 */

export const RANKING_START_CURSOR = Object.freeze({ phase: 'ranked', offset: 0, ranked: 0 });

/**
 * @param {object} args
 * @param {{ phase: 'ranked' | 'unranked', offset: number, ranked: number }} args.cursor
 * @param {number} args.pageSize
 * @param {(offset: number, limit: number) => Promise<object[]>} args.fetchRanked
 * @param {(offset: number, limit: number) => Promise<object[]>} args.fetchUnranked
 */
export async function fetchRankingPage({ cursor, pageSize, fetchRanked, fetchUnranked }) {
  let { phase, offset, ranked } = cursor || RANKING_START_CURSOR;
  let rows = [];

  if (phase === 'ranked') {
    const got = (await fetchRanked(offset, pageSize)) || [];
    rows = got.map((row, i) => ({ ...row, _globalRank: ranked + i + 1, _unranked: false }));
    ranked += got.length;
    offset += got.length;
    if (got.length < pageSize) {
      phase = 'unranked';
      offset = 0;
    }
  }

  let hasMore = true;
  if (phase === 'unranked' && rows.length < pageSize) {
    const need = pageSize - rows.length;
    const got = (await fetchUnranked(offset, need)) || [];
    rows = rows.concat(got.map((row) => ({ ...row, _globalRank: null, _unranked: true })));
    offset += got.length;
    hasMore = got.length === need;
  }

  return {
    rows,
    cursor: { phase, offset, ranked },
    hasMore,
    /** Alle spillede er hentet, så `ranked` er det endelige antal. */
    rankedComplete: phase === 'unranked',
  };
}
