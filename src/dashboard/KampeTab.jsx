import { useState, useEffect, useMemo, useCallback, useRef, lazy, Suspense } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { useConfirm } from '../lib/ConfirmDialogProvider';
import { fetchCourtsCached } from '../lib/courtsCache';
import { fetchProfilesByIdMap, MATCH_PLAYERS_SAFE_SELECT } from '../lib/profileQueries';
import { supabase } from '../lib/supabase';
import { readKampeSessionPrefs, mergeKampeSessionPrefs } from '../lib/kampeSessionPrefs';
import { calendarWindowForMatch, buildIcsEvent } from '../lib/matchIcsEvent';
import { matchPlayerTeam, splitPlayersByTeam, teamMoveErrorMessage } from '../lib/matchTeams';
import { nearestHalfHour } from '../lib/timeSlotOptions';
import { PADEL_RULE_SUMMARY } from '../lib/padelRuleSummary';
const AmericanoTab = lazy(() =>
  import('../features/americano/AmericanoTab').then(m => ({ default: m.AmericanoTab }))
);
const LigaTabLazyEmbed = lazy(() =>
  import('./LigaTab').then((m) => ({ default: m.LigaTab }))
);
import { theme, btn } from '../lib/platformTheme';
import { resolveDisplayName, sanitizeText } from '../lib/platformUtils';
import { statsFromEloHistoryRows, useProfileEloBundle, fetchEloByUserIdFromHistory } from '../lib/eloHistoryUtils';
import { eloOf, fmtClock, timeToMinutes, matchCompletedSortMs, formatMatchDateDa } from '../lib/matchDisplayUtils';
import { calculateAndApplyElo } from '../lib/applyEloMatch';
import {
  createNotification,
  createNotificationsForUsers,
  sendPushNotificationsForUsers,
} from '../lib/notifications';
import { activateSeekingPlayer, deactivateSeekingPlayer } from '../lib/seekingPlayerUtils';
import { notifyMatchWatchersForMatch } from '../lib/matchWatchUtils';
import { fetchMatchMessages, fetchMatchMessageCounts, sendMatchMessage, subscribeToMatchMessages } from '../lib/matchChatUtils';
import { openCalendarInvite } from '../lib/calendarExport';
import { MatchDetailActionCard } from '../components/kampe/MatchDetailActionCard';
import { CreateMatchForm } from '../components/kampe/CreateMatchForm';
import { CreatedMatchReceipt } from '../components/kampe/CreatedMatchReceipt';
import { rpcJoinOpenMatch, rpcLeaveMatch, rpcKickPlayer } from '../lib/matchJoinUtils';
import { openPlayerChat } from '../lib/playerChat';
import {
  courtSideErrorMessage,
  courtSideLabel,
} from '../lib/matchPlayerCourtSide';
import { submitPadelMatchResult } from '../lib/submitPadelMatchResult';
import { mapUserFacingError } from '../lib/userFacingErrors';
import { canConfirmPadelMatchResult, confirmPadelMatchResult, rejectPadelMatchResult } from '../lib/resolvePadelMatchResult';
import { KAMPE_NON_CHAT_NOTIFICATION_TYPES as KAMPE_NON_CHAT_NOTIF_TYPES } from '../lib/kampeNotificationTypes';
import { groupUnreadNotificationsByMatchId, groupRelevantUnreadNotificationsByMatchId, removeUnreadForMatch, shouldRefreshKampeUnreadForNotificationType } from '../lib/kampeNotificationBadges';
import { AdminPinGate } from '../components/AdminPinGate';
import { buildMatchCardState } from '../lib/matchCardState';
import { useAdminPinSession } from '../lib/useAdminPinSession';
import { buildKampeMatchLists } from '../lib/matchListFilters';
import {
  normalizeKampeListFilter,
  kampeListFilterIsActive,
  getKampeListRegionLabel,
  getKampeListLevelBandLabel,
} from '../lib/kampeListFilterCore';
import { facilityLabel } from '../lib/courtFacilities.jsx';
import { fetchRowsInChunks } from '../lib/supabaseChunkFetch';
import { buildMatchLevelRange, parseMatchLevelRange } from '../lib/matchLevelRange';
import { defaultMatchLevelEloRange, profilePlaytomicLevel } from '../lib/padelLevelUtils';
import {
  KAMPE_FORMAT_PADEL,
  KAMPE_FORMAT_AMERICANO,
  KAMPE_FORMAT_LIGA,
} from '../lib/kampeFocusNavigation';
import {
  parseKampeDetailRoute,
  buildKampe2v2DetailPath,
  buildKampeListPath,
  resolveLegacyKampeFocusRedirect,
} from '../lib/kampeDetailRoutes';
import { DateTime } from 'luxon';
import { UserMinus, Trash2, Zap, ChevronDown, ChevronUp, SendHorizontal, Users, BarChart3, RotateCcw } from 'lucide-react';
import { EmptyStateIcon } from '../components/EmptyStateIcon';

import { sharePadelMatch, shareResultToastMessage } from '../lib/shareUtils';
import { scrollFormFieldIntoView } from '../lib/formValidationScroll';
import { TeamSelectModal } from './TeamSelectModal';
import { ResultModal } from './ResultModal';
import { ConfirmResultModal } from './ConfirmResultModal';
import { PlayerProfileModal } from './PlayerProfileModal';
import { AvatarCircle } from '../components/AvatarCircle';
import { ReportResultErrorButton } from '../components/ReportResultErrorButton';
import { completedMatchActions } from '../lib/completedMatchActions';
import { completionMsFor2v2, isWithinResultErrorReportWindow } from '../lib/resultErrorReports';
import { calculate2v2MatchWinPrediction } from '../lib/matchWinPrediction';
import { PillTabs } from '../components/PillTabs';
import {
  KampeRedesignToolbar,
  KampeActiveFilterChips,
  KampeCreateHeader,
} from '../components/kampe/KampeRedesignToolbar';
import { KampeFilterSheet } from '../components/kampe/KampeFilterSheet';
import { KampeMatchListCard } from '../components/kampe/KampeMatchListCard';
import { KampeMatchDetailSheet } from '../components/kampe/KampeMatchDetailSheet';
import { isProfileMatchFeedVisible } from '../lib/seekingFeedTtl';
import { ActiveSeekingPanel } from '../components/ActiveSeekingPanel';
import { PlayIntentPanel } from '../components/PlayIntentPanel';
import { matchJoinPushContent } from '../lib/matchJoinNotice';
import { FILTER_RETURN_KAMPE } from '../lib/filterReturnNavigation';
import {
  getMatchVenueOptions,
  courtIdFromVenueSelection,
  courtNameFromVenueSelection,
  isMatchVenueTbd,
  MATCH_VENUE_TBD,
} from '../lib/matchVenueOptions';

const KAMPE_AUTO_READ_NOTIF_TYPES = KAMPE_NON_CHAT_NOTIF_TYPES.filter((type) => type !== 'match_invite');

