import { useState, useEffect } from "react";
import { useAuth } from "./lib/AuthContext";
import { Profile, Court, CourtSlot, Match, Booking } from "./api/base44Client";
import { supabase } from "./lib/supabase";

const LEVELS = ["1-2 (Helt ny)", "3-4 (Begynder)", "5-6 (Øvet)", "7-8 (Avanceret)", "9-10 (Elite)"];
const PLAY_STYLES = ["Offensiv", "Defensiv", "Alround", "Ved ikke endnu"];
const AREAS = ["København", "Frederiksberg", "Amager", "Herlev", "Taastrup", "Østerbro", "Nørrebro", "Vesterbro", "Aarhus", "Odense"];
const AVAILABILITY = ["Morgener", "Formiddage", "Eftermiddage", "Aftener", "Weekender", "Flexibel"];

const font = "'Outfit', sans-serif";
const fontDisplay = "'Syne', sans-serif";
const theme = {
  bg: "#FAFAF7", surface: "#FFFFFF", text: "#1A1E23", textMid: "#555D66", textLight: "#99A1AA",
  accent: "#1A7A52", accentHover: "#156342", accentBg: "#E6F5ED",
  warm: "#E8943A", warmBg: "#FFF6EB", blue: "#3B6EE8", blueBg: "#EBF0FF",
  red: "#D94848", redBg: "#FFECEC", border: "#E5E7E2",
  shadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)",
  shadowLg: "0 4px 24px rgba(0,0,0,0.08)", radius: "14px",
};
const btn = (primary) => ({ fontFamily: font, fontSize: "14px", fontWeight: 600, padding: "11px 24px", borderRadius: "10px", border: primary ? "none" : "1.5px solid " + theme.border, background: primary ? theme.accent : theme.surface, color: primary ? "#fff" : theme.text, cursor: "pointer", transition: "all 0.2s" });
const inputStyle = { fontFamily: font, fontSize: "14px", padding: "11px 14px", borderRadius: "10px", border: "1.5px solid " + theme.border, background: theme.surface, color: theme.text, width: "100%", boxSizing: "border-box", outline: "none" };
const tag = (bg, color) => ({ fontSize: "11px", fontWeight: 600, padding: "3px 10px", borderRadius: "6px", background: bg, color: color, display: "inline-block" });

export default function PadelMakker() {
  const { user, profile, loading, signOut } = useAuth();
  const [page, setPage] = useState(user ? "dashboard" : "landing");
  const [toast, setToast] = useState(null);
  useEffect(() => { if (!loading && user && profile) setPage("dashboard"); else if (!loading && !user) setPage("landing"); }, [loading, user, profile]);
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3000); };
  const handleLogout = async () => { await signOut(); setPage("landing"); };
  if (loading) return (<div style={{ fontFamily: font, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: theme.bg }}><div style={{ fontSize: "24px" }}>🎾</div></div>);
  return (
    <div style={{ fontFamily: font, background: theme.bg, minHeight: "100vh", color: theme.text, position: "relative" }}>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Syne:wght@700;800&display=swap" rel="stylesheet" />
      {toast && (<div style={{ position: "fixed", top: "20px", left: "50%", transform: "translateX(-50%)", background: theme.accent, color: "#fff", padding: "12px 24px", borderRadius: "12px", fontSize: "14px", fontWeight: 600, zIndex: 9999, boxShadow: theme.shadowLg }}>{toast}</div>)}
      <style>{`* { box-sizing: border-box; margin: 0; } input:focus, select:focus, textarea:focus { border-color: ${theme.accent} !important; } ::placeholder { color: ${theme.textLight}; } button:hover { opacity: 0.9; }`}</style>
      {page === "landing" && <LandingPage onGetStarted={() => setPage("onboarding")} onLogin={() => setPage("login")} />}
      {page === "onboarding" && <OnboardingPage onComplete={() => { setPage("dashboard"); showToast("Velkommen til PadelMakker! 🎾"); }} onBack={() => setPage("landing")} />}
      {page === "login" && <LoginPage onLogin={() => setPage("dashboard")} onBack={() => setPage("landing")} />}
      {page === "dashboard" && profile && <DashboardPage user={profile} onLogout={handleLogout} showToast={showToast} />}
    </div>
  );
}

