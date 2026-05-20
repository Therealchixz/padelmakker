import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { fetchMakkerePlayerProfiles } from '../lib/profileQueries';
import { theme, btn, inputStyle, tag, heading } from '../lib/platformTheme';
import { REGIONS, PLAY_STYLES, INTENTS, INTENT_LABELS, COURT_SIDES, SEEK_TTL_MS } from '../lib/platformConstants';
import { eloOf } from '../lib/matchDisplayUtils';
import { fetchEloStatsBatchByUserIds } from '../lib/eloHistoryUtils';
import { Search, MapPin, Zap, SlidersHorizontal } from 'lucide-react';
import { calcAge } from '../lib/profileUtils';
import { levelLabel } from '../lib/platformConstants';
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

const isSeekingActive = (p) =>
  p.seeking_match === true &&
  p.seeking_match_at != null &&
  Date.now() - new Date(p.seeking_match_at).getTime() < SEEK_TTL_MS;

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

function matchQuality(score) {
  if (score >= 80) return { label: 'Stærk match', color: '#15803D', bg: '#F0FDF4', border: '#86EFAC' };
  if (score >= 65) return { label: 'God match',   color: '#1D4ED8', bg: '#DBEAFE', border: '#93C5FD' };
  if (score >= 50) return { label: 'Okay match',  color: '#B45309', bg: '#FEF3C7', border: '#FCD34D' };
  return               { label: 'Mulig match',  color: '#6B7280', bg: '#F3F4F6', border: '#D1D5DB' };
}

