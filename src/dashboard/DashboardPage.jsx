import { useEffect, useCallback, useState, useRef, lazy, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { font, theme, btn, heading } from '../lib/platformTheme';
import { resolveDisplayName } from '../lib/platformUtils';
import { Home, Users, MapPin, Swords, Trophy, Settings, LogOut, MessageCircle, Medal, ChevronDown, Menu } from 'lucide-react';
import { NotificationBell } from '../components/NotificationBell';
import { HomeTab } from './HomeTab';
import { ShieldCheck } from 'lucide-react';
import { useUnreadMessageCount } from '../lib/chatUtils';
import { useDarkMode } from '../lib/useDarkMode';
import { supabase } from '../lib/supabase';

const MakkereTabLazy = lazy(() => import('./MakkereTab').then((m) => ({ default: m.MakkereTab })));
const BanerTabLazy = lazy(() => import('./BanerTab').then((m) => ({ default: m.BanerTab })));
const KampeTabLazy = lazy(() => import('./KampeTab').then((m) => ({ default: m.KampeTab })));
const RankingTabLazy = lazy(() => import('./RankingTab').then((m) => ({ default: m.RankingTab })));
const ProfilTabLazy = lazy(() => import('./ProfilTab').then((m) => ({ default: m.ProfilTab })));
const AdminTabLazy = lazy(() => import('./AdminTab').then((m) => ({ default: m.AdminTab })));
const BeskedTabLazy = lazy(() => import('./BeskedTab').then((m) => ({ default: m.BeskedTab })));
const LigaTabLazy = lazy(() => import('./LigaTab').then((m) => ({ default: m.LigaTab })));

function usePendingLigaInvites(userId) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!userId) { setCount(0); return; }
    let cancelled = false;
    let timer = null;
    const scheduleFetch = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { void fetch(); }, 250);
    };
    const fetch = async () => {
      try {
        const { count: c } = await supabase
          .from('league_teams')
          .select('id', { count: 'exact', head: true })
          .eq('player2_id', userId)
          .eq('status', 'pending');
        if (!cancelled) setCount(c || 0);
      } catch (e) {
        console.warn('liga invites badge:', e);
      }
    };
    void fetch();
    const channel = supabase
      .channel('liga-invites-' + userId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'league_teams', filter: 'player2_id=eq.' + userId }, scheduleFetch)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'league_teams', filter: 'player2_id=eq.' + userId }, scheduleFetch)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'league_teams', filter: 'player2_id=eq.' + userId }, scheduleFetch)
      .subscribe();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [userId]);
  return count;
}

function usePendingKampeBadge(userId) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!userId) { setCount(0); return; }
    let cancelled = false;
    let timer = null;
    const scheduleRefetch = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { void refetch(); }, 250);
    };
    const refetch = async () => {
      try {
        const [myMatchesRes, myPlayerRes] = await Promise.all([
          supabase.from('matches').select('id').eq('creator_id', userId),
          supabase.from('match_players').select('match_id').eq('user_id', userId),
        ]);
        const myMatchIds    = (myMatchesRes.data || []).map(m => m.id);
        const myPlayerMIds  = (myPlayerRes.data  || []).map(p => p.match_id);
        const [joinRes, resultRes] = await Promise.all([
          myMatchIds.length > 0
            ? supabase.from('match_join_requests').select('id', { count: 'exact', head: true }).in('match_id', myMatchIds).eq('status', 'pending')
            : { count: 0 },
          myPlayerMIds.length > 0
            ? supabase.from('match_results').select('id', { count: 'exact', head: true }).in('match_id', myPlayerMIds).eq('confirmed', false).neq('submitted_by', userId)
            : { count: 0 },
        ]);
        if (!cancelled) setCount((joinRes.count || 0) + (resultRes.count || 0));
      } catch (e) {
        console.warn('kampe badge refetch:', e);
      }
    };
    void refetch();
    const ch1 = supabase.channel('kampe-badge-req-' + userId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'match_join_requests', filter: 'status=eq.pending' }, scheduleRefetch)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'match_join_requests', filter: 'status=eq.pending' }, scheduleRefetch)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'match_join_requests', filter: 'status=eq.pending' }, scheduleRefetch)
      .subscribe();
    const ch2 = supabase.channel('kampe-badge-res-' + userId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'match_results', filter: 'confirmed=eq.false' }, scheduleRefetch)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'match_results', filter: 'confirmed=eq.false' }, scheduleRefetch)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'match_results', filter: 'confirmed=eq.false' }, scheduleRefetch)
      .subscribe();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      supabase.removeChannel(ch1);
      supabase.removeChannel(ch2);
    };
  }, [userId]);
  return count;
}