function LandingPage({ onGetStarted, onLogin }) {
  return (
    <div>
      <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 24px", maxWidth: "1100px", margin: "0 auto" }}>
        <div style={{ fontFamily: fontDisplay, fontSize: "22px", fontWeight: 800, color: theme.accent }}>🎾 PadelMakker</div>
        <div style={{ display: "flex", gap: "10px" }}><button onClick={onLogin} style={btn(false)}>Log ind</button><button onClick={onGetStarted} style={btn(true)}>Kom i gang</button></div>
      </nav>
      <section style={{ maxWidth: "1100px", margin: "0 auto", padding: "60px 24px 40px", textAlign: "center" }}>
        <div style={{ display: "inline-block", background: theme.accentBg, color: theme.accent, fontSize: "13px", fontWeight: 600, padding: "6px 16px", borderRadius: "20px", marginBottom: "20px" }}>🇩🇰 Danmarks padel-platform</div>
        <h1 style={{ fontFamily: fontDisplay, fontSize: "clamp(36px, 6vw, 60px)", fontWeight: 800, lineHeight: 1.05, letterSpacing: "-2px", marginBottom: "16px" }}>Find makker.<br />Book bane.<br /><span style={{ color: theme.accent }}>Spil padel.</span></h1>
        <p style={{ fontSize: "18px", color: theme.textMid, maxWidth: "520px", margin: "0 auto 32px", lineHeight: 1.6 }}>Stop med at søge i Facebook-grupper. PadelMakker matcher dig med spillere på dit niveau.</p>
        <button onClick={onGetStarted} style={{ ...btn(true), fontSize: "16px", padding: "15px 36px", borderRadius: "12px" }}>Opret gratis profil →</button>
      </section>
      <section style={{ maxWidth: "1100px", margin: "0 auto", padding: "40px 24px 60px" }}>
        <h2 style={{ fontFamily: fontDisplay, fontSize: "28px", fontWeight: 800, textAlign: "center", marginBottom: "40px" }}>Sådan virker det</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
          {[{ step: "01", icon: "👤", title: "Opret profil", desc: "Angiv dit niveau og område." }, { step: "02", icon: "🤝", title: "Find makker", desc: "Se spillere nær dig på dit niveau." }, { step: "03", icon: "📍", title: "Book bane", desc: "Find ledige baner og book direkte." }, { step: "04", icon: "📊", title: "Rank op", desc: "Se din ranking stige." }].map(s => (
            <div key={s.step} style={{ background: theme.surface, borderRadius: theme.radius, padding: "28px 24px", boxShadow: theme.shadow, border: "1px solid " + theme.border }}>
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
          {[{ n: "200+", l: "Aktive spillere" }, { n: "6", l: "Baner i København" }, { n: "50+", l: "Kampe ugentligt" }, { n: "4.7★", l: "Rating" }].map((s, i) => (<div key={i}><div style={{ fontFamily: fontDisplay, fontSize: "36px", fontWeight: 800, color: "#fff" }}>{s.n}</div><div style={{ fontSize: "14px", color: "rgba(255,255,255,0.75)" }}>{s.l}</div></div>))}
        </div>
      </section>
      <footer style={{ maxWidth: "1100px", margin: "0 auto", padding: "40px 24px", display: "flex", justifyContent: "space-between", fontSize: "13px", color: theme.textLight }}><span>© 2026 PadelMakker</span><span>kontakt@padelmakker.dk</span></footer>
    </div>
  );
}

function LoginPage({ onLogin, onBack }) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [err, setErr] = useState(""); const [submitting, setSubmitting] = useState(false);
  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) { setErr("Indtast email og password"); return; }
    setSubmitting(true); setErr("");
    try { await signIn(email.trim(), password); onLogin(); } catch (e) { setErr(e.message || "Login fejlede."); } finally { setSubmitting(false); }
  };
  return (
    <div style={{ maxWidth: "420px", margin: "0 auto", padding: "80px 24px" }}>
      <button onClick={onBack} style={{ ...btn(false), marginBottom: "32px", padding: "8px 16px", fontSize: "13px" }}>← Tilbage</button>
      <h1 style={{ fontFamily: fontDisplay, fontSize: "28px", fontWeight: 800, marginBottom: "8px" }}>Log ind</h1>
      <p style={{ color: theme.textMid, fontSize: "14px", marginBottom: "24px" }}>Brug din email og password.</p>
      <input value={email} onChange={e => { setEmail(e.target.value); setErr(""); }} placeholder="din@email.dk" style={{ ...inputStyle, marginBottom: "12px" }} />
      <input value={password} onChange={e => { setPassword(e.target.value); setErr(""); }} placeholder="Password" type="password" style={{ ...inputStyle, marginBottom: "12px" }} />
      {err && <p style={{ color: theme.red, fontSize: "13px", marginBottom: "12px" }}>{err}</p>}
      <button onClick={handleLogin} disabled={submitting} style={{ ...btn(true), width: "100%", opacity: submitting ? 0.6 : 1 }}>{submitting ? "Logger ind..." : "Log ind"}</button>
    </div>
  );
}

