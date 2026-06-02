import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import { font, theme, btn, inputStyle, labelStyle, heading, tag } from '../lib/platformTheme';
import { resolveDisplayName, sanitizeText } from '../lib/platformUtils';
import { mergeKampeSessionPrefs } from '../lib/kampeSessionPrefs';
import { mergeLigaSessionPrefs, openMineLigaerFromProfile } from '../lib/ligaSessionPrefs';
import { useLigaPartnerOpponentStats } from '../lib/ligaRelationStats';
import { REGIONS, PLAY_STYLES, COURT_SIDES } from '../lib/platformConstants';
import { profileLevelDisplayText } from '../lib/padelLevelUtils';
import { PlaytomicLevelPicker } from '../components/PlaytomicLevelPicker';
import { canonicalRegionForForm, calcAge } from '../lib/profileUtils';
import { normalizeMatchSearchPrefs, describeMatchFilter } from '../lib/matchSearchFilterUtils';
import { normalizeMakkerSearchPrefs, describeMakkerFilter } from '../lib/makkerSearchFilterUtils';
import { isProfileMatchFeedVisible, isProfileMakkerFeedVisible } from '../lib/seekingFeedTtl';
import { useNavigate } from 'react-router-dom';
import { Filter, Users, ChevronRight } from 'lucide-react';
import { statsFromEloHistoryRows, useProfileEloBundle, winStreaksFromEloHistory, usePartnerOpponentStats, sortEloHistoryChronological } from '../lib/eloHistoryUtils';
import { useAmericanoPartnerOpponentStats } from '../lib/americanoRelationStats';
import { americanoOutcomeColors } from '../features/americano/americanoOutcomeColors';
import { EloGraph } from '../components/EloGraph';
import { MapPin, Settings, Swords, Trophy, TrendingUp, Save, X } from 'lucide-react';
import { profileFormState } from './profileTabHelpers';
import { isValidProfileRegion } from '../lib/profileUtils';
import { FILTER_RETURN_PROFIL } from '../lib/filterReturnNavigation';
import { LEGAL_INFO } from '../lib/legalInfo';
import { uploadAvatar, hasPendingAvatar, applyPendingAvatar } from '../lib/avatarUpload';
import { AvatarPicker } from '../components/AvatarPicker';
import { AvatarCircle } from '../components/AvatarCircle';
import { PillTabs } from '../components/PillTabs';
import {
  TOURNAMENT_DATA_SOURCE,
  TOURNAMENT_ELO_GRAPH_EMPTY,
  TOURNAMENT_ELO_GRAPH_LABEL,
  TOURNAMENT_ELO_LABEL,
  TOURNAMENT_MODE_LABEL,
  TOURNAMENT_RANKING_LABEL,
} from '../lib/tournamentCopy';

const PROFILE_OVERVIEW_TABS = [
  { id: '2v2', label: '2v2' },
  { id: 'americano', label: TOURNAMENT_MODE_LABEL },
  { id: 'liga', label: 'Liga' },
];

const REGION_PILL_TABS = REGIONS.map((r) => ({
  id: r,
  label: r.replace(/^Region /, ''),
}));

const profilePromptCardStyle = {
  marginBottom: '16px',
  padding: '12px 14px',
  background: theme.surfaceAlt,
  borderRadius: '10px',
  border: `1px solid ${theme.border}`,
};

const filterStatusPillStyle = {
  fontSize: 10,
  fontWeight: 700,
  padding: '2px 8px',
  borderRadius: 100,
  background: theme.accentBg,
  color: theme.accent,
};

function FilterChannelBadges({ feedVisible, notify }) {
  if (!feedVisible && !notify) return null;
  return (
    <>
      {feedVisible ? <span style={filterStatusPillStyle}>Synlig</span> : null}
      {notify ? <span style={filterStatusPillStyle}>Notifikationer</span> : null}
    </>
  );
}

function MatchFilterProfileCard({ user }) {
  const navigate = useNavigate();
  const prefs = normalizeMatchSearchPrefs(user?.match_search_prefs, user);
  const info = describeMatchFilter(prefs, user);
  const feedVisible = isProfileMatchFeedVisible(user);

  return (
    <button
      type="button"
      onClick={() => navigate('/dashboard/kamp-filter', { state: { filterReturnTo: FILTER_RETURN_PROFIL } })}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        textAlign: 'left',
        background: theme.surfaceAlt,
        border: `1px solid ${theme.border}`,
        borderRadius: 10,
        padding: '12px 14px',
        marginBottom: 16,
        cursor: 'pointer',
      }}
    >
      <span
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: feedVisible ? theme.accentBg : theme.blueBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Filter size={18} color={theme.accent} aria-hidden />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: theme.text }}>Mit kamp-filter</span>
          <FilterChannelBadges feedVisible={feedVisible} notify={prefs.notify} />
        </div>
        <div style={{ fontSize: 11, color: theme.textLight, marginTop: 2, lineHeight: 1.4 }}>
          {info.configured ? (
            <>
              {info.summary}
              <br />
              <span style={{ color: theme.textMid }}>{info.detail}</span>
            </>
          ) : (
            'Indstil region, niveau og hvornår du vil have besked om åbne kampe.'
          )}
        </div>
      </span>
      <ChevronRight size={18} color={theme.textLight} aria-hidden style={{ flexShrink: 0 }} />
    </button>
  );
}

