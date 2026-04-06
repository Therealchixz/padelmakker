// src/padelmakker-platform.jsx
import { useState, useEffect } from "react";
import { useAuth } from "./lib/AuthContext";
import KampeTab from "./features/matches/KampeTab";

// Icons
import { 
  Home, Users, MapPin, Swords, Trophy, 
  Settings, LogOut, UserPlus, TrendingUp, ArrowRight 
} from "lucide-react";

const LEVELS = ["1-2 (Helt ny)", "3-4 (Begynder)", "5-6 (Øvet)", "7-8 (Avanceret)", "9-10 (Elite)"];
const PLAY_STYLES = ["Offensiv", "Defensiv", "Alround", "Ved ikke endnu"];
const AREAS = ["København", "Frederiksberg", "Amager", "Herlev", "Taastrup", "Østerbro", "Nørrebro", "Vesterbro", "Aarhus", "Odense"];
const AVAILABILITY = ["Morgener", "Formiddage", "Eftermiddage", "Aftener", "Weekender", "Flexibel"];

/* ─── Design tokens ─── */
const font = "'Inter', sans-serif";
const theme = {
  bg: "#F6F8FA",
  surface: "#FFFFFF",
  text: "#0F172A",
  textMid: "#475569",
  textLight: "#94A3B8",
  accent: "#166534",
  accentHover: "#14532D",
  accentBg: "#DCFCE7",
  warm: "#D97706",
  warmBg: "#FEF3C7",
  blue: "#2563EB",
  blueBg: "#EFF6FF",
  red: "#DC2626",
  redBg: "#FEF2F2",
  border: "#E2E8F0",
  shadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)",
  shadowLg: "0 8px 32px rgba(0,0,0,0.12)",
  radius: "10px",
};

/* ─── Utility ─── */
function resolveDisplayName(profileRow, authUser) {
  const fromProfile = profileRow?.full_name || profileRow?.name;
  if (fromProfile && fromProfile.trim() !== "" && fromProfile.toLowerCase() !== "ny spiller") {
    return fromProfile.trim();
  }
  const meta = authUser?.user_metadata?.full_name || authUser?.user_metadata?.name;
  if (meta && meta.trim() !== "") return meta.trim();
  return authUser?.email?.split("@")[0] || "Spiller";
}

export default function PadelMakker() {
  const { user, profile, loading, profileLoading, signOut } = useAuth();
  const [toast, setToast] = useState(null);
  const [resetMode, setResetMode] = useState(false);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleLogout = async () => {
    await signOut();
  };

  // Password recovery detection
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
      <div className="flex items-center justify-center min-h-screen bg-[#F6F8FA]">
        <div className="pm-spinner" />
      </div>
    );
  }

  if (resetMode) {
    return <ResetPasswordPage onDone={() => { setResetMode(false); showToast("Adgangskode opdateret! ✅"); }} />;
  }

  return (
    <div className="pm-root" style={{ fontFamily: font, background: theme.bg, minHeight: "100dvh", color: theme.text }}>
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-emerald-700 text-white px-6 py-3 rounded-2xl shadow-xl z-50 text-sm font-medium">
          {toast}
        </div>
      )}

      {user && profile ? (
        <DashboardPage 
          user={profile} 
          onLogout={handleLogout} 
          showToast={showToast} 
        />
      ) : (
        <PublicPages showToast={showToast} />
      )}
    </div>
  );
}

/* ====================== PUBLIC PAGES ====================== */
function PublicPages({ showToast }) {
  const [page, setPage] = useState("landing");

  return (
    <>
      {page === "landing" && <LandingPage onGetStarted={() => setPage("onboarding")} onLogin={() => setPage("login")} />}
      {page === "onboarding" && <OnboardingPage onComplete={() => showToast("Velkommen til PadelMakker! 🎾")} onBack={() => setPage("landing")} />}
      {page === "login" && <LoginPage onBack={() => setPage("landing")} />}
    </>
  );
}

/* ====================== RESET PASSWORD ====================== */
function ResetPasswordPage({ onDone }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleReset = async () => {
    if (!password || password.length < 6) { 
      setErr("Adgangskode skal være mindst 6 tegn"); 
      return; 
    }
    if (password !== confirm) { 
      setErr("Adgangskoderne matcher ikke"); 
      return; 
    }
    setSubmitting(true); 
    setErr("");
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      onDone();
    } catch (e) {
      setErr(e.message || "Kunne ikke opdatere adgangskode.");
    } finally { 
      setSubmitting(false); 
    }
  };

  return (
    <div className="pm-auth-narrow">
      <h1 style={{ fontSize: "28px", fontWeight: 800, marginBottom: "6px" }}>Ny adgangskode</h1>
      <p style={{ color: "#475569", marginBottom: "28px" }}>Vælg din nye adgangskode.</p>
      
      <label className="block text-sm font-medium mb-1">Ny adgangskode</label>
      <input 
        type="password" 
        value={password} 
        onChange={e => { setPassword(e.target.value); setErr(""); }} 
        placeholder="Mindst 6 tegn" 
        className="w-full border border-slate-300 rounded-lg px-4 py-3 mb-4"
      />

      <label className="block text-sm font-medium mb-1">Gentag adgangskode</label>
      <input 
        type="password" 
        value={confirm} 
        onChange={e => { setConfirm(e.target.value); setErr(""); }} 
        placeholder="Gentag adgangskode" 
        className="w-full border border-slate-300 rounded-lg px-4 py-3 mb-4"
      />

      {err && <p className="text-red-600 text-sm mb-4">{err}</p>}

      <button 
        onClick={handleReset} 
        disabled={submitting}
        className="w-full bg-emerald-700 hover:bg-emerald-800 text-white py-3 rounded-xl font-semibold"
      >
        {submitting ? "Opdaterer..." : "Gem ny adgangskode"}
      </button>
    </div>
  );
}