function OnboardingPage({ onComplete, onBack }) {
  const { signUp } = useAuth();
  const [step, setStep] = useState(0); const [submitting, setSubmitting] = useState(false); const [err, setErr] = useState("");
  const [form, setForm] = useState({ name: "", email: "", password: "", level: "", style: "", area: "", availability: [], bio: "", avatar: "🎾" });
  const avatars = ["🎾", "👨", "👩", "🧔", "👩‍🦰", "👨‍🦱", "👩‍🦱", "🧑"];
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const toggleAvail = (a) => setForm(f => ({ ...f, availability: f.availability.includes(a) ? f.availability.filter(x => x !== a) : [...f.availability, a] }));
  const canNext = () => { if (step === 0) return form.name.trim() && form.email.trim() && form.password.trim(); if (step === 1) return form.level && form.style; if (step === 2) return form.area && form.availability.length > 0; return true; };
  const finish = async () => {
    setSubmitting(true); setErr("");
    try {
      const levelNum = parseFloat(form.level.match(/\d+/)?.[0] || "5") + Math.random() * 1.5;
      await signUp(form.email.trim(), form.password, { full_name: form.name, level: Math.round(levelNum * 10) / 10, play_style: form.style, area: form.area, availability: form.availability, bio: form.bio, avatar: form.avatar, elo_rating: 1000, games_played: 0, games_won: 0 });
      onComplete();
    } catch (e) { setErr(e.message || "Kunne ikke oprette profil."); } finally { setSubmitting(false); }
  };
  const steps = [
    <div key={0}><h2 style={{ fontFamily: fontDisplay, fontSize: "24px", fontWeight: 800, marginBottom: "6px" }}>Velkommen! 👋</h2><p style={{ color: theme.textMid, fontSize: "14px", marginBottom: "24px" }}>Lad os oprette din profil.</p><label style={{ fontSize: "13px", fontWeight: 600, display: "block", marginBottom: "6px" }}>Dit navn</label><input value={form.name} onChange={e => set("name", e.target.value)} placeholder="F.eks. Mikkel P." style={{ ...inputStyle, marginBottom: "16px" }} /><label style={{ fontSize: "13px", fontWeight: 600, display: "block", marginBottom: "6px" }}>Email</label><input value={form.email} onChange={e => set("email", e.target.value)} placeholder="din@email.dk" type="email" style={{ ...inputStyle, marginBottom: "16px" }} /><label style={{ fontSize: "13px", fontWeight: 600, display: "block", marginBottom: "6px" }}>Password</label><input value={form.password} onChange={e => set("password", e.target.value)} placeholder="Mindst 6 tegn" type="password" style={inputStyle} /></div>,
    <div key={1}><h2 style={{ fontFamily: fontDisplay, fontSize: "24px", fontWeight: 800, marginBottom: "6px" }}>Dit padel-niveau 🏓</h2><p style={{ color: theme.textMid, fontSize: "14px", marginBottom: "24px" }}>Vær ærlig — vi matcher dig bedre!</p><label style={{ fontSize: "13px", fontWeight: 600, display: "block", marginBottom: "8px" }}>Niveau</label><div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "20px" }}>{LEVELS.map(l => (<button key={l} onClick={() => set("level", l)} style={{ ...btn(form.level === l), textAlign: "left", padding: "12px 16px" }}>{l}</button>))}</div><label style={{ fontSize: "13px", fontWeight: 600, display: "block", marginBottom: "8px" }}>Spillestil</label><div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>{PLAY_STYLES.map(s => (<button key={s} onClick={() => set("style", s)} style={{ ...btn(form.style === s), padding: "10px 18px" }}>{s}</button>))}</div></div>,
    <div key={2}><h2 style={{ fontFamily: fontDisplay, fontSize: "24px", fontWeight: 800, marginBottom: "6px" }}>Hvor og hvornår? 📍</h2><p style={{ color: theme.textMid, fontSize: "14px", marginBottom: "24px" }}>Så vi kan finde makkere nær dig.</p><label style={{ fontSize: "13px", fontWeight: 600, display: "block", marginBottom: "8px" }}>Område</label><div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "20px" }}>{AREAS.map(a => (<button key={a} onClick={() => set("area", a)} style={{ ...btn(form.area === a), padding: "8px 16px", fontSize: "13px" }}>{a}</button>))}</div><label style={{ fontSize: "13px", fontWeight: 600, display: "block", marginBottom: "8px" }}>Hvornår kan du spille?</label><div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>{AVAILABILITY.map(a => (<button key={a} onClick={() => toggleAvail(a)} style={{ ...btn(form.availability.includes(a)), padding: "8px 16px", fontSize: "13px" }}>{a}</button>))}</div></div>,
    <div key={3}><h2 style={{ fontFamily: fontDisplay, fontSize: "24px", fontWeight: 800, marginBottom: "6px" }}>Sidste trin! 🎯</h2><p style={{ color: theme.textMid, fontSize: "14px", marginBottom: "24px" }}>Vælg avatar og skriv lidt om dig.</p><label style={{ fontSize: "13px", fontWeight: 600, display: "block", marginBottom: "8px" }}>Avatar</label><div style={{ display: "flex", gap: "10px", marginBottom: "20px", flexWrap: "wrap" }}>{avatars.map(a => (<button key={a} onClick={() => set("avatar", a)} style={{ width: "52px", height: "52px", borderRadius: "50%", fontSize: "24px", border: form.avatar === a ? "3px solid " + theme.accent : "2px solid " + theme.border, background: form.avatar === a ? theme.accentBg : theme.surface, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>{a}</button>))}</div><label style={{ fontSize: "13px", fontWeight: 600, display: "block", marginBottom: "6px" }}>Kort bio</label><textarea value={form.bio} onChange={e => set("bio", e.target.value)} placeholder="F.eks. 'Ny til padel, søger makkere...'" style={{ ...inputStyle, height: "80px", resize: "vertical" }} /></div>,
  ];
  return (
    <div style={{ maxWidth: "520px", margin: "0 auto", padding: "40px 24px" }}>
      <div style={{ display: "flex", gap: "6px", marginBottom: "32px" }}>{[0,1,2,3].map(i => (<div key={i} style={{ flex: 1, height: "4px", borderRadius: "4px", background: i <= step ? theme.accent : theme.border }} />))}</div>
      {steps[step]}
      {err && <p style={{ color: theme.red, fontSize: "13px", marginTop: "12px" }}>{err}</p>}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "32px" }}>
        {step > 0 ? <button onClick={() => setStep(s => s - 1)} style={btn(false)}>← Tilbage</button> : <button onClick={onBack} style={btn(false)}>← Tilbage</button>}
        {step < 3 ? <button onClick={() => canNext() && setStep(s => s + 1)} style={{ ...btn(true), opacity: canNext() ? 1 : 0.4 }}>Næste →</button> : <button onClick={finish} disabled={submitting} style={{ ...btn(true), opacity: submitting ? 0.6 : 1 }}>{submitting ? "Opretter..." : "Opret min profil 🎾"}</button>}
      </div>
    </div>
  );
}

