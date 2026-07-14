import { useState, useEffect, useMemo, useCallback, useRef, lazy, Suspense } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { useConfirm } from '../lib/ConfirmDialogProvider';
import { fetchCourtsCached } from '../lib/courtsCache';
import { fetchProfilesByIdMap } from '../lib/profileQueries';
import { supabase } from '../lib/supabase';
import { readKampeSessionPrefs, mergeKampeSessionPrefs } from '../lib/kampeSessionPrefs';
import { useScrollIntoViewWhen } from '../lib/useScrollIntoViewWhen';
const AmericanoTab = lazy(() =>
  import('../features/americano/AmericanoTab').then(m => ({ default: m.AmericanoTab }))
);
const LigaTabLazyEmbed = lazy(() =>
  import('./LigaTab').then((m) => ({ default: m.LigaTab }))
);
import { theme, btn, inputStyle, labelStyle, font } from '../lib/platformTheme';
import { resolveDisplayName, sanitizeText } from '../lib/platformUtils';
import { statsFromEloHistoryRows, useProfileEloBundle, fetchEloByUserIdFromHistory } from '../lib/eloHistoryUtils';
import { eloOf, fmtClock, matchTimeLabel, timeToMinutes, matchCompletedSortMs, formatMatchDateDa } from '../lib/matchDisplayUtils';
import { calculateAndApplyElo } from '../lib/applyEloMatch';
import {
  createNotification,
  createNotificationsForUsers,
  sendPushNotificationsForUsers,
} from '../lib/notifications';
import { activateSeekingPlayer, deactivateSeekingPlayer } from '../lib/seekingPlayerUtils';
import { notifyMatchWatchersForMatch } from '../lib/matchWatchUtils';
import { fetchMatchMessages, fetchMatchMessageCounts, sendMatchMessage, subscribeToMatchMessages } from '../lib/matchChatUtils';
import { rpcJoinOpenMatch, rpcLeaveMatch } from '../lib/matchJoinUtils';
import { submitPadelMatchResult } from '../lib/submitPadelMatchResult';
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
  getKampeListEloBandLabel,
} from '../lib/kampeListFilterCore';
import { facilityLabel } from '../lib/courtFacilities.jsx';
import { fetchRowsInChunks } from '../lib/supabaseChunkFetch';
import { buildMatchLevelRange, clampElo, parseMatchLevelRange } from '../lib/matchLevelRange';
import {
  parseKampeFocusFromSearch,
  KAMPE_FORMAT_PADEL,
  KAMPE_FORMAT_AMERICANO,
  KAMPE_FORMAT_LIGA,
} from '../lib/kampeFocusNavigation';
import { DateTime } from 'luxon';
import { Plus, UserMinus, Trash2, Zap, ChevronDown, ChevronUp, MessageCircle, SendHorizontal, CalendarDays, CalendarPlus, Share2, Swords, Users, BarChart3, Check, Copy, ArrowRight, MapPin } from 'lucide-react';
import { EmptyStateIcon } from '../components/EmptyStateIcon';
import { KAMPE_CREATE_PLUS_HINT } from '../lib/kampeCreateHint';
import { sharePadelMatch, shareResultToastMessage } from '../lib/shareUtils';
import { TeamSelectModal } from './TeamSelectModal';
import { ResultModal } from './ResultModal';
import { ConfirmResultModal } from './ConfirmResultModal';
import { PlayerProfileModal } from './PlayerProfileModal';
import { AvatarCircle } from '../components/AvatarCircle';
import { ReportResultErrorButton } from '../components/ReportResultErrorButton';
import { completionMsFor2v2, isWithinResultErrorReportWindow } from '../lib/resultErrorReports';
import { calculate2v2MatchWinPrediction } from '../lib/matchWinPrediction';
import { PillTabs } from '../components/PillTabs';
import { LevelRangeSlider } from '../components/LevelRangeSlider';
import { eloToLevel, levelToElo, formatMatchLevelRangeLabel, formatPlaytomicLevelRange } from '../lib/padelLevelUtils';
import {
  KampeRedesignToolbar,
  KampeActiveFilterChips,
  KampeCreateHeader,
} from '../components/kampe/KampeRedesignToolbar';
import { KampeFilterSheet } from '../components/kampe/KampeFilterSheet';
import { VenueRegionPicker } from '../components/VenueRegionPicker';
import { KampeMatchListCard } from '../components/kampe/KampeMatchListCard';
import { KampeMatchDetailSheet } from '../components/kampe/KampeMatchDetailSheet';
import { isProfileMatchFeedVisible } from '../lib/seekingFeedTtl';
import { ActiveSeekingPanel } from '../components/ActiveSeekingPanel';
import { FILTER_RETURN_KAMPE } from '../lib/filterReturnNavigation';
import {
  getMatchVenueOptions,
  courtIdFromVenueSelection,
  courtNameFromVenueSelection,
  isMatchVenueTbd,
  MATCH_VENUE_TBD,
} from '../lib/matchVenueOptions';

const KAMPE_AUTO_READ_NOTIF_TYPES = KAMPE_NON_CHAT_NOTIF_TYPES.filter((type) => type !== 'match_invite');

function matchPlayerTeam(p) {
  return Number(p?.team);
}

function splitPlayersByTeam(players) {
  const list = players || [];
  const t1 = list.filter((p) => matchPlayerTeam(p) === 1);
  const t2 = list.filter((p) => matchPlayerTeam(p) === 2);
  const unassigned = list.filter((p) => {
    const team = matchPlayerTeam(p);
    return team !== 1 && team !== 2;
  });
  for (const p of unassigned) {
    if (t1.length < 2 && t1.length <= t2.length) t1.push(p);
    else if (t2.length < 2) t2.push(p);
    else if (t1.length <= t2.length) t1.push(p);
    else t2.push(p);
  }
  return { t1, t2 };
}

function teamMoveErrorMessage(data, fallbackTeam) {
  const code = data?.error;
  if (code === "team_full") return `Hold ${data?.team ?? fallbackTeam} er fuldt.`;
  if (code === "match_not_open") return "Hold kan kun skiftes før kampen er startet.";
  if (code === "not_authorized") return "Du har ikke lov til at flytte denne spiller.";
  if (code === "player_not_in_match") return "Spilleren er ikke i kampen.";
  if (code === "match_not_found") return "Kampen blev ikke fundet.";
  return code || "Ukendt fejl";
}

function nearestHalfHour() {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  if (m < 15) return `${String(h).padStart(2, '0')}:00`;
  if (m < 45) return `${String(h).padStart(2, '0')}:30`;
  return `${String((h + 1) % 24).padStart(2, '0')}:00`;
}

const TIME_OPTIONS = [];
for (let h = 6; h <= 23; h++) {
  TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:00`);
  TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:30`);
}

const PADEL_RULE_SUMMARY = [
  {
    icon: '1.',
    text: 'Kampen spilles som bedst af 3 sæt. Et sæt vindes typisk 6-0 til 6-4, eller 7-5 / 7-6 ved tætte sæt.',
  },
  {
    icon: '2.',
    text: 'Serven slås under hoftehøjde efter et hop og diagonalt over i modstanderens serverfelt.',
  },
  {
    icon: '3.',
    text: 'Bolden skal først ramme gulvet på modstanderens side. Derefter må den ramme glas/hegn og stadig være i spil.',
  },
  {
    icon: '4.',
    text: 'På egen side må bolden kun hoppe en gang, før du returnerer den.',
  },
  {
    icon: '5.',
    text: 'Du taber point hvis du rammer nettet, slår bolden direkte i væggen på modstanderens side eller slår bolden ud af banen.',
  },
  {
    icon: '6.',
    text: 'I PadelMakker registreres resultat som sætscore (fx 6-4, 7-5, 7-6), så begge hold hurtigt kan se kampens udfald.',
  },
];

const CALENDAR_ZONE = 'Europe/Copenhagen';

