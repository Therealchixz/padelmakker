import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { theme, btn, inputStyle, labelStyle, heading, tag } from '../lib/platformTheme';
import { Trophy, Users, Plus, Play, ChevronDown, ChevronUp } from 'lucide-react';
import { AvatarCircle } from '../components/AvatarCircle';
import { formatMatchDateDa } from '../lib/matchDisplayUtils';

function computeStandings(participants, matches) {
  const map = {};
  for (const p of participants) {
    map[p.id] = { ...p, points: 0, wins: 0, losses: 0, played: 0 };
  }
  for (const m of matches) {
    if (m.status !== 'reported' || !m.winner_id) continue;
    const winner = map[m.winner_id];
    const loserId = m.winner_id === m.player1_id ? m.player2_id : m.player1_id;
    const loser = loserId ? map[loserId] : null;
    if (winner) { winner.wins++; winner.points += 3; winner.played++; }
    if (loser)  { loser.losses++; loser.played++; }
  }
  return Object.values(map).sort((a, b) =>
    b.points !== a.points ? b.points - a.points :
    b.wins   !== a.wins   ? b.wins   - a.wins   :
    b.elo_at_signup - a.elo_at_signup
  );
}

function generatePairings(standings, allMatches) {
  const played = new Set(
    allMatches
      .filter(m => m.player1_id && m.player2_id)
      .map(m => [m.player1_id, m.player2_id].sort().join('|'))
  );
  const pairings = [];
  const used = new Set();
  for (let i = 0; i < standings.length; i++) {
    if (used.has(standings[i].id)) continue;
    const p1 = standings[i];
    let paired = false;
    for (let j = i + 1; j < standings.length; j++) {
      if (used.has(standings[j].id)) continue;
      const p2 = standings[j];
      if (played.has([p1.id, p2.id].sort().join('|'))) continue;
      pairings.push({ player1_id: p1.id, player2_id: p2.id });
      used.add(p1.id); used.add(p2.id);
      paired = true; break;
    }
    if (!paired && !used.has(p1.id)) {
      pairings.push({ player1_id: p1.id, player2_id: null });
      used.add(p1.id);
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

export function LigaTab({ user, showToast }) {
  const isAdmin = user?.role === 'admin';
  const [view, setView] = useState('active');
  const [leagues, setLeagues] = useState([]);
  const [myPartIds, setMyPartIds] = useState({});
  const [partsByLeague, setPartsByLeague] = useState({});
  const [matchesByLeague, setMatchesByLeague] = useState({});
  const [snippets, setSnippets] = useState({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [openStandings, setOpenStandings] = useState(new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', description: '', season_type: 'monthly', start_date: '', end_date: '' });
  const [reportingMatch, setReportingMatch] = useState(null);
  const [scoreText, setScoreText] = useState('');

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [lgRes, myRes] = await Promise.all([
        supabase.from('leagues').select('*').order('created_at', { ascending: false }),
        supabase.from('league_participants').select('id, league_id').eq('user_id', user.id),
      ]);
      const lgList = lgRes.data || [];
      setLeagues(lgList);
      const myMap = {};
      for (const r of (myRes.data || [])) myMap[r.league_id] = r.id;
      setMyPartIds(myMap);
      if (lgList.length === 0) return;

      const ids = lgList.map(l => l.id);
      const [partRes, matchRes] = await Promise.all([
        supabase.from('league_participants').select('*').in('league_id', ids),
        supabase.from('league_matches').select('*').in('league_id', ids),
      ]);
      const partMap = {};
      const userIds = new Set();
      for (const p of (partRes.data || [])) {
        if (!partMap[p.league_id]) partMap[p.league_id] = [];
        partMap[p.league_id].push(p);
        userIds.add(p.user_id);
      }
      setPartsByLeague(partMap);
      const matchMap = {};
      for (const m of (matchRes.data || [])) {
        if (!matchMap[m.league_id]) matchMap[m.league_id] = [];
        matchMap[m.league_id].push(m);
      }
      setMatchesByLeague(matchMap);
      if (userIds.size > 0) {
        const { data: profs } = await supabase.from('profiles').select('id, full_name, name, avatar').in('id', [...userIds]);
        const sMap = {};
        for (const p of (profs || [])) sMap[p.id] = p;
        setSnippets(sMap);
      }
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const joinLeague = async (league) => {
    setBusyId(league.id);
    try {
      const snap = snippets[user.id] || {};
      const { error } = await supabase.from('league_participants').insert({
        league_id: league.id,
        user_id: user.id,
        display_name: snap.full_name || snap.name || user.full_name || user.name || 'Spiller',
        avatar: snap.avatar || user.avatar || '🎾',
        elo_at_signup: Math.round(Number(user.elo_rating) || 1000),
      });
      if (error) throw error;
      showToast('Du er tilmeldt!');
      await load();
    } catch (e) { showToast('Fejl: ' + e.message); }
    finally { setBusyId(null); }
  };

  const leaveLeague = async (leagueId) => {
    if (!window.confirm('Meld dig af ligaen?')) return;
    setBusyId(leagueId);
    try {
      const { error } = await supabase.from('league_participants').delete().eq('league_id', leagueId).eq('user_id', user.id);
      if (error) throw error;
      showToast('Du er afmeldt.');
      await load();
    } catch (e) { showToast('Fejl: ' + e.message); }
    finally { setBusyId(null); }
  };

  const reportResult = async (match, iWon) => {
    const myPartId = myPartIds[match.league_id];
    if (!myPartId) return;
    const winnerId = iWon ? myPartId : (match.player1_id === myPartId ? match.player2_id : match.player1_id);
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
    const parts = partsByLeague[league.id] || [];
    if (parts.length < 2) { showToast('Mindst 2 tilmeldte kræves.'); return; }
    if (!window.confirm(`Start "${league.name}" og generér runde 1?`)) return;
    setBusyId(league.id + '-start');
    try {
      const allMatches = matchesByLeague[league.id] || [];
      const standings = computeStandings(parts, allMatches);
      const pairings = generatePairings(standings, allMatches);
      const rows = pairings.map(p => ({
        league_id: league.id, round_number: 1,
        player1_id: p.player1_id, player2_id: p.player2_id || null,
        status: p.player2_id ? 'pending' : 'reported',
        winner_id: p.player2_id ? null : p.player1_id,
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
    const parts = partsByLeague[league.id] || [];
    const allMatches = matchesByLeague[league.id] || [];
    const pending = allMatches.filter(m => m.round_number === league.current_round && m.status === 'pending');
    if (pending.length > 0) {
      if (!window.confirm(`${pending.length} kampe i runde ${league.current_round} er ikke rapporteret endnu. Fortsæt alligevel?`)) return;
    }
    setBusyId(league.id + '-next');
    try {
      const standings = computeStandings(parts, allMatches);
      const pairings = generatePairings(standings, allMatches);
      const round = league.current_round + 1;
      const rows = pairings.map(p => ({
        league_id: league.id, round_number: round,
        player1_id: p.player1_id, player2_id: p.player2_id || null,
        status: p.player2_id ? 'pending' : 'reported',
        winner_id: p.player2_id ? null : p.player1_id,
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
      {/* Top row */}
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
            const parts = partsByLeague[league.id] || [];
            const matches = matchesByLeague[league.id] || [];
            const joined = !!myPartIds[league.id];
            const myPartId = myPartIds[league.id];
            const standings = computeStandings(parts, matches);
            const standingsOpen = openStandings.has(league.id);
            const sc = STATUS_COLORS[league.status] || {};
            const busy = busyId === league.id || (typeof busyId === 'string' && busyId.startsWith(league.id + '-'));

            const currentRoundMatches = matches.filter(m => m.round_number === league.current_round);
            const myMatch = myPartId ? currentRoundMatches.find(m => m.player1_id === myPartId || m.player2_id === myPartId) : null;
            const opponentPartId = myMatch ? (myMatch.player1_id === myPartId ? myMatch.player2_id : myMatch.player1_id) : null;
            const opponentPart = opponentPartId ? parts.find(p => p.id === opponentPartId) : null;
            const opSnap = opponentPart ? snippets[opponentPart.user_id] : null;
            const opName = opSnap?.full_name || opSnap?.name || opponentPart?.display_name || 'Modstander';
            const opAvatar = opSnap?.avatar || opponentPart?.avatar || '🎾';

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
                      <Users size={10} /> {parts.length}
                    </span>
                  </div>
                </div>

                {/* Tilmelding */}
                {league.status === 'registration' && (
                  <div style={{ marginBottom: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    {joined ? (
                      <>
                        <span style={{ fontSize: '12px', color: '#1D4ED8', fontWeight: 600 }}>✓ Du er tilmeldt</span>
                        <button onClick={() => leaveLeague(league.id)} disabled={busy} style={{ ...btn(false), padding: '6px 12px', fontSize: '12px' }}>Afmeld</button>
                      </>
                    ) : (
                      <button onClick={() => joinLeague(league)} disabled={busy} style={{ ...btn(true), padding: '8px 16px', fontSize: '13px' }}>
                        {busy ? 'Tilmelder…' : '+ Tilmeld mig'}
                      </button>
                    )}
                  </div>
                )}

                {/* Min kamp denne runde */}
                {league.status === 'active' && joined && myMatch && (
                  <div style={{ background: theme.accentBg, borderRadius: '10px', padding: '14px', marginBottom: '12px', border: '1px solid ' + theme.accent + '30' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: theme.accent, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                      Din kamp — runde {league.current_round}
                    </div>
                    {myMatch.player2_id === null ? (
                      <div style={{ fontSize: '13px', color: theme.textMid }}>Fri runde — automatisk sejr 🎾</div>
                    ) : myMatch.status === 'reported' ? (
                      <div style={{ fontSize: '13px', color: theme.textMid }}>
                        {myMatch.winner_id === myPartId ? '🏆 Du vandt' : '😔 Du tabte'}
                        {myMatch.score_text && <span style={{ color: theme.textLight }}> · {myMatch.score_text}</span>}
                        <span style={{ color: theme.textLight }}> vs. {opName}</span>
                      </div>
                    ) : (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                          <AvatarCircle avatar={opAvatar} size={36} emojiSize="17px" style={{ background: '#EFF6FF', border: '1px solid ' + theme.border, flexShrink: 0 }} />
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '14px' }}>vs. {opName}</div>
                            <div style={{ fontSize: '11px', color: theme.textLight }}>ELO {opponentPart?.elo_at_signup ?? '?'} ved tilmelding</div>
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
                                🏆 Jeg vandt
                              </button>
                              <button onClick={() => reportResult(myMatch, false)} disabled={busyId === myMatch.id}
                                style={{ ...btn(false), padding: '8px 14px', fontSize: '13px' }}>
                                😔 Jeg tabte
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
                    )}
                  </div>
                )}

                {/* Rangliste */}
                {(league.status === 'active' || league.status === 'completed') && parts.length > 0 && (
                  <div style={{ marginBottom: '10px' }}>
                    <button onClick={() => toggleStandings(league.id)}
                      style={{ ...btn(false), padding: '7px 12px', fontSize: '12px', width: '100%', justifyContent: 'space-between' }}>
                      <span>🏅 Rangliste</span>
                      {standingsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    {standingsOpen && (
                      <div style={{ marginTop: '8px', border: '1px solid ' + theme.border, borderRadius: '8px', overflow: 'hidden' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 44px 40px 40px', background: '#F8FAFC', borderBottom: '1px solid ' + theme.border }}>
                          {['#', 'Spiller', 'Pts', 'V', 'T'].map(h => (
                            <div key={h} style={{ padding: '7px 8px', fontSize: '10px', fontWeight: 700, color: theme.textLight, textTransform: 'uppercase', textAlign: h === 'Spiller' ? 'left' : 'center' }}>{h}</div>
                          ))}
                        </div>
                        {standings.map((p, i) => {
                          const snap = snippets[p.user_id];
                          const av = snap?.avatar || p.avatar || '🎾';
                          const isMe = p.user_id === user.id;
                          return (
                            <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '28px 1fr 44px 40px 40px', borderTop: i > 0 ? '1px solid ' + theme.border : 'none', background: isMe ? theme.accentBg : 'transparent' }}>
                              <div style={{ padding: '10px 8px', fontSize: '12px', fontWeight: 700, color: i < 3 ? theme.warm : theme.textLight, textAlign: 'center' }}>
                                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                              </div>
                              <div style={{ padding: '10px 8px', display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
                                <AvatarCircle avatar={av} size={24} emojiSize="12px" style={{ background: theme.accentBg, border: '1px solid ' + theme.border, flexShrink: 0 }} />
                                <span style={{ fontSize: '13px', fontWeight: isMe ? 700 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {snap?.full_name || snap?.name || p.display_name}{isMe ? ' (dig)' : ''}
                                </span>
                              </div>
                              <div style={{ padding: '10px 4px', fontSize: '13px', fontWeight: 700, color: theme.accent, textAlign: 'center' }}>{p.points}</div>
                              <div style={{ padding: '10px 4px', fontSize: '12px', fontWeight: 600, color: '#16A34A', textAlign: 'center' }}>{p.wins}</div>
                              <div style={{ padding: '10px 4px', fontSize: '12px', fontWeight: 600, color: '#DC2626', textAlign: 'center' }}>{p.losses}</div>
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