/* ====================== LANDING PAGE ====================== */
function LandingPage({ onGetStarted, onLogin }) {
  const steps = [
    { step: "01", icon: <UserPlus size={22} color="#166534" />, title: "Opret profil", desc: "Angiv dit niveau og område." },
    { step: "02", icon: <Users size={22} color="#166534" />, title: "Find makker", desc: "Se spillere nær dig på dit niveau." },
    { step: "03", icon: <MapPin size={22} color="#166534" />, title: "Book bane", desc: "Find ledige baner og book direkte." },
    { step: "04", icon: <TrendingUp size={22} color="#166534" />, title: "Rank op", desc: "Se din ranking stige." },
  ];

  return (
    <div className="pm-landing">
      {/* Nav */}
      <nav className="pm-landing-nav">
        <div className="text-2xl font-bold text-emerald-700">🎾 PadelMakker</div>
        <div className="flex gap-3">
          <button onClick={onLogin} className="px-5 py-2 border rounded-xl hover:bg-slate-50">Log ind</button>
          <button onClick={onGetStarted} className="px-5 py-2 bg-emerald-700 text-white rounded-xl hover:bg-emerald-800">Kom i gang</button>
        </div>
      </nav>

      {/* Hero */}
      <section className="text-center px-6 py-16">
        <div className="inline-flex items-center gap-2 bg-emerald-100 text-emerald-700 text-xs font-bold px-4 py-1.5 rounded-full mb-6">
          🇩🇰 Danmarks padel-platform
        </div>
        <h1 className="text-5xl md:text-6xl font-bold leading-tight mb-6">
          Find makker.<br />Book bane.<br />
          <span className="text-emerald-700">Spil padel.</span>
        </h1>
        <p className="max-w-md mx-auto text-lg text-slate-600 mb-10">
          Stop med at søge i Facebook-grupper. PadelMakker matcher dig med spillere på dit niveau.
        </p>
        <button 
          onClick={onGetStarted} 
          className="bg-emerald-700 hover:bg-emerald-800 text-white px-8 py-4 rounded-2xl text-lg font-semibold inline-flex items-center gap-3"
        >
          Opret gratis profil <ArrowRight size={20} />
        </button>
      </section>

      {/* How it works */}
      <section className="px-6 py-16 max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <p className="uppercase tracking-widest text-emerald-700 text-sm font-bold mb-2">Sådan virker det</p>
          <h2 className="text-3xl font-bold">Fra profil til bane på minutter</h2>
        </div>
        <div className="grid md:grid-cols-4 gap-6">
          {steps.map((s, i) => (
            <div key={i} className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm">
              <div className="text-emerald-700 mb-4">{s.icon}</div>
              <div className="font-semibold text-lg mb-2">{s.title}</div>
              <div className="text-slate-600 text-sm">{s.desc}</div>
            </div>
          ))}
        </div>
      </section>

      <footer className="text-center py-8 text-slate-500 text-sm border-t">
        © 2026 PadelMakker • kontakt@padelmakker.dk
      </footer>
    </div>
  );
}

