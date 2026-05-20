import { useState, useEffect, useCallback, useRef, lazy, Suspense } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "./lib/AuthContext";
import { supabase } from "./lib/supabase";
import { canAccessDashboard } from "./lib/profileUtils";
import { isPhoneVerificationExempt, shouldRequirePhoneVerification } from "./lib/phoneVerification";
import { font, theme } from "./lib/platformTheme";
import { ConfirmDialogProvider } from "./lib/ConfirmDialogProvider";
import { LandingPage } from "./pages/LandingPage";

const ResetPasswordPageLazy = lazy(() =>
  import("./pages/ResetPasswordPage").then((m) => ({ default: m.ResetPasswordPage }))
);
const LoginPageLazy = lazy(() =>
  import("./pages/LoginPage").then((m) => ({ default: m.LoginPage }))
);
const OnboardingPageLazy = lazy(() =>
  import("./pages/OnboardingPage").then((m) => ({ default: m.OnboardingPage }))
);
import { CookieNoticeBar } from "./components/CookieNoticeBar";

const PrivacyPageLazy = lazy(() => import("./pages/PrivacyPage").then((m) => ({ default: m.PrivacyPage })));
const TermsPageLazy = lazy(() => import("./pages/TermsPage").then((m) => ({ default: m.TermsPage })));
const CookiesPageLazy = lazy(() => import("./pages/CookiesPage").then((m) => ({ default: m.CookiesPage })));
const OmPageLazy = lazy(() => import("./pages/OmPage").then((m) => ({ default: m.OmPage })));
const FaqPageLazy = lazy(() => import("./pages/FaqPage").then((m) => ({ default: m.FaqPage })));
const EloExplainerPageLazy = lazy(() => import("./pages/EloExplainerPage").then((m) => ({ default: m.EloExplainerPage })));
const PublicEventsPageLazy = lazy(() => import("./pages/PublicEventsPage").then((m) => ({ default: m.PublicEventsPage })));
const DashboardPageLazy = lazy(() => import("./dashboard/DashboardPage").then((m) => ({ default: m.DashboardPage })));
const HelpContactPageLazy = lazy(() => import("./pages/HelpContactPage").then((m) => ({ default: m.HelpContactPage })));
const InstallAppPageLazy = lazy(() => import("./pages/InstallAppPage").then((m) => ({ default: m.InstallAppPage })));
const NotFoundPageLazy = lazy(() => import("./pages/NotFoundPage").then((m) => ({ default: m.NotFoundPage })));
const SignupEmailSentPageLazy = lazy(() => import("./pages/SignupEmailSentPage").then((m) => ({ default: m.SignupEmailSentPage })));
const PhoneVerificationPageLazy = lazy(() => import("./pages/PhoneVerificationPage").then((m) => ({ default: m.PhoneVerificationPage })));

