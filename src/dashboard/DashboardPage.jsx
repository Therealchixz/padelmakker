import { useEffect, useCallback, useState, useRef, lazy, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { font, theme, btn, heading } from '../lib/platformTheme';
import { resolveDisplayName } from '../lib/platformUtils';
import { Home, Users, MapPin, Swords, Trophy, Settings, LogOut, MessageCircle, Medal, ChevronDown, Menu, Bug } from 'lucide-react';
import { NotificationBell } from '../components/NotificationBell';
import { HomeTab } from './HomeTab';
import { ShieldCheck } from 'lucide-react';
import { useUnreadMessageCount } from '../lib/chatUtils';
import { useDarkMode } from '../lib/useDarkMode';
import { supabase } from '../lib/supabase';

const loadMakkereTab = () => import('./MakkereTab');
const loadBanerTab = () => import('./BanerTab');
const loadKampeTab = () => import('./KampeTab');
const loadRankingTab = () => import('./RankingTab');
const loadProfilTab = () => import('./ProfilTab');
const loadAdminTab = () => import('./AdminTab');
const loadBeskedTab = () => import('./BeskedTab');
const loadLigaTab = () => import('./LigaTab');

const MakkereTabLazy = lazy(() => loadMakkereTab().then((m) => ({ default: m.MakkereTab })));
const BanerTabLazy = lazy(() => loadBanerTab().then((m) => ({ default: m.BanerTab })));
const KampeTabLazy = lazy(() => loadKampeTab().then((m) => ({ default: m.KampeTab })));
const RankingTabLazy = lazy(() => loadRankingTab().then((m) => ({ default: m.RankingTab })));
const ProfilTabLazy = lazy(() => loadProfilTab().then((m) => ({ default: m.ProfilTab })));
const AdminTabLazy = lazy(() => loadAdminTab().then((m) => ({ default: m.AdminTab })));
const BeskedTabLazy = lazy(() => loadBeskedTab().then((m) => ({ default: m.BeskedTab })));
const LigaTabLazy = lazy(() => loadLigaTab().then((m) => ({ default: m.LigaTab })));

function usePendingLigaInvites(userId) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!userId) { setCount(0); return; }
    let cancelled = false;
    const syncCount = async () => {
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
    const applyDeltaFromPayload = (payload) => {
      if (cancelled) return;
      const event = payload?.eventType;
      const next = payload?.new || {};
      const prev = payload?.old || {};
      const nextPending = next?.status === 'pending';
      const prevPending = prev?.status === 'pending';

      if (event === 'INSERT') {
        if (nextPending) setCount((v) => v + 1);
        return;
      }
      if (event === 'UPDATE') {
        if (prevPending === nextPending) return;
        setCount((v) => Math.max(0, v + (nextPending ? 1 : -1)));
        return;
      }
      if (event === 'DELETE' && prevPending) {
        setCount((v) => Math.max(0, v - 1));
      }
    };

    void syncCount();
    const channel = supabase
      .channel('liga-invites-' + userId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'league_teams', filter: 'player2_id=eq.' + userId }, applyDeltaFromPayload)
      .subscribe();
    return () => {
      cancelled = true;
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
    let intervalId = null;
    let myCreatedMatchIds = [];
    let myPlayerMatchIds = [];
    let shouldRefreshIds = true;
    let inFlight = false;
    let rerunAfterFlight = false;

    const isPageVisible = () => (typeof document === "undefined" || document.visibilityState === "visible");
    const scheduleRefetch = (opts = {}) => {
      const { refreshIds = false, delay = 350 } = opts;
      if (refreshIds) shouldRefreshIds = true;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { void refetch(); }, delay);
    };

    const loadIds = async () => {
      try {
        const [myMatchesRes, myPlayerRes] = await Promise.all([
          supabase.from('matches').select('id').eq('creator_id', userId),
          supabase.from('match_players').select('match_id').eq('user_id', userId),
        ]);
        myCreatedMatchIds = (myMatchesRes.data || []).map(m => m.id);
        myPlayerMatchIds = [...new Set((myPlayerRes.data || []).map(p => p.match_id))];
        shouldRefreshIds = false;
      } catch (e) {
        console.warn('kampe badge ids:', e);
      }
    };

    const loadCounts = async () => {
      try {
        const [joinRes, resultRes] = await Promise.all([
          myCreatedMatchIds.length > 0
            ? supabase.from('match_join_requests').select('id', { count: 'exact', head: true }).in('match_id', myCreatedMatchIds).eq('status', 'pending')
            : { count: 0 },
          myPlayerMatchIds.length > 0
            ? supabase.from('match_results').select('id', { count: 'exact', head: true }).in('match_id', myPlayerMatchIds).eq('confirmed', false).neq('submitted_by', userId)
            : { count: 0 },
        ]);
        if (!cancelled) setCount((joinRes.count || 0) + (resultRes.count || 0));
      } catch (e) {
        console.warn('kampe badge counts:', e);
      }
    };

    const refetch = async () => {
      if (!isPageVisible()) return;
      if (inFlight) {
        rerunAfterFlight = true;
        return;
      }
      inFlight = true;
      try {
        if (shouldRefreshIds) await loadIds();
        await loadCounts();
      } finally {
        inFlight = false;
        if (rerunAfterFlight) {
          rerunAfterFlight = false;
          scheduleRefetch({ delay: 120 });
        }
      }
    };

    const onVisibilityChange = () => {
      if (!isPageVisible()) return;
      scheduleRefetch({ delay: 80 });
    };

    void refetch();
    intervalId = setInterval(() => {
      if (isPageVisible()) scheduleRefetch({ delay: 50 });
    }, 15000);
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibilityChange);
    }

    const chMatches = supabase.channel('kampe-badge-matches-' + userId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches', filter: 'creator_id=eq.' + userId }, () => scheduleRefetch({ refreshIds: true, delay: 120 }))
      .subscribe();
    const chPlayers = supabase.channel('kampe-badge-players-' + userId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'match_players', filter: 'user_id=eq.' + userId }, () => scheduleRefetch({ refreshIds: true, delay: 120 }))
      .subscribe();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (intervalId) clearInterval(intervalId);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibilityChange);
      }
      supabase.removeChannel(chMatches);
      supabase.removeChannel(chPlayers);
    };
  }, [userId]);
  return count;
}

