import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { Profile, Court, Match } from '../api/base44Client';
import { supabase } from '../lib/supabase';
import { readKampeSessionPrefs, mergeKampeSessionPrefs } from '../lib/kampeSessionPrefs';
import { AmericanoTab } from '../features/americano/AmericanoTab';
import { theme, btn, inputStyle, labelStyle, heading, tag } from '../lib/platformTheme';
import { resolveDisplayName, sanitizeText } from '../lib/platformUtils';
import { statsFromEloHistoryRows, useProfileEloBundle, fetchEloByUserIdFromHistory } from '../lib/eloHistoryUtils';
import { eloOf, fmtClock, matchTimeLabel, timeToMinutes, matchCompletedSortMs, formatMatchDateDa } from '../lib/matchDisplayUtils';
import { calculateAndApplyElo } from '../lib/applyEloMatch';
import { createNotification } from '../lib/notifications';
import { Clock, MapPin, Plus, UserMinus, Trash2 } from 'lucide-react';
import { TeamSelectModal } from './TeamSelectModal';
import { ResultModal } from './ResultModal';
import { PlayerProfileModal } from './PlayerProfileModal';
import {
  getMatchVenueOptions,
  courtIdFromVenueSelection,
  courtNameFromVenueSelection,
} from '../lib/matchVenueOptions';

function matchPlayerTeam(p) {
  return Number(p?.team);
}

