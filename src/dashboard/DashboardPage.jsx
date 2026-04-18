import { useEffect, useCallback, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { font, theme, btn, heading } from '../lib/platformTheme';
import { resolveDisplayName } from '../lib/platformUtils';
import { Home, Users, MapPin, Swords, Trophy, Settings, LogOut, MessageCircle, Medal, ChevronDown } from 'lucide-react';
import { NotificationBell } from '../components/NotificationBell';
import { HomeTab } from './HomeTab';
import { MakkereTab } from './MakkereTab';
import { BanerTab } from './BanerTab';
import { KampeTab } from './KampeTab';
import { RankingTab } from './RankingTab';
import { ProfilTab } from './ProfilTab';
import { AdminTab } from './AdminTab';
import { BeskedTab } from './BeskedTab';
import { LigaTab } from './LigaTab';
import { ShieldCheck } from 'lucide-react';
import { useUnreadMessageCount } from '../lib/chatUtils';
import { supabase } from '../lib/supabase';

function usePendingLigaInvites(userId) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!userId) { setCount(0); return; }
    let cancelled = false;
    const fetch = async () => {
      const { count: c } = await supabase
        .from('league_teams')
        .select('id', { count: 'exact', head: true })
        .eq('player2_id', userId)
        .eq('status', 'pending');
      if (!cancelled) setCount(c || 0);
    };
    fetch();
    const channel = supabase
      .channel('liga-invites-' + userId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'league_teams', filter: 'player2_id=eq.' + userId }, fetch)
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [userId]);
  return count;
}

function usePendingKampeBadge(userId) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!userId) { setCount(0); return; }
    let cancelled = false;
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
      } catch { /* stille fejl */ }
    };
    refetch();
    const ch1 = supabase.channel('kampe-badge-req-' + userId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'match_join_requests' }, refetch)
      .subscribe();
    const ch2 = supabase.channel('kampe-badge-res-' + userId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'match_results' }, refetch)
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch1); supabase.removeChannel(ch2); };
  }, [userId]);
  return count;
}

const PRIMARY_TAB_IDS = ["hjem", "kampe", "liga", "beskeder", "profil"];

const tabBtnStyle = (active) => ({
  background: "transparent",
  color: active ? theme.accent : theme.textMid,
  border: "none",
  borderBottom: active ? "2px solid " + theme.accent : "2px solid transparent",
  marginBottom: "-1px",
  padding: "6px 9px",
  borderRadius: 0,
  fontSize: "clamp(11px,2.8vw,12px)",
  fontWeight: active ? 700 : 500,
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
  const pathTab = location.pathname.split("/")[2] || "hjem";
  const validTabs = ["hjem", "makkere", "baner", "kampe", "ranking", "liga", "beskeder", "profil", "admin"];
  const tab = validTabs.includes(pathTab) ? pathTab : "hjem";
  const setTab = useCallback((t) => navigate("/dashboard/" + t), [navigate]);

  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef(null);

  useEffect(() => {
    if (!moreOpen) return;
    const handler = (e) => {
      if (moreRef.current && !moreRef.current.contains(e.target)) setMoreOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [moreOpen]);

  useEffect(() => {
    if (["hjem", "profil", "ranking", "kampe", "makkere", "admin"].includes(tab)) refreshProfileQuiet();
  }, [tab, refreshProfileQuiet]);

  const allTabs = [
    { id: "hjem",     label: "Hjem",        icon: <Home          size={15} /> },
    { id: "kampe",    label: "Kampe",        icon: <Swords        size={15} />, badge: pendingKampe > 0 ? pendingKampe : null },
    { id: "liga",     label: "Liga",         icon: <Medal         size={15} />, badge: pendingLigaInvites > 0 ? pendingLigaInvites : null },
    { id: "beskeder", label: "Beskeder",     icon: <MessageCircle size={15} />, badge: unreadMessages > 0 ? unreadMessages : null },
    { id: "profil",   label: "Profil",       icon: <Settings      size={15} /> },
    { id: "makkere",  label: "Find Makker",  icon: <Users         size={15} /> },
    { id: "baner",    label: "Book Bane",    icon: <MapPin        size={15} /> },
    { id: "ranking",  label: "Ranking",      icon: <Trophy        size={15} /> },
  ];
  if (isAdmin) allTabs.push({ id: "admin", label: "Admin", icon: <ShieldCheck size={15} /> });

  const primaryTabs = allTabs.filter(t => PRIMARY_TAB_IDS.includes(t.id));
  const moreTabs    = allTabs.filter(t => !PRIMARY_TAB_IDS.includes(t.id));
  const moreIsActive = moreTabs.some(t => t.id === tab);
  const moreBadge = moreTabs.reduce((s, t) => s + (t.badge || 0), 0);

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", paddingBottom: "env(safe-area-inset-bottom)" }}>
      {/* Header */}
      <div className="pm-dash-header" style={{ padding: "clamp(10px,2.5vw,14px) clamp(12px,3vw,20px)", paddingTop: "max(clamp(10px,2.5vw,14px), env(safe-area-inset-top))", borderBottom: "1px solid " + theme.border, background: theme.surface, position: "sticky", top: 0, zIndex: 20 }}>
        <button type="button" onClick={() => setTab("hjem")} className="pm-dash-brand" style={{ ...heading("clamp(16px,4vw,18px)"), color: theme.accent, display: "flex", alignItems: "center", gap: "8px", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: font }}>
          <img src="/logo-nav.png" alt="PadelMakker" style={{ height: "40px", width: "auto", objectFit: "contain" }} /> PadelMakker
        </button>
        <div className="pm-dash-user">
          <span className="pm-dash-name">{displayName}</span>
          <div className="pm-dash-header-actions">
            <NotificationBell />
            <button type="button" onClick={onLogout} style={{ ...btn(false), padding: "6px 12px", fontSize: "12px", flexShrink: 0 }}>
              <LogOut size={13} /> Log ud
            </button>
          </div>
        </div>
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
        <div ref={moreRef} style={{ position: "relative", flexShrink: 0 }}>
          <button
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

          {moreOpen && (
            <div style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, background: theme.surface, border: "1px solid " + theme.border, borderRadius: "10px", boxShadow: theme.shadowLg || "0 8px 32px rgba(0,0,0,0.12)", zIndex: 30, minWidth: "160px", overflow: "hidden" }}>
              {moreTabs.map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => { setTab(t.id); setMoreOpen(false); }}
                  style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%", padding: "11px 16px", background: tab === t.id ? theme.accentBg : "transparent", color: tab === t.id ? theme.accent : theme.text, border: "none", borderBottom: "1px solid " + theme.border, fontSize: "13px", fontWeight: tab === t.id ? 700 : 500, cursor: "pointer", fontFamily: font, textAlign: "left" }}
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
            </div>
          )}
        </div>
      </div>

      <div className="pm-dash-main">
        {tab === "hjem"     && <HomeTab    user={user} setTab={setTab} />}
        {tab === "makkere"  && <MakkereTab user={user} showToast={showToast} />}
        {tab === "baner"    && <BanerTab />}
        {tab === "kampe"    && <KampeTab   user={user} showToast={showToast} tabActive />}
        {tab === "ranking"  && <RankingTab user={user} />}
        {tab === "liga"     && <LigaTab    user={user} showToast={showToast} />}
        {tab === "beskeder" && <BeskedTab  user={user} />}
        {tab === "profil"   && <ProfilTab  user={user} showToast={showToast} setTab={setTab} />}
        {tab === "admin"    && isAdmin && <AdminTab />}
      </div>
    </div>
  );
}
