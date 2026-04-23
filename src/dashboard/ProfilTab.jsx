import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import { font, theme, btn, inputStyle, labelStyle, heading, tag } from '../lib/platformTheme';
import { resolveDisplayName, sanitizeText, availabilityTags } from '../lib/platformUtils';
import { mergeKampeSessionPrefs } from '../lib/kampeSessionPrefs';
import { REGIONS, AVAILABILITY, DAYS_OF_WEEK, PLAY_STYLES, COURT_SIDES, LEVELS, LEVEL_DESCS, levelLabel, INTENTS } from '../lib/platformConstants';
import { normalizeStringArrayField, canonicalRegionForForm, calcAge } from '../lib/profileUtils';
import { statsFromEloHistoryRows, useProfileEloBundle, winStreaksFromEloHistory, usePartnerOpponentStats, sortEloHistoryChronological } from '../lib/eloHistoryUtils';
import { americanoOutcomeColors } from '../features/americano/americanoOutcomeColors';
import { EloGraph } from '../components/EloGraph';
import { MapPin, Settings, Swords, Trophy, TrendingUp, Save, X, Sun, Moon } from 'lucide-react';
import { profileFormState } from './profileTabHelpers';
import { uploadAvatar, hasPendingAvatar, applyPendingAvatar } from '../lib/avatarUpload';
import { AvatarPicker } from '../components/AvatarPicker';
import { AvatarCircle } from '../components/AvatarCircle';

const PROFILE_OVERVIEW_MODE_PREFIX = "pm-profile-overview-mode:";
const PROFILE_OVERVIEW_MODES = new Set(["2v2", "americano", "liga"]);

function readProfileOverviewMode(userId) {
  if (typeof localStorage === "undefined" || !userId) return null;
  try {
    const raw = localStorage.getItem(PROFILE_OVERVIEW_MODE_PREFIX + String(userId));
    if (!raw || !PROFILE_OVERVIEW_MODES.has(raw)) return null;
    return raw;
  } catch {
    return null;
  }
}

function writeProfileOverviewMode(userId, mode) {
  if (typeof localStorage === "undefined" || !userId || !PROFILE_OVERVIEW_MODES.has(mode)) return;
  try {
    localStorage.setItem(PROFILE_OVERVIEW_MODE_PREFIX + String(userId), mode);
  } catch {
    // Ignore storage issues in private mode / quota exceeded.
  }
}

