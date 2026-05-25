import { useCallback, useState, lazy, Suspense } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { resolveDisplayName } from '../lib/platformUtils';
import { 
  Home, Users, MapPin, Swords, Trophy, Settings, LogOut, 
  MessageCircle, Sun, Moon
} from 'lucide-react';
import { TopHeader } from '../components/TopHeader';
import { BottomNav } from '../components/BottomNav';
import { useDashboardBadges } from '../hooks/useDashboardBadges';
import { useDarkMode } from '../lib/useDarkMode';
import { AdminPinGate } from '../components/AdminPinGate';
import { GuidedTourOverlay } from '../components/GuidedTourOverlay';
import { GuidedTourPrompt } from '../components/GuidedTourPrompt';
import { FeedbackReportModal } from '../components/FeedbackReportModal';
import { useGuidedTour } from '../hooks/useGuidedTour';
import { PendingResultConfirmModal } from '../components/PendingResultConfirmModal';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';

const HomeTabLazy = lazy(() => import('./HomeTab').then((m) => ({ default: m.HomeTab })));
const MakkereTabLazy = lazy(() => import('./MakkereTab').then((m) => ({ default: m.MakkereTab })));
const BanerTabLazy = lazy(() => import('./BanerTab').then((m) => ({ default: m.BanerTab })));
const KampeTabLazy = lazy(() => import('./KampeTab').then((m) => ({ default: m.KampeTab })));
const RankingTabLazy = lazy(() => import('./RankingTab').then((m) => ({ default: m.RankingTab })));
const ProfilTabLazy = lazy(() => import('./ProfilTab').then((m) => ({ default: m.ProfilTab })));
const MatchSearchFilterPageLazy = lazy(() => import('./MatchSearchFilterPage').then((m) => ({ default: m.MatchSearchFilterPage })));
const MakkerSearchFilterPageLazy = lazy(() => import('./MakkerSearchFilterPage').then((m) => ({ default: m.MakkerSearchFilterPage })));
const AdminTabLazy = lazy(() => import('./AdminTab').then((m) => ({ default: m.AdminTab })));
const BeskedTabLazy = lazy(() => import('./BeskedTab').then((m) => ({ default: m.BeskedTab })));

