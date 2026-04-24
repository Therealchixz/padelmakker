import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { DateTime } from 'luxon';
import { useAuth } from '../lib/AuthContext';
import { font, theme, heading, btn } from '../lib/platformTheme';
import { resolveDisplayName } from '../lib/platformUtils';
import { statsFromEloHistoryRows, useProfileEloBundle } from '../lib/eloHistoryUtils';
import { supabase } from '../lib/supabase';
import { Users, MapPin, Swords, Trophy, X } from 'lucide-react';
import { AvatarCircle } from '../components/AvatarCircle';
import { AppModal } from '../components/AppModal';
import { PlayerStatsModal } from '../components/PlayerStatsModal';
import { levelLabel } from '../lib/platformConstants';
import { mergeKampeSessionPrefs } from '../lib/kampeSessionPrefs';

const HOME_FEED_CACHE_TTL_MS = 45_000;
const HOME_FEED_CACHE_BY_USER = new Map();
const HOME_FEED_FILTERS = [
  { id: 'kampe', label: 'Kampe', icon: '⚔️', types: ['match_group', 'elo', 'open_match'] },
  { id: 'americano', label: 'Americano', icon: '🎾', types: ['americano_winner', 'americano_registration'] },
  { id: 'liga', label: 'Liga', icon: '🏆', types: ['liga_completed', 'league_new'] },
  { id: 'spillere', label: 'Spillere', icon: '⚡', types: ['elo_milestone', 'seeking_player'] },
];