function formatUpdatedAtDa(value) {
  if (!value) return "ukendt";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "ukendt";
  return date.toLocaleString("da-DK", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ProfilTab({ user, showToast, setTab, dark, onDarkModeChange }) {
  const { updateProfile, user: authUser } = useAuth();
  const displayName = resolveDisplayName(user, authUser);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const eloSyncKey = `${user.elo_rating}|${user.games_played}|${user.games_won}`;
  const { bundleLoading, profileFresh, ratedRows } = useProfileEloBundle(user.id, eloSyncKey);
  const pStats = profileFresh || user;
  const histStats = useMemo(() => statsFromEloHistoryRows(ratedRows), [ratedRows]);
  const elo = histStats?.elo ?? Math.round(Number(pStats.elo_rating) || 1000);
  const games = histStats?.games ?? (pStats.games_played || 0);
  const wins = histStats?.wins ?? (pStats.games_won || 0);
  const eloHistory = ratedRows;
  const statsLoading = bundleLoading;

  // Ekstra statistik beregnet fra allerede indlæste ratedRows
  const peakElo = useMemo(() => {
    if (ratedRows.length === 0) return null;
    const sorted = sortEloHistoryChronological(ratedRows);
    let running = Math.round(Number(sorted[0].old_rating) || 1000);
    let peak = running;
    for (const row of sorted) {
      const ch = row.change != null && Number.isFinite(Number(row.change))
        ? Number(row.change)
        : Math.round(Number(row.new_rating || 0) - Number(row.old_rating || 0));
      running = Math.max(100, Math.round(running + ch));
      peak = Math.max(peak, running);
    }
    return peak;
  }, [ratedRows]);
  const recentForm = ratedRows.slice(-5).reverse();

  const { partnerOpponentStats, partnerOpponentLoading } = usePartnerOpponentStats(user.id, ratedRows);

  const [form, setForm] = useState(() => profileFormState(user));

  useEffect(() => {
    if (!editing) setForm(profileFormState(user));
  }, [user, editing]);

  /* Automatisk upload af billede valgt under oprettelse — gemmes i sessionStorage */
  useEffect(() => {
    if (!user?.id || !hasPendingAvatar()) return;
    let cancelled = false;
    (async () => {
      const url = await applyPendingAvatar(user.id);
      if (cancelled || !url) return;
      try {
        await updateProfile({ avatar: url });
        showToast('Profilbillede gemt! 📸');
      } catch (e) {
        console.warn('Auto-avatar apply fejlede:', e.message);
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const [pendingAvatarFile, setPendingAvatarFile]   = useState(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl]     = useState(null);
  const [avatarUploading, setAvatarUploading]       = useState(false);
  const [overviewMode, setOverviewMode] = useState("2v2");
  const [ligaLoading, setLigaLoading] = useState(true);
  const [ligaStats, setLigaStats] = useState({
    leagues: 0,
    matches: 0,
    wins: 0,
    losses: 0,
    draws: 0,
  });
  const [overviewLastUpdated, setOverviewLastUpdated] = useState({
    "2v2": null,
    americano: null,
    liga: null,
  });
  const overviewRef = useRef(null);
  const performanceRef = useRef(null);
  const relationsRef = useRef(null);
  const actionsRef = useRef(null);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const toggleAvail = (a) => setForm(f => {
    const cur = normalizeStringArrayField(f.availability);
    return { ...f, availability: cur.includes(a) ? cur.filter((x) => x !== a) : [...cur, a] };
  });
  const toggleDay = (d) => setForm(f => {
    const cur = normalizeStringArrayField(f.available_days);
    return { ...f, available_days: cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d] };
  });

  useEffect(() => {
    if (!user?.id) {
      setOverviewMode("2v2");
      return;
    }
    const persistedMode = readProfileOverviewMode(user.id);
    setOverviewMode(persistedMode || "2v2");
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    writeProfileOverviewMode(user.id, overviewMode);
  }, [user?.id, overviewMode]);

  useEffect(() => {
    if (statsLoading || !user?.id) return;
    const now = new Date();
    setOverviewLastUpdated((prev) => ({
      ...prev,
      "2v2": now,
      americano: now,
    }));
  }, [
    statsLoading,
    user?.id,
    eloSyncKey,
    user?.americano_played,
    user?.americano_wins,
    user?.americano_draws,
    user?.americano_losses,
  ]);

  useEffect(() => {
    if (!user?.id) {
      setLigaStats({ leagues: 0, matches: 0, wins: 0, losses: 0, draws: 0 });
      setLigaLoading(false);
      setOverviewLastUpdated((prev) => ({ ...prev, liga: null }));
      return;
    }

    let cancelled = false;
    setLigaLoading(true);

    (async () => {
      try {
        const { data: teamRows, error: teamError } = await supabase
          .from("league_teams")
          .select("id, league_id")
          .or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`);

        if (teamError) throw teamError;

        const teams = teamRows || [];
        const teamIds = teams.map((t) => t.id).filter(Boolean);
        const leagueIds = [...new Set(teams.map((t) => t.league_id).filter(Boolean))];

        if (teamIds.length === 0) {
          if (!cancelled) {
            setLigaStats({ leagues: leagueIds.length, matches: 0, wins: 0, losses: 0, draws: 0 });
            setLigaLoading(false);
          }
          return;
        }

        const [team1Res, team2Res] = await Promise.all([
          supabase
            .from("league_matches")
            .select("id, team1_id, team2_id, winner_id, status")
            .eq("status", "reported")
            .in("team1_id", teamIds),
          supabase
            .from("league_matches")
            .select("id, team1_id, team2_id, winner_id, status")
            .eq("status", "reported")
            .in("team2_id", teamIds),
        ]);

        if (team1Res.error) throw team1Res.error;
        if (team2Res.error) throw team2Res.error;

        const uniqueMatches = new Map();
        for (const m of [...(team1Res.data || []), ...(team2Res.data || [])]) {
          uniqueMatches.set(m.id, m);
        }

        const myTeamIds = new Set(teamIds);
        let matches = 0;
        let winsCount = 0;
        let lossesCount = 0;
        let drawsCount = 0;

        for (const m of uniqueMatches.values()) {
          const involved = myTeamIds.has(m.team1_id) || (m.team2_id && myTeamIds.has(m.team2_id));
          if (!involved) continue;
          matches += 1;

          if (!m.winner_id) {
            drawsCount += 1;
            continue;
          }

          if (myTeamIds.has(m.winner_id)) winsCount += 1;
          else lossesCount += 1;
        }

        if (!cancelled) {
          setLigaStats({
            leagues: leagueIds.length,
            matches,
            wins: winsCount,
            losses: lossesCount,
            draws: drawsCount,
          });
        }
      } catch (error) {
        console.warn("Liga overview stats fejlede:", error?.message || error);
        if (!cancelled) {
          setLigaStats({ leagues: 0, matches: 0, wins: 0, losses: 0, draws: 0 });
        }
      } finally {
        if (!cancelled) {
          setLigaLoading(false);
          setOverviewLastUpdated((prev) => ({ ...prev, liga: new Date() }));
        }
      }
    })();

    return () => { cancelled = true; };
  }, [user?.id]);

  const handleSave = async () => {
    const region = canonicalRegionForForm(form.area) || form.area;
    const availability = normalizeStringArrayField(form.availability);
    const available_days = normalizeStringArrayField(form.available_days);
    setSaving(true);
    let avatarValue = form.avatar;
    if (pendingAvatarFile) {
      setAvatarUploading(true);
      try {
        avatarValue = await uploadAvatar(user.id, pendingAvatarFile);
      } catch (e) {
        showToast('Billedet kunne ikke uploades: ' + e.message);
        setSaving(false);
        setAvatarUploading(false);
        return;
      }
      setAvatarUploading(false);
    }
    try {
      await updateProfile({
        area: region,
        city: form.city.trim() || null,
        level: form.level ? parseFloat(form.level.match(/[\d.]+/)?.[0] || "3") : undefined,
        play_style: form.play_style,
        court_side: form.court_side || null,
        bio: sanitizeText(form.bio.trim()),
        avatar: avatarValue,
        availability,
        available_days,
        birth_year: form.birth_year ? parseInt(form.birth_year, 10) : null,
        birth_month: form.birth_month ? parseInt(form.birth_month, 10) : null,
        birth_day: form.birth_day ? parseInt(form.birth_day, 10) : null,
        // Matchmaking
        seeking_match:     form.seeking_match,
        seeking_match_at:  form.seeking_match && !user.seeking_match ? new Date().toISOString() : form.seeking_match ? user.seeking_match_at : null,
        intent_now:        form.intent_now || null,
        travel_willing:    form.travel_willing,
      });
      if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
      setPendingAvatarFile(null);
      setAvatarPreviewUrl(null);
      setEditing(false);
      showToast("Profil opdateret! ✅");
    } catch (e) {
      console.error(e);
      showToast("Kunne ikke gemme. Prøv igen.");
    } finally { setSaving(false); }
  };

  const winPct = games > 0 ? Math.round((wins / games) * 100) : 0;
  const americanoPlayed = Number(user.americano_played) || 0;
  const americanoWins = Number(user.americano_wins) || 0;
  const americanoDraws = Number(user.americano_draws) || 0;
  const americanoLosses = Number(user.americano_losses) || 0;
  const americanoRounds = americanoWins + americanoDraws + americanoLosses;
  const americanoWinPct = americanoRounds > 0 ? Math.round((americanoWins / americanoRounds) * 100) : 0;
  const ligaWinPct = ligaStats.matches > 0 ? Math.round((ligaStats.wins / ligaStats.matches) * 100) : 0;
  const twoVTwoOverviewCards = [
    { label: "ELO", value: elo, color: theme.accent },
    { label: "Win %", value: games > 0 ? winPct + "%" : "—", color: theme.accent },
    { label: "Kampe", value: games, color: theme.blue },
    { label: "Sejre", value: wins, color: theme.warm },
  ];
  const americanoOverviewCards = [
    { label: "Turneringer", value: americanoPlayed, color: theme.text },
    { label: "Runder i alt", value: americanoRounds, color: theme.blue },
    { label: "Runder vundet", value: americanoWins, color: americanoOutcomeColors.win.text },
    { label: "Runder uafgjort", value: americanoDraws, color: americanoOutcomeColors.tie.text },
    { label: "Runder tabt", value: americanoLosses, color: americanoOutcomeColors.loss.text },
    { label: "Win %", value: americanoRounds > 0 ? americanoWinPct + "%" : "—", color: theme.accent },
  ];
  const ligaOverviewCards = [
    { label: "Ligaer", value: ligaStats.leagues, color: theme.text },
    { label: "Kampe", value: ligaStats.matches, color: theme.blue },
    { label: "Sejre", value: ligaStats.wins, color: theme.green },
    { label: "Tab", value: ligaStats.losses, color: theme.red },
    { label: "Uafgjort", value: ligaStats.draws, color: theme.textLight },
    { label: "Win %", value: ligaStats.matches > 0 ? ligaWinPct + "%" : "--", color: theme.accent },
  ];
  const activeOverviewCards =
    overviewMode === "americano"
      ? americanoOverviewCards
      : overviewMode === "liga"
        ? ligaOverviewCards
        : twoVTwoOverviewCards;
  const activeOverviewSource =
    overviewMode === "americano"
      ? "Datakilde: Americano-turneringer"
      : overviewMode === "liga"
        ? "Datakilde: Liga-hold og rapporterede ligakampe"
        : "Datakilde: 2v2 kamphistorik";
  const activeOverviewUpdatedAt = formatUpdatedAtDa(overviewLastUpdated[overviewMode]);
  const jumpToSection = (ref) => {
    if (!ref?.current) return;
    ref.current.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div data-tour="profile-main">
      {!editing ? (
      <div>
        <h2 style={{ ...heading("clamp(20px,4.5vw,24px)"), marginBottom: "20px" }}>Min profil</h2>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "12px" }}>
          <button onClick={() => jumpToSection(overviewRef)} style={{ ...btn(false), padding: "6px 10px", fontSize: "11px", background: theme.surfaceAlt }}>Overblik</button>
          <button onClick={() => jumpToSection(performanceRef)} style={{ ...btn(false), padding: "6px 10px", fontSize: "11px", background: theme.surfaceAlt }}>Performance</button>
          <button onClick={() => jumpToSection(relationsRef)} style={{ ...btn(false), padding: "6px 10px", fontSize: "11px", background: theme.surfaceAlt }}>Relationer</button>
          <button onClick={() => jumpToSection(actionsRef)} style={{ ...btn(false), padding: "6px 10px", fontSize: "11px", background: theme.surfaceAlt }}>Handlinger</button>
        </div>

        {/* Profile card */}
        <div ref={overviewRef} style={{ background: theme.surface, borderRadius: theme.radius, padding: "24px", boxShadow: theme.shadow, border: "1px solid " + theme.border, marginBottom: "16px" }}>
          <div style={{ display: "flex", gap: "16px", alignItems: "flex-start", marginBottom: "20px" }}>
            <AvatarCircle
              avatar={user.avatar}
              size={64}
              emojiSize="32px"
              style={{ background: theme.accentBg, border: "2px solid " + theme.accent + "40" }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                <div style={{ fontSize: "20px", fontWeight: 800, letterSpacing: "-0.02em" }}>{displayName}</div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "8px", flexShrink: 0 }}>
                  <button
                    onClick={() => { setForm(profileFormState(user)); setEditing(true); }}
                    style={{ ...btn(false), padding: "5px 10px", fontSize: "12px", color: theme.textMid, background: theme.surfaceAlt, borderColor: theme.border }}
                  >
                    <Settings size={12} /> Rediger
                  </button>
                  {onDarkModeChange && (
                    <button
                      onClick={() => onDarkModeChange(d => !d)}
                      title={dark ? "Skift til lys tilstand" : "Skift til mørk tilstand"}
                      style={{
                        width: 60, height: 30, borderRadius: 15, border: "none", cursor: "pointer", flexShrink: 0,
                        background: dark ? "#1e293b" : "#e5e7eb",
                        position: "relative", transition: "background 0.25s",
                        boxShadow: dark ? "inset 0 2px 5px rgba(0,0,0,0.6)" : "inset 0 2px 4px rgba(0,0,0,0.12)",
                        padding: 0,
                      }}
                    >
                      {/* Sun icon — left */}
                      <span style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", display: "flex", zIndex: 1, color: dark ? "#475569" : "#f59e0b", transition: "color 0.25s" }}>
                        <Sun size={13} />
                      </span>
                      {/* Moon icon — right */}
                      <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", display: "flex", zIndex: 1, color: dark ? "#94a3b8" : "#9ca3af", transition: "color 0.25s" }}>
                        <Moon size={13} />
                      </span>
                      {/* Sliding circle with active icon */}
                      <div style={{
                        position: "absolute", top: 3, left: dark ? 31 : 3,
                        width: 24, height: 24, borderRadius: "50%",
                        background: dark ? "#334155" : "#ffffff",
                        transition: "left 0.25s",
                        boxShadow: dark ? "0 1px 5px rgba(0,0,0,0.7)" : "0 1px 4px rgba(0,0,0,0.2)",
                        zIndex: 2, display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        {dark
                          ? <Moon size={13} style={{ color: "#e2e8f0" }} />
                          : <Sun size={13} style={{ color: "#f59e0b" }} />
                        }
                      </div>
                    </button>
                  )}
                </div>
              </div>              <div style={{ fontSize: "13px", color: theme.textLight, marginTop: "2px" }}>{authUser?.email}</div>
              <div style={{ display: "flex", gap: "5px", marginTop: "8px", flexWrap: "wrap" }}>
                {!statsLoading && <span style={tag(theme.accentBg, theme.accent)}>ELO {elo}</span>}
                {user.birth_year && <span style={tag(theme.blueBg, theme.blue)}>{calcAge(user.birth_year, user.birth_month, user.birth_day)} år</span>}
                {user.level && <span style={tag(theme.blueBg, theme.blue)}>{levelLabel(user.level)}</span>}
                <span style={tag(theme.blueBg, theme.blue)}>{user.play_style || "?"}</span>
                {user.court_side && <span style={tag(theme.blueBg, theme.blue)}>{user.court_side}</span>}
                <span style={tag(theme.warmBg, theme.warm)}><MapPin size={9} /> {user.city ? `${user.city}, ` : ""}{user.area || "?"}</span>
              </div>
            </div>
          </div>

          {user.bio && <p style={{ fontSize: "13px", color: theme.textMid, lineHeight: 1.5, marginBottom: "16px", fontStyle: "italic" }}>&ldquo;{user.bio}&rdquo;</p>}

          {/* Søger kamp — standalone toggle der gemmer øjeblikkeligt */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: theme.surfaceAlt, border: '1px solid ' + (user.seeking_match ? theme.accent : theme.border), borderRadius: 10, padding: '10px 14px', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: theme.text }}>⚡ Søger kamp nu</div>
              <div style={{ fontSize: 11, color: theme.textLight, marginTop: 2 }}>Vises i andres feed. Slukker automatisk 24 timer efter du aktiverede det.</div>
            </div>
            <button
              onClick={async () => {
                try {
                  const enabling = !user.seeking_match;
                  await updateProfile({ seeking_match: enabling, seeking_match_at: enabling ? new Date().toISOString() : null });
                  showToast(enabling ? 'Du søger nu kamp! ⚡' : 'Du søger ikke længere kamp.');
                } catch { showToast('Kunne ikke gemme. Prøv igen.'); }
              }}
              style={{ width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', background: user.seeking_match ? theme.accent : theme.border, position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}
            >
              <div style={{ position: 'absolute', top: 3, left: user.seeking_match ? 23 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
            </button>
          </div>

          {/* Stats — først når frisk profil + historik er hentet (ingen flash) */}
          {statsLoading || (overviewMode === "liga" && ligaLoading) ? (
            <div style={{ textAlign: "center", padding: "20px", color: theme.textLight, fontSize: "13px", marginBottom: "20px" }}>Indlæser statistik…</div>
          ) : (
          <>
          <div style={{ fontSize: "11px", fontWeight: 700, color: theme.textLight, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Overblik
          </div>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "10px" }}>
            <button onClick={() => setOverviewMode("2v2")} style={{ ...btn(overviewMode === "2v2"), padding: "5px 10px", fontSize: "11px" }}>
              2v2
            </button>
            <button onClick={() => setOverviewMode("americano")} style={{ ...btn(overviewMode === "americano"), padding: "5px 10px", fontSize: "11px" }}>
              Americano
            </button>
            <button onClick={() => setOverviewMode("liga")} style={{ ...btn(overviewMode === "liga"), padding: "5px 10px", fontSize: "11px" }}>
              Liga
            </button>
            <span style={{ fontSize: "11px", color: theme.textLight, display: "inline-flex", alignItems: "center", paddingLeft: "2px" }}>
              {overviewMode === "americano"
                ? "Viser kun Americano-data"
                : overviewMode === "liga"
                  ? "Viser kun Liga-data"
                  : "Viser kun 2v2-data"}
            </span>
          </div>
          <div style={{ fontSize: "10px", color: theme.textLight, marginBottom: "10px" }}>
            {activeOverviewSource} · Sidst opdateret: {activeOverviewUpdatedAt}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "8px", marginBottom: "20px" }}>
            {activeOverviewCards.map((s, i) => (
              <div key={i} style={{ textAlign: "center", padding: "12px 6px", background: theme.surfaceAlt, borderRadius: "8px", border: "1px solid " + theme.border }}>
                <div style={{ fontSize: "18px", fontWeight: 800, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: "9px", fontWeight: 700, color: theme.textLight, marginTop: "2px", textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</div>
              </div>
            ))}
          </div>
          </>
          )}

          {/* Availability — tidspunkter */}
          {availabilityTags(user).length > 0 && (
            <div style={{ marginBottom: "10px" }}>
              <div style={{ fontSize: "11px", fontWeight: 700, color: theme.textLight, marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Tilgængelighed</div>
              <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
                {availabilityTags(user).map((a) => <span key={a} style={tag(theme.accentBg, theme.accent)}>{a}</span>)}
              </div>
            </div>
          )}

          {/* Availability — ugedage */}
          {(() => {
            const days = normalizeStringArrayField(user.available_days);
            if (!days.length) return null;
            return (
              <div style={{ marginBottom: "16px" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: theme.textLight, marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Spilledage</div>
                <div style={{ display: "flex", gap: "4px" }}>
                  {DAYS_OF_WEEK.map(({ key, label }) => {
                    const active = days.includes(key);
                    return (
                      <div key={key} style={{ flex: 1, textAlign: "center", padding: "5px 2px", borderRadius: "6px", fontSize: "11px", fontWeight: 700, background: active ? theme.accent : "#F1F5F9", color: active ? "#fff" : theme.textLight }}>
                        {label}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

        </div>

        <div ref={performanceRef} style={{ fontSize: "11px", fontWeight: 700, color: theme.textLight, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Performance
        </div>
        {/* ELO over tid */}
        <div style={{ background: theme.surface, borderRadius: theme.radius, padding: "20px", boxShadow: theme.shadow, border: "1px solid " + theme.border, marginBottom: "16px" }}>
          <div style={{ fontSize: "14px", fontWeight: 700, marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
            <TrendingUp size={16} color={theme.accent} /> ELO over tid
          </div>
          {statsLoading ? (
            <div style={{ textAlign: "center", padding: "20px", color: theme.textLight, fontSize: "13px" }}>Indlæser...</div>
          ) : (
            <EloGraph data={eloHistory} />
          )}
        </div>

        {/* Ekstra statistik */}
        {!statsLoading && (() => {
          const { currentStreak, bestStreak } = winStreaksFromEloHistory(eloHistory);

          const monthStats = {};
          eloHistory.forEach(h => {
            const key = h.date?.slice(0, 7);
            if (!key) return;
            if (!monthStats[key]) monthStats[key] = { wins: 0, games: 0, change: 0 };
            monthStats[key].games++;
            if (h.result === "win") monthStats[key].wins++;
            monthStats[key].change += (h.change || 0);
          });
          const months = Object.entries(monthStats);
          const bestMonth = months.length > 0
            ? months.reduce((best, [k, v]) => v.change > (best.change || -Infinity) ? { month: k, ...v } : best, { change: -Infinity })
            : null;
          const monthNames = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
          const fmtMonth = (m) => { const [y, mo] = m.split("-"); return monthNames[parseInt(mo, 10) - 1] + " " + y; };

          return (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "10px", marginBottom: "16px" }}>
              <div style={{ background: theme.surface, borderRadius: theme.radius, padding: "18px", boxShadow: theme.shadow, border: "1px solid " + theme.border }}>
                <div style={{ fontSize: "10px", fontWeight: 700, color: theme.textLight, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>Sejrsstreak</div>
                <div style={{ fontSize: "28px", fontWeight: 800, color: theme.warm, letterSpacing: "-0.03em" }}>{currentStreak > 0 ? `🔥 ${currentStreak}` : "0"}</div>
                <div style={{ fontSize: "11px", color: theme.textMid, marginTop: "4px" }}>Bedste: {bestStreak} i træk</div>
              </div>
              <div style={{ background: theme.surface, borderRadius: theme.radius, padding: "18px", boxShadow: theme.shadow, border: "1px solid " + theme.border }}>
                <div style={{ fontSize: "10px", fontWeight: 700, color: theme.textLight, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>Bedste måned</div>
                {bestMonth && bestMonth.month ? (
                  <>
                    <div style={{ fontSize: "16px", fontWeight: 800, color: theme.accent, letterSpacing: "-0.02em", textTransform: "capitalize" }}>{fmtMonth(bestMonth.month)}</div>
                    <div style={{ fontSize: "11px", color: theme.textMid, marginTop: "4px" }}>
                      {bestMonth.wins}/{bestMonth.games} sejre · {bestMonth.change > 0 ? "+" : ""}{bestMonth.change} ELO
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: "14px", color: theme.textMid }}>Ingen data endnu</div>
                )}
              </div>
            </div>
          );
        })()}

        {/* Peak ELO + Seneste form */}
        {!statsLoading && ratedRows.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "10px", marginBottom: "10px" }}>
            {peakElo && (
              <div style={{ background: theme.surface, borderRadius: theme.radius, padding: "18px", boxShadow: theme.shadow, border: "1px solid " + theme.border }}>
                <div style={{ fontSize: "10px", fontWeight: 700, color: theme.textLight, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>Højeste ELO</div>
                <div style={{ fontSize: "24px", fontWeight: 800, color: theme.accent, letterSpacing: "-0.03em" }}>🏆 {peakElo}</div>
                <div style={{ fontSize: "11px", color: theme.textMid, marginTop: "4px" }}>Bedste nogensinde</div>
              </div>
            )}
            {recentForm.length > 0 && (
              <div style={{ background: theme.surface, borderRadius: theme.radius, padding: "18px", boxShadow: theme.shadow, border: "1px solid " + theme.border }}>
                <div style={{ fontSize: "10px", fontWeight: 700, color: theme.textLight, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "10px" }}>Seneste form</div>
                <div style={{ display: "flex", gap: "5px", alignItems: "center", marginBottom: "6px" }}>
                  {recentForm.map((r, i) => (
                    <div key={i} title={r.result === 'win' ? 'Sejr' : r.result === 'loss' ? 'Nederlag' : 'Uafgjort'} style={{
                      width: "22px", height: "22px", borderRadius: "50%", flexShrink: 0,
                      background: r.result === 'win' ? "#22C55E" : r.result === 'loss' ? "#EF4444" : "#9CA3AF",
                    }} />
                  ))}
                </div>
                <div style={{ fontSize: "11px", color: theme.textMid }}>Seneste {recentForm.length} kampe</div>
              </div>
            )}
          </div>
        )}

        {(!statsLoading && !partnerOpponentLoading && partnerOpponentStats && (partnerOpponentStats.partners.length > 0 || partnerOpponentStats.opponents.length > 0)) && (
          <div ref={relationsRef} style={{ fontSize: "11px", fontWeight: 700, color: theme.textLight, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Relationer
          </div>
        )}
        {/* Bedste makker + Hårdeste modstandere */}
        {!statsLoading && !partnerOpponentLoading && partnerOpponentStats && (
          <>
            {partnerOpponentStats.partners.length > 0 && (
              <div style={{ background: theme.surface, borderRadius: theme.radius, padding: "18px", boxShadow: theme.shadow, border: "1px solid " + theme.border, marginBottom: "10px" }}>
                <div style={{ fontSize: "10px", fontWeight: 700, color: theme.textLight, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "14px" }}>Bedste makker</div>
                {partnerOpponentStats.partners.map((p, i) => (
                  <div key={p.userId} style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: i < partnerOpponentStats.partners.length - 1 ? "10px" : 0 }}>
                    <AvatarCircle avatar={p.emoji} size={32} emojiSize="16px" style={{ background: theme.accentBg, border: "1px solid " + theme.accent + "30", flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "13px", fontWeight: 600, color: theme.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                      <div style={{ fontSize: "11px", color: theme.textLight }}>{p.asPartner.games} kampe sammen</div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: "15px", fontWeight: 800, color: "#16A34A" }}>{Math.round((p.asPartner.wins / p.asPartner.games) * 100)}%</div>
                      <div style={{ fontSize: "10px", color: theme.textLight }}>sejr</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {(() => {
              const hardOpponents = partnerOpponentStats.opponents;
              if (hardOpponents.length === 0) return null;
              return (
                <div style={{ background: theme.surface, borderRadius: theme.radius, padding: "18px", boxShadow: theme.shadow, border: "1px solid " + theme.border, marginBottom: "16px" }}>
                  <div style={{ fontSize: "10px", fontWeight: 700, color: theme.textLight, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "14px" }}>Hårdeste modstandere</div>
                  {hardOpponents.map((p, i) => {
                    const theirWinPct = Math.round((1 - p.asOpponent.wins / p.asOpponent.games) * 100);
                    return (
                      <div key={p.userId} style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: i < hardOpponents.length - 1 ? "10px" : 0 }}>
                        <AvatarCircle avatar={p.emoji} size={32} emojiSize="16px" style={{ background: "#FEF2F2", border: "1px solid #FECACA", flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: "13px", fontWeight: 600, color: theme.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                          <div style={{ fontSize: "11px", color: theme.textLight }}>{p.asOpponent.games} kampe imod</div>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <div style={{ fontSize: "15px", fontWeight: 800, color: "#DC2626" }}>{theirWinPct}%</div>
                          <div style={{ fontSize: "10px", color: theme.textLight }}>de vinder</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </>
        )}

        <div ref={actionsRef} style={{ fontSize: "11px", fontWeight: 700, color: theme.textLight, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Handlinger
        </div>
        {/* Quick links */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px" }}>
          <button onClick={() => { mergeKampeSessionPrefs(user.id, { view: "completed" }); setTab("kampe"); }} style={{ background: theme.surface, borderRadius: theme.radius, padding: "16px", boxShadow: theme.shadow, border: "1px solid " + theme.border, cursor: "pointer", textAlign: "left", fontFamily: font }}>
            <Swords size={18} color={theme.accent} />
            <div style={{ fontSize: "13px", fontWeight: 700, marginTop: "8px" }}>Mine kampe</div>
            <div style={{ fontSize: "11px", color: theme.textLight }}>{games} spillet</div>
          </button>
          <button onClick={() => setTab("ranking")} style={{ background: theme.surface, borderRadius: theme.radius, padding: "16px", boxShadow: theme.shadow, border: "1px solid " + theme.border, cursor: "pointer", textAlign: "left", fontFamily: font }}>
            <Trophy size={18} color={theme.warm} />
            <div style={{ fontSize: "13px", fontWeight: 700, marginTop: "8px" }}>Ranking</div>
            <div style={{ fontSize: "11px", color: theme.textLight }}>ELO {elo}</div>
          </button>
        </div>
      </div>
      ) : (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h2 style={{ ...heading("clamp(20px,4.5vw,24px)") }}>Rediger profil</h2>
        <button onClick={() => { setForm(profileFormState(user)); setPendingAvatarFile(null); if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl); setAvatarPreviewUrl(null); setEditing(false); }} style={{ ...btn(false), padding: "6px 12px", fontSize: "12px" }}>
          <X size={14} /> Annullér
        </button>
      </div>

      <div style={{ background: theme.surface, borderRadius: theme.radius, padding: "24px", boxShadow: theme.shadow, border: "1px solid " + theme.border }}>
        {/* Avatar */}
        <div style={labelStyle}>Profilbillede</div>
        <div style={{ marginBottom: "20px" }}>
          <AvatarPicker
            value={form.avatar}
            previewUrl={avatarPreviewUrl}
            uploading={avatarUploading}
            onFileSelect={(file) => {
              if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
              setAvatarPreviewUrl(URL.createObjectURL(file));
              setPendingAvatarFile(file);
            }}
            onEmojiSelect={(emoji) => {
              set("avatar", emoji);
              setPendingAvatarFile(null);
              if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
              setAvatarPreviewUrl(null);
            }}
          />
        </div>

        {/* Name — read-only */}
        <label style={labelStyle}>Fornavn</label>
        <input value={form.first_name} readOnly style={{ ...inputStyle, marginBottom: "10px", background: "#F1F5F9", color: theme.textLight, cursor: "not-allowed" }} />
        <label style={labelStyle}>Efternavn</label>
        <input value={form.last_name} readOnly style={{ ...inputStyle, marginBottom: "6px", background: "#F1F5F9", color: theme.textLight, cursor: "not-allowed" }} />
        <p style={{ color: theme.textLight, fontSize: "12px", lineHeight: 1.45, marginBottom: "14px" }}>
          Navn kan ikke ændres efter oprettelse. Kontakt support hvis der er en fejl.
        </p>

        {/* Birth date */}
        <label style={labelStyle}>Fødselsdato</label>
        <div style={{ display: "grid", gridTemplateColumns: "72px 1fr 90px", gap: "8px", marginBottom: "14px" }}>
          <select value={form.birth_day || ""} onChange={e => set("birth_day", e.target.value)} style={{ ...inputStyle, paddingLeft: "10px", paddingRight: "4px" }}>
            <option value="">Dag</option>
            {Array.from({ length: 31 }, (_, i) => i + 1).map(d => <option key={d} value={d}>{d}.</option>)}
          </select>
          <select value={form.birth_month || ""} onChange={e => set("birth_month", e.target.value)} style={{ ...inputStyle, paddingLeft: "10px", paddingRight: "4px" }}>
            <option value="">Måned</option>
            {["Januar","Februar","Marts","April","Maj","Juni","Juli","August","September","Oktober","November","December"].map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
          <input value={form.birth_year || ""} onChange={e => set("birth_year", e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="År" type="text" inputMode="numeric" style={{ ...inputStyle, paddingLeft: "10px" }} />
        </div>

        {/* Area + City */}
        <div style={labelStyle}>Region</div>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "10px" }}>
          {REGIONS.map((r) => (
            <button key={r} onClick={() => set("area", r)} style={{ ...btn(form.area === r), padding: "6px 12px", fontSize: "12px" }}>{r}</button>
          ))}
        </div>
        <label htmlFor="profil-city" style={labelStyle}>By <span style={{ fontWeight: 400, color: "#8494A7" }}>(valgfri)</span></label>
        <input
          id="profil-city"
          value={form.city}
          onChange={e => set("city", e.target.value)}
          placeholder="F.eks. Aarhus, København, Aalborg..."
          style={{ ...inputStyle, marginBottom: "14px" }}
        />

        {/* Niveau */}
        <div style={labelStyle}>Niveau</div>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "14px" }}>
          {LEVELS.map(l => (
            <button key={l} onClick={() => set("level", l)} style={{ ...btn(form.level === l), textAlign: "left", padding: "8px 14px", display: "flex", flexDirection: "column", gap: "2px" }}>
              <span style={{ fontWeight: 700, fontSize: "13px" }}>{l}</span>
              <span style={{ fontSize: "11px", fontWeight: 400, opacity: 0.7 }}>{LEVEL_DESCS[l]}</span>
            </button>
          ))}
        </div>

        {/* Play style */}
        <div style={labelStyle}>Spillestil</div>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "14px" }}>
          {PLAY_STYLES.map(s => (
            <button key={s} onClick={() => set("play_style", s)} style={{ ...btn(form.play_style === s), padding: "6px 12px", fontSize: "12px" }}>{s}</button>
          ))}
        </div>

        {/* Court side */}
        <div style={labelStyle}>Foretrukken side på banen</div>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "14px" }}>
          {COURT_SIDES.map(s => (
            <button key={s} onClick={() => set("court_side", s)} style={{ ...btn(form.court_side === s), padding: "6px 12px", fontSize: "12px" }}>{s}</button>
          ))}
        </div>

        {/* Availability — tidspunkter */}
        <div style={labelStyle}>Hvornår kan du spille?</div>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "14px" }}>
          {AVAILABILITY.map(a => (
            <button key={a} onClick={() => toggleAvail(a)} style={{ ...btn(form.availability.includes(a)), padding: "6px 12px", fontSize: "12px" }}>{a}</button>
          ))}
        </div>

        {/* Availability — ugedage */}
        <div style={labelStyle}>Hvilke dage kan du typisk spille?</div>
        <div style={{ display: "flex", gap: "6px", marginBottom: "14px" }}>
          {DAYS_OF_WEEK.map(({ key, label }) => {
            const active = normalizeStringArrayField(form.available_days).includes(key);
            return (
              <button
                key={key}
                onClick={() => toggleDay(key)}
                style={{
                  flex: 1,
                  padding: "8px 2px",
                  fontSize: "12px",
                  fontWeight: 700,
                  borderRadius: "8px",
                  border: "1.5px solid " + (active ? theme.accent : theme.border),
                  background: active ? theme.accent : theme.surface,
                  color: active ? "#fff" : theme.textMid,
                  cursor: "pointer",
                  transition: "all 0.12s",
                  minWidth: 0,
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Bio */}
        <label htmlFor="profil-bio" style={labelStyle}>Bio</label>
        <textarea id="profil-bio" value={form.bio} onChange={e => set("bio", e.target.value)} placeholder="Fortæl lidt om dig som spiller..." style={{ ...inputStyle, height: "80px", resize: "vertical", marginBottom: "20px" }} />

        {/* Matchmaking */}
        <div style={{ borderTop: "1px solid " + theme.border, paddingTop: "20px", marginBottom: "20px" }}>
          <div style={{ fontSize: "12px", fontWeight: 700, color: theme.textLight, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "14px" }}>
            Matchmaking-præferencer
          </div>

          {/* Søger kamp nu */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
            <div>
              <div style={{ fontSize: "14px", fontWeight: 600, color: theme.text }}>Søger kamp aktivt</div>
              <div style={{ fontSize: "12px", color: theme.textLight, marginTop: "2px" }}>Vis mig i foreslåede makkere for andre spillere</div>
            </div>
            <button
              onClick={() => set("seeking_match", !form.seeking_match)}
              style={{
                width: "44px", height: "24px", borderRadius: "12px", border: "none", cursor: "pointer",
                background: form.seeking_match ? theme.accent : theme.border,
                position: "relative", transition: "background 0.2s", flexShrink: 0,
              }}
            >
              <div style={{
                position: "absolute", top: "3px",
                left: form.seeking_match ? "23px" : "3px",
                width: "18px", height: "18px", borderRadius: "50%",
                background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
              }} />
            </button>
          </div>

          {/* Intention */}
          <div style={labelStyle}>Hvad søger du?</div>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "14px" }}>
            <button
              onClick={() => set("intent_now", "")}
              style={{ ...btn(!form.intent_now), padding: "6px 12px", fontSize: "12px" }}
            >
              Ikke angivet
            </button>
            {INTENTS.map(i => (
              <button
                key={i.value}
                onClick={() => set("intent_now", i.value)}
                style={{ ...btn(form.intent_now === i.value), padding: "6px 12px", fontSize: "12px" }}
                title={i.desc}
              >
                {i.label}
              </button>
            ))}
          </div>

          {/* Vil rejse */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: "14px", fontWeight: 600, color: theme.text }}>Vil gerne rejse lidt</div>
              <div style={{ fontSize: "12px", color: theme.textLight, marginTop: "2px" }}>Åben for spillere uden for dit nærområde</div>
            </div>
            <button
              onClick={() => set("travel_willing", !form.travel_willing)}
              style={{
                width: "44px", height: "24px", borderRadius: "12px", border: "none", cursor: "pointer",
                background: form.travel_willing ? theme.accent : theme.border,
                position: "relative", transition: "background 0.2s", flexShrink: 0,
              }}
            >
              <div style={{
                position: "absolute", top: "3px",
                left: form.travel_willing ? "23px" : "3px",
                width: "18px", height: "18px", borderRadius: "50%",
                background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
              }} />
            </button>
          </div>
        </div>

        <button onClick={handleSave} disabled={saving} style={{ ...btn(true), width: "100%", justifyContent: "center", opacity: saving ? 0.6 : 1 }}>
          {saving ? "Gemmer..." : <><Save size={14} /> Gem ændringer</>}
        </button>
      </div>
    </div>
      )}
    </div>
  );
}
