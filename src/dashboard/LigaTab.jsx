import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { theme, btn, inputStyle, labelStyle, heading, tag } from '../lib/platformTheme';
import { Trophy, Users, Plus, Play, ChevronDown, ChevronUp, Search } from 'lucide-react';
import { AvatarCircle } from '../components/AvatarCircle';
import { formatMatchDateDa } from '../lib/matchDisplayUtils';

function computeStandings(teams, matches) {
  const map = {};
  for (const t of teams) map[t.id] = { ...t, points: 0, wins: 0, losses: 0, played: 0 };
  for (const m of matches) {
    if (m.status !== 'reported' || !m.winner_id) continue;
    const winner = map[m.winner_id];
    const loserId = m.winner_id === m.team1_id ? m.team2_id : m.team1_id;
    const loser = loserId ? map[loserId] : null;
    if (winner) { winner.wins++; winner.points += 3; winner.played++; }
    if (loser)  { loser.losses++; loser.played++; }
  }
  return Object.values(map).sort((a, b) =>
    b.points !== a.points ? b.points - a.points :
    b.wins   !== a.wins   ? b.wins   - a.wins   :
    b.elo_combined - a.elo_combined
  );
}

function generatePairings(standings, allMatches) {
  const played = new Set(
    allMatches
      .filter(m => m.team1_id && m.team2_id)
      .map(m => [m.team1_id, m.team2_id].sort().join('|'))
  );
  const pairings = [];
  const used = new Set();
  for (let i = 0; i < standings.length; i++) {
    if (used.has(standings[i].id)) continue;
    const t1 = standings[i];
    let paired = false;
    for (let j = i + 1; j < standings.length; j++) {
      if (used.has(standings[j].id)) continue;
      const t2 = standings[j];
      if (played.has([t1.id, t2.id].sort().join('|'))) continue;
      pairings.push({ team1_id: t1.id, team2_id: t2.id });
      used.add(t1.id); used.add(t2.id);
      paired = true; break;
    }
    if (!paired && !used.has(t1.id)) {
      pairings.push({ team1_id: t1.id, team2_id: null });
      used.add(t1.id);
    }
  }
  return pairings;
}

const SEASON_LABELS = { weekly: 'Ugentlig', monthly: 'Månedlig' };
const STATUS_LABELS = { registration: 'Tilmelding åben', active: 'Aktiv', completed: 'Afsluttet' };
const STATUS_COLORS = {
  registration: { bg: '#FEF3C7', color: '#92400E' },
  active:       { bg: '#D1FAE5', color: '#065F46' },
  completed:    { bg: '#F1F5F9', color: '#475569' },
};

