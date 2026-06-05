import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { DateTime } from 'luxon';
import { useAuth } from '../lib/AuthContext';
import { theme, btn, font } from '../lib/platformTheme';
import { resolveDisplayName } from '../lib/platformUtils';
import { statsFromEloHistoryRows, useProfileEloBundle } from '../lib/eloHistoryUtils';
import { supabase } from '../lib/supabase';
import { Court } from '../api/base44Client';
import { Users, MapPin, Swords, Trophy, ChevronRight, X } from 'lucide-react';
import { AvatarCircle } from '../components/AvatarCircle';
import { AppModal } from '../components/AppModal';
import { PageSectionTitle } from '../components/PageSectionTitle';
import { PlayerProfileModal } from './PlayerProfileModal';
import { HOME_FEED_CACHE_TTL_MS } from '../lib/platformConstants';
import { formatPlaytomicLevel } from '../lib/padelLevelUtils';
import { mergeKampeSessionPrefs } from '../lib/kampeSessionPrefs';
import { parseMatchLevelRange } from '../lib/matchLevelRange';
import { matchTimeLabel } from '../lib/matchDisplayUtils';
import { regionDisplayLabel } from '../lib/appRegions';
import { getTournamentFormatLabel, resolveAmericanoCourtName } from '../features/americano/americanoDisplayUtils';
import { TOURNAMENT_ELO_LABEL, TOURNAMENT_MODE_LABEL } from '../lib/tournamentCopy';
import { seekingActivityLabelForRow } from '../lib/seekingActivityLabel';
import { createNotification } from '../lib/notifications';
import { shouldShowIosInstallHint, dismissIosInstallHint } from '../lib/iosInstallPrompt';
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
  { id: 'americano', label: TOURNAMENT_MODE_LABEL, icon: '🎾', types: ['americano_winner', 'americano_registration'] },
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

/** Sted for turnering/kamp: bane-navn, ellers opretterens region. */
function activityLocationLabel(courtName, creatorArea) {
  return openMatchLocationChipLabel(courtName, creatorArea);
}

