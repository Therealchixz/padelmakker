import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, AlertCircle, Check, MessageCircle, TrendingUp, Bell, Trash2, Users, Trophy, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { theme, font, btn } from '../lib/platformTheme';
import {
  buildKampeFocusPath,
  notificationKampeTarget,
  kampeFocusFooterLabel,
  kampeFocusOpensChat,
} from '../lib/kampeFocusNavigation';
import { formatMatchDateDa, matchTimeLabel } from '../lib/matchDisplayUtils';

const DISMISSED_MAX = 400;

function dismissedStorageKey(userId) {
  return `pm_notif_dismissed_${userId}`;
}
function loadDismissedIds(userId) {
  try {
    const raw = localStorage.getItem(dismissedStorageKey(userId));
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : []);
  } catch { return new Set(); }
}
function addDismissedIds(userId, ids) {
  if (!userId || !ids.length) return;
  const s = loadDismissedIds(userId);
  for (const id of ids) s.add(id);
  const arr = [...s];
  const trimmed = arr.length > DISMISSED_MAX ? arr.slice(-DISMISSED_MAX) : arr;
  try { localStorage.setItem(dismissedStorageKey(userId), JSON.stringify(trimmed)); } catch { /* ignore */ }
}

function NotifIcon({ type }) {
  const iconStyle = { width: 18, height: 18, strokeWidth: 2.2, flexShrink: 0 };
  const wrap = (bg, color, icon) => (
    <div style={{ width: 36, height: 36, borderRadius: '50%', background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {icon}
    </div>
  );
  switch (type) {
    case 'result_submitted':
    case 'result_error_report':
      return wrap(theme.amberBg, theme.amberText, <AlertCircle style={iconStyle} />);
    case 'match_full':
    case 'result_confirmed':
    case 'team_invite_accepted':
    case 'league_full':
    case 'americano_full':
      return wrap(theme.greenBg, theme.green, <Check style={iconStyle} />);
    case 'match_join':
    case 'match_invite':
    case 'americano_invite':
    case 'team_invite':
      return wrap(theme.accentBg, theme.accent, <Users style={iconStyle} />);
    case 'match_chat':
    case 'match_chat_group':
      return wrap(theme.surfaceAlt, theme.textMid, <MessageCircle style={iconStyle} />);
    case 'match_cancelled':
      return wrap(theme.redBg, theme.red, <X style={iconStyle} />);
    case 'elo_change':
    case 'americano_completed':
    case 'league_completed':
      return wrap(theme.greenBg, theme.green, <TrendingUp style={iconStyle} />);
    case 'americano_started':
    case 'league_started':
      return wrap(theme.accentBg, theme.accent, <Trophy style={iconStyle} />);
    case 'makker_suggestion':
      return wrap(theme.purpleBg, theme.purple, <Users style={iconStyle} />);
    default:
      return wrap(theme.surfaceAlt, theme.textMid, <Bell style={iconStyle} />);
  }
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'nu';
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} t`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'I går';
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}u`;
}

export function NotifikationerPage({ onBack }) {
  const { user: authUser, profile } = useAuth();
  const navigate = useNavigate();
  const userId = authUser?.id;
  const [notifs, setNotifs] = useState([]);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [markingAll, setMarkingAll] = useState(false);
  const [matchMetaById, setMatchMetaById] = useState({});

  const load = useCallback(async () => {
    if (!userId) {
      setNotifs([]);
      setUnreadTotal(0);
      setLoading(false);
      setLoadError('');
      return;
    }
    setLoading(true);
    setLoadError('');
    try {
      const [{ data, error }, { count: unreadCount, error: unreadError }] = await Promise.all([
        supabase
          .from('notifications')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(40),
        supabase
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('read', false),
      ]);
      if (error) throw error;
      if (unreadError) throw unreadError;
      setUnreadTotal(unreadCount || 0);
      const dismissed = loadDismissedIds(userId);
      const filtered = (data || []).filter((n) => !dismissed.has(n.id));
      setNotifs(filtered);

      const matchIds = [...new Set(
        filtered.filter((n) => n?.type === 'match_chat' && n?.match_id != null).map((n) => String(n.match_id))
      )];
      if (!matchIds.length) { setMatchMetaById({}); return; }
      const { data: matchRows, error: matchError } = await supabase
        .from('matches').select('id, date, time, time_end, court_name').in('id', matchIds);
      if (matchError) throw matchError;
      const nextMeta = {};
      (matchRows || []).forEach((m) => { nextMeta[String(m.id)] = m; });
      setMatchMetaById(nextMeta);
    } catch (err) {
      setNotifs([]);
      setUnreadTotal(0);
      setMatchMetaById({});
      setLoadError(err?.message || 'Kunne ikke hente notifikationer.');
    } finally { setLoading(false); }
  }, [userId]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const onSync = () => { void load(); };
    window.addEventListener('pm-notifications-sync', onSync);
    return () => window.removeEventListener('pm-notifications-sync', onSync);
  }, [load]);

  const displayNotifs = useMemo(() => {
    const rows = [];
    const groupedByMatchId = new Map();
    for (const n of notifs) {
      const isMatchChat = n?.type === 'match_chat' && n?.match_id != null;
      if (!isMatchChat) { rows.push(n); continue; }
      const key = String(n.match_id);
      const existing = groupedByMatchId.get(key);
      if (!existing) {
        const group = { id: `match_chat:${key}`, type: 'match_chat_group', match_id: key, created_at: n.created_at, notifIds: [n.id], totalCount: 1, unreadCount: n.read ? 0 : 1, read: Boolean(n.read) };
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

  const goBack = useCallback(() => {
    if (typeof onBack === 'function') {
      onBack();
      return;
    }
    navigate('/dashboard/hjem', { replace: true });
  }, [navigate, onBack]);

  const markAllRead = async () => {
    if (!userId || unreadTotal === 0 || markingAll) return;
    setMarkingAll(true);
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', userId)
        .eq('read', false);
      if (error) throw error;
      setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadTotal(0);
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('pm-notifications-sync'));
    } catch (err) {
      console.warn('notifications markAllRead:', err?.message || err);
      void load();
    } finally {
      setMarkingAll(false);
    }
  };

  const deleteNotif = async (n) => {
    const ids = Array.isArray(n?.notifIds) ? n.notifIds : [n?.id].filter(Boolean);
    if (!ids.length || !userId) return;
    const idSet = new Set(ids);
    const unreadRemoved = notifs.filter((x) => idSet.has(x.id) && !x.read).length;
    setNotifs(prev => prev.filter(x => !idSet.has(x.id)));
    if (unreadRemoved > 0) setUnreadTotal((prev) => Math.max(0, prev - unreadRemoved));
    await supabase.from('notifications').delete().in('id', ids).eq('user_id', userId).select('id');
    addDismissedIds(userId, ids);
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('pm-notifications-sync'));
  };

  const markNotifRead = async (n) => {
    const ids = Array.isArray(n?.notifIds) ? n.notifIds : [n?.id].filter(Boolean);
    if (!ids.length || !userId || n.read) return;
    const idSet = new Set(ids);
    const unreadMarked = notifs.filter((x) => idSet.has(x.id) && !x.read).length;
    await supabase.from('notifications').update({ read: true }).in('id', ids).eq('user_id', userId);
    setNotifs((prev) => prev.map((x) => (idSet.has(x.id) ? { ...x, read: true } : x)));
    if (unreadMarked > 0) setUnreadTotal((prev) => Math.max(0, prev - unreadMarked));
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('pm-notifications-sync'));
  };

  const openNotif = async (n) => {
    if (!userId) return;
    await markNotifRead(n);

    if (n?.type === 'result_error_report' && profile?.role === 'admin') {
      navigate('/dashboard/admin?adminSub=result_errors'); return;
    }
    if (n?.type === 'user_report' && profile?.role === 'admin') {
      navigate('/dashboard/admin?adminSub=reports'); return;
    }
    if (n?.type === 'makker_suggestion' && n?.entity_id) {
      navigate(`/dashboard/makkere?profile=${encodeURIComponent(String(n.entity_id))}`); return;
    }
    const kampeTarget = notificationKampeTarget(n);
    if (kampeTarget) {
      navigate(buildKampeFocusPath(kampeTarget.format, kampeTarget.focusId, {
        openChat: kampeFocusOpensChat(n.type),
      }));
      return;
    }
    if (n?.type === 'elo_change') { navigate('/dashboard/profil'); return; }
    if (n?.type === 'result_submitted') { navigate('/dashboard/kampe'); return; }
  };

  const matchLabel = (matchId) => {
    const m = matchMetaById[String(matchId)];
    if (!m) return 'Din kamp';
    const court = m.court_name?.trim() || 'Ukendt bane';
    const datePart = m.date ? formatMatchDateDa(m.date) : '';
    const timePart = matchTimeLabel(m);
    if (datePart && timePart && timePart !== '—') return `${court} · ${datePart} kl. ${timePart}`;
    return datePart ? `${court} · ${datePart}` : court;
  };

  const cardStyle = (unread) => ({
    display: 'flex',
    gap: '12px',
    alignItems: 'flex-start',
    padding: '13px 15px',
    background: unread ? theme.accentBg + '40' : theme.surface,
    borderRadius: 14,
    border: '1px solid ' + (unread ? theme.accent + '30' : theme.border),
    borderLeft: unread ? `3px solid ${theme.navy}` : '1px solid ' + theme.border,
    margin: '0 18px 11px',
    position: 'relative',
  });

  return (
    <div className="pm-notifikationer-page" style={{ background: theme.bg, fontFamily: font }}>
      <div className="pm-notifikationer-head" style={{ borderBottom: '1px solid ' + theme.border, background: theme.surface, flexShrink: 0 }}>
        <button
          type="button"
          onClick={goBack}
          style={{ width: 36, height: 36, borderRadius: '50%', border: '1px solid ' + theme.border, background: theme.surfaceAlt, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
          aria-label="Tilbage til Hjem"
        >
          <ChevronLeft size={20} />
        </button>
        <h2 className="pm-notifikationer-head-title" style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>Notifikationer</h2>
        <button
          type="button"
          className="pm-notifikationer-mark-all"
          onClick={() => void markAllRead()}
          disabled={unreadTotal === 0 || markingAll}
          aria-label="Markér alle notifikationer som læst"
          style={{
            ...btn(false, { size: 'sm', radius: 'pill' }),
            minHeight: 40,
            color: theme.accent,
            fontWeight: 600,
            whiteSpace: 'nowrap',
            flexShrink: 0,
            opacity: unreadTotal === 0 || markingAll ? 0.45 : 1,
            cursor: unreadTotal === 0 || markingAll ? 'default' : 'pointer',
          }}
        >
          {markingAll ? 'Markerer…' : 'Læs alle'}
        </button>
      </div>

      <div className="pm-notifikationer-list" style={{ flex: 1, overflowY: 'auto', paddingTop: 12 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '32px 16px', color: theme.textLight, fontSize: 13 }}>Indlæser…</div>
        ) : loadError ? (
          <div style={{ padding: '0 18px' }}>
            <div className="pm-state-card pm-state-card--error">
              <div className="pm-state-icon" aria-hidden="true">⚠️</div>
              <div className="pm-state-title">Kunne ikke hente notifikationer</div>
              <div className="pm-state-copy">{loadError}</div>
              <div className="pm-state-actions">
                <button type="button" onClick={() => void load()} style={{ ...btn(true), fontSize: '13px' }}>
                  Prøv igen
                </button>
              </div>
            </div>
          </div>
        ) : displayNotifs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 16px', color: theme.textLight, fontSize: 13 }}>
            <Bell size={28} color={theme.textLight} style={{ marginBottom: 10 }} />
            <div style={{ fontWeight: 600 }}>Ingen notifikationer</div>
            <div style={{ marginTop: 4, fontSize: 12 }}>Du er helt à jour!</div>
          </div>
        ) : displayNotifs.map((n) => {
          const isMatchChatGroup = n.type === 'match_chat_group';
          const title = isMatchChatGroup
            ? (n.unreadCount > 0 ? 'Nye beskeder i kamp-chat' : 'Beskeder i kamp-chat')
            : n.title;
          const body = isMatchChatGroup ? matchLabel(n.match_id) : n.body;
          const kampeTarget = notificationKampeTarget(n);
          const isClickable = Boolean(kampeTarget)
            || (n.type === 'result_error_report' && profile?.role === 'admin')
            || (n.type === 'user_report' && profile?.role === 'admin')
            || n.type === 'makker_suggestion'
            || n.type === 'elo_change'
            || n.type === 'result_submitted';
          const isResultPending = n.type === 'result_submitted';
          const canMarkReadOnly = !n.read && !isClickable && !isResultPending;
          return (
            <div key={n.id} style={cardStyle(!n.read)}>
              <NotifIcon type={n.type} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: n.read ? 500 : 700, color: theme.text, marginBottom: 2 }}>{title}</div>
                <div style={{ fontSize: 12, color: theme.textMid, lineHeight: 1.45 }}>{body}</div>
                {isResultPending && (
                  <div style={{ marginTop: 9 }}>
                    <button
                      type="button"
                      onClick={() => void openNotif(n)}
                      style={{ fontSize: 12, fontWeight: 700, padding: '7px 13px', borderRadius: 8, border: '1px solid ' + theme.accent, background: theme.accent, color: theme.onAccent, cursor: 'pointer', fontFamily: font }}
                    >
                      Se resultat
                    </button>
                  </div>
                )}
                {isClickable && !isResultPending && (
                  <div style={{ fontSize: 10.5, color: theme.accent, marginTop: 6, fontWeight: 600 }}>
                    {kampeTarget ? kampeFocusFooterLabel(kampeTarget.format, n.type) : 'Tryk for at åbne →'}
                  </div>
                )}
                {canMarkReadOnly && (
                  <div style={{ fontSize: 10.5, color: theme.textMid, marginTop: 6, fontWeight: 600 }}>
                    Tryk for at markere som læst
                  </div>
                )}
              </div>
              <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                <time style={{ fontSize: 11, color: theme.textLight, fontWeight: 500, whiteSpace: 'nowrap' }}>{timeAgo(n.created_at)}</time>
                {!n.read && <div style={{ width: 8, height: 8, borderRadius: '50%', background: theme.accent }} />}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); void deleteNotif(n); }}
                  aria-label="Slet"
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: theme.textLight, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, minWidth: 40, position: 'relative', zIndex: 2 }}
                >
                  <Trash2 size={15} />
                </button>
              </div>
              {isClickable && !isResultPending && (
                <button
                  type="button"
                  onClick={() => void openNotif(n)}
                  aria-label="Åbn"
                  style={{ position: 'absolute', inset: 0, background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: 14 }}
                />
              )}
              {canMarkReadOnly && (
                <button
                  type="button"
                  onClick={() => void markNotifRead(n)}
                  aria-label="Markér som læst"
                  style={{ position: 'absolute', inset: 0, background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: 14 }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