export default function PadelMakker() {
  const { user, profile, loading, profileLoading, signOut } = useAuth();
  const hasProfile = Boolean(user && profile);
  const phoneExempt = hasProfile && isPhoneVerificationExempt(user, profile);
  const onboardingComplete = hasProfile && canAccessDashboard(user, profile, { phoneExempt });
  const canUseApp = onboardingComplete;
  const requiresPhoneVerification = canUseApp && shouldRequirePhoneVerification(user, profile);
  const defaultAuthedPath = requiresPhoneVerification ? "/opret/bekraeft-telefon" : "/dashboard";
  const [toast, setToast] = useState(null);
  const [resetMode, setResetMode] = useState(false);
  const toastTimerRef = useRef(null);
  const navigate = useNavigate();
  const showToast = useCallback((msg) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(msg);
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 3000);
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
    return () => {
      subscription.unsubscribe();
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
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
      <ConfirmDialogProvider>
        <div className="pm-root" style={{ fontFamily: font, background: theme.bg, minHeight: "100dvh", color: theme.text }}>
          {toast && (
            <div className="pm-toast" style={{ position: "fixed", top: "max(12px, env(safe-area-inset-top))", left: "50%", transform: "translateX(-50%)", background: theme.accent, color: "#fff", padding: "11px 22px", borderRadius: "10px", fontSize: "13px", fontWeight: 600, zIndex: 9999, boxShadow: theme.shadowLg }}>
              {toast}
            </div>
          )}
          <Suspense fallback={<div className="pm-spinner" style={{ margin: "40px auto" }} />}>
            <ResetPasswordPageLazy onDone={() => { setResetMode(false); navigate("/dashboard"); showToast("Adgangskode opdateret! ✅"); }} />
          </Suspense>
          <CookieNoticeBar />
        </div>
      </ConfirmDialogProvider>
    );
  }

  return (
    <ConfirmDialogProvider>
      <div className="pm-root" style={{ fontFamily: font, background: theme.bg, minHeight: "100dvh", color: theme.text, position: "relative" }}>
        {toast && (
          <div className="pm-toast" style={{ position: "fixed", top: "max(12px, env(safe-area-inset-top))", left: "50%", transform: "translateX(-50%)", background: theme.accent, color: "#fff", padding: "11px 22px", borderRadius: "10px", fontSize: "13px", fontWeight: 600, zIndex: 9999, boxShadow: theme.shadowLg, letterSpacing: "-0.01em" }}>
            {toast}
          </div>
        )}
        <Suspense
          fallback={
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: "60vh",
              }}
            >
              <div className="pm-spinner" />
            </div>
          }
        >
          <Routes>
            <Route path="/" element={canUseApp ? <Navigate to={defaultAuthedPath} replace /> : hasProfile ? <Navigate to="/opret" replace /> : <LandingPage />} />
            <Route path="/login" element={canUseApp ? <Navigate to={defaultAuthedPath} replace /> : hasProfile ? <Navigate to="/opret" replace /> : <LoginPageLazy />} />
            <Route path="/opret" element={canUseApp ? <Navigate to={defaultAuthedPath} replace /> : <OnboardingPageLazy />} />
            <Route path="/opret/bekraeft-email" element={canUseApp ? <Navigate to={defaultAuthedPath} replace /> : <SignupEmailSentPageLazy />} />
            <Route
              path="/opret/bekraeft-telefon"
              element={
                canUseApp
                  ? (requiresPhoneVerification ? <PhoneVerificationPageLazy /> : <Navigate to="/dashboard" replace />)
                  : <PhoneVerificationPageLazy />
              }
            />
            <Route path="/privatlivspolitik" element={<PrivacyPageLazy />} />
            <Route path="/handelsbetingelser" element={<TermsPageLazy />} />
            <Route path="/cookies" element={<CookiesPageLazy />} />
            <Route path="/om" element={<OmPageLazy />} />
            <Route path="/faq" element={<FaqPageLazy />} />
            <Route path="/elo" element={<EloExplainerPageLazy />} />
            <Route path="/events" element={<PublicEventsPageLazy />} />
            <Route path="/hjaelp" element={<HelpContactPageLazy />} />
            <Route path="/app" element={<InstallAppPageLazy />} />
            <Route
              path="/dashboard"
              element={
                canUseApp
                  ? (requiresPhoneVerification
                      ? <Navigate to="/opret/bekraeft-telefon" replace />
                      : <DashboardPageLazy user={profile} onLogout={handleLogout} showToast={showToast} />)
                  : hasProfile
                    ? <Navigate to="/opret" replace />
                    : <Navigate to="/" replace />
              }
            />
            <Route
              path="/dashboard/:tab"
              element={
                canUseApp
                  ? (requiresPhoneVerification
                      ? <Navigate to="/opret/bekraeft-telefon" replace />
                      : <DashboardPageLazy user={profile} onLogout={handleLogout} showToast={showToast} />)
                  : hasProfile
                    ? <Navigate to="/opret" replace />
                    : <Navigate to="/" replace />
              }
            />
            <Route path="*" element={<NotFoundPageLazy />} />
          </Routes>
        </Suspense>
        <CookieNoticeBar />
      </div>
    </ConfirmDialogProvider>
  );
}
