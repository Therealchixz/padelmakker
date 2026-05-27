import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { font, theme, btn, heading } from '../lib/platformTheme';
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
const PERIOD_HISTORY_LIMIT = 5000;

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

  const profileOffsetRef = useRef(0);
  const profileFetchGenRef = useRef(0);
  const periodHistoryLoadedRef = useRef(false);
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

  const loadPeriodHistory = useCallback(async () => {
    const [historyData, americanoHistoryData] = await Promise.all([
      supabase
        .from('elo_history')
        .select('user_id, result, change, old_rating, new_rating, date, match_id')
        .order('date', { ascending: false })
        .order('match_id', { ascending: false })
        .limit(PERIOD_HISTORY_LIMIT),
      supabase
        .from('americano_elo_history')
        .select('id, tournament_id, user_id, old_rating, new_rating, change, points, created_at')
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
    async ({ background = false } = {}) => {
      if (periodHistoryLoadedRef.current) return;
      profileFetchGenRef.current += 1;
      const gen = profileFetchGenRef.current;
      setLoadError(null);
      if (!background) setInitialLoading(true);
      else setRefreshing(true);
      try {
        await loadPeriodHistory();
        if (gen === profileFetchGenRef.current) periodHistoryLoadedRef.current = true;
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
    periodHistoryLoadedRef.current = false;
    setEloHistory([]);
    setAmericanoHistory([]);
    if (period === 'all') {
      await loadAllTimeProfiles({ background: false });
    } else {
      await ensurePeriodHistory({ background: false });
    }
  }, [period, loadAllTimeProfiles, ensurePeriodHistory]);

  useEffect(() => {
    periodHistoryLoadedRef.current = false;
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
      void ensurePeriodHistory({ background: true });
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

  const userRank = useMemo(() => {
    if (period === 'all' && myGlobalRank != null) return myGlobalRank;
    const idx = sorted.findIndex((p) => String(p.id) === myId);
    if (idx >= 0) return idx + 1;
    if (period !== 'all') {
      const globalIdx = periodRankList.findIndex((r) => String(r.id) === myId);
      return globalIdx >= 0 ? globalIdx + 1 : 0;
    }
    return 0;
  }, [period, myGlobalRank, sorted, myId, periodRankList]);

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

  const medals = ['🥇', '🥈', '🥉'];
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
        ? `${sorted.length}+`
        : String(sorted.length)
      : String(totalRanked ?? sorted.length);

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

  return (
    <div>
      <h2 style={{ ...heading('clamp(20px,4.5vw,24px)'), marginBottom: '16px' }}>Ranking</h2>

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
                : userRank > 0 && (totalRanked != null || sorted.length > 0)
                  ? `af ${period === 'all' && myGlobalRank != null ? rankTotalLabel : totalRanked ?? sorted.length}`
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
                ? `${userEntry.periodGames} turneringer · ${userEntry.periodWins} vundne runder`
                : `${userEntry.periodGames} turneringer · ${userEntry.periodPoints || 0} point`
              : `${userEntry.periodGames} kampe · ${userEntry.periodWins} sejre`}
          </div>
        )}
      </div>

      {showInitialLoader ? (
        <div className="pm-state-card" style={{ textAlign: 'center', padding: '32px 20px' }}>
          <div className="pm-state-copy" style={{ color: theme.textLight, fontSize: '14px' }}>
            Indlæser ranking...
          </div>
        </div>
      ) : sorted.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 20px', color: theme.textLight }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>📊</div>
          <div style={{ fontSize: '15px', fontWeight: 600, color: theme.text, marginBottom: '6px' }}>
            {period === 'week'
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
            {isAmericano
              ? TOURNAMENT_RANKING_CTA
              : 'Spil en kamp for at komme på ranglisten!'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {sorted.map((p, i) => {
            const me = String(p.id) === myId;
            const score = p.score;
            const isPositive = period !== 'all' && score > 0;
            const isNegative = period !== 'all' && score < 0;
            const place = p._globalRank ?? i + 1;
            const medalIdx = place - 1;

            return (
              <div
                key={p.id}
                onClick={() => !me && setViewPlayer(p)}
                onKeyDown={(e) => {
                  if (!me && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    setViewPlayer(p);
                  }
                }}
                role={me ? undefined : 'button'}
                tabIndex={me ? undefined : 0}
                className="pm-rank-row"
                style={{
                  background: me ? theme.accentBg : theme.surface,
                  borderRadius: '8px',
                  padding: '12px 14px',
                  boxShadow: me ? 'none' : theme.shadow,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  border: me ? `1.5px solid ${theme.accent}35` : `1px solid ${theme.border}`,
                  cursor: me ? 'default' : 'pointer',
                }}
              >
                <div
                  style={{
                    width: '28px',
                    flexShrink: 0,
                    textAlign: 'center',
                    fontSize: medalIdx < 3 ? '18px' : '13px',
                    fontWeight: 700,
                    color: medalIdx < 3 ? 'inherit' : theme.textLight,
                  }}
                >
                  {medalIdx < 3 ? medals[medalIdx] : place}
                </div>

                <AvatarCircle
                  avatar={p.avatar}
                  size={38}
                  emojiSize="17px"
                  alt={`${p.full_name || p.name || 'Spiller'} avatar`}
                  style={{ background: theme.surfaceAlt, border: `1px solid ${theme.border}` }}
                />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: '14px',
                      fontWeight: me ? 700 : 600,
                      letterSpacing: '-0.01em',
                      wordBreak: 'break-word',
                    }}
                  >
                    {p.full_name || p.name}
                    {me ? ' (dig)' : ''}
                  </div>
                  <div style={{ fontSize: '11px', color: theme.textLight, marginTop: '1px' }}>
                    {isAmericano
                      ? period === 'all'
                        ? `${p.area || '?'} · ${p.periodGames} turneringer · ${p.periodWins} vundne runder`
                        : `${p.periodGames} turneringer · ${p.periodPoints || 0} point`
                      : period === 'all'
                        ? `${p.area || '?'} · ${p.periodGames} kampe · ${p.periodWins} sejre`
                        : `${p.periodGames} kampe · ${p.periodWins} sejre`}
                  </div>
                </div>

                <div
                  className="pm-rank-score"
                  style={{
                    fontFamily: font,
                    fontSize: '17px',
                    fontWeight: 800,
                    flexShrink: 0,
                    letterSpacing: '-0.02em',
                    color:
                      period === 'all'
                        ? theme.accent
                        : isPositive
                          ? theme.accent
                          : isNegative
                            ? theme.red
                            : theme.textLight,
                  }}
                >
                  {period === 'all' ? score : score > 0 ? `+${score}` : score}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {hasMore && sorted.length > 0 && (
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
      </div>

      {viewPlayer && <PlayerProfileModal player={viewPlayer} onClose={() => setViewPlayer(null)} />}
    </div>
  );
}
