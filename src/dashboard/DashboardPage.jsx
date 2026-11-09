import { useEffect, useCallback, useState, useRef, useMemo, lazy, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { AppModal } from '../components/AppModal';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { useConfirm } from '../lib/ConfirmDialogProvider';
import { font, theme, btn } from '../lib/platformTheme';
import { resolveDisplayName } from '../lib/platformUtils';
import { formatPlaytomicLevel } from '../lib/padelLevelUtils';
import { Home, Users, Swords, Settings, LogOut, ChevronDown, MoreHorizontal, Bug, Compass, Sun, Moon, ExternalLink } from 'lucide-react';
import { NotificationBell } from '../components/NotificationBell';

const loadHomeTab = () => import('./HomeTab');
const HomeTabLazy = lazy(() => loadHomeTab().then((m) => ({ default: m.HomeTab })));
import { ShieldCheck } from 'lucide-react';
import { MereTab } from './MereTab';
import { SpilChooser } from '../components/SpilChooser';
import '../styles/mere.css';
import { useUnreadMessageCount } from '../lib/chatUtils';
import { useDarkMode } from '../lib/useDarkMode';
import { supabase } from '../lib/supabase';
import { PROFILE_REFRESH_COOLDOWN_MS } from '../lib/platformConstants';
import { AdminPinGate } from '../components/AdminPinGate';
import { GuidedTourOverlay } from '../components/GuidedTourOverlay';
import { WelcomeScreen } from '../components/WelcomeScreen';
import { PendingResultConfirmModal } from '../components/PendingResultConfirmModal';
import { CityRequiredModal } from '../components/CityRequiredModal';
import { isValidCityPlace } from '../lib/dawaPlaceSearch';
import { filterConfirmablePendingResults } from '../lib/resolvePadelMatchResult';
import {
  adminAttentionFocusSubTab,
  adminAttentionTotal,
  fetchAdminSubTabBadges,
} from '../lib/userModeration';
import { subscribeToPush, isPushSupported } from '../lib/pushNotifications';
import { useAdminPinSession } from '../lib/useAdminPinSession';
import { BADGE_POLL_VISIBLE_MS, usePageVisible } from '../lib/pageVisibility';
import {
  scrollDashboardToTop,
  shouldScrollDashboardToTopOnTabReselect,
} from '../lib/dashboardScroll';
import { parseDashboardTab, isKampeDetailRoute } from '../lib/kampeDetailRoutes';

const loadMakkereTab = () => import('./MakkereTab');
const loadBanerTab = () => import('./BanerTab');
const loadKampeTab = () => import('./KampeTab');
const loadRankingTab = () => import('./RankingTab');
const loadProfilTab = () => import('./ProfilTab');
const loadMatchSearchFilterPage = () => import('./MatchSearchFilterPage');
const loadMakkerSearchFilterPage = () => import('./MakkerSearchFilterPage');
const loadAdminTab = () => import('./AdminTab');
const loadBeskedTab = () => import('./BeskedTab');
const loadNotifikationerPage = () => import('../pages/NotifikationerPage');
const MakkereTabLazy = lazy(() => loadMakkereTab().then((m) => ({ default: m.MakkereTab })));
const BanerTabLazy = lazy(() => loadBanerTab().then((m) => ({ default: m.BanerTab })));
const KampeTabLazy = lazy(() => loadKampeTab().then((m) => ({ default: m.KampeTab })));
const RankingTabLazy = lazy(() => loadRankingTab().then((m) => ({ default: m.RankingTab })));
const ProfilTabLazy = lazy(() => loadProfilTab().then((m) => ({ default: m.ProfilTab })));
const MatchSearchFilterPageLazy = lazy(() => loadMatchSearchFilterPage().then((m) => ({ default: m.MatchSearchFilterPage })));
const MakkerSearchFilterPageLazy = lazy(() => loadMakkerSearchFilterPage().then((m) => ({ default: m.MakkerSearchFilterPage })));
const AdminTabLazy = lazy(() => loadAdminTab().then((m) => ({ default: m.AdminTab })));
const BeskedTabLazy = lazy(() => loadBeskedTab().then((m) => ({ default: m.BeskedTab })));
const NotifikationerPageLazy = lazy(() => loadNotifikationerPage().then((m) => ({ default: m.NotifikationerPage })));

const FEEDBACK_DEFAULT_CATEGORY = "bug";
const FEEDBACK_DEFAULT_PRIORITY = "normal";

const FEEDBACK_CATEGORY_OPTIONS = [
  { value: "bug", label: "Fejl" },
  { value: "performance", label: "Ydeevne" },
  { value: "ui", label: "Udseende / brug" },
  { value: "match-chat", label: "Kamp-chat" },
  { value: "notifications", label: "Notifikationer" },
  { value: "other", label: "Andet" },
];

const FEEDBACK_PRIORITY_OPTIONS = [
  { value: "low", label: "Lav" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "Høj" },
  { value: "critical", label: "Kritisk" },
];

function useRealtimeCount(userId, createController) {
  const [count, setCount] = useState(0);
  const pageVisible = usePageVisible();

  useEffect(() => {
    if (!userId) {
      setCount(0);
      return undefined;
    }
    if (!pageVisible) {
      return undefined;
    }

    let cancelled = false;
    let timer = null;
    let intervalId = null;
    let inFlight = false;
    let rerunAfterFlight = false;
    const channels = [];
    const removeFns = [];

    const setCountSafe = (next) => {
      if (cancelled) return;
      setCount((prev) => (typeof next === "function" ? next(prev) : next));
    };

    const isPageVisible = () => (typeof document === "undefined" || document.visibilityState === "visible");

    const api = {
      userId,
      setCountSafe,
      isPageVisible,
      scheduleRefetch: () => {},
    };

    const controller = createController(api) || {};
    const skipWhenHidden = controller.skipWhenHidden !== false;
    const rerunDelay = controller.rerunDelay ?? 120;
    const refetchImpl = controller.refetch || (async () => {});

    const refetch = async () => {
      if (skipWhenHidden && !isPageVisible()) return;
      if (inFlight) {
        rerunAfterFlight = true;
        return;
      }
      inFlight = true;
      try {
        await refetchImpl(api);
      } finally {
        inFlight = false;
        if (rerunAfterFlight) {
          rerunAfterFlight = false;
          api.scheduleRefetch({ delay: rerunDelay });
        }
      }
    };

    api.scheduleRefetch = ({ delay = 120 } = {}) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void refetch();
      }, delay);
    };

    if (controller.runOnMount !== false) {
      void refetch();
    }

    if (Array.isArray(controller.subscriptions)) {
      controller.subscriptions.forEach((sub) => {
        const channel = supabase
          .channel(sub.name)
          .on(
            "postgres_changes",
            {
              event: sub.event || "*",
              schema: sub.schema || "public",
              table: sub.table,
              ...(sub.filter ? { filter: sub.filter } : {}),
            },
            (payload) => {
              if (typeof sub.onEvent === "function") {
                sub.onEvent({ payload, api });
                return;
              }
              api.scheduleRefetch(sub.schedule || {});
            }
          )
          .subscribe();
        channels.push(channel);
      });
    }

    if (controller.intervalMs) {
      intervalId = setInterval(() => {
        if (typeof controller.onInterval === "function") {
          controller.onInterval(api);
          return;
        }
        api.scheduleRefetch({ delay: 50 });
      }, controller.intervalMs);
    }

    if (controller.listenVisibility && typeof document !== "undefined") {
      const onVisibilityChange = () => {
        if (typeof controller.onVisibility === "function") {
          controller.onVisibility(api);
          return;
        }
        if (!isPageVisible()) return;
        api.scheduleRefetch({ delay: 80 });
      };
      document.addEventListener("visibilitychange", onVisibilityChange);
      removeFns.push(() => document.removeEventListener("visibilitychange", onVisibilityChange));
    }

    if (Array.isArray(controller.windowEvents) && controller.windowEvents.length > 0 && typeof window !== "undefined") {
      const onWindowEvent = () => {
        if (typeof controller.onWindowEvent === "function") {
          controller.onWindowEvent(api);
          return;
        }
        if (!isPageVisible()) return;
        api.scheduleRefetch({ delay: 80 });
      };
      controller.windowEvents.forEach((eventName) => {
        window.addEventListener(eventName, onWindowEvent);
      });
      removeFns.push(() => {
        controller.windowEvents.forEach((eventName) => {
          window.removeEventListener(eventName, onWindowEvent);
        });
      });
    }

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (intervalId) clearInterval(intervalId);
      removeFns.forEach((fn) => fn());
      channels.forEach((channel) => {
        supabase.removeChannel(channel);
      });
      if (typeof controller.cleanup === "function") {
        controller.cleanup();
      }
    };
  }, [userId, pageVisible, createController]);

  return count;
}