function SuggestionCard({ suggestion, onView, onInvite }) {
  const { profile: p, score, breakdown, resolvedElo } = suggestion;
  const reason = matchReason(breakdown, p);
  const quality = matchQuality(score);

  return (
    <div style={{
      background: theme.surface,
      borderRadius: theme.radius,
      padding: '14px 16px',
      boxShadow: theme.shadow,
      border: `1px solid ${theme.border}`,
    }}>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <div onClick={() => onView(p)} style={{ cursor: 'pointer', flexShrink: 0 }}>
          <AvatarCircle
            avatar={p.avatar}
            size={46}
            emojiSize="22px"
            style={{ background: '#F1F5F9', border: '1px solid ' + theme.border }}
          />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <span
            onClick={() => onView(p)}
            style={{ fontSize: '14px', fontWeight: 700, cursor: 'pointer', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '5px' }}
          >
            {p.full_name || p.name}
          </span>

          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ ...tag(theme.accent, theme.onAccent), fontWeight: 800 }}>ELO {Math.round(Number(resolvedElo) || Number(p.elo_rating) || 1000)}</span>
            {(p.city || p.area) && (
              <span style={{ ...tag(theme.blueBg, theme.blue), display: 'flex', alignItems: 'center', gap: '2px' }}>
                <MapPin size={8} />{p.city || p.area.replace('Region ', '')}
              </span>
            )}
            {p.intent_now && INTENT_LABELS[p.intent_now] && (
              <span style={tag('#F0FDF4', '#15803D')}>{INTENT_LABELS[p.intent_now]}</span>
            )}
            {isSeekingActive(p) && (
              <span style={tag('#FEF3C7', '#B45309')}>Søger kamp</span>
            )}
          </div>
        </div>

        <button
          onClick={() => onInvite(p)}
          style={{ ...btn(true), padding: '7px 12px', fontSize: '12px', flexShrink: 0 }}
        >
          Invitér
        </button>
      </div>

      {/* Match-kvalitet — bundlinje */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        marginTop: '10px', paddingTop: '9px',
        borderTop: '1px solid ' + theme.border,
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
        <span style={{ fontSize: '11px', color: theme.textLight }}>·</span>
        <span style={{ fontSize: '11px', color: theme.textLight }}>{reason}</span>
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
    try {
      const data = await fetchMakkerePlayerProfiles();
      const list = (data || []).filter((p) => p.id !== user.id);
      setPlayers(list);
      const ids = list.map((p) => p.id);
      const batch = await fetchEloStatsBatchByUserIds(ids);
      setStatsById(batch);
    } catch (e) {
      console.error(e);
      showToast('Kunne ikke hente data. Tjek din forbindelse og prøv igen.');
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
    inviteStatsByUserId,
    exposureCountByUserId,
    pastMatchesByUserId,
    favoriteIds: favorites,
  }), [user, players, eloByUserId, inviteStatsByUserId, exposureCountByUserId, pastMatchesByUserId, favorites]);

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
    <div style={{ textAlign: 'center', padding: '40px', color: theme.textLight, fontSize: '14px' }}>
      Indlæser spillere...
    </div>
  );

  return (
    <div>
      <h2 style={{ ...heading('clamp(20px,4.5vw,24px)'), marginBottom: '16px' }}>Find makker</h2>

      {/* Foreslåede makkere */}
      {suggestions.length > 0 && (
        <div style={{ marginBottom: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Zap size={14} color={theme.accent} />
              <span style={{ fontSize: '12px', fontWeight: 700, color: theme.textLight, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Foreslåede makkere
              </span>
            </div>
            {suggestions.length > 3 && (
              <button
                onClick={() => setShowAllSuggestions(v => !v)}
                style={{ fontSize: '12px', color: theme.accent, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0 }}
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
      <div ref={seekingResultsRef} style={{ fontSize: '12px', fontWeight: 700, color: theme.textLight, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px', scrollMarginTop: '86px' }}>
        Alle spillere
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
          onClick={() => setShowFilters(v => !v)}
          style={{ ...btn(showFilters || activeFilterCount > 0), padding: '8px 12px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <SlidersHorizontal size={13} />
          Filtre
          {activeFilterCount > 0 && (
            <span style={{ background: showFilters ? 'rgba(255,255,255,0.3)' : theme.accent, color: '#fff', borderRadius: '10px', fontSize: '10px', fontWeight: 800, padding: '1px 6px', marginLeft: '2px' }}>
              {activeFilterCount}
            </span>
          )}
        </button>
        <button
          onClick={() => handleFilterChange(() => setFilterFav(f => !f))}
          style={{ ...btn(filterFav), padding: '8px 12px', fontSize: '13px' }}
        >
          {filterFav ? '★ Favoritter' : '☆ Favoritter'}
        </button>
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
        <div style={{ background: '#F8FAFC', borderRadius: '10px', border: '1px solid ' + theme.border, padding: '14px', marginBottom: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
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
            onClick={() => handleFilterChange(() => setFilterSeeking(v => !v))}
            style={{ ...btn(filterSeeking), padding: '8px 14px', fontSize: '13px', alignSelf: 'flex-start' }}
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
          const age = calcAge(p.birth_year, p.birth_month, p.birth_day);
          return (
            <div key={p.id} style={{ background: theme.surface, borderRadius: theme.radius, padding: 'clamp(14px,3vw,18px)', boxShadow: theme.shadow, border: '1px solid ' + theme.border }}>
              <div onClick={() => setViewPlayer(p)} style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', cursor: 'pointer' }}>
                <AvatarCircle
                  avatar={p.avatar}
                  size={48}
                  emojiSize="22px"
                  style={{ background: '#F1F5F9', border: '1px solid ' + theme.border }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                    <span style={{ fontSize: '15px', fontWeight: 700, letterSpacing: '-0.01em', wordBreak: 'break-word' }}>{p.full_name || p.name}</span>
                    <span style={{ fontSize: '12px', color: theme.textLight, display: 'flex', alignItems: 'center', gap: '3px' }}><MapPin size={11} /> {p.city ? `${p.city}` : (p.area || '?')}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '5px', marginTop: '7px', flexWrap: 'wrap' }}>
                    <span style={tag(theme.accentBg, theme.accent)}>ELO {displayElo(p)}</span>
                    {age && <span style={tag(theme.blueBg, theme.blue)}>{age} år</span>}
                    {p.level && <span style={tag(theme.accentBg, theme.accent)}>{levelLabel(p.level)}</span>}
                    <span style={tag(theme.blueBg, theme.blue)}>{p.play_style || '?'}</span>
                    {p.court_side && <span style={tag(theme.blueBg, theme.blue)}>{p.court_side}</span>}
                    <span style={tag(theme.warmBg, theme.warm)}>{displayGames(p)} kampe</span>
                    {isSeekingActive(p) && <span style={tag('#FEF3C7', '#B45309')}>Søger kamp</span>}
                  </div>
                  {p.bio && <PlayerBioPreview bio={p.bio} />}
                </div>
              </div>
              <div className="pm-makker-card-actions">
                <button
                  onClick={() => toggleFavorite(p.id)}
                  title={favorites.has(String(p.id)) ? 'Fjern fra favoritter' : 'Tilføj til favoritter'}
                  style={{ ...btn(false), padding: '7px 10px', fontSize: '14px' }}
                >
                  {favorites.has(String(p.id)) ? '★' : '☆'}
                </button>
                <button onClick={() => setViewPlayer(p)} style={{ ...btn(false), padding: '7px 14px', fontSize: '12px' }}>
                  👤 Se profil
                </button>
                <button onClick={() => navigate(`/dashboard/beskeder?med=${p.id}`)} style={{ ...btn(false), padding: '7px 14px', fontSize: '12px' }}>
                  Besked
                </button>
                <button onClick={() => setInviteTarget(p)} style={{ ...btn(true), padding: '7px 14px', fontSize: '12px' }}>
                  Invitér
                </button>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 20px', color: theme.textLight }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔍</div>
            <div style={{ fontSize: '15px', fontWeight: 600, color: theme.text, marginBottom: '6px' }}>Ingen spillere fundet</div>
            <div style={{ fontSize: '13px', lineHeight: 1.5 }}>Prøv at ændre filtre eller søg med et andet navn.</div>
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
