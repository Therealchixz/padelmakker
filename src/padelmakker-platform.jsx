import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "./lib/AuthContext";
import { Profile, Court, CourtSlot, Match, Booking } from "./api/base44Client";
import { supabase } from "./lib/supabase";
import { normalizeProfileRow, normalizeStringArrayField, validateFirstLastName } from "./lib/profileUtils";
import { readKampeSessionPrefs, mergeKampeSessionPrefs } from "./lib/kampeSessionPrefs";
import { AmericanoTab } from "./features/americano/AmericanoTab";
import { americanoOutcomeColors } from "./features/americano/americanoOutcomeColors";

/** Sikker liste til .map() selv hvis profil kommer uden normalisering */
function availabilityTags(profileLike) {
  return normalizeStringArrayField(profileLike?.availability);
}
import {
  Home, Users, MapPin, Swords, Trophy,
  UserPlus, TrendingUp, MessageCircle, Search,
  LogOut, Plus, Star, Clock, Building2, Sun, ArrowRight, Trash2, UserMinus,
  Settings, KeyRound, Save, X, Bell, CheckCheck,
} from "lucide-react";

const LEVELS      = ["1-2 (Helt ny)", "3-4 (Begynder)", "5-6 (Øvet)", "7-8 (Avanceret)", "9-10 (Elite)"];
const PLAY_STYLES = ["Offensiv", "Defensiv", "Alround", "Ved ikke endnu"];
/** Danmarks fem regioner (administrativ inddeling) */
const REGIONS = [
  "Region Hovedstaden",
  "Region Midtjylland",
  "Region Nordjylland",
  "Region Sjælland",
  "Region Syddanmark",
];
const DEFAULT_REGION = REGIONS[0];
const AVAILABILITY = ["Morgener", "Formiddage", "Eftermiddage", "Aftener", "Weekender", "Flexibel"];

/* ─── Design tokens (mirrors variables.css) ─── */
const font = "'Inter', sans-serif";
const theme = {
  bg:          "#F0F4F8",
  surface:     "#FFFFFF",
  text:        "#0B1120",
  textMid:     "#3E4C63",
  textLight:   "#8494A7",
  accent:      "#1D4ED8",
  accentHover: "#1E40AF",
  accentBg:    "#DBEAFE",
  warm:        "#D97706",
  warmBg:      "#FEF3C7",
  blue:        "#2563EB",
  blueBg:      "#EFF6FF",
  red:         "#DC2626",
  redBg:       "#FEF2F2",
  border:      "#D5DDE8",
  shadow:      "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)",
  shadowLg:    "0 8px 32px rgba(0,0,0,0.12)",
  radius:      "12px",
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

/* ─── Scroll reveal hook ─── */
function useScrollReveal() {
  const containerRef = useRef(null);
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const els = root.querySelectorAll('.pm-reveal, .pm-reveal-left, .pm-reveal-right, .pm-reveal-scale');
    if (!els.length) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('pm-visible'); io.unobserve(e.target); } });
    }, { threshold: 0.12 });
    els.forEach(el => io.observe(el));
    return () => io.disconnect();
  }, []);
  return containerRef;
}