function DashboardPage({ user, onLogout, showToast }) {
  const [tab, setTab] = useState("hjem");
  const tabs = [{ id: "hjem", label: "Hjem", icon: "🏠" }, { id: "makkere", label: "Find Makker", icon: "🤝" }, { id: "baner", label: "Baner", icon: "📍" }, { id: "kampe", label: "Kampe", icon: "⚔️" }, { id: "ranking", label: "Ranking", icon: "🏆" }];
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", borderBottom: "1px solid " + theme.border, background: theme.surface }}>
        <div style={{ fontFamily: fontDisplay, fontSize: "18px", fontWeight: 800, color: theme.accent }}>🎾 PadelMakker</div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}><span style={{ fontSize: "13px", color: theme.textMid }}>{user.full_name || user.name}</span><button onClick={onLogout} style={{ ...btn(false), padding: "6px 12px", fontSize: "12px" }}>Log ud</button></div>
      </div>
      <div style={{ display: "flex", gap: "4px", padding: "10px 16px", background: theme.surface, borderBottom: "1px solid " + theme.border, overflowX: "auto" }}>
        {tabs.map(t => (<button key={t.id} onClick={() => setTab(t.id)} style={{ background: tab === t.id ? theme.accentBg : "transparent", color: tab === t.id ? theme.accent : theme.textMid, border: "none", padding: "8px 16px", borderRadius: "8px", fontSize: "13px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", whiteSpace: "nowrap", fontFamily: font }}><span>{t.icon}</span>{t.label}</button>))}
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

