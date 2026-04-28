/** Samme filter som ELO-graf / streak: kun rigtige kampe med rating. */
export function filterRatedEloHistoryRows(rows) {
  return (rows || []).filter((h) => h.old_rating != null && h.match_id != null);
}

/** Stabil kronologi: samme dato -> match_id -> id. */
export function eloHistoryTimeMs(h) {
  const t = h?.date != null ? new Date(h.date).getTime() : NaN;
  return Number.isFinite(t) ? t : 0;
}

export function compareEloHistoryChronological(a, b) {
  const ta = eloHistoryTimeMs(a);
  const tb = eloHistoryTimeMs(b);
  if (ta !== tb) return ta - tb;
  const ma = String(a?.match_id ?? '');
  const mb = String(b?.match_id ?? '');
  if (ma !== mb) return ma < mb ? -1 : ma > mb ? 1 : 0;
  const ia = String(a?.id ?? '');
  const ib = String(b?.id ?? '');
  return ia < ib ? -1 : ia > ib ? 1 : 0;
}

export function sortEloHistoryChronological(rows) {
  return [...(rows || [])].sort(compareEloHistoryChronological);
}

/**
 * Current ELO = rating before the first rated row + sum of all row changes.
 * This mirrors the Supabase sync SQL and avoids trusting stale new_rating values.
 */
export function currentEloFromSortedHistory(sorted) {
  if (!sorted.length) return 1000;
  const rawBase = Number(sorted[0].old_rating);
  const base = Number.isFinite(rawBase) && rawBase > 0 ? Math.round(rawBase) : 1000;
  let sumCh = 0;
  for (const row of sorted) {
    const ch = row.change;
    if (ch != null && ch !== '' && Number.isFinite(Number(ch))) {
      sumCh += Number(ch);
    } else if (
      row.old_rating != null &&
      row.new_rating != null &&
      Number.isFinite(Number(row.old_rating)) &&
      Number.isFinite(Number(row.new_rating))
    ) {
      sumCh += Math.round(Number(row.new_rating) - Number(row.old_rating));
    }
  }
  const r = Math.round(base + sumCh);
  return Math.max(100, r);
}

/** Seneste ELO + antal kampe/sejre ud fra rated elo_history. */
export function statsFromEloHistoryRows(rows) {
  const list = filterRatedEloHistoryRows(rows);
  if (!list.length) return null;
  const sorted = sortEloHistoryChronological(list);
  const elo = currentEloFromSortedHistory(sorted);
  const games = sorted.length;
  let wins = 0;
  for (const h of sorted) {
    if (h.result === 'win') wins++;
  }
  return { elo, games, wins };
}

/** Kræver rækker med `date` og `result` ("win" / andet). Sorterer kronologisk internt. */
export function winStreaksFromEloHistory(raw) {
  const rated = filterRatedEloHistoryRows(raw);
  if (!rated.length) return { currentStreak: 0, bestStreak: 0 };
  const sorted = sortEloHistoryChronological(rated);
  let bestStreak = 0;
  for (let start = 0; start < sorted.length; start++) {
    let s = 0;
    for (let j = start; j < sorted.length; j++) {
      if (sorted[j].result === 'win') {
        s++;
        bestStreak = Math.max(bestStreak, s);
      } else break;
    }
  }
  let currentStreak = 0;
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].result === 'win') {
      currentStreak++;
      bestStreak = Math.max(bestStreak, currentStreak);
    } else {
      if (i === sorted.length - 1) currentStreak = 0;
      break;
    }
  }
  return { currentStreak, bestStreak };
}