/* ─── Utility ─── */
function sanitizeText(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

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
  const [resetMode, setResetMode] = useState(false);
  const navigate = useNavigate();
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3000); };
  const handleLogout = async () => { await signOut(); navigate("/", { replace: true }); };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setResetMode(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  if (loading || (user && profileLoading)) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100dvh", background: theme.bg, padding: "env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)" }}>
        <div className="pm-spinner" />
      </div>
    );
  }

  if (resetMode) {
    return (
      <div className="pm-root" style={{ fontFamily: font, background: theme.bg, minHeight: "100dvh", color: theme.text }}>
        {toast && (
          <div className="pm-toast" style={{ position: "fixed", top: "max(12px, env(safe-area-inset-top))", left: "50%", transform: "translateX(-50%)", background: theme.accent, color: "#fff", padding: "11px 22px", borderRadius: "10px", fontSize: "13px", fontWeight: 600, zIndex: 9999, boxShadow: theme.shadowLg }}>
            {toast}
          </div>
        )}
        <ResetPasswordPage onDone={() => { setResetMode(false); navigate("/dashboard"); showToast("Adgangskode opdateret! ✅"); }} />
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
      <Routes>
        <Route path="/" element={user && profile ? <Navigate to="/dashboard" replace /> : <LandingPage />} />
        <Route path="/login" element={user && profile ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
        <Route path="/opret" element={user && profile ? <Navigate to="/dashboard" replace /> : <OnboardingPage onComplete={() => showToast("Tjek din email — bekræft kontoen, og log derefter ind.")} />} />
        <Route path="/dashboard" element={user && profile ? <DashboardPage user={profile} onLogout={handleLogout} showToast={showToast} /> : <Navigate to="/" replace />} />
        <Route path="/dashboard/:tab" element={user && profile ? <DashboardPage user={profile} onLogout={handleLogout} showToast={showToast} /> : <Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   RESET PASSWORD PAGE
═══════════════════════════════════════════════════ */
function ResetPasswordPage({ onDone }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleReset = async () => {
    if (!password || password.length < 8) { setErr("Adgangskode skal være mindst 8 tegn"); return; }
    if (password !== confirm) { setErr("Adgangskoderne matcher ikke"); return; }
    setSubmitting(true); setErr("");
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      onDone();
    } catch (e) {
      setErr(e.message || "Kunne ikke opdatere adgangskode. Prøv igen.");
    } finally { setSubmitting(false); }
  };

  return (
    <div className="pm-auth-narrow">
      <h1 style={{ ...heading("28px"), marginBottom: "6px" }}>Ny adgangskode</h1>
      <p style={{ color: theme.textMid, fontSize: "14px", marginBottom: "28px", lineHeight: 1.5 }}>Vælg din nye adgangskode.</p>
      <label style={labelStyle}>Ny adgangskode</label>
      <input value={password} onChange={e => { setPassword(e.target.value); setErr(""); }} placeholder="Mindst 8 tegn" type="password" style={{ ...inputStyle, marginBottom: "14px" }} />
      <label style={labelStyle}>Gentag adgangskode</label>
      <input value={confirm} onChange={e => { setConfirm(e.target.value); setErr(""); }} placeholder="Gentag adgangskode" type="password" style={{ ...inputStyle, marginBottom: "14px" }} />
      {err && <p style={{ color: theme.red, fontSize: "13px", marginBottom: "14px" }}>{err}</p>}
      <button onClick={handleReset} disabled={submitting} style={{ ...btn(true), width: "100%", justifyContent: "center" }}>
        {submitting ? "Opdaterer..." : <><KeyRound size={14} /> Gem ny adgangskode</>}
      </button>
    </div>
  );
}
function LandingPage() {
  const revealRef = useScrollReveal();
  const heroRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const maxExtra = 100;
    const fadeStart = 24;
    const fadeRange = 200;
    const onScroll = () => {
      const y = window.scrollY || 0;
      const t = Math.max(0, Math.min(1, (y - fadeStart) / fadeRange));
      el.style.setProperty("--pm-hero-fade-extra", `${Math.round(t * maxExtra)}px`);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const steps = [
    { step: "01", icon: <UserPlus  size={24} color="#fff" />, title: "Opret profil", desc: "Angiv dit niveau, spillestil og region — det tager under et minut." },
    { step: "02", icon: <Users     size={24} color="#fff" />, title: "Find makker",  desc: "Se spillere nær dig på dit niveau og invitér dem til en kamp." },
    { step: "03", icon: <MapPin    size={24} color="#fff" />, title: "Book bane",    desc: "Find ledige baner med priser og tider — book direkte i appen." },
    { step: "04", icon: <TrendingUp size={24} color="#fff" />, title: "Rank op",     desc: "Spil kampe, optjen ELO-point og klatr op ad ranglisten." },
  ];

  const features = [
    { icon: <Trophy size={22} color={theme.accent} />, title: "ELO-ranking", desc: "Avanceret ranking-system der matcher dig med jævnbyrdige spillere." },
    { icon: <Swords size={22} color={theme.accent} />, title: "Holdkampe", desc: "Opret 2v2 kampe, vælg hold og registrér resultater med tiebreak-validering." },
    { icon: <MessageCircle size={22} color={theme.accent} />, title: "Fællesskab", desc: "Bliv en del af Danmarks voksende padel-community med hundredvis af aktive spillere." },
  ];

  return (
    <div className="pm-landing" ref={revealRef}>
      {/* Nav */}
      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 50, background: "rgba(255,255,255,0.92)", backdropFilter: "blur(12px)", borderBottom: "1px solid " + theme.border }}>
        <div className="pm-landing-nav" style={{ padding: "clamp(12px, 2.5vw, 16px) clamp(16px, 4vw, 24px)", maxWidth: "1100px", margin: "0 auto" }}>
          <div style={{ ...heading("clamp(17px,4.5vw,20px)"), color: theme.accent, display: "flex", alignItems: "center", gap: "8px" }}>🎾 PadelMakker</div>
          <div className="pm-landing-nav-actions">
            <button onClick={() => navigate("/login")} style={{ ...btn(false), borderColor: "transparent", background: "transparent" }}>Log ind</button>
            <button onClick={() => navigate("/opret")} style={{ ...btn(true), borderRadius: "8px" }}>Kom i gang</button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section
        className="pm-hero-gradient"
        style={{
          display: "flex",
          flexDirection: "column",
          paddingTop: "clamp(100px,18vw,140px)",
          paddingLeft: 0,
          paddingRight: 0,
          paddingBottom: 0,
          textAlign: "center",
          position: "relative",
        }}
      >
        <div
          style={{
            flex: "1 1 auto",
            paddingLeft: "clamp(16px,4vw,24px)",
            paddingRight: "clamp(16px,4vw,24px)",
            paddingBottom: "clamp(28px,6vw,44px)",
            position: "relative",
            zIndex: 2,
          }}
        >
          <div style={{ maxWidth: "800px", margin: "0 auto" }}>
            <div className="pm-reveal" style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "rgba(255,255,255,0.15)", color: "#fff", fontSize: "12px", fontWeight: 600, padding: "6px 16px", borderRadius: "20px", marginBottom: "28px", border: "1px solid rgba(255,255,255,0.25)", letterSpacing: "0.03em", backdropFilter: "blur(4px)" }}>
              🇩🇰 Danmarks padel-platform
            </div>
            <h1 className="pm-reveal pm-delay-1" style={{ fontFamily: font, fontSize: "clamp(40px,8vw,76px)", fontWeight: 800, lineHeight: 1.02, letterSpacing: "-0.04em", color: "#fff", marginBottom: "24px" }}>
              Find makker.<br />Book bane.<br /><span style={{ color: "#93C5FD" }}>Spil padel.</span>
            </h1>
            <p className="pm-reveal pm-delay-2" style={{ fontSize: "clamp(16px,3.8vw,19px)", color: "rgba(255,255,255,0.80)", maxWidth: "480px", margin: "0 auto clamp(36px,7vw,48px)", lineHeight: 1.65 }}>
              Stop med at søge i Facebook-grupper. PadelMakker matcher dig med spillere på dit niveau — gratis.
            </p>
            <div className="pm-reveal pm-delay-3" style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
              <button onClick={() => navigate("/opret")} style={{ fontFamily: font, fontSize: "16px", fontWeight: 700, padding: "14px 32px", borderRadius: "10px", border: "none", background: "#fff", color: theme.accent, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "8px", letterSpacing: "-0.01em", boxShadow: "0 4px 20px rgba(0,0,0,0.15)" }}>
                Opret gratis profil <ArrowRight size={17} />
              </button>
              <button onClick={() => navigate("/login")} style={{ fontFamily: font, fontSize: "16px", fontWeight: 600, padding: "14px 28px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.35)", background: "rgba(255,255,255,0.1)", color: "#fff", cursor: "pointer", backdropFilter: "blur(4px)", letterSpacing: "-0.01em" }}>
                Log ind
              </button>
            </div>
          </div>
        </div>
        <div ref={heroRef} className="pm-hero-fade-tail" aria-hidden />
      </section>

      {/* Stats banner */}
      <section style={{ background: theme.surface, padding: "clamp(32px,6vw,48px) clamp(16px,4vw,24px)", borderBottom: "1px solid " + theme.border }}>
        <div style={{ maxWidth: "900px", margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,140px),1fr))", gap: "20px", textAlign: "center" }}>
          {[{ n: "200+", l: "Aktive spillere" }, { n: "6", l: "Baner i København" }, { n: "50+", l: "Kampe ugentligt" }, { n: "4.7", l: "Gennemsnitlig rating" }].map((s, i) => (
            <div key={i} className={"pm-reveal pm-delay-" + (i+1)}>
              <div className="pm-stat-number" style={{ fontFamily: font, fontSize: "clamp(32px,7vw,44px)", fontWeight: 800, color: theme.accent, letterSpacing: "-0.04em" }}>{s.n}</div>
              <div style={{ fontSize: "13px", color: theme.textMid, marginTop: "4px", fontWeight: 500 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section style={{ maxWidth: "1100px", margin: "0 auto", padding: "clamp(56px,12vw,88px) clamp(16px,4vw,24px)" }}>
        <div className="pm-reveal" style={{ textAlign: "center", marginBottom: "clamp(32px,7vw,48px)" }}>
          <p style={{ fontSize: "12px", fontWeight: 700, color: theme.accent, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "10px" }}>Sådan virker det</p>
          <h2 style={{ ...heading("clamp(26px,5.5vw,36px)"), letterSpacing: "-0.03em" }}>Fra profil til bane på minutter</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%,230px),1fr))", gap: "16px" }}>
          {steps.map((s, i) => (
            <div key={s.step} className={"pm-feature-card pm-reveal pm-delay-" + (i+1)} style={{ background: theme.surface, borderRadius: "14px", padding: "32px 24px", boxShadow: theme.shadow, border: "1px solid " + theme.border, position: "relative" }}>
              <div style={{ fontSize: "48px", fontWeight: 900, color: theme.accent + "12", position: "absolute", top: "16px", right: "20px", letterSpacing: "-0.04em", fontFamily: font }}>{s.step}</div>
              <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: "linear-gradient(135deg, " + theme.accent + ", #3B82F6)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "18px" }}>
                {s.icon}
              </div>
              <div style={{ fontSize: "17px", fontWeight: 700, marginBottom: "8px", letterSpacing: "-0.01em", color: theme.text }}>{s.title}</div>
              <div style={{ fontSize: "14px", color: theme.textMid, lineHeight: 1.6 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section style={{ background: theme.bg, padding: "clamp(56px,12vw,88px) clamp(16px,4vw,24px)" }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
          <div className="pm-reveal" style={{ textAlign: "center", marginBottom: "clamp(32px,7vw,48px)" }}>
            <p style={{ fontSize: "12px", fontWeight: 700, color: theme.accent, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "10px" }}>Funktioner</p>
            <h2 style={{ ...heading("clamp(26px,5.5vw,36px)"), letterSpacing: "-0.03em" }}>Alt hvad du behøver</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%,280px),1fr))", gap: "16px" }}>
            {features.map((f, i) => (
              <div key={i} className={"pm-feature-card pm-reveal pm-delay-" + (i+1)} style={{ background: theme.surface, borderRadius: "14px", padding: "32px 24px", boxShadow: theme.shadow, border: "1px solid " + theme.border }}>
                <div style={{ width: "52px", height: "52px", borderRadius: "14px", background: theme.accentBg, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "18px" }}>
                  {f.icon}
                </div>
                <div style={{ fontSize: "18px", fontWeight: 700, marginBottom: "10px", letterSpacing: "-0.02em", color: theme.text }}>{f.title}</div>
                <div style={{ fontSize: "14px", color: theme.textMid, lineHeight: 1.65 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="pm-reveal-scale" style={{ maxWidth: "1100px", margin: "0 auto", padding: "clamp(56px,12vw,88px) clamp(16px,4vw,24px)" }}>
        <div style={{ background: "linear-gradient(135deg, #1E3A5F, #1D4ED8)", borderRadius: "20px", padding: "clamp(40px,8vw,64px) clamp(24px,5vw,48px)", textAlign: "center", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "relative", zIndex: 1 }}>
            <h2 style={{ fontFamily: font, fontSize: "clamp(26px,5.5vw,40px)", fontWeight: 800, color: "#fff", letterSpacing: "-0.03em", marginBottom: "16px", lineHeight: 1.1 }}>
              Klar til at spille?
            </h2>
            <p style={{ fontSize: "clamp(15px,3.5vw,17px)", color: "rgba(255,255,255,0.75)", maxWidth: "420px", margin: "0 auto 32px", lineHeight: 1.6 }}>
              Opret din profil på under et minut og find din første makker i dag.
            </p>
            <button onClick={() => navigate("/opret")} style={{ fontFamily: font, fontSize: "16px", fontWeight: 700, padding: "14px 36px", borderRadius: "10px", border: "none", background: "#fff", color: theme.accent, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "8px", boxShadow: "0 4px 20px rgba(0,0,0,0.2)" }}>
              Kom i gang — det er gratis <ArrowRight size={17} />
            </button>
          </div>
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
function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [err, setErr]             = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) { setErr("Indtast email og adgangskode"); return; }
    setSubmitting(true); setErr("");
    try {
      await signIn(email.trim(), password);
    } catch (e) {
      setErr(e.message || "Login fejlede. Tjek email og adgangskode.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim() || !email.includes("@")) { setErr("Indtast din email først"); return; }
    setSubmitting(true); setErr("");
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin,
      });
      if (error) throw error;
      setForgotSent(true);
    } catch (e) {
      setErr(e.message || "Kunne ikke sende nulstillingsmail.");
    } finally { setSubmitting(false); }
  };

  if (forgotMode) {
    return (
      <div className="pm-auth-narrow">
        <button onClick={() => { setForgotMode(false); setForgotSent(false); setErr(""); }} style={{ ...btn(false), marginBottom: "40px", padding: "8px 14px", fontSize: "13px" }}>← Tilbage til login</button>
        <h1 style={{ ...heading("28px"), marginBottom: "6px" }}>Glemt adgangskode</h1>
        {forgotSent ? (
          <div style={{ background: theme.accentBg, padding: "20px", borderRadius: theme.radius, marginTop: "20px" }}>
            <p style={{ fontSize: "14px", color: theme.accent, fontWeight: 600, marginBottom: "8px" }}>✉️ Mail sendt!</p>
            <p style={{ fontSize: "13px", color: theme.textMid, lineHeight: 1.5 }}>Tjek din indbakke på <strong>{email}</strong> og følg linket for at nulstille din adgangskode.</p>
          </div>
        ) : (
          <>
            <p style={{ color: theme.textMid, fontSize: "14px", marginBottom: "28px", lineHeight: 1.5 }}>Indtast din email, så sender vi et link til at nulstille din adgangskode.</p>
            <label style={labelStyle}>Email</label>
            <input value={email} onChange={e => { setEmail(e.target.value); setErr(""); }} placeholder="din@email.dk" style={{ ...inputStyle, marginBottom: "14px" }} />
            {err && <p style={{ color: theme.red, fontSize: "13px", marginBottom: "14px" }}>{err}</p>}
            <button onClick={handleForgotPassword} disabled={submitting} style={{ ...btn(true), width: "100%", justifyContent: "center" }}>
              {submitting ? "Sender..." : "Send nulstillingslink"}
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="pm-auth-narrow">
      <button onClick={() => navigate("/")} style={{ ...btn(false), marginBottom: "40px", padding: "8px 14px", fontSize: "13px" }}>← Tilbage</button>
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
      <button onClick={() => setForgotMode(true)} style={{ background: "none", border: "none", color: theme.accent, fontSize: "13px", marginTop: "16px", cursor: "pointer", fontFamily: font, fontWeight: 500, width: "100%", textAlign: "center" }}>
        Glemt adgangskode?
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   ONBOARDING
═══════════════════════════════════════════════════ */
function OnboardingPage({ onComplete }) {
  const { signUp, signOut } = useAuth();
  const navigate = useNavigate();
  const [step, setStep]           = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr]             = useState("");
  const [form, setForm]           = useState({ first_name: "", last_name: "", email: "", password: "", level: "", style: "", area: "", availability: [], bio: "", avatar: "🎾", birth_year: "" });
  const avatars = ["🎾", "👨", "👩", "🧔", "👩‍🦰", "👨‍🦱", "👩‍🦱", "🧑"];

  const set        = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const toggleAvail = (a) => setForm(f => ({ ...f, availability: f.availability.includes(a) ? f.availability.filter(x => x !== a) : [...f.availability, a] }));
  const canNext = () => {
    if (step === 0)
      return (
        validateFirstLastName(form.first_name, form.last_name).valid &&
        form.email.trim() &&
        form.password.trim() &&
        form.birth_year.length === 4
      );
    if (step === 1) return form.level && form.style;
    if (step === 2) return form.area && form.availability.length > 0;
    return true;
  };

  const finish = async () => {
    setSubmitting(true); setErr("");
    try {
      const nameCheck = validateFirstLastName(form.first_name, form.last_name);
      if (!nameCheck.valid) {
        setErr(nameCheck.message);
        return;
      }
      const displayName = `${form.first_name.trim()} ${form.last_name.trim()}`;
      const levelNum = parseFloat(form.level.match(/\d+/)?.[0] || "5");
      await signUp(form.email.trim(), form.password, {
        full_name: sanitizeText(displayName), level: levelNum,
        play_style: form.style, area: form.area, availability: form.availability,
        bio: sanitizeText(form.bio), avatar: form.avatar, birth_year: parseInt(form.birth_year) || null,
      });
      if (onComplete) onComplete();
      /* Altid til login: undgå at blive på /opret eller auto-dashboard når der opstår en session */
      try { await signOut(); } catch (_) { /* fortsæt til login alligevel */ }
      navigate("/login", { replace: true });
    } catch (e) {
      setErr(e.message || "Kunne ikke oprette profil.");
    } finally {
      setSubmitting(false);
    }
  };

  const selBtn = (active) => ({ ...btn(active), textAlign: "left", padding: "11px 16px" });

  const steps = [
    <div key={0}>
      <h2 style={{ ...heading("24px"), marginBottom: "6px" }}>Velkommen! 👋</h2>
      <p style={{ color: theme.textMid, fontSize: "14px", marginBottom: "28px", lineHeight: 1.5 }}>Lad os oprette din profil.</p>
      <label style={labelStyle}>Fornavn</label>
      <input value={form.first_name} onChange={e => set("first_name", e.target.value)} placeholder="F.eks. Mikkel" style={{ ...inputStyle, marginBottom: "10px" }} />
      <label style={labelStyle}>Efternavn</label>
      <input value={form.last_name} onChange={e => set("last_name", e.target.value)} placeholder="F.eks. Hansen" style={{ ...inputStyle, marginBottom: "6px" }} />
      <p style={{ color: theme.textLight, fontSize: "12px", lineHeight: 1.45, marginBottom: "14px" }}>
        Begge felter skal udfyldes. Dobbeltnavne med bindestreg er ok (f.eks. Anne-Marie).
      </p>
      <label style={labelStyle}>Email</label>
      <input value={form.email}    onChange={e => set("email", e.target.value)}    placeholder="din@email.dk"      type="email"    style={{ ...inputStyle, marginBottom: "14px" }} />
      <label style={labelStyle}>Adgangskode</label>
      <input value={form.password} onChange={e => set("password", e.target.value)} placeholder="Mindst 8 tegn"     type="password" style={{ ...inputStyle, marginBottom: "14px" }} />
      <label style={labelStyle}>Fødselsår</label>
      <input value={form.birth_year} onChange={e => set("birth_year", e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="F.eks. 1995" type="text" inputMode="numeric" style={inputStyle} />
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
      <p style={{ color: theme.textMid, fontSize: "14px", marginBottom: "24px", lineHeight: 1.5 }}>Vælg den region du primært spiller i — så kan andre finde dig.</p>
      <label style={labelStyle}>Region</label>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "20px" }}>
        {REGIONS.map((r) => (
          <button key={r} onClick={() => set("area", r)} style={{ ...btn(form.area === r), padding: "8px 14px", fontSize: "13px" }}>{r}</button>
        ))}
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
        <button onClick={step > 0 ? () => setStep(s => s - 1) : () => navigate("/")} style={btn(false)}>← Tilbage</button>
        {step < 3
          ? <button onClick={() => canNext() && setStep(s => s + 1)} style={{ ...btn(true), opacity: canNext() ? 1 : 0.4 }}>Næste <ArrowRight size={15} /></button>
          : <button onClick={finish} disabled={submitting} style={btn(true)}>{submitting ? "Opretter..." : "Opret profil"}</button>
        }
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   NOTIFICATIONS
═══════════════════════════════════════════════════ */
/** Returnerer fejl-objekt hvis RPC fejler (så UI kan vise toast). Kræver create_notification_rpc.sql + ALTER FUNCTION SET row_security = off. */
async function createNotification(userId, type, title, body, matchId = null) {
  try {
    const { error } = await supabase.rpc("create_notification_for_user", {
      p_user_id: userId,
      p_type: type,
      p_title: title,
      p_body: body,
      p_match_id: matchId,
    });
    if (error) {
      console.warn("Notification error:", error.message || error);
      return error;
    }
    return null;
  } catch (e) {
    console.warn("Notification error:", e);
    return e;
  }
}

function NotificationBell() {
  const { user: authUser } = useAuth();
  const navigate = useNavigate();
  const userId = authUser?.id;
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState([]);
  const panelRef = useRef(null);

  const unreadCount = notifs.filter(n => !n.read).length;

  const load = useCallback(async () => {
    if (!userId) {
      setNotifs([]);
      return;
    }
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) {
        console.warn("notifications load:", error.message || error);
        setNotifs([]);
        return;
      }
      setNotifs(data || []);
    } catch (e) {
      console.warn("notifications load:", e);
      setNotifs([]);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  /* Realtime på notifications kræver at tabellen findes og Realtime er slået til — ellers kan nogle browsere crashe med hvid skærm */
  useEffect(() => {
    if (!userId) return undefined;
    const channel = supabase
      .channel("notifs-" + userId)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: "user_id=eq." + userId }, () => load())
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          try { supabase.removeChannel(channel); } catch (_) { /* ignore */ }
        }
      });
    return () => { try { supabase.removeChannel(channel); } catch (_) { /* ignore */ } };
  }, [userId, load]);

  useEffect(() => {
    if (!open) return;
    const closeIfOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", closeIfOutside);
    document.addEventListener("touchstart", closeIfOutside, { passive: true });
    return () => {
      document.removeEventListener("mousedown", closeIfOutside);
      document.removeEventListener("touchstart", closeIfOutside);
    };
  }, [open]);

  const markAllRead = async () => {
    const unread = notifs.filter(n => !n.read).map(n => n.id);
    if (!unread.length) return;
    await supabase.from("notifications").update({ read: true }).in("id", unread);
    setNotifs(prev => prev.map(n => ({ ...n, read: true })));
  };

  const deleteOne = async (id) => {
    if (!userId) return;
    const { error } = await supabase.from("notifications").delete().eq("id", id).eq("user_id", userId);
    if (error) {
      console.warn("notifications delete:", error.message || error);
      return;
    }
    setNotifs((prev) => prev.filter((n) => n.id !== id));
  };

  const clearAll = async () => {
    if (!userId || !notifs.length) return;
    const ids = notifs.map((n) => n.id);
    const { error } = await supabase.from("notifications").delete().in("id", ids).eq("user_id", userId);
    if (error) {
      console.warn("notifications clear:", error.message || error);
      return;
    }
    setNotifs([]);
  };

  const openNotificationMatch = async (n) => {
    if (!n?.match_id || !userId) return;
    try {
      await supabase.from("notifications").update({ read: true }).eq("id", n.id).eq("user_id", userId);
      setNotifs((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    } catch (_) { /* ignore */ }
    setOpen(false);
    /* ?focus= så KampeTab reagerer også hvis man allerede er på Kampe-fanen */
    navigate("/dashboard/kampe?focus=" + encodeURIComponent(String(n.match_id)));
  };

  const timeAgo = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "nu";
    if (mins < 60) return mins + " min";
    const hours = Math.floor(mins / 60);
    if (hours < 24) return hours + "t";
    return Math.floor(hours / 24) + "d";
  };

  const typeIcon = (type) => {
    switch (type) {
      case "match_join": return "⚔️";
      case "match_full": return "✅";
      case "result_submitted": return "📊";
      case "result_confirmed": return "🏆";
      case "elo_change": return "📈";
      case "match_cancelled": return "❌";
      case "welcome": return "👋";
      default: return "🔔";
    }
  };

  const iconBtn = {
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: "6px",
    borderRadius: "8px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    WebkitTapHighlightColor: "transparent",
  };

  return (
    <div ref={panelRef} className="pm-notification-bell-root" style={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => { setOpen(!open); if (!open) load(); }}
        style={{ ...iconBtn, position: "relative" }}
        aria-label="Notifikationer"
        aria-expanded={open}
      >
        <Bell size={20} color={theme.textMid} strokeWidth={2} />
        {unreadCount > 0 && (
          <span style={{ position: "absolute", top: "-2px", right: "-2px", minWidth: "17px", height: "17px", padding: "0 4px", borderRadius: "999px", background: theme.red, color: "#fff", fontSize: "9px", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1, boxSizing: "border-box" }}>
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="pm-notification-panel"
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            marginTop: "8px",
            width: "min(360px, calc(100vw - 24px))",
            maxHeight: "min(420px, 70dvh)",
            background: theme.surface,
            borderRadius: "12px",
            boxShadow: theme.shadowLg,
            border: "1px solid " + theme.border,
            zIndex: 200,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px", padding: "12px 14px", borderBottom: "1px solid " + theme.border }}>
            <span style={{ fontSize: "14px", fontWeight: 700, color: theme.text, flex: "1 1 auto", minWidth: "100px" }}>Notifikationer</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center", marginLeft: "auto" }}>
              {unreadCount > 0 && (
                <button type="button" onClick={markAllRead} style={{ background: "none", border: "none", color: theme.accent, fontSize: "11px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", fontFamily: font, padding: "4px 6px" }}>
                  <CheckCheck size={13} /> Læst
                </button>
              )}
              {notifs.length > 0 && (
                <button type="button" onClick={() => { if (window.confirm("Ryd alle notifikationer?")) clearAll(); }} style={{ background: "none", border: "none", color: theme.textMid, fontSize: "11px", fontWeight: 600, cursor: "pointer", fontFamily: font, padding: "4px 6px" }}>
                  Ryd alle
                </button>
              )}
            </div>
          </div>

          <div style={{ overflowY: "auto", flex: 1, WebkitOverflowScrolling: "touch" }}>
            {notifs.length === 0 ? (
              <div style={{ padding: "32px 16px", textAlign: "center", color: theme.textLight, fontSize: "13px" }}>
                <Bell size={24} color={theme.textLight} style={{ marginBottom: "8px" }} />
                <div>Ingen notifikationer endnu</div>
              </div>
            ) : notifs.map(n => {
              const hasMatch = Boolean(n.match_id);
              return (
              <div
                key={n.id}
                role={hasMatch ? "button" : undefined}
                tabIndex={hasMatch ? 0 : undefined}
                onClick={hasMatch ? () => openNotificationMatch(n) : undefined}
                onKeyDown={hasMatch ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openNotificationMatch(n); } } : undefined}
                style={{
                  padding: "10px 12px 10px 14px",
                  borderBottom: "1px solid " + theme.border + "80",
                  background: n.read ? "transparent" : theme.accentBg + "40",
                  transition: "background 0.2s",
                  cursor: hasMatch ? "pointer" : "default",
                }}
              >
                <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                  <span style={{ fontSize: "18px", flexShrink: 0, marginTop: "1px" }}>{typeIcon(n.type)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "13px", fontWeight: n.read ? 500 : 700, color: theme.text, marginBottom: "2px" }}>{n.title}</div>
                    <div style={{ fontSize: "12px", color: theme.textMid, lineHeight: 1.4 }}>{n.body}</div>
                    {hasMatch && (
                      <div style={{ fontSize: "10px", color: theme.accent, marginTop: "6px", fontWeight: 600 }}>Tryk for at gå til kampen →</div>
                    )}
                    <div style={{ fontSize: "10px", color: theme.textLight, marginTop: "4px" }}>{timeAgo(n.created_at)}</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px", flexShrink: 0 }}>
                    {!n.read && <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: theme.accent }} />}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); deleteOne(n.id); }}
                      title="Slet"
                      aria-label="Slet notifikation"
                      style={{ ...iconBtn, padding: "4px", color: theme.textLight }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );})}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   DASHBOARD SHELL
═══════════════════════════════════════════════════ */
function DashboardPage({ user, onLogout, showToast }) {
  const { user: authUser, refreshProfileQuiet } = useAuth();
  const displayName = resolveDisplayName(user, authUser);
  const navigate = useNavigate();
  const location = useLocation();
  const pathTab = location.pathname.split("/")[2] || "hjem";
  const validTabs = ["hjem", "makkere", "baner", "kampe", "ranking", "profil"];
  const tab = validTabs.includes(pathTab) ? pathTab : "hjem";
  const setTab = useCallback((t) => navigate("/dashboard/" + t), [navigate]);

  /* Profil i React kan være forældet efter ændringer udefra (fx SQL-reset). Hent forfra på relevante faner uden fuld loading-skærm. */
  useEffect(() => {
    if (["hjem", "profil", "ranking", "kampe"].includes(tab)) refreshProfileQuiet();
  }, [tab, refreshProfileQuiet]);

  const tabs = [
    { id: "hjem",    label: "Hjem",        icon: <Home    size={16} /> },
    { id: "makkere", label: "Find Makker", icon: <Users   size={16} /> },
    { id: "baner",   label: "Baner",       icon: <MapPin  size={16} /> },
    { id: "kampe",   label: "Kampe",       icon: <Swords  size={16} /> },
    { id: "ranking", label: "Ranking",     icon: <Trophy  size={16} /> },
    { id: "profil",  label: "Profil",      icon: <Settings size={16} /> },
  ];

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", paddingBottom: "env(safe-area-inset-bottom)" }}>
      {/* Header */}
      <div className="pm-dash-header" style={{ padding: "clamp(10px,2.5vw,14px) clamp(12px,3vw,20px)", paddingTop: "max(clamp(10px,2.5vw,14px), env(safe-area-inset-top))", borderBottom: "1px solid " + theme.border, background: theme.surface, position: "sticky", top: 0, zIndex: 20 }}>
        <div className="pm-dash-brand" style={{ ...heading("clamp(16px,4vw,18px)"), color: theme.accent }}>🎾 PadelMakker</div>
        <div className="pm-dash-user">
          <span className="pm-dash-name">{displayName}</span>
          <div className="pm-dash-header-actions">
            <NotificationBell />
            <button type="button" onClick={onLogout} style={{ ...btn(false), padding: "6px 12px", fontSize: "12px", flexShrink: 0 }}>
              <LogOut size={13} /> Log ud
            </button>
          </div>
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
        {tab === "baner"   && <BanerTab   user={user} showToast={showToast} />}
        {tab === "kampe"   && <KampeTab   user={user} showToast={showToast} tabActive />}
        {tab === "ranking" && <RankingTab user={user} />}
        {tab === "profil"  && <ProfilTab  user={user} showToast={showToast} setTab={setTab} />}
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
  const eloSyncKey = `${user.elo_rating}|${user.games_played}|${user.games_won}`;
  const { bundleLoading, profileFresh, ratedRows } = useProfileEloBundle(user.id, eloSyncKey);
  const histStats = useMemo(() => statsFromEloHistoryRows(ratedRows), [ratedRows]);
  const elo = histStats?.elo ?? Math.round(Number(profileFresh?.elo_rating) || 1000);
  const games = histStats?.games ?? (profileFresh?.games_played || 0);
  const wins = histStats?.wins ?? (profileFresh?.games_won || 0);
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

      {/* Stat cards + ELO: vent på frisk DB (undgå flash af forældede tal fra React) */}
      {bundleLoading ? (
        <div style={{ textAlign: "center", padding: "32px 16px", color: theme.textLight, fontSize: "14px", marginBottom: "24px" }}>Indlæser dine tal…</div>
      ) : (
        <>
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

      <div style={{ background: "linear-gradient(135deg, #1E3A5F, #1D4ED8)", borderRadius: theme.radius, padding: "clamp(18px,4vw,24px)", marginBottom: "24px", color: "#fff", boxShadow: theme.shadow }}>
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
        </>
      )}

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
function eloOf(p) {
  const v = Number(p?.elo_rating);
  return Number.isFinite(v) ? Math.round(v) : 1000;
}

/** Samme filter som ELO-graf / streak (kun rigtige kampe med rating). */
function filterRatedEloHistoryRows(rows) {
  return (rows || []).filter((h) => h.old_rating != null && h.match_id != null);
}

/** Stabil kronologi: samme dato → match_id → id (undgår at "seneste" række bliver forkert). */
function eloHistoryTimeMs(h) {
  const t = h?.date != null ? new Date(h.date).getTime() : NaN;
  return Number.isFinite(t) ? t : 0;
}

function compareEloHistoryChronological(a, b) {
  const ta = eloHistoryTimeMs(a);
  const tb = eloHistoryTimeMs(b);
  if (ta !== tb) return ta - tb;
  const ma = String(a?.match_id ?? "");
  const mb = String(b?.match_id ?? "");
  if (ma !== mb) return ma < mb ? -1 : ma > mb ? 1 : 0;
  const ia = String(a?.id ?? "");
  const ib = String(b?.id ?? "");
  return ia < ib ? -1 : ia > ib ? 1 : 0;
}

function sortEloHistoryChronological(rows) {
  return [...(rows || [])].sort(compareEloHistoryChronological);
}

/**
 * Nuværende ELO = rating før første kamp i listen + sum af alle `change`.
 * Matcher uge/måned-ranking (som summerer `change`) og ignorerer `new_rating`,
 * som i nogle DB-rækker kan være ét skridt bagud eller forkert.
 */
function currentEloFromSortedHistory(sorted) {
  if (!sorted.length) return 1000;
  const base = Math.round(Number(sorted[0].old_rating) || 1000);
  let sumCh = 0;
  for (const row of sorted) {
    const ch = row.change;
    if (ch != null && ch !== "" && Number.isFinite(Number(ch))) {
      sumCh += Number(ch);
    } else if (
      row.old_rating != null &&
      row.new_rating != null &&
      Number.isFinite(Number(row.old_rating)) &&
      Number.isFinite(Number(row.new_rating))
    ) {
      sumCh += Math.round(Number(row.new_rating) - Number(row.old_rating));
    }
  }
  const r = Math.round(base + sumCh);
  return Math.max(100, r);
}

/** Seneste ELO + antal kampe/sejre ud fra elo_history (kilde til graf). null hvis ingen rækker. */
function statsFromEloHistoryRows(rows) {
  const list = filterRatedEloHistoryRows(rows);
  if (!list.length) return null;
  const sorted = sortEloHistoryChronological(list);
  const elo = currentEloFromSortedHistory(sorted);
  const games = sorted.length;
  let wins = 0;
  for (const h of sorted) {
    if (h.result === "win") wins++;
  }
  return { elo, games, wins };
}

/**
 * Frisk profiles-række + rated elo_history i ét trin. Ved syncKey (opdateret profil i context)
 * vises loading igen så vi ikke flasher forældede tal. Ved fokus/genvisning opdateres stille.
 */
function useProfileEloBundle(userId, syncKey) {
  const [loading, setLoading] = useState(true);
  const [profileFresh, setProfileFresh] = useState(null);
  const [ratedRows, setRatedRows] = useState([]);

  const fetchBundle = useCallback(async (showLoading) => {
    if (!userId) {
      setProfileFresh(null);
      setRatedRows([]);
      setLoading(false);
      return;
    }
    if (showLoading) setLoading(true);
    try {
      const [pr, hist] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
        supabase
          .from("elo_history")
          .select("*")
          .eq("user_id", userId)
          .order("date", { ascending: true })
          .order("match_id", { ascending: true }),
      ]);
      setProfileFresh(normalizeProfileRow(pr.data || null));
      setRatedRows(filterRatedEloHistoryRows(hist.data || []));
    } catch {
      setProfileFresh(null);
      setRatedRows([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchBundle(true);
  }, [userId, syncKey, fetchBundle]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible" && userId) fetchBundle(false);
    };
    const onFocus = () => { if (userId) fetchBundle(false); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onFocus);
    };
  }, [userId, fetchBundle]);

  return { bundleLoading: loading, profileFresh, ratedRows, reloadProfileEloBundle: () => fetchBundle(true) };
}

/** Per bruger: seneste ELO + kampe/sejre fra elo_history (til ranking all-time). */
function allTimeStatsMapFromEloHistory(eloHistory) {
  const byUser = {};
  for (const h of eloHistory || []) {
    if (h.old_rating == null || h.match_id == null) continue;
    const uid = h.user_id;
    if (uid == null) continue;
    const key = String(uid);
    if (!byUser[key]) byUser[key] = [];
    byUser[key].push(h);
  }
  const out = {};
  for (const key of Object.keys(byUser)) {
    const s = statsFromEloHistoryRows(byUser[key]);
    if (s) out[key] = s;
  }
  return out;
}

/** Kræver rækker med `date` og `result` ("win" / andet). Sorterer kronologisk internt. */
function winStreaksFromEloHistory(raw) {
  if (!raw?.length) return { currentStreak: 0, bestStreak: 0 };
  const sorted = sortEloHistoryChronological(raw);
  let bestStreak = 0;
  for (let start = 0; start < sorted.length; start++) {
    let s = 0;
    for (let j = start; j < sorted.length; j++) {
      if (sorted[j].result === "win") {
        s++;
        bestStreak = Math.max(bestStreak, s);
      } else break;
    }
  }
  let currentStreak = 0;
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].result === "win") {
      currentStreak++;
      bestStreak = Math.max(bestStreak, currentStreak);
    } else {
      if (i === sorted.length - 1) currentStreak = 0;
      break;
    }
  }
  return { currentStreak, bestStreak };
}

function fmtClock(t) {
  if (t == null || t === "") return "";
  return String(t).slice(0, 5);
}

/** Viser "20:00–22:00" når time_end findes, ellers kun starttid. */
function matchTimeLabel(m) {
  const a = fmtClock(m.time);
  const b = m.time_end ? fmtClock(m.time_end) : "";
  if (a && b) return `${a}–${b}`;
  return a || "—";
}

function timeToMinutes(hhmm) {
  const s = fmtClock(hhmm);
  const [h, min] = s.split(":").map((x) => parseInt(x, 10));
  if (!Number.isFinite(h) || !Number.isFinite(min)) return NaN;
  return h * 60 + min;
}

/** Nyeste afsluttede kamp først: resultat-tidsstempel, ellers kamp dato+tid. */
function matchCompletedSortMs(m, resultsByMatchId) {
  const mr = resultsByMatchId[m.id];
  const ts = mr?.updated_at || mr?.created_at || mr?.confirmed_at;
  if (ts) {
    const n = new Date(ts).getTime();
    if (Number.isFinite(n)) return n;
  }
  const d = m.date || "1970-01-01";
  const t = fmtClock(m.time) || "00:00";
  const n = new Date(`${d}T${t}:00`).getTime();
  return Number.isFinite(n) ? n : 0;
}

/** Nyere kampe: level_range er ren ELO-tal som string. Ældre: "4-6" osv. */
function matchSkillLabel(m) {
  const lr = m?.level_range;
  if (lr != null && /^\d+$/.test(String(lr).trim())) return `ELO ${lr}`;
  if (m?.level_range) return `Niveau ${m.level_range}`;
  return "ELO —";
}

function MakkereTab({ user, showToast }) {
  const [search, setSearch]           = useState("");
  const [filterElo, setFilterElo]     = useState("all");
  const [filterArea, setFilterArea]   = useState("all");
  const [players, setPlayers]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [viewPlayer, setViewPlayer]   = useState(null);

  const myElo = eloOf(user);

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
    if (filterArea !== "all" && p.area !== filterArea) return false;
    if (filterElo === "close" && Math.abs(eloOf(p) - myElo) > 150) return false;
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
                  <span style={tag(theme.accentBg, theme.accent)}>ELO {eloOf(p)}</span>
                  {age && <span style={tag(theme.blueBg, theme.blue)}>{age} år</span>}
                  <span style={tag(theme.blueBg, theme.blue)}>{p.play_style || "?"}</span>
                  <span style={tag(theme.warmBg, theme.warm)}>{p.games_played || 0} kampe</span>
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

/* ═══════════════════════════════════════════════════
   BANER TAB
═══════════════════════════════════════════════════ */
function BanerTab({ user, showToast }) {
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

/* ═══════════════════════════════════════════════════
   KAMPE TAB
═══════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════
   ELO CALCULATION
═══════════════════════════════════════════════════ */
async function calculateAndApplyElo(matchId, matchWinner, ignoredPlayersList, showToast) {
  try {
    // Hent match_result ID
    const { data: mr, error: mrErr } = await supabase
      .from("match_results")
      .select("id")
      .eq("match_id", matchId)
      .eq("confirmed", true)
      .single();

    if (mrErr || !mr) {
      console.error("ELO: Kunne ikke finde bekræftet resultat:", mrErr);
      if (showToast) showToast("ELO fejl: Resultat ikke fundet.");
      return;
    }

    // Kald den sikre database-funktion
    const { data, error } = await supabase.rpc("apply_elo_for_match", {
      p_match_result_id: mr.id,
    });

    if (error) {
      console.error("ELO rpc error:", error);
      if (showToast) showToast("ELO fejl: " + error.message);
      return;
    }

    if (data?.error) {
      console.error("ELO function error:", data.error);
      if (showToast) showToast("ELO fejl: " + data.error);
      return;
    }

    if (data?.success) {
      const t1c = data.team1_change;
      const sign = t1c > 0 ? "+" : "";
      const n = Number(data.players_updated) || 0;
      if (showToast) {
        if (n === 0) {
          showToast("ELO blev ikke opdateret for nogen spillere. Tjek at alle fire spillere var med på kampen da resultatet blev gemt.");
        } else {
          showToast(`ELO opdateret for ${n} spillere! Hold 1: ${sign}${t1c}, Hold 2: ${t1c > 0 ? "" : "+"}${-t1c} 🏆`);
        }
      }
    }
  } catch (e) {
    console.error("ELO exception:", e);
    if (showToast) showToast("ELO fejl: " + (e.message || "Ukendt fejl"));
  }
}

/* ═══════════════════════════════════════════════════
   TEAM SELECTION MODAL
═══════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════
   PLAYER PROFILE MODAL
═══════════════════════════════════════════════════ */
function PlayerProfileModal({ player, onClose }) {
  const [dataLoading, setDataLoading] = useState(true);
  const [streakError, setStreakError] = useState(false);
  const [streakStats, setStreakStats] = useState({ currentStreak: 0, bestStreak: 0 });
  const [ratedHistoryRows, setRatedHistoryRows] = useState([]);
  const [profileRow, setProfileRow] = useState(null);

  useEffect(() => {
    if (!player?.id) {
      setDataLoading(false);
      setStreakStats({ currentStreak: 0, bestStreak: 0 });
      setRatedHistoryRows([]);
      setProfileRow(null);
      return;
    }
    let cancelled = false;
    setDataLoading(true);
    setStreakError(false);
    setRatedHistoryRows([]);
    setProfileRow(null);
    (async () => {
      try {
        const [pr, hist] = await Promise.all([
          supabase.from("profiles").select("*").eq("id", player.id).maybeSingle(),
          supabase.from("elo_history").select("*").eq("user_id", player.id).order("date", { ascending: true }),
        ]);
        if (cancelled) return;
        if (hist.error) throw hist.error;
        const rows = filterRatedEloHistoryRows(hist.data || []);
        setStreakStats(winStreaksFromEloHistory(rows));
        setRatedHistoryRows(rows);
        setProfileRow(pr.data || player);
      } catch {
        if (!cancelled) {
          setStreakError(true);
          setStreakStats({ currentStreak: 0, bestStreak: 0 });
          setRatedHistoryRows([]);
          setProfileRow(player);
        }
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [player?.id]);

  if (!player) return null;
  const pRef = profileRow || player;
  const histStatsModal = statsFromEloHistoryRows(ratedHistoryRows);
  const elo = dataLoading ? null : (histStatsModal?.elo ?? eloOf(pRef));
  const games = dataLoading ? null : (histStatsModal?.games ?? (pRef.games_played || 0));
  const wins = dataLoading ? null : (histStatsModal?.wins ?? (pRef.games_won || 0));
  const winPct = games != null && games > 0 ? Math.round((wins / games) * 100) : 0;
  const age = player.birth_year ? new Date().getFullYear() - player.birth_year : null;

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "16px" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: "14px", padding: "28px", maxWidth: "380px", width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        {/* Header */}
        <div style={{ display: "flex", gap: "16px", alignItems: "center", marginBottom: "20px" }}>
          <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: theme.accentBg, border: "2px solid " + theme.accent + "40", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "32px", flexShrink: 0 }}>
            {player.avatar || "🎾"}
          </div>
          <div>
            <div style={{ fontSize: "20px", fontWeight: 800, letterSpacing: "-0.02em" }}>{player.full_name || player.name || "Spiller"}</div>
            <div style={{ display: "flex", gap: "5px", marginTop: "6px", flexWrap: "wrap" }}>
              {!dataLoading && elo != null && <span style={tag(theme.accentBg, theme.accent)}>ELO {elo}</span>}
              {age && <span style={tag(theme.blueBg, theme.blue)}>{age} år</span>}
              <span style={tag(theme.warmBg, theme.warm)}><MapPin size={9} /> {player.area || "?"}</span>
            </div>
          </div>
        </div>

        {/* Stats — først når elo_history er hentet (undgå forældede tal fra liste) */}
        {dataLoading ? (
          <div style={{ textAlign: "center", padding: "16px", color: theme.textMid, fontSize: "13px", marginBottom: "16px" }}>Indlæser statistik…</div>
        ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px", marginBottom: "16px" }}>
          {[
            { label: "ELO", value: elo, color: theme.accent },
            { label: "Kampe", value: games, color: theme.blue },
            { label: "Sejre", value: wins, color: theme.warm },
            { label: "Win %", value: games != null && games > 0 ? winPct + "%" : "—", color: theme.accent },
          ].map((s, i) => (
            <div key={i} style={{ textAlign: "center", padding: "10px 4px", background: "#F8FAFC", borderRadius: "8px" }}>
              <div style={{ fontSize: "16px", fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: "9px", fontWeight: 700, color: theme.textLight, marginTop: "2px", textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</div>
            </div>
          ))}
        </div>
        )}

        {/* Sejrsstreak (samme logik som egen profil — data fra elo_history) */}
        <div style={{ marginBottom: "16px", padding: "12px 14px", background: "#FFFBEB", borderRadius: "10px", border: "1px solid rgba(217, 119, 6, 0.2)" }}>
          <div style={{ fontSize: "10px", fontWeight: 700, color: theme.textLight, textTransform: "uppercase", letterSpacing: "0.05em" }}>Sejrsstreak</div>
          {dataLoading ? (
            <div style={{ fontSize: "13px", color: theme.textMid, marginTop: "8px" }}>Indlæser…</div>
          ) : streakError ? (
            <div style={{ fontSize: "12px", color: theme.textMid, marginTop: "6px", lineHeight: 1.4 }}>Kunne ikke hente kamphistorik.</div>
          ) : (
            <>
              <div style={{ fontSize: "22px", fontWeight: 800, color: theme.warm, marginTop: "4px", letterSpacing: "-0.02em" }}>
                {streakStats.currentStreak > 0 ? `🔥 ${streakStats.currentStreak}` : "0"}
              </div>
              <div style={{ fontSize: "11px", color: theme.textMid, marginTop: "4px" }}>Bedste: {streakStats.bestStreak} i træk</div>
            </>
          )}
        </div>

        {/* Details */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
            <span style={{ color: theme.textLight }}>Spillestil</span>
            <span style={{ fontWeight: 600 }}>{player.play_style || "Ikke angivet"}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
            <span style={{ color: theme.textLight }}>Region</span>
            <span style={{ fontWeight: 600 }}>{player.area || "Ikke angivet"}</span>
          </div>
          {age && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
              <span style={{ color: theme.textLight }}>Alder</span>
              <span style={{ fontWeight: 600 }}>{age} år</span>
            </div>
          )}
          {availabilityTags(player).length > 0 && (
            <div style={{ fontSize: "13px" }}>
              <span style={{ color: theme.textLight }}>Tilgængelighed</span>
              <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginTop: "4px" }}>
                {availabilityTags(player).map((a) => <span key={a} style={tag(theme.accentBg, theme.accent)}>{a}</span>)}
              </div>
            </div>
          )}
        </div>

        {player.bio && (
          <p style={{ fontSize: "13px", color: theme.textMid, lineHeight: 1.5, marginBottom: "16px", padding: "12px", background: "#F8FAFC", borderRadius: "8px", fontStyle: "italic" }}>
            "{player.bio}"
          </p>
        )}

        <button onClick={onClose} style={{ ...btn(false), width: "100%", justifyContent: "center" }}>Luk</button>
      </div>
    </div>
  );
}

function TeamSelectModal({ matchPlayers, onSelect, onClose }) {
  const team1 = matchPlayers.filter(p => Number(p.team) === 1);
  const team2 = matchPlayers.filter(p => Number(p.team) === 2);
  const team1Full = team1.length >= 2;
  const team2Full = team2.length >= 2;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "16px" }}>
      <div style={{ background: "#fff", borderRadius: "14px", padding: "28px", maxWidth: "360px", width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <h3 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "6px", letterSpacing: "-0.02em" }}>Vælg hold</h3>
        <p style={{ fontSize: "13px", color: "#64748B", marginBottom: "20px", lineHeight: 1.5 }}>Hvilket hold vil du spille på?</p>

        <button
          onClick={() => onSelect(1)}
          disabled={team1Full}
          style={{ width: "100%", padding: "16px", marginBottom: "10px", borderRadius: "10px", border: "2px solid #1D4ED8", background: team1Full ? "#f1f5f9" : "#DBEAFE", color: team1Full ? "#94A3B8" : "#1D4ED8", fontSize: "15px", fontWeight: 700, cursor: team1Full ? "not-allowed" : "pointer", opacity: team1Full ? 0.5 : 1 }}
        >
          Hold 1 ({team1.length}/2)
          {team1.length > 0 && <div style={{ fontSize: "12px", fontWeight: 400, marginTop: "4px" }}>{team1.map(p => (p.user_name || "?").split(" ")[0]).join(", ")}</div>}
        </button>

        <button
          onClick={() => onSelect(2)}
          disabled={team2Full}
          style={{ width: "100%", padding: "16px", marginBottom: "16px", borderRadius: "10px", border: "2px solid #2563EB", background: team2Full ? "#f1f5f9" : "#EFF6FF", color: team2Full ? "#94A3B8" : "#2563EB", fontSize: "15px", fontWeight: 700, cursor: team2Full ? "not-allowed" : "pointer", opacity: team2Full ? 0.5 : 1 }}
        >
          Hold 2 ({team2.length}/2)
          {team2.length > 0 && <div style={{ fontSize: "12px", fontWeight: 400, marginTop: "4px" }}>{team2.map(p => (p.user_name || "?").split(" ")[0]).join(", ")}</div>}
        </button>

        <button onClick={onClose} style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #E2E8F0", background: "#fff", color: "#64748B", fontSize: "13px", cursor: "pointer" }}>
          Annullér
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   RESULT MODAL (wraps PadelMatchResultInput)
═══════════════════════════════════════════════════ */
function ResultModal({ team1Names, team2Names, onSubmit, onClose }) {
  // Dynamic import workaround - render inline form if PadelMatchResultInput unavailable
  const [ResultComp, setResultComp] = useState(null);
  useEffect(() => {
    import("./components/PadelMatchResultInput").then(mod => {
      setResultComp(() => mod.default);
    }).catch(() => {
      console.warn("PadelMatchResultInput not found, using inline form");
    });
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "16px", overflowY: "auto" }}>
      <div style={{ background: "#fff", borderRadius: "14px", padding: "24px", maxWidth: "500px", width: "100%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        {ResultComp ? (
          <ResultComp
            playersEditable={false}
            initialData={{ team1: team1Names, team2: team2Names, sets: [], winner: null, completed: false }}
            onSubmit={onSubmit}
            onCancel={onClose}
          />
        ) : (
          <InlineResultForm team1Names={team1Names} team2Names={team2Names} onSubmit={onSubmit} onClose={onClose} />
        )}
      </div>
    </div>
  );
}

/* Simpel fallback resultat-formular hvis PadelMatchResultInput ikke kan importeres */
function InlineResultForm({ team1Names, team2Names, onSubmit, onClose }) {
  const [sets, setSets] = useState([{ g1: "", g2: "" }, { g1: "", g2: "" }, { g1: "", g2: "" }]);

  const handleSubmit = () => {
    const parsedSets = sets.map((s, i) => ({
      setNumber: i + 1,
      gamesTeam1: parseInt(s.g1) || 0,
      gamesTeam2: parseInt(s.g2) || 0,
    })).filter(s => s.gamesTeam1 > 0 || s.gamesTeam2 > 0);

    let t1wins = 0, t2wins = 0;
    parsedSets.forEach(s => { if (s.gamesTeam1 > s.gamesTeam2) t1wins++; else if (s.gamesTeam2 > s.gamesTeam1) t2wins++; });
    const winner = t1wins > t2wins ? "team1" : t2wins > t1wins ? "team2" : null;

    onSubmit({
      team1: team1Names,
      team2: team2Names,
      sets: parsedSets,
      winner,
      completed: winner !== null,
    });
  };

  const setField = (idx, field, val) => {
    setSets(prev => prev.map((s, i) => i === idx ? { ...s, [field]: val } : s));
  };

  return (
    <div>
      <h3 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "16px" }}>Indrapportér resultat</h3>
      <div style={{ fontSize: "13px", color: "#64748B", marginBottom: "16px" }}>
        <strong style={{ color: "#1D4ED8" }}>{team1Names}</strong> vs <strong style={{ color: "#2563EB" }}>{team2Names}</strong>
      </div>
      {[0, 1, 2].map(i => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
          <span style={{ fontSize: "13px", fontWeight: 600, width: "50px" }}>Sæt {i + 1}</span>
          <input type="number" min="0" max="7" value={sets[i].g1} onChange={e => setField(i, "g1", e.target.value)} placeholder="H1" style={{ width: "60px", padding: "8px", borderRadius: "6px", border: "1px solid #E2E8F0", textAlign: "center", fontSize: "16px" }} />
          <span style={{ fontWeight: 700 }}>-</span>
          <input type="number" min="0" max="7" value={sets[i].g2} onChange={e => setField(i, "g2", e.target.value)} placeholder="H2" style={{ width: "60px", padding: "8px", borderRadius: "6px", border: "1px solid #E2E8F0", textAlign: "center", fontSize: "16px" }} />
        </div>
      ))}
      <div style={{ display: "flex", gap: "8px", marginTop: "20px" }}>
        <button onClick={onClose} style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "1px solid #E2E8F0", background: "#fff", cursor: "pointer", fontSize: "13px" }}>Annullér</button>
        <button onClick={handleSubmit} style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "none", background: "#1D4ED8", color: "#fff", cursor: "pointer", fontSize: "13px", fontWeight: 600 }}>Gem resultat</button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   KAMPE TAB (full rewrite with team selection, start, results, ELO)