export function HomeTab({ user, setTab }) {
  const { user: authUser } = useAuth();
  const [viewTournament, setViewTournament] = useState(null);
  const [viewPlayer, setViewPlayer] = useState(null);
  const displayName = resolveDisplayName(user, authUser);
  const firstName   = displayName.split(/\s+/)[0];
  const eloSyncKey = `${user.elo_rating}|${user.games_played}|${user.games_won}`;
  const { bundleLoading, profileFresh, ratedRows } = useProfileEloBundle(user.id, eloSyncKey);
  const histStats = useMemo(() => statsFromEloHistoryRows(ratedRows), [ratedRows]);
  const elo = histStats?.elo ?? Math.round(Number(profileFresh?.elo_rating) || 1000);
  const games = histStats?.games ?? (profileFresh?.games_played || 0);
  const wins = histStats?.wins ?? (profileFresh?.games_won || 0);
  const eloBarPct   = Math.min(Math.max((elo / 2000) * 100, 0), 100);

  const fetchIdRef = useRef(0);
  const [feed, setFeed] = useState([]);
  const [americanoFeed, setAmericanoFeed] = useState([]);
  const [ligaFeed, setLigaFeed] = useState([]);
  const [openMatchFeed, setOpenMatchFeed] = useState([]);
  const [americanoRegFeed, setAmericanoRegFeed] = useState([]);
  const [milestoneFeed, setMilestoneFeed] = useState([]);
  const [seekingFeed, setSeekingFeed] = useState([]);
  const [leagueNewFeed, setLeagueNewFeed] = useState([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [viewLeague, setViewLeague] = useState(null);
  const [viewMatch, setViewMatch] = useState(null);
  const closeViewTournament = useCallback(() => setViewTournament(null), []);
  const closeViewMatch = useCallback(() => setViewMatch(null), []);
  const closeViewLeague = useCallback(() => setViewLeague(null), []);

  const FEED_INITIAL_COUNT = 10;
  const FEED_PAGE_SIZE = 10;
  const FILTER_STORAGE_KEY = `pm_feed_filters_${user.id}`;
  const [activeFilters, setActiveFilters] = useState(() => {
    try {
      const saved = localStorage.getItem(FILTER_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return new Set(parsed);
      }
    } catch (e) {
      console.warn('[home-feed] Kunne ikke læse gemte feed-filtre:', e);
    }
    return new Set(HOME_FEED_FILTERS.map(f => f.id));
  });
  const toggleFilter = (id) => {
    setActiveFilters(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size === 1) return prev; // altid mindst ét aktiv
        next.delete(id);
      } else {
        next.add(id);
      }
      try {
        localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify([...next]));
      } catch (e) {
        console.warn('[home-feed] Kunne ikke gemme feed-filtre:', e);
      }
      return next;
    });
  };
  const allActive = activeFilters.size === HOME_FEED_FILTERS.length;
  const [visibleFeedCount, setVisibleFeedCount] = useState(FEED_INITIAL_COUNT);
  const enableAllFilters = () => {
    const all = new Set(HOME_FEED_FILTERS.map(f => f.id));
    setActiveFilters(all);
    try {
      localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify([...all]));
    } catch (e) {
      console.warn('[home-feed] Kunne ikke gemme feed-filtre:', e);
    }
  };
  const enabledTypes = useMemo(
    () => new Set(HOME_FEED_FILTERS.filter(f => activeFilters.has(f.id)).flatMap(f => f.types)),
    [activeFilters]
  );
  useEffect(() => {
    setVisibleFeedCount(FEED_INITIAL_COUNT);
  }, [activeFilters]);

  const applyFeedPayload = useCallback((payload) => {
    if (!payload) return;
    setFeed(payload.feed || []);
    setAmericanoFeed(payload.americanoFeed || []);
    setLigaFeed(payload.ligaFeed || []);
    setOpenMatchFeed(payload.openMatchFeed || []);
    setAmericanoRegFeed(payload.americanoRegFeed || []);
    setMilestoneFeed(payload.milestoneFeed || []);
    setSeekingFeed(payload.seekingFeed || []);
    setLeagueNewFeed(payload.leagueNewFeed || []);
  }, []);

  const fetchFeed = useCallback(async ({ silent = false } = {}) => {
    const fetchId = ++fetchIdRef.current;
    if (!silent) setFeedLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      // Round 1: alle primære queries i parallel
      const [
        eloRes, completedAmRes, completedLigaRes,
        openMatchRes, regAmRes, seekingRes, newLigaRes,
      ] = await Promise.allSettled([
        supabase.from('elo_history')
          .select('user_id, result, change, old_rating, new_rating, date, created_at, match_id, profiles(full_name, name, avatar)')
          .gte('created_at', since30d)
          .neq('change', 0).not('change', 'is', null).neq('result', 'adjustment')
          .order('created_at', { ascending: false, nullsFirst: false }).limit(100),
        supabase.from('americano_tournaments')
          .select('id, name, tournament_date, updated_at').eq('status', 'completed')
          .order('updated_at', { ascending: false }).limit(5),
        supabase.from('leagues')
          .select('id, name, updated_at').eq('status', 'completed')
          .order('updated_at', { ascending: false }).limit(5),
        supabase.from('matches')
          .select('id, creator_id, date, court_name, created_at').eq('status', 'open')
          .gte('date', today).order('created_at', { ascending: false }).limit(5),
        supabase.from('americano_tournaments')
          .select('id, name, tournament_date, time_slot, player_slots, created_at').eq('status', 'registration')
          .order('created_at', { ascending: false }).limit(5),
        supabase.from('profiles')
          .select('id, full_name, name, avatar, level, area, intent_now, seeking_match_at')
          .eq('seeking_match', true).gt('seeking_match_at', since24h)
          .order('seeking_match_at', { ascending: false, nullsFirst: false }).limit(5),
        supabase.from('leagues')
          .select('id, name, status, created_at').in('status', ['registration', 'active'])
          .order('created_at', { ascending: false }).limit(5),
      ]);
      const round1Results = {
        eloRes, completedAmRes, completedLigaRes, openMatchRes, regAmRes, seekingRes, newLigaRes,
      };
      for (const [key, result] of Object.entries(round1Results)) {
        if (result.status === 'rejected') console.warn('[home-feed] Round1 query fejlede:', key, result.reason);
      }

      const eloFull     = (eloRes.value?.data         || []).filter(r => Number(r.change) !== 0);
      const completedAm = completedAmRes.value?.data   || [];
      const completedLg = completedLigaRes.value?.data || [];
      const openMatches = openMatchRes.value?.data     || [];
      const regAm       = regAmRes.value?.data         || [];
      const seeking     = seekingRes.value?.data       || [];
      const newLiga     = newLigaRes.value?.data       || [];

      const matchIds       = [...new Set(eloFull.filter(r => r.match_id).map(r => r.match_id))];
      const completedAmIds = completedAm.map(t => t.id);
      const completedLgIds = completedLg.map(l => l.id);
      const creatorIds     = [...new Set(openMatches.map(m => m.creator_id))];
      const regAmIds       = regAm.map(t => t.id);
      const newLigaIds     = newLiga.map(l => l.id);

      // Round 2: alle sekundære queries i parallel
      const [
        mResultsRes, mDetailsRes,
        amPartsRes, amMatchesRes,
        lgTeamsRes, lgMatchesRes,
        creatorProfilesRes, regAmPartsRes, newLgTeamsRes,
      ] = await Promise.allSettled([
        matchIds.length       ? supabase.from('match_results').select('match_id, score_display, match_winner').in('match_id', matchIds)                                                                                                       : Promise.resolve({ data: [] }),
        matchIds.length       ? supabase.from('matches').select('id, court_name, description').in('id', matchIds)                                                                                                                                : Promise.resolve({ data: [] }),
        completedAmIds.length ? supabase.from('americano_participants').select('id, tournament_id, user_id, display_name').in('tournament_id', completedAmIds)                                                                                   : Promise.resolve({ data: [] }),
        completedAmIds.length ? supabase.from('americano_matches').select('tournament_id, team_a_p1, team_a_p2, team_b_p1, team_b_p2, team_a_score, team_b_score').in('tournament_id', completedAmIds)                                           : Promise.resolve({ data: [] }),
        completedLgIds.length ? supabase.from('league_teams').select('id, league_id, name, player1_id, player1_name, player1_avatar, player2_id, player2_name, player2_avatar').eq('status', 'ready').in('league_id', completedLgIds)            : Promise.resolve({ data: [] }),
        completedLgIds.length ? supabase.from('league_matches').select('league_id, team1_id, team2_id, winner_id, score_text').eq('status', 'reported').in('league_id', completedLgIds)                                                         : Promise.resolve({ data: [] }),
        creatorIds.length     ? supabase.from('profiles').select('id, full_name, name, avatar').in('id', creatorIds)                                                                                                                             : Promise.resolve({ data: [] }),
        regAmIds.length       ? supabase.from('americano_participants').select('tournament_id').in('tournament_id', regAmIds)                                                                                                                     : Promise.resolve({ data: [] }),
        newLigaIds.length     ? supabase.from('league_teams').select('league_id').in('league_id', newLigaIds).eq('status', 'ready')                                                                                                              : Promise.resolve({ data: [] }),
      ]);
      const round2Results = {
        mResultsRes, mDetailsRes, amPartsRes, amMatchesRes, lgTeamsRes, lgMatchesRes, creatorProfilesRes, regAmPartsRes, newLgTeamsRes,
      };
      for (const [key, result] of Object.entries(round2Results)) {
        if (result.status === 'rejected') console.warn('[home-feed] Round2 query fejlede:', key, result.reason);
      }

      // Round 3: Americano avatar-opslag (afhænger af participants fra Round 2)
      const amParts = amPartsRes.value?.data || [];
      const amUserIds = [...new Set(amParts.map(p => p.user_id).filter(Boolean))];
      let amAvatarMap = {};
      if (amUserIds.length) {
        const { data: amProfiles } = await supabase.from('profiles').select('id, avatar').in('id', amUserIds);
        (amProfiles || []).forEach(p => { amAvatarMap[String(p.id)] = p.avatar; });
      }

      // --- Byg alle feed-items ---

      // ELO feed (de første 40 poster)
      const eloSlice = eloFull.slice(0, 40);
      const matchMap = {};
      (mResultsRes.value?.data || []).forEach(r => { matchMap[r.match_id] = { ...matchMap[r.match_id], results: r }; });
      (mDetailsRes.value?.data || []).forEach(d => { matchMap[d.id]       = { ...matchMap[d.id],       details: d }; });
      const rowsByMatchId = new Map();
      eloSlice.forEach((row) => {
        if (!row.match_id) return;
        const mid = String(row.match_id);
        if (!rowsByMatchId.has(mid)) rowsByMatchId.set(mid, []);
        rowsByMatchId.get(mid).push(row);
      });
      const groupedFeed = [];
      eloSlice.forEach(row => {
        if (!row.match_id) { groupedFeed.push({ ...row, type: 'elo' }); return; }
        const mid = String(row.match_id);
        const sameMatch = rowsByMatchId.get(mid);
        if (!sameMatch) return;
        rowsByMatchId.delete(mid);
        const mInfo = matchMap[row.match_id];
        groupedFeed.push({
          type: 'match_group', match_id: row.match_id, created_at: row.created_at,
          players: sameMatch.map(r => ({ id: r.user_id, name: r.profiles?.full_name || r.profiles?.name || 'Spiller', avatar: r.profiles?.avatar || '🎾', change: Number(r.change), win: r.result === 'win' })),
          score: mInfo?.results?.score_display || '—', winner: mInfo?.results?.match_winner,
          court: mInfo?.details?.court_name || 'Bane', description: mInfo?.details?.description,
        });
      });

      // Americano afsluttede
      const amMatches = amMatchesRes.value?.data || [];
      const completedAmFeed = completedAm.map(t => {
        const tParts = amParts.filter(p => p.tournament_id === t.id);
        const tMatches = amMatches.filter(m => m.tournament_id === t.id);
        const totals = {};
        tParts.forEach(p => { totals[p.id] = 0; });
        tMatches.forEach(m => {
          if (m.team_a_score == null || m.team_b_score == null) return;
          const add = (pid, pts) => { totals[pid] = (totals[pid] || 0) + pts; };
          add(m.team_a_p1, m.team_a_score); add(m.team_a_p2, m.team_a_score);
          add(m.team_b_p1, m.team_b_score); add(m.team_b_p2, m.team_b_score);
        });
        let bestPart = null, bestPts = -1;
        tParts.forEach(p => { const pts = totals[p.id] || 0; if (pts > bestPts) { bestPts = pts; bestPart = p; } });
        if (!bestPart) return null;
        const leaderboard = tParts.map(p => ({ name: p.display_name, points: totals[p.id] || 0, userId: p.user_id, avatar: amAvatarMap[String(p.user_id)] || '🎾' })).sort((a, b) => b.points - a.points);
        return { type: 'americano_winner', userId: bestPart.user_id, name: bestPart.display_name, points: bestPts, tournamentName: t.name, tournamentId: t.id, leaderboard, avatar: amAvatarMap[String(bestPart.user_id)] || '🏆', created_at: t.updated_at || t.tournament_date };
      }).filter(Boolean);

      // Liga afsluttede
      const lgTeams = lgTeamsRes.value?.data || [];
      const lgMatches = lgMatchesRes.value?.data || [];
      const completedLgFeed = completedLg.map(l => {
        const lTeams = lgTeams.filter(t => t.league_id === l.id);
        const lMs = lgMatches.filter(m => m.league_id === l.id);
        const map = {};
        for (const t of lTeams) map[t.id] = { ...t, points: 0, wins: 0, losses: 0 };
        for (const m of lMs) {
          if (!m.winner_id) continue;
          const winner = map[m.winner_id];
          const loserId = m.winner_id === m.team1_id ? m.team2_id : m.team1_id;
          const loser = loserId ? map[loserId] : null;
          const tb = m.score_text && /7-6|6-7/.test(m.score_text);
          if (winner) { winner.wins++; winner.points += 3; }
          if (loser) { loser.losses++; if (tb) loser.points += 1; }
        }
        const standings = Object.values(map).sort((a, b) => b.points - a.points);
        if (!standings.length) return null;
        return { type: 'liga_completed', leagueId: l.id, leagueName: l.name, champion: standings[0], standings, created_at: l.updated_at };
      }).filter(Boolean);

      // Åbne kampe
      const pMap = {};
      (creatorProfilesRes.value?.data || []).forEach(p => { pMap[p.id] = p; });
      const openMatchFeed_ = openMatches.map(m => {
        const p = pMap[m.creator_id] || {};
        return { type: 'open_match', matchId: m.id, creatorName: p.full_name || p.name || 'En spiller', creatorAvatar: p.avatar || '🎾', creatorId: m.creator_id, date: m.date, court: m.court_name || 'Ukendt bane', created_at: m.created_at };
      });

      // Americano under tilmelding
      const regCounts = {};
      (regAmPartsRes.value?.data || []).forEach(p => { regCounts[p.tournament_id] = (regCounts[p.tournament_id] || 0) + 1; });
      const americanoRegFeed_ = regAm.map(t => ({ type: 'americano_registration', tournamentId: t.id, name: t.name, date: t.tournament_date, time: t.time_slot, slots: t.player_slots, participants: regCounts[t.id] || 0, created_at: t.created_at }));

      // ELO milepæle (fra det fulde opslag)
      const MILESTONES = [1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900, 2000];
      const milestoneItems = [];
      const seenMilestones = new Set();
      for (const r of eloFull) {
        const oldR = Number(r.old_rating || 0), newR = Number(r.new_rating || 0);
        const milestone = MILESTONES.find(m => oldR < m && newR >= m);
        if (!milestone) continue;
        const key = `${r.user_id}-${milestone}`;
        if (seenMilestones.has(key)) continue;
        seenMilestones.add(key);
        milestoneItems.push({ type: 'elo_milestone', userId: r.user_id, name: r.profiles?.full_name || r.profiles?.name || 'En spiller', avatar: r.profiles?.avatar || '🎾', milestone, created_at: r.created_at });
        if (milestoneItems.length >= 3) break;
      }

      // Søger makker
      const seekingFeed_ = seeking
        .filter(p => String(p.id) !== String(user.id)).slice(0, 3)
        .map(p => ({ type: 'seeking_player', userId: p.id, name: p.full_name || p.name || 'En spiller', avatar: p.avatar || '🎾', level: p.level, area: p.area, intent: p.intent_now, created_at: p.seeking_match_at }));

      // Nye/aktive ligaer
      const lgTeamCounts = {};
      (newLgTeamsRes.value?.data || []).forEach(t => { lgTeamCounts[t.league_id] = (lgTeamCounts[t.league_id] || 0) + 1; });
      const leagueNewFeed_ = newLiga.map(l => ({ type: 'league_new', leagueId: l.id, leagueName: l.name, status: l.status, teamCount: lgTeamCounts[l.id] || 0, created_at: l.created_at }));

      // Sæt al state på én gang (React 18 batcher disse i async-kontekst)
      if (fetchIdRef.current !== fetchId) return;
      const payload = {
        feed: groupedFeed,
        americanoFeed: completedAmFeed,
        ligaFeed: completedLgFeed,
        openMatchFeed: openMatchFeed_,
        americanoRegFeed: americanoRegFeed_,
        milestoneFeed: milestoneItems,
        seekingFeed: seekingFeed_,
        leagueNewFeed: leagueNewFeed_,
      };
      applyFeedPayload(payload);
      HOME_FEED_CACHE_BY_USER.set(String(user.id), { at: Date.now(), payload });
    } catch (e) {
      if (fetchIdRef.current === fetchId) console.warn('Feed error:', e);
    } finally {
      if (fetchIdRef.current === fetchId && !silent) setFeedLoading(false);
    }
  }, [applyFeedPayload, user.id]);

  useEffect(() => {
    const key = String(user.id);
    const cached = HOME_FEED_CACHE_BY_USER.get(key);
    if (cached?.payload) {
      applyFeedPayload(cached.payload);
      setFeedLoading(false);
      if (Date.now() - cached.at > HOME_FEED_CACHE_TTL_MS / 4) {
        fetchFeed({ silent: true });
      }
      return;
    }
    fetchFeed();
  }, [applyFeedPayload, fetchFeed, user.id]);

  /* Genindlæs feed når appen kommer i forgrunden igen */
  useEffect(() => {
    let lastFetch = 0;
    const onVis = () => {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (now - lastFetch < 30000) return; // maks. ét kald pr. 30 sek.
      lastFetch = now;
      fetchFeed({ silent: true });
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [fetchFeed]);

  const formatTimeAgo = (iso) => {
    if (!iso) return "";
    const dt = DateTime.fromISO(iso).setLocale("da");
    if (!dt.isValid) return "";
    
    // Hvis det er over en uge siden, vis bare datoen
    if (Math.abs(dt.diffNow('days').days) > 7) {
      return dt.toFormat('d. MMM');
    }
    
    const rel = dt.toRelative();
    // Gør første bogstav stort hvis nødvendigt
    return rel ? rel.charAt(0).toUpperCase() + rel.slice(1) : "";
  };

  const actions = [
    { icon: <Users   size={20} color={theme.accent} />, title: "Find en makker", desc: "Se ledige spillere",  tab: "makkere" },
    { icon: <MapPin  size={20} color={theme.accent} />, title: "Book en bane",   desc: "Ledige tider",       tab: "baner"   },
    { icon: <Swords  size={20} color={theme.accent} />, title: "Åbne kampe",     desc: "Tilmeld dig nu",     tab: "kampe"   },
    { icon: <Trophy  size={20} color={theme.accent} />, title: "Se ranking",     desc: "Din placering",      tab: "ranking" },
  ];

  const activityRowBaseStyle = {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    borderRadius: "12px",
    minHeight: "74px",
    padding: "10px 12px",
    border: "1px solid " + theme.border,
    boxShadow: theme.shadowSoft,
    background: theme.surface,
  };

  const activityActionBtnStyle = (tone) => ({
    ...btn(false),
    minWidth: "88px",
    justifyContent: "center",
    padding: "6px 11px",
    fontSize: "12px",
    height: "auto",
    borderRadius: "999px",
    borderColor: tone + "55",
    color: tone,
    background: theme.surface,
    flexShrink: 0,
  });

  const activityBodyStyle = {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    gap: "2px",
  };

  const activityMetaRowStyle = {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    minHeight: "18px",
    minWidth: 0,
  };

  const activityMetaTextStyle = {
    fontSize: "12px",
    color: theme.textMid,
    fontWeight: 600,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    lineHeight: 1.25,
  };

  const activityTitleStyle = {
    fontSize: "14px",
    color: theme.text,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    lineHeight: 1.3,
  };

  const activitySubtitleStyle = {
    fontSize: "13px",
    color: theme.textMid,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    lineHeight: 1.35,
  };

  const activityTypeTagStyle = (tone) => ({
    display: "inline-flex",
    alignItems: "center",
    padding: "2px 8px",
    borderRadius: "999px",
    border: "1px solid " + tone + "44",
    background: theme.surfaceAlt,
    color: tone,
    fontSize: "10px",
    fontWeight: 700,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    flexShrink: 0,
  });

  const activityLeadingSlotStyle = {
    width: "40px",
    minWidth: "40px",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  };

  const activityRightRailStyle = {
    minWidth: "94px",
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
    flexShrink: 0,
  };

  const activityStatPillStyle = (tone) => ({
    fontSize: "11px",
    fontWeight: 700,
    padding: "5px 8px",
    borderRadius: "999px",
    border: "1px solid " + tone + "44",
    color: tone,
    background: theme.surfaceAlt,
    whiteSpace: "nowrap",
  });

  const activityHighlightRowStyle = {
    borderColor: theme.infoBorder,
    boxShadow: theme.shadowAccent,
  };

  const activityCardStyle = (isHighlight, tone) => ({
    ...activityRowBaseStyle,
    borderLeft: "3px solid " + (tone || theme.accent),
    ...(isHighlight ? activityHighlightRowStyle : null),
  });

  const renderActivityRowCard = ({
    key,
    isHighlight,
    tone,
    leading,
    tag,
    meta,
    title,
    subtitle,
    action,
    stat,
  }) => (
    <div key={key} style={activityCardStyle(isHighlight, tone)}>
      <div style={activityLeadingSlotStyle}>{leading}</div>
      <div style={activityBodyStyle}>
        <div style={activityMetaRowStyle}>
          {tag ? <span style={activityTypeTagStyle(tone || theme.accent)}>{tag}</span> : null}
          {meta ? <span style={activityMetaTextStyle}>{meta}</span> : null}
        </div>
        <div style={activityTitleStyle}>{title}</div>
        {subtitle ? <div style={activitySubtitleStyle}>{subtitle}</div> : null}
      </div>
      <div style={activityRightRailStyle}>
        {action || stat || null}
      </div>
    </div>
  );

  const activityGroupLabel = useCallback((iso) => {
    if (!iso) return "Tidligere";
    const dt = DateTime.fromISO(iso);
    if (!dt.isValid) return "Tidligere";
    const now = DateTime.now();
    if (dt.hasSame(now, "day")) return "I dag";
    if (dt.plus({ days: 1 }).hasSame(now, "day")) return "I går";
    return dt.setLocale("da").toFormat("d. MMM");
  }, []);

  const allFeedRows = useMemo(
    () => [...feed, ...americanoFeed, ...ligaFeed, ...openMatchFeed, ...americanoRegFeed, ...milestoneFeed, ...seekingFeed, ...leagueNewFeed]
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()),
    [feed, americanoFeed, ligaFeed, openMatchFeed, americanoRegFeed, milestoneFeed, seekingFeed, leagueNewFeed]
  );

  const filteredFeedRows = useMemo(
    () => allFeedRows.filter((row) => enabledTypes.has(row.type)),
    [allFeedRows, enabledTypes]
  );

  const feedRows = useMemo(
    () => filteredFeedRows.slice(0, visibleFeedCount),
    [filteredFeedRows, visibleFeedCount]
  );

  const canShowMore = filteredFeedRows.length > feedRows.length;
  const canShowLess = feedRows.length > FEED_INITIAL_COUNT;

  const feedRenderItems = useMemo(
    () => feedRows.flatMap((row, index) => {
      const label = index === 0 ? "Nyeste" : activityGroupLabel(row.created_at);
      const prevLabel = index > 0 ? activityGroupLabel(feedRows[index - 1].created_at) : null;
      const showLabel = index === 0 || label !== prevLabel;
      const items = [];
      if (showLabel) {
        items.push({ kind: "label", key: `label-${index}-${label}`, label });
      }
      items.push({ kind: "row", key: `row-${index}`, row, index, isHighlight: index === 0 });
      return items;
    }),
    [feedRows, activityGroupLabel]
  );

  return (
    <div>
      <h2 style={{ ...heading("clamp(22px,5vw,26px)"), marginBottom: "4px" }}>Hej {firstName}! 👋</h2>
      <p style={{ color: theme.textMid, fontSize: "14px", marginBottom: "24px" }}>Klar til at spille?</p>

      {/* Stat cards + ELO: vent på frisk DB (undgå flash af forældede tal fra React) */}
      {bundleLoading ? (
        <div style={{ textAlign: "center", padding: "32px 16px", color: theme.textLight, fontSize: "14px", marginBottom: "24px" }}>Indlæser dine tal…</div>
      ) : (
        <>
      <div className="pm-stat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,110px),1fr))", gap: "10px", marginBottom: "24px" }}>
        {[
          { label: "Kampe", value: games, color: theme.blue },
          { label: "Sejre", value: wins,  color: theme.warm },
          { label: "Win %", value: games > 0 ? Math.round((wins / games) * 100) + "%" : "—", color: theme.accent },
        ].map((s, i) => (
          <div key={i} className="pm-ui-card" style={{ padding: "18px 16px", textAlign: "center" }}>
            <div style={{ fontSize: "26px", fontWeight: 800, color: s.color, fontFamily: font, letterSpacing: "-0.03em" }}>{s.value}</div>
            <div style={{ fontSize: "10px", color: theme.textLight, marginTop: "4px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ background: theme.brandGradient, borderRadius: theme.radius, padding: "clamp(18px,4vw,24px)", marginBottom: "24px", color: theme.onAccent, boxShadow: theme.shadow }}>
        <div style={{ fontSize: "10px", opacity: 0.65, marginBottom: "8px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Din ELO-rating</div>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
          <span style={{ fontFamily: font, fontSize: "clamp(40px,10vw,52px)", fontWeight: 800, lineHeight: 1, letterSpacing: "-0.04em" }}>{elo}</span>
          <span style={{ fontSize: "13px", opacity: 0.65, maxWidth: "200px", lineHeight: 1.5 }}>Jo højere ELO, jo stærkere matcher du ift. andre spillere.</span>
        </div>
        <div style={{ marginTop: "18px", background: theme.eloProgressTrack, borderRadius: "6px", height: "6px", overflow: "hidden" }}>
          <div style={{ width: eloBarPct + "%", height: "100%", background: theme.warm, borderRadius: "6px", transition: "width 0.4s ease" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "6px", fontSize: "10px", opacity: 0.55, letterSpacing: "0.04em" }}>
          <span>0</span><span>Skala op til 2000+</span>
        </div>
      </div>
        </>
      )}

      {/* Aktivitetsfeed */}
      {feedLoading ? (
        <div data-tour="home-latest-activity" style={{ marginBottom: "24px" }}>
          <div style={{ fontSize: "12px", fontWeight: 700, color: theme.textLight, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "10px" }}>
            Seneste aktivitet
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {[54, 46, 54, 38, 50].map((w, i) => (
              <div key={i} style={{ height: "54px", borderRadius: "8px", background: theme.border, opacity: 0.5 + (i * 0.08), animation: "pm-pulse 1.4s ease-in-out infinite", animationDelay: `${i * 0.1}s` }} />
            ))}
          </div>
        </div>
      ) : (
        <div data-tour="home-latest-activity" style={{ marginBottom: "24px" }}>
          <div className="pm-feed-filters-header">
            <div style={{ fontSize: "12px", fontWeight: 700, color: theme.textLight, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Seneste aktivitet
            </div>
            <div className="pm-feed-filters-scroll">
              <div className="pm-feed-filters-row">
                <button
                  onClick={enableAllFilters}
                  className={allActive ? "pm-ui-btn-chip pm-feed-filter-chip pm-ui-btn-chip-active" : "pm-ui-btn-chip pm-feed-filter-chip"}
                >
                  Alle
                </button>
                {HOME_FEED_FILTERS.map(f => {
                  const on = activeFilters.has(f.id);
                  return (
                    <button
                      key={f.id}
                      onClick={() => toggleFilter(f.id)}
                      className={on ? "pm-ui-btn-chip pm-feed-filter-chip pm-ui-btn-chip-active" : "pm-ui-btn-chip pm-feed-filter-chip"}
                    >
                      {f.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {feedRows.length === 0 ? (
              <div className="pm-ui-card" style={{ padding: "16px", color: theme.textMid, fontSize: "13px" }}>
                {allFeedRows.length > 0 ? (
                  <>
                    Ingen aktiviteter matcher de valgte filtre lige nu.
                    <button
                      onClick={enableAllFilters}
                      className="pm-ui-btn-chip pm-feed-filter-chip"
                      style={{ marginLeft: "10px" }}
                    >
                      Vis alle filtre
                    </button>
                  </>
                ) : (
                  "Der er ingen aktivitet endnu."
                )}
              </div>
            ) : feedRenderItems.map((entry) => {
                if (entry.kind === "label") {
                  return (
                    <div
                    key={entry.key}
                    style={{
                      fontSize: "12px",
                      color: theme.textMid,
                      fontWeight: 700,
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                      marginTop: entry.label === "Nyeste" ? 0 : "4px",
                    }}
                  >
                    {entry.label}
                  </div>
                );
              }
              const row = entry.row;
              const i = entry.index;
              const isHighlight = entry.isHighlight;

              if (row.type === 'americano_winner') {
                const player = { id: row.userId, name: row.name };
                return renderActivityRowCard({
                  key: `am-${i}`,
                  isHighlight,
                  tone: theme.warm,
                  leading: (
                    <div onClick={() => setViewPlayer(player)} style={{ cursor: "pointer" }}>
                      <AvatarCircle avatar={row.avatar} size={36} emojiSize="22px" style={{ background: theme.surfaceAlt, border: "1px solid " + theme.border }} />
                    </div>
                  ),
                  tag: "Americano",
                  meta: formatTimeAgo(row.created_at),
                  title: (
                    <>
                      <span onClick={() => setViewPlayer(player)} style={{ cursor: "pointer", fontWeight: 700 }}>{row.name}</span> vandt Americano
                    </>
                  ),
                  subtitle: row.tournamentName ? `"${row.tournamentName}"` : null,
                  action: <button onClick={() => setViewTournament(row)} style={activityActionBtnStyle(theme.warm)}>Se detaljer</button>,
                });
              }

              if (row.type === 'liga_completed') {
                const c = row.champion;
                return renderActivityRowCard({
                  key: `liga-${i}`,
                  isHighlight,
                  tone: theme.accent,
                  leading: (
                    <div style={{ position: "relative", width: "40px", height: "32px" }}>
                      <AvatarCircle avatar={c.player1_avatar} size={28} emojiSize="14px" style={{ background: theme.surfaceAlt, border: "2px solid " + theme.surface, position: "absolute", left: 0, top: 2, zIndex: 2 }} />
                      <AvatarCircle avatar={c.player2_avatar} size={28} emojiSize="14px" style={{ background: theme.surfaceAlt, border: "2px solid " + theme.surface, position: "absolute", left: 14, top: 2, zIndex: 1 }} />
                    </div>
                  ),
                  tag: "Liga",
                  meta: formatTimeAgo(row.created_at),
                  title: <><span style={{ fontWeight: 700 }}>{c.name}</span> vandt ligaen</>,
                  subtitle: row.leagueName ? `"${row.leagueName}"` : null,
                  action: <button onClick={() => setViewLeague(row)} style={activityActionBtnStyle(theme.accent)}>Se detaljer</button>,
                });
              }

              if (row.type === 'open_match') {
                const dateStr = row.date ? DateTime.fromISO(row.date).setLocale('da').toFormat('EEE d. MMM') : '';
                const player = { id: row.creatorId, name: row.creatorName };
                return renderActivityRowCard({
                  key: `open-${i}`,
                  isHighlight,
                  tone: theme.green,
                  leading: (
                    <div onClick={() => setViewPlayer(player)} style={{ cursor: "pointer" }}>
                      <AvatarCircle avatar={row.creatorAvatar} size={36} emojiSize="22px" style={{ background: theme.surfaceAlt, border: "1px solid " + theme.border }} />
                    </div>
                  ),
                  tag: "2v2",
                  meta: formatTimeAgo(row.created_at),
                  title: <><span style={{ fontWeight: 700, cursor: "pointer" }} onClick={() => setViewPlayer(player)}>{row.creatorName}</span> søger spillere til <strong>2v2</strong></>,
                  subtitle: `${dateStr}${row.court ? ` · ${row.court}` : ""}`,
                  action: (
                    <button
                      onClick={() =>
                        setViewMatch({
                          kind: "open",
                          title: `${row.creatorName} søger spillere`,
                          createdAt: row.created_at,
                          date: row.date,
                          court: row.court,
                          creatorName: row.creatorName,
                          creatorAvatar: row.creatorAvatar,
                        })
                      }
                      style={activityActionBtnStyle(theme.green)}
                    >
                      Se detaljer
                    </button>
                  ),
                });
              }

              if (row.type === 'americano_registration') {
                const dateStr = row.date ? DateTime.fromISO(row.date).setLocale('da').toFormat('EEE d. MMM') : '';
                return renderActivityRowCard({
                  key: `amreg-${i}`,
                  isHighlight,
                  tone: theme.warm,
                  leading: (
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: theme.surfaceAlt, border: "1px solid " + theme.border, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "17px" }}>
                      🎾
                    </div>
                  ),
                  tag: "Americano",
                  meta: formatTimeAgo(row.created_at),
                  title: <span style={{ fontWeight: 700 }}>{row.name}</span>,
                  subtitle: `${dateStr}${row.time ? ` · ${row.time}` : ""} · ${row.participants}/${row.slots} tilmeldt`,
                  action: <button onClick={() => { mergeKampeSessionPrefs(user.id, { format: 'americano' }); setTab('kampe'); }} style={activityActionBtnStyle(theme.warm)}>Tilmeld</button>,
                });
              }

              if (row.type === 'elo_milestone') {
                const player = { id: row.userId, name: row.name };
                return renderActivityRowCard({
                  key: `milestone-${i}`,
                  isHighlight,
                  tone: theme.purple,
                  leading: (
                    <div onClick={() => setViewPlayer(player)} style={{ cursor: "pointer" }}>
                      <AvatarCircle avatar={row.avatar} size={36} emojiSize="22px" style={{ background: theme.surfaceAlt, border: "1px solid " + theme.border }} />
                    </div>
                  ),
                  tag: "ELO",
                  meta: formatTimeAgo(row.created_at),
                  title: <><span style={{ fontWeight: 700, cursor: "pointer" }} onClick={() => setViewPlayer(player)}>{row.name}</span> nåede {row.milestone} ELO</>,
                  subtitle: "Ny milepæl",
                  stat: <span style={activityStatPillStyle(theme.purple)}>{row.milestone}+</span>,
                });
              }

              if (row.type === 'seeking_player') {
                const player = { id: row.userId, name: row.name };
                const levelStr = row.level ? levelLabel(row.level) : null;
                const sub = [row.area, levelStr].filter(Boolean).join(' · ');
                return renderActivityRowCard({
                  key: `seek-${i}`,
                  isHighlight,
                  tone: theme.blue,
                  leading: (
                    <div onClick={() => setViewPlayer(player)} style={{ cursor: "pointer" }}>
                      <AvatarCircle avatar={row.avatar} size={36} emojiSize="22px" style={{ background: theme.surfaceAlt, border: "1px solid " + theme.border }} />
                    </div>
                  ),
                  tag: "Spiller",
                  meta: formatTimeAgo(row.created_at),
                  title: <><span style={{ fontWeight: 700, cursor: "pointer" }} onClick={() => setViewPlayer(player)}>{row.name}</span> søger makker</>,
                  subtitle: sub || "Klar til kamp",
                  action: <button onClick={() => setViewPlayer(player)} style={activityActionBtnStyle(theme.blue)}>Se detaljer</button>,
                });
              }

              if (row.type === 'league_new') {
                const isReg = row.status === 'registration';
                return renderActivityRowCard({
                  key: `lnew-${i}`,
                  isHighlight,
                  tone: theme.accent,
                  leading: (
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: theme.surfaceAlt, border: "1px solid " + theme.border, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "17px" }}>
                      🏆
                    </div>
                  ),
                  tag: "Liga",
                  meta: formatTimeAgo(row.created_at),
                  title: <span style={{ fontWeight: 700 }}>{row.leagueName}</span>,
                  subtitle: `${isReg ? "Tilmelding åben" : "I gang"} · ${row.teamCount} hold`,
                  action: <button onClick={() => setTab('liga')} style={activityActionBtnStyle(theme.accent)}>{isReg ? 'Tilmeld' : 'Se detaljer'}</button>,
                });
              }

              if (row.type === 'match_group') {
                const winners = row.players.filter((p) => p.win);
                const losers = row.players.filter((p) => !p.win);
                const winnerNames = winners.map((p) => p.name.split(' ')[0]).join(' + ');
                const loserNames = losers.map((p) => p.name.split(' ')[0]).join(' + ');
                return renderActivityRowCard({
                  key: `match-${i}`,
                  isHighlight,
                  tone: theme.accent,
                  leading: (
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: theme.surfaceAlt, border: '1px solid ' + theme.border, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Swords size={16} color={theme.accent} />
                    </div>
                  ),
                  tag: "Kamp",
                  meta: formatTimeAgo(row.created_at),
                  title: <><strong>{winnerNames}</strong> slog <strong>{loserNames}</strong></>,
                  subtitle: `${row.court} · ${row.score}`,
                  action: (
                    <button
                      onClick={() =>
                        setViewMatch({
                          kind: "result",
                          title: `${winnerNames} slog ${loserNames}`,
                          createdAt: row.created_at,
                          court: row.court,
                          score: row.score,
                          description: row.description,
                          winners,
                          losers,
                        })
                      }
                      style={activityActionBtnStyle(theme.accent)}
                    >
                      Se detaljer
                    </button>
                  ),
                });
              }
              const name = row.profiles?.full_name || row.profiles?.name || "En spiller";
              const avatar = row.profiles?.avatar || "🎾";
              const won = row.result === 'win';
              const change = Number(row.change) || 0;
              const tone = change >= 0 ? theme.green : theme.red;
              return renderActivityRowCard({
                key: `elo-${i}`,
                isHighlight,
                tone: theme.accent,
                leading: <AvatarCircle avatar={avatar} size={36} emojiSize="22px" style={{ background: theme.surfaceAlt, border: "1px solid " + theme.border }} />,
                tag: "Kamp",
                meta: formatTimeAgo(row.created_at),
                title: <><strong>{name}</strong> {won ? "vandt" : "tabte"}</>,
                stat: <span style={activityStatPillStyle(tone)}>{change >= 0 ? "+" : ""}{change} ELO</span>,
              });
            })}
          </div>
          {(canShowMore || canShowLess) && (
            <div style={{ display: "flex", gap: "8px", marginTop: "10px", flexWrap: "wrap" }}>
              {canShowMore && (
                <button
                  className="pm-ui-btn-chip pm-feed-filter-chip"
                  onClick={() => setVisibleFeedCount((prev) => Math.min(prev + FEED_PAGE_SIZE, filteredFeedRows.length))}
                >
                  Vis flere
                </button>
              )}
              {canShowLess && (
                <button
                  className="pm-ui-btn-chip pm-feed-filter-chip"
                  onClick={() => setVisibleFeedCount(FEED_INITIAL_COUNT)}
                >
                  Vis færre
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Quick actions */}
      <div className="pm-home-grid">
        {actions.map((a, i) => (
          <button
            key={i}
            onClick={() => setTab(a.tab)}
            data-tour={`quick-action-${a.tab}`}
            className="pm-ui-card pm-ui-card-interactive pm-home-action-card"
          >
            <div className="pm-home-action-card-icon">
              {a.icon}
            </div>
            <div className="pm-home-action-card-title">{a.title}</div>
            <div className="pm-home-action-card-desc">{a.desc}</div>
          </button>
        ))}
      </div>

      {/* Modals */}
      <AppModal
        open={Boolean(viewTournament)}
        ariaLabel="Americano resultatdetaljer"
        onClose={closeViewTournament}
        maxWidth="400px"
        zIndex={1000}
      >
        {viewTournament ? (
          <>
            <div style={{ padding: "20px", borderBottom: "1px solid " + theme.border, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: "10px", color: theme.accent, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px" }}>Americano Resultat</div>
                <h3 style={{ fontSize: "18px", fontWeight: 800, color: theme.text, margin: 0 }}>{viewTournament.tournamentName}</h3>
              </div>
              <button type="button" aria-label="Luk turneringsdetaljer" onClick={closeViewTournament} style={{ border: "none", background: "none", cursor: "pointer", color: theme.textLight }}><X size={20} aria-hidden="true" /></button>
            </div>
            
            <div style={{ padding: "20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
              {viewTournament.leaderboard.map((p, idx) => {
                const rank = idx + 1;
                const isWinner = rank === 1;
                const rankIcon = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;
                
                return (
                  <div key={idx} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 14px", background: isWinner ? theme.warmBg : theme.surface, borderRadius: "10px", border: "1px solid " + (isWinner ? theme.warm : theme.border) }}>
                    <div style={{ width: "24px", fontSize: "14px", fontWeight: 800, color: isWinner ? theme.warm : theme.textLight, textAlign: "center" }}>
                      {rankIcon || rank}
                    </div>
                    <AvatarCircle avatar={p.avatar} size={36} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "14px", fontWeight: 700, color: theme.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                    </div>
                    <div style={{ fontSize: "15px", fontWeight: 800, color: isWinner ? theme.warm : theme.text }}>
                      {p.points} <span style={{ fontSize: "10px", fontWeight: 600, opacity: 0.6 }}>PTS</span>
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div style={{ padding: "16px 20px", borderTop: "1px solid " + theme.border }}>
              <button type="button" onClick={closeViewTournament} style={{ ...btn(true), width: "100%", justifyContent: "center" }}>Luk</button>
            </div>
          </>
        ) : null}
      </AppModal>

      <AppModal
        open={Boolean(viewMatch)}
        ariaLabel="Kampdetaljer"
        onClose={closeViewMatch}
        maxWidth="460px"
        zIndex={1000}
      >
        {viewMatch ? (
          <>
            <div style={{ padding: "20px", borderBottom: "1px solid " + theme.border, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: "10px", color: theme.accent, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px" }}>
                  {viewMatch.kind === "result" ? "Kampresultat" : "Åben kamp"}
                </div>
                <h3 style={{ fontSize: "18px", fontWeight: 800, color: theme.text, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {viewMatch.title}
                </h3>
              </div>
              <button type="button" aria-label="Luk kampdetaljer" onClick={closeViewMatch} style={{ border: "none", background: "none", cursor: "pointer", color: theme.textLight }}><X size={20} aria-hidden="true" /></button>
            </div>

            <div style={{ padding: "20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {viewMatch.court ? (
                  <span style={{ fontSize: "11px", border: "1px solid " + theme.border, borderRadius: "999px", padding: "4px 10px", color: theme.textMid, background: theme.surfaceAlt }}>
                    {viewMatch.court}
                  </span>
                ) : null}
                {viewMatch.score ? (
                  <span style={{ fontSize: "11px", border: "1px solid " + theme.blue + "33", borderRadius: "999px", padding: "4px 10px", color: theme.accent, background: theme.accentBg }}>
                    Resultat: {viewMatch.score}
                  </span>
                ) : null}
                {viewMatch.date ? (
                  <span style={{ fontSize: "11px", border: "1px solid " + theme.border, borderRadius: "999px", padding: "4px 10px", color: theme.textMid, background: theme.surfaceAlt }}>
                    {DateTime.fromISO(viewMatch.date).setLocale("da").toFormat("EEE d. MMM")}
                  </span>
                ) : null}
                {viewMatch.createdAt ? (
                  <span style={{ fontSize: "11px", border: "1px solid " + theme.border, borderRadius: "999px", padding: "4px 10px", color: theme.textMid, background: theme.surfaceAlt }}>
                    {formatTimeAgo(viewMatch.createdAt)}
                  </span>
                ) : null}
              </div>

              {viewMatch.kind === "result" ? (
                <>
                  <div className="pm-ui-card" style={{ padding: "12px" }}>
                    <div style={{ fontSize: "11px", color: theme.textLight, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>Vindere</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {(viewMatch.winners || []).map((p, idx) => (
                        <div key={`w-${idx}`} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <AvatarCircle avatar={p.avatar} size={30} emojiSize="15px" style={{ background: theme.surfaceAlt, border: "1px solid " + theme.border }} />
                          <div style={{ flex: 1, minWidth: 0, fontSize: "14px", fontWeight: 700, color: theme.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                          <div style={{ fontSize: "12px", fontWeight: 700, color: Number(p.change) >= 0 ? theme.green : theme.red }}>
                            {Number(p.change) >= 0 ? "+" : ""}{Number(p.change) || 0} ELO
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pm-ui-card" style={{ padding: "12px" }}>
                    <div style={{ fontSize: "11px", color: theme.textLight, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>Tabere</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {(viewMatch.losers || []).map((p, idx) => (
                        <div key={`l-${idx}`} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <AvatarCircle avatar={p.avatar} size={30} emojiSize="15px" style={{ background: theme.surfaceAlt, border: "1px solid " + theme.border }} />
                          <div style={{ flex: 1, minWidth: 0, fontSize: "14px", fontWeight: 700, color: theme.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                          <div style={{ fontSize: "12px", fontWeight: 700, color: Number(p.change) >= 0 ? theme.green : theme.red }}>
                            {Number(p.change) >= 0 ? "+" : ""}{Number(p.change) || 0} ELO
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {viewMatch.description ? (
                    <div style={{ fontSize: "13px", color: theme.textMid, lineHeight: 1.45 }}>
                      {viewMatch.description}
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="pm-ui-card" style={{ padding: "12px", display: "flex", alignItems: "center", gap: "10px" }}>
                  <AvatarCircle avatar={viewMatch.creatorAvatar || "🎾"} size={34} emojiSize="18px" style={{ background: theme.surfaceAlt, border: "1px solid " + theme.border }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: "14px", fontWeight: 700, color: theme.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {viewMatch.creatorName || "Spiller"}
                    </div>
                    <div style={{ fontSize: "12px", color: theme.textMid }}>
                      Søger spillere til en åben 2v2 kamp
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div style={{ padding: "16px 20px", borderTop: "1px solid " + theme.border }}>
              <button type="button" onClick={closeViewMatch} style={{ ...btn(true), width: "100%", justifyContent: "center" }}>Luk</button>
            </div>
          </>
        ) : null}
      </AppModal>

      {viewPlayer && (
        <PlayerStatsModal
          userId={viewPlayer.id}
          fallbackName={viewPlayer.name}
          onClose={() => setViewPlayer(null)}
        />
      )}

      <AppModal
        open={Boolean(viewLeague)}
        ariaLabel="Ligastilling detaljer"
        onClose={closeViewLeague}
        maxWidth="400px"
        zIndex={1000}
      >
        {viewLeague ? (
          <>
            <div style={{ padding: "20px", borderBottom: "1px solid " + theme.border, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: "10px", color: theme.blue, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px" }}>Ligaresultat</div>
                <h3 style={{ fontSize: "18px", fontWeight: 800, color: theme.text, margin: 0 }}>{viewLeague.leagueName}</h3>
              </div>
              <button type="button" aria-label="Luk ligastilling detaljer" onClick={closeViewLeague} style={{ border: "none", background: "none", cursor: "pointer", color: theme.textLight }}><X size={20} aria-hidden="true" /></button>
            </div>
            <div style={{ padding: "20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
              {viewLeague.standings.map((t, idx) => {
                const rankIcon = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : null;
                const isChamp = idx === 0;
                return (
                  <div key={t.id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 14px", background: isChamp ? theme.blueBg : theme.surface, borderRadius: "10px", border: "1px solid " + (isChamp ? theme.blue : theme.border) }}>
                    <div style={{ width: "24px", fontSize: "14px", fontWeight: 800, color: isChamp ? theme.accent : theme.textLight, textAlign: "center", flexShrink: 0 }}>
                      {rankIcon || idx + 1}
                    </div>
                    <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
                      <AvatarCircle avatar={t.player1_avatar} size={28} emojiSize="13px" style={{ background: theme.accentBg, border: "1px solid " + theme.border }} />
                      <AvatarCircle avatar={t.player2_avatar} size={28} emojiSize="13px" style={{ background: theme.accentBg, border: "1px solid " + theme.border }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "14px", fontWeight: 700, color: theme.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</div>
                      <div style={{ fontSize: "11px", color: theme.textLight }}>{t.player1_name} & {t.player2_name}</div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: "15px", fontWeight: 800, color: isChamp ? theme.accent : theme.text }}>{t.points} <span style={{ fontSize: "10px", fontWeight: 600, opacity: 0.6 }}>PTS</span></div>
                      <div style={{ fontSize: "10px", color: theme.textLight }}>{t.wins}W · {t.losses}L</div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ padding: "16px 20px", borderTop: "1px solid " + theme.border }}>
              <button type="button" onClick={closeViewLeague} style={{ ...btn(true), width: "100%", justifyContent: "center" }}>Luk</button>
            </div>
          </>
        ) : null}
      </AppModal>
    </div>
  );
}
