import { useState, useEffect, useCallback } from 'react';

const SEEK_TTL_MS = 24 * 60 * 60 * 1000;
const isSeekingActive = (p) =>
  p.seeking_match === true &&
  p.seeking_match_at != null &&
  Date.now() - new Date(p.seeking_match_at).getTime() < SEEK_TTL_MS;
import { useNavigate } from 'react-router-dom';
import { Profile } from '../api/base44Client';
import { theme, btn, inputStyle, tag, heading } from '../lib/platformTheme';
import { REGIONS, PLAY_STYLES, INTENTS, INTENT_LABELS, COURT_SIDES } from '../lib/platformConstants';
import { eloOf } from '../lib/matchDisplayUtils';
import { fetchEloStatsBatchByUserIds } from '../lib/eloHistoryUtils';
import { Search, MapPin, Zap, SlidersHorizontal } from 'lucide-react';
import { calcAge } from '../lib/profileUtils';
import { levelLabel } from '../lib/platformConstants';
import { PlayerProfileModal } from './PlayerProfileModal';
import { InviteToMatchModal } from './InviteToMatchModal';
import { AvatarCircle } from '../components/AvatarCircle';
import { getMatchSuggestions, matchReason } from '../lib/matchmakingUtils';

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
  const { profile: p, score, breakdown } = suggestion;
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
            <span style={tag(theme.accentBg, theme.accent)}>ELO {Math.round(Number(p.elo_rating) || 1000)}</span>
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
  const [search, setSearch]           = useState('');
  const [filterElo, setFilterElo]     = useState('all');
  const [filterArea, setFilterArea]   = useState('all');
  const [filterStyle, setFilterStyle] = useState('all');
  const [filterIntent, setFilterIntent] = useState('all');
  const [filterCourtSide, setFilterCourtSide] = useState('all');
  const [filterSeeking, setFilterSeeking] = useState(false);
  const [filterFav, setFilterFav]     = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [players, setPlayers]         = useState([]);
  const [statsById, setStatsById]     = useState({});
  const [loading, setLoading]         = useState(true);
  const [page, setPage]               = useState(0);
  const [viewPlayer, setViewPlayer]   = useState(null);
  const [inviteTarget, setInviteTarget] = useState(null);
  const [favorites, setFavorites]     = useState(() => readFavoritesSet(user?.id));
  const [showAllSuggestions, setShowAllSuggestions] = useState(false);

  const myElo = eloOf(user);

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
      const data = await Profile.filter({ is_banned: false });
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

  const displayElo = (p) => {
    const s = statsById[String(p.id)];
    return s != null ? s.elo : eloOf(p);
  };
  const displayGames = (p) => {
    const s = statsById[String(p.id)];
    return s != null ? s.games : (p.games_played || 0);
  };

  // Matchmaking-forslag (beregnes client-side på allerede-hentede spillere)
  const suggestions = getMatchSuggestions(user, players, { limit: 10 });
  const visibleSuggestions = showAllSuggestions ? suggestions : suggestions.slice(0, 3);

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
      <div style={{ fontSize: '12px', fontWeight: 700, color: theme.textLight, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>
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
                  {p.bio && <p style={{ fontSize: '12px', color: theme.textMid, marginTop: '8px', lineHeight: 1.5 }}>{p.bio}</p>}
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
          onClose={() => setInviteTarget(null)}
        />
      )}
    </div>
  );
}
