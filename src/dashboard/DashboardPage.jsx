import { useEffect, useCallback, useState, useRef, useMemo, lazy, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { useConfirm } from '../lib/ConfirmDialogProvider';
import { font, theme, btn } from '../lib/platformTheme';
import { resolveDisplayName } from '../lib/platformUtils';
import { Home, Users, MapPin, Swords, Trophy, Settings, LogOut, MessageCircle, Medal, ChevronDown, Menu, Bug, Compass, Sun, Moon } from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo';
import { NotificationBell } from '../components/NotificationBell';
import { HomeTab } from './HomeTab';
import { ShieldCheck } from 'lucide-react';
import { useUnreadMessageCount } from '../lib/chatUtils';
import { useDarkMode } from '../lib/useDarkMode';
import { supabase } from '../lib/supabase';
import { PROFILE_REFRESH_COOLDOWN_MS } from '../lib/platformConstants';
import { AdminPinGate } from '../components/AdminPinGate';
import { GuidedTourOverlay } from '../components/GuidedTourOverlay';
import { PendingResultConfirmModal } from '../components/PendingResultConfirmModal';
import { KAMPE_NOTIFICATION_TYPES } from '../lib/kampeNotificationTypes';
import { countRelevantKampeUnreadNotifications } from '../lib/kampeNotificationBadges';
import { fetchRowsInChunks } from '../lib/supabaseChunkFetch';
import { filterConfirmablePendingResults } from '../lib/resolvePadelMatchResult';

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

const FEEDBACK_DEFAULT_CATEGORY = "bug";
const FEEDBACK_DEFAULT_PRIORITY = "normal";

const FEEDBACK_CATEGORY_OPTIONS = [
  { value: "bug", label: "Bug" },
  { value: "performance", label: "Performance" },
  { value: "ui", label: "UI / UX" },
  { value: "match-chat", label: "Match chat" },
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

  useEffect(() => {
    if (!userId) {
      setCount(0);
      return;
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
  }, [userId, createController]);

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
      intervalMs: 15000,
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
    let shouldRefreshIds = true;
    let myRelatedMatchIds = [];
    let statusByMatchId = {};
    const RELEVANT_TYPES = KAMPE_NOTIFICATION_TYPES;

    const loadRelatedMatchIds = async () => {
      try {
        const [createdRes, playerRes] = await Promise.all([
          supabase.from("matches").select("id").eq("creator_id", api.userId),
          supabase.from("match_players").select("match_id").eq("user_id", api.userId),
        ]);
        const set = new Set([
          ...(createdRes.data || []).map((m) => String(m.id)),
          ...(playerRes.data || []).map((p) => String(p.match_id)),
        ]);
        myRelatedMatchIds = [...set];
        const matchRows = myRelatedMatchIds.length > 0
          ? await fetchRowsInChunks(supabase, "matches", "id", myRelatedMatchIds, "id,status")
          : [];
        statusByMatchId = Object.fromEntries(
          (matchRows || []).map((match) => [String(match.id), (match.status ?? "open").toString().toLowerCase()])
        );
      } catch (e) {
        console.warn("kampe notif badge ids:", e);
        myRelatedMatchIds = [];
        statusByMatchId = {};
      } finally {
        shouldRefreshIds = false;
      }
    };

    const loadCount = async () => {
      try {
        if (myRelatedMatchIds.length === 0) {
          api.setCountSafe(0);
          return;
        }
        const { data, error } = await supabase
          .from("notifications")
          .select("id,type,match_id")
          .eq("user_id", api.userId)
          .eq("read", false)
          .in("type", RELEVANT_TYPES)
          .in("match_id", myRelatedMatchIds)
          .limit(500);
        if (error) throw error;
        api.setCountSafe(countRelevantKampeUnreadNotifications(data, statusByMatchId));
      } catch (e) {
        console.warn("kampe notif badge refetch:", e);
      }
    };

    return {
      refetch: async () => {
        if (shouldRefreshIds) await loadRelatedMatchIds();
        await loadCount();
      },
      subscriptions: [
        {
          name: "kampe-notif-badge-notifs-" + api.userId,
          table: "notifications",
          filter: "user_id=eq." + api.userId,
          onEvent: ({ api: runtime }) => {
            shouldRefreshIds = true;
            runtime.scheduleRefetch({ delay: 120 });
          },
        },
        {
          name: "kampe-notif-badge-matches-" + api.userId,
          table: "matches",
          filter: "creator_id=eq." + api.userId,
          onEvent: ({ api: runtime }) => {
            shouldRefreshIds = true;
            runtime.scheduleRefetch({ delay: 120 });
          },
        },
        {
          name: "kampe-notif-badge-players-" + api.userId,
          table: "match_players",
          filter: "user_id=eq." + api.userId,
          onEvent: ({ api: runtime }) => {
            shouldRefreshIds = true;
            runtime.scheduleRefetch({ delay: 120 });
          },
        },
      ],
      intervalMs: 10000,
      onInterval: (runtime) => {
        if (!runtime.isPageVisible()) return;
        shouldRefreshIds = true;
        runtime.scheduleRefetch({ delay: 50 });
      },
      listenVisibility: true,
      onVisibility: (runtime) => {
        if (!runtime.isPageVisible()) return;
        shouldRefreshIds = true;
        runtime.scheduleRefetch({ delay: 80 });
      },
      windowEvents: ["focus", "pageshow", "online", "pm-notifications-sync"],
      onWindowEvent: (runtime) => {
        if (!runtime.isPageVisible()) return;
        shouldRefreshIds = true;
        runtime.scheduleRefetch({ delay: 80 });
      },
    };
  }, []);

  return useRealtimeCount(userId, createController);
}

