import { useState, useEffect } from 'react';
import { Court, CourtSlot, Booking } from '../api/base44Client';
import { font, theme, btn, inputStyle, tag, heading } from '../lib/platformTheme';
import { MapPin, Building2, Sun, Star, Clock } from 'lucide-react';

export function BanerTab({ user, showToast }) {
  const [filterType, setFilterType] = useState("all");
  const [sortBy, setSortBy]         = useState("price");
  const [courts, setCourts]         = useState([]);
  const [slots, setSlots]           = useState({});
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [cd, sd] = await Promise.all([Court.filter(), CourtSlot.filter()]);
        setCourts(cd || []);
        const today = new Date().toISOString().split("T")[0];
        const g = {};
        (sd || []).forEach(s => { if (!s.is_booked && s.date >= today) { if (!g[s.court_id]) g[s.court_id] = []; g[s.court_id].push(s); } });
        setSlots(g);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  let filtered = [...courts];
  if (filterType === "indoor")  filtered = filtered.filter(c =>  c.is_indoor);
  if (filterType === "outdoor") filtered = filtered.filter(c => !c.is_indoor);
  if (sortBy === "price")  filtered.sort((a, b) => (a.price_per_hour || 0) - (b.price_per_hour || 0));
  if (sortBy === "rating") filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));

  if (loading) return <div style={{ textAlign: "center", padding: "40px", color: theme.textLight, fontSize: "14px" }}>Indlæser baner...</div>;

  return (
    <div>
      <h2 style={{ ...heading("clamp(20px,4.5vw,24px)"), marginBottom: "16px" }}>Padelbaner</h2>
      <div className="pm-baner-filters" style={{ marginBottom: "20px" }}>
        {[["all","Alle"],["indoor","Indoor"],["outdoor","Outdoor"]].map(([v,l]) => (
          <button key={v} onClick={() => setFilterType(v)} style={{ ...btn(filterType === v), padding: "8px 16px", fontSize: "13px" }}>{l}</button>
        ))}
        <select className="pm-baner-sort" value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ ...inputStyle, width: "auto", minWidth: "120px", padding: "8px 12px", fontSize: "13px" }}>
          <option value="price">Pris ↑</option>
          <option value="rating">Rating ↓</option>
        </select>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {filtered.map(c => {
          const cs    = slots[c.id] || [];
          const times = [...new Set(cs.map(s => s.time))].sort().slice(0, 8);
          return (
            <div key={c.id} style={{ background: theme.surface, borderRadius: theme.radius, padding: "20px", boxShadow: theme.shadow, border: "1px solid " + theme.border }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                <div>
                  <div style={{ fontSize: "15px", fontWeight: 700, letterSpacing: "-0.01em", marginBottom: "2px" }}>{c.name}</div>
                  <div style={{ fontSize: "12px", color: theme.textLight, display: "flex", alignItems: "center", gap: "3px" }}><MapPin size={11} /> {c.address}</div>
                </div>
                <span style={tag(c.is_indoor ? theme.blueBg : theme.warmBg, c.is_indoor ? theme.blue : theme.warm)}>
                  {c.is_indoor ? <><Building2 size={9} /> Indoor</> : <><Sun size={9} /> Outdoor</>}
                </span>
              </div>
              <div style={{ display: "flex", gap: "16px", marginBottom: "14px", fontSize: "13px", color: theme.textMid, flexWrap: "wrap" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><Star size={12} color={theme.warm} fill={theme.warm} /> {c.rating || "—"}</span>
                <span style={{ fontWeight: 600, color: theme.text }}>{c.price_per_hour} kr/t</span>
                <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><Clock size={12} /> {cs.length} ledige tider</span>
              </div>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                {times.length > 0 ? times.map(t => (
                  <button key={t} onClick={async () => {
                    try {
                      await Booking.create({ court_id: c.id, user_id: user?.id, date: new Date().toISOString().split("T")[0], time_slot: t, price: c.price_per_hour, court_name: c.name, status: "confirmed" });
                      showToast("Booket kl. " + t + "! ✅");
                    } catch (e) { showToast("Fejl: " + (e.message || "Prøv igen")); }
                  }} style={{ background: theme.accentBg, color: theme.accent, border: "1px solid " + theme.accent + "30", padding: "6px 13px", borderRadius: "6px", fontSize: "12px", fontWeight: 600, cursor: "pointer", fontFamily: font, transition: "all 0.15s", letterSpacing: "-0.01em" }}>
                    {t}
                  </button>
                )) : <span style={{ fontSize: "12px", color: theme.textLight }}>Ingen ledige tider</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