function HomeTab({ user, setTab }) {
  const name = user.full_name || user.name || "Spiller";
  const level = user.level || 5;
  const games = user.games_played || 0;
  const wins = user.games_won || 0;
  return (
    <div>
      <h2 style={{ fontFamily: fontDisplay, fontSize: "26px", fontWeight: 800, marginBottom: "4px" }}>Hej {name.split(" ")[0]}! 👋</h2>
      <p style={{ color: theme.textMid, fontSize: "14px", marginBottom: "28px" }}>Klar til at spille?</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "12px", marginBottom: "28px" }}>
        {[{ label: "Niveau", value: level, color: theme.accent }, { label: "Kampe", value: games, color: theme.blue }, { label: "Sejre", value: wins, color: theme.warm }, { label: "Win %", value: games > 0 ? Math.round((wins / games) * 100) + "%" : "—", color: theme.accent }].map((s, i) => (<div key={i} style={{ background: theme.surface, borderRadius: theme.radius, padding: "20px", boxShadow: theme.shadow, textAlign: "center" }}><div style={{ fontSize: "28px", fontWeight: 800, color: s.color, fontFamily: fontDisplay }}>{s.value}</div><div style={{ fontSize: "12px", color: theme.textLight, marginTop: "4px" }}>{s.label}</div></div>))}
      </div>
      <div style={{ background: theme.surface, borderRadius: theme.radius, padding: "20px", boxShadow: theme.shadow, marginBottom: "28px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}><span style={{ fontSize: "14px", fontWeight: 600 }}>Din niveau-progression</span><span style={{ fontSize: "14px", fontWeight: 700, color: theme.accent }}>{level} / 10</span></div>
        <div style={{ background: theme.border, borderRadius: "6px", height: "10px", overflow: "hidden" }}><div style={{ width: (level / 10) * 100 + "%", height: "100%", background: "linear-gradient(90deg, " + theme.accent + ", " + theme.blue + ")", borderRadius: "6px" }} /></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        {[{ icon: "🤝", title: "Find en makker", desc: "Se ledige spillere", tab: "makkere" }, { icon: "📍", title: "Book en bane", desc: "Ledige tider", tab: "baner" }, { icon: "⚔️", title: "Åbne kampe", desc: "Tilmeld dig nu", tab: "kampe" }, { icon: "🏆", title: "Se ranking", desc: "Din placering", tab: "ranking" }].map((a, i) => (<button key={i} onClick={() => setTab(a.tab)} style={{ background: theme.surface, borderRadius: theme.radius, padding: "20px", boxShadow: theme.shadow, border: "1px solid " + theme.border, cursor: "pointer", textAlign: "left", fontFamily: font }}><div style={{ fontSize: "24px", marginBottom: "8px" }}>{a.icon}</div><div style={{ fontSize: "15px", fontWeight: 700, color: theme.text }}>{a.title}</div><div style={{ fontSize: "12px", color: theme.textLight }}>{a.desc}</div></button>))}
      </div>
    </div>
  );
}

