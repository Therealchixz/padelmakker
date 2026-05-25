import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { DateTime } from 'luxon';
import { motion } from 'framer-motion';
import { cn } from '../lib/utils';
import { useAuth } from '../lib/AuthContext';
import { theme, btn, font } from '../lib/platformTheme';
import { resolveDisplayName } from '../lib/platformUtils';
import { statsFromEloHistoryRows, useProfileEloBundle } from '../lib/eloHistoryUtils';
import { supabase } from '../lib/supabase';
import { Users, MapPin, Swords, Trophy, ChevronRight, X } from 'lucide-react';
import { AvatarCircle } from '../components/AvatarCircle';
import { AppModal } from '../components/AppModal';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { PageSectionTitle } from '../components/PageSectionTitle';
import { PlayerProfileModal } from './PlayerProfileModal';
import { HOME_FEED_CACHE_TTL_MS } from '../lib/platformConstants';
import { formatPlaytomicLevel } from '../lib/padelLevelUtils';
import { mergeKampeSessionPrefs } from '../lib/kampeSessionPrefs';
import { seekingActivityLabelForRow } from '../lib/seekingActivityLabel';
import { SEEK_FEED_QUERY_TTL_MS, expandProfilesToSeekingFeedRows } from '../lib/seekingFeedTtl';
import {
  normalizeMatchSearchPrefs,
  isMatchFilterActive,
  countOpenMatchesMatchingFilter,
} from '../lib/matchSearchFilterUtils';

const HOME_FEED_CACHE_BY_USER = new Map();
const HOME_ELO_MODE_STORAGE_PREFIX = "pm-home-elo-mode:";
const HOME_FEED_FILTERS = [
  { id: 'kampe', label: 'Kampe', icon: '⚔️', types: ['match_group', 'elo', 'open_match'] },
  { id: 'americano', label: 'Americano', icon: '🎾', types: ['americano_winner', 'americano_registration'] },
  { id: 'liga', label: 'Liga', icon: '🏆', types: ['liga_completed', 'league_new'] },
  { id: 'spillere', label: 'Spillere', icon: '⚡', types: ['elo_milestone', 'seeking_player'] },
];

function readHomeEloMode(userId) {
  if (typeof localStorage === "undefined" || !userId) return "2v2";
  try {
    const raw = localStorage.getItem(HOME_ELO_MODE_STORAGE_PREFIX + String(userId));
    return raw === "americano" ? "americano" : "2v2";
  } catch {
    return "2v2";
  }
}

function writeHomeEloMode(userId, mode) {
  if (typeof localStorage === "undefined" || !userId) return;
  try {
    localStorage.setItem(HOME_ELO_MODE_STORAGE_PREFIX + String(userId), mode === "americano" ? "americano" : "2v2");
  } catch {
    // Ignore localStorage limitations (private mode / quota).
  }
}

