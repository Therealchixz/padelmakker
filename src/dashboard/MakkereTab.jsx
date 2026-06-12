import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { fetchMakkerePlayerProfiles } from '../lib/profileQueries';
import { theme, btn, inputStyle, tag, heading, makkerMatchBadge } from '../lib/platformTheme';
import { REGIONS, PLAY_STYLES, INTENTS, intentDisplayLabel, COURT_SIDES } from '../lib/platformConstants';
import { isSeekingActiveProfile } from '../lib/seekingFeedTtl';
import { eloOf } from '../lib/matchDisplayUtils';
import { fetchEloStatsBatchByUserIds } from '../lib/eloHistoryUtils';
import { Search, MapPin, Zap, SlidersHorizontal } from 'lucide-react';
import { calcAge } from '../lib/profileUtils';
import { formatPlaytomicLevel } from '../lib/padelLevelUtils';
import { PlayerProfileModal } from './PlayerProfileModal';
import { InviteToMatchModal } from './InviteToMatchModal';
import { AvatarCircle } from '../components/AvatarCircle';
import { supabase } from '../lib/supabase';
import { getMatchSuggestions, matchReason } from '../lib/matchmakingUtils';
import {
  getMatchmakingSignalMaps,
  getPendingInviteChecks,
  markInvitesAccepted,
  recordInviteSent,
  recordSuggestionExposure,
} from '../lib/matchmakingTelemetry';
import { seekingActivityLabelDisplay } from '../lib/seekingActivityLabel';
import {
  normalizeMakkerSearchPrefs,
  isMakkerFilterActive,
  countSeekersMatchingMakkerFilter,
} from '../lib/makkerSearchFilterUtils';
import { ActiveSeekingPanel } from '../components/ActiveSeekingPanel';
import { PillTabs } from '../components/PillTabs';
import { FILTER_RETURN_MAKKERE } from '../lib/filterReturnNavigation';

const isSeekingActive = (p) => isSeekingActiveProfile(p);

/** Maks. synlige linjer før "Vis mere" på Find makker-kort. */
const BIO_COLLAPSED_LINES = 3;
/** Lange tekster uden linjeskift foldes også ud ved tegn-grænse. */
const BIO_COLLAPSE_MIN_CHARS = 200;

/** Fjerner tomme linjer fra textarea (\\n\\n) så udfoldet tekst ikke får “blank” mellemrum. */
function normalizeBioParagraphs(text) {
  return String(text || '')
    .trim()
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function bioNeedsCollapse(paragraphs) {
  if (!paragraphs.length) return false;
  const joined = paragraphs.join('\n');
  if (joined.length >= BIO_COLLAPSE_MIN_CHARS) return true;
  return paragraphs.length > BIO_COLLAPSED_LINES;
}

function PlayerBioPreview({ bio }) {
  const [expanded, setExpanded] = useState(false);
  const paragraphs = normalizeBioParagraphs(bio);
  if (!paragraphs.length) return null;

  const collapsible = bioNeedsCollapse(paragraphs);

  return (
    <div
      style={{ marginTop: '8px' }}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div
        style={{
          fontSize: '12px',
          color: theme.textMid,
          lineHeight: 1.5,
          wordBreak: 'break-word',
          ...(collapsible && !expanded
            ? {
                display: '-webkit-box',
                WebkitLineClamp: BIO_COLLAPSED_LINES,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }
            : {}),
        }}
      >
        {paragraphs.map((part, index) => (
          <p
            key={index}
            style={{
              margin: 0,
              marginTop: index === 0 ? 0 : '6px',
            }}
          >
            {part}
          </p>
        ))}
      </div>
      {collapsible && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
          style={{
            marginTop: '6px',
            padding: 0,
            border: 'none',
            background: 'none',
            color: theme.accent,
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            textDecoration: 'underline',
            textUnderlineOffset: '2px',
          }}
        >
          {expanded ? 'Vis mindre' : 'Vis mere'}
        </button>
      )}
    </div>
  );
}

