import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { font, theme, btn, heading } from '../lib/platformTheme';
import { REGIONS } from '../lib/platformConstants';
import { ChevronDown } from 'lucide-react';
import { formatPlaytomicLevel } from '../lib/padelLevelUtils';
import {
  statsFromEloHistoryRows,
  useProfileEloBundle,
  allTimeStatsMapFromEloHistory,
  formatLocalDateYMD,
  eloHistoryRowDateKey,
} from '../lib/eloHistoryUtils';
import { fetchRowsInChunks } from '../lib/supabaseChunkFetch';
import { PlayerProfileModal } from './PlayerProfileModal';
import { AvatarCircle } from '../components/AvatarCircle';
import { PillTabs } from '../components/PillTabs';
import {
  TOURNAMENT_ELO_LABEL,
  TOURNAMENT_MODE_LABEL,
  TOURNAMENT_RANKING_ALL_TIME,
  TOURNAMENT_RANKING_CTA,
  TOURNAMENT_RANKING_EMPTY_MONTH,
  TOURNAMENT_RANKING_EMPTY_WEEK,
} from '../lib/tournamentCopy';
import { TabbedFilterCard } from '../components/TabbedFilterCard';

const RANKING_PAGE_SIZE = 50;
const PERIOD_HISTORY_LIMIT = 1500;

const PROFILE_RANKING_SELECT =
  'id, full_name, name, avatar, area, elo_rating, games_played, games_won, level, americano_elo_rating, americano_played, americano_wins';

