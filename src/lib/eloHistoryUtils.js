import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';
import { normalizeProfileRow } from './profileUtils';
import {
  compareEloHistoryChronological as compareEloHistoryChronologicalPure,
  currentEloFromSortedHistory as currentEloFromSortedHistoryPure,
  eloHistoryTimeMs as eloHistoryTimeMsPure,
  filterRatedEloHistoryRows as filterRatedEloHistoryRowsPure,
  sortEloHistoryChronological as sortEloHistoryChronologicalPure,
  statsFromEloHistoryRows as statsFromEloHistoryRowsPure,
  winStreaksFromEloHistory as winStreaksFromEloHistoryPure,
} from './eloHistoryMath';

/** Samme filter som ELO-graf / streak (kun rigtige kampe med rating). */
export function filterRatedEloHistoryRows(rows) {
  return filterRatedEloHistoryRowsPure(rows);
}

/** Stabil kronologi: samme dato → match_id → id (undgår at "seneste" række bliver forkert). */
export function eloHistoryTimeMs(h) {
  return eloHistoryTimeMsPure(h);
}

export function compareEloHistoryChronological(a, b) {
  return compareEloHistoryChronologicalPure(a, b);
}

export function sortEloHistoryChronological(rows) {
  return sortEloHistoryChronologicalPure(rows);
}

/**
 * Nuværende ELO = rating før første kamp i listen + sum af alle `change`.
 * Matcher uge/måned-ranking (som summerer `change`) og ignorerer `new_rating`,
 * som i nogle DB-rækker kan være ét skridt bagud eller forkert.
 */
export function currentEloFromSortedHistory(sorted) {
  return currentEloFromSortedHistoryPure(sorted);
}

/** Seneste ELO + antal kampe/sejre ud fra elo_history (kilde til graf). null hvis ingen rækker. */
export function statsFromEloHistoryRows(rows) {
  return statsFromEloHistoryRowsPure(rows);
}

/** Kræver rækker med `date` og `result` ("win" / andet). Sorterer kronologisk internt. */
export function winStreaksFromEloHistory(raw) {
  return winStreaksFromEloHistoryPure(raw);
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
            .order('match_id', { ascending: true })
            .order('id', { ascending: true }),
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

/**
 * Henter og beregner partner- og modstander-statistik for en spiller.
 * Joiner elo_history (resultater) med match_players (hold-sammensætning).
 */
export function usePartnerOpponentStats(userId, ratedRows) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);

  const matchIdsKey = (ratedRows || [])
    .map(r => r.match_id).filter(Boolean).sort().join(',');

  useEffect(() => {
    if (!userId || !matchIdsKey) {
      setStats({ partners: [], opponents: [] });
      return;
    }
    const matchIds = matchIdsKey.split(',').filter(Boolean);
    setLoading(true);

    supabase
      .from('match_players')
      .select('match_id, user_id, team, user_name, user_emoji')
      .in('match_id', matchIds)
      .then(({ data: players, error }) => {
        if (error || !players) {
          setStats({ partners: [], opponents: [] });
          setLoading(false);
          return;
        }

        // Brugerens hold pr. kamp
        const myTeamMap = {};
        for (const p of players) {
          if (p.user_id === userId) myTeamMap[p.match_id] = p.team;
        }

        // Resultat pr. kamp fra elo_history
        const resultMap = {};
        for (const r of ratedRows) {
          if (r.match_id) resultMap[r.match_id] = r.result;
        }

        // Aggregér stats pr. modspiller
        const statsMap = {};
        for (const p of players) {
          if (p.user_id === userId) continue;
          const result = resultMap[p.match_id];
          if (!result || result === 'adjustment') continue;
          const myTeam = myTeamMap[p.match_id];
          if (myTeam == null) continue;

          const isPartner = myTeam === p.team;
          if (!statsMap[p.user_id]) {
            statsMap[p.user_id] = {
              userId: p.user_id,
              name: p.user_name || 'Ukendt',
              emoji: p.user_emoji || '👤',
              asPartner:  { games: 0, wins: 0 },
              asOpponent: { games: 0, wins: 0 },
            };
          }
          if (isPartner) {
            statsMap[p.user_id].asPartner.games++;
            if (result === 'win') statsMap[p.user_id].asPartner.wins++;
          } else {
            statsMap[p.user_id].asOpponent.games++;
            if (result === 'win') statsMap[p.user_id].asOpponent.wins++;
          }
        }

        const all = Object.values(statsMap);

        const partners = all
          .filter(p => p.asPartner.games >= 2)
          .sort((a, b) => (b.asPartner.wins / b.asPartner.games) - (a.asPartner.wins / a.asPartner.games))
          .slice(0, 3);

        // Hårdeste: laveste sejrsprocent mod dem
        const opponents = all
          .filter(p => p.asOpponent.games >= 2)
          .sort((a, b) => (a.asOpponent.wins / a.asOpponent.games) - (b.asOpponent.wins / b.asOpponent.games))
          .slice(0, 3);

        setStats({ partners, opponents });
        setLoading(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, matchIdsKey]);

  return { partnerOpponentStats: stats, partnerOpponentLoading: loading };
}

/** Per bruger: seneste ELO + kampe/sejre fra elo_history (til ranking all-time). */
export function allTimeStatsMapFromEloHistory(eloHistory) {
  const byUser = {};
  for (const h of eloHistory || []) {
    if (h.old_rating == null || h.match_id == null) continue;
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