function useUnreadNotificationsCount(userId) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!userId) { setCount(0); return; }
    let cancelled = false;

    const syncCount = async () => {
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

    const applyDeltaFromPayload = (payload) => {
      if (cancelled) return;
      const event = payload?.eventType;
      const next = payload?.new || {};
      const prev = payload?.old || {};
      const nextUnread = next?.read === false;
      const prevHasReadField = Object.prototype.hasOwnProperty.call(prev, 'read');
      const prevUnread = prev?.read === false;

      if (event === 'INSERT') {
        if (nextUnread) setCount((v) => v + 1);
        return;
      }
      if (event === 'UPDATE') {
        if (!prevHasReadField) {
          void syncCount();
          return;
        }
        if (prevUnread === nextUnread) return;
        setCount((v) => Math.max(0, v + (nextUnread ? 1 : -1)));
        return;
      }
      if (event === 'DELETE') {
        if (!prevHasReadField) {
          void syncCount();
          return;
        }
        if (prevUnread) setCount((v) => Math.max(0, v - 1));
      }
    };

    void syncCount();
    const channel = supabase
      .channel('notif-badge-' + userId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: 'user_id=eq.' + userId }, applyDeltaFromPayload)
      .subscribe();

    const syncIfVisible = () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        void syncCount();
      }
    };
    const onVisibilityChange = () => syncIfVisible();
    const intervalId = setInterval(syncIfVisible, 10000);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibilityChange);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', syncIfVisible);
      window.addEventListener('pageshow', syncIfVisible);
      window.addEventListener('online', syncIfVisible);
      window.addEventListener('pm-notifications-sync', syncIfVisible);
    }

    return () => {
      cancelled = true;
      clearInterval(intervalId);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibilityChange);
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', syncIfVisible);
        window.removeEventListener('pageshow', syncIfVisible);
        window.removeEventListener('online', syncIfVisible);
        window.removeEventListener('pm-notifications-sync', syncIfVisible);
      }
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return count;
}

