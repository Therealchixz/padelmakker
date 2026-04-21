import { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { Profile, Court } from '../api/base44Client';
import { supabase } from '../lib/supabase';
import { readKampeSessionPrefs, mergeKampeSessionPrefs } from '../lib/kampeSessionPrefs';
const AmericanoTab = lazy(() =>
  import('../features/americano/AmericanoTab').then(m => ({ default: m.AmericanoTab }))
);
import { LigaTab as LigaTabEmbed } from './LigaTab';
import { theme, btn, inputStyle, labelStyle, heading, tag } from '../lib/platformTheme';
import { resolveDisplayName, sanitizeText } from '../lib/platformUtils';
import { statsFromEloHistoryRows, useProfileEloBundle, fetchEloByUserIdFromHistory } from '../lib/eloHistoryUtils';
import { eloOf, fmtClock, matchTimeLabel, timeToMinutes, matchCompletedSortMs, formatMatchDateDa } from '../lib/matchDisplayUtils';
import { calculateAndApplyElo } from '../lib/applyEloMatch';
import { createNotification } from '../lib/notifications';
import { activateSeekingPlayer, deactivateSeekingPlayer } from '../lib/seekingPlayerUtils';
import { Clock, MapPin, Plus, UserMinus, Trash2, Search, Zap } from 'lucide-react';
import { TeamSelectModal } from './TeamSelectModal';
import { ResultModal } from './ResultModal';
import { PlayerProfileModal } from './PlayerProfileModal';
import { AvatarCircle } from '../components/AvatarCircle';
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

/** Undgår gigantiske .in() — Supabase/PostgREST har URL-grænser. */
async function fetchRowsInChunks(table, column, ids, select = '*') {
  if (!ids.length) return [];
  const rows = [];
  const chunkSize = 100;
  for (let i = 0; i < ids.length; i += chunkSize) {
    const slice = ids.slice(i, i + chunkSize);
    const { data, error } = await supabase.from(table).select(select).in(column, slice);
    if (error) throw error;
    rows.push(...(data || []));
  }
  return rows;
}

export function KampeTab({ user, showToast, tabActive = true }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user: authUser, refreshProfile } = useAuth();
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
  const [searchQuery, setSearchQuery] = useState("");
  const [joinRequests, setJoinRequests] = useState({}); // { [matchId]: [{ id, user_id, user_name, user_emoji, status }] }
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
        allMatchIds.length > 0 ? await fetchRowsInChunks("matches", "id", allMatchIds) : [];
      setMatches(allMatches);

      const vOpts = getMatchVenueOptions(cd || []);
      if (vOpts.length > 0) {
        setNewMatch((m) => {
          if (m.court_id && vOpts.some((o) => o.id === m.court_id)) return m;
          return { ...m, court_id: vOpts[0].id };
        });
      }

      const mpd =
        allMatchIds.length > 0 ? await fetchRowsInChunks("match_players", "match_id", allMatchIds) : [];
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
        allMatchIds.length > 0 ? await fetchRowsInChunks("match_results", "match_id", allMatchIds) : [];
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
        createNotification(match.creator_id, 'match_cancelled', 'Spiller afmeldt ❌', `${myDisplayName} er afmeldt kampen.`, matchId);
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
    if (!window.confirm(`Er du sikker på, at du vil smide ${label} ud af kampen som ${actor}?`)) return;

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
      if (!window.confirm("Kampen er ikke fuld endnu. Vil du gennemtvinge start som admin?")) return;
    } else if (isAdmin && !matchPlayers[matchId]?.some(p => p.user_id === user.id)) {
      if (!window.confirm("Vil du starte denne kamp som admin?")) return;
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

    if (!window.confirm(msg)) return;
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

  const submitResult = async (matchId, result) => {
    setResultMatch(null);
    setBusyId(matchId);
    try {
      const mp = matchPlayers[matchId] || [];
      const t1 = mp.filter(p => matchPlayerTeam(p) === 1);
      const t2 = mp.filter(p => matchPlayerTeam(p) === 2);

      const scoreDisplay = result.sets
        .filter(s => s.gamesTeam1 > 0 || s.gamesTeam2 > 0)
        .map(s => `${s.gamesTeam1}-${s.gamesTeam2}`)
        .join(", ");

      const { error } = await supabase.from("match_results").insert({
        match_id: matchId,
        team1_player1_id: t1[0]?.user_id, team1_player2_id: t1[1]?.user_id,
        team2_player1_id: t2[0]?.user_id, team2_player2_id: t2[1]?.user_id,
        set1_team1: result.sets[0]?.gamesTeam1, set1_team2: result.sets[0]?.gamesTeam2,
        set1_tb1: result.sets[0]?.tiebreakTeam1, set1_tb2: result.sets[0]?.tiebreakTeam2,
        set2_team1: result.sets[1]?.gamesTeam1, set2_team2: result.sets[1]?.gamesTeam2,
        set2_tb1: result.sets[1]?.tiebreakTeam1, set2_tb2: result.sets[1]?.tiebreakTeam2,
        set3_team1: result.sets[2]?.gamesTeam1, set3_team2: result.sets[2]?.gamesTeam2,
        set3_tb1: result.sets[2]?.tiebreakTeam1, set3_tb2: result.sets[2]?.tiebreakTeam2,
        sets_won_team1: result.sets.filter(s => s.gamesTeam1 > s.gamesTeam2).length,
        sets_won_team2: result.sets.filter(s => s.gamesTeam2 > s.gamesTeam1).length,
        match_winner: result.winner,
        score_display: scoreDisplay,
        submitted_by: user.id,
        confirmed: false,
      });
      if (error) throw error;
      // Notify other players to confirm the result
      mp.filter(p => p.user_id !== user.id).forEach(p => {
        createNotification(p.user_id, "result_submitted", "Resultat indsendt 📊", `${myDisplayName} har indsendt et resultat (${scoreDisplay}). Bekræft venligst.`, matchId);
      });
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
      const { error } = await supabase.from("match_results").update({ confirmed: true, confirmed_by: user.id }).eq("id", mr.id);
      if (error) throw error;

      // Calculate ELO
      const mp = matchPlayers[matchId] || [];
      await calculateAndApplyElo(matchId, showToast);
      refreshProfile();
      await reloadKampeEloBundle();
      // Notify all players about ELO update
      mp.forEach(p => {
        createNotification(p.user_id, "result_confirmed", "Resultat bekræftet! 🏆", `Kampen er afsluttet (${mr.score_display || "—"}). Personlig ELO er opdateret.`, matchId);
      });
      showToast("Resultat bekræftet! Personlig ELO opdateret 🏆");
      await loadData();
    } catch (e) { showToast("Fejl: " + (e.message || "Prøv igen")); }
    finally { setBusyId(null); }
  };

  const rejectResult = async (matchId) => {
    setBusyId(matchId);
    try {
      const mr = matchResults[matchId];
      if (!mr) return;
      await supabase.from("match_results").delete().eq("id", mr.id);
      // Notify the submitter (if someone else rejected)
      if (mr.submitted_by && mr.submitted_by !== user.id) {
        createNotification(mr.submitted_by, 'result_submitted', 'Resultat afvist ❌', `Dit indberettede resultat er blevet afvist. Indrapportér igen.`, matchId);
      }
      showToast("Resultat afvist. Indrapportér igen.");
      await loadData();
    } catch (e) { showToast("Fejl: " + (e.message || "Prøv igen")); }
    finally { setBusyId(null); }
  };

  const getStatus = (m) => (m.status ?? "open").toString().toLowerCase();
  const sortJoinedFirst = (list) => [...list].sort((a, b) => {
    const aJ = (matchPlayers[a.id] || []).some(p => p.user_id === user.id) ? 1 : 0;
    const bJ = (matchPlayers[b.id] || []).some(p => p.user_id === user.id) ? 1 : 0;
    if (bJ !== aJ) return bJ - aJ;
    return new Date(b.created_at || 0) - new Date(a.created_at || 0);
  });

  // Search filter helper
  const matchesSearch = (m) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const mp = matchPlayers[m.id] || [];
    const playerNames = mp.map(p => (p.user_name || "").toLowerCase()).join(" ");
    const courtName = (m.court_name || "").toLowerCase();
    const desc = (m.description || "").toLowerCase();
    const range = (m.level_range || "").toLowerCase();
    return playerNames.includes(q) || courtName.includes(q) || desc.includes(q) || range.includes(q);
  };

  const isMine = kampeScope === "mine";
  const amInMatch = (m) => (matchPlayers[m.id] || []).some(p => p.user_id === user.id);
  const amCreator = (m) => String(m.creator_id) === String(user.id);

  const openMatches = sortJoinedFirst(matches.filter(m => {
    const s = getStatus(m); if (s !== "open" && s !== "full") return false;
    if ((matchPlayers[m.id] || []).length === 0) return false;
    // Mine kampe → kun kampe jeg har oprettet
    if (isMine && !amCreator(m)) return false;
    if (!matchesSearch(m)) return false;
    return true;
  }));
  const activeMatches = matches.filter(m => {
    if (getStatus(m) !== "in_progress") return false;
    if (isMine && !amInMatch(m)) return false;
    if (!matchesSearch(m)) return false;
    return true;
  });
  const completedMatches = matches
    .filter(m => {
      if (getStatus(m) !== "completed") return false;
      if (isMine && !amInMatch(m)) return false;
      if (!matchesSearch(m)) return false;
      return true;
    })
    .sort((a, b) => matchCompletedSortMs(b, matchResults) - matchCompletedSortMs(a, matchResults));

  const renderMatchCard = (m) => {
    const mp = matchPlayers[m.id] || [];
    const mr = matchResults[m.id];
    const matchPrefs = parseMatchLevelRange(m.level_range);
    const left = (m.max_players || 4) - mp.length;
    const joined = mp.some(p => p.user_id === user.id);
    const isCreator = String(m.creator_id) === String(user.id);
    const busy = busyId === m.id;
    const status = getStatus(m);
    const t1 = mp.filter(p => matchPlayerTeam(p) === 1);
    const t2 = mp.filter(p => matchPlayerTeam(p) === 2);
    const isFull = t1.length >= 2 && t2.length >= 2;
    const isPlayerInMatch = mp.some(p => p.user_id === user.id);
    const myTeam = t1.some(p => p.user_id === user.id) ? 1 : t2.some(p => p.user_id === user.id) ? 2 : null;
    const isClosed = (m.match_type || "open") === "closed";
    const myRequest = (joinRequests[m.id] || []).find(r => r.user_id === user.id);
    const pendingRequests = (joinRequests[m.id] || []).filter(r => r.status === "pending");
    const hasAdminActions = isAdmin && (
      ((isCreator || isAdmin) && (status === "open" || status === "full")) ||
      (status === "in_progress" && (isPlayerInMatch || isAdmin) && !mr) ||
      (mr && !mr.confirmed && (isPlayerInMatch || isAdmin)) ||
      ((isCreator || isAdmin) && status !== "completed" && status !== "in_progress")
    );
    const adminActionsOpen = !!expandedAdminActions[m.id];

    const statusLabel = {
      open: { text: left > 0 ? `${left} ledig${left > 1 ? "e" : ""}` : "Fuld", bg: left > 0 ? theme.accentBg : theme.warmBg, color: left > 0 ? theme.accent : theme.warm },
      full: { text: "Klar til start", bg: theme.blueBg, color: theme.blue },
      in_progress: { text: "I gang", bg: theme.warmBg, color: theme.warm },
      completed: { text: "Afsluttet", bg: "#F1F5F9", color: theme.textLight },
    }[status] || { text: status, bg: "#F1F5F9", color: theme.textLight };

    return (
      <div id={"pm-match-" + m.id} key={m.id} className="pm-ui-card" style={{ padding: "20px", scrollMarginTop: "88px" }}>
        {/* Header */}
        <div className="pm-kampe-card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px", gap: "10px" }}>
          <div className="pm-kampe-card-meta">
            <div className="pm-kampe-card-datetime" style={{ fontSize: "15px", fontWeight: 700, display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
              <Clock size={15} color={theme.accent} />
              <span className="pm-kampe-card-time-normalized">{formatMatchDateDa(m.date)} kl. {matchTimeLabel(m)}</span>
            </div>
            <div style={{ fontSize: "12px", color: theme.textLight, marginTop: "4px", display: "flex", alignItems: "center", gap: "3px" }}><MapPin size={11} /> {m.court_name}</div>
            {m.description && <div style={{ fontSize: "12px", color: theme.textMid, marginTop: "4px", fontStyle: "italic", lineHeight: 1.4 }}>💬 {m.description}</div>}
          </div>
          <div className="pm-kampe-card-tags" style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {m.seeking_player && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#FEF3C7', color: '#B45309', border: '1px solid #FCD34D', borderRadius: '6px', padding: '2px 8px', fontSize: '11px', fontWeight: 700 }}>
                <Zap size={10} /> Mangler 1 spiller
              </span>
            )}
            {isClosed && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', background: theme.surfaceAlt, color: theme.textMid, border: '1px solid ' + theme.border, borderRadius: '6px', padding: '2px 8px', fontSize: '11px', fontWeight: 700 }}>
                🔒 Lukket
              </span>
            )}
            {matchPrefs.booked != null && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "3px",
                  background: matchPrefs.booked ? "#ECFDF5" : "#FEF3C7",
                  color: matchPrefs.booked ? "#166534" : "#B45309",
                  border: "1px solid " + (matchPrefs.booked ? "#A7F3D0" : "#FCD34D"),
                  borderRadius: "6px",
                  padding: "2px 8px",
                  fontSize: "11px",
                  fontWeight: 700,
                }}
              >
                {matchPrefs.booked ? "Bane booket" : "Bane ikke booket"}
              </span>
            )}
            {matchPrefs.min != null && matchPrefs.max != null && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: "3px", background: theme.blueBg, color: theme.blue, border: "1px solid " + theme.blue + "40", borderRadius: "6px", padding: "2px 8px", fontSize: "11px", fontWeight: 700 }}>
                ELO {matchPrefs.min}-{matchPrefs.max}
              </span>
            )}
            <span style={{ ...tag(statusLabel.bg, statusLabel.color) }}>{statusLabel.text}</span>
          </div>
        </div>

        {/* Teams display */}
        {(() => {
          const myUid = String(user.id);
          const playerElo = (p) => {
            const uid = String(p.user_id);
            const fromHist = eloFromHistoryByUserId[uid];
            if (fromHist != null) return fromHist;
            if (uid === myUid) return myElo;
            return eloByUserId[uid] ?? 1000;
          };
          const avgElo = (team) => team.length > 0 ? Math.round(team.reduce((s, p) => s + playerElo(p), 0) / team.length) : null;
          const t1Avg = avgElo(t1);
          const t2Avg = avgElo(t2);
          return (
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px", padding: "12px", background: theme.surfaceAlt, borderRadius: "8px" }}>
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
                        <div onClick={() => { const prof = profilesById[String(p.user_id)]; if (prof) setViewPlayer(prof); }} style={{ display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer" }}>
                          <AvatarCircle avatar={profilesById[String(p.user_id)]?.avatar || p.user_emoji || "🎾"} size={34} emojiSize="15px" style={{ background: theme.accentBg, border: "1.5px solid " + theme.accent + "40" }} />
                          <span style={{ fontSize: "9px", color: theme.text, marginTop: "3px", fontWeight: 600 }}>{(p.user_name || "?").split(" ")[0]}</span>
                          <span style={{ fontSize: "8px", color: theme.accent, fontWeight: 700 }}>{playerElo(p)}</span>
                        </div>
                        {canKick && (
                          <button onClick={(e) => { e.stopPropagation(); kickPlayer(m.id, p.user_id, p.user_name); }} disabled={kickingBusy}
                            style={{ position: "absolute", top: -4, right: -4, width: 16, height: 16, borderRadius: "50%", border: "none", background: "#DC2626", color: "#fff", fontSize: 10, fontWeight: 700, cursor: kickingBusy ? "wait" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, lineHeight: 1 }}>
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
                        <div onClick={() => { const prof = profilesById[String(p.user_id)]; if (prof) setViewPlayer(prof); }} style={{ display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer" }}>
                          <AvatarCircle avatar={profilesById[String(p.user_id)]?.avatar || p.user_emoji || "🎾"} size={34} emojiSize="15px" style={{ background: theme.blueBg, border: "1.5px solid " + theme.blue + "40" }} />
                          <span style={{ fontSize: "9px", color: theme.text, marginTop: "3px", fontWeight: 600 }}>{(p.user_name || "?").split(" ")[0]}</span>
                          <span style={{ fontSize: "8px", color: theme.blue, fontWeight: 700 }}>{playerElo(p)}</span>
                        </div>
                        {canKick && (
                          <button onClick={(e) => { e.stopPropagation(); kickPlayer(m.id, p.user_id, p.user_name); }} disabled={kickingBusy}
                            style={{ position: "absolute", top: -4, right: -4, width: 16, height: 16, borderRadius: "50%", border: "none", background: "#DC2626", color: "#fff", fontSize: 10, fontWeight: 700, cursor: kickingBusy ? "wait" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, lineHeight: 1 }}>
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
          const bgColor = !mr.confirmed ? theme.warmBg : iWon ? theme.accentBg : iLost ? theme.redBg : "#F1F5F9";
          const borderColor = !mr.confirmed ? theme.warm : iWon ? theme.accent : iLost ? theme.red : theme.border;
          const textColor = !mr.confirmed ? theme.warm : iWon ? theme.accent : iLost ? theme.red : theme.textMid;
          return (
            <div style={{ padding: "14px", background: bgColor, borderRadius: "8px", marginBottom: "12px", textAlign: "center", border: "1.5px solid " + borderColor + "40" }}>
              <div style={{ fontSize: "20px", fontWeight: 800, letterSpacing: "0.05em", color: textColor }}>{mr.score_display || "—"}</div>
              <div style={{ fontSize: "12px", color: textColor, marginTop: "5px", fontWeight: 600 }}>
                {!mr.confirmed ? "⏳ Venter på bekræftelse" : iWon ? "🏆 Du vandt!" : iLost ? "😞 Du tabte" : `🏆 ${mr.match_winner === "team1" ? "Hold 1" : "Hold 2"} vandt`}
              </div>
              {mr.confirmed && eloChangeByMatchId[String(m.id)] != null && (
                <div style={{ fontSize: "14px", fontWeight: 800, color: eloChangeByMatchId[String(m.id)] >= 0 ? theme.accent : theme.red, marginTop: "6px", letterSpacing: "-0.01em" }}>
                  {eloChangeByMatchId[String(m.id)] >= 0 ? "+" : ""}{eloChangeByMatchId[String(m.id)]} ELO
                </div>
              )}
            </div>
          );
        })()}

        {/* Actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>

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
                  <div style={{ textAlign: "center", fontSize: "13px", color: "#B45309", fontWeight: 600, background: "#FEF3C7", borderRadius: "8px", padding: "8px" }}>
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
                  style={{ ...btn(true), width: "100%", justifyContent: "center", fontSize: "13px", background: "#16A34A", borderColor: "#16A34A" }}
                >
                  ✅ Godkendt — Vælg hold og tilmeld
                </button>
              );
            }
            if (myRequest.status === "rejected") {
              return (
                <div style={{ textAlign: "center", fontSize: "13px", color: theme.red, fontWeight: 600, background: theme.redBg, borderRadius: "8px", padding: "8px" }}>
                  ❌ Din anmodning er ikke godkendt
                </div>
              );
            }
          })()}

          {/* ---- Creator: pending join requests (closed match) ---- */}
          {isCreator && isClosed && pendingRequests.length > 0 && (
            <div style={{ background: theme.surfaceAlt, borderRadius: "8px", padding: "12px", border: "1px solid " + theme.border }}>
              <div style={{ fontSize: "12px", fontWeight: 700, color: theme.textMid, marginBottom: "8px" }}>
                🔒 Tilmeldingsanmodninger ({pendingRequests.length})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {pendingRequests.map(req => (
                  <div key={req.id} style={{ display: "flex", alignItems: "center", gap: "8px", justifyContent: "space-between" }}>
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
                        style={{ padding: "5px 10px", fontSize: "12px", fontWeight: 700, background: theme.accent, color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }}
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
              style={{
                ...btn(false),
                width: "100%",
                justifyContent: "center",
                fontSize: "12px",
                color: theme.warm,
                borderColor: theme.warm + "55",
                background: theme.warmBg,
              }}
            >
              {adminActionsOpen ? "Skjul admin-værktøjer ▲" : "Vis admin-værktøjer ▼"}
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
                background: m.seeking_player ? '#FEF3C7' : theme.surface,
                color: m.seeking_player ? '#B45309' : theme.textMid,
                borderColor: m.seeking_player ? '#FCD34D' : theme.border,
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

  const segmentBtnStyle = (active) => ({
    ...btn(false),
    padding: "8px 14px",
    fontSize: "13px",
    borderRadius: "999px",
    background: active ? theme.accent : theme.surfaceAlt,
    color: active ? "#fff" : theme.textMid,
    borderColor: active ? theme.accent : theme.border,
    boxShadow: active ? "0 2px 8px rgba(29, 78, 216, 0.28)" : "none",
    fontWeight: active ? 700 : 600,
  });

  const listTabBtnStyle = (active) => ({
    ...segmentBtnStyle(active),
    padding: "7px 14px",
    fontSize: "12px",
  });

  return (
    <div>
      <div className="pm-kampe-head" style={{ marginBottom: "10px", minHeight: "44px" }}>
        <h2 style={{ ...heading("clamp(20px,4.5vw,24px)"), lineHeight: 1.2 }}>Kampe</h2>
      </div>

      <div className="pm-ui-card pm-kampe-controls" style={{ marginBottom: "18px" }}>
        <div className="pm-kampe-controls-top">
          <div className="pm-kampe-segment" role="tablist" aria-label="Kampe format">
            {[
              { id: "padel", label: "2v2-kampe" },
              { id: "americano", label: "Americano" },
              { id: "liga", label: "Liga" },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={kampeFormat === f.id}
                onClick={() => {
                  setKampeFormat(f.id);
                  setShowCreate(false);
                  setShowAmericanoCreate(false);
                  setShowLigaCreate(false);
                }}
                style={segmentBtnStyle(kampeFormat === f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="pm-kampe-controls-action">
            {!loadingMatches && kampeFormat === "padel" && (
              <button type="button" onClick={() => setShowCreate(!showCreate)} style={btn(true)}>
                {showCreate ? "Annullér" : <><Plus size={15} /> Opret kamp</>}
              </button>
            )}
            {!loadingMatches && kampeFormat === "americano" && (
              <button type="button" onClick={() => setShowAmericanoCreate(!showAmericanoCreate)} style={btn(true)}>
                {showAmericanoCreate ? "Annullér" : <><Plus size={15} /> Opret turnering</>}
              </button>
            )}
            {!loadingMatches && kampeFormat === "liga" && user?.role === "admin" && (
              <button type="button" onClick={() => setShowLigaCreate((v) => !v)} style={btn(true)}>
                {showLigaCreate ? "Annullér" : <><Plus size={15} /> Opret liga</>}
              </button>
            )}
          </div>
        </div>

        {kampeFormat !== "liga" && (
          <>
            <div className="pm-kampe-controls-divider" />
            <div className="pm-kampe-controls-bottom">
              <div className="pm-kampe-segment" role="tablist" aria-label="Kampe scope">
                {[
                  { id: "alle", label: "Alle kampe" },
                  { id: "mine", label: "Mine kampe" },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={kampeScope === t.id}
                    onClick={() => {
                      setKampeScope(t.id);
                      mergeKampeSessionPrefs(user.id, { scope: t.id });
                      setSearchQuery("");
                    }}
                    style={segmentBtnStyle(kampeScope === t.id)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="pm-kampe-search-wrap">
                <Search size={16} className="pm-kampe-search-icon" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Søg spiller, bane eller beskrivelse..."
                  className="pm-kampe-search-input"
                />
              </div>
            </div>
          </>
        )}
      </div>
      {kampeFormat === "liga" && (
        <LigaTabEmbed user={user} showToast={showToast} createOpen={showLigaCreate} onCreateOpenChange={setShowLigaCreate} />
      )}

      {loadingMatches && kampeFormat !== "liga" ? (
        <div style={{ textAlign: "center", padding: "40px", color: theme.textLight, fontSize: "14px" }}>Indlæser kampe...</div>
      ) : kampeFormat === "liga" ? null : (
      <>
      {kampeFormat === "americano" && (
        <Suspense fallback={<div style={{ textAlign: "center", padding: "40px", color: theme.textLight, fontSize: "14px" }}>Indlæser Americano…</div>}>
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

      {kampeFormat === "padel" && (
      <>
      <div style={{ display: "flex", gap: "6px", marginBottom: "16px", flexWrap: "wrap" }}>
        {[
          { id: "open", label: `Åbne (${openMatches.length})` },
          { id: "active", label: `I gang (${activeMatches.length})` },
          { id: "completed", label: `Afsluttede (${completedMatches.length})` },
        ].map((t) => (
          <button key={t.id} type="button" onClick={() => setViewTab(t.id)} style={listTabBtnStyle(viewTab === t.id)}>
            {t.label}
          </button>
        ))}
      </div>

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
                color: newMatch.match_type === "open" ? "#fff" : theme.textMid,
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
                background: newMatch.match_type === "closed" ? "#475569" : theme.surface,
                color: newMatch.match_type === "closed" ? "#fff" : theme.textMid,
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
          <div className="pm-ui-card-soft pm-kampe-empty-state">
            <div style={{ fontSize: "32px", marginBottom: "12px" }}>⚔️</div>
            <div style={{ fontSize: "15px", fontWeight: 600, color: theme.text, marginBottom: "6px" }}>Ingen åbne kampe</div>
            <div style={{ fontSize: "13px", lineHeight: 1.5, marginBottom: "16px" }}>Opret den første kamp og find nogen at spille med!</div>
            <button type="button" onClick={() => setShowCreate(true)} style={{ ...btn(true), fontSize: "13px" }}>
              <Plus size={14} /> Opret kamp
            </button>
          </div>
        )}
        {viewTab === "active" && activeMatches.length === 0 && (
          <div className="pm-ui-card-soft pm-kampe-empty-state">
            <div style={{ fontSize: "32px", marginBottom: "12px" }}>🎾</div>
            <div style={{ fontSize: "15px", fontWeight: 600, color: theme.text, marginBottom: "6px" }}>Ingen aktive kampe</div>
            <div style={{ fontSize: "13px", lineHeight: 1.5 }}>Tilmeld dig en åben kamp for at komme i gang.</div>
          </div>
        )}
        {viewTab === "completed" && completedMatches.length === 0 && (
          <div className="pm-ui-card-soft pm-kampe-empty-state">
            <div style={{ fontSize: "32px", marginBottom: "12px" }}>📊</div>
            <div style={{ fontSize: "15px", fontWeight: 600, color: theme.text, marginBottom: "6px" }}>Ingen afsluttede kampe endnu</div>
            <div style={{ fontSize: "13px", lineHeight: 1.5 }}>Spil din første kamp og se dit resultat her.</div>
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