function usePendingLigaInvites(userId) {
  const createController = useCallback((api) => ({
    refetch: async () => {
      try {
        const { count: c } = await supabase
          .from("league_teams")
          .select("id", { count: "exact", head: true })
          .eq("player2_id", api.userId)
          .eq("status", "pending");
        api.setCountSafe(c || 0);
      } catch (e) {
        console.warn("liga invites badge:", e);
      }
    },
    subscriptions: [
      {
        name: "liga-invites-" + api.userId,
        table: "league_teams",
        filter: "player2_id=eq." + api.userId,
        onEvent: ({ payload, api: runtime }) => {
          const event = payload?.eventType;
          const next = payload?.new || {};
          const prev = payload?.old || {};
          const nextPending = next?.status === "pending";
          const prevPending = prev?.status === "pending";

          if (event === "INSERT") {
            if (nextPending) runtime.setCountSafe((v) => v + 1);
            return;
          }
          if (event === "UPDATE") {
            if (prevPending === nextPending) return;
            runtime.setCountSafe((v) => Math.max(0, v + (nextPending ? 1 : -1)));
            return;
          }
          if (event === "DELETE" && prevPending) {
            runtime.setCountSafe((v) => Math.max(0, v - 1));
          }
        },
      },
    ],
  }), []);

  return useRealtimeCount(userId, createController);
}

function usePendingKampeBadge(userId, isAdmin = false) {
  const createController = useCallback((api) => {
    let myCreatedMatchIds = [];
    let myPlayerMatchIds = [];
    let shouldRefreshIds = true;

    const loadIds = async () => {
      try {
        const [myMatchesRes, myPlayerRes] = await Promise.all([
          supabase.from("matches").select("id").eq("creator_id", api.userId),
          supabase.from("match_players").select("match_id").eq("user_id", api.userId),
        ]);
        myCreatedMatchIds = (myMatchesRes.data || []).map((m) => m.id);
        myPlayerMatchIds = [...new Set((myPlayerRes.data || []).map((p) => p.match_id))];
        shouldRefreshIds = false;
      } catch (e) {
        console.warn("kampe badge ids:", e);
      }
    };

    const loadCounts = async () => {
      try {
        const [joinRes, resultRowsRes] = await Promise.all([
          myCreatedMatchIds.length > 0
            ? supabase.from("match_join_requests").select("id", { count: "exact", head: true }).in("match_id", myCreatedMatchIds).eq("status", "pending")
            : { count: 0 },
          myPlayerMatchIds.length > 0
            ? supabase.from("match_results").select("id, match_id, submitted_by").in("match_id", myPlayerMatchIds).eq("confirmed", false).neq("submitted_by", api.userId)
            : { data: [] },
        ]);
        const resultRows = resultRowsRes.data || [];
        const resultMatchIds = [...new Set(resultRows.map((r) => r.match_id).filter(Boolean))];
        let confirmableResultCount = 0;

        if (resultMatchIds.length > 0) {
          const { data: playerRows, error: playersErr } = await supabase
            .from("match_players")
            .select("match_id, user_id, team")
            .in("match_id", resultMatchIds);
          if (playersErr) throw playersErr;

          const playersByMatchId = {};
          (playerRows || []).forEach((p) => {
            if (!p.match_id) return;
            if (!playersByMatchId[p.match_id]) playersByMatchId[p.match_id] = [];
            playersByMatchId[p.match_id].push(p);
          });

          confirmableResultCount = filterConfirmablePendingResults({
            results: resultRows,
            playersByMatchId,
            userId: api.userId,
            isAdmin,
          }).length;
        }

        api.setCountSafe((joinRes.count || 0) + confirmableResultCount);
      } catch (e) {
        console.warn("kampe badge counts:", e);
      }
    };

    return {
      refetch: async () => {
        if (shouldRefreshIds) await loadIds();
        await loadCounts();
      },
      subscriptions: [
        {
          name: "kampe-badge-matches-" + api.userId,
          table: "matches",
          filter: "creator_id=eq." + api.userId,
          onEvent: ({ api: runtime }) => {
            shouldRefreshIds = true;
            runtime.scheduleRefetch({ delay: 120 });
          },
        },
        {
          name: "kampe-badge-players-" + api.userId,
          table: "match_players",
          filter: "user_id=eq." + api.userId,
          onEvent: ({ api: runtime }) => {
            shouldRefreshIds = true;
            runtime.scheduleRefetch({ delay: 120 });
          },
        },
      ],
      intervalMs: BADGE_POLL_VISIBLE_MS,
      onInterval: (runtime) => {
        if (runtime.isPageVisible()) runtime.scheduleRefetch({ delay: 50 });
      },
      listenVisibility: true,
      onVisibility: (runtime) => {
        if (!runtime.isPageVisible()) return;
        runtime.scheduleRefetch({ delay: 80 });
      },
    };
  }, [isAdmin]);

  return useRealtimeCount(userId, createController);
}

function useAdminAttentionBadge(userId, isAdminRole = false) {
  const createController = useCallback((api) => {
    if (!isAdminRole || !api.userId) {
      return {
        refetch: async () => {
          api.setCountSafe(0);
        },
      };
    }

    const syncCount = async () => {
      try {
        const badges = await fetchAdminSubTabBadges(api.userId);
        api.setCountSafe(adminAttentionTotal(badges));
      } catch (e) {
        console.warn('admin attention badge:', e);
      }
    };

    return {
      refetch: syncCount,
      subscriptions: [
        {
          name: 'admin-attn-reports-' + api.userId,
          table: 'user_reports',
          onEvent: ({ api: runtime }) => {
            runtime.scheduleRefetch({ delay: 120 });
          },
        },
        {
          name: 'admin-attn-flags-' + api.userId,
          table: 'rating_admin_flags',
          onEvent: ({ api: runtime }) => {
            runtime.scheduleRefetch({ delay: 120 });
          },
        },
        {
          name: 'admin-attn-results-' + api.userId,
          table: 'match_results',
          onEvent: ({ api: runtime }) => {
            runtime.scheduleRefetch({ delay: 120 });
          },
        },
        {
          name: 'admin-attn-result-errors-' + api.userId,
          table: 'result_error_reports',
          onEvent: ({ api: runtime }) => {
            runtime.scheduleRefetch({ delay: 120 });
          },
        },
        {
          name: 'admin-attn-notif-' + api.userId,
          table: 'notifications',
          filter: 'user_id=eq.' + api.userId,
          onEvent: ({ api: runtime }) => {
            runtime.scheduleRefetch({ delay: 120 });
          },
        },
      ],
      intervalMs: BADGE_POLL_VISIBLE_MS,
      onInterval: (runtime) => {
        if (runtime.isPageVisible()) runtime.scheduleRefetch({ delay: 50 });
      },
      listenVisibility: true,
      onVisibility: (runtime) => {
        if (!runtime.isPageVisible()) return;
        runtime.scheduleRefetch({ delay: 80 });
      },
    };
  }, [isAdminRole]);

  return useRealtimeCount(userId, createController);
}