function parseMatchDateTime(matchDate, matchTime) {
  const dateIso = String(matchDate || '').slice(0, 10);
  const rawTime = String(matchTime || '').trim();
  const timeMatch = /^(\d{1,2}):(\d{2})/.exec(rawTime);
  if (!dateIso || !timeMatch) return null;

  const hours = Math.max(0, Math.min(23, Number(timeMatch[1])));
  const minutes = Math.max(0, Math.min(59, Number(timeMatch[2])));
  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  const dt = DateTime.fromISO(`${dateIso}T${hh}:${mm}:00`, { zone: CALENDAR_ZONE });
  return dt.isValid ? dt : null;
}

function calendarWindowForMatch(match) {
  const start = parseMatchDateTime(match?.date, match?.time);
  if (!start) return null;

  let end = parseMatchDateTime(match?.date, match?.time_end);
  if (!end) {
    const duration = Number(match?.duration);
    const minutes = Number.isFinite(duration) && duration > 0 ? duration : 120;
    end = start.plus({ minutes });
  }
  if (end <= start) end = end.plus({ days: 1 });
  return { start, end };
}

function escapeIcsText(value) {
  return String(value || '')
    .replaceAll('\\', '\\\\')
    .replaceAll(';', '\\;')
    .replaceAll(',', '\\,')
    .replace(/\r?\n/g, '\\n');
}

function toIcsUtc(dt) {
  return dt.toUTC().toFormat("yyyyLLdd'T'HHmmss'Z'");
}

