import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import { font, theme, btn, inputStyle, labelStyle, heading, tag } from '../lib/platformTheme';
import { resolveDisplayName, sanitizeText, displayUserText } from '../lib/platformUtils';
import { mergeKampeSessionPrefs } from '../lib/kampeSessionPrefs';
import { mergeLigaSessionPrefs, openMineLigaerFromProfile } from '../lib/ligaSessionPrefs';
import { useLigaPartnerOpponentStats } from '../lib/ligaRelationStats';
import { REGIONS, PLAY_STYLES, COURT_SIDES, AVAILABILITY, DAYS_OF_WEEK } from '../lib/platformConstants';
import { formatPlaytomicLevel } from '../lib/padelLevelUtils';
import { PlaytomicLevelPicker } from '../components/PlaytomicLevelPicker';
import { canonicalRegionForForm, calcAge } from '../lib/profileUtils';
import { statsFromEloHistoryRows, useProfileEloBundle, winStreaksFromEloHistory, usePartnerOpponentStats, sortEloHistoryChronological } from '../lib/eloHistoryUtils';
import { useAmericanoPartnerOpponentStats } from '../lib/americanoRelationStats';
import { americanoOutcomeColors } from '../features/americano/americanoOutcomeColors';
import { EloGraph } from '../components/EloGraph';
import { MapPin, Settings, Swords, Trophy, TrendingUp, Save, X } from 'lucide-react';
import { profileFormState } from './profileTabHelpers';
import { isValidProfileRegion } from '../lib/profileUtils';
import { isSeekingActiveProfile } from '../lib/seekingFeedTtl';
import { LEGAL_INFO } from '../lib/legalInfo';
import { uploadAvatar, hasPendingAvatar, applyPendingAvatar } from '../lib/avatarUpload';
import { AvatarPicker } from '../components/AvatarPicker';
import { AvatarCircle } from '../components/AvatarCircle';
import { PlayerProfileModal } from './PlayerProfileModal';
import { PillTabs } from '../components/PillTabs';
import { ProfileBadgeGallery } from '../components/ProfileBadgeGallery';
import { getProfileBadges } from '../lib/profileBadges';
import {
  TWO_V_TWO_ELO_LABEL,
  TOURNAMENT_DATA_SOURCE,
  TOURNAMENT_ELO_GRAPH_EMPTY,
  TOURNAMENT_ELO_GRAPH_LABEL,
  TOURNAMENT_ELO_LABEL,
  TOURNAMENT_MODE_LABEL,
  TOURNAMENT_RANKING_LABEL,
} from '../lib/tournamentCopy';
import { fetchUsersIBlocked, unblockUser } from '../lib/userModeration';
import { fetchProfilesByIdMap } from '../lib/profileQueries';

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

function RelationRow({ emoji, name, subtitle, statValue, statColor, statLabel, avatarStyle, onOpen }) {
  const interactive = typeof onOpen === "function";
  const handleKeyDown = interactive
    ? (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }
    : undefined;
  return (
    <div
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={interactive ? onOpen : undefined}
      onKeyDown={handleKeyDown}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        cursor: interactive ? "pointer" : undefined,
      }}
    >
      <AvatarCircle avatar={emoji} size={40} emojiSize="16px" style={{ ...avatarStyle, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "13px", fontWeight: 600, color: theme.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
        <div style={{ fontSize: "11px", color: theme.textLight }}>{subtitle}</div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontSize: "15px", fontWeight: 800, color: statColor }}>{statValue}</div>
        <div style={{ fontSize: "10px", color: theme.textLight }}>{statLabel}</div>
      </div>
    </div>
  );
}