function periodCutoffDate(period) {
  const now = new Date();
  if (period === 'week') {
    const d = new Date(now);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  const d = new Date(now.getFullYear(), now.getMonth(), 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function RankingTab({ user }) {
  const [players, setPlayers] = useState([]);
  const [profileById, setProfileById] = useState({});
  const [eloHistory, setEloHistory] = useState([]);
  const [americanoHistory, setAmericanoHistory] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [visibleCount, setVisibleCount] = useState(RANKING_PAGE_SIZE);
  const [myGlobalRank, setMyGlobalRank] = useState(null);
  const [viewPlayer, setViewPlayer] = useState(null);
  const [rankMode, setRankMode] = useState(() => {
    try {
      return localStorage.getItem('pm-rank-mode') || '2v2';
    } catch {
      return '2v2';
    }
  });
  const [period, setPeriod] = useState(() => {
    try {
      return localStorage.getItem('pm-rank-period') || 'all';
    } catch {
      return 'all';
    }
  });
  const [filterArea, setFilterArea] = useState('all');

  const profileOffsetRef = useRef(0);
  const profileFetchGenRef = useRef(0);
  const periodHistoryLoadedRef = useRef('');
  const prevPeriodRef = useRef(period);
  const prevRankModeRef = useRef(rankMode);

  const eloSyncKey = `${user.elo_rating}|${user.games_played}|${user.games_won}`;
  const { bundleLoading: myBundleLoading, profileFresh: myProfileFresh, ratedRows: myRatedRows } =
    useProfileEloBundle(user.id, eloSyncKey);
  const myHistStats = useMemo(() => statsFromEloHistoryRows(myRatedRows), [myRatedRows]);

  const myAllTimeElo = myHistStats?.elo ?? Math.round(Number(myProfileFresh?.elo_rating ?? user.elo_rating) || 1000);
  const myAllTimeGames = myHistStats?.games ?? (myProfileFresh?.games_played ?? user.games_played ?? 0);
  const myAllTimeWins = myHistStats?.wins ?? (myProfileFresh?.games_won ?? user.games_won ?? 0);

  const myAllTimeAmericanoElo = Math.round(
    Number(myProfileFresh?.americano_elo_rating ?? user.americano_elo_rating) || 1000,
  );
  const myAllTimeAmericanoPlayed = Number(myProfileFresh?.americano_played ?? user.americano_played) || 0;
  const myAllTimeAmericanoWins = Number(myProfileFresh?.americano_wins ?? user.americano_wins) || 0;

  const allTimeFromHistory = useMemo(() => allTimeStatsMapFromEloHistory(eloHistory), [eloHistory]);
  const americanoHistoryForStats = useMemo(
    () =>
      (americanoHistory || []).map((h) => ({
        ...h,
        date: h.created_at,
        match_id: h.tournament_id || h.id,
        result: Number(h.change) > 0 ? 'win' : Number(h.change) < 0 ? 'loss' : 'draw',
      })),
    [americanoHistory],
  );
  const allTimeAmericanoFromHistory = useMemo(
    () => allTimeStatsMapFromEloHistory(americanoHistoryForStats),
    [americanoHistoryForStats],
  );

  const myId = user?.id != null ? String(user.id) : '';
  const isAmericano = rankMode === 'americano';
  const orderColumn = isAmericano ? 'americano_elo_rating' : 'elo_rating';

  useEffect(() => {
    try {
      localStorage.setItem('pm-rank-period', period);
    } catch {
      /* ignore */
    }
  }, [period]);

  useEffect(() => {
    try {
      localStorage.setItem('pm-rank-mode', rankMode);
    } catch {
      /* ignore */
    }
  }, [rankMode]);

  const fetchMyAllTimeRank = useCallback(async () => {
    if (!myId || period !== 'all') return;
    const myScore = isAmericano ? myAllTimeAmericanoElo : myAllTimeElo;
    const { count, error } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .gt(orderColumn, myScore);
    if (error) {
      console.warn('ranking: my placement', error.message);
      setMyGlobalRank(null);
      return;
    }
    setMyGlobalRank((count ?? 0) + 1);
  }, [myId, period, isAmericano, myAllTimeElo, myAllTimeAmericanoElo, orderColumn]);

  const loadPeriodHistory = useCallback(async (activePeriod) => {
    const cutoff = periodCutoffDate(activePeriod);
    const cutoffStr = formatLocalDateYMD(cutoff);
    const cutoffIso = cutoff.toISOString();
    const [historyData, americanoHistoryData] = await Promise.all([
      supabase
        .from('elo_history')
        .select('user_id, result, change, old_rating, new_rating, date, match_id')
        .gte('date', cutoffStr)
        .order('date', { ascending: false })
        .order('match_id', { ascending: false })
        .limit(PERIOD_HISTORY_LIMIT),
      supabase
        .from('americano_elo_history')
        .select('id, tournament_id, user_id, old_rating, new_rating, change, points, created_at')
        .gte('created_at', cutoffIso)
        .order('created_at', { ascending: false })
        .limit(PERIOD_HISTORY_LIMIT),
    ]);
    if (historyData.error) throw historyData.error;
    if (americanoHistoryData.error) throw americanoHistoryData.error;
    setEloHistory(historyData.data || []);
    setAmericanoHistory(americanoHistoryData.data || []);
  }, []);

  const fetchProfilePage = useCallback(
    async (offset, append) => {
      const from = offset;
      const to = offset + RANKING_PAGE_SIZE - 1;
      const { data, error } = await supabase
        .from('profiles')
        .select(PROFILE_RANKING_SELECT)
        .order(orderColumn, { ascending: false })
        .range(from, to);
      if (error) throw error;
      const rows = (data || []).map((row, idx) => ({
        ...row,
        _globalRank: from + idx + 1,
      }));
      setPlayers((prev) => (append ? [...prev, ...rows] : rows));
      setHasMore(rows.length === RANKING_PAGE_SIZE);
      profileOffsetRef.current = append ? offset + rows.length : rows.length;
    },
    [orderColumn],
  );

  const loadAllTimeProfiles = useCallback(
    async ({ background = false } = {}) => {
      profileFetchGenRef.current += 1;
      const gen = profileFetchGenRef.current;
      setLoadingMore(false);
      setHasMore(false);
      setLoadError(null);
      if (!background) {
        setInitialLoading(true);
        setPlayers([]);
        profileOffsetRef.current = 0;
      } else {
        setRefreshing(true);
      }
      try {
        await fetchProfilePage(0, false);
        if (gen === profileFetchGenRef.current) void fetchMyAllTimeRank();
      } catch (e) {
        console.error(e);
        if (gen === profileFetchGenRef.current) {
          setLoadError('Kunne ikke hente ranking. Tjek din forbindelse og prøv igen.');
        }
      } finally {
        if (gen === profileFetchGenRef.current) {
          setInitialLoading(false);
          setRefreshing(false);
        }
      }
    },
    [fetchProfilePage, fetchMyAllTimeRank],
  );

  const ensurePeriodHistory = useCallback(
    async ({ background = false, activePeriod = period } = {}) => {
      if (periodHistoryLoadedRef.current === activePeriod) return;
      profileFetchGenRef.current += 1;
      const gen = profileFetchGenRef.current;
      setLoadError(null);
      if (!background) setInitialLoading(true);
      else setRefreshing(true);
      try {
        await loadPeriodHistory(activePeriod);
        if (gen === profileFetchGenRef.current) periodHistoryLoadedRef.current = activePeriod;
      } catch (e) {
        console.error(e);
        if (gen === profileFetchGenRef.current) {
          setLoadError('Kunne ikke hente ranking. Tjek din forbindelse og prøv igen.');
        }
      } finally {
        if (gen === profileFetchGenRef.current) {
          setInitialLoading(false);
          setRefreshing(false);
        }
      }
    },
    [loadPeriodHistory],
  );

  const resetAndLoad = useCallback(async () => {
    profileFetchGenRef.current += 1;
    setLoadingMore(false);
    setHasMore(false);
    setVisibleCount(RANKING_PAGE_SIZE);
    setProfileById({});
    profileOffsetRef.current = 0;
    setMyGlobalRank(null);
    setLoadError(null);
    periodHistoryLoadedRef.current = '';
    setEloHistory([]);
    setAmericanoHistory([]);
    if (period === 'all') {
      await loadAllTimeProfiles({ background: false });
    } else {
      await ensurePeriodHistory({ background: false });
    }
  }, [period, loadAllTimeProfiles, ensurePeriodHistory]);

  useEffect(() => {
    periodHistoryLoadedRef.current = '';
    setEloHistory([]);
    setAmericanoHistory([]);
    setVisibleCount(RANKING_PAGE_SIZE);
    if (period === 'all') {
      void loadAllTimeProfiles({ background: false });
    } else {
      void ensurePeriodHistory({ background: false });
    }
    // Kun ved ELO-sync — ikke ved skift mellem uge/måned/alle tider
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eloSyncKey]);

  useEffect(() => {
    if (prevPeriodRef.current === period) return;
    prevPeriodRef.current = period;
    setVisibleCount(RANKING_PAGE_SIZE);
    setMyGlobalRank(null);
    if (period === 'all') {
      void loadAllTimeProfiles({ background: players.length > 0 });
    } else {
      periodHistoryLoadedRef.current = '';
      void ensurePeriodHistory({ background: true, activePeriod: period });
    }
  }, [period, loadAllTimeProfiles, ensurePeriodHistory, players.length]);

  useEffect(() => {
    if (prevRankModeRef.current === rankMode) return;
    prevRankModeRef.current = rankMode;
    setVisibleCount(RANKING_PAGE_SIZE);
    if (period === 'all') void loadAllTimeProfiles({ background: true });
  }, [rankMode, period, loadAllTimeProfiles]);

  useEffect(() => {
    if (period === 'all' && !myBundleLoading && myId) {
      void fetchMyAllTimeRank();
    }
  }, [period, myBundleLoading, myId, fetchMyAllTimeRank, myAllTimeElo, myAllTimeAmericanoElo, isAmericano]);

  useEffect(() => {
    let lastVisFetch = 0;
    const throttleMs = 120000;
    const onVis = () => {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (now - lastVisFetch < throttleMs) return;
      lastVisFetch = now;
      if (period === 'all') void loadAllTimeProfiles({ background: true });
      else void ensurePeriodHistory({ background: true });
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [period, loadAllTimeProfiles, ensurePeriodHistory]);

  const periodRankList = useMemo(() => {
    if (period === 'all') return [];

    const cutoffStr = formatLocalDateYMD(periodCutoffDate(period));

    if (isAmericano) {
      const periodStats = {};
      americanoHistoryForStats.forEach((h) => {
        if (h.old_rating == null || h.match_id == null) return;
        const rowDay = eloHistoryRowDateKey(h);
        if (rowDay == null || rowDay < cutoffStr) return;
        const uid = String(h.user_id);
        if (!periodStats[uid]) periodStats[uid] = { change: 0, games: 0, wins: 0, points: 0 };
        periodStats[uid].change += Number(h.change) || 0;
        periodStats[uid].games += 1;
        periodStats[uid].wins += Number(h.change) > 0 ? 1 : 0;
        periodStats[uid].points += Number(h.points) || 0;
      });

      return Object.entries(periodStats)
        .filter(([, s]) => s.games > 0)
        .map(([id, stats]) => ({
          id,
          score: stats.change,
          periodGames: stats.games,
          periodWins: stats.wins,
          periodPoints: stats.points,
        }))
        .sort((a, b) => b.score - a.score)
        .map((row, index) => ({ ...row, _globalRank: index + 1 }));
    }

    const periodStats = {};
    eloHistory.forEach((h) => {
      if (h.old_rating == null || h.match_id == null) return;
      const rowDay = eloHistoryRowDateKey(h);
      if (rowDay == null || rowDay < cutoffStr) return;
      const uid = String(h.user_id);
      if (!periodStats[uid]) periodStats[uid] = { change: 0, games: 0, wins: 0, points: 0 };
      periodStats[uid].change += Number(h.change) || 0;
      periodStats[uid].games += 1;
      if (h.result === 'win') periodStats[uid].wins += 1;
    });

    return Object.entries(periodStats)
      .filter(([, s]) => s.games > 0)
      .map(([id, stats]) => ({
        id,
        score: stats.change,
        periodGames: stats.games,
        periodWins: stats.wins,
        periodPoints: 0,
      }))
      .sort((a, b) => b.score - a.score)
      .map((row, index) => ({ ...row, _globalRank: index + 1 }));
  }, [period, isAmericano, americanoHistoryForStats, eloHistory]);

  useEffect(() => {
    if (period === 'all') return undefined;

    const slice = periodRankList.slice(0, visibleCount);
    const missing = slice.map((r) => r.id).filter((id) => !profileById[String(id)]);
    if (missing.length === 0) {
      setHasMore(visibleCount < periodRankList.length);
      return undefined;
    }

    let cancelled = false;
    (async () => {
      try {
        const rows = await fetchRowsInChunks(supabase, 'profiles', 'id', missing, PROFILE_RANKING_SELECT);
        if (cancelled) return;
        setProfileById((prev) => {
          const next = { ...prev };
          for (const row of rows) {
            if (row?.id != null) next[String(row.id)] = row;
          }
          return next;
        });
        setHasMore(visibleCount < periodRankList.length);
      } catch (e) {
        console.error(e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [period, periodRankList, visibleCount, profileById]);

  const buildAllTimeRanking = useCallback(
    (list) =>
      list
        .map((p) => {
          const pid = String(p.id);
          const h = allTimeFromHistory[pid];
          const ah = allTimeAmericanoFromHistory[pid];
          const isMe = myId && pid === myId;
          const isMeReady = isMe && !myBundleLoading;

          return {
            ...p,
            _globalRank: p._globalRank,
            score: isAmericano
              ? isMeReady
                ? myAllTimeAmericanoElo
                : Math.round(Number(p.americano_elo_rating) || 0) || ah?.elo || 1000
              : isMeReady
                ? myAllTimeElo
                : h?.elo ?? Math.round(Number(p.elo_rating) || 1000),
            periodGames: isAmericano
              ? isMeReady
                ? myAllTimeAmericanoPlayed
                : Number(p.americano_played) || ah?.games || 0
              : isMeReady
                ? myAllTimeGames
                : h?.games ?? (p.games_played || 0),
            periodWins: isAmericano
              ? isMeReady
                ? myAllTimeAmericanoWins
                : Number(p.americano_wins) || 0
              : isMeReady
                ? myAllTimeWins
                : h?.wins ?? (p.games_won || 0),
            periodPoints: 0,
          };
        }),
    [
      allTimeAmericanoFromHistory,
      allTimeFromHistory,
      isAmericano,
      myAllTimeAmericanoElo,
      myAllTimeAmericanoPlayed,
      myAllTimeAmericanoWins,
      myAllTimeElo,
      myAllTimeGames,
      myAllTimeWins,
      myBundleLoading,
      myId,
    ],
  );

  const sorted = useMemo(() => {
    if (period === 'all') {
      return buildAllTimeRanking(players);
    }
    return periodRankList.slice(0, visibleCount).map((row) => {
      const p = profileById[String(row.id)] || { id: row.id, full_name: 'Spiller', name: 'Spiller' };
      return { ...p, ...row, _globalRank: row._globalRank };
    });
  }, [period, players, buildAllTimeRanking, periodRankList, visibleCount, profileById]);

  const totalRanked = period === 'all' ? null : periodRankList.length;

  const displaySorted = useMemo(
    () => filterArea === 'all' ? sorted : sorted.filter((p) => p.area === filterArea),
    [sorted, filterArea],
  );

  const userRank = useMemo(() => {
    if (filterArea !== 'all') {
      const idx = displaySorted.findIndex((p) => String(p.id) === myId);
      return idx >= 0 ? idx + 1 : 0;
    }
    if (period === 'all' && myGlobalRank != null) return myGlobalRank;
    const idx = sorted.findIndex((p) => String(p.id) === myId);
    if (idx >= 0) return idx + 1;
    if (period !== 'all') {
      const globalIdx = periodRankList.findIndex((r) => String(r.id) === myId);
      return globalIdx >= 0 ? globalIdx + 1 : 0;
    }
    return 0;
  }, [period, myGlobalRank, sorted, displaySorted, filterArea, myId, periodRankList]);

  const userEntry = useMemo(() => {
    const inList = sorted.find((p) => String(p.id) === myId);
    if (inList) return inList;
    if (period === 'all') {
      return buildAllTimeRanking([user])[0];
    }
    const row = periodRankList.find((r) => String(r.id) === myId);
    if (!row) return null;
    const p = profileById[myId] || user;
    return { ...p, ...row };
  }, [sorted, myId, period, user, buildAllTimeRanking, periodRankList, profileById]);

  const displayScore =
    period === 'all'
      ? myBundleLoading
        ? null
        : isAmericano
          ? myAllTimeAmericanoElo
          : myAllTimeElo ?? allTimeFromHistory[myId]?.elo ?? Math.round(Number(user.elo_rating) || 1000)
      : userEntry?.score || 0;

  // Rank change tracking using localStorage (global/all-area only)
  const rankStorageKey = myId ? `pm_prevrank_${myId}_${rankMode}_${period}` : null;
  const [rankChange, setRankChange] = useState(0);
  const rankProcessedKeyRef = useRef('');

  useEffect(() => {
    if (!rankStorageKey || userRank <= 0 || myBundleLoading || filterArea !== 'all') return;
    if (rankProcessedKeyRef.current === rankStorageKey) return; // already processed this key
    rankProcessedKeyRef.current = rankStorageKey;
    try {
      const stored = parseInt(localStorage.getItem(rankStorageKey) || '0', 10) || 0;
      if (stored > 0 && stored !== userRank) setRankChange(stored - userRank);
      localStorage.setItem(rankStorageKey, String(userRank));
    } catch { /* ignore */ }
  }, [rankStorageKey, userRank, myBundleLoading, filterArea]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      if (period === 'all') {
        await fetchProfilePage(profileOffsetRef.current, true);
      } else {
        setVisibleCount((n) => Math.min(n + RANKING_PAGE_SIZE, periodRankList.length));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, period, fetchProfilePage, periodRankList.length]);

  const rankModeLabel = isAmericano ? TOURNAMENT_MODE_LABEL : '2v2';

  const periodLabels = {
    week: 'Denne uge',
    month: 'Denne måned',
    all: 'Alle tider',
  };

  const periodInfo = {
    week: 'Nulstilles hver mandag',
    month: 'Nulstilles d. 1 i måneden',
    all: isAmericano ? TOURNAMENT_RANKING_ALL_TIME : 'Samlet 2v2 ELO-rating',
  };

  const rankTotalLabel =
    period === 'all'
      ? hasMore
        ? `${displaySorted.length}+`
        : String(displaySorted.length)
      : String(totalRanked ?? displaySorted.length);

  const rankModeTabs = [
    { id: '2v2', label: '2v2 ELO' },
    { id: 'americano', label: TOURNAMENT_ELO_LABEL },
  ];
  const periodTabs = [
    { id: 'week', label: 'Uge' },
    { id: 'month', label: 'Måned' },
    { id: 'all', label: 'Alle tider' },
  ];

  const showInitialLoader = initialLoading && sorted.length === 0;
  const hasPodium = period === 'all' && !showInitialLoader && displaySorted.length >= 3;

  const renderPod = (p, place) => {
    const isFirst = place === 1;
    const isMe = String(p.id) === myId;
    const avatarSize = isFirst ? 62 : 50;
    const emojiSize = isFirst ? '19px' : '15px';
    const firstName = (p.full_name || p.name || 'Spiller').split(' ')[0];
    return (
      <div
        key={`pod-${p.id}`}
        onClick={() => !isMe && setViewPlayer(p)}
        onKeyDown={(e) => { if (!isMe && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setViewPlayer(p); } }}
        role={isMe ? undefined : 'button'}
        tabIndex={isMe ? undefined : 0}
        style={{ flex: 1, textAlign: 'center', cursor: isMe ? 'default' : 'pointer' }}
      >
        <AvatarCircle
          avatar={p.avatar}
          size={avatarSize}
          emojiSize={emojiSize}
          alt={`${p.full_name || p.name || 'Spiller'} avatar`}
          style={{ margin: '0 auto 7px', border: `2.5px solid ${isFirst ? theme.amber : 'rgba(255,255,255,0.35)'}` }}
        />
        <b style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--pm-on-accent)' }}>
          {firstName}{isMe ? ' ✓' : ''}
        </b>
        <span style={{ fontSize: 10.5, color: 'var(--pm-hero-subtitle)' }}>
          {Math.round(Number((isAmericano ? p.americano_elo_rating : p.elo_rating)) || 1000)} ELO
          {p.level ? ` · Niveau ${formatPlaytomicLevel(p.level)}` : ''}
        </span>
        <div style={{ fontSize: 15, fontWeight: 700, marginTop: 3, color: 'var(--pm-on-accent)' }}>{p.score}</div>
        <div style={{
          width: 22, height: 22, borderRadius: '50%',
          background: isFirst ? theme.amber : 'rgba(255,255,255,0.14)',
          color: isFirst ? 'var(--pm-navy-deep)' : 'var(--pm-on-accent)',
          fontSize: 11, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '7px auto 0',
        }}>
          {place}
        </div>
      </div>
    );
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px 8px' }}>
        <h2 style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-0.3px', color: theme.text, margin: 0 }}>Rangliste</h2>
        <div style={{ position: 'relative' }}>
          <select
            value={filterArea}
            onChange={(e) => setFilterArea(e.target.value)}
            aria-label="Filtrer efter region"
            style={{
              appearance: 'none',
              WebkitAppearance: 'none',
              background: filterArea !== 'all' ? theme.accentBg : theme.surfaceAlt,
              border: `1px solid ${filterArea !== 'all' ? theme.accent : theme.border}`,
              borderRadius: 8,
              padding: '5px 26px 5px 10px',
              fontSize: 12,
              fontWeight: 600,
              color: filterArea !== 'all' ? theme.accent : theme.textMid,
              cursor: 'pointer',
              fontFamily: font,
              outline: 'none',
            }}
          >
            <option value="all">Alle</option>
            {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <ChevronDown size={13} style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: filterArea !== 'all' ? theme.accent : theme.textMid }} />
        </div>
      </div>

      {loadError && sorted.length === 0 ? (
        <div className="pm-state-card pm-state-card--error" style={{ marginBottom: '16px' }}>
          <div className="pm-state-icon" aria-hidden="true">⚠️</div>
          <div className="pm-state-title">Kunne ikke hente ranking</div>
          <div className="pm-state-copy">{loadError}</div>
          <div className="pm-state-actions">
            <button type="button" onClick={() => void resetAndLoad()} style={{ ...btn(true), fontSize: '13px' }}>
              Prøv igen
            </button>
          </div>
        </div>
      ) : loadError ? (
        <div
          className="pm-ui-card"
          style={{
            padding: '12px 14px',
            marginBottom: '14px',
            border: `1px solid ${theme.warm}`,
            background: theme.warmBg,
            fontSize: '12px',
            color: theme.textMid,
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <span>{loadError}</span>
          <button type="button" onClick={() => void resetAndLoad()} style={{ ...btn(false), padding: '6px 12px', fontSize: '12px' }}>
            Prøv igen
          </button>
        </div>
      ) : null}

      <TabbedFilterCard
        tabs={rankModeTabs}
        value={rankMode}
        onTabChange={setRankMode}
        tabAriaLabel="Ranking-type"
        cardClassName="pm-ui-card pm-kampe-controls pm-filter-card"
        tabsClassName="pm-kampe-segment pm-filter-card-tabs"
        cardStyle={{ marginBottom: '10px' }}
      />

      <PillTabs
        tabs={periodTabs}
        value={period}
        onChange={setPeriod}
        ariaLabel="Ranking-periode"
        size="sm"
        style={{ marginBottom: '16px' }}
      />

      <div style={{ fontSize: '12px', color: theme.textLight, marginBottom: '16px', textAlign: 'center' }}>
        {rankModeLabel} · {periodLabels[period]} · {periodInfo[period]}
      </div>

      <div
        className="pm-rank-body"
        style={{
          opacity: refreshing ? 0.72 : 1,
          transition: 'opacity 0.15s ease',
          pointerEvents: refreshing ? 'none' : undefined,
        }}
      >
      {!hasPodium && (
      <div className="pm-rank-hero">
        <div className="pm-rank-hero-kicker">
          Din placering · {rankModeLabel} · {periodLabels[period]}
        </div>
        <div className="pm-rank-hero-inner">
          <div>
            <span style={{ fontFamily: font, fontSize: 'clamp(32px,8vw,40px)', fontWeight: 800, letterSpacing: '-0.04em' }}>
              {period === 'all' && myBundleLoading ? '…' : userRank > 0 ? `#${userRank}` : '—'}
            </span>
            <span style={{ fontSize: '14px', marginLeft: '8px', opacity: 0.6 }}>
              {period === 'all' && myBundleLoading
                ? ''
                : userRank > 0 && (totalRanked != null || displaySorted.length > 0)
                  ? `af ${filterArea !== 'all' ? displaySorted.length : period === 'all' && myGlobalRank != null ? rankTotalLabel : totalRanked ?? displaySorted.length}`
                  : ''}
            </span>
          </div>
          <div className="pm-rank-hero-elo">
            <div style={{ fontFamily: font, fontSize: 'clamp(20px,5vw,24px)', fontWeight: 800, letterSpacing: '-0.03em' }}>
              {period === 'all' && displayScore === null
                ? '…'
                : period === 'all'
                  ? displayScore
                  : displayScore > 0
                    ? `+${displayScore}`
                    : displayScore}
            </div>
            <div style={{ fontSize: '10px', opacity: 0.65, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              {period === 'all' ? (isAmericano ? TOURNAMENT_ELO_LABEL : '2v2 ELO') : 'ELO ændring'}
            </div>
          </div>
        </div>

        {period === 'all' && displayScore != null && (
          <div style={{ marginTop: '14px', background: 'rgba(255,255,255,0.15)', borderRadius: '6px', height: '6px' }}>
            <div
              style={{
                width: `${Math.min((displayScore / 2000) * 100, 100)}%`,
                height: '100%',
                background: theme.warm,
                borderRadius: '6px',
              }}
            />
          </div>
        )}

        {userEntry && (period !== 'all' || !myBundleLoading) && (
          <div style={{ marginTop: '12px', fontSize: '12px', opacity: 0.7 }}>
            {isAmericano
              ? period === 'all'
                ? `${userEntry.periodGames} Americano/Mexicano · ${userEntry.periodWins} vundne runder`
                : `${userEntry.periodGames} Americano/Mexicano · ${userEntry.periodPoints || 0} point`
              : `${userEntry.periodGames} kampe · ${userEntry.periodWins} sejre`}
          </div>
        )}
        {rankChange !== 0 && (
          <div style={{ marginTop: '8px', fontSize: '11px', fontWeight: 600, color: rankChange > 0 ? 'var(--pm-success-border)' : 'var(--pm-danger-border)' }}>
            {rankChange > 0 ? `↑ ${rankChange} pladser` : `↓ ${Math.abs(rankChange)} pladser`}
          </div>
        )}
      </div>
      )}

      {/* Podium – top 3, only shown for 'all' period */}
      {hasPodium && (
        <div style={{
          margin: '14px 18px 0',
          borderRadius: 14,
          padding: '18px 14px 14px',
          background: 'linear-gradient(150deg, var(--pm-navy-deep), var(--pm-navy-soft))',
          color: 'var(--pm-on-accent)',
          boxShadow: theme.shadowLg,
          display: 'flex',
          alignItems: 'flex-end',
          gap: 10,
        }}>
          {renderPod(displaySorted[1], 2)}
          {renderPod(displaySorted[0], 1)}
          {renderPod(displaySorted[2], 3)}
        </div>
      )}

      {showInitialLoader ? (
        <div className="pm-state-card" style={{ textAlign: 'center', padding: '32px 20px' }}>
          <div className="pm-state-copy" style={{ color: theme.textLight, fontSize: '14px' }}>
            Indlæser ranking...
          </div>
        </div>
      ) : displaySorted.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 20px', color: theme.textLight }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>📊</div>
          <div style={{ fontSize: '15px', fontWeight: 600, color: theme.text, marginBottom: '6px' }}>
            {filterArea !== 'all'
              ? `Ingen spillere i ${filterArea} endnu`
              : period === 'week'
                ? isAmericano
                  ? TOURNAMENT_RANKING_EMPTY_WEEK
                  : 'Ingen kampe denne uge endnu'
                : period === 'month'
                  ? isAmericano
                    ? TOURNAMENT_RANKING_EMPTY_MONTH
                    : 'Ingen kampe denne måned endnu'
                  : 'Ingen spillere fundet'}
          </div>
          <div style={{ fontSize: '13px', lineHeight: 1.5 }}>
            {filterArea !== 'all'
              ? 'Prøv en anden region eller vælg "Alle".'
              : isAmericano
                ? TOURNAMENT_RANKING_CTA
                : 'Spil en kamp for at komme på ranglisten!'}
          </div>
        </div>
      ) : (() => {
        const listPlayers = hasPodium ? displaySorted.slice(3) : displaySorted;
        if (listPlayers.length === 0) return null;
        return (
          <div style={{
            background: theme.surface,
            border: `1px solid ${theme.border}`,
            borderRadius: 12,
            margin: '13px 18px 0',
            padding: '4px 2px',
            overflow: 'hidden',
          }}>
            {listPlayers.map((p, sliceIdx) => {
              const me = String(p.id) === myId;
              const score = p.score;
              const isPositive = period !== 'all' && score > 0;
              const isNegative = period !== 'all' && score < 0;
              const place = filterArea !== 'all'
                ? (hasPodium ? sliceIdx + 4 : sliceIdx + 1)
                : (p._globalRank ?? (hasPodium ? sliceIdx + 4 : sliceIdx + 1));
              const isLast = sliceIdx === listPlayers.length - 1;
              return (
                <div key={p.id}>
                  <div
                    onClick={() => !me && setViewPlayer(p)}
                    onKeyDown={(e) => {
                      if (!me && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        setViewPlayer(p);
                      }
                    }}
                    role={me ? undefined : 'button'}
                    tabIndex={me ? undefined : 0}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 11,
                      padding: '11px 14px',
                      background: me ? theme.accentBg : 'transparent',
                      cursor: me ? 'default' : 'pointer',
                      borderLeft: me ? `3px solid ${theme.navy}` : undefined,
                    }}
                  >
                    <div style={{
                      width: 24, textAlign: 'center', fontWeight: 700,
                      fontSize: 13, color: me ? theme.navy : theme.textMid, flexShrink: 0,
                    }}>
                      {place}
                    </div>
                    <AvatarCircle
                      avatar={p.avatar}
                      size={36}
                      emojiSize="12px"
                      alt={`${p.full_name || p.name || 'Spiller'} avatar`}
                      style={{ background: theme.surfaceAlt, border: `1px solid ${theme.border}`, flexShrink: 0 }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, letterSpacing: '-0.01em', wordBreak: 'break-word' }}>
                        {p.full_name || p.name}{me ? ' (dig)' : ''}
                      </div>
                      <div style={{ fontSize: 11, color: theme.textLight, marginTop: 1 }}>
                        {isAmericano
                          ? period === 'all'
                            ? `${p.area || '?'} · ${p.periodGames} Americano/Mexicano`
                            : `${p.periodGames} Americano/Mexicano · ${p.periodPoints || 0} point`
                          : period === 'all'
                            ? `${Math.round(Number(p.elo_rating) || 1000)} ELO${p.level ? ` · Niveau ${formatPlaytomicLevel(p.level)}` : ''} · ${p.periodGames} kampe`
                            : `${p.periodGames} kampe · ${p.periodWins} sejre`}
                      </div>
                    </div>
                    <div style={{
                      fontSize: 14, fontWeight: 700, flexShrink: 0,
                      color: period === 'all'
                        ? theme.navy
                        : isPositive ? theme.accent : isNegative ? theme.red : theme.textLight,
                    }}>
                      {period === 'all' ? score : score > 0 ? `+${score}` : score}
                    </div>
                  </div>
                  {!isLast && <div style={{ height: 1, background: theme.border, margin: '0 14px' }} />}
                </div>
              );
            })}
          </div>
        );
      })()}

      {hasMore && sorted.length > 0 && filterArea === 'all' && (
        <button
          type="button"
          onClick={() => void loadMore()}
          disabled={loadingMore || refreshing}
          style={{
            ...btn(false),
            width: '100%',
            marginTop: '16px',
            justifyContent: 'center',
            padding: '12px 16px',
            fontSize: '13px',
            fontWeight: 700,
          }}
        >
          {loadingMore ? 'Indlæser…' : `Indlæs ${RANKING_PAGE_SIZE} flere`}
        </button>
      )}

      {/* User position card — shown below list when podium is visible */}
      {hasPodium && userRank > 0 && !myBundleLoading && userEntry && (
        <div style={{
          margin: '12px 18px 18px',
          background: theme.surface,
          borderRadius: 12,
          border: `1.5px solid ${theme.navy}`,
          padding: '11px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 11,
        }}>
          <div style={{ width: 24, textAlign: 'center', fontWeight: 700, fontSize: 13, color: theme.accent, flexShrink: 0 }}>
            {userRank}
          </div>
          <AvatarCircle
            avatar={userEntry.avatar}
            size={36}
            emojiSize="12px"
            style={{ background: theme.surfaceAlt, border: `1px solid ${theme.border}`, flexShrink: 0 }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, letterSpacing: '-0.01em' }}>
              Dig
            </div>
            <div style={{ fontSize: 11, color: theme.textLight, marginTop: 1 }}>
              {isAmericano
                ? `${userEntry.periodGames || 0} Americano/Mexicano`
                : `${Math.round(Number(userEntry.elo_rating) || 1000)} ELO${userEntry.level ? ` · Niveau ${formatPlaytomicLevel(userEntry.level)}` : ''} · ${userEntry.periodGames || 0} kampe`}
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: theme.accent }}>
              {period === 'all' ? displayScore : displayScore > 0 ? `+${displayScore}` : displayScore}
            </div>
            {rankChange !== 0 && (
              <div style={{ fontSize: 10.5, fontWeight: 600, color: rankChange > 0 ? theme.green : theme.red, marginTop: 1 }}>
                {rankChange > 0 ? `↑ ${rankChange} pladser` : `↓ ${Math.abs(rankChange)} pladser`}
              </div>
            )}
          </div>
        </div>
      )}
      </div>

      {viewPlayer && <PlayerProfileModal player={viewPlayer} onClose={() => setViewPlayer(null)} />}
    </div>
  );
}
