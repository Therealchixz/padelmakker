import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useConfirm } from '../lib/ConfirmDialogProvider';
import { theme, font, btn, inputStyle, heading, labelStyle } from '../lib/platformTheme';
import { Search, User, Swords, Trash2, ShieldAlert, ShieldCheck, Edit2, X, ChevronUp, ChevronDown, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { AvatarCircle } from '../components/AvatarCircle';
import { formatEloHistoryDate } from '../lib/eloHistoryUtils';

import {
  LEVELS,
  PLAY_STYLES,
  REGIONS,
  levelStringFromNum,
} from '../lib/platformConstants';

function adminDisplayName(user) {
  const fullName = String(user?.full_name || '').trim();
  if (fullName) return fullName;
  const name = String(user?.name || '').trim();
  if (name) return name;
  const email = String(user?.email || '').trim();
  if (email) {
    const emailPrefix = email.split('@')[0]?.trim();
    if (emailPrefix) return emailPrefix;
  }
  return 'Spiller';
}

function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 6);
}

function isSixDigitPin(value) {
  return /^\d{6}$/.test(String(value || ''));
}

function formatDateTimeDa(value) {
  if (!value) return 'Ukendt';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return 'Ukendt';
  return new Intl.DateTimeFormat('da-DK', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(dt);
}

export function AdminTab() {
  const { user } = useAuth();
  const ask = useConfirm();
  const [activeSubTab, setActiveSubTab] = useState('users'); // 'users' | 'matches' | 'console'
  const [matchSubTab, setMatchSubTab] = useState('2v2'); // '2v2' | 'americano' | 'liga'
  const [_loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [matches, setMatches] = useState([]);
  const [americanoTournaments, setAmericanoTournaments] = useState([]);
  const [ligaLeagues, setLigaLeagues] = useState([]);
  const [search, setSearch] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'full_name', direction: 'asc' });
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);
  const [deletePinOpen, setDeletePinOpen] = useState(false);
  const [deleteTargetUser, setDeleteTargetUser] = useState(null);
  const [deletePin, setDeletePin] = useState('');
  const [deletePinError, setDeletePinError] = useState('');
  const [deletePinBusy, setDeletePinBusy] = useState(false);
  const [consoleLoading, setConsoleLoading] = useState(false);
  const [consoleError, setConsoleError] = useState('');
  const [ratingFlags, setRatingFlags] = useState([]);
  const [flagSearch, setFlagSearch] = useState('');
  const [flagStatusFilter, setFlagStatusFilter] = useState('open');
  const [flagSourceFilter, setFlagSourceFilter] = useState('all');
  const [flagSeverityFilter, setFlagSeverityFilter] = useState('all');
  const [expandedFlags, setExpandedFlags] = useState({});
  const [flagNotes, setFlagNotes] = useState({});
  const [flagBusyId, setFlagBusyId] = useState(null);
  const [reviewerMap, setReviewerMap] = useState({});
  const [consoleStats, setConsoleStats] = useState({
    totalPlayers: 0,
    bannedPlayers: 0,
    pendingResults: 0,
    openMatches: 0,
    inProgressMatches: 0,
    completedMatches24h: 0,
    americanoOpen: 0,
    americanoActive: 0,
    americanoCompleted7d: 0,
    openFlags: 0,
    highFlags: 0,
  });

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('profiles').select('*');
    if (!error) setUsers(data || []);
    setLoading(false);
  };

  const fetchMatches = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('matches')
      .select('*, match_results(*), match_players(*, profiles(full_name))')
      .order('completed_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(50);
    if (!error) setMatches(data || []);
    setLoading(false);
  };

  const fetchAmericano = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('americano_tournaments')
      .select('id, name, status, tournament_date, updated_at, created_at')
      .order('created_at', { ascending: false })
      .limit(50);
    if (!error) setAmericanoTournaments(data || []);
    setLoading(false);
  };

  const fetchLiga = async () => {
    setLoading(true);
    const { data: leagues, error } = await supabase
      .from('leagues')
      .select('id, name, status, season_type, start_date, end_date, current_round, total_rounds, created_at')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) { setLoading(false); return; }
    const lIds = (leagues || []).map(l => l.id);
    let teamCounts = {};
    if (lIds.length) {
      const { data: teams } = await supabase.from('league_teams').select('league_id').in('league_id', lIds);
      for (const t of (teams || [])) teamCounts[t.league_id] = (teamCounts[t.league_id] || 0) + 1;
    }
    setLigaLeagues((leagues || []).map(l => ({ ...l, team_count: teamCounts[l.id] || 0 })));
    setLoading(false);
  };

  const fetchAdminConsole = async () => {
    setConsoleLoading(true);
    setConsoleError('');
    try {
      const [
        flagsRes,
        profilesRes,
        matchesRes,
        resultsRes,
        americanoRes,
      ] = await Promise.all([
        supabase
          .from('rating_admin_flags')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(300),
        supabase
          .from('profiles')
          .select('id, is_banned'),
        supabase
          .from('matches')
          .select('id, status, completed_at')
          .order('created_at', { ascending: false })
          .limit(500),
        supabase
          .from('match_results')
          .select('id, confirmed')
          .eq('confirmed', false),
        supabase
          .from('americano_tournaments')
          .select('id, status, updated_at')
          .order('created_at', { ascending: false })
          .limit(300),
      ]);

      if (flagsRes.error) {
        const msg = String(flagsRes.error.message || '');
        if (msg.toLowerCase().includes('rating_admin_flags')) {
          setConsoleError('Flag-tabellen mangler i DB. Kør SQL-scriptet supabase/sql/elo_guardrails_admin_flags.sql i Supabase SQL Editor.');
          setRatingFlags([]);
        } else {
          setConsoleError('Kunne ikke hente flags: ' + msg);
        }
      } else {
        setRatingFlags(flagsRes.data || []);
      }

      const profiles = profilesRes.data || [];
      const matchesRows = matchesRes.data || [];
      const pendingResults = resultsRes.data || [];
      const americanoRows = americanoRes.data || [];
      const now = Date.now();
      const oneDayAgo = now - 24 * 60 * 60 * 1000;
      const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

      const nextStats = {
        totalPlayers: profiles.length,
        bannedPlayers: profiles.filter((p) => !!p.is_banned).length,
        pendingResults: pendingResults.length,
        openMatches: matchesRows.filter((m) => m.status === 'open' || m.status === 'full').length,
        inProgressMatches: matchesRows.filter((m) => m.status === 'in_progress').length,
        completedMatches24h: matchesRows.filter((m) => m.status === 'completed' && m.completed_at && new Date(m.completed_at).getTime() >= oneDayAgo).length,
        americanoOpen: americanoRows.filter((t) => t.status === 'open').length,
        americanoActive: americanoRows.filter((t) => t.status === 'active').length,
        americanoCompleted7d: americanoRows.filter((t) => t.status === 'completed' && t.updated_at && new Date(t.updated_at).getTime() >= sevenDaysAgo).length,
        openFlags: (flagsRes.data || []).filter((f) => f.status === 'open').length,
        highFlags: (flagsRes.data || []).filter((f) => f.status === 'open' && f.severity === 'high').length,
      };
      setConsoleStats(nextStats);

      const reviewerIds = [...new Set((flagsRes.data || []).map((f) => f.reviewed_by).filter(Boolean))];
      if (reviewerIds.length > 0) {
        const { data: reviewerRows } = await supabase
          .from('profiles')
          .select('id, full_name, name, email')
          .in('id', reviewerIds);
        const nextReviewerMap = {};
        for (const row of (reviewerRows || [])) {
          nextReviewerMap[row.id] = adminDisplayName(row);
        }
        setReviewerMap(nextReviewerMap);
      } else {
        setReviewerMap({});
      }
    } catch (err) {
      setConsoleError('Admin-konsol fejl: ' + (err?.message || 'ukendt fejl'));
    } finally {
      setConsoleLoading(false);
    }
  };

  const deleteAmericano = async (id, name) => {
    const ok = await ask({
      message: `Slet turneringen "${name}"? Dette kan ikke fortrydes.`,
      confirmLabel: 'Ja, slet',
      danger: true,
    });
    if (!ok) return;
    const { error } = await supabase.from('americano_tournaments').delete().eq('id', id);
    if (error) await ask({ message: 'Fejl: ' + error.message, notice: true });
    else fetchAmericano();
  };

  const deleteLiga = async (id, name) => {
    const ok = await ask({
      message: `Slet ligaen "${name}"? Hold og kampe slettes også. Dette kan ikke fortrydes.`,
      confirmLabel: 'Ja, slet',
      danger: true,
    });
    if (!ok) return;
    const { error } = await supabase.from('leagues').delete().eq('id', id);
    if (error) await ask({ message: 'Fejl: ' + error.message, notice: true });
    else fetchLiga();
  };

  useEffect(() => {
    if (activeSubTab === 'users') fetchUsers();
    else if (activeSubTab === 'matches') {
      if (matchSubTab === '2v2') fetchMatches();
      else if (matchSubTab === 'americano') fetchAmericano();
      else fetchLiga();
    } else {
      fetchAdminConsole();
    }
  }, [activeSubTab, matchSubTab]);

  const toggleAdmin = async (user) => {
    const newRole = user.role === 'admin' ? 'player' : 'admin';
    const displayName = adminDisplayName(user);
    const confirmMsg = user.role === 'admin' 
        ? `Er du sikker på, at du vil fjerne admin-rettigheder fra ${displayName}?`
        : `Vil du give admin-rettigheder til ${displayName}?`;
    
    const ok = await ask({
      message: confirmMsg,
      confirmLabel: user.role === 'admin' ? 'Ja, fjern admin' : 'Ja, gør til admin',
      danger: user.role === 'admin',
    });
    if (!ok) return;

    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', user.id);

    if (!error) fetchUsers();
  };

  const deleteUser = async (targetUser) => {
    if (!targetUser?.id) return;
    const displayName = adminDisplayName(targetUser);

    const ok = await ask({
      message:
        `Slet spilleren "${displayName}" permanent?\n\n` +
        'Dette sletter også login, profil og tilknyttede kampdata for spilleren.',
      confirmLabel: 'Ja, slet spiller',
      danger: true,
    });
    if (!ok) return;
    setDeleteTargetUser(targetUser);
    setDeletePin('');
    setDeletePinError('');
    setDeletePinOpen(true);
  };

  const closeDeletePinModal = (force = false) => {
    if (deletePinBusy && !force) return;
    setDeletePinOpen(false);
    setDeleteTargetUser(null);
    setDeletePin('');
    setDeletePinError('');
  };

  const confirmDeleteWithPin = async () => {
    if (!deleteTargetUser?.id) return;
    const pin = digitsOnly(deletePin);
    if (!isSixDigitPin(pin)) {
      setDeletePinError('Indtast din 6-cifrede admin-kode.');
      return;
    }

    setDeletePinBusy(true);
    setDeletePinError('');
    try {
      const { data, error } = await supabase.rpc('admin_delete_user', {
        p_user_id: deleteTargetUser.id,
        p_pin: pin,
      });

      if (error) {
        const msg = String(error?.message || '');
        const fnMissing = msg.includes('Could not find the function public.admin_delete_user');
        await ask({
          message: fnMissing
            ? 'DB-funktion mangler eller er for gammel: kør SQL-scriptet "supabase/sql/admin_delete_user.sql" i Supabase SQL Editor først.'
            : `Kunne ikke slette spilleren: ${msg || 'ukendt fejl'}`,
          notice: true,
        });
        return;
      }

      if (data?.error) {
        setDeletePinError(String(data.error));
        return;
      }

      const displayName = adminDisplayName(deleteTargetUser);
      if (editingUser?.id === deleteTargetUser.id) setEditingUser(null);
      closeDeletePinModal(true);
      await ask({ message: `Spiller slettet: ${displayName}`, notice: true });
      fetchUsers();
    } finally {
      setDeletePinBusy(false);
    }
  };

  const deleteMatch = async (matchId) => {
    const ok = await ask({
      message: 'Er du helt sikker på at du vil slette denne kamp? Dette kan ikke fortrydes og vil påvirke ELO.',
      confirmLabel: 'Ja, slet kamp',
      danger: true,
    });
    if (!ok) return;

    const { error } = await supabase
      .from('matches')
      .delete()
      .eq('id', matchId);

    if (error) {
      console.error('Delete error:', error);
      await ask({ message: 'Kunne ikke slette kampen: ' + error.message, notice: true });
    } else {
      fetchMatches();
    }
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      const { error: profErr } = await supabase
        .from('profiles')
        .update({
          full_name: editingUser.full_name,
          name: editingUser.full_name,
          level: Number(editingUser.level),
          play_style: editingUser.play_style,
          area: editingUser.area,
          bio: editingUser.bio,
          court_side: editingUser.court_side,
          is_banned: editingUser.is_banned,
          ban_reason: editingUser.ban_reason
        })
        .eq('id', editingUser.id);

      if (profErr) throw profErr;

      const { error: eloErr } = await supabase
        .rpc('admin_adjust_elo', { 
          p_user_id: editingUser.id, 
          p_new_elo: Number(editingUser.elo_rating) 
        });

      if (eloErr) throw eloErr;
      
      setEditingUser(null);
      setTimeout(() => fetchUsers(), 300);
    } catch (err) {
      await ask({ message: 'Fejl ved opdatering: ' + (err.message || 'Ukendt fejl'), notice: true });
    }
  };

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedUsers = useMemo(() => {
    let sortableUsers = [...users];
    if (sortConfig.key) {
      sortableUsers.sort((a, b) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];

        // Special håndtering af roller (Admin > Player)
        if (sortConfig.key === 'role') {
          const priority = { admin: 1, player: 2 };
          aValue = priority[aValue] || 3;
          bValue = priority[bValue] || 3;
        } else if (sortConfig.key === 'full_name') {
          aValue = adminDisplayName(a).toLowerCase();
          bValue = adminDisplayName(b).toLowerCase();
        } else {
          aValue = aValue == null ? '' : aValue;
          bValue = bValue == null ? '' : bValue;
        }

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableUsers;
  }, [users, sortConfig]);

  const filteredUsers = sortedUsers.filter((u) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      adminDisplayName(u).toLowerCase().includes(q) ||
      String(u.name || '').toLowerCase().includes(q) ||
      String(u.email || '').toLowerCase().includes(q)
    );
  });

  const SortIcon = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) return <ChevronDown size={12} style={{ opacity: 0.3, marginLeft: '4px' }} />;
    return sortConfig.direction === 'asc' 
      ? <ChevronUp size={12} style={{ marginLeft: '4px', color: theme.accent }} /> 
      : <ChevronDown size={12} style={{ marginLeft: '4px', color: theme.accent }} />;
  };

  const thStyle = () => ({
    padding: "12px", 
    fontSize: "12px", 
    color: theme.textMid, 
    cursor: "pointer", 
    userSelect: "none",
    transition: "background 0.2s"
  });

  const formatCreatedAt = (createdAt) => {
    if (!createdAt) return 'Ukendt';
    const date = new Date(createdAt);
    if (Number.isNaN(date.getTime())) return 'Ukendt';
    return new Intl.DateTimeFormat('da-DK', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const filteredFlags = useMemo(() => {
    return (ratingFlags || []).filter((flag) => {
      if (flagStatusFilter !== 'all' && flag.status !== flagStatusFilter) return false;
      if (flagSourceFilter !== 'all' && flag.source !== flagSourceFilter) return false;
      if (flagSeverityFilter !== 'all' && flag.severity !== flagSeverityFilter) return false;
      const q = flagSearch.trim().toLowerCase();
      if (!q) return true;
      const blob = [
        flag.reason,
        flag.source,
        flag.severity,
        flag.status,
        flag.match_id,
        flag.tournament_id,
        JSON.stringify(flag.payload || {}),
      ].join(' ').toLowerCase();
      return blob.includes(q);
    });
  }, [ratingFlags, flagSearch, flagStatusFilter, flagSourceFilter, flagSeverityFilter]);

  const flagStatusBadgeColor = (status) => {
    if (status === 'open') return { text: theme.red, bg: theme.redBg };
    if (status === 'reviewed') return { text: theme.warm, bg: theme.warmBg };
    return { text: theme.accent, bg: theme.accentBg };
  };

  const flagSeverityBadgeColor = (severity) => {
    if (severity === 'high') return { text: theme.red, bg: theme.redBg };
    if (severity === 'medium') return { text: theme.warm, bg: theme.warmBg };
    return { text: theme.textMid, bg: theme.surfaceAlt };
  };

  const statusLabelDa = (status) => {
    if (status === 'open') return 'Åben';
    if (status === 'reviewed') return 'Gennemgået';
    if (status === 'closed') return 'Lukket';
    return status || 'Ukendt';
  };

  const severityLabelDa = (severity) => {
    if (severity === 'high') return 'Høj';
    if (severity === 'medium') return 'Mellem';
    if (severity === 'low') return 'Lav';
    return severity || 'Ukendt';
  };

  const updateFlag = async (flag, nextStatus) => {
    if (!flag?.id) return;
    const note = String(flagNotes[flag.id] || '').trim();
    setFlagBusyId(flag.id);
    try {
      const updates = {
        status: nextStatus,
      };
      if (nextStatus === 'open') {
        updates.reviewed_at = null;
        updates.reviewed_by = null;
      } else {
        updates.reviewed_at = new Date().toISOString();
        updates.reviewed_by = user?.id || null;
      }
      if (note) updates.review_note = note;

      const { error } = await supabase
        .from('rating_admin_flags')
        .update(updates)
        .eq('id', flag.id);
      if (error) {
        await ask({ message: 'Kunne ikke opdatere flag: ' + error.message, notice: true });
        return;
      }
      await fetchAdminConsole();
      if (nextStatus !== 'open') {
        setExpandedFlags((prev) => ({ ...prev, [flag.id]: false }));
      }
    } finally {
      setFlagBusyId(null);
    }
  };

  return (
    <div style={{ padding: "16px", maxWidth: "1000px", margin: "0 auto", fontFamily: font }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h2 style={heading("20px")}>Admin Panel</h2>
        <div style={{ display: "flex", gap: "8px", background: theme.bg, padding: "4px", borderRadius: "10px" }}>
          <button 
            onClick={() => setActiveSubTab('users')}
            style={{ ...btn(activeSubTab === 'users'), padding: "6px 16px", fontSize: "13px" }}
          >
            <User size={14} style={{ marginRight: "6px" }} /> Brugere
          </button>
          <button 
            onClick={() => setActiveSubTab('matches')}
            style={{ ...btn(activeSubTab === 'matches'), padding: "6px 16px", fontSize: "13px" }}
          >
            <Swords size={14} style={{ marginRight: "6px" }} /> Kampe
          </button>
          <button
            onClick={() => setActiveSubTab('console')}
            style={{ ...btn(activeSubTab === 'console'), padding: "6px 16px", fontSize: "13px" }}
          >
            <AlertTriangle size={14} style={{ marginRight: "6px" }} /> Konsol
          </button>
        </div>
      </div>

      {activeSubTab === 'users' ? (
        <>
          <div style={{ position: "relative", marginBottom: "16px" }}>
            <Search size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: theme.textMid }} />
            <input 
              type="text"
              placeholder="Søg..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ ...inputStyle, paddingLeft: "38px" }}
            />
          </div>

          {/* Sorterings-bar til mobil */}
          {isMobile && (
            <div style={{ display: "flex", gap: "8px", marginBottom: "12px", overflowX: "auto", paddingBottom: "4px" }}>
              <button 
                onClick={() => requestSort('full_name')}
                style={{ ...btn(sortConfig.key === 'full_name'), fontSize: "11px", padding: "4px 10px", whiteSpace: "nowrap" }}
              >
                Navn <SortIcon columnKey="full_name" />
              </button>
              <button 
                onClick={() => requestSort('elo_rating')}
                style={{ ...btn(sortConfig.key === 'elo_rating'), fontSize: "11px", padding: "4px 10px", whiteSpace: "nowrap" }}
              >
                ELO <SortIcon columnKey="elo_rating" />
              </button>
              <button 
                onClick={() => requestSort('role')}
                style={{ ...btn(sortConfig.key === 'role'), fontSize: "11px", padding: "4px 10px", whiteSpace: "nowrap" }}
              >
                Rolle <SortIcon columnKey="role" />
              </button>
            </div>
          )}

          {!isMobile ? (
            <div style={{ background: theme.surface, borderRadius: "12px", border: "1px solid " + theme.border, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left", background: theme.surfaceAlt, borderBottom: "1px solid " + theme.border }}>
                    <th style={thStyle()} onClick={() => requestSort('full_name')}>
                      <div style={{ display: "flex", alignItems: "center" }}>SPILLER <SortIcon columnKey="full_name" /></div>
                    </th>
                    <th style={thStyle()} onClick={() => requestSort('elo_rating')}>
                      <div style={{ display: "flex", alignItems: "center" }}>ELO <SortIcon columnKey="elo_rating" /></div>
                    </th>
                    <th style={thStyle()} onClick={() => requestSort('role')}>
                      <div style={{ display: "flex", alignItems: "center" }}>ROLLE <SortIcon columnKey="role" /></div>
                    </th>
                    <th style={{ padding: "12px", fontSize: "12px", color: theme.textMid, textAlign: "right" }}>HANDLING</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(u => (
                    <tr key={u.id} style={{ borderBottom: "1px solid " + theme.border }}>
                      <td style={{ padding: "12px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <AvatarCircle avatar={u.avatar || '🎾'} size={32} />
                          <div>
                            <div style={{ fontSize: "14px", fontWeight: 600 }}>{adminDisplayName(u)}</div>
                            <div style={{ fontSize: "11px", color: theme.textMid }}>{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "12px", fontSize: "14px", fontWeight: 700 }}>{u.elo_rating || 1000}</td>
                      <td style={{ padding: "12px" }}>
                        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                          <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "100px", background: u.role === 'admin' ? theme.accentBg : theme.surfaceAlt, border: "1px solid " + theme.border, color: u.role === 'admin' ? theme.accent : theme.textMid, textTransform: "uppercase" }}>
                            {u.role}
                          </span>
                          {u.is_banned && (
                            <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "100px", background: theme.redBg, color: theme.red, textTransform: "uppercase" }}>
                              Bannet
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: "12px", textAlign: "right" }}>
                        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                          <button onClick={() => setEditingUser({ ...u })} style={{ background: "none", border: "none", cursor: "pointer", color: theme.accent }}><Edit2 size={18} /></button>
                          <button onClick={() => toggleAdmin(u)} style={{ background: "none", border: "none", cursor: "pointer", color: u.role === 'admin' ? theme.red : theme.accent }}>
                            {u.role === 'admin' ? <ShieldAlert size={18} /> : <ShieldCheck size={18} />}
                          </button>
                          <button onClick={() => deleteUser(u)} style={{ background: "none", border: "none", cursor: "pointer", color: theme.red }} title="Slet spiller">
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {filteredUsers.map(u => (
                <div key={u.id} style={{ background: theme.surface, borderRadius: "12px", border: "1px solid " + theme.border, padding: "16px", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                    <div style={{ display: "flex", gap: "12px" }}>
                      <AvatarCircle avatar={u.avatar || '🎾'} size={40} />
                      <div>
                        <div style={{ fontSize: "15px", fontWeight: 700 }}>{adminDisplayName(u)}</div>
                        <div style={{ fontSize: "12px", color: theme.textMid }}>{u.email}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "18px", fontWeight: 800, color: theme.accent }}>{u.elo_rating || 1000}</div>
                      <div style={{ fontSize: "10px", color: theme.textLight, fontWeight: 700, textTransform: "uppercase" }}>ELO</div>
                    </div>
                  </div>
                  
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <span style={{ fontSize: "10px", fontWeight: 700, padding: "3px 8px", borderRadius: "100px", background: u.role === 'admin' ? theme.accentBg : theme.surfaceAlt, border: "1px solid " + theme.border, color: u.role === 'admin' ? theme.accent : theme.textMid, textTransform: "uppercase" }}>
                        {u.role}
                      </span>
                      {u.is_banned && (
                        <span style={{ fontSize: "10px", fontWeight: 700, padding: "3px 8px", borderRadius: "100px", background: theme.redBg, color: theme.red, textTransform: "uppercase" }}>
                          Bannet
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        onClick={() => deleteUser(u)}
                        style={{ background: theme.redBg, border: "none", borderRadius: "8px", padding: "8px", color: theme.red, display: "flex", alignItems: "center" }}
                        title="Slet spiller"
                      >
                        <Trash2 size={18} />
                      </button>
                      <button 
                        onClick={() => toggleAdmin(u)} 
                        style={{ background: u.role === 'admin' ? theme.redBg : theme.accentBg, border: "none", borderRadius: "8px", padding: "8px", color: u.role === 'admin' ? theme.red : theme.accent, display: "flex", alignItems: "center" }}
                        title={u.role === 'admin' ? "Fjern admin" : "Gør til admin"}
                      >
                        {u.role === 'admin' ? <ShieldAlert size={18} /> : <ShieldCheck size={18} />}
                      </button>
                      <button 
                        onClick={() => setEditingUser({ ...u })} 
                        style={{ background: theme.accent, border: "none", borderRadius: "8px", padding: "8px 16px", color: theme.onAccent, display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: 600 }}
                      >
                        <Edit2 size={16} /> Rediger
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : activeSubTab === 'matches' ? (
        <div>
          {/* Match type sub-tabs */}
          <div style={{ display: "flex", gap: "6px", marginBottom: "16px", flexWrap: "wrap" }}>
            {[
              { id: '2v2',       label: '2v2-kampe' },
              { id: 'americano', label: 'Americano' },
              { id: 'liga',      label: '🏆 Liga' },
            ].map(t => (
              <button key={t.id} onClick={() => setMatchSubTab(t.id)}
                style={{ ...btn(matchSubTab === t.id), padding: "7px 14px", fontSize: "13px" }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* ── Americano ── */}
          {matchSubTab === 'americano' && (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <h3 style={{ fontSize: "14px", fontWeight: 800, color: theme.accent, marginBottom: "4px", textTransform: "uppercase" }}>Americano-turneringer</h3>
              {americanoTournaments.length === 0 && <div style={{ color: theme.textLight, fontSize: "13px" }}>Ingen turneringer fundet.</div>}
              {americanoTournaments.map(t => {
                const statusLabel = t.status === 'completed' ? 'Afsluttet' : t.status === 'active' ? 'Aktiv' : 'Åben';
                const statusColor = t.status === 'completed' ? theme.accent : t.status === 'active' ? theme.green : theme.textMid;
                return (
                  <div key={t.id} style={{ background: theme.surface, padding: "14px 16px", borderRadius: "12px", border: "1px solid " + theme.border, display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "14px", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</div>
                      <div style={{ fontSize: "11px", color: theme.textMid, marginTop: "2px" }}>
                        {t.tournament_date || formatEloHistoryDate(t.created_at)}
                        <span style={{ marginLeft: "8px", fontWeight: 700, color: statusColor, background: statusColor + '15', padding: "1px 6px", borderRadius: "4px", textTransform: "uppercase", fontSize: "10px" }}>{statusLabel}</span>
                      </div>
                    </div>
                    <button onClick={() => deleteAmericano(t.id, t.name)}
                      style={{ color: theme.red, background: theme.redBg, border: "none", borderRadius: "8px", padding: "8px", cursor: "pointer", flexShrink: 0 }}
                      title="Slet turnering">
                      <Trash2 size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Liga ── */}
          {matchSubTab === 'liga' && (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <h3 style={{ fontSize: "14px", fontWeight: 800, color: theme.accent, marginBottom: "4px", textTransform: "uppercase" }}>Ligaer</h3>
              {ligaLeagues.length === 0 && <div style={{ color: theme.textLight, fontSize: "13px" }}>Ingen ligaer fundet.</div>}
              {ligaLeagues.map(l => {
                const statusLabel = l.status === 'completed' ? 'Afsluttet' : l.status === 'active' ? 'Aktiv' : 'Tilmelding';
                const statusColor = l.status === 'completed' ? theme.textMid : l.status === 'active' ? theme.green : theme.warm;
                return (
                  <div key={l.id} style={{ background: theme.surface, padding: "14px 16px", borderRadius: "12px", border: "1px solid " + theme.border, display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "14px", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.name}</div>
                      <div style={{ fontSize: "11px", color: theme.textMid, marginTop: "2px", display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                        <span style={{ fontWeight: 700, color: statusColor, background: statusColor + '18', padding: "1px 6px", borderRadius: "4px", textTransform: "uppercase", fontSize: "10px" }}>{statusLabel}</span>
                        <span>{l.team_count} hold</span>
                        {l.status === 'active' && <span>Runde {l.current_round}{l.total_rounds ? `/${l.total_rounds}` : ''}</span>}
                        <span>{formatEloHistoryDate(l.start_date)} – {formatEloHistoryDate(l.end_date)}</span>
                      </div>
                    </div>
                    <button onClick={() => deleteLiga(l.id, l.name)}
                      style={{ color: theme.red, background: theme.redBg, border: "none", borderRadius: "8px", padding: "8px", cursor: "pointer", flexShrink: 0 }}
                      title="Slet liga">
                      <Trash2 size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── 2v2 kampe ── */}
          {matchSubTab === '2v2' && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <h3 style={{ fontSize: "14px", fontWeight: 800, color: theme.accent, marginBottom: "8px", textTransform: "uppercase" }}>Admin: Detaljeret Kamp-overblik</h3>
          {matches.map(m => {
            const t1 = (m.match_players || []).filter(p => p.team === 1);
            const t2 = (m.match_players || []).filter(p => p.team === 2);
            const status = m.status;
            const statusColor = status === 'completed' ? theme.accent : status === 'in_progress' ? theme.warm : theme.textMid;
            const statusLabel = status === 'completed' ? 'Afsluttet' : status === 'in_progress' ? 'I gang' : 'Åben';

            return (
              <div key={m.id} style={{ background: theme.surface, padding: "16px", borderRadius: "12px", border: "1px solid " + theme.border, boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                  <div>
                    <div style={{ fontSize: "11px", color: theme.textMid, textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.5px", marginBottom: "8px", lineHeight: "1.4" }}>
                       <div style={{ color: theme.text }}>Oprettet: {formatEloHistoryDate(m.created_at)}</div>
                       {m.completed_at ? (
                         <div style={{ marginTop: "2px", color: theme.accent }}>Spillet: {formatEloHistoryDate(m.completed_at)} • {m.court_name || "Ukendt bane"}</div>
                       ) : (
                         <div style={{ marginTop: "2px" }}>{m.court_name || "Ukendt bane"}</div>
                       )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ fontSize: "10px", fontWeight: 800, padding: "3px 8px", borderRadius: "5px", background: statusColor + "15", color: statusColor, textTransform: "uppercase" }}>
                        {statusLabel}
                      </span>
                      <div style={{ fontSize: "16px", fontWeight: 800, color: theme.text }}>
                        {m.match_results?.[0]?.score_display || "Ingen score"}
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={() => deleteMatch(m.id)}
                    style={{ color: theme.red, background: theme.redBg, border: "none", borderRadius: "10px", padding: "10px", cursor: "pointer", display: "flex", alignItems: "center", transition: "all 0.2s" }}
                    title="Slet kamp"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>

                <div style={{ 
                  display: "flex", 
                  flexDirection: isMobile ? "column" : "row",
                  alignItems: isMobile ? "stretch" : "center", 
                  gap: isMobile ? "8px" : "12px", 
                  background: theme.surfaceAlt, 
                  padding: "12px", 
                  borderRadius: "10px",
                  border: "1px solid " + theme.border + "40"
                }}>
                  <div style={{ flex: 1, textAlign: isMobile ? "center" : "right" }}>
                    {t1.length > 0 ? t1.map(p => (
                      <div key={p.user_id} style={{ fontSize: "13px", fontWeight: 600, color: theme.text }}>{p.profiles?.full_name || "Ukendt"}</div>
                    )) : <div style={{ fontSize: "12px", color: theme.textLight, fontStyle: "italic" }}>Ingen spillere</div>}
                  </div>
                  
                  <div style={{ 
                    fontSize: "10px", 
                    fontWeight: 900, 
                    color: theme.textLight, 
                    display: "flex", 
                    alignItems: "center", 
                    justifyContent: "center",
                    padding: isMobile ? "4px 0" : "0",
                    background: isMobile ? theme.border + "30" : "transparent",
                    borderRadius: "4px"
                  }}>VS</div>
                  
                  <div style={{ flex: 1, textAlign: isMobile ? "center" : "left" }}>
                    {t2.length > 0 ? t2.map(p => (
                      <div key={p.user_id} style={{ fontSize: "13px", fontWeight: 600, color: theme.text }}>{p.profiles?.full_name || "Ukendt"}</div>
                    )) : <div style={{ fontSize: "12px", color: theme.textLight, fontStyle: "italic" }}>Ingen spillere</div>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <h3 style={{ fontSize: "14px", fontWeight: 800, color: theme.accent, textTransform: "uppercase" }}>
              Admin-konsol
            </h3>
            <button
              onClick={() => { void fetchAdminConsole(); }}
              style={{ ...btn(false), padding: "6px 12px", fontSize: "12px" }}
              disabled={consoleLoading}
            >
              <RefreshCw size={13} style={{ marginRight: "6px", opacity: consoleLoading ? 0.6 : 1 }} />
              Opdater
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(5, 1fr)", gap: "10px" }}>
            {[
              { key: 'openFlags', label: 'Åbne flags', value: consoleStats.openFlags, color: theme.red },
              { key: 'highFlags', label: 'Høje flags', value: consoleStats.highFlags, color: theme.warm },
              { key: 'pendingResults', label: 'Afventer resultat', value: consoleStats.pendingResults, color: theme.accent },
              { key: 'inProgressMatches', label: 'Kampe i gang', value: consoleStats.inProgressMatches, color: theme.text },
              { key: 'bannedPlayers', label: 'Bannede spillere', value: consoleStats.bannedPlayers, color: theme.textMid },
            ].map((card) => (
              <div
                key={card.key}
                style={{
                  background: theme.surface,
                  border: "1px solid " + theme.border,
                  borderRadius: "12px",
                  padding: "12px",
                }}
              >
                <div style={{ fontSize: "11px", color: theme.textMid, textTransform: "uppercase", fontWeight: 700 }}>
                  {card.label}
                </div>
                <div style={{ fontSize: "24px", fontWeight: 900, color: card.color, marginTop: "6px" }}>
                  {card.value}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr 1fr", gap: "10px" }}>
            <div style={{ background: theme.surface, border: "1px solid " + theme.border, borderRadius: "10px", padding: "10px 12px" }}>
              <div style={{ fontSize: "11px", color: theme.textMid, textTransform: "uppercase", fontWeight: 700 }}>Spillere</div>
              <div style={{ fontSize: "13px", color: theme.text, marginTop: "4px" }}>{consoleStats.totalPlayers} total, {consoleStats.bannedPlayers} bannet</div>
            </div>
            <div style={{ background: theme.surface, border: "1px solid " + theme.border, borderRadius: "10px", padding: "10px 12px" }}>
              <div style={{ fontSize: "11px", color: theme.textMid, textTransform: "uppercase", fontWeight: 700 }}>2v2 matcher</div>
              <div style={{ fontSize: "13px", color: theme.text, marginTop: "4px" }}>{consoleStats.openMatches} åbne, {consoleStats.inProgressMatches} i gang, {consoleStats.completedMatches24h} afsluttet (24t)</div>
            </div>
            <div style={{ background: theme.surface, border: "1px solid " + theme.border, borderRadius: "10px", padding: "10px 12px" }}>
              <div style={{ fontSize: "11px", color: theme.textMid, textTransform: "uppercase", fontWeight: 700 }}>Americano</div>
              <div style={{ fontSize: "13px", color: theme.text, marginTop: "4px" }}>{consoleStats.americanoOpen} åbne, {consoleStats.americanoActive} aktive, {consoleStats.americanoCompleted7d} afsluttet (7 dage)</div>
            </div>
            <div style={{ background: theme.surface, border: "1px solid " + theme.border, borderRadius: "10px", padding: "10px 12px" }}>
              <div style={{ fontSize: "11px", color: theme.textMid, textTransform: "uppercase", fontWeight: 700 }}>Resultater</div>
              <div style={{ fontSize: "13px", color: theme.text, marginTop: "4px" }}>{consoleStats.pendingResults} venter på bekræftelse</div>
            </div>
          </div>

          <div style={{ background: theme.surface, border: "1px solid " + theme.border, borderRadius: "12px", padding: "14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", marginBottom: "10px", flexWrap: "wrap" }}>
              <div style={{ fontSize: "13px", fontWeight: 800, color: theme.text }}>ELO-/Americano-flags</div>
              <div style={{ fontSize: "11px", color: theme.textMid }}>
                {consoleLoading ? 'Indlæser...' : `${filteredFlags.length} vist / ${ratingFlags.length} i alt`}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr 1fr 1fr", gap: "8px", marginBottom: "10px" }}>
              <input
                type="text"
                placeholder="Søg i årsag, data, kamp-id..."
                value={flagSearch}
                onChange={(e) => setFlagSearch(e.target.value)}
                style={inputStyle}
              />
              <select value={flagStatusFilter} onChange={(e) => setFlagStatusFilter(e.target.value)} style={inputStyle}>
                <option value="open">Kun åbne</option>
                <option value="reviewed">Gennemgået</option>
                <option value="closed">Lukket</option>
                <option value="all">Alle status</option>
              </select>
              <select value={flagSeverityFilter} onChange={(e) => setFlagSeverityFilter(e.target.value)} style={inputStyle}>
                <option value="all">Alle alvorlighedsgrader</option>
                <option value="high">Høj</option>
                <option value="medium">Mellem</option>
                <option value="low">Lav</option>
              </select>
              <select value={flagSourceFilter} onChange={(e) => setFlagSourceFilter(e.target.value)} style={inputStyle}>
                <option value="all">Alle kilder</option>
                <option value="2v2">2v2</option>
                <option value="americano">Americano</option>
              </select>
            </div>

            {consoleError && (
              <div style={{ marginBottom: "10px", background: theme.redBg, color: theme.red, border: "1px solid " + theme.red + "44", borderRadius: "8px", padding: "10px 12px", fontSize: "12px" }}>
                {consoleError}
              </div>
            )}

            {!consoleError && filteredFlags.length === 0 && (
              <div style={{ color: theme.textMid, fontSize: "13px", padding: "8px 2px" }}>
                Ingen flags med nuværende filter.
              </div>
            )}

            {!consoleError && filteredFlags.map((flag) => {
              const statusBadge = flagStatusBadgeColor(flag.status);
              const severityBadge = flagSeverityBadgeColor(flag.severity);
              const expanded = !!expandedFlags[flag.id];
              const hasReviewMeta = flag.reviewed_at || flag.reviewed_by || flag.review_note;
              return (
                <div key={flag.id} style={{ border: "1px solid " + theme.border, borderRadius: "10px", marginBottom: "10px", overflow: "hidden" }}>
                  <div style={{ padding: "10px 12px", background: theme.surfaceAlt, display: "grid", gridTemplateColumns: isMobile ? "1fr" : "2fr 1.2fr 1fr", gap: "8px", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: 700, color: theme.text }}>{flag.reason || 'Ukendt årsag'}</div>
                      <div style={{ fontSize: "11px", color: theme.textMid, marginTop: "2px" }}>
                        {formatDateTimeDa(flag.created_at)} · {String(flag.source || '').toUpperCase()}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "10px", fontWeight: 700, borderRadius: "999px", padding: "3px 8px", color: statusBadge.text, background: statusBadge.bg, textTransform: "uppercase" }}>
                        {statusLabelDa(flag.status)}
                      </span>
                      <span style={{ fontSize: "10px", fontWeight: 700, borderRadius: "999px", padding: "3px 8px", color: severityBadge.text, background: severityBadge.bg, textTransform: "uppercase" }}>
                        {severityLabelDa(flag.severity)}
                      </span>
                    </div>
                    <div style={{ display: "flex", justifyContent: isMobile ? "flex-start" : "flex-end", gap: "6px", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={() => setExpandedFlags((prev) => ({ ...prev, [flag.id]: !prev[flag.id] }))}
                        style={{ ...btn(false), padding: "5px 10px", fontSize: "11px" }}
                      >
                        {expanded ? 'Skjul' : 'Detaljer'}
                      </button>
                      <button
                        type="button"
                        onClick={() => { void updateFlag(flag, 'reviewed'); }}
                        disabled={flagBusyId === flag.id}
                        style={{ ...btn(flag.status === 'reviewed'), padding: "5px 10px", fontSize: "11px" }}
                      >
                        <CheckCircle2 size={12} style={{ marginRight: "4px" }} />
                        Gennemgået
                      </button>
                      <button
                        type="button"
                        onClick={() => { void updateFlag(flag, 'closed'); }}
                        disabled={flagBusyId === flag.id}
                        style={{ ...btn(flag.status === 'closed'), padding: "5px 10px", fontSize: "11px" }}
                      >
                        Luk
                      </button>
                    </div>
                  </div>

                  {expanded && (
                    <div style={{ padding: "10px 12px", borderTop: "1px solid " + theme.border, background: theme.surface }}>
                      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
                        <div style={{ fontSize: "12px", color: theme.textMid }}>
                          <div><strong style={{ color: theme.text }}>Kamp:</strong> {flag.match_id || '-'}</div>
                          <div style={{ marginTop: "4px" }}><strong style={{ color: theme.text }}>Turnering:</strong> {flag.tournament_id || '-'}</div>
                        </div>
                        <div style={{ fontSize: "12px", color: theme.textMid }}>
                          <div><strong style={{ color: theme.text }}>Gennemgået af:</strong> {reviewerMap[flag.reviewed_by] || '-'}</div>
                          <div style={{ marginTop: "4px" }}><strong style={{ color: theme.text }}>Gennemgået tid:</strong> {formatDateTimeDa(flag.reviewed_at)}</div>
                        </div>
                      </div>

                      <label style={{ ...labelStyle, marginBottom: "6px", display: "block" }}>Adminnote</label>
                      <textarea
                        value={flagNotes[flag.id] ?? flag.review_note ?? ''}
                        onChange={(e) => setFlagNotes((prev) => ({ ...prev, [flag.id]: e.target.value }))}
                        placeholder="Skriv note om vurdering af flag..."
                        style={{ ...inputStyle, minHeight: "54px", resize: "vertical", marginBottom: "10px" }}
                      />
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "10px" }}>
                        <button
                          type="button"
                          onClick={() => { void updateFlag(flag, flag.status || 'open'); }}
                          disabled={flagBusyId === flag.id}
                          style={{ ...btn(true), padding: "6px 12px", fontSize: "11px" }}
                        >
                          Gem note
                        </button>
                        {flag.status !== 'open' && (
                          <button
                            type="button"
                            onClick={() => { void updateFlag(flag, 'open'); }}
                            disabled={flagBusyId === flag.id}
                            style={{ ...btn(false), padding: "6px 12px", fontSize: "11px" }}
                          >
                            Genåbn
                          </button>
                        )}
                      </div>

                      <div style={{ fontSize: "11px", color: theme.textMid, marginBottom: "6px" }}>Datafelt</div>
                      <pre style={{ margin: 0, background: theme.surfaceAlt, border: "1px solid " + theme.border, borderRadius: "8px", padding: "10px", fontSize: "11px", lineHeight: 1.4, whiteSpace: "pre-wrap", wordBreak: "break-word", color: theme.text }}>
                        {JSON.stringify(flag.payload || {}, null, 2)}
                      </pre>
                      {hasReviewMeta && (
                        <div style={{ marginTop: "8px", fontSize: "11px", color: theme.textMid }}>
                          Seneste note: {flag.review_note || '(ingen)'}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
      {/* Edit User Modal */}
      {editingUser && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(4px)" }}>
          <div style={{ background: theme.surface, border: "1px solid " + theme.border, borderRadius: "16px", padding: "24px", maxWidth: "450px", width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.18)", position: "relative", maxHeight: "90vh", overflowY: "auto" }}>
            <button onClick={() => setEditingUser(null)} style={{ position: "absolute", top: "16px", right: "16px", background: "none", border: "none", color: theme.textLight, cursor: "pointer" }}>
              <X size={20} />
            </button>
            <h3 style={{ ...heading("18px"), marginBottom: "20px" }}>Rediger Spiller</h3>
            
            <form onSubmit={handleUpdateUser} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ ...labelStyle, marginBottom: "4px", display: "block" }}>Fulde Navn</label>
                  <input 
                    type="text" 
                    value={editingUser.full_name ?? editingUser.name ?? ''} 
                    onChange={(e) => setEditingUser({ ...editingUser, full_name: e.target.value })}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={{ ...labelStyle, marginBottom: "4px", display: "block" }}>ELO Rating</label>
                  <input 
                    type="number" 
                    value={editingUser.elo_rating} 
                    onChange={(e) => setEditingUser({ ...editingUser, elo_rating: e.target.value })}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div style={{
                fontSize: "12px",
                color: theme.textMid,
                background: theme.surfaceAlt,
                border: "1px solid " + theme.border,
                borderRadius: "10px",
                padding: "10px 12px"
              }}>
                Oprettet: <strong style={{ color: theme.text }}>{formatCreatedAt(editingUser.created_at)}</strong>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ ...labelStyle, marginBottom: "4px", display: "block" }}>Niveau</label>
                  <select
                    value={levelStringFromNum(editingUser.level) || ''}
                    onChange={(e) => {
                      const levelNum = parseFloat(e.target.value.match(/[\d.]+/)?.[0] || '0');
                      setEditingUser({ ...editingUser, level: levelNum });
                    }}
                    style={inputStyle}
                  >
                    <option value="" disabled>Vælg niveau</option>
                    {LEVELS.map((levelOption) => (
                      <option key={levelOption} value={levelOption}>{levelOption}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ ...labelStyle, marginBottom: "4px", display: "block" }}>Foretrukket side</label>
                  <select 
                    value={editingUser.court_side || ''} 
                    onChange={(e) => setEditingUser({ ...editingUser, court_side: e.target.value })}
                    style={inputStyle}
                  >
                    <option value="">Ikke valgt</option>
                    <option value="backhand">Backhand</option>
                    <option value="forehand">Forehand</option>
                    <option value="both">Begge sider</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ ...labelStyle, marginBottom: "4px", display: "block" }}>Område</label>
                <select
                  value={editingUser.area || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, area: e.target.value })}
                  style={inputStyle}
                >
                  <option value="" disabled>Vælg område</option>
                  {REGIONS.map((regionOption) => (
                    <option key={regionOption} value={regionOption}>{regionOption}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ ...labelStyle, marginBottom: "4px", display: "block" }}>Spillestil</label>
                <select
                  value={editingUser.play_style || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, play_style: e.target.value })}
                  style={inputStyle}
                >
                  <option value="" disabled>Vælg spillestil</option>
                  {PLAY_STYLES.map((styleOption) => (
                    <option key={styleOption} value={styleOption}>{styleOption}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ ...labelStyle, marginBottom: "4px", display: "block" }}>Bio / Om mig</label>
                <textarea 
                  value={editingUser.bio || ''} 
                  onChange={(e) => setEditingUser({ ...editingUser, bio: e.target.value })}
                  style={{ ...inputStyle, minHeight: "60px", resize: "vertical" }}
                />
              </div>
              
              <div style={{ marginTop: "8px", padding: "12px", background: editingUser.is_banned ? theme.redBg : theme.surfaceAlt, borderRadius: "10px", border: "1px solid " + (editingUser.is_banned ? "var(--pm-danger-border)" : theme.border) }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: editingUser.is_banned ? theme.red : theme.text }}>
                      {editingUser.is_banned ? "Brugeren er UDELUKKET" : "Status: Aktiv"}
                    </div>
                    <div style={{ fontSize: "11px", color: theme.textMid }}>
                      {editingUser.is_banned ? "Brugeren kan ikke logge ind." : "Brugeren har normal adgang."}
                    </div>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setEditingUser({ ...editingUser, is_banned: !editingUser.is_banned })}
                    style={{ ...btn(editingUser.is_banned), background: editingUser.is_banned ? theme.accent : theme.red, borderColor: editingUser.is_banned ? theme.accent : theme.red, fontSize: "12px", padding: "6px 12px" }}
                  >
                    {editingUser.is_banned ? "Ophæv ban" : "Udeluk spiller"}
                  </button>
                </div>
                
                {editingUser.is_banned && (
                  <div style={{ marginTop: "12px" }}>
                    <label style={{ ...labelStyle, marginBottom: "4px", display: "block" }}>Begrundelse (vises til spilleren)</label>
                    <textarea 
                      value={editingUser.ban_reason || ''} 
                      onChange={(e) => setEditingUser({ ...editingUser, ban_reason: e.target.value })}
                      placeholder="Skriv hvorfor spilleren er udelukket..."
                      style={{ ...inputStyle, minHeight: "50px", fontSize: "12px", background: theme.surface, borderColor: theme.red + "40" }}
                    />
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "12px" }}>
                <button type="button" onClick={() => setEditingUser(null)} style={{ ...btn(false), flex: 1 }}>Annuller</button>
                <button type="submit" style={{ ...btn(true), flex: 1 }}>Gem ændringer</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {deletePinOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1001, backdropFilter: "blur(4px)" }}>
          <div style={{ background: theme.surface, border: "1px solid " + theme.border, borderRadius: "14px", padding: "20px", maxWidth: "420px", width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.18)" }}>
            <h3 style={{ ...heading("18px"), marginBottom: "8px" }}>Bekræft med admin-kode</h3>
            <div style={{ fontSize: "12px", color: theme.textMid, lineHeight: 1.5, marginBottom: "12px" }}>
              Sletning af <strong style={{ color: theme.text }}>{adminDisplayName(deleteTargetUser)}</strong> kræver din 6-cifrede admin-kode.
            </div>

            <label style={{ ...labelStyle, marginBottom: "6px", display: "block" }}>Admin-kode (6 tal)</label>
            <input
              type="password"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={deletePin}
              onChange={(e) => {
                setDeletePin(digitsOnly(e.target.value));
                if (deletePinError) setDeletePinError('');
              }}
              style={{
                ...inputStyle,
                letterSpacing: "0.2em",
                fontFamily: font,
              }}
              disabled={deletePinBusy}
            />

            {deletePinError && (
              <div style={{ marginTop: "8px", fontSize: "12px", color: theme.red }}>
                {deletePinError}
              </div>
            )}

            <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
              <button
                type="button"
                onClick={() => closeDeletePinModal()}
                style={{ ...btn(false), flex: 1 }}
                disabled={deletePinBusy}
              >
                Annuller
              </button>
              <button
                type="button"
                onClick={() => { void confirmDeleteWithPin(); }}
                style={{ ...btn(true), flex: 1, background: theme.red, borderColor: theme.red }}
                disabled={deletePinBusy}
              >
                {deletePinBusy ? 'Sletter...' : 'Slet spiller'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

