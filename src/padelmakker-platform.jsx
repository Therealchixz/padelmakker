import { useState, useEffect } from "react";
import { useAuth } from "./lib/AuthContext";

const LEVELS = ["1-2 (Helt ny)", "3-4 (Begynder)", "5-6 (Øvet)", "7-8 (Avanceret)", "9-10 (Ekspert)"];
const PLAY_STYLES = ["Aggressiv", "Defensiv", "Allround", "Teknisk"];
const AREAS = ["København", "Frederiksberg", "Amager", "Nordsjælland", "Odense", "Aarhus", "Aalborg"];

export default function PadelMakker() {
  const { user, profile, loading, signOut } = useAuth();
  
  const [page, setPage] = useState("landing");

  // Smart navigation baseret på auth-status
  useEffect(() => {
    if (loading) return;

    if (!user) {
      setPage("landing");
    } else if (user && !profile) {
      setPage("onboarding");
    } else if (page === "landing" || page === "login" || page === "onboarding") {
      setPage("dashboard");
    }
  }, [user, profile, loading, page]);

  // Vis kun loading mens vi henter auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-6xl animate-pulse">🎾</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🎾</span>
            <h1 className="text-2xl font-bold text-green-700">PadelMakker</h1>
          </div>
          
          {user && (
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">{profile?.name}</span>
              <button
                onClick={signOut}
                className="text-sm px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg"
              >
                Log ud
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* Page Router */}
      {page === "landing" && <LandingPage onGetStarted={() => setPage("login")} />}
      {page === "login" && <LoginPage onSuccess={() => setPage("dashboard")} />}
      {page === "onboarding" && <OnboardingPage />}
      {page === "dashboard" && <DashboardPage setPage={setPage} profile={profile} />}
    </div>
  );
}

/* ==================== RESTEN AF KOMPONENTERNE ==================== */

// LandingPage, LoginPage, OnboardingPage, DashboardPage osv.
// Jeg har holdt dem korte her for overskuelighed – du kan beholde dine gamle komponenter, 
// men sørg for at de ikke selv styrer page-state (lad det ske i toppen).

function LandingPage({ onGetStarted }) {
  return (
    <div className="max-w-4xl mx-auto text-center py-20 px-6">
      <h1 className="text-5xl font-bold mb-6">Find makker.<br />Book bane.<br />Spil padel.</h1>
      <p className="text-xl text-gray-600 mb-10">Den samlede platform til padel i Danmark</p>
      <button 
        onClick={onGetStarted}
        className="bg-green-600 text-white text-lg px-10 py-4 rounded-2xl hover:bg-green-700"
      >
        Kom i gang
      </button>
    </div>
  );
}

// LoginPage, OnboardingPage og DashboardPage kan du beholde næsten som de er – 
// bare fjern alle manuelle setPage-kald og lad den øverste useEffect håndtere navigation.

function LoginPage({ onSuccess }) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    setSubmitting(true);
    setError("");
    try {
      await signIn(email, password);
      // Vi lader useEffect i toppen håndtere navigation
    } catch (e) {
      setError(e.message || "Login fejlede");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    // ... din login UI her ...
    <button onClick={handleLogin} disabled={submitting}>
      {submitting ? "Logger ind..." : "Log ind"}
    </button>
  );
}

// Du kan kopiere resten af dine sider ind her (DashboardPage, MakkereTab osv.)

export function DashboardPage({ setPage, profile }) {
  return (
    <div className="max-w-6xl mx-auto p-6">
      <h2 className="text-3xl font-bold mb-8">Velkommen tilbage, {profile?.name} 🎾</h2>
      {/* Dine tabs: Hjem, Find Makker, Baner, Kampe, Ranking */}
    </div>
  );
}