export function ProfilTab({ user, showToast, setTab }) {
  const { updateProfile, user: authUser } = useAuth();
  const displayName = resolveDisplayName(user, authUser);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState(/** @type {{ id: string, name: string }[]} */ ([]));
  const [blockedLoading, setBlockedLoading] = useState(false);
  const [unblockingId, setUnblockingId] = useState(/** @type {string | null} */ (null));

  useEffect(() => {
    let cancelled = false;
    if (!user?.id || !editing) return undefined;
    setBlockedLoading(true);
    void (async () => {
      try {
        const ids = [...(await fetchUsersIBlocked(user.id))];
        if (!ids.length) {
          if (!cancelled) setBlockedUsers([]);
          return;
        }
        const map = await fetchProfilesByIdMap(ids, 'id, full_name, name');
        if (cancelled) return;
        setBlockedUsers(
          ids.map((id) => ({
            id,
            name: resolveDisplayName(map[id] || { id }, null) || 'Spiller',
          })),
        );
      } catch (e) {
        console.warn('blocked users load:', e?.message || e);
        if (!cancelled) setBlockedUsers([]);
      } finally {
        if (!cancelled) setBlockedLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id, editing]);
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
  const { currentStreak: twoV2CurrentStreak, bestStreak: twoV2BestStreak } = useMemo(() => winStreaksFromEloHistory(ratedRows), [ratedRows]);

  const todayEloChange = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    return ratedRows
      .filter((r) => (r.date || '').slice(0, 10) === todayStr)
      .reduce((sum, r) => sum + (Number(r.change) || 0), 0);
  }, [ratedRows]);

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
      showToast(trimmed ? 'By gemt' : 'By fjernet', 'success');
    } catch (e) {
      showToast(e?.message || 'Kunne ikke gemme by', 'error');
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

  const [viewPlayer, setViewPlayer] = useState(null);
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
        availability: form.availability || [],
        available_days: form.available_days || [],
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
      showToast('Profil opdateret!', 'success');
    } catch (e) {
      console.error(e);
      showToast('Kunne ikke gemme. Prøv igen.', 'error');
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
    { label: "Kampe spillet", value: games, color: theme.blue },
    { label: "Win rate", value: games > 0 ? winPct + "%" : "—", color: theme.accent },
    { label: "Nuværende stime", value: twoV2CurrentStreak > 0 ? `🔥 ${twoV2CurrentStreak}` : twoV2CurrentStreak, color: twoV2CurrentStreak > 0 ? theme.warm : theme.textLight },
    { label: "Turneringer", value: americanoPlayed || 0, color: theme.accent },
  ];
  const americanoOverviewCards = [
    { label: TOURNAMENT_ELO_LABEL, value: americanoElo, color: theme.accent },
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
  const activeEloGraphLabel = isAmericanoMode ? TOURNAMENT_ELO_GRAPH_LABEL : TWO_V_TWO_ELO_LABEL;
  const activeEloGraphEmptyText = isAmericanoMode
    ? TOURNAMENT_ELO_GRAPH_EMPTY
    : `Spil mindst 2 kampe for at se din ${TWO_V_TWO_ELO_LABEL}-graf.`;
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
  const profileBadges = useMemo(() => {
    const ctx = {
      games,
      wins,
      winPct,
      elo,
      peakElo,
      currentStreak: twoV2CurrentStreak,
      bestStreak: twoV2BestStreak,
      todayEloChange,
      maxPartnerGames: partnerOpponentStats?.maxPartnerGames || 0,
      americanoPlayed,
      americanoRounds,
      americanoWins,
      americanoWinPct,
      americanoElo,
      leagues: ligaStats.leagues,
      ligaMatches: ligaStats.matches,
      ligaWins: ligaStats.wins,
      ligaWinPct,
    };
    if (overviewMode === 'americano') return getProfileBadges('americano', ctx);
    if (overviewMode === 'liga') return getProfileBadges('liga', ctx);
    return getProfileBadges('2v2', ctx);
  }, [
    overviewMode,
    games,
    wins,
    winPct,
    elo,
    peakElo,
    twoV2CurrentStreak,
    twoV2BestStreak,
    todayEloChange,
    partnerOpponentStats?.maxPartnerGames,
    americanoPlayed,
    americanoRounds,
    americanoWins,
    americanoWinPct,
    americanoElo,
    ligaStats.leagues,
    ligaStats.matches,
    ligaStats.wins,
    ligaWinPct,
  ]);

  const profileBadgesLoading =
    overviewMode === '2v2'
      ? statsLoading
      : overviewMode === 'americano'
        ? statsLoading
        : ligaLoading;

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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px 8px' }}>
          <h2 style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-0.3px', color: theme.text, margin: 0 }}>Min profil</h2>
        </div>
        <div className="pm-profile-top">
        {/* Profile card – centered pf-head layout matching mockup */}
        <div ref={overviewRef} className="pm-profile-card" style={{ background: theme.surface, borderRadius: theme.radius, padding: "0 0 16px", boxShadow: theme.shadow, border: "1px solid " + theme.border, marginBottom: "16px", overflow: 'hidden', position: 'relative' }}>
          {/* Edit button floating in top-right corner */}
          <div style={{ position: 'absolute', top: 14, right: 14, zIndex: 1 }}>
            <button
              onClick={() => { setForm(profileFormState(user)); setEditing(true); }}
              style={{ ...btn(false), padding: "5px 10px", fontSize: "12px", color: theme.textMid, background: theme.surfaceAlt, borderColor: theme.border }}
            >
              <Settings size={12} /> Rediger
            </button>
          </div>
          {/* Centered header: avatar + name + location + tags */}
          <div style={{ textAlign: 'center', padding: '18px 18px 14px' }}>
            <div style={{ position: 'relative', display: 'inline-block', margin: '0 auto' }}>
              <AvatarCircle
                avatar={user.avatar}
                size={96}
                emojiSize="29px"
                style={{ border: '3px solid ' + theme.surface, boxShadow: theme.shadow }}
              />
              {user.level != null && user.level !== '' && (
                <div style={{ position: 'absolute', bottom: 2, right: 2, width: 22, height: 22, borderRadius: '50%', background: theme.navy, color: 'var(--pm-on-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid ' + theme.surface }}>
                  <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 13 4 4L19 7"/></svg>
                </div>
              )}
            </div>
            <h2 style={{ fontSize: 19, fontWeight: 600, marginTop: 12, letterSpacing: '-0.3px', color: theme.text, margin: '12px 0 0' }}>{displayName}</h2>
            <p style={{ color: theme.textLight, fontSize: 12.5, marginTop: 3 }}>
              {user.city ? `${user.city}, ` : ''}{user.area || authUser?.email}
            </p>
            <div style={{ display: 'flex', gap: 7, marginTop: 9, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
              {!statsLoading && is2v2Mode && elo != null ? (
                <span style={tag(theme.accentBg, theme.accent)}>{TWO_V_TWO_ELO_LABEL} {elo}</span>
              ) : null}
              {user.level != null && user.level !== '' ? (
                <span style={tag(theme.amberBg, theme.amberText)}>
                  Niveau {formatPlaytomicLevel(user.level)}
                </span>
              ) : null}
              {!statsLoading && isAmericanoMode && <span style={tag(theme.blueBg, theme.blue)}>{TOURNAMENT_ELO_LABEL} {americanoElo}</span>}
              {!statsLoading && isLigaMode && !ligaLoading && ligaStats.matches > 0 && (
                <span style={tag(theme.blueBg, theme.blue)}>{ligaStats.matches} ligakampe</span>
              )}
              {user.birth_year && <span style={tag(theme.blueBg, theme.blue)}>{calcAge(user.birth_year, user.birth_month, user.birth_day)} år</span>}
              {user.play_style && <span style={tag(theme.blueBg, theme.blue)}>{user.play_style}</span>}
              {user.court_side && <span style={tag(theme.blueBg, theme.blue)}>{user.court_side}</span>}
              {isSeekingActiveProfile(user) && <span style={tag(theme.greenBg, theme.green)}>Søger makker</span>}
            </div>
          </div>

          {/* ELO hero inside profile card — matches mockup position (between stat-grid and padded content) */}
          {showPerformanceSection && (
            <div style={{ margin: '10px 18px 0', borderRadius: 16, padding: '17px', background: 'linear-gradient(150deg, var(--pm-navy-deep), var(--pm-navy-soft))', color: 'var(--pm-on-accent)', boxShadow: theme.shadowLg }}>
              <div style={{ fontSize: '9.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--pm-hero-subtitle)', marginBottom: '6px' }}>
                Aktuel {isAmericanoMode ? TOURNAMENT_ELO_LABEL : TWO_V_TWO_ELO_LABEL} · {activeModeLabel}
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: '12px' }}>
                <div style={{ fontSize: '32px', fontWeight: 700, lineHeight: 1.15, letterSpacing: '-0.5px' }}>
                  {(is2v2Mode ? elo : americanoElo) ?? '—'}
                </div>
                {is2v2Mode && todayEloChange !== 0 && (
                  <div style={{ fontSize: '13px', fontWeight: 700, color: todayEloChange > 0 ? 'var(--pm-success-border)' : 'var(--pm-danger-border)', letterSpacing: '-0.2px' }}>
                    {todayEloChange > 0 ? '↑' : '↓'} {todayEloChange > 0 ? '+' : ''}{todayEloChange} i dag
                  </div>
                )}
              </div>
              {activeEloGraphLoading ? (
                <div style={{ textAlign: "center", padding: "16px 0", color: 'var(--pm-hero-subtitle)', fontSize: "13px" }}>Indlæser...</div>
              ) : (
                <EloGraph
                  data={activeEloGraphData}
                  valueLabel={activeEloGraphLabel}
                  emptyText={activeEloGraphEmptyText}
                  dark
                />
              )}
            </div>
          )}

          <div style={{ padding: '0 18px' }}>
          {user.bio && <p style={{ fontSize: "13px", color: theme.textMid, lineHeight: 1.5, marginBottom: "16px", fontStyle: "italic" }}>&ldquo;{displayUserText(user.bio)}&rdquo;</p>}

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

          <div className="pm-profile-overview-tabs">
          <PillTabs
            tabs={PROFILE_OVERVIEW_TABS}
            value={overviewMode}
            onChange={setOverviewMode}
            ariaLabel="Statistik-type"
            size="sm"
            className="pm-pill-tabs--fill"
          />
          </div>

          {/* Stats — først når frisk profil + historik er hentet (ingen flash) */}
          {statsLoading || (overviewMode === "liga" && ligaLoading) ? (
            <div style={{ textAlign: "center", padding: "20px", color: theme.textLight, fontSize: "13px", marginBottom: "20px" }}>Indlæser {activeModeLabel}-statistik…</div>
          ) : (
          <>
          <div style={{ fontSize: 10, color: theme.textLight, marginBottom: 10, lineHeight: 1.45 }}>
            <div>{activeOverviewSource}</div>
            {activeOverviewUpdatedAt !== 'ukendt' ? (
              <div style={{ marginTop: 2, opacity: 0.85 }}>Opdateret {activeOverviewUpdatedAt}</div>
            ) : null}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11, marginBottom: 20 }}>
            {activeOverviewCards.map((s, i) => (
              <div key={i} style={{ textAlign: 'center', padding: '13px 15px', background: 'var(--pm-surface-muted)', borderRadius: 16, border: '1px solid var(--pm-americano-tie-border)' }}>
                <div style={{ fontSize: '10.5px', fontWeight: 600, color: theme.textLight, letterSpacing: '0.03em' }}>{s.label}</div>
                {s.form ? (
                  <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginTop: 9 }}>
                    {s.form.length > 0 ? s.form.map((r, j) => (
                      <div key={j} style={{ width: 21, height: 21, borderRadius: '50%', background: r.result === 'win' ? 'var(--pm-green)' : r.result === 'loss' ? 'var(--pm-red)' : 'var(--pm-border)', color: 'var(--pm-on-accent)', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {r.result === 'win' ? 'V' : r.result === 'loss' ? 'T' : 'U'}
                      </div>
                    )) : <div style={{ fontSize: '13px', color: theme.textLight, marginTop: 4 }}>—</div>}
                  </div>
                ) : (
                  <div style={{ fontSize: 23, fontWeight: 700, color: s.color || theme.accent, marginTop: 4 }}>{s.value}</div>
                )}
              </div>
            ))}
          </div>
          </>
          )}

          {!profileBadgesLoading && (
            <ProfileBadgeGallery badges={profileBadges} modeLabel={activeModeLabel} />
          )}

        </div>
        </div>
        </div>

        {showPerformanceSection ? (
        <>
        <div ref={performanceRef} style={{ fontSize: "10.5px", fontWeight: 700, color: theme.textLight, margin: "14px 18px 8px", textTransform: "uppercase", letterSpacing: "1.2px" }}>
          Performance · {activeModeLabel}
        </div>
        {/* Ekstra statistik — kun 2v2: samlet 2×2 gitter */}
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

          const statCard = (children) => (
            <div style={{ background: theme.surface, borderRadius: theme.radius, padding: "14px 16px", boxShadow: theme.shadow, border: "1px solid " + theme.border }}>
              {children}
            </div>
          );

          return (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "16px" }}>
              {statCard(<>
                <div style={{ fontSize: "10px", fontWeight: 700, color: theme.textLight, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>Sejrsstreak</div>
                <div style={{ fontSize: "26px", fontWeight: 800, color: theme.warm, letterSpacing: "-0.03em" }}>{currentStreak > 0 ? `🔥 ${currentStreak}` : "0"}</div>
                <div style={{ fontSize: "11px", color: theme.textMid, marginTop: "4px" }}>Bedste: {bestStreak} i træk</div>
              </>)}
              {statCard(<>
                <div style={{ fontSize: "10px", fontWeight: 700, color: theme.textLight, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>Bedste måned</div>
                {bestMonth && bestMonth.month ? (
                  <>
                    <div style={{ fontSize: "15px", fontWeight: 800, color: theme.accent, letterSpacing: "-0.02em", textTransform: "capitalize" }}>{fmtMonth(bestMonth.month)}</div>
                    <div style={{ fontSize: "11px", color: theme.textMid, marginTop: "4px" }}>
                      {bestMonth.wins}/{bestMonth.games} sejre · {bestMonth.change > 0 ? "+" : ""}{bestMonth.change} ELO
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: "13px", color: theme.textMid, marginTop: "2px" }}>Ingen data endnu</div>
                )}
              </>)}
              {statCard(<>
                <div style={{ fontSize: "10px", fontWeight: 700, color: theme.textLight, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>Højeste ELO</div>
                {peakElo ? (
                  <>
                    <div style={{ fontSize: "22px", fontWeight: 800, color: theme.accent, letterSpacing: "-0.03em" }}>🏆 {peakElo}</div>
                    <div style={{ fontSize: "11px", color: theme.textMid, marginTop: "4px" }}>Bedste nogensinde</div>
                  </>
                ) : (
                  <div style={{ fontSize: "22px", fontWeight: 800, color: theme.textLight }}>—</div>
                )}
              </>)}
              {statCard(<>
                <div style={{ fontSize: "10px", fontWeight: 700, color: theme.textLight, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "10px" }}>Seneste form</div>
                {recentForm.length > 0 ? (
                  <>
                    <div style={{ display: "flex", gap: "5px", alignItems: "center", justifyContent: "center", marginBottom: "6px" }}>
                      {recentForm.map((r, i) => (
                        <div key={i} title={r.result === 'win' ? 'Sejr' : r.result === 'loss' ? 'Nederlag' : 'Uafgjort'} style={{
                          width: "24px", height: "24px", borderRadius: "50%", flexShrink: 0,
                          background: r.result === 'win' ? 'var(--pm-form-win)' : r.result === 'loss' ? 'var(--pm-form-loss)' : 'var(--pm-form-draw)',
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: "10px", fontWeight: 700, color: "var(--pm-on-accent)",
                        }}>
                          {r.result === 'win' ? 'V' : r.result === 'loss' ? 'T' : 'U'}
                        </div>
                      ))}
                    </div>
                    <div style={{ fontSize: "11px", color: theme.textMid }}>Seneste {recentForm.length} kampe</div>
                  </>
                ) : (
                  <div style={{ fontSize: "13px", color: theme.textMid }}>Ingen kampe endnu</div>
                )}
              </>)}
            </div>
          );
        })()}
        </>
        ) : null}

        {showRelationsSection && (
          <div ref={relationsRef} style={{ fontSize: "10.5px", fontWeight: 700, color: theme.textLight, margin: "14px 18px 8px", textTransform: "uppercase", letterSpacing: "1.2px" }}>
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
                  <div key={p.userId} style={{ marginBottom: i < partnerOpponentStats.partners.length - 1 ? "10px" : 0 }}>
                    <RelationRow
                      emoji={p.emoji}
                      name={p.name}
                      subtitle={`${p.asPartner.games} kampe sammen`}
                      statValue={`${Math.round((p.asPartner.wins / p.asPartner.games) * 100)}%`}
                      statColor={theme.green}
                      statLabel="sejr"
                      avatarStyle={{ background: theme.accentBg, border: "1px solid " + theme.accent + "30" }}
                      onOpen={() => setViewPlayer({ id: p.userId, name: p.name, avatar: p.emoji })}
                    />
                  </div>
                ))}
              </div>
            )}
            {(partnerOpponentStats.worstPartners || []).length > 0 && (
              <div style={{ background: theme.surface, borderRadius: theme.radius, padding: "18px", boxShadow: theme.shadow, border: "1px solid " + theme.border, marginBottom: "10px" }}>
                <div style={{ fontSize: "10px", fontWeight: 700, color: theme.textLight, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "14px" }}>{RELATION_SECTION_LABELS.loseMostWith}</div>
                {partnerOpponentStats.worstPartners.map((p, i) => (
                  <div key={p.userId} style={{ marginBottom: i < partnerOpponentStats.worstPartners.length - 1 ? "10px" : 0 }}>
                    <RelationRow
                      emoji={p.emoji}
                      name={p.name}
                      subtitle={`${p.asPartner.games} kampe sammen`}
                      statValue={`${Math.round((1 - p.asPartner.wins / p.asPartner.games) * 100)}%`}
                      statColor={theme.warm}
                      statLabel="nederlag som makker"
                      avatarStyle={{ background: theme.warmBg, border: "1px solid " + theme.warm + "40" }}
                      onOpen={() => setViewPlayer({ id: p.userId, name: p.name, avatar: p.emoji })}
                    />
                  </div>
                ))}
              </div>
            )}
            {(partnerOpponentStats.bestOpponents || []).length > 0 && (
              <div style={{ background: theme.surface, borderRadius: theme.radius, padding: "18px", boxShadow: theme.shadow, border: "1px solid " + theme.border, marginBottom: "10px" }}>
                <div style={{ fontSize: "10px", fontWeight: 700, color: theme.textLight, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "14px" }}>{RELATION_SECTION_LABELS.winMostAgainst}</div>
                {partnerOpponentStats.bestOpponents.map((p, i) => (
                  <div key={p.userId} style={{ marginBottom: i < partnerOpponentStats.bestOpponents.length - 1 ? "10px" : 0 }}>
                    <RelationRow
                      emoji={p.emoji}
                      name={p.name}
                      subtitle={`${p.asOpponent.games} kampe imod`}
                      statValue={`${Math.round((p.asOpponent.wins / p.asOpponent.games) * 100)}%`}
                      statColor={theme.green}
                      statLabel="din sejr"
                      avatarStyle={{ background: theme.greenBg, border: "1px solid " + theme.green + "40" }}
                      onOpen={() => setViewPlayer({ id: p.userId, name: p.name, avatar: p.emoji })}
                    />
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
                      <div key={p.userId} style={{ marginBottom: i < hardOpponents.length - 1 ? "10px" : 0 }}>
                        <RelationRow
                          emoji={p.emoji}
                          name={p.name}
                          subtitle={`${p.asOpponent.games} kampe imod`}
                          statValue={`${theirWinPct}%`}
                          statColor={theme.red}
                          statLabel="de vinder"
                          avatarStyle={{ background: theme.redBg, border: `1px solid ${theme.red}` }}
                          onOpen={() => setViewPlayer({ id: p.userId, name: p.name, avatar: p.emoji })}
                        />
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
                  <div key={p.userId} style={{ marginBottom: i < americanoRelationStats.bestPartners.length - 1 ? "10px" : 0 }}>
                    <RelationRow
                      emoji={p.emoji}
                      name={p.name}
                      subtitle={`${p.asPartner.rounds} runder sammen`}
                      statValue={`${Math.round((p.asPartner.wins / p.asPartner.rounds) * 100)}%`}
                      statColor={americanoOutcomeColors.win.text}
                      statLabel="sejr på banen"
                      avatarStyle={{ background: theme.accentBg, border: "1px solid " + theme.accent + "30" }}
                      onOpen={() => setViewPlayer({ id: p.userId, name: p.name, avatar: p.emoji })}
                    />
                  </div>
                ))}
              </div>
            )}
            {americanoRelationStats.toughestPartners.length > 0 && (
              <div style={{ background: theme.surface, borderRadius: theme.radius, padding: "18px", boxShadow: theme.shadow, border: "1px solid " + theme.border, marginBottom: "10px" }}>
                <div style={{ fontSize: "10px", fontWeight: 700, color: theme.textLight, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "14px" }}>{RELATION_SECTION_LABELS.loseMostWith}</div>
                {americanoRelationStats.toughestPartners.map((p, i) => (
                  <div key={`tough-${p.userId}`} style={{ marginBottom: i < americanoRelationStats.toughestPartners.length - 1 ? "10px" : 0 }}>
                    <RelationRow
                      emoji={p.emoji}
                      name={p.name}
                      subtitle={`${p.asPartner.rounds} runder sammen`}
                      statValue={`${Math.round((1 - p.asPartner.wins / p.asPartner.rounds) * 100)}%`}
                      statColor={theme.warm}
                      statLabel="nederlag som makker"
                      avatarStyle={{ background: theme.warmBg, border: "1px solid " + theme.warm + "40" }}
                      onOpen={() => setViewPlayer({ id: p.userId, name: p.name, avatar: p.emoji })}
                    />
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
                    <div key={`hard-${p.userId}`} style={{ marginBottom: i < americanoRelationStats.hardestOpponents.length - 1 ? "10px" : 0 }}>
                      <RelationRow
                        emoji={p.emoji}
                        name={p.name}
                        subtitle={`${p.asOpponent.rounds} runder imod`}
                        statValue={`${theirWinPct}%`}
                        statColor={americanoOutcomeColors.loss.text}
                        statLabel="de vinder"
                        avatarStyle={{ background: theme.redBg, border: `1px solid ${theme.red}` }}
                        onOpen={() => setViewPlayer({ id: p.userId, name: p.name, avatar: p.emoji })}
                      />
                    </div>
                  );
                })}
              </div>
            )}
            {americanoRelationStats.easiestOpponents.length > 0 && (
              <div style={{ background: theme.surface, borderRadius: theme.radius, padding: "18px", boxShadow: theme.shadow, border: "1px solid " + theme.border, marginBottom: "16px" }}>
                <div style={{ fontSize: "10px", fontWeight: 700, color: theme.textLight, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "14px" }}>{RELATION_SECTION_LABELS.winMostAgainst}</div>
                {americanoRelationStats.easiestOpponents.map((p, i) => (
                  <div key={`easy-${p.userId}`} style={{ marginBottom: i < americanoRelationStats.easiestOpponents.length - 1 ? "10px" : 0 }}>
                    <RelationRow
                      emoji={p.emoji}
                      name={p.name}
                      subtitle={`${p.asOpponent.rounds} runder imod`}
                      statValue={`${Math.round((p.asOpponent.wins / p.asOpponent.rounds) * 100)}%`}
                      statColor={americanoOutcomeColors.win.text}
                      statLabel="din sejr"
                      avatarStyle={{ background: theme.accentBg, border: "1px solid " + theme.accent + "30" }}
                      onOpen={() => setViewPlayer({ id: p.userId, name: p.name, avatar: p.emoji })}
                    />
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
                  <div key={p.userId} style={{ marginBottom: i < ligaRelationStats.bestPartners.length - 1 ? "10px" : 0 }}>
                    <RelationRow
                      emoji={p.emoji}
                      name={p.name}
                      subtitle={`${p.asPartner.matches} kampe sammen`}
                      statValue={`${Math.round((p.asPartner.wins / p.asPartner.matches) * 100)}%`}
                      statColor={theme.green}
                      statLabel="sejr"
                      avatarStyle={{ background: theme.accentBg, border: "1px solid " + theme.accent + "30" }}
                      onOpen={() => setViewPlayer({ id: p.userId, name: p.name, avatar: p.emoji })}
                    />
                  </div>
                ))}
              </div>
            )}
            {ligaRelationStats.toughestPartners.length > 0 && (
              <div style={{ background: theme.surface, borderRadius: theme.radius, padding: "18px", boxShadow: theme.shadow, border: "1px solid " + theme.border, marginBottom: "10px" }}>
                <div style={{ fontSize: "10px", fontWeight: 700, color: theme.textLight, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "14px" }}>{RELATION_SECTION_LABELS.loseMostWith}</div>
                {ligaRelationStats.toughestPartners.map((p, i) => (
                  <div key={`liga-tough-${p.userId}`} style={{ marginBottom: i < ligaRelationStats.toughestPartners.length - 1 ? "10px" : 0 }}>
                    <RelationRow
                      emoji={p.emoji}
                      name={p.name}
                      subtitle={`${p.asPartner.matches} kampe sammen`}
                      statValue={`${Math.round((1 - p.asPartner.wins / p.asPartner.matches) * 100)}%`}
                      statColor={theme.warm}
                      statLabel="nederlag som makker"
                      avatarStyle={{ background: theme.warmBg, border: "1px solid " + theme.warm + "40" }}
                      onOpen={() => setViewPlayer({ id: p.userId, name: p.name, avatar: p.emoji })}
                    />
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
                    <div key={`liga-hard-${p.userId}`} style={{ marginBottom: i < ligaRelationStats.hardestOpponents.length - 1 ? "10px" : 0 }}>
                      <RelationRow
                        emoji={p.emoji}
                        name={p.name}
                        subtitle={`${p.asOpponent.matches} kampe imod`}
                        statValue={`${theirWinPct}%`}
                        statColor={theme.red}
                        statLabel="de vinder"
                        avatarStyle={{ background: theme.redBg, border: `1px solid ${theme.red}` }}
                        onOpen={() => setViewPlayer({ id: p.userId, name: p.name, avatar: p.emoji })}
                      />
                    </div>
                  );
                })}
              </div>
            )}
            {ligaRelationStats.easiestOpponents.length > 0 && (
              <div style={{ background: theme.surface, borderRadius: theme.radius, padding: "18px", boxShadow: theme.shadow, border: "1px solid " + theme.border, marginBottom: "16px" }}>
                <div style={{ fontSize: "10px", fontWeight: 700, color: theme.textLight, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "14px" }}>{RELATION_SECTION_LABELS.winMostAgainst}</div>
                {ligaRelationStats.easiestOpponents.map((p, i) => (
                  <div key={`liga-easy-${p.userId}`} style={{ marginBottom: i < ligaRelationStats.easiestOpponents.length - 1 ? "10px" : 0 }}>
                    <RelationRow
                      emoji={p.emoji}
                      name={p.name}
                      subtitle={`${p.asOpponent.matches} kampe imod`}
                      statValue={`${Math.round((p.asOpponent.wins / p.asOpponent.matches) * 100)}%`}
                      statColor={theme.green}
                      statLabel="din sejr"
                      avatarStyle={{ background: theme.accentBg, border: "1px solid " + theme.accent + "30" }}
                      onOpen={() => setViewPlayer({ id: p.userId, name: p.name, avatar: p.emoji })}
                    />
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        <div ref={actionsRef} style={{ fontSize: "10.5px", fontWeight: 700, color: theme.textLight, margin: "14px 18px 8px", textTransform: "uppercase", letterSpacing: "1.2px" }}>
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
              <div style={{ fontSize: "11px", color: theme.textLight }}>{TWO_V_TWO_ELO_LABEL} {elo}</div>
            </button>
          ) : null}
          {isAmericanoMode ? (
            <button onClick={() => { persistRankingModeForProfile("americano"); setTab("ranking"); }} style={{ background: theme.surface, borderRadius: theme.radius, padding: "16px", boxShadow: theme.shadow, border: "1px solid " + theme.border, cursor: "pointer", textAlign: "left", fontFamily: font }}>
              <Trophy size={18} color={theme.warm} />
              <div style={{ fontSize: "13px", fontWeight: 700, marginTop: "8px" }}>{TOURNAMENT_RANKING_LABEL}</div>
              <div style={{ fontSize: "11px", color: theme.textLight }}>{TOURNAMENT_ELO_LABEL} {americanoElo}</div>
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

        {/* Tilgængelighed */}
        {(() => {
          const chip = (active) => ({
            padding: '8px 13px', borderRadius: 999, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
            border: `1.5px solid ${active ? theme.navy : theme.border}`,
            background: active ? theme.navy : theme.surface,
            color: active ? 'var(--pm-on-accent)' : theme.textMid, fontFamily: 'inherit',
          });
          const avail = form.availability || [];
          const days = form.available_days || [];
          const toggleAvail = (a) => set('availability', avail.includes(a) ? avail.filter(x => x !== a) : [...avail, a]);
          const toggleDay = (d) => set('available_days', days.includes(d) ? days.filter(x => x !== d) : [...days, d]);
          return (
            <>
              <div style={labelStyle}>Hvornår kan du spille?</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                {AVAILABILITY.map((a) => (
                  <button key={a} type="button" onClick={() => toggleAvail(a)} style={chip(avail.includes(a))}>{a}</button>
                ))}
              </div>
              <div style={labelStyle}>Spilledage</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                {DAYS_OF_WEEK.map(({ key, label }) => (
                  <button key={key} type="button" onClick={() => toggleDay(key)} style={chip(days.includes(key))}>{label}</button>
                ))}
              </div>
            </>
          );
        })()}

        {/* Bio */}
        <label htmlFor="profil-bio" style={labelStyle}>Bio</label>
        <textarea id="profil-bio" value={form.bio} onChange={e => set("bio", e.target.value)} placeholder="Fortæl lidt om dig som spiller..." style={{ ...inputStyle, height: "80px", resize: "vertical", marginBottom: "20px" }} />

        <div
          data-tour="blocked-users-section"
          style={{
            marginTop: '20px',
            marginBottom: '12px',
            padding: '14px',
            borderRadius: theme.radius,
            border: `1px solid ${theme.border}`,
            background: theme.surfaceAlt,
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 700, color: theme.textLight, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
            Blokerede spillere
          </div>
          <p style={{ margin: '0 0 10px', fontSize: '13px', color: theme.textMid, lineHeight: 1.5 }}>
            Blokerede spillere kan ikke sende dig beskeder. Du kan også blokere fra en spillerprofil eller i chat.
          </p>
          {blockedLoading ? (
            <p style={{ margin: 0, fontSize: '13px', color: theme.textMid }}>Henter…</p>
          ) : blockedUsers.length === 0 ? (
            <p style={{ margin: 0, fontSize: '13px', color: theme.textMid }}>
              Du har ikke blokeret nogen endnu.
            </p>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {blockedUsers.map((b) => (
                <li
                  key={b.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    padding: '8px 10px',
                    borderRadius: 8,
                    background: theme.surface,
                    border: `1px solid ${theme.border}`,
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>{b.name}</span>
                  <button
                    type="button"
                    disabled={unblockingId === b.id}
                    onClick={async () => {
                      setUnblockingId(b.id);
                      try {
                        await unblockUser(b.id);
                        setBlockedUsers((prev) => prev.filter((x) => x.id !== b.id));
                        showToast?.(`${b.name} er ikke længere blokeret`, 'success');
                      } catch (e) {
                        showToast?.(e?.message || 'Kunne ikke fjerne blokering', 'error');
                      } finally {
                        setUnblockingId(null);
                      }
                    }}
                    style={{ ...btn(false), fontSize: 12, padding: '6px 10px', opacity: unblockingId === b.id ? 0.6 : 1 }}
                  >
                    {unblockingId === b.id ? 'Fjerner…' : 'Fjern blokering'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div
          data-tour="account-deletion-section"
          style={{
            marginBottom: '16px',
            padding: '14px',
            borderRadius: theme.radius,
            border: `1px solid ${theme.border}`,
            background: theme.surface,
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 700, color: theme.textLight, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
            Slet konto
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
      {viewPlayer && <PlayerProfileModal player={viewPlayer} onClose={() => setViewPlayer(null)} />}
    </div>
  );
}

