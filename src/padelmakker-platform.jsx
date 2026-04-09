import { useState, useEffect } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "./lib/AuthContext";
import { supabase } from "./lib/supabase";
import { font, theme } from "./lib/platformTheme";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { DashboardPage } from "./dashboard/DashboardPage";

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

  if (loading || (user && profileLoading && !profile)) {
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
