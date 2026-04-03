import { useState, useEffect } from "react";
import { useAuth } from "./lib/AuthContext";
import { Profile, Court, CourtSlot, Match, Booking } from "./api/base44Client";
Show less
import { supabase } from "./lib/supabase";
// ─── Constants (UI only) ───
const LEVELS = ["1-2 (Helt ny)", "3-4 (Begynder)", "5-6 (Øvet)", "7-8 (Avanceret)", "9-10 (Elite)"];
const PLAY_STYLES = ["Offensiv", "Defensiv", "Alround", "Ved ikke endnu"];
const AREAS = ["København", "Frederiksberg", "Amager", "Herlev", "Taastrup", "Østerbro", "Nørrebro", "Vesterbro", "Aarhus", "Odense"];
const AVAILABILITY = ["Morgener", "Formiddage", "Eftermiddage", "Aftener", "Weekender", "Flexibel"];
// ─── Styles ───
const font = "'Outfit', sans-serif";
const fontDisplay = "'Syne', sans-serif";
const theme = {
  bg: "#FAFAF7",
  surface: "#FFFFFF",
  text: "#1A1E23",
  textMid: "#555D66",
  textLight: "#99A1AA",
  accent: "#1A7A52",
  accentHover: "#15634",
  accentBg: "#E6F5ED",
  warm: "#E8943A",
  warmBg: "#FFF6EB",
  blue: "#3B6EE8",
  blueBg: "#EBF0FF",
  red: "#D94848",
  redBg: "#FFECEC",
  border: "#E5E7E2",
  shadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)",
  shadowLg: "0 4px 24px rgba(0,0,0,0.08)",
  radius: "14px",
};
const btn = (primary) => ({
  fontFamily: font,
  fontSize: "14px",
  fontWeight: 600,
  padding: "11px 24px",
  borderRadius: "10px",
  border: primary ? "none" : `1.5px solid ${theme.border}`,
  background: primary ? theme.accent : theme.surface,
  color: primary ? "#fff" : theme.text,
  cursor: "pointer",
  transition: "all 0.2s",
});
const input = {
  fontFamily: font,
  fontSize: "14px",
  padding: "11px 14px",
  borderRadius: "10px",
  border: `1.5px solid ${theme.border}`,
  background: theme.surface,
  color: theme.text,
  width: "100%",
  boxSizing: "border-box",
  outline: "none",
};
const tag = (bg, color) => ({
  fontSize: "11px",
  fontWeight: 600,
  padding: "3px 10px",
  borderRadius: "6px",
  background: bg,
  color: color,
  display: "inline-block",
});
// ─── App ───
export default function PadelMakker() {
  const { user, profile, loading, signOut } = useAuth();
  const [page, setPage] = useState(user ? "dashboard" : "landing");
  const [toast, setToast] = useState(null);
  useEffect(() => {
    if (!loading && user && profile) setPage("dashboard");
    else if (!loading && !user) setPage("landing");
  }, [loading, user, profile]);
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3000); };
  const handleLogout = async () => {
    await signOut();
    setPage("landing");
  };
  if (loading) return (
    <div style={{ fontFamily: font, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: theme.bg }}>
      <div style={{ fontSize: "24px" }}>🎾</div>
    </div>
  );
  return (
    <div style={{ fontFamily: font, background: theme.bg, minHeight: "100vh", color: theme.text, position: "relative" }}>
      {toast && (
        <div style={{ position: "fixed", top: "20px", left: "50%", transform: "translateX(-50%)", background: theme.accent, color: "#fff", padding: "12px 24px", borderRadius: "12px", fontSize: "14px", fontWeight: 600, zIndex: 9999, boxShadow: theme.shadowLg, animation: "fadeIn 0.3s" }}>
          {toast}
        </div>
      )}
      <style>{`
        @keyframes fadeIn { from { opacity:0; transform: translateX(-50%) translateY(-10px); } to { opacity:1; transform: translateX(-50%) translateY(0); } }
        @keyframes slideUp { from { opacity:0; transform: translateY(20px); } to { opacity:1; transform: translateY(0); } }
        * { box-sizing: border-box; margin: 0; }
        input:focus, select:focus, textarea:focus { border-color: ${theme.accent} !important; }
        ::placeholder { color: ${theme.textLight}; }
        button:hover { opacity: 0.9; }
      `}</style>
      {page === "landing" && <LandingPage onGetStarted={() => setPage("onboarding")} onLogin={() => setPage("login")} />}
      {page === "onboarding" && <OnboardingPage onComplete={() => { setPage("dashboard"); showToast("Velkommen til PadelMakker! 🎾"); }} onBack={() => setPage("landing")} />}
      {page === "login" && <LoginPage onLogin={() => setPage("dashboard")} onBack={() => setPage("landing")} />}
      {page === "dashboard" && profile && <DashboardPage user={profile} onLogout={handleLogout} showToast={showToast} />}
    </div>
  );
}
// ─── Landing Page ───
function LandingPage({ onGetStarted, onLogin }) {
  return (
    <div>
      <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 24px", maxWidth: "1100px", margin: "0 auto" }}>
        <div style={{ fontFamily: fontDisplay, fontSize: "22px", fontWeight: 800, color: theme.accent, letterSpacing: "-0.5px" }}>
          🎾 PadelMakker
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={onLogin} style={btn(false)}>Log ind</button>
          <button onClick={onGetStarted} style={btn(true)}>Kom i gang</button>
        </div>
      </nav>
      <section style={{ maxWidth: "1100px", margin: "0 auto", padding: "60px 24px 40px", textAlign: "center" }}>
        <div style={{ display: "inline-block", background: theme.accentBg, color: theme.accent, fontSize: "13px", fontWeight: 600, padding: "6px 16px", borderRadius: "20px", marginBottom: "20px" }}>
          🇩🇰 Danmarks padel-platform
        </div>
        <h1 style={{ fontFamily: fontDisplay, fontSize: "clamp(36px, 6vw, 60px)", fontWeight: 800, lineHeight: 1.05, letterSpacing: "-2px", marginBottom: "16px", color: theme.text }}>
          Find makker.<br />Book bane.<br /><span style={{ color: theme.accent }}>Spil padel.</span>
        </h1>
        <p style={{ fontSize: "18px", color: theme.textMid, maxWidth: "520px", margin: "0 auto 32px", lineHeight: 1.6 }}>
          Stop med at søge i Facebook-grupper. PadelMakker matcher dig med spillere på dit niveau, finder den nærmeste bane, og tracker din udvikling.
        </p>
        <button onClick={onGetStarted} style={{ ...btn(true), fontSize: "16px", padding: "15px 36px", borderRadius: "12px" }}>
          Opret gratis profil →
        </button>
        <p style={{ fontSize: "13px", color: theme.textLight, marginTop: "12px" }}>Gratis at bruge · Ingen kreditkort</p>
      </section>
      <section style={{ maxWidth: "1100px", margin: "0 auto", padding: "40px 24px 60px" }}>
        <h2 style={{ fontFamily: fontDisplay, fontSize: "28px", fontWeight: 800, textAlign: "center", marginBottom: "40px", letterSpacing: "-1px" }}>Sådan virker det</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
          {[
            { step: "01", icon: "👤", title: "Opret profil", desc: "Angiv dit niveau, område og hvornår du kan spille. Tager under 2 minutter." },
            { step: "02", icon: "🤝", title: "Find makker", desc: "Se spillere nær dig på dit niveau. Invitér dem direkte eller tilmeld dig åbne kampe." },
            { step: "03", icon: "📍", title: "Book bane", desc: "Find ledige baner tæt på dig. Sammenlign priser og book direkte." },
            { step: "04", icon: "📊", title: "Rank op", desc: "Registrér resultater og se din ranking stige. Konkurrér lokalt og nationalt." },
          ].map((s) => (
            <div key={s.step} style={{ background: theme.surface, borderRadius: theme.radius, padding: "28px 24px", boxShadow: theme.shadow, border: `1px solid ${theme.border}` }}>
              <div style={{ fontSize: "12px", fontWeight: 700, color: theme.accent, marginBottom: "10px", fontFamily: fontDisplay }}>{s.step}</div>
              <div style={{ fontSize: "28px", marginBottom: "10px" }}>{s.icon}</div>
              <div style={{ fontSize: "17px", fontWeight: 700, marginBottom: "6px" }}>{s.title}</div>
              <div style={{ fontSize: "14px", color: theme.textMid, lineHeight: 1.5 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </section>
      <section style={{ background: theme.accent, padding: "48px 24px" }}>
        <div style={{ maxWidth: "800px", margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "20px", textAlign: "center" }}>
          {[
            { n: "200+", l: "Aktive spillere" },
            { n: "6", l: "Baner i København" },
            { n: "50+", l: "Kampe ugentligt" },
            { n: "4.7★", l: "Gennemsnitlig rating" },
          ].map((s, i) => (
            <div key={i}>
              <div style={{ fontFamily: fontDisplay, fontSize: "36px", fontWeight: 800, color: "#fff" }}>{s.n}</div>
              <div style={{ fontSize: "14px", color: "rgba(255,255,255,0.75)" }}>{s.l}</div>
            </div>
          ))}
        </div>
      </section>
      <footer style={{ maxWidth: "1100px", margin: "0 auto", padding: "40px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "13px", color: theme.textLight }}>
        <span>© 2026 PadelMakker · Lavet i Danmark</span>
        <span>kontakt@padelmakker.dk</span>
      </footer>
    </div>
  );
}
// ─── Login Page (Supabase Auth) ───
function LoginPage({ onLogin, onBack }) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
Bash
sed -n '201,400p' /home/user/pm-hr-system/src/padelmakker-platform.jsx
const [submitting, setSubmitting] = useState(false);
  const handleLogin = async () => {
Show more
Bash
sed -n '401,600p' /home/user/pm-hr-system/src/padelmakker-platform.jsx
{tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ background: tab === t.id ? theme.accentBg : "transparent", color: tab === t.id ? theme.accent : theme.textMid, border: "none", padding: "8px 16px", borderRadius: "8px", fontSize: "13px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", whiteSpace: "nowrap", fontFamily: font }}>
            <span>{t.icon}</span>{t.label}
Show less
          </button>
        ))}
      </div>
      <div style={{ flex: 1, maxWidth: "900px", width: "100%", margin: "0 auto", padding: "24px 16px" }}>
        {tab === "hjem" && <HomeTab user={user} setTab={setTab} />}
        {tab === "makkere" && <MakkereTab user={user} showToast={showToast} />}
        {tab === "baner" && <BanerTab showToast={showToast} />}
        {tab === "kampe" && <KampeTab user={user} showToast={showToast} />}
        {tab === "ranking" && <RankingTab user={user} />}
      </div>
    </div>
  );
}
// ─── Home Tab ───
function HomeTab({ user, setTab }) {
  const name = user.full_name || user.name || "Spiller";
  const level = user.level || 5;
  const games = user.games_played || 0;
  const wins = user.games_won || 0;
  const lvlPct = (level / 10) * 100;
  return (
    <div>
      <h2 style={{ fontFamily: fontDisplay, fontSize: "26px", fontWeight: 800, marginBottom: "4px" }}>Hej {name.split(" ")[0]}! 👋</h2>
      <p style={{ color: theme.textMid, fontSize: "14px", marginBottom: "28px" }}>Klar til at spille?</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "12px", marginBottom: "28px" }}>
        {[
          { label: "Niveau", value: level, color: theme.accent },
          { label: "Kampe", value: games, color: theme.blue },
          { label: "Sejre", value: wins, color: theme.warm },
          { label: "Win %", value: games > 0 ? Math.round((wins / games) * 100) + "%" : "—", color: theme.accent },
        ].map((s, i) => (
          <div key={i} style={{ background: theme.surface, borderRadius: theme.radius, padding: "20px", boxShadow: theme.shadow, textAlign: "center" }}>
            <div style={{ fontSize: "28px", fontWeight: 800, color: s.color, fontFamily: fontDisplay }}>{s.value}</div>
            <div style={{ fontSize: "12px", color: theme.textLight, marginTop: "4px" }}>{s.label}</div>
          </div>
        ))}
      </div>
      <div style={{ background: theme.surface, borderRadius: theme.radius, padding: "20px", boxShadow: theme.shadow, marginBottom: "28px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
          <span style={{ fontSize: "14px", fontWeight: 600 }}>Din niveau-progression</span>
          <span style={{ fontSize: "14px", fontWeight: 700, color: theme.accent }}>{level} / 10</span>
        </div>
        <div style={{ background: theme.border, borderRadius: "6px", height: "10px", overflow: "hidden" }}>
          <div style={{ width: `${lvlPct}%`, height: "100%", background: `linear-gradient(90deg, ${theme.accent}, ${theme.blue})`, borderRadius: "6px", transition: "width 0.5s" }} />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        {[
          { icon: "🤝", title: "Find en makker", desc: "Se ledige spillere", tab: "makkere" },
          { icon: "📍", title: "Book en bane", desc: "Ledige tider i dag", tab: "baner" },
          { icon: "⚔️", title: "Åbne kampe", desc: "Tilmeld dig nu", tab: "kampe" },
          { icon: "🏆", title: "Se ranking", desc: "Din placering", tab: "ranking" },
        ].map((a, i) => (
          <button key={i} onClick={() => setTab(a.tab)} style={{ background: theme.surface, borderRadius: theme.radius, padding: "20px", boxShadow: theme.shadow, border: `1px solid ${theme.border}`, cursor: "pointer", textAlign: "left", fontFamily: font }}>
            <div style={{ fontSize: "24px", marginBottom: "8px" }}>{a.icon}</div>
            <div style={{ fontSize: "15px", fontWeight: 700, color: theme.text }}>{a.title}</div>
            <div style={{ fontSize: "12px", color: theme.textLight }}>{a.desc}</div>
          </button>
        ))}
      </div>
      <div style={{ background: theme.surface, borderRadius: theme.radius, padding: "20px", boxShadow: theme.shadow, marginTop: "28px" }}>
        <div style={{ fontSize: "14px", fontWeight: 700, marginBottom: "12px" }}>Din profil</div>
        <div style={{ display: "flex", gap: "14px", alignItems: "center" }}>
          <div style={{ width: "56px", height: "56px", borderRadius: "50%", background: theme.accentBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "26px", border: `2px solid ${theme.accent}30` }}>{user.avatar || "🎾"}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "16px", fontWeight: 700 }}>{name}</div>
            <div style={{ fontSize: "12px", color: theme.textLight }}>{user.area} · {user.play_style}</div>
            <div style={{ display: "flex", gap: "6px", marginTop: "6px", flexWrap: "wrap" }}>
              <span style={tag(theme.accentBg, theme.accent)}>Lvl {level}</span>
              {user.availability?.slice(0, 2).map(a => <span key={a} style={tag(theme.blueBg, theme.blue)}>{a}</span>)}
            </div>
          </div>
        </div>
        {user.bio && <p style={{ fontSize: "13px", color: theme.textMid, marginTop: "12px", lineHeight: 1.5 }}>{user.bio}</p>}
      </div>
    </div>
  );
}
// ─── Find Makker Tab (loads from Supabase profiles) ───
function MakkereTab({ user, showToast }) {
  const [search, setSearch] = useState("");
  const [filterLevel, setFilterLevel] = useState("all");
  const [filterArea, setFilterArea] = useState("all");
  const [players, setPlayers] = useState([]);
  const [loadingPlayers, setLoadingPlayers] = useState(true);
  useEffect(() => {
    (async () => {
      try {
        const data = await Profile.filter();
        // Exclude self
        setPlayers(data.filter(p => p.id !== user.id));
      } catch (e) {
        console.error("Failed to load players:", e);
      } finally {
        setLoadingPlayers(false);
      }
    })();
  }, [user.id]);
  const filtered = players.filter(p => {
    const name = p.full_name || "";
    if (search && !name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterArea !== "all" && p.area !== filterArea) return false;
    if (filterLevel === "close" && Math.abs((p.level || 5) - (user.level || 5)) > 1.5) return false;
    return true;
  });
  return (
    <div>
      <h2 style={{ fontFamily: fontDisplay, fontSize: "24px", fontWeight: 800, marginBottom: "16px" }}>Find makker 🤝</h2>
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Søg efter navn..." style={{ ...input, marginBottom: "12px" }} />
      <div style={{ display: "flex", gap: "8px", marginBottom: "20px", flexWrap: "wrap" }}>
        <select value={filterLevel} onChange={e => setFilterLevel(e.target.value)} style={{ ...input, width: "auto", padding: "8px 12px", fontSize: "13px" }}>
          <option value="all">Alle niveauer</option>
          <option value="close">±1.5 af dit niveau</option>
        </select>
        <select value={filterArea} onChange={e => setFilterArea(e.target.value)} style={{ ...input, width: "auto", padding: "8px 12px", fontSize: "13px" }}>
          <option value="all">Alle områder</option>
          {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>
      {loadingPlayers ? (
        <div style={{ textAlign: "center", padding: "40px", color: theme.textLight }}>Indlæser spillere...</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {filtered.map(p => (
            <div key={p.id} style={{ background: theme.surface, borderRadius: theme.radius, padding: "18px", boxShadow: theme.shadow }}>
              <div style={{ display: "flex", gap: "14px", alignItems: "center" }}>
                <div style={{ width: "50px", height: "50px", borderRadius: "50%", background: theme.accentBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px", flexShrink: 0 }}>{p.avatar || "🎾"}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "4px" }}>
                    <span style={{ fontSize: "15px", fontWeight: 700 }}>{p.full_name}</span>
                    <span style={{ fontSize: "12px", color: theme.textLight }}>📍 {p.area || "Ukendt"}</span>
                  </div>
                  <div style={{ display: "flex", gap: "6px", marginTop: "6px", flexWrap: "wrap" }}>
                    <span style={tag(theme.accentBg, theme.accent)}>Lvl {p.level || "?"}</span>
                    <span style={tag(theme.blueBg, theme.blue)}>{p.play_style || "?"}</span>
                    <span style={tag(theme.warmBg, theme.warm)}>{p.games_played || 0} kampe</span>
                  </div>
                  {p.bio && <p style={{ fontSize: "12px", color: theme.textMid, marginTop: "8px", lineHeight: 1.4 }}>{p.bio}</p>}
                  {p.availability?.length > 0 && <div style={{ fontSize: "11px", color: theme.textLight, marginTop: "4px" }}>📅 {p.availability.join(", ")}</div>}
                </div>
              </div>
              <div style={{ display: "flex", gap: "8px", marginTop: "14px", justifyContent: "flex-end" }}>
                <button onClick={() => showToast(`Besked sendt til ${p.full_name}! 💬`)} style={{ ...btn(false), padding: "8px 16px", fontSize: "12px" }}>💬 Skriv</button>
                <button onClick={() => showToast(`Invitation sendt til ${p.full_name}! 🎾`)} style={{ ...btn(true), padding: "8px 16px", fontSize: "12px" }}>Invitér til kamp</button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px", color: theme.textLight }}>
              <div style={{ fontSize: "32px", marginBottom: "8px" }}>🔍</div>
              <p>Ingen spillere fundet med disse filtre.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
// ─── Baner Tab (loads from Supabase courts + court_slots) ───
function BanerTab({ showToast }) {
  const [filterType, setFilterType] = useState("all");
  const [sortBy, setSortBy] = useState("price");
  const [courts, setCourts] = useState([]);
  const [slots, setSlots] = useState({});
  const [loadingCourts, setLoadingCourts] = useState(true);
  useEffect(() => {
    (async () => {
      try {
        const [courtsData, slotsData] = await Promise.all([
          Court.filter(),
          CourtSlot.filter(),
        ]);
        setCourts(courtsData || []);
        // Group slots by court_id, only available ones for today and forward
        const today = new Date().toISOString().split("T")[0];
        const grouped = {};
        (slotsData || []).forEach(s => {
          if (s.is_available && s.slot_date >= today) {
            if (!grouped[s.court_id]) grouped[s.court_id] = [];
            grouped[s.court_id].push(s);
          }
Bash
sed -n '601,800p' /home/user/pm-hr-system/src/padelmakker-platform.jsx
});
        setSlots(grouped);
      } catch (e) {
Show less
        console.error("Failed to load courts:", e);
      } finally {
        setLoadingCourts(false);
      }
    })();
  }, []);
  let filtered = [...courts];
  if (filterType === "indoor") filtered = filtered.filter(c => c.indoor);
  if (filterType === "outdoor") filtered = filtered.filter(c => !c.indoor);
  if (sortBy === "price") filtered.sort((a, b) => (a.price_per_hour || 0) - (b.price_per_hour || 0));
  if (sortBy === "rating") filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  if (loadingCourts) return <div style={{ textAlign: "center", padding: "40px", color: theme.textLight }}>Indlæser baner...</div>;
  return (
    <div>
      <h2 style={{ fontFamily: fontDisplay, fontSize: "24px", fontWeight: 800, marginBottom: "16px" }}>Padelbaner 📍</h2>
      <div style={{ display: "flex", gap: "8px", marginBottom: "20px", flexWrap: "wrap" }}>
        {[["all", "Alle"], ["indoor", "Indoor"], ["outdoor", "Outdoor"]].map(([v, l]) => (
          <button key={v} onClick={() => setFilterType(v)} style={{ ...btn(filterType === v), padding: "8px 16px", fontSize: "13px" }}>{l}</button>
        ))}
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ ...input, width: "auto", padding: "8px 12px", fontSize: "13px", marginLeft: "auto" }}>
          <option value="price">Sortér: Pris</option>
          <option value="rating">Sortér: Rating</option>
        </select>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {filtered.map(c => {
          const courtSlots = slots[c.id] || [];
          // Get unique times for display (first 8)
          const times = [...new Set(courtSlots.map(s => s.start_time?.slice(0, 5)))].sort().slice(0, 8);
          return (
            <div key={c.id} style={{ background: theme.surface, borderRadius: theme.radius, padding: "20px", boxShadow: theme.shadow }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
                <div>
                  <div style={{ fontSize: "16px", fontWeight: 700 }}>{c.name}</div>
                  <div style={{ fontSize: "12px", color: theme.textLight, marginTop: "2px" }}>{c.address}</div>
                </div>
                <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                  <span style={tag(c.indoor ? theme.blueBg : theme.warmBg, c.indoor ? theme.blue : theme.warm)}>{c.indoor ? "Indoor" : "Outdoor"}</span>
                </div>
              </div>
              <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "14px", fontSize: "13px", color: theme.textMid }}>
                <span>⭐ {c.rating || "—"}</span>
                <span>💰 {c.price_per_hour || "?"} kr/time</span>
                <span>🕐 {courtSlots.length} ledige tider</span>
              </div>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "12px" }}>
                {times.length > 0 ? times.map(t => (
                  <button key={t} onClick={async () => {
                    try {
                      const slot = courtSlots.find(s => s.start_time?.slice(0, 5) === t);
                      if (slot) {
                        await Booking.create({ court_slot_id: slot.id, court_id: c.id });
                        showToast(`Bane booket kl. ${t} på ${c.name}! ✅`);
                      }
                    } catch (e) {
                      showToast(`Bane booket kl. ${t} på ${c.name}! ✅`);
                    }
                  }} style={{ background: theme.accentBg, color: theme.accent, border: "none", padding: "7px 14px", borderRadius: "8px", fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: font }}>
                    {t}
                  </button>
                )) : <span style={{ fontSize: "12px", color: theme.textLight }}>Ingen ledige tider</span>}
              </div>
              <div style={{ fontSize: "11px", color: theme.textLight }}>💳 Split betaling muligt · Klik på tid for at booke</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
// ─── Kampe Tab (loads from Supabase matches) ───
function KampeTab({ user, showToast }) {
  const [showCreate, setShowCreate] = useState(false);
  const [courts, setCourts] = useState([]);
  const [matches, setMatches] = useState([]);
  const [matchPlayers, setMatchPlayers] = useState({});
  const [profiles, setProfiles] = useState({});
  const [loadingMatches, setLoadingMatches] = useState(true);
  const [newMatch, setNewMatch] = useState({ court_id: "", date: new Date().toISOString().split("T")[0], time: "18:00", level_range: "4-6" });
  useEffect(() => {
    loadData();
  }, []);
  const loadData = async () => {
    try {
      const [courtsData, matchesData, allProfiles] = await Promise.all([
        Court.filter(),
        Match.filter(),
        Profile.filter(),
      ]);
      setCourts(courtsData || []);
      setMatches((matchesData || []).filter(m => m.status === "open" || m.status === "pending"));
      if (courtsData?.length > 0 && !newMatch.court_id) {
        setNewMatch(m => ({ ...m, court_id: courtsData[0].id }));
      }
      // Build profiles lookup
      const pMap = {};
      (allProfiles || []).forEach(p => { pMap[p.id] = p; });
      setProfiles(pMap);
      // Load match_players via supabase directly
      const { data: mpData } = await supabase.from("match_players").select("*");
      const mpMap = {};
      (mpData || []).forEach(mp => {
        if (!mpMap[mp.match_id]) mpMap[mp.match_id] = [];
        mpMap[mp.match_id].push(mp);
      });
      setMatchPlayers(mpMap);
    } catch (e) {
      console.error("Failed to load matches:", e);
    } finally {
      setLoadingMatches(false);
    }
  };
  const getCourtName = (id) => courts.find(c => c.id === id)?.name || "Ukendt bane";
  const createMatch = async () => {
    try {
      const matchData = {
        creator_id: user.id,
        court_id: newMatch.court_id,
        match_date: newMatch.date,
        match_time: newMatch.time,
        level_range: newMatch.level_range,
        status: "open",
        max_players: 4,
      };
      const created = await Match.create(matchData);
      // Add creator as first player
      await supabase.from("match_players").insert({ match_id: created.id, player_id: user.id });
      setShowCreate(false);
      showToast("Kamp oprettet! Andre spillere kan nu tilmelde sig 🎾");
      loadData();
    } catch (e) {
      showToast("Fejl ved oprettelse: " + (e.message || "Prøv igen"));
    }
  };
  const joinMatch = async (matchId) => {
    try {
      await supabase.from("match_players").insert({ match_id: matchId, player_id: user.id });
      showToast("Du er tilmeldt kampen! ⚔️");
      loadData();
    } catch (e) {
      showToast("Kunne ikke tilmelde: " + (e.message || "Prøv igen"));
    }
  };
  if (loadingMatches) return <div style={{ textAlign: "center", padding: "40px", color: theme.textLight }}>Indlæser kampe...</div>;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h2 style={{ fontFamily: fontDisplay, fontSize: "24px", fontWeight: 800 }}>Kampe ⚔️</h2>
        <button onClick={() => setShowCreate(!showCreate)} style={btn(true)}>{showCreate ? "Annullér" : "+ Opret kamp"}</button>
      </div>
      {showCreate && (
        <div style={{ background: theme.surface, borderRadius: theme.radius, padding: "20px", boxShadow: theme.shadow, marginBottom: "20px", border: `2px solid ${theme.accent}30` }}>
          <h3 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "16px" }}>Opret ny kamp</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>Bane</label>
              <select value={newMatch.court_id} onChange={e => setNewMatch(m => ({ ...m, court_id: e.target.value }))} style={{ ...input, fontSize: "13px" }}>
                {courts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>Niveau-range</label>
              <select value={newMatch.level_range} onChange={e => setNewMatch(m => ({ ...m, level_range: e.target.value }))} style={{ ...input, fontSize: "13px" }}>
                {["1-3", "2-4", "3-5", "4-6", "5-7", "6-8", "7-9", "8-10"].map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>Dato</label>
              <input type="date" value={newMatch.date} onChange={e => setNewMatch(m => ({ ...m, date: e.target.value }))} style={{ ...input, fontSize: "13px" }} />
            </div>
            <div>
              <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>Tidspunkt</label>
              <input type="time" value={newMatch.time} onChange={e => setNewMatch(m => ({ ...m, time: e.target.value }))} style={{ ...input, fontSize: "13px" }} />
            </div>
          </div>
          <button onClick={createMatch} style={{ ...btn(true), marginTop: "16px", width: "100%" }}>Opret kamp</button>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {matches.map(m => {
Bash
sed -n '801,919p' /home/user/pm-hr-system/src/padelmakker-platform.jsx
const mPlayers = matchPlayers[m.id] || [];
          const spotsLeft = (m.max_players || 4) - mPlayers.length;
          const alreadyJoined = mPlayers.some(mp => mp.player_id === user.id);
Show less
          return (
            <div key={m.id} style={{ background: theme.surface, borderRadius: theme.radius, padding: "20px", boxShadow: theme.shadow }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
                <div>
                  <div style={{ fontSize: "16px", fontWeight: 700 }}>{m.match_date} kl. {m.match_time?.slice(0, 5)}</div>
                  <div style={{ fontSize: "12px", color: theme.textLight }}>{getCourtName(m.court_id)}</div>
                </div>
                <span style={tag(spotsLeft > 0 ? theme.accentBg : theme.redBg, spotsLeft > 0 ? theme.accent : theme.red)}>
                  {spotsLeft > 0 ? `${spotsLeft} ${spotsLeft === 1 ? "plads" : "pladser"} ledig${spotsLeft > 1 ? "e" : ""}` : "Fuld"}
                </span>
              </div>
              <div style={{ display: "flex", gap: "6px", marginBottom: "12px" }}>
                <span style={tag(theme.accentBg, theme.accent)}>Niveau {m.level_range}</span>
                <span style={tag(theme.blueBg, theme.blue)}>{mPlayers.length}/{m.max_players || 4} spillere</span>
              </div>
              <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "12px" }}>
                {mPlayers.map(mp => {
                  const pl = profiles[mp.player_id] || { full_name: "Spiller", avatar: "🎾" };
                  return (
                    <div key={mp.player_id} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <div style={{ width: "38px", height: "38px", borderRadius: "50%", background: theme.accentBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px" }}>{pl.avatar || "🎾"}</div>
                      <span style={{ fontSize: "10px", color: theme.textLight, marginTop: "2px" }}>{(pl.full_name || "?").split(" ")[0]}</span>
                    </div>
                  );
                })}
                {Array.from({ length: Math.max(0, spotsLeft) }).map((_, i) => (
                  <div key={i} style={{ width: "38px", height: "38px", borderRadius: "50%", border: `2px dashed ${theme.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", color: theme.textLight }}>?</div>
                ))}
              </div>
              {spotsLeft > 0 && !alreadyJoined && (
                <button onClick={() => joinMatch(m.id)} style={{ ...btn(true), width: "100%", fontSize: "13px" }}>Tilmeld mig</button>
              )}
              {alreadyJoined && (
                <div style={{ textAlign: "center", fontSize: "13px", color: theme.accent, fontWeight: 600 }}>✅ Du er tilmeldt</div>
              )}
            </div>
          );
        })}
        {matches.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px", color: theme.textLight }}>
            <div style={{ fontSize: "32px", marginBottom: "8px" }}>⚔️</div>
            <p>Ingen åbne kampe endnu. Opret den første!</p>
          </div>
        )}
      </div>
    </div>
  );
}
// ─── Ranking Tab (loads from Supabase profiles, sorted by level) ───
function RankingTab({ user }) {
  const [players, setPlayers] = useState([]);
  const [loadingRanking, setLoadingRanking] = useState(true);
  useEffect(() => {
    (async () => {
      try {
        const data = await Profile.filter();
        setPlayers(data || []);
      } catch (e) {
        console.error("Failed to load ranking:", e);
      } finally {
        setLoadingRanking(false);
      }
    })();
  }, []);
  const sorted = [...players].sort((a, b) => (b.level || 0) - (a.level || 0));
  const userRank = sorted.findIndex(p => p.id === user.id) + 1;
  const level = user.level || 5;
  if (loadingRanking) return <div style={{ textAlign: "center", padding: "40px", color: theme.textLight }}>Indlæser ranking...</div>;
  return (
    <div>
      <h2 style={{ fontFamily: fontDisplay, fontSize: "24px", fontWeight: 800, marginBottom: "20px" }}>Ranking 🏆</h2>
      <div style={{ background: `linear-gradient(135deg, ${theme.accent}, #0D5C3A)`, borderRadius: theme.radius, padding: "24px", marginBottom: "24px", color: "#fff" }}>
        <div style={{ fontSize: "12px", opacity: 0.8, marginBottom: "6px" }}>Din placering</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <span style={{ fontFamily: fontDisplay, fontSize: "40px", fontWeight: 800 }}>#{userRank || "—"}</span>
            <span style={{ fontSize: "14px", marginLeft: "8px", opacity: 0.8 }}>af {sorted.length} spillere</span>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: fontDisplay, fontSize: "24px", fontWeight: 800 }}>{level}</div>
            <div style={{ fontSize: "11px", opacity: 0.8 }}>ELO rating</div>
          </div>
        </div>
        <div style={{ marginTop: "14px", background: "rgba(255,255,255,0.2)", borderRadius: "6px", height: "8px" }}>
          <div style={{ width: `${(level / 10) * 100}%`, height: "100%", background: theme.warm, borderRadius: "6px" }} />
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        {sorted.map((p, i) => {
          const isYou = p.id === user.id;
          return (
            <div key={p.id} style={{ background: isYou ? theme.accentBg : theme.surface, borderRadius: "12px", padding: "14px 16px", boxShadow: isYou ? "none" : theme.shadow, display: "flex", alignItems: "center", gap: "12px", border: isYou ? `2px solid ${theme.accent}40` : `1px solid ${theme.border}` }}>
              <div style={{ width: "30px", textAlign: "center", fontSize: i < 3 ? "18px" : "14px", fontWeight: 700, color: i < 3 ? [theme.warm, theme.textLight, "#B87333"][i] : theme.textLight }}>
                {i < 3 ? ["🥇", "🥈", "🥉"][i] : `${i + 1}`}
              </div>
              <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: isYou ? `${theme.accent}20` : theme.accentBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px" }}>{p.avatar || "🎾"}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "14px", fontWeight: isYou ? 700 : 600 }}>{p.full_name}{isYou ? " (dig)" : ""}</div>
                <div style={{ fontSize: "11px", color: theme.textLight }}>{p.area || "?"} · {p.games_played || 0} kampe · {(p.games_played || 0) > 0 ? Math.round(((p.games_won || 0) / p.games_played) * 100) : 0}% win</div>
              </div>
              <div style={{ fontFamily: fontDisplay, fontSize: "18px", fontWeight: 800, color: theme.accent }}>{p.level || 0}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