function MakkereTab({ user, showToast }) {
  const [search, setSearch] = useState(""); const [filterLevel, setFilterLevel] = useState("all"); const [filterArea, setFilterArea] = useState("all");
  const [players, setPlayers] = useState([]); const [loadingPlayers, setLoadingPlayers] = useState(true);
  useEffect(() => { (async () => { try { const data = await Profile.filter(); setPlayers(data.filter(p => p.id !== user.id)); } catch (e) { console.error(e); } finally { setLoadingPlayers(false); } })(); }, [user.id]);
  const filtered = players.filter(p => { const n = p.full_name || p.name || ""; if (search && !n.toLowerCase().includes(search.toLowerCase())) return false; if (filterArea !== "all" && p.area !== filterArea) return false; if (filterLevel === "close" && Math.abs((p.level || 5) - (user.level || 5)) > 1.5) return false; return true; });
  if (loadingPlayers) return <div style={{ textAlign: "center", padding: "40px", color: theme.textLight }}>Indlæser spillere...</div>;
  return (
    <div>
      <h2 style={{ fontFamily: fontDisplay, fontSize: "24px", fontWeight: 800, marginBottom: "16px" }}>Find makker 🤝</h2>
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Søg efter navn..." style={{ ...inputStyle, marginBottom: "12px" }} />
      <div style={{ display: "flex", gap: "8px", marginBottom: "20px", flexWrap: "wrap" }}>
        <select value={filterLevel} onChange={e => setFilterLevel(e.target.value)} style={{ ...inputStyle, width: "auto", padding: "8px 12px", fontSize: "13px" }}><option value="all">Alle niveauer</option><option value="close">±1.5 af dit niveau</option></select>
        <select value={filterArea} onChange={e => setFilterArea(e.target.value)} style={{ ...inputStyle, width: "auto", padding: "8px 12px", fontSize: "13px" }}><option value="all">Alle områder</option>{AREAS.map(a => <option key={a} value={a}>{a}</option>)}</select>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {filtered.map(p => (<div key={p.id} style={{ background: theme.surface, borderRadius: theme.radius, padding: "18px", boxShadow: theme.shadow }}><div style={{ display: "flex", gap: "14px", alignItems: "center" }}><div style={{ width: "50px", height: "50px", borderRadius: "50%", background: theme.accentBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px", flexShrink: 0 }}>{p.avatar || "🎾"}</div><div style={{ flex: 1, minWidth: 0 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "4px" }}><span style={{ fontSize: "15px", fontWeight: 700 }}>{p.full_name || p.name}</span><span style={{ fontSize: "12px", color: theme.textLight }}>📍 {p.area || "?"}</span></div><div style={{ display: "flex", gap: "6px", marginTop: "6px", flexWrap: "wrap" }}><span style={tag(theme.accentBg, theme.accent)}>Lvl {p.level || "?"}</span><span style={tag(theme.blueBg, theme.blue)}>{p.play_style || "?"}</span><span style={tag(theme.warmBg, theme.warm)}>{p.games_played || 0} kampe</span></div>{p.bio && <p style={{ fontSize: "12px", color: theme.textMid, marginTop: "8px", lineHeight: 1.4 }}>{p.bio}</p>}</div></div><div style={{ display: "flex", gap: "8px", marginTop: "14px", justifyContent: "flex-end" }}><button onClick={() => showToast("Besked sendt! 💬")} style={{ ...btn(false), padding: "8px 16px", fontSize: "12px" }}>💬 Skriv</button><button onClick={() => showToast("Invitation sendt! 🎾")} style={{ ...btn(true), padding: "8px 16px", fontSize: "12px" }}>Invitér</button></div></div>))}
        {filtered.length === 0 && <div style={{ textAlign: "center", padding: "40px", color: theme.textLight }}>🔍 Ingen spillere fundet.</div>}
      </div>
    </div>
  );
}

function BanerTab({ showToast }) {
  const [filterType, setFilterType] = useState("all"); const [sortBy, setSortBy] = useState("price");
  const [courts, setCourts] = useState([]); const [slots, setSlots] = useState({}); const [loadingCourts, setLoadingCourts] = useState(true);
  useEffect(() => { (async () => { try { const [cd, sd] = await Promise.all([Court.filter(), CourtSlot.filter()]); setCourts(cd || []); const today = new Date().toISOString().split("T")[0]; const g = {}; (sd || []).forEach(s => { if (!s.is_booked && s.date >= today) { if (!g[s.court_id]) g[s.court_id] = []; g[s.court_id].push(s); } }); setSlots(g); } catch (e) { console.error(e); } finally { setLoadingCourts(false); } })(); }, []);
  let filtered = [...courts]; if (filterType === "indoor") filtered = filtered.filter(c => c.is_indoor); if (filterType === "outdoor") filtered = filtered.filter(c => !c.is_indoor); if (sortBy === "price") filtered.sort((a, b) => (a.price_per_hour || 0) - (b.price_per_hour || 0)); if (sortBy === "rating") filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  if (loadingCourts) return <div style={{ textAlign: "center", padding: "40px", color: theme.textLight }}>Indlæser baner...</div>;
  return (
    <div>
      <h2 style={{ fontFamily: fontDisplay, fontSize: "24px", fontWeight: 800, marginBottom: "16px" }}>Padelbaner 📍</h2>
      <div style={{ display: "flex", gap: "8px", marginBottom: "20px", flexWrap: "wrap" }}>
        {[["all","Alle"],["indoor","Indoor"],["outdoor","Outdoor"]].map(([v,l]) => (<button key={v} onClick={() => setFilterType(v)} style={{ ...btn(filterType === v), padding: "8px 16px", fontSize: "13px" }}>{l}</button>))}
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ ...inputStyle, width: "auto", padding: "8px 12px", fontSize: "13px", marginLeft: "auto" }}><option value="price">Pris</option><option value="rating">Rating</option></select>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {filtered.map(c => { const cs = slots[c.id] || []; const times = [...new Set(cs.map(s => s.time))].sort().slice(0, 8); return (
          <div key={c.id} style={{ background: theme.surface, borderRadius: theme.radius, padding: "20px", boxShadow: theme.shadow }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}><div><div style={{ fontSize: "16px", fontWeight: 700 }}>{c.name}</div><div style={{ fontSize: "12px", color: theme.textLight, marginTop: "2px" }}>{c.address}</div></div><span style={tag(c.is_indoor ? theme.blueBg : theme.warmBg, c.is_indoor ? theme.blue : theme.warm)}>{c.is_indoor ? "Indoor" : "Outdoor"}</span></div>
            <div style={{ display: "flex", gap: "12px", marginBottom: "14px", fontSize: "13px", color: theme.textMid }}><span>⭐ {c.rating || "—"}</span><span>💰 {c.price_per_hour} kr/t</span><span>🕐 {cs.length} ledige</span></div>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "12px" }}>{times.length > 0 ? times.map(t => (<button key={t} onClick={async () => { try { await Booking.create({ court_id: c.id, date: new Date().toISOString().split("T")[0], time_slot: t, price: c.price_per_hour, court_name: c.name, status: "confirmed" }); showToast("Booket kl. " + t + "! ✅"); } catch (e) { showToast("Fejl: " + (e.message || "Prøv igen")); } }} style={{ background: theme.accentBg, color: theme.accent, border: "none", padding: "7px 14px", borderRadius: "8px", fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: font }}>{t}</button>)) : <span style={{ fontSize: "12px", color: theme.textLight }}>Ingen ledige tider</span>}</div>
          </div>); })}
      </div>
    </div>
  );
}

function KampeTab({ user, showToast }) {
  const [showCreate, setShowCreate] = useState(false); const [courts, setCourts] = useState([]); const [matches, setMatches] = useState([]); const [matchPlayers, setMatchPlayers] = useState({}); const [profiles, setProfiles] = useState({}); const [loadingMatches, setLoadingMatches] = useState(true); const [creating, setCreating] = useState(false);
  const [newMatch, setNewMatch] = useState({ court_id: "", date: new Date().toISOString().split("T")[0], time: "18:00", level_range: "4-6" });
  useEffect(() => { loadData(); }, []);
  const loadData = async () => { try { const [cd, md, ap] = await Promise.all([Court.filter(), Match.filter(), Profile.filter()]); setCourts(cd || []); setMatches((md || []).filter(m => m.status === "open")); if (cd?.length > 0 && !newMatch.court_id) setNewMatch(m => ({ ...m, court_id: cd[0].id })); const pm = {}; (ap || []).forEach(p => { pm[p.id] = p; }); setProfiles(pm); const { data: mpd } = await supabase.from("match_players").select("*"); const mm = {}; (mpd || []).forEach(mp => { if (!mm[mp.match_id]) mm[mp.match_id] = []; mm[mp.match_id].push(mp); }); setMatchPlayers(mm); } catch (e) { console.error(e); } finally { setLoadingMatches(false); } };
  const createMatch = async () => { setCreating(true); try { const court = courts.find(c => c.id === newMatch.court_id); const { data: created, error } = await supabase.from("matches").insert({ creator_id: user.id, court_id: newMatch.court_id, court_name: court?.name || "", date: newMatch.date, time: newMatch.time, level_range: newMatch.level_range, status: "open", max_players: 4, current_players: 1 }).select().single(); if (error) throw error; await supabase.from("match_players").insert({ match_id: created.id, user_id: user.id, user_name: user.full_name || user.name, user_email: user.email, user_emoji: user.avatar || "🎾" }); setShowCreate(false); showToast("Kamp oprettet! 🎾"); await loadData(); } catch (e) { showToast("Fejl: " + (e.message || "Prøv igen")); } finally { setCreating(false); } };
  const joinMatch = async (matchId) => { try { const { error } = await supabase.from("match_players").insert({ match_id: matchId, user_id: user.id, user_name: user.full_name || user.name, user_email: user.email, user_emoji: user.avatar || "🎾" }); if (error) throw error; showToast("Du er tilmeldt! ⚔️"); await loadData(); } catch (e) { showToast("Fejl: " + (e.message || "Prøv igen")); } };
  if (loadingMatches) return <div style={{ textAlign: "center", padding: "40px", color: theme.textLight }}>Indlæser kampe...</div>;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}><h2 style={{ fontFamily: fontDisplay, fontSize: "24px", fontWeight: 800 }}>Kampe ⚔️</h2><button onClick={() => setShowCreate(!showCreate)} style={btn(true)}>{showCreate ? "Annullér" : "+ Opret kamp"}</button></div>
      {showCreate && (<div style={{ background: theme.surface, borderRadius: theme.radius, padding: "20px", boxShadow: theme.shadow, marginBottom: "20px", border: "2px solid " + theme.accent + "30" }}><h3 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "16px" }}>Opret ny kamp</h3><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}><div><label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>Bane</label><select value={newMatch.court_id} onChange={e => setNewMatch(m => ({ ...m, court_id: e.target.value }))} style={{ ...inputStyle, fontSize: "13px" }}>{courts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div><div><label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>Niveau</label><select value={newMatch.level_range} onChange={e => setNewMatch(m => ({ ...m, level_range: e.target.value }))} style={{ ...inputStyle, fontSize: "13px" }}>{["1-3","2-4","3-5","4-6","5-7","6-8","7-9","8-10"].map(r => <option key={r} value={r}>{r}</option>)}</select></div><div><label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>Dato</label><input type="date" value={newMatch.date} onChange={e => setNewMatch(m => ({ ...m, date: e.target.value }))} style={{ ...inputStyle, fontSize: "13px" }} /></div><div><label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>Tid</label><input type="time" value={newMatch.time} onChange={e => setNewMatch(m => ({ ...m, time: e.target.value }))} style={{ ...inputStyle, fontSize: "13px" }} /></div></div><button onClick={createMatch} disabled={creating} style={{ ...btn(true), marginTop: "16px", width: "100%", opacity: creating ? 0.6 : 1 }}>{creating ? "Opretter..." : "Opret kamp"}</button></div>)}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {matches.map(m => { const mp = matchPlayers[m.id] || []; const left = (m.max_players || 4) - mp.length; const joined = mp.some(p => p.user_id === user.id); return (
          <div key={m.id} style={{ background: theme.surface, borderRadius: theme.radius, padding: "20px", boxShadow: theme.shadow }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}><div><div style={{ fontSize: "16px", fontWeight: 700 }}>{m.date} kl. {(m.time || "").slice(0, 5)}</div><div style={{ fontSize: "12px", color: theme.textLight }}>{m.court_name}</div></div><span style={tag(left > 0 ? theme.accentBg : theme.redBg, left > 0 ? theme.accent : theme.red)}>{left > 0 ? left + " ledig" + (left > 1 ? "e" : "") : "Fuld"}</span></div>
            <div style={{ display: "flex", gap: "6px", marginBottom: "12px" }}><span style={tag(theme.accentBg, theme.accent)}>Niveau {m.level_range}</span><span style={tag(theme.blueBg, theme.blue)}>{mp.length}/{m.max_players || 4}</span></div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "12px" }}>{mp.map(p => (<div key={p.id || p.user_id} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}><div style={{ width: "38px", height: "38px", borderRadius: "50%", background: theme.accentBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px" }}>{p.user_emoji || "🎾"}</div><span style={{ fontSize: "10px", color: theme.textLight, marginTop: "2px" }}>{(p.user_name || "?").split(" ")[0]}</span></div>))}{Array.from({ length: Math.max(0, left) }).map((_, i) => (<div key={"e" + i} style={{ width: "38px", height: "38px", borderRadius: "50%", border: "2px dashed " + theme.border, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", color: theme.textLight }}>?</div>))}</div>
            {left > 0 && !joined && <button onClick={() => joinMatch(m.id)} style={{ ...btn(true), width: "100%", fontSize: "13px" }}>Tilmeld mig</button>}
            {joined && <div style={{ textAlign: "center", fontSize: "13px", color: theme.accent, fontWeight: 600 }}>✅ Tilmeldt</div>}
          </div>); })}
        {matches.length === 0 && <div style={{ textAlign: "center", padding: "40px", color: theme.textLight }}>⚔️ Ingen åbne kampe. Opret den første!</div>}
      </div>
    </div>
  );
}

