import { useState, useEffect, useCallback } from 'react';
import { Profile } from '../api/base44Client';
import { theme, btn, inputStyle, tag, heading } from '../lib/platformTheme';
import { REGIONS } from '../lib/platformConstants';
import { eloOf } from '../lib/matchDisplayUtils';
import { fetchEloStatsBatchByUserIds } from '../lib/eloHistoryUtils';
import { Search, MapPin } from 'lucide-react';
import { PlayerProfileModal } from './PlayerProfileModal';

export function MakkereTab({ user, showToast }) {
  const [search, setSearch]           = useState("");
  const [filterElo, setFilterElo]     = useState("all");
  const [filterArea, setFilterArea]   = useState("all");
  const [players, setPlayers]         = useState([]);
  /** elo_history-afledt stats pr. bruger (matcher profil-modal) */
  const [statsById, setStatsById]     = useState({});
  const [loading, setLoading]         = useState(true);
  const [viewPlayer, setViewPlayer]   = useState(null);

  const myElo = eloOf(user);

  const loadPlayers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await Profile.filter();
      const list = (data || []).filter((p) => p.id !== user.id);
      setPlayers(list);
      const ids = list.map((p) => p.id);
      const batch = await fetchEloStatsBatchByUserIds(ids);
      setStatsById(batch);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  useEffect(() => {
    loadPlayers();
  }, [loadPlayers]);

  const displayElo = (p) => {
    const s = statsById[String(p.id)];
    if (s != null) return s.elo;
    return eloOf(p);
  };
  const displayGames = (p) => {
    const s = statsById[String(p.id)];
    if (s != null) return s.games;
    return p.games_played || 0;
  };

  const filtered = players.filter(p => {
    const n = p.full_name || p.name || "";
    if (search && !n.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterArea !== "all" && p.area !== filterArea) return false;
    if (filterElo === "close" && Math.abs(displayElo(p) - myElo) > 150) return false;
    return true;
  });

  if (loading) return <div style={{ textAlign: "center", padding: "40px", color: theme.textLight, fontSize: "14px" }}>Indlæser spillere...</div>;

  return (
    <div>
      <h2 style={{ ...heading("clamp(20px,4.5vw,24px)"), marginBottom: "16px" }}>Find makker</h2>

      {/* Search */}
      <div style={{ position: "relative", marginBottom: "10px" }}>
        <Search size={15} color={theme.textLight} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Søg efter navn..." style={{ ...inputStyle, paddingLeft: "36px" }} />
      </div>

      <div style={{ display: "flex", gap: "8px", marginBottom: "20px", flexWrap: "wrap" }}>
        <select value={filterElo} onChange={e => setFilterElo(e.target.value)} style={{ ...inputStyle, width: "auto", padding: "8px 12px", fontSize: "13px" }}>
          <option value="all">Alle ELO</option>
          <option value="close">±150 ELO om dig ({myElo})</option>
        </select>
        <select value={filterArea} onChange={e => setFilterArea(e.target.value)} style={{ ...inputStyle, width: "auto", padding: "8px 12px", fontSize: "13px" }}>
          <option value="all">Alle regioner</option>
          {REGIONS.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {filtered.map(p => {
          const age = p.birth_year ? new Date().getFullYear() - p.birth_year : null;
          return (
          <div key={p.id} style={{ background: theme.surface, borderRadius: theme.radius, padding: "clamp(14px,3vw,18px)", boxShadow: theme.shadow, border: "1px solid " + theme.border }}>
            <div onClick={() => setViewPlayer(p)} style={{ display: "flex", gap: "14px", alignItems: "flex-start", cursor: "pointer" }}>
              <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "#F1F5F9", border: "1px solid " + theme.border, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", flexShrink: 0 }}>
                {p.avatar || "🎾"}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "4px" }}>
                  <span style={{ fontSize: "15px", fontWeight: 700, letterSpacing: "-0.01em" }}>{p.full_name || p.name}</span>
                  <span style={{ fontSize: "12px", color: theme.textLight, display: "flex", alignItems: "center", gap: "3px" }}><MapPin size={11} /> {p.area || "?"}</span>
                </div>
                <div style={{ display: "flex", gap: "5px", marginTop: "7px", flexWrap: "wrap" }}>
                  <span style={tag(theme.accentBg, theme.accent)}>ELO {displayElo(p)}</span>
                  {age && <span style={tag(theme.blueBg, theme.blue)}>{age} år</span>}
                  <span style={tag(theme.blueBg, theme.blue)}>{p.play_style || "?"}</span>
                  <span style={tag(theme.warmBg, theme.warm)}>{displayGames(p)} kampe</span>
                </div>
                {p.bio && <p style={{ fontSize: "12px", color: theme.textMid, marginTop: "8px", lineHeight: 1.5 }}>{p.bio}</p>}
              </div>
            </div>
            <div className="pm-makker-card-actions">
              <button onClick={() => setViewPlayer(p)} style={{ ...btn(false), padding: "7px 14px", fontSize: "12px" }}>
                👤 Se profil
              </button>
              <button onClick={() => showToast("Invitation sendt! 🎾")} style={{ ...btn(true), padding: "7px 14px", fontSize: "12px" }}>
                Invitér
              </button>
            </div>
          </div>
          );
        })}
        {filtered.length === 0 && <div style={{ textAlign: "center", padding: "48px 20px", color: theme.textLight }}><div style={{ fontSize: "32px", marginBottom: "12px" }}>🔍</div><div style={{ fontSize: "15px", fontWeight: 600, color: theme.text, marginBottom: "6px" }}>Ingen spillere fundet</div><div style={{ fontSize: "13px", lineHeight: 1.5 }}>Prøv at ændre filtre eller søg med et andet navn.</div></div>}
      </div>
      {viewPlayer && <PlayerProfileModal player={viewPlayer} onClose={() => setViewPlayer(null)} />}
    </div>
  );
}