export function KampeTab({ user, showToast, tabActive = true }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user: authUser, refreshProfile } = useAuth();
  const myDisplayName                 = resolveDisplayName(user, authUser);
  const eloSyncKeyKampe = `${user.elo_rating}|${user.games_played}|${user.games_won}`;
  const { profileFresh: kampeProfileFresh, ratedRows: kampeRatedRows, reloadProfileEloBundle: reloadKampeEloBundle } =
    useProfileEloBundle(user.id, eloSyncKeyKampe);
  const [showCreate, setShowCreate]   = useState(false);
  const [showAmericanoCreate, setShowAmericanoCreate] = useState(false);
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
  const [profilesById, setProfilesById] = useState({});
  const [viewTab, setViewTab]         = useState(() => {
    const s = readKampeSessionPrefs(user.id);
    if (s?.view === "open" || s?.view === "active" || s?.view === "completed") return s.view;
    return "open";
  }); // "open" | "active" | "completed"
  const [kampeFormat, setKampeFormat] = useState(() => {
    const s = readKampeSessionPrefs(user.id);
    if (s?.format === "padel" || s?.format === "americano") return s.format;
    return "padel";
  }); // "padel" | "americano"
  const [newMatch, setNewMatch]       = useState({
    court_id: "",
    date: new Date().toISOString().split("T")[0],
    time: "20:00",
    duration: "120",
    description: "",
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

  const loadData = useCallback(async () => {
    try {
      const [cd, md, profiles] = await Promise.all([Court.filter(), Match.filter(), Profile.filter()]);
      setCourts(cd || []);
      const eloMap = {};
      const pById = {};
      (profiles || []).forEach((pr) => {
        const id = String(pr.id);
        eloMap[id] = eloOf(pr);
        pById[id] = pr;
      });

      const allMatches = md || [];
      setMatches(allMatches);

      const vOpts = getMatchVenueOptions(cd || []);
      if (vOpts.length > 0) {
        setNewMatch((m) => {
          if (m.court_id && vOpts.some((o) => o.id === m.court_id)) return m;
          return { ...m, court_id: vOpts[0].id };
        });
      }

      const { data: mpd } = await supabase.from("match_players").select("*");
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

      const { data: mrd } = await supabase.from("match_results").select("*");
      const mrMap = {};
      (mrd || []).forEach((mr) => { mrMap[mr.match_id] = mr; });
      setMatchResults(mrMap);
    } catch (e) { console.error(e); }
    finally {
      setLoadingMatches(false);
      void reloadKampeEloBundle();
    }
  }, [user.id, reloadKampeEloBundle]);

  useEffect(() => { void loadData(); }, [loadData]);

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
        level_range: String(myElo), status: "open", max_players: 4, current_players: 1,
        description: sanitizeText(newMatch.description.trim()) || null,
      };
      const { data: created, error } = await supabase.from("matches").insert(row).select().single();
      if (error) throw error;
      await supabase.from("match_players").insert({
        match_id: created.id, user_id: user.id, user_name: myDisplayName,
        user_email: authUser?.email || user.email, user_emoji: user.avatar || "🎾", team: 1,
      });
      setShowCreate(false);
      showToast("Kamp oprettet! Du er på Hold 1 🎾");
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
        await supabase.from("matches").update({ status: "full", current_players: 4 }).eq("id", matchId);
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

  const leaveMatch = async (matchId) => {
    setBusyId(matchId);
    try {
      const { error } = await supabase.from("match_players").delete().eq("match_id", matchId).eq("user_id", user.id);
      if (error) throw error;
      const mp = (matchPlayers[matchId] || []).filter(p => p.user_id !== user.id);
      const match = matches.find(m => m.id === matchId);
      const isCreator = match && String(match.creator_id) === String(user.id);

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

  const startMatch = async (matchId) => {
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
    const mp = matchPlayers[matchId] || [];
    const others = mp.filter(p => p.user_id !== user.id);
    const msg = others.length > 0
      ? `Slet denne kamp? ${others.length} andre spillere bliver også afmeldt.`
      : "Slet denne kamp?";
    if (!window.confirm(msg)) return;
    setBusyId(matchId);
    try {
      const mpBefore = matchPlayers[matchId] || [];
      await supabase.from("match_players").delete().eq("match_id", matchId);
      await supabase.from("matches").update({ status: "cancelled", current_players: 0 }).eq("id", matchId).eq("creator_id", user.id);
      mpBefore.filter(p => p.user_id !== user.id).forEach(p => {
        createNotification(p.user_id, "match_cancelled", "Kamp aflyst ❌", `${myDisplayName} har aflyst kampen.`, matchId);
      });
      showToast("Kamp slettet.");
      await loadData();
    } catch (e) { showToast("Fejl: " + (e.message || "Prøv igen")); }
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
      showToast("Resultat afvist. Indrapportér igen.");
      await loadData();
    } catch (e) { showToast("Fejl: " + (e.message || "Prøv igen")); }
    finally { setBusyId(null); }
  };

  const getStatus = (m) => (m.status ?? "open").toString().toLowerCase();
  const sortJoinedFirst = (list) => [...list].sort((a, b) => {
    const aJ = (matchPlayers[a.id] || []).some(p => p.user_id === user.id) ? 1 : 0;
    const bJ = (matchPlayers[b.id] || []).some(p => p.user_id === user.id) ? 1 : 0;
    return bJ - aJ;
  });
  const openMatches = sortJoinedFirst(matches.filter(m => { const s = getStatus(m); if (s !== "open" && s !== "active" && s !== "full") return false; return (matchPlayers[m.id] || []).length > 0; }));
  const activeMatches = matches.filter(m => getStatus(m) === "in_progress" && (matchPlayers[m.id] || []).some(p => p.user_id === user.id));
  const completedMatches = matches
    .filter(m => getStatus(m) === "completed" && (matchPlayers[m.id] || []).some(p => p.user_id === user.id))
    .sort((a, b) => matchCompletedSortMs(b, matchResults) - matchCompletedSortMs(a, matchResults))
    .slice(0, 20);

  const renderMatchCard = (m) => {
    const mp = matchPlayers[m.id] || [];
    const mr = matchResults[m.id];
    const left = (m.max_players || 4) - mp.length;
    const joined = mp.some(p => p.user_id === user.id);
    const isCreator = String(m.creator_id) === String(user.id);
    const busy = busyId === m.id;
    const status = getStatus(m);
    const t1 = mp.filter(p => matchPlayerTeam(p) === 1);
    const t2 = mp.filter(p => matchPlayerTeam(p) === 2);
    const isFull = t1.length >= 2 && t2.length >= 2;
    const isPlayerInMatch = mp.some(p => p.user_id === user.id);

    const statusLabel = {
      open: { text: left > 0 ? `${left} ledig${left > 1 ? "e" : ""}` : "Fuld", bg: left > 0 ? theme.accentBg : theme.warmBg, color: left > 0 ? theme.accent : theme.warm },
      full: { text: "Klar til start", bg: theme.blueBg, color: theme.blue },
      in_progress: { text: "I gang", bg: theme.warmBg, color: theme.warm },
      completed: { text: "Afsluttet", bg: "#F1F5F9", color: theme.textLight },
    }[status] || { text: status, bg: "#F1F5F9", color: theme.textLight };

    return (
      <div id={"pm-match-" + m.id} key={m.id} style={{ background: theme.surface, borderRadius: theme.radius, padding: "20px", boxShadow: theme.shadow, border: "1px solid " + theme.border, scrollMarginTop: "88px" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px", gap: "10px" }}>
          <div>
            <div style={{ fontSize: "15px", fontWeight: 700, display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
              <Clock size={15} color={theme.accent} />
              <span>{formatMatchDateDa(m.date)} · {matchTimeLabel(m)}</span>
            </div>
            <div style={{ fontSize: "12px", color: theme.textLight, marginTop: "4px", display: "flex", alignItems: "center", gap: "3px" }}><MapPin size={11} /> {m.court_name}</div>
            {m.description && <div style={{ fontSize: "12px", color: theme.textMid, marginTop: "4px", fontStyle: "italic", lineHeight: 1.4 }}>💬 {m.description}</div>}
          </div>
          <span style={{ ...tag(statusLabel.bg, statusLabel.color), flexShrink: 0 }}>{statusLabel.text}</span>
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
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px", padding: "12px", background: "#F8FAFC", borderRadius: "8px" }}>
              {/* Team 1 */}
              <div style={{ flex: 1, textAlign: "center" }}>
                <div style={{ fontSize: "10px", fontWeight: 700, color: theme.accent, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "2px" }}>Hold 1</div>
                {t1Avg !== null && <div style={{ fontSize: "10px", fontWeight: 700, color: theme.accent, marginBottom: "6px", opacity: 0.7 }}>{t1Avg} ELO</div>}
                {t1Avg === null && <div style={{ height: "6px" }} />}
                <div style={{ display: "flex", justifyContent: "center", gap: "8px" }}>
                  {t1.map(p => (
                    <div key={p.id || p.user_id} onClick={() => { const prof = profilesById[String(p.user_id)]; if (prof) setViewPlayer(prof); }} style={{ display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer", minWidth: "42px" }}>
                      <div style={{ width: "34px", height: "34px", borderRadius: "50%", background: theme.accentBg, border: "1.5px solid " + theme.accent + "40", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "15px" }}>{p.user_emoji || "🎾"}</div>
                      <span style={{ fontSize: "9px", color: theme.text, marginTop: "3px", fontWeight: 600 }}>{(p.user_name || "?").split(" ")[0]}</span>
                      <span style={{ fontSize: "8px", color: theme.accent, fontWeight: 700 }}>{playerElo(p)}</span>
                    </div>
                  ))}
                  {Array.from({ length: Math.max(0, 2 - t1.length) }).map((_, i) => (
                    <div key={"t1e" + i} style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: "42px" }}>
                      <div style={{ width: "34px", height: "34px", borderRadius: "50%", border: "1.5px dashed " + theme.border, display: "flex", alignItems: "center", justifyContent: "center" }}><Plus size={10} color={theme.textLight} /></div>
                    </div>
                  ))}
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
                  {t2.map(p => (
                    <div key={p.id || p.user_id} onClick={() => { const prof = profilesById[String(p.user_id)]; if (prof) setViewPlayer(prof); }} style={{ display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer", minWidth: "42px" }}>
                      <div style={{ width: "34px", height: "34px", borderRadius: "50%", background: theme.blueBg, border: "1.5px solid " + theme.blue + "40", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "15px" }}>{p.user_emoji || "🎾"}</div>
                      <span style={{ fontSize: "9px", color: theme.text, marginTop: "3px", fontWeight: 600 }}>{(p.user_name || "?").split(" ")[0]}</span>
                      <span style={{ fontSize: "8px", color: theme.blue, fontWeight: 700 }}>{playerElo(p)}</span>
                    </div>
                  ))}
                  {Array.from({ length: Math.max(0, 2 - t2.length) }).map((_, i) => (
                    <div key={"t2e" + i} style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: "42px" }}>
                      <div style={{ width: "34px", height: "34px", borderRadius: "50%", border: "1.5px dashed " + theme.border, display: "flex", alignItems: "center", justifyContent: "center" }}><Plus size={10} color={theme.textLight} /></div>
                    </div>
                  ))}
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
            </div>
          );
        })()}

        {/* Actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {status === "open" && left > 0 && !joined && (
            <button onClick={() => setTeamSelectMatch(m.id)} disabled={busy} style={{ ...btn(true), width: "100%", justifyContent: "center", fontSize: "13px" }}>Tilmeld mig</button>
          )}
          {joined && status !== "completed" && (
            <div style={{ textAlign: "center", fontSize: "13px", color: theme.accent, fontWeight: 600 }}>✅ Tilmeldt</div>
          )}
          {isCreator && (status === "full" || (status === "open" && isFull)) && (
            <button onClick={() => startMatch(m.id)} disabled={busy} style={{ ...btn(true), width: "100%", justifyContent: "center", fontSize: "13px", background: theme.warm }}>
              🎾 Start kamp
            </button>
          )}
          {status === "in_progress" && isPlayerInMatch && !mr && (
            <button onClick={() => setResultMatch(m.id)} disabled={busy} style={{ ...btn(true), width: "100%", justifyContent: "center", fontSize: "13px" }}>
              📊 Indrapportér resultat
            </button>
          )}
          {mr && !mr.confirmed && mr.submitted_by !== user.id && isPlayerInMatch && (
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={() => confirmResult(m.id)} disabled={busy} style={{ ...btn(true), flex: 1, justifyContent: "center", fontSize: "13px" }}>✅ Bekræft</button>
              <button onClick={() => rejectResult(m.id)} disabled={busy} style={{ ...btn(false), flex: 1, justifyContent: "center", fontSize: "13px", color: theme.red }}>❌ Afvis</button>
            </div>
          )}
          {joined && !isCreator && (status === "open" || status === "full") && (
            <button onClick={() => leaveMatch(m.id)} disabled={busy} style={{ ...btn(false), width: "100%", justifyContent: "center", fontSize: "13px", color: theme.textMid }}>
              <UserMinus size={14} /> Afmeld mig
            </button>
          )}
          {isCreator && status !== "completed" && status !== "in_progress" && (
            <button onClick={() => deleteMatch(m.id)} disabled={busy} style={{ ...btn(false), width: "100%", justifyContent: "center", fontSize: "13px", color: theme.red, borderColor: theme.red + "55" }}>
              <Trash2 size={14} /> Slet kamp
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="pm-kampe-head" style={{ marginBottom: "12px", minHeight: "44px" }}>
        <h2 style={{ ...heading("clamp(20px,4.5vw,24px)"), lineHeight: 1.2 }}>Kampe</h2>
        <div className="pm-kampe-head-actions" style={{ minHeight: "40px" }}>
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
        </div>
      </div>

      <div style={{ display: "flex", gap: "8px", marginBottom: "20px", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => {
            setKampeFormat("padel");
            setShowCreate(false);
            setShowAmericanoCreate(false);
          }}
          style={{ ...btn(kampeFormat === "padel"), padding: "8px 16px", fontSize: "13px" }}
        >
          Almindelig padel (2v2)
        </button>
        <button
          type="button"
          onClick={() => {
            setKampeFormat("americano");
            setShowCreate(false);
            setShowAmericanoCreate(false);
          }}
          style={{ ...btn(kampeFormat === "americano"), padding: "8px 16px", fontSize: "13px" }}
        >
          Americano
        </button>
      </div>

      {loadingMatches ? (
        <div style={{ textAlign: "center", padding: "40px", color: theme.textLight, fontSize: "14px" }}>Indlæser kampe...</div>
      ) : (
      <>
      {kampeFormat === "americano" && (
        <AmericanoTab
          profile={user}
          showToast={showToast}
          embedInKampe
          createOpen={showAmericanoCreate}
          onCreateOpenChange={setShowAmericanoCreate}
          initialSubTab={(() => {
            const s = readKampeSessionPrefs(user.id);
            if (s?.americanoView === "open" || s?.americanoView === "playing" || s?.americanoView === "completed") {
              return s.americanoView;
            }
            return undefined;
          })()}
          onAmericanoSubTabChange={persistAmericanoSubTab}
        />
      )}

      {kampeFormat === "padel" && (
      <>
      <div style={{ display: "flex", gap: "6px", marginBottom: "16px", flexWrap: "wrap" }}>
        {[
          { id: "open", label: `Åbne (${openMatches.length})` },
          { id: "active", label: `I gang (${activeMatches.length})` },
          { id: "completed", label: `Afsluttede (${completedMatches.length})` },
        ].map((t) => (
          <button key={t.id} type="button" onClick={() => setViewTab(t.id)} style={{ ...btn(viewTab === t.id), padding: "7px 14px", fontSize: "12px" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Create match form */}
      {showCreate && (
        <div style={{ background: theme.surface, borderRadius: theme.radius, padding: "clamp(16px,3vw,20px)", boxShadow: theme.shadow, marginBottom: "20px", border: "1px solid " + theme.border }}>
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
            <div><label style={labelStyle}>Dato</label>
              <input type="date" value={newMatch.date} onChange={e => setNewMatch(m => ({ ...m, date: e.target.value }))} style={{ ...inputStyle, fontSize: "13px" }} /></div>
            <div><label style={labelStyle}>Starttid</label>
              <input type="time" value={newMatch.time} onChange={e => setNewMatch(m => ({ ...m, time: e.target.value }))} style={{ ...inputStyle, fontSize: "13px" }} /></div>
            <div><label style={labelStyle}>Varighed</label>
              <select value={newMatch.duration} onChange={e => setNewMatch(m => ({ ...m, duration: e.target.value }))} style={{ ...inputStyle, fontSize: "13px" }}>
                <option value="60">1 time</option>
                <option value="90">1½ time</option>
                <option value="120">2 timer</option>
                <option value="150">2½ timer</option>
                <option value="180">3 timer</option>
              </select></div>
          </div>
          <label style={{ ...labelStyle, marginTop: "12px" }}>Beskrivelse (valgfrit)</label>
          <textarea value={newMatch.description} onChange={e => setNewMatch(m => ({ ...m, description: e.target.value }))} placeholder="F.eks. 'Søger venstreside-spiller' eller 'Begyndervenlig kamp'" style={{ ...inputStyle, fontSize: "13px", height: "60px", resize: "vertical" }} />
          <button onClick={createMatch} disabled={creating || !newMatch.court_id || venueOptions.length === 0} style={{ ...btn(true), marginTop: "16px", width: "100%", justifyContent: "center", opacity: creating ? 0.55 : 1 }}>
            {creating ? "Opretter..." : "Opret kamp"}
          </button>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {viewTab === "open" && openMatches.map((m) => renderMatchCard(m, "open"))}
        {viewTab === "active" && activeMatches.map((m) => renderMatchCard(m, "active"))}
        {viewTab === "completed" && completedMatches.map((m) => renderMatchCard(m, "completed"))}

        {viewTab === "open" && openMatches.length === 0 && (
          <div style={{ textAlign: "center", padding: "48px 20px", color: theme.textLight }}>
            <div style={{ fontSize: "32px", marginBottom: "12px" }}>⚔️</div>
            <div style={{ fontSize: "15px", fontWeight: 600, color: theme.text, marginBottom: "6px" }}>Ingen åbne kampe</div>
            <div style={{ fontSize: "13px", lineHeight: 1.5, marginBottom: "16px" }}>Opret den første kamp og find nogen at spille med!</div>
            <button type="button" onClick={() => setShowCreate(true)} style={{ ...btn(true), fontSize: "13px" }}>
              <Plus size={14} /> Opret kamp
            </button>
          </div>
        )}
        {viewTab === "active" && activeMatches.length === 0 && (
          <div style={{ textAlign: "center", padding: "48px 20px", color: theme.textLight }}>
            <div style={{ fontSize: "32px", marginBottom: "12px" }}>🎾</div>
            <div style={{ fontSize: "15px", fontWeight: 600, color: theme.text, marginBottom: "6px" }}>Ingen aktive kampe</div>
            <div style={{ fontSize: "13px", lineHeight: 1.5 }}>Tilmeld dig en åben kamp for at komme i gang.</div>
          </div>
        )}
        {viewTab === "completed" && completedMatches.length === 0 && (
          <div style={{ textAlign: "center", padding: "48px 20px", color: theme.textLight }}>
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