function useUnreadNotificationsCount(userId) {
  const createController = useCallback((api) => {
    const syncCount = async () => {
      try {
        const { count: c } = await supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("user_id", api.userId)
          .eq("read", false);
        api.setCountSafe(c || 0);
      } catch (e) {
        console.warn("notif badge refetch:", e);
      }
    };

    return {
      refetch: syncCount,
      subscriptions: [
        {
          name: "notif-badge-" + api.userId,
          table: "notifications",
          filter: "user_id=eq." + api.userId,
          onEvent: ({ payload, api: runtime }) => {
            const event = payload?.eventType;
            const next = payload?.new || {};
            const prev = payload?.old || {};
            const nextUnread = next?.read === false;
            const prevHasReadField = Object.prototype.hasOwnProperty.call(prev, "read");
            const prevUnread = prev?.read === false;

            if (event === "INSERT") {
              if (nextUnread) runtime.setCountSafe((v) => v + 1);
              return;
            }
            if (event === "UPDATE") {
              if (!prevHasReadField) {
                runtime.scheduleRefetch({ delay: 80 });
                return;
              }
              if (prevUnread === nextUnread) return;
              runtime.setCountSafe((v) => Math.max(0, v + (nextUnread ? 1 : -1)));
              return;
            }
            if (event === "DELETE") {
              if (!prevHasReadField) {
                runtime.scheduleRefetch({ delay: 80 });
                return;
              }
              if (prevUnread) runtime.setCountSafe((v) => Math.max(0, v - 1));
            }
          },
        },
      ],
      intervalMs: 10000,
      onInterval: (runtime) => {
        if (runtime.isPageVisible()) runtime.scheduleRefetch({ delay: 50 });
      },
      listenVisibility: true,
      onVisibility: (runtime) => {
        if (!runtime.isPageVisible()) return;
        runtime.scheduleRefetch({ delay: 80 });
      },
      windowEvents: ["focus", "pageshow", "online", "pm-notifications-sync"],
      onWindowEvent: (runtime) => {
        if (!runtime.isPageVisible()) return;
        runtime.scheduleRefetch({ delay: 80 });
      },
    };
  }, []);

  return useRealtimeCount(userId, createController);
}

function useUnreadKampeNotificationsCount(userId) {
  const createController = useCallback((api) => {
    // Tællingen lå tidligere her i klienten: fem opslag for at finde brugerens
    // kampe, ligaer og turneringer, et chunked opslag for kampstatus og to
    // opslag i notifications — hvert 10. sekund. Den samme logik ligger nu i
    // RPC'en kampe_unread_badge_count og koster ét kald.
    const loadCount = async () => {
      try {
        const { data, error } = await supabase.rpc("kampe_unread_badge_count");
        if (error) throw error;
        api.setCountSafe(Number(data) || 0);
      } catch (e) {
        console.warn("kampe notif badge refetch:", e);
      }
    };

    return {
      refetch: loadCount,
      subscriptions: [
        {
          name: "kampe-notif-badge-notifs-" + api.userId,
          table: "notifications",
          filter: "user_id=eq." + api.userId,
          onEvent: ({ api: runtime }) => {
            runtime.scheduleRefetch({ delay: 120 });
          },
        },
        {
          name: "kampe-notif-badge-matches-" + api.userId,
          table: "matches",
          filter: "creator_id=eq." + api.userId,
          onEvent: ({ api: runtime }) => {
            runtime.scheduleRefetch({ delay: 120 });
          },
        },
        {
          name: "kampe-notif-badge-players-" + api.userId,
          table: "match_players",
          filter: "user_id=eq." + api.userId,
          onEvent: ({ api: runtime }) => {
            runtime.scheduleRefetch({ delay: 120 });
          },
        },
      ],
      // Realtime dækker de faktiske hændelser; intervallet er kun et sikkerhedsnet.
      intervalMs: BADGE_POLL_VISIBLE_MS,
      onInterval: (runtime) => {
        if (!runtime.isPageVisible()) return;
        runtime.scheduleRefetch({ delay: 50 });
      },
      listenVisibility: true,
      onVisibility: (runtime) => {
        if (!runtime.isPageVisible()) return;
        runtime.scheduleRefetch({ delay: 80 });
      },
      windowEvents: ["focus", "pageshow", "online", "pm-notifications-sync"],
      onWindowEvent: (runtime) => {
        if (!runtime.isPageVisible()) return;
        runtime.scheduleRefetch({ delay: 80 });
      },
    };
  }, []);

  return useRealtimeCount(userId, createController);
}

const TOUR_VERSION = 4;
const SCROLL_RETRY_MAX = 40;
const SCROLL_START_SETTLE_RETRIES = 16;

function scrollTourTarget(target, step, attempts) {
  if (step.scrollBlock === 'start') {
    const header = document.querySelector('.pm-dash-header');
    const headerH = header?.getBoundingClientRect().height ?? 88;
    const top = target.getBoundingClientRect().top + window.scrollY - headerH - 8;
    window.scrollTo({
      top: Math.max(0, top),
      behavior: attempts === 0 ? 'smooth' : 'auto',
    });
    return;
  }
  target.scrollIntoView({
    behavior: attempts === 0 ? 'smooth' : 'auto',
    block: step.scrollBlock || 'center',
    inline: 'nearest',
  });
}

const tabBtnStyle = (active) => ({
  background: "transparent",
  color: active ? theme.accent : theme.textMid,
  border: "none",
  marginBottom: "-1px",
  padding: "8px 10px 11px",
  fontSize: "clamp(11px,2.8vw,12px)",
  fontWeight: active ? 800 : 500,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: "5px",
  whiteSpace: "nowrap",
  fontFamily: font,
  flexShrink: 0,
  transition: "color 0.18s ease, background-color 0.18s ease",
  letterSpacing: "-0.01em",
  position: "relative",
});

const accountMenuRowBtnStyle = ({ isDanger = false, isLast = false } = {}) => ({
  ...btn(false, { size: 'sm', fontWeight: isDanger ? 700 : 600 }),
  width: "100%",
  justifyContent: "flex-start",
  border: "none",
  borderBottom: isLast ? "none" : "1px solid " + theme.border,
  borderRadius: 0,
  background: "transparent",
  boxShadow: "none",
  color: isDanger ? theme.dangerStrong : theme.text,
  fontSize: "13px",
  padding: "11px 12px",
  textAlign: "left",
  fontFamily: font,
});

// Konstant - uden for komponenten, saa listen ikke genskabes ved hver
// rendering og kan staa i rute-effektens afhaengigheder.
const VALID_TABS = ["hjem", "makkere", "baner", "kampe", "ranking", "liga", "beskeder", "profil", "mere", "kamp-filter", "makker-filter", "admin", "notifikationer"];

