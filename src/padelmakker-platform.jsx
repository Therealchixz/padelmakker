import { useState, useEffect, useCallback } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "./lib/AuthContext";
import { supabase } from "./lib/supabase";
import { font, theme } from "./lib/platformTheme";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { PrivacyPage } from "./pages/PrivacyPage";
import { TermsPage } from "./pages/TermsPage";
import { CookiesPage } from "./pages/CookiesPage";
import { OmPage } from "./pages/OmPage";
import { FaqPage } from "./pages/FaqPage";
import { EloExplainerPage } from "./pages/EloExplainerPage";
import { PublicEventsPage } from "./pages/PublicEventsPage";
import { DashboardPage } from "./dashboard/DashboardPage";
import { CookieNoticeBar } from "./components/CookieNoticeBar";
import { HelpContactPage } from "./pages/HelpContactPage";
import { InstallAppPage } from "./pages/InstallAppPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { SignupEmailSentPage } from "./pages/SignupEmailSentPage";

export default function PadelMakker() {
  const { user, profile, loading, profileLoading, signOut } = useAuth();
  const [toast, setToast] = useState(null);
  const [resetMode, setResetMode] = useState(false);
  const navigate = useNavigate();
  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);
  const handleLogout = useCallback(async () => {
    await signOut();
    navigate("/", { replace: true });
  }, [navigate, signOut]);

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
        <CookieNoticeBar />
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
        <Route path="/opret" element={user && profile ? <Navigate to="/dashboard" replace /> : <OnboardingPage />} />
        <Route path="/opret/bekraeft-email" element={user && profile ? <Navigate to="/dashboard" replace /> : <SignupEmailSentPage />} />
        <Route path="/privatlivspolitik" element={<PrivacyPage />} />
        <Route path="/handelsbetingelser" element={<TermsPage />} />
        <Route path="/cookies" element={<CookiesPage />} />
        <Route path="/om" element={<OmPage />} />
        <Route path="/faq" element={<FaqPage />} />
        <Route path="/elo" element={<EloExplainerPage />} />
        <Route path="/events" element={<PublicEventsPage />} />
        <Route path="/hjaelp" element={<HelpContactPage />} />
        <Route path="/app" element={<InstallAppPage />} />
        <Route path="/dashboard" element={user && profile ? <DashboardPage user={profile} onLogout={handleLogout} showToast={showToast} /> : <Navigate to="/" replace />} />
        <Route path="/dashboard/:tab" element={user && profile ? <DashboardPage user={profile} onLogout={handleLogout} showToast={showToast} /> : <Navigate to="/" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <CookieNoticeBar />
    </div>
  );
}
