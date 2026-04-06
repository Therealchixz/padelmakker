// src/padelmakker-platform.jsx
import { useState, useEffect } from "react";
import { useAuth } from "./lib/AuthContext";
import KampeTab from "./features/matches/KampeTab";
import { supabase } from "./lib/supabase";

// Ikoner
import { 
  Home, Users, MapPin, Swords, Trophy, 
  Settings, LogOut, UserPlus, TrendingUp, ArrowRight 
} from "lucide-react";

const LEVELS = ["1-2 (Helt ny)", "3-4 (Begynder)", "5-6 (Øvet)", "7-8 (Avanceret)", "9-10 (Elite)"];
const PLAY_STYLES = ["Offensiv", "Defensiv", "Alround", "Ved ikke endnu"];
const AREAS = ["København", "Frederiksberg", "Amager", "Herlev", "Taastrup", "Østerbro", "Nørrebro", "Vesterbro", "Aarhus", "Odense"];
const AVAILABILITY = ["Morgener", "Formiddage", "Eftermiddage", "Aftener", "Weekender", "Flexibel"];

const font = "'Inter', sans-serif";

export default function PadelMakker() {
  const { user, profile, loading, profileLoading, signOut } = useAuth();
  const [toast, setToast] = useState(null);
  const [resetMode, setResetMode] = useState(false);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleLogout = async () => await signOut();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setResetMode(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (loading || (user && profileLoading)) {
    return <div className="flex items-center justify-center min-h-screen bg-[#F6F8FA]">Indlæser...</div>;
  }

  if (resetMode) {
    return <ResetPasswordPage onDone={() => { setResetMode(false); showToast("Adgangskode opdateret! ✅"); }} />;
  }

  return (
    <div style={{ fontFamily: font, minHeight: "100dvh" }}>
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-emerald-700 text-white px-6 py-3 rounded-2xl shadow-xl z-50">
          {toast}
        </div>
      )}

      {user && profile ? (
        <DashboardPage user={profile} onLogout={handleLogout} showToast={showToast} />
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
    if (!password || password.length < 6) { setErr("Adgangskode skal være mindst 6 tegn"); return; }
    if (password !== confirm) { setErr("Adgangskoderne matcher ikke"); return; }

    setSubmitting(true); setErr("");
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
    <div className="max-w-md mx-auto p-8">
      <h1 className="text-3xl font-bold mb-2">Ny adgangskode</h1>
      <p className="text-slate-600 mb-8">Vælg din nye adgangskode.</p>

      <label className="block text-sm font-medium mb-1">Ny adgangskode</label>
      <input 
        type="password" 
        value={password} 
        onChange={e => { setPassword(e.target.value); setErr(""); }} 
        placeholder="Mindst 6 tegn" 
        className="w-full border border-slate-300 rounded-xl px-4 py-3 mb-4"
      />

      <label className="block text-sm font-medium mb-1">Gentag adgangskode</label>
      <input 
        type="password" 
        value={confirm} 
        onChange={e => { setConfirm(e.target.value); setErr(""); }} 
        placeholder="Gentag adgangskode" 
        className="w-full border border-slate-300 rounded-xl px-4 py-3 mb-6"
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

/* ====================== DASHBOARD ====================== */
function DashboardPage({ user, onLogout, showToast }) {
  const { user: authUser } = useAuth();
  const displayName = user.full_name || user.name || "Spiller";

  const [tab, setTab] = useState("hjem");

  const tabs = [
    { id: "hjem",    label: "Hjem",        icon: <Home size={18} /> },
    { id: "makkere", label: "Makkere",     icon: <Users size={18} /> },
    { id: "baner",   label: "Baner",       icon: <MapPin size={18} /> },
    { id: "kampe",   label: "Kampe",       icon: <Swords size={18} /> },
    { id: "ranking", label: "Ranking",     icon: <Trophy size={18} /> },
    { id: "profil",  label: "Profil",      icon: <Settings size={18} /> },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="text-2xl font-bold text-emerald-700">🎾 PadelMakker</div>
          <div className="flex items-center gap-4">
            <span className="font-medium">{displayName}</span>
            <button 
              onClick={onLogout}
              className="text-sm px-4 py-2 border rounded-xl hover:bg-gray-100"
            >
              Log ud
            </button>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 flex gap-1 overflow-x-auto pb-3">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-6 py-2 rounded-2xl text-sm font-medium whitespace-nowrap transition ${
                tab === t.id ? "bg-emerald-100 text-emerald-700" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6">
        {tab === "hjem" && <div className="text-center py-12 text-slate-500">Hjem-siden er under udvikling</div>}
        {tab === "makkere" && <div className="text-center py-12 text-slate-500">Find Makker – kommer snart</div>}
        {tab === "baner" && <div className="text-center py-12 text-slate-500">Baner – kommer snart</div>}
        {tab === "kampe" && <KampeTab />}
        {tab === "ranking" && <div className="text-center py-12 text-slate-500">Ranking – kommer snart</div>}
        {tab === "profil" && <div className="text-center py-12 text-slate-500">Profil – kommer snart</div>}
      </main>
    </div>
  );
}

/* ====================== LANDING PAGE ====================== */
function LandingPage({ onGetStarted, onLogin }) {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-5xl mx-auto px-6 py-24 text-center">
        <div className="text-6xl mb-6">🎾</div>
        <h1 className="text-5xl font-bold mb-6">Find makker.<br />Book bane.<br />Spil padel.</h1>
        <p className="text-xl text-slate-600 mb-10 max-w-md mx-auto">
          Stop med at søge i Facebook-grupper. PadelMakker matcher dig med spillere på dit niveau.
        </p>
        <button 
          onClick={onGetStarted}
          className="bg-emerald-700 text-white px-10 py-4 rounded-2xl text-lg font-semibold hover:bg-emerald-800"
        >
          Kom i gang gratis
        </button>
      </div>
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

  const handleLogin = async () => {
    if (!email || !password) {
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

  return (
    <div className="max-w-md mx-auto p-8 pt-20">
      <h1 className="text-3xl font-bold mb-6">Log ind</h1>
      
      <input 
        type="email" 
        value={email} 
        onChange={e => setEmail(e.target.value)} 
        placeholder="din@email.dk" 
        className="w-full border border-slate-300 rounded-xl px-4 py-3 mb-4"
      />
      <input 
        type="password" 
        value={password} 
        onChange={e => setPassword(e.target.value)} 
        placeholder="Adgangskode" 
        className="w-full border border-slate-300 rounded-xl px-4 py-3 mb-6"
      />

      {err && <p className="text-red-600 mb-4">{err}</p>}

      <button 
        onClick={handleLogin} 
        disabled={submitting}
        className="w-full bg-emerald-700 hover:bg-emerald-800 text-white py-3 rounded-xl font-semibold"
      >
        {submitting ? "Logger ind..." : "Log ind"}
      </button>

      <button onClick={onBack} className="mt-6 text-sm text-slate-500 block mx-auto">
        ← Tilbage
      </button>
    </div>
  );
}

/* ====================== ONBOARDING PAGE ====================== */
// Tilføj din fulde OnboardingPage her hvis du vil have den med.
// Du kan kopiere den fra din gamle version af filen.

function OnboardingPage({ onComplete, onBack }) {
  return (
    <div className="max-w-md mx-auto p-8 pt-20">
      <h1 className="text-3xl font-bold mb-6">Opret profil</h1>
      <p className="text-slate-600 mb-8">Onboarding er under udvikling</p>
      <button onClick={onComplete} className="w-full bg-emerald-700 text-white py-3 rounded-xl">
        Fortsæt
      </button>
    </div>
  );
}