/** Chip-tekst for sted: bane-navn, eller opretterens region når bane ikke er valgt. */
function openMatchLocationChipLabel(court, creatorArea) {
  const c = String(court || '').trim();
  const unset =
    !c || c.toLowerCase() === 'bane ikke valgt' || c === 'Bane ikke valgt endnu' || c === 'Ukendt bane';
  if (!unset) return c;
  const area = String(creatorArea || '').trim();
  if (!area) return null;
  return regionDisplayLabel(area) || area;
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

  // Dato-badge (dag + måned) til kort.
  const dayMonBadge = (ymd) => {
    if (!ymd) return { top: "–", bottom: "" };
    const d = new Date(`${ymd}T00:00:00`);
    if (Number.isNaN(d.getTime())) return { top: "–", bottom: "" };
    return {
      top: d.toLocaleDateString("da-DK", { day: "numeric" }).replace(".", ""),
      bottom: d.toLocaleDateString("da-DK", { month: "short" }).replace(".", ""),
    };
  };
  // Kort dato til undertekst, fx "9. jun".
  const shortDate = (ymd) => {
    if (!ymd) return "";
    const d = new Date(`${ymd}T00:00:00`);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("da-DK", { day: "numeric", month: "short" });
  };

  // Kommende kampe: 2v2-kampe, Americano/Mexicano og liga-kampe brugeren er en del af, fra i dag og frem.
  const [upcomingItems, setUpcomingItems] = useState([]);
  useEffect(() => {
    if (!user?.id) {
      setUpcomingItems([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const now = new Date();
        const todayYMD = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const [mRes, amRes, ltRes] = await Promise.all([
          supabase.from('match_players')
            .select('matches!inner(id, date, time, court_name, status, current_players, max_players)')
            .eq('user_id', user.id)
            .gte('matches.date', todayYMD)
            .in('matches.status', ['open', 'full', 'in_progress']),
          supabase.from('americano_participants')
            .select('americano_tournaments!inner(id, name, tournament_date, time_slot, status, format)')
            .eq('user_id', user.id)
            .gte('americano_tournaments.tournament_date', todayYMD)
            .neq('americano_tournaments.status', 'completed'),
          supabase.from('league_teams')
            .select('id, name, league_id, leagues!inner(id, name, status)')
            .or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`)
            .eq('status', 'ready'),
        ]);
        if (cancelled) return;

        const items = [];

        for (const r of (mRes.data || [])) {
          const m = r.matches;
          if (!m) continue;
          const statusLabel = m.status === 'open' ? 'Åben' : m.status === 'in_progress' ? 'I gang' : 'Fuld';
          const players = (m.current_players != null && m.max_players != null) ? ` · ${m.current_players}/${m.max_players} spillere` : '';
          items.push({
            key: `m-${m.id}`, kind: 'match', tone: theme.green, bg: theme.greenBg, badge: dayMonBadge(m.date), sortKey: `${m.date} ${m.time || ''}`,
            title: <strong style={{ fontWeight: 700 }}>{m.court_name || 'Padelkamp'}</strong>, tag: '2v2',
            subtitle: `${statusLabel} · ${m.time || 'Tidspunkt ikke sat'}${players}`,
            target: { tab: 'kampe', search: `focus=${encodeURIComponent(String(m.id))}` },
          });
        }

        for (const r of (amRes.data || [])) {
          const t = r.americano_tournaments;
          if (!t) continue;
          const fmt = String(t.format || '').toLowerCase() === 'mexicano' ? 'Mexicano' : 'Americano';
          items.push({
            key: `am-${t.id}`, kind: 'americano', tone: theme.warm, bg: theme.warmBg, badge: dayMonBadge(t.tournament_date), sortKey: `${t.tournament_date} ${t.time_slot || ''}`,
            title: <strong style={{ fontWeight: 700 }}>{t.name || fmt}</strong>, tag: fmt,
            subtitle: `${t.time_slot ? `${t.time_slot} · ` : ''}${t.status === 'registration' ? 'Tilmelding åben' : 'Planlagt'}`,
            target: { tab: 'kampe', search: `format=americano&focus=${encodeURIComponent(String(t.id))}` },
          });
        }

        const myTeams = (ltRes.data || []).filter((t) => t.leagues && t.leagues.status !== 'completed');
        if (myTeams.length) {
          const leagueIds = [...new Set(myTeams.map((t) => t.league_id))];
          const myTeamIds = new Set(myTeams.map((t) => t.id));
          const [lmRes, allTeamsRes] = await Promise.all([
            supabase.from('league_matches').select('id, league_id, round_number, team1_id, team2_id, status').in('league_id', leagueIds).eq('status', 'pending'),
            supabase.from('league_teams').select('id, name, league_id').in('league_id', leagueIds),
          ]);
          if (cancelled) return;
          const teamName = new Map((allTeamsRes.data || []).map((t) => [t.id, t.name]));
          const leagueName = new Map(myTeams.map((t) => [t.league_id, t.leagues?.name]));
          for (const lm of (lmRes.data || [])) {
            const involvesMe = myTeamIds.has(lm.team1_id) || myTeamIds.has(lm.team2_id);
            if (!involvesMe) continue;
            const oppId = myTeamIds.has(lm.team1_id) ? lm.team2_id : lm.team1_id;
            items.push({
              key: `lm-${lm.id}`, kind: 'liga', tone: theme.accent, bg: theme.accentBg, badge: { top: `R${lm.round_number ?? '?'}`, bottom: 'LIGA' }, sortKey: `zzzz-${lm.round_number ?? 0}`,
              title: <strong style={{ fontWeight: 700 }}>{leagueName.get(lm.league_id) || 'Ligakamp'}</strong>, tag: 'Liga',
              subtitle: `Runde ${lm.round_number ?? '?'}${oppId && teamName.get(oppId) ? ` mod ${teamName.get(oppId)}` : ''}`,
              target: { tab: 'kampe', search: `format=liga&focus=${encodeURIComponent(String(lm.league_id))}` },
            });
          }
        }

        items.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
        setUpcomingItems(items.slice(0, 5));
      } catch (err) {
        console.warn('home upcoming items load:', err?.message || err);
        if (!cancelled) setUpcomingItems([]);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  // Invitationer: (1) anmodninger om at komme med i DINE kampe, (2) holdinvitationer i ligaen, (3) dine egne ventende anmodninger.
  const [inviteItems, setInviteItems] = useState([]);
  useEffect(() => {
    if (!user?.id) {
      setInviteItems([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [inboundRes, teamInvRes] = await Promise.all([
          supabase.from('match_join_requests')
            .select('id, user_id, user_name, user_emoji, created_at, matches!inner(id, court_name, date, time, creator_id, status)')
            .eq('status', 'pending').eq('matches.creator_id', user.id),
          supabase.from('league_teams')
            .select('id, name, status, player1_name, league_id, leagues!inner(id, name)')
            .eq('player2_id', user.id).eq('status', 'pending'),
        ]);
        if (cancelled) return;

        const items = [];

        for (const r of (inboundRes.data || [])) {
          const m = r.matches; if (!m) continue;
          const sd = shortDate(m.date);
          items.push({
            key: `inb-${r.id}`, kind: 'inbound', icon: r.user_emoji || '🎾', tone: theme.green, bg: theme.greenBg, tag: 'Anmodning',
            title: <><strong style={{ fontWeight: 700 }}>{r.user_name || 'En spiller'}</strong> vil være med</>,
            subtitle: `${m.court_name || 'din kamp'}${sd ? ` · ${sd}` : ''}${m.time ? ` · ${m.time}` : ''}`,
            reqId: r.id, matchId: m.id, reqUserId: r.user_id, reqUserName: r.user_name || 'En spiller', reqUserEmoji: r.user_emoji,
            target: { tab: 'kampe', search: `focus=${encodeURIComponent(String(m.id))}` },
          });
        }

        for (const t of (teamInvRes.data || [])) {
          items.push({
            key: `team-${t.id}`, icon: '🏆', tone: theme.accent, bg: theme.accentBg, tag: 'Holdinvitation',
            title: <strong style={{ fontWeight: 700 }}>{t.name || 'Ligahold'}</strong>,
            subtitle: `${t.player1_name ? `${t.player1_name} · ` : ''}${t.leagues?.name || 'Liga'}`,
            target: { tab: 'kampe', search: `format=liga&focus=${encodeURIComponent(String(t.league_id))}` },
          });
        }

        setInviteItems(items.slice(0, 6));
      } catch (err) {
        console.warn('home invites load:', err?.message || err);
        if (!cancelled) setInviteItems([]);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  // Accepter/afvis en anmodning direkte fra Invitationer (samme logik som Kampe-fanen).
  const [busyInviteId, setBusyInviteId] = useState(null);
  const approveInvite = useCallback(async (it) => {
    if (busyInviteId) return;
    setBusyInviteId(it.key);
    try {
      const { data, error } = await supabase.rpc("approve_match_join_request", {
        p_request_id: it.reqId,
        p_match_id: it.matchId,
        p_user_id: it.reqUserId,
        p_user_name: it.reqUserName,
        p_user_emoji: it.reqUserEmoji || "🎾",
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Ukendt fejl");
      const myName = resolveDisplayName(user, user);
      await createNotification(it.reqUserId, "match_invite", "Anmodning godkendt! 🎾",
        `${myName} har godkendt din tilmeldingsanmodning.`, it.matchId).catch(() => {});
      setInviteItems((prev) => prev.filter((x) => x.key !== it.key));
    } catch (e) {
      console.warn("home approve invite:", e?.message || e);
      setBusyInviteId(null);
    }
  }, [busyInviteId, user]);
  const rejectInvite = useCallback(async (it) => {
    if (busyInviteId) return;
    setBusyInviteId(it.key);
    try {
      const { error } = await supabase.from("match_join_requests")
        .update({ status: "rejected" }).eq("id", it.reqId);
      if (error) throw error;
      await createNotification(it.reqUserId, "match_invite", "Anmodning afvist",
        "Din anmodning om at deltage i kampen er desværre ikke godkendt.", it.matchId).catch(() => {});
      setInviteItems((prev) => prev.filter((x) => x.key !== it.key));
    } catch (e) {
      console.warn("home reject invite:", e?.message || e);
      setBusyInviteId(null);
    }
  }, [busyInviteId]);

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
  // iOS: Web Push kræver en installeret PWA → vis et synligt banner på hjem-skærmen.
  const [showIosInstallHint, setShowIosInstallHint] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem('pm_niveau_elo_hint_v1') === '1') return;
      setShowNiveauEloHint(true);
    } catch {
      /* private mode */
    }
  }, []);

  useEffect(() => {
    // Sættes i en effect (ikke ved initial render) så server/klient matcher og
    // navigator/matchMedia kun læses i browseren.
    setShowIosInstallHint(shouldShowIosInstallHint());
  }, []);
  const [viewLeague, setViewLeague] = useState(null);
  const [viewMatch, setViewMatch] = useState(null);
  const closeViewTournament = useCallback(() => setViewTournament(null), []);
  const closeViewMatch = useCallback(() => setViewMatch(null), []);
  const closeViewLeague = useCallback(() => setViewLeague(null), []);
  const openMatchInKampe = useCallback((matchId) => {
    setViewMatch(null);
    mergeKampeSessionPrefs(user.id, { format: 'padel' });
    setTab('kampe', { search: `focus=${encodeURIComponent(String(matchId))}` });
  }, [setTab, user.id]);

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
    let watchdog = null;
    if (!silent) {
      setFeedLoading(true);
      setFeedLoadError(null);
      // Sikkerhedsnet: hvis fetchen mod forventning hænger, så sluk skelettet
      // alligevel, så brugeren ikke ser grå bokse i det uendelige.
      watchdog = setTimeout(() => setFeedLoading(false), 15000);
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
          .select('id, name, tournament_date, updated_at, format').eq('status', 'completed')
          .order('updated_at', { ascending: false }).limit(5),
        supabase.from('leagues')
          .select('id, name, updated_at').eq('status', 'completed')
          .order('updated_at', { ascending: false }).limit(5),
        supabase.from('matches')
          .select('id, creator_id, date, time, time_end, court_name, level_range, description, created_at').eq('status', 'open')
          .gte('date', today).order('created_at', { ascending: false }).limit(5),
        supabase.from('americano_tournaments')
          .select('id, name, tournament_date, time_slot, player_slots, court_id, creator_id, created_at, format').eq('status', 'registration')
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
      const creatorIds     = [...new Set([
        ...openMatches.map(m => m.creator_id),
        ...regAm.map(t => t.creator_id),
      ].filter(Boolean))];
      const openMatchIds   = openMatches.map(m => m.id);
      const regAmIds       = regAm.map(t => t.id);
      const newLigaIds     = newLiga.map(l => l.id);

      // Round 2: alle sekundære queries i parallel
      const [
        mResultsRes, mDetailsRes,
        amPartsRes, amMatchesRes, amEloRes,
        lgTeamsRes, lgMatchesRes,
        creatorProfilesRes, regAmPartsRes, newLgTeamsRes,
        openMatchPlayersRes,
        courtsRes,
      ] = await Promise.allSettled([
        matchIds.length       ? supabase.from('match_results').select('match_id, score_display, match_winner').in('match_id', matchIds)                                                                                                       : Promise.resolve({ data: [] }),
        matchIds.length       ? supabase.from('matches').select('id, court_name, description').in('id', matchIds)                                                                                                                                : Promise.resolve({ data: [] }),
        completedAmIds.length ? supabase.from('americano_participants').select('id, tournament_id, user_id, display_name').in('tournament_id', completedAmIds)                                                                                   : Promise.resolve({ data: [] }),
        completedAmIds.length ? supabase.from('americano_matches').select('tournament_id, team_a_p1, team_a_p2, team_b_p1, team_b_p2, team_a_score, team_b_score').in('tournament_id', completedAmIds)                                           : Promise.resolve({ data: [] }),
        completedAmIds.length ? supabase.from('americano_elo_history').select('tournament_id, user_id, old_rating, new_rating, change').in('tournament_id', completedAmIds)                                                                     : Promise.resolve({ data: [] }),
        completedLgIds.length ? supabase.from('league_teams').select('id, league_id, name, player1_id, player1_name, player1_avatar, player2_id, player2_name, player2_avatar').eq('status', 'ready').in('league_id', completedLgIds)            : Promise.resolve({ data: [] }),
        completedLgIds.length ? supabase.from('league_matches').select('league_id, team1_id, team2_id, winner_id, score_text').eq('status', 'reported').in('league_id', completedLgIds)                                                         : Promise.resolve({ data: [] }),
        creatorIds.length     ? supabase.from('profiles').select('id, full_name, name, avatar, area').in('id', creatorIds)                                                                                                                       : Promise.resolve({ data: [] }),
        regAmIds.length       ? supabase.from('americano_participants').select('tournament_id').in('tournament_id', regAmIds)                                                                                                                     : Promise.resolve({ data: [] }),
        newLigaIds.length     ? supabase.from('league_teams').select('league_id').in('league_id', newLigaIds).eq('status', 'ready')                                                                                                              : Promise.resolve({ data: [] }),
        openMatchIds.length   ? supabase.from('match_players').select('match_id, user_id, user_name, user_emoji, team').in('match_id', openMatchIds)                                                                                            : Promise.resolve({ data: [] }),
        Court.filter(),
      ]);
      const round2Results = {
        mResultsRes, mDetailsRes, amPartsRes, amMatchesRes, amEloRes, lgTeamsRes, lgMatchesRes, creatorProfilesRes, regAmPartsRes, newLgTeamsRes, openMatchPlayersRes, courtsRes,
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
          format: t.format || 'americano',
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
      const openPlayersByMatch = {};
      (openMatchPlayersRes.value?.data || []).forEach((pl) => {
        if (!openPlayersByMatch[pl.match_id]) openPlayersByMatch[pl.match_id] = [];
        openPlayersByMatch[pl.match_id].push(pl);
      });
      const openMatchFeed_ = openMatches.map(m => {
        const p = pMap[m.creator_id] || {};
        const { min: eloMin, max: eloMax, booked } = parseMatchLevelRange(m.level_range);
        const players = (openPlayersByMatch[m.id] || []).map((pl) => ({
          userId: pl.user_id,
          name: pl.user_name || 'Spiller',
          avatar: pl.user_emoji || '🎾',
          team: pl.team,
        }));
        const courtRaw = String(m.court_name || '').trim();
        const court =
          courtRaw && courtRaw.toLowerCase() !== 'bane ikke valgt'
            ? courtRaw
            : booked === false
              ? 'Bane ikke valgt endnu'
              : 'Ukendt bane';
        return {
          type: 'open_match',
          matchId: m.id,
          creatorName: p.full_name || p.name || 'En spiller',
          creatorAvatar: p.avatar || '🎾',
          creatorArea: p.area || '',
          creatorId: m.creator_id,
          date: m.date,
          time: m.time,
          timeEnd: m.time_end,
          court,
          booked,
          eloMin,
          eloMax,
          description: m.description || '',
          players,
          playerCount: players.length,
          created_at: m.created_at,
        };
      });

      // Americano under tilmelding
      const regCounts = {};
      (regAmPartsRes.value?.data || []).forEach(p => { regCounts[p.tournament_id] = (regCounts[p.tournament_id] || 0) + 1; });
      const courtsList = (courtsRes.status === 'fulfilled' ? courtsRes.value : []) || [];
      const courtsForAm = courtsList.map((c) => ({ id: String(c.id), name: String(c.name || 'Bane') }));
      const americanoRegFeed_ = regAm.map(t => {
        const creatorArea = pMap[t.creator_id]?.area || '';
        const courtName = resolveAmericanoCourtName(t.court_id, courtsForAm);
        const location = activityLocationLabel(courtName, creatorArea);
        return {
          type: 'americano_registration',
          format: t.format || 'americano',
          tournamentId: t.id,
          name: t.name,
          date: t.tournament_date,
          time: t.time_slot,
          location,
          slots: t.player_slots,
          participants: regCounts[t.id] || 0,
          created_at: t.created_at,
        };
      });

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
      if (watchdog) clearTimeout(watchdog);
      // En ikke-silent fetch tænder loading-skelettet og skal altid slukke det igen,
      // også selvom en silent baggrunds-fetch i mellemtiden har bumpet fetchId
      // (ellers hænger skelettet for evigt).
      if (!silent) setFeedLoading(false);
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

  /* Realtime: opdatér feed live når en kamp/turnering/liga ændrer sig.
     Debounced + silent, så der ikke blinkes skelet. Falder pænt tilbage til
     synligheds-/cache-refresh hvis kanalen fejler (samme mønster som NotificationBell). */
  const [feedRealtimeVersion, setFeedRealtimeVersion] = useState(0);
  useEffect(() => {
    if (!user?.id) return undefined;
    let cancelled = false;
    let debounceTimer = null;
    let retryTimer = null;
    const scheduleRefetch = () => {
      if (cancelled) return;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (!cancelled) fetchFeed({ silent: true });
      }, 1500);
    };
    const channel = supabase
      .channel(`home-feed-${user.id}-${feedRealtimeVersion}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'match_results' }, scheduleRefetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, scheduleRefetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'americano_tournaments' }, scheduleRefetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leagues' }, scheduleRefetch)
      .subscribe((status) => {
        if (cancelled) return;
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          if (retryTimer) clearTimeout(retryTimer);
          retryTimer = setTimeout(() => {
            if (!cancelled) setFeedRealtimeVersion((v) => v + 1);
          }, 1500);
        }
      });
    return () => {
      cancelled = true;
      if (debounceTimer) clearTimeout(debounceTimer);
      if (retryTimer) clearTimeout(retryTimer);
      try { supabase.removeChannel(channel); } catch { /* ignore */ }
    };
  }, [user?.id, fetchFeed, feedRealtimeVersion]);

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
    { Icon: Users,  color: theme.accent, bg: theme.accentBg, title: "Find en makker", desc: "Se ledige spillere",  tab: "makkere" },
    { Icon: MapPin, color: theme.green,  bg: theme.greenBg,  title: "Book en bane",   desc: "Ledige tider",       tab: "baner"   },
    { Icon: Swords, color: theme.warm,   bg: theme.warmBg,   title: "Åbne kampe",     desc: "Tilmeld dig nu",     tab: "kampe"   },
    { Icon: Trophy, color: theme.purple, bg: theme.purpleBg, title: "Se ranking",     desc: "Din placering",      tab: "ranking" },
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

  // Fyldt handlingsknap (farve + hvid tekst), farvematchet til korttypen — ens bredde på tværs af feedet.
  // Dybde: glans-gradient på toppen + lagdelt skygge + indre lys-kant = "løftet", ikke fladt.
  const activityActionBtnStyle = (tone) => ({
    ...btn(false),
    width: "84px",
    boxSizing: "border-box",
    justifyContent: "center",
    whiteSpace: "nowrap",
    padding: "8px 8px",
    fontSize: "13px",
    fontWeight: 700,
    height: "auto",
    borderRadius: "10px",
    border: "1px solid rgba(0,0,0,0.05)",
    color: "#fff",
    background: "linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0) 55%), " + tone,
    boxShadow: "0 1px 2px rgba(16,24,40,0.12)",
    flexShrink: 0,
  });
  // Sekundær (afvis) knap til invitationer — outline, jf. mockup. Let løft via blød skygge + hvid inderkant.
  const inviteSecondaryBtnStyle = {
    ...btn(false),
    boxSizing: "border-box",
    justifyContent: "center",
    whiteSpace: "nowrap",
    padding: "8px 12px",
    fontSize: "13px",
    fontWeight: 700,
    height: "auto",
    borderRadius: "10px",
    border: "1px solid " + theme.border,
    color: theme.textMid,
    background: theme.surface,
    boxShadow: "0 1px 2px rgba(16,24,40,0.06)",
    flexShrink: 0,
  };
  // Primær (accepter) knap til invitationer — fyldt grøn med dybde, auto-bredde så parret passer.
  const invitePrimaryBtnStyle = {
    ...btn(false),
    boxSizing: "border-box",
    justifyContent: "center",
    whiteSpace: "nowrap",
    padding: "8px 14px",
    fontSize: "13px",
    fontWeight: 700,
    height: "auto",
    borderRadius: "10px",
    border: "1px solid rgba(0,0,0,0.05)",
    color: "#fff",
    background: "linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0) 55%), " + theme.green,
    boxShadow: "0 1px 2px rgba(16,24,40,0.12)",
    flexShrink: 0,
  };

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
      const label = activityGroupLabel(row.created_at);
      const prevLabel = index > 0 ? activityGroupLabel(feedRows[index - 1].created_at) : null;
      const showLabel = index > 0 && label !== prevLabel;
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
  // Ugentlig ELO-ændring = sum af 'change' for kampe inden for de sidste 7 dage.
  const weeklyDelta = useMemo(() => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    let sum = 0;
    for (const row of (activeHistoryRows || [])) {
      const t = new Date(row.date || row.created_at || 0).getTime();
      if (!Number.isNaN(t) && t >= weekAgo) sum += Number(row.change) || 0;
    }
    return Math.round(sum);
  }, [activeHistoryRows]);
  const greetingText = useMemo(() => {
    const h = new Date().getHours();
    if (h < 10) return 'Godmorgen';
    if (h < 12) return 'God formiddag';
    if (h < 18) return 'God eftermiddag';
    return 'God aften';
  }, []);
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

  return (
    <div>
      {showIosInstallHint && (
        <div
          style={{
            background: theme.warmBg,
            border: `1px solid ${theme.warm}33`,
            borderRadius: '12px',
            padding: '12px 14px',
            marginBottom: '14px',
            fontSize: '13px',
            color: theme.textMid,
            lineHeight: 1.5,
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
          }}
        >
          <span style={{ fontSize: '18px', lineHeight: 1.2 }} aria-hidden="true">📲</span>
          <div style={{ flex: 1 }}>
            <strong style={{ color: theme.text }}>Få notifikationer på din iPhone.</strong>{' '}
            Tryk på <strong>Del</strong>-ikonet nederst i Safari og vælg <strong>“Føj til hjemmeskærm”</strong>. Åbn derefter PadelMakker fra hjemmeskærmen, så kan du slå push-beskeder til.
            <button
              type="button"
              onClick={() => {
                dismissIosInstallHint();
                setShowIosInstallHint(false);
              }}
              style={{
                display: 'block',
                marginTop: '8px',
                background: 'transparent',
                border: 'none',
                color: theme.textLight,
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                padding: 0,
                fontFamily: font,
              }}
            >
              Skjul
            </button>
          </div>
        </div>
      )}
      {showNiveauEloHint && (
        <div
          style={{
            background: theme.accentBg,
            border: `1px solid ${theme.accent}33`,
            borderRadius: '12px',
            padding: '12px 14px',
            marginBottom: '14px',
            fontSize: '13px',
            color: theme.textMid,
            lineHeight: 1.5,
          }}
        >
          <strong style={{ color: theme.text }}>Niveau og ELO er ikke det samme.</strong>{' '}
          Dit valgte niveau bruges til matching. ELO opdateres først, når du spiller kampe med resultat.{' '}
          <a href="/elo" style={{ color: theme.accent, fontWeight: 700 }}>
            Læs hvordan ELO virker
          </a>
          <button
            type="button"
            onClick={() => {
              try {
                localStorage.setItem('pm_niveau_elo_hint_v1', '1');
              } catch {
                /* ignore */
              }
              setShowNiveauEloHint(false);
            }}
            style={{
              display: 'block',
              marginTop: '8px',
              background: 'transparent',
              border: 'none',
              color: theme.textLight,
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              padding: 0,
              fontFamily: font,
            }}
          >
            Forstået
          </button>
        </div>
      )}
      {/* Premium ELO hero: vent på frisk DB (undgå flash af forældede tal fra React) */}
      {bundleLoading ? (
        <div style={{ textAlign: "center", padding: "32px 16px", color: theme.textLight, fontSize: "14px", marginBottom: "24px" }}>Indlæser dine tal…</div>
      ) : (
        <>
          {/* Hilsen */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: theme.textMid, letterSpacing: '-.01em' }}>{greetingText}</div>
            <h2 style={{ fontSize: 26, fontWeight: 800, color: theme.text, letterSpacing: '-.03em', lineHeight: 1.05, margin: 0 }}>Hej {firstName}</h2>
          </div>

          {/* Blå ELO-hero (nyt design) */}
          <section
            aria-label="Din ELO status"
            style={{
              borderRadius: 20,
              padding: '18px 20px 20px',
              background: 'linear-gradient(150deg, #1E3A8A 0%, #1D4ED8 55%, #2563EB 100%)',
              color: '#fff',
              position: 'relative',
              overflow: 'hidden',
              boxShadow: '0 8px 24px rgba(29,78,216,.28)',
              marginBottom: 24,
            }}
          >
            <div style={{ position: 'absolute', top: -60, right: -40, width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,.55), transparent 70%)' }} />

            {/* Top: label + 2v2/Americano-skift */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, position: 'relative' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,.8)', letterSpacing: '.02em' }}>
                {eloMode === 'americano' ? 'Americano' : '2v2'} ELO-rating
              </div>
              <div style={{ display: 'flex', background: 'rgba(255,255,255,.14)', borderRadius: 9, padding: 3, gap: 2, flexShrink: 0 }}>
                {[{ k: '2v2', l: '2v2' }, { k: 'americano', l: 'Americano' }].map(({ k, l }) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setEloMode(k)}
                    style={{
                      fontFamily: 'inherit', fontSize: 12, fontWeight: 700, padding: '5px 12px', borderRadius: 7,
                      border: 'none', cursor: 'pointer', letterSpacing: '-.01em',
                      background: eloMode === k ? '#fff' : 'transparent',
                      color: eloMode === k ? '#1D4ED8' : 'rgba(255,255,255,.85)',
                      transition: 'background .2s, color .2s',
                    }}
                  >{l}</button>
                ))}
              </div>
            </div>

            {/* ELO-tal + ugentlig delta-pille */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginTop: 6, position: 'relative', flexWrap: 'wrap' }}>
              <div style={{ fontSize: 52, fontWeight: 900, letterSpacing: '-.04em', lineHeight: 1 }}>{activeElo}</div>
              {(activeHistoryRows?.length > 0) && (() => {
                const up = weeklyDelta >= 0;
                return (
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5, marginBottom: 9,
                    padding: '4px 11px 4px 6px', borderRadius: 99,
                    background: up ? 'rgba(16,185,129,.2)' : 'rgba(239,68,68,.18)',
                    border: `1px solid ${up ? 'rgba(110,231,183,.35)' : 'rgba(252,165,165,.32)'}`,
                  }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, borderRadius: '50%', background: up ? '#10B981' : '#EF4444' }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">{up ? <polyline points="6 14 12 8 18 14" /> : <polyline points="6 10 12 16 18 10" />}</svg>
                    </span>
                    <span style={{ fontSize: 13.5, fontWeight: 800, color: up ? '#6EE7B7' : '#FCA5A5', letterSpacing: '-.01em' }}>{Math.abs(weeklyDelta)}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,.55)', marginLeft: 1, whiteSpace: 'nowrap' }}>denne uge</span>
                  </div>
                );
              })()}
            </div>

            {/* Fremgang mod næste mål */}
            <div style={{ marginTop: 16, position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 7, gap: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,.85)' }}>Næste mål · {nextEloMilestone.target}</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#BFDBFE', whiteSpace: 'nowrap' }}>
                  {nextEloMilestone.remaining > 0 ? `${nextEloMilestone.remaining} ELO igen` : 'Nået! 🎉'}
                </span>
              </div>
              <div style={{ height: 8, borderRadius: 99, background: 'rgba(255,255,255,.18)', overflow: 'hidden' }}>
                <div style={{
                  width: `${Math.max(0, Math.min(1, (nextEloMilestone.remaining > 0 ? (50 - nextEloMilestone.remaining) / 50 : 1))) * 100}%`,
                  height: '100%', borderRadius: 99, background: 'linear-gradient(90deg, #60A5FA, #93C5FD)', transition: 'width .6s ease',
                }} />
              </div>
            </div>

            {/* Form + Kampe/Sejre */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,.14)', position: 'relative', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.6)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Form</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  {recentForm.length > 0 ? (
                    [...recentForm].reverse().map((item) => {
                      const win = item.result === 'win';
                      const draw = item.result === 'draw';
                      return (
                        <span key={item.key} style={{
                          width: 20, height: 20, borderRadius: 6, fontSize: 11, fontWeight: 800,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: win ? 'rgba(110,231,183,.22)' : draw ? 'rgba(255,255,255,.18)' : 'rgba(252,165,165,.2)',
                          color: win ? '#6EE7B7' : draw ? 'rgba(255,255,255,.85)' : '#FCA5A5',
                        }}>{win ? 'S' : draw ? 'U' : 'T'}</span>
                      );
                    })
                  ) : (
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,.55)' }}>Ingen kampe endnu</span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 22 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 16, fontWeight: 800, lineHeight: 1 }}>{activeStats.primary.value}</div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,.6)', marginTop: 3 }}>{activeStats.primary.label}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 16, fontWeight: 800, lineHeight: 1 }}>{activeStats.tertiary.value}</div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,.6)', marginTop: 3 }}>Sejre</div>
                </div>
              </div>
            </div>
          </section>
        </>
      )}

      {/* Invitationer (rigtige data) — bruger samme kort-stil som aktivitetsfeedet for konsistens */}
      {inviteItems.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <PageSectionTitle>Invitationer</PageSectionTitle>
            <span style={{ fontSize: 11, fontWeight: 800, color: "#fff", background: "#EF4444", borderRadius: 999, minWidth: 18, height: 18, padding: "0 6px", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              {inviteItems.length}
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {inviteItems.map((it) => renderActivityRowCard({
              key: it.key,
              tone: it.tone,
              leading: (
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: it.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }} aria-hidden="true">
                  {it.icon}
                </div>
              ),
              tag: it.tag,
              title: it.title,
              subtitle: it.subtitle,
              action: it.kind === 'inbound' ? (
                <div style={{ display: "flex", gap: 6 }}>
                  <button type="button" disabled={busyInviteId === it.key} onClick={() => rejectInvite(it)} style={{ ...inviteSecondaryBtnStyle, opacity: busyInviteId === it.key ? 0.5 : 1 }}>
                    Afvis
                  </button>
                  <button type="button" disabled={busyInviteId === it.key} onClick={() => approveInvite(it)} style={{ ...invitePrimaryBtnStyle, opacity: busyInviteId === it.key ? 0.5 : 1 }}>
                    Acceptér
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => setTab(it.target.tab, { search: it.target.search })} style={activityActionBtnStyle(it.tone)}>
                  Se
                </button>
              ),
            }))}
          </div>
        </div>
      )}

      {/* Kommende kampe (rigtige data: 2v2, Americano/Mexicano og liga) — samme kort-stil som feedet */}
      {upcomingItems.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ marginBottom: 10 }}>
            <PageSectionTitle>Kommende kampe</PageSectionTitle>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {upcomingItems.map((it) => renderActivityRowCard({
              key: it.key,
              tone: it.tone,
              leading: (
                <div style={{ width: 40, height: 40, borderRadius: 10, background: it.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>
                  <span style={{ fontSize: it.kind === "liga" ? 14 : 16, fontWeight: 800, color: it.tone }}>{it.badge.top}</span>
                  {it.badge.bottom ? <span style={{ fontSize: 9, fontWeight: 700, color: it.tone, textTransform: "uppercase", marginTop: 1 }}>{it.badge.bottom}</span> : null}
                </div>
              ),
              tag: it.tag,
              title: it.title,
              subtitle: it.subtitle,
              action: (
                <button type="button" onClick={() => setTab(it.target.tab, { search: it.target.search })} style={activityActionBtnStyle(it.tone)}>
                  Se
                </button>
              ),
            }))}
          </div>
        </div>
      )}

      {matchFilterOn && filterMatchCount != null && filterMatchCount > 0 && (
        <button
          type="button"
          className="pm-home-seeking-cta"
          style={{ marginBottom: 10 }}
          onClick={() => setTab('kampe')}
        >
          <span className="pm-home-seeking-cta-icon" aria-hidden="true">
            <Swords size={20} />
          </span>
          <span className="pm-home-seeking-cta-copy">
            <strong>
              {filterMatchCount === 1
                ? '1 kamp matcher dit filter'
                : `${filterMatchCount} kampe matcher dit filter`}
            </strong>
            <small>Åbne kampe i din region på dit niveau</small>
          </span>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      )}

      {/* Aktivitetsfeed */}
      {feedLoading ? (
        <div data-tour="home-latest-activity" className="pm-tour-scroll-anchor" style={{ marginBottom: "24px" }}>
          <div style={{ fontSize: "12px", fontWeight: 700, color: theme.textLight, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "10px" }}>
            Seneste aktivitet
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {[54, 46, 54, 38, 50].map((w, i) => (
              <div key={i} style={{ height: "54px", borderRadius: "8px", background: theme.border, opacity: 0.5 + (i * 0.08), animation: "pm-pulse 1.4s ease-in-out infinite", animationDelay: `${i * 0.1}s` }} />
            ))}
          </div>
        </div>
      ) : feedLoadError && allFeedRows.length === 0 ? (
        <div data-tour="home-latest-activity" className="pm-tour-scroll-anchor" style={{ marginBottom: "24px" }}>
          <div style={{ fontSize: "12px", fontWeight: 700, color: theme.textLight, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "10px" }}>
            Seneste aktivitet
          </div>
          <div className="pm-state-card pm-state-card--error">
            <div className="pm-state-icon" aria-hidden="true">⚠️</div>
            <div className="pm-state-title">Kunne ikke hente aktivitet</div>
            <div className="pm-state-copy">{feedLoadError}</div>
            <div className="pm-state-actions">
              <button type="button" onClick={() => void fetchFeed()} style={{ ...btn(true), fontSize: "13px" }}>
                Prøv igen
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div data-tour="home-latest-activity" className="pm-tour-scroll-anchor" style={{ marginBottom: "24px" }}>
          {feedLoadError ? (
            <div
              className="pm-ui-card"
              style={{
                padding: "12px 14px",
                marginBottom: "10px",
                border: `1px solid ${theme.warm}`,
                background: theme.warmBg,
                fontSize: "12px",
                color: theme.textMid,
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: "10px",
              }}
            >
              <span>Kunne ikke opdatere aktivitet — viser sidst hentede data.</span>
              <button type="button" onClick={() => void fetchFeed()} style={{ ...btn(false), padding: "6px 12px", fontSize: "12px" }}>
                Prøv igen
              </button>
            </div>
          ) : null}
          <div className="pm-feed-filters-header">
            <PageSectionTitle>Seneste aktivitet</PageSectionTitle>
            <div className="pm-feed-filters-scroll" aria-label="Aktivitetstyper">
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
                      Vis alle typer
                    </button>
                  </>
                ) : (
                  <>
                    Der er ingen aktivitet endnu i dit område.
                    <div style={{ marginTop: "12px", display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "center" }}>
                      <button type="button" onClick={() => setTab("makkere")} style={activityActionBtnStyle(theme.accent)}>
                        Find makker
                      </button>
                      <button type="button" onClick={() => setTab("kampe")} style={activityActionBtnStyle(theme.textMid)}>
                        Opret kamp
                      </button>
                    </div>
                  </>
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
                const formatLabel = getTournamentFormatLabel(row.format);
                const winnerEloChange = Number(row.winnerEloChange);
                const hasWinnerElo = Number.isFinite(winnerEloChange);
                const winnerEloTone =
                  winnerEloChange > 0 ? theme.green : winnerEloChange < 0 ? theme.red : theme.textMid;
                return renderActivityRowCard({
                  key: `am-${i}`,
                  isHighlight,
                  tone: theme.warm,
                  leading: (
                    <div onClick={() => setViewPlayer(player)} style={{ cursor: "pointer" }}>
                      <AvatarCircle avatar={row.avatar} size={36} emojiSize="22px" style={{ background: theme.surfaceAlt, border: "1px solid " + theme.border }} />
                    </div>
                  ),
                  tag: formatLabel,
                  meta: formatTimeAgo(row.created_at),
                  title: (
                    <>
                      <span onClick={() => setViewPlayer(player)} style={{ cursor: "pointer", fontWeight: 700 }}>{row.name}</span> vandt en {formatLabel}
                    </>
                  ),
                  subtitle: row.tournamentName ? `"${row.tournamentName}"` : null,
                  stat: hasWinnerElo ? (
                    <span style={activityStatPillStyle(winnerEloTone)}>
                      {winnerEloChange > 0 ? '+' : ''}{winnerEloChange} ELO
                    </span>
                  ) : undefined,
                  action: <button onClick={() => setViewTournament(row)} style={activityActionBtnStyle(theme.warm)}>Detaljer</button>,
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
                  action: <button onClick={() => setViewLeague(row)} style={activityActionBtnStyle(theme.accent)}>Detaljer</button>,
                });
              }

              if (row.type === 'open_match') {
                const dateStr = row.date ? DateTime.fromISO(row.date).setLocale('da').toFormat('EEE d. MMM') : '';
                const timeStr = row.time ? matchTimeLabel({ time: row.time, time_end: row.timeEnd }) : '';
                const eloStr = row.eloMin != null && row.eloMax != null ? `ELO ${row.eloMin}–${row.eloMax}` : '';
                const locLabel = openMatchLocationChipLabel(row.court, row.creatorArea);
                const subtitleParts = [dateStr, timeStr, locLabel, eloStr].filter(Boolean);
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
                  subtitle: subtitleParts.join(' · ') || 'Åben kamp',
                  action: (
                    <button
                      onClick={() =>
                        setViewMatch({
                          kind: "open",
                          matchId: row.matchId,
                          title: `${row.creatorName} søger spillere`,
                          createdAt: row.created_at,
                          date: row.date,
                          time: row.time,
                          timeEnd: row.timeEnd,
                          court: row.court,
                          booked: row.booked,
                          eloMin: row.eloMin,
                          eloMax: row.eloMax,
                          description: row.description,
                          creatorName: row.creatorName,
                          creatorAvatar: row.creatorAvatar,
                          creatorArea: row.creatorArea,
                          players: row.players,
                          playerCount: row.playerCount,
                        })
                      }
                      style={activityActionBtnStyle(theme.green)}
                    >
                      Detaljer
                    </button>
                  ),
                });
              }

              if (row.type === 'americano_registration') {
                const formatLabel = getTournamentFormatLabel(row.format);
                const dateStr = row.date ? DateTime.fromISO(row.date).setLocale('da').toFormat('EEE d. MMM') : '';
                const subtitleParts = [
                  dateStr,
                  row.time || null,
                  row.location || null,
                  `${row.participants}/${row.slots} tilmeldt`,
                ].filter(Boolean);
                return renderActivityRowCard({
                  key: `amreg-${i}`,
                  isHighlight,
                  tone: theme.warm,
                  leading: (
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: theme.surfaceAlt, border: "1px solid " + theme.border, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "17px" }}>
                      🎾
                    </div>
                  ),
                  tag: formatLabel,
                  meta: formatTimeAgo(row.created_at),
                  title: <span style={{ fontWeight: 700 }}>{row.name}</span>,
                  subtitle: subtitleParts.join(' · '),
                  action: (
                    <button
                      onClick={() => {
                        mergeKampeSessionPrefs(user.id, { format: 'americano', americanoView: 'open' });
                        setTab('kampe', {
                          search: `format=americano&focus=${encodeURIComponent(String(row.tournamentId))}`,
                        });
                      }}
                      style={activityActionBtnStyle(theme.warm)}
                    >
                      Tilmeld
                    </button>
                  ),
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
                const player = {
                  id: row.userId,
                  name: row.name,
                  seekingChannel: row.seekingChannel === 'makker' ? 'makker' : row.seekingChannel === 'kamp' ? 'kamp' : undefined,
                };
                const openSeekingPlayer = () => setViewPlayer(player);
                const writeToPlayer = () => setTab("beskeder", { search: `med=${encodeURIComponent(String(row.userId))}` });
                const isMakker = row.seekingChannel === 'makker';
                const seekTone = isMakker ? theme.green : theme.blue;
                const levelStr = row.level != null && row.level !== '' ? formatPlaytomicLevel(row.level) : null;
                const sub = [row.area, levelStr].filter(Boolean).join(' · ');
                return renderActivityRowCard({
                  key: `seek-${row.userId}-${row.seekingChannel || 'x'}-${i}`,
                  isHighlight,
                  tone: seekTone,
                  leading: (
                    <div onClick={openSeekingPlayer} style={{ cursor: "pointer" }}>
                      <AvatarCircle avatar={row.avatar} size={36} emojiSize="22px" style={{ background: theme.surfaceAlt, border: "1px solid " + theme.border }} />
                    </div>
                  ),
                  tag: isMakker ? "Søger makker" : "Søger kamp",
                  meta: formatTimeAgo(row.created_at),
                  title: <><span style={{ fontWeight: 700, cursor: "pointer" }} onClick={openSeekingPlayer}>{row.name}</span> {seekingActivityLabelForRow(row)}</>,
                  subtitle: sub || "Klar til kamp",
                  action: <button onClick={writeToPlayer} style={activityActionBtnStyle(theme.green)}>Skriv</button>,
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
                  action: (
                    <button
                      onClick={() => {
                        mergeKampeSessionPrefs(user.id, { format: 'liga' });
                        setTab('kampe', { search: 'format=liga' });
                      }}
                      style={activityActionBtnStyle(theme.accent)}
                    >
                      {isReg ? 'Tilmeld' : 'Detaljer'}
                    </button>
                  ),
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
                      Detaljer
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

      {/* Genveje (nederst) */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ marginBottom: 10 }}>
          <PageSectionTitle>Genveje</PageSectionTitle>
        </div>
        <div className="pm-home-grid">
          {actions.map((a) => (
            <button
              key={a.tab}
              type="button"
              onClick={() => setTab(a.tab)}
              data-tour={`quick-action-${a.tab}`}
              className="pm-ui-card pm-ui-card-interactive pm-home-action-card"
            >
              <div className="pm-home-action-card-icon" style={{ background: a.bg }}>
                <a.Icon size={20} color={a.color} />
              </div>
              <div className="pm-home-action-card-title">{a.title}</div>
              <div className="pm-home-action-card-desc">{a.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Modals */}
      <AppModal
        open={Boolean(viewTournament)}
        ariaLabel={viewTournament ? `${getTournamentFormatLabel(viewTournament.format)} resultat` : 'Americano/Mexicano resultat'}
        onClose={closeViewTournament}
        maxWidth="400px"
        zIndex={1000}
      >
        {viewTournament ? (
          <>
            <div style={{ padding: "20px", borderBottom: "1px solid " + theme.border, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: "10px", color: theme.accent, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px" }}>
                  {getTournamentFormatLabel(viewTournament.format)} resultat
                </div>
                <h3 style={{ fontSize: "18px", fontWeight: 800, color: theme.text, margin: 0 }}>{viewTournament.tournamentName}</h3>
              </div>
              <button type="button" aria-label="Luk Americano/Mexicano-detaljer" onClick={closeViewTournament} style={{ border: "none", background: "none", cursor: "pointer", color: theme.textLight }}><X size={20} aria-hidden="true" /></button>
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
                {viewMatch.kind === "open" ? (
                  (() => {
                    const loc = openMatchLocationChipLabel(viewMatch.court, viewMatch.creatorArea);
                    return loc ? (
                      <span style={{ fontSize: "11px", border: "1px solid " + theme.border, borderRadius: "999px", padding: "4px 10px", color: theme.textMid, background: theme.surfaceAlt }}>
                        {loc}
                      </span>
                    ) : null;
                  })()
                ) : viewMatch.court ? (
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
                {viewMatch.time ? (
                  <span style={{ fontSize: "11px", border: "1px solid " + theme.border, borderRadius: "999px", padding: "4px 10px", color: theme.textMid, background: theme.surfaceAlt }}>
                    {matchTimeLabel({ time: viewMatch.time, time_end: viewMatch.timeEnd })}
                  </span>
                ) : null}
                {viewMatch.eloMin != null && viewMatch.eloMax != null ? (
                  <span style={{ fontSize: "11px", border: "1px solid " + theme.green + "33", borderRadius: "999px", padding: "4px 10px", color: theme.green, background: theme.greenBg || theme.surfaceAlt }}>
                    ELO {viewMatch.eloMin}–{viewMatch.eloMax}
                  </span>
                ) : null}
                {viewMatch.kind === "open" && viewMatch.booked != null ? (
                  <span style={{ fontSize: "11px", border: "1px solid " + theme.border, borderRadius: "999px", padding: "4px 10px", color: viewMatch.booked ? theme.green : theme.warm, background: theme.surfaceAlt }}>
                    {viewMatch.booked ? 'Bane booket' : 'Bane ikke booket'}
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
                <>
                  <div className="pm-ui-card" style={{ padding: "12px", display: "flex", alignItems: "center", gap: "10px" }}>
                    <AvatarCircle avatar={viewMatch.creatorAvatar || "🎾"} size={34} emojiSize="18px" style={{ background: theme.surfaceAlt, border: "1px solid " + theme.border }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: "14px", fontWeight: 700, color: theme.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {viewMatch.creatorName || "Spiller"}
                      </div>
                      <div style={{ fontSize: "12px", color: theme.textMid }}>
                        Opretter · søger spillere til en åben 2v2 kamp
                      </div>
                    </div>
                  </div>

                  <div className="pm-ui-card" style={{ padding: "12px" }}>
                    <div style={{ fontSize: "11px", color: theme.textLight, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>
                      Spillere ({viewMatch.playerCount ?? 0}/4)
                    </div>
                    {(viewMatch.players || []).length > 0 ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {(viewMatch.players || []).map((p, idx) => (
                          <div key={`${p.userId || idx}`} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <AvatarCircle avatar={p.avatar} size={30} emojiSize="15px" style={{ background: theme.surfaceAlt, border: "1px solid " + theme.border }} />
                            <div style={{ flex: 1, minWidth: 0, fontSize: "14px", fontWeight: 600, color: theme.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {p.name}
                            </div>
                            {p.team != null ? (
                              <span style={{ fontSize: "11px", color: theme.textLight, fontWeight: 600 }}>
                                Hold {p.team}
                              </span>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: "12px", color: theme.textMid, lineHeight: 1.45 }}>
                        Ingen tilmeldt endnu — bliv den første!
                      </div>
                    )}
                  </div>

                  {viewMatch.description ? (
                    <div className="pm-ui-card" style={{ padding: "12px" }}>
                      <div style={{ fontSize: "11px", color: theme.textLight, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>
                        Beskrivelse
                      </div>
                      <div style={{ fontSize: "13px", color: theme.textMid, lineHeight: 1.45 }}>
                        {viewMatch.description}
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </div>

            <div style={{ padding: "16px 20px", borderTop: "1px solid " + theme.border, display: "flex", flexDirection: "column", gap: "8px" }}>
              {viewMatch.kind === "open" && viewMatch.matchId ? (
                <button
                  type="button"
                  onClick={() => openMatchInKampe(viewMatch.matchId)}
                  style={{ ...btn(true), width: "100%", justifyContent: "center" }}
                >
                  Gå til kamp
                </button>
              ) : null}
              <button type="button" onClick={closeViewMatch} style={{ ...btn(viewMatch.kind !== "open"), width: "100%", justifyContent: "center" }}>Luk</button>
            </div>
          </>
        ) : null}
      </AppModal>

      {viewPlayer && (
        <PlayerProfileModal
          player={viewPlayer}
          onClose={() => setViewPlayer(null)}
          onMessage={() => { const pid = viewPlayer.id; setViewPlayer(null); setTab("beskeder", { search: `med=${encodeURIComponent(String(pid))}` }); }}
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