export function DashboardPage({ user, onLogout, showToast }) {
  const { user: authUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [dark, setDark] = useDarkMode();
  
  const displayName = resolveDisplayName(user, authUser);
  const userInitial = (displayName || "?").trim().charAt(0).toUpperCase();
  const isAdmin = user?.role === 'admin';

  const { 
    unreadMessages, 
    hasKampeAttention, 
    kampeTabBadge, 
    unreadNotifs, 
    adminAttentionCount 
  } = useDashboardBadges(user?.id, isAdmin);

  const pathTab = location.pathname.split("/")[2] || "hjem";
  const validTabs = ["hjem", "makkere", "baner", "kampe", "ranking", "liga", "beskeder", "profil", "kamp-filter", "makker-filter", "admin"];
  const tab = validTabs.includes(pathTab) ? pathTab : "hjem";

  const setTab = useCallback((tabId, opts = {}) => {
    const raw = opts.search != null ? String(opts.search) : "";
    const q = raw ? (raw.startsWith("?") ? raw : `?${raw}`) : "";
    navigate(`/dashboard/${tabId}${q}`);
  }, [navigate]);

  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [adminPinUnlocked, setAdminPinUnlocked] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const {
    tourOpen,
    tourPromptOpen,
    tourSteps,
    tourStepIndex,
    tourOnNotificationStep,
    mobileMoreTourActive,
    forceAccountMenuOpen,
    startTour,
    handleTourBack,
    handleTourNext,
    handleTourPromptAccept,
    handleTourPromptDecline,
    handleTourPromptDefer,
    handleTourSkip,
    handleTourFinish,
  } = useGuidedTour({
    userId: user?.id,
    tab,
    setTab,
    showToast,
    onCloseMobileMore: () => setMobileMoreOpen(false),
    onMobileMoreOpenChange: setMobileMoreOpen,
  });

  const mobileMoreVisible = mobileMoreOpen || mobileMoreTourActive;

  return (
    <div className="min-h-screen bg-pm-bg flex flex-col pb-20 md:pb-0 font-sans">
      <TopHeader 
        user={user}
        displayName={displayName}
        userInitial={userInitial}
        isAdmin={isAdmin}
        unreadNotifs={unreadNotifs}
        adminAttentionCount={adminAttentionCount}
        onLogout={onLogout}
        onProfileClick={() => setTab('profil')}
        onTourClick={startTour}
        tourOnNotificationStep={tourOnNotificationStep}
        forceAccountMenuOpen={forceAccountMenuOpen}
        onFeedbackClick={() => setFeedbackOpen(true)}
        onLandingClick={() => navigate('/?forside=1')}
        onAdminClick={() => setTab('admin')}
        dark={dark}
        onTabChange={setTab}
      />

      {/* Desktop Tabs */}
      <div className="hidden md:flex px-4 overflow-x-auto mt-8 mb-4 max-w-7xl mx-auto gap-2">
        {[
          { id: 'hjem', label: 'Hjem', icon: Home },
          { id: 'makkere', label: 'Makkere', icon: Users },
          { id: 'baner', label: 'Baner', icon: MapPin },
          { id: 'kampe', label: 'Kampe', icon: Swords, badge: kampeTabBadge, attention: hasKampeAttention },
          { id: 'ranking', label: 'Ranking', icon: Trophy },
          { id: 'beskeder', label: 'Beskeder', icon: MessageCircle, badge: unreadMessages },
        ].map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              data-tour={`tab-${t.id}`}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-2 px-6 py-3 text-sm font-black rounded-2xl transition-all",
                active 
                  ? "bg-pm-accent text-white shadow-lg shadow-pm-accent/20" 
                  : "text-slate-500 hover:bg-white dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
              )}
            >
              <Icon size={18} strokeWidth={active ? 3 : 2} />
              {t.label}
              {t.badge > 0 && (
                <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{t.badge}</span>
              )}
            </button>
          );
        })}
      </div>

      <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-6">
        <Suspense fallback={<div className="flex items-center justify-center p-12 text-pm-text-light font-bold">Indlæser...</div>}>
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
            >
              {tab === "hjem" && <HomeTabLazy user={user} setTab={setTab} />}
              {tab === "makkere"  && <MakkereTabLazy user={user} showToast={showToast} />}
              {tab === "baner"    && <BanerTabLazy />}
              {tab === "kampe"    && <KampeTabLazy user={user} showToast={showToast} tabActive />}
              {tab === "ranking"  && <RankingTabLazy user={user} />}
              {tab === "beskeder" && <BeskedTabLazy user={user} showToast={showToast} setTab={setTab} />}
              {tab === "profil"   && <ProfilTabLazy user={user} showToast={showToast} setTab={setTab} />}
              {tab === "kamp-filter" && <MatchSearchFilterPageLazy user={user} showToast={showToast} />}
              {tab === "makker-filter" && <MakkerSearchFilterPageLazy user={user} showToast={showToast} />}
              {tab === "admin" && isAdmin && adminPinUnlocked && <AdminTabLazy />}
              {tab === "admin" && isAdmin && !adminPinUnlocked && (
                <div className="bg-pm-surface p-8 rounded-3xl border border-pm-border text-center">
                  <p className="text-pm-text font-bold mb-4">Admin-adgang er låst.</p>
                  <button onClick={() => setAdminPinUnlocked(true)} className="bg-pm-accent text-white px-6 py-2 rounded-full font-bold">Lås op</button>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </Suspense>
      </main>

      <BottomNav 
        activeTab={tab}
        onTabChange={setTab}
        hasKampeAttention={hasKampeAttention}
        kampeTabBadge={kampeTabBadge}
        unreadMessages={unreadMessages}
        onMoreClick={() => setMobileMoreOpen(true)}
        className={mobileMoreTourActive ? 'opacity-0 pointer-events-none' : undefined}
      />

      {/* Mobile More Sheet */}
      <AnimatePresence>
        {mobileMoreVisible && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => {
                if (mobileMoreTourActive) return;
                setMobileMoreOpen(false);
              }}
              className={cn(
                'fixed inset-0 bg-black/40 backdrop-blur-sm',
                mobileMoreTourActive ? 'z-[10045]' : 'z-[60]',
              )}
            />
            <motion.div
              initial={mobileMoreTourActive ? false : { y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={mobileMoreTourActive ? { duration: 0 } : { type: 'spring', damping: 28, stiffness: 320 }}
              data-tour="mobile-more-sheet"
              className={cn(
                'fixed bottom-0 left-0 right-0 bg-pm-surface rounded-t-[2.5rem] border-t border-pm-border p-6 shadow-2xl',
                mobileMoreTourActive ? 'z-[10050]' : 'z-[70]',
              )}
            >
              <div className="w-12 h-1.5 bg-pm-border rounded-full mx-auto mb-8" />
              <div className="grid grid-cols-3 gap-6">
                {[
                  { id: 'ranking', label: 'Ranking', icon: Trophy },
                  { id: 'beskeder', label: 'Beskeder', icon: MessageCircle, badge: unreadMessages },
                  { id: 'profil', label: 'Profil', icon: Settings },
                ].map((t) => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      data-tour={`mobile-tab-${t.id}`}
                      onClick={() => { setTab(t.id); setMobileMoreOpen(false); }}
                      className="flex flex-col items-center gap-2 group"
                    >
                      <div className="w-14 h-14 rounded-2xl bg-pm-surface-alt flex items-center justify-center text-pm-text-light group-hover:bg-pm-accent-bg group-hover:text-pm-accent transition-all">
                        <Icon size={24} />
                      </div>
                      <span className="text-[11px] font-black text-pm-text-light uppercase tracking-wider">{t.label}</span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-8 pt-8 border-t border-pm-border flex flex-col gap-2">
                <button onClick={() => { setDark(!dark); setMobileMoreOpen(false); }} className="w-full flex items-center justify-between p-4 rounded-2xl bg-pm-surface-alt font-bold text-pm-text">
                  <div className="flex items-center gap-3">
                    {dark ? <Moon size={20} /> : <Sun size={20} />}
                    <span>Mørk tilstand</span>
                  </div>
                  <span className="text-pm-accent">{dark ? 'Til' : 'Fra'}</span>
                </button>
                <button onClick={() => { onLogout(); setMobileMoreOpen(false); }} className="w-full flex items-center gap-3 p-4 rounded-2xl text-red-500 font-bold">
                  <LogOut size={20} />
                  <span>Log ud</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <PendingResultConfirmModal user={user} />
      <FeedbackReportModal
        open={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
        showToast={showToast}
        displayName={displayName}
        userId={user?.id}
        userEmail={authUser?.email || user?.email}
      />
      <GuidedTourPrompt
        open={tourPromptOpen && !tourOpen && !feedbackOpen}
        onAccept={handleTourPromptAccept}
        onDecline={handleTourPromptDecline}
        onDefer={handleTourPromptDefer}
      />
      <GuidedTourOverlay
        open={tourOpen}
        steps={tourSteps}
        stepIndex={tourStepIndex}
        onBack={handleTourBack}
        onNext={handleTourNext}
        onSkip={handleTourSkip}
        onFinish={handleTourFinish}
        zIndex={mobileMoreTourActive ? 10060 : undefined}
      />
      {isAdmin && !adminPinUnlocked && tab === 'admin' && (
        <AdminPinGate userId={user?.id} showToast={showToast} onUnlocked={() => setAdminPinUnlocked(true)} onCancel={() => setTab('hjem')} />
      )}
    </div>
  );
}
