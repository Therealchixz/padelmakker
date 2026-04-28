import { useState, useEffect, useMemo, useCallback, useRef, lazy, Suspense } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { useConfirm } from '../lib/ConfirmDialogProvider';
import { Profile, Court } from '../api/base44Client';
import { supabase } from '../lib/supabase';
import { readKampeSessionPrefs, mergeKampeSessionPrefs } from '../lib/kampeSessionPrefs';
const AmericanoTab = lazy(() =>
  import('../features/americano/AmericanoTab').then(m => ({ default: m.AmericanoTab }))
);
import { LigaTab as LigaTabEmbed } from './LigaTab';
import { theme, btn, inputStyle, labelStyle, heading } from '../lib/platformTheme';
import { resolveDisplayName, sanitizeText } from '../lib/platformUtils';
import { statsFromEloHistoryRows, useProfileEloBundle, fetchEloByUserIdFromHistory } from '../lib/eloHistoryUtils';
import { eloOf, fmtClock, matchTimeLabel, timeToMinutes, matchCompletedSortMs, formatMatchDateDa } from '../lib/matchDisplayUtils';
import { calculateAndApplyElo } from '../lib/applyEloMatch';
import { createNotification } from '../lib/notifications';
import { activateSeekingPlayer, deactivateSeekingPlayer } from '../lib/seekingPlayerUtils';
import { fetchMatchMessages, sendMatchMessage, subscribeToMatchMessages } from '../lib/matchChatUtils';
import { formatMatchResultScore } from '../lib/matchResultScore';
import { submitPadelMatchResult } from '../lib/submitPadelMatchResult';
import { confirmPadelMatchResult, rejectPadelMatchResult } from '../lib/resolvePadelMatchResult';
import { KAMPE_NON_CHAT_NOTIFICATION_TYPES as KAMPE_NON_CHAT_NOTIF_TYPES } from '../lib/kampeNotificationTypes';
import { groupUnreadNotificationsByMatchId, removeUnreadForMatch, shouldRefreshKampeUnreadForNotificationType } from '../lib/kampeNotificationBadges';
import { buildMatchCardState } from '../lib/matchCardState';
import { buildKampeMatchLists } from '../lib/matchListFilters';
import { fetchRowsInChunks } from '../lib/supabaseChunkFetch';
import { DateTime } from 'luxon';
import { Clock, MapPin, Plus, UserMinus, Trash2, Zap, ChevronDown, ChevronUp, MessageCircle, SendHorizontal, CalendarPlus } from 'lucide-react';
import { TeamSelectModal } from './TeamSelectModal';
import { ResultModal } from './ResultModal';
import { PlayerProfileModal } from './PlayerProfileModal';
import { AvatarCircle } from '../components/AvatarCircle';
import { PillTabs } from '../components/PillTabs';
import { ScopeSearchControls } from '../components/ScopeSearchControls';
import { TabbedFilterCard } from '../components/TabbedFilterCard';
import {
  getMatchVenueOptions,
  courtIdFromVenueSelection,
  courtNameFromVenueSelection,
} from '../lib/matchVenueOptions';