function RankingTab({ user }) {
  const [players, setPlayers] = useState([]); const [loadingRanking, setLoadingRanking] = useState(true);
  useEffect(() => { (async () => { try { const data = await Profile.filter(); setPlayers(data || []); } catch (e) { console.error(e); } finally { setLoadingRanking(false); } })(); }, []);
  const sorted = [...players].sort((a, b) => (b.elo_rating || b.level || 0) - (a.elo_rating || a.level || 0));
  const userRank = sorted.findIndex(p => p.id === user.id) + 1;
  const rating = user.elo_rating || user.level || 5;
  if (loadingRanking) return <div style={{ textAlign: "center", padding: "40px", color: theme.textLight }}>Indlæser ranking...</div>;
  return (
    <div>
      <h2 style={{ fontFamily: fontDisplay, fontSize: "24px", fontWeight: 800, marginBottom: "20px" }}>Ranking 🏆</h2>
      <div style={{ background: "linear-gradient(135deg, " + theme.accent + ", #0D5C3A)", borderRadius: theme.radius, padding: "24px", marginBottom: "24px", color: "#fff" }}>
        <div style={{ fontSize: "12px", opacity: 0.8, marginBottom: "6px" }}>Din placering</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><div><span style={{ fontFamily: fontDisplay, fontSize: "40px", fontWeight: 800 }}>#{userRank || "—"}</span><span style={{ fontSize: "14px", marginLeft: "8px", opacity: 0.8 }}>af {sorted.length}</span></div><div style={{ textAlign: "right" }}><div style={{ fontFamily: fontDisplay, fontSize: "24px", fontWeight: 800 }}>{rating}</div><div style={{ fontSize: "11px", opacity: 0.8 }}>ELO</div></div></div>
        <div style={{ marginTop: "14px", background: "rgba(255,255,255,0.2)", borderRadius: "6px", height: "8px" }}><div style={{ width: Math.min((rating / 2000) * 100, 100) + "%", height: "100%", background: theme.warm, borderRadius: "6px" }} /></div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        {sorted.map((p, i) => { const me = p.id === user.id; const r = p.elo_rating || p.level || 0; return (
          <div key={p.id} style={{ background: me ? theme.accentBg : theme.surface, borderRadius: "12px", padding: "14px 16px", boxShadow: me ? "none" : theme.shadow, display: "flex", alignItems: "center", gap: "12px", border: me ? "2px solid " + theme.accent + "40" : "1px solid " + theme.border }}>
            <div style={{ width: "30px", textAlign: "center", fontSize: i < 3 ? "18px" : "14px", fontWeight: 700, color: i < 3 ? [theme.warm, theme.textLight, "#B87333"][i] : theme.textLight }}>{i < 3 ? ["🥇","🥈","🥉"][i] : i + 1}</div>
            <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: me ? theme.accent + "20" : theme.accentBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px" }}>{p.avatar || "🎾"}</div>
            <div style={{ flex: 1 }}><div style={{ fontSize: "14px", fontWeight: me ? 700 : 600 }}>{p.full_name || p.name}{me ? " (dig)" : ""}</div><div style={{ fontSize: "11px", color: theme.textLight }}>{p.area || "?"} · {p.games_played || 0} kampe</div></div>
            <div style={{ fontFamily: fontDisplay, fontSize: "18px", fontWeight: 800, color: theme.accent }}>{r}</div>
          </div>); })}
      </div>
    </div>
  );
}