function useUnreadKampeNotificationsCount(userId) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!userId) { setCount(0); return; }
    let cancelled = false;
    let timer = null;
    let inFlight = false;
    let rerunAfterFlight = false;
    let shouldRefreshIds = true;
    let myRelatedMatchIds = [];
    const RELEVANT_TYPES = ['match_chat', 'match_join', 'match_invite', 'match_full', 'result_submitted', 'result_confirmed'];

    const isPageVisible = () => (typeof document === 'undefined' || document.visibilityState === 'visible');
    const scheduleRefetch = (opts = {}) => {
      const { delay = 220, refreshIds = false } = opts;
      if (refreshIds) shouldRefreshIds = true;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { void refetch(); }, delay);
    };

    const loadRelatedMatchIds = async () => {
      try {
        const [createdRes, playerRes] = await Promise.all([
          supabase.from('matches').select('id').eq('creator_id', userId),
          supabase.from('match_players').select('match_id').eq('user_id', userId),
        ]);
        const set = new Set([
          ...(createdRes.data || []).map((m) => String(m.id)),
          ...(playerRes.data || []).map((p) => String(p.match_id)),
        ]);
        myRelatedMatchIds = [...set];
      } catch (e) {
        console.warn('kampe notif badge ids:', e);
        myRelatedMatchIds = [];
      } finally {
        shouldRefreshIds = false;
      }
    };

    const loadCount = async () => {
      try {
        if (myRelatedMatchIds.length === 0) {
          if (!cancelled) setCount(0);
          return;
        }
        const { count: c } = await supabase
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('read', false)
          .in('type', RELEVANT_TYPES)
          .in('match_id', myRelatedMatchIds);
        if (!cancelled) setCount(c || 0);
      } catch (e) {
        console.warn('kampe notif badge refetch:', e);
      }
    };

    const refetch = async () => {
      if (!isPageVisible()) return;
      if (inFlight) {
        rerunAfterFlight = true;
        return;
      }
      inFlight = true;
      try {
        if (shouldRefreshIds) await loadRelatedMatchIds();
        await loadCount();
      } finally {
        inFlight = false;
        if (rerunAfterFlight) {
          rerunAfterFlight = false;
          scheduleRefetch({ delay: 120 });
        }
      }
    };

    const onVisibilityChange = () => {
      if (!isPageVisible()) return;
      scheduleRefetch({ delay: 80, refreshIds: true });
    };

    void refetch();
    const chNotifs = supabase.channel('kampe-notif-badge-notifs-' + userId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: 'user_id=eq.' + userId }, () => scheduleRefetch({ delay: 120 }))
      .subscribe();
    const chMatches = supabase.channel('kampe-notif-badge-matches-' + userId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches', filter: 'creator_id=eq.' + userId }, () => scheduleRefetch({ refreshIds: true, delay: 120 }))
      .subscribe();
    const chPlayers = supabase.channel('kampe-notif-badge-players-' + userId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'match_players', filter: 'user_id=eq.' + userId }, () => scheduleRefetch({ refreshIds: true, delay: 120 }))
      .subscribe();

    const intervalId = setInterval(() => {
      if (isPageVisible()) scheduleRefetch({ delay: 50, refreshIds: true });
    }, 10000);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibilityChange);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', onVisibilityChange);
      window.addEventListener('pageshow', onVisibilityChange);
      window.addEventListener('online', onVisibilityChange);
      window.addEventListener('pm-notifications-sync', onVisibilityChange);
    }

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      clearInterval(intervalId);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibilityChange);
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', onVisibilityChange);
        window.removeEventListener('pageshow', onVisibilityChange);
        window.removeEventListener('online', onVisibilityChange);
        window.removeEventListener('pm-notifications-sync', onVisibilityChange);
      }
      supabase.removeChannel(chNotifs);
      supabase.removeChannel(chMatches);
      supabase.removeChannel(chPlayers);
    };
  }, [userId]);

  return count;
}