function favoritesKeyForUser(userId) {
  return userId != null && String(userId).trim() !== ''
    ? `pm_favorites_${String(userId)}`
    : null;
}

function readFavoritesSet(userId) {
  const key = favoritesKeyForUser(userId);
  if (!key) return new Set();
  try {
    return new Set(JSON.parse(localStorage.getItem(key) || '[]'));
  } catch {
    return new Set();
  }
}

function writeFavoritesSet(userId, set) {
  const key = favoritesKeyForUser(userId);
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify([...set]));
  } catch {
    /* quota */
  }
}

// ----- Suggested player card -----

function SuggestionCard({ suggestion, onView, onInvite, displayEloFor }) {
  const { profile: p, score, breakdown } = suggestion;
  const reason = matchReason(breakdown, p);
  const quality = makkerMatchBadge(score);

  return (
    <div className="pm-ui-card" style={{ padding: '14px 16px', margin: '0 18px' }}>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
        <div onClick={() => onView(p)} style={{ cursor: 'pointer', flexShrink: 0 }}>
          <AvatarCircle
            avatar={p.avatar}
            size={50}
            emojiSize="16px"
            style={{ background: theme.surfaceAlt, border: '1px solid ' + theme.border }}
          />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span
              onClick={() => onView(p)}
              style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.2px', cursor: 'pointer' }}
            >
              {p.full_name || p.name}
            </span>
            {p.level != null && p.level !== '' && (
              <span style={tag(theme.amberBg, theme.amberText)}>Niveau {formatPlaytomicLevel(p.level)}</span>
            )}
          </div>
          <div style={{ fontSize: 12, color: theme.textLight, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
            <MapPin size={10} />
            {[p.city || (p.area ? p.area.replace('Region ', '') : null), p.games_played ? `${p.games_played} kampe` : null].filter(Boolean).join(' · ')}
          </div>
        </div>
      </div>

      {/* Match-kvalitet + handlinger */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginTop: '11px', paddingTop: '11px',
        borderTop: '1px solid ' + theme.border,
        gap: 8,
      }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: '5px',
          background: quality.bg, color: quality.color,
          border: '1px solid ' + quality.border,
          borderRadius: '6px', padding: '3px 8px',
          fontSize: '11px', fontWeight: 700,
          whiteSpace: 'nowrap', flexShrink: 0,
        }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: quality.color, flexShrink: 0 }} />
          {quality.label}
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => onView(p)} style={{ ...btn(false), padding: '7px 12px', fontSize: '12px' }}>
            Profil
          </button>
          <button onClick={() => onInvite(p)} style={{ ...btn(true), padding: '7px 12px', fontSize: '12px' }}>
            Invitér
          </button>
        </div>
      </div>
    </div>
  );
}

// ----- Hoved-komponent -----

