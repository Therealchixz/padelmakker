import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import { font, theme } from '../lib/platformTheme';
import { Bell, CheckCheck, Trash2 } from 'lucide-react';
import { ConfirmDialog } from './ConfirmDialog';
import { formatMatchDateDa, matchTimeLabel } from '../lib/matchDisplayUtils';
import {
  isPushSupported,
  getPushPermission,
  subscribeToPush,
  unsubscribeFromPush,
  isPushSubscribed,
} from '../lib/pushNotifications';

const DISMISSED_MAX = 400;
const NOTIF_REFRESH_INTERVAL_MS = 10000;
const REALTIME_RETRY_DELAY_MS = 1500;

/** Lokalt afviste id'er — så de ikke kommer tilbage ved refresh hvis DELETE fejler stille (0 rækker / RLS). */
function dismissedStorageKey(userId) {
  return `pm_notif_dismissed_${userId}`;
}

function loadDismissedIds(userId) {
  if (!userId) return new Set();
  try {
    const raw = localStorage.getItem(dismissedStorageKey(userId));
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

function addDismissedIds(userId, ids) {
  if (!userId || !ids.length) return;
  const s = loadDismissedIds(userId);
  for (const id of ids) s.add(id);
  const arr = [...s];
  const trimmed = arr.length > DISMISSED_MAX ? arr.slice(-DISMISSED_MAX) : arr;
  try {
    localStorage.setItem(dismissedStorageKey(userId), JSON.stringify(trimmed));
  } catch {
    /* ignore quota */
  }
}

export function NotificationBell() {
  const { user: authUser } = useAuth();
  const navigate = useNavigate();
  const userId = authUser?.id;
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState([]);
  const [matchMetaById, setMatchMetaById] = useState({});
  const [realtimeVersion, setRealtimeVersion] = useState(0);
  const [confirmClear, setConfirmClear] = useState(false);
  const panelRef = useRef(null);
  const realtimeRetryTimerRef = useRef(null);

  // Push notification opt-in state
  const [pushSupported, setPushSupported] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushMessage, setPushMessage] = useState(null); // kortvarig bekræftelsesbesked
  const [pushBlocked, setPushBlocked] = useState(() => {
    try { return localStorage.getItem('pm_push_blocked') === '1'; } catch { return false; }
  });

  const unreadCount = notifs.filter(n => !n.read).length;

  const displayNotifs = useMemo(() => {
    const rows = [];
    const groupedByMatchId = new Map();

    for (const n of notifs) {
      const isMatchChat = n?.type === "match_chat" && n?.match_id != null;
      if (!isMatchChat) {
        rows.push(n);
        continue;
      }

      const key = String(n.match_id);
      const existing = groupedByMatchId.get(key);
      if (!existing) {
        const group = {
          id: `match_chat:${key}`,
          type: "match_chat_group",
          match_id: key,
          created_at: n.created_at,
          notifIds: [n.id],
          totalCount: 1,
          unreadCount: n.read ? 0 : 1,
          read: Boolean(n.read),
        };
        groupedByMatchId.set(key, group);
        rows.push(group);
      } else {
        existing.notifIds.push(n.id);
        existing.totalCount += 1;
        if (!n.read) existing.unreadCount += 1;
        existing.read = existing.unreadCount === 0;
      }
    }

    return rows;
  }, [notifs]);

  // App-ikon badge (virker på installerede PWA'er — Android og iOS 16.4+)
  useEffect(() => {
    if (!('setAppBadge' in navigator)) return;
    if (unreadCount > 0) {
      navigator.setAppBadge(unreadCount).catch(() => {});
    } else {
      navigator.clearAppBadge().catch(() => {});
    }
  }, [unreadCount]);

  // Ryd badge når bruger logger ud
  useEffect(() => {
    if (!userId && 'clearAppBadge' in navigator) {
      navigator.clearAppBadge().catch(() => {});
    }
  }, [userId]);

  const load = useCallback(async () => {
    if (!userId) {
      setNotifs([]);
      setMatchMetaById({});
      return;
    }
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) {
        console.warn("notifications load:", error.message || error);
        setNotifs([]);
        return;
      }
      const dismissed = loadDismissedIds(userId);
      const filtered = (data || []).filter((n) => !dismissed.has(n.id));
      setNotifs(filtered);

      const matchIds = [...new Set(
        filtered
          .filter((n) => n?.type === "match_chat" && n?.match_id != null)
          .map((n) => String(n.match_id))
      )];

      if (!matchIds.length) {
        setMatchMetaById({});
        return;
      }

      const { data: matchRows, error: matchError } = await supabase
        .from("matches")
        .select("id, date, time, time_end, court_name")
        .in("id", matchIds);
      if (matchError) {
        console.warn("notification match meta load:", matchError.message || matchError);
        setMatchMetaById({});
        return;
      }
      const nextMeta = {};
      (matchRows || []).forEach((m) => {
        nextMeta[String(m.id)] = m;
      });
      setMatchMetaById(nextMeta);
    } catch (e) {
      console.warn("notifications load:", e);
      setNotifs([]);
      setMatchMetaById({});
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  /* Realtime på notifications med retry, så mobil ikke kræver app-reopen ved timeout. */
  useEffect(() => {
    if (!userId) return undefined;
    let cancelled = false;
    const channel = supabase
      .channel(`notifs-${userId}-${realtimeVersion}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: "user_id=eq." + userId }, () => load())
      .subscribe((status) => {
        if (cancelled) return;
        if (status === "SUBSCRIBED") {
          void load();
          return;
        }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          if (realtimeRetryTimerRef.current) clearTimeout(realtimeRetryTimerRef.current);
          realtimeRetryTimerRef.current = setTimeout(() => {
            if (!cancelled) setRealtimeVersion((v) => v + 1);
          }, REALTIME_RETRY_DELAY_MS);
        }
      });
    return () => {
      cancelled = true;
      if (realtimeRetryTimerRef.current) {
        clearTimeout(realtimeRetryTimerRef.current);
        realtimeRetryTimerRef.current = null;
      }
      try { supabase.removeChannel(channel); } catch { /* ignore */ }
    };
  }, [userId, load, realtimeVersion]);

  // Tjek om push er understøttet og allerede aktiveret
  useEffect(() => {
    if (!isPushSupported()) return;
    setPushSupported(true);
    isPushSubscribed().then(setPushSubscribed);
  }, [userId]);

  // Fallback refresh på mobil: fokus/synlighed/online + let polling mens siden er synlig.
  useEffect(() => {
    const syncIfVisible = () => {
      if (typeof document === "undefined" || document.visibilityState === "visible") {
        void load();
      }
    };
    const onVisibilityChange = () => syncIfVisible();

    const intervalId = setInterval(syncIfVisible, NOTIF_REFRESH_INTERVAL_MS);
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibilityChange);
    }
    if (typeof window !== "undefined") {
      window.addEventListener("focus", syncIfVisible);
      window.addEventListener("pageshow", syncIfVisible);
      window.addEventListener("online", syncIfVisible);
    }
    return () => {
      clearInterval(intervalId);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibilityChange);
      }
      if (typeof window !== "undefined") {
        window.removeEventListener("focus", syncIfVisible);
        window.removeEventListener("pageshow", syncIfVisible);
        window.removeEventListener("online", syncIfVisible);
      }
    };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const closeIfOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", closeIfOutside);
    document.addEventListener("touchstart", closeIfOutside, { passive: true });
    return () => {
      document.removeEventListener("mousedown", closeIfOutside);
      document.removeEventListener("touchstart", closeIfOutside);
    };
  }, [open]);

  const markAllRead = async () => {
    const unread = notifs.filter(n => !n.read).map(n => n.id);
    if (!unread.length) return;
    await supabase.from("notifications").update({ read: true }).in("id", unread);
    setNotifs(prev => prev.map(n => ({ ...n, read: true })));
    emitNotificationsSync();
  };

  const deleteNotificationItem = async (notif) => {
    if (!userId) return;
    const ids = Array.isArray(notif?.notifIds)
      ? notif.notifIds.filter((id) => typeof id === "string")
      : [notif?.id].filter((id) => typeof id === "string");
    if (!ids.length) return;

    addDismissedIds(userId, ids);
    const idSet = new Set(ids);
    setNotifs((prev) => prev.filter((n) => !idSet.has(n.id)));
    emitNotificationsSync();

    const { data, error } = await supabase
      .from("notifications")
      .delete()
      .in("id", ids)
      .eq("user_id", userId)
      .select("id");

    if (error) {
      console.warn("notifications delete:", error.message || error);
      return;
    }
    if (!data?.length) {
      console.warn("notifications delete: ingen række slettet (tjek RLS / kør notifications_add_delete_policy.sql)");
    }
  };

  const clearAll = async () => {
    if (!userId || !notifs.length) return;
    const ids = notifs.map((n) => n.id);
    addDismissedIds(userId, ids);
    setNotifs([]);
    emitNotificationsSync();

    const { data, error } = await supabase
      .from("notifications")
      .delete()
      .in("id", ids)
      .eq("user_id", userId)
      .select("id");

    if (error) {
      console.warn("notifications clear:", error.message || error);
      return;
    }
    if (!data?.length) {
      console.warn("notifications clear: ingen rækker slettet (tjek RLS / kør notifications_add_delete_policy.sql)");
    }
  };

  const openNotificationMatch = async (n) => {
    if (!n?.match_id || !userId) return;
    const ids = Array.isArray(n?.notifIds)
      ? n.notifIds.filter((id) => typeof id === "string")
      : [n?.id].filter((id) => typeof id === "string");
    try {
      if (ids.length > 0) {
        await supabase.from("notifications").update({ read: true }).in("id", ids).eq("user_id", userId);
        const idSet = new Set(ids);
        setNotifs((prev) => prev.map((x) => (idSet.has(x.id) ? { ...x, read: true } : x)));
        emitNotificationsSync();
      }
    } catch { /* ignore */ }
    setOpen(false);
    /* ?focus= så KampeTab reagerer også hvis man allerede er på Kampe-fanen */
    navigate("/dashboard/kampe?focus=" + encodeURIComponent(String(n.match_id)));
  };

  const timeAgo = useCallback((dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "nu";
    if (mins < 60) return mins + " min";
    const hours = Math.floor(mins / 60);
    if (hours < 24) return hours + "t";
    return Math.floor(hours / 24) + "d";
  }, []);

  const matchLabel = useCallback((matchId) => {
    const m = matchMetaById[String(matchId)];
    if (!m) return "Din kamp";
    const court = m.court_name && String(m.court_name).trim() !== "" ? String(m.court_name).trim() : "Ukendt bane";
    const datePart = m.date ? formatMatchDateDa(m.date) : "";
    const timePart = matchTimeLabel(m);
    if (datePart && timePart && timePart !== "—") return `${court} · ${datePart} kl. ${timePart}`;
    if (datePart) return `${court} · ${datePart}`;
    return court;
  }, [matchMetaById]);

  const typeIcon = (type) => {
    switch (type) {
      case "match_join": return "\u2694\uFE0F";
      case "match_invite": return "\u2694\uFE0F";
      case "match_chat": return "\uD83D\uDCAC";
      case "match_chat_group": return "\uD83D\uDCAC";
      case "match_full": return "\u2705";
      case "result_submitted": return "\uD83D\uDCCA";
      case "result_confirmed": return "\uD83C\uDFC6";
      case "elo_change": return "\uD83D\uDCC8";
      case "match_cancelled": return "\u274C";
      case "welcome": return "\uD83D\uDC4B";
      case "team_invite": return "\uD83C\uDFBE";
      default: return "\uD83D\uDD14";
    }
  };

  const showPushMessage = (msg) => {
    setPushMessage(msg);
    setTimeout(() => setPushMessage(null), 3000);
  };

  const handleEnablePush = async () => {
    if (!userId || pushLoading) return;
    setPushLoading(true);
    try {
      const result = await subscribeToPush(userId);
      const subscribed = await isPushSubscribed();
      setPushSubscribed(subscribed);
      if (subscribed) {
        showPushMessage('Push-beskeder aktiveret!');
      } else if (result === 'denied') {
        showPushMessage('Tilladelse afvist — tjek browserindstillinger');
      } else if (result === 'blocked') {
        try { localStorage.setItem('pm_push_blocked', '1'); } catch { /* ignore */ }
        setPushBlocked(true);
      } else if (result === 'timeout') {
        showPushMessage('Timeout — prøv igen');
      } else {
        showPushMessage('Kunne ikke aktivere — prøv igen');
      }
    } finally {
      setPushLoading(false);
    }
  };

  const handleDisablePush = async () => {
    if (pushLoading) return;
    setPushLoading(true);
    try {
      await unsubscribeFromPush();
      setPushSubscribed(false);
      showPushMessage('Push-beskeder slået fra');
    } finally {
      setPushLoading(false);
    }
  };

  const iconBtn = {
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: "6px",
    borderRadius: "8px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    WebkitTapHighlightColor: "transparent",
  };

  const emitNotificationsSync = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("pm-notifications-sync"));
    }
  };

  return (
    <>
    {confirmClear && (
      <ConfirmDialog
        message="Vil du slette alle notifikationer?"
        confirmLabel="Ja, ryd alle"
        cancelLabel="Fortryd"
        danger
        onConfirm={() => { setConfirmClear(false); clearAll(); }}
        onCancel={() => setConfirmClear(false)}
      />
    )}
    <div ref={panelRef} className="pm-notification-bell-root" data-tour="notification-bell" style={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => { setOpen(!open); if (!open) load(); }}
        style={{ ...iconBtn, position: "relative" }}
        aria-label="Notifikationer"
        aria-expanded={open}
      >
        <Bell size={20} color={theme.textMid} strokeWidth={2} />
        {unreadCount > 0 && (
          <span style={{ position: "absolute", top: "-2px", right: "-2px", minWidth: "17px", height: "17px", padding: "0 4px", borderRadius: "999px", background: theme.red, color: "#fff", fontSize: "9px", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1, boxSizing: "border-box" }}>
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="pm-notification-panel"
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            marginTop: "8px",
            width: "min(360px, calc(100vw - 24px))",
            maxHeight: "min(420px, 70dvh)",
            background: theme.surface,
            borderRadius: "12px",
            boxShadow: theme.shadowLg,
            border: "1px solid " + theme.border,
            zIndex: 200,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px", padding: "12px 14px", borderBottom: "1px solid " + theme.border }}>
            <span style={{ fontSize: "14px", fontWeight: 700, color: theme.text, flex: "1 1 auto", minWidth: "100px" }}>Notifikationer</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center", marginLeft: "auto" }}>
              {unreadCount > 0 && (
                <button type="button" onClick={markAllRead} style={{ background: "none", border: "none", color: theme.accent, fontSize: "11px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", fontFamily: font, padding: "4px 6px" }}>
                  <CheckCheck size={13} /> Læst
                </button>
              )}
              {notifs.length > 0 && (
                <button type="button" onClick={() => setConfirmClear(true)} style={{ background: "none", border: "none", color: theme.textMid, fontSize: "11px", fontWeight: 600, cursor: "pointer", fontFamily: font, padding: "4px 6px" }}>
                  Ryd alle
                </button>
              )}
            </div>
          </div>

          {/* Push opt-in / opt-out banner */}
          {pushSupported && !pushBlocked && getPushPermission() !== 'denied' && (
            <div style={{ padding: "10px 14px", borderBottom: "1px solid " + theme.border, background: pushMessage ? (pushSubscribed ? "#DCFCE7" : theme.surface) : pushSubscribed ? theme.accentBg + "30" : theme.warmBg + "40", transition: "background 0.3s", display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "16px" }}>{pushMessage && pushSubscribed ? "✅" : pushMessage ? "🔕" : pushSubscribed ? "🔔" : "🔔"}</span>
              <span style={{ flex: 1, fontSize: "12px", color: pushMessage ? (pushSubscribed ? "#166534" : theme.textMid) : theme.textMid, lineHeight: 1.4, fontWeight: pushMessage ? 600 : 400 }}>
                {pushMessage || (pushSubscribed ? "Push-beskeder er aktiveret" : "Få push-beskeder selv når du ikke er på siden")}
              </span>
              {!pushMessage && (
                <button
                  type="button"
                  onClick={pushSubscribed ? handleDisablePush : handleEnablePush}
                  disabled={pushLoading}
                  style={{ background: pushSubscribed ? theme.border : theme.accent, color: pushSubscribed ? theme.textMid : "#fff", border: "none", borderRadius: "6px", padding: "5px 10px", fontSize: "11px", fontWeight: 700, cursor: pushLoading ? "default" : "pointer", opacity: pushLoading ? 0.6 : 1, whiteSpace: "nowrap", fontFamily: font }}
                >
                  {pushLoading ? "…" : pushSubscribed ? "Slå fra" : "Aktiver"}
                </button>
              )}
            </div>
          )}

          <div style={{ overflowY: "auto", flex: 1, WebkitOverflowScrolling: "touch" }}>
            {displayNotifs.length === 0 ? (
              <div style={{ padding: "32px 16px", textAlign: "center", color: theme.textLight, fontSize: "13px" }}>
                <Bell size={24} color={theme.textLight} style={{ marginBottom: "8px" }} />
                <div>Ingen notifikationer endnu</div>
              </div>
            ) : displayNotifs.map(n => {
              const hasMatch = Boolean(n.match_id);
              const isMatchChatGroup = n.type === "match_chat_group";
              const itemTitle = isMatchChatGroup
                ? (n.unreadCount > 0 ? "Nye beskeder i kamp-chat" : "Beskeder i kamp-chat")
                : n.title;
              const itemBody = isMatchChatGroup ? matchLabel(n.match_id) : n.body;
              const itemMeta = isMatchChatGroup
                ? `${n.unreadCount > 0 ? n.unreadCount : n.totalCount} ${
                    (n.unreadCount > 0 ? n.unreadCount : n.totalCount) === 1 ? "besked" : "beskeder"
                  }`
                : "";
              return (
              <div
                key={n.id}
                role={hasMatch ? "button" : undefined}
                tabIndex={hasMatch ? 0 : undefined}
                onClick={hasMatch ? () => openNotificationMatch(n) : undefined}
                onKeyDown={hasMatch ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openNotificationMatch(n); } } : undefined}
                style={{
                  padding: "10px 12px 10px 14px",
                  borderBottom: "1px solid " + theme.border + "80",
                  background: n.read ? "transparent" : theme.accentBg + "40",
                  transition: "background 0.2s",
                  cursor: hasMatch ? "pointer" : "default",
                }}
              >
                <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                  <span style={{ fontSize: "18px", flexShrink: 0, marginTop: "1px" }}>{typeIcon(n.type)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "13px", fontWeight: n.read ? 500 : 700, color: theme.text, marginBottom: "2px" }}>{itemTitle}</div>
                    <div style={{ fontSize: "12px", color: theme.textMid, lineHeight: 1.4 }}>{itemBody}</div>
                    {isMatchChatGroup && (
                      <div style={{ fontSize: "10px", color: theme.textLight, marginTop: "4px" }}>{itemMeta}</div>
                    )}
                    {hasMatch && (
                      <div style={{ fontSize: "10px", color: theme.accent, marginTop: "6px", fontWeight: 600 }}>Tryk for at gå til kampen →</div>
                    )}
                    <div style={{ fontSize: "10px", color: theme.textLight, marginTop: "4px" }}>{timeAgo(n.created_at)}</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px", flexShrink: 0 }}>
                    {!n.read && <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: theme.accent }} />}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); deleteNotificationItem(n); }}
                      title="Slet"
                      aria-label="Slet notifikation"
                      style={{ ...iconBtn, padding: "8px", color: theme.textLight }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );})}
          </div>
        </div>
      )}
    </div>
    </>
  );
}