export function DashboardPage({ user, onLogout, showToast }) {
  const { user: authUser, refreshProfileQuiet, updateProfile } = useAuth();
  const ask = useConfirm();
  const displayName = resolveDisplayName(user, authUser);
  const navigate = useNavigate();
  const location = useLocation();
  const isAdmin = user?.role === 'admin';
  const { adminPinVerified } = useAdminPinSession(isAdmin);
  const adminCanConfirmResults = isAdmin && adminPinVerified;
  const unreadMessages = useUnreadMessageCount(user?.id);
  const pendingLigaInvites = usePendingLigaInvites(user?.id);
  const pendingKampe = usePendingKampeBadge(user?.id, adminCanConfirmResults);
  const adminAttentionCount = useAdminAttentionBadge(user?.id, isAdmin);
  const [adminInitialSubTab, setAdminInitialSubTab] = useState(null);
  const unreadNotifs = useUnreadNotificationsCount(user?.id);
  const unreadKampeNotifs = useUnreadKampeNotificationsCount(user?.id);
  const hasKampeAttention = pendingKampe > 0 || unreadKampeNotifs > 0 || pendingLigaInvites > 0;
  const kampeTabBadge =
    pendingKampe + pendingLigaInvites > 0 ? pendingKampe + pendingLigaInvites : null;
  const pathTab = parseDashboardTab(location.pathname);
  const tab = VALID_TABS.includes(pathTab) ? pathTab : "hjem";
  const setTab = useCallback((tabId, opts = {}) => {
    const raw = opts.search != null ? String(opts.search) : "";
    const q = raw ? (raw.startsWith("?") ? raw : `?${raw}`) : "";
    navigate(`/dashboard/${tabId}${q}`, opts.state != null ? { state: opts.state } : undefined);
  }, [navigate]);

  useEffect(() => {
    if (pathTab === "liga") {
      navigate("/dashboard/kampe?format=liga", { replace: true });
      return;
    }
    if (!VALID_TABS.includes(pathTab)) {
      navigate("/dashboard/hjem", { replace: true });
    }
  }, [pathTab, navigate]);

  const [dark, setDark] = useDarkMode();
  const [accountOpen, setAccountOpen] = useState(false);
  const [spilChooserOpen, setSpilChooserOpen] = useState(false);
  const [accountPos, setAccountPos] = useState(null);
  const [isMobileView, setIsMobileView] = useState(() => (typeof window !== "undefined" ? window.innerWidth <= 768 : false));
  const [mobileConversationOpen, setMobileConversationOpen] = useState(false);
  const [kampeCreatePanelOpen, setKampeCreatePanelOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackCategory, setFeedbackCategory] = useState(FEEDBACK_DEFAULT_CATEGORY);
  const [feedbackPriority, setFeedbackPriority] = useState(FEEDBACK_DEFAULT_PRIORITY);
  const [feedbackTopic, setFeedbackTopic] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackSending, setFeedbackSending] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [tourStepIndex, setTourStepIndex] = useState(0);
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [adminPinUnlocked, setAdminPinUnlocked] = useState(false);
  const hasPrefetchedTabsRef = useRef(false);
  const lastProfileRefreshAtRef = useRef(0);
  const lastNonAdminTabRef = useRef(tab !== "admin" ? tab : "hjem");
  const wasInAdminTabRef = useRef(false);
  const hasAutoStartedTourRef = useRef(false);
  const accountBtnRef = useRef(null);
  const accountDropRef = useRef(null);
  const tourStorageKey = user?.id ? `pm_dash_tour_v${TOUR_VERSION}_done_${user.id}` : null;
  const welcomeStorageKey = user?.id ? `pm_dash_welcome_v1_${user.id}` : null;

  // Kører velkomst eller rundvisning i dette besøg, venter "Aktiv søgning"-vinduet
  // til næste besøg, så nye brugere ikke får flere vinduer oven i hinanden.
  const onboardingThisVisit = useMemo(() => {
    if (!tourStorageKey) return true;
    try {
      return localStorage.getItem(tourStorageKey) !== '1';
    } catch {
      return false;
    }
  }, [tourStorageKey]);

  const tabTourSelector = useCallback((tabId) => {
    return isMobileView ? `[data-tour="mobile-tab-${tabId}"]` : `[data-tour="tab-${tabId}"]`;
  }, [isMobileView]);

  const tourSteps = useMemo(() => {
    const base = [
      {
        id: 'intro',
        title: 'Velkommen til PadelMakker',
        description: 'Denne korte guide viser de vigtigste funktioner, så du hurtigt kan finde makkere, tilmelde dig kampe og følge din udvikling.',
      },
      {
        id: 'push-notifications',
        title: 'Hold dig opdateret',
        description: 'Tryk Næste for at aktivere push-notifikationer – du får besked om resultater, kampe og makker-svar selv når appen er lukket. Du kan til enhver tid slå dem til eller fra igen.',
      },
      {
        id: 'notification-bell',
        selector: isMobileView ? '[data-tour="notification-panel"]' : '[data-tour="account-menu-btn"]',
        interactive: isMobileView,
        title: 'Notifikationer & push-indstillinger',
        description: isMobileView
          ? 'Klokken er åben. Tryk Aktiver i panelet (browseren kan bede om tilladelse). Du kan altid finde notifikationer i klokken bagefter.'
          : 'Åbn konto-menuen øverst til højre – der finder du alle dine notifikationer og kan slå push-beskeder til og fra når som helst.',
      },
      {
        id: 'home',
        tab: 'hjem',
        selector: tabTourSelector('hjem'),
        title: 'Hjem-overblik',
        description: 'Her får du et samlet overblik over aktivitet, forslag og det vigtigste der sker lige nu.',
      },
      {
        id: 'quick-action',
        tab: 'hjem',
        selector: '[data-tour="quick-action-makkere"]',
        title: 'Genveje',
        description: 'Herfra finder du hurtigt en makker eller en ledig bane. Åbne kampe på dit niveau står lige ovenover, når der er nogen.',
      },
      {
        id: 'latest-activity',
        tab: 'hjem',
        selector: '[data-tour="home-latest-activity"]',
        scrollBlock: 'start',
        clampHighlight: true,
        tooltipPlacement: 'below',
        title: 'Seneste aktivitet',
        description: 'Her kan nye brugere hurtigt se hvad der rører sig: nye kampe, ELO-ændringer og relevante events i fællesskabet.',
      },
      {
        id: 'makkere',
        tab: 'makkere',
        selector: tabTourSelector('makkere'),
        title: 'Find makker',
        description: 'Her finder du spillere, der matcher niveau og område, så du hurtigere får sat en kamp op.',
      },
      {
        id: 'spil',
        selector: tabTourSelector('spil'),
        title: 'Spil',
        description: 'Den store Spil-knap: vælg selv, om du vil oprette en 2v2-kamp, en Americano/Mexicano eller en liga.',
      },
      {
        id: 'kampe',
        tab: 'kampe',
        selector: tabTourSelector('kampe'),
        title: 'Kampe',
        description:
          'I Kampe opretter du 2v2-kampe, Americano/Mexicano og liga — her tilmelder du dig, ser invitationer og håndterer resultater.',
      },
    ];

    if (isMobileView) {
      base.push({
        id: 'mere',
        tab: 'mere',
        selector: tabTourSelector('mere'),
        title: 'Mere',
        description: 'Under Mere finder du Beskeder, Rangliste, Baner, Liga, Americano, din profil og indstillinger.',
      });

      base.push({
        id: 'profile',
        tab: 'profil',
        selector: '[data-tour="profile-main"]',
        scrollBlock: 'start',
        clampHighlight: true,
        waitForMount: true,
        title: 'Din profil',
        description: 'Her opdaterer du profil, følger ELO-udvikling og styrer dine personlige præferencer. Det er dit vigtigste udgangspunkt i appen.',
      });
    } else {
      base.push(
        {
          id: 'mere',
          tab: 'mere',
          selector: tabTourSelector('mere'),
          title: 'Mere',
          description: 'Under Mere finder du Beskeder, Rangliste, Baner, Liga, Americano, din profil og indstillinger.',
        },
        {
          id: 'account-menu',
          selector: '[data-tour="account-menu-dropdown"]',
          openAccountMenu: true,
          title: 'Konto-menu',
          description: 'Dropdown-menuen samler de vigtigste hurtige handlinger: Min profil, Start guide, Rapportér fejl og Log ud.',
        },
        {
          id: 'profile',
          tab: 'profil',
          selector: '[data-tour="profile-main"]',
          scrollBlock: 'start',
          clampHighlight: true,
          waitForMount: true,
          title: 'Din profil',
          description: 'Her opdaterer du profil, følger ELO-udvikling og styrer dine personlige præferencer. Det er dit vigtigste udgangspunkt i appen.',
        }
      );
    }

    return base;
  }, [isMobileView, tabTourSelector]);


  const tourOnNotificationStep =
    tourOpen && tourSteps[tourStepIndex]?.id === 'notification-bell';


  const persistTourCompleted = useCallback(() => {
    if (!tourStorageKey) return;
    try {
      localStorage.setItem(tourStorageKey, '1');
    } catch {
      // ignore storage errors
    }
  }, [tourStorageKey]);

  const startTour = useCallback(() => {
    if (typeof window !== 'undefined') {
      setIsMobileView(window.innerWidth <= 768);
    }
    setAccountOpen(false);
    setTourStepIndex(0);
    setTourOpen(true);
  }, []);

  const markWelcomeSeen = useCallback(() => {
    try { if (welcomeStorageKey) localStorage.setItem(welcomeStorageKey, '1'); } catch { /* ignore */ }
  }, [welcomeStorageKey]);

  // Luk Velkommen. Hvis brugeren ikke valgte rundturen, markeres turen også som
  // set, så den ikke popper op bagefter (undgå dobbelt-onboarding).
  const dismissWelcome = useCallback((markTourDone = true) => {
    markWelcomeSeen();
    if (markTourDone) {
      try { if (tourStorageKey) localStorage.setItem(tourStorageKey, '1'); } catch { /* ignore */ }
    }
    setWelcomeOpen(false);
  }, [markWelcomeSeen, tourStorageKey]);

  const closeTour = useCallback((withToastMessage) => {
    persistTourCompleted();
    setTourOpen(false);
    setTourStepIndex(0);
    setAccountOpen(false);
    if (withToastMessage) showToast(withToastMessage);
  }, [persistTourCompleted, showToast]);

  const handleTourBack = useCallback(() => {
    setTourStepIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const handleTourNext = useCallback(() => {
    if (tourSteps[tourStepIndex]?.id === 'push-notifications' && user?.id && isPushSupported()) {
      subscribeToPush(user.id).catch(() => {});
    }
    setTourStepIndex((prev) => Math.min(tourSteps.length - 1, prev + 1));
  }, [tourSteps, tourStepIndex, user?.id]);

  useEffect(() => {
    if (!accountOpen) return;
    // Sæt altid en position, så dropdown'en monteres selv hvis måling af knappen
    // fejler (fx endnu-ikke-layoutet ref) — ellers kan menuen aldrig åbne.
    const rect = accountBtnRef.current?.getBoundingClientRect();
    const vw = typeof window !== "undefined" ? window.innerWidth : 1024;
    const left = rect
      ? Math.min(Math.max(8, rect.right - 230), vw - 238)
      : Math.max(8, vw - 238);
    const top = rect ? rect.bottom + 6 : 56;
    setAccountPos({ top, left });
    const handler = (e) => {
      if (accountBtnRef.current?.contains(e.target) || accountDropRef.current?.contains(e.target)) return;
      setAccountOpen(false);
    };
    // Tilknyt outside-click-lukkeren efter den aktuelle klik-cyklus, så det klik
    // der åbnede menuen ikke selv når at lukke den igen.
    const attach = setTimeout(() => document.addEventListener("mousedown", handler), 0);
    return () => {
      clearTimeout(attach);
      document.removeEventListener("mousedown", handler);
    };
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
    setAccountOpen(false);
  }, [tab]);

  useEffect(() => {
    hasAutoStartedTourRef.current = false;
  }, [tourStorageKey]);

  useEffect(() => {
    if (!tourStorageKey) return undefined;
    if (hasAutoStartedTourRef.current) return undefined;
    hasAutoStartedTourRef.current = true;

    let alreadyCompleted = false;
    let welcomeSeen = false;
    try {
      alreadyCompleted = localStorage.getItem(tourStorageKey) === '1';
      welcomeSeen = welcomeStorageKey ? localStorage.getItem(welcomeStorageKey) === '1' : true;
    } catch {
      alreadyCompleted = false;
    }
    if (alreadyCompleted) return undefined;

    // Første login: vis Velkommen-skærmen i stedet for at auto-starte turen.
    if (!welcomeSeen) {
      const wTimer = window.setTimeout(() => setWelcomeOpen(true), 400);
      return () => window.clearTimeout(wTimer);
    }

    const timer = window.setTimeout(() => {
      setTourStepIndex(0);
      setTourOpen(true);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [tourStorageKey, welcomeStorageKey]);

  useEffect(() => {
    if (!tourOpen) return;
    const step = tourSteps[tourStepIndex];
    const shouldOpenAccountMenu = Boolean(step?.openAccountMenu);
    setAccountOpen((isOpen) => (isOpen === shouldOpenAccountMenu ? isOpen : shouldOpenAccountMenu));
  }, [tourOpen, tourStepIndex, tourSteps]);

  useEffect(() => {
    if (!tourOpen) return undefined;
    const step = tourSteps[tourStepIndex];
    if (!step) return undefined;

    if (step.tab && tab !== step.tab) {
      setTab(step.tab);
      return undefined;
    }

    if (step.skipScroll) return undefined;

    let cancelled = false;
    let attempts = 0;
    let rafId = null;

    const tryScroll = () => {
      if (cancelled) return;
      const target = step.selector ? document.querySelector(step.selector) : null;
      if (target && typeof target.scrollIntoView === 'function') {
        scrollTourTarget(target, step, attempts);
        attempts += 1;
        if (step.scrollBlock === 'start' && attempts < SCROLL_START_SETTLE_RETRIES) {
          rafId = requestAnimationFrame(tryScroll);
        }
        return;
      }
      attempts += 1;
      if (attempts < SCROLL_RETRY_MAX) {
        rafId = requestAnimationFrame(tryScroll);
      }
    };

    rafId = requestAnimationFrame(tryScroll);
    return () => {
      cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [tourOpen, tourStepIndex, tourSteps, tab, setTab]);

  useEffect(() => {
    if (tab !== "beskeder") setMobileConversationOpen(false);
  }, [tab]);

  useEffect(() => {
    if (!user?.id || !isPushSupported()) return undefined;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return undefined;
    subscribeToPush(user.id).catch(() => {});
    return undefined;
  }, [user?.id]);

  useEffect(() => {
    if (tab === "admin") return;
    lastNonAdminTabRef.current = tab;
  }, [tab]);

  /** Deep link fra admin-notifikation: ?adminSub=result_errors | reports */
  useEffect(() => {
    if (!isAdmin || tab !== "admin") return;
    const params = new URLSearchParams(location.search);
    const raw = params.get("adminSub");
    const allowed = raw === "result_errors" || raw === "reports";
    if (!allowed) {
      if (params.has("adminSub")) {
        params.delete("adminSub");
        const next = params.toString();
        navigate({ pathname: location.pathname, search: next ? `?${next}` : "" }, { replace: true });
      }
      return;
    }
    setAdminInitialSubTab(raw);
    params.delete("adminSub");
    const next = params.toString();
    navigate({ pathname: location.pathname, search: next ? `?${next}` : "" }, { replace: true });
  }, [isAdmin, tab, location.pathname, location.search, navigate]);

  useEffect(() => {
    setAdminPinUnlocked(false);
  }, [user?.id]);

  useEffect(() => {
    if (tab === "admin" && isAdmin) {
      setAdminPinUnlocked(false);
    }
  }, [tab, isAdmin]);

  useEffect(() => {
    if (!isAdmin) {
      wasInAdminTabRef.current = false;
      return;
    }
    const inAdminTab = tab === "admin";
    if (wasInAdminTabRef.current && !inAdminTab) {
      setAdminPinUnlocked(false);
      void (async () => {
        try {
          await supabase.rpc("admin_clear_pin_session");
        } catch {
          // Best effort cleanup; PIN prompt vises stadig næste gang.
        }
      })();
    }
    wasInAdminTabRef.current = inAdminTab;
  }, [tab, isAdmin]);

  const openFeedbackModal = useCallback(() => {
    setAccountOpen(false);
    setFeedbackCategory(FEEDBACK_DEFAULT_CATEGORY);
    setFeedbackPriority(FEEDBACK_DEFAULT_PRIORITY);
    setFeedbackTopic("");
    setFeedbackMessage("");
    setFeedbackOpen(true);
  }, []);

  const closeFeedbackModal = useCallback(async (options = {}) => {
    const force = options.force === true;
    if (feedbackSending && !force) return false;
    const hasDraft = feedbackTopic.trim().length > 0 || feedbackMessage.trim().length > 0;
    if (!force && hasDraft) {
      const confirmed = await ask({
        message: "Du har tekst du ikke har sendt. Vil du lukke?",
        confirmLabel: "Ja, luk",
        cancelLabel: "Bliv her",
        danger: true,
      });
      if (!confirmed) return false;
    }
    setFeedbackOpen(false);
    setFeedbackCategory(FEEDBACK_DEFAULT_CATEGORY);
    setFeedbackPriority(FEEDBACK_DEFAULT_PRIORITY);
    setFeedbackTopic("");
    setFeedbackMessage("");
    return true;
  }, [ask, feedbackMessage, feedbackSending, feedbackTopic]);

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
      if (!session?.access_token) {
        throw new Error("Du skal være logget ind for at sende indberetning.");
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/report-feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          category: feedbackCategory,
          priority: feedbackPriority,
          topic: feedbackTopic.trim() || null,
          message,
          pageUrl: typeof window !== "undefined" ? window.location.href : null,
          routePath: location.pathname + location.search,
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
          displayName,
          userId: user?.id || null,
          userEmail: authUser?.email || user?.email || null,
          submittedAt: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        let details = "";
        try { details = await response.text(); } catch { /* ignore */ }
        throw new Error(details || "Serveren kunne ikke modtage indberetningen.");
      }

      closeFeedbackModal({ force: true });
      showToast("Tak! Din indberetning er sendt.");
    } catch (error) {
      const messageText = error instanceof Error ? error.message : "Kunne ikke sende indberetningen.";
      showToast(messageText);
    } finally {
      setFeedbackSending(false);
    }
  }, [closeFeedbackModal, feedbackCategory, feedbackPriority, feedbackMessage, feedbackTopic, showToast, location.pathname, location.search, displayName, authUser?.email, user?.email, user?.id]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    let cancelled = false;
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const effectiveType = connection?.effectiveType || "";
    const deviceMemory = Number(navigator.deviceMemory || 0);
    const isConstrainedNetwork =
      connection?.saveData === true
      || effectiveType === "slow-2g"
      || effectiveType === "2g"
      || effectiveType === "3g";
    const isLowMemoryDevice = Number.isFinite(deviceMemory) && deviceMemory > 0 && deviceMemory <= 4;

    // Skip eager tab prefetch on mobile and constrained devices to keep first load lighter.
    if (isMobileView || isConstrainedNetwork || isLowMemoryDevice) return undefined;
    if (hasPrefetchedTabsRef.current) return undefined;
    hasPrefetchedTabsRef.current = true;

    const warmTabs = () => {
      if (cancelled) return;

      const loaders = [];
      if (tab !== "kampe") loaders.push(loadKampeTab);
      if (tab !== "beskeder") loaders.push(loadBeskedTab);
      if (isAdmin && tab !== "admin") loaders.push(loadAdminTab);

      loaders.forEach((loader, index) => {
        window.setTimeout(() => {
          if (!cancelled) void loader();
        }, index * 320);
      });
    };

    if (typeof window.requestIdleCallback === "function") {
      const idleId = window.requestIdleCallback(warmTabs, { timeout: 2200 });
      return () => {
        cancelled = true;
        if (typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(idleId);
      };
    }

    const timeoutId = window.setTimeout(warmTabs, 2200);
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [isAdmin, isMobileView, tab]);

  const moreTabIds = ["mere", "beskeder", "baner", "ranking", "profil", "admin"];
  const mereBadge = (unreadMessages > 0 ? unreadMessages : 0) + (isAdmin && adminAttentionCount > 0 ? adminAttentionCount : 0);
  // Redesign v4: Hjem · Kampe · Spil · Makkere · Mere. Beskeder, Baner, Rangliste og Profil ligger under Mere.
  const navTabs = [
    { id: "hjem",     label: "Hjem",    icon: <Home size={18} /> },
    { id: "kampe",    label: "Kampe",   icon: <Swords size={18} />, badge: kampeTabBadge, attention: hasKampeAttention },
    { id: "makkere",  label: "Makkere", icon: <Users size={18} /> },
    { id: "mere",     label: "Mere",    icon: <MoreHorizontal size={18} />, badge: mereBadge > 0 ? mereBadge : null },
  ];
  const isNavTabActive = (id) => (id === "mere" ? moreTabIds.includes(tab) : tab === id);
  // Spil lader brugeren vaelge: 2v2-kamp, Americano/Mexicano eller Liga.
  const openSpil = () => setSpilChooserOpen(true);
  const pickSpil = (search) => {
    setSpilChooserOpen(false);
    setTab("kampe", { search });
  };

  const openAdminPanel = async () => {
    let focusSubTab = null;
    if (isAdmin && user?.id) {
      try {
        const badges = await fetchAdminSubTabBadges(user.id);
        focusSubTab = adminAttentionFocusSubTab(badges);
      } catch {
        focusSubTab = null;
      }
    }
    setAdminInitialSubTab(focusSubTab);
    setTab('admin');
    setAccountOpen(false);
  };

  const userInitial = (displayName || "?").trim().charAt(0).toUpperCase();

  const handleTabPress = useCallback((tabId, opts = {}) => {
    const isCurrentTab = tab === tabId;
    if (isMobileView && isCurrentTab && shouldScrollDashboardToTopOnTabReselect()) {
      scrollDashboardToTop('smooth');
      return;
    }
    setTab(tabId, opts);
  }, [tab, isMobileView, setTab]);

  const hideMobileBottomNavForChat = isMobileView && tab === "beskeder" && mobileConversationOpen;
  const hideMobileBottomNavForKampeDetail = isMobileView && isKampeDetailRoute(location.pathname);
  const hideMobileBottomNavForKampeCreate = isMobileView && tab === "kampe" && kampeCreatePanelOpen;
  const hideMobileBottomNav = hideMobileBottomNavForChat || hideMobileBottomNavForKampeDetail || hideMobileBottomNavForKampeCreate;

  return (
    <div
      id="pm-app-shell"
      style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}
    >
      {/* Header — skjult på mobil: hver fane har sin egen topbar som i mockup'et */}
      <div className="pm-dash-header" style={{ display: isMobileView ? "none" : undefined, padding: "clamp(8px,1.8vw,11px) clamp(12px,2.6vw,18px)", paddingTop: "max(clamp(8px,1.8vw,11px), env(safe-area-inset-top))", borderBottom: "1px solid " + theme.border, background: theme.surface, position: "sticky", top: 0, zIndex: 20 }}>
        <button type="button" onClick={() => setTab("hjem")} className="pm-dash-brand" style={{ display: "flex", alignItems: "center", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: font }} aria-label="Gå til Hjem">
          <picture>
            <source srcSet={dark ? "/logo-brand-dark-nav.webp" : "/logo-brand-nav.webp"} type="image/webp" />
            <img
              src={dark ? "/logo-brand-dark.png" : "/logo-brand.png"}
              width={320}
              height={120}
              alt="PadelMakker logo"
              style={{ height: "32px", width: "auto", objectFit: "contain", display: "block" }}
            />
          </picture>
        </button>
        <div className="pm-dash-header-actions pm-dash-header-actions-mobile" />
        <div className="pm-dash-account-desktop">
          <button
            ref={accountBtnRef}
            type="button"
            data-tour="account-menu-btn"
            onClick={() => setAccountOpen((open) => !open)}
            style={{
              ...btn(false, { size: 'sm', radius: 'pill', fontWeight: 600 }),
              padding: "6px 10px",
              fontSize: "12px",
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
                  background: theme.accentSolid,
                  color: theme.onAccent,
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
            <span style={{ width: "22px", height: "22px", borderRadius: "999px", background: theme.surfaceMuted, color: theme.text, fontSize: "11px", fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              {userInitial}
            </span>
            <span className="pm-dash-account-name">{displayName}</span>
            <ChevronDown size={14} style={{ transform: accountOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.14s ease" }} />
          </button>
        </div>
        {accountOpen && accountPos && createPortal(
          <div
            ref={accountDropRef}
            data-tour="account-menu-dropdown"
            style={{
              position: "fixed",
              top: accountPos.top,
              left: accountPos.left,
              width: "230px",
              background: theme.surface,
              border: "1px solid " + theme.border,
              borderRadius: "12px",
              boxShadow: theme.menuShadow,
              zIndex: 9999,
              overflow: "visible",
            }}
          >
            <div style={{ padding: "10px 12px", borderBottom: "1px solid " + theme.border }}>
              <div style={{ fontSize: "11px", color: theme.textMid, marginBottom: "4px" }}>Logget ind som</div>
              <div style={{ fontSize: "13px", fontWeight: 700, color: theme.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayName}</div>
            </div>
            {isAdmin && (
              <button
                type="button"
                onClick={() => { void openAdminPanel(); }}
                style={accountMenuRowBtnStyle()}
              >
                <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                  <ShieldCheck size={15} />
                  {adminAttentionCount > 0 && (
                    <span
                      aria-label={`${adminAttentionCount} admin-opgaver kræver opmærksomhed`}
                      style={{
                        position: 'absolute',
                        top: '-6px',
                        right: '-8px',
                        minWidth: '16px',
                        height: '16px',
                        padding: '0 4px',
                        borderRadius: '999px',
                        background: theme.redSolid,
                        color: theme.onAccent,
                        fontSize: '9px',
                        fontWeight: 800,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        lineHeight: 1,
                        border: '2px solid ' + theme.surface,
                      }}
                    >
                      {adminAttentionCount > 9 ? '9+' : adminAttentionCount}
                    </span>
                  )}
                </span>
                Admin
                {adminAttentionCount > 0 && (
                  <span
                    style={{
                      marginLeft: 'auto',
                      fontSize: '10px',
                      fontWeight: 700,
                      color: theme.red,
                      background: theme.redBg,
                      padding: '2px 7px',
                      borderRadius: '999px',
                    }}
                  >
                    {adminAttentionCount} opgave{adminAttentionCount === 1 ? '' : 'r'}
                  </span>
                )}
              </button>
            )}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", padding: "10px 12px", borderBottom: "1px solid " + theme.border }}>
              <span style={{ fontSize: "13px", fontWeight: 600, color: theme.textMid }}>Notifikationer</span>
              {!isMobileView && <NotificationBell />}
            </div>
            <button
              type="button"
              onClick={() => {
                setAccountOpen(false);
                navigate("/?forside=1");
              }}
              style={accountMenuRowBtnStyle()}
            >
              <ExternalLink size={15} />
              Se forsiden
            </button>
            <button
              type="button"
              data-tour="account-menu-profile-btn"
              onClick={() => {
                setTab("profil");
                setAccountOpen(false);
              }}
              style={accountMenuRowBtnStyle()}
            >
              <Settings size={15} />
              Min profil
            </button>
            <button
              type="button"
              onClick={() => {
                setAccountOpen(false);
                startTour();
              }}
              style={accountMenuRowBtnStyle()}
            >
              <Compass size={15} />
              Start guide
            </button>
            <button
              type="button"
              onClick={openFeedbackModal}
              style={accountMenuRowBtnStyle()}
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
              style={accountMenuRowBtnStyle({ isDanger: true, isLast: true })}
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
        {navTabs.map(t => {
          const active = isNavTabActive(t.id);
          const tabAttention = Boolean(t.attention && !active);
          return (
          <button key={t.id} type="button" className="pm-tab-strip-btn" data-active={active ? "true" : "false"} title={t.label} aria-label={t.label} data-tour={`tab-${t.id}`} onClick={() => setTab(t.id)} style={tabBtnStyle(active)} aria-current={active ? "page" : undefined}>
            <span aria-hidden style={{ display: "flex", position: "relative" }}>
              {t.icon}
              {t.badge && (
                <span style={{ position: "absolute", top: "-5px", right: "-6px", background: theme.accentSolid, color: theme.onAccent, borderRadius: "10px", fontSize: "9px", fontWeight: 800, padding: "1px 4px", lineHeight: 1.2 }}>
                  {t.badge > 9 ? "9+" : t.badge}
                </span>
              )}
              {!t.badge && tabAttention && (
                <span style={{ position: "absolute", top: "-3px", right: "-5px", width: "8px", height: "8px", borderRadius: "50%", background: theme.accentSolid }} />
              )}
            </span>
            <span className="pm-tab-label">{t.label}</span>
          </button>
        );})}
        {!isMobileView && (
          <button type="button" className="pm-spil-btn pm-spil-btn--strip" data-tour="tab-spil" onClick={openSpil}>
            Spil
          </button>
        )}

        {!isMobileView && (
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", paddingLeft: "8px", flexShrink: 0 }}>
            <button
              type="button"
              className={`pm-theme-switch ${dark ? 'pm-theme-switch--dark' : 'pm-theme-switch--light'}`}
              onClick={() => setDark((d) => !d)}
              title={dark ? "Skift til lys tilstand" : "Skift til mørk tilstand"}
              aria-label={dark ? "Skift til lys tilstand" : "Skift til mørk tilstand"}
            >
              <span className="pm-theme-switch__icon pm-theme-switch__icon--sun" style={{ color: dark ? theme.textLight : theme.warm }}>
                <Sun size={13} />
              </span>
              <span className="pm-theme-switch__icon pm-theme-switch__icon--moon" style={{ color: dark ? theme.textMid : theme.textLight }}>
                <Moon size={13} />
              </span>
              <div className={`pm-theme-switch__thumb ${dark ? 'pm-theme-switch__thumb--dark' : 'pm-theme-switch__thumb--light'}`}>
                {dark
                  ? <Moon size={13} style={{ color: theme.text }} />
                  : <Sun size={13} style={{ color: theme.warm }} />
                }
              </div>
            </button>
          </div>
        )}

      </div>

      <div role="main" className={`pm-dash-main${tab === "hjem" ? " pm-dash-main--home" : ""}${tab === "notifikationer" ? " pm-dash-main--notifikationer" : ""}${tab === "makker-filter" || tab === "kamp-filter" ? " pm-dash-main--filter" : ""}${hideMobileBottomNavForChat ? " pm-dash-main--chat" : ""}${hideMobileBottomNavForKampeDetail ? " pm-dash-main--kampe-detail" : ""}${hideMobileBottomNavForKampeCreate ? " pm-dash-main--kampe-create" : ""}`}>
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
          {tab === "hjem" && <HomeTabLazy user={user} setTab={setTab} showToast={showToast} tourForceNotificationOpen={tourOnNotificationStep} deferOnboardingPrompt={onboardingThisVisit || welcomeOpen || tourOpen}  unreadMessages={unreadMessages} />}
            {tab === "makkere"  && <MakkereTabLazy user={user} showToast={showToast} />}
            {tab === "baner"    && <BanerTabLazy />}
            {tab === "kampe"    && <KampeTabLazy user={user} showToast={showToast} tabActive onCreatePanelChange={setKampeCreatePanelOpen} />}
            {tab === "ranking"  && <RankingTabLazy user={user} />}
            {tab === "mere" && (
              <MereTab
                user={user}
                displayName={displayName}
                email={authUser?.email}
                unreadMessages={unreadMessages}
                isAdmin={isAdmin}
                adminAttentionCount={adminAttentionCount}
                dark={dark}
                onToggleDark={() => setDark((d) => !d)}
                setTab={setTab}
                onStartTour={startTour}
                onOpenFeedback={openFeedbackModal}
                onOpenAdmin={() => void openAdminPanel()}
                onShowLanding={() => navigate("/?forside=1")}
                onLogout={onLogout}
              />
            )}
            {tab === "beskeder" && (
              <BeskedTabLazy
                user={user}
                showToast={showToast}
                setTab={setTab}
                onMobileConversationStateChange={setMobileConversationOpen}
              />
            )}
            {tab === "profil"   && <ProfilTabLazy user={user} showToast={showToast} setTab={setTab} />}
            {tab === "kamp-filter" && <MatchSearchFilterPageLazy user={user} showToast={showToast} />}
            {tab === "makker-filter" && <MakkerSearchFilterPageLazy user={user} showToast={showToast} />}
            {tab === "admin"    && isAdmin && adminPinUnlocked && (
              <AdminTabLazy initialSubTab={adminInitialSubTab} />
            )}
            {tab === "admin"    && isAdmin && !adminPinUnlocked && (
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
                Admin-adgang er låst. Indtast din 6-cifrede kode for at fortsætte.
              </div>
            )}
            {tab === "notifikationer" && (
              <NotifikationerPageLazy onBack={() => setTab("hjem")} />
            )}
          </Suspense>
      </div>

      {tab === "admin" && isAdmin && !adminPinUnlocked && (
        <AdminPinGate
          userId={user?.id}
          showToast={showToast}
          onUnlocked={() => setAdminPinUnlocked(true)}
          onCancel={() => setTab(lastNonAdminTabRef.current || "hjem")}
        />
      )}

      <GuidedTourOverlay
        open={tourOpen}
        steps={tourSteps}
        stepIndex={tourStepIndex}
        onBack={handleTourBack}
        onNext={handleTourNext}
        onSkip={() => closeTour("Guiden er lukket. Du kan starte den igen i menuen.")}
        onFinish={() => {
          closeTour("Guide gennemført. God fornøjelse!");
          setTab("hjem");
        }}
      />

      {welcomeOpen && isValidCityPlace(user) && (
        <WelcomeScreen
          name={displayName}
          levelText={user?.level != null ? formatPlaytomicLevel(user.level) : null}
          onFindPartner={() => { dismissWelcome(); setTab('makkere'); }}
          onJoinMatch={() => { dismissWelcome(); setTab('kampe'); }}
          onStartTour={() => { markWelcomeSeen(); setWelcomeOpen(false); startTour(); }}
          onGoToApp={() => dismissWelcome()}
        />
      )}

      <PendingResultConfirmModal user={user} />

      <CityRequiredModal
        open={Boolean(user?.id) && !isValidCityPlace(user)}
        user={user}
        showToast={showToast}
        onSaved={async (fields) => {
          await updateProfile(fields);
        }}
      />

      {feedbackOpen && (
        <AppModal
          open
          onClose={feedbackSending ? undefined : closeFeedbackModal}
          ariaLabel="Rapportér fejl"
          maxWidth="560px"
          zIndex={10020}
          closeOnEscape={!feedbackSending}
          closeOnBackdrop={!feedbackSending}
        >
          <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
            <div style={{ padding: "14px 16px", borderBottom: "1px solid " + theme.border }}>
              <div style={{ fontSize: "17px", fontWeight: 800, color: theme.text }}>Rapportér fejl</div>
              <div style={{ marginTop: "4px", fontSize: "12px", color: theme.textMid }}>
                Beskriv bug eller problem — vi sender den direkte til kontakt@padelmakker.dk.
              </div>
            </div>
            <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: "10px", overflowY: "auto", flex: 1, minHeight: 0 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: isMobileView ? "1fr" : "1fr 1fr",
                  gap: "10px",
                }}
              >
                <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <span style={{ fontSize: "12px", fontWeight: 700, color: theme.textMid }}>Kategori</span>
                  <select
                    value={feedbackCategory}
                    onChange={(event) => setFeedbackCategory(event.target.value)}
                    disabled={feedbackSending}
                    style={{
                      width: "100%",
                      border: "1px solid " + theme.border,
                      borderRadius: "10px",
                      padding: "10px 12px",
                      fontSize: isMobileView ? "16px" : "13px",
                      fontFamily: font,
                      color: theme.text,
                      background: theme.surface,
                      outline: "none",
                    }}
                  >
                    {FEEDBACK_CATEGORY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <span style={{ fontSize: "12px", fontWeight: 700, color: theme.textMid }}>Prioritet</span>
                  <select
                    value={feedbackPriority}
                    onChange={(event) => setFeedbackPriority(event.target.value)}
                    disabled={feedbackSending}
                    style={{
                      width: "100%",
                      border: "1px solid " + theme.border,
                      borderRadius: "10px",
                      padding: "10px 12px",
                      fontSize: isMobileView ? "16px" : "13px",
                      fontFamily: font,
                      color: theme.text,
                      background: theme.surface,
                      outline: "none",
                    }}
                  >
                    {FEEDBACK_PRIORITY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
              </div>
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
                  fontSize: isMobileView ? "16px" : "13px",
                  fontFamily: font,
                  color: theme.text,
                  background: theme.surface,
                  outline: "none",
                }}
              />
              <label htmlFor="feedback-message" style={{ fontSize: "12px", fontWeight: 600, color: theme.textMid, display: "block", marginBottom: "6px" }}>
                Beskrivelse <span style={{ fontWeight: 500, color: theme.textLight }}>(mindst 10 tegn)</span>
              </label>
              <textarea
                id="feedback-message"
                value={feedbackMessage}
                onChange={(event) => setFeedbackMessage(event.target.value.slice(0, 3000))}
                placeholder="Fx: På Kampe-tabben får jeg fejl når jeg trykker Gem resultat efter en 2v2-kamp…"
                disabled={feedbackSending}
                rows={6}
                aria-describedby="feedback-message-hint"
                style={{
                  width: "100%",
                  resize: "vertical",
                  border: "1px solid " + (feedbackMessage.trim().length < 10 ? theme.warm : theme.border),
                  borderRadius: "10px",
                  padding: "10px 12px",
                  fontSize: isMobileView ? "16px" : "13px",
                  lineHeight: 1.5,
                  fontFamily: font,
                  color: theme.text,
                  background: theme.surface,
                  outline: "none",
                  minHeight: "140px",
                }}
              />
              <div
                id="feedback-message-hint"
                style={{
                  fontSize: "11px",
                  color: feedbackMessage.trim().length < 10 ? theme.warm : theme.textLight,
                  fontWeight: feedbackMessage.trim().length < 10 ? 600 : 400,
                  marginTop: "6px",
                  lineHeight: 1.45,
                }}
              >
                {feedbackMessage.trim().length < 10
                  ? `Skriv mindst ${10 - feedbackMessage.trim().length} tegn mere, så vi kan forstå fejlen.`
                  : "Tak — du kan sende indberetningen nu."}
                <span style={{ float: "right", fontWeight: 400, color: theme.textLight }}>
                  {feedbackMessage.trim().length}/3000
                </span>
              </div>
            </div>
            <div style={{ padding: "12px 16px", borderTop: "1px solid " + theme.border, display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button
                type="button"
                onClick={closeFeedbackModal}
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
                title={
                  feedbackMessage.trim().length < 10
                    ? "Skriv mindst 10 tegn i beskrivelsen"
                    : undefined
                }
                style={{
                  ...btn(true),
                  minHeight: "34px",
                  fontSize: "12px",
                  padding: "7px 12px",
                  opacity: (feedbackSending || feedbackMessage.trim().length < 10) ? 0.6 : 1,
                  cursor: (feedbackSending || feedbackMessage.trim().length < 10) ? "not-allowed" : "pointer",
                }}
              >
                {feedbackSending
                  ? "Sender..."
                  : feedbackMessage.trim().length < 10
                    ? `Mangler ${10 - feedbackMessage.trim().length} tegn`
                    : "Send indberetning"}
              </button>
            </div>
          </div>
        </AppModal>
      )}

      <SpilChooser
        open={spilChooserOpen}
        onClose={() => setSpilChooserOpen(false)}
        onPick={pickSpil}
        asSheet={isMobileView}
        canCreateLiga={isAdmin}
      />

      {!hideMobileBottomNav && (
      <nav className="pm-mobile-bottom-nav pm-nav-v4" aria-label="Mobil navigation">
        {[...navTabs.slice(0, 2), null, ...navTabs.slice(2)].map((t) => {
          if (!t) {
            return (
              <button
                key="spil"
                type="button"
                className="pm-spil-btn"
                data-tour="mobile-tab-spil"
                onClick={openSpil}
                aria-label="Spil: opret en kamp, turnering eller liga"
                aria-haspopup="dialog"
              >
                Spil
              </button>
            );
          }
          const active = isNavTabActive(t.id);
          const tabAttention = Boolean(t.attention && !active);
          return (
            <button
              key={t.id}
              type="button"
              data-tour={`mobile-tab-${t.id}`}
              data-active={active ? "true" : "false"}
              onClick={() => handleTabPress(t.id)}
              className="pm-mobile-bottom-btn"
              aria-label={t.badge ? `${t.label} (${t.badge})` : t.label}
              aria-current={active ? "page" : undefined}
            >
              <span className="pm-mobile-bottom-icon-wrap">
                {t.icon}
                {t.badge && (
                  <span className="pm-mobile-bottom-badge" aria-hidden>
                    {t.badge > 9 ? "9+" : t.badge}
                  </span>
                )}
                {!t.badge && tabAttention && (
                  <span style={{ position: "absolute", top: "-3px", right: "-4px", width: "8px", height: "8px", borderRadius: "50%", background: theme.accentSolid }} />
                )}
              </span>
              <span className="pm-mobile-bottom-label">{t.label}</span>
            </button>
          );
        })}
      </nav>
      )}
    </div>
  );
}

