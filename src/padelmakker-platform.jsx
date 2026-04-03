import { useState, useEffect } from "react";
import { useAuth } from "./lib/AuthContext";
import { Profile, Court, CourtSlot, Match, Booking } from "./api/base44Client";
import { supabase } from "./lib/supabase";
import {
  Home, Users, MapPin, Swords, Trophy,
  UserPlus, TrendingUp, MessageCircle, Search,
  LogOut, Plus, Star, Clock, Building2, Sun, ArrowRight,
} from "lucide-react";

const LEVELS      = ["1-2 (Helt ny)", "3-4 (Begynder)", "5-6 (Øvet)", "7-8 (Avanceret)", "9-10 (Elite)"];
const PLAY_STYLES = ["Offensiv", "Defensiv", "Alround", "Ved ikke endnu"];
const AREAS       = ["København", "Frederiksberg", "Amager", "Herlev", "Taastrup", "Østerbro", "Nørrebro", "Vesterbro", "Aarhus", "Odense"];
const AVAILABILITY = ["Morgener", "Formiddage", "Eftermiddage", "Aftener", "Weekender", "Flexibel"];

/* ─── Design tokens (mirrors variables.css) ─── */
const font = "'Inter', sans-serif";
const theme = {
  bg:          "#F6F8FA",
  surface:     "#FFFFFF",
  text:        "#0F172A",
  textMid:     "#475569",
  textLight:   "#94A3B8",
  accent:      "#166534",
  accentHover: "#14532D",
  accentBg:    "#DCFCE7",
  warm:        "#D97706",
  warmBg:      "#FEF3C7",
  blue:        "#2563EB",
  blueBg:      "#EFF6FF",
  red:         "#DC2626",
  redBg:       "#FEF2F2",
  border:      "#E2E8F0",
  shadow:      "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)",
  shadowLg:    "0 8px 32px rgba(0,0,0,0.12)",
  radius:      "10px",
};

/* ─── Shared style helpers ─── */
const btn = (primary) => ({
  fontFamily: font,
  fontSize: "14px",
  fontWeight: 600,
  padding: "10px 20px",
  borderRadius: "8px",
  border: primary ? "none" : "1px solid " + theme.border,
  background: primary ? theme.accent : theme.surface,
  color: primary ? "#fff" : theme.text,
  cursor: "pointer",
  transition: "opacity 0.15s, box-shadow 0.15s",
  letterSpacing: "-0.01em",
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
});

const inputStyle = {
  fontFamily: font,
  fontSize: "14px",
  padding: "10px 14px",
  borderRadius: "8px",
  border: "1px solid " + theme.border,
  background: theme.surface,
  color: theme.text,
  width: "100%",
  boxSizing: "border-box",
  outline: "none",
  transition: "border-color 0.15s",
};

const tag = (bg, color) => ({
  fontSize: "10px",
  fontWeight: 700,
  padding: "2px 7px",
  borderRadius: "4px",
  background: bg,
  color: color,
  display: "inline-flex",
  alignItems: "center",
  gap: "3px",
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  whiteSpace: "nowrap",
});

const labelStyle = {
  fontSize: "12px",
  fontWeight: 600,
  display: "block",
  marginBottom: "5px",
  color: theme.textMid,
  letterSpacing: "0.01em",
};

const heading = (size = "24px") => ({
  fontFamily: font,
  fontSize: size,
  fontWeight: 800,
  letterSpacing: "-0.03em",
  color: theme.text,
});

/* ─── Utility ─── */
function resolveDisplayName(profileRow, authUser) {
  const bad = (s) => {
    if (s == null || String(s).trim() === "") return true;
    const t = String(s).trim().toLowerCase();
    return t === "ny spiller" || t === "ny";
  };
  const fromProfile = profileRow?.full_name || profileRow?.name;
  if (fromProfile && !bad(fromProfile)) return String(fromProfile).trim();
  const meta = authUser?.user_metadata?.full_name || authUser?.user_metadata?.name;
  if (meta && !bad(meta)) return String(meta).trim();
  return authUser?.email?.split("@")[0] || "Spiller";
}

/* ═══════════════════════════════════════════════════
   ROOT
═══════════════════════════════════════════════════ */
export default function PadelMakker() {
  const { user, profile, loading, profileLoading, signOut } = useAuth();
  const [toast, setToast] = useState(null);
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3000); };
  const handleLogout = async () => { await signOut(); };

  if (loading || (user && profileLoading)) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100dvh", background: theme.bg, padding: "env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)" }}>
        <div className="pm-spinner" />
      </div>
    );
  }

  return (
    <div className="pm-root" style={{ fontFamily: font, background: theme.bg, minHeight: "100dvh", color: theme.text, position: "relative" }}>
      {toast && (
        <div className="pm-toast" style={{ position: "fixed", top: "max(12px, env(safe-area-inset-top))", left: "50%", transform: "translateX(-50%)", background: theme.accent, color: "#fff", padding: "11px 22px", borderRadius: "10px", fontSize: "13px", fontWeight: 600, zIndex: 9999, boxShadow: theme.shadowLg, letterSpacing: "-0.01em" }}>
          {toast}
        </div>
      )}
      {user && profile
        ? <DashboardPage user={profile} onLogout={handleLogout} showToast={showToast} />
        : <PublicPages showToast={showToast} />
      }
    </div>
  );
}