function buildIcsEvent({ uid, title, description, location, start, end, url }) {
  const stamp = DateTime.utc().toFormat("yyyyLLdd'T'HHmmss'Z'");
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PadelMakker//Kampe//DA',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${escapeIcsText(uid)}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${toIcsUtc(start)}`,
    `DTEND:${toIcsUtc(end)}`,
    `SUMMARY:${escapeIcsText(title)}`,
    `LOCATION:${escapeIcsText(location)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    `URL:${escapeIcsText(url)}`,
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ];
  return lines.join('\r\n');
}

export function KampeTab({ user, showToast, tabActive = true }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user: authUser, refreshProfile } = useAuth();
  const ask = useConfirm();
  const isAdmin = user?.role === 'admin';
  const { adminPinVerified, refreshAdminPinSession } = useAdminPinSession(isAdmin && tabActive);
  const adminCanAct = isAdmin && adminPinVerified;
  const [adminPinGateOpen, setAdminPinGateOpen] = useState(false);
  const myDisplayName                 = resolveDisplayName(user, authUser);
  const eloSyncKeyKampe = `${user.elo_rating}|${user.games_played}|${user.games_won}`;
  const { profileFresh: kampeProfileFresh, ratedRows: kampeRatedRows, reloadProfileEloBundle: reloadKampeEloBundle } =
    useProfileEloBundle(user.id, eloSyncKeyKampe);
  const [showCreate, setShowCreate]   = useState(false);
  const [padelCreateStep, setPadelCreateStep] = useState(1);
  const [padelCreateStepErr, setPadelCreateStepErr] = useState("");
  const [showAmericanoCreate, setShowAmericanoCreate] = useState(false);
  const [showLigaCreate, setShowLigaCreate] = useState(false);
  const [createdMatchReceipt, setCreatedMatchReceipt] = useState(null); // match row after creation
  const [receiptUrlCopied, setReceiptUrlCopied] = useState(false);
  const padelCreateFormRef = useRef(null);
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
  const [detailMatchId, setDetailMatchId] = useState(null);

  useScrollIntoViewWhen(showCreate, padelCreateFormRef, {
    enabled: kampeFormat === 'padel' && !loadingMatches,
    block: 'start',
  });

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
      setPadelCreateStepErr("");
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
    payment_method: "mobilepay",
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
    setLoadingMatches(true);
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

      const idSet = new Set();
      (openPoolRes.data || []).forEach((m) => idSet.add(m.id));
      (createdRes.data || []).forEach((m) => idSet.add(m.id));
      (myMpRes.data || []).forEach((r) => idSet.add(r.match_id));

      const { data: recentCompleted, error: rcErr } = await supabase
        .from("matches")
        .select("id")
        .eq("status", "completed")
        .order("date", { ascending: false })
        .limit(300);
      if (rcErr) throw rcErr;
      (recentCompleted || []).forEach((r) => idSet.add(r.id));
      if (isStale()) return;

      const allMatchIds = [...idSet];

      const allMatches =
        allMatchIds.length > 0 ? await fetchRowsInChunks(supabase, "matches", "id", allMatchIds) : [];
      if (isStale()) return;
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
        allMatchIds.length > 0 ? await fetchRowsInChunks(supabase, "match_players", "match_id", allMatchIds) : [];
      const mm = {};
      (mpd || []).forEach((mp) => {
        if (!mm[mp.match_id]) mm[mp.match_id] = [];
        mm[mp.match_id].push(mp);
      });

      /** ELO fra elo_history for alle på banen (+ dig) — undgår RLS hvor kun egen profiles-række returneres ved .in("id"). */
      const idsForHist = new Set();
      for (const arr of Object.values(mm)) {
        for (const row of arr || []) {
          if (row?.user_id) idsForHist.add(String(row.user_id));
        }
      }
      idsForHist.add(String(user.id));
      const profileIdList = [...idsForHist];
      const [histEloMap, pById] = await Promise.all([
        fetchEloByUserIdFromHistory(profileIdList),
        fetchProfilesByIdMap(profileIdList),
      ]);
      setEloFromHistoryByUserId(histEloMap);

      const eloMap = {};
      for (const [id, pr] of Object.entries(pById)) {
        eloMap[id] = eloOf(pr);
      }
      setEloByUserId(eloMap);
      setProfilesById(pById);
      if (isStale()) return;
      setMatchPlayers(mm);

      const mrd =
        allMatchIds.length > 0 ? await fetchRowsInChunks(supabase, "match_results", "match_id", allMatchIds) : [];
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

      const eloHistRows =
        allMatchIds.length > 0
          ? await fetchRowsInChunks(
              supabase,
              'elo_history',
              'match_id',
              allMatchIds,
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
        void reloadKampeEloBundle();
      }
    }
  }, [user.id, showToast, reloadKampeEloBundle]);

  useEffect(() => { void loadData(); }, [loadData]);

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

  /* Hent totalt antal chat-beskeder per kamp så badgen "Match chat (N)"
     kan vises uden at brugeren først skal åbne chatten. */
  useEffect(() => {
    const ids = matches.map((m) => String(m.id)).filter(Boolean);
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
  }, [matches]);

  useEffect(() => {
    if (!showCreate) return;
    setNewMatch((m) => {
      if (m.level_min !== "" || m.level_max !== "") return m;
      return {
        ...m,
        level_min: String(clampElo(myElo - 100, myElo)),
        level_max: String(clampElo(myElo + 100, myElo)),
      };
    });
  }, [showCreate, myElo]);

  useEffect(() => {
    mergeKampeSessionPrefs(user.id, { format: kampeFormat, view: viewTab });
  }, [user.id, kampeFormat, viewTab]);

  useEffect(() => {
    if (kampeFormat !== "padel") {
      setMatchChatOpenById({});
    }
  }, [kampeFormat]);

  useEffect(() => {
    setMatchChatOpenById({});
  }, [viewTab, kampeScope]);

  /* Kamp-detaljen opfører sig som en side: åbning skubber et history-trin,
     så telefonens tilbage-gestus/knap lukker arket i stedet for at forlade Kampe.
     mounted-ref'en (defineret FØR effekten, så dens cleanup kører først ved unmount)
     sikrer at vi ikke kalder history.back() når hele fanen forlades. */
  const loadDataReqIdRef = useRef(0);
  const kampeMountedRef = useRef(true);
  useEffect(() => () => { kampeMountedRef.current = false; }, []);
  const detailHistoryArmedRef = useRef(false);
  useEffect(() => {
    if (!detailMatchId || typeof window === "undefined") return undefined;
    window.history.pushState({ pmKampeDetail: String(detailMatchId) }, "");
    detailHistoryArmedRef.current = true;
    const onPop = () => {
      detailHistoryArmedRef.current = false;
      setDetailMatchId(null);
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      if (detailHistoryArmedRef.current) {
        detailHistoryArmedRef.current = false;
        if (kampeMountedRef.current) window.history.back();
      }
    };
  }, [detailMatchId]);

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
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadUnreadMatchChatNotifs, loadMatchUnreadCounts, user?.id]);

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

  /** Deep link scroll-mål (state så ny notifikation trigger scroll på samme underfane). */
  const [focusScrollMatchId, setFocusScrollMatchId] = useState(null);
  const [focusScrollAmericanoId, setFocusScrollAmericanoId] = useState(null);
  const [focusScrollLeagueId, setFocusScrollLeagueId] = useState(null);

  const createMatch = async () => {
    if (newMatch.court_booked && (!newMatch.court_id || isMatchVenueTbd(newMatch.court_id))) {
      showToast("Vælg hvilken bane der er booket.");
      return;
    }
    const startM = timeToMinutes(newMatch.time);
    if (!Number.isFinite(startM)) { showToast("Vælg en gyldig starttid."); return; }
    const dur = parseInt(newMatch.duration, 10);
    if (!dur || dur < 60) { showToast("Varighed skal være mindst 1 time."); return; }
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
        status: "open", max_players: 4, current_players: 1,
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
      await rpcJoinOpenMatch({
        matchId: created.id,
        team: 1,
        userName: myDisplayName,
        userEmail: authUser?.email || user.email,
        userEmoji: user.avatar || "🎾",
      });
      if (row.match_type !== "closed" && row.status === "open") {
        void notifyMatchWatchersForMatch(created.id);
      }
      setShowCreate(false);
      setPadelCreateStep(1);
      setPadelCreateStepErr("");
      setCreatedMatchReceipt(created);
      await loadData();
    } catch (e) { showToast("Fejl: " + (e.message || "Prøv igen")); }
    finally { setCreating(false); }
  };

  const validatePadelCreateStep = (step) => {
    if (step === 1) {
      if (venueOptions.length === 0) return "Ingen baner tilgængelige i dit område endnu.";
      if (newMatch.court_booked && (!newMatch.court_id || isMatchVenueTbd(newMatch.court_id))) {
        return "Vælg hvilken bane der er booket.";
      }
      if (!newMatch.date) return "Angiv en dato.";
      const startM = timeToMinutes(newMatch.time);
      if (!Number.isFinite(startM)) return "Vælg en gyldig starttid.";
      const dur = parseInt(newMatch.duration, 10);
      if (!dur || dur < 60) return "Varighed skal være mindst 1 time.";
      return null;
    }
    return null;
  };

  const goPadelCreateNext = () => {
    const err = validatePadelCreateStep(padelCreateStep);
    if (err) {
      setPadelCreateStepErr(err);
      return;
    }
    setPadelCreateStepErr("");
    setPadelCreateStep((s) => Math.min(3, s + 1));
  };

  const joinMatchWithTeam = async (matchId, teamNum) => {
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
        userName: myDisplayName,
        userEmail: authUser?.email || user.email,
        userEmoji: user.avatar || "🎾",
      });
      const joinedTeam = result?.team ?? teamNum;
      const isFull = result?.is_full === true;

      /* Underret opretter via RPC (læser creator_id server-side — RLS kan skjule creator for B) */
      if (!result?.already_joined) {
        const { error: nErr } = await supabase.rpc("notify_match_creator_on_join", {
          p_match_id: matchId,
          p_title: "Ny spiller tilmeldt!",
          p_body: `${myDisplayName} har tilmeldt sig Hold ${joinedTeam} i din kamp.`,
        });
        if (nErr) {
          console.warn("notify_match_creator_on_join:", nErr.message || nErr);
          showToast(
            "Tilmelding gemt, men notifikation fejlede. Kør opdateret create_notification_rpc.sql (notify_match_creator_on_join) i Supabase."
          );
        } else if (match?.creator_id && String(match.creator_id) !== String(user.id)) {
          void sendPushNotificationsForUsers(
            [match.creator_id],
            'match_join',
            'Ny spiller tilmeldt!',
            `${myDisplayName} har tilmeldt sig Hold ${joinedTeam} i din kamp.`,
            matchId,
          );
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

      showToast(result?.already_joined ? "Du er allerede tilmeldt kampen." : `Du er tilmeldt Hold ${joinedTeam}! ⚔️`);
      await loadData();
    } catch (e) { showToast("Fejl: " + (e.message || "Prøv igen")); }
    finally { setBusyId(null); }
  };

  const patchMatchPlayerTeamLocally = useCallback((matchId, targetUserId, newTeam) => {
    const key = String(matchId);
    setMatchPlayers((prev) => {
      const rows = prev[key];
      if (!rows?.length) return prev;
      return {
        ...prev,
        [key]: rows.map((p) => (
          String(p.user_id) === String(targetUserId) ? { ...p, team: newTeam } : p
        )),
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

  const switchTeam = async (matchId, newTeam) => {
    const myCurrent = (matchPlayers[String(matchId)] || []).find((p) => String(p.user_id) === String(user.id));
    if (myCurrent && matchPlayerTeam(myCurrent) === Number(newTeam)) return;
    setBusyId(matchId + "-switch");
    try {
      const data = await applyMatchPlayerTeam(matchId, user.id, newTeam);
      if (!data?.unchanged) {
        patchMatchPlayerTeamLocally(matchId, user.id, newTeam);
        showToast(`Skiftet til Hold ${newTeam}! ⚔️`);
      }
      await loadData();
    } catch (e) { showToast("Fejl: " + (e.message || "Prøv igen")); }
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
      showToast("Fejl: " + (e.message || "Prøv igen"));
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

    const mp = matchPlayers[matchId] || [];
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
      if (!isCreator && match?.creator_id) {
        await createNotification(match.creator_id, 'match_cancelled', 'Spiller afmeldt ❌', `${myDisplayName} er afmeldt kampen.`, matchId);
      }
      const leaveResult = await rpcLeaveMatch(matchId);
      if (leaveResult?.cancelled) {
        showToast("Kampen er slettet (ingen spillere tilbage).");
      } else if (leaveResult?.creator_transferred) {
        showToast("Du er afmeldt. Kampen er givet videre.");
      } else {
        showToast("Du er afmeldt.");
      }
      await loadData();
    } catch (e) { showToast("Fejl: " + (e.message || "Prøv igen")); }
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
        showToast("Fejl: " + (e.message || "Prøv igen"));
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
      showToast("Fejl: " + (e.message || "Prøv igen"));
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
      const approveErr = await createNotification(reqUserId, "match_invite", "Anmodning godkendt! 🎾",
        `${myDisplayName} har godkendt din tilmeldingsanmodning. Du er sat på Hold ${teamNum}.`, matchId);
      if (approveErr) console.warn("approve join notify:", approveErr.message || approveErr);

      showToast(`${reqUserName} er godkendt og sat på Hold ${teamNum}!`);
      await markJoinRequestNotifsRead(matchId);
      await loadData();
    } catch (e) { showToast("Fejl: " + (e.message || "Prøv igen")); }
    finally { setBusyId(null); }
  };

  const rejectJoinRequest = async (matchId, requestId, reqUserId, reqUserName) => {
    setBusyId(matchId + '-reject-' + requestId);
    try {
      const { error } = await supabase.from("match_join_requests")
        .update({ status: "rejected" }).eq("id", requestId);
      if (error) throw error;

      const rejectErr = await createNotification(reqUserId, "match_invite", "Anmodning afvist",
        `Din anmodning om at deltage i kampen er desværre ikke godkendt.`, matchId);
      if (rejectErr) console.warn("reject join notify:", rejectErr.message || rejectErr);

      showToast(`Anmodning fra ${reqUserName} afvist.`);
      await markJoinRequestNotifsRead(matchId);
      await loadData();
    } catch (e) { showToast("Fejl: " + (e.message || "Prøv igen")); }
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
      const kickNotifyErr = await createNotification(
        targetUserId,
        'match_cancelled',
        'Du er fjernet fra kampen ❌',
        'En admin/opretter har fjernet dig fra kampen.',
        matchId,
      );
      if (kickNotifyErr) console.warn('kick notify:', kickNotifyErr.message || kickNotifyErr);

      const { error } = await supabase.from("match_players").delete()
        .eq("match_id", matchId).eq("user_id", targetUserId);
      if (error) throw error;
      const { data: remainingRows, error: remainingError } = await supabase
        .from("match_players")
        .select("user_id, team")
        .eq("match_id", matchId);
      if (remainingError) throw remainingError;
      const mp = remainingRows ?? [];
      await supabase.from("matches").update({ status: "open", current_players: mp.length }).eq("id", matchId);
      showToast("Spiller fjernet.");
      await loadData();
    } catch (e) { showToast("Fejl: " + (e.message || "Prøv igen")); }
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
    } catch (e) { showToast("Fejl: " + (e.message || "Prøv igen")); }
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

      const cancelNotifyIds = mpBefore.filter((p) => p.user_id !== user.id).map((p) => p.user_id);
      void createNotificationsForUsers(
        cancelNotifyIds,
        "match_cancelled",
        "Kamp aflyst ❌",
        isAdmin ? "En admin har aflyst kampen." : `${myDisplayName} har aflyst kampen.`,
        matchId,
      );
      setDetailMatchId((current) => (String(current) === String(matchId) ? null : current));
      showToast("Kamp slettet.");
      await loadData();
    } catch (e) { showToast("Fejl: " + (e.message || "Prøv igen")); }
    finally { setBusyId(null); }
  };

  const shareMatch = async (match) => {
    const result = await sharePadelMatch({ match, hostName: myDisplayName });
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
      } catch (e) { showToast('Fejl: ' + (e.message || 'Prøv igen')); }
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
    } catch (e) { showToast('Fejl: ' + (e.message || 'Prøv igen')); }
    finally { setBusyId(null); }
  };

  const loadMatchChat = useCallback(async (matchId, options = {}) => {
    const { showLoading = true } = options;
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
  }, []);

  const toggleMatchChat = async (matchId) => {
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

  const addMatchToCalendar = useCallback((match) => {
    const windowRef = typeof window !== 'undefined' ? window : null;
    const navigatorRef = typeof navigator !== 'undefined' ? navigator : null;
    if (!windowRef || !navigatorRef) return;

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
    const matchUrl = `${windowRef.location.origin}/dashboard/kampe#pm-match-${match.id}`;
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
    const userAgent = String(navigatorRef.userAgent || '');
    const isIOS = /iPhone|iPad|iPod/i.test(userAgent);
    const isAndroid = /Android/i.test(userAgent);

    if (isIOS) {
      const dataUrl = `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
      windowRef.location.assign(dataUrl);
      showToast('Kalender åbnet. Vælg "Tilføj" for at gemme kampen.');
      return;
    }

    if (isAndroid) {
      const dates = `${toIcsUtc(timing.start)}/${toIcsUtc(timing.end)}`;
      const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${encodeURIComponent(dates)}&location=${encodeURIComponent(locationName)}&details=${encodeURIComponent(description)}`;
      const popup = windowRef.open(googleUrl, '_blank', 'noopener,noreferrer');
      if (!popup) windowRef.location.assign(googleUrl);
      showToast('Kalender åbnet. Bekræft eventen for at gemme den.');
      return;
    }

    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = windowRef.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    windowRef.setTimeout(() => windowRef.URL.revokeObjectURL(url), 0);
    showToast('Kalenderfil hentet. Åbn filen for at tilføje kampen.');
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
      return { ok: false, reason: "Fejl: " + (e.message || "Prøv igen") };
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
    } catch (e) { showToast("Fejl: " + (e.message || "Prøv igen")); }
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

      showToast("Resultat afvist. Indrapportér igen.");
      await loadData();
    } catch (e) { showToast("Fejl: " + (e.message || "Prøv igen")); }
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
    userElo: myElo,
    courtFacilitiesById,
    completedSortMs: matchCompletedSortMs,
  }), [isMine, joinedMatchIds, matchPlayers, matchResults, matches, myUidStr, searchQuery, kampeListFilter, profilesById, myElo, courtFacilitiesById]);

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

  /* Notifikation: ?format=americano|liga&focus=<id> eller ?focus=<matchId> (padel) */
  useEffect(() => {
    if (!tabActive) return;
    const { format, focusId, openChat } = parseKampeFocusFromSearch(location.search);
    if (!focusId) return;

    const clearFocusInUrl = (keepFormat) => {
      const params = new URLSearchParams();
      if (keepFormat && keepFormat !== KAMPE_FORMAT_PADEL) params.set("format", keepFormat);
      const q = params.toString();
      navigate({ pathname: "/dashboard/kampe", search: q ? `?${q}` : "" }, { replace: true });
    };

    if (format === KAMPE_FORMAT_AMERICANO) {
      setKampeFormat(KAMPE_FORMAT_AMERICANO);
      setFocusScrollAmericanoId(focusId);
      clearFocusInUrl(KAMPE_FORMAT_AMERICANO);
      return;
    }

    if (format === KAMPE_FORMAT_LIGA) {
      setKampeFormat(KAMPE_FORMAT_LIGA);
      setFocusScrollLeagueId(focusId);
      clearFocusInUrl(KAMPE_FORMAT_LIGA);
      return;
    }

    if (loadingMatches || !matches.length) return;
    const m = matches.find((x) => String(x.id) === String(focusId));
    if (!m) {
      clearFocusInUrl(KAMPE_FORMAT_PADEL);
      return;
    }
    setKampeFormat(KAMPE_FORMAT_PADEL);
    setFocusScrollMatchId(focusId);
    const st = (m.status ?? "open").toString().toLowerCase();
    const mp = matchPlayers[m.id] || [];
    const imIn = mp.some((p) => p.user_id === user.id);
    if (st === "in_progress" && imIn) setViewTab("active");
    else if (st === "completed" && imIn) setViewTab("completed");
    else setViewTab("open");
    // Åbn detaljer direkte, så deeplinket altid viser kampen — også hvis et
    // aktivt filter ellers ville skjule den fra den synlige liste.
    setDetailMatchId(String(focusId));
    if (openChat) {
      const matchKey = String(focusId);
      setMatchChatOpenById((prev) => ({ ...prev, [matchKey]: true }));
      void loadMatchChat(matchKey, { showLoading: true });
      void markMatchChatNotifsRead(matchKey);
    }
    clearFocusInUrl(KAMPE_FORMAT_PADEL);
  }, [tabActive, loadingMatches, matches, matchPlayers, user.id, location.search, navigate, loadMatchChat, markMatchChatNotifsRead]);

  useEffect(() => {
    const mid = focusScrollMatchId;
    if (!mid || !tabActive || loadingMatches) return;

    const matchInRenderedList = () => {
      if (viewTab === "open") {
        return openMatches.some((x) => String(x.id) === String(mid));
      }
      if (viewTab === "active") {
        return activeMatches.some((x) => String(x.id) === String(mid));
      }
      if (viewTab === "completed") {
        return completedMatches.slice(0, completedLimit).some((x) => String(x.id) === String(mid));
      }
      return false;
    };

    if (viewTab === "completed") {
      const idx = completedMatches.findIndex((x) => String(x.id) === String(mid));
      if (idx >= 0 && idx >= completedLimit) {
        setCompletedLimit(idx + 1);
        return;
      }
    }

    if (!matchInRenderedList()) return;

    setDetailMatchId(String(mid));
    void refreshJoinRequestsForMatch(mid);
    setFocusScrollMatchId(null);
  }, [
    tabActive,
    loadingMatches,
    matches,
    focusScrollMatchId,
    viewTab,
    openMatches,
    activeMatches,
    completedMatches,
    completedLimit,
    refreshJoinRequestsForMatch,
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
  }, [getStatus, matchChatUnreadById, matchUnreadById, matches]);

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
  const onListFilterChange = (nextFilter) => {
    const normalized = normalizeKampeListFilter(nextFilter);
    setKampeListFilter(normalized);
    mergeKampeSessionPrefs(user.id, { listFilter: normalized });
  };
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
      unreadChatCount: matchChatUnreadById[String(m.id)] || 0,
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
        onClick: () => {
          setDetailMatchId(null);
          setTeamSelectMatch(m.id);
        },
        disabled: busy,
      };
    }
    if (isClosed && status === "open" && left > 0 && !joined && !isCreator) {
      if (!myRequest) {
        return {
          label: busyId === m.id + "-req" ? "Sender..." : "Anmod om tilmelding",
          onClick: () => {
            setDetailMatchId(null);
            void requestJoin(m.id);
          },
          disabled: busyId === m.id + "-req",
        };
      }
      if (myRequest.status === "approved") {
        return {
          label: "Vælg hold og anmod",
          onClick: () => {
            setDetailMatchId(null);
            setTeamSelectMatch(m.id);
          },
          disabled: busy,
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
          label: "Vælg hold og tilmeld",
          onClick: () => {
            setDetailMatchId(null);
            setTeamSelectMatch(m.id);
          },
          disabled: busy,
        };
      }
    }
    if (isCreator && (status === "open" || status === "full")) {
      return {
        label: isFull ? "Start kamp" : "Venter på spillere",
        onClick: () => {
          setDetailMatchId(null);
          void startMatch(m.id);
        },
        disabled: busy || !isFull,
        variant: isFull ? "primary" : "secondary",
      };
    }
    if (status === "in_progress" && isPlayerInMatch && !mr) {
      return {
        label: "Indrapportér resultat",
        onClick: () => {
          setDetailMatchId(null);
          setResultMatch(m.id);
        },
        disabled: busy,
      };
    }
    if (mr && !mr.confirmed && isPlayerInMatch) {
      if (canConfirmPadelMatchResult({ result: mr, players: bundle.mp, confirmedBy: user.id, isAdmin: adminCanAct }).ok) {
        return {
          label: "Bekræft resultat",
          onClick: () => {
            setDetailMatchId(null);
            setConfirmModalMatchId(m.id);
          },
          disabled: busy,
        };
      }
    }
    return null;
  }, [busyId, cancelJoinRequest, confirmResult, isAdmin, requestJoin, startMatch, user.id]);

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
    setDetailMatchId(null);
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
      chatOpen,
      chatMessages,
      chatDraft,
      chatLoading,
      chatSending,
      chatError,
      unreadChatCount,
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
    const showToolsAccordion =
      adminCanForceStart || adminCanForceReport || adminCanForceConfirm || canDeleteMatch || canKickPlayers || needsAdminPinUnlock;
    const hasManage =
      canUseMatchChat || hasSecondaryLinks || showToolsAccordion;

    if (!hasManage) return null;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {canUseMatchChat ? (
          <>
            <button
              type="button"
              onClick={() => { void toggleMatchChat(m.id); }}
              className="pm-accordion-trigger"
              style={{
                ...btn(false),
                marginBottom: chatOpen ? "8px" : 0,
                padding: "8px 12px",
                fontSize: "12px",
                color: theme.textMid,
                borderColor: theme.border,
                background: theme.surfaceAlt,
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: "7px" }}>
                <MessageCircle size={14} />
                Match chat {(() => {
                  const total = Math.max(matchChatTotalById[String(m.id)] || 0, chatMessages.length);
                  return total > 0 ? `(${total})` : "";
                })()}
                {unreadChatCount > 0 ? (
                  <span
                    style={{
                      background: theme.red,
                      color: theme.onAccent,
                      borderRadius: "999px",
                      minWidth: "16px",
                      height: "16px",
                      padding: "0 5px",
                      fontSize: "10px",
                      fontWeight: 700,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      lineHeight: 1,
                    }}
                  >
                    {unreadChatCount > 9 ? "9+" : unreadChatCount}
                  </span>
                ) : null}
              </span>
              {chatOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {chatOpen ? (
              <div className="pm-card-subpanel pm-match-chat-panel" style={{ marginBottom: "4px" }}>
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
          </>
        ) : null}

        {hasSecondaryLinks ? (
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", alignItems: "center", gap: "8px 14px", padding: "2px 0", fontSize: "12px", color: theme.textMid }}>
            {showShareLink ? (
              <button
                type="button"
                onClick={() => void shareMatch(m)}
                style={{ background: "none", border: "none", padding: 0, color: theme.accent, fontWeight: 600, fontSize: "12px", cursor: "pointer", textDecoration: "underline", textDecorationColor: "rgba(37,99,235,0.25)", display: "inline-flex", alignItems: "center", gap: "4px" }}
              >
                <Share2 size={12} /> Del kamp
              </button>
            ) : null}
            {joined && status !== "completed" ? (
              <span style={{ color: theme.green, fontWeight: 700 }}>✅ Du er tilmeldt</span>
            ) : null}
            {joined && status !== "completed" ? (
              <button
                type="button"
                onClick={() => addMatchToCalendar(m)}
                style={{ background: "none", border: "none", padding: 0, color: theme.textMid, fontWeight: 600, fontSize: "12px", cursor: "pointer", textDecoration: "underline", textDecorationColor: "rgba(0,0,0,0.2)", display: "inline-flex", alignItems: "center", gap: "4px" }}
              >
                <CalendarPlus size={12} /> Tilføj til kalender
              </button>
            ) : null}
            {isCreator && status === "open" && mp.length === 3 ? (
              <button
                type="button"
                onClick={() => toggleSeekingPlayer(m)}
                disabled={busyId === m.id + "-seek"}
                style={{ background: "none", border: "none", padding: 0, color: m.seeking_player ? theme.warm : theme.textMid, fontWeight: 600, fontSize: "12px", cursor: "pointer", textDecoration: "underline", textDecorationColor: m.seeking_player ? "rgba(217,119,6,0.3)" : "rgba(0,0,0,0.2)", display: "inline-flex", alignItems: "center", gap: "4px" }}
              >
                <Zap size={12} />
                {busyId === m.id + "-seek" ? "Sender..." : m.seeking_player ? "Stop råb" : "Råb op for spiller"}
              </button>
            ) : null}
            {joined && (status === "open" || status === "full") ? (
              <button
                type="button"
                onClick={() => leaveMatch(m.id)}
                disabled={busy}
                style={{ background: "none", border: "none", padding: 0, color: theme.red, fontWeight: 600, fontSize: "12px", cursor: "pointer", textDecoration: "underline", textDecorationColor: "rgba(220,38,38,0.3)", display: "inline-flex", alignItems: "center", gap: "4px" }}
              >
                <UserMinus size={12} /> {isCreator ? "Forlad / overdrag" : "Afmeld mig"}
              </button>
            ) : null}
          </div>
        ) : null}

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
                {needsAdminPinUnlock ? (
                  <div className="pm-feedback-panel pm-feedback-panel--warning" style={{ fontSize: "12px", lineHeight: 1.45, padding: "10px 12px" }}>
                    <div style={{ fontWeight: 700, marginBottom: "6px" }}>Admin-PIN påkrævet</div>
                    <div style={{ marginBottom: "10px", color: theme.textMid }}>
                      For at slette eller styre andres kampe skal du bekræfte din admin-kode.
                    </div>
                    <button
                      type="button"
                      onClick={() => setAdminPinGateOpen(true)}
                      style={{ ...btn(true), width: "100%", justifyContent: "center", fontSize: "12px" }}
                    >
                      Indtast admin-PIN
                    </button>
                  </div>
                ) : null}
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
            setDetailMatchId(m.id);
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
    profilesById,
    requestJoin,
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
        label: `ELO ${getKampeListEloBandLabel(kampeListFilter.eloBandId, myElo)} ×`,
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
  }, [kampeScope, kampeFormat, user, kampeListFilter]);
  const showCreatePanel =
    (kampeFormat === "padel" && showCreate) ||
    (kampeFormat === "americano" && showAmericanoCreate) ||
    (kampeFormat === "liga" && showLigaCreate);
  const handleToolbarCreate = !loadingMatches && !showCreatePanel
    ? () => {
        if (kampeFormat === "padel") setShowCreate(true);
        else if (kampeFormat === "americano") setShowAmericanoCreate(true);
        else if (kampeFormat === "liga" && user?.role === "admin") setShowLigaCreate(true);
      }
    : undefined;
  const toolbarCreateLabel =
    kampeFormat === "padel"
      ? "Opret kamp"
      : kampeFormat === "americano"
        ? "Opret Americano/Mexicano"
        : "Opret liga";
  const createHeaderTitle =
    kampeFormat === "padel"
      ? "Opret kamp"
      : kampeFormat === "americano"
        ? "Opret turnering"
        : "Opret liga";
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
      ) : (
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
              setDetailMatchId(null);
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
            <ActiveSeekingPanel
              variant="compact"
              channel="kamp"
              user={user}
              showToast={showToast}
              filterReturnTo={FILTER_RETURN_KAMPE}
            />
          )}
        </>
      )}

      <KampeFilterSheet
        open={filterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        scope={kampeScope}
        onScopeChange={onScopeChange}
        listFilter={kampeListFilter}
        onListFilterChange={onListFilterChange}
        myElo={myElo}
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
            focusLeagueId={focusScrollLeagueId}
            onFocusLeagueHandled={() => setFocusScrollLeagueId(null)}
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
      {kampeFormat === "padel" && loadingMatches && (
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
          focusTournamentId={focusScrollAmericanoId}
          onFocusTournamentHandled={() => setFocusScrollAmericanoId(null)}
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

      {kampeFormat === "padel" && !loadingMatches && !loadError && (
      <>
      {showCreate ? (
        <div
          ref={padelCreateFormRef}
          className="pm-ui-card pm-create-form-anchor pm-create-form-panel"
          style={{
            padding: "clamp(16px,3vw,20px)",
            marginBottom: "20px",
            border: `2px solid ${theme.accent}40`,
            boxShadow: theme.shadow,
          }}
        >
          <div className="pm-wiz" style={{ margin: "0 0 16px" }}>
            {[{ n: 1, label: "Info" }, { n: 2, label: "Pris" }, { n: 3, label: "Bekræft" }].map((s, i, arr) => {
              const state = s.n < padelCreateStep ? "done" : s.n === padelCreateStep ? "on" : "";
              return (
                <span key={s.n} style={{ display: "contents" }}>
                  <div className={`pm-wiz-step${state ? ` ${state}` : ""}`}>
                    <div className="pm-wiz-num">{state === "done" ? "✓" : s.n}</div>
                    <span className="pm-wiz-label">{s.label}</span>
                  </div>
                  {i < arr.length - 1 && <div className="pm-wiz-line" />}
                </span>
              );
            })}
          </div>

          {padelCreateStep === 1 && (
            <>
              <p style={{ fontSize: "13px", color: theme.textMid, margin: "0 0 16px" }}>
                Din ELO <strong>{myElo}</strong> — du sættes automatisk på Hold 1.
              </p>
              <div className="pm-form-2col">
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={labelStyle}>Har du booket en bane?</label>
                  <PillTabs
                    tabs={courtBookedTabs}
                    value={newMatch.court_booked === true ? "yes" : "no"}
                    onChange={(id) => {
                      const booked = id === "yes";
                      setNewMatch((m) => {
                        let nextCourtId = m.court_id;
                        if (booked) {
                          if (!nextCourtId || isMatchVenueTbd(nextCourtId)) {
                            nextCourtId = venueOptions[0]?.id ?? "";
                          }
                        } else if (!nextCourtId || !isMatchVenueTbd(nextCourtId)) {
                          nextCourtId = MATCH_VENUE_TBD;
                        }
                        return { ...m, court_booked: booked, court_id: nextCourtId };
                      });
                    }}
                    ariaLabel="Bane booket"
                    size="sm"
                    style={{ marginTop: "4px" }}
                  />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={labelStyle}>
                    {newMatch.court_booked ? "Hvilken bane er booket?" : "Hvor vil du helst spille? (valgfrit)"}
                  </label>
                  <VenueRegionPicker
                    value={newMatch.court_id}
                    onChange={(id) => setNewMatch((m) => ({ ...m, court_id: id }))}
                    options={createVenueOptions}
                    placeholder={newMatch.court_booked ? "Vælg booket center" : "Ikke valgt endnu"}
                    emptyLabel="Indlæser centre…"
                    ariaLabel={newMatch.court_booked ? "Vælg booket bane" : "Vælg foretrukket center"}
                  />
                  <p style={{ fontSize: "11px", color: theme.textLight, marginTop: "6px", lineHeight: 1.45 }}>
                    {newMatch.court_booked
                      ? "Vælg det center, hvor du har booket tid."
                      : "Vælg «Ikke valgt endnu», eller peg på et center du overvejer — du behøver ikke have booket endnu."}
                  </p>
                </div>
                <div style={{ minWidth: 0 }}>
                  <label style={labelStyle}>Dato</label>
                  <input
                    type="date"
                    value={newMatch.date}
                    min={new Date().toISOString().split("T")[0]}
                    onChange={(e) => setNewMatch((m) => ({ ...m, date: e.target.value }))}
                    style={{ ...inputStyle, fontSize: "13px", appearance: "none", WebkitAppearance: "none" }}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Starttid</label>
                  <select
                    value={newMatch.time}
                    onChange={(e) => setNewMatch((m) => ({ ...m, time: e.target.value }))}
                    style={{ ...inputStyle, fontSize: "13px" }}
                  >
                    {TIME_OPTIONS.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={labelStyle}>Varighed</label>
                  <select
                    value={newMatch.duration}
                    onChange={(e) => setNewMatch((m) => ({ ...m, duration: e.target.value }))}
                    style={{ ...inputStyle, fontSize: "13px" }}
                  >
                    <option value="60">1 time</option>
                    <option value="90">1½ time</option>
                    <option value="120">2 timer</option>
                    <option value="150">2½ timer</option>
                    <option value="180">3 timer</option>
                  </select>
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={labelStyle}>Hvilket niveau søger du?</label>
                  {(() => {
                    const lvlMin = eloToLevel(Number(newMatch.level_min) || clampElo(myElo - 100, myElo));
                    const lvlMax = eloToLevel(Number(newMatch.level_max) || clampElo(myElo + 100, myElo));
                    return (
                      <>
                        <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: "0 8px 8px", marginTop: 4 }}>
                          <LevelRangeSlider
                            minVal={lvlMin}
                            maxVal={lvlMax}
                            step={0.1}
                            onMinChange={(v) => setNewMatch((m) => ({ ...m, level_min: String(levelToElo(v)) }))}
                            onMaxChange={(v) => setNewMatch((m) => ({ ...m, level_max: String(levelToElo(v)) }))}
                          />
                        </div>
                        <p style={{ fontSize: "11px", color: theme.textLight, marginTop: "6px", lineHeight: 1.45 }}>
                          Spillere på niveau {formatPlaytomicLevelRange(lvlMin, lvlMax)} matcher kampen.
                        </p>
                      </>
                    );
                  })()}
                </div>
              </div>
              <div style={{ margin: "14px 0 0", background: "var(--pm-surface-muted)", border: "1px solid var(--pm-americano-tie-border)", borderRadius: 12, padding: "12px 14px", fontSize: 11.5, color: theme.textLight, lineHeight: 1.55 }}>
                Pris, betaling og kamptype konfigureres i næste trin.
              </div>
            </>
          )}

          {padelCreateStep === 2 && (
            <>
              <label style={{ ...labelStyle, marginTop: 0 }}>
                Beskrivelse <span style={{ fontWeight: 400, color: theme.textLight }}>(valgfrit)</span>
              </label>
              <input
                value={newMatch.description}
                onChange={(e) => setNewMatch((m) => ({ ...m, description: e.target.value }))}
                placeholder="F.eks. 'Søger venstreside-spiller' eller 'Begyndervenlig kamp'"
                style={{ ...inputStyle, marginBottom: "14px" }}
              />
              <div className="pm-form-2col" style={{ marginBottom: "14px" }}>
                <div style={{ minWidth: 0 }}>
                  <label style={labelStyle}>
                    Pris pr. person <span style={{ fontWeight: 400, color: theme.textLight }}>(valgfrit)</span>
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={newMatch.price_per_person}
                      onChange={(e) => setNewMatch((m) => ({ ...m, price_per_person: e.target.value }))}
                      placeholder="0"
                      style={{ ...inputStyle, fontSize: "13px", paddingRight: "32px" }}
                    />
                    <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: "12px", color: theme.textLight, pointerEvents: "none" }}>kr.</span>
                  </div>
                </div>
                <div style={{ minWidth: 0 }}>
                  <label style={labelStyle}>Betaling</label>
                  <select
                    value={newMatch.payment_method}
                    onChange={(e) => setNewMatch((m) => ({ ...m, payment_method: e.target.value }))}
                    style={{ ...inputStyle, fontSize: "13px" }}
                  >
                    <option value="mobilepay">MobilePay</option>
                    <option value="cash">Ved fremmøde</option>
                    <option value="free">Gratis</option>
                  </select>
                </div>
              </div>
              <label style={labelStyle}>Kamptype</label>
              <PillTabs
                tabs={matchTypeTabs}
                value={newMatch.match_type === "closed" ? "closed" : "open"}
                onChange={(id) => setNewMatch((m) => ({ ...m, match_type: id }))}
                ariaLabel="Kamptype"
                size="sm"
                style={{ marginTop: "4px" }}
              />
              <p style={{ fontSize: "11px", color: theme.textLight, marginTop: "6px", lineHeight: 1.45 }}>
                {newMatch.match_type === "open"
                  ? "Alle kan tilmelde sig direkte."
                  : "Alle kan se kampen, men skal anmode om at deltage — du godkender selv."}
              </p>
            </>
          )}

          {padelCreateStep === 3 && (() => {
            const courtLabel = courtNameFromVenueSelection(newMatch.court_id, createVenueOptions) || "Ikke valgt endnu";
            const lvlMin = eloToLevel(Number(newMatch.level_min) || clampElo(myElo - 100, myElo));
            const lvlMax = eloToLevel(Number(newMatch.level_max) || clampElo(myElo + 100, myElo));
            const startM = timeToMinutes(newMatch.time);
            const dur = parseInt(newMatch.duration, 10) || 120;
            const endM = Number.isFinite(startM) ? startM + dur : null;
            const endTime = endM != null
              ? `${String(Math.floor(endM / 60) % 24).padStart(2, "0")}:${String(endM % 60).padStart(2, "0")}`
              : "";
            const paymentLabels = { mobilepay: "MobilePay", cash: "Ved fremmøde", free: "Gratis" };
            const priceNum = newMatch.payment_method === "free"
              ? 0
              : parseFloat(String(newMatch.price_per_person).replace(",", "."));
            const priceLabel = newMatch.payment_method === "free" || !Number.isFinite(priceNum) || priceNum <= 0
              ? "Gratis"
              : `${priceNum % 1 === 0 ? priceNum : priceNum.toFixed(2).replace(".", ",")} kr.`;
            const dateLabel = newMatch.date
              ? new Date(`${newMatch.date}T12:00:00`).toLocaleDateString("da-DK", { weekday: "long", day: "numeric", month: "long" })
              : "—";
            const summaryRows = [
              { label: "Bane", value: courtLabel },
              { label: "Tid", value: `${dateLabel} · ${newMatch.time}${endTime ? `–${endTime}` : ""}` },
              { label: "Niveau", value: formatMatchLevelRangeLabel(newMatch.level_min, newMatch.level_max) || `Niveau ${formatPlaytomicLevelRange(lvlMin, lvlMax)}` },
              { label: "Kamptype", value: newMatch.match_type === "closed" ? "Lukket (godkendelse)" : "Åben" },
              { label: "Pris", value: `${priceLabel} · ${paymentLabels[newMatch.payment_method] || newMatch.payment_method}` },
            ];
            if (newMatch.description?.trim()) {
              summaryRows.push({ label: "Beskrivelse", value: newMatch.description.trim() });
            }
            return (
              <>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: theme.textLight, textTransform: "uppercase", letterSpacing: "1.2px", margin: "0 0 10px" }}>
                  Opsummering
                </div>
                <div style={{ margin: "0 0 14px", border: `1px solid ${theme.border}`, borderRadius: 14, background: theme.surface, overflow: "hidden" }}>
                  {summaryRows.map((row, i) => (
                    <div
                      key={row.label}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "baseline",
                        gap: 8,
                        padding: "9px 14px",
                        borderBottom: i < summaryRows.length - 1 ? `1px solid ${theme.border}` : "none",
                      }}
                    >
                      <span style={{ fontSize: 12.5, color: theme.textLight, flexShrink: 0 }}>{row.label}</span>
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: theme.text, textAlign: "right" }}>{row.value}</span>
                    </div>
                  ))}
                </div>
                <div style={{ background: "var(--pm-surface-muted)", border: "1px solid var(--pm-americano-tie-border)", borderRadius: 12, padding: "12px 14px", fontSize: 11.5, color: theme.textLight, lineHeight: 1.6, marginBottom: 4 }}>
                  Kampen bliver synlig for spillere i dit område og niveau-interval. Du kan redigere detaljer ved at gå tilbage.
                </div>
              </>
            );
          })()}

          {padelCreateStepErr && (
            <div style={{ margin: "12px 0 0", color: theme.red, fontSize: 12 }}>{padelCreateStepErr}</div>
          )}

          <div className="pm-form-submit pm-form-submit-actions" style={{ marginTop: 16 }}>
            {padelCreateStep > 1 ? (
              <button
                type="button"
                onClick={() => { setPadelCreateStep((s) => s - 1); setPadelCreateStepErr(""); }}
                disabled={creating}
                style={{ ...btn(false, { size: "md", fontWeight: 600 }), flex: 1 }}
              >
                ← Tilbage
              </button>
            ) : (
              <button
                type="button"
                onClick={() => { setShowCreate(false); setPadelCreateStep(1); setPadelCreateStepErr(""); }}
                disabled={creating}
                style={{ ...btn(false, { size: "md", fontWeight: 600 }), flex: 1 }}
              >
                Annullér
              </button>
            )}
            {padelCreateStep < 3 ? (
              <button
                type="button"
                onClick={goPadelCreateNext}
                style={{ ...btn(true, { size: "md", fontWeight: 600 }), flex: 2 }}
              >
                {padelCreateStep === 1 ? "Næste: Pris & kamptype →" : "Næste: Bekræft →"}
              </button>
            ) : (
              <button
                type="button"
                onClick={createMatch}
                disabled={
                  creating ||
                  venueOptions.length === 0 ||
                  (newMatch.court_booked && (!newMatch.court_id || isMatchVenueTbd(newMatch.court_id)))
                }
                style={{ ...btn(true, { size: "md", fontWeight: 600 }), flex: 2, opacity: creating ? 0.55 : 1 }}
              >
                {creating ? "Opretter..." : "Opret kamp ✓"}
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="pm-help-box" style={{ marginBottom: 16 }}>
            <button
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
                  Der er ikke oprettet nogen kampe, der matcher dine filtre lige nu. Opret den første – eller udvid din søgning.
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
        </>
      )}

      {/* Team selection modal */}
      {teamSelectMatch && (
        <TeamSelectModal
          matchPlayers={matchPlayers[teamSelectMatch] || []}
          onSelect={(teamNum) => joinMatchWithTeam(teamSelectMatch, teamNum)}
          onClose={() => setTeamSelectMatch(null)}
        />
      )}

      {/* Result input modal */}
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

      {/* Confirm result modal */}
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

      {/* Player profile modal */}
      {viewPlayer && <PlayerProfileModal player={viewPlayer} onClose={() => setViewPlayer(null)} />}

      {detailMatch && detailBundle ? (
        <KampeMatchDetailSheet
          open
          onClose={() => setDetailMatchId(null)}
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
          isAdmin={isAdmin}
          currentUserId={user.id}
          onSwitchTeam={switchTeam}
          onSwitchPlayerTeam={switchPlayerTeam}
          onKickPlayer={kickPlayer}
          onProfileClick={(prof) => setViewPlayer(prof)}
          managePanel={renderDetailManagePanel(detailMatch, detailBundle)}
          facilities={courts.find((c) => String(c.id) === String(detailMatch.court_id))?.facilities || []}
          onRematch={detailBundle.status === 'completed' ? () => handleRematch(detailMatch) : undefined}
          reportErrorNode={detailBundle.status === 'completed' ? renderResultErrorControl(detailMatch, detailBundle) : null}
        />
      ) : null}

      {adminPinGateOpen ? (
        <AdminPinGate
          userId={user?.id}
          showToast={showToast}
          onUnlocked={() => {
            setAdminPinGateOpen(false);
            void refreshAdminPinSession();
          }}
          onCancel={() => setAdminPinGateOpen(false)}
        />
      ) : null}
      </>
      )}
      </>
      )}

      {/* Kamp oprettet kvittering */}
      {createdMatchReceipt && (() => {
        const m = createdMatchReceipt;
        const matchPrefs = parseMatchLevelRange(m.level_range);
        const levelStr = formatMatchLevelRangeLabel(matchPrefs?.min, matchPrefs?.max);
        const isClosed = m.match_type === 'closed';
        const court = m.court_name?.trim() || null;
        const datePart = m.date ? formatMatchDateDa(m.date) : '';
        const timePart = matchTimeLabel(m);
        const timeStr = timePart && timePart !== '—' ? `Kl. ${timePart}` : '';
        const matchUrl = typeof window !== 'undefined'
          ? `${window.location.origin}/dashboard/kampe#pm-match-${m.id}`
          : '';
        const handleCopy = () => {
          if (!matchUrl) return;
          navigator.clipboard?.writeText(matchUrl).then(() => {
            setReceiptUrlCopied(true);
            setTimeout(() => setReceiptUrlCopied(false), 2000);
          }).catch(() => showToast('Kopiering mislykkedes'));
        };
        return (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 1200,
            background: theme.bg, display: 'flex', flexDirection: 'column',
            fontFamily: font,
          }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', padding: 'max(10px, calc(env(safe-area-inset-top) + 8px)) 14px 10px', borderBottom: '1px solid ' + theme.border, background: theme.surface, flexShrink: 0 }}>
              <h2 style={{ flex: 1, fontSize: 17, fontWeight: 800, letterSpacing: '-0.02em', margin: 0, textAlign: 'center' }}>PadelMakker</h2>
            </div>

            {/* Scrollable content */}
            <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 80 }}>
              {/* Checkmark */}
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 24 }}>
                <div style={{
                  width: 72, height: 72, borderRadius: '50%',
                  background: theme.navy, color: 'var(--pm-on-accent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Check size={32} strokeWidth={2.8} />
                </div>
              </div>

              {/* Title */}
              <div style={{ textAlign: 'center', padding: '16px 32px 0' }}>
                <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-0.3px', color: theme.text }}>Kamp oprettet!</div>
                <p style={{ fontSize: 12.5, color: theme.textMid, marginTop: 6, marginBottom: 0 }}>
                  {isClosed ? 'Din lukkede kamp er klar – invitér dine spillere.' : 'Din kamp er nu synlig for andre spillere.'}
                </p>
              </div>

              {/* Summary card */}
              <div style={{ margin: '16px 18px 0', background: theme.surface, borderRadius: 16, border: '1px solid ' + theme.border, padding: '14px 16px' }}>
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ background: theme.navy, color: 'var(--pm-on-accent)', borderRadius: 6, padding: '3px 9px', fontSize: 11.5, fontWeight: 700, letterSpacing: '0.04em' }}>
                    {isClosed ? 'LUKKET' : '2V2'}
                  </span>
                  {levelStr && (
                    <span style={{ background: theme.accentBg, color: theme.accent, borderRadius: 6, padding: '3px 9px', fontSize: 11.5, fontWeight: 600 }}>
                      {levelStr}
                    </span>
                  )}
                </div>

                {/* Date + time row */}
                {(datePart || timeStr) && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 12 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: theme.surfaceAlt, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <CalendarDays size={14} color={theme.textMid} />
                    </div>
                    <div style={{ fontSize: 12.5, lineHeight: 1.55 }}>
                      {datePart && <b style={{ color: theme.text, display: 'block' }}>{datePart}</b>}
                      {timeStr && <span style={{ color: theme.textMid }}>{timeStr}</span>}
                    </div>
                  </div>
                )}

                {/* Location row */}
                {court && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: theme.surfaceAlt, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <MapPin size={14} color={theme.textMid} />
                    </div>
                    <div style={{ fontSize: 12.5, lineHeight: 1.55 }}>
                      <b style={{ color: theme.text }}>{court}</b>
                    </div>
                  </div>
                )}

                {/* Slots row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 13, paddingTop: 12, borderTop: '1px solid ' + theme.border }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: theme.navy, color: 'var(--pm-on-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>
                      {(user?.avatar || '🎾')}
                    </div>
                  </div>
                  <span style={{ fontSize: 11.5, color: theme.textMid, fontWeight: 600 }}>1/4 pladser optaget</span>
                </div>
              </div>

              {/* Share section */}
              <div style={{ fontSize: 11, fontWeight: 700, color: theme.textMid, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '16px 18px 8px' }}>
                Del kamp
              </div>
              <div style={{ margin: '0 18px 12px', background: theme.surface, borderRadius: 10, border: '1px solid ' + theme.border, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px' }}>
                <span style={{ flex: 1, fontSize: 12, color: theme.textMid, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {matchUrl || 'padelmakker.dk/kamp/…'}
                </span>
                <button
                  type="button"
                  onClick={handleCopy}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, padding: '5px 10px', borderRadius: 7, border: '1px solid ' + theme.border, background: theme.surfaceAlt, color: receiptUrlCopied ? theme.green : theme.textMid, cursor: 'pointer', flexShrink: 0, fontFamily: font }}
                >
                  <Copy size={12} />
                  {receiptUrlCopied ? 'Kopieret!' : 'Kopiér'}
                </button>
              </div>

              {/* Action buttons */}
              <div style={{ padding: '0 18px', display: 'flex', flexDirection: 'column', gap: 9 }}>
                <button
                  type="button"
                  onClick={() => void shareMatch(m)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '11px 16px', borderRadius: 10, border: '1px solid ' + theme.border, background: theme.surface, color: theme.text, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: font }}
                >
                  <Share2 size={15} />
                  Send invitation til venner
                </button>
                <button
                  type="button"
                  onClick={() => addMatchToCalendar(m)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '11px 16px', borderRadius: 10, border: '1px solid ' + theme.border, background: theme.surface, color: theme.text, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: font }}
                >
                  <CalendarPlus size={15} />
                  Tilføj til kalender
                </button>
              </div>
            </div>

            {/* CTA bar */}
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '12px 18px', background: theme.surface, borderTop: '1px solid ' + theme.border }}>
              <button
                type="button"
                onClick={() => { setCreatedMatchReceipt(null); setViewTab('open'); }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '13px 16px', borderRadius: 12, border: 'none', background: theme.navy, color: 'var(--pm-on-accent)', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: font }}
              >
                Gå til kamp-oversigt
                <ArrowRight size={16} strokeWidth={2.4} />
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