export function HomeTab({ user, setTab }) {
  const { user: authUser } = useAuth();
  const [viewTournament, setViewTournament] = useState(null);
  const [viewPlayer, setViewPlayer] = useState(null);
  const displayName = resolveDisplayName(user, authUser);
  const firstName   = displayName.split(/\s+/)[0];
  const eloSyncKey = `${user.elo_rating}|${user.games_played}|${user.games_won}`;
  const { bundleLoading, profileFresh, ratedRows } = useProfileEloBundle(user.id, eloSyncKey);
  const [eloMode, setEloMode] = useState(() => readHomeEloMode(user?.id));
  const [americanoHistoryRows, setAmericanoHistoryRows] = useState([]);
  const histStats = useMemo(() => statsFromEloHistoryRows(ratedRows), [ratedRows]);
  const elo = histStats?.elo ?? Math.round(Number(profileFresh?.elo_rating) || 1000);
  const games = histStats?.games ?? (profileFresh?.games_played || 0);
  const wins = histStats?.wins ?? (profileFresh?.games_won || 0);
  const winRate = games > 0 ? Math.round((wins / games) * 100) : null;
  const americanoElo = Math.round(Number(profileFresh?.americano_elo_rating) || 1000);
  const americanoPlayed = Number(profileFresh?.americano_played) || 0;
  const americanoWins = Number(profileFresh?.americano_wins) || 0;
  const americanoDraws = Number(profileFresh?.americano_draws) || 0;
  const americanoLosses = Number(profileFresh?.americano_losses) || 0;
  const americanoRounds = americanoWins + americanoDraws + americanoLosses;
  const americanoWinRate = americanoRounds > 0 ? Math.round((americanoWins / americanoRounds) * 100) : null;

  useEffect(() => {
    setEloMode(readHomeEloMode(user?.id));
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    writeHomeEloMode(user.id, eloMode);
  }, [user?.id, eloMode]);

  useEffect(() => {
    if (!user?.id) {
      setAmericanoHistoryRows([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('americano_elo_history')
          .select('id, old_rating, new_rating, change, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true });
        if (error) throw error;
        if (cancelled) return;
        setAmericanoHistoryRows((data || []).map((row) => ({
          id: row.id,
          old_rating: row.old_rating,
          new_rating: row.new_rating,
          change: row.change,
          date: row.created_at,
          match_id: row.id,
          result:
            Number(row.change) > 0
              ? 'win'
              : Number(row.change) < 0
                ? 'loss'
                : 'draw',
        })));
      } catch (error) {
        console.warn('home americano_elo_history load:', error?.message || error);
        if (!cancelled) setAmericanoHistoryRows([]);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id, profileFresh?.americano_elo_rating]);

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
  const [feedLoadError, setFeedLoadError] = useState(null);
  const [showNiveauEloHint, setShowNiveauEloHint] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem('pm_niveau_elo_hint_v1') === '1') return;
      setShowNiveauEloHint(true);
    } catch {
      /* private mode */
    }
  }, []);
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
    if (!silent) {
      setFeedLoading(true);
      setFeedLoadError(null);
    }
    try {
      const today = new Date().toISOString().split('T')[0];
      const sinceSeeking = new Date(Date.now() - SEEK_FEED_QUERY_TTL_MS).toISOString();
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
          .select('id, full_name, name, avatar, level, area, intent_now, seeking_match_at, match_search_prefs, makker_search_prefs')
          .eq('seeking_match', true).gt('seeking_match_at', sinceSeeking)
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
      const anyRound1Ok = Object.values(round1Results).some((r) => r.status === 'fulfilled');
      if (!anyRound1Ok) {
        throw new Error('Kunne ikke hente aktivitet');
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
        amPartsRes, amMatchesRes, amEloRes,
        lgTeamsRes, lgMatchesRes,
        creatorProfilesRes, regAmPartsRes, newLgTeamsRes,
      ] = await Promise.allSettled([
        matchIds.length       ? supabase.from('match_results').select('match_id, score_display, match_winner').in('match_id', matchIds)                                                                                                       : Promise.resolve({ data: [] }),
        matchIds.length       ? supabase.from('matches').select('id, court_name, description').in('id', matchIds)                                                                                                                                : Promise.resolve({ data: [] }),
        completedAmIds.length ? supabase.from('americano_participants').select('id, tournament_id, user_id, display_name').in('tournament_id', completedAmIds)                                                                                   : Promise.resolve({ data: [] }),
        completedAmIds.length ? supabase.from('americano_matches').select('tournament_id, team_a_p1, team_a_p2, team_b_p1, team_b_p2, team_a_score, team_b_score').in('tournament_id', completedAmIds)                                           : Promise.resolve({ data: [] }),
        completedAmIds.length ? supabase.from('americano_elo_history').select('tournament_id, user_id, old_rating, new_rating, change').in('tournament_id', completedAmIds)                                                                     : Promise.resolve({ data: [] }),
        completedLgIds.length ? supabase.from('league_teams').select('id, league_id, name, player1_id, player1_name, player1_avatar, player2_id, player2_name, player2_avatar').eq('status', 'ready').in('league_id', completedLgIds)            : Promise.resolve({ data: [] }),
        completedLgIds.length ? supabase.from('league_matches').select('league_id, team1_id, team2_id, winner_id, score_text').eq('status', 'reported').in('league_id', completedLgIds)                                                         : Promise.resolve({ data: [] }),
        creatorIds.length     ? supabase.from('profiles').select('id, full_name, name, avatar').in('id', creatorIds)                                                                                                                             : Promise.resolve({ data: [] }),
        regAmIds.length       ? supabase.from('americano_participants').select('tournament_id').in('tournament_id', regAmIds)                                                                                                                     : Promise.resolve({ data: [] }),
        newLigaIds.length     ? supabase.from('league_teams').select('league_id').in('league_id', newLigaIds).eq('status', 'ready')                                                                                                              : Promise.resolve({ data: [] }),
      ]);
      const round2Results = {
        mResultsRes, mDetailsRes, amPartsRes, amMatchesRes, amEloRes, lgTeamsRes, lgMatchesRes, creatorProfilesRes, regAmPartsRes, newLgTeamsRes,
      };
      for (const [key, result] of Object.entries(round2Results)) {
        if (result.status === 'rejected') console.warn('[home-feed] Round2 query fejlede:', key, result.reason);
      }

      // Round 3: Americano avatar-opslag (afhænger af participants fra Round 2)
      const amParts = amPartsRes.value?.data || [];
      const amEloRows = amEloRes.value?.data || [];
      const amEloByTournamentUser = {};
      amEloRows.forEach((r) => {
        if (!r?.tournament_id || !r?.user_id) return;
        amEloByTournamentUser[`${r.tournament_id}:${r.user_id}`] = {
          old_rating: r.old_rating,
          new_rating: r.new_rating,
          change: r.change,
        };
      });
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
        const leaderboard = tParts
          .map((p) => {
            const eloRow = amEloByTournamentUser[`${t.id}:${p.user_id}`];
            return {
              name: p.display_name,
              points: totals[p.id] || 0,
              userId: p.user_id,
              avatar: amAvatarMap[String(p.user_id)] || '🎾',
              eloChange: eloRow ? Number(eloRow.change) : null,
              oldRating: eloRow?.old_rating ?? null,
              newRating: eloRow?.new_rating ?? null,
            };
          })
          .sort((a, b) => b.points - a.points);
        const winnerRow = leaderboard[0] || null;
        return {
          type: 'americano_winner',
          userId: bestPart.user_id,
          name: bestPart.display_name,
          points: bestPts,
          tournamentName: t.name,
          tournamentId: t.id,
          leaderboard,
          winnerEloChange: winnerRow?.eloChange ?? null,
          avatar: amAvatarMap[String(bestPart.user_id)] || '🏆',
          created_at: t.updated_at || t.tournament_date,
        };
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

      // Søger kamp/makker — én feed-række pr. aktiv kanal
      const seekingFeed_ = expandProfilesToSeekingFeedRows(seeking, { excludeUserId: user?.id }).slice(0, 6);

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
      if (fetchIdRef.current === fetchId) setFeedLoadError(null);
    } catch (e) {
      if (fetchIdRef.current === fetchId) {
        console.warn('Feed error:', e);
        setFeedLoadError('Kunne ikke hente aktivitet. Tjek din forbindelse og prøv igen.');
      }
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

  const activeElo = eloMode === 'americano' ? americanoElo : elo;
  const activeStats = eloMode === 'americano'
    ? {
        primary: { value: americanoPlayed, label: 'Turn.' },
        secondary: { value: americanoWins, label: 'Vundne runder' },
        tertiary: { value: americanoWinRate == null ? "—" : `${americanoWinRate}%`, label: 'Win' },
      }
    : {
        primary: { value: games, label: 'Kampe' },
        secondary: { value: wins, label: 'Sejre' },
        tertiary: { value: winRate == null ? "—" : `${winRate}%`, label: 'Win' },
      };
  const activeHistoryRows = eloMode === 'americano' ? americanoHistoryRows : ratedRows;

  const nextEloMilestone = useMemo(() => {
    const current = Math.max(0, Math.round(Number(activeElo) || 0));
    const step = 50;
    const max = 2000;
    if (current >= max) {
      return { target: max, remaining: 0 };
    }
    const target = Math.min(max, Math.ceil((current + 1) / step) * step);
    return { target, remaining: Math.max(0, target - current) };
  }, [activeElo]);
  const recentForm = useMemo(() => {
    return [...(activeHistoryRows || [])]
      .filter((row) => row.result === 'win' || row.result === 'loss' || row.result === 'draw')
      .sort((a, b) => new Date(b.date || b.created_at || 0).getTime() - new Date(a.date || a.created_at || 0).getTime())
      .slice(0, 5)
      .map((row, index) => ({
        key: `${row.match_id || row.created_at || row.date || index}-${index}`,
        label: row.result === 'win' ? 'V' : row.result === 'loss' ? 'T' : 'U',
        result: row.result,
      }));
  }, [activeHistoryRows]);
  const matchFilterPrefs = useMemo(
    () => normalizeMatchSearchPrefs(user?.match_search_prefs, user),
    [user],
  );
  const matchFilterOn = isMatchFilterActive(matchFilterPrefs, user);
  const [filterMatchCount, setFilterMatchCount] = useState(null);

  useEffect(() => {
    if (!user?.id || !matchFilterOn) {
      setFilterMatchCount(null);
      return;
    }
    let cancelled = false;
    countOpenMatchesMatchingFilter(user, matchFilterPrefs, user.id)
      .then((n) => { if (!cancelled) setFilterMatchCount(n); })
      .catch(() => { if (!cancelled) setFilterMatchCount(0); });
    return () => { cancelled = true; };
  }, [user, matchFilterPrefs, matchFilterOn]);

  const seekingByChannel = useMemo(() => {
    const makkerIds = new Set();
    const kampIds = new Set();
    for (const row of seekingFeed) {
      if (row.seekingChannel === "makker") makkerIds.add(row.userId);
      else if (row.seekingChannel === "kamp") kampIds.add(row.userId);
    }
    const total = new Set(seekingFeed.map((r) => r.userId)).size;
    return { makker: makkerIds.size, kamp: kampIds.size, total };
  }, [seekingFeed]);

  const seekingTitle = feedLoading
    ? "Finder spillere der søger"
    : seekingByChannel.makker > 0 && seekingByChannel.kamp === 0
      ? `${seekingByChannel.makker} ${seekingByChannel.makker === 1 ? "spiller" : "spillere"} søger makker`
      : seekingByChannel.kamp > 0 && seekingByChannel.makker === 0
        ? `${seekingByChannel.kamp} ${seekingByChannel.kamp === 1 ? "spiller" : "spillere"} søger kamp`
        : seekingByChannel.total > 0
          ? `${seekingByChannel.total} ${seekingByChannel.total === 1 ? "spiller" : "spillere"} søger makker eller kamp`
          : "Find en makker";
  const seekingSubtitle = seekingByChannel.total > 0
    ? "Se dem under Find makker"
    : "Se spillere på dit niveau";
  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <header className="flex items-end justify-between px-1 mb-8">
        <div className="space-y-1">
          <motion.h1 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-5xl md:text-6xl font-display uppercase italic tracking-tighter leading-none text-pm-text"
          >
            Hej <span className="text-pm-accent">{firstName}!</span> 👋
          </motion.h1>
          <p className="text-slate-500 font-bold text-lg md:text-xl">Klar til kamp i dag?</p>
        </div>
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700">
          <button 
            onClick={() => setEloMode('2v2')} 
            className={cn(
              "px-6 py-2.5 rounded-xl text-xs font-black tracking-widest transition-all",
              eloMode === '2v2' ? "bg-white dark:bg-slate-700 text-pm-accent shadow-sm" : "text-slate-400 hover:text-slate-600"
            )}
          >
            2V2
          </button>
          <button 
            onClick={() => setEloMode('americano')} 
            className={cn(
              "px-6 py-2.5 rounded-xl text-xs font-black tracking-widest transition-all",
              eloMode === 'americano' ? "bg-white dark:bg-slate-700 text-pm-orange shadow-sm" : "text-slate-400 hover:text-slate-600"
            )}
          >
            AMERICANO
          </button>
        </div>
      </header>

      {/* Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* ELO Main Card */}
        <motion.div 
          whileHover={{ y: -4, scale: 1.01 }}
          className="md:col-span-2"
        >
          <Card className="h-full overflow-hidden border-none bg-[#001e3c] text-white shadow-2xl shadow-blue-900/30 group p-1">
            <div className="h-full w-full rounded-[1.8rem] bg-gradient-to-br from-[#0076B6] via-[#004e82] to-[#001e3c] p-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-96 h-96 bg-blue-400/20 rounded-full -mr-32 -mt-32 blur-3xl pointer-events-none group-hover:scale-150 transition-transform duration-1000" />
              
              <div className="relative z-10">
                <p className="text-[11px] font-black uppercase tracking-[0.3em] text-blue-200/80 mb-2">
                  Din nuværende status
                </p>
                <div className="flex items-baseline gap-3 mb-8">
                  <span className="text-7xl md:text-8xl font-display uppercase italic tracking-tighter drop-shadow-2xl">{activeElo}</span>
                  <span className="text-2xl font-black text-blue-300/60 uppercase italic tracking-tighter">ELO</span>
                </div>

                <div className="grid grid-cols-3 gap-4 border-t border-white/10 pt-8 mt-4">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-blue-300">Kampe</p>
                    <p className="text-3xl font-display italic uppercase tracking-tighter">{activeStats.primary.value}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-blue-300">Sejre</p>
                    <p className="text-3xl font-display italic uppercase tracking-tighter">{activeStats.secondary.value}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-blue-300">Winrate</p>
                    <p className="text-3xl font-display italic uppercase tracking-tighter">{activeStats.tertiary.value}</p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Form Card */}
        <motion.div whileHover={{ y: -4, scale: 1.01 }}>
          <Card className="h-full bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xl p-8 flex flex-col justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 mb-6">Seneste form</p>
              <div className="flex gap-3">
                {recentForm.length > 0 ? recentForm.map((item) => (
                  <div 
                    key={item.key} 
                    className={cn(
                      "w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg text-white shadow-lg transform transition-transform hover:scale-110",
                      item.result === 'win' ? "bg-green-500 shadow-green-500/20" : item.result === 'loss' ? "bg-red-500 shadow-red-500/20" : "bg-slate-400 shadow-slate-500/20"
                    )}
                  >
                    {item.label}
                  </div>
                )) : (
                  <p className="text-sm text-slate-400 font-bold italic">Ingen kampe endnu</p>
                )}
              </div>
            </div>

            <div className="mt-12 p-6 rounded-[2rem] bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
               <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Næste milepæl</p>
               <div className="flex justify-between items-end mb-3">
                 <p className="text-lg font-black text-slate-900 dark:text-white uppercase italic tracking-tighter">
                  {nextEloMilestone.remaining > 0
                    ? `${nextEloMilestone.remaining} til målet`
                    : `Mål nået!`}
                 </p>
                 <span className="text-xs font-black text-pm-accent tracking-tighter italic uppercase">{nextEloMilestone.target} ELO</span>
               </div>
               <div className="w-full h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(5, (1 - nextEloMilestone.remaining / 50) * 100)}%` }}
                    className="h-full bg-pm-accent shadow-[0_0_12px_rgba(0,118,182,0.4)]" 
                    transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
                  />
               </div>
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Quick CTAs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <button
          onClick={() => setTab("makkere")}
          className="flex items-center gap-6 p-6 rounded-[2.5rem] bg-green-500 hover:bg-green-600 transition-all group text-left shadow-xl shadow-green-500/20 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl group-hover:scale-150 transition-transform duration-700" />
          <div className="w-16 h-16 rounded-[1.5rem] bg-white flex items-center justify-center text-green-600 shadow-xl group-hover:rotate-6 transition-transform">
            <Users size={32} />
          </div>
          <div className="relative z-10">
            <p className="font-black text-white/70 uppercase text-[10px] tracking-widest mb-1">Social</p>
            <p className="text-2xl font-display uppercase italic tracking-tighter text-white">Find Makker</p>
            <p className="text-xs font-bold text-white/80">{seekingTitle}</p>
          </div>
          <div className="ml-auto w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white">
            <ChevronRight size={24} />
          </div>
        </button>

        <button
          type="button"
          data-tour="quick-action-kampe"
          onClick={() => setTab("kampe")}
          className="flex items-center gap-6 p-6 rounded-[2.5rem] bg-pm-accent hover:bg-pm-accent-hover transition-all group text-left shadow-xl shadow-blue-500/20 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl group-hover:scale-150 transition-transform duration-700" />
          <div className="w-16 h-16 rounded-[1.5rem] bg-white flex items-center justify-center text-pm-accent shadow-xl group-hover:rotate-6 transition-transform">
            <Swords size={32} />
          </div>
          <div className="relative z-10">
            <p className="font-black text-white/70 uppercase text-[10px] tracking-widest mb-1">Play</p>
            <p className="text-2xl font-display uppercase italic tracking-tighter text-white">Tilmeld Kamp</p>
            <p className="text-xs font-bold text-white/80">Se åbne kampe i nærheden</p>
          </div>
          <div className="ml-auto w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white">
            <ChevronRight size={24} />
          </div>
        </button>
      </div>

      {/* Activity Feed */}
      <section className="space-y-4">
        <div data-tour="home-latest-activity" className="scroll-mt-24 space-y-4">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xl font-black font-display uppercase italic text-pm-text">Seneste aktivitet</h2>
          <button 
            onClick={enableAllFilters}
            className="text-xs font-black text-pm-accent uppercase tracking-wider"
          >
            Vis alle
          </button>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-4 px-1 scrollbar-hide">
          <button
            onClick={enableAllFilters}
            className={cn(
              "px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all",
              allActive 
                ? "bg-pm-text text-white shadow-lg" 
                : "bg-white text-slate-400 border border-slate-200"
            )}
          >
            Alle Typer
          </button>
          {HOME_FEED_FILTERS.map(f => {
            const on = activeFilters.has(f.id);
            return (
              <button
                key={f.id}
                onClick={() => toggleFilter(f.id)}
                className={cn(
                  "px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all",
                  on 
                    ? "bg-pm-accent text-white shadow-lg shadow-pm-accent/20" 
                    : "bg-white text-slate-400 border border-slate-200 hover:border-pm-accent/30"
                )}
              >
                {f.label}
              </button>
            );
          })}
        </div>
        </div>

        <div className="space-y-4">
          {feedLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-24 bg-white border border-slate-100 rounded-[2rem] animate-pulse" />
              ))}
            </div>
          ) : feedRows.length === 0 ? (
            <Card className="p-12 text-center bg-slate-50 dark:bg-slate-900 border-dashed border-2">
              <p className="text-slate-400 font-bold text-lg">Ingen aktivitet fundet i dit område endnu.</p>
            </Card>
          ) : (
            feedRenderItems.map((entry) => {
              if (entry.kind === "label") {
                return (
                  <div
                    key={entry.key}
                    className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-8 mb-4 ml-1"
                  >
                    {entry.label}
                  </div>
                );
              }
              const row = entry.row;
              const i = entry.index;
              const isAmericano = row.type === 'americano_winner';
              return (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  key={entry.key}
                  className="group relative flex items-center gap-5 p-6 rounded-[2rem] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-pm-accent hover:shadow-2xl hover:shadow-pm-accent/10 transition-all cursor-pointer"
                >
                  <div className={cn(
                    "w-14 h-14 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-lg",
                    isAmericano ? "bg-pm-orange shadow-pm-orange/20" : "bg-pm-accent shadow-pm-accent/20"
                  )}>
                    {isAmericano ? <Trophy size={24} /> : <Swords size={24} />}
                  </div>
                  <div className="flex-1 min-width-0">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">
                      {formatTimeAgo(row.created_at)}
                    </p>
                    <p className="text-lg font-black text-slate-900 dark:text-white leading-tight uppercase italic tracking-tighter">
                      {isAmericano ? (
                        <><span className="text-pm-orange">{row.name}</span> vandt Americano</>
                      ) : row.type === 'match_group' ? (
                        <>Kampresultat: <span className="text-pm-accent">{row.score}</span></>
                      ) : (
                        row.title || "Ny aktivitet"
                      )}
                    </p>
                    {row.court && <p className="text-sm font-bold text-slate-400 mt-1">{row.court}</p>}
                  </div>
                  <div className="w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-300 group-hover:text-pm-accent group-hover:bg-pm-accent-bg transition-all">
                    <ChevronRight size={20} />
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </section>

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
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "2px", minWidth: "78px" }}>
                      <div style={{ fontSize: "15px", fontWeight: 800, color: isWinner ? theme.warm : theme.text }}>
                        {p.points} <span style={{ fontSize: "10px", fontWeight: 600, opacity: 0.6 }}>PTS</span>
                      </div>
                      {Number.isFinite(Number(p.eloChange)) ? (
                        <div
                          style={{
                            fontSize: "11px",
                            fontWeight: 700,
                            color:
                              Number(p.eloChange) > 0
                                ? theme.green
                                : Number(p.eloChange) < 0
                                  ? theme.red
                                  : theme.textMid,
                          }}
                        >
                          {Number(p.eloChange) > 0 ? "+" : ""}
                          {Number(p.eloChange)} ELO
                        </div>
                      ) : (
                        <div style={{ fontSize: "10px", color: theme.textLight }}>ELO -</div>
                      )}
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
        <PlayerProfileModal
          player={viewPlayer}
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