function useUnreadNotificationsCount(userId) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!userId) { setCount(0); return; }
    let cancelled = false;
    let timer = null;

    const refetch = async () => {
      try {
        const { count: c } = await supabase
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('read', false);
        if (!cancelled) setCount(c || 0);
      } catch (e) {
        console.warn('notif badge refetch:', e);
      }
    };

    const scheduleRefetch = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { void refetch(); }, 250);
    };

    void refetch();
    const channel = supabase
      .channel('notif-badge-' + userId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: 'user_id=eq.' + userId }, scheduleRefetch)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications', filter: 'user_id=eq.' + userId }, scheduleRefetch)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'notifications', filter: 'user_id=eq.' + userId }, scheduleRefetch)
      .subscribe();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return count;
}

const PRIMARY_TAB_IDS = ["hjem", "makkere", "baner", "kampe", "ranking"];

const tabBtnStyle = (active) => ({
  background: "transparent",
  color: active ? theme.accent : theme.textMid,
  border: "none",
  borderBottom: active ? "3px solid " + theme.accent : "3px solid transparent",
  marginBottom: "-1px",
  padding: "5px 9px 6px",
  borderRadius: 0,
  fontSize: "clamp(11px,2.8vw,12px)",
  fontWeight: active ? 800 : 500,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: "5px",
  whiteSpace: "nowrap",
  fontFamily: font,
  flexShrink: 0,
  transition: "color 0.12s, border-color 0.12s",
  letterSpacing: "-0.01em",
  position: "relative",
});