export function KampeTab({ user, showToast, tabActive = true, onCreatePanelChange }) {
  const navigate = useNavigate();
  const location = useLocation();
  const kampeDetailRoute = parseKampeDetailRoute(location.pathname);
  const detailMatchId = kampeDetailRoute?.kind === '2v2' ? kampeDetailRoute.id : null;
  const detailMatchIdRef = useRef(detailMatchId);
  detailMatchIdRef.current = detailMatchId;
  const isOnKampeDetailPage = !!kampeDetailRoute;
  const detailBackTo = location.state?.backTo || null;
  /** 'idle' | 'loading' | 'ready' | 'missing' | 'error' — hurtig fetch så "Se kamp" ikke venter på hele listen. */
  const [detailFetchStatus, setDetailFetchStatus] = useState('idle');
  const [detailHydrateNonce, setDetailHydrateNonce] = useState(0);
  const close2v2Detail = useCallback(() => {
    navigate(buildKampeListPath(KAMPE_FORMAT_PADEL));
  }, [navigate]);
  // Kun selve Tilbage/luk-knappen: kom man fra fx en chat-invitation, land dér igen.
  const close2v2DetailToOrigin = useCallback(() => {
    if (detailBackTo) navigate(detailBackTo);
    else navigate(buildKampeListPath(KAMPE_FORMAT_PADEL));
  }, [navigate, detailBackTo]);
  const open2v2Detail = useCallback((matchId) => {
    navigate(buildKampe2v2DetailPath(matchId));
  }, [navigate]);
  const { user: authUser, refreshProfile } = useAuth();
  const ask = useConfirm();
  const isAdmin = user?.role === 'admin';
  const { adminPinVerified, refreshAdminPinSession } = useAdminPinSession(isAdmin && tabActive);
  const adminCanAct = isAdmin && adminPinVerified;
  const [adminPinGateOpen, setAdminPinGateOpen] = useState(false);
  const adminPinPendingChatMatchIdRef = useRef(null);
  const adminPinPendingExpandMatchIdRef = useRef(null);
  const myDisplayName                 = resolveDisplayName(user, authUser);
  // Profilens niveau (sættes af spilleren) — ikke ELO, som stiger med kampe.
  const myLevel = profilePlaytomicLevel(user);
  const eloSyncKeyKampe = `${user.elo_rating}|${user.games_played}|${user.games_won}`;
  const { profileFresh: kampeProfileFresh, ratedRows: kampeRatedRows, reloadProfileEloBundle: reloadKampeEloBundle } =
    useProfileEloBundle(user.id, eloSyncKeyKampe);
  const [showCreate, setShowCreate]   = useState(false);
  const [padelCreateStep, setPadelCreateStep] = useState(1);
  const [padelCreateFieldError, setPadelCreateFieldError] = useState(null);
  const [showAmericanoCreate, setShowAmericanoCreate] = useState(false);
  const [showLigaCreate, setShowLigaCreate] = useState(false);
  const [createdMatchReceipt, setCreatedMatchReceipt] = useState(null); // match row after creation
  const padelCreateFormRef = useRef(null);
  const padelCreateVenueFieldRef = useRef(null);
  const padelCreateDateFieldRef = useRef(null);
  const padelCreateTimeFieldRef = useRef(null);
  const padelCreateDurationFieldRef = useRef(null);
  const [courts, setCourts]           = useState([]);
  const [matches, setMatches]         = useState([]);
  const [matchPlayers, setMatchPlayers] = useState({});
  const [matchResults, setMatchResults] = useState({});
  /** match_id → user_id → ELO-ændring (alle spillere, til afsluttede kampe) */
  const [eloChangesByMatchId, setEloChangesByMatchId] = useState({});
  const [loadingMatches, setLoadingMatches] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [creating, setCreating]       = useState(false);
  const [busyId, setBusyId]           = useState(null);
  /** ELO fra elo_history pr. user_id — samme som profil; virker på tværs af profiler når RLS skjuler andres profiles.elo_rating */
  const [eloFromHistoryByUserId, setEloFromHistoryByUserId] = useState({});
  const [eloByUserId, setEloByUserId] = useState({});
  const [teamSelectMatch, setTeamSelectMatch] = useState(null);
  const [resultMatch, setResultMatch] = useState(null);
  const [confirmModalMatchId, setConfirmModalMatchId] = useState(null);
  const [viewPlayer, setViewPlayer]   = useState(null);
  const [expandedAdminActions, setExpandedAdminActions] = useState({});
  const [profilesById, setProfilesById] = useState({});
  const [completedLimit, setCompletedLimit] = useState(5);
  const [viewTab, setViewTab]         = useState(() => {
    const s = readKampeSessionPrefs(user.id);
    if (s?.view === "open" || s?.view === "active" || s?.view === "completed") return s.view;
    return "open";
  }); // "open" | "active" | "completed"
  const [kampeFormat, setKampeFormat] = useState(() => {
    const s = readKampeSessionPrefs(user.id);
    if (s?.format === "padel" || s?.format === "americano" || s?.format === "liga") return s.format;
    return "padel";
  }); // "padel" | "americano" | "liga"
  const [kampeScope, setKampeScope]   = useState(() => {
    const s = readKampeSessionPrefs(user.id);
    if (s?.scope === "mine" || s?.scope === "alle") return s.scope;
    return "alle";
  }); // "mine" | "alle"
  const [kampeListFilter, setKampeListFilter] = useState(() =>
    normalizeKampeListFilter(readKampeSessionPrefs(user.id)?.listFilter),
  );
  const [americanoFilteredCount, setAmericanoFilteredCount] = useState(null);
  const [ligaFilteredCount, setLigaFilteredCount] = useState(null);
  const [padelHelpOpen, setPadelHelpOpen] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  useEffect(() => {
    if (showCreate) setPadelHelpOpen(false);
  }, [showCreate]);

  useEffect(() => {
    if (showCreate && typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [padelCreateStep, showCreate]);

  useEffect(() => {
    if (!showCreate) {
      setPadelCreateStep(1);
      setPadelCreateFieldError(null);
    }
  }, [showCreate]);

  const [searchQuery, setSearchQuery] = useState("");
  const [joinRequests, setJoinRequests] = useState({}); // { [matchId]: [{ id, user_id, user_name, user_emoji, status }] }
  const [joinRequestsLoadingMatchId, setJoinRequestsLoadingMatchId] = useState(null);
  const refreshJoinRequestsForMatchRef = useRef(null);
  const [matchChatOpenById, setMatchChatOpenById] = useState({});
  const [matchChatById, setMatchChatById] = useState({});
  const [matchChatDraftById, setMatchChatDraftById] = useState({});
  const [matchChatLoadingById, setMatchChatLoadingById] = useState({});
  const [matchChatSendingById, setMatchChatSendingById] = useState({});
  const [matchChatErrorById, setMatchChatErrorById] = useState({});
  const [matchChatUnreadById, setMatchChatUnreadById] = useState({});
  /** Totalt antal beskeder per kamp — vises i "Match chat (N)" labelen
      uden at brugeren først skal åbne chatten. */
  const [matchChatTotalById, setMatchChatTotalById] = useState({});
  const [matchUnreadById, setMatchUnreadById] = useState({});
  const matchUnreadByIdRef = useRef({});
  const hasMatchListRef = useRef(false);
  useEffect(() => {
    matchUnreadByIdRef.current = matchUnreadById;
  }, [matchUnreadById]);
  const matchCardObserverRef = useRef(null);
  const matchCardDwellTimersRef = useRef(new Map());
  const matchChatListRefs = useRef({});
  const [newMatch, setNewMatch]       = useState({
    court_id: MATCH_VENUE_TBD,
    date: new Date().toISOString().split("T")[0],
    time: nearestHalfHour(),
    duration: "120",
    court_booked: false,
    level_min: "",
    level_max: "",
    description: "",
    match_type: "open",
    price_per_person: "",
    // Gratis indtil der skrives en pris; så skiftes der til MobilePay.
    payment_method: "free",
  });

  /**
   * Samme rækkefølge som ProfilTab: elo_history først (sand nuværende rating), derefter frisk
   * profiles-række, derefter bulk-liste (kan være bagud ift. DB), til sidst context.
   * Ellers vises forældet elo fra profiles-listen selvom historik viser nyere tal.
   */
  const myUidStr = String(user.id);
  const venueOptions = useMemo(() => getMatchVenueOptions(courts), [courts]);
  const createVenueOptions = useMemo(() => {
    if (newMatch.court_booked) return venueOptions;
    return [
      { id: MATCH_VENUE_TBD, label: 'Ikke valgt endnu', courtId: null },
      ...venueOptions,
    ];
  }, [venueOptions, newMatch.court_booked]);

  const myElo = useMemo(() => {
    const fromHist = statsFromEloHistoryRows(kampeRatedRows)?.elo;
    if (fromHist != null) return fromHist;
    if (kampeProfileFresh != null) {
      const raw = kampeProfileFresh.elo_rating;
      if (raw != null && raw !== "" && Number.isFinite(Number(raw))) {
        return Math.round(Number(raw));
      }
    }
    const fromList = eloByUserId[myUidStr];
    if (fromList != null && Number.isFinite(Number(fromList))) return Math.round(Number(fromList));
    return Math.round(Number(user.elo_rating) || 1000);
  }, [kampeRatedRows, kampeProfileFresh, myUidStr, eloByUserId, user.elo_rating]);

  const loadData = useCallback(async () => {
    const reqId = ++loadDataReqIdRef.current;
    const isStale = () => reqId !== loadDataReqIdRef.current;
    if (!hasMatchListRef.current) setLoadingMatches(true);
    setLoadError("");
    try {
      const uid = user.id;
      const openPoolCutoff = DateTime.now().minus({ days: 30 }).toISODate();
      const [cd, openPoolRes, createdRes, myMpRes] = await Promise.all([
        fetchCourtsCached(),
        supabase
          .from("matches")
          .select("*")
          .in("status", ["open", "full", "in_progress"])
          .gte("date", openPoolCutoff)
          .order("date", { ascending: true })
          .limit(400),
        supabase.from("matches").select("*").eq("creator_id", uid),
        supabase.from("match_players").select("match_id").eq("user_id", uid).limit(2000),
      ]);
      if (openPoolRes.error) throw openPoolRes.error;
      if (createdRes.error) throw createdRes.error;
      if (myMpRes.error) throw myMpRes.error;
      if (isStale()) return;

      setCourts(cd || []);

      const byId = new Map();
      for (const m of [...(openPoolRes.data || []), ...(createdRes.data || [])]) {
        if (m?.id) byId.set(String(m.id), m);
      }
      const extraIds = [];
      for (const r of myMpRes.data || []) {
        if (r?.match_id && !byId.has(String(r.match_id))) extraIds.push(r.match_id);
      }
      // Deep-link / chat "Se kamp": åben-pool har limit + 30-dages cutoff.
      const focusMatchId = detailMatchIdRef.current;
      if (focusMatchId && !byId.has(String(focusMatchId))) extraIds.push(focusMatchId);

      const uniqueExtraIds = [...new Set(extraIds)];
      if (uniqueExtraIds.length > 0) {
        const extraMatches = await fetchRowsInChunks(supabase, "matches", "id", uniqueExtraIds);
        for (const m of extraMatches) {
          if (m?.id) byId.set(String(m.id), m);
        }
      }
      if (isStale()) return;

      const allMatches = [...byId.values()];
      const allMatchIds = allMatches.map((m) => m.id);
      setMatches(allMatches);

      const vOpts = getMatchVenueOptions(cd || []);
      if (vOpts.length > 0) {
        setNewMatch((m) => {
          if (m.court_id === MATCH_VENUE_TBD && !m.court_booked) return m;
          if (m.court_id && vOpts.some((o) => o.id === m.court_id)) return m;
          const defaultId = m.court_booked ? vOpts[0].id : MATCH_VENUE_TBD;
          return { ...m, court_id: defaultId };
        });
      }

      const mpd =
        allMatchIds.length > 0 ? await fetchRowsInChunks(supabase, "match_players", "match_id", allMatchIds, MATCH_PLAYERS_SAFE_SELECT) : [];
      const mm = {};
      (mpd || []).forEach((mp) => {
        if (!mm[mp.match_id]) mm[mp.match_id] = [];
        mm[mp.match_id].push(mp);
      });

      /** Liste-kort: navn/emoji fra match_players + profil-avatar/region. ELO-historik hentes på detail. */
      const idsForProfiles = new Set();
      for (const arr of Object.values(mm)) {
        for (const row of arr || []) {
          if (row?.user_id) idsForProfiles.add(String(row.user_id));
        }
      }
      for (const m of allMatches) {
        if (m?.creator_id) idsForProfiles.add(String(m.creator_id));
      }
      idsForProfiles.add(String(user.id));
      const pById = await fetchProfilesByIdMap([...idsForProfiles]);
      const eloMap = {};
      for (const [id, pr] of Object.entries(pById)) {
        eloMap[id] = eloOf(pr);
      }
      setEloByUserId((prev) => ({ ...prev, ...eloMap }));
      setProfilesById((prev) => ({ ...prev, ...pById }));
      if (isStale()) return;
      setMatchPlayers(mm);

      const resultMatchIds = allMatches
        .filter((m) => {
          const st = String(m?.status || "").toLowerCase();
          return st === "completed" || st === "in_progress";
        })
        .map((m) => m.id);
      const mrd =
        resultMatchIds.length > 0
          ? await fetchRowsInChunks(supabase, "match_results", "match_id", resultMatchIds)
          : [];
      const mrMap = {};
      (mrd || []).forEach((mr) => {
        const mid = mr.match_id;
        const prev = mrMap[mid];
        if (!prev) {
          mrMap[mid] = mr;
          return;
        }
        const ta = prev.created_at != null ? new Date(prev.created_at).getTime() : 0;
        const tb = mr.created_at != null ? new Date(mr.created_at).getTime() : 0;
        if (tb >= ta) mrMap[mid] = mr;
      });
      setMatchResults(mrMap);

      const completedMatchIds = allMatches
        .filter((m) => String(m?.status || "").toLowerCase() === "completed")
        .map((m) => m.id);
      const eloHistRows =
        completedMatchIds.length > 0
          ? await fetchRowsInChunks(
              supabase,
              'elo_history',
              'match_id',
              completedMatchIds,
              'match_id, user_id, change',
            )
          : [];
      const eloChangesMap = {};
      for (const row of eloHistRows) {
        if (!row?.match_id || !row?.user_id) continue;
        const change = Number(row.change);
        if (!Number.isFinite(change) || change === 0) continue;
        const mid = String(row.match_id);
        if (!eloChangesMap[mid]) eloChangesMap[mid] = {};
        eloChangesMap[mid][String(row.user_id)] = change;
      }
      setEloChangesByMatchId(eloChangesMap);

      // Join requests: creator pending + egne anmodninger (ikke slice af pool-ids)
      const createdMatchIds = (createdRes.data || []).map((m) => m.id);
      const [creatorJoinRows, myJoinRes] = await Promise.all([
        createdMatchIds.length > 0
          ? fetchRowsInChunks(supabase, "match_join_requests", "match_id", createdMatchIds)
          : Promise.resolve([]),
        supabase.from("match_join_requests").select("*").eq("user_id", uid),
      ]);
      if (myJoinRes.error) throw myJoinRes.error;
      const jrMap = {};
      for (const jr of [...creatorJoinRows, ...(myJoinRes.data || [])]) {
        const mid = String(jr.match_id);
        if (!jrMap[mid]) jrMap[mid] = [];
        if (!jrMap[mid].some((row) => row.id === jr.id)) {
          jrMap[mid].push(jr);
        }
      }
      if (isStale()) return;
      setJoinRequests(jrMap);
    } catch (e) {
      if (isStale()) return;
      console.error(e);
      setLoadError("Kunne ikke hente kampe lige nu.");
      showToast('Kunne ikke hente data. Tjek din forbindelse og prøv igen.');
    } finally {
      if (reqId === loadDataReqIdRef.current) {
        setLoadingMatches(false);
        hasMatchListRef.current = true;
      }
    }
  }, [user.id, showToast]);

  useEffect(() => { void loadData(); }, [loadData]);

  /* Hurtig fetch af én kamp til detail-rute (chat "Se kamp", share-link). */
  useEffect(() => {
    if (!tabActive || !detailMatchId) {
      setDetailFetchStatus('idle');
      return undefined;
    }

    let cancelled = false;
    setDetailFetchStatus('loading');

    const hydrateDetailMatch = async () => {
      try {
        const { data: match, error: matchErr } = await supabase
          .from('matches')
          .select('*')
          .eq('id', detailMatchId)
          .maybeSingle();
        if (cancelled) return;
        if (matchErr) throw matchErr;
        if (!match || String(match.status || '').toLowerCase() === 'cancelled') {
          setDetailFetchStatus('missing');
          return;
        }

        setMatches((prev) => {
          if (prev.some((m) => String(m.id) === String(match.id))) return prev;
          return [...prev, match];
        });

        const [{ data: players, error: playersErr }, joinRes] = await Promise.all([
          supabase
            .from('match_players')
            .select(MATCH_PLAYERS_SAFE_SELECT)
            .eq('match_id', match.id),
          supabase
            .from('match_join_requests')
            .select('*')
            .eq('match_id', match.id),
        ]);
        if (cancelled) return;
        if (playersErr) throw playersErr;

        const playerRows = players || [];
        setMatchPlayers((prev) => ({ ...prev, [match.id]: playerRows }));
        if (!joinRes.error) {
          setJoinRequests((prev) => ({ ...prev, [String(match.id)]: joinRes.data || [] }));
        }

        const profileIds = new Set();
        if (match.creator_id) profileIds.add(String(match.creator_id));
        for (const p of playerRows) {
          if (p?.user_id) profileIds.add(String(p.user_id));
        }
        if (profileIds.size > 0) {
          const [histEloMap, pById] = await Promise.all([
            fetchEloByUserIdFromHistory([...profileIds]),
            fetchProfilesByIdMap([...profileIds]),
          ]);
          if (cancelled) return;
          setEloFromHistoryByUserId((prev) => ({ ...prev, ...histEloMap }));
          setEloByUserId((prev) => {
            const next = { ...prev };
            for (const [id, pr] of Object.entries(pById)) next[id] = eloOf(pr);
            return next;
          });
          setProfilesById((prev) => ({ ...prev, ...pById }));
        }

        if (!cancelled) setDetailFetchStatus('ready');
      } catch (e) {
        console.warn('detail match hydrate:', e?.message || e);
        if (!cancelled) setDetailFetchStatus('error');
      }
    };

    void hydrateDetailMatch();
    return () => { cancelled = true; };
  }, [tabActive, detailMatchId, detailHydrateNonce]);

  const refreshJoinRequestsForMatch = useCallback(async (matchId) => {
    const key = String(matchId || "");
    if (!key || !user?.id) return;
    setJoinRequestsLoadingMatchId(key);
    try {
      const { data, error } = await supabase
        .from("match_join_requests")
        .select("*")
        .eq("match_id", key);
      if (error) throw error;
      setJoinRequests((prev) => ({ ...prev, [key]: data || [] }));
    } catch (e) {
      console.warn("refresh join requests:", e?.message || e);
    } finally {
      setJoinRequestsLoadingMatchId((prev) => (prev === key ? null : prev));
    }
  }, [user?.id]);

  refreshJoinRequestsForMatchRef.current = refreshJoinRequestsForMatch;

  /* Hent totalt antal chat-beskeder per kamp brugeren er tilmeldt — kun deltagere
     må se match chat. */
  useEffect(() => {
    const joinedIds = new Set();
    for (const [matchId, players] of Object.entries(matchPlayers || {})) {
      if ((players || []).some((p) => String(p.user_id) === myUidStr)) {
        joinedIds.add(String(matchId));
      }
    }
    const ids = matches
      .map((m) => String(m.id))
      .filter((id) => id && joinedIds.has(id));
    if (ids.length === 0) {
      setMatchChatTotalById({});
      return undefined;
    }
    let cancelled = false;
    void fetchMatchMessageCounts(ids)
      .then((counts) => {
        if (!cancelled) setMatchChatTotalById(counts);
      })
      .catch((err) => {
        console.warn("Kunne ikke hente match-chat counts:", err?.message || err);
      });
    return () => {
      cancelled = true;
    };
  }, [matches, matchPlayers, myUidStr]);

  useEffect(() => {
    if (!showCreate) return;
    setNewMatch((m) => {
      if (m.level_min !== "" || m.level_max !== "") return m;
      const range = defaultMatchLevelEloRange(user);
      return {
        ...m,
        level_min: String(range.min),
        level_max: String(range.max),
      };
    });
  }, [showCreate, user]);

  useEffect(() => {
    mergeKampeSessionPrefs(user.id, { format: kampeFormat, view: viewTab });
  }, [user.id, kampeFormat, viewTab]);

  useEffect(() => {
    if (kampeFormat !== "padel") {
      setMatchChatOpenById({});
    }
  }, [kampeFormat]);

  useEffect(() => {
    setMatchChatOpenById((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const matchId of Object.keys(prev)) {
        if (!prev[matchId]) continue;
        const isParticipant = (matchPlayers[matchId] || []).some((p) => String(p.user_id) === myUidStr);
        if (!isParticipant && !(isAdmin && adminCanAct)) {
          delete next[matchId];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [matchPlayers, myUidStr, isAdmin, adminCanAct]);

  useEffect(() => {
    setMatchChatOpenById({});
  }, [viewTab, kampeScope]);

  const loadDataReqIdRef = useRef(0);
  const kampeMountedRef = useRef(true);
  useEffect(() => () => { kampeMountedRef.current = false; }, []);

  useEffect(() => {
    const closeChatPanels = () => setMatchChatOpenById({});
    const onVisibilityChange = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        closeChatPanels();
      }
    };
    const onBlur = () => closeChatPanels();

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibilityChange);
    }
    if (typeof window !== "undefined") {
      window.addEventListener("blur", onBlur);
    }

    return () => {
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibilityChange);
      }
      if (typeof window !== "undefined") {
        window.removeEventListener("blur", onBlur);
      }
    };
  }, []);

  const loadUnreadMatchChatNotifs = useCallback(async () => {
    if (!user?.id) {
      setMatchChatUnreadById({});
      return;
    }
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, match_id")
        .eq("user_id", user.id)
        .eq("type", "match_chat")
        .eq("read", false)
        .not("match_id", "is", null)
        .limit(500);
      if (error) throw error;
      setMatchChatUnreadById(groupUnreadNotificationsByMatchId(data));
    } catch (e) {
      console.warn("match chat unread notifications:", e?.message || e);
    }
  }, [user?.id]);

  const loadMatchUnreadCounts = useCallback(async () => {
    if (!user?.id) {
      setMatchUnreadById({});
      return;
    }
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, match_id, type")
        .eq("user_id", user.id)
        .eq("read", false)
        .in("type", KAMPE_NON_CHAT_NOTIF_TYPES)
        .not("match_id", "is", null)
        .limit(500);
      if (error) throw error;
      const statusByMatchId = Object.fromEntries(
        matches.map((match) => [String(match.id), (match.status ?? "open").toString().toLowerCase()])
      );
      setMatchUnreadById(groupRelevantUnreadNotificationsByMatchId(data, statusByMatchId));
    } catch (e) {
      console.warn("match unread notifications:", e?.message || e);
    }
  }, [matches, user?.id]);

  useEffect(() => {
    void loadUnreadMatchChatNotifs();
    void loadMatchUnreadCounts();
  }, [loadUnreadMatchChatNotifs, loadMatchUnreadCounts]);

  useEffect(() => {
    if (!user?.id) return undefined;
    const channel = supabase
      .channel("match-notif-badges-" + user.id)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: "user_id=eq." + user.id },
        (payload) => {
          const next = payload?.new || {};
          const prev = payload?.old || {};
          const type = next?.type || prev?.type;
          const refreshTarget = shouldRefreshKampeUnreadForNotificationType(type);
          if (refreshTarget === "chat") {
            void loadUnreadMatchChatNotifs();
          } else if (refreshTarget === "match" || refreshTarget === "entity") {
            void loadMatchUnreadCounts();
          }
          if (type === "match_invite") {
            const matchId = next?.match_id || prev?.match_id;
            if (matchId && refreshJoinRequestsForMatchRef.current) {
              void refreshJoinRequestsForMatchRef.current(matchId);
            }
          }
          if (
            type === "match_join" ||
            type === "match_full" ||
            type === "match_cancelled" ||
            type === "match_invite"
          ) {
            void loadData();
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadData, loadUnreadMatchChatNotifs, loadMatchUnreadCounts, user?.id]);

  /* Live liste: join, godkendelse og status skal ramme Kampe uden manuel genindlæs. */
  const [kampeRealtimeVersion, setKampeRealtimeVersion] = useState(0);
  useEffect(() => {
    if (!user?.id) return undefined;
    let cancelled = false;
    let debounceTimer = null;
    let retryTimer = null;
    const scheduleRefetch = () => {
      if (cancelled) return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (!cancelled && document.visibilityState !== "hidden") void loadData();
      }, 1500);
    };
    const channel = supabase
      .channel(`kampe-list-${user.id}-${kampeRealtimeVersion}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, scheduleRefetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "match_players" }, scheduleRefetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "match_join_requests" }, scheduleRefetch)
      .subscribe((status) => {
        if (cancelled) return;
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          if (retryTimer) clearTimeout(retryTimer);
          retryTimer = setTimeout(() => {
            if (!cancelled) setKampeRealtimeVersion((v) => v + 1);
          }, 1500);
        }
      });
    return () => {
      cancelled = true;
      if (debounceTimer) clearTimeout(debounceTimer);
      if (retryTimer) clearTimeout(retryTimer);
      try { supabase.removeChannel(channel); } catch { /* ignore */ }
    };
  }, [user?.id, loadData, kampeRealtimeVersion]);

  useEffect(() => {
    let lastFetch = 0;
    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastFetch < 30000) return;
      lastFetch = now;
      void loadData();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [loadData]);

  const markMatchChatNotifsRead = useCallback(async (matchId) => {
    const key = String(matchId || "");
    if (!key || !user?.id) return;
    setMatchChatUnreadById((prev) => removeUnreadForMatch(prev, key));
    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user.id)
      .eq("type", "match_chat")
      .eq("match_id", key)
      .eq("read", false);
    if (error) {
      console.warn("mark match chat notifications read:", error.message || error);
      void loadUnreadMatchChatNotifs();
    }
  }, [loadUnreadMatchChatNotifs, user?.id]);

  const markMatchNotifsRead = useCallback(async (matchId) => {
    const key = String(matchId || "");
    if (!key || !user?.id) return;
    if (!matchUnreadByIdRef.current[key]) return;
    setMatchUnreadById((prev) => removeUnreadForMatch(prev, key));
    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user.id)
      .in("type", KAMPE_AUTO_READ_NOTIF_TYPES)
      .eq("match_id", key)
      .eq("read", false);
    if (error) {
      console.warn("mark match notifications read:", error.message || error);
      void loadMatchUnreadCounts();
    } else if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("pm-notifications-sync"));
    }
  }, [loadMatchUnreadCounts, user?.id]);

  const markJoinRequestNotifsRead = useCallback(async (matchId) => {
    const key = String(matchId || "");
    if (!key || !user?.id) return;
    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user.id)
      .eq("type", "match_invite")
      .eq("match_id", key)
      .eq("read", false);
    if (error) {
      console.warn("mark join request notifications read:", error.message || error);
    } else if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("pm-notifications-sync"));
    }
  }, [user?.id]);

  useEffect(() => {
    if (!detailMatchId || !user?.id) return;
    void refreshJoinRequestsForMatch(detailMatchId);
  }, [detailMatchId, refreshJoinRequestsForMatch, user?.id]);

  useEffect(() => {
    if (!detailMatchId) return;
    if (matchUnreadByIdRef.current[String(detailMatchId)]) {
      void markMatchNotifsRead(detailMatchId);
    }
  }, [detailMatchId, markMatchNotifsRead]);

  // Auto-mark match notifs as read when the card has been visible for ~1.2s.
  // Cards below the fold stay unread until the user scrolls them into view,
  // so it doesn't regress to the old "everything cleared on tab visit"
  // behaviour. Tap on the card still works as a manual override.
  useEffect(() => {
    if (typeof window === "undefined" || !("IntersectionObserver" in window)) {
      return undefined;
    }
    const dwellTimers = matchCardDwellTimersRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const matchId = entry.target?.dataset?.matchId;
          if (!matchId) return;
          const visible = entry.isIntersecting && entry.intersectionRatio > 0.4;
          if (visible) {
            if (dwellTimers.has(matchId)) return;
            const timer = window.setTimeout(() => {
              dwellTimers.delete(matchId);
              if (matchUnreadByIdRef.current[matchId]) {
                void markMatchNotifsRead(matchId);
              }
            }, 1200);
            dwellTimers.set(matchId, timer);
          } else {
            const existing = dwellTimers.get(matchId);
            if (existing) {
              clearTimeout(existing);
              dwellTimers.delete(matchId);
            }
          }
        });
      },
      { threshold: [0.4] },
    );
    matchCardObserverRef.current = observer;
    return () => {
      observer.disconnect();
      matchCardObserverRef.current = null;
      dwellTimers.forEach((t) => clearTimeout(t));
      dwellTimers.clear();
    };
  }, [markMatchNotifsRead]);

  const observeMatchCard = useCallback((node) => {
    if (node && matchCardObserverRef.current) {
      matchCardObserverRef.current.observe(node);
    }
  }, []);

  const scrollMatchChatToBottom = useCallback((matchId, behavior = "auto") => {
    const key = String(matchId || "");
    const listEl = matchChatListRefs.current[key];
    if (!listEl) return;
    try {
      listEl.scrollTo({ top: listEl.scrollHeight, behavior });
    } catch {
      listEl.scrollTop = listEl.scrollHeight;
    }
  }, []);

  useEffect(() => {
    const openMatchIds = Object.keys(matchChatOpenById).filter((matchId) => matchChatOpenById[matchId]);
    if (openMatchIds.length === 0) return undefined;

    const unsubscribers = openMatchIds.map((matchId) =>
      subscribeToMatchMessages(matchId, (incoming) => {
        if (!incoming?.id) return;
        let added = false;
        setMatchChatById((prev) => {
          const current = prev[matchId] || [];
          if (current.some((m) => String(m.id) === String(incoming.id))) return prev;
          added = true;
          const next = [...current, incoming];
          return { ...prev, [matchId]: next.slice(-120) };
        });
        if (added) {
          setMatchChatTotalById((prev) => ({
            ...prev,
            [String(matchId)]: (prev[String(matchId)] || 0) + 1,
          }));
        }
        if (matchChatOpenById[matchId]) {
          if (typeof window !== "undefined") {
            window.requestAnimationFrame(() => scrollMatchChatToBottom(matchId, "smooth"));
          } else {
            scrollMatchChatToBottom(matchId);
          }
        }
      })
    );

    return () => {
      unsubscribers.forEach((stop) => {
        try { stop(); } catch { /* ignore */ }
      });
    };
  }, [matchChatOpenById, scrollMatchChatToBottom]);

  useEffect(() => {
    const openMatchIds = Object.keys(matchChatOpenById).filter((matchId) => matchChatOpenById[matchId]);
    if (!openMatchIds.length) return undefined;

    let rafIds = [];
    if (typeof window !== "undefined") {
      rafIds = openMatchIds.map((matchId) => window.requestAnimationFrame(() => scrollMatchChatToBottom(matchId)));
    } else {
      openMatchIds.forEach((matchId) => scrollMatchChatToBottom(matchId));
    }

    return () => {
      if (typeof window !== "undefined") {
        rafIds.forEach((id) => window.cancelAnimationFrame(id));
      }
    };
  }, [matchChatOpenById, matchChatById, matchChatLoadingById, scrollMatchChatToBottom]);

  const persistAmericanoSubTab = useCallback(
    (v) => mergeKampeSessionPrefs(user.id, { americanoView: v }),
    [user.id]
  );

  const createMatch = async () => {
    if (newMatch.court_booked && (!newMatch.court_id || isMatchVenueTbd(newMatch.court_id))) {
      setPadelCreateStep(1);
      setPadelCreateFieldError({ field: 'venue', message: 'Vælg hvilken bane der er booket.' });
      scrollPadelCreateField("venue");
      return;
    }
    if (!newMatch.date) {
      setPadelCreateStep(1);
      setPadelCreateFieldError({ field: 'date', message: 'Angiv en dato.' });
      scrollPadelCreateField("date");
      return;
    }
    const startM = timeToMinutes(newMatch.time);
    if (!Number.isFinite(startM)) {
      setPadelCreateStep(1);
      setPadelCreateFieldError({ field: 'time', message: 'Vælg en gyldig starttid.' });
      scrollPadelCreateField("time");
      return;
    }
    const dur = parseInt(newMatch.duration, 10);
    if (!dur || dur < 60) {
      setPadelCreateStep(1);
      setPadelCreateFieldError({ field: 'duration', message: 'Varighed skal være mindst 1 time.' });
      scrollPadelCreateField("duration");
      return;
    }
    const endM = startM + dur;
    const endH = String(Math.floor(endM / 60) % 24).padStart(2, "0");
    const endMin = String(endM % 60).padStart(2, "0");
    const timeEnd = endH + ":" + endMin;
    setCreating(true);
    try {
      const cid = courtIdFromVenueSelection(newMatch.court_id, createVenueOptions);
      const cname = courtNameFromVenueSelection(newMatch.court_id, createVenueOptions);
      const row = {
        creator_id: user.id, court_id: cid, court_name: cname || '',
        date: newMatch.date, time: fmtClock(newMatch.time), time_end: timeEnd,
        level_range: buildMatchLevelRange(newMatch.level_min, newMatch.level_max, newMatch.court_booked, myElo),
        status: "open", max_players: 4, current_players: 0,
        description: sanitizeText(newMatch.description.trim()) || null,
        match_type: newMatch.match_type || "open",
        price_per_person: (() => {
          if (newMatch.payment_method === "free") return 0;
          const n = parseFloat(String(newMatch.price_per_person).replace(",", "."));
          return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
        })(),
        payment_method: newMatch.payment_method || "mobilepay",
      };
      const { data: created, error } = await supabase.from("matches").insert(row).select().single();
      if (error) throw error;
      try {
        await rpcJoinOpenMatch({
          matchId: created.id,
          team: 1,
          userName: myDisplayName,
          userEmail: authUser?.email || user.email,
          userEmoji: user.avatar || "🎾",
        });
      } catch (joinErr) {
        // Undgå orphan-kamp uden spillere hvis man ikke kan joine som opretter.
        await supabase.from("matches").delete().eq("id", created.id);
        throw joinErr;
      }
      if (row.match_type !== "closed" && row.status === "open") {
        void notifyMatchWatchersForMatch(created.id);
      }
      setShowCreate(false);
      setPadelCreateStep(1);
      setPadelCreateFieldError(null);
      // Opretteren er lige meldt til (join_open_match), men `created` er fra før.
      // Uden dette stod der "Vi mangler 4 spillere" i delingsteksten.
      setCreatedMatchReceipt({ ...created, current_players: Math.max(1, Number(created.current_players) || 0) });
      await loadData();
    } catch (e) { showToast(mapUserFacingError(e), 'error'); }
    finally { setCreating(false); }
  };

  const scrollPadelCreateField = (field) => {
    if (field === 'general') {
      scrollFormFieldIntoView(padelCreateFormRef.current, { block: 'start' });
      return;
    }
    const refMap = {
      venue: padelCreateVenueFieldRef,
      date: padelCreateDateFieldRef,
      time: padelCreateTimeFieldRef,
      duration: padelCreateDurationFieldRef,
    };
    scrollFormFieldIntoView(refMap[field]?.current);
  };

  const validatePadelCreateStep = (step) => {
    if (step === 1) {
      if (venueOptions.length === 0) return { message: "Ingen baner tilgængelige i dit område endnu.", field: "general" };
      if (newMatch.court_booked && (!newMatch.court_id || isMatchVenueTbd(newMatch.court_id))) {
        return { message: "Vælg hvilken bane der er booket.", field: "venue" };
      }
      if (!newMatch.date) return { message: "Angiv en dato.", field: "date" };
      const startM = timeToMinutes(newMatch.time);
      if (!Number.isFinite(startM)) return { message: "Vælg en gyldig starttid.", field: "time" };
      const dur = parseInt(newMatch.duration, 10);
      if (!dur || dur < 60) return { message: "Varighed skal være mindst 1 time.", field: "duration" };
      return null;
    }
    return null;
  };

  const goPadelCreateNext = () => {
    const result = validatePadelCreateStep(padelCreateStep);
    if (result) {
      setPadelCreateFieldError({ field: result.field ?? 'general', message: result.message });
      scrollPadelCreateField(result.field ?? 'general');
      return;
    }
    setPadelCreateFieldError(null);
    setPadelCreateStep((s) => Math.min(2, s + 1));
  };

  const joinMatchWithTeam = async (matchId, teamNum, courtSide = null) => {
    setTeamSelectMatch(null);
    setBusyId(matchId);
    const match = matches.find((m) => String(m.id) === String(matchId));
    if ((match?.match_type || 'open') === 'closed') {
      showToast('Denne kamp kræver godkendelse fra opretteren.');
      setBusyId(null);
      return;
    }
    try {
      const result = await rpcJoinOpenMatch({
        matchId,
        team: teamNum,
        courtSide,
        userName: myDisplayName,
        userEmail: authUser?.email || user.email,
        userEmoji: user.avatar || "🎾",
      });
      if (courtSide && !result?.already_joined && result?.court_side !== courtSide) {
        const { data: sideData, error: sideErr } = await supabase.rpc('set_match_player_court_side', {
          p_match_id: matchId,
          p_user_id: user.id,
          p_side: courtSide,
        });
        if (sideErr) throw sideErr;
        if (!sideData?.success) throw new Error(courtSideErrorMessage(sideData));
      }
      const joinedTeam = result?.team ?? teamNum;
      const isFull = result?.is_full === true;

      /* Underret opretter via RPC (læser creator_id server-side — RLS kan skjule creator for B) */
      if (!result?.already_joined) {
        const fallbackBody = `${myDisplayName} har tilmeldt sig Hold ${joinedTeam} i din kamp.`;
        const { data: joinNotice, error: nErr } = await supabase.rpc("notify_match_creator_on_join", {
          p_match_id: matchId,
          p_title: "Ny spiller tilmeldt!",
          p_body: fallbackBody,
        });
        if (nErr) {
          console.warn("notify_match_creator_on_join:", nErr.message || nErr);
          showToast(
            "Tilmelding gemt, men notifikation fejlede. Kør opdateret create_notification_rpc.sql (notify_match_creator_on_join) i Supabase."
          );
        } else if (match?.creator_id && String(match.creator_id) !== String(user.id)) {
          const push = matchJoinPushContent(joinNotice, fallbackBody);
          if (push) {
            void sendPushNotificationsForUsers([match.creator_id], 'match_join', push.title, push.body, matchId);
          }
        }
      }

      if (isFull) {
        const { data: playerRows } = await supabase
          .from("match_players")
          .select("user_id")
          .eq("match_id", matchId);
        const fullNotifyIds = (playerRows || [])
          .filter((p) => p.user_id !== user.id)
          .map((p) => p.user_id);
        void createNotificationsForUsers(
          fullNotifyIds,
          "match_full",
          "Kampen er fuld! 🎾",
          "Alle 4 pladser er fyldt — kampen er klar til at starte.",
          matchId,
        );
      }

      showToast(
        result?.already_joined
          ? "Du er allerede tilmeldt kampen."
          : `Du er tilmeldt Hold ${joinedTeam}${courtSide ? ` · ${courtSideLabel(courtSide)}` : ''}! ⚔️`
      );
      await loadData();
    } catch (e) { showToast(mapUserFacingError(e), 'error'); }
    finally { setBusyId(null); }
  };

  const patchMatchPlayerTeamLocally = useCallback((matchId, targetUserId, newTeam, courtSide = undefined) => {
    const key = String(matchId);
    setMatchPlayers((prev) => {
      const rows = prev[key];
      if (!rows?.length) return prev;
      return {
        ...prev,
        [key]: rows.map((p) => (
          String(p.user_id) === String(targetUserId)
            ? { ...p, team: newTeam, ...(courtSide ? { court_side: courtSide } : {}) }
            : p
        )),
      };
    });
  }, []);

  const patchMatchPlayerCourtSideLocally = useCallback((matchId, targetUserId, newSide, swappedUserId = null) => {
    const key = String(matchId);
    setMatchPlayers((prev) => {
      const rows = prev[key];
      if (!rows?.length) return prev;
      const target = rows.find((p) => String(p.user_id) === String(targetUserId));
      const previous = target?.court_side;
      return {
        ...prev,
        [key]: rows.map((p) => {
          if (String(p.user_id) === String(targetUserId)) return { ...p, court_side: newSide };
          if (swappedUserId && String(p.user_id) === String(swappedUserId)) {
            return { ...p, court_side: previous === 'left' ? 'right' : previous === 'right' ? 'left' : previous };
          }
          return p;
        }),
      };
    });
  }, []);

  const applyMatchPlayerTeam = useCallback(async (matchId, targetUserId, newTeam) => {
    const { data, error } = await supabase.rpc("set_match_player_team", {
      p_match_id: matchId,
      p_user_id: targetUserId,
      p_team: newTeam,
    });
    if (error) throw error;
    if (!data?.success) {
      throw new Error(teamMoveErrorMessage(data, newTeam));
    }
    return data;
  }, []);

  const applyMatchPlayerCourtSide = useCallback(async (matchId, targetUserId, side) => {
    const { data, error } = await supabase.rpc('set_match_player_court_side', {
      p_match_id: matchId,
      p_user_id: targetUserId,
      p_side: side,
    });
    if (error) throw error;
    if (!data?.success) throw new Error(courtSideErrorMessage(data));
    return data;
  }, []);

  const switchTeam = async (matchId, newTeam, courtSide = null) => {
    const myCurrent = (matchPlayers[String(matchId)] || []).find((p) => String(p.user_id) === String(user.id));
    if (myCurrent && matchPlayerTeam(myCurrent) === Number(newTeam) && !courtSide) return;
    setBusyId(matchId + (courtSide ? '-side' : '-switch'));
    try {
      if (!myCurrent || matchPlayerTeam(myCurrent) !== Number(newTeam)) {
        const data = await applyMatchPlayerTeam(matchId, user.id, newTeam);
        if (!data?.unchanged) {
          patchMatchPlayerTeamLocally(matchId, user.id, newTeam);
        }
      }
      if (courtSide) {
        const sideData = await applyMatchPlayerCourtSide(matchId, user.id, courtSide);
        if (!sideData?.unchanged) {
          patchMatchPlayerCourtSideLocally(matchId, user.id, courtSide, sideData?.swapped_user_id);
        }
        showToast(`Skiftet til Hold ${newTeam} · ${courtSideLabel(courtSide)}`);
      } else {
        showToast(`Skiftet til Hold ${newTeam}! ⚔️`);
      }
      await loadData();
    } catch (e) { showToast(mapUserFacingError(e), 'error'); }
    finally { setBusyId(null); }
  };

  const claimCourtSide = async (matchId, teamNum, side) => {
    const myCurrent = (matchPlayers[String(matchId)] || []).find((p) => String(p.user_id) === String(user.id));
    if (!myCurrent) return;
    if (matchPlayerTeam(myCurrent) !== Number(teamNum)) {
      await switchTeam(matchId, teamNum, side);
      return;
    }
    setBusyId(matchId + '-side');
    try {
      const data = await applyMatchPlayerCourtSide(matchId, user.id, side);
      if (!data?.unchanged) {
        patchMatchPlayerCourtSideLocally(matchId, user.id, side, data?.swapped_user_id);
        showToast(`${courtSideLabel(side)} side`);
      }
      await loadData();
    } catch (e) { showToast(mapUserFacingError(e), 'error'); }
    finally { setBusyId(null); }
  };

  const setPlayerCourtSide = async (matchId, targetUserId, side) => {
    setBusyId(matchId + '-side');
    try {
      const data = await applyMatchPlayerCourtSide(matchId, targetUserId, side);
      if (!data?.unchanged) {
        patchMatchPlayerCourtSideLocally(matchId, targetUserId, side, data?.swapped_user_id);
        showToast('Placering opdateret');
      }
      await loadData();
    } catch (e) { showToast(mapUserFacingError(e), 'error'); }
    finally { setBusyId(null); }
  };

  const switchPlayerTeam = async (matchId, targetUserId, newTeam) => {
    const match = matches.find((m) => String(m.id) === String(matchId));
    const isCreator = match && String(match.creator_id) === String(user.id);
    if (!isCreator && !adminCanAct) return;

    const mp = matchPlayers[String(matchId)] || [];
    const target = mp.find((p) => String(p.user_id) === String(targetUserId));
    if (!target) return;
    if (matchPlayerTeam(target) === Number(newTeam)) return;

    setBusyId(matchId + "-switch-player-" + targetUserId);
    try {
      const data = await applyMatchPlayerTeam(matchId, targetUserId, newTeam);
      if (!data?.unchanged) {
        patchMatchPlayerTeamLocally(matchId, targetUserId, newTeam);
        const name = (target.user_name || "Spiller").split(" ")[0];
        const isSelf = String(targetUserId) === String(user.id);
        showToast(isSelf ? `Skiftet til Hold ${newTeam}! ⚔️` : `${name} er flyttet til Hold ${newTeam}! ⚔️`);
      }
      await loadData();
    } catch (e) {
      showToast(mapUserFacingError(e), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const leaveMatch = async (matchId) => {
    const match = matches.find(m => m.id === matchId);
    if (!match) return;
    const status = getStatus(match);
    if (status === "in_progress" || status === "completed") {
      showToast("Du kan ikke afmelde dig en kamp, der er i gang eller afsluttet.");
      return;
    }

    const isCreator = String(match.creator_id) === String(user.id);
    const soonNotice = (() => {
      if (!match.date || !match.time) return '';
      try {
        const dt = new Date(`${match.date}T${match.time}`);
        const hoursLeft = (dt - Date.now()) / 3_600_000;
        if (hoursLeft > 0 && hoursLeft < 24) return ' Kampen er om under 24 timer.';
      } catch { /* ignore */ }
      return '';
    })();

    const ok = await ask({
      title: isCreator ? 'Slet kampen?' : 'Forlad kampen?',
      description: isCreator
        ? `Du er opretter — kampen overdrages til den næste spiller, eller slettes hvis du er den eneste.${soonNotice}`
        : `Din plads bliver ledig igen, og de andre spillere får besked.${soonNotice}`,
      confirmLabel: isCreator ? 'Slet / forlad' : 'Forlad kampen',
      cancelLabel: isCreator ? 'Fortryd' : 'Bliv i kampen',
      danger: true,
    });
    if (!ok) return;

    setBusyId(matchId);
    try {
      const isCreator = match && String(match.creator_id) === String(user.id);
      const leaveResult = await rpcLeaveMatch(matchId);
      if (!isCreator && match?.creator_id && !leaveResult?.cancelled) {
        const leaveNotifyErr = await createNotification(
          match.creator_id,
          'match_join',
          'Spiller afmeldt ❌',
          `${myDisplayName} er afmeldt kampen.`,
          matchId,
        );
        if (leaveNotifyErr) console.warn('leave notify:', leaveNotifyErr.message || leaveNotifyErr);
      }
      if (leaveResult?.cancelled) {
        showToast("Kampen er slettet (ingen spillere tilbage).");
      } else if (leaveResult?.creator_transferred) {
        showToast("Du er afmeldt. Kampen er givet videre.");
      } else {
        showToast("Du er afmeldt.");
      }
      await loadData();
    } catch (e) { showToast(mapUserFacingError(e), 'error'); }
    finally { setBusyId(null); }
  };

  // ---- Join request functions (for closed matches) ----

  const requestJoin = async (matchId) => {
    setBusyId(matchId + '-req');
    const match = matches.find((m) => String(m.id) === String(matchId));
    const isClosed = (match?.match_type || 'open') === 'closed';
    try {
      const { error } = await supabase.from("match_join_requests").insert({
        match_id: matchId,
        user_id: user.id,
        user_name: myDisplayName,
        user_emoji: user.avatar || "🎾",
        status: "pending",
      });
      if (error) throw error;
      const { error: nErr } = await supabase.rpc("notify_creator_join_request", {
        p_match_id: matchId,
        p_title: isClosed ? "Ny tilmeldingsanmodning 🔒" : "Ny på ventelisten",
        p_body: isClosed
          ? `${myDisplayName} anmoder om at deltage i din lukkede kamp.`
          : `${myDisplayName} vil på ventelisten til din fulde kamp.`,
      });
      if (nErr) console.warn("notify_creator_join_request:", nErr.message || nErr);
      showToast(isClosed ? "Anmodning sendt! Venter på godkendelse 🔒" : "Du er skrevet på ventelisten!");
      await loadData();
    } catch (e) {
      if (e.code === "23505") {
        showToast(isClosed
          ? "Du har allerede anmodet om at deltage i denne kamp."
          : "Du står allerede på ventelisten.");
      } else {
        showToast(mapUserFacingError(e), 'error');
      }
    }
    finally { setBusyId(null); }
  };

  const cancelJoinRequest = async (matchId, requestId) => {
    setBusyId(matchId + '-cancel-req');
    try {
      const { error } = await supabase.from("match_join_requests")
        .delete()
        .eq("id", requestId)
        .eq("user_id", user.id);
      if (error) throw error;
      showToast("Du er fjernet fra ventelisten.");
      await loadData();
    } catch (e) {
      showToast(mapUserFacingError(e), 'error');
    } finally { setBusyId(null); }
  };

  const approveJoinRequest = async (matchId, requestId, reqUserId, reqUserName, reqUserEmoji) => {
    setBusyId(matchId + '-approve-' + requestId);
    try {
      const { data, error } = await supabase.rpc("approve_match_join_request", {
        p_request_id: requestId,
        p_match_id:   matchId,
        p_user_id:    reqUserId,
        p_user_name:  reqUserName,
        p_user_emoji: reqUserEmoji || "🎾",
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Ukendt fejl");

      const teamNum = data.team;
      const approveErr = await createNotification(reqUserId, "match_join", "Anmodning godkendt! 🎾",
        `${myDisplayName} har godkendt din tilmeldingsanmodning. Du er sat på Hold ${teamNum}.`, matchId);
      if (approveErr) console.warn("approve join notify:", approveErr.message || approveErr);

      showToast(`${reqUserName} er godkendt og sat på Hold ${teamNum}!`);
      await markJoinRequestNotifsRead(matchId);
      await loadData();
    } catch (e) { showToast(mapUserFacingError(e), 'error'); }
    finally { setBusyId(null); }
  };

  const rejectJoinRequest = async (matchId, requestId, reqUserId, reqUserName) => {
    setBusyId(matchId + '-reject-' + requestId);
    try {
      const { error } = await supabase.from("match_join_requests")
        .update({ status: "rejected" }).eq("id", requestId);
      if (error) throw error;

      const rejectErr = await createNotification(reqUserId, "match_join", "Anmodning afvist",
        `Din anmodning om at deltage i kampen er desværre ikke godkendt.`, matchId);
      if (rejectErr) console.warn("reject join notify:", rejectErr.message || rejectErr);

      showToast(`Anmodning fra ${reqUserName} afvist.`, 'success');
      await markJoinRequestNotifsRead(matchId);
      await loadData();
    } catch (e) { showToast(mapUserFacingError(e), 'error'); }
    finally { setBusyId(null); }
  };

  // ---- End join request functions ----

  const kickPlayer = async (matchId, targetUserId, targetName = "spilleren") => {
    const label = String(targetName || "spilleren").trim();
    const actor = isAdmin ? "admin" : "kampopretter";
    const ok = await ask({
      title: `Fjern ${label}?`,
      description: `${label} bliver fjernet fra kampen som ${actor}. De vil modtage en notifikation.`,
      confirmLabel: "Ja, fjern",
      cancelLabel: "Fortryd",
      danger: true,
    });
    if (!ok) return;

    setBusyId(matchId + '-kick-' + targetUserId);
    try {
      const result = await rpcKickPlayer(matchId, targetUserId);
      showToast(result?.cancelled ? "Spiller fjernet — kampen er annulleret." : "Spiller fjernet.");
      await loadData();
    } catch (e) { showToast(mapUserFacingError(e), 'error'); }
    finally { setBusyId(null); }
  };

  const startMatch = async (matchId) => {
    const mp = matchPlayers[matchId] || [];
    const t1 = mp.filter(p => matchPlayerTeam(p) === 1).length;
    const t2 = mp.filter(p => matchPlayerTeam(p) === 2).length;
    const isFull = t1 >= 2 && t2 >= 2;

    if (!isFull && !adminCanAct) {
      showToast("Kampen kan kun startes når der er 2 spillere på hvert hold (2 mod 2).");
      return;
    }

    if (!isFull && adminCanAct) {
      const ok = await ask({
        message: "Kampen er ikke fuld endnu. Vil du gennemtvinge start som admin?",
        confirmLabel: "Ja, start nu",
      });
      if (!ok) return;
    } else if (adminCanAct && !matchPlayers[matchId]?.some(p => p.user_id === user.id)) {
      const ok = await ask({
        message: "Vil du starte denne kamp som admin?",
        confirmLabel: "Ja, start",
      });
      if (!ok) return;
    }

    setBusyId(matchId);
    try {
      const { error } = await supabase.from("matches").update({
        status: "in_progress", started_by: user.id, started_at: new Date().toISOString(),
      }).eq("id", matchId);
      if (error) throw error;
      showToast("Kampen er startet! Held og lykke 🎾");
      await loadData();
    } catch (e) { showToast(mapUserFacingError(e), 'error'); }
    finally { setBusyId(null); }
  };

  const deleteMatch = async (matchId) => {
    const match = matches.find(m => m.id === matchId);
    if (!match) return;
    const status = getStatus(match);
    if (status === "completed" && !adminCanAct) {
      showToast("Du kan ikke slette en afsluttet kamp.");
      return;
    }

    const mp = matchPlayers[matchId] || [];
    const others = mp.filter(p => p.user_id !== user.id);

    const ok = await ask({
      title: isAdmin ? 'Slet kamp (admin)?' : 'Slet kampen?',
      description: isAdmin
        ? 'Dette kan ikke fortrydes. Alle spillere fjernes.'
        : others.length > 0
        ? `${others.length} ${others.length === 1 ? 'anden spiller' : 'andre spillere'} bliver også afmeldt. Dette kan ikke fortrydes.`
        : 'Kampen slettes permanent.',
      confirmLabel: 'Ja, slet',
      cancelLabel: 'Fortryd',
      danger: true,
    });
    if (!ok) return;
    setBusyId(matchId);
    try {
      const mpBefore = matchPlayers[matchId] || [];
      const isCreator = String(match.creator_id) === String(user.id);
      const cancelNotifyIds = mpBefore.filter((p) => p.user_id !== user.id).map((p) => p.user_id);
      if (cancelNotifyIds.length) {
        await createNotificationsForUsers(
          cancelNotifyIds,
          "match_cancelled",
          "Kamp aflyst ❌",
          isAdmin ? "En admin har aflyst kampen." : `${myDisplayName} har aflyst kampen.`,
          matchId,
        );
      }
      if (adminCanAct && !isCreator) {
        const { data, error } = await supabase.rpc("admin_delete_match", { p_match_id: matchId });
        if (error) throw error;
        if (!data?.ok) {
          throw new Error(data?.error || "Kunne ikke slette kampen som admin");
        }
      } else if (adminCanAct && isCreator) {
        const { data, error } = await supabase.from("matches").delete().eq("id", matchId).select("id");
        if (error) throw error;
        if (!data?.length) throw new Error("Kampen blev ikke slettet");
      } else {
        await supabase.from("match_players").delete().eq("match_id", matchId);
        const { data, error } = await supabase
          .from("matches")
          .update({ status: "cancelled", current_players: 0 })
          .eq("id", matchId)
          .eq("creator_id", user.id)
          .select("id");
        if (error) throw error;
        if (!data?.length) throw new Error("Kampen blev ikke slettet");
      }

      if (String(detailMatchId) === String(matchId)) close2v2Detail();
      showToast("Kamp slettet.");
      await loadData();
    } catch (e) { showToast(mapUserFacingError(e), 'error'); }
    finally { setBusyId(null); }
  };

  const shareMatch = async (match) => {
    const result = await sharePadelMatch({ match });
    const msg = shareResultToastMessage(result);
    if (msg) showToast(msg);
  };

  const toggleSeekingPlayer = async (match) => {
    // Sluk hvis allerede aktiv
    if (match.seeking_player) {
      setBusyId(match.id + '-seek');
      try {
        await deactivateSeekingPlayer(match.id);
        showToast('Søgning stoppet.');
        await loadData();
      } catch (e) { showToast(mapUserFacingError(e), 'error'); }
      finally { setBusyId(null); }
      return;
    }

    setBusyId(match.id + '-seek');
    try {
      const creatorProfile = profilesById[String(match.creator_id)] || user;
      const playerIds = (matchPlayers[match.id] || []).map(p => p.user_id);

      const { notified, error, matchElo, matchArea } = await activateSeekingPlayer(
        match,
        creatorProfile,
        playerIds,
        { eloByUserId: eloFromHistoryByUserId },
      );

      if (error) {
        showToast(error);
        return;
      }

      if (notified > 0) {
        const eloMin = Math.max(0, (matchElo ?? 1000) - 250);
        const eloMax = (matchElo ?? 1000) + 250;
        const regionBit = matchArea ? ` · ${matchArea}` : '';
        showToast(
          `⚡ ${notified} spillere notificeret (ELO ${eloMin}–${eloMax}${regionBit})`,
        );
      } else {
        const eloMin = Math.max(0, (matchElo ?? 1000) - 250);
        const eloMax = (matchElo ?? 1000) + 250;
        const regionBit = matchArea ? ` i ${matchArea}` : '';
        showToast(
          `Kampen søger spiller (ELO ${eloMin}–${eloMax}${regionBit}) — ingen matchende spillere lige nu.`,
        );
      }
      await loadData();
    } catch (e) { showToast(mapUserFacingError(e), 'error'); }
    finally { setBusyId(null); }
  };

  const canAccessMatchChat = useCallback((matchId, { asAdmin = false } = {}) => {
    const matchKey = String(matchId);
    const isParticipant = (matchPlayers[matchKey] || []).some((p) => String(p.user_id) === myUidStr);
    return isParticipant || asAdmin || adminCanAct;
  }, [matchPlayers, myUidStr, adminCanAct]);

  const loadMatchChat = useCallback(async (matchId, options = {}) => {
    const { showLoading = true, asAdmin = false } = options;
    if (!canAccessMatchChat(matchId, { asAdmin })) return;
    if (showLoading) {
      setMatchChatLoadingById((prev) => ({ ...prev, [matchId]: true }));
    }
    setMatchChatErrorById((prev) => ({ ...prev, [matchId]: "" }));
    try {
      const rows = await fetchMatchMessages(matchId, 100);
      setMatchChatById((prev) => ({ ...prev, [matchId]: rows }));
      /* Synkroniser totalen hvis bulk-tællingen var ude af sync (fx hvis besked
         blev sendt mens kortet ikke var åbent). */
      setMatchChatTotalById((prev) => {
        const fresh = Math.max(rows.length, prev[String(matchId)] || 0);
        if ((prev[String(matchId)] || 0) === fresh) return prev;
        return { ...prev, [String(matchId)]: fresh };
      });
    } catch (e) {
      const msg = e?.message || "Kunne ikke hente kamp-chat.";
      setMatchChatErrorById((prev) => ({ ...prev, [matchId]: msg }));
    } finally {
      if (showLoading) {
        setMatchChatLoadingById((prev) => ({ ...prev, [matchId]: false }));
      }
    }
  }, [canAccessMatchChat]);

  const handleAdminPinUnlocked = useCallback(() => {
    void (async () => {
      setAdminPinGateOpen(false);
      const verified = await refreshAdminPinSession();
      const pendingChatMatchId = adminPinPendingChatMatchIdRef.current;
      const pendingExpandMatchId = adminPinPendingExpandMatchIdRef.current;
      adminPinPendingChatMatchIdRef.current = null;
      adminPinPendingExpandMatchIdRef.current = null;

      if (!verified) return;

      if (pendingExpandMatchId != null) {
        setExpandedAdminActions((prev) => ({ ...prev, [pendingExpandMatchId]: true }));
      }

      if (pendingChatMatchId != null) {
        setMatchChatOpenById((prev) => ({ ...prev, [pendingChatMatchId]: true }));
        void loadMatchChat(pendingChatMatchId, { showLoading: true, asAdmin: true });
      }
    })();
  }, [refreshAdminPinSession, loadMatchChat]);

  const openAdminPinGate = useCallback(({ matchId = null, expandTools = false, openChat = false } = {}) => {
    adminPinPendingChatMatchIdRef.current = openChat ? matchId : null;
    adminPinPendingExpandMatchIdRef.current = expandTools ? matchId : null;
    setAdminPinGateOpen(true);
  }, []);

  const toggleMatchChat = async (matchId) => {
    if (!canAccessMatchChat(matchId)) return;
    const openNow = !!matchChatOpenById[matchId];
    const nextOpen = !openNow;
    setMatchChatOpenById((prev) => ({ ...prev, [matchId]: nextOpen }));
    if (nextOpen) {
      void markMatchChatNotifsRead(matchId);
      const hasCachedRows = Array.isArray(matchChatById[matchId]) && matchChatById[matchId].length > 0;
      await loadMatchChat(matchId, { showLoading: !hasCachedRows });
    }
  };

  useEffect(() => {
    const openMatchIds = Object.keys(matchChatOpenById).filter((matchId) => matchChatOpenById[matchId]);
    if (!openMatchIds.length) return undefined;

    let cancelled = false;
    const refreshOpenChats = () => {
      if (cancelled) return;
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      openMatchIds.forEach((matchId) => {
        void loadMatchChat(matchId, { showLoading: false });
      });
    };

    const onVisibilityChange = () => refreshOpenChats();
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibilityChange);
    }
    if (typeof window !== "undefined") {
      window.addEventListener("focus", refreshOpenChats);
      window.addEventListener("pageshow", refreshOpenChats);
      window.addEventListener("online", refreshOpenChats);
    }

    return () => {
      cancelled = true;
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibilityChange);
      }
      if (typeof window !== "undefined") {
        window.removeEventListener("focus", refreshOpenChats);
        window.removeEventListener("pageshow", refreshOpenChats);
        window.removeEventListener("online", refreshOpenChats);
      }
    };
  }, [loadMatchChat, matchChatOpenById]);

  const notifyMatchChatParticipants = useCallback(async (matchId, messageText) => {
    if (!matchId || !messageText) return;

    const collectRecipientIds = (rows) => {
      const ids = new Set();
      (rows || []).forEach((row) => {
        const uid = row?.user_id;
        if (uid && String(uid) !== String(user.id)) ids.add(uid);
      });
      return [...ids];
    };

    let recipientIds = collectRecipientIds(matchPlayers[matchId] || []);
    if (recipientIds.length === 0) {
      const { data, error } = await supabase
        .from("match_players")
        .select("user_id")
        .eq("match_id", matchId);
      if (!error) {
        recipientIds = collectRecipientIds(data || []);
      } else {
        console.warn("match chat notify recipients:", error.message || error);
        return;
      }
    }
    if (!recipientIds.length) return;

    const preview = messageText.length > 90 ? `${messageText.slice(0, 87)}...` : messageText;
    const title = "Ny besked i kamp-chat 💬";
    const body = `${myDisplayName}: ${preview}`;
    const notifyError = await createNotificationsForUsers(
      recipientIds,
      "match_chat",
      title,
      body,
      matchId,
    );
    if (notifyError) console.warn("match chat notification:", notifyError.message || notifyError);
  }, [matchPlayers, myDisplayName, user.id]);

  const submitMatchChat = async (matchId, canWrite = false) => {
    if (!canWrite) {
      showToast("Kun tilmeldte spillere kan skrive i kamp-chat.");
      return;
    }
    const raw = matchChatDraftById[matchId] || "";
    const content = sanitizeText(raw).trim();
    if (!content) return;

    setMatchChatSendingById((prev) => ({ ...prev, [matchId]: true }));
    setMatchChatErrorById((prev) => ({ ...prev, [matchId]: "" }));
    try {
      const created = await sendMatchMessage({
        matchId,
        senderId: user.id,
        senderName: myDisplayName,
        senderAvatar: user.avatar || "🎾",
        content,
      });
      if (created?.id) {
        let added = false;
        setMatchChatById((prev) => {
          const current = prev[matchId] || [];
          if (current.some((m) => String(m.id) === String(created.id))) return prev;
          added = true;
          return { ...prev, [matchId]: [...current, created].slice(-120) };
        });
        if (added) {
          setMatchChatTotalById((prev) => ({
            ...prev,
            [String(matchId)]: (prev[String(matchId)] || 0) + 1,
          }));
        }
        if (typeof window !== "undefined") {
          window.requestAnimationFrame(() => scrollMatchChatToBottom(matchId, "smooth"));
        } else {
          scrollMatchChatToBottom(matchId);
        }
      }
      void notifyMatchChatParticipants(matchId, content);
      setMatchChatDraftById((prev) => ({ ...prev, [matchId]: "" }));
    } catch (e) {
      const msg = e?.message || "Kunne ikke sende besked.";
      setMatchChatErrorById((prev) => ({ ...prev, [matchId]: msg }));
      showToast(msg);
    } finally {
      setMatchChatSendingById((prev) => ({ ...prev, [matchId]: false }));
    }
  };

  const formatChatClock = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" });
  };

  const addMatchToCalendar = useCallback(async (match) => {
    const windowRef = typeof window !== 'undefined' ? window : null;
    if (!windowRef) return;

    const timing = calendarWindowForMatch(match);
    if (!timing) {
      showToast('Kunne ikke læse kampens dato eller tid.');
      return;
    }

    const roster = matchPlayers[match.id] || [];
    const players = roster
      .map((p) => String(p?.user_name || '').trim())
      .filter(Boolean);
    const locationName = String(match.court_name || 'Padelbane').trim();
    const title = `Padelkamp - ${locationName}`;
    const matchUrl = `${windowRef.location.origin}${buildKampe2v2DetailPath(match.id)}`;
    const descriptionParts = [
      match.description ? `Beskrivelse: ${match.description}` : '',
      players.length ? `Spillere: ${players.join(', ')}` : '',
      `PadelMakker: ${matchUrl}`,
    ].filter(Boolean);
    const description = descriptionParts.join('\n');
    const uid = `match-${match.id}@padelmakker.dk`;
    const ics = buildIcsEvent({
      uid,
      title,
      description,
      location: locationName,
      start: timing.start,
      end: timing.end,
      url: matchUrl,
    });

    const fileName = `padelmakker-kamp-${String(match.id).replace(/[^a-zA-Z0-9_-]/g, '') || 'event'}.ics`;
    const result = await openCalendarInvite({
      ics,
      fileName,
      title,
      start: timing.start,
      end: timing.end,
      location: locationName,
      description,
      uid,
      url: matchUrl,
    });

    if (result === 'opened-ios') {
      showToast('Kalender åbnet. Vælg "Tilføj" for at gemme kampen.');
      return;
    }
    if (result === 'opened') {
      showToast('Kalender åbnet. Bekræft eventen for at gemme den.');
      return;
    }
    if (result === 'download') {
      showToast('Kalenderfil hentet. Åbn filen for at tilføje kampen.');
      return;
    }
    showToast('Kunne ikke åbne kalenderen.', 'error');
  }, [matchPlayers, showToast]);

  const submitResult = async (matchId, result) => {
    setBusyId(matchId);
    try {
      const mp = matchPlayers[matchId] || [];
      const submission = await submitPadelMatchResult({
        supabaseClient: supabase,
        createNotificationFn: createNotification,
        createNotificationsForUsersFn: createNotificationsForUsers,
        matchId,
        players: mp,
        submittedBy: user.id,
        submitterName: myDisplayName,
        result,
        getTeam: matchPlayerTeam,
      });
      if (!submission.ok) {
        return { ok: false, reason: submission.reason || "Resultatet er ikke gyldigt." };
      }
      void loadData();
      return { ok: true };
    } catch (e) {
      return { ok: false, reason: mapUserFacingError(e) };
    } finally {
      setBusyId(null);
    }
  };

  const confirmResult = async (matchId) => {
    setBusyId(matchId);
    try {
      const mr = matchResults[matchId];
      if (!mr) return;
      const mp = matchPlayers[matchId] || [];
      const confirmation = await confirmPadelMatchResult({
        supabaseClient: supabase,
        calculateAndApplyEloFn: calculateAndApplyElo,
        createNotificationFn: createNotification,
        createNotificationsForUsersFn: createNotificationsForUsers,
        matchId,
        result: mr,
        players: mp,
        confirmedBy: user.id,
        isAdmin: adminCanAct,
        showToast,
      });
      if (!confirmation.ok) {
        showToast(confirmation.reason || "Resultatet kunne ikke bekræftes.");
        return;
      }
      if (!confirmation.eloApplied) {
        await loadData();
        return;
      }

      refreshProfile();
      await reloadKampeEloBundle();
      await loadData();
    } catch (e) { showToast(mapUserFacingError(e), 'error'); }
    finally { setBusyId(null); }
  };

  const rejectResult = async (matchId) => {
    setBusyId(matchId);
    try {
      const mr = matchResults[matchId];
      if (!mr) return;
      const rejection = await rejectPadelMatchResult({
        supabaseClient: supabase,
        createNotificationFn: createNotification,
        createNotificationsForUsersFn: createNotificationsForUsers,
        matchId,
        result: mr,
        rejectedBy: user.id,
        rejecterName: myDisplayName,
        onWarn: (e) => console.warn("notify admins on reject:", e?.message || e),
      });
      if (!rejection.ok) {
        showToast(rejection.reason || "Resultatet kunne ikke afvises.");
        return;
      }

      showToast("Resultat afvist. Indrapportér igen.", 'info');
      await loadData();
    } catch (e) { showToast(mapUserFacingError(e), 'error'); }
    finally { setBusyId(null); }
  };

  const getStatus = useCallback((m) => (m.status ?? "open").toString().toLowerCase(), []);
  const isMine = kampeScope === "mine";

  const joinedMatchIds = useMemo(() => {
    const ids = new Set();
    for (const [matchId, players] of Object.entries(matchPlayers || {})) {
      if ((players || []).some((p) => String(p.user_id) === myUidStr)) {
        ids.add(String(matchId));
      }
    }
    return ids;
  }, [matchPlayers, myUidStr]);

  const courtFacilitiesById = useMemo(() => {
    const map = {};
    for (const c of courts) {
      if (c?.id) map[String(c.id)] = Array.isArray(c.facilities) ? c.facilities : [];
    }
    return map;
  }, [courts]);

  const availableFacilities = useMemo(() => {
    const set = new Set();
    for (const c of courts) {
      if (Array.isArray(c?.facilities)) c.facilities.forEach((f) => set.add(String(f)));
    }
    return [...set];
  }, [courts]);

  const { openMatches, activeMatches, completedMatches } = useMemo(() => buildKampeMatchLists({
    matches,
    matchPlayers,
    matchResults,
    joinedMatchIds,
    isMine,
    currentUserId: myUidStr,
    searchQuery,
    listFilter: kampeListFilter,
    profilesById,
    userLevel: myLevel,
    courtFacilitiesById,
    completedSortMs: matchCompletedSortMs,
  }), [isMine, joinedMatchIds, matchPlayers, matchResults, matches, myUidStr, searchQuery, kampeListFilter, profilesById, myLevel, courtFacilitiesById]);

  /* Deep-link: ?create=1 åbner opret-kamp-formularen direkte (fx fra "Opret ny kamp" i makker-invitation). */
  useEffect(() => {
    if (!tabActive) return;
    const params = new URLSearchParams(location.search);
    if (params.get("create") !== "1") return;
    setKampeFormat("padel");
    setShowCreate(true);
    params.delete("create");
    const q = params.toString();
    navigate({ pathname: "/dashboard/kampe", search: q ? `?${q}` : "" }, { replace: true });
  }, [tabActive, location.search, navigate]);

  /* Legacy ?focus= / #pm-match- → nye detail-ruter */
  useEffect(() => {
    if (!tabActive) return;
    const redirectPath = resolveLegacyKampeFocusRedirect(
      location.pathname,
      location.search,
      location.hash,
    );
    if (redirectPath) {
      navigate(redirectPath, { replace: true });
    }
  }, [tabActive, location.pathname, location.search, location.hash, navigate]);

  /* Detail-side: sync kampe-format efter URL */
  useEffect(() => {
    if (!tabActive || !kampeDetailRoute) return;
    if (kampeDetailRoute.kind === "2v2") setKampeFormat(KAMPE_FORMAT_PADEL);
    else if (kampeDetailRoute.kind === "americano") setKampeFormat(KAMPE_FORMAT_AMERICANO);
    else if (kampeDetailRoute.kind === "liga") setKampeFormat(KAMPE_FORMAT_LIGA);
  }, [tabActive, kampeDetailRoute]);

  /* 2v2 detail-route: underfane, join requests og ?chat=1 */
  useEffect(() => {
    if (!tabActive || !detailMatchId) return;

    const params = new URLSearchParams(location.search);
    const openChat = params.get("chat") === "1";

    // Vent på hurtig detail-fetch eller fuld liste — undgå at bounce til listen for tidligt.
    if (detailFetchStatus === 'loading' || (loadingMatches && !matches.length && detailFetchStatus !== 'ready')) {
      return;
    }

    const m = matches.find((x) => String(x.id) === String(detailMatchId));
    if (!m || getStatus(m) === 'cancelled') {
      if (detailFetchStatus === 'error') return;
      if (detailFetchStatus === 'missing' || (!loadingMatches && detailFetchStatus !== 'loading')) {
        if (detailFetchStatus !== 'missing') setDetailFetchStatus('missing');
      }
      return;
    }

    if (detailFetchStatus !== 'ready') setDetailFetchStatus('ready');

    const st = getStatus(m);
    const mp = matchPlayers[m.id] || [];
    const imIn = mp.some((p) => p.user_id === user.id);
    if (st === "in_progress" && imIn) setViewTab("active");
    else if (st === "completed" && imIn) setViewTab("completed");
    else setViewTab("open");

    void refreshJoinRequestsForMatch(detailMatchId);

    if ((openChat && imIn) || (openChat && adminCanAct)) {
      const matchKey = String(detailMatchId);
      setMatchChatOpenById((prev) => ({ ...prev, [matchKey]: true }));
      void loadMatchChat(matchKey, { showLoading: true });
      void markMatchChatNotifsRead(matchKey);
      params.delete("chat");
      navigate(
        { pathname: location.pathname, search: params.toString() ? `?${params}` : "" },
        { replace: true },
      );
    }
  }, [
    tabActive,
    detailMatchId,
    detailFetchStatus,
    loadingMatches,
    matches,
    matchPlayers,
    user.id,
    location.pathname,
    location.search,
    navigate,
    loadMatchChat,
    markMatchChatNotifsRead,
    refreshJoinRequestsForMatch,
    getStatus,
    adminCanAct,
  ]);

  const matchTeamStatsById = useMemo(() => {
    const stats = {};
    const resolvePlayerElo = (player) => {
      const uid = String(player.user_id);
      const fromHist = eloFromHistoryByUserId[uid];
      if (fromHist != null) return fromHist;
      if (uid === myUidStr) return myElo;
      return eloByUserId[uid] ?? 1000;
    };

    for (const [matchId, playersRaw] of Object.entries(matchPlayers || {})) {
      const players = playersRaw || [];
      const { t1, t2 } = splitPlayersByTeam(players);
      const playerEloByUserId = {};
      for (const p of players) {
        playerEloByUserId[String(p.user_id)] = resolvePlayerElo(p);
      }
      const avgElo = (team) => (
        team.length > 0
          ? Math.round(team.reduce((sum, p) => sum + (playerEloByUserId[String(p.user_id)] ?? 1000), 0) / team.length)
          : null
      );
      const toPredictionPlayer = (p) => {
        const uid = String(p.user_id);
        const profile = profilesById[uid];
        return {
          rating: playerEloByUserId[uid] ?? 1000,
          gamesPlayed: profile?.games_played ?? (uid === myUidStr ? user.games_played : 0),
        };
      };
      const winPrediction =
        t1.length === 2 && t2.length === 2
          ? calculate2v2MatchWinPrediction(t1.map(toPredictionPlayer), t2.map(toPredictionPlayer))
          : null;
      stats[String(matchId)] = {
        t1,
        t2,
        t1Avg: avgElo(t1),
        t2Avg: avgElo(t2),
        playerEloByUserId,
        playerEloChangeByUserId: eloChangesByMatchId[String(matchId)] || {},
        winPrediction,
      };
    }
    return stats;
  }, [eloByUserId, eloChangesByMatchId, eloFromHistoryByUserId, matchPlayers, myElo, myUidStr, profilesById, user.games_played]);

  const padelUnreadCounts = useMemo(() => {
    const counts = { open: 0, active: 0, completed: 0, total: 0 };
    if (!matches.length) return counts;
    const matchById = new Map(matches.map((m) => [String(m.id), m]));
    const merged = new Map();
    Object.entries(matchUnreadById).forEach(([id, c]) => {
      merged.set(id, (merged.get(id) || 0) + (Number(c) || 0));
    });
    Object.entries(matchChatUnreadById).forEach(([id, c]) => {
      merged.set(id, (merged.get(id) || 0) + (Number(c) || 0));
    });
    for (const m of matches) {
      if (String(m.creator_id) !== String(user.id)) continue;
      const pending = (joinRequests[String(m.id)] || []).filter((row) => row.status === "pending");
      if (pending.length === 0) continue;
      const id = String(m.id);
      merged.set(id, Math.max(merged.get(id) || 0, pending.length));
    }
    for (const [id, count] of merged) {
      const match = matchById.get(id);
      if (!match) continue;
      const status = getStatus(match);
      let bucket = null;
      if (status === "open" || status === "full") bucket = "open";
      else if (status === "in_progress") bucket = "active";
      else if (status === "completed") bucket = "completed";
      if (!bucket) continue;
      counts[bucket] += count;
      counts.total += count;
    }
    return counts;
  }, [getStatus, matchChatUnreadById, matchUnreadById, matches, joinRequests, user.id]);

  const searchPlaceholder = kampeFormat === "liga"
    ? "Søg liga..."
    : "Søg spiller, bane eller beskrivelse...";
  const courtBookedTabs = [
    { id: "yes", label: "Ja, booket" },
    { id: "no", label: "Nej, ikke endnu" },
  ];
  const matchTypeTabs = [
    { id: "open", label: "🔓 Åben kamp" },
    { id: "closed", label: "🔒 Lukket kamp" },
  ];
  const onScopeChange = (nextScope) => {
    setKampeScope(nextScope);
    mergeKampeSessionPrefs(user.id, { scope: nextScope });
    setSearchQuery("");
  };
  const onListFilterChange = useCallback((nextFilter) => {
    const normalized = normalizeKampeListFilter(nextFilter);
    setKampeListFilter(normalized);
    mergeKampeSessionPrefs(user.id, { listFilter: normalized });
  }, [user.id]);
  const onViewTabChange = (nextView) => {
    setViewTab(nextView);
    mergeKampeSessionPrefs(user.id, { view: nextView });
  };

  const getMatchCardBundle = useCallback((m) => {
    const mp = matchPlayers[m.id] || [];
    const teamStats = matchTeamStatsById[String(m.id)] || {
      t1: [],
      t2: [],
      t1Avg: null,
      t2Avg: null,
      playerEloByUserId: {},
      playerEloChangeByUserId: {},
      winPrediction: null,
    };
    const mr = matchResults[m.id];
    const matchPrefs = parseMatchLevelRange(m.level_range);
    const status = getStatus(m);
    const isInProgress = status === "in_progress";
    const winnerTeam =
      status === "completed" && mr?.confirmed && (mr.match_winner === "team1" || mr.match_winner === "team2")
        ? (mr.match_winner === "team1" ? 1 : 2)
        : null;
    const cardState = buildMatchCardState({
      match: m,
      players: mp,
      teamStats,
      matchResult: mr,
      joined: joinedMatchIds.has(String(m.id)),
      currentUserId: user.id,
      busyId,
      status,
      joinRequests: joinRequests[String(m.id)] || [],
      isAdmin,
      adminCanAct,
      adminActionsOpen: !!expandedAdminActions[m.id],
      chatOpen: !!matchChatOpenById[m.id],
      chatMessages: matchChatById[m.id] || [],
      chatDraft: matchChatDraftById[m.id] || "",
      chatLoading: !!matchChatLoadingById[m.id],
      chatSending: !!matchChatSendingById[m.id],
      chatError: matchChatErrorById[m.id] || "",
      unreadChatCount: joinedMatchIds.has(String(m.id))
        ? (matchChatUnreadById[String(m.id)] || 0)
        : 0,
      totalChatCount: matchChatTotalById[String(m.id)] || 0,
      unreadMatchCount: matchUnreadById[String(m.id)] || 0,
    });
    return { mp, teamStats, mr, matchPrefs, status, isInProgress, winnerTeam, cardState };
  }, [
    matchPlayers,
    matchTeamStatsById,
    matchResults,
    getStatus,
    joinedMatchIds,
    user.id,
    busyId,
    joinRequests,
    isAdmin,
    adminCanAct,
    expandedAdminActions,
    matchChatOpenById,
    matchChatById,
    matchChatDraftById,
    matchChatLoadingById,
    matchChatSendingById,
    matchChatErrorById,
    matchChatUnreadById,
    matchChatTotalById,
    matchUnreadById,
  ]);

  const buildMatchPrimaryAction = useCallback((m, bundle) => {
    const { cardState, mr, status } = bundle;
    const {
      left,
      joined,
      isClosed,
      isCreator,
      isFull,
      isPlayerInMatch,
      myRequest,
      busy,
    } = cardState;

    if (!isClosed && left > 0 && !joined) {
      return {
        label: "Tilmeld mig",
        onClick: () => setTeamSelectMatch(m.id),
        disabled: busy,
      };
    }
    if (isClosed && status === "open" && left > 0 && !joined && !isCreator) {
      if (!myRequest) {
        return {
          label: busyId === m.id + "-req" ? "Sender..." : "Anmod om tilmelding",
          onClick: () => void requestJoin(m.id),
          disabled: busyId === m.id + "-req",
        };
      }
      if (myRequest.status === "approved") {
        // Approve indsætter allerede spilleren — ingen separat "join efter godkendelse".
        return {
          label: "Godkendt — genindlæs",
          onClick: () => void loadData(),
          disabled: busy,
          variant: "secondary",
        };
      }
    }
    if (!isClosed && (status === "open" || status === "full") && isFull && !joined && !isCreator) {
      if (!myRequest) {
        return {
          label: busyId === m.id + "-req" ? "Sender..." : "Skriv på venteliste",
          onClick: () => void requestJoin(m.id),
          disabled: busyId === m.id + "-req",
        };
      }
      if (myRequest.status === "pending") {
        return {
          label: busyId === m.id + "-cancel-req" ? "Fjerner..." : "Forlad venteliste",
          onClick: () => void cancelJoinRequest(m.id, myRequest.id),
          disabled: busyId === m.id + "-cancel-req",
          variant: "secondary",
        };
      }
      if (myRequest.status === "approved") {
        return {
          label: "Godkendt — genindlæs",
          onClick: () => void loadData(),
          disabled: busy,
          variant: "secondary",
        };
      }
    }
    if (isCreator && (status === "open" || status === "full")) {
      return {
        label: isFull ? "Start kamp" : "Venter på spillere",
        onClick: () => void startMatch(m.id),
        disabled: busy || !isFull,
        variant: isFull ? "primary" : "secondary",
      };
    }
    if (status === "in_progress" && isPlayerInMatch && !mr) {
      return {
        label: "Indrapportér resultat",
        onClick: () => setResultMatch(m.id),
        disabled: busy,
      };
    }
    if (mr && !mr.confirmed && isPlayerInMatch) {
      if (canConfirmPadelMatchResult({ result: mr, players: bundle.mp, confirmedBy: user.id, isAdmin: adminCanAct }).ok) {
        return {
          label: "Bekræft resultat",
          onClick: () => setConfirmModalMatchId(m.id),
          disabled: busy,
        };
      }
    }
    return null;
  // Listen er komplet, men denne useCallback memoiserer reelt ikke: requestJoin,
  // cancelJoinRequest og startMatch er almindelige funktioner, der genskabes hver
  // rendering. ESLint foreslaar at pakke dem i useCallback - det ville ikke hjaelpe,
  // for de afhaenger alle af `matches`, som skifter ved hver indlaesning. Til
  // gengaeld ville en overset afhaengighed give praecis den slags forAeldede
  // vaerdier som rettelsen ovenfor (adminCanAct) fjernede. Hoerer til opdelingen
  // af denne fil, ikke til en lap her.
  }, [busyId, cancelJoinRequest, adminCanAct, loadData, requestJoin, startMatch, user.id]);

  const renderJoinRequestsPanel = (m, bundle) => {
    const { isCreator, pendingRequests, isClosed, left } = bundle.cardState;
    const key = String(m.id);
    const loading = joinRequestsLoadingMatchId === key;

    if (!isCreator) return null;

    if (loading && pendingRequests.length === 0) {
      return (
        <div className="pm-kampe-v2-join-requests pm-kampe-v2-join-requests--loading">
          Henter anmodninger…
        </div>
      );
    }

    if (pendingRequests.length === 0) return null;

    const canApproveNow = isClosed || left > 0;

    return (
      <div className="pm-kampe-v2-join-requests">
        <div className="pm-kampe-v2-join-requests-title">
          {isClosed ? `🔒 Tilmeldingsanmodninger (${pendingRequests.length})` : `Venteliste (${pendingRequests.length})`}
        </div>
        {!canApproveNow ? (
          <p className="pm-kampe-v2-join-requests-hint">
            Kampen er fuld — godkend spillere når en plads bliver ledig.
          </p>
        ) : null}
        <div className="pm-kampe-v2-join-requests-list">
          {pendingRequests.map((req) => (
            <div key={req.id} className="pm-kampe-v2-join-request-row">
              <div className="pm-kampe-v2-join-request-user">
                <AvatarCircle
                  avatar={profilesById[String(req.user_id)]?.avatar || req.user_emoji || "🎾"}
                  size={28}
                  emojiSize="13px"
                  style={{ background: theme.accentBg, border: "1px solid " + theme.border, flexShrink: 0 }}
                />
                <span>{req.user_name || "Ukendt"}</span>
              </div>
              <div className="pm-kampe-v2-join-request-actions">
                <button
                  type="button"
                  onClick={() => approveJoinRequest(m.id, req.id, req.user_id, req.user_name, req.user_emoji)}
                  disabled={!canApproveNow || busyId === m.id + "-approve-" + req.id}
                  className="pm-kampe-v2-join-request-btn pm-kampe-v2-join-request-btn--approve"
                  title={!canApproveNow ? "Vent til en plads bliver ledig" : undefined}
                >
                  {busyId === m.id + "-approve-" + req.id ? "..." : "✓ Godkend"}
                </button>
                <button
                  type="button"
                  onClick={() => rejectJoinRequest(m.id, req.id, req.user_id, req.user_name)}
                  disabled={busyId === m.id + "-reject-" + req.id}
                  className="pm-kampe-v2-join-request-btn pm-kampe-v2-join-request-btn--reject"
                >
                  {busyId === m.id + "-reject-" + req.id ? "..." : "✕ Afvis"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const handleRematch = (m) => {
    if (!m) return;
    const prefs = parseMatchLevelRange(m.level_range);
    const booked = !!m.court_id;
    close2v2Detail();
    setKampeFormat('padel');
    setNewMatch((prev) => ({
      ...prev,
      court_id: m.court_id || MATCH_VENUE_TBD,
      court_booked: booked,
      level_min: prefs.min != null ? String(prefs.min) : '',
      level_max: prefs.max != null ? String(prefs.max) : '',
      description: m.court_name ? `Revanche · ${m.court_name}` : 'Revanche',
      match_type: 'open',
    }));
    setShowCreate(true);
  };

  const renderResultErrorControl = (m, bundle) => {
    const mr = bundle.mr;
    const isCreator = bundle.cardState.isCreator;
    const joined = bundle.cardState.joined;
    if (!mr) return null;
    const withinWindow = isWithinResultErrorReportWindow(completionMsFor2v2(m, mr));
    if (isCreator) {
      return (
        <ReportResultErrorButton
          sourceType="match_2v2"
          entityId={m.id}
          completedAtMs={completionMsFor2v2(m, mr)}
          isCreator={isCreator}
          entityLabel={`2v2 · ${formatMatchDateDa(m.date)}${m.court_name ? ` · ${m.court_name}` : ''}`}
        />
      );
    }
    if (joined && withinWindow) {
      return (
        <p style={{ fontSize: 11.5, color: theme.textLight, textAlign: 'center', margin: '4px 0', lineHeight: 1.45 }}>
          Er resultatet forkert? Kontakt opretteren, som kan rette det inden for tidsfristen.
        </p>
      );
    }
    return null;
  };

  const renderDetailManagePanel = (m, bundle) => {
    const { mp, mr, status } = bundle;
    const {
      joined,
      isCreator,
      busy,
      canUseMatchChat,
      canWriteMatchChat,
      needsAdminPinForMatchChat,
      chatOpen,
      chatMessages,
      chatDraft,
      chatLoading,
      chatSending,
      chatError,
      unreadChatCount,
      totalChatCount,
      adminActionsOpen,
      isPlayerInMatch,
    } = bundle.cardState;

    const showShareLink = status === "open" || status === "full" || status === "in_progress";
    const hasSecondaryLinks =
      showShareLink ||
      (joined && status !== "completed") ||
      (isCreator && status === "open" && mp.length === 3);
    const adminCanForceStart = adminCanAct && !isCreator && (status === "open" || status === "full");
    const adminCanForceReport = adminCanAct && !isCreator && !isPlayerInMatch && status === "in_progress" && !mr;
    const adminCanForceConfirm = adminCanAct && !isCreator && !isPlayerInMatch && mr && !mr.confirmed;
    const canDeleteMatch =
      (isCreator || adminCanAct) && status !== "completed" && status !== "in_progress";
    const kickablePlayers =
      (isCreator || adminCanAct) && (status === "open" || status === "full")
        ? mp.filter((p) => String(p.user_id) !== String(user.id))
        : [];
    const canKickPlayers = kickablePlayers.length > 0;
    const needsAdminPinUnlock =
      isAdmin && !adminCanAct && !isCreator && status !== "completed" && status !== "in_progress";
    const needsAdminPinForPage = isAdmin && !adminCanAct && !isPlayerInMatch;
    const showToolsAccordion =
      adminCanForceStart || adminCanForceReport || adminCanForceConfirm || canDeleteMatch || canKickPlayers;
    // Afsluttet kamp: fejlindberetning (samme flow som Americano/liga) og revanche.
    const completedActions = completedMatchActions({
      status,
      resultConfirmed: Boolean(mr?.confirmed),
      joined,
      isCreator,
    });
    const resultErrorControl = completedActions.canReportResultError
      ? renderResultErrorControl(m, bundle)
      : null;
    const canRematch = completedActions.canRematch;
    const showCompletedActions = Boolean(resultErrorControl) || canRematch;
    const hasManage =
      canUseMatchChat || needsAdminPinForPage || hasSecondaryLinks || showToolsAccordion || showCompletedActions;

    if (!hasManage) return null;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {needsAdminPinForPage ? (
          <div className="pm-feedback-panel pm-feedback-panel--warning" style={{ fontSize: "12px", lineHeight: 1.45, padding: "10px 12px" }}>
            <div style={{ fontWeight: 700, marginBottom: "6px" }}>Admin-adgang påkrævet</div>
            <div style={{ marginBottom: "10px", color: theme.textMid }}>
              Du er ikke tilmeldt kampen. Bekræft din admin-kode for at læse chat og bruge admin-værktøjer.
            </div>
            <button
              type="button"
              onClick={() => openAdminPinGate({
                matchId: m.id,
                expandTools: showToolsAccordion || needsAdminPinUnlock,
                openChat: needsAdminPinForMatchChat,
              })}
              style={{ ...btn(true), width: "100%", justifyContent: "center", fontSize: "12px" }}
            >
              Indtast admin-PIN
            </button>
          </div>
        ) : null}
        {showCompletedActions ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {canRematch ? (
              <button
                type="button"
                onClick={() => handleRematch(m)}
                style={{ ...btn(false), width: "100%", justifyContent: "center", fontSize: "13px" }}
              >
                <RotateCcw size={14} /> Spil igen
              </button>
            ) : null}
            {resultErrorControl}
          </div>
        ) : null}
        <MatchDetailActionCard
          canUseMatchChat={canUseMatchChat}
          chatOpen={chatOpen}
          onToggleChat={() => { void toggleMatchChat(m.id); }}
          unreadChatCount={unreadChatCount}
          totalChatCount={totalChatCount}
          chatPanel={chatOpen ? (
            <div className="pm-card-subpanel pm-match-chat-panel" style={{ marginBottom: 0 }}>
              {!canWriteMatchChat && isAdmin ? (
                <div className="pm-match-chat-empty" style={{ marginBottom: "8px" }}>
                  Admin-visning: Kun tilmeldte spillere kan skrive i chatten.
                </div>
              ) : null}
              <div
                className="pm-match-chat-list"
                ref={(node) => {
                  const key = String(m.id);
                  if (node) {
                    matchChatListRefs.current[key] = node;
                  } else {
                    delete matchChatListRefs.current[key];
                  }
                }}
              >
                {chatLoading ? (
                  <div className="pm-match-chat-empty">Henter beskeder...</div>
                ) : null}
                {!chatLoading && chatError ? (
                  <div className="pm-match-chat-empty">{chatError}</div>
                ) : null}
                {!chatLoading && !chatError && chatMessages.length === 0 ? (
                  <div className="pm-match-chat-empty">Ingen beskeder endnu. Skriv den første besked til kampen.</div>
                ) : null}
                {!chatLoading && !chatError && chatMessages.map((msg) => {
                  const mine = String(msg.sender_id) === String(user.id);
                  const displayName = (msg.sender_name || "Spiller").trim();
                  return (
                    <div key={msg.id} className={`pm-match-chat-row ${mine ? "pm-match-chat-row--mine" : ""}`}>
                      <div className={`pm-match-chat-bubble ${mine ? "pm-match-chat-bubble--mine" : ""}`}>
                        <div className="pm-match-chat-meta">
                          <span className="pm-match-chat-author">{mine ? "Dig" : displayName}</span>
                          <span>{formatChatClock(msg.created_at)}</span>
                        </div>
                        <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{msg.content}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="pm-match-chat-composer">
                <input
                  value={chatDraft}
                  onChange={(e) => {
                    const next = e.target.value.slice(0, 1000);
                    setMatchChatDraftById((prev) => ({ ...prev, [m.id]: next }));
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void submitMatchChat(m.id, canWriteMatchChat);
                    }
                  }}
                  placeholder={canWriteMatchChat ? "Skriv til holdet..." : "Kun tilmeldte kan skrive"}
                  className="pm-match-chat-input"
                  maxLength={1000}
                  disabled={!canWriteMatchChat || chatSending}
                />
                <button
                  type="button"
                  onClick={() => { void submitMatchChat(m.id, canWriteMatchChat); }}
                  disabled={!canWriteMatchChat || chatSending || !chatDraft.trim()}
                  style={{
                    ...btn(true),
                    justifyContent: "center",
                    minWidth: "92px",
                    padding: "8px 10px",
                    fontSize: "12px",
                    opacity: chatSending || !chatDraft.trim() ? 0.7 : 1,
                  }}
                >
                  <SendHorizontal size={13} />
                  {chatSending ? "Sender..." : "Send"}
                </button>
              </div>
            </div>
          ) : null}
          joined={joined}
          status={status}
          showShare={showShareLink}
          onShare={() => void shareMatch(m)}
          onAddToCalendar={() => addMatchToCalendar(m)}
          showLeave={joined && (status === "open" || status === "full")}
          onLeave={() => leaveMatch(m.id)}
          leaveLabel={isCreator ? "Forlad / overdrag" : "Afmeld mig"}
          leaveBusy={busy}
          extraAction={isCreator && status === "open" && mp.length === 3 ? (
            <button
              type="button"
              className="pm-kd-action-extra"
              onClick={() => toggleSeekingPlayer(m)}
              disabled={busyId === m.id + "-seek"}
            >
              <Zap size={12} />
              {busyId === m.id + "-seek" ? "Sender..." : m.seeking_player ? "Stop råb" : "Råb op for spiller"}
            </button>
          ) : null}
        />

        {showToolsAccordion ? (
          <div style={{ background: theme.warmBg, border: "1px solid " + theme.warm + "55", borderRadius: "10px", overflow: "hidden" }}>
            <button
              type="button"
              onClick={() => setExpandedAdminActions((prev) => ({ ...prev, [m.id]: !prev[m.id] }))}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "transparent",
                border: "none",
                padding: "9px 14px",
                fontSize: "12px",
                fontWeight: 700,
                color: theme.warm,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              <span>🛠 {isAdmin && !isCreator ? "Admin-værktøjer" : isAdmin ? "Admin / creator-værktøjer" : "Creator-værktøjer"}</span>
              {adminActionsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {adminActionsOpen ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "10px 12px 12px", borderTop: "1px solid " + theme.warm + "33" }}>
                {canKickPlayers ? (
                  <div className="pm-kampe-v2-kick-players">
                    <div style={{ fontSize: "12px", fontWeight: 700, color: theme.textMid, marginBottom: "8px" }}>
                      Fjern spiller fra kampen
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      {kickablePlayers.map((p) => {
                        const kickingBusy = busyId === m.id + "-kick-" + p.user_id;
                        const label = (p.user_name || "Ukendt").split(" ")[0];
                        return (
                          <button
                            key={p.user_id}
                            type="button"
                            onClick={() => { void kickPlayer(m.id, p.user_id, p.user_name); }}
                            disabled={kickingBusy}
                            style={{
                              ...btn(false),
                              width: "100%",
                              justifyContent: "center",
                              fontSize: "13px",
                              color: theme.red,
                              borderColor: theme.red + "55",
                            }}
                          >
                            <UserMinus size={14} />
                            {kickingBusy ? "Fjerner..." : `Smid ${label} ud`}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
                {adminCanForceStart ? (
                  <button
                    type="button"
                    onClick={() => startMatch(m.id)}
                    disabled={busy}
                    style={{ ...btn(true), width: "100%", justifyContent: "center", fontSize: "13px", background: theme.warm, borderColor: theme.warm }}
                  >
                    ⚡ Gennemtving start (Admin)
                  </button>
                ) : null}
                {adminCanForceReport ? (
                  <button
                    type="button"
                    onClick={() => setResultMatch(m.id)}
                    disabled={busy}
                    style={{ ...btn(true), width: "100%", justifyContent: "center", fontSize: "13px", background: theme.warm, borderColor: theme.warm }}
                  >
                    Indrapportér resultat (Admin)
                  </button>
                ) : null}
                {adminCanForceConfirm ? (
                  <div style={{ display: "flex", gap: "8px" }}>
                    {canConfirmPadelMatchResult({ result: mr, players: mp, confirmedBy: user.id, isAdmin: adminCanAct }).ok ? (
                      <button
                        type="button"
                        onClick={() => confirmResult(m.id)}
                        disabled={busy}
                        style={{ ...btn(true), flex: 1, justifyContent: "center", fontSize: "13px", background: theme.warm, borderColor: theme.warm }}
                      >
                        Bekræft (Admin)
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => rejectResult(m.id)}
                      disabled={busy}
                      style={{ ...btn(false), flex: 1, justifyContent: "center", fontSize: "13px", color: theme.warm, borderColor: theme.warm + "55" }}
                    >
                      Slet (Admin)
                    </button>
                  </div>
                ) : null}
                {canDeleteMatch ? (
                  <button
                    type="button"
                    onClick={() => deleteMatch(m.id)}
                    disabled={busy}
                    style={{ ...btn(false), width: "100%", justifyContent: "center", fontSize: "13px", color: theme.red, borderColor: theme.red + "55" }}
                  >
                    <Trash2 size={14} /> {isAdmin && adminCanAct && !isCreator ? "Slet kamp (Admin)" : "Slet kamp"}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  };

  const renderPadelListItem = useCallback((m) => {
    const bundle = getMatchCardBundle(m);
    const { cardState, matchPrefs, status, mr, winnerTeam } = bundle;
    const myEloChange =
      status === 'completed' && mr?.confirmed && cardState.joined
        ? eloChangesByMatchId[String(m.id)]?.[myUidStr] ?? null
        : null;
    const matchKey = String(m.id);
    return (
      <div
        key={m.id}
        ref={observeMatchCard}
        data-match-id={m.id}
        className={cardState.attentionCount ? 'pm-kampe-v2-list-item--attention' : undefined}
      >
        <KampeMatchListCard
          match={m}
          teamStats={bundle.teamStats}
          profilesById={profilesById}
          matchPrefs={matchPrefs}
          status={status}
          left={cardState.left}
          isFull={cardState.isFull}
          isClosed={cardState.isClosed}
          joined={cardState.joined}
          myRequest={cardState.myRequest}
          myEloChange={myEloChange}
          unreadCount={cardState.attentionCount}
          matchResult={mr}
          winnerTeam={winnerTeam}
          myTeam={cardState.myTeam}
          currentUserId={myUidStr}
          primaryAction={buildMatchPrimaryAction(m, bundle)}
          attentionReason={cardState.attentionReason}
          statusNote={cardState.statusNote}
          onClick={() => {
            if (matchUnreadByIdRef.current[matchKey]) {
              void markMatchNotifsRead(m.id);
            }
            open2v2Detail(m.id);
          }}
        />
      </div>
    );
  }, [
    eloChangesByMatchId,
    getMatchCardBundle,
    buildMatchPrimaryAction,
    markMatchNotifsRead,
    myUidStr,
    observeMatchCard,
    open2v2Detail,
    profilesById,
  ]);

  const toolbarFormatTabs = [
    {
      id: "padel",
      label: "2v2-kampe",
      count: openMatches.length + activeMatches.length,
      unread: padelUnreadCounts.total,
    },
    { id: "americano", label: "Americano/Mexicano" },
    { id: "liga", label: "Liga" },
  ];
  const padelSubTabs = [
    { id: "open", label: <>Åbne<span className="pm-tab-count">{openMatches.length}</span></> },
    { id: "active", label: <>I gang<span className="pm-tab-count">{activeMatches.length}</span></> },
    { id: "completed", label: <>Spillede<span className="pm-tab-count">{completedMatches.length}</span></> },
  ];
  const currentPadelMatches =
    viewTab === "open" ? openMatches : viewTab === "active" ? activeMatches : completedMatches;
  const filterActive =
    kampeScope === "mine"
    || kampeListFilterIsActive(kampeListFilter)
    || (kampeFormat === "padel" && isProfileMatchFeedVisible(user));
  const activeFilterChips = useMemo(() => {
    const chips = [];
    if (kampeListFilter.regionId) {
      chips.push({
        id: "region",
        label: `${getKampeListRegionLabel(kampeListFilter.regionId)} ×`,
        onClick: () => onListFilterChange({ ...kampeListFilter, regionId: "" }),
      });
    }
    if (kampeListFilter.eloBandId && kampeFormat === "padel") {
      chips.push({
        id: "elo",
        label: `Niveau ${getKampeListLevelBandLabel(kampeListFilter.eloBandId, myLevel)} ×`,
        onClick: () => onListFilterChange({ ...kampeListFilter, eloBandId: "" }),
      });
    }
    if (kampeFormat === "padel" && Array.isArray(kampeListFilter.facilities)) {
      kampeListFilter.facilities.forEach((key) => {
        chips.push({
          id: `fac-${key}`,
          label: `${facilityLabel(key)} ×`,
          onClick: () => onListFilterChange({
            ...kampeListFilter,
            facilities: kampeListFilter.facilities.filter((f) => f !== key),
          }),
        });
      });
    }
    if (kampeFormat === "padel" && isProfileMatchFeedVisible(user)) {
      chips.push({
        id: "seeking",
        label: "Søger kamp ×",
        tone: "accent",
        onClick: () => setFilterSheetOpen(true),
      });
    }
    return chips;
  }, [kampeFormat, user, kampeListFilter, myLevel, onListFilterChange]);
  const showCreatePanel =
    (kampeFormat === "padel" && showCreate) ||
    (kampeFormat === "americano" && showAmericanoCreate) ||
    (kampeFormat === "liga" && showLigaCreate);

  useEffect(() => {
    onCreatePanelChange?.(showCreatePanel);
    return () => onCreatePanelChange?.(false);
  }, [showCreatePanel, onCreatePanelChange]);

  const canCreateInFormat =
    kampeFormat === "padel"
    || kampeFormat === "americano"
    || (kampeFormat === "liga" && isAdmin);
  // Maa IKKE afhaenge af loadingMatches: knappen forsvandt helt under
  // indlaesningen og poppede ind bagefter. At oprette en kamp kraever ikke at
  // listen er hentet - guiden er uafhaengig af den.
  const handleToolbarCreate = !showCreatePanel && canCreateInFormat
    ? () => {
        if (kampeFormat === "padel") setShowCreate(true);
        else if (kampeFormat === "americano") setShowAmericanoCreate(true);
        else if (kampeFormat === "liga") setShowLigaCreate(true);
      }
    : undefined;
  const toolbarCreateLabel =
    kampeFormat === "padel"
      ? "Opret kamp"
      : kampeFormat === "americano"
        ? "Opret Americano/Mexicano"
        : "Opret liga";
  const createHeaderTitle = toolbarCreateLabel;
  const handleCreateBack = () => {
    if (kampeFormat === "padel") setShowCreate(false);
    else if (kampeFormat === "americano") setShowAmericanoCreate(false);
    else if (kampeFormat === "liga") setShowLigaCreate(false);
  };
  const createHeaderInfo =
    kampeFormat === "padel"
      ? () => showToast("Opret en 2v2-kamp i 3 trin: bane & tid, pris & kamptype, bekræft.")
      : kampeFormat === "americano"
        ? () => showToast("Americano/Mexicano: alle spiller med skiftende makkere. Vælg format, antal spillere og baner.")
        : () => showToast("Opret en liga med divisioner, kampsystem og point. Hold kan tilmelde sig efter oprettelse.");
  const detailMatch = detailMatchId
    ? ([...openMatches, ...activeMatches, ...completedMatches].find((m) => String(m.id) === String(detailMatchId))
        // Fald tilbage til matches-listen for deeplink (?focus=), men aldrig aflyste kampe.
        || matches.find((m) => {
          if (String(m.id) !== String(detailMatchId)) return false;
          return getStatus(m) !== "cancelled";
        }))
    : null;
  const detailBundle = detailMatch ? getMatchCardBundle(detailMatch) : null;

  return (
    <div>
      {showCreatePanel ? (
        <KampeCreateHeader
          title={createHeaderTitle}
          onBack={handleCreateBack}
          onInfo={createHeaderInfo}
        />
      ) : !isOnKampeDetailPage ? (
        <>
          <KampeRedesignToolbar
            formatTabs={toolbarFormatTabs}
            format={kampeFormat}
            onFormatChange={(nextFormat) => {
              setKampeFormat(nextFormat);
              setPadelHelpOpen(false);
              setShowCreate(false);
              setShowAmericanoCreate(false);
              setShowLigaCreate(false);
              setFilterSheetOpen(false);
              if (isOnKampeDetailPage) navigate(buildKampeListPath(nextFormat));
            }}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder={searchPlaceholder}
            onFilterOpen={() => setFilterSheetOpen(true)}
            filterActive={filterActive}
            onCreate={handleToolbarCreate}
            createLabel={toolbarCreateLabel}
          />

          <KampeActiveFilterChips chips={activeFilterChips} />

          {kampeFormat === 'padel' && (
            <>
              {/* Samme "Jeg vil spille" som på Hjem: dag + tidsrum → en åben kamp, og spillere på samme niveau får besked. */}
              <PlayIntentPanel
                user={user}
                showToast={showToast}
                onMatchCreated={() => void loadData()}
                style={{ margin: '0 0 12px' }}
              />
              <ActiveSeekingPanel
                variant="compact"
                channel="kamp"
                user={user}
                showToast={showToast}
                filterReturnTo={FILTER_RETURN_KAMPE}
              />
            </>
          )}
        </>
      ) : null}

      <KampeFilterSheet
        open={filterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        scope={kampeScope}
        onScopeChange={onScopeChange}
        listFilter={kampeListFilter}
        onListFilterChange={onListFilterChange}
        myLevel={myLevel}
        format={kampeFormat}
        resultCount={
          kampeFormat === "padel"
            ? currentPadelMatches.length
            : kampeFormat === "americano"
              ? americanoFilteredCount
              : ligaFilteredCount
        }
        showRegionFilter
        showEloFilter={kampeFormat === "padel"}
        facilityOptions={availableFacilities}
      />

      {detailMatchId && !detailMatch ? (
        detailFetchStatus === 'missing' ? (
          <div className="pm-state-card pm-state-card--error" style={{ marginBottom: "14px" }}>
            <div className="pm-state-icon">⚠️</div>
            <div className="pm-state-title">Kampen blev ikke fundet</div>
            <div className="pm-state-copy">Den kan være aflyst, eller du har ikke adgang til den længere.</div>
            <div className="pm-state-actions">
              <button type="button" onClick={close2v2DetailToOrigin} style={{ ...btn(true), fontSize: "13px" }}>
                Tilbage
              </button>
            </div>
          </div>
        ) : detailFetchStatus === 'error' ? (
          <div className="pm-state-card pm-state-card--error" style={{ marginBottom: "14px" }}>
            <div className="pm-state-icon">⚠️</div>
            <div className="pm-state-title">Kampen kunne ikke indlæses</div>
            <div className="pm-state-copy">Tjek din forbindelse og prøv igen.</div>
            <div className="pm-state-actions" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button type="button" onClick={() => setDetailHydrateNonce((n) => n + 1)} style={{ ...btn(true), fontSize: "13px" }}>
                Prøv igen
              </button>
              <button type="button" onClick={close2v2DetailToOrigin} style={{ ...btn(false), fontSize: "13px" }}>
                Tilbage
              </button>
            </div>
          </div>
        ) : (
          <div className="pm-state-card pm-state-card--loading" style={{ marginBottom: "14px" }}>
            <div className="pm-spinner pm-state-spinner" />
            <div className="pm-state-title">Indlæser kamp…</div>
          </div>
        )
      ) : null}

      {detailMatch && detailBundle ? (
        <KampeMatchDetailSheet
          open
          onClose={close2v2DetailToOrigin}
          presentation="page"
          match={detailMatch}
          profilesById={profilesById}
          matchPrefs={detailBundle.matchPrefs}
          statusLabel={detailBundle.cardState.statusLabel}
          status={detailBundle.status}
          isClosed={detailBundle.cardState.isClosed}
          left={detailBundle.cardState.left}
          isFull={detailBundle.cardState.isFull}
          teamStats={detailBundle.teamStats}
          winnerTeam={detailBundle.winnerTeam}
          matchResult={detailBundle.mr}
          myEloChange={
            detailBundle.mr?.confirmed && detailBundle.cardState.joined
              ? eloChangesByMatchId[String(detailMatch.id)]?.[myUidStr] ?? null
              : null
          }
          myTeam={detailBundle.cardState.myTeam}
          description={detailMatch.description}
          primaryAction={buildMatchPrimaryAction(detailMatch, detailBundle)}
          joinRequestsPanel={renderJoinRequestsPanel(detailMatch, detailBundle)}
          unreadCount={detailBundle.cardState.attentionCount}
          joined={detailBundle.cardState.joined}
          matchId={detailMatch.id}
          busyId={busyId}
          isCreator={detailBundle.cardState.isCreator}
          isAdmin={adminCanAct}
          currentUserId={user.id}
          onSwitchTeam={switchTeam}
          onSwitchPlayerTeam={switchPlayerTeam}
          onClaimCourtSide={claimCourtSide}
          onSetCourtSide={setPlayerCourtSide}
          onKickPlayer={kickPlayer}
          onProfileClick={(prof) => setViewPlayer(prof)}
          managePanel={renderDetailManagePanel(detailMatch, detailBundle)}
        />
      ) : null}

      {kampeFormat === "liga" && (
        <Suspense
          fallback={
            <div className="pm-state-card pm-state-card--loading" style={{ marginBottom: "14px" }}>
              <div className="pm-spinner pm-state-spinner" />
              <div className="pm-state-title">Indlæser liga…</div>
            </div>
          }
        >
          <LigaTabLazyEmbed
            user={user}
            showToast={showToast}
            createOpen={showLigaCreate}
            onCreateOpenChange={setShowLigaCreate}
            embedInKampe
            tabActive={tabActive && kampeFormat === "liga"}
            scope={kampeScope}
            onScopeChange={onScopeChange}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            listRegionFilter={kampeListFilter.regionId}
            onFilteredCountChange={setLigaFilteredCount}
          />
        </Suspense>
      )}

      {kampeFormat === "liga" ? null : (
      <>
      {kampeFormat === "padel" && loadingMatches && matches.length === 0 && !detailMatchId && !showCreate && (
        <div className="pm-state-card pm-state-card--loading" style={{ marginBottom: "14px" }}>
          <div className="pm-spinner pm-state-spinner" />
          <div className="pm-state-title">Indlæser kampe…</div>
          <div className="pm-state-copy">Vi henter de nyeste 2v2-kampe.</div>
        </div>
      )}

      {kampeFormat === "padel" && !loadingMatches && loadError && (
        <div className="pm-state-card pm-state-card--error" style={{ marginBottom: "14px" }}>
          <div className="pm-state-icon">⚠️</div>
          <div className="pm-state-title">Kunne ikke hente kampe</div>
          <div className="pm-state-copy">{loadError}</div>
          <div className="pm-state-actions">
            <button type="button" onClick={() => void loadData()} style={{ ...btn(true), fontSize: "13px" }}>
              Prøv igen
            </button>
          </div>
        </div>
      )}

      {kampeFormat === "americano" && (
        <Suspense fallback={
          <div className="pm-state-card pm-state-card--loading">
            <div className="pm-spinner pm-state-spinner" />
            <div className="pm-state-title">Indlæser Americano/Mexicano…</div>
            <div className="pm-state-copy">Vi henter Americano/Mexicano og deltagere.</div>
          </div>
        }>
        <AmericanoTab
          profile={user}
          showToast={showToast}
          embedInKampe
          tabActive={tabActive && kampeFormat === "americano"}
          createOpen={showAmericanoCreate}
          onCreateOpenChange={setShowAmericanoCreate}
            scope={kampeScope}
            onScopeChange={onScopeChange}
            searchQuery={searchQuery}
            listRegionFilter={kampeListFilter.regionId}
            onFilteredCountChange={setAmericanoFilteredCount}
          initialSubTab={(() => {
            const s = readKampeSessionPrefs(user.id);
            if (s?.americanoView === "open" || s?.americanoView === "playing" || s?.americanoView === "completed") {
              return s.americanoView;
            }
            return undefined;
          })()}
          onAmericanoSubTabChange={persistAmericanoSubTab}
        />
        </Suspense>
      )}

      {kampeFormat === "padel" && !detailMatchId && !loadError && (!loadingMatches || matches.length > 0 || showCreate) && (
      <>
      {showCreate ? (
        <CreateMatchForm
          newMatch={newMatch}
          setNewMatch={setNewMatch}
          creating={creating}
          createMatch={createMatch}
          venueOptions={venueOptions}
          createVenueOptions={createVenueOptions}
          courtBookedTabs={courtBookedTabs}
          matchTypeTabs={matchTypeTabs}
          defaultLevelElo={defaultMatchLevelEloRange(user)}
          padelCreateStep={padelCreateStep}
          setPadelCreateStep={setPadelCreateStep}
          goPadelCreateNext={goPadelCreateNext}
          padelCreateFieldError={padelCreateFieldError}
          setPadelCreateFieldError={setPadelCreateFieldError}
          setShowCreate={setShowCreate}
          padelCreateFormRef={padelCreateFormRef}
          padelCreateDateFieldRef={padelCreateDateFieldRef}
          padelCreateTimeFieldRef={padelCreateTimeFieldRef}
          padelCreateVenueFieldRef={padelCreateVenueFieldRef}
          padelCreateDurationFieldRef={padelCreateDurationFieldRef}
        />
      ) : (
        <>
          <PillTabs
            tabs={padelSubTabs}
            value={viewTab}
            onChange={onViewTabChange}
            ariaLabel="2v2 kampstatus"
            style={{ marginBottom: 16 }}
          />

          <div className="pm-kampe-v2-list">
            {viewTab === "open" && openMatches.map((m) => renderPadelListItem(m))}
            {viewTab === "active" && activeMatches.map((m) => renderPadelListItem(m))}
            {viewTab === "completed" && completedMatches.slice(0, completedLimit).map((m) => renderPadelListItem(m))}
            {viewTab === "completed" && completedMatches.length > completedLimit && (
              <button
                onClick={() => setCompletedLimit(n => n + 5)}
                style={{ ...btn(false), width: "100%", justifyContent: "center", fontSize: "13px", color: theme.textMid }}
              >
                Indlæs flere ({completedMatches.length - completedLimit} tilbage)
              </button>
            )}

            {viewTab === "open" && openMatches.length === 0 && (
              <div className="pm-state-card pm-state-card--empty" style={{ padding: '40px 24px 32px' }}>
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--pm-accent-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px', color: 'var(--pm-accent)' }}>
                  <svg style={{ width: 32, height: 32 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 3a14 14 0 0 0 0 18M3.5 9h17M3.5 15h17"/></svg>
                </div>
                <div className="pm-state-title" style={{ fontSize: '16px', marginBottom: '8px' }}>Ingen åbne kampe i dit område</div>
                <div className="pm-state-copy" style={{ marginBottom: '20px', maxWidth: 280, margin: '0 auto 20px' }}>
                  Opret den første kamp i dit område — og del linket i Messenger, når du mangler spillere.
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '0 8px' }}>
                  <button type="button" onClick={() => setShowCreate(true)} style={{ ...btn(true), justifyContent: 'center', fontSize: '14px', padding: '12px' }}>
                    Opret den første kamp
                  </button>
                  <button type="button" onClick={() => setFilterSheetOpen(true)} style={{ ...btn(false), justifyContent: 'center', fontSize: '14px', padding: '12px', color: 'var(--pm-accent)', borderColor: 'var(--pm-border)' }}>
                    Justér filtre
                  </button>
                </div>
              </div>
            )}
            {viewTab === "active" && activeMatches.length === 0 && (
              <div className="pm-state-card pm-state-card--empty">
                <EmptyStateIcon icon={Users} />
                <div className="pm-state-title">Ingen aktive kampe</div>
                <div className="pm-state-copy">Tilmeld dig en åben kamp for at komme i gang.</div>
                <button
                  type="button"
                  onClick={() => onViewTabChange("open")}
                  style={{ ...btn(true), justifyContent: "center", fontSize: "14px", padding: "12px 20px", marginTop: 14 }}
                >
                  Se åbne kampe
                </button>
              </div>
            )}
            {viewTab === "completed" && completedMatches.length === 0 && (
              <div className="pm-state-card pm-state-card--empty">
                <EmptyStateIcon icon={BarChart3} />
                <div className="pm-state-title">Ingen afsluttede kampe endnu</div>
                <div className="pm-state-copy">Spil din første kamp og se dit resultat her.</div>
                <button
                  type="button"
                  onClick={() => onViewTabChange("open")}
                  style={{ ...btn(true), justifyContent: "center", fontSize: "14px", padding: "12px 20px", marginTop: 14 }}
                >
                  Se åbne kampe
                </button>
              </div>
            )}
          </div>

          {/* Forklaringen står under listen, så kampene kommer først. */}
          <div className="pm-help-box" style={{ marginTop: 16 }}>
            <button
              className="pm-hit-44"
              type="button"
              onClick={() => setPadelHelpOpen((v) => !v)}
              aria-expanded={padelHelpOpen}
              style={{
                width: "100%",
                border: "none",
                background: "transparent",
                padding: 0,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                textAlign: "left",
              }}
            >
              <span className="pm-help-box-title">Sådan fungerer 2v2-kampe</span>
              <span className="pm-help-box-chevron">
                {padelHelpOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </span>
            </button>
            {padelHelpOpen ? (
              <div className="pm-help-box-content" style={{ marginTop: 8 }}>
                {PADEL_RULE_SUMMARY.map((item) => (
                  <div key={item.icon} className="pm-help-box-item">
                    <span style={{ flexShrink: 0 }}>{item.icon}</span>
                    <span>{item.text}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </>
      )}

      </>
      )}
      </>
      )}

      {/* Modals uden for liste/detail-gate — skal kunne åbne fra kampdetalje-siden */}
      {teamSelectMatch && (
        <TeamSelectModal
          matchPlayers={matchPlayers[teamSelectMatch] || []}
          onSelect={(teamNum, courtSide) => joinMatchWithTeam(teamSelectMatch, teamNum, courtSide)}
          onClose={() => setTeamSelectMatch(null)}
        />
      )}

      {resultMatch && kampeFormat === "padel" && (() => {
        const matchObj = matches.find((m) => m.id === resultMatch);
        const mp = matchPlayers[resultMatch] || [];
        const t1 = mp.filter(p => matchPlayerTeam(p) === 1);
        const t2 = mp.filter(p => matchPlayerTeam(p) === 2);
        const t1Names = t1.map(p => (p.user_name || "?").split(" ")[0]).join(" & ") || "Hold 1";
        const t2Names = t2.map(p => (p.user_name || "?").split(" ")[0]).join(" & ") || "Hold 2";
        return (
          <ResultModal
            team1Names={t1Names}
            team2Names={t2Names}
            match={matchObj}
            onSubmit={(result) => submitResult(resultMatch, result)}
            onClose={() => setResultMatch(null)}
          />
        );
      })()}

      {confirmModalMatchId && (() => {
        const matchObj = matches.find((m) => m.id === confirmModalMatchId);
        const mr = matchResults[confirmModalMatchId];
        const mp = matchPlayers[confirmModalMatchId] || [];
        const t1 = mp.filter(p => matchPlayerTeam(p) === 1);
        const t2 = mp.filter(p => matchPlayerTeam(p) === 2);
        const t1Names = t1.map(p => (p.user_name || "?").split(" ")[0]).join(" & ") || "Hold 1";
        const t2Names = t2.map(p => (p.user_name || "?").split(" ")[0]).join(" & ") || "Hold 2";
        const submitter = mr?.submitted_by ? profilesById[String(mr.submitted_by)] : null;
        const submitterName = submitter?.name?.split(" ")[0] || null;
        return (
          <ConfirmResultModal
            open
            onClose={() => setConfirmModalMatchId(null)}
            matchResult={mr}
            match={matchObj}
            team1Names={t1Names}
            team2Names={t2Names}
            submitterName={submitterName}
            busy={busyId === confirmModalMatchId}
            onConfirm={() => { void confirmResult(confirmModalMatchId).then(() => setConfirmModalMatchId(null)); }}
            onReject={() => { void rejectResult(confirmModalMatchId).then(() => setConfirmModalMatchId(null)); }}
          />
        );
      })()}

      {viewPlayer && (
        <PlayerProfileModal
          player={viewPlayer}
          onClose={() => setViewPlayer(null)}
          onMessage={() => {
            openPlayerChat(navigate, viewPlayer);
          }}
        />
      )}

      {adminPinGateOpen ? (
        <AdminPinGate
          userId={user?.id}
          showToast={showToast}
          onUnlocked={handleAdminPinUnlocked}
          onCancel={() => {
            adminPinPendingChatMatchIdRef.current = null;
            adminPinPendingExpandMatchIdRef.current = null;
            setAdminPinGateOpen(false);
          }}
        />
      ) : null}

      {/* Kamp oprettet kvittering */}
      {createdMatchReceipt && (
        <CreatedMatchReceipt
          match={createdMatchReceipt}
          user={user}
          showToast={showToast}
          onShare={shareMatch}
          onAddToCalendar={addMatchToCalendar}
          onClose={() => { setCreatedMatchReceipt(null); setViewTab('open'); }}
        />
      )}
    </div>
  );
}

