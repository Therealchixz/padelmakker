import { useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { font, theme, btn, heading } from '../lib/platformTheme';
import { resolveDisplayName } from '../lib/platformUtils';
import { Home, Users, MapPin, Swords, Trophy, Settings, LogOut } from 'lucide-react';
import { NotificationBell } from '../components/NotificationBell';
import { HomeTab } from './HomeTab';
import { MakkereTab } from './MakkereTab';
import { BanerTab } from './BanerTab';
import { KampeTab } from './KampeTab';
import { RankingTab } from './RankingTab';
import { ProfilTab } from './ProfilTab';

export function DashboardPage({ user, onLogout, showToast }) {
  const { user: authUser, refreshProfileQuiet } = useAuth();
  const displayName = resolveDisplayName(user, authUser);
  const navigate = useNavigate();
  const location = useLocation();
  const pathTab = location.pathname.split("/")[2] || "hjem";
  const validTabs = ["hjem", "makkere", "baner", "kampe", "ranking", "profil"];
  const tab = validTabs.includes(pathTab) ? pathTab : "hjem";
  const setTab = useCallback((t) => navigate("/dashboard/" + t), [navigate]);

  /* Profil i React kan være forældet efter ændringer udefra (fx SQL-reset). Hent forfra på relevante faner uden fuld loading-skærm. */
  useEffect(() => {
    if (["hjem", "profil", "ranking", "kampe"].includes(tab)) refreshProfileQuiet();
  }, [tab, refreshProfileQuiet]);

  const tabs = [
    { id: "hjem",    label: "Hjem",        icon: <Home    size={16} /> },
    { id: "makkere", label: "Find Makker", icon: <Users   size={16} /> },
    { id: "baner",   label: "Baner",       icon: <MapPin  size={16} /> },
    { id: "kampe",   label: "Kampe",       icon: <Swords  size={16} /> },
    { id: "ranking", label: "Ranking",     icon: <Trophy  size={16} /> },
    { id: "profil",  label: "Profil",      icon: <Settings size={16} /> },
  ];

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", paddingBottom: "env(safe-area-inset-bottom)" }}>
      {/* Header */}
      <div className="pm-dash-header" style={{ padding: "clamp(10px,2.5vw,14px) clamp(12px,3vw,20px)", paddingTop: "max(clamp(10px,2.5vw,14px), env(safe-area-inset-top))", borderBottom: "1px solid " + theme.border, background: theme.surface, position: "sticky", top: 0, zIndex: 20 }}>
        <div className="pm-dash-brand" style={{ ...heading("clamp(16px,4vw,18px)"), color: theme.accent }}>🎾 PadelMakker</div>
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
        {tabs.map(t => (
          <button key={t.id} type="button" title={t.label} aria-label={t.label} onClick={() => setTab(t.id)} style={{ background: tab === t.id ? theme.accentBg : "transparent", color: tab === t.id ? theme.accent : theme.textMid, border: "none", padding: "8px 12px", borderRadius: "7px", fontSize: "clamp(12px,3.2vw,13px)", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", whiteSpace: "nowrap", fontFamily: font, flexShrink: 0, transition: "all 0.15s", letterSpacing: "-0.01em" }}>
            <span aria-hidden style={{ display: "flex" }}>{t.icon}</span>
            <span className="pm-tab-label">{t.label}</span>
          </button>
        ))}
      </div>

      <div className="pm-dash-main">
        {tab === "hjem"    && <HomeTab    user={user} setTab={setTab} />}
        {tab === "makkere" && <MakkereTab user={user} showToast={showToast} />}
        {tab === "baner"   && <BanerTab />}
        {tab === "kampe"   && <KampeTab   user={user} showToast={showToast} tabActive />}
        {tab === "ranking" && <RankingTab user={user} />}
        {tab === "profil"  && <ProfilTab  user={user} showToast={showToast} setTab={setTab} />}
      </div>
    </div>
  );
}