/* ====================== LOGIN PAGE ====================== */
function LoginPage({ onBack }) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setErr("Indtast email og adgangskode");
      return;
    }
    setSubmitting(true);
    setErr("");
    try {
      await signIn(email.trim(), password);
    } catch (e) {
      setErr(e.message || "Login fejlede");
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setErr("Indtast din email først");
      return;
    }
    setSubmitting(true);
    setErr("");
    try {
      await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin,
      });
      setForgotSent(true);
    } catch (e) {
      setErr(e.message || "Kunne ikke sende mail");
    } finally {
      setSubmitting(false);
    }
  };

  if (forgotMode) {
    return (
      <div className="pm-auth-narrow">
        <button onClick={() => { setForgotMode(false); setForgotSent(false); setErr(""); }} className="mb-8 text-sm">← Tilbage til login</button>
        <h1 className="text-3xl font-bold mb-2">Glemt adgangskode</h1>
        {forgotSent ? (
          <div className="bg-emerald-50 p-6 rounded-2xl text-center">
            <p className="text-emerald-700 font-semibold">Mail sendt!</p>
            <p className="text-sm text-slate-600 mt-2">Tjek din indbakke på <strong>{email}</strong></p>
          </div>
        ) : (
          <>
            <p className="text-slate-600 mb-6">Indtast din email, så sender vi et link til at nulstille adgangskoden.</p>
            <input 
              type="email" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              placeholder="din@email.dk" 
              className="w-full border border-slate-300 rounded-xl px-4 py-3 mb-4"
            />
            {err && <p className="text-red-600 text-sm mb-4">{err}</p>}
            <button onClick={handleForgotPassword} disabled={submitting} className="w-full bg-emerald-700 text-white py-3 rounded-xl font-semibold">
              {submitting ? "Sender..." : "Send nulstillingslink"}
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="pm-auth-narrow">
      <button onClick={onBack} className="mb-8 text-sm">← Tilbage</button>
      <h1 className="text-3xl font-bold mb-2">Velkommen tilbage</h1>
      <p className="text-slate-600 mb-8">Log ind med din email og adgangskode.</p>

      <input 
        type="email" 
        value={email} 
        onChange={e => { setEmail(e.target.value); setErr(""); }} 
        placeholder="din@email.dk" 
        className="w-full border border-slate-300 rounded-xl px-4 py-3 mb-4"
      />
      <input 
        type="password" 
        value={password} 
        onChange={e => { setPassword(e.target.value); setErr(""); }} 
        placeholder="••••••••" 
        className="w-full border border-slate-300 rounded-xl px-4 py-3 mb-6"
      />

      {err && <p className="text-red-600 text-sm mb-4">{err}</p>}

      <button 
        onClick={handleLogin} 
        disabled={submitting}
        className="w-full bg-emerald-700 hover:bg-emerald-800 text-white py-3 rounded-xl font-semibold"
      >
        {submitting ? "Logger ind..." : "Log ind"}
      </button>

      <button 
        onClick={() => setForgotMode(true)} 
        className="mt-4 text-emerald-700 text-sm w-full"
      >
        Glemt adgangskode?
      </button>
    </div>
  );
}

/* ====================== ONBOARDING ====================== */
// Behold din gamle OnboardingPage her (kopier den ind fra din gamle fil)
// For at spare plads har jeg udeladt den her – du kan indsætte din eksisterende OnboardingPage nedenfor

/* ====================== DASHBOARD ====================== */
function DashboardPage({ user, onLogout, showToast }) {
  const { user: authUser } = useAuth();
  const displayName = resolveDisplayName(user, authUser);

  const [tab, setTab] = useState(() => {
    try { return localStorage.getItem("pm-tab") || "hjem"; } 
    catch { return "hjem"; }
  });

  useEffect(() => {
    try { localStorage.setItem("pm-tab", tab); } catch {}
  }, [tab]);

  const tabs = [
    { id: "hjem",    label: "Hjem",        icon: <Home size={16} /> },
    { id: "makkere", label: "Find Makker", icon: <Users size={16} /> },
    { id: "baner",   label: "Baner",       icon: <MapPin size={16} /> },
    { id: "kampe",   label: "Kampe",       icon: <Swords size={16} /> },
    { id: "ranking", label: "Ranking",     icon: <Trophy size={16} /> },
    { id: "profil",  label: "Profil",      icon: <Settings size={16} /> },
  ];

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="border-b bg-white sticky top-0 z-20 px-4 py-4 flex justify-between items-center">
        <div className="text-2xl font-bold text-emerald-700">🎾 PadelMakker</div>
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-slate-600 hidden sm:block">{displayName}</span>
          <button 
            onClick={onLogout}
            className="flex items-center gap-2 px-4 py-2 text-sm border rounded-xl hover:bg-slate-50"
          >
            <LogOut size={16} /> Log ud
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white border-b px-4 py-3 flex gap-2 overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-2xl text-sm font-medium whitespace-nowrap transition-all ${
              tab === t.id 
                ? "bg-emerald-100 text-emerald-700 shadow-sm" 
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Main Content */}
      <main className="flex-1 p-4 max-w-4xl mx-auto w-full pb-20">
        {tab === "hjem" && <HomeTab user={user} />}
        {tab === "makkere" && <div className="text-center py-20 text-slate-500">Find Makker – kommer snart</div>}
        {tab === "baner" && <div className="text-center py-20 text-slate-500">Baner – kommer snart</div>}
        {tab === "kampe" && <KampeTab />}
        {tab === "ranking" && <div className="text-center py-20 text-slate-500">Ranking – kommer snart</div>}
        {tab === "profil" && <div className="text-center py-20 text-slate-500">Profil – kommer snart</div>}
      </main>
    </div>
  );
}

/* ====================== HOME TAB ====================== */
function HomeTab({ user }) {
  return (
    <div className="text-center py-12">
      <h2 className="text-3xl font-bold mb-4">Velkommen tilbage!</h2>
      <p className="text-slate-600">Hjem-siden er under udvikling</p>
    </div>
  );
}

/* ====================== ONBOARDING PAGE ====================== */
// Indsæt din gamle OnboardingPage her (kopier fra din tidligere version)
// Hvis du vil have hjælp til at opdatere den også, så sig til.