function matchPlayerTeam(p) {
  return Number(p?.team);
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

function TabBadge({ count }) {
  if (!count) return null;
  return (
    <span
      aria-label={`${count} ulæste notifikationer`}
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
        marginLeft: "6px",
        verticalAlign: "middle",
      }}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
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

function clampElo(val, fallback = 1000) {
  const n = Number(val);
  if (!Number.isFinite(n)) return Math.round(fallback);
  return Math.max(400, Math.min(3000, Math.round(n)));
}

function parseMatchLevelRange(raw) {
  const txt = String(raw || "").trim();
  if (!txt) return { min: null, max: null, booked: null };

  const eloPart = /elo:(\d{2,4})-(\d{2,4})/i.exec(txt);
  const bookedPart = /booked:(yes|no)/i.exec(txt);
  if (eloPart || bookedPart) {
    const a = eloPart ? clampElo(eloPart[1]) : null;
    const b = eloPart ? clampElo(eloPart[2]) : null;
    return {
      min: a != null && b != null ? Math.min(a, b) : null,
      max: a != null && b != null ? Math.max(a, b) : null,
      booked: bookedPart ? bookedPart[1].toLowerCase() === "yes" : null,
    };
  }

  const classicRange = /^(\d{2,4})\s*-\s*(\d{2,4})$/.exec(txt);
  if (classicRange) {
    const a = clampElo(classicRange[1]);
    const b = clampElo(classicRange[2]);
    return { min: Math.min(a, b), max: Math.max(a, b), booked: null };
  }

  const single = /^(\d{2,4})$/.exec(txt);
  if (single) {
    const s = clampElo(single[1]);
    return { min: s, max: s, booked: null };
  }

  return { min: null, max: null, booked: null };
}

function buildMatchLevelRange(levelMin, levelMax, courtBooked, myElo) {
  const fallback = clampElo(myElo || 1000);
  const a = clampElo(levelMin, fallback - 100);
  const b = clampElo(levelMax, fallback + 100);
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  const bookedTag = courtBooked ? "yes" : "no";
  return `elo:${lo}-${hi}|booked:${bookedTag}`;
}

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
  const myDisplayName                 = resolveDisplayName(user, authUser);
  const eloSyncKeyKampe = `${user.elo_rating}|${user.games_played}|${user.games_won}`;
  const { profileFresh: kampeProfileFresh, ratedRows: kampeRatedRows, reloadProfileEloBundle: reloadKampeEloBundle } =
    useProfileEloBundle(user.id, eloSyncKeyKampe);
  const [showCreate, setShowCreate]   = useState(false);
  const [showAmericanoCreate, setShowAmericanoCreate] = useState(false);
  const [showLigaCreate, setShowLigaCreate] = useState(false);
  const [courts, setCourts]           = useState([]);
  const [matches, setMatches]         = useState([]);
  const [matchPlayers, setMatchPlayers] = useState({});
  const [matchResults, setMatchResults] = useState({});
  const [loadingMatches, setLoadingMatches] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [creating, setCreating]       = useState(false);
  const [busyId, setBusyId]           = useState(null);
  /** ELO fra elo_history pr. user_id — samme som profil; virker på tværs af profiler når RLS skjuler andres profiles.elo_rating */
  const [eloFromHistoryByUserId, setEloFromHistoryByUserId] = useState({});
  const [eloByUserId, setEloByUserId] = useState({});
  const [teamSelectMatch, setTeamSelectMatch] = useState(null);
  const [resultMatch, setResultMatch] = useState(null);
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
  const [padelHelpOpen, setPadelHelpOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [joinRequests, setJoinRequests] = useState({}); // { [matchId]: [{ id, user_id, user_name, user_emoji, status }] }
  const [matchChatOpenById, setMatchChatOpenById] = useState({});
  const [matchChatById, setMatchChatById] = useState({});
  const [matchChatDraftById, setMatchChatDraftById] = useState({});
  const [matchChatLoadingById, setMatchChatLoadingById] = useState({});
  const [matchChatSendingById, setMatchChatSendingById] = useState({});
  const [matchChatErrorById, setMatchChatErrorById] = useState({});
  const [matchChatUnreadById, setMatchChatUnreadById] = useState({});
  const [matchUnreadById, setMatchUnreadById] = useState({});
  const matchUnreadByIdRef = useRef({});
  useEffect(() => {
    matchUnreadByIdRef.current = matchUnreadById;
  }, [matchUnreadById]);
  const matchCardObserverRef = useRef(null);
  const matchCardDwellTimersRef = useRef(new Map());
  const matchChatListRefs = useRef({});
  const [newMatch, setNewMatch]       = useState({
    court_id: "",
    date: new Date().toISOString().split("T")[0],
    time: nearestHalfHour(),
    duration: "120",
    court_booked: false,
    level_min: "",
    level_max: "",
    description: "",
    match_type: "open",
  });

  /**
   * Samme rækkefølge som ProfilTab: elo_history først (sand nuværende rating), derefter frisk
   * profiles-række, derefter bulk-liste (kan være bagud ift. DB), til sidst context.
   * Ellers vises 1000 fra Profile.filter() selvom profilen viser 1020 fra historik.
   */
  const myUidStr = String(user.id);
  const venueOptions = useMemo(() => getMatchVenueOptions(courts), [courts]);

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

  /** ELO-ændring pr. match for den loggede bruger — til visning på afsluttede kampkort */
  const eloChangeByMatchId = useMemo(() => {
    const map = {};
    for (const row of kampeRatedRows) {
      if (row.match_id) map[String(row.match_id)] = Number(row.change);
    }
    return map;
  }, [kampeRatedRows]);

  const loadData = useCallback(async () => {
    setLoadingMatches(true);
    setLoadError("");
    try {
      const uid = user.id;
      const [cd, profiles, openPoolRes, createdRes, myMpRes] = await Promise.all([
        Court.filter(),
        Profile.filter(),
        supabase
          .from("matches")
          .select("*")
          .in("status", ["open", "full", "in_progress"])
          .order("date", { ascending: true })
          .limit(400),
        supabase.from("matches").select("*").eq("creator_id", uid),
        supabase.from("match_players").select("match_id").eq("user_id", uid).limit(2000),
      ]);
      if (openPoolRes.error) throw openPoolRes.error;
      if (createdRes.error) throw createdRes.error;
      if (myMpRes.error) throw myMpRes.error;

      setCourts(cd || []);
      const eloMap = {};
      const pById = {};
      (profiles || []).forEach((pr) => {
        const id = String(pr.id);
        eloMap[id] = eloOf(pr);
        pById[id] = pr;
      });

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

      const allMatchIds = [...idSet];

      const allMatches =
        allMatchIds.length > 0 ? await fetchRowsInChunks(supabase, "matches", "id", allMatchIds) : [];
      setMatches(allMatches);

      const vOpts = getMatchVenueOptions(cd || []);
      if (vOpts.length > 0) {
        setNewMatch((m) => {
          if (m.court_id && vOpts.some((o) => o.id === m.court_id)) return m;
          return { ...m, court_id: vOpts[0].id };
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
      const histEloMap = await fetchEloByUserIdFromHistory([...idsForHist]);
      setEloFromHistoryByUserId(histEloMap);

      setEloByUserId(eloMap);
      setProfilesById(pById);
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

      // Load join requests (RLS returns: own requests + requests for matches I created)
      if (allMatchIds.length > 0) {
        const jrMap = {};
        const { data: jrd } = await supabase
          .from("match_join_requests")
          .select("*")
          .in("match_id", allMatchIds.slice(0, 100)); // first chunk — closed matches will be few
        (jrd || []).forEach((jr) => {
          if (!jrMap[jr.match_id]) jrMap[jr.match_id] = [];
          jrMap[jr.match_id].push(jr);
        });
        setJoinRequests(jrMap);
      }
    } catch (e) {
      console.error(e);
      setLoadError("Kunne ikke hente kampe lige nu.");
      showToast('Kunne ikke hente data. Tjek din forbindelse og prøv igen.');
    } finally {
      setLoadingMatches(false);
      void reloadKampeEloBundle();
    }
  }, [user.id, showToast, reloadKampeEloBundle]);

  useEffect(() => { void loadData(); }, [loadData]);

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
        .select("id, match_id")
        .eq("user_id", user.id)
        .eq("read", false)
        .in("type", KAMPE_NON_CHAT_NOTIF_TYPES)
        .not("match_id", "is", null)
        .limit(500);
      if (error) throw error;
      setMatchUnreadById(groupUnreadNotificationsByMatchId(data));
    } catch (e) {
      console.warn("match unread notifications:", e?.message || e);
    }
  }, [user?.id]);

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
          } else if (refreshTarget === "match") {
            void loadMatchUnreadCounts();
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
      .in("type", KAMPE_NON_CHAT_NOTIF_TYPES)
      .eq("match_id", key)
      .eq("read", false);
    if (error) {
      console.warn("mark match notifications read:", error.message || error);
      void loadMatchUnreadCounts();
    } else if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("pm-notifications-sync"));
    }
  }, [loadMatchUnreadCounts, user?.id]);

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
        setMatchChatById((prev) => {
          const current = prev[matchId] || [];
          if (current.some((m) => String(m.id) === String(incoming.id))) return prev;
          const next = [...current, incoming];
          return { ...prev, [matchId]: next.slice(-120) };
        });
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

  /* Notifikation: ?focus=<matchId> — vælg underfane, scroll til kort, fjern query */
  useEffect(() => {
    if (!tabActive || loadingMatches) return;
    const params = new URLSearchParams(location.search);
    const mid = params.get("focus");
    if (!mid) return;
    if (!matches.length) return;
    const m = matches.find((x) => String(x.id) === String(mid));
    if (!m) {
      navigate("/dashboard/kampe", { replace: true });
      return;
    }
    const st = (m.status ?? "open").toString().toLowerCase();
    const mp = matchPlayers[m.id] || [];
    const imIn = mp.some((p) => p.user_id === user.id);
    if (st === "in_progress" && imIn) setViewTab("active");
    else if (st === "completed" && imIn) setViewTab("completed");
    else setViewTab("open");
    navigate("/dashboard/kampe", { replace: true });
    const t = window.setTimeout(() => {
      document.getElementById("pm-match-" + String(mid))?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 200);
    return () => window.clearTimeout(t);
  }, [tabActive, loadingMatches, matches, matchPlayers, user.id, location.search, navigate]);

  const createMatch = async () => {
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
      const cid = courtIdFromVenueSelection(newMatch.court_id, venueOptions);
      const cname = courtNameFromVenueSelection(newMatch.court_id, venueOptions);
      const row = {
        creator_id: user.id, court_id: cid, court_name: cname || '',
        date: newMatch.date, time: fmtClock(newMatch.time), time_end: timeEnd,
        level_range: buildMatchLevelRange(newMatch.level_min, newMatch.level_max, newMatch.court_booked, myElo),
        status: "open", max_players: 4, current_players: 1,
        description: sanitizeText(newMatch.description.trim()) || null,
        match_type: newMatch.match_type || "open",
      };
      const { data: created, error } = await supabase.from("matches").insert(row).select().single();
      if (error) throw error;
      await supabase.from("match_players").insert({
        match_id: created.id, user_id: user.id, user_name: myDisplayName,
        user_email: authUser?.email || user.email, user_emoji: user.avatar || "🎾", team: 1,
      });
      setShowCreate(false);
      showToast(newMatch.match_type === "closed" ? "Lukket kamp oprettet! Du er på Hold 1 🔒" : "Kamp oprettet! Du er på Hold 1 🎾");
      await loadData();
    } catch (e) { showToast("Fejl: " + (e.message || "Prøv igen")); }
    finally { setCreating(false); }
  };

  const joinMatchWithTeam = async (matchId, teamNum) => {
    setTeamSelectMatch(null);
    setBusyId(matchId);
    try {
      const { error } = await supabase.from("match_players").insert({
        match_id: matchId, user_id: user.id, user_name: myDisplayName,
        user_email: authUser?.email || user.email, user_emoji: user.avatar || "🎾", team: teamNum,
      });
      if (error) throw error;

      // Check if match is now full (4 players, 2 per team)
      const mp = [...(matchPlayers[matchId] || []), { user_id: user.id, team: teamNum }];
      const t1 = mp.filter(p => matchPlayerTeam(p) === 1).length;
      const t2 = mp.filter(p => matchPlayerTeam(p) === 2).length;
      if (t1 >= 2 && t2 >= 2) {
        await supabase.from("matches").update({ status: "full", current_players: 4, seeking_player: false }).eq("id", matchId);
      } else {
        await supabase.from("matches").update({ current_players: mp.length }).eq("id", matchId);
      }

      /* Underret opretter via RPC (læser creator_id server-side — RLS kan skjule creator for B) */
      {
        const { error: nErr } = await supabase.rpc("notify_match_creator_on_join", {
          p_match_id: matchId,
          p_title: "Ny spiller tilmeldt!",
          p_body: `${myDisplayName} har tilmeldt sig Hold ${teamNum} i din kamp.`,
        });
        if (nErr) {
          console.warn("notify_match_creator_on_join:", nErr.message || nErr);
          showToast(
            "Tilmelding gemt, men notifikation fejlede. Kør opdateret create_notification_rpc.sql (notify_match_creator_on_join) i Supabase."
          );
        }
      }
      // Notify all players if match is now full
      if (t1 >= 2 && t2 >= 2) {
        mp.filter(p => p.user_id !== user.id).forEach(p => {
          createNotification(p.user_id, "match_full", "Kampen er fuld! 🎾", "Alle 4 pladser er fyldt — kampen er klar til at starte.", matchId);
        });
      }

      showToast(`Du er tilmeldt Hold ${teamNum}! ⚔️`);
      await loadData();
    } catch (e) { showToast("Fejl: " + (e.message || "Prøv igen")); }
    finally { setBusyId(null); }
  };

  const switchTeam = async (matchId, newTeam) => {
    setBusyId(matchId + '-switch');
    try {
      const { error } = await supabase
        .from("match_players")
        .update({ team: newTeam })
        .eq("match_id", matchId)
        .eq("user_id", user.id);
      if (error) throw error;
      showToast(`Skiftet til Hold ${newTeam}! ⚔️`);
      await loadData();
    } catch (e) { showToast("Fejl: " + (e.message || "Prøv igen")); }
    finally { setBusyId(null); }
  };

  const leaveMatch = async (matchId) => {
    const match = matches.find(m => m.id === matchId);
    if (!match) return;
    const status = getStatus(match);
    if (status === "in_progress" || status === "completed") {
      showToast("Du kan ikke afmelde dig en kamp, der er i gang eller afsluttet.");
      return;
    }

    setBusyId(matchId);
    try {
      // Notify creator BEFORE delete (while still in match_players so RPC check passes)
      const isCreator = match && String(match.creator_id) === String(user.id);
      if (!isCreator && match?.creator_id) {
        await createNotification(match.creator_id, 'match_cancelled', 'Spiller afmeldt ❌', `${myDisplayName} er afmeldt kampen.`, matchId);
      }
      const { error } = await supabase.from("match_players").delete().eq("match_id", matchId).eq("user_id", user.id);
      if (error) throw error;
      const mp = (matchPlayers[matchId] || []).filter(p => p.user_id !== user.id);

      if (mp.length === 0) {
        await supabase.from("matches").update({ status: "cancelled", current_players: 0 }).eq("id", matchId);
        showToast("Kampen er slettet (ingen spillere tilbage).");
      } else if (isCreator) {
        await supabase.from("matches").update({ creator_id: mp[0].user_id, status: "open", current_players: mp.length }).eq("id", matchId);
        showToast("Du er afmeldt. Kampen er givet videre.");
      } else {
        await supabase.from("matches").update({ status: "open", current_players: mp.length }).eq("id", matchId);
        showToast("Du er afmeldt.");
      }
      await loadData();
    } catch (e) { showToast("Fejl: " + (e.message || "Prøv igen")); }
    finally { setBusyId(null); }
  };

  // ---- Join request functions (for closed matches) ----

  const requestJoin = async (matchId) => {
    setBusyId(matchId + '-req');
    try {
      const { error } = await supabase.from("match_join_requests").insert({
        match_id: matchId,
        user_id: user.id,
        user_name: myDisplayName,
        user_emoji: user.avatar || "🎾",
        status: "pending",
      });
      if (error) throw error;
      // Notify creator via dedikeret RPC (kræver IKKE at ansøger er i match_players)
      const { error: nErr } = await supabase.rpc("notify_creator_join_request", {
        p_match_id: matchId,
        p_title: "Ny tilmeldingsanmodning 🔒",
        p_body: `${myDisplayName} anmoder om at deltage i din lukkede kamp.`,
      });
      if (nErr) console.warn("notify_creator_join_request:", nErr.message || nErr);
      showToast("Anmodning sendt! Venter på godkendelse 🔒");
      await loadData();
    } catch (e) {
      if (e.code === "23505") {
        showToast("Du har allerede anmodet om at deltage i denne kamp.");
      } else {
        showToast("Fejl: " + (e.message || "Prøv igen"));
      }
    }
    finally { setBusyId(null); }
  };

  const cancelJoinRequest = async (matchId) => {
    setBusyId(matchId + '-req');
    try {
      const { error } = await supabase.from("match_join_requests")
        .delete().eq("match_id", matchId).eq("user_id", user.id);
      if (error) throw error;
      showToast("Anmodning trukket tilbage.");
      await loadData();
    } catch (e) { showToast("Fejl: " + (e.message || "Prøv igen")); }
    finally { setBusyId(null); }
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
      createNotification(reqUserId, "match_invite", "Anmodning godkendt! 🎾",
        `${myDisplayName} har godkendt din tilmeldingsanmodning. Du er sat på Hold ${teamNum}.`, matchId);

      showToast(`${reqUserName} er godkendt og sat på Hold ${teamNum}!`);
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

      // Notify the rejected user
      createNotification(reqUserId, "match_cancelled", "Anmodning afvist",
        `Din anmodning om at deltage i kampen er desværre ikke godkendt.`, matchId);

      showToast(`Anmodning fra ${reqUserName} afvist.`);
      await loadData();
    } catch (e) { showToast("Fejl: " + (e.message || "Prøv igen")); }
    finally { setBusyId(null); }
  };

  // ---- End join request functions ----

  const kickPlayer = async (matchId, targetUserId, targetName = "spilleren") => {
    const label = String(targetName || "spilleren").trim();
    const actor = isAdmin ? "admin" : "kampopretter";
    const ok = await ask({
      message: `Er du sikker på, at du vil smide ${label} ud af kampen som ${actor}?`,
      confirmLabel: "Ja, smid ud",
      danger: true,
    });
    if (!ok) return;

    setBusyId(matchId + '-kick-' + targetUserId);
    try {
      const { error } = await supabase.from("match_players").delete()
        .eq("match_id", matchId).eq("user_id", targetUserId);
      if (error) throw error;
      const mp = (matchPlayers[matchId] || []).filter(p => p.user_id !== targetUserId);
      await supabase.from("matches").update({ status: "open", current_players: mp.length }).eq("id", matchId);
      // Notify kicked player (caller is still creator → RPC check passes)
      createNotification(targetUserId, 'match_cancelled', 'Du er fjernet fra kampen ❌', `En admin/opretter har fjernet dig fra kampen.`, matchId);
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

    if (!isFull && !isAdmin) {
      showToast("Kampen kan kun startes når der er 2 spillere på hvert hold (2 mod 2).");
      return;
    }

    if (!isFull && isAdmin) {
      const ok = await ask({
        message: "Kampen er ikke fuld endnu. Vil du gennemtvinge start som admin?",
        confirmLabel: "Ja, start nu",
      });
      if (!ok) return;
    } else if (isAdmin && !matchPlayers[matchId]?.some(p => p.user_id === user.id)) {
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
    if (status === "completed" && !isAdmin) {
      showToast("Du kan ikke slette en afsluttet kamp.");
      return;
    }

    const mp = matchPlayers[matchId] || [];
    const others = mp.filter(p => p.user_id !== user.id);
    const msg = isAdmin 
      ? `Slet denne kamp som admin? Dette kan ikke fortrydes.`
      : others.length > 0
      ? `Slet denne kamp? ${others.length} andre spillere bliver også afmeldt.`
      : "Slet denne kamp?";

    const ok = await ask({
      message: msg,
      confirmLabel: "Ja, slet",
      danger: true,
    });
    if (!ok) return;
    setBusyId(matchId);
    try {
      const mpBefore = matchPlayers[matchId] || [];
      await supabase.from("match_players").delete().eq("match_id", matchId);
      // Admin kan slette ALLE kampe, ellers kun egne
      let q = supabase.from("matches").update({ status: "cancelled", current_players: 0 }).eq("id", matchId);
      if (!isAdmin) q = q.eq("creator_id", user.id);
      
      const { error } = await q;
      if (error) throw error;

      mpBefore.filter(p => p.user_id !== user.id).forEach(p => {
        createNotification(p.user_id, "match_cancelled", "Kamp aflyst ❌", isAdmin ? "En admin har aflyst kampen." : `${myDisplayName} har aflyst kampen.`, matchId);
      });
      showToast("Kamp slettet.");
      await loadData();
    } catch (e) { showToast("Fejl: " + (e.message || "Prøv igen")); }
    finally { setBusyId(null); }
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
      const allProfilesList = Object.values(profilesById);

      const { notified, error } = await activateSeekingPlayer(
        match, creatorProfile, allProfilesList, playerIds
      );

      if (error) {
        showToast(error);
        return;
      }

      if (notified > 0) {
        showToast(`⚡ ${notified} spillere er notificeret!`);
      } else {
        showToast('Kampen er markeret som "søger spiller" — ingen matchende spillere fundet lige nu.');
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
    const intervalId = setInterval(refreshOpenChats, 7000);
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
      clearInterval(intervalId);
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
    const results = await Promise.allSettled(
      recipientIds.map((recipientId) =>
        createNotification(recipientId, "match_chat", title, body, matchId)
      )
    );
    const hasErrors = results.some((result) => (
      result.status === "rejected"
      || (result.status === "fulfilled" && result.value)
    ));
    if (hasErrors) console.warn("match chat notification: en eller flere notifikationer fejlede");
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
        setMatchChatById((prev) => {
          const current = prev[matchId] || [];
          if (current.some((m) => String(m.id) === String(created.id))) return prev;
          return { ...prev, [matchId]: [...current, created].slice(-120) };
        });
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
    setResultMatch(null);
    setBusyId(matchId);
    try {
      const mp = matchPlayers[matchId] || [];
      const submission = await submitPadelMatchResult({
        supabaseClient: supabase,
        createNotificationFn: createNotification,
        matchId,
        players: mp,
        submittedBy: user.id,
        submitterName: myDisplayName,
        result,
        getTeam: matchPlayerTeam,
      });
      if (!submission.ok) {
        showToast(submission.reason || "Resultatet er ikke gyldigt.");
        return;
      }
      showToast("Resultat indsendt! Venter på bekræftelse ⏳");
      await loadData();
    } catch (e) { showToast("Fejl: " + (e.message || "Prøv igen")); }
    finally { setBusyId(null); }
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
        matchId,
        result: mr,
        players: mp,
        confirmedBy: user.id,
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

  const { openMatches, activeMatches, completedMatches } = useMemo(() => buildKampeMatchLists({
    matches,
    matchPlayers,
    matchResults,
    joinedMatchIds,
    isMine,
    currentUserId: myUidStr,
    searchQuery,
    completedSortMs: matchCompletedSortMs,
  }), [isMine, joinedMatchIds, matchPlayers, matchResults, matches, myUidStr, searchQuery]);

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
      const t1 = players.filter((p) => matchPlayerTeam(p) === 1);
      const t2 = players.filter((p) => matchPlayerTeam(p) === 2);
      const playerEloByUserId = {};
      for (const p of players) {
        playerEloByUserId[String(p.user_id)] = resolvePlayerElo(p);
      }
      const avgElo = (team) => (
        team.length > 0
          ? Math.round(team.reduce((sum, p) => sum + (playerEloByUserId[String(p.user_id)] ?? 1000), 0) / team.length)
          : null
      );
      stats[String(matchId)] = {
        t1,
        t2,
        t1Avg: avgElo(t1),
        t2Avg: avgElo(t2),
        playerEloByUserId,
      };
    }
    return stats;
  }, [eloByUserId, eloFromHistoryByUserId, matchPlayers, myElo, myUidStr]);

  const renderMatchCard = (m) => {
    const mp = matchPlayers[m.id] || [];
    const teamStats = matchTeamStatsById[String(m.id)] || { t1: [], t2: [], t1Avg: null, t2Avg: null, playerEloByUserId: {} };
    const mr = matchResults[m.id];
    const matchPrefs = parseMatchLevelRange(m.level_range);
    const status = getStatus(m);
    const {
      left,
      joined,
      isCreator,
      busy,
      t1,
      t2,
      isFull,
      isPlayerInMatch,
      myTeam,
      isClosed,
      myRequest,
      pendingRequests,
      hasAdminActions,
      adminActionsOpen,
      canUseMatchChat,
      canWriteMatchChat,
      chatOpen,
      chatMessages,
      chatDraft,
      chatLoading,
      chatSending,
      chatError,
      unreadChatCount,
      unreadMatchCount,
      statusLabel,
    } = buildMatchCardState({
      match: m,
      players: mp,
      teamStats,
      matchResult: mr,
      joined: joinedMatchIds.has(String(m.id)),
      currentUserId: user.id,
      busyId,
      status,
      joinRequests: joinRequests[m.id] || [],
      isAdmin,
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

    return (
      <div
        id={"pm-match-" + m.id}
        key={m.id}
        ref={observeMatchCard}
        data-match-id={m.id}
        className="pm-ui-card pm-match-surface-card"
        style={{
          scrollMarginTop: "88px",
          position: "relative",
          boxShadow: unreadMatchCount > 0 ? "0 0 0 2px " + theme.red + "55, 0 8px 24px rgba(0,0,0,0.06)" : undefined,
        }}
        onClick={unreadMatchCount > 0 ? () => { void markMatchNotifsRead(m.id); } : undefined}
      >
        {/* Header */}
        <div className="pm-kampe-card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px", gap: "10px" }}>
          <div className="pm-kampe-card-meta">
            <div className="pm-kampe-card-datetime" style={{ fontSize: "15px", fontWeight: 700, display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
              <Clock size={15} color={theme.accent} />
              <span className="pm-kampe-card-time-normalized">{formatMatchDateDa(m.date)} kl. {matchTimeLabel(m)}</span>
              {unreadMatchCount > 0 && (
                <span
                  aria-label={`${unreadMatchCount} ulæste notifikationer for denne kamp`}
                  title="Ulæste notifikationer for denne kamp"
                  style={{
                    background: theme.red,
                    color: theme.onAccent,
                    borderRadius: "999px",
                    minWidth: "18px",
                    height: "18px",
                    padding: "0 6px",
                    fontSize: "10px",
                    fontWeight: 700,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    lineHeight: 1,
                  }}
                >
                  {unreadMatchCount > 9 ? "9+" : unreadMatchCount}
                </span>
              )}
            </div>
            <div style={{ fontSize: "12px", color: theme.textLight, marginTop: "4px", display: "flex", alignItems: "center", gap: "3px" }}><MapPin size={11} /> {m.court_name}</div>
            {m.description && <div style={{ fontSize: "12px", color: theme.textMid, marginTop: "4px", fontStyle: "italic", lineHeight: 1.4 }}>💬 {m.description}</div>}
          </div>
          <div className="pm-kampe-card-tags" style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {m.seeking_player && (
              <span className="pm-status-badge pm-status-badge--warm">
                <Zap size={10} /> Mangler 1 spiller
              </span>
            )}
            {isClosed && (
              <span className="pm-status-badge pm-status-badge--neutral">
                🔒 Lukket
              </span>
            )}
            {matchPrefs.booked != null && (
              <span
                className={`pm-status-badge ${matchPrefs.booked ? "pm-status-badge--green" : "pm-status-badge--warm"}`}
              >
                {matchPrefs.booked ? "Bane booket" : "Bane ikke booket"}
              </span>
            )}
            {matchPrefs.min != null && matchPrefs.max != null && (
              <span className="pm-status-badge pm-status-badge--blue">
                ELO {matchPrefs.min}-{matchPrefs.max}
              </span>
            )}
            <span className={`pm-status-badge pm-status-badge--${statusLabel.tone}`}>{statusLabel.text}</span>
          </div>
        </div>

        {/* Teams display */}
        {(() => {
          const playerElo = (p) => teamStats.playerEloByUserId[String(p.user_id)] ?? 1000;
          const t1Avg = teamStats.t1Avg;
          const t2Avg = teamStats.t2Avg;
          return (
            <div className="pm-card-subpanel" style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
              {/* Team 1 */}
              <div style={{ flex: 1, textAlign: "center" }}>
                <div style={{ fontSize: "10px", fontWeight: 700, color: theme.accent, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "2px" }}>Hold 1</div>
                {t1Avg !== null && <div style={{ fontSize: "10px", fontWeight: 700, color: theme.accent, marginBottom: "6px", opacity: 0.7 }}>{t1Avg} ELO</div>}
                {t1Avg === null && <div style={{ height: "6px" }} />}
                <div style={{ display: "flex", justifyContent: "center", gap: "8px" }}>
                  {t1.map(p => {
                    const canKick = (isCreator || isAdmin) && String(p.user_id) !== String(user.id) && (status === "open" || status === "full");
                    const kickingBusy = busyId === m.id + '-kick-' + p.user_id;
                    return (
                      <div key={p.id || p.user_id} style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", minWidth: "42px" }}>
                        <button type="button" onClick={() => { const prof = profilesById[String(p.user_id)]; if (prof) setViewPlayer(prof); }} aria-label={"Åbn profil for " + (p.user_name || "spiller")} style={{ display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer", border: "none", background: "transparent", padding: 0 }}>
                          <AvatarCircle avatar={profilesById[String(p.user_id)]?.avatar || p.user_emoji || "🎾"} size={34} emojiSize="15px" style={{ background: theme.accentBg, border: "1.5px solid " + theme.accent + "40" }} />
                          <span style={{ fontSize: "9px", color: theme.text, marginTop: "3px", fontWeight: 600 }}>{(p.user_name || "?").split(" ")[0]}</span>
                          <span style={{ fontSize: "8px", color: theme.accent, fontWeight: 700 }}>{playerElo(p)}</span>
                        </button>
                        {canKick && (
                          <button onClick={(e) => { e.stopPropagation(); kickPlayer(m.id, p.user_id, p.user_name); }} disabled={kickingBusy} aria-label={"Fjern " + (p.user_name || "spiller") + " fra kampen"} style={{ position: "absolute", top: -4, right: -4, width: 16, height: 16, borderRadius: "50%", border: "none", background: theme.red, color: theme.onAccent, fontSize: 10, fontWeight: 700, cursor: kickingBusy ? "wait" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, lineHeight: 1 }}>
                            ×
                          </button>
                        )}
                      </div>
                    );
                  })}
                  {Array.from({ length: Math.max(0, 2 - t1.length) }).map((_, i) => {
                    const canSwitch = joined && myTeam === 2 && (status === "open" || status === "full") && busyId !== m.id + '-switch';
                    return (
                      <div key={"t1e" + i} style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: "42px" }}>
                        <div
                          onClick={canSwitch ? () => switchTeam(m.id, 1) : undefined}
                          title={canSwitch ? "Skift til Hold 1" : undefined}
                          style={{ width: "34px", height: "34px", borderRadius: "50%", border: "1.5px dashed " + (canSwitch ? theme.accent : theme.border), display: "flex", alignItems: "center", justifyContent: "center", cursor: canSwitch ? "pointer" : "default", background: canSwitch ? theme.accentBg : "transparent", transition: "all 0.15s" }}
                        >
                          <Plus size={10} color={canSwitch ? theme.accent : theme.textLight} />
                        </div>
                        {canSwitch && <span style={{ fontSize: "8px", color: theme.accent, fontWeight: 700, marginTop: "2px" }}>Skift</span>}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
                <div style={{ fontSize: "14px", fontWeight: 800, color: theme.textLight }}>vs</div>
              </div>

              {/* Team 2 */}
              <div style={{ flex: 1, textAlign: "center" }}>
                <div style={{ fontSize: "10px", fontWeight: 700, color: theme.blue, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "2px" }}>Hold 2</div>
                {t2Avg !== null && <div style={{ fontSize: "10px", fontWeight: 700, color: theme.blue, marginBottom: "6px", opacity: 0.7 }}>{t2Avg} ELO</div>}
                {t2Avg === null && <div style={{ height: "6px" }} />}
                <div style={{ display: "flex", justifyContent: "center", gap: "8px" }}>
                  {t2.map(p => {
                    const canKick = (isCreator || isAdmin) && String(p.user_id) !== String(user.id) && (status === "open" || status === "full");
                    const kickingBusy = busyId === m.id + '-kick-' + p.user_id;
                    return (
                      <div key={p.id || p.user_id} style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", minWidth: "42px" }}>
                        <button type="button" onClick={() => { const prof = profilesById[String(p.user_id)]; if (prof) setViewPlayer(prof); }} aria-label={"Åbn profil for " + (p.user_name || "spiller")} style={{ display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer", border: "none", background: "transparent", padding: 0 }}>
                          <AvatarCircle avatar={profilesById[String(p.user_id)]?.avatar || p.user_emoji || "🎾"} size={34} emojiSize="15px" style={{ background: theme.blueBg, border: "1.5px solid " + theme.blue + "40" }} />
                          <span style={{ fontSize: "9px", color: theme.text, marginTop: "3px", fontWeight: 600 }}>{(p.user_name || "?").split(" ")[0]}</span>
                          <span style={{ fontSize: "8px", color: theme.blue, fontWeight: 700 }}>{playerElo(p)}</span>
                        </button>
                        {canKick && (
                          <button onClick={(e) => { e.stopPropagation(); kickPlayer(m.id, p.user_id, p.user_name); }} disabled={kickingBusy} aria-label={"Fjern " + (p.user_name || "spiller") + " fra kampen"} style={{ position: "absolute", top: -4, right: -4, width: 16, height: 16, borderRadius: "50%", border: "none", background: theme.red, color: theme.onAccent, fontSize: 10, fontWeight: 700, cursor: kickingBusy ? "wait" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, lineHeight: 1 }}>
                            ×
                          </button>
                        )}
                      </div>
                    );
                  })}
                  {Array.from({ length: Math.max(0, 2 - t2.length) }).map((_, i) => {
                    const canSwitch = joined && myTeam === 1 && (status === "open" || status === "full") && busyId !== m.id + '-switch';
                    return (
                      <div key={"t2e" + i} style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: "42px" }}>
                        <div
                          onClick={canSwitch ? () => switchTeam(m.id, 2) : undefined}
                          title={canSwitch ? "Skift til Hold 2" : undefined}
                          style={{ width: "34px", height: "34px", borderRadius: "50%", border: "1.5px dashed " + (canSwitch ? theme.blue : theme.border), display: "flex", alignItems: "center", justifyContent: "center", cursor: canSwitch ? "pointer" : "default", background: canSwitch ? theme.blueBg : "transparent", transition: "all 0.15s" }}
                        >
                          <Plus size={10} color={canSwitch ? theme.blue : theme.textLight} />
                        </div>
                        {canSwitch && <span style={{ fontSize: "8px", color: theme.blue, fontWeight: 700, marginTop: "2px" }}>Skift</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Score display for completed/result pending */}
        {mr && (() => {
          const myTeam = t1.some(p => p.user_id === user.id) ? "team1" : t2.some(p => p.user_id === user.id) ? "team2" : null;
          const iWon = mr.confirmed && myTeam === mr.match_winner;
          const iLost = mr.confirmed && myTeam && myTeam !== mr.match_winner;
          const toneClass = !mr.confirmed
            ? "pm-feedback-panel--warning"
            : iWon
              ? "pm-feedback-panel--success"
              : iLost
                ? "pm-feedback-panel--danger"
                : "pm-feedback-panel--info";
          const textColor = !mr.confirmed ? theme.warm : iWon ? theme.green : iLost ? theme.red : theme.blue;
          return (
            <div className={`pm-feedback-panel ${toneClass}`} style={{ marginBottom: "12px", padding: "14px" }}>
              <div style={{ fontSize: "20px", fontWeight: 800, letterSpacing: "0.05em", color: textColor }}>{formatMatchResultScore(mr)}</div>
              <div style={{ fontSize: "12px", color: textColor, marginTop: "5px", fontWeight: 600 }}>
                {!mr.confirmed ? "⏳ Venter på bekræftelse" : iWon ? "🏆 Du vandt!" : iLost ? "😞 Du tabte" : `🏆 ${mr.match_winner === "team1" ? "Hold 1" : "Hold 2"} vandt`}
              </div>
              {mr.confirmed && eloChangeByMatchId[String(m.id)] != null && (
                <div style={{ fontSize: "14px", fontWeight: 800, color: eloChangeByMatchId[String(m.id)] >= 0 ? theme.green : theme.red, marginTop: "6px", letterSpacing: "-0.01em" }}>
                  {eloChangeByMatchId[String(m.id)] >= 0 ? "+" : ""}{eloChangeByMatchId[String(m.id)]} ELO
                </div>
              )}
            </div>
          );
        })()}

        {canUseMatchChat && (
          <>
            <button
              onClick={() => { void toggleMatchChat(m.id); }}
              className="pm-accordion-trigger"
              style={{
                ...btn(false),
                marginBottom: chatOpen ? "8px" : "10px",
                padding: "8px 12px",
                fontSize: "12px",
                color: theme.textMid,
                borderColor: theme.border,
                background: theme.surfaceAlt,
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: "7px" }}>
                <MessageCircle size={14} />
                Match chat {chatMessages.length > 0 ? `(${chatMessages.length})` : ""}
                {unreadChatCount > 0 && (
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
                )}
              </span>
              {chatOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {chatOpen && (
              <div className="pm-card-subpanel pm-match-chat-panel" style={{ marginBottom: "10px" }}>
                {!canWriteMatchChat && isAdmin && (
                  <div className="pm-match-chat-empty" style={{ marginBottom: "8px" }}>
                    Admin-visning: Kun tilmeldte spillere kan skrive i chatten.
                  </div>
                )}
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
                  {chatLoading && (
                    <div className="pm-match-chat-empty">Henter beskeder...</div>
                  )}
                  {!chatLoading && chatError && (
                    <div className="pm-match-chat-empty">{chatError}</div>
                  )}
                  {!chatLoading && !chatError && chatMessages.length === 0 && (
                    <div className="pm-match-chat-empty">Ingen beskeder endnu. Skriv den første besked til kampen.</div>
                  )}
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
            )}
          </>
        )}

        {/* Actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {joined && status !== "completed" && (
            <button
              type="button"
              onClick={() => addMatchToCalendar(m)}
              style={{ ...btn(false), width: "100%", justifyContent: "center", fontSize: "13px" }}
            >
              <CalendarPlus size={14} /> Tilføj til kalender
            </button>
          )}

          {/* ---- Open match: direct join ---- */}
          {!isClosed && status === "open" && left > 0 && !joined && (
            <button onClick={() => setTeamSelectMatch(m.id)} disabled={busy} style={{ ...btn(true), width: "100%", justifyContent: "center", fontSize: "13px" }}>Tilmeld mig</button>
          )}

          {/* ---- Closed match: request to join ---- */}
          {isClosed && status === "open" && left > 0 && !joined && !isCreator && (() => {
            if (!myRequest) {
              return (
                <button
                  onClick={() => requestJoin(m.id)}
                  disabled={busyId === m.id + '-req'}
                  style={{ ...btn(true), width: "100%", justifyContent: "center", fontSize: "13px" }}
                >
                  {busyId === m.id + '-req' ? "Sender..." : "🔒 Anmod om tilmelding"}
                </button>
              );
            }
            if (myRequest.status === "pending") {
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <div className="pm-feedback-panel pm-feedback-panel--warning" style={{ fontSize: "13px", fontWeight: 600, padding: "8px" }}>
                    ⏳ Anmodning afventer godkendelse
                  </div>
                  <button
                    onClick={() => cancelJoinRequest(m.id)}
                    disabled={busyId === m.id + '-req'}
                    style={{ ...btn(false), width: "100%", justifyContent: "center", fontSize: "13px", color: theme.textMid }}
                  >
                    Træk anmodning tilbage
                  </button>
                </div>
              );
            }
            if (myRequest.status === "approved") {
              return (
                <button
                  onClick={() => setTeamSelectMatch(m.id)}
                  disabled={busy}
                  style={{ ...btn(true), width: "100%", justifyContent: "center", fontSize: "13px", background: theme.green, borderColor: theme.green }}
                >
                  ✅ Godkendt — Vælg hold og tilmeld
                </button>
              );
            }
            if (myRequest.status === "rejected") {
              return (
                <div className="pm-feedback-panel pm-feedback-panel--danger" style={{ fontSize: "13px", fontWeight: 600, padding: "8px" }}>
                  ❌ Din anmodning er ikke godkendt
                </div>
              );
            }
          })()}

          {/* ---- Creator: pending join requests (closed match) ---- */}
          {isCreator && isClosed && pendingRequests.length > 0 && (
            <div className="pm-card-subpanel">
              <div style={{ fontSize: "12px", fontWeight: 700, color: theme.textMid, marginBottom: "8px" }}>
                🔒 Tilmeldingsanmodninger ({pendingRequests.length})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {pendingRequests.map(req => (
                  <div key={req.id} className="pm-card-row-item" style={{ justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", fontWeight: 600 }}>
                      <AvatarCircle
                        avatar={profilesById[String(req.user_id)]?.avatar || req.user_emoji || "🎾"}
                        size={28}
                        emojiSize="13px"
                        style={{ background: theme.accentBg, border: "1px solid " + theme.border, flexShrink: 0 }}
                      />
                      <span>{req.user_name || "Ukendt"}</span>
                    </div>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        onClick={() => approveJoinRequest(m.id, req.id, req.user_id, req.user_name, req.user_emoji)}
                        disabled={busyId === m.id + '-approve-' + req.id}
                        style={{ padding: "5px 10px", fontSize: "12px", fontWeight: 700, background: theme.accent, color: theme.onAccent, border: "none", borderRadius: "6px", cursor: "pointer" }}
                      >
                        {busyId === m.id + '-approve-' + req.id ? "..." : "✓ Godkend"}
                      </button>
                      <button
                        onClick={() => rejectJoinRequest(m.id, req.id, req.user_id, req.user_name)}
                        disabled={busyId === m.id + '-reject-' + req.id}
                        style={{ padding: "5px 10px", fontSize: "12px", fontWeight: 700, background: theme.surface, color: theme.red, border: "1px solid " + theme.red + "55", borderRadius: "6px", cursor: "pointer" }}
                      >
                        {busyId === m.id + '-reject-' + req.id ? "..." : "✕ Afvis"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {joined && status !== "completed" && (
            <div style={{ textAlign: "center", fontSize: "13px", color: theme.accent, fontWeight: 600 }}>✅ Tilmeldt</div>
          )}
          {hasAdminActions && (
            <button
              onClick={() => setExpandedAdminActions(prev => ({ ...prev, [m.id]: !prev[m.id] }))}
              className="pm-accordion-trigger"
              style={{
                ...btn(false),
                padding: "7px 12px",
                fontSize: "12px",
                color: theme.warm,
                borderColor: theme.warm + "55",
                background: theme.warmBg,
              }}
            >
              <span>{adminActionsOpen ? "Skjul admin-værktøjer" : "Vis admin-værktøjer"}</span>
              {adminActionsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}
          {(isCreator || isAdmin) && (status === "open" || status === "full") && (!isAdmin || adminActionsOpen) && (
            <button 
              onClick={() => startMatch(m.id)} 
              disabled={busy || (!isFull && !isAdmin)} 
              style={{ 
                ...btn(isFull || isAdmin), 
                width: "100%", 
                justifyContent: "center", 
                fontSize: "13px", 
                background: (isFull || isAdmin) ? theme.warm : theme.border,
                cursor: (isFull || isAdmin) ? "pointer" : "not-allowed",
                opacity: (isFull || isAdmin) ? 1 : 0.6
              }}
            >
              {isFull ? "🎾 Start kamp" : isAdmin ? "⚡ Gennemtving start (Admin)" : "🎾 Venter på spillere (2 mod 2)"}
            </button>
          )}
          {status === "in_progress" && (isPlayerInMatch || isAdmin) && !mr && (!isAdmin || adminActionsOpen) && (
            <button 
              onClick={() => setResultMatch(m.id)} 
              disabled={busy} 
              style={{ 
                ...btn(true), 
                width: "100%", 
                justifyContent: "center", 
                fontSize: "13px",
                background: (isAdmin && !isPlayerInMatch) ? theme.warm : theme.accent,
                borderColor: (isAdmin && !isPlayerInMatch) ? theme.warm : theme.accent
              }}
            >
              📊 Indrapportér resultat {isAdmin && !isPlayerInMatch && "(Admin)"}
            </button>
          )}
          {mr && !mr.confirmed && (isPlayerInMatch || isAdmin) && (!isAdmin || adminActionsOpen) && (
            <div style={{ display: "flex", gap: "8px" }}>
              {(isAdmin || mr.submitted_by !== user.id) && (
                <button 
                  onClick={() => confirmResult(m.id)} 
                  disabled={busy} 
                  style={{ 
                    ...btn(true), 
                    flex: 1, 
                    justifyContent: "center", 
                    fontSize: "13px",
                    background: isAdmin ? theme.warm : theme.accent,
                    borderColor: isAdmin ? theme.warm : theme.accent
                  }}
                >
                  ✅ Bekræft {isAdmin && "(Admin)"}
                </button>
              )}
              <button 
                onClick={() => rejectResult(m.id)} 
                disabled={busy} 
                style={{ 
                  ...btn(false), 
                  flex: 1, 
                  justifyContent: "center", 
                  fontSize: "13px", 
                  color: isAdmin ? theme.warm : theme.red,
                  borderColor: isAdmin ? theme.warm : theme.red + "55"
                }}
              >
                ❌ {isAdmin ? "Slet (Admin)" : "Afvis"}
              </button>
            </div>
          )}
          {isCreator && status === "open" && mp.length === 3 && (
            <button
              onClick={() => toggleSeekingPlayer(m)}
              disabled={busyId === m.id + '-seek'}
              style={{
                ...btn(false),
                width: "100%",
                justifyContent: "center",
                fontSize: "13px",
                background: m.seeking_player ? theme.warmBg : theme.surface,
                color: m.seeking_player ? theme.warm : theme.textMid,
                borderColor: m.seeking_player ? "var(--pm-warning-border)" : theme.border,
              }}
            >
              <Zap size={14} />
              {busyId === m.id + '-seek'
                ? 'Sender...'
                : m.seeking_player
                ? 'Søger spiller — klik for at stoppe'
                : 'Råb op — mangler 1 spiller'}
            </button>
          )}
          {joined && !isCreator && (status === "open" || status === "full") && (
            <button onClick={() => leaveMatch(m.id)} disabled={busy} style={{ ...btn(false), width: "100%", justifyContent: "center", fontSize: "13px", color: theme.textMid }}>
              <UserMinus size={14} /> Afmeld mig
            </button>
          )}
          {(isCreator || isAdmin) && status !== "completed" && status !== "in_progress" && (!isAdmin || adminActionsOpen) && (
            <button onClick={() => deleteMatch(m.id)} disabled={busy} style={{ ...btn(false), width: "100%", justifyContent: "center", fontSize: "13px", color: theme.red, borderColor: theme.red + "55" }}>
              <Trash2 size={14} /> {isAdmin ? "Slet kamp (Admin)" : "Slet kamp"}
            </button>
          )}
        </div>
      </div>
    );
  };

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

  const formatTabs = [
    { id: "padel", label: <>2v2-kampe<TabBadge count={padelUnreadCounts.total} /></> },
    { id: "americano", label: "Americano" },
    { id: "liga", label: "Liga" },
  ];
  const scopeTabs = kampeFormat === "liga"
    ? [
        { id: "alle", label: "Alle ligaer" },
        { id: "mine", label: "Mine ligaer" },
      ]
    : [
        { id: "alle", label: "Alle kampe" },
        { id: "mine", label: "Mine kampe" },
      ];
  const searchPlaceholder = kampeFormat === "liga"
    ? "Søg liga..."
    : "Søg spiller, bane eller beskrivelse...";
  const padelViewTabs = [
    { id: "open", label: <>Åbne ({openMatches.length})<TabBadge count={padelUnreadCounts.open} /></> },
    { id: "active", label: <>I gang ({activeMatches.length})<TabBadge count={padelUnreadCounts.active} /></> },
    { id: "completed", label: <>Afsluttede ({completedMatches.length})<TabBadge count={padelUnreadCounts.completed} /></> },
  ];
  const onScopeChange = (nextScope) => {
    setKampeScope(nextScope);
    mergeKampeSessionPrefs(user.id, { scope: nextScope });
    setSearchQuery("");
  };
  const formatAction = !loadingMatches && kampeFormat === "padel"
    ? (
      <button type="button" onClick={() => setShowCreate(!showCreate)} style={btn(true)}>
        {showCreate ? "Annullér" : <><Plus size={15} /> Opret kamp</>}
      </button>
    )
    : !loadingMatches && kampeFormat === "americano"
      ? (
        <button type="button" onClick={() => setShowAmericanoCreate(!showAmericanoCreate)} style={btn(true)}>
          {showAmericanoCreate ? "Annullér" : <><Plus size={15} /> Opret turnering</>}
        </button>
      )
      : !loadingMatches && kampeFormat === "liga" && user?.role === "admin"
        ? (
          <button type="button" onClick={() => setShowLigaCreate((v) => !v)} style={btn(true)}>
            {showLigaCreate ? "Annullér" : <><Plus size={15} /> Opret liga</>}
          </button>
        )
        : null;

  return (
    <div>
      <div className="pm-kampe-head" style={{ marginBottom: "10px", minHeight: "44px" }}>
        <h2 style={{ ...heading("clamp(20px,4.5vw,24px)"), lineHeight: 1.2 }}>Kampe</h2>
      </div>

      <TabbedFilterCard
        tabs={formatTabs}
        value={kampeFormat}
        onTabChange={(nextFormat) => {
          setKampeFormat(nextFormat);
          setPadelHelpOpen(false);
          setShowCreate(false);
          setShowAmericanoCreate(false);
          setShowLigaCreate(false);
        }}
        tabAriaLabel="Kampe format"
        action={formatAction}
        bottom={(
          <ScopeSearchControls
            tabs={scopeTabs}
            value={kampeScope}
            onTabChange={onScopeChange}
            searchValue={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder={searchPlaceholder}
            tabAriaLabel={kampeFormat === "liga" ? "Liga scope" : "Kampe scope"}
            className="pm-kampe-controls-bottom"
            tabsClassName="pm-kampe-segment"
            searchWrapClassName="pm-kampe-search-wrap"
            searchInputClassName="pm-kampe-search-input"
            searchIconClassName="pm-kampe-search-icon"
          />
        )}
        cardStyle={{ marginBottom: "18px" }}
      />
      {kampeFormat === "liga" && (
        <LigaTabEmbed
          user={user}
          showToast={showToast}
          createOpen={showLigaCreate}
          onCreateOpenChange={setShowLigaCreate}
          embedInKampe
          scope={kampeScope}
          onScopeChange={onScopeChange}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
        />
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
            <div className="pm-state-title">Indlæser Americano…</div>
            <div className="pm-state-copy">Vi henter turneringer og deltagere.</div>
          </div>
        }>
        <AmericanoTab
          profile={user}
          showToast={showToast}
          embedInKampe
          createOpen={showAmericanoCreate}
          onCreateOpenChange={setShowAmericanoCreate}
          scope={kampeScope}
          searchQuery={searchQuery}
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
      <div className="pm-help-box" style={{ marginBottom: "14px" }}>
        <button
          type="button"
          onClick={() => setPadelHelpOpen((v) => !v)}
          aria-expanded={padelHelpOpen}
          className="pm-help-box-toggle"
          style={{ cursor: "pointer" }}
        >
          <span className="pm-help-box-title">Sådan fungerer 2v2 (padel)</span>
          <span className="pm-help-box-chevron">
            {padelHelpOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </span>
        </button>
        {padelHelpOpen ? (
          <div className="pm-help-box-content" style={{ marginTop: "8px" }}>
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
        tabs={padelViewTabs}
        value={viewTab}
        onChange={(nextView) => setViewTab(nextView)}
        ariaLabel="Kampestatus"
        size="sm"
        style={{ marginBottom: "16px" }}
      />

      {/* Create match form */}
      {showCreate && (
        <div className="pm-ui-card" style={{ padding: "clamp(16px,3vw,20px)", marginBottom: "20px" }}>
          <h3 style={{ fontSize: "15px", fontWeight: 700, marginBottom: "12px" }}>Opret ny kamp</h3>
          <p style={{ fontSize: "13px", color: theme.textMid, marginBottom: "16px" }}>Din ELO <strong>{myElo}</strong> — du sættes automatisk på Hold 1.</p>
          <div className="pm-form-2col">
            <div style={{ gridColumn: "1 / -1" }}><label style={labelStyle}>Bane</label>
              <select value={newMatch.court_id} onChange={e => setNewMatch(m => ({ ...m, court_id: e.target.value }))} style={{ ...inputStyle, fontSize: "13px" }}>
                {venueOptions.length === 0 ? (
                  <option value="">Indlæser…</option>
                ) : (
                  venueOptions.map((o) => (
                    <option key={o.id} value={o.id}>{o.label}</option>
                  ))
                )}
              </select>
              <p style={{ fontSize: "11px", color: theme.textLight, marginTop: "6px", lineHeight: 1.45 }}>
                Samme steder som under fanen Baner. Virtuel bane gemmer kun navnet (tilføj banen i databasen for at koble uuid).
              </p>
            </div>
            <div style={{ minWidth: 0 }}><label style={labelStyle}>Dato</label>
              <input type="date" value={newMatch.date} min={new Date().toISOString().split('T')[0]} onChange={e => setNewMatch(m => ({ ...m, date: e.target.value }))} style={{ ...inputStyle, fontSize: "13px", appearance: "none", WebkitAppearance: "none" }} /></div>
            <div><label style={labelStyle}>Starttid</label>
              <select value={newMatch.time} onChange={e => setNewMatch(m => ({ ...m, time: e.target.value }))} style={{ ...inputStyle, fontSize: "13px" }}>
                {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
              </select></div>
            <div><label style={labelStyle}>Varighed</label>
              <select value={newMatch.duration} onChange={e => setNewMatch(m => ({ ...m, duration: e.target.value }))} style={{ ...inputStyle, fontSize: "13px" }}>
                <option value="60">1 time</option>
                <option value="90">1½ time</option>
                <option value="120">2 timer</option>
                <option value="150">2½ timer</option>
                <option value="180">3 timer</option>
              </select></div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Har du booket en bane?</label>
              <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                <button
                  type="button"
                  onClick={() => setNewMatch(m => ({ ...m, court_booked: true }))}
                  style={{ ...btn(newMatch.court_booked === true), flex: 1, fontSize: "13px", justifyContent: "center", padding: "9px 12px" }}
                >
                  Ja, booket
                </button>
                <button
                  type="button"
                  onClick={() => setNewMatch(m => ({ ...m, court_booked: false }))}
                  style={{ ...btn(newMatch.court_booked === false), flex: 1, fontSize: "13px", justifyContent: "center", padding: "9px 12px" }}
                >
                  Nej, ikke endnu
                </button>
              </div>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Hvilket niveau søger du? (ELO)</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "4px" }}>
                <input
                  type="number"
                  min="400"
                  max="3000"
                  value={newMatch.level_min}
                  onChange={e => setNewMatch(m => ({ ...m, level_min: e.target.value }))}
                  placeholder="Fra"
                  style={{ ...inputStyle, fontSize: "13px" }}
                />
                <input
                  type="number"
                  min="400"
                  max="3000"
                  value={newMatch.level_max}
                  onChange={e => setNewMatch(m => ({ ...m, level_max: e.target.value }))}
                  placeholder="Til"
                  style={{ ...inputStyle, fontSize: "13px" }}
                />
              </div>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "8px" }}>
                <button type="button" onClick={() => setNewMatch(m => ({ ...m, level_min: String(clampElo(myElo - 100, myElo)), level_max: String(clampElo(myElo + 100, myElo)) }))} style={{ ...btn(false), fontSize: "12px", padding: "6px 10px" }}>
                  Tæt på mig (±100)
                </button>
                <button type="button" onClick={() => setNewMatch(m => ({ ...m, level_min: String(clampElo(myElo - 200, myElo)), level_max: String(clampElo(myElo + 200, myElo)) }))} style={{ ...btn(false), fontSize: "12px", padding: "6px 10px" }}>
                  Fleksibel (±200)
                </button>
                <button type="button" onClick={() => setNewMatch(m => ({ ...m, level_min: String(clampElo(myElo - 350, myElo)), level_max: String(clampElo(myElo + 350, myElo)) }))} style={{ ...btn(false), fontSize: "12px", padding: "6px 10px" }}>
                  Åben (±350)
                </button>
              </div>
            </div>
          </div>
          <label style={{ ...labelStyle, marginTop: "12px" }}>Beskrivelse (valgfrit)</label>
          <textarea value={newMatch.description} onChange={e => setNewMatch(m => ({ ...m, description: e.target.value }))} placeholder="F.eks. 'Søger venstreside-spiller' eller 'Begyndervenlig kamp'" style={{ ...inputStyle, fontSize: "13px", height: "60px", resize: "vertical" }} />

          {/* Open / Closed toggle */}
          <label style={{ ...labelStyle, marginTop: "14px" }}>Kamptyp</label>
          <div style={{ display: "flex", gap: "0", borderRadius: "8px", overflow: "hidden", border: "1px solid " + theme.border, marginTop: "4px" }}>
            <button
              type="button"
              onClick={() => setNewMatch(m => ({ ...m, match_type: "open" }))}
              style={{
                flex: 1, padding: "10px 12px", fontSize: "13px", fontWeight: newMatch.match_type === "open" ? 700 : 500,
                background: newMatch.match_type === "open" ? theme.accent : theme.surface,
                color: newMatch.match_type === "open" ? theme.onAccent : theme.textMid,
                border: "none", cursor: "pointer", transition: "all 0.15s",
              }}
            >
              🔓 Åben kamp
            </button>
            <button
              type="button"
              onClick={() => setNewMatch(m => ({ ...m, match_type: "closed" }))}
              style={{
                flex: 1, padding: "10px 12px", fontSize: "13px", fontWeight: newMatch.match_type === "closed" ? 700 : 500,
                background: newMatch.match_type === "closed" ? theme.textMid : theme.surface,
                color: newMatch.match_type === "closed" ? theme.onAccent : theme.textMid,
                border: "none", borderLeft: "1px solid " + theme.border, cursor: "pointer", transition: "all 0.15s",
              }}
            >
              🔒 Lukket kamp
            </button>
          </div>
          <p style={{ fontSize: "11px", color: theme.textLight, marginTop: "6px", lineHeight: 1.45 }}>
            {newMatch.match_type === "open"
              ? "Alle kan tilmelde sig direkte."
              : "Alle kan se kampen, men skal anmode om at deltage — du godkender selv."}
          </p>

          <button onClick={createMatch} disabled={creating || !newMatch.court_id || venueOptions.length === 0} style={{ ...btn(true), marginTop: "16px", width: "100%", justifyContent: "center", opacity: creating ? 0.55 : 1 }}>
            {creating ? "Opretter..." : "Opret kamp"}
          </button>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {viewTab === "open" && openMatches.map((m) => renderMatchCard(m, "open"))}
        {viewTab === "active" && activeMatches.map((m) => renderMatchCard(m, "active"))}
        {viewTab === "completed" && completedMatches.slice(0, completedLimit).map((m) => renderMatchCard(m, "completed"))}
        {viewTab === "completed" && completedMatches.length > completedLimit && (
          <button
            onClick={() => setCompletedLimit(n => n + 5)}
            style={{ ...btn(false), width: "100%", justifyContent: "center", fontSize: "13px", color: theme.textMid }}
          >
            Indlæs flere ({completedMatches.length - completedLimit} tilbage)
          </button>
        )}

        {viewTab === "open" && openMatches.length === 0 && (
          <div className="pm-state-card pm-state-card--empty">
            <div className="pm-state-icon">⚔️</div>
            <div className="pm-state-title">Ingen åbne kampe</div>
            <div className="pm-state-copy" style={{ marginBottom: "16px" }}>Opret den første kamp og find nogen at spille med.</div>
            <button type="button" onClick={() => setShowCreate(true)} style={{ ...btn(true), fontSize: "13px" }}>
              <Plus size={14} /> Opret kamp
            </button>
          </div>
        )}
        {viewTab === "active" && activeMatches.length === 0 && (
          <div className="pm-state-card pm-state-card--empty">
            <div className="pm-state-icon">🎾</div>
            <div className="pm-state-title">Ingen aktive kampe</div>
            <div className="pm-state-copy">Tilmeld dig en åben kamp for at komme i gang.</div>
          </div>
        )}
        {viewTab === "completed" && completedMatches.length === 0 && (
          <div className="pm-state-card pm-state-card--empty">
            <div className="pm-state-icon">📊</div>
            <div className="pm-state-title">Ingen afsluttede kampe endnu</div>
            <div className="pm-state-copy">Spil din første kamp og se dit resultat her.</div>
          </div>
        )}
      </div>

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
        const mp = matchPlayers[resultMatch] || [];
        const t1 = mp.filter(p => matchPlayerTeam(p) === 1);
        const t2 = mp.filter(p => matchPlayerTeam(p) === 2);
        const t1Names = t1.map(p => (p.user_name || "?").split(" ")[0]).join(" & ") || "Hold 1";
        const t2Names = t2.map(p => (p.user_name || "?").split(" ")[0]).join(" & ") || "Hold 2";
        return (
          <ResultModal
            team1Names={t1Names}
            team2Names={t2Names}
            onSubmit={(result) => submitResult(resultMatch, result)}
            onClose={() => setResultMatch(null)}
          />
        );
      })()}

      {/* Player profile modal */}
      {viewPlayer && <PlayerProfileModal player={viewPlayer} onClose={() => setViewPlayer(null)} />}
      </>
      )}
      </>
      )}
    </div>
  );
}