function PartnerSearch({ userId, onSelect }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (query.length < 2) { setResults([]); setOpen(false); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, name, avatar, elo_rating')
        .or(`full_name.ilike.%${query}%,name.ilike.%${query}%`)
        .neq('id', userId)
        .limit(6);
      setResults(data || []);
      setOpen(true);
    }, 280);
    return () => clearTimeout(t);
  }, [query, userId]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: theme.textLight, pointerEvents: 'none' }} />
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); }}
          placeholder="Søg efter makker..."
          style={{ ...inputStyle, paddingLeft: '32px' }}
        />
      </div>
      {open && results.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid ' + theme.border, borderRadius: '8px', boxShadow: theme.shadow, zIndex: 100, marginTop: '4px' }}>
          {results.map(p => {
            const name = p.full_name || p.name || 'Spiller';
            return (
              <div
                key={p.id}
                onClick={() => { onSelect(p); setQuery(name); setOpen(false); }}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid ' + theme.border + '80' }}
              >
                <AvatarCircle avatar={p.avatar} size={30} emojiSize="14px" style={{ background: theme.accentBg, border: '1px solid ' + theme.border, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>{name}</div>
                  <div style={{ fontSize: '11px', color: theme.textLight }}>ELO {Math.round(Number(p.elo_rating) || 1000)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function LigaTab({ user, showToast }) {
  const isAdmin = user?.role === 'admin';
  const [view, setView] = useState('active');
  const [leagues, setLeagues] = useState([]);
  const [teamsByLeague, setTeamsByLeague] = useState({});
  const [allTeamsByLeague, setAllTeamsByLeague] = useState({});
  const [matchesByLeague, setMatchesByLeague] = useState({});
  const [myTeamByLeague, setMyTeamByLeague] = useState({});
  const [pendingInvites, setPendingInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [openStandings, setOpenStandings] = useState(new Set());

  // Create league form (admin)
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', description: '', season_type: 'monthly', start_date: '', end_date: '' });

  // Create team form
  const [teamFormLeagueId, setTeamFormLeagueId] = useState(null);
  const [teamName, setTeamName] = useState('');
  const [selectedPartner, setSelectedPartner] = useState(null);

  // Report result
  const [reportingMatch, setReportingMatch] = useState(null);
  const [scoreText, setScoreText] = useState('');

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [lgRes, teamsRes] = await Promise.all([
        supabase.from('leagues').select('*').order('created_at', { ascending: false }),
        supabase.from('league_teams').select('*').or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`),
      ]);
      const lgList = lgRes.data || [];
      setLeagues(lgList);

      const myTeams = teamsRes.data || [];
      // Invitationer: hold hvor jeg er player2 og status = pending
      setPendingInvites(myTeams.filter(t => t.player2_id === user.id && t.status === 'pending'));
      const myTeamMap = {};
      for (const t of myTeams) {
        // Mit hold i en liga: kun ready, eller pending hvis jeg selv oprettede det
        if (t.status === 'ready' || t.player1_id === user.id) myTeamMap[t.league_id] = t;
      }
      setMyTeamByLeague(myTeamMap);

      if (lgList.length === 0) return;
      const ids = lgList.map(l => l.id);
      const [allTeamsRes, matchRes] = await Promise.all([
        supabase.from('league_teams').select('*').in('league_id', ids),
        supabase.from('league_matches').select('*').in('league_id', ids),
      ]);
      const tMap = {};
      const allMap = {};
      for (const t of (allTeamsRes.data || [])) {
        if (!allMap[t.league_id]) allMap[t.league_id] = [];
        allMap[t.league_id].push(t);
        if (t.status !== 'ready') continue;
        if (!tMap[t.league_id]) tMap[t.league_id] = [];
        tMap[t.league_id].push(t);
      }
      setTeamsByLeague(tMap);
      setAllTeamsByLeague(allMap);
      const mMap = {};
      for (const m of (matchRes.data || [])) {
        if (!mMap[m.league_id]) mMap[m.league_id] = [];
        mMap[m.league_id].push(m);
      }
      setMatchesByLeague(mMap);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const createTeam = async (leagueId) => {
    if (!teamName.trim()) { showToast('Angiv et holdnavn.'); return; }
    if (!selectedPartner) { showToast('Vælg en makker.'); return; }
    setBusyId(leagueId + '-team');
    try {
      const myElo = Math.round(Number(user.elo_rating) || 1000);
      const partnerElo = Math.round(Number(selectedPartner.elo_rating) || 1000);
      const { error } = await supabase.from('league_teams').insert({
        league_id: leagueId,
        name: teamName.trim(),
        player1_id: user.id,
        player2_id: selectedPartner.id,
        player1_name: user.full_name || user.name || 'Spiller',
        player2_name: selectedPartner.full_name || selectedPartner.name || 'Spiller',
        player1_avatar: user.avatar || '🎾',
        player2_avatar: selectedPartner.avatar || '🎾',
        elo_combined: myElo + partnerElo,
        status: 'pending',
      });
      if (error) throw error;
      const leagueName = leagues.find(l => l.id === leagueId)?.name || 'ligaen';
      await supabase.rpc('notify_league_invite', {
        p_user_id: selectedPartner.id,
        p_title: 'Holdinvitation 🎾',
        p_body: `${user.full_name || user.name || 'En spiller'} inviterer dig til holdet "${teamName.trim()}" i ${leagueName}`,
      });
      showToast('Hold tilmeldt — invitation sendt til ' + (selectedPartner.full_name || selectedPartner.name) + '!');
      setTeamFormLeagueId(null);
      setTeamName('');
      setSelectedPartner(null);
      await load();
    } catch (e) {
      showToast(e.message.includes('unique') ? 'En af spillerne er allerede tilmeldt denne liga.' : 'Fejl: ' + e.message);
    } finally { setBusyId(null); }
  };

  const acceptInvite = async (team) => {
    setBusyId(team.id + '-accept');
    try {
      const { error } = await supabase.from('league_teams').update({ status: 'ready' }).eq('id', team.id);
      if (error) throw error;
      showToast('Du har accepteret invitationen! 🎾');
      await load();
    } catch (e) { showToast('Fejl: ' + e.message); }
    finally { setBusyId(null); }
  };

  const declineInvite = async (team) => {
    if (!window.confirm(`Afvis invitation til holdet "${team.name}"?`)) return;
    setBusyId(team.id + '-decline');
    try {
      const { error } = await supabase.from('league_teams').delete().eq('id', team.id);
      if (error) throw error;
      showToast('Invitation afvist.');
      await load();
    } catch (e) { showToast('Fejl: ' + e.message); }
    finally { setBusyId(null); }
  };

  const leaveLeague = async (leagueId) => {
    const myTeam = myTeamByLeague[leagueId];
    if (!myTeam) return;
    if (!window.confirm('Afmeld dit hold fra ligaen?')) return;
    setBusyId(leagueId + '-leave');
    try {
      const { error } = await supabase.from('league_teams').delete().eq('id', myTeam.id);
      if (error) throw error;
      showToast('Hold afmeldt.');
      await load();
    } catch (e) { showToast('Fejl: ' + e.message); }
    finally { setBusyId(null); }
  };

  const reportResult = async (match, myTeamWon) => {
    const myTeam = myTeamByLeague[match.league_id];
    if (!myTeam) return;
    const winnerId = myTeamWon ? myTeam.id : (match.team1_id === myTeam.id ? match.team2_id : match.team1_id);
    setBusyId(match.id);
    try {
      const { error } = await supabase.from('league_matches').update({
        winner_id: winnerId,
        score_text: scoreText.trim() || null,
        status: 'reported',
        reported_by: user.id,
      }).eq('id', match.id);
      if (error) throw error;
      showToast('Resultat registreret!');
      setReportingMatch(null); setScoreText('');
      await load();
    } catch (e) { showToast('Fejl: ' + e.message); }
    finally { setBusyId(null); }
  };

  const createLeague = async () => {
    if (!createForm.name.trim() || !createForm.start_date || !createForm.end_date) {
      showToast('Udfyld navn og datoer.'); return;
    }
    setBusyId('create');
    try {
      const { error } = await supabase.from('leagues').insert({
        name: createForm.name.trim(),
        description: createForm.description.trim() || null,
        season_type: createForm.season_type,
        start_date: createForm.start_date,
        end_date: createForm.end_date,
        created_by: user.id,
      });
      if (error) throw error;
      showToast('Liga oprettet!');
      setCreateOpen(false);
      setCreateForm({ name: '', description: '', season_type: 'monthly', start_date: '', end_date: '' });
      await load();
    } catch (e) { showToast('Fejl: ' + e.message); }
    finally { setBusyId(null); }
  };

  const startLeague = async (league) => {
    const teams = teamsByLeague[league.id] || [];
    if (teams.length < 2) { showToast('Mindst 2 hold kræves for at starte.'); return; }
    if (!window.confirm(`Start "${league.name}" og generér runde 1?`)) return;
    setBusyId(league.id + '-start');
    try {
      const allMatches = matchesByLeague[league.id] || [];
      const standings = computeStandings(teams, allMatches);
      const pairings = generatePairings(standings, allMatches);
      const rows = pairings.map(p => ({
        league_id: league.id, round_number: 1,
        team1_id: p.team1_id, team2_id: p.team2_id || null,
        status: p.team2_id ? 'pending' : 'reported',
        winner_id: p.team2_id ? null : p.team1_id,
      }));
      const { error: mErr } = await supabase.from('league_matches').insert(rows);
      if (mErr) throw mErr;
      const { error: uErr } = await supabase.from('leagues').update({ status: 'active', current_round: 1 }).eq('id', league.id);
      if (uErr) throw uErr;
      showToast('Liga startet — runde 1 genereret!');
      await load();
    } catch (e) { showToast('Fejl: ' + e.message); }
    finally { setBusyId(null); }
  };

  const nextRound = async (league) => {
    const teams = teamsByLeague[league.id] || [];
    const allMatches = matchesByLeague[league.id] || [];
    const pending = allMatches.filter(m => m.round_number === league.current_round && m.status === 'pending');
    if (pending.length > 0) {
      if (!window.confirm(`${pending.length} kampe i runde ${league.current_round} mangler stadig resultat. Fortsæt alligevel?`)) return;
    }
    setBusyId(league.id + '-next');
    try {
      const standings = computeStandings(teams, allMatches);
      const pairings = generatePairings(standings, allMatches);
      const round = league.current_round + 1;
      const rows = pairings.map(p => ({
        league_id: league.id, round_number: round,
        team1_id: p.team1_id, team2_id: p.team2_id || null,
        status: p.team2_id ? 'pending' : 'reported',
        winner_id: p.team2_id ? null : p.team1_id,
      }));
      const { error: mErr } = await supabase.from('league_matches').insert(rows);
      if (mErr) throw mErr;
      const { error: uErr } = await supabase.from('leagues').update({ current_round: round }).eq('id', league.id);
      if (uErr) throw uErr;
      showToast(`Runde ${round} genereret!`);
      await load();
    } catch (e) { showToast('Fejl: ' + e.message); }
    finally { setBusyId(null); }
  };

  const completeLeague = async (league) => {
    if (!window.confirm(`Afslut "${league.name}"? Ranglisten låses.`)) return;
    setBusyId(league.id + '-complete');
    try {
      const { error } = await supabase.from('leagues').update({ status: 'completed' }).eq('id', league.id);
      if (error) throw error;
      showToast('Liga afsluttet!');
      await load();
    } catch (e) { showToast('Fejl: ' + e.message); }
    finally { setBusyId(null); }
  };

  const deleteLeague = async (league) => {
    if (!window.confirm(`Slet "${league.name}"? Dette kan ikke fortrydes.`)) return;
    setBusyId(league.id + '-delete');
    try {
      const { error } = await supabase.from('leagues').delete().eq('id', league.id);
      if (error) throw error;
      showToast('Liga slettet.');
      await load();
    } catch (e) { showToast('Fejl: ' + e.message); }
    finally { setBusyId(null); }
  };

  const toggleStandings = (id) => setOpenStandings(s => {
    const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  const visibleLeagues = leagues.filter(l => l.status === view);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <h2 style={{ ...heading('clamp(20px,4.5vw,24px)') }}>Liga</h2>
        {isAdmin && (
          <button onClick={() => setCreateOpen(o => !o)} style={{ ...btn(createOpen), padding: '8px 14px', fontSize: '13px' }}>
            <Plus size={14} /> Opret liga
          </button>
        )}
      </div>

      {/* Admin: opret-formular */}
      {isAdmin && createOpen && (
        <div style={{ background: theme.surface, borderRadius: theme.radius, padding: '20px', border: '1px solid ' + theme.border, boxShadow: theme.shadow, marginBottom: '16px' }}>
          <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '14px' }}>Ny liga</div>
          <label style={labelStyle}>Navn</label>
          <input value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} placeholder="F.eks. Forårssæson 2026" style={{ ...inputStyle, marginBottom: '10px' }} />
          <label style={labelStyle}>Beskrivelse <span style={{ fontWeight: 400, color: theme.textLight }}>(valgfri)</span></label>
          <input value={createForm.description} onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))} placeholder="Kort beskrivelse..." style={{ ...inputStyle, marginBottom: '10px' }} />
          <label style={labelStyle}>Type</label>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
            {['weekly', 'monthly'].map(t => (
              <button key={t} onClick={() => setCreateForm(f => ({ ...f, season_type: t }))} style={{ ...btn(createForm.season_type === t), padding: '6px 14px', fontSize: '12px' }}>
                {SEASON_LABELS[t]}
              </button>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
            <div>
              <label style={labelStyle}>Startdato</label>
              <input type="date" value={createForm.start_date} onChange={e => setCreateForm(f => ({ ...f, start_date: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Slutdato</label>
              <input type="date" value={createForm.end_date} onChange={e => setCreateForm(f => ({ ...f, end_date: e.target.value }))} style={inputStyle} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={createLeague} disabled={busyId === 'create'} style={{ ...btn(true), fontSize: '13px' }}>
              {busyId === 'create' ? 'Opretter…' : 'Opret liga'}
            </button>
            <button onClick={() => setCreateOpen(false)} style={{ ...btn(false), fontSize: '13px' }}>Annullér</button>
          </div>
        </div>
      )}

      {/* Ventende invitationer */}
      {pendingInvites.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          {pendingInvites.map(invite => {
            const league = leagues.find(l => l.id === invite.league_id);
            const busy = busyId === invite.id + '-accept' || busyId === invite.id + '-decline';
            return (
              <div key={invite.id} style={{ background: '#FEF3C7', borderRadius: theme.radius, padding: '14px 16px', border: '1px solid #FDE68A', marginBottom: '8px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#92400E', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                  ⚡ Holdinvitation
                </div>
                <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '2px' }}>{invite.name}</div>
                <div style={{ fontSize: '12px', color: theme.textMid, marginBottom: '10px' }}>
                  {invite.player1_name} inviterer dig med i {league?.name || 'en liga'}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => acceptInvite(invite)} disabled={busy}
                    style={{ ...btn(true), padding: '7px 14px', fontSize: '13px', background: '#16A34A', borderColor: '#16A34A' }}>
                    {busyId === invite.id + '-accept' ? 'Accepterer…' : '✓ Acceptér'}
                  </button>
                  <button onClick={() => declineInvite(invite)} disabled={busy}
                    style={{ ...btn(false), padding: '7px 14px', fontSize: '13px', color: '#DC2626', borderColor: '#FCA5A5' }}>
                    Afvis
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {[
          { id: 'registration', label: 'Tilmelding' },
          { id: 'active',       label: 'Aktiv sæson' },
          { id: 'completed',    label: 'Afsluttede' },
        ].map(v => (
          <button key={v.id} onClick={() => setView(v.id)} style={{ ...btn(view === v.id), padding: '7px 14px', fontSize: '13px' }}>
            {v.label}
            <span style={{ marginLeft: '5px', fontSize: '11px', opacity: 0.65 }}>({leagues.filter(l => l.status === v.id).length})</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: theme.textLight, fontSize: '14px' }}>Indlæser…</div>
      ) : visibleLeagues.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '52px 20px', color: theme.textLight }}>
          <Trophy size={44} color={theme.border} style={{ display: 'block', margin: '0 auto 14px' }} />
          <div style={{ fontSize: '15px', fontWeight: 700, color: theme.text, marginBottom: '6px' }}>
            {view === 'registration' ? 'Ingen åbne ligaer' : view === 'active' ? 'Ingen aktive ligaer' : 'Ingen afsluttede ligaer'}
          </div>
          {isAdmin && view === 'registration' && (
            <div style={{ fontSize: '13px', color: theme.textLight }}>Opret en ny liga via knappen ovenfor.</div>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {visibleLeagues.map(league => {
            const teams = teamsByLeague[league.id] || [];
            const matches = matchesByLeague[league.id] || [];
            const myTeam = myTeamByLeague[league.id];
            const joined = !!myTeam;
            const standings = computeStandings(teams, matches);
            const standingsOpen = openStandings.has(league.id);
            const sc = STATUS_COLORS[league.status] || {};
            const busy = busyId === league.id || (typeof busyId === 'string' && busyId.startsWith(league.id + '-'));

            const currentRoundMatches = matches.filter(m => m.round_number === league.current_round);
            const myMatch = myTeam ? currentRoundMatches.find(m => m.team1_id === myTeam.id || m.team2_id === myTeam.id) : null;
            const opponentTeamId = myMatch ? (myMatch.team1_id === myTeam?.id ? myMatch.team2_id : myMatch.team1_id) : null;
            const opponentTeam = opponentTeamId ? teams.find(t => t.id === opponentTeamId) : null;

            const showTeamForm = teamFormLeagueId === league.id;

            return (
              <div key={league.id} style={{ background: theme.surface, borderRadius: theme.radius, padding: '18px', border: '1px solid ' + theme.border, boxShadow: theme.shadow }}>

                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: '16px', marginBottom: '4px' }}>{league.name}</div>
                    <div style={{ fontSize: '12px', color: theme.textLight }}>
                      {SEASON_LABELS[league.season_type]} · {formatMatchDateDa(league.start_date)} – {formatMatchDateDa(league.end_date)}
                      {league.status === 'active' && <span style={{ color: theme.accent, fontWeight: 700 }}> · Runde {league.current_round}</span>}
                    </div>
                    {league.description && (
                      <div style={{ fontSize: '12px', color: theme.textMid, marginTop: '4px', fontStyle: 'italic' }}>{league.description}</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', flexShrink: 0 }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px', background: sc.bg, color: sc.color }}>
                      {STATUS_LABELS[league.status]}
                    </span>
                    <span style={tag(theme.blueBg, theme.blue)}>
                      <Users size={10} /> {(allTeamsByLeague[league.id] || []).length} hold
                    </span>
                  </div>
                </div>

                {/* Tilmelding */}
                {league.status === 'registration' && (
                  <div style={{ marginBottom: '12px' }}>
                    {joined ? (
                      <div style={{ background: myTeam.status === 'pending' ? '#FEF9EC' : '#F0FDF4', borderRadius: '10px', padding: '12px 14px', border: '1px solid ' + (myTeam.status === 'pending' ? '#FDE68A' : '#BBF7D0'), display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: myTeam.status === 'pending' ? '#92400E' : '#15803D', marginBottom: '4px' }}>
                            {myTeam.status === 'pending' ? '⏳ Afventer godkendelse' : '✓'} {myTeam.name}
                          </div>
                          <div style={{ fontSize: '12px', color: theme.textMid, display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <AvatarCircle avatar={myTeam.player1_avatar} size={20} emojiSize="10px" style={{ background: theme.accentBg, border: '1px solid ' + theme.border }} />
                            {myTeam.player1_name}
                            <span style={{ color: theme.textLight }}>+</span>
                            <AvatarCircle avatar={myTeam.player2_avatar} size={20} emojiSize="10px" style={{ background: theme.accentBg, border: '1px solid ' + theme.border }} />
                            {myTeam.player2_name}
                            {myTeam.status === 'pending' && <span style={{ color: '#92400E', fontSize: '11px' }}>(venter på {myTeam.player2_name})</span>}
                          </div>
                        </div>
                        <button onClick={() => leaveLeague(league.id)} disabled={busy} style={{ ...btn(false), padding: '6px 12px', fontSize: '12px' }}>Afmeld hold</button>
                      </div>
                    ) : showTeamForm ? (
                      <div style={{ background: '#F8FAFC', borderRadius: '10px', padding: '14px', border: '1px solid ' + theme.border }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px' }}>Tilmeld hold</div>
                        <label style={labelStyle}>Holdnavn</label>
                        <input
                          value={teamName}
                          onChange={e => setTeamName(e.target.value)}
                          placeholder="F.eks. Smash Bros"
                          style={{ ...inputStyle, marginBottom: '10px' }}
                        />
                        <label style={labelStyle}>Din makker</label>
                        <PartnerSearch userId={user.id} onSelect={setSelectedPartner} />
                        {selectedPartner && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', padding: '8px 10px', background: theme.accentBg, borderRadius: '8px' }}>
                            <AvatarCircle avatar={selectedPartner.avatar} size={24} emojiSize="12px" style={{ background: '#fff', border: '1px solid ' + theme.border }} />
                            <span style={{ fontSize: '13px', fontWeight: 600 }}>{selectedPartner.full_name || selectedPartner.name}</span>
                            <span style={{ fontSize: '11px', color: theme.textLight }}>ELO {Math.round(Number(selectedPartner.elo_rating) || 1000)}</span>
                            <button onClick={() => setSelectedPartner(null)} style={{ ...btn(false), padding: '2px 8px', fontSize: '11px', marginLeft: 'auto' }}>×</button>
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                          <button onClick={() => createTeam(league.id)} disabled={busyId === league.id + '-team'} style={{ ...btn(true), fontSize: '13px' }}>
                            {busyId === league.id + '-team' ? 'Tilmelder…' : 'Tilmeld hold'}
                          </button>
                          <button onClick={() => { setTeamFormLeagueId(null); setTeamName(''); setSelectedPartner(null); }} style={{ ...btn(false), fontSize: '13px' }}>Annullér</button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setTeamFormLeagueId(league.id)} style={{ ...btn(true), padding: '8px 16px', fontSize: '13px' }}>
                        <Plus size={14} /> Tilmeld hold
                      </button>
                    )}
                  </div>
                )}

                {/* Tilmeldte hold under tilmeldingsfasen */}
                {league.status === 'registration' && (() => {
                  const regTeams = allTeamsByLeague[league.id] || [];
                  if (regTeams.length === 0) return null;
                  return (
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: theme.textMid, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                        Tilmeldte hold ({regTeams.length})
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {regTeams.map(t => (
                          <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', borderRadius: '8px', background: t.status === 'pending' ? '#FFFBEB' : '#F0FDF4', border: '1px solid ' + (t.status === 'pending' ? '#FDE68A' : '#BBF7D0') }}>
                            <div style={{ display: 'flex', gap: '3px' }}>
                              <AvatarCircle avatar={t.player1_avatar} size={24} emojiSize="11px" style={{ background: theme.accentBg, border: '1px solid ' + theme.border }} />
                              <AvatarCircle avatar={t.player2_avatar} size={24} emojiSize="11px" style={{ background: theme.accentBg, border: '1px solid ' + theme.border }} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '13px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</div>
                              <div style={{ fontSize: '11px', color: theme.textLight, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {t.player1_name} + {t.player2_name}
                              </div>
                            </div>
                            {t.status === 'pending' && (
                              <span style={{ fontSize: '10px', fontWeight: 700, color: '#92400E', background: '#FEF3C7', padding: '2px 7px', borderRadius: '10px', flexShrink: 0 }}>Afventer</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Min kamp denne runde */}
                {league.status === 'active' && joined && myMatch && (
                  <div style={{ background: theme.accentBg, borderRadius: '10px', padding: '14px', marginBottom: '12px', border: '1px solid ' + theme.accent + '30' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: theme.accent, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
                      Jeres kamp — runde {league.current_round}
                    </div>
                    {myMatch.team2_id === null ? (
                      <div style={{ fontSize: '13px', color: theme.textMid }}>Fri runde — automatisk sejr 🎾</div>
                    ) : myMatch.status === 'reported' ? (
                      <div style={{ fontSize: '13px', color: theme.textMid }}>
                        {myMatch.winner_id === myTeam.id ? '🏆 I vandt' : '😔 I tabte'}
                        {myMatch.score_text && <span style={{ color: theme.textLight }}> · {myMatch.score_text}</span>}
                        {opponentTeam && <span style={{ color: theme.textLight }}> mod {opponentTeam.name}</span>}
                      </div>
                    ) : opponentTeam ? (
                      <div>
                        {/* Vores hold vs modstanderhold */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                          <div style={{ flex: 1, textAlign: 'center' }}>
                            <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '4px' }}>{myTeam.name}</div>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '4px' }}>
                              <AvatarCircle avatar={myTeam.player1_avatar} size={28} emojiSize="13px" style={{ background: '#fff', border: '1px solid ' + theme.border }} />
                              <AvatarCircle avatar={myTeam.player2_avatar} size={28} emojiSize="13px" style={{ background: '#fff', border: '1px solid ' + theme.border }} />
                            </div>
                          </div>
                          <div style={{ fontSize: '18px', fontWeight: 800, color: theme.textLight }}>vs</div>
                          <div style={{ flex: 1, textAlign: 'center' }}>
                            <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '4px' }}>{opponentTeam.name}</div>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '4px' }}>
                              <AvatarCircle avatar={opponentTeam.player1_avatar} size={28} emojiSize="13px" style={{ background: '#fff', border: '1px solid ' + theme.border }} />
                              <AvatarCircle avatar={opponentTeam.player2_avatar} size={28} emojiSize="13px" style={{ background: '#fff', border: '1px solid ' + theme.border }} />
                            </div>
                          </div>
                        </div>
                        {reportingMatch === myMatch.id ? (
                          <div>
                            <input
                              value={scoreText}
                              onChange={e => setScoreText(e.target.value)}
                              placeholder="Score f.eks. 6-4, 6-2 (valgfri)"
                              style={{ ...inputStyle, marginBottom: '10px', fontSize: '13px' }}
                            />
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                              <button onClick={() => reportResult(myMatch, true)} disabled={busyId === myMatch.id}
                                style={{ ...btn(true), padding: '8px 14px', fontSize: '13px', background: '#16A34A', borderColor: '#16A34A' }}>
                                🏆 Vi vandt
                              </button>
                              <button onClick={() => reportResult(myMatch, false)} disabled={busyId === myMatch.id}
                                style={{ ...btn(false), padding: '8px 14px', fontSize: '13px' }}>
                                😔 Vi tabte
                              </button>
                              <button onClick={() => { setReportingMatch(null); setScoreText(''); }}
                                style={{ ...btn(false), padding: '7px 12px', fontSize: '12px' }}>Annullér</button>
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => setReportingMatch(myMatch.id)}
                            style={{ ...btn(true), padding: '8px 14px', fontSize: '13px' }}>
                            Indberét resultat
                          </button>
                        )}
                      </div>
                    ) : null}
                  </div>
                )}

                {/* Rangliste */}
                {(league.status === 'active' || league.status === 'completed') && teams.length > 0 && (
                  <div style={{ marginBottom: '10px' }}>
                    <button onClick={() => toggleStandings(league.id)}
                      style={{ ...btn(false), padding: '7px 12px', fontSize: '12px', width: '100%', justifyContent: 'space-between' }}>
                      <span>🏅 Holdrangliste</span>
                      {standingsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    {standingsOpen && (
                      <div style={{ marginTop: '8px', border: '1px solid ' + theme.border, borderRadius: '8px', overflow: 'hidden' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 44px 36px 36px', background: '#F8FAFC', borderBottom: '1px solid ' + theme.border }}>
                          {['#', 'Hold', 'Pts', 'V', 'T'].map(h => (
                            <div key={h} style={{ padding: '7px 8px', fontSize: '10px', fontWeight: 700, color: theme.textLight, textTransform: 'uppercase', textAlign: h === 'Hold' ? 'left' : 'center' }}>{h}</div>
                          ))}
                        </div>
                        {standings.map((t, i) => {
                          const isMyTeam = myTeam?.id === t.id;
                          return (
                            <div key={t.id} style={{ display: 'grid', gridTemplateColumns: '28px 1fr 44px 36px 36px', borderTop: i > 0 ? '1px solid ' + theme.border : 'none', background: isMyTeam ? theme.accentBg : 'transparent' }}>
                              <div style={{ padding: '10px 8px', fontSize: '12px', fontWeight: 700, color: i < 3 ? theme.warm : theme.textLight, textAlign: 'center' }}>
                                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                              </div>
                              <div style={{ padding: '10px 8px', minWidth: 0 }}>
                                <div style={{ fontSize: '13px', fontWeight: isMyTeam ? 700 : 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {t.name}{isMyTeam ? ' (jer)' : ''}
                                </div>
                                <div style={{ fontSize: '11px', color: theme.textLight, display: 'flex', gap: '4px', alignItems: 'center', marginTop: '2px' }}>
                                  <AvatarCircle avatar={t.player1_avatar} size={14} emojiSize="8px" style={{ background: theme.accentBg, border: '1px solid ' + theme.border }} />
                                  {t.player1_name}
                                  <span>+</span>
                                  <AvatarCircle avatar={t.player2_avatar} size={14} emojiSize="8px" style={{ background: theme.accentBg, border: '1px solid ' + theme.border }} />
                                  {t.player2_name}
                                </div>
                              </div>
                              <div style={{ padding: '10px 4px', fontSize: '13px', fontWeight: 700, color: theme.accent, textAlign: 'center' }}>{t.points}</div>
                              <div style={{ padding: '10px 4px', fontSize: '12px', fontWeight: 600, color: '#16A34A', textAlign: 'center' }}>{t.wins}</div>
                              <div style={{ padding: '10px 4px', fontSize: '12px', fontWeight: 600, color: '#DC2626', textAlign: 'center' }}>{t.losses}</div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Admin-panel */}
                {isAdmin && (
                  <div style={{ borderTop: '1px solid ' + theme.border, paddingTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {league.status === 'registration' && (
                      <button onClick={() => startLeague(league)} disabled={busy}
                        style={{ ...btn(true), padding: '7px 12px', fontSize: '12px', background: '#D97706', borderColor: '#D97706' }}>
                        <Play size={13} /> Start liga
                      </button>
                    )}
                    {league.status === 'active' && (
                      <>
                        <button onClick={() => nextRound(league)} disabled={busy}
                          style={{ ...btn(true), padding: '7px 12px', fontSize: '12px', background: '#D97706', borderColor: '#D97706' }}>
                          ⏭ Næste runde
                        </button>
                        <button onClick={() => completeLeague(league)} disabled={busy}
                          style={{ ...btn(false), padding: '7px 12px', fontSize: '12px' }}>
                          Afslut liga
                        </button>
                      </>
                    )}
                    <button onClick={() => deleteLeague(league)} disabled={busy}
                      style={{ ...btn(false), padding: '7px 12px', fontSize: '12px', color: '#DC2626', borderColor: '#FCA5A5' }}>
                      Slet
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
