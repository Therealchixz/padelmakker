import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { theme, font, btn, inputStyle, heading } from '../lib/platformTheme';
import { Search, User, Swords, Trash2, ShieldAlert, ShieldCheck } from 'lucide-react';
import { AvatarCircle } from '../components/AvatarCircle';
import { formatEloHistoryDate } from '../lib/eloHistoryUtils';

export function AdminTab() {
  const [activeSubTab, setActiveSubTab] = useState('users'); // 'users' or 'matches'
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [matches, setMatches] = useState([]);
  const [search, setSearch] = useState('');

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('full_name', { ascending: true });
    if (!error) setUsers(data || []);
    setLoading(false);
  };

  const fetchMatches = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('matches')
      .select('*, match_results(*)')
      .order('created_at', { ascending: false })
      .limit(50);
    if (!error) setMatches(data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (activeSubTab === 'users') fetchUsers();
    else fetchMatches();
  }, [activeSubTab]);

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
    
    if (!error) fetchMatches();
  };

  const filteredUsers = users.filter(u => 
    (u.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(search.toLowerCase())
  );

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
              placeholder="Søg på navn eller email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ ...inputStyle, paddingLeft: "38px" }}
            />
          </div>

          <div style={{ background: theme.surface, borderRadius: "12px", border: "1px solid " + theme.border, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", background: "#F8FAFC", borderBottom: "1px solid " + theme.border }}>
                  <th style={{ padding: "12px", fontSize: "12px", color: theme.textMid }}>SPILLER</th>
                  <th style={{ padding: "12px", fontSize: "12px", color: theme.textMid }}>ELO</th>
                  <th style={{ padding: "12px", fontSize: "12px", color: theme.textMid }}>ROLLE</th>
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
                      <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "100px", background: u.role === 'admin' ? theme.accentBg : "#F1F5F9", color: u.role === 'admin' ? theme.accent : theme.textMid, textTransform: "uppercase" }}>
                        {u.role}
                      </span>
                    </td>
                    <td style={{ padding: "12px", textAlign: "right" }}>
                      <button 
                        onClick={() => toggleAdmin(u)}
                        title={u.role === 'admin' ? "Fjern admin" : "Gør til admin"}
                        style={{ background: "none", border: "none", cursor: "pointer", color: u.role === 'admin' ? theme.red : theme.accent }}
                      >
                        {u.role === 'admin' ? <ShieldAlert size={18} /> : <ShieldCheck size={18} />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {matches.map(m => (
            <div key={m.id} style={{ background: theme.surface, padding: "12px", borderRadius: "12px", border: "1px solid " + theme.border, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "12px", color: theme.textMid, marginBottom: "4px" }}>
                   {formatEloHistoryDate(m.created_at)} • {m.court_name || "Ukendt bane"}
                </div>
                <div style={{ fontSize: "14px", fontWeight: 600 }}>
                  {m.match_results?.[0]?.score_display || "Ingen score"}
                </div>
              </div>
              <button 
                onClick={() => deleteMatch(m.id)}
                style={{ color: theme.red, background: "none", border: "none", cursor: "pointer", padding: "8px" }}
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