function MakkerFilterProfileCard({ user }) {
  const navigate = useNavigate();
  const prefs = normalizeMakkerSearchPrefs(user?.makker_search_prefs, user);
  const info = describeMakkerFilter(prefs, user);
  const feedVisible = isProfileMakkerFeedVisible(user);

  return (
    <button
      type="button"
      onClick={() => navigate('/dashboard/makker-filter', { state: { filterReturnTo: FILTER_RETURN_PROFIL } })}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        textAlign: 'left',
        background: theme.surfaceAlt,
        border: `1px solid ${theme.border}`,
        borderRadius: 10,
        padding: '12px 14px',
        marginBottom: 16,
        cursor: 'pointer',
      }}
    >
      <span
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: feedVisible ? theme.accentBg : theme.blueBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Users size={18} color={theme.accent} aria-hidden />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: theme.text }}>Mit makker-filter</span>
          <FilterChannelBadges feedVisible={feedVisible} notify={prefs.notify} />
        </div>
        <div style={{ fontSize: 11, color: theme.textLight, marginTop: 2, lineHeight: 1.4 }}>
          {info.configured ? (
            <>
              {info.summary}
              <br />
              <span style={{ color: theme.textMid }}>{info.detail}</span>
            </>
          ) : (
            'Få besked når spillere på dit niveau søger makker i dit område.'
          )}
        </div>
      </span>
      <ChevronRight size={18} color={theme.textLight} aria-hidden style={{ flexShrink: 0 }} />
    </button>
  );
}

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

function persistRankingModeForProfile(mode) {
  if (typeof localStorage === "undefined" || mode === "liga") return;
  try {
    localStorage.setItem("pm-rank-mode", mode === "americano" ? "americano" : "2v2");
  } catch {
    // Ignore storage issues in private mode / quota exceeded.
  }
}

const PROFILE_MODE_LABELS = {
  "2v2": "2v2",
  americano: TOURNAMENT_MODE_LABEL,
  liga: "Liga",
};

const RELATION_SECTION_LABELS = {
  winMostWith: "Vinder mest med",
  loseMostWith: "Taber mest med",
  winMostAgainst: "Vinder mest mod",
  loseMostAgainst: "Taber mest mod",
};

