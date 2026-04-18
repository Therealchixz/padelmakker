import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { theme, font, btn, inputStyle, heading, labelStyle } from '../lib/platformTheme';
import { Search, User, Swords, Trash2, ShieldAlert, ShieldCheck, Edit2, X, ChevronUp, ChevronDown } from 'lucide-react';
import { AvatarCircle } from '../components/AvatarCircle';
import { formatEloHistoryDate } from '../lib/eloHistoryUtils';

import {
  LEVELS,
  PLAY_STYLES,
  REGIONS,
  levelStringFromNum,
} from '../lib/platformConstants';

export function AdminTab() {
  const [activeSubTab, setActiveSubTab] = useState('users'); // 'users' or 'matches'
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

  const deleteAmericano = async (id, name) => {
    if (!window.confirm(`Slet turneringen "${name}"? Dette kan ikke fortrydes.`)) return;
    const { error } = await supabase.from('americano_tournaments').delete().eq('id', id);
    if (error) alert('Fejl: ' + error.message);
    else fetchAmericano();
  };

  const deleteLiga = async (id, name) => {
    if (!window.confirm(`Slet ligaen "${name}"? Hold og kampe slettes også. Dette kan ikke fortrydes.`)) return;
    const { error } = await supabase.from('leagues').delete().eq('id', id);
    if (error) alert('Fejl: ' + error.message);
    else fetchLiga();
  };

  useEffect(() => {
    if (activeSubTab === 'users') fetchUsers();
    else if (matchSubTab === '2v2') fetchMatches();
    else if (matchSubTab === 'americano') fetchAmericano();
    else fetchLiga();
  }, [activeSubTab, matchSubTab]);

  const toggleAdmin = async (user) => {
    const newRole = user.role === 'admin' ? 'player' : 'admin';
    const confirmMsg = user.role === 'admin' 
        ? `Er du sikker på, at du vil fjerne admin-rettigheder fra ${user.full_name}?`
        : `Vil du give admin-rettigheder til ${user.full_name}?`;
    
    if (!window.confirm(confirmMsg)) return;

    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', user.id);
    
    if (!error) fetchUsers();
  };

  const deleteMatch = async (matchId) => {
    if (!window.confirm('Er du helt sikker på at du vil slette denne kamp? Dette kan ikke fortrydes og vil påvirke ELO.')) return;
    
    const { error } = await supabase
      .from('matches')
      .delete()
      .eq('id', matchId);
    
    if (error) {
      console.error('Delete error:', error);
      alert('Kunne ikke slette kampen: ' + error.message);
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
      alert('Fejl ved opdatering: ' + (err.message || 'Ukendt fejl'));
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

  const filteredUsers = sortedUsers.filter(u => 
    (u.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(search.toLowerCase())
  );

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
                  <tr style={{ textAlign: "left", background: "#F8FAFC", borderBottom: "1px solid " + theme.border }}>
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
                            <div style={{ fontSize: "14px", fontWeight: 600 }}>{u.full_name}</div>
                            <div style={{ fontSize: "11px", color: theme.textMid }}>{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "12px", fontSize: "14px", fontWeight: 700 }}>{u.elo_rating || 1000}</td>
                      <td style={{ padding: "12px" }}>
                        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                          <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "100px", background: u.role === 'admin' ? theme.accentBg : "#F1F5F9", color: u.role === 'admin' ? theme.accent : theme.textMid, textTransform: "uppercase" }}>
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
                        <div style={{ fontSize: "15px", fontWeight: 700 }}>{u.full_name}</div>
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
                      <span style={{ fontSize: "10px", fontWeight: 700, padding: "3px 8px", borderRadius: "100px", background: u.role === 'admin' ? theme.accentBg : "#F1F5F9", color: u.role === 'admin' ? theme.accent : theme.textMid, textTransform: "uppercase" }}>
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
                        onClick={() => toggleAdmin(u)} 
                        style={{ background: u.role === 'admin' ? theme.redBg : theme.accentBg, border: "none", borderRadius: "8px", padding: "8px", color: u.role === 'admin' ? theme.red : theme.accent, display: "flex", alignItems: "center" }}
                        title={u.role === 'admin' ? "Fjern admin" : "Gør til admin"}
                      >
                        {u.role === 'admin' ? <ShieldAlert size={18} /> : <ShieldCheck size={18} />}
                      </button>
                      <button 
                        onClick={() => setEditingUser({ ...u })} 
                        style={{ background: theme.accent, border: "none", borderRadius: "8px", padding: "8px 16px", color: "#fff", display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: 600 }}
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
      ) : (
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
                const statusColor = t.status === 'completed' ? theme.accent : t.status === 'active' ? '#16A34A' : theme.textMid;
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
                const statusColor = l.status === 'completed' ? theme.textMid : l.status === 'active' ? '#16A34A' : '#D97706';
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
                  background: "#F8FAFC", 
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
      )}
      {/* Edit User Modal */}
      {editingUser && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(4px)" }}>
          <div style={{ background: "#fff", borderRadius: "16px", padding: "24px", maxWidth: "450px", width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.18)", position: "relative", maxHeight: "90vh", overflowY: "auto" }}>
            <button onClick={() => setEditingUser(null)} style={{ position: "absolute", top: "16px", right: "16px", background: "none", border: "none", color: "#64748B", cursor: "pointer" }}>
              <X size={20} />
            </button>
            <h3 style={{ ...heading("18px"), marginBottom: "20px" }}>Rediger Spiller</h3>
            
            <form onSubmit={handleUpdateUser} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ ...labelStyle, marginBottom: "4px", display: "block" }}>Fulde Navn</label>
                  <input 
                    type="text" 
                    value={editingUser.full_name} 
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
                background: "#F8FAFC",
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
              
              <div style={{ marginTop: "8px", padding: "12px", background: editingUser.is_banned ? "#FEF2F2" : "#F8FAFC", borderRadius: "10px", border: "1px solid " + (editingUser.is_banned ? "#FCA5A5" : theme.border) }}>
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
                      style={{ ...inputStyle, minHeight: "50px", fontSize: "12px", background: "#fff", borderColor: theme.red + "40" }}
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
    </div>
  );
}