═══════════════════════════════════════════════════ */
/** match_players.team kan være tal eller streng fra DB — brug altid Number ved sammenligning. */
function matchPlayerTeam(p) {
  return Number(p?.team);
}

function KampeTab({ user, showToast, tabActive = true }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user: authUser, refreshProfile } = useAuth();
  const myDisplayName                 = resolveDisplayName(user, authUser);
  const eloSyncKeyKampe = `${user.elo_rating}|${user.games_played}|${user.games_won}`;
  const { ratedRows: kampeRatedRows } = useProfileEloBundle(user.id, eloSyncKeyKampe);
  const myEloFromHistory = useMemo(() => statsFromEloHistoryRows(kampeRatedRows)?.elo ?? null, [kampeRatedRows]);
  const myElo                         = myEloFromHistory != null ? myEloFromHistory : eloOf(user);
  const [showCreate, setShowCreate]   = useState(false);
  const [courts, setCourts]           = useState([]);
  const [matches, setMatches]         = useState([]);
  const [matchPlayers, setMatchPlayers] = useState({});
  const [matchResults, setMatchResults] = useState({});
  const [loadingMatches, setLoadingMatches] = useState(true);
  const [creating, setCreating]       = useState(false);
  const [busyId, setBusyId]           = useState(null);
  const [eloByUserId, setEloByUserId] = useState({});
  const [teamSelectMatch, setTeamSelectMatch] = useState(null);
  const [resultMatch, setResultMatch] = useState(null);
  const [viewPlayer, setViewPlayer]   = useState(null);
  const [profilesById, setProfilesById] = useState({});
  const [viewTab, setViewTab]         = useState(() => {
    const s = readKampeSessionPrefs(user.id);
    if (s?.view === "open" || s?.view === "active" || s?.view === "completed") return s.view;
    return "open";
  }); // "open" | "active" | "completed"
  const [kampeFormat, setKampeFormat] = useState(() => {
    const s = readKampeSessionPrefs(user.id);
    if (s?.format === "padel" || s?.format === "americano") return s.format;
    return "padel";
  }); // "padel" | "americano"
  const [newMatch, setNewMatch]       = useState({
    court_id: "",
    date: new Date().toISOString().split("T")[0],
    time: "20:00",
    duration: "120",
    description: "",
  });

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    mergeKampeSessionPrefs(user.id, { format: kampeFormat, view: viewTab });
  }, [user.id, kampeFormat, viewTab]);

  const persistAmericanoSubTab = useCallback(
    (v) => mergeKampeSessionPrefs(user.id, { americanoView: v }),
    [user.id]
  );

  /* Notifikation: ?focus=<matchId> — vælg underfane, scroll til kort, fjern query */
  useEffect(() => {
    if (!tabActive || loadingMatches) return;
    const params = new URLSearchParams(location.search);
    const mid = params.get("focus");
    if (!mid) return;
    if (!matches.length) return;
    const m = matches.find((x) => String(x.id) === String(mid));
    if (!m) {
      navigate("/dashboard/kampe", { replace: true });
      return;
    }
    const st = (m.status ?? "open").toString().toLowerCase();
    const mp = matchPlayers[m.id] || [];
    const imIn = mp.some((p) => p.user_id === user.id);
    if (st === "in_progress" && imIn) setViewTab("active");
    else if (st === "completed" && imIn) setViewTab("completed");
    else setViewTab("open");
    navigate("/dashboard/kampe", { replace: true });
    const t = window.setTimeout(() => {
      document.getElementById("pm-match-" + String(mid))?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 200);
    return () => window.clearTimeout(t);
  }, [tabActive, loadingMatches, matches, matchPlayers, user.id, location.search, navigate]);

  const loadData = async () => {
    try {
      const [cd, md, profiles] = await Promise.all([Court.filter(), Match.filter(), Profile.filter()]);
      setCourts(cd || []);
      const eloMap = {};
      const pById = {};
      (profiles || []).forEach((pr) => { eloMap[String(pr.id)] = eloOf(pr); pById[String(pr.id)] = pr; });
      setEloByUserId(eloMap);
      setProfilesById(pById);

      const allMatches = md || [];
      setMatches(allMatches);

      if (cd?.length > 0) setNewMatch((m) => (m.court_id ? m : { ...m, court_id: cd[0].id }));

      const { data: mpd } = await supabase.from("match_players").select("*");
      const mm = {};
      (mpd || []).forEach((mp) => {
        if (!mm[mp.match_id]) mm[mp.match_id] = [];
        mm[mp.match_id].push(mp);
      });
      setMatchPlayers(mm);

      // Load match results
      const { data: mrd } = await supabase.from("match_results").select("*");
      const mrMap = {};
      (mrd || []).forEach((mr) => { mrMap[mr.match_id] = mr; });
      setMatchResults(mrMap);
    } catch (e) { console.error(e); }
    finally { setLoadingMatches(false); }
  };

  const createMatch = async () => {
    const startM = timeToMinutes(newMatch.time);
    if (!Number.isFinite(startM)) { showToast("Vælg en gyldig starttid."); return; }
    const dur = parseInt(newMatch.duration, 10);
    if (!dur || dur < 60) { showToast("Varighed skal være mindst 1 time."); return; }
    const endM = startM + dur;
    const endH = String(Math.floor(endM / 60) % 24).padStart(2, "0");
    const endMin = String(endM % 60).padStart(2, "0");
    const timeEnd = endH + ":" + endMin;
    setCreating(true);
    try {
      const court = courts.find(c => c.id === newMatch.court_id);
      const row = {
        creator_id: user.id, court_id: newMatch.court_id, court_name: court?.name || "",
        date: newMatch.date, time: fmtClock(newMatch.time), time_end: timeEnd,
        level_range: String(myElo), status: "open", max_players: 4, current_players: 1,
        description: sanitizeText(newMatch.description.trim()) || null,
      };
      const { data: created, error } = await supabase.from("matches").insert(row).select().single();
      if (error) throw error;
      await supabase.from("match_players").insert({
        match_id: created.id, user_id: user.id, user_name: myDisplayName,
        user_email: authUser?.email || user.email, user_emoji: user.avatar || "🎾", team: 1,
      });
      setShowCreate(false);
      showToast("Kamp oprettet! Du er på Hold 1 🎾");
      await loadData();
    } catch (e) { showToast("Fejl: " + (e.message || "Prøv igen")); }
    finally { setCreating(false); }
  };

  const joinMatchWithTeam = async (matchId, teamNum) => {
    setTeamSelectMatch(null);
    setBusyId(matchId);
    try {
      const { error } = await supabase.from("match_players").insert({
        match_id: matchId, user_id: user.id, user_name: myDisplayName,
        user_email: authUser?.email || user.email, user_emoji: user.avatar || "🎾", team: teamNum,
      });
      if (error) throw error;

      // Check if match is now full (4 players, 2 per team)
      const mp = [...(matchPlayers[matchId] || []), { user_id: user.id, team: teamNum }];
      const t1 = mp.filter(p => matchPlayerTeam(p) === 1).length;
      const t2 = mp.filter(p => matchPlayerTeam(p) === 2).length;
      if (t1 >= 2 && t2 >= 2) {
        await supabase.from("matches").update({ status: "full", current_players: 4 }).eq("id", matchId);
      } else {
        await supabase.from("matches").update({ current_players: mp.length }).eq("id", matchId);
      }

      /* Underret opretter via RPC (læser creator_id server-side — RLS kan skjule creator for B) */
      {
        const { error: nErr } = await supabase.rpc("notify_match_creator_on_join", {
          p_match_id: matchId,
          p_title: "Ny spiller tilmeldt!",
          p_body: `${myDisplayName} har tilmeldt sig Hold ${teamNum} i din kamp.`,
        });
        if (nErr) {
          console.warn("notify_match_creator_on_join:", nErr.message || nErr);
          showToast(
            "Tilmelding gemt, men notifikation fejlede. Kør opdateret create_notification_rpc.sql (notify_match_creator_on_join) i Supabase."
          );
        }
      }
      // Notify all players if match is now full
      if (t1 >= 2 && t2 >= 2) {
        mp.filter(p => p.user_id !== user.id).forEach(p => {
          createNotification(p.user_id, "match_full", "Kampen er fuld! 🎾", "Alle 4 pladser er fyldt — kampen er klar til at starte.", matchId);
        });
      }

      showToast(`Du er tilmeldt Hold ${teamNum}! ⚔️`);
      await loadData();
    } catch (e) { showToast("Fejl: " + (e.message || "Prøv igen")); }
    finally { setBusyId(null); }
  };

  const leaveMatch = async (matchId) => {
    setBusyId(matchId);
    try {
      const { error } = await supabase.from("match_players").delete().eq("match_id", matchId).eq("user_id", user.id);
      if (error) throw error;
      const mp = (matchPlayers[matchId] || []).filter(p => p.user_id !== user.id);
      const match = matches.find(m => m.id === matchId);
      const isCreator = match && String(match.creator_id) === String(user.id);

      if (mp.length === 0) {
        await supabase.from("matches").update({ status: "cancelled", current_players: 0 }).eq("id", matchId);
        showToast("Kampen er slettet (ingen spillere tilbage).");
      } else if (isCreator) {
        await supabase.from("matches").update({ creator_id: mp[0].user_id, status: "open", current_players: mp.length }).eq("id", matchId);
        showToast("Du er afmeldt. Kampen er givet videre.");
      } else {
        await supabase.from("matches").update({ status: "open", current_players: mp.length }).eq("id", matchId);
        showToast("Du er afmeldt.");
      }
      await loadData();
    } catch (e) { showToast("Fejl: " + (e.message || "Prøv igen")); }
    finally { setBusyId(null); }
  };

  const startMatch = async (matchId) => {
    setBusyId(matchId);
    try {
      const { error } = await supabase.from("matches").update({
        status: "in_progress", started_by: user.id, started_at: new Date().toISOString(),
      }).eq("id", matchId);
      if (error) throw error;
      showToast("Kampen er startet! Held og lykke 🎾");
      await loadData();
    } catch (e) { showToast("Fejl: " + (e.message || "Prøv igen")); }
    finally { setBusyId(null); }
  };

  const deleteMatch = async (matchId) => {
    const mp = matchPlayers[matchId] || [];
    const others = mp.filter(p => p.user_id !== user.id);
    const msg = others.length > 0
      ? `Slet denne kamp? ${others.length} andre spillere bliver også afmeldt.`
      : "Slet denne kamp?";
    if (!window.confirm(msg)) return;
    setBusyId(matchId);
    try {
      const mpBefore = matchPlayers[matchId] || [];
      await supabase.from("match_players").delete().eq("match_id", matchId);
      await supabase.from("matches").update({ status: "cancelled", current_players: 0 }).eq("id", matchId).eq("creator_id", user.id);
      mpBefore.filter(p => p.user_id !== user.id).forEach(p => {
        createNotification(p.user_id, "match_cancelled", "Kamp aflyst ❌", `${myDisplayName} har aflyst kampen.`, matchId);
      });
      showToast("Kamp slettet.");
      await loadData();
    } catch (e) { showToast("Fejl: " + (e.message || "Prøv igen")); }
    finally { setBusyId(null); }
  };

  const submitResult = async (matchId, result) => {
    setResultMatch(null);
    setBusyId(matchId);
    try {
      const mp = matchPlayers[matchId] || [];
      const t1 = mp.filter(p => matchPlayerTeam(p) === 1);
      const t2 = mp.filter(p => matchPlayerTeam(p) === 2);

      const scoreDisplay = result.sets
        .filter(s => s.gamesTeam1 > 0 || s.gamesTeam2 > 0)
        .map(s => `${s.gamesTeam1}-${s.gamesTeam2}`)
        .join(", ");

      const { error } = await supabase.from("match_results").insert({
        match_id: matchId,
        team1_player1_id: t1[0]?.user_id, team1_player2_id: t1[1]?.user_id,
        team2_player1_id: t2[0]?.user_id, team2_player2_id: t2[1]?.user_id,
        set1_team1: result.sets[0]?.gamesTeam1, set1_team2: result.sets[0]?.gamesTeam2,
        set1_tb1: result.sets[0]?.tiebreakTeam1, set1_tb2: result.sets[0]?.tiebreakTeam2,
        set2_team1: result.sets[1]?.gamesTeam1, set2_team2: result.sets[1]?.gamesTeam2,
        set2_tb1: result.sets[1]?.tiebreakTeam1, set2_tb2: result.sets[1]?.tiebreakTeam2,
        set3_team1: result.sets[2]?.gamesTeam1, set3_team2: result.sets[2]?.gamesTeam2,
        set3_tb1: result.sets[2]?.tiebreakTeam1, set3_tb2: result.sets[2]?.tiebreakTeam2,
        sets_won_team1: result.sets.filter(s => s.gamesTeam1 > s.gamesTeam2).length,
        sets_won_team2: result.sets.filter(s => s.gamesTeam2 > s.gamesTeam1).length,
        match_winner: result.winner,
        score_display: scoreDisplay,
        submitted_by: user.id,
        confirmed: false,
      });
      if (error) throw error;
      // Notify other players to confirm the result
      mp.filter(p => p.user_id !== user.id).forEach(p => {
        createNotification(p.user_id, "result_submitted", "Resultat indsendt 📊", `${myDisplayName} har indsendt et resultat (${scoreDisplay}). Bekræft venligst.`, matchId);
      });
      showToast("Resultat indsendt! Venter på bekræftelse ⏳");
      await loadData();
    } catch (e) { showToast("Fejl: " + (e.message || "Prøv igen")); }
    finally { setBusyId(null); }
  };

  const confirmResult = async (matchId) => {
    setBusyId(matchId);
    try {
      const mr = matchResults[matchId];
      if (!mr) return;
      const { error } = await supabase.from("match_results").update({ confirmed: true, confirmed_by: user.id }).eq("id", mr.id);
      if (error) throw error;

      // Calculate ELO
      const mp = matchPlayers[matchId] || [];
      await calculateAndApplyElo(matchId, mr.match_winner, mp, showToast);
      refreshProfile();
      // Notify all players about ELO update
      mp.forEach(p => {
        createNotification(p.user_id, "result_confirmed", "Resultat bekræftet! 🏆", `Kampen er afsluttet (${mr.score_display || "—"}). ELO er opdateret.`, matchId);
      });
      showToast("Resultat bekræftet! ELO opdateret 🏆");
      await loadData();
    } catch (e) { showToast("Fejl: " + (e.message || "Prøv igen")); }
    finally { setBusyId(null); }
  };

  const rejectResult = async (matchId) => {
    setBusyId(matchId);
    try {
      const mr = matchResults[matchId];
      if (!mr) return;
      await supabase.from("match_results").delete().eq("id", mr.id);
      showToast("Resultat afvist. Indrapportér igen.");
      await loadData();
    } catch (e) { showToast("Fejl: " + (e.message || "Prøv igen")); }
    finally { setBusyId(null); }
  };

  const getStatus = (m) => (m.status ?? "open").toString().toLowerCase();
  const sortJoinedFirst = (list) => [...list].sort((a, b) => {
    const aJ = (matchPlayers[a.id] || []).some(p => p.user_id === user.id) ? 1 : 0;
    const bJ = (matchPlayers[b.id] || []).some(p => p.user_id === user.id) ? 1 : 0;
    return bJ - aJ;
  });
  const openMatches = sortJoinedFirst(matches.filter(m => { const s = getStatus(m); if (s !== "open" && s !== "active" && s !== "full") return false; return (matchPlayers[m.id] || []).length > 0; }));
  const activeMatches = matches.filter(m => getStatus(m) === "in_progress" && (matchPlayers[m.id] || []).some(p => p.user_id === user.id));
  const completedMatches = matches
    .filter(m => getStatus(m) === "completed" && (matchPlayers[m.id] || []).some(p => p.user_id === user.id))
    .sort((a, b) => matchCompletedSortMs(b, matchResults) - matchCompletedSortMs(a, matchResults))
    .slice(0, 20);

  const renderMatchCard = (m, mode) => {
    const mp = matchPlayers[m.id] || [];
    const mr = matchResults[m.id];
    const left = (m.max_players || 4) - mp.length;
    const joined = mp.some(p => p.user_id === user.id);
    const isCreator = String(m.creator_id) === String(user.id);
    const busy = busyId === m.id;
    const status = getStatus(m);
    const t1 = mp.filter(p => matchPlayerTeam(p) === 1);
    const t2 = mp.filter(p => matchPlayerTeam(p) === 2);
    const t1Names = t1.map(p => (p.user_name || "?").split(" ")[0]).join(" & ") || "—";
    const t2Names = t2.map(p => (p.user_name || "?").split(" ")[0]).join(" & ") || "—";
    const isFull = t1.length >= 2 && t2.length >= 2;
    const isPlayerInMatch = mp.some(p => p.user_id === user.id);

    const statusLabel = {
      open: { text: left > 0 ? `${left} ledig${left > 1 ? "e" : ""}` : "Fuld", bg: left > 0 ? theme.accentBg : theme.warmBg, color: left > 0 ? theme.accent : theme.warm },
      full: { text: "Klar til start", bg: theme.blueBg, color: theme.blue },
      in_progress: { text: "I gang", bg: theme.warmBg, color: theme.warm },
      completed: { text: "Afsluttet", bg: "#F1F5F9", color: theme.textLight },
    }[status] || { text: status, bg: "#F1F5F9", color: theme.textLight };

    return (
      <div id={"pm-match-" + m.id} key={m.id} style={{ background: theme.surface, borderRadius: theme.radius, padding: "20px", boxShadow: theme.shadow, border: "1px solid " + theme.border, scrollMarginTop: "88px" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px", gap: "10px" }}>
          <div>
            <div style={{ fontSize: "15px", fontWeight: 700, display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
              <Clock size={15} color={theme.accent} />
              <span>{m.date} · {matchTimeLabel(m)}</span>
            </div>
            <div style={{ fontSize: "12px", color: theme.textLight, marginTop: "4px", display: "flex", alignItems: "center", gap: "3px" }}><MapPin size={11} /> {m.court_name}</div>
            {m.description && <div style={{ fontSize: "12px", color: theme.textMid, marginTop: "4px", fontStyle: "italic", lineHeight: 1.4 }}>💬 {m.description}</div>}
          </div>
          <span style={{ ...tag(statusLabel.bg, statusLabel.color), flexShrink: 0 }}>{statusLabel.text}</span>
        </div>

        {/* Teams display */}
        {(() => {
          const myUid = String(user.id);
          const playerElo = (p) => {
            const uid = String(p.user_id);
            if (uid === myUid && myEloFromHistory != null) return myEloFromHistory;
            return eloByUserId[uid] ?? 1000;
          };
          const avgElo = (team) => team.length > 0 ? Math.round(team.reduce((s, p) => s + playerElo(p), 0) / team.length) : null;
          const t1Avg = avgElo(t1);
          const t2Avg = avgElo(t2);
          return (
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px", padding: "12px", background: "#F8FAFC", borderRadius: "8px" }}>
              {/* Team 1 */}
              <div style={{ flex: 1, textAlign: "center" }}>
                <div style={{ fontSize: "10px", fontWeight: 700, color: theme.accent, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "2px" }}>Hold 1</div>
                {t1Avg !== null && <div style={{ fontSize: "10px", fontWeight: 700, color: theme.accent, marginBottom: "6px", opacity: 0.7 }}>{t1Avg} ELO</div>}
                {t1Avg === null && <div style={{ height: "6px" }} />}
                <div style={{ display: "flex", justifyContent: "center", gap: "8px" }}>
                  {t1.map(p => (
                    <div key={p.id || p.user_id} onClick={() => { const prof = profilesById[String(p.user_id)]; if (prof) setViewPlayer(prof); }} style={{ display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer", minWidth: "42px" }}>
                      <div style={{ width: "34px", height: "34px", borderRadius: "50%", background: theme.accentBg, border: "1.5px solid " + theme.accent + "40", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "15px" }}>{p.user_emoji || "🎾"}</div>
                      <span style={{ fontSize: "9px", color: theme.text, marginTop: "3px", fontWeight: 600 }}>{(p.user_name || "?").split(" ")[0]}</span>
                      <span style={{ fontSize: "8px", color: theme.accent, fontWeight: 700 }}>{playerElo(p)}</span>
                    </div>
                  ))}
                  {Array.from({ length: Math.max(0, 2 - t1.length) }).map((_, i) => (
                    <div key={"t1e" + i} style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: "42px" }}>
                      <div style={{ width: "34px", height: "34px", borderRadius: "50%", border: "1.5px dashed " + theme.border, display: "flex", alignItems: "center", justifyContent: "center" }}><Plus size={10} color={theme.textLight} /></div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
                <div style={{ fontSize: "14px", fontWeight: 800, color: theme.textLight }}>vs</div>
              </div>

              {/* Team 2 */}
              <div style={{ flex: 1, textAlign: "center" }}>
                <div style={{ fontSize: "10px", fontWeight: 700, color: theme.blue, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "2px" }}>Hold 2</div>
                {t2Avg !== null && <div style={{ fontSize: "10px", fontWeight: 700, color: theme.blue, marginBottom: "6px", opacity: 0.7 }}>{t2Avg} ELO</div>}
                {t2Avg === null && <div style={{ height: "6px" }} />}
                <div style={{ display: "flex", justifyContent: "center", gap: "8px" }}>
                  {t2.map(p => (
                    <div key={p.id || p.user_id} onClick={() => { const prof = profilesById[String(p.user_id)]; if (prof) setViewPlayer(prof); }} style={{ display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer", minWidth: "42px" }}>
                      <div style={{ width: "34px", height: "34px", borderRadius: "50%", background: theme.blueBg, border: "1.5px solid " + theme.blue + "40", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "15px" }}>{p.user_emoji || "🎾"}</div>
                      <span style={{ fontSize: "9px", color: theme.text, marginTop: "3px", fontWeight: 600 }}>{(p.user_name || "?").split(" ")[0]}</span>
                      <span style={{ fontSize: "8px", color: theme.blue, fontWeight: 700 }}>{playerElo(p)}</span>
                    </div>
                  ))}
                  {Array.from({ length: Math.max(0, 2 - t2.length) }).map((_, i) => (
                    <div key={"t2e" + i} style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: "42px" }}>
                      <div style={{ width: "34px", height: "34px", borderRadius: "50%", border: "1.5px dashed " + theme.border, display: "flex", alignItems: "center", justifyContent: "center" }}><Plus size={10} color={theme.textLight} /></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Score display for completed/result pending */}
        {mr && (() => {
          const myTeam = t1.some(p => p.user_id === user.id) ? "team1" : t2.some(p => p.user_id === user.id) ? "team2" : null;
          const iWon = mr.confirmed && myTeam === mr.match_winner;
          const iLost = mr.confirmed && myTeam && myTeam !== mr.match_winner;
          const bgColor = !mr.confirmed ? theme.warmBg : iWon ? theme.accentBg : iLost ? theme.redBg : "#F1F5F9";
          const borderColor = !mr.confirmed ? theme.warm : iWon ? theme.accent : iLost ? theme.red : theme.border;
          const textColor = !mr.confirmed ? theme.warm : iWon ? theme.accent : iLost ? theme.red : theme.textMid;
          return (
            <div style={{ padding: "14px", background: bgColor, borderRadius: "8px", marginBottom: "12px", textAlign: "center", border: "1.5px solid " + borderColor + "40" }}>
              <div style={{ fontSize: "20px", fontWeight: 800, letterSpacing: "0.05em", color: textColor }}>{mr.score_display || "—"}</div>
              <div style={{ fontSize: "12px", color: textColor, marginTop: "5px", fontWeight: 600 }}>
                {!mr.confirmed ? "⏳ Venter på bekræftelse" : iWon ? "🏆 Du vandt!" : iLost ? "😞 Du tabte" : `🏆 ${mr.match_winner === "team1" ? "Hold 1" : "Hold 2"} vandt`}
              </div>
            </div>
          );
        })()}

        {/* Actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {status === "open" && left > 0 && !joined && (
            <button onClick={() => setTeamSelectMatch(m.id)} disabled={busy} style={{ ...btn(true), width: "100%", justifyContent: "center", fontSize: "13px" }}>Tilmeld mig</button>
          )}
          {joined && status !== "completed" && (
            <div style={{ textAlign: "center", fontSize: "13px", color: theme.accent, fontWeight: 600 }}>✅ Tilmeldt</div>
          )}
          {isCreator && (status === "full" || (status === "open" && isFull)) && (
            <button onClick={() => startMatch(m.id)} disabled={busy} style={{ ...btn(true), width: "100%", justifyContent: "center", fontSize: "13px", background: theme.warm }}>
              🎾 Start kamp
            </button>
          )}
          {status === "in_progress" && isPlayerInMatch && !mr && (
            <button onClick={() => setResultMatch(m.id)} disabled={busy} style={{ ...btn(true), width: "100%", justifyContent: "center", fontSize: "13px" }}>
              📊 Indrapportér resultat
            </button>
          )}
          {mr && !mr.confirmed && mr.submitted_by !== user.id && isPlayerInMatch && (
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={() => confirmResult(m.id)} disabled={busy} style={{ ...btn(true), flex: 1, justifyContent: "center", fontSize: "13px" }}>✅ Bekræft</button>
              <button onClick={() => rejectResult(m.id)} disabled={busy} style={{ ...btn(false), flex: 1, justifyContent: "center", fontSize: "13px", color: theme.red }}>❌ Afvis</button>
            </div>
          )}
          {joined && !isCreator && (status === "open" || status === "full") && (
            <button onClick={() => leaveMatch(m.id)} disabled={busy} style={{ ...btn(false), width: "100%", justifyContent: "center", fontSize: "13px", color: theme.textMid }}>
              <UserMinus size={14} /> Afmeld mig
            </button>
          )}
          {isCreator && status !== "completed" && status !== "in_progress" && (
            <button onClick={() => deleteMatch(m.id)} disabled={busy} style={{ ...btn(false), width: "100%", justifyContent: "center", fontSize: "13px", color: theme.red, borderColor: theme.red + "55" }}>
              <Trash2 size={14} /> Slet kamp
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="pm-kampe-head" style={{ marginBottom: "16px" }}>
        <h2 style={{ ...heading("clamp(20px,4.5vw,24px)") }}>Kampe</h2>
        {kampeFormat === "padel" && !loadingMatches && (
          <button onClick={() => setShowCreate(!showCreate)} style={btn(true)}>
            {showCreate ? "Annullér" : <><Plus size={15} /> Opret kamp</>}
          </button>
        )}
      </div>

      <div style={{ display: "flex", gap: "8px", marginBottom: "20px", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => { setKampeFormat("padel"); setShowCreate(false); }}
          style={{ ...btn(kampeFormat === "padel"), padding: "8px 16px", fontSize: "13px" }}
        >
          Almindelig padel (2v2)
        </button>
        <button
          type="button"
          onClick={() => { setKampeFormat("americano"); setShowCreate(false); }}
          style={{ ...btn(kampeFormat === "americano"), padding: "8px 16px", fontSize: "13px" }}
        >
          Americano
        </button>
      </div>

      {loadingMatches ? (
        <div style={{ textAlign: "center", padding: "40px", color: theme.textLight, fontSize: "14px" }}>Indlæser kampe...</div>
      ) : (
      <>
      {kampeFormat === "americano" && (
        <AmericanoTab
          profile={user}
          showToast={showToast}
          initialSubTab={(() => {
            const s = readKampeSessionPrefs(user.id);
            if (s?.americanoView === "open" || s?.americanoView === "playing" || s?.americanoView === "completed") {
              return s.americanoView;
            }
            return undefined;
          })()}
          onAmericanoSubTabChange={persistAmericanoSubTab}
        />
      )}

      {kampeFormat === "padel" && (
      <>
      {/* View tabs */}
      <div style={{ display: "flex", gap: "6px", marginBottom: "16px" }}>
        {[
          { id: "open", label: `Åbne (${openMatches.length})` },
          { id: "active", label: `I gang (${activeMatches.length})` },
          { id: "completed", label: `Afsluttede (${completedMatches.length})` },
        ].map(t => (
          <button key={t.id} onClick={() => setViewTab(t.id)} style={{ ...btn(viewTab === t.id), padding: "7px 14px", fontSize: "12px" }}>{t.label}</button>
        ))}
      </div>

      {/* Create match form */}
      {showCreate && (
        <div style={{ background: theme.surface, borderRadius: theme.radius, padding: "clamp(16px,3vw,20px)", boxShadow: theme.shadow, marginBottom: "20px", border: "1px solid " + theme.border }}>
          <h3 style={{ fontSize: "15px", fontWeight: 700, marginBottom: "12px" }}>Opret ny kamp</h3>
          <p style={{ fontSize: "13px", color: theme.textMid, marginBottom: "16px" }}>Din ELO <strong>{myElo}</strong> — du sættes automatisk på Hold 1.</p>
          <div className="pm-form-2col">
            <div style={{ gridColumn: "1 / -1" }}><label style={labelStyle}>Bane</label>
              <select value={newMatch.court_id} onChange={e => setNewMatch(m => ({ ...m, court_id: e.target.value }))} style={{ ...inputStyle, fontSize: "13px" }}>
                {courts.length === 0 ? <option value="">Ingen baner</option> : courts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select></div>
            <div><label style={labelStyle}>Dato</label>
              <input type="date" value={newMatch.date} onChange={e => setNewMatch(m => ({ ...m, date: e.target.value }))} style={{ ...inputStyle, fontSize: "13px" }} /></div>
            <div><label style={labelStyle}>Starttid</label>
              <input type="time" value={newMatch.time} onChange={e => setNewMatch(m => ({ ...m, time: e.target.value }))} style={{ ...inputStyle, fontSize: "13px" }} /></div>
            <div><label style={labelStyle}>Varighed</label>
              <select value={newMatch.duration} onChange={e => setNewMatch(m => ({ ...m, duration: e.target.value }))} style={{ ...inputStyle, fontSize: "13px" }}>
                <option value="60">1 time</option>
                <option value="90">1½ time</option>
                <option value="120">2 timer</option>
                <option value="150">2½ timer</option>
                <option value="180">3 timer</option>
              </select></div>
          </div>
          <label style={{ ...labelStyle, marginTop: "12px" }}>Beskrivelse (valgfrit)</label>
          <textarea value={newMatch.description} onChange={e => setNewMatch(m => ({ ...m, description: e.target.value }))} placeholder="F.eks. 'Søger venstreside-spiller' eller 'Begyndervenlig kamp'" style={{ ...inputStyle, fontSize: "13px", height: "60px", resize: "vertical" }} />
          <button onClick={createMatch} disabled={creating || !newMatch.court_id} style={{ ...btn(true), marginTop: "16px", width: "100%", justifyContent: "center", opacity: creating ? 0.55 : 1 }}>
            {creating ? "Opretter..." : "Opret kamp"}
          </button>
        </div>
      )}

      {/* Match list */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {viewTab === "open" && openMatches.map(m => renderMatchCard(m, "open"))}
        {viewTab === "active" && activeMatches.map(m => renderMatchCard(m, "active"))}
        {viewTab === "completed" && completedMatches.map(m => renderMatchCard(m, "completed"))}

        {viewTab === "open" && openMatches.length === 0 && <div style={{ textAlign: "center", padding: "48px 20px", color: theme.textLight }}><div style={{ fontSize: "32px", marginBottom: "12px" }}>⚔️</div><div style={{ fontSize: "15px", fontWeight: 600, color: theme.text, marginBottom: "6px" }}>Ingen åbne kampe</div><div style={{ fontSize: "13px", lineHeight: 1.5, marginBottom: "16px" }}>Opret den første kamp og find nogen at spille med!</div><button onClick={() => setShowCreate(true)} style={{ ...btn(true), fontSize: "13px" }}><Plus size={14} /> Opret kamp</button></div>}
        {viewTab === "active" && activeMatches.length === 0 && <div style={{ textAlign: "center", padding: "48px 20px", color: theme.textLight }}><div style={{ fontSize: "32px", marginBottom: "12px" }}>🎾</div><div style={{ fontSize: "15px", fontWeight: 600, color: theme.text, marginBottom: "6px" }}>Ingen aktive kampe</div><div style={{ fontSize: "13px", lineHeight: 1.5 }}>Tilmeld dig en åben kamp for at komme i gang.</div></div>}
        {viewTab === "completed" && completedMatches.length === 0 && <div style={{ textAlign: "center", padding: "48px 20px", color: theme.textLight }}><div style={{ fontSize: "32px", marginBottom: "12px" }}>📊</div><div style={{ fontSize: "15px", fontWeight: 600, color: theme.text, marginBottom: "6px" }}>Ingen afsluttede kampe endnu</div><div style={{ fontSize: "13px", lineHeight: 1.5 }}>Spil din første kamp og se dit resultat her.</div></div>}
      </div>

      {/* Team selection modal */}
      {teamSelectMatch && (
        <TeamSelectModal
          matchPlayers={matchPlayers[teamSelectMatch] || []}
          onSelect={(teamNum) => joinMatchWithTeam(teamSelectMatch, teamNum)}
          onClose={() => setTeamSelectMatch(null)}
        />
      )}

      {/* Result input modal */}
      {resultMatch && kampeFormat === "padel" && (() => {
        const mp = matchPlayers[resultMatch] || [];
        const t1 = mp.filter(p => matchPlayerTeam(p) === 1);
        const t2 = mp.filter(p => matchPlayerTeam(p) === 2);
        const t1Names = t1.map(p => (p.user_name || "?").split(" ")[0]).join(" & ") || "Hold 1";
        const t2Names = t2.map(p => (p.user_name || "?").split(" ")[0]).join(" & ") || "Hold 2";
        return (
          <ResultModal
            team1Names={t1Names}
            team2Names={t2Names}
            onSubmit={(result) => submitResult(resultMatch, result)}
            onClose={() => setResultMatch(null)}
          />
        );
      })()}

      {/* Player profile modal */}
      {viewPlayer && <PlayerProfileModal player={viewPlayer} onClose={() => setViewPlayer(null)} />}
      </>
      )}
      </>
      )}
    </div>
  );
}
/* ═══════════════════════════════════════════════════
   PROFIL TAB
═══════════════════════════════════════════════════ */
function splitDisplayNameToFirstLast(full) {
  const t = String(full || "").trim();
  const i = t.indexOf(" ");
  if (i === -1) return { first_name: t, last_name: "" };
  return { first_name: t.slice(0, i).trim(), last_name: t.slice(i + 1).trim() };
}

function profileFormState(p) {
  const { first_name, last_name } = splitDisplayNameToFirstLast(p.full_name || p.name || "");
  return {
    first_name,
    last_name,
    full_name: p.full_name || p.name || "",
    area: p.area || DEFAULT_REGION,
    play_style: p.play_style || "Ved ikke endnu",
    bio: p.bio || "",
    avatar: p.avatar || "🎾",
    availability: normalizeStringArrayField(p.availability),
    birth_year: p.birth_year ? String(p.birth_year) : "",
  };
}

function formatEloHistoryDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString("da-DK", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function EloGraph({ data }) {
  const svgRef = useRef(null);
  const [hoverIdx, setHoverIdx] = useState(null);

  const W = 320, H = 140, PX = 32, PY = 20;
  const hasGraph = data && data.length >= 2;
  const sorted = hasGraph ? sortEloHistoryChronological(data) : [];
  const values = (() => {
    if (!sorted.length) return [];
    let r = Math.round(Number(sorted[0].old_rating) || 1000);
    return sorted.map((d) => {
      const ch = d.change;
      if (ch != null && ch !== "" && Number.isFinite(Number(ch))) {
        r = Math.round(r + Number(ch));
      } else if (
        d.old_rating != null &&
        d.new_rating != null &&
        Number.isFinite(Number(d.old_rating)) &&
        Number.isFinite(Number(d.new_rating))
      ) {
        r = Math.round(Number(d.new_rating));
      }
      return r;
    });
  })();
  const minV = hasGraph ? Math.min(...values) - 20 : 1000;
  const maxV = hasGraph ? Math.max(...values) + 20 : 1000;
  const rangeV = maxV - minV || 1;

  const points = hasGraph
    ? sorted.map((d, i) => {
        const x = PX + (i / (sorted.length - 1)) * (W - PX * 2);
        const y = PY + (1 - (values[i] - minV) / rangeV) * (H - PY * 2);
        return { x, y, val: values[i], date: d.date };
      })
    : [];

  /** Map screen X to SVG user space (viewBox coords). Default "meet" scaling centers the graph, so rect-width ≠ viewBox width — getScreenCTM fixes that. */
  const clientXToSvgX = (clientX) => {
    const el = svgRef.current;
    if (!el) return 0;
    const pt = el.createSVGPoint();
    pt.x = clientX;
    pt.y = 0;
    const ctm = el.getScreenCTM();
    if (ctm) {
      const inv = ctm.inverse();
      return pt.matrixTransform(inv).x;
    }
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return 0;
    return ((clientX - rect.left) / rect.width) * W;
  };

  const pickNearestIndex = (clientX) => {
    if (points.length === 0) return 0;
    let svgX = clientXToSvgX(clientX);
    const xMin = points[0].x;
    const xMax = points[points.length - 1].x;
    svgX = Math.max(xMin, Math.min(xMax, svgX));
    let best = 0;
    let bestDist = Infinity;
    points.forEach((p, i) => {
      const dist = Math.abs(p.x - svgX);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });
    return best;
  };

  const onSvgPointerMove = (e) => {
    setHoverIdx(pickNearestIndex(e.clientX));
  };

  const onSvgPointerLeave = () => {
    setHoverIdx(null);
  };

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const areaPath = hasGraph && points.length > 0
    ? line + ` L${points[points.length - 1].x},${H - PY} L${points[0].x},${H - PY} Z`
    : "";

  const gridLines = 3;
  const gridVals = Array.from({ length: gridLines }, (_, i) => Math.round(minV + (rangeV * (i / (gridLines - 1)))));

  const hi = hoverIdx != null && points[hoverIdx] ? points[hoverIdx] : null;
  const last = points[points.length - 1];

  if (!hasGraph) {
    return (
      <div style={{ textAlign: "center", padding: "24px", color: theme.textLight, fontSize: "13px" }}>
        Spil mindst 2 kampe for at se din ELO-graf.
      </div>
    );
  }

  return (
    <div style={{ position: "relative", paddingBottom: "44px" }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: "auto", maxHeight: "180px", display: "block", cursor: "crosshair" }}
        onMouseMove={onSvgPointerMove}
        onMouseLeave={onSvgPointerLeave}
        onTouchStart={(e) => {
          if (e.touches[0]) setHoverIdx(pickNearestIndex(e.touches[0].clientX));
        }}
        onTouchMove={(e) => {
          if (e.touches[0]) setHoverIdx(pickNearestIndex(e.touches[0].clientX));
        }}
        onTouchEnd={onSvgPointerLeave}
      >
        {gridVals.map((v, i) => {
          const y = PY + (1 - (v - minV) / rangeV) * (H - PY * 2);
          return (
            <g key={i}>
              <line x1={PX} y1={y} x2={W - PX} y2={y} stroke={theme.border} strokeWidth="0.5" strokeDasharray="3,3" />
              <text x={PX - 4} y={y + 3} textAnchor="end" fontSize="8" fill={theme.textLight} fontFamily={font}>{v}</text>
            </g>
          );
        })}
        <defs>
          <linearGradient id="eloGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={theme.accent} stopOpacity="0.25" />
            <stop offset="100%" stopColor={theme.accent} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#eloGrad)" />
        <path d={line} fill="none" stroke={theme.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {hi && (
          <line
            x1={hi.x}
            y1={PY}
            x2={hi.x}
            y2={H - PY}
            stroke={theme.accent}
            strokeWidth="1"
            strokeOpacity={0.35}
            pointerEvents="none"
          />
        )}
        {points.map((p, i) => {
          const active = hoverIdx === i;
          const isLast = i === points.length - 1;
          const r = active ? 5 : isLast ? 4 : 2.5;
          return (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={r}
              fill={theme.accent}
              stroke="#fff"
              strokeWidth={active ? 2 : 1.5}
            />
          );
        })}
        {!hi && points.length > 0 && (
          <text x={last.x} y={last.y - 8} textAnchor="middle" fontSize="9" fontWeight="700" fill={theme.accent} fontFamily={font}>
            {Math.round(last.val)}
          </text>
        )}
      </svg>
      {hi && (
        <div
          style={{
            position: "absolute",
            left: `${(hi.x / W) * 100}%`,
            bottom: "4px",
            transform: "translateX(-50%)",
            pointerEvents: "none",
            zIndex: 2,
            background: theme.surface,
            border: "1px solid " + theme.border,
            borderRadius: "8px",
            padding: "6px 10px",
            boxShadow: theme.shadow,
            fontFamily: font,
            textAlign: "center",
            minWidth: "120px",
          }}
        >
          <div style={{ fontSize: "15px", fontWeight: 800, color: theme.accent, letterSpacing: "-0.02em" }}>
            ELO {Math.round(hi.val)}
          </div>
          <div style={{ fontSize: "11px", color: theme.textMid, marginTop: "2px", lineHeight: 1.3 }}>
            {formatEloHistoryDate(hi.date)}
          </div>
        </div>
      )}
    </div>
  );
}

function ProfilTab({ user, showToast, setTab }) {
  const { updateProfile, refreshProfile, user: authUser } = useAuth();
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
  const [form, setForm] = useState(() => profileFormState(user));

  useEffect(() => {
    if (!editing) setForm(profileFormState(user));
  }, [user, editing]);

  const avatars = ["🎾", "👨", "👩", "🧔", "👩‍🦰", "👨‍🦱", "👩‍🦱", "🧑"];
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const toggleAvail = (a) => setForm(f => {
    const cur = normalizeStringArrayField(f.availability);
    return { ...f, availability: cur.includes(a) ? cur.filter((x) => x !== a) : [...cur, a] };
  });

  const handleSave = async () => {
    const nameCheck = validateFirstLastName(form.first_name, form.last_name);
    if (!nameCheck.valid) {
      showToast(nameCheck.message);
      return;
    }
    const displayName = `${form.first_name.trim()} ${form.last_name.trim()}`;
    setSaving(true);
    try {
      await updateProfile({
        full_name: sanitizeText(displayName),
        name: sanitizeText(displayName),
        area: form.area,
        play_style: form.play_style,
        bio: sanitizeText(form.bio.trim()),
        avatar: form.avatar,
        availability: form.availability,
        birth_year: form.birth_year ? parseInt(form.birth_year) : null,
      });
      refreshProfile();
      setEditing(false);
      showToast("Profil opdateret! ✅");
    } catch (e) {
      console.error(e);
      showToast("Kunne ikke gemme. Prøv igen.");
    } finally { setSaving(false); }
  };

  const winPct = games > 0 ? Math.round((wins / games) * 100) : 0;

  return (
    <div>
      {!editing ? (
      <div>
        <h2 style={{ ...heading("clamp(20px,4.5vw,24px)"), marginBottom: "20px" }}>Min profil</h2>

        {/* Profile card */}
        <div style={{ background: theme.surface, borderRadius: theme.radius, padding: "24px", boxShadow: theme.shadow, border: "1px solid " + theme.border, marginBottom: "16px" }}>
          <div style={{ display: "flex", gap: "16px", alignItems: "center", marginBottom: "20px" }}>
            <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: theme.accentBg, border: "2px solid " + theme.accent + "40", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "32px", flexShrink: 0 }}>
              {user.avatar || "🎾"}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "20px", fontWeight: 800, letterSpacing: "-0.02em" }}>{displayName}</div>
              <div style={{ fontSize: "13px", color: theme.textLight, marginTop: "2px" }}>{authUser?.email}</div>
              <div style={{ display: "flex", gap: "5px", marginTop: "8px", flexWrap: "wrap" }}>
                {!statsLoading && <span style={tag(theme.accentBg, theme.accent)}>ELO {elo}</span>}
                {user.birth_year && <span style={tag(theme.blueBg, theme.blue)}>{new Date().getFullYear() - user.birth_year} år</span>}
                <span style={tag(theme.blueBg, theme.blue)}>{user.play_style || "?"}</span>
                <span style={tag(theme.warmBg, theme.warm)}><MapPin size={9} /> {user.area || "?"}</span>
              </div>
            </div>
          </div>

          {user.bio && <p style={{ fontSize: "13px", color: theme.textMid, lineHeight: 1.5, marginBottom: "16px", fontStyle: "italic" }}>"{user.bio}"</p>}

          {/* Stats — først når frisk profil + historik er hentet (ingen flash) */}
          {statsLoading ? (
            <div style={{ textAlign: "center", padding: "20px", color: theme.textLight, fontSize: "13px", marginBottom: "20px" }}>Indlæser statistik…</div>
          ) : (
          <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px", marginBottom: "12px" }}>
            {[
              { label: "ELO", value: elo, color: theme.accent },
              { label: "Kampe", value: games, color: theme.blue },
              { label: "Sejre", value: wins, color: theme.warm },
              { label: "Win %", value: games > 0 ? winPct + "%" : "—", color: theme.accent },
            ].map((s, i) => (
              <div key={i} style={{ textAlign: "center", padding: "12px 4px", background: "#F8FAFC", borderRadius: "8px" }}>
                <div style={{ fontSize: "18px", fontWeight: 800, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: "9px", fontWeight: 700, color: theme.textLight, marginTop: "2px", textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px", marginBottom: "20px" }}>
            <div style={{ textAlign: "center", padding: "10px 4px", background: americanoOutcomeColors.win.bg, borderRadius: "8px", border: "1px solid " + americanoOutcomeColors.win.border }}>
              <div style={{ fontSize: "16px", fontWeight: 800, color: americanoOutcomeColors.win.text }}>{Number(user.americano_wins) || 0}</div>
              <div style={{ fontSize: "9px", fontWeight: 700, color: theme.textLight, marginTop: "2px", textTransform: "uppercase", letterSpacing: "0.04em" }}>Americano sejre</div>
            </div>
            <div style={{ textAlign: "center", padding: "10px 4px", background: americanoOutcomeColors.tie.bg, borderRadius: "8px", border: "1px solid " + americanoOutcomeColors.tie.border }}>
              <div style={{ fontSize: "16px", fontWeight: 800, color: americanoOutcomeColors.tie.text }}>{Number(user.americano_draws) || 0}</div>
              <div style={{ fontSize: "9px", fontWeight: 700, color: theme.textLight, marginTop: "2px", textTransform: "uppercase", letterSpacing: "0.04em" }}>Americano uafgjort</div>
            </div>
            <div style={{ textAlign: "center", padding: "10px 4px", background: americanoOutcomeColors.loss.bg, borderRadius: "8px", border: "1px solid " + americanoOutcomeColors.loss.border }}>
              <div style={{ fontSize: "16px", fontWeight: 800, color: americanoOutcomeColors.loss.text }}>{Number(user.americano_losses) || 0}</div>
              <div style={{ fontSize: "9px", fontWeight: 700, color: theme.textLight, marginTop: "2px", textTransform: "uppercase", letterSpacing: "0.04em" }}>Americano tab</div>
            </div>
          </div>
          </>
          )}

          {/* Availability */}
          {availabilityTags(user).length > 0 && (
            <div style={{ marginBottom: "16px" }}>
              <div style={{ fontSize: "11px", fontWeight: 700, color: theme.textLight, marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Tilgængelighed</div>
              <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
                {availabilityTags(user).map((a) => <span key={a} style={tag(theme.accentBg, theme.accent)}>{a}</span>)}
              </div>
            </div>
          )}

          <button onClick={() => { setForm(profileFormState(user)); setEditing(true); }} style={{ ...btn(true), width: "100%", justifyContent: "center" }}>
            <Settings size={14} /> Rediger profil
          </button>
        </div>

        {/* ELO over tid */}
        <div style={{ background: theme.surface, borderRadius: theme.radius, padding: "20px", boxShadow: theme.shadow, border: "1px solid " + theme.border, marginBottom: "16px" }}>
          <div style={{ fontSize: "14px", fontWeight: 700, marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
            <TrendingUp size={16} color={theme.accent} /> ELO over tid
          </div>
          {statsLoading ? (
            <div style={{ textAlign: "center", padding: "20px", color: theme.textLight, fontSize: "13px" }}>Indlæser...</div>
          ) : (
            <EloGraph data={eloHistory} />
          )}
        </div>

        {/* Ekstra statistik */}
        {!statsLoading && (() => {
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
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "16px" }}>
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

        {/* Quick links */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
          <button onClick={() => setTab("kampe")} style={{ background: theme.surface, borderRadius: theme.radius, padding: "16px", boxShadow: theme.shadow, border: "1px solid " + theme.border, cursor: "pointer", textAlign: "left", fontFamily: font }}>
            <Swords size={18} color={theme.accent} />
            <div style={{ fontSize: "13px", fontWeight: 700, marginTop: "8px" }}>Mine kampe</div>
            <div style={{ fontSize: "11px", color: theme.textLight }}>{games} spillet</div>
          </button>
          <button onClick={() => setTab("ranking")} style={{ background: theme.surface, borderRadius: theme.radius, padding: "16px", boxShadow: theme.shadow, border: "1px solid " + theme.border, cursor: "pointer", textAlign: "left", fontFamily: font }}>
            <Trophy size={18} color={theme.warm} />
            <div style={{ fontSize: "13px", fontWeight: 700, marginTop: "8px" }}>Ranking</div>
            <div style={{ fontSize: "11px", color: theme.textLight }}>ELO {elo}</div>
          </button>
        </div>
      </div>
      ) : (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h2 style={{ ...heading("clamp(20px,4.5vw,24px)") }}>Rediger profil</h2>
        <button onClick={() => { setForm(profileFormState(user)); setEditing(false); }} style={{ ...btn(false), padding: "6px 12px", fontSize: "12px" }}>
          <X size={14} /> Annullér
        </button>
      </div>

      <div style={{ background: theme.surface, borderRadius: theme.radius, padding: "24px", boxShadow: theme.shadow, border: "1px solid " + theme.border }}>
        {/* Avatar */}
        <label style={labelStyle}>Avatar</label>
        <div style={{ display: "flex", gap: "8px", marginBottom: "20px", flexWrap: "wrap" }}>
          {avatars.map(a => (
            <button key={a} onClick={() => set("avatar", a)} style={{ width: "48px", height: "48px", borderRadius: "50%", fontSize: "22px", border: form.avatar === a ? "2px solid " + theme.accent : "1px solid " + theme.border, background: form.avatar === a ? theme.accentBg : theme.surface, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>{a}</button>
          ))}
        </div>

        {/* Name */}
        <label style={labelStyle}>Fornavn</label>
        <input value={form.first_name} onChange={e => set("first_name", e.target.value)} placeholder="F.eks. Mikkel" style={{ ...inputStyle, marginBottom: "10px" }} />
        <label style={labelStyle}>Efternavn</label>
        <input value={form.last_name} onChange={e => set("last_name", e.target.value)} placeholder="F.eks. Hansen" style={{ ...inputStyle, marginBottom: "6px" }} />
        <p style={{ color: theme.textLight, fontSize: "12px", lineHeight: 1.45, marginBottom: "14px" }}>
          Begge skal udfyldes. Dobbeltnavne: brug bindestreg i ét felt (Anne-Marie). Samme validering som ved oprettelse.
        </p>

        {/* Birth year */}
        <label style={labelStyle}>Fødselsår</label>
        <input value={form.birth_year} onChange={e => set("birth_year", e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="F.eks. 1995" type="text" inputMode="numeric" style={{ ...inputStyle, marginBottom: "14px" }} />

        {/* Area */}
        <label style={labelStyle}>Region</label>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "14px" }}>
          {REGIONS.map((r) => (
            <button key={r} onClick={() => set("area", r)} style={{ ...btn(form.area === r), padding: "6px 12px", fontSize: "12px" }}>{r}</button>
          ))}
        </div>

        {/* Play style */}
        <label style={labelStyle}>Spillestil</label>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "14px" }}>
          {PLAY_STYLES.map(s => (
            <button key={s} onClick={() => set("play_style", s)} style={{ ...btn(form.play_style === s), padding: "6px 12px", fontSize: "12px" }}>{s}</button>
          ))}
        </div>

        {/* Availability */}
        <label style={labelStyle}>Hvornår kan du spille?</label>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "14px" }}>
          {AVAILABILITY.map(a => (
            <button key={a} onClick={() => toggleAvail(a)} style={{ ...btn(form.availability.includes(a)), padding: "6px 12px", fontSize: "12px" }}>{a}</button>
          ))}
        </div>

        {/* Bio */}
        <label style={labelStyle}>Bio</label>
        <textarea value={form.bio} onChange={e => set("bio", e.target.value)} placeholder="Fortæl lidt om dig som spiller..." style={{ ...inputStyle, height: "80px", resize: "vertical", marginBottom: "20px" }} />

        <button onClick={handleSave} disabled={saving} style={{ ...btn(true), width: "100%", justifyContent: "center", opacity: saving ? 0.6 : 1 }}>
          {saving ? "Gemmer..." : <><Save size={14} /> Gem ændringer</>}
        </button>
      </div>
    </div>
      )}
    </div>
  );
}

function RankingTab({ user }) {
  const [players, setPlayers] = useState([]);
  const [eloHistory, setEloHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewPlayer, setViewPlayer] = useState(null);
  const [period, setPeriod] = useState(() => {
    try { return localStorage.getItem("pm-rank-period") || "all"; } catch { return "all"; }
  });

  const eloSyncKey = `${user.elo_rating}|${user.games_played}|${user.games_won}`;
  const { bundleLoading: myBundleLoading, profileFresh: myProfileFresh, ratedRows: myRatedRows } = useProfileEloBundle(user.id, eloSyncKey);
  const myHistStats = useMemo(() => statsFromEloHistoryRows(myRatedRows), [myRatedRows]);
  const myAllTimeElo = myHistStats?.elo ?? Math.round(Number(myProfileFresh?.elo_rating ?? user.elo_rating) || 1000);
  const myAllTimeGames = myHistStats?.games ?? (myProfileFresh?.games_played ?? user.games_played ?? 0);
  const myAllTimeWins = myHistStats?.wins ?? (myProfileFresh?.games_won ?? user.games_won ?? 0);

  const allTimeFromHistory = useMemo(() => allTimeStatsMapFromEloHistory(eloHistory), [eloHistory]);
  const myId = user?.id != null ? String(user.id) : "";

  useEffect(() => {
    try { localStorage.setItem("pm-rank-period", period); } catch {}
  }, [period]);

  const loadRankingData = useCallback(async () => {
    try {
      const [profileData, historyData] = await Promise.all([
        Profile.filter(),
        supabase
          .from("elo_history")
          .select("*")
          .order("date", { ascending: false })
          .order("match_id", { ascending: false })
          .limit(10000),
      ]);
      setPlayers(profileData || []);
      setEloHistory(historyData.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    setLoading(true);
    loadRankingData();
  }, [loadRankingData, eloSyncKey]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") loadRankingData();
    };
    const onFocus = () => { loadRankingData(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onFocus);
    };
  }, [loadRankingData]);

  // Calculate period start dates
  const now = new Date();
  const getMonday = () => {
    const d = new Date(now);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  };
  const getMonthStart = () => {
    const d = new Date(now.getFullYear(), now.getMonth(), 1);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  // Build ranking based on period
  const buildRanking = () => {
    if (period === "all") {
      return [...players]
        .map(p => {
          const pid = String(p.id);
          const h = allTimeFromHistory[pid];
          const isMe = myId && pid === myId;
          const isMeReady = isMe && !myBundleLoading;
          return {
            ...p,
            score: isMeReady ? myAllTimeElo : (h?.elo ?? Math.round(Number(p.elo_rating) || 1000)),
            periodGames: isMeReady ? myAllTimeGames : (h?.games ?? (p.games_played || 0)),
            periodWins: isMeReady ? myAllTimeWins : (h?.wins ?? (p.games_won || 0)),
          };
        })
        .sort((a, b) => b.score - a.score);
    }

    const cutoff = period === "week" ? getMonday() : getMonthStart();
    const cutoffStr = cutoff.toISOString().split("T")[0];

    // Sum ELO changes per player within the period
    const periodStats = {};
    eloHistory.forEach(h => {
      if (h.old_rating == null || h.match_id == null) return;
      if (h.date >= cutoffStr) {
        const uid = String(h.user_id);
        if (!periodStats[uid]) periodStats[uid] = { change: 0, games: 0, wins: 0 };
        periodStats[uid].change += (h.change || 0);
        periodStats[uid].games += 1;
        if (h.result === "win") periodStats[uid].wins += 1;
      }
    });

    return [...players]
      .map(p => {
        const stats = periodStats[String(p.id)] || { change: 0, games: 0, wins: 0 };
        return { ...p, score: stats.change, periodGames: stats.games, periodWins: stats.wins };
      })
      .filter(p => p.periodGames > 0)
      .sort((a, b) => b.score - a.score);
  };

  const sorted = buildRanking();
  const userRank = sorted.findIndex(p => String(p.id) === myId) + 1;
  const userEntry = sorted.find(p => String(p.id) === myId);
  const displayScore = period === "all"
    ? (myBundleLoading ? null : (myAllTimeElo ?? allTimeFromHistory[myId]?.elo ?? Math.round(Number(user.elo_rating) || 1000)))
    : (userEntry?.score || 0);
  const medals = ["🥇", "🥈", "🥉"];

  const periodLabels = {
    week: "Denne uge",
    month: "Denne måned",
    all: "All-time",
  };

  const periodInfo = {
    week: "Nulstilles hver mandag",
    month: "Nulstilles d. 1 i måneden",
    all: "Samlet ELO-rating",
  };

  if (loading) return <div style={{ textAlign: "center", padding: "40px", color: theme.textLight, fontSize: "14px" }}>Indlæser ranking...</div>;

  return (
    <div>
      <h2 style={{ ...heading("clamp(20px,4.5vw,24px)"), marginBottom: "16px" }}>Ranking</h2>

      {/* Period tabs */}
      <div style={{ display: "flex", gap: "6px", marginBottom: "16px" }}>
        {["week", "month", "all"].map(p => (
          <button key={p} onClick={() => setPeriod(p)} style={{ ...btn(period === p), padding: "8px 14px", fontSize: "12px", flex: 1, justifyContent: "center" }}>
            {p === "week" ? "📅 Uge" : p === "month" ? "🗓️ Måned" : "🏆 All-time"}
          </button>
        ))}
      </div>

      {/* Period info */}
      <div style={{ fontSize: "12px", color: theme.textLight, marginBottom: "16px", textAlign: "center" }}>
        {periodLabels[period]} · {periodInfo[period]}
      </div>

      {/* Hero card */}
      <div style={{ background: "linear-gradient(135deg, #1E3A5F, #1D4ED8)", borderRadius: theme.radius, padding: "clamp(18px,4vw,24px)", marginBottom: "24px", color: "#fff" }}>
        <div style={{ fontSize: "10px", opacity: 0.65, marginBottom: "6px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Din placering · {periodLabels[period]}</div>
        <div className="pm-rank-hero-inner">
          <div>
            <span style={{ fontFamily: font, fontSize: "clamp(32px,8vw,40px)", fontWeight: 800, letterSpacing: "-0.04em" }}>
              {period === "all" && myBundleLoading ? "…" : userRank > 0 ? `#${userRank}` : "—"}
            </span>
            <span style={{ fontSize: "14px", marginLeft: "8px", opacity: 0.6 }}>
              {period === "all" && myBundleLoading ? "" : sorted.length > 0 ? `af ${sorted.length}` : ""}
            </span>
          </div>
          <div className="pm-rank-hero-elo">
            <div style={{ fontFamily: font, fontSize: "clamp(20px,5vw,24px)", fontWeight: 800, letterSpacing: "-0.03em" }}>
              {period === "all" && displayScore === null ? "…" : period === "all" ? displayScore : (displayScore > 0 ? "+" + displayScore : displayScore)}
            </div>
            <div style={{ fontSize: "10px", opacity: 0.65, letterSpacing: "0.06em", textTransform: "uppercase" }}>
              {period === "all" ? "ELO" : "ELO ændring"}
            </div>
          </div>
        </div>
        {period === "all" && displayScore != null && (
          <div style={{ marginTop: "14px", background: "rgba(255,255,255,0.15)", borderRadius: "6px", height: "6px" }}>
            <div style={{ width: Math.min((displayScore / 2000) * 100, 100) + "%", height: "100%", background: theme.warm, borderRadius: "6px" }} />
          </div>
        )}
        {userEntry && (period !== "all" || !myBundleLoading) && (
          <div style={{ marginTop: "12px", fontSize: "12px", opacity: 0.7 }}>
            {userEntry.periodGames} kampe · {userEntry.periodWins} sejre
          </div>
        )}
      </div>

      {/* Leaderboard */}
      {sorted.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 20px", color: theme.textLight }}>
          <div style={{ fontSize: "32px", marginBottom: "12px" }}>📊</div>
          <div style={{ fontSize: "15px", fontWeight: 600, color: theme.text, marginBottom: "6px" }}>
            {period === "week" ? "Ingen kampe denne uge endnu" : period === "month" ? "Ingen kampe denne måned endnu" : "Ingen spillere fundet"}
          </div>
          <div style={{ fontSize: "13px", lineHeight: 1.5 }}>Spil en kamp for at komme på ranglisten!</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          {sorted.map((p, i) => {
            const me = p.id === user.id;
            const score = p.score;
            const isPositive = period !== "all" && score > 0;
            const isNegative = period !== "all" && score < 0;
            return (
              <div key={p.id} onClick={() => !me && setViewPlayer(p)} className="pm-rank-row" style={{ background: me ? theme.accentBg : theme.surface, borderRadius: "8px", padding: "12px 14px", boxShadow: me ? "none" : theme.shadow, display: "flex", alignItems: "center", gap: "12px", border: me ? "1.5px solid " + theme.accent + "35" : "1px solid " + theme.border, cursor: me ? "default" : "pointer" }}>
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
                  <div style={{ fontSize: "11px", color: theme.textLight, marginTop: "1px" }}>
                    {period === "all"
                      ? `${p.area || "?"} · ${p.periodGames} kampe · ${p.periodWins} sejre`
                      : `${p.periodGames} kampe · ${p.periodWins} sejre`
                    }
                  </div>
                </div>
                <div className="pm-rank-score" style={{ fontFamily: font, fontSize: "17px", fontWeight: 800, flexShrink: 0, letterSpacing: "-0.02em", color: period === "all" ? theme.accent : isPositive ? theme.accent : isNegative ? theme.red : theme.textLight }}>
                  {period === "all" ? score : (score > 0 ? "+" + score : score)}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {viewPlayer && <PlayerProfileModal player={viewPlayer} onClose={() => setViewPlayer(null)} />}
    </div>
  );
}
