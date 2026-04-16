import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import { font, theme } from '../lib/platformTheme';
import { Bell, CheckCheck, Trash2 } from 'lucide-react';
import { ConfirmDialog } from './ConfirmDialog';
import {
  isPushSupported,
  getPushPermission,
  subscribeToPush,
  unsubscribeFromPush,
  isPushSubscribed,
} from '../lib/pushNotifications';

const DISMISSED_MAX = 400;

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
  const [confirmClear, setConfirmClear] = useState(false);
  const panelRef = useRef(null);

  // Push notification opt-in state
  const [pushSupported, setPushSupported] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushMessage, setPushMessage] = useState(null); // kortvarig bekræftelsesbesked
  const [pushBlocked, setPushBlocked] = useState(() => {
    try { return localStorage.getItem('pm_push_blocked') === '1'; } catch { return false; }
  });

  const unreadCount = notifs.filter(n => !n.read).length;

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
      setNotifs((data || []).filter((n) => !dismissed.has(n.id)));
    } catch (e) {
      console.warn("notifications load:", e);
      setNotifs([]);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  /* Realtime på notifications kræver at tabellen findes og Realtime er slået til — ellers kan nogle browsere crashe med hvid skærm */
  useEffect(() => {
    if (!userId) return undefined;
    const channel = supabase
      .channel("notifs-" + userId)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: "user_id=eq." + userId }, () => load())
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          try { supabase.removeChannel(channel); } catch { /* ignore */ }
        }
      });
    return () => { try { supabase.removeChannel(channel); } catch { /* ignore */ } };
  }, [userId, load]);

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
    navigator.standalone === true;

  // Tjek om push er understøttet og allerede aktiveret
  useEffect(() => {
    if (!isPushSupported()) return;
    setPushSupported(true);
    isPushSubscribed().then(setPushSubscribed);
  }, [userId]);

  // Genindlæs notifikationer når siden bliver synlig igen (fx skift af tab)
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
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
  };

  const deleteOne = async (id) => {
    if (!userId) return;
    addDismissedIds(userId, [id]);
    setNotifs((prev) => prev.filter((n) => n.id !== id));

    const { data, error } = await supabase
      .from("notifications")
      .delete()
      .eq("id", id)
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
    try {
      await supabase.from("notifications").update({ read: true }).eq("id", n.id).eq("user_id", userId);
      setNotifs((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
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

  const typeIcon = (type) => {
    switch (type) {
      case "match_join": return "⚔️";
      case "match_full": return "✅";
      case "result_submitted": return "📊";
      case "result_confirmed": return "🏆";
      case "elo_change": return "📈";
      case "match_cancelled": return "❌";
      case "welcome": return "👋";
      default: return "🔔";
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
    <div ref={panelRef} className="pm-notification-bell-root" style={{ position: "relative", flexShrink: 0 }}>
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
            isIOS && !isStandalone ? (
              <div style={{ padding: "10px 14px", borderBottom: "1px solid " + theme.border, background: "#FFFBEB" }}>
                <div style={{ fontSize: "12px", fontWeight: 700, color: "#92400E", marginBottom: "3px" }}>📱 iPhone: tilføj til hjemmeskærm</div>
                <div style={{ fontSize: "11px", color: "#78350F", lineHeight: 1.5 }}>
                  Tryk <strong>Del</strong> i Safari → <strong>"Føj til hjemmeskærm"</strong> → åbn derfra → aktiver notifikationer her
                </div>
              </div>
            ) : (
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
            )
          )}

          <div style={{ overflowY: "auto", flex: 1, WebkitOverflowScrolling: "touch" }}>
            {notifs.length === 0 ? (
              <div style={{ padding: "32px 16px", textAlign: "center", color: theme.textLight, fontSize: "13px" }}>
                <Bell size={24} color={theme.textLight} style={{ marginBottom: "8px" }} />
                <div>Ingen notifikationer endnu</div>
              </div>
            ) : notifs.map(n => {
              const hasMatch = Boolean(n.match_id);
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
                    <div style={{ fontSize: "13px", fontWeight: n.read ? 500 : 700, color: theme.text, marginBottom: "2px" }}>{n.title}</div>
                    <div style={{ fontSize: "12px", color: theme.textMid, lineHeight: 1.4 }}>{n.body}</div>
                    {hasMatch && (
                      <div style={{ fontSize: "10px", color: theme.accent, marginTop: "6px", fontWeight: 600 }}>Tryk for at gå til kampen →</div>
                    )}
                    <div style={{ fontSize: "10px", color: theme.textLight, marginTop: "4px" }}>{timeAgo(n.created_at)}</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px", flexShrink: 0 }}>
                    {!n.read && <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: theme.accent }} />}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); deleteOne(n.id); }}
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
