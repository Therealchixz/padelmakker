import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';
import { normalizeProfileRow } from './profileUtils';

/** Kun rigtige kampe med rating (til graf, streak, kamp-tæl). */
export function filterRatedMatchRows(rows) {
  return (rows || []).filter((h) => h.old_rating != null && h.match_id != null);
}

/** Alle rækker der påvirker ELO: rigtige kampe + admin-justeringer. */
export function filterRatedEloHistoryRows(rows) {
  return (rows || []).filter(
    (h) =>
      (h.old_rating != null && h.match_id != null) ||
      (h.result === 'adjustment' && h.change != null)
  );
}

/** Stabil kronologi: samme dato → match_id → id (undgår at "seneste" række bliver forkert). */
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
 * Nuværende ELO = rating før første kamp i listen + sum af alle `change`.
 * Matcher uge/måned-ranking (som summerer `change`) og ignorerer `new_rating`,
 * som i nogle DB-rækker kan være ét skridt bagud eller forkert.
 */
export function currentEloFromSortedHistory(sorted) {
  if (!sorted.length) return 1000;
  // Find det første entry med old_rating som fundament (spring justeringer uden old_rating over)
  const firstWithRating = sorted.find((h) => h.old_rating != null && Number.isFinite(Number(h.old_rating)));
  const base = firstWithRating ? Math.round(Number(firstWithRating.old_rating)) : 1000;
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

/** Seneste ELO + antal kampe/sejre ud fra elo_history (kilde til graf). null hvis ingen rækker. */
export function statsFromEloHistoryRows(rows) {
  const allElo = filterRatedEloHistoryRows(rows);
  const matchOnly = filterRatedMatchRows(rows);
  if (!allElo.length && !matchOnly.length) return null;
  const sorted = sortEloHistoryChronological(allElo);
  const elo = sorted.length ? currentEloFromSortedHistory(sorted) : 1000;
  const games = matchOnly.length;
  let wins = 0;
  for (const h of matchOnly) {
    if (h.result === 'win') wins++;
  }
  return { elo, games, wins };
}

/** Kræver rækker med `date` og `result` ("win" / andet). Sorterer kronologisk internt. */
export function winStreaksFromEloHistory(raw) {
  if (!raw?.length) return { currentStreak: 0, bestStreak: 0 };
  // Kun rigtige kampe tæller i streaks — spring admin-justeringer over
  const sorted = sortEloHistoryChronological(raw).filter((h) => h.result !== 'adjustment');
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

export function formatEloHistoryDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString('da-DK', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

/** Kalenderdato YYYY-MM-DD i **lokal** tid (ikke UTC via toISOString — bruges til uge/måned ranking). */
export function formatLocalDateYMD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** elo_history.date (date eller timestamptz) → YYYY-MM-DD til sammenligning med cutoff. */
export function eloHistoryRowDateKey(h) {
  if (h?.date == null || h.date === '') return null;
  const s = String(h.date).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const t = new Date(s);
  if (Number.isNaN(t.getTime())) return s.length >= 10 ? s.slice(0, 10) : null;
  return formatLocalDateYMD(t);
}

/**
 * ELO pr. bruger ud fra elo_history (samme som profil/ranking). Virker selv når RLS kun tillader
 * at læse egne profiles — historikken er typisk synlig for alle authenticated (til ranking).
 */
export async function fetchEloByUserIdFromHistory(userIds) {
  const ids = [...new Set((userIds || []).map((x) => String(x)).filter(Boolean))];
  const out = {};
  if (ids.length === 0) return out;
  const chunkSize = 100;
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const { data, error } = await supabase.from('elo_history').select('*').in('user_id', chunk);
    if (error) {
      console.warn('elo_history batch for Kampe:', error.message);
      continue;
    }
    const byUser = {};
    for (const h of data || []) {
      const u = String(h.user_id);
      if (!byUser[u]) byUser[u] = [];
      byUser[u].push(h);
    }
    for (const uid of chunk) {
      const st = statsFromEloHistoryRows(byUser[String(uid)] || []);
      if (st != null) out[String(uid)] = st.elo;
    }
  }
  return out;
}

/**
 * ELO + kampe + sejre pr. bruger fra elo_history (samme som PlayerProfileModal / ranking).
 * Bruges på Find makker så listen ikke viser forældede profiles.elo_rating / games_played.
 */
export async function fetchEloStatsBatchByUserIds(userIds) {
  const ids = [...new Set((userIds || []).map((x) => String(x)).filter(Boolean))];
  /** @type {Record<string, { elo: number; games: number; wins: number }>} */
  const out = {};
  if (ids.length === 0) return out;
  const chunkSize = 100;
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const { data, error } = await supabase.from('elo_history').select('*').in('user_id', chunk);
    if (error) {
      console.warn('elo_history batch (makkere):', error.message);
      continue;
    }
    const byUser = {};
    for (const h of data || []) {
      const u = String(h.user_id);
      if (!byUser[u]) byUser[u] = [];
      byUser[u].push(h);
    }
    for (const uid of chunk) {
      const st = statsFromEloHistoryRows(byUser[String(uid)] || []);
      if (st != null) out[String(uid)] = { elo: st.elo, games: st.games, wins: st.wins };
    }
  }
  return out;
}

/**
 * Frisk profiles-række + rated elo_history i ét trin. Ved syncKey (opdateret profil i context)
 * vises loading igen så vi ikke flasher forældede tal. Ved fokus/genvisning opdateres stille.
 */
export function useProfileEloBundle(userId, syncKey) {
  const [loading, setLoading] = useState(true);
  const [profileFresh, setProfileFresh] = useState(null);
  const [ratedRows, setRatedRows] = useState([]);

  const fetchBundle = useCallback(
    async (showLoading) => {
      if (!userId) {
        setProfileFresh(null);
        setRatedRows([]);
        setLoading(false);
        return;
      }
      if (showLoading) setLoading(true);
      try {
        const [pr, hist] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
          supabase
            .from('elo_history')
            .select('*')
            .eq('user_id', userId)
            .order('date', { ascending: true })
            .order('match_id', { ascending: true }),
        ]);
        setProfileFresh(normalizeProfileRow(pr.data || null));
        setRatedRows(filterRatedEloHistoryRows(hist.data || []));
      } catch {
        setProfileFresh(null);
        setRatedRows([]);
      } finally {
        setLoading(false);
      }
    },
    [userId]
  );

  useEffect(() => {
    fetchBundle(true);
  }, [userId, syncKey, fetchBundle]);

  useEffect(() => {
    let lastVisFetch = 0;
    const throttleMs = 120000;
    const onVis = () => {
      if (document.visibilityState !== 'visible' || !userId) return;
      const now = Date.now();
      if (now - lastVisFetch < throttleMs) return;
      lastVisFetch = now;
      fetchBundle(false);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [userId, fetchBundle]);

  const reloadProfileEloBundle = useCallback(() => {
    void fetchBundle(true);
  }, [fetchBundle]);

  return {
    bundleLoading: loading,
    profileFresh,
    ratedRows,
    reloadProfileEloBundle,
  };
}

/** Per bruger: seneste ELO + kampe/sejre fra elo_history (til ranking all-time). */
export function allTimeStatsMapFromEloHistory(eloHistory) {
  const byUser = {};
  for (const h of eloHistory || []) {
    // Inkludér rigtige kampe (med old_rating + match_id) OG admin-justeringer (result='adjustment' med change)
    const isMatch = h.old_rating != null && h.match_id != null;
    const isAdjustment = h.result === 'adjustment' && h.change != null;
    if (!isMatch && !isAdjustment) continue;
    const uid = h.user_id;
    if (uid == null) continue;
    const key = String(uid);
    if (!byUser[key]) byUser[key] = [];
    byUser[key].push(h);
  }
  const out = {};
  for (const key of Object.keys(byUser)) {
    const s = statsFromEloHistoryRows(byUser[key]);
    if (s) out[key] = s;
  }
  return out;
}