export function DashboardPage({ user, onLogout, showToast }) {
  const { user: authUser, refreshProfileQuiet } = useAuth();
  const displayName = resolveDisplayName(user, authUser);
  const navigate = useNavigate();
  const location = useLocation();
  const isAdmin = user?.role === 'admin';
  const unreadMessages = useUnreadMessageCount(user?.id);
  const pendingLigaInvites = usePendingLigaInvites(user?.id);
  const pendingKampe = usePendingKampeBadge(user?.id);
  const unreadNotifs = useUnreadNotificationsCount(user?.id);
  const pathTab = location.pathname.split("/")[2] || "hjem";
  const validTabs = ["hjem", "makkere", "baner", "kampe", "ranking", "liga", "beskeder", "profil", "admin"];
  const tab = validTabs.includes(pathTab) ? pathTab : "hjem";
  const setTab = useCallback((t) => navigate("/dashboard/" + t), [navigate]);

  const [dark, setDark] = useDarkMode();
  const [moreOpen, setMoreOpen] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [morePos, setMorePos] = useState(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountPos, setAccountPos] = useState(null);
  const [isMobileView, setIsMobileView] = useState(() => (typeof window !== "undefined" ? window.innerWidth <= 768 : false));
  const [mobileConversationOpen, setMobileConversationOpen] = useState(false);
  const moreBtnRef = useRef(null);
  const moreDropRef = useRef(null);
  const accountBtnRef = useRef(null);
  const accountDropRef = useRef(null);

  useEffect(() => {
    if (!moreOpen) return;
    const rect = moreBtnRef.current?.getBoundingClientRect();
    if (rect) {
      const left = Math.min(rect.left, window.innerWidth - 170);
      setMorePos({ top: rect.bottom + 4, left });
    }
    const handler = (e) => {
      if (moreBtnRef.current?.contains(e.target) || moreDropRef.current?.contains(e.target)) return;
      setMoreOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [moreOpen]);

  useEffect(() => {
    if (!accountOpen) return;
    const rect = accountBtnRef.current?.getBoundingClientRect();
    if (rect) {
      const left = Math.min(Math.max(8, rect.right - 230), window.innerWidth - 238);
      setAccountPos({ top: rect.bottom + 6, left });
    }
    const handler = (e) => {
      if (accountBtnRef.current?.contains(e.target) || accountDropRef.current?.contains(e.target)) return;
      setAccountOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [accountOpen]);

  useEffect(() => {
    const onResize = () => setIsMobileView(window.innerWidth <= 768);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (["hjem", "profil", "ranking", "kampe", "makkere", "admin"].includes(tab)) refreshProfileQuiet();
  }, [tab, refreshProfileQuiet]);

  useEffect(() => {
    setMoreOpen(false);
    setMobileMoreOpen(false);
    setAccountOpen(false);
  }, [tab]);

  useEffect(() => {
    if (tab !== "beskeder") setMobileConversationOpen(false);
  }, [tab]);

  const allTabs = [
    { id: "hjem",     label: "Hjem",        icon: <Home          size={15} /> },
    { id: "makkere",  label: "Find Makker",  icon: <Users         size={15} /> },
    { id: "baner",    label: "Book Bane",    icon: <MapPin        size={15} /> },
    { id: "kampe",    label: "Kampe",        icon: <Swords        size={15} />, badge: pendingKampe > 0 ? pendingKampe : null },
    { id: "ranking",  label: "Ranking",      icon: <Trophy        size={15} /> },
    { id: "liga",     label: "Liga",         icon: <Medal         size={15} />, badge: pendingLigaInvites > 0 ? pendingLigaInvites : null },
    { id: "beskeder", label: "Beskeder",     icon: <MessageCircle size={15} />, badge: unreadMessages > 0 ? unreadMessages : null },
  ];
  // Profil vises i konto-dropdown på desktop, men beholdes i mobilens "Mere"-menu.
  if (isMobileView) allTabs.push({ id: "profil", label: "Profil", icon: <Settings size={15} /> });
  if (isAdmin) allTabs.push({ id: "admin", label: "Admin", icon: <ShieldCheck size={15} /> });

  const primaryTabs = allTabs.filter(t => PRIMARY_TAB_IDS.includes(t.id));
  const moreTabs    = allTabs.filter(t => !PRIMARY_TAB_IDS.includes(t.id) && t.id !== "liga");
  const moreIsActive = moreTabs.some(t => t.id === tab);
  const moreBadge = moreTabs.reduce((s, t) => s + (t.badge || 0), 0);
  const mobilePrimaryTabs = allTabs.filter(t => ["hjem", "makkere", "baner", "kampe"].includes(t.id));
  const mobileMoreTabs = allTabs.filter(t => !["hjem", "makkere", "baner", "kampe"].includes(t.id) && t.id !== "liga");
  const mobileMoreIsActive = mobileMoreTabs.some(t => t.id === tab);
  const mobileMoreBadge = mobileMoreTabs.reduce((s, t) => s + (t.badge || 0), 0);
  const userInitial = (displayName || "?").trim().charAt(0).toUpperCase();

  const hideMobileBottomNav = isMobileView && tab === "beskeder" && mobileConversationOpen;

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div className="pm-dash-header" style={{ padding: "clamp(8px,1.8vw,11px) clamp(12px,2.6vw,18px)", paddingTop: "max(clamp(8px,1.8vw,11px), env(safe-area-inset-top))", borderBottom: "1px solid " + theme.border, background: theme.surface, position: "sticky", top: 0, zIndex: 20 }}>
        <button type="button" onClick={() => setTab("hjem")} className="pm-dash-brand" style={{ ...heading("clamp(16px,4vw,18px)"), color: theme.accent, display: "flex", alignItems: "center", gap: "8px", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: font }}>
          <img src="/logo-nav.png" alt="PadelMakker" style={{ height: "34px", width: "auto", objectFit: "contain" }} /> PadelMakker
        </button>
        <div className="pm-dash-header-actions pm-dash-header-actions-mobile">
          {isMobileView && <NotificationBell />}
        </div>
        <div className="pm-dash-account-desktop">
          <button
            ref={accountBtnRef}
            type="button"
            onClick={() => setAccountOpen((open) => !open)}
            style={{
              ...btn(false),
              padding: "6px 10px",
              fontSize: "12px",
              borderRadius: "999px",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              minHeight: "36px",
              position: "relative",
            }}
          >
            {unreadNotifs > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: "-4px",
                  right: "-4px",
                  minWidth: "18px",
                  height: "18px",
                  padding: "0 5px",
                  borderRadius: "999px",
                  background: theme.red,
                  color: "#fff",
                  fontSize: "10px",
                  fontWeight: 800,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  lineHeight: 1,
                  boxSizing: "border-box",
                  border: "2px solid " + theme.surface,
                }}
              >
                {unreadNotifs > 9 ? "9+" : unreadNotifs}
              </span>
            )}
            <span style={{ width: "22px", height: "22px", borderRadius: "999px", background: theme.accentBg, color: theme.accent, fontSize: "11px", fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              {userInitial}
            </span>
            <span className="pm-dash-account-name">{displayName}</span>
            <ChevronDown size={14} style={{ transform: accountOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.14s ease" }} />
          </button>
        </div>
        {accountOpen && accountPos && createPortal(
          <div
            ref={accountDropRef}
            style={{
              position: "fixed",
              top: accountPos.top,
              left: accountPos.left,
              width: "230px",
              background: theme.surface,
              border: "1px solid " + theme.border,
              borderRadius: "12px",
              boxShadow: "0 8px 32px rgba(0,0,0,0.14)",
              zIndex: 9999,
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "10px 12px", borderBottom: "1px solid " + theme.border }}>
              <div style={{ fontSize: "11px", color: theme.textMid, marginBottom: "4px" }}>Logget ind som</div>
              <div style={{ fontSize: "13px", fontWeight: 700, color: theme.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayName}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", padding: "10px 12px", borderBottom: "1px solid " + theme.border }}>
              <span style={{ fontSize: "13px", fontWeight: 600, color: theme.textMid }}>Notifikationer</span>
              {!isMobileView && <NotificationBell />}
            </div>
            <button
              type="button"
              onClick={() => {
                setTab("profil");
                setAccountOpen(false);
              }}
              style={{ display: "flex", alignItems: "center", gap: "9px", width: "100%", padding: "11px 12px", border: "none", borderBottom: "1px solid " + theme.border, background: "transparent", color: theme.text, fontWeight: 600, fontSize: "13px", cursor: "pointer", textAlign: "left", fontFamily: font }}
            >
              <Settings size={15} />
              Min profil
            </button>
            <button
              type="button"
              onClick={() => {
                setAccountOpen(false);
                onLogout();
              }}
              style={{ display: "flex", alignItems: "center", gap: "9px", width: "100%", padding: "11px 12px", border: "none", background: "transparent", color: "#b91c1c", fontWeight: 700, fontSize: "13px", cursor: "pointer", textAlign: "left", fontFamily: font }}
            >
              <LogOut size={15} />
              Log ud
            </button>
          </div>
          ,
          document.body
        )}
      </div>

      {/* Tab strip */}
      <div className="pm-tab-strip" style={{ background: theme.surface, borderBottom: "1px solid " + theme.border }}>
        {primaryTabs.map(t => (
          <button key={t.id} type="button" title={t.label} aria-label={t.label} onClick={() => setTab(t.id)} style={tabBtnStyle(tab === t.id)}>
            <span aria-hidden style={{ display: "flex", position: "relative" }}>
              {t.icon}
              {t.badge && (
                <span style={{ position: "absolute", top: "-5px", right: "-6px", background: theme.red, color: "#fff", borderRadius: "10px", fontSize: "9px", fontWeight: 800, padding: "1px 4px", lineHeight: 1.2 }}>
                  {t.badge > 9 ? "9+" : t.badge}
                </span>
              )}
            </span>
            <span className="pm-tab-label">{t.label}</span>
          </button>
        ))}

        {/* Mere dropdown */}
        <button
          ref={moreBtnRef}
          type="button"
          onClick={() => setMoreOpen(o => !o)}
          style={{ ...tabBtnStyle(moreIsActive), gap: "3px" }}
        >
          <span aria-hidden style={{ display: "flex", position: "relative" }}>
            <ChevronDown size={15} style={{ transition: "transform 0.15s", transform: moreOpen ? "rotate(180deg)" : "rotate(0deg)" }} />
            {moreBadge > 0 && (
              <span style={{ position: "absolute", top: "-5px", right: "-6px", background: theme.red, color: "#fff", borderRadius: "10px", fontSize: "9px", fontWeight: 800, padding: "1px 4px", lineHeight: 1.2 }}>
                {moreBadge > 9 ? "9+" : moreBadge}
              </span>
            )}
          </span>
          <span className="pm-tab-label">Mere</span>
        </button>

        {moreOpen && morePos && createPortal(
          <div ref={moreDropRef} style={{ position: "fixed", top: morePos.top, left: morePos.left, background: theme.surface, border: "1px solid " + theme.border, borderRadius: "10px", boxShadow: "0 8px 32px rgba(0,0,0,0.14)", zIndex: 9999, minWidth: "165px", overflow: "hidden" }}>
            {moreTabs.map((t, i) => (
              <button
                key={t.id}
                type="button"
                onClick={() => { setTab(t.id); setMoreOpen(false); }}
                style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%", padding: "11px 16px", background: tab === t.id ? theme.accentBg : "transparent", color: tab === t.id ? theme.accent : theme.text, border: "none", borderBottom: i < moreTabs.length - 1 ? "1px solid " + theme.border : "none", fontSize: "13px", fontWeight: tab === t.id ? 700 : 500, cursor: "pointer", fontFamily: font, textAlign: "left" }}
              >
                <span style={{ display: "flex", position: "relative" }}>
                  {t.icon}
                  {t.badge && (
                    <span style={{ position: "absolute", top: "-4px", right: "-6px", background: theme.red, color: "#fff", borderRadius: "10px", fontSize: "9px", fontWeight: 800, padding: "1px 4px", lineHeight: 1.2 }}>
                      {t.badge > 9 ? "9+" : t.badge}
                    </span>
                  )}
                </span>
                {t.label}
              </button>
            ))}
          </div>,
          document.body
        )}
      </div>

      <div className="pm-dash-main">
        {tab === "hjem" && <HomeTab user={user} setTab={setTab} />}
        {tab !== "hjem" && (
          <Suspense
            fallback={
              <div
                style={{
                  background: theme.surface,
                  border: "1px solid " + theme.border,
                  borderRadius: "12px",
                  padding: "18px",
                  color: theme.textLight,
                  fontSize: "13px",
                }}
              >
                Indlæser…
              </div>
            }
          >
            {tab === "makkere"  && <MakkereTabLazy user={user} showToast={showToast} />}
            {tab === "baner"    && <BanerTabLazy />}
            {tab === "kampe"    && <KampeTabLazy user={user} showToast={showToast} tabActive />}
            {tab === "ranking"  && <RankingTabLazy user={user} />}
            {tab === "liga"     && <LigaTabLazy user={user} showToast={showToast} />}
            {tab === "beskeder" && <BeskedTabLazy user={user} onMobileConversationStateChange={setMobileConversationOpen} />}
            {tab === "profil"   && <ProfilTabLazy user={user} showToast={showToast} setTab={setTab} dark={dark} onDarkModeChange={setDark} />}
            {tab === "admin"    && isAdmin && <AdminTabLazy />}
          </Suspense>
        )}
      </div>

      {mobileMoreOpen && (
        <button
          type="button"
          aria-label="Luk menu"
          className="pm-mobile-more-backdrop"
          onClick={() => setMobileMoreOpen(false)}
        />
      )}
      {mobileMoreOpen && (
        <div className="pm-mobile-more-sheet">
          {mobileMoreTabs.map((t) => (
            <button
              key={t.id}
              type="button"
              className="pm-mobile-more-row"
              onClick={() => {
                setTab(t.id);
                setMobileMoreOpen(false);
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: "10px", position: "relative" }}>
                {t.icon}
                {t.label}
                {t.badge && (
                  <span style={{ background: theme.red, color: "#fff", borderRadius: "10px", fontSize: "10px", fontWeight: 800, padding: "1px 6px", lineHeight: 1.3 }}>
                    {t.badge > 9 ? "9+" : t.badge}
                  </span>
                )}
              </span>
            </button>
          ))}
          <button
            type="button"
            className="pm-mobile-more-row pm-mobile-more-logout"
            onClick={() => {
              setMobileMoreOpen(false);
              onLogout();
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <LogOut size={16} />
              Log ud
            </span>
          </button>
        </div>
      )}

      {!hideMobileBottomNav && (
      <nav className="pm-mobile-bottom-nav" aria-label="Mobil navigation">
        {mobilePrimaryTabs.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className="pm-mobile-bottom-btn"
              aria-label={t.label}
              title={t.label}
            >
              <span className="pm-mobile-bottom-icon-wrap" style={{ color: active ? theme.accent : theme.textMid }}>
                {t.icon}
                {t.badge && (
                  <span className="pm-mobile-bottom-badge">
                    {t.badge > 9 ? "9+" : t.badge}
                  </span>
                )}
              </span>
              <span
                className="pm-mobile-bottom-label"
                style={{ color: active ? theme.accent : theme.textMid, fontWeight: active ? 700 : 500 }}
              >
                {t.label}
              </span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setMobileMoreOpen((open) => !open)}
          className="pm-mobile-bottom-btn"
          aria-label="Mere"
          title="Mere"
        >
          <span className="pm-mobile-bottom-icon-wrap">
            <Menu size={18} color={mobileMoreIsActive || mobileMoreOpen ? theme.accent : theme.textMid} />
            {mobileMoreBadge > 0 && (
              <span className="pm-mobile-bottom-badge">
                {mobileMoreBadge > 9 ? "9+" : mobileMoreBadge}
              </span>
            )}
          </span>
          <span
            className="pm-mobile-bottom-label"
            style={{ color: mobileMoreIsActive || mobileMoreOpen ? theme.accent : theme.textMid, fontWeight: mobileMoreIsActive || mobileMoreOpen ? 700 : 500 }}
          >
            Mere
          </span>
        </button>
      </nav>
      )}
    </div>
  );
}
