import { useCallback, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useUnreadMessageCount } from '../lib/chatUtils';
import { BADGE_POLL_VISIBLE_MS, usePageVisible } from '../lib/pageVisibility';
import {
  KAMPE_NOTIFICATION_TYPES,
  KAMPE_ENTITY_NOTIFICATION_TYPES,
} from '../lib/kampeNotificationTypes';
import {
  countRelevantKampeUnreadNotifications,
  countUnreadEntityNotifications,
} from '../lib/kampeNotificationBadges';
import { fetchRowsInChunks } from '../lib/supabaseChunkFetch';

function useRealtimeCount(userId, createController) {
  const [count, setCount] = useState(0);
  const pageVisible = usePageVisible();

  useEffect(() => {
    if (!userId || !pageVisible) {
      setCount(0);
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

export function useDashboardBadges(userId, isAdmin = false) {
  const unreadMessages = useUnreadMessageCount(userId);

  const pendingLigaInvites = useRealtimeCount(userId, useCallback((api) => ({
    refetch: async () => {
      const { count: c } = await supabase.from("league_teams").select("id", { count: "exact", head: true }).eq("player2_id", api.userId).eq("status", "pending");
      api.setCountSafe(c || 0);
    },
    subscriptions: [{ name: "liga-invites-" + api.userId, table: "league_teams", filter: "player2_id=eq." + api.userId }]
  }), []));

  const unreadNotifs = useRealtimeCount(userId, useCallback((api) => ({
    refetch: async () => {
      const { count: c } = await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", api.userId).eq("read", false);
      api.setCountSafe(c || 0);
    },
    subscriptions: [{ name: "notif-badge-" + api.userId, table: "notifications", filter: "user_id=eq." + api.userId }],
    intervalMs: 10000,
    listenVisibility: true
  }), []));

  const unreadKampeNotifs = useRealtimeCount(userId, useCallback((api) => {
    let shouldRefreshIds = true;
    let myRelatedMatchIds = [];
    let myRelatedEntityIds = [];
    let statusByMatchId = {};

    return {
      refetch: async () => {
        if (shouldRefreshIds) {
          const [createdRes, playerRes, americanoRes, leagueTeamRes, leagueCreatedRes] = await Promise.all([
            supabase.from("matches").select("id").eq("creator_id", api.userId),
            supabase.from("match_players").select("match_id").eq("user_id", api.userId),
            supabase.from("americano_participants").select("tournament_id").eq("user_id", api.userId),
            supabase.from("league_teams").select("league_id").or(`player1_id.eq.${api.userId},player2_id.eq.${api.userId}`),
            supabase.from("leagues").select("id").eq("created_by", api.userId),
          ]);
          myRelatedMatchIds = [...new Set([...(createdRes.data || []).map(m => m.id), ...(playerRes.data || []).map(p => p.match_id)])];
          myRelatedEntityIds = [...new Set([...(americanoRes.data || []).map(p => p.tournament_id), ...(leagueTeamRes.data || []).map(t => t.league_id), ...(leagueCreatedRes.data || []).map(l => l.id)])];
          const matchRows = myRelatedMatchIds.length > 0 ? await fetchRowsInChunks(supabase, "matches", "id", myRelatedMatchIds, "id,status") : [];
          statusByMatchId = Object.fromEntries(matchRows.map(m => [String(m.id), (m.status ?? "open").toLowerCase()]));
          shouldRefreshIds = false;
        }

        let total = 0;
        if (myRelatedMatchIds.length > 0) {
          const { data } = await supabase.from("notifications").select("id,type,match_id,read").eq("user_id", api.userId).eq("read", false).in("type", KAMPE_NOTIFICATION_TYPES).in("match_id", myRelatedMatchIds);
          total += countRelevantKampeUnreadNotifications(data, statusByMatchId);
        }
        if (myRelatedEntityIds.length > 0) {
          const { data } = await supabase.from("notifications").select("id,type,entity_id,read").eq("user_id", api.userId).eq("read", false).in("type", KAMPE_ENTITY_NOTIFICATION_TYPES).in("entity_id", myRelatedEntityIds);
          total += countUnreadEntityNotifications(data, myRelatedEntityIds);
        }
        api.setCountSafe(total);
      },
      subscriptions: [
        { name: "kampe-notif-badge-" + api.userId, table: "notifications", filter: "user_id=eq." + api.userId, onEvent: () => { shouldRefreshIds = true; api.scheduleRefetch(); } }
      ],
      intervalMs: 10000,
      listenVisibility: true
    };
  }, []));

  return {
    unreadMessages,
    pendingLigaInvites,
    adminAttentionCount: 0, // Simplified for now as it needs more logic
    unreadNotifs,
    unreadKampeNotifs,
    hasKampeAttention: unreadKampeNotifs > 0 || pendingLigaInvites > 0,
    kampeTabBadge: unreadKampeNotifs + pendingLigaInvites > 0 ? unreadKampeNotifs + pendingLigaInvites : null,
  };
}