export function MakkereTab({ user, showToast }) {
  const navigate = useNavigate();
  const location = useLocation();
  const shouldShowSeekingFromUrl = useMemo(
    () => new URLSearchParams(location.search).get('seeking') === '1',
    [location.search]
  );
  const [search, setSearch]           = useState('');
  const [filterElo, setFilterElo]     = useState('all');
  const [filterArea, setFilterArea]   = useState('all');
  const [filterStyle, setFilterStyle] = useState('all');
  const [filterIntent, setFilterIntent] = useState('all');
  const [filterCourtSide, setFilterCourtSide] = useState('all');
  const [filterSeeking, setFilterSeeking] = useState(() => shouldShowSeekingFromUrl);
  const [filterFav, setFilterFav]     = useState(false);
  const [showFilters, setShowFilters] = useState(() => shouldShowSeekingFromUrl);
  const [players, setPlayers]         = useState([]);
  const [statsById, setStatsById]     = useState({});
  const [loading, setLoading]         = useState(true);
  const [loadError, setLoadError]     = useState(null);
  const [page, setPage]               = useState(0);
  const [viewPlayer, setViewPlayer]   = useState(null);
  const [inviteTarget, setInviteTarget] = useState(null);
  const [favorites, setFavorites]     = useState(() => readFavoritesSet(user?.id));
  const [showAllSuggestions, setShowAllSuggestions] = useState(false);
  const [telemetryVersion, setTelemetryVersion] = useState(0);
  /** Aggregeret kamp-historik mod hver anden spiller — fodres til matchmakingen
      for at booste skjul-makker-kemi og fair-modstander-match. */
  const [pastMatchesByUserId, setPastMatchesByUserId] = useState({});
  const seekingResultsRef = useRef(null);
  const hasScrolledToSeekingRef = useRef(false);

  const myElo = eloOf(user);
  const makkerFilterPrefs = useMemo(
    () => normalizeMakkerSearchPrefs(user?.makker_search_prefs, user),
    [user],
  );
  const makkerFilterOn = isMakkerFilterActive(makkerFilterPrefs, user);
  const [filterSeekerCount, setFilterSeekerCount] = useState(null);

  useEffect(() => {
    if (!user?.id || !makkerFilterOn) {
      setFilterSeekerCount(null);
      return;
    }
    let cancelled = false;
    countSeekersMatchingMakkerFilter(user, makkerFilterPrefs, user.id)
      .then((n) => { if (!cancelled) setFilterSeekerCount(n); })
      .catch(() => { if (!cancelled) setFilterSeekerCount(0); });
    return () => { cancelled = true; };
  }, [user, makkerFilterPrefs, makkerFilterOn]);

  useEffect(() => {
    const pid = new URLSearchParams(location.search).get('profile');
    if (!pid || players.length === 0) return;
    const p = players.find((row) => String(row.id) === String(pid));
    if (p) setViewPlayer(p);
  }, [location.search, players]);

  useEffect(() => {
    if (!shouldShowSeekingFromUrl) return;
    setFilterSeeking(true);
    setShowFilters(true);
    setPage(0);
  }, [shouldShowSeekingFromUrl]);

  useEffect(() => {
    if (!shouldShowSeekingFromUrl) {
      hasScrolledToSeekingRef.current = false;
      return undefined;
    }
    if (loading || hasScrolledToSeekingRef.current) return undefined;

    hasScrolledToSeekingRef.current = true;
    const timerId = window.setTimeout(() => {
      seekingResultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);

    return () => window.clearTimeout(timerId);
  }, [shouldShowSeekingFromUrl, loading]);

  useEffect(() => {
    setFavorites(readFavoritesSet(user.id));
    setFilterFav(false);
  }, [user.id, showToast]);

  const toggleFavorite = (playerId) => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(String(playerId))) next.delete(String(playerId));
      else next.add(String(playerId));
      writeFavoritesSet(user.id, next);
      return next;
    });
  };

  const loadPlayers = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await fetchMakkerePlayerProfiles();
      const list = (data || []).filter((p) => p.id !== user.id);
      setPlayers(list);
      const ids = list.map((p) => p.id);
      const batch = await fetchEloStatsBatchByUserIds(ids);
      setStatsById(batch);
    } catch (e) {
      console.error(e);
      const msg = 'Kunne ikke hente spillere. Tjek din forbindelse og prøv igen.';
      setLoadError(msg);
      showToast(msg);
    } finally {
      setLoading(false);
    }
  }, [user.id, showToast]);

  useEffect(() => {
    loadPlayers();
  }, [loadPlayers]);

  /* Hent kamp-historik mod alle andre spillere én gang ved load.
     Bruges af matchmakingen til at booste makker-kemi og fair modstander-match. */
  useEffect(() => {
    if (!user?.id) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const { data: myRows } = await supabase
          .from('match_players')
          .select('match_id, team')
          .eq('user_id', user.id);
        const matchIds = [...new Set((myRows || []).map((r) => String(r.match_id)).filter(Boolean))];
        if (matchIds.length === 0) {
          if (!cancelled) setPastMatchesByUserId({});
          return;
        }
        const myTeamByMatch = {};
        for (const row of myRows || []) {
          myTeamByMatch[String(row.match_id)] = Number(row.team);
        }
        const [{ data: allPlayers }, { data: results }] = await Promise.all([
          supabase
            .from('match_players')
            .select('match_id, user_id, team')
            .in('match_id', matchIds),
          supabase
            .from('match_results')
            .select('match_id, match_winner, confirmed')
            .in('match_id', matchIds)
            .eq('confirmed', true),
        ]);
        const winnerByMatch = {};
        for (const r of results || []) {
          if (r?.match_winner === 'team1' || r?.match_winner === 'team2') {
            winnerByMatch[String(r.match_id)] = r.match_winner === 'team1' ? 1 : 2;
          }
        }
        /** map: otherUserId → { asTeammate, winsAsTeammate, asOpponent, winsAgainst } */
        const map = {};
        for (const row of allPlayers || []) {
          const otherId = String(row.user_id);
          if (otherId === String(user.id)) continue;
          const mid = String(row.match_id);
          const myTeam = myTeamByMatch[mid];
          const theirTeam = Number(row.team);
          if (!myTeam || !theirTeam) continue;
          const entry = map[otherId] || { asTeammate: 0, winsAsTeammate: 0, asOpponent: 0, winsAgainst: 0 };
          const winnerTeam = winnerByMatch[mid] || null;
          if (myTeam === theirTeam) {
            entry.asTeammate += 1;
            if (winnerTeam === myTeam) entry.winsAsTeammate += 1;
          } else {
            entry.asOpponent += 1;
            if (winnerTeam === myTeam) entry.winsAgainst += 1;
          }
          map[otherId] = entry;
        }
        if (!cancelled) setPastMatchesByUserId(map);
      } catch (err) {
        console.warn('Kunne ikke hente kamp-historik for matchmaking:', err?.message || err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const displayElo = useCallback((player) => {
    const stats = statsById[String(player.id)];
    return stats != null ? stats.elo : eloOf(player);
  }, [statsById]);

  const displayGames = useCallback((player) => {
    const stats = statsById[String(player.id)];
    return stats != null ? stats.games : (player.games_played || 0);
  }, [statsById]);

  const eloByUserId = useMemo(() => {
    const map = {};
    players.forEach((player) => {
      map[String(player.id)] = displayElo(player);
    });
    map[String(user.id)] = Number.isFinite(Number(myElo)) ? Number(myElo) : 1000;
    return map;
  }, [players, displayElo, user.id, myElo]);

  const gamesByUserId = useMemo(() => {
    const map = {};
    for (const [id, stats] of Object.entries(statsById)) {
      if (stats != null && Number.isFinite(Number(stats.games))) {
        map[id] = Number(stats.games);
      }
    }
    return map;
  }, [statsById]);

  const { exposureCountByUserId, inviteStatsByUserId } = useMemo(
    () => {
      void telemetryVersion;
      return getMatchmakingSignalMaps(user.id);
    },
    [user.id, telemetryVersion]
  );

  // Matchmaking-forslag (beregnes client-side paa allerede-hentede spillere)
  const suggestions = useMemo(() => getMatchSuggestions(user, players, {
    limit: 10,
    eloByUserId,
    gamesByUserId,
    inviteStatsByUserId,
    exposureCountByUserId,
    pastMatchesByUserId,
    favoriteIds: favorites,
  }), [user, players, eloByUserId, gamesByUserId, inviteStatsByUserId, exposureCountByUserId, pastMatchesByUserId, favorites]);

  const visibleSuggestions = useMemo(
    () => (showAllSuggestions ? suggestions : suggestions.slice(0, 3)),
    [showAllSuggestions, suggestions]
  );

  useEffect(() => {
    if (!user?.id || visibleSuggestions.length === 0) return;
    const candidateIds = visibleSuggestions
      .map((item) => item?.profile?.id)
      .filter(Boolean);
    if (candidateIds.length === 0) return;
    recordSuggestionExposure(user.id, candidateIds);
  }, [user?.id, visibleSuggestions]);

  useEffect(() => {
    if (!user?.id) return undefined;
    let disposed = false;

    const syncAcceptedInvites = async () => {
      const pendingPairs = getPendingInviteChecks(user.id);
      if (!pendingPairs.length) return;

      const matchIds = [...new Set(pendingPairs.map((pair) => String(pair.matchId || '')).filter(Boolean))];
      const candidateIds = [...new Set(pendingPairs.map((pair) => String(pair.candidateId || '')).filter(Boolean))];
      if (!matchIds.length || !candidateIds.length) return;

      const { data, error } = await supabase
        .from('match_players')
        .select('match_id, user_id')
        .in('match_id', matchIds)
        .in('user_id', candidateIds)
        .limit(5000);

      if (error) {
        console.warn('syncAcceptedInvites:', error.message || error);
        return;
      }

      const joinedPairs = new Set(
        (data || []).map((row) => `${String(row.match_id)}:${String(row.user_id)}`)
      );
      const acceptedPairs = pendingPairs.filter((pair) =>
        joinedPairs.has(`${String(pair.matchId)}:${String(pair.candidateId)}`)
      );

      const changed = markInvitesAccepted(user.id, acceptedPairs);
      if (changed && !disposed) setTelemetryVersion((prev) => prev + 1);
    };

    void syncAcceptedInvites();
    const timerId = window.setInterval(() => {
      void syncAcceptedInvites();
    }, 60000);

    return () => {
      disposed = true;
      window.clearInterval(timerId);
    };
  }, [user?.id]);

  // Filtrer til browse-listen
  const filtered = players.filter(p => {
    const n = p.full_name || p.name || '';
    const c = p.city || '';
    if (search && !n.toLowerCase().includes(search.toLowerCase()) && !c.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterArea !== 'all' && p.area !== filterArea) return false;
    if (filterElo === 'close' && Math.abs(displayElo(p) - myElo) > 150) return false;
    if (filterStyle !== 'all' && p.play_style !== filterStyle) return false;
    if (filterIntent !== 'all' && p.intent_now !== filterIntent) return false;
    if (filterCourtSide !== 'all' && p.court_side !== filterCourtSide) return false;
    if (filterSeeking && !isSeekingActive(p)) return false;
    if (filterFav && !favorites.has(String(p.id))) return false;
    return true;
  });

  const activeFilterCount = [
    filterElo !== 'all', filterArea !== 'all', filterStyle !== 'all',
    filterIntent !== 'all', filterCourtSide !== 'all', filterSeeking, filterFav,
  ].filter(Boolean).length;

  const PAGE_SIZE = 20;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const paginated = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const handleFilterChange = (fn) => { fn(); setPage(0); };
  const handleInviteSent = useCallback(({ candidateId, matchId }) => {
    const changed = recordInviteSent(user.id, { candidateId, matchId });
    if (changed) setTelemetryVersion((prev) => prev + 1);
  }, [user.id]);

  if (loading) return (
    <div className="pm-state-card pm-state-card--loading" style={{ marginBottom: '14px' }}>
      <div className="pm-spinner pm-state-spinner" />
      <div className="pm-state-title">Indlæser spillere…</div>
      <div className="pm-state-copy">Vi henter spillere du kan finde som makker.</div>
    </div>
  );

  return (
    <div>
      {/* Topbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px 8px' }}>
        <h2 style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-0.3px', color: theme.text, margin: 0 }}>Find makker</h2>
      </div>

      <ActiveSeekingPanel
        variant="compact"
        channel="makker"
        user={user}
        showToast={showToast}
        filterReturnTo={FILTER_RETURN_MAKKERE}
      />

      {loadError ? (
        <div className="pm-state-card pm-state-card--error" style={{ marginBottom: '16px' }}>
          <div className="pm-state-icon" aria-hidden="true">⚠️</div>
          <div className="pm-state-title">Kunne ikke hente spillere</div>
          <div className="pm-state-copy">{loadError}</div>
          <div className="pm-state-actions">
            <button type="button" onClick={() => void loadPlayers()} style={{ ...btn(true), fontSize: '13px' }}>
              Prøv igen
            </button>
          </div>
        </div>
      ) : null}

      {makkerFilterOn && filterSeekerCount != null && filterSeekerCount > 0 && (
        <button
          type="button"
          onClick={() => {
            setFilterSeeking(true);
            setShowFilters(true);
            setPage(0);
            seekingResultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}
          style={{
            width: '100%',
            textAlign: 'left',
            background: theme.blueBg,
            border: `1px solid ${theme.accent}`,
            borderRadius: 10,
            padding: '12px 14px',
            marginBottom: 16,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: theme.text }}>
            {filterSeekerCount} {filterSeekerCount === 1 ? 'spiller' : 'spillere'} matcher dit makker-filter
          </div>
          <div style={{ fontSize: 11, color: theme.textMid, marginTop: 4 }}>
            Vis spillere der søger makker nu
          </div>
        </button>
      )}

      {/* Foreslåede makkere */}
      {suggestions.length > 0 && (
        <div style={{ marginBottom: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '8px 18px 10px' }}>
            <h3 style={{ fontSize: 15.5, fontWeight: 600, letterSpacing: '-0.2px', color: theme.text, margin: 0 }}>Foreslåede makkere</h3>
            {suggestions.length > 3 && (
              <button
                onClick={() => setShowAllSuggestions(v => !v)}
                style={{ fontSize: '12.5px', color: theme.accent, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0 }}
              >
                {showAllSuggestions ? 'Vis færre' : `Se alle ${suggestions.length}`}
              </button>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {visibleSuggestions.map(s => (
              <SuggestionCard
                key={s.profile.id}
                suggestion={s}
                displayEloFor={displayElo}
                onView={setViewPlayer}
                onInvite={setInviteTarget}
              />
            ))}
          </div>
        </div>
      )}

      {/* Divider */}
      <div style={{ borderTop: '1px solid ' + theme.border, marginBottom: '20px' }} />

      {/* Browse / søg alle */}
      <div ref={seekingResultsRef} style={{ margin: '0 18px 12px', scrollMarginTop: '86px' }}>
        <h3 style={{ fontSize: 15.5, fontWeight: 600, letterSpacing: '-0.2px', color: theme.text, margin: 0 }}>Alle spillere</h3>
      </div>

      <div style={{ position: 'relative', marginBottom: '10px' }}>
        <Search size={15} color={theme.textLight} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
        <input
          value={search}
          onChange={e => handleFilterChange(() => setSearch(e.target.value))}
          placeholder="Søg efter navn eller by..."
          style={{ ...inputStyle, paddingLeft: '36px' }}
        />
      </div>

      {/* Filterknap + aktive filtre */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          className={`pm-ui-btn-chip ${showFilters || activeFilterCount > 0 ? 'pm-ui-btn-chip-active' : ''}`}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', fontSize: '13px' }}
        >
          <SlidersHorizontal size={13} />
          Filtre
          {activeFilterCount > 0 && (
            <span
              style={{
                background: showFilters || activeFilterCount > 0 ? 'color-mix(in srgb, var(--pm-on-accent) 30%, transparent)' : theme.accent,
                color: theme.onAccent,
                borderRadius: '10px',
                fontSize: '10px',
                fontWeight: 800,
                padding: '1px 6px',
                marginLeft: '2px',
              }}
            >
              {activeFilterCount}
            </span>
          )}
        </button>
        <PillTabs
          tabs={[
            { id: 'all', label: 'Alle spillere' },
            { id: 'fav', label: '★ Favoritter' },
          ]}
          value={filterFav ? 'fav' : 'all'}
          onChange={(id) => handleFilterChange(() => setFilterFav(id === 'fav'))}
          ariaLabel="Vis favoritter"
          size="sm"
          style={{ width: 'auto', flex: '1 1 200px', maxWidth: '320px' }}
        />
        {activeFilterCount > 0 && (
          <button
            onClick={() => { setFilterElo('all'); setFilterArea('all'); setFilterStyle('all'); setFilterIntent('all'); setFilterCourtSide('all'); setFilterSeeking(false); setFilterFav(false); setPage(0); }}
            style={{ fontSize: '12px', color: theme.red, background: 'none', border: 'none', cursor: 'pointer', padding: '4px', fontWeight: 600 }}
          >
            Nulstil filtre
          </button>
        )}
      </div>

      {showFilters && (
        <div className="pm-filter-panel">
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <select value={filterElo} onChange={e => handleFilterChange(() => setFilterElo(e.target.value))} style={{ ...inputStyle, width: 'auto', padding: '8px 12px', fontSize: '13px', flex: '1 1 140px' }}>
              <option value="all">Alle ELO-niveauer</option>
              <option value="close">±150 ELO om dig ({myElo})</option>
            </select>
            <select value={filterArea} onChange={e => handleFilterChange(() => setFilterArea(e.target.value))} style={{ ...inputStyle, width: 'auto', padding: '8px 12px', fontSize: '13px', flex: '1 1 140px' }}>
              <option value="all">Alle regioner</option>
              {REGIONS.map((r) => <option key={r} value={r}>{r.replace('Region ', '')}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <select value={filterStyle} onChange={e => handleFilterChange(() => setFilterStyle(e.target.value))} style={{ ...inputStyle, width: 'auto', padding: '8px 12px', fontSize: '13px', flex: '1 1 140px' }}>
              <option value="all">Alle spillestile</option>
              {PLAY_STYLES.filter(s => s !== 'Ved ikke endnu').map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={filterIntent} onChange={e => handleFilterChange(() => setFilterIntent(e.target.value))} style={{ ...inputStyle, width: 'auto', padding: '8px 12px', fontSize: '13px', flex: '1 1 140px' }}>
              <option value="all">Alle intentioner</option>
              {INTENTS.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <select value={filterCourtSide} onChange={e => handleFilterChange(() => setFilterCourtSide(e.target.value))} style={{ ...inputStyle, width: 'auto', padding: '8px 12px', fontSize: '13px', flex: '1 1 140px' }}>
              <option value="all">Alle bandesider</option>
              {COURT_SIDES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <button
            type="button"
            onClick={() => handleFilterChange(() => setFilterSeeking((v) => !v))}
            className={`pm-ui-btn-chip ${filterSeeking ? 'pm-ui-btn-chip-active' : ''}`}
            style={{ padding: '8px 14px', fontSize: '13px', alignSelf: 'flex-start' }}
          >
            ⚡ {filterSeeking ? 'Kun søgende spillere' : 'Vis kun søgende spillere'}
          </button>
        </div>
      )}


      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', fontSize: '13px', color: theme.textMid }}>
          <span>{filtered.length} spillere · side {safePage + 1} af {totalPages}</span>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {paginated.map(p => {
          return (
            <div key={p.id} style={{ background: theme.surface, borderRadius: theme.radius, padding: '14px 16px', boxShadow: theme.shadow, border: '1px solid ' + theme.border }}>
              <div onClick={() => setViewPlayer(p)} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', cursor: 'pointer' }}>
                <AvatarCircle
                  avatar={p.avatar}
                  size={50}
                  emojiSize="16px"
                  style={{ background: theme.surfaceAlt, border: '1px solid ' + theme.border, flexShrink: 0 }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.2px' }}>{p.full_name || p.name}</span>
                    {p.level != null && p.level !== '' && (
                      <span style={tag(theme.amberBg, theme.amberText)}>Niveau {formatPlaytomicLevel(p.level)}</span>
                    )}
                    {isSeekingActive(p) && (
                      <span style={tag(theme.greenBg, theme.green)}>{seekingActivityLabelDisplay(p)}</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: theme.textLight, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <MapPin size={10} />
                    {[p.city || p.area, `${displayGames(p)} kampe`, p.court_side].filter(Boolean).join(' · ')}
                  </div>
                  {p.bio && <PlayerBioPreview bio={p.bio} />}
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: 11, paddingTop: 11, borderTop: '1px solid ' + theme.border }}>
                <button
                  onClick={() => toggleFavorite(p.id)}
                  title={favorites.has(String(p.id)) ? 'Fjern fra favoritter' : 'Tilføj til favoritter'}
                  style={{ ...btn(false), padding: '8px 11px', fontSize: '14px' }}
                >
                  {favorites.has(String(p.id)) ? '★' : '☆'}
                </button>
                <button onClick={() => navigate(`/dashboard/beskeder?med=${p.id}`)} style={{ ...btn(false), padding: '8px 14px', fontSize: '12px' }}>
                  Besked
                </button>
                <button onClick={() => setInviteTarget(p)} style={{ ...btn(true), padding: '8px 14px', fontSize: '12px' }}>
                  Invitér
                </button>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && !loadError && (
          <div style={{ textAlign: 'center', padding: '48px 20px', color: theme.textLight }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔍</div>
            <div style={{ fontSize: '15px', fontWeight: 600, color: theme.text, marginBottom: '6px' }}>
              {activeFilterCount > 0 ? 'Ingen spillere matcher dine filtre' : 'Ingen spillere at vise'}
            </div>
            <div style={{ fontSize: '13px', lineHeight: 1.5 }}>
              {activeFilterCount > 0
                ? 'Prøv at ændre filtre eller søg med et andet navn.'
                : 'Der er endnu få spillere i dit område — prøv at udvide region eller niveau under filter.'}
            </div>
            {activeFilterCount === 0 && (
              <button
                type="button"
                onClick={() => navigate('/dashboard/makker-filter')}
                style={{ ...btn(true), marginTop: '14px', fontSize: '13px' }}
              >
                Åbn filter
              </button>
            )}
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', marginTop: '16px' }}>
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={safePage === 0}
            style={{ ...btn(false), padding: '8px 18px', fontSize: '13px', opacity: safePage === 0 ? 0.35 : 1 }}
          >
            ← Forrige
          </button>
          <span style={{ fontSize: '13px', color: theme.textMid, fontWeight: 600 }}>
            {safePage + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={safePage === totalPages - 1}
            style={{ ...btn(false), padding: '8px 18px', fontSize: '13px', opacity: safePage === totalPages - 1 ? 0.35 : 1 }}
          >
            Næste →
          </button>
        </div>
      )}

      {viewPlayer && (
        <PlayerProfileModal
          player={viewPlayer}
          onClose={() => setViewPlayer(null)}
          onMessage={() => { setViewPlayer(null); navigate(`/dashboard/beskeder?med=${viewPlayer.id}`); }}
          onInviteMatch={() => { const p = viewPlayer; setViewPlayer(null); setInviteTarget(p); }}
        />
      )}
      {inviteTarget && (
        <InviteToMatchModal
          invitee={inviteTarget}
          currentUser={user}
          showToast={showToast}
          onInviteSent={handleInviteSent}
          onClose={() => setInviteTarget(null)}
        />
      )}
    </div>
  );
}