function PublicPages({ showToast }) {
  const [page, setPage] = useState("landing");
  return (
    <>
      {page === "landing"    && <LandingPage    onGetStarted={() => setPage("onboarding")} onLogin={() => setPage("login")} />}
      {page === "onboarding" && <OnboardingPage onComplete={() => showToast("Velkommen til PadelMakker! 🎾")} onBack={() => setPage("landing")} />}
      {page === "login"      && <LoginPage      onBack={() => setPage("landing")} />}
    </>
  );
}

/* ═══════════════════════════════════════════════════
   LANDING PAGE
═══════════════════════════════════════════════════ */
function LandingPage({ onGetStarted, onLogin }) {
  const steps = [
    { step: "01", icon: <UserPlus  size={22} color={theme.accent} />, title: "Opret profil", desc: "Angiv dit niveau og område." },
    { step: "02", icon: <Users     size={22} color={theme.accent} />, title: "Find makker",  desc: "Se spillere nær dig på dit niveau." },
    { step: "03", icon: <MapPin    size={22} color={theme.accent} />, title: "Book bane",    desc: "Find ledige baner og book direkte." },
    { step: "04", icon: <TrendingUp size={22} color={theme.accent} />, title: "Rank op",     desc: "Se din ranking stige." },
  ];

  return (
    <div className="pm-landing">
      {/* Nav */}
      <nav className="pm-landing-nav" style={{ padding: "clamp(14px, 3vw, 18px) clamp(16px, 4vw, 24px)", maxWidth: "1100px", margin: "0 auto" }}>
        <div style={{ ...heading("clamp(17px,4.5vw,20px)"), color: theme.accent }}>🎾 PadelMakker</div>
        <div className="pm-landing-nav-actions">
          <button onClick={onLogin}       style={btn(false)}>Log ind</button>
          <button onClick={onGetStarted}  style={btn(true)}>Kom i gang</button>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ maxWidth: "1100px", margin: "0 auto", padding: "clamp(48px,10vw,88px) clamp(16px,4vw,24px) clamp(40px,8vw,64px)", textAlign: "center" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: theme.accentBg, color: theme.accent, fontSize: "12px", fontWeight: 600, padding: "5px 14px", borderRadius: "20px", marginBottom: "28px", border: "1px solid " + theme.accent + "25", letterSpacing: "0.02em" }}>
          🇩🇰 Danmarks padel-platform
        </div>
        <h1 style={{ ...heading("clamp(36px,6.5vw,68px)"), lineHeight: 1.04, letterSpacing: "-0.04em", marginBottom: "20px" }}>
          Find makker.<br />Book bane.<br /><span style={{ color: theme.accent }}>Spil padel.</span>
        </h1>
        <p style={{ fontSize: "clamp(15px,3.8vw,17px)", color: theme.textMid, maxWidth: "440px", margin: "0 auto clamp(32px,6vw,44px)", lineHeight: 1.65 }}>
          Stop med at søge i Facebook-grupper. PadelMakker matcher dig med spillere på dit niveau.
        </p>
        <button onClick={onGetStarted} style={{ ...btn(true), fontSize: "15px", padding: "13px 30px", borderRadius: "9px" }}>
          Opret gratis profil <ArrowRight size={16} />
        </button>
      </section>

      {/* How it works */}
      <section style={{ maxWidth: "1100px", margin: "0 auto", padding: "0 clamp(16px,4vw,24px) clamp(56px,12vw,80px)" }}>
        <div style={{ textAlign: "center", marginBottom: "clamp(24px,6vw,40px)" }}>
          <p style={{ fontSize: "11px", fontWeight: 700, color: theme.accent, letterSpacing: "0.10em", textTransform: "uppercase", marginBottom: "8px" }}>Sådan virker det</p>
          <h2 style={{ ...heading("clamp(22px,5vw,28px)"), letterSpacing: "-0.025em" }}>Fra profil til bane på minutter</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%,220px),1fr))", gap: "12px" }}>
          {steps.map(s => (
            <div key={s.step} style={{ background: theme.surface, borderRadius: theme.radius, padding: "28px 22px", boxShadow: theme.shadow, border: "1px solid " + theme.border }}>
              <div style={{ fontSize: "11px", fontWeight: 700, color: theme.textLight, marginBottom: "14px", letterSpacing: "0.08em" }}>{s.step}</div>
              <div style={{ width: "44px", height: "44px", borderRadius: "8px", background: theme.accentBg, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "14px" }}>
                {s.icon}
              </div>
              <div style={{ fontSize: "16px", fontWeight: 700, marginBottom: "6px", letterSpacing: "-0.01em", color: theme.text }}>{s.title}</div>
              <div style={{ fontSize: "13px", color: theme.textMid, lineHeight: 1.55 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Stats banner */}
      <section style={{ background: theme.accent, padding: "clamp(32px,8vw,52px) clamp(16px,4vw,24px)" }}>
        <div style={{ maxWidth: "800px", margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,140px),1fr))", gap: "20px", textAlign: "center" }}>
          {[{ n: "200+", l: "Aktive spillere" }, { n: "6", l: "Baner i København" }, { n: "50+", l: "Kampe ugentligt" }, { n: "4.7", l: "Gennemsnitlig rating" }].map((s, i) => (
            <div key={i}>
              <div style={{ fontFamily: font, fontSize: "clamp(28px,7vw,40px)", fontWeight: 800, color: "#fff", letterSpacing: "-0.03em" }}>{s.n}</div>
              <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.70)", marginTop: "4px" }}>{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      <footer className="pm-landing-footer" style={{ maxWidth: "1100px", margin: "0 auto", padding: "clamp(24px,6vw,36px) clamp(16px,4vw,24px)", fontSize: "13px", color: theme.textLight }}>
        <span style={{ fontWeight: 500 }}>© 2026 PadelMakker</span>
        <span>kontakt@padelmakker.dk</span>
      </footer>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   LOGIN
═══════════════════════════════════════════════════ */
function LoginPage({ onBack }) {
  const { signIn } = useAuth();
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [err, setErr]             = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) { setErr("Indtast email og adgangskode"); return; }
    setSubmitting(true); setErr("");
    try {
      await signIn(email.trim(), password);
    } catch (e) {
      setErr(e.message || "Login fejlede. Tjek email og adgangskode.");
      setSubmitting(false);
    }
  };

  return (
    <div className="pm-auth-narrow">
      <button onClick={onBack} style={{ ...btn(false), marginBottom: "40px", padding: "8px 14px", fontSize: "13px" }}>← Tilbage</button>
      <h1 style={{ ...heading("28px"), marginBottom: "6px" }}>Velkommen tilbage</h1>
      <p style={{ color: theme.textMid, fontSize: "14px", marginBottom: "28px", lineHeight: 1.5 }}>Log ind med din email og adgangskode.</p>
      <label style={labelStyle}>Email</label>
      <input value={email} onChange={e => { setEmail(e.target.value); setErr(""); }} placeholder="din@email.dk" style={{ ...inputStyle, marginBottom: "14px" }} />
      <label style={labelStyle}>Adgangskode</label>
      <input value={password} onChange={e => { setPassword(e.target.value); setErr(""); }} placeholder="••••••••" type="password" style={{ ...inputStyle, marginBottom: "14px" }} />
      {err && <p style={{ color: theme.red, fontSize: "13px", marginBottom: "14px" }}>{err}</p>}
      <button onClick={handleLogin} disabled={submitting} style={{ ...btn(true), width: "100%", justifyContent: "center" }}>
        {submitting ? "Logger ind..." : "Log ind"}
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   ONBOARDING
═══════════════════════════════════════════════════ */
function OnboardingPage({ onComplete, onBack }) {
  const { signUp } = useAuth();
  const [step, setStep]           = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr]             = useState("");
  const [form, setForm]           = useState({ name: "", email: "", password: "", level: "", style: "", area: "", availability: [], bio: "", avatar: "🎾" });
  const avatars = ["🎾", "👨", "👩", "🧔", "👩‍🦰", "👨‍🦱", "👩‍🦱", "🧑"];

  const set        = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const toggleAvail = (a) => setForm(f => ({ ...f, availability: f.availability.includes(a) ? f.availability.filter(x => x !== a) : [...f.availability, a] }));
  const canNext = () => {
    if (step === 0) return form.name.trim() && form.email.trim() && form.password.trim();
    if (step === 1) return form.level && form.style;
    if (step === 2) return form.area && form.availability.length > 0;
    return true;
  };

  const finish = async () => {
    setSubmitting(true); setErr("");
    try {
      const levelNum = parseFloat(form.level.match(/\d+/)?.[0] || "5") + Math.random() * 1.5;
      await signUp(form.email.trim(), form.password, {
        full_name: form.name, level: Math.round(levelNum * 10) / 10,
        play_style: form.style, area: form.area, availability: form.availability,
        bio: form.bio, avatar: form.avatar, elo_rating: 1000, games_played: 0, games_won: 0,
      });
      if (onComplete) onComplete();
    } catch (e) {
      setErr(e.message || "Kunne ikke oprette profil.");
      setSubmitting(false);
    }
  };

  const selBtn = (active) => ({ ...btn(active), textAlign: "left", padding: "11px 16px" });

  const steps = [
    <div key={0}>
      <h2 style={{ ...heading("24px"), marginBottom: "6px" }}>Velkommen! 👋</h2>
      <p style={{ color: theme.textMid, fontSize: "14px", marginBottom: "28px", lineHeight: 1.5 }}>Lad os oprette din profil.</p>
      <label style={labelStyle}>Dit navn</label>
      <input value={form.name}     onChange={e => set("name", e.target.value)}     placeholder="F.eks. Mikkel P."  style={{ ...inputStyle, marginBottom: "14px" }} />
      <label style={labelStyle}>Email</label>
      <input value={form.email}    onChange={e => set("email", e.target.value)}    placeholder="din@email.dk"      type="email"    style={{ ...inputStyle, marginBottom: "14px" }} />
      <label style={labelStyle}>Adgangskode</label>
      <input value={form.password} onChange={e => set("password", e.target.value)} placeholder="Mindst 6 tegn"     type="password" style={inputStyle} />
    </div>,

    <div key={1}>
      <h2 style={{ ...heading("24px"), marginBottom: "6px" }}>Dit padel-niveau</h2>
      <p style={{ color: theme.textMid, fontSize: "14px", marginBottom: "24px", lineHeight: 1.5 }}>Vær ærlig — vi matcher dig bedre!</p>
      <label style={labelStyle}>Niveau</label>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "20px" }}>
        {LEVELS.map(l => <button key={l} onClick={() => set("level", l)} style={selBtn(form.level === l)}>{l}</button>)}
      </div>
      <label style={labelStyle}>Spillestil</label>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        {PLAY_STYLES.map(s => <button key={s} onClick={() => set("style", s)} style={{ ...selBtn(form.style === s) }}>{s}</button>)}
      </div>
    </div>,

    <div key={2}>
      <h2 style={{ ...heading("24px"), marginBottom: "6px" }}>Hvor og hvornår?</h2>
      <p style={{ color: theme.textMid, fontSize: "14px", marginBottom: "24px", lineHeight: 1.5 }}>Så vi kan finde makkere nær dig.</p>
      <label style={labelStyle}>Område</label>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "20px" }}>
        {AREAS.map(a => <button key={a} onClick={() => set("area", a)} style={{ ...btn(form.area === a), padding: "8px 14px", fontSize: "13px" }}>{a}</button>)}
      </div>
      <label style={labelStyle}>Hvornår kan du spille?</label>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        {AVAILABILITY.map(a => <button key={a} onClick={() => toggleAvail(a)} style={{ ...btn(form.availability.includes(a)), padding: "8px 14px", fontSize: "13px" }}>{a}</button>)}
      </div>
    </div>,

    <div key={3}>
      <h2 style={{ ...heading("24px"), marginBottom: "6px" }}>Næsten færdig!</h2>
      <p style={{ color: theme.textMid, fontSize: "14px", marginBottom: "24px", lineHeight: 1.5 }}>Vælg avatar og skriv lidt om dig.</p>
      <label style={labelStyle}>Avatar</label>
      <div style={{ display: "flex", gap: "8px", marginBottom: "20px", flexWrap: "wrap" }}>
        {avatars.map(a => (
          <button key={a} onClick={() => set("avatar", a)} style={{ width: "48px", height: "48px", borderRadius: "50%", fontSize: "22px", border: form.avatar === a ? "2px solid " + theme.accent : "1px solid " + theme.border, background: form.avatar === a ? theme.accentBg : theme.surface, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}>{a}</button>
        ))}
      </div>
      <label style={labelStyle}>Kort bio</label>
      <textarea value={form.bio} onChange={e => set("bio", e.target.value)} placeholder="F.eks. 'Ny til padel, søger makkere...'" style={{ ...inputStyle, height: "80px", resize: "vertical" }} />
    </div>,
  ];

  return (
    <div className="pm-auth-wide">
      <div style={{ display: "flex", gap: "6px", marginBottom: "32px" }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{ flex: 1, height: "3px", borderRadius: "3px", background: i <= step ? theme.accent : theme.border, transition: "background 0.3s" }} />
        ))}
      </div>
      {steps[step]}
      {err && <p style={{ color: theme.red, fontSize: "13px", marginTop: "12px" }}>{err}</p>}
      <div className="pm-onboarding-actions">
        <button onClick={step > 0 ? () => setStep(s => s - 1) : onBack} style={btn(false)}>← Tilbage</button>
        {step < 3
          ? <button onClick={() => canNext() && setStep(s => s + 1)} style={{ ...btn(true), opacity: canNext() ? 1 : 0.4 }}>Næste <ArrowRight size={15} /></button>
          : <button onClick={finish} disabled={submitting} style={btn(true)}>{submitting ? "Opretter..." : "Opret profil"}</button>
        }
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   DASHBOARD SHELL
═══════════════════════════════════════════════════ */
function DashboardPage({ user, onLogout, showToast }) {
  const { user: authUser } = useAuth();
  const displayName = resolveDisplayName(user, authUser);
  const [tab, setTab] = useState("hjem");

  const tabs = [
    { id: "hjem",    label: "Hjem",        icon: <Home    size={16} /> },
    { id: "makkere", label: "Find Makker", icon: <Users   size={16} /> },
    { id: "baner",   label: "Baner",       icon: <MapPin  size={16} /> },
    { id: "kampe",   label: "Kampe",       icon: <Swords  size={16} /> },
    { id: "ranking", label: "Ranking",     icon: <Trophy  size={16} /> },
  ];

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", paddingBottom: "env(safe-area-inset-bottom)" }}>
      {/* Header */}
      <div className="pm-dash-header" style={{ padding: "clamp(10px,2.5vw,14px) clamp(12px,3vw,20px)", borderBottom: "1px solid " + theme.border, background: theme.surface, position: "sticky", top: 0, zIndex: 20 }}>
        <div className="pm-dash-brand" style={{ ...heading("clamp(16px,4vw,18px)"), color: theme.accent }}>🎾 PadelMakker</div>
        <div className="pm-dash-user">
          <span className="pm-dash-name">{displayName}</span>
          <button onClick={onLogout} style={{ ...btn(false), padding: "6px 12px", fontSize: "12px", flexShrink: 0 }}>
            <LogOut size={13} /> Log ud
          </button>
        </div>
      </div>

      {/* Tab strip */}
      <div className="pm-tab-strip" style={{ background: theme.surface, borderBottom: "1px solid " + theme.border }}>
        {tabs.map(t => (
          <button key={t.id} type="button" title={t.label} aria-label={t.label} onClick={() => setTab(t.id)} style={{ background: tab === t.id ? theme.accentBg : "transparent", color: tab === t.id ? theme.accent : theme.textMid, border: "none", padding: "8px 12px", borderRadius: "7px", fontSize: "clamp(12px,3.2vw,13px)", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", whiteSpace: "nowrap", fontFamily: font, flexShrink: 0, transition: "all 0.15s", letterSpacing: "-0.01em" }}>
            <span aria-hidden style={{ display: "flex" }}>{t.icon}</span>
            <span className="pm-tab-label">{t.label}</span>
          </button>
        ))}
      </div>

      <div className="pm-dash-main">
        {tab === "hjem"    && <HomeTab    user={user} setTab={setTab} />}
        {tab === "makkere" && <MakkereTab user={user} showToast={showToast} />}
        {tab === "baner"   && <BanerTab   showToast={showToast} />}
        {tab === "kampe"   && <KampeTab   user={user} showToast={showToast} />}
        {tab === "ranking" && <RankingTab user={user} />}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   HOME TAB
═══════════════════════════════════════════════════ */
function HomeTab({ user, setTab }) {
  const { user: authUser } = useAuth();
  const displayName = resolveDisplayName(user, authUser);
  const firstName   = displayName.split(/\s+/)[0];
  const games       = user.games_played || 0;
  const wins        = user.games_won    || 0;
  const elo         = Math.round(Number(user.elo_rating) || 1000);
  const eloBarPct   = Math.min(Math.max((elo / 2000) * 100, 0), 100);

  const actions = [
    { icon: <Users   size={20} color={theme.accent} />, title: "Find en makker", desc: "Se ledige spillere",  tab: "makkere" },
    { icon: <MapPin  size={20} color={theme.accent} />, title: "Book en bane",   desc: "Ledige tider",       tab: "baner"   },
    { icon: <Swords  size={20} color={theme.accent} />, title: "Åbne kampe",     desc: "Tilmeld dig nu",     tab: "kampe"   },
    { icon: <Trophy  size={20} color={theme.accent} />, title: "Se ranking",     desc: "Din placering",      tab: "ranking" },
  ];

  return (
    <div>
      <h2 style={{ ...heading("clamp(22px,5vw,26px)"), marginBottom: "4px" }}>Hej {firstName}! 👋</h2>
      <p style={{ color: theme.textMid, fontSize: "14px", marginBottom: "24px" }}>Klar til at spille?</p>

      {/* Stat cards */}
      <div className="pm-stat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,110px),1fr))", gap: "10px", marginBottom: "24px" }}>
        {[
          { label: "Kampe", value: games, color: theme.blue },
          { label: "Sejre", value: wins,  color: theme.warm },
          { label: "Win %", value: games > 0 ? Math.round((wins / games) * 100) + "%" : "—", color: theme.accent },
        ].map((s, i) => (
          <div key={i} style={{ background: theme.surface, borderRadius: theme.radius, padding: "18px 16px", boxShadow: theme.shadow, border: "1px solid " + theme.border, textAlign: "center" }}>
            <div style={{ fontSize: "26px", fontWeight: 800, color: s.color, fontFamily: font, letterSpacing: "-0.03em" }}>{s.value}</div>
            <div style={{ fontSize: "10px", color: theme.textLight, marginTop: "4px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ELO card */}
      <div style={{ background: "linear-gradient(135deg, #166534, #052E16)", borderRadius: theme.radius, padding: "clamp(18px,4vw,24px)", marginBottom: "24px", color: "#fff", boxShadow: theme.shadow }}>
        <div style={{ fontSize: "10px", opacity: 0.65, marginBottom: "8px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Din ELO-rating</div>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
          <span style={{ fontFamily: font, fontSize: "clamp(40px,10vw,52px)", fontWeight: 800, lineHeight: 1, letterSpacing: "-0.04em" }}>{elo}</span>
          <span style={{ fontSize: "13px", opacity: 0.65, maxWidth: "200px", lineHeight: 1.5 }}>Jo højere ELO, jo stærkere matcher du ift. andre spillere.</span>
        </div>
        <div style={{ marginTop: "18px", background: "rgba(255,255,255,0.15)", borderRadius: "6px", height: "6px", overflow: "hidden" }}>
          <div style={{ width: eloBarPct + "%", height: "100%", background: theme.warm, borderRadius: "6px", transition: "width 0.4s ease" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "6px", fontSize: "10px", opacity: 0.55, letterSpacing: "0.04em" }}>
          <span>0</span><span>Skala op til 2000+</span>
        </div>
      </div>

      {/* Quick actions */}
      <div className="pm-home-grid">
        {actions.map((a, i) => (
          <button key={i} onClick={() => setTab(a.tab)} style={{ background: theme.surface, borderRadius: theme.radius, padding: "clamp(16px,3.5vw,20px)", boxShadow: theme.shadow, border: "1px solid " + theme.border, cursor: "pointer", textAlign: "left", fontFamily: font, display: "flex", flexDirection: "column", transition: "box-shadow 0.15s" }}>
            <div style={{ width: "40px", height: "40px", borderRadius: "8px", background: theme.accentBg, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "12px" }}>
              {a.icon}
            </div>
            <div style={{ fontSize: "clamp(13px,3.5vw,14px)", fontWeight: 700, color: theme.text, letterSpacing: "-0.01em", marginBottom: "3px" }}>{a.title}</div>
            <div style={{ fontSize: "12px", color: theme.textLight }}>{a.desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   MAKKERE TAB
═══════════════════════════════════════════════════ */
function MakkereTab({ user, showToast }) {
  const [search, setSearch]           = useState("");
  const [filterLevel, setFilterLevel] = useState("all");
  const [filterArea, setFilterArea]   = useState("all");
  const [players, setPlayers]         = useState([]);
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    (async () => {
      try { const data = await Profile.filter(); setPlayers(data.filter(p => p.id !== user.id)); }
      catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, [user.id]);

  const filtered = players.filter(p => {
    const n = p.full_name || p.name || "";
    if (search && !n.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterArea  !== "all" && p.area  !== filterArea) return false;
    if (filterLevel === "close" && Math.abs((p.level || 5) - (user.level || 5)) > 1.5) return false;
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
        <select value={filterLevel} onChange={e => setFilterLevel(e.target.value)} style={{ ...inputStyle, width: "auto", padding: "8px 12px", fontSize: "13px" }}>
          <option value="all">Alle niveauer</option>
          <option value="close">±1.5 af dit niveau</option>
        </select>
        <select value={filterArea} onChange={e => setFilterArea(e.target.value)} style={{ ...inputStyle, width: "auto", padding: "8px 12px", fontSize: "13px" }}>
          <option value="all">Alle områder</option>
          {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {filtered.map(p => (
          <div key={p.id} style={{ background: theme.surface, borderRadius: theme.radius, padding: "clamp(14px,3vw,18px)", boxShadow: theme.shadow, border: "1px solid " + theme.border }}>
            <div style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
              <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "#F1F5F9", border: "1px solid " + theme.border, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", flexShrink: 0 }}>
                {p.avatar || "🎾"}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "4px" }}>
                  <span style={{ fontSize: "15px", fontWeight: 700, letterSpacing: "-0.01em" }}>{p.full_name || p.name}</span>
                  <span style={{ fontSize: "12px", color: theme.textLight, display: "flex", alignItems: "center", gap: "3px" }}><MapPin size={11} /> {p.area || "?"}</span>
                </div>
                <div style={{ display: "flex", gap: "5px", marginTop: "7px", flexWrap: "wrap" }}>
                  <span style={tag(theme.accentBg, theme.accent)}>Lvl {p.level || "?"}</span>
                  <span style={tag(theme.blueBg,   theme.blue)}>{p.play_style || "?"}</span>
                  <span style={tag(theme.warmBg,   theme.warm)}>{p.games_played || 0} kampe</span>
                </div>
                {p.bio && <p style={{ fontSize: "12px", color: theme.textMid, marginTop: "8px", lineHeight: 1.5 }}>{p.bio}</p>}
              </div>
            </div>
            <div className="pm-makker-card-actions">
              <button onClick={() => showToast("Besked sendt!")} style={{ ...btn(false), padding: "7px 14px", fontSize: "12px" }}>
                <MessageCircle size={13} /> Skriv
              </button>
              <button onClick={() => showToast("Invitation sendt! 🎾")} style={{ ...btn(true), padding: "7px 14px", fontSize: "12px" }}>
                Invitér
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div style={{ textAlign: "center", padding: "40px", color: theme.textLight, fontSize: "14px" }}>Ingen spillere fundet.</div>}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   BANER TAB
═══════════════════════════════════════════════════ */
function BanerTab({ showToast }) {
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
                      await Booking.create({ court_id: c.id, date: new Date().toISOString().split("T")[0], time_slot: t, price: c.price_per_hour, court_name: c.name, status: "confirmed" });
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

/* ═══════════════════════════════════════════════════
   KAMPE TAB
═══════════════════════════════════════════════════ */
function KampeTab({ user, showToast }) {
  const { user: authUser }            = useAuth();
  const myDisplayName                 = resolveDisplayName(user, authUser);
  const [showCreate, setShowCreate]   = useState(false);
  const [courts, setCourts]           = useState([]);
  const [matches, setMatches]         = useState([]);
  const [matchPlayers, setMatchPlayers] = useState({});
  const [loadingMatches, setLoadingMatches] = useState(true);
  const [creating, setCreating]       = useState(false);
  const [newMatch, setNewMatch]       = useState({ court_id: "", date: new Date().toISOString().split("T")[0], time: "18:00", level_range: "4-6" });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [cd, md, ap] = await Promise.all([Court.filter(), Match.filter(), Profile.filter()]);
      setCourts(cd || []);
      setMatches((md || []).filter(m => m.status === "open"));
      if (cd?.length > 0 && !newMatch.court_id) setNewMatch(m => ({ ...m, court_id: cd[0].id }));
      const { data: mpd } = await supabase.from("match_players").select("*");
      const mm = {};
      (mpd || []).forEach(mp => { if (!mm[mp.match_id]) mm[mp.match_id] = []; mm[mp.match_id].push(mp); });
      setMatchPlayers(mm);
    } catch (e) { console.error(e); }
    finally { setLoadingMatches(false); }
  };

  const createMatch = async () => {
    setCreating(true);
    try {
      const court = courts.find(c => c.id === newMatch.court_id);
      const { data: created, error } = await supabase.from("matches").insert({
        creator_id: user.id, court_id: newMatch.court_id, court_name: court?.name || "",
        date: newMatch.date, time: newMatch.time, level_range: newMatch.level_range,
        status: "open", max_players: 4, current_players: 1,
      }).select().single();
      if (error) throw error;
      await supabase.from("match_players").insert({ match_id: created.id, user_id: user.id, user_name: myDisplayName, user_email: authUser?.email || user.email, user_emoji: user.avatar || "🎾" });
      setShowCreate(false); showToast("Kamp oprettet! 🎾"); await loadData();
    } catch (e) { showToast("Fejl: " + (e.message || "Prøv igen")); }
    finally { setCreating(false); }
  };

  const joinMatch = async (matchId) => {
    try {
      const { error } = await supabase.from("match_players").insert({ match_id: matchId, user_id: user.id, user_name: myDisplayName, user_email: authUser?.email || user.email, user_emoji: user.avatar || "🎾" });
      if (error) throw error;
      showToast("Du er tilmeldt!"); await loadData();
    } catch (e) { showToast("Fejl: " + (e.message || "Prøv igen")); }
  };

  if (loadingMatches) return <div style={{ textAlign: "center", padding: "40px", color: theme.textLight, fontSize: "14px" }}>Indlæser kampe...</div>;

  return (
    <div>
      <div className="pm-kampe-head" style={{ marginBottom: "20px" }}>
        <h2 style={{ ...heading("clamp(20px,4.5vw,24px)") }}>Kampe</h2>
        <button onClick={() => setShowCreate(!showCreate)} style={btn(true)}>
          {showCreate ? "Annullér" : <><Plus size={15} /> Opret kamp</>}
        </button>
      </div>

      {showCreate && (
        <div style={{ background: theme.surface, borderRadius: theme.radius, padding: "clamp(16px,3vw,20px)", boxShadow: theme.shadow, marginBottom: "20px", border: "1px solid " + theme.border }}>
          <h3 style={{ fontSize: "15px", fontWeight: 700, marginBottom: "16px", letterSpacing: "-0.01em" }}>Opret ny kamp</h3>
          <div className="pm-form-2col">
            <div><label style={labelStyle}>Bane</label>
              <select value={newMatch.court_id} onChange={e => setNewMatch(m => ({ ...m, court_id: e.target.value }))} style={{ ...inputStyle, fontSize: "13px" }}>
                {courts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select></div>
            <div><label style={labelStyle}>Niveau</label>
              <select value={newMatch.level_range} onChange={e => setNewMatch(m => ({ ...m, level_range: e.target.value }))} style={{ ...inputStyle, fontSize: "13px" }}>
                {["1-3","2-4","3-5","4-6","5-7","6-8","7-9","8-10"].map(r => <option key={r} value={r}>{r}</option>)}
              </select></div>
            <div><label style={labelStyle}>Dato</label>
              <input type="date" value={newMatch.date} onChange={e => setNewMatch(m => ({ ...m, date: e.target.value }))} style={{ ...inputStyle, fontSize: "13px" }} /></div>
            <div><label style={labelStyle}>Tid</label>
              <input type="time" value={newMatch.time} onChange={e => setNewMatch(m => ({ ...m, time: e.target.value }))} style={{ ...inputStyle, fontSize: "13px" }} /></div>
          </div>
          <button onClick={createMatch} disabled={creating} style={{ ...btn(true), marginTop: "16px", width: "100%", justifyContent: "center" }}>
            {creating ? "Opretter..." : "Opret kamp"}
          </button>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {matches.map(m => {
          const mp     = matchPlayers[m.id] || [];
          const left   = (m.max_players || 4) - mp.length;
          const joined = mp.some(p => p.user_id === user.id);
          return (
            <div key={m.id} style={{ background: theme.surface, borderRadius: theme.radius, padding: "20px", boxShadow: theme.shadow, border: "1px solid " + theme.border }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
                <div>
                  <div style={{ fontSize: "15px", fontWeight: 700, letterSpacing: "-0.01em" }}>{m.date} kl. {(m.time || "").slice(0, 5)}</div>
                  <div style={{ fontSize: "12px", color: theme.textLight, marginTop: "2px", display: "flex", alignItems: "center", gap: "3px" }}><MapPin size={11} /> {m.court_name}</div>
                </div>
                <span style={tag(left > 0 ? theme.accentBg : theme.redBg, left > 0 ? theme.accent : theme.red)}>
                  {left > 0 ? `${left} ledig${left > 1 ? "e" : ""}` : "Fuld"}
                </span>
              </div>
              <div style={{ display: "flex", gap: "5px", marginBottom: "14px", flexWrap: "wrap" }}>
                <span style={tag(theme.accentBg, theme.accent)}>Niveau {m.level_range}</span>
                <span style={tag(theme.blueBg,   theme.blue)}>{mp.length}/{m.max_players || 4} spillere</span>
              </div>
              <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "14px", flexWrap: "wrap" }}>
                {mp.map(p => (
                  <div key={p.id || p.user_id} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "#F1F5F9", border: "1px solid " + theme.border, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px" }}>{p.user_emoji || "🎾"}</div>
                    <span style={{ fontSize: "10px", color: theme.textLight, marginTop: "2px" }}>{(p.user_name || "?").split(" ")[0]}</span>
                  </div>
                ))}
                {Array.from({ length: Math.max(0, left) }).map((_, i) => (
                  <div key={"e" + i} style={{ width: "36px", height: "36px", borderRadius: "50%", border: "1.5px dashed " + theme.border, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Plus size={12} color={theme.textLight} />
                  </div>
                ))}
              </div>
              {left > 0 && !joined && (
                <button onClick={() => joinMatch(m.id)} style={{ ...btn(true), width: "100%", justifyContent: "center", fontSize: "13px" }}>Tilmeld mig</button>
              )}
              {joined && <div style={{ textAlign: "center", fontSize: "13px", color: theme.accent, fontWeight: 600 }}>✅ Tilmeldt</div>}
            </div>
          );
        })}
        {matches.length === 0 && <div style={{ textAlign: "center", padding: "40px", color: theme.textLight, fontSize: "14px" }}>Ingen åbne kampe. Opret den første!</div>}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   RANKING TAB
═══════════════════════════════════════════════════ */
function RankingTab({ user }) {
  const [players, setPlayers]   = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    (async () => {
      try { const data = await Profile.filter(); setPlayers(data || []); }
      catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  const sorted   = [...players].sort((a, b) => (b.elo_rating || b.level || 0) - (a.elo_rating || a.level || 0));
  const userRank = sorted.findIndex(p => p.id === user.id) + 1;
  const rating   = user.elo_rating || user.level || 5;
  const medals   = ["🥇", "🥈", "🥉"];

  if (loading) return <div style={{ textAlign: "center", padding: "40px", color: theme.textLight, fontSize: "14px" }}>Indlæser ranking...</div>;

  return (
    <div>
      <h2 style={{ ...heading("clamp(20px,4.5vw,24px)"), marginBottom: "20px" }}>Ranking</h2>

      {/* Hero card */}
      <div style={{ background: "linear-gradient(135deg, #166534, #052E16)", borderRadius: theme.radius, padding: "clamp(18px,4vw,24px)", marginBottom: "24px", color: "#fff" }}>
        <div style={{ fontSize: "10px", opacity: 0.65, marginBottom: "6px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Din placering</div>
        <div className="pm-rank-hero-inner">
          <div>
            <span style={{ fontFamily: font, fontSize: "clamp(32px,8vw,40px)", fontWeight: 800, letterSpacing: "-0.04em" }}>#{userRank || "—"}</span>
            <span style={{ fontSize: "14px", marginLeft: "8px", opacity: 0.6 }}>af {sorted.length}</span>
          </div>
          <div className="pm-rank-hero-elo">
            <div style={{ fontFamily: font, fontSize: "clamp(20px,5vw,24px)", fontWeight: 800, letterSpacing: "-0.03em" }}>{rating}</div>
            <div style={{ fontSize: "10px", opacity: 0.65, letterSpacing: "0.06em", textTransform: "uppercase" }}>ELO</div>
          </div>
        </div>
        <div style={{ marginTop: "14px", background: "rgba(255,255,255,0.15)", borderRadius: "6px", height: "6px" }}>
          <div style={{ width: Math.min((rating / 2000) * 100, 100) + "%", height: "100%", background: theme.warm, borderRadius: "6px" }} />
        </div>
      </div>

      {/* Leaderboard */}
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        {sorted.map((p, i) => {
          const me = p.id === user.id;
          const r  = p.elo_rating || p.level || 0;
          return (
            <div key={p.id} className="pm-rank-row" style={{ background: me ? theme.accentBg : theme.surface, borderRadius: "8px", padding: "12px 14px", boxShadow: me ? "none" : theme.shadow, display: "flex", alignItems: "center", gap: "12px", border: me ? "1.5px solid " + theme.accent + "35" : "1px solid " + theme.border }}>
              <div style={{ width: "28px", flexShrink: 0, textAlign: "center", fontSize: i < 3 ? "18px" : "13px", fontWeight: 700, color: i < 3 ? "inherit" : theme.textLight }}>
                {i < 3 ? medals[i] : i + 1}
              </div>
              <div style={{ width: "38px", height: "38px", flexShrink: 0, borderRadius: "50%", background: "#F1F5F9", border: "1px solid " + theme.border, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "17px" }}>
                {p.avatar || "🎾"}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "14px", fontWeight: me ? 700 : 600, letterSpacing: "-0.01em", wordBreak: "break-word" }}>
                  {p.full_name || p.name}{me ? " (dig)" : ""}
                </div>
                <div style={{ fontSize: "11px", color: theme.textLight, marginTop: "1px" }}>{p.area || "?"} · {p.games_played || 0} kampe</div>
              </div>
              <div className="pm-rank-score" style={{ fontFamily: font, fontSize: "17px", fontWeight: 800, color: theme.accent, flexShrink: 0, letterSpacing: "-0.02em" }}>{r}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
