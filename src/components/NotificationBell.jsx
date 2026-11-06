import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import { theme } from '../lib/platformTheme';
import { Bell, X } from 'lucide-react';
import { BottomSheet } from './BottomSheet';
import { SwipeToDelete } from './SwipeToDelete';
import { ConfirmDialog } from './ConfirmDialog';
import { NotificationPushControls } from './NotificationPushControls';
import { normalizeNotificationPrefs } from '../lib/notificationPreferences';
import { NotificationSettingsDisclosure } from './NotificationSettingsPanel';
import { formatMatchDateDa, matchTimeLabel } from '../lib/matchDisplayUtils';
import { resolveNotificationClickTarget } from '../lib/notificationClickTarget';
import { formatNotificationAge, settleExpiredNotifications } from '../lib/notificationAge';
import {
  notificationKampeTarget,
  kampeFocusFooterLabel,
} from '../lib/kampeFocusNavigation';
import {
  deleteNotificationsForUser,
  emitNotificationsSync,
  loadDismissedIds,
  NOTIFICATIONS_SYNC_EVENT,
} from '../lib/notificationDismissStorage';

const NOTIF_REFRESH_INTERVAL_MS = 10000;
const REALTIME_RETRY_DELAY_MS = 1500;

export function NotificationBell({ tourForceOpen = false }) {
  const { user: authUser, profile } = useAuth();
  const navigate = useNavigate();
  const userId = authUser?.id;
  const [open, setOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [notifs, setNotifs] = useState([]);
  const [matchMetaById, setMatchMetaById] = useState({});
  const [realtimeVersion, setRealtimeVersion] = useState(0);
  const panelRef = useRef(null);
  const realtimeRetryTimerRef = useRef(null);
  const loadSeqRef = useRef(0);
  const loadRef = useRef(() => {});
  /** Unikt pr. mount — undgår Supabase-kanal-kollision ved dropdown remount. */
  const realtimeInstanceRef = useRef(
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `nb-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  );

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
    const seq = ++loadSeqRef.current;
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (loadSeqRef.current !== seq) return;
      if (error) {
        console.warn("notifications load:", error.message || error);
        setNotifs([]);
        return;
      }
      const dismissed = loadDismissedIds(userId);
      // Udløbne kampforslag markeres læst, så de ikke tæller i klokken.
      const { rows: filtered, expiredIds } = settleExpiredNotifications(
        (data || []).filter((n) => !dismissed.has(n.id)),
      );
      if (loadSeqRef.current !== seq) return;
      setNotifs(filtered);
      if (expiredIds.length) {
        void supabase.from("notifications").update({ read: true }).in("id", expiredIds).eq("user_id", userId);
      }

      const matchIds = [...new Set(
        filtered
          .filter((n) => n?.type === "match_chat" && n?.match_id != null)
          .map((n) => String(n.match_id))
      )];

      if (!matchIds.length) {
        if (loadSeqRef.current === seq) setMatchMetaById({});
        return;
      }

      const { data: matchRows, error: matchError } = await supabase
        .from("matches")
        .select("id, date, time, time_end, court_name")
        .in("id", matchIds);
      if (loadSeqRef.current !== seq) return;
      if (matchError) {
        console.warn("notification match meta load:", matchError.message || matchError);
        setMatchMetaById({});
        return;
      }
      const nextMeta = {};
      (matchRows || []).forEach((m) => {
        nextMeta[String(m.id)] = m;
      });
      if (loadSeqRef.current === seq) setMatchMetaById(nextMeta);
    } catch (e) {
      if (loadSeqRef.current !== seq) return;
      console.warn("notifications load:", e);
      setNotifs([]);
      setMatchMetaById({});
    }
  }, [userId]);

  loadRef.current = load;

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!tourForceOpen) return;
    setOpen(true);
    void load();
  }, [tourForceOpen, load]);

  /* Realtime på notifications med retry, så mobil ikke kræver app-reopen ved timeout. */
  useEffect(() => {
    if (!userId) return undefined;
    let cancelled = false;
    const channelName = `notifs-${userId}-${realtimeInstanceRef.current}-v${realtimeVersion}`;
    const stale = supabase.getChannels().find((ch) => ch.topic === `realtime:${channelName}`);
    if (stale) {
      try { supabase.removeChannel(stale); } catch { /* ignore */ }
    }
    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: "user_id=eq." + userId }, () => loadRef.current())
      .subscribe((status) => {
        if (cancelled) return;
        if (status === "SUBSCRIBED") {
          void loadRef.current();
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
  }, [userId, realtimeVersion]);

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
    const onNotificationsSync = () => syncIfVisible();
    if (typeof window !== "undefined") {
      window.addEventListener("focus", syncIfVisible);
      window.addEventListener("pageshow", syncIfVisible);
      window.addEventListener("online", syncIfVisible);
      window.addEventListener(NOTIFICATIONS_SYNC_EVENT, onNotificationsSync);
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
        window.removeEventListener(NOTIFICATIONS_SYNC_EVENT, onNotificationsSync);
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
    if (!userId || unreadCount === 0) return;
    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", userId)
      .eq("read", false);
    if (error) {
      console.warn("notifications markAllRead:", error.message || error);
      void load();
      return;
    }
    setNotifs(prev => prev.map(n => ({ ...n, read: true })));
    emitNotificationsSync();
  };

  const clearAll = async () => {
    if (!userId || !notifs.length) return;
    const ids = notifs.map((n) => n.id);
    const prevNotifs = notifs;
    setNotifs([]);

    const deleted = await deleteNotificationsForUser(supabase, userId, ids);
    if (!deleted.length) {
      setNotifs(prevNotifs);
      void load();
    }
  };

  const deleteNotificationItem = async (notif) => {
    if (!userId) return;
    const ids = Array.isArray(notif?.notifIds)
      ? notif.notifIds.filter((id) => typeof id === "string")
      : [notif?.id].filter((id) => typeof id === "string");
    if (!ids.length) return;

    const idSet = new Set(ids);
    const prevNotifs = notifs;
    setNotifs((prev) => prev.filter((n) => !idSet.has(n.id)));

    const deleted = await deleteNotificationsForUser(supabase, userId, ids);
    if (!deleted.length) {
      setNotifs(prevNotifs);
      void load();
    }
  };

  const markNotifRead = async (n) => {
    const ids = Array.isArray(n?.notifIds)
      ? n.notifIds.filter((id) => typeof id === "string")
      : [n?.id].filter((id) => typeof id === "string");
    if (!ids.length || !userId) return;
    try {
      await supabase.from("notifications").update({ read: true }).in("id", ids).eq("user_id", userId);
      const idSet = new Set(ids);
      setNotifs((prev) => prev.map((x) => (idSet.has(x.id) ? { ...x, read: true } : x)));
      emitNotificationsSync();
    } catch { /* ignore */ }
  };

  const openNotificationTarget = async (n) => {
    if (!userId) return;
    const target = resolveNotificationClickTarget(n, { isAdmin: profile?.role === 'admin' });
    if (!target) return;
    await markNotifRead(n);
    setOpen(false);
    setSheetOpen(false);
    navigate(target.path);
  };


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

  const closePanels = () => { setOpen(false); setSheetOpen(false); };
  const ctaLabel = (n, clickTarget, kampeTarget) => {
    let label;
    if (clickTarget.kind === 'admin') label = n.type === 'result_error_report' ? 'Åbn Admin → Fejl' : 'Åbn Admin → Anmeldelser';
    else if (kampeTarget) label = kampeFocusFooterLabel(kampeTarget.format, n.type);
    else if (clickTarget.kind === 'profile') label = 'Åbn din profil';
    else if (clickTarget.kind === 'proposal-popup') label = 'Bekræft kampen';
    else label = 'Åbn';
    label = label.replace(/^Tryk for at /, '').replace(/\s*→\s*$/, '');
    return label.charAt(0).toUpperCase() + label.slice(1) + ' →';
  };

  const panelContent = (
    <>
      <div className="pm-notif-v4-head">
        <h2 className="pm-notif-v4-title">Notifikationer</h2>
        <div className="pm-notif-v4-head-actions">
          {unreadCount > 0 ? (
            <button type="button" className="pm-notif-v4-read" onClick={() => void markAllRead()} aria-label="Markér alle notifikationer som læst">
              Markér læst
            </button>
          ) : null}
          <button type="button" className="pm-notif-v4-close" onClick={closePanels} aria-label="Luk notifikationer">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="pm-notif-v4-list">
        {displayNotifs.length === 0 ? (
          <div className="pm-notif-v4-empty">
            <Bell size={22} aria-hidden="true" />
            <span>Ingen notifikationer endnu</span>
          </div>
        ) : displayNotifs.map((n) => {
          const clickTarget = resolveNotificationClickTarget(n, { isAdmin: profile?.role === 'admin' });
          const kampeTarget = notificationKampeTarget(n);
          const isMatchChatGroup = n.type === "match_chat_group";
          const count = n.unreadCount > 0 ? n.unreadCount : n.totalCount;
          const itemTitle = isMatchChatGroup
            ? (n.unreadCount > 0 ? "Nye beskeder i kamp-chat" : "Beskeder i kamp-chat")
            : n.title;
          const itemBody = isMatchChatGroup
            ? `${matchLabel(n.match_id)} · ${count} ${count === 1 ? "besked" : "beskeder"}`
            : n.body;
          const body = (
            <>
              <span className={'pm-notif-v4-dot' + (n.read ? '' : ' is-unread')} aria-hidden />
              <span className="pm-notif-v4-main">
                <span className="pm-notif-v4-t">{!n.read ? <span className="pm-sr-only">Ulæst: </span> : null}{itemTitle}</span>
                {itemBody ? <span className="pm-notif-v4-b">{itemBody}</span> : null}
                {clickTarget ? <span className="pm-notif-v4-cta">{ctaLabel(n, clickTarget, kampeTarget)}</span> : null}
              </span>
              <span className="pm-notif-v4-time">{formatNotificationAge(n.created_at)}</span>
            </>
          );
          return (
            <SwipeToDelete key={n.id} onDelete={() => void deleteNotificationItem(n)} label={`Slet notifikation: ${itemTitle}`}>
              {clickTarget ? (
                <button type="button" className="pm-notif-v4-item" onClick={() => { void openNotificationTarget(n); }}>{body}</button>
              ) : (
                <div className="pm-notif-v4-item">{body}</div>
              )}
            </SwipeToDelete>
          );
        })}
      </div>
      {/* Push og indstillinger: samme byggeklodser som notifikationssiden. */}
      <div className="pm-notif-v4-extras">
        <NotificationPushControls
          userId={userId}
          notificationPrefs={normalizeNotificationPrefs(profile?.notification_prefs)}
          variant="dropdown"
          onAfterTest={() => void load()}
        />
        <NotificationSettingsDisclosure />
      </div>
      <div className="pm-notif-v4-foot">
        <button type="button" className="pm-notif-v4-link" onClick={() => { closePanels(); navigate('/dashboard/notifikationer'); }}>
          Se alle
        </button>
        {notifs.length > 0 ? (
          <button type="button" className="pm-notif-v4-link pm-notif-v4-link--muted" onClick={() => setConfirmClear(true)}>
            Ryd alle
          </button>
        ) : null}
      </div>
    </>
  );

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
        className="pm-hit-44"
        type="button"
        onClick={() => {
          if (window.innerWidth < 768) {
            setSheetOpen(true);
            load();
          } else {
            setOpen(!open);
            if (!open) load();
          }
        }}
        style={{ ...iconBtn, position: "relative" }}
        aria-label={unreadCount > 0 ? `Notifikationer, ${unreadCount} ulæste` : "Notifikationer"}
        aria-expanded={open || sheetOpen}
      >
        <Bell size={20} color={theme.textMid} strokeWidth={2} />
        {unreadCount > 0 && (
          <span style={{ position: "absolute", top: "-2px", right: "-2px", minWidth: "17px", height: "17px", padding: "0 4px", borderRadius: "999px", background: theme.accentSolid, color: theme.onAccent, fontSize: "9px", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1, boxSizing: "border-box" }}>
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          data-tour="notification-panel"
          className="pm-notification-panel pm-notif-v4 pm-notif-v4--dropdown"
          role="dialog"
          aria-label="Notifikationer"
        >
          {panelContent}
        </div>
      )}
    </div>
    <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} ariaLabel="Notifikationer" className="pm-notif-v4 pm-notif-v4--sheet">
      {panelContent}
    </BottomSheet>
    </>
  );
}