const PRIMARY_TAB_IDS = ["hjem", "makkere", "baner", "kampe", "ranking", "liga", "beskeder"];
const TOUR_VERSION = 1;

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

export function DashboardPage({ user, onLogout, showToast }) {
  const { user: authUser, refreshProfileQuiet } = useAuth();
  const ask = useConfirm();
  const displayName = resolveDisplayName(user, authUser);
  const navigate = useNavigate();
  const location = useLocation();
  const isAdmin = user?.role === 'admin';
  const unreadMessages = useUnreadMessageCount(user?.id);
  const pendingLigaInvites = usePendingLigaInvites(user?.id);
  const pendingKampe = usePendingKampeBadge(user?.id, isAdmin);
  const unreadNotifs = useUnreadNotificationsCount(user?.id);
  const unreadKampeNotifs = useUnreadKampeNotificationsCount(user?.id);
  const hasKampeAttention = pendingKampe > 0 || unreadKampeNotifs > 0;
  const pathTab = location.pathname.split("/")[2] || "hjem";
  const validTabs = ["hjem", "makkere", "baner", "kampe", "ranking", "liga", "beskeder", "profil", "admin"];
  const tab = validTabs.includes(pathTab) ? pathTab : "hjem";
  const setTab = useCallback((t) => navigate("/dashboard/" + t), [navigate]);

  const [dark, setDark] = useDarkMode();
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountPos, setAccountPos] = useState(null);
  const [isMobileView, setIsMobileView] = useState(() => (typeof window !== "undefined" ? window.innerWidth <= 768 : false));
  const [mobileConversationOpen, setMobileConversationOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackCategory, setFeedbackCategory] = useState(FEEDBACK_DEFAULT_CATEGORY);
  const [feedbackPriority, setFeedbackPriority] = useState(FEEDBACK_DEFAULT_PRIORITY);
  const [feedbackTopic, setFeedbackTopic] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackSending, setFeedbackSending] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [tourStepIndex, setTourStepIndex] = useState(0);
  const [adminPinUnlocked, setAdminPinUnlocked] = useState(false);
  const hasPrefetchedTabsRef = useRef(false);
  const lastProfileRefreshAtRef = useRef(0);
  const lastNonAdminTabRef = useRef(tab !== "admin" ? tab : "hjem");
  const wasInAdminTabRef = useRef(false);
  const hasAutoStartedTourRef = useRef(false);
  const accountBtnRef = useRef(null);
  const accountDropRef = useRef(null);
  const tourStorageKey = user?.id ? `pm_dash_tour_v${TOUR_VERSION}_done_${user.id}` : null;

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
        id: 'home',
        tab: 'hjem',
        selector: tabTourSelector('hjem'),
        title: 'Hjem-overblik',
        description: 'Her får du et samlet overblik over aktivitet, forslag og det vigtigste der sker lige nu.',
      },
      {
        id: 'quick-action',
        tab: 'hjem',
        selector: '[data-tour="quick-action-kampe"]',
        title: 'Hurtig handling',
        description: 'De store kort på forsiden er genveje. Tryk fx på “Åbne kampe” for at hoppe direkte til kamp-flowet.',
      },
      {
        id: 'latest-activity',
        tab: 'hjem',
        selector: '[data-tour="home-latest-activity"]',
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
        id: 'baner-booking',
        tab: 'baner',
        selector: tabTourSelector('baner'),
        title: 'Baner & booking',
        description: 'Du booker ikke direkte i PadelMakker. Her finder du baner og åbner deres bookingsystem via booking-linket.',
      },
      {
        id: 'kampe',
        tab: 'kampe',
        selector: tabTourSelector('kampe'),
        title: 'Kampe',
        description: 'I Kampe opretter du nye kampe, tilmelder dig eksisterende, og håndterer resultater og bekræftelser.',
      },
    ];

    if (isMobileView) {
      base.push({
        id: 'mobile-more',
        selector: '[data-tour="mobile-tab-mere"]',
        title: 'Mere-menu',
        description: 'Under “Mere” finder du bl.a. Profil, Ranking, Beskeder og øvrige funktioner.',
      });

      base.push({
        id: 'profile',
        tab: 'profil',
        selector: '[data-tour="profile-main"]',
        title: 'Din profil',
        description: 'Her opdaterer du profil, følger ELO-udvikling og styrer dine personlige præferencer. Det er dit vigtigste udgangspunkt i appen.',
      });
    } else {
      base.push(
        {
          id: 'ranking',
          tab: 'ranking',
          selector: '[data-tour="tab-ranking"]',
          title: 'Ranking',
          description: 'Her kan du følge ELO, placering og udvikling over tid.',
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
          title: 'Din profil',
          description: 'Her opdaterer du profil, følger ELO-udvikling og styrer dine personlige præferencer. Det er dit vigtigste udgangspunkt i appen.',
        }
      );
    }

    return base;
  }, [isMobileView, tabTourSelector]);

  const persistTourCompleted = useCallback(() => {
    if (!tourStorageKey) return;
    try {
      localStorage.setItem(tourStorageKey, '1');
    } catch {
      // ignore storage errors
    }
  }, [tourStorageKey]);

  const startTour = useCallback(() => {
    setMobileMoreOpen(false);
    setAccountOpen(false);
    setTourStepIndex(0);
    setTourOpen(true);
  }, []);

  const closeTour = useCallback((withToastMessage) => {
    persistTourCompleted();
    setTourOpen(false);
    setTourStepIndex(0);
    setMobileMoreOpen(false);
    setAccountOpen(false);
    if (withToastMessage) showToast(withToastMessage);
  }, [persistTourCompleted, showToast]);

  const handleTourBack = useCallback(() => {
    setTourStepIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const handleTourNext = useCallback(() => {
    setTourStepIndex((prev) => Math.min(tourSteps.length - 1, prev + 1));
  }, [tourSteps.length]);

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
    setMobileMoreOpen(false);
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
    try {
      alreadyCompleted = localStorage.getItem(tourStorageKey) === '1';
    } catch {
      alreadyCompleted = false;
    }
    if (alreadyCompleted) return undefined;

    const timer = window.setTimeout(() => {
      setTourStepIndex(0);
      setTourOpen(true);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [tourStorageKey]);

  useEffect(() => {
    if (!tourOpen) return;
    const step = tourSteps[tourStepIndex];
    const shouldOpenAccountMenu = Boolean(step?.openAccountMenu);
    setAccountOpen((isOpen) => (isOpen === shouldOpenAccountMenu ? isOpen : shouldOpenAccountMenu));
  }, [tourOpen, tourStepIndex, tourSteps]);

  useEffect(() => {
    if (!tourOpen) return;
    const step = tourSteps[tourStepIndex];
    if (!step) return;

    if (step.tab && tab !== step.tab) {
      setTab(step.tab);
      return;
    }

    const target = step.selector ? document.querySelector(step.selector) : null;
    if (target && typeof target.scrollIntoView === 'function') {
      target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    }
  }, [tourOpen, tourStepIndex, tourSteps, tab, setTab]);

  useEffect(() => {
    if (tab !== "beskeder") setMobileConversationOpen(false);
  }, [tab]);

  useEffect(() => {
    if (tab === "admin") return;
    lastNonAdminTabRef.current = tab;
  }, [tab]);

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
    setMobileMoreOpen(false);
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

  useEffect(() => {
    if (!feedbackOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeFeedbackModal();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [closeFeedbackModal, feedbackOpen]);

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
        throw new Error("Du skal vaere logget ind for at sende indberetning.");
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
  if (isAdmin && isMobileView) allTabs.push({ id: "admin", label: "Admin", icon: <ShieldCheck size={15} /> });

  const primaryTabs = allTabs.filter(t => PRIMARY_TAB_IDS.includes(t.id));
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
        <button type="button" onClick={() => setTab("hjem")} className="pm-dash-brand" style={{ display: "flex", alignItems: "center", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: font }} aria-label="Gå til Hjem">
          <BrandLogo size="dashboard" />
        </button>
        <div className="pm-dash-header-actions pm-dash-header-actions-mobile">
          {isMobileView && <NotificationBell />}
        </div>
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
                  background: theme.red,
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
                onClick={() => {
                  setTab("admin");
                  setAccountOpen(false);
                }}
                style={accountMenuRowBtnStyle()}
              >
                <ShieldCheck size={15} />
                Admin
              </button>
            )}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", padding: "10px 12px", borderBottom: "1px solid " + theme.border }}>
              <span style={{ fontSize: "13px", fontWeight: 600, color: theme.textMid }}>Notifikationer</span>
              {!isMobileView && <NotificationBell />}
            </div>
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
        {primaryTabs.map(t => {
          const active = tab === t.id;
          const tabAttention = Boolean(t.attention && !active);
          return (
          <button key={t.id} type="button" className="pm-tab-strip-btn" data-active={active ? "true" : "false"} title={t.label} aria-label={t.label} data-tour={`tab-${t.id}`} onClick={() => setTab(t.id)} style={tabBtnStyle(active)} aria-current={active ? "page" : undefined}>
            <span aria-hidden style={{ display: "flex", position: "relative" }}>
              {t.icon}
              {t.badge && (
                <span style={{ position: "absolute", top: "-5px", right: "-6px", background: theme.red, color: theme.onAccent, borderRadius: "10px", fontSize: "9px", fontWeight: 800, padding: "1px 4px", lineHeight: 1.2 }}>
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

        {!isMobileView && (
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", paddingLeft: "8px", flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => setDark((d) => !d)}
              title={dark ? "Skift til lys tilstand" : "Skift til mørk tilstand"}
              aria-label={dark ? "Skift til lys tilstand" : "Skift til mørk tilstand"}
              style={{
                width: 60,
                height: 30,
                borderRadius: 15,
                border: "none",
                cursor: "pointer",
                flexShrink: 0,
                background: dark ? theme.surfaceAlt : theme.border,
                position: "relative",
                transition: "background 0.25s",
                boxShadow: dark ? "inset 0 2px 5px rgba(0,0,0,0.6)" : "inset 0 2px 4px rgba(0,0,0,0.12)",
                padding: 0,
              }}
            >
              <span style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", display: "flex", zIndex: 1, color: dark ? theme.textLight : theme.warm, transition: "color 0.25s" }}>
                <Sun size={13} />
              </span>
              <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", display: "flex", zIndex: 1, color: dark ? theme.textMid : theme.textLight, transition: "color 0.25s" }}>
                <Moon size={13} />
              </span>
              <div
                style={{
                  position: "absolute",
                  top: 3,
                  left: dark ? 31 : 3,
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  background: dark ? theme.surface : theme.onAccent,
                  transition: "left 0.25s",
                  boxShadow: dark ? "0 1px 5px rgba(0,0,0,0.7)" : "0 1px 4px rgba(0,0,0,0.2)",
                  zIndex: 2,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {dark
                  ? <Moon size={13} style={{ color: theme.text }} />
                  : <Sun size={13} style={{ color: theme.warm }} />
                }
              </div>
            </button>
          </div>
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
            {tab === "profil"   && <ProfilTabLazy user={user} showToast={showToast} setTab={setTab} />}
            {tab === "admin"    && isAdmin && adminPinUnlocked && <AdminTabLazy />}
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
          </Suspense>
        )}
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

      <PendingResultConfirmModal user={user} />

      {feedbackOpen && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Rapportér fejl"
          onClick={closeFeedbackModal}
          style={{
            position: "fixed",
            inset: 0,
            background: theme.overlay,
            zIndex: 10020,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: "min(560px, 100%)",
              background: theme.surface,
              border: "1px solid " + theme.border,
              borderRadius: "14px",
              boxShadow: theme.modalShadow,
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
                  fontSize: isMobileView ? "16px" : "13px",
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
                  <span style={{ background: theme.red, color: theme.onAccent, borderRadius: "10px", fontSize: "10px", fontWeight: 800, padding: "1px 6px", lineHeight: 1.3 }}>
                    {t.badge > 9 ? "9+" : t.badge}
                  </span>
                )}
              </span>
            </button>
          ))}
          <button
            type="button"
            className="pm-mobile-more-row"
            onClick={() => setDark((d) => !d)}
            aria-pressed={dark}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              {dark ? <Moon size={16} /> : <Sun size={16} />}
              Mørk tilstand
            </span>
            <span style={{ fontSize: "12px", fontWeight: 700, color: dark ? theme.accent : theme.textMid }}>
              {dark ? "Til" : "Fra"}
            </span>
          </button>
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
            className="pm-mobile-more-row"
            onClick={() => {
              setMobileMoreOpen(false);
              startTour();
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <Compass size={16} />
              Start guide
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
              data-tour={`mobile-tab-${t.id}`}
              data-active={active ? "true" : "false"}
              onClick={() => setTab(t.id)}
              className="pm-mobile-bottom-btn"
              aria-label={t.label}
              aria-current={active ? "page" : undefined}
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
          data-tour="mobile-tab-mere"
          data-active={mobileMoreIsActive || mobileMoreOpen ? "true" : "false"}
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