export function ProfilTab({ user, showToast, setTab }) {
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
  const americanoStatsEnabled =
    (Number(pStats?.americano_played) || 0) > 0
    || (Number(pStats?.americano_wins) || 0)
      + (Number(pStats?.americano_draws) || 0)
      + (Number(pStats?.americano_losses) || 0) > 0;
  const { americanoRelationStats, americanoRelationLoading } = useAmericanoPartnerOpponentStats(
    user?.id,
    americanoStatsEnabled,
  );
  const { ligaRelationStats, ligaRelationLoading } = useLigaPartnerOpponentStats(user?.id, !!user?.id);

  const [form, setForm] = useState(() => profileFormState(user));
  const [quickCity, setQuickCity] = useState(() => user?.city || '');
  const [quickCitySaving, setQuickCitySaving] = useState(false);

  useEffect(() => {
    if (!editing) setForm(profileFormState(user));
  }, [user, editing]);

  useEffect(() => {
    if (!editing) setQuickCity(user?.city || '');
  }, [user?.city, editing]);

  const handleQuickCitySave = async () => {
    const trimmed = quickCity.trim();
    if (trimmed === String(user?.city || '').trim()) return;
    setQuickCitySaving(true);
    try {
      await updateProfile({ city: trimmed || null });
      showToast(trimmed ? 'By gemt' : 'By fjernet');
    } catch (e) {
      showToast(e?.message || 'Kunne ikke gemme by');
    } finally {
      setQuickCitySaving(false);
    }
  };

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
  const [activeProfileSection, setActiveProfileSection] = useState("overview");
  const [americanoEloHistoryRows, setAmericanoEloHistoryRows] = useState([]);
  const [americanoEloHistoryLoading, setAmericanoEloHistoryLoading] = useState(true);
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
    if (!user?.id) {
      setAmericanoEloHistoryRows([]);
      setAmericanoEloHistoryLoading(false);
      return;
    }
    let cancelled = false;
    setAmericanoEloHistoryLoading(true);
    (async () => {
      try {
        const { data, error } = await supabase
          .from('americano_elo_history')
          .select('id, old_rating, new_rating, change, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true });
        if (error) throw error;
        if (cancelled) return;
        const mapped = (data || []).map((row) => ({
          id: row.id,
          old_rating: row.old_rating,
          new_rating: row.new_rating,
          change: row.change,
          date: row.created_at,
          match_id: row.id,
        }));
        setAmericanoEloHistoryRows(mapped);
      } catch (error) {
        console.warn('americano_elo_history load:', error?.message || error);
        if (!cancelled) setAmericanoEloHistoryRows([]);
      } finally {
        if (!cancelled) setAmericanoEloHistoryLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id, pStats?.americano_elo_rating]);

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
    pStats?.americano_played,
    pStats?.americano_wins,
    pStats?.americano_draws,
    pStats?.americano_losses,
    pStats?.americano_elo_rating,
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
    if (!isValidProfileRegion(region)) {
      showToast('Vælg din region — by er valgfri.');
      return;
    }
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
        level: form.levelNumeric,
        play_style: form.play_style,
        court_side: form.court_side || null,
        bio: sanitizeText(form.bio.trim()),
        avatar: avatarValue,
        birth_year: form.birth_year ? parseInt(form.birth_year, 10) : null,
        birth_month: form.birth_month ? parseInt(form.birth_month, 10) : null,
        birth_day: form.birth_day ? parseInt(form.birth_day, 10) : null,
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
  const americanoElo = Math.round(Number(pStats.americano_elo_rating) || 1000);
  const americanoPlayed = Number(pStats.americano_played) || 0;
  const americanoWins = Number(pStats.americano_wins) || 0;
  const americanoDraws = Number(pStats.americano_draws) || 0;
  const americanoLosses = Number(pStats.americano_losses) || 0;
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
    { label: "ELO", value: americanoElo, color: theme.accent },
    { label: "Americano/Mexicano", value: americanoPlayed, color: theme.text },
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
  const is2v2Mode = overviewMode === "2v2";
  const isAmericanoMode = overviewMode === "americano";
  const isLigaMode = overviewMode === "liga";
  const activeModeLabel = PROFILE_MODE_LABELS[overviewMode] || overviewMode;
  const activeEloGraphData = isAmericanoMode ? americanoEloHistoryRows : eloHistory;
  const activeEloGraphLoading = isAmericanoMode ? americanoEloHistoryLoading : statsLoading;
  const activeEloGraphLabel = isAmericanoMode ? TOURNAMENT_ELO_GRAPH_LABEL : "ELO";
  const activeEloGraphEmptyText = isAmericanoMode
    ? TOURNAMENT_ELO_GRAPH_EMPTY
    : "Spil mindst 2 kampe for at se din ELO-graf.";
  const showPerformanceSection = is2v2Mode || isAmericanoMode;
  const show2v2RelationsSection =
    is2v2Mode
    && !statsLoading
    && !partnerOpponentLoading
    && partnerOpponentStats
    && (partnerOpponentStats.partners.length > 0 || partnerOpponentStats.opponents.length > 0);
  const showAmericanoRelationsSection =
    isAmericanoMode
    && !americanoRelationLoading
    && americanoRelationStats
    && (
      americanoRelationStats.bestPartners.length > 0
      || americanoRelationStats.toughestPartners.length > 0
      || americanoRelationStats.hardestOpponents.length > 0
      || americanoRelationStats.easiestOpponents.length > 0
    );
  const showLigaRelationsSection =
    isLigaMode
    && !ligaRelationLoading
    && ligaRelationStats
    && (
      ligaRelationStats.bestPartners.length > 0
      || ligaRelationStats.toughestPartners.length > 0
      || ligaRelationStats.hardestOpponents.length > 0
      || ligaRelationStats.easiestOpponents.length > 0
    );
  const showRelationsSection =
    show2v2RelationsSection || showAmericanoRelationsSection || showLigaRelationsSection;
  const activeOverviewSource =
    overviewMode === "americano"
      ? TOURNAMENT_DATA_SOURCE
      : overviewMode === "liga"
        ? "Datakilde: Liga-hold og rapporterede ligakampe"
        : "Datakilde: 2v2 kamphistorik";
  const activeOverviewUpdatedAt = formatUpdatedAtDa(overviewLastUpdated[overviewMode]);
  const jumpToSection = (ref) => {
    if (!ref?.current) return;
    ref.current.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const profileSectionTabs = useMemo(() => {
    const tabs = [{ id: "overview", label: "Overblik" }];
    if (showPerformanceSection) tabs.push({ id: "performance", label: "Performance" });
    if (showRelationsSection) tabs.push({ id: "relations", label: "Relationer" });
    tabs.push({ id: "actions", label: "Handlinger" });
    return tabs;
  }, [showPerformanceSection, showRelationsSection]);

  const profileSectionValue = profileSectionTabs.some((t) => t.id === activeProfileSection)
    ? activeProfileSection
    : "overview";

  const handleProfileSectionChange = (id) => {
    setActiveProfileSection(id);
    const refs = {
      overview: overviewRef,
      performance: performanceRef,
      relations: relationsRef,
      actions: actionsRef,
    };
    jumpToSection(refs[id]);
  };

  return (
    <div>
      {!editing ? (
      <div>
        <div data-tour="profile-main" className="pm-tour-scroll-anchor">
        <h2 style={{ ...heading("clamp(20px,4.5vw,24px)"), marginBottom: "20px" }}>Min profil</h2>
        <div className="pm-profile-top">
        <PillTabs
          tabs={profileSectionTabs}
          value={profileSectionValue}
          onChange={handleProfileSectionChange}
          ariaLabel="Profil-sektioner"
          size="sm"
          className="pm-pill-tabs--wrap"
        />

        {/* Profile card */}
        <div ref={overviewRef} className="pm-profile-card" style={{ background: theme.surface, borderRadius: theme.radius, padding: "24px", boxShadow: theme.shadow, border: "1px solid " + theme.border, marginBottom: "16px" }}>
          <div className="pm-profile-header" style={{ marginBottom: "20px" }}>
            <AvatarCircle
              avatar={user.avatar}
              size={64}
              emojiSize="32px"
              style={{ background: theme.accentBg, border: "2px solid " + theme.accent + "40" }}
            />
            <div className="pm-profile-header-copy">
              <div className="pm-profile-header-top">
                <div className="pm-profile-name" style={{ fontSize: "20px", fontWeight: 800, letterSpacing: "-0.02em" }}>{displayName}</div>
                <div className="pm-profile-actions">
                  <button
                    onClick={() => { setForm(profileFormState(user)); setEditing(true); }}
                    style={{ ...btn(false), padding: "5px 10px", fontSize: "12px", color: theme.textMid, background: theme.surfaceAlt, borderColor: theme.border }}
                  >
                    <Settings size={12} /> Rediger
                  </button>
                </div>
              </div>
              <div className="pm-profile-email" style={{ fontSize: "13px", color: theme.textLight, marginTop: "2px" }}>{authUser?.email}</div>
              <div style={{ display: "flex", gap: "5px", marginTop: "8px", flexWrap: "wrap" }}>
                {!statsLoading && is2v2Mode && <span style={tag(theme.accentBg, theme.accent)}>ELO {elo}</span>}
                {!statsLoading && isAmericanoMode && <span style={tag(theme.blueBg, theme.blue)}>{TOURNAMENT_ELO_LABEL} {americanoElo}</span>}
                {!statsLoading && isLigaMode && !ligaLoading && ligaStats.matches > 0 && (
                  <span style={tag(theme.blueBg, theme.blue)}>{ligaStats.matches} ligakampe</span>
                )}
                {user.birth_year && <span style={tag(theme.blueBg, theme.blue)}>{calcAge(user.birth_year, user.birth_month, user.birth_day)} år</span>}
                {profileLevelDisplayText(user.level) ? (
                  <span style={tag(theme.blueBg, theme.blue)}>
                    Niveau {profileLevelDisplayText(user.level)}
                  </span>
                ) : null}
                <span style={tag(theme.blueBg, theme.blue)}>{user.play_style || "?"}</span>
                {user.court_side && <span style={tag(theme.blueBg, theme.blue)}>{user.court_side}</span>}
                <span style={tag(theme.warmBg, theme.warm)}><MapPin size={9} /> {user.city ? `${user.city}, ` : ""}{user.area || "?"}</span>
              </div>
            </div>
          </div>

          {user.bio && <p style={{ fontSize: "13px", color: theme.textMid, lineHeight: 1.5, marginBottom: "16px", fontStyle: "italic" }}>&ldquo;{user.bio}&rdquo;</p>}

          {!editing && !isValidProfileRegion(user.area) ? (
            <div style={profilePromptCardStyle}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: theme.text, marginBottom: '4px' }}>
                Vælg region
              </div>
              <p style={{ fontSize: '12px', color: theme.textLight, lineHeight: 1.45, marginBottom: '10px' }}>
                Din profil mangler en region. Det er påkrævet, så andre kan finde dig i det rigtige område.
              </p>
              <button
                type="button"
                onClick={() => { setForm(profileFormState(user)); setEditing(true); }}
                style={{ ...btn(true), padding: '8px 14px', fontSize: '12px' }}
              >
                Vælg region under Rediger
              </button>
            </div>
          ) : null}

          {!editing && isValidProfileRegion(user.area) && !String(user.city || '').trim() ? (
            <div style={profilePromptCardStyle}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: theme.text, marginBottom: '4px' }}>
                Tilføj din by <span style={{ fontWeight: 500, color: theme.textLight }}>(valgfri)</span>
              </div>
              <p style={{ fontSize: '12px', color: theme.textLight, lineHeight: 1.45, marginBottom: '10px' }}>
                {user.area} er en stor region. Med din by kan andre finde dig nemmere.
              </p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                  value={quickCity}
                  onChange={(e) => setQuickCity(e.target.value)}
                  placeholder="F.eks. Aalborg, Aarhus, Odense..."
                  style={{ ...inputStyle, flex: '1 1 160px', marginBottom: 0 }}
                />
                <button
                  type="button"
                  onClick={handleQuickCitySave}
                  disabled={quickCitySaving}
                  style={{ ...btn(true), padding: '8px 14px', fontSize: '12px', opacity: quickCitySaving ? 0.6 : 1 }}
                >
                  {quickCitySaving ? 'Gemmer…' : 'Gem by'}
                </button>
              </div>
            </div>
          ) : null}

          <MatchFilterProfileCard user={user} />
          <MakkerFilterProfileCard user={user} />

          <div style={{ fontSize: "11px", fontWeight: 700, color: theme.textLight, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Overblik
          </div>
          <PillTabs
            tabs={PROFILE_OVERVIEW_TABS}
            value={overviewMode}
            onChange={setOverviewMode}
            ariaLabel="Statistik-type"
            size="sm"
            className="pm-pill-tabs--fill"
            style={{ marginBottom: "6px" }}
          />

          {/* Stats — først når frisk profil + historik er hentet (ingen flash) */}
          {statsLoading || (overviewMode === "liga" && ligaLoading) ? (
            <div style={{ textAlign: "center", padding: "20px", color: theme.textLight, fontSize: "13px", marginBottom: "20px" }}>Indlæser {activeModeLabel}-statistik…</div>
          ) : (
          <>
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

        </div>
        </div>

        {showPerformanceSection ? (
        <>
        <div ref={performanceRef} style={{ fontSize: "11px", fontWeight: 700, color: theme.textLight, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Performance · {activeModeLabel}
        </div>
        {/* ELO over tid — samme format som valgt i Overblik */}
        <div style={{ background: theme.surface, borderRadius: theme.radius, padding: "20px", boxShadow: theme.shadow, border: "1px solid " + theme.border, marginBottom: "16px" }}>
          <div style={{ fontSize: "14px", fontWeight: 700, marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
            <TrendingUp size={16} color={theme.accent} />
            <span>ELO over tid</span>
            <span style={{ fontSize: "11px", fontWeight: 500, color: theme.textLight }}>({activeModeLabel})</span>
          </div>
          {activeEloGraphLoading ? (
            <div style={{ textAlign: "center", padding: "20px", color: theme.textLight, fontSize: "13px" }}>Indlæser...</div>
          ) : (
            <EloGraph
              data={activeEloGraphData}
              valueLabel={activeEloGraphLabel}
              emptyText={activeEloGraphEmptyText}
            />
          )}
        </div>

        {/* Ekstra statistik — kun 2v2 */}
        {!statsLoading && is2v2Mode && (() => {
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

        {/* Peak ELO + Seneste form — kun 2v2 */}
        {!statsLoading && is2v2Mode && ratedRows.length > 0 && (
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
                      background: r.result === 'win' ? 'var(--pm-form-win)' : r.result === 'loss' ? 'var(--pm-form-loss)' : 'var(--pm-form-draw)',
                    }} />
                  ))}
                </div>
                <div style={{ fontSize: "11px", color: theme.textMid }}>Seneste {recentForm.length} kampe</div>
              </div>
            )}
          </div>
        )}
        </>
        ) : null}

        {showRelationsSection && (
          <div ref={relationsRef} style={{ fontSize: "11px", fontWeight: 700, color: theme.textLight, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Relationer · {activeModeLabel}
          </div>
        )}
        {isAmericanoMode && americanoRelationLoading && (
          <div style={{ textAlign: "center", padding: "16px", color: theme.textLight, fontSize: "13px", marginBottom: "16px" }}>
            Indlæser makker- og modstander-statistik…
          </div>
        )}
        {isAmericanoMode && !americanoRelationLoading && americanoRelationStats
          && !showAmericanoRelationsSection && americanoRounds > 0 && (
          <div style={{ fontSize: "12px", color: theme.textMid, marginBottom: "16px", lineHeight: 1.45 }}>
            Spil kampe på banen med makkere og modstandere i afsluttede Americano/Mexicano — så vises dine relationer her.
          </div>
        )}
        {isLigaMode && ligaRelationLoading && (
          <div style={{ textAlign: "center", padding: "16px", color: theme.textLight, fontSize: "13px", marginBottom: "16px" }}>
            Indlæser hold- og modstander-statistik…
          </div>
        )}
        {isLigaMode && !ligaRelationLoading && ligaRelationStats
          && !showLigaRelationsSection && ligaStats.matches > 0 && (
          <div style={{ fontSize: "12px", color: theme.textMid, marginBottom: "16px", lineHeight: 1.45 }}>
            Spil rapporterede ligakampe med makkere og modstandere — så vises dine relationer her.
          </div>
        )}
        {/* Relationer — kun 2v2 */}
        {show2v2RelationsSection && partnerOpponentStats && (
          <>
            {partnerOpponentStats.partners.length > 0 && (
              <div style={{ background: theme.surface, borderRadius: theme.radius, padding: "18px", boxShadow: theme.shadow, border: "1px solid " + theme.border, marginBottom: "10px" }}>
                <div style={{ fontSize: "10px", fontWeight: 700, color: theme.textLight, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "14px" }}>{RELATION_SECTION_LABELS.winMostWith}</div>
                {partnerOpponentStats.partners.map((p, i) => (
                  <div key={p.userId} style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: i < partnerOpponentStats.partners.length - 1 ? "10px" : 0 }}>
                    <AvatarCircle avatar={p.emoji} size={32} emojiSize="16px" style={{ background: theme.accentBg, border: "1px solid " + theme.accent + "30", flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "13px", fontWeight: 600, color: theme.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                      <div style={{ fontSize: "11px", color: theme.textLight }}>{p.asPartner.games} kampe sammen</div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: "15px", fontWeight: 800, color: theme.green }}>{Math.round((p.asPartner.wins / p.asPartner.games) * 100)}%</div>
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
                  <div style={{ fontSize: "10px", fontWeight: 700, color: theme.textLight, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "14px" }}>{RELATION_SECTION_LABELS.loseMostAgainst}</div>
                  {hardOpponents.map((p, i) => {
                    const theirWinPct = Math.round((1 - p.asOpponent.wins / p.asOpponent.games) * 100);
                    return (
                      <div key={p.userId} style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: i < hardOpponents.length - 1 ? "10px" : 0 }}>
                        <AvatarCircle avatar={p.emoji} size={32} emojiSize="16px" style={{ background: theme.redBg, border: `1px solid ${theme.red}`, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: "13px", fontWeight: 600, color: theme.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                          <div style={{ fontSize: "11px", color: theme.textLight }}>{p.asOpponent.games} kampe imod</div>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <div style={{ fontSize: "15px", fontWeight: 800, color: theme.red }}>{theirWinPct}%</div>
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

        {/* Americano: makker/modstander pr. runde */}
        {showAmericanoRelationsSection && americanoRelationStats && (
          <>
            {americanoRelationStats.bestPartners.length > 0 && (
              <div style={{ background: theme.surface, borderRadius: theme.radius, padding: "18px", boxShadow: theme.shadow, border: "1px solid " + theme.border, marginBottom: "10px" }}>
                <div style={{ fontSize: "10px", fontWeight: 700, color: theme.textLight, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "14px" }}>{RELATION_SECTION_LABELS.winMostWith}</div>
                {americanoRelationStats.bestPartners.map((p, i) => (
                  <div key={p.userId} style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: i < americanoRelationStats.bestPartners.length - 1 ? "10px" : 0 }}>
                    <AvatarCircle avatar={p.emoji} size={32} emojiSize="16px" style={{ background: theme.accentBg, border: "1px solid " + theme.accent + "30", flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "13px", fontWeight: 600, color: theme.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                      <div style={{ fontSize: "11px", color: theme.textLight }}>{p.asPartner.rounds} runder sammen</div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: "15px", fontWeight: 800, color: americanoOutcomeColors.win.text }}>{Math.round((p.asPartner.wins / p.asPartner.rounds) * 100)}%</div>
                      <div style={{ fontSize: "10px", color: theme.textLight }}>sejr på banen</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {americanoRelationStats.toughestPartners.length > 0 && (
              <div style={{ background: theme.surface, borderRadius: theme.radius, padding: "18px", boxShadow: theme.shadow, border: "1px solid " + theme.border, marginBottom: "10px" }}>
                <div style={{ fontSize: "10px", fontWeight: 700, color: theme.textLight, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "14px" }}>{RELATION_SECTION_LABELS.loseMostWith}</div>
                {americanoRelationStats.toughestPartners.map((p, i) => (
                  <div key={`tough-${p.userId}`} style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: i < americanoRelationStats.toughestPartners.length - 1 ? "10px" : 0 }}>
                    <AvatarCircle avatar={p.emoji} size={32} emojiSize="16px" style={{ background: theme.warmBg, border: "1px solid " + theme.warm + "40", flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "13px", fontWeight: 600, color: theme.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                      <div style={{ fontSize: "11px", color: theme.textLight }}>{p.asPartner.rounds} runder sammen</div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: "15px", fontWeight: 800, color: theme.warm }}>{Math.round((1 - p.asPartner.wins / p.asPartner.rounds) * 100)}%</div>
                      <div style={{ fontSize: "10px", color: theme.textLight }}>nederlag som makker</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {americanoRelationStats.hardestOpponents.length > 0 && (
              <div style={{ background: theme.surface, borderRadius: theme.radius, padding: "18px", boxShadow: theme.shadow, border: "1px solid " + theme.border, marginBottom: "10px" }}>
                <div style={{ fontSize: "10px", fontWeight: 700, color: theme.textLight, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "14px" }}>{RELATION_SECTION_LABELS.loseMostAgainst}</div>
                {americanoRelationStats.hardestOpponents.map((p, i) => {
                  const theirWinPct = Math.round((1 - p.asOpponent.wins / p.asOpponent.rounds) * 100);
                  return (
                    <div key={`hard-${p.userId}`} style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: i < americanoRelationStats.hardestOpponents.length - 1 ? "10px" : 0 }}>
                      <AvatarCircle avatar={p.emoji} size={32} emojiSize="16px" style={{ background: theme.redBg, border: `1px solid ${theme.red}`, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "13px", fontWeight: 600, color: theme.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                        <div style={{ fontSize: "11px", color: theme.textLight }}>{p.asOpponent.rounds} runder imod</div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontSize: "15px", fontWeight: 800, color: americanoOutcomeColors.loss.text }}>{theirWinPct}%</div>
                        <div style={{ fontSize: "10px", color: theme.textLight }}>de vinder</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {americanoRelationStats.easiestOpponents.length > 0 && (
              <div style={{ background: theme.surface, borderRadius: theme.radius, padding: "18px", boxShadow: theme.shadow, border: "1px solid " + theme.border, marginBottom: "16px" }}>
                <div style={{ fontSize: "10px", fontWeight: 700, color: theme.textLight, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "14px" }}>{RELATION_SECTION_LABELS.winMostAgainst}</div>
                {americanoRelationStats.easiestOpponents.map((p, i) => (
                  <div key={`easy-${p.userId}`} style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: i < americanoRelationStats.easiestOpponents.length - 1 ? "10px" : 0 }}>
                    <AvatarCircle avatar={p.emoji} size={32} emojiSize="16px" style={{ background: theme.accentBg, border: "1px solid " + theme.accent + "30", flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "13px", fontWeight: 600, color: theme.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                      <div style={{ fontSize: "11px", color: theme.textLight }}>{p.asOpponent.rounds} runder imod</div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: "15px", fontWeight: 800, color: americanoOutcomeColors.win.text }}>{Math.round((p.asOpponent.wins / p.asOpponent.rounds) * 100)}%</div>
                      <div style={{ fontSize: "10px", color: theme.textLight }}>din sejr</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {showLigaRelationsSection && ligaRelationStats && (
          <>
            {ligaRelationStats.bestPartners.length > 0 && (
              <div style={{ background: theme.surface, borderRadius: theme.radius, padding: "18px", boxShadow: theme.shadow, border: "1px solid " + theme.border, marginBottom: "10px" }}>
                <div style={{ fontSize: "10px", fontWeight: 700, color: theme.textLight, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "14px" }}>{RELATION_SECTION_LABELS.winMostWith}</div>
                {ligaRelationStats.bestPartners.map((p, i) => (
                  <div key={p.userId} style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: i < ligaRelationStats.bestPartners.length - 1 ? "10px" : 0 }}>
                    <AvatarCircle avatar={p.emoji} size={32} emojiSize="16px" style={{ background: theme.accentBg, border: "1px solid " + theme.accent + "30", flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "13px", fontWeight: 600, color: theme.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                      <div style={{ fontSize: "11px", color: theme.textLight }}>{p.asPartner.matches} kampe sammen</div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: "15px", fontWeight: 800, color: theme.green }}>{Math.round((p.asPartner.wins / p.asPartner.matches) * 100)}%</div>
                      <div style={{ fontSize: "10px", color: theme.textLight }}>sejr</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {ligaRelationStats.toughestPartners.length > 0 && (
              <div style={{ background: theme.surface, borderRadius: theme.radius, padding: "18px", boxShadow: theme.shadow, border: "1px solid " + theme.border, marginBottom: "10px" }}>
                <div style={{ fontSize: "10px", fontWeight: 700, color: theme.textLight, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "14px" }}>{RELATION_SECTION_LABELS.loseMostWith}</div>
                {ligaRelationStats.toughestPartners.map((p, i) => (
                  <div key={`liga-tough-${p.userId}`} style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: i < ligaRelationStats.toughestPartners.length - 1 ? "10px" : 0 }}>
                    <AvatarCircle avatar={p.emoji} size={32} emojiSize="16px" style={{ background: theme.warmBg, border: "1px solid " + theme.warm + "40", flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "13px", fontWeight: 600, color: theme.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                      <div style={{ fontSize: "11px", color: theme.textLight }}>{p.asPartner.matches} kampe sammen</div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: "15px", fontWeight: 800, color: theme.warm }}>{Math.round((1 - p.asPartner.wins / p.asPartner.matches) * 100)}%</div>
                      <div style={{ fontSize: "10px", color: theme.textLight }}>nederlag som makker</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {ligaRelationStats.hardestOpponents.length > 0 && (
              <div style={{ background: theme.surface, borderRadius: theme.radius, padding: "18px", boxShadow: theme.shadow, border: "1px solid " + theme.border, marginBottom: "10px" }}>
                <div style={{ fontSize: "10px", fontWeight: 700, color: theme.textLight, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "14px" }}>{RELATION_SECTION_LABELS.loseMostAgainst}</div>
                {ligaRelationStats.hardestOpponents.map((p, i) => {
                  const theirWinPct = Math.round((1 - p.asOpponent.wins / p.asOpponent.matches) * 100);
                  return (
                    <div key={`liga-hard-${p.userId}`} style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: i < ligaRelationStats.hardestOpponents.length - 1 ? "10px" : 0 }}>
                      <AvatarCircle avatar={p.emoji} size={32} emojiSize="16px" style={{ background: theme.redBg, border: `1px solid ${theme.red}`, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "13px", fontWeight: 600, color: theme.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                        <div style={{ fontSize: "11px", color: theme.textLight }}>{p.asOpponent.matches} kampe imod</div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontSize: "15px", fontWeight: 800, color: theme.red }}>{theirWinPct}%</div>
                        <div style={{ fontSize: "10px", color: theme.textLight }}>de vinder</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {ligaRelationStats.easiestOpponents.length > 0 && (
              <div style={{ background: theme.surface, borderRadius: theme.radius, padding: "18px", boxShadow: theme.shadow, border: "1px solid " + theme.border, marginBottom: "16px" }}>
                <div style={{ fontSize: "10px", fontWeight: 700, color: theme.textLight, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "14px" }}>{RELATION_SECTION_LABELS.winMostAgainst}</div>
                {ligaRelationStats.easiestOpponents.map((p, i) => (
                  <div key={`liga-easy-${p.userId}`} style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: i < ligaRelationStats.easiestOpponents.length - 1 ? "10px" : 0 }}>
                    <AvatarCircle avatar={p.emoji} size={32} emojiSize="16px" style={{ background: theme.accentBg, border: "1px solid " + theme.accent + "30", flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "13px", fontWeight: 600, color: theme.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                      <div style={{ fontSize: "11px", color: theme.textLight }}>{p.asOpponent.matches} kampe imod</div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: "15px", fontWeight: 800, color: theme.green }}>{Math.round((p.asOpponent.wins / p.asOpponent.matches) * 100)}%</div>
                      <div style={{ fontSize: "10px", color: theme.textLight }}>din sejr</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        <div ref={actionsRef} style={{ fontSize: "11px", fontWeight: 700, color: theme.textLight, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Handlinger · {activeModeLabel}
        </div>
        {/* Quick links — matcher valgt format i Overblik */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px" }}>
          {is2v2Mode ? (
            <button onClick={() => { mergeKampeSessionPrefs(user.id, { format: "padel", view: "completed", scope: "mine" }); setTab("kampe"); }} style={{ background: theme.surface, borderRadius: theme.radius, padding: "16px", boxShadow: theme.shadow, border: "1px solid " + theme.border, cursor: "pointer", textAlign: "left", fontFamily: font }}>
              <Swords size={18} color={theme.accent} />
              <div style={{ fontSize: "13px", fontWeight: 700, marginTop: "8px" }}>Mine 2v2-kampe</div>
              <div style={{ fontSize: "11px", color: theme.textLight }}>{games} spillet</div>
            </button>
          ) : null}
          {isAmericanoMode ? (
            <button onClick={() => { mergeKampeSessionPrefs(user.id, { format: "americano", americanoView: "completed", scope: "mine" }); setTab("kampe"); }} style={{ background: theme.surface, borderRadius: theme.radius, padding: "16px", boxShadow: theme.shadow, border: "1px solid " + theme.border, cursor: "pointer", textAlign: "left", fontFamily: font }}>
              <Swords size={18} color={theme.accent} />
              <div style={{ fontSize: "13px", fontWeight: 700, marginTop: "8px" }}>Mine Americano/Mexicano</div>
              <div style={{ fontSize: "11px", color: theme.textLight }}>{americanoPlayed} deltaget</div>
            </button>
          ) : null}
          {isLigaMode ? (
            <button onClick={() => openMineLigaerFromProfile(user.id, setTab)} style={{ background: theme.surface, borderRadius: theme.radius, padding: "16px", boxShadow: theme.shadow, border: "1px solid " + theme.border, cursor: "pointer", textAlign: "left", fontFamily: font }}>
              <Swords size={18} color={theme.accent} />
              <div style={{ fontSize: "13px", fontWeight: 700, marginTop: "8px" }}>Mine ligaer</div>
              <div style={{ fontSize: "11px", color: theme.textLight }}>{ligaStats.leagues} liga{ligaStats.leagues === 1 ? "" : "er"}</div>
            </button>
          ) : null}
          {is2v2Mode ? (
            <button onClick={() => { persistRankingModeForProfile("2v2"); setTab("ranking"); }} style={{ background: theme.surface, borderRadius: theme.radius, padding: "16px", boxShadow: theme.shadow, border: "1px solid " + theme.border, cursor: "pointer", textAlign: "left", fontFamily: font }}>
              <Trophy size={18} color={theme.warm} />
              <div style={{ fontSize: "13px", fontWeight: 700, marginTop: "8px" }}>2v2-ranking</div>
              <div style={{ fontSize: "11px", color: theme.textLight }}>ELO {elo}</div>
            </button>
          ) : null}
          {isAmericanoMode ? (
            <button onClick={() => { persistRankingModeForProfile("americano"); setTab("ranking"); }} style={{ background: theme.surface, borderRadius: theme.radius, padding: "16px", boxShadow: theme.shadow, border: "1px solid " + theme.border, cursor: "pointer", textAlign: "left", fontFamily: font }}>
              <Trophy size={18} color={theme.warm} />
              <div style={{ fontSize: "13px", fontWeight: 700, marginTop: "8px" }}>{TOURNAMENT_RANKING_LABEL}</div>
              <div style={{ fontSize: "11px", color: theme.textLight }}>ELO {americanoElo}</div>
            </button>
          ) : null}
          {isLigaMode ? (
            <button onClick={() => {
              mergeLigaSessionPrefs(user.id, { ligaView: 'completed', ligaScope: 'mine' });
              mergeKampeSessionPrefs(user.id, { format: 'liga', scope: 'mine' });
              setTab('kampe');
            }} style={{ background: theme.surface, borderRadius: theme.radius, padding: "16px", boxShadow: theme.shadow, border: "1px solid " + theme.border, cursor: "pointer", textAlign: "left", fontFamily: font }}>
              <Trophy size={18} color={theme.warm} />
              <div style={{ fontSize: "13px", fontWeight: 700, marginTop: "8px" }}>Liga i Kampe</div>
              <div style={{ fontSize: "11px", color: theme.textLight }}>{ligaStats.matches} kampe</div>
            </button>
          ) : null}
        </div>
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
        <input value={form.first_name} readOnly style={{ ...inputStyle, marginBottom: "10px", background: theme.surfaceAlt, color: theme.textLight, cursor: "not-allowed" }} />
        <label style={labelStyle}>Efternavn</label>
        <input value={form.last_name} readOnly style={{ ...inputStyle, marginBottom: "6px", background: theme.surfaceAlt, color: theme.textLight, cursor: "not-allowed" }} />
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
        <div style={labelStyle}>Region <span style={{ color: theme.red }}>*</span></div>
        <PillTabs
          tabs={REGION_PILL_TABS}
          value={canonicalRegionForForm(form.area) || ''}
          onChange={(id) => set('area', id)}
          ariaLabel="Region"
          size="sm"
          className="pm-pill-tabs--wrap"
          style={{ marginBottom: '14px' }}
        />
        <label htmlFor="profil-city" style={labelStyle}>By <span style={{ fontWeight: 400, color: theme.textLight }}>(valgfri)</span></label>
        <input
          id="profil-city"
          value={form.city}
          onChange={e => set("city", e.target.value)}
          placeholder="F.eks. Aarhus, København, Aalborg..."
          style={{ ...inputStyle, marginBottom: "14px" }}
        />

        <div style={labelStyle}>Niveau</div>
        <div style={{ marginBottom: 14 }}>
          <PlaytomicLevelPicker
            value={form.levelNumeric}
            onChange={(n) => set('levelNumeric', n)}
          />
        </div>

        {/* Play style */}
        <div style={labelStyle}>Spillestil</div>
        <PillTabs
          tabs={PLAY_STYLES.map((s) => ({ id: s, label: s }))}
          value={PLAY_STYLES.includes(form.play_style) ? form.play_style : ""}
          onChange={(id) => set("play_style", id)}
          ariaLabel="Spillestil"
          size="sm"
          className="pm-pill-tabs--wrap"
          style={{ marginBottom: "14px" }}
        />

        {/* Court side */}
        <div style={labelStyle}>Foretrukken side på banen</div>
        <PillTabs
          tabs={COURT_SIDES.map((s) => ({ id: s, label: s }))}
          value={COURT_SIDES.includes(form.court_side) ? form.court_side : ""}
          onChange={(id) => set("court_side", id)}
          ariaLabel="Foretrukken baneside"
          size="sm"
          style={{ marginBottom: "14px" }}
        />

        {/* Bio */}
        <label htmlFor="profil-bio" style={labelStyle}>Bio</label>
        <textarea id="profil-bio" value={form.bio} onChange={e => set("bio", e.target.value)} placeholder="Fortæl lidt om dig som spiller..." style={{ ...inputStyle, height: "80px", resize: "vertical", marginBottom: "20px" }} />

        <div style={{ fontSize: "12px", fontWeight: 700, color: theme.textLight, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "10px" }}>
          Søger kamp eller makker
        </div>
        <p style={{ fontSize: "12px", color: theme.textMid, lineHeight: 1.45, margin: "0 0 12px" }}>
          Synlighed, intention, niveau og tidsrum styres i dine to filtre — ikke her under basisprofil.
        </p>
        <MatchFilterProfileCard user={user} />
        <MakkerFilterProfileCard user={user} />

        <div
          style={{
            marginTop: '20px',
            marginBottom: '16px',
            padding: '14px',
            borderRadius: theme.radius,
            border: `1px solid ${theme.border}`,
            background: theme.surfaceAlt,
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 700, color: theme.textLight, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
            Konto og privatliv
          </div>
          <p style={{ margin: '0 0 10px', fontSize: '13px', color: theme.textMid, lineHeight: 1.5 }}>
            Vil du slette konto og persondata? Skriv til os — vi sletter typisk inden for 30 dage.
          </p>
          <a
            href={`mailto:${LEGAL_INFO.email}?subject=${encodeURIComponent('Slet min PadelMakker-konto')}`}
            style={{ ...btn(false), display: 'inline-flex', fontSize: '13px', textDecoration: 'none' }}
          >
            Anmod om sletning
          </a>
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