const PRIMARY_TAB_IDS = ["hjem", "makkere", "baner", "kampe", "ranking"];
const PROFILE_REFRESH_COOLDOWN_MS = 30_000;

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
  const unreadKampeNotifs = useUnreadKampeNotificationsCount(user?.id);
  const hasKampeAttention = pendingKampe > 0 || unreadKampeNotifs > 0;
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
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackTopic, setFeedbackTopic] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackSending, setFeedbackSending] = useState(false);
  const hasPrefetchedTabsRef = useRef(false);
  const lastProfileRefreshAtRef = useRef(0);
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
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
    const media = window.matchMedia("(max-width: 768px)");
    const onChange = (event) => setIsMobileView(event.matches);
    setIsMobileView(media.matches);
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    }
    media.addListener(onChange);
    return () => media.removeListener(onChange);
  }, []);

  useEffect(() => {
    if (!["hjem", "profil", "ranking", "kampe", "makkere", "admin"].includes(tab)) return;
    const now = Date.now();
    if (lastProfileRefreshAtRef.current && now - lastProfileRefreshAtRef.current < PROFILE_REFRESH_COOLDOWN_MS) return;
    lastProfileRefreshAtRef.current = now;
    refreshProfileQuiet();
  }, [tab, refreshProfileQuiet]);

  useEffect(() => {
    setMoreOpen(false);
    setMobileMoreOpen(false);
    setAccountOpen(false);
  }, [tab]);

  useEffect(() => {
    if (tab !== "beskeder") setMobileConversationOpen(false);
  }, [tab]);

  useEffect(() => {
    if (!feedbackOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape" && !feedbackSending) setFeedbackOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [feedbackOpen, feedbackSending]);

  const openFeedbackModal = useCallback(() => {
    setAccountOpen(false);
    setMobileMoreOpen(false);
    setFeedbackOpen(true);
  }, []);

  const submitFeedbackReport = useCallback(async () => {
    const message = feedbackMessage.trim();
    if (message.length < 10) {
      showToast("Skriv gerne mindst 10 tegn, så vi kan hjælpe bedre.");
      return;
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) {
      showToast("Fejl: mangler Supabase-konfiguration.");
      return;
    }

    setFeedbackSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Du skal være logget ind for at sende en indberetning.");

      const response = await fetch(`${supabaseUrl}/functions/v1/report-feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          topic: feedbackTopic.trim() || null,
          message,
          pageUrl: typeof window !== "undefined" ? window.location.href : null,
          routePath: location.pathname + location.search,
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
          displayName,
          userEmail: authUser?.email || user?.email || null,
          submittedAt: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        let details = "";
        try { details = await response.text(); } catch { /* ignore */ }
        throw new Error(details || "Serveren kunne ikke modtage indberetningen.");
      }

      setFeedbackOpen(false);
      setFeedbackTopic("");
      setFeedbackMessage("");
      showToast("Tak! Din indberetning er sendt.");
    } catch (error) {
      const messageText = error instanceof Error ? error.message : "Kunne ikke sende indberetningen.";
      showToast(messageText);
    } finally {
      setFeedbackSending(false);
    }
  }, [feedbackMessage, feedbackTopic, showToast, location.pathname, location.search, displayName, authUser?.email, user?.email]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    if (hasPrefetchedTabsRef.current) return undefined;
    hasPrefetchedTabsRef.current = true;

    let cancelled = false;
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const effectiveType = connection?.effectiveType || "";
    const isConstrainedNetwork =
      connection?.saveData === true
      || effectiveType === "slow-2g"
      || effectiveType === "2g"
      || effectiveType === "3g";

    const warmTabs = () => {
      if (cancelled) return;
      const loaders = isConstrainedNetwork
        ? [loadKampeTab, loadBeskedTab]
        : [loadKampeTab, loadBeskedTab, loadLigaTab, loadMakkereTab, loadRankingTab];
      if (isAdmin) loaders.push(loadAdminTab);
      loaders.forEach((loader, index) => {
        window.setTimeout(() => {
          if (!cancelled) void loader();
        }, index * 180);
      });
    };

    if (typeof window.requestIdleCallback === "function") {
      const idleId = window.requestIdleCallback(warmTabs, { timeout: 1200 });
      return () => {
        cancelled = true;
        if (typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(idleId);
      };
    }

    const timeoutId = window.setTimeout(warmTabs, 450);
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [isAdmin]);

  const allTabs = [
    { id: "hjem",     label: "Hjem",        icon: <Home          size={15} /> },
    { id: "makkere",  label: "Find Makker",  icon: <Users         size={15} /> },
    { id: "baner",    label: "Book Bane",    icon: <MapPin        size={15} /> },
    { id: "kampe",    label: "Kampe",        icon: <Swords        size={15} />, badge: pendingKampe > 0 ? pendingKampe : null, attention: hasKampeAttention },
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
              overflow: "visible",
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
              onClick={openFeedbackModal}
              style={{ display: "flex", alignItems: "center", gap: "9px", width: "100%", padding: "11px 12px", border: "none", borderBottom: "1px solid " + theme.border, background: "transparent", color: theme.text, fontWeight: 600, fontSize: "13px", cursor: "pointer", textAlign: "left", fontFamily: font }}
            >
              <Bug size={15} />
              Rapportér fejl
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
        {primaryTabs.map(t => {
          const active = tab === t.id;
          const tabAttention = Boolean(t.attention && !active);
          return (
          <button key={t.id} type="button" title={t.label} aria-label={t.label} onClick={() => setTab(t.id)} style={tabBtnStyle(active)}>
            <span aria-hidden style={{ display: "flex", position: "relative" }}>
              {t.icon}
              {t.badge && (
                <span style={{ position: "absolute", top: "-5px", right: "-6px", background: theme.red, color: "#fff", borderRadius: "10px", fontSize: "9px", fontWeight: 800, padding: "1px 4px", lineHeight: 1.2 }}>
                  {t.badge > 9 ? "9+" : t.badge}
                </span>
              )}
              {!t.badge && tabAttention && (
                <span style={{ position: "absolute", top: "-3px", right: "-5px", width: "8px", height: "8px", borderRadius: "50%", background: theme.red }} />
              )}
            </span>
            <span className="pm-tab-label">{t.label}</span>
          </button>
        );})}

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

      {feedbackOpen && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Rapportér fejl"
          onMouseDown={() => {
            if (!feedbackSending) setFeedbackOpen(false);
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.35)",
            zIndex: 10020,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
        >
          <div
            onMouseDown={(event) => event.stopPropagation()}
            style={{
              width: "min(560px, 100%)",
              background: theme.surface,
              border: "1px solid " + theme.border,
              borderRadius: "14px",
              boxShadow: "0 12px 40px rgba(0,0,0,0.22)",
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "14px 16px", borderBottom: "1px solid " + theme.border }}>
              <div style={{ fontSize: "17px", fontWeight: 800, color: theme.text }}>Rapportér fejl</div>
              <div style={{ marginTop: "4px", fontSize: "12px", color: theme.textMid }}>
                Beskriv bug eller problem — vi sender den direkte til kontakt@padelmakker.dk.
              </div>
            </div>
            <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: "10px" }}>
              <input
                type="text"
                value={feedbackTopic}
                onChange={(event) => setFeedbackTopic(event.target.value.slice(0, 120))}
                placeholder="Kort titel (valgfri)"
                disabled={feedbackSending}
                style={{
                  width: "100%",
                  border: "1px solid " + theme.border,
                  borderRadius: "10px",
                  padding: "10px 12px",
                  fontSize: "13px",
                  fontFamily: font,
                  color: theme.text,
                  background: theme.surface,
                  outline: "none",
                }}
              />
              <textarea
                value={feedbackMessage}
                onChange={(event) => setFeedbackMessage(event.target.value.slice(0, 3000))}
                placeholder="Hvad gik galt, og hvordan kan vi genskabe det?"
                disabled={feedbackSending}
                rows={6}
                style={{
                  width: "100%",
                  resize: "vertical",
                  border: "1px solid " + theme.border,
                  borderRadius: "10px",
                  padding: "10px 12px",
                  fontSize: "13px",
                  lineHeight: 1.5,
                  fontFamily: font,
                  color: theme.text,
                  background: theme.surface,
                  outline: "none",
                  minHeight: "140px",
                }}
              />
              <div style={{ fontSize: "11px", color: theme.textLight, textAlign: "right" }}>
                {feedbackMessage.trim().length}/3000
              </div>
            </div>
            <div style={{ padding: "12px 16px", borderTop: "1px solid " + theme.border, display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button
                type="button"
                onClick={() => setFeedbackOpen(false)}
                disabled={feedbackSending}
                style={{
                  ...btn(false),
                  minHeight: "34px",
                  fontSize: "12px",
                  padding: "7px 12px",
                  opacity: feedbackSending ? 0.6 : 1,
                }}
              >
                Annuller
              </button>
              <button
                type="button"
                onClick={() => { void submitFeedbackReport(); }}
                disabled={feedbackSending || feedbackMessage.trim().length < 10}
                style={{
                  ...btn(true),
                  minHeight: "34px",
                  fontSize: "12px",
                  padding: "7px 12px",
                  opacity: (feedbackSending || feedbackMessage.trim().length < 10) ? 0.6 : 1,
                  cursor: (feedbackSending || feedbackMessage.trim().length < 10) ? "not-allowed" : "pointer",
                }}
              >
                {feedbackSending ? "Sender..." : "Send indberetning"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

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
            className="pm-mobile-more-row"
            onClick={openFeedbackModal}
          >
            <span style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <Bug size={16} />
              Rapportér fejl
            </span>
          </button>
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
          const tabAttention = Boolean(t.attention && !active);
          const mobileTabColor = active ? theme.accent : theme.textMid;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className="pm-mobile-bottom-btn"
              aria-label={t.label}
              title={t.label}
            >
              <span className="pm-mobile-bottom-icon-wrap" style={{ color: mobileTabColor }}>
                {t.icon}
                {t.badge && (
                  <span className="pm-mobile-bottom-badge">
                    {t.badge > 9 ? "9+" : t.badge}
                  </span>
                )}
                {!t.badge && tabAttention && (
                  <span style={{ position: "absolute", top: "-3px", right: "-4px", width: "8px", height: "8px", borderRadius: "50%", background: theme.red }} />
                )}
              </span>
              <span
                className="pm-mobile-bottom-label"
                style={{ color: mobileTabColor, fontWeight: active ? 700 : 500 }}
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

