import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useConfirm } from '../lib/ConfirmDialogProvider';
import { theme, btn, inputStyle, labelStyle } from '../lib/platformTheme';
import { Trophy, Plus } from 'lucide-react';
import { EmptyStateIcon } from '../components/EmptyStateIcon';
import { PillTabs } from '../components/PillTabs';
import { ScopeSearchControls } from '../components/ScopeSearchControls';
import { TabbedFilterCard } from '../components/TabbedFilterCard';
import { PlayerProfileModal } from './PlayerProfileModal';
import { LigaListCard } from './LigaListCard';
import { LigaDetailSheet } from './LigaDetailSheet';
import { LigaScheduleSheet } from './LigaScheduleSheet';
import { LigaTeamProfileSheet } from './LigaTeamProfileSheet';
import { LigaSelectedDetail, SwissRulesBox } from './LigaSelectedDetail';
import { computeStandings, generatePairings } from '../lib/ligaStandings';
import { getLigaBadge } from '../lib/ligaDisplayUtils';
import { kampeCreateHint } from '../lib/kampeCreateHint';
import { notifyLeagueFull } from '../lib/notifyKampeEntityFull';
import { notifyLeagueStarted } from '../lib/notifyKampeEntityStarted';
import { sendPushNotificationsForUsers } from '../lib/notifications';
import { readLigaSessionPrefs, mergeLigaSessionPrefs } from '../lib/ligaSessionPrefs';
import { useScrollIntoViewWhen } from '../lib/useScrollIntoViewWhen';
import { DateInputField } from '../components/DateInputField';
import { profileAreaMatchesKampeRegionFilter } from '../lib/kampeListFilterCore';

const SEASON_LABELS = { weekly: 'Ugentlig', monthly: 'Månedlig' };

function buildNextMatchLabel(league, myTeam, teams, matches) {
  if (!myTeam || league.status !== 'active') return null;
  const currentRoundMatches = matches.filter((m) => m.round_number === league.current_round);
  const myMatch = currentRoundMatches.find((m) => m.team1_id === myTeam.id || m.team2_id === myTeam.id);
  if (!myMatch) return null;
  if (myMatch.team2_id === null) return 'Fri runde denne runde';
  if (myMatch.status === 'reported') return null;
  const oppId = myMatch.team1_id === myTeam.id ? myMatch.team2_id : myMatch.team1_id;
  const opp = teams.find((t) => t.id === oppId);
  return opp ? `Næste kamp mod ${opp.name}` : 'Næste kamp venter';
}

export function LigaTab({
  user,
  showToast,
  createOpen: createOpenProp,
  onCreateOpenChange,
  embedInKampe = false,
  tabActive = true,
  focusLeagueId = null,
  onFocusLeagueHandled,
  scope: scopeProp,
  onScopeChange,
  searchQuery: searchQueryProp,
  onSearchQueryChange,
  listRegionFilter = '',
  onFilteredCountChange,
}) {
  const isAdmin = user?.role === 'admin';
  const navigate = useNavigate();
  const ask = useConfirm();
  const [view, setView] = useState(() => {
    const s = readLigaSessionPrefs(user?.id);
    if (s?.ligaView === 'registration' || s?.ligaView === 'active' || s?.ligaView === 'completed') {
      return s.ligaView;
    }
    return 'registration';
  });
  const [scopeLocal, setScopeLocal] = useState(() => {
    const s = readLigaSessionPrefs(user?.id);
    if (s?.ligaScope === 'mine' || s?.ligaScope === 'alle') return s.ligaScope;
    return 'alle';
  });
  const [searchLocal, setSearchLocal] = useState('');
  const scope = scopeProp ?? scopeLocal;
  const search = searchQueryProp ?? searchLocal;
  const setScope = onScopeChange ?? setScopeLocal;
  const setSearch = onSearchQueryChange ?? setSearchLocal;
  const [viewPlayer, setViewPlayer] = useState(null);
  const [leagues, setLeagues] = useState([]);
  const [teamsByLeague, setTeamsByLeague] = useState({});
  const [allTeamsByLeague, setAllTeamsByLeague] = useState({});
  const [matchesByLeague, setMatchesByLeague] = useState({});
  const [myTeamByLeague, setMyTeamByLeague] = useState({});
  const [pendingInvites, setPendingInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [creatorAreasByUserId, setCreatorAreasByUserId] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [openManageTools, setOpenManageTools] = useState({});

  // Create league form (admin) — controlled by parent if props provided
  const [createOpenLocal, setCreateOpenLocal] = useState(false);
  const createOpen = createOpenProp !== undefined ? createOpenProp : createOpenLocal;
  const setCreateOpen = onCreateOpenChange !== undefined ? onCreateOpenChange : setCreateOpenLocal;
  const ligaCreateFormRef = useRef(null);
  useScrollIntoViewWhen(createOpen, ligaCreateFormRef, { enabled: isAdmin, block: 'start' });
  const [createForm, setCreateForm] = useState({ name: '', description: '', season_type: 'monthly', start_date: '', end_date: '', max_teams: '' });

  // Create team form
  const [teamFormLeagueId, setTeamFormLeagueId] = useState(null);
  const [teamName, setTeamName] = useState('');
  const [selectedPartner, setSelectedPartner] = useState(null);

  // Report result
  const [reportingMatch, setReportingMatch] = useState(null);
  const [scoreText, setScoreText] = useState('');
  const [selectedWinnerId, setSelectedWinnerId] = useState(null);
  const [confirmPending, setConfirmPending] = useState(null); // { match, winnerId }
  const [selectedLeagueId, setSelectedLeagueId] = useState(null);
  const [scheduleLeagueId, setScheduleLeagueId] = useState(null);
  const [profileTeam, setProfileTeam] = useState(null);
  const [profileTeamLeagueId, setProfileTeamLeagueId] = useState(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setLoadError('');
    try {
      const [lgRes, teamsRes] = await Promise.all([
        supabase.from('leagues').select('*').order('created_at', { ascending: false }),
        supabase.from('league_teams').select('*').or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`),
      ]);
      if (lgRes.error) throw lgRes.error;
      if (teamsRes.error) throw teamsRes.error;
      const lgList = lgRes.data || [];
      setLeagues(lgList);

      const creatorIds = [...new Set(lgList.map((l) => l.created_by).filter(Boolean))];
      if (creatorIds.length > 0) {
        const { data: creatorProfiles } = await supabase
          .from('profiles')
          .select('id, area')
          .in('id', creatorIds);
        const areaMap = {};
        (creatorProfiles || []).forEach((p) => {
          areaMap[String(p.id)] = String(p.area || '');
        });
        setCreatorAreasByUserId(areaMap);
      } else {
        setCreatorAreasByUserId({});
      }

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
      if (allTeamsRes.error) throw allTeamsRes.error;
      if (matchRes.error) throw matchRes.error;
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
    } catch (e) {
      console.error(e);
      setLoadError('Kunne ikke hente liga-data lige nu.');
      showToast('Kunne ikke hente liga-data. Tjek din forbindelse og prøv igen.');
    } finally {
      setLoading(false);
    }
  }, [user?.id, showToast]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!user?.id) return;
    mergeLigaSessionPrefs(user.id, { ligaView: view, ligaScope: scope });
  }, [user?.id, view, scope]);

  const openProfile = (id, name, avatar) => setViewPlayer({ id, full_name: name, avatar });

  const maybeNotifyLeagueFull = async (leagueId) => {
    const league = leagues.find((l) => l.id === leagueId);
    if (!league?.max_teams || String(league.status || '').toLowerCase() !== 'registration') return;
    const { count, error: cErr } = await supabase
      .from('league_teams')
      .select('*', { count: 'exact', head: true })
      .eq('league_id', leagueId);
    if (cErr) {
      console.warn('maybeNotifyLeagueFull count:', cErr.message);
      return;
    }
    if ((count ?? 0) >= league.max_teams) {
      void notifyLeagueFull(league);
    }
  };

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
      void maybeNotifyLeagueFull(leagueId);
      const leagueName = leagues.find(l => l.id === leagueId)?.name || 'ligaen';
      const inviteTitle = 'Holdinvitation 🎾';
      const inviteBody = `${user.full_name || user.name || 'En spiller'} inviterer dig til holdet "${teamName.trim()}" i ${leagueName}`;
      await supabase.rpc('notify_league_invite', {
        p_user_id: selectedPartner.id,
        p_league_id: leagueId,
        p_title: inviteTitle,
        p_body: inviteBody,
      });
      void sendPushNotificationsForUsers(
        [selectedPartner.id],
        'team_invite',
        inviteTitle,
        inviteBody,
        null,
        { entityType: 'league', entityId: leagueId },
      );
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
      const acceptTitle = 'Invitation accepteret! 🎾';
      const acceptBody = `${user.full_name || user.name || 'Din makker'} har accepteret invitationen til holdet "${team.name}".`;
      void supabase.rpc('notify_league_invite_accepted', {
        p_team_id: team.id,
        p_title: acceptTitle,
        p_body: acceptBody,
      }).then(({ error: nErr }) => {
        if (nErr) console.warn('notify_league_invite_accepted:', nErr.message || nErr);
      });
      if (team.player1_id && team.league_id) {
        void sendPushNotificationsForUsers(
          [team.player1_id],
          'team_invite_accepted',
          acceptTitle,
          acceptBody,
          null,
          { entityType: 'league', entityId: team.league_id },
        );
      }
      showToast('Du har accepteret invitationen! 🎾');
      await load();
    } catch (e) { showToast('Fejl: ' + e.message); }
    finally { setBusyId(null); }
  };

  const declineInvite = async (team) => {
    const ok = await ask({
      message: `Afvis invitation til holdet "${team.name}"?`,
      confirmLabel: 'Ja, afvis',
      danger: true,
    });
    if (!ok) return;
    setBusyId(team.id + '-decline');
    try {
      const declineTitle = 'Invitation afvist';
      const declineBody = `${user.full_name || user.name || 'Din makker'} har afvist invitationen til holdet "${team.name}".`;
      await supabase.rpc('notify_league_invite_declined', {
        p_team_id: team.id,
        p_title: declineTitle,
        p_body: declineBody,
      });
      if (team.player1_id && team.league_id) {
        void sendPushNotificationsForUsers(
          [team.player1_id],
          'team_invite_declined',
          declineTitle,
          declineBody,
          null,
          { entityType: 'league', entityId: team.league_id },
        );
      }
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
    const ok = await ask({
      message: 'Afmeld dit hold fra ligaen?',
      confirmLabel: 'Ja, afmeld',
      danger: true,
    });
    if (!ok) return;
    setBusyId(leagueId + '-leave');
    try {
      const { error } = await supabase.from('league_teams').delete().eq('id', myTeam.id);
      if (error) throw error;
      showToast('Hold afmeldt.');
      await load();
    } catch (e) { showToast('Fejl: ' + e.message); }
    finally { setBusyId(null); }
  };

  const kickTeam = async (team) => {
    const ok = await ask({
      message: `Smid "${team.name}" ud af ligaen?`,
      confirmLabel: 'Ja, smid ud',
      danger: true,
    });
    if (!ok) return;
    setBusyId(team.id + '-kick');
    try {
      const { error } = await supabase.from('league_teams').delete().eq('id', team.id);
      if (error) throw error;
      showToast('Hold fjernet fra ligaen.');
      await load();
    } catch (e) { showToast('Fejl: ' + e.message); }
    finally { setBusyId(null); }
  };

  const cancelReporting = () => {
    setReportingMatch(null); setScoreText(''); setSelectedWinnerId(null); setConfirmPending(null);
  };

  const reportResult = async (match, winnerId, score) => {
    setBusyId(match.id);
    try {
      const { error } = await supabase.from('league_matches').update({
        winner_id: winnerId,
        score_text: score || null,
        status: 'reported',
        reported_by: user.id,
      }).eq('id', match.id);
      if (error) throw error;
      showToast('Resultat registreret! 🎾');
      cancelReporting();
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
      const maxT = createForm.max_teams !== '' ? parseInt(createForm.max_teams, 10) : null;
      const { error } = await supabase.from('leagues').insert({
        name: createForm.name.trim(),
        description: createForm.description.trim() || null,
        season_type: createForm.season_type,
        start_date: createForm.start_date,
        end_date: createForm.end_date,
        max_teams: maxT && maxT > 0 ? maxT : null,
        created_by: user.id,
      });
      if (error) throw error;
      showToast('Liga oprettet!');
      setCreateOpen(false);
      setCreateForm({ name: '', description: '', season_type: 'monthly', start_date: '', end_date: '', max_teams: '' });
      await load();
    } catch (e) { showToast('Fejl: ' + e.message); }
    finally { setBusyId(null); }
  };

  const startLeague = async (league) => {
    const teams = teamsByLeague[league.id] || [];
    if (teams.length < 2) { showToast('Mindst 2 hold kræves for at starte.'); return; }
    const ok = await ask({
      message: `Start "${league.name}" og generér runde 1?`,
      confirmLabel: 'Ja, start',
    });
    if (!ok) return;
    setBusyId(league.id + '-start');
    try {
      // Use the larger of log2 (Swiss minimum) and teams-1 (full round-robin for small groups)
      const totalRounds = Math.max(
        Math.ceil(Math.log2(Math.max(2, teams.length))),
        teams.length <= 6 ? teams.length - 1 : 0
      );
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
      const { error: uErr } = await supabase.from('leagues').update({ status: 'active', current_round: 1, total_rounds: totalRounds }).eq('id', league.id);
      if (uErr) throw uErr;
      void notifyLeagueStarted(league, user.id);
      showToast(`Liga startet — runde 1 af ${totalRounds} genereret!`);
      await load();
    } catch (e) { showToast('Fejl: ' + e.message); }
    finally { setBusyId(null); }
  };

  const nextRound = async (league) => {
    const teams = teamsByLeague[league.id] || [];
    const allMatches = matchesByLeague[league.id] || [];
    const pending = allMatches.filter(m => m.round_number === league.current_round && m.status === 'pending');
    if (pending.length > 0) {
      showToast(`${pending.length} kamp${pending.length > 1 ? 'e' : ''} mangler stadig resultat i runde ${league.current_round}.`);
      return;
    }
    const totalRounds = league.total_rounds;
    if (totalRounds && league.current_round >= totalRounds) {
      const ok = await ask({
        message: `Alle ${totalRounds} planlagte runder er spillet! Afslut ligaen nu?`,
        confirmLabel: 'Ja, afslut',
      });
      if (ok) await completeLeague(league, { skipConfirm: true });
      return;
    }
    const round = league.current_round + 1;

    // Check if any real pairings are possible before generating
    const previewStandings = computeStandings(teams, allMatches);
    const previewPairings = generatePairings(previewStandings, allMatches);
    const hasRealMatches = previewPairings.some(p => p.team2_id !== null);
    if (!hasRealMatches) {
      const ok = await ask({
        message: 'Alle hold har allerede spillet mod hinanden — der er ingen gyldige parringer tilbage.\n\nVil du afslutte ligaen og låse ranglisten?',
        confirmLabel: 'Ja, afslut',
      });
      if (ok) await completeLeague(league, { skipConfirm: true });
      return;
    }

    const okGen = await ask({
      message: `Generér runde ${round}${totalRounds ? ` af ${totalRounds}` : ''}?`,
      confirmLabel: 'Ja, generér',
    });
    if (!okGen) return;
    setBusyId(league.id + '-next');
    try {
      const standings = computeStandings(teams, allMatches);
      const pairings = generatePairings(standings, allMatches);
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
      showToast(`Runde ${round}${totalRounds ? ` af ${totalRounds}` : ''} genereret!`);
      await load();
    } catch (e) { showToast('Fejl: ' + e.message); }
    finally { setBusyId(null); }
  };

  const completeLeague = async (league, opts = {}) => {
    if (!opts.skipConfirm) {
      const ok = await ask({
        message: `Afslut "${league.name}"? Ranglisten låses.`,
        confirmLabel: 'Ja, afslut',
        danger: true,
      });
      if (!ok) return;
    }
    setBusyId(league.id + '-complete');
    try {
      const nowIso = new Date().toISOString();
      const { error } = await supabase
        .from('leagues')
        .update({ status: 'completed', completed_at: nowIso, updated_at: nowIso })
        .eq('id', league.id);
      if (error) throw error;
      showToast('Liga afsluttet!');
      const { notifyLeagueCompleted } = await import('../lib/notifyKampeEntityComplete');
      void notifyLeagueCompleted(league, user.id);
      await load();
    } catch (e) { showToast('Fejl: ' + e.message); }
    finally { setBusyId(null); }
  };

  const toggleManageTools = (id) => setOpenManageTools((prev) => ({ ...prev, [id]: !prev[id] }));

  const closeDetailSheet = () => {
    if (teamFormLeagueId === selectedLeagueId) {
      setTeamFormLeagueId(null);
      setTeamName('');
      setSelectedPartner(null);
    }
    setSelectedLeagueId(null);
  };

  useEffect(() => {
    const lid = focusLeagueId;
    if (!lid || !tabActive || !embedInKampe || loading) return;
    const league = leagues.find((l) => String(l.id) === String(lid));
    if (!league) {
      onFocusLeagueHandled?.();
      return;
    }
    const st = String(league.status || '').toLowerCase();
    if (st === 'registration' || st === 'active' || st === 'completed') {
      setView(st);
    }
    setSelectedLeagueId(league.id);
    onFocusLeagueHandled?.();
  }, [focusLeagueId, tabActive, embedInKampe, loading, leagues, onFocusLeagueHandled]);

  const leaguesMatchingListFilters = useMemo(() => leagues.filter((l) => {
    if (scope === 'mine' && !myTeamByLeague[l.id] && l.created_by !== user.id) return false;
    if (listRegionFilter && !profileAreaMatchesKampeRegionFilter(creatorAreasByUserId[String(l.created_by)], listRegionFilter)) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!l.name?.toLowerCase().includes(q) && !l.description?.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [leagues, scope, myTeamByLeague, user?.id, listRegionFilter, creatorAreasByUserId, search]);

  const visibleLeagues = useMemo(
    () => leaguesMatchingListFilters.filter((l) => l.status === view),
    [leaguesMatchingListFilters, view],
  );

  useEffect(() => {
    onFilteredCountChange?.(visibleLeagues.length);
  }, [visibleLeagues.length, onFilteredCountChange]);
  const leagueScopeTabs = [
    { id: 'alle', label: 'Alle ligaer' },
    { id: 'mine', label: 'Mine ligaer' },
  ];
  const leagueTopTabs = [{ id: 'liga', label: 'Liga' }];
  const leagueStatusCount = useMemo(() => ({
    registration: leaguesMatchingListFilters.filter((l) => l.status === 'registration').length,
    active: leaguesMatchingListFilters.filter((l) => l.status === 'active').length,
    completed: leaguesMatchingListFilters.filter((l) => l.status === 'completed').length,
  }), [leaguesMatchingListFilters]);
  const leagueStatusTabs = [
    { id: 'registration', label: `Tilmelding${leagueStatusCount.registration > 0 ? ` ${leagueStatusCount.registration}` : ''}` },
    { id: 'active', label: `Aktiv${leagueStatusCount.active > 0 ? ` ${leagueStatusCount.active}` : ''}` },
    { id: 'completed', label: `Afsluttede${leagueStatusCount.completed > 0 ? ` ${leagueStatusCount.completed}` : ''}` },
  ];

  const selectedLeague = useMemo(
    () => (selectedLeagueId ? leagues.find((l) => l.id === selectedLeagueId) : null),
    [selectedLeagueId, leagues],
  );
  const scheduleLeague = useMemo(
    () => (scheduleLeagueId ? leagues.find((l) => l.id === scheduleLeagueId) : null),
    [scheduleLeagueId, leagues],
  );

  const myActiveLeagueHero = useMemo(() => {
    const activeLeague = leagues.find((l) => l.status === 'active' && myTeamByLeague[l.id]);
    if (!activeLeague) return null;
    const myTeam = myTeamByLeague[activeLeague.id];
    const teams = teamsByLeague[activeLeague.id] || [];
    const matches = matchesByLeague[activeLeague.id] || [];
    const standings = computeStandings(teams, matches);
    const rankIdx = myTeam ? standings.findIndex((t) => t.id === myTeam.id) : -1;
    const rank = rankIdx >= 0 ? rankIdx + 1 : null;
    const totalTeams = standings.length;
    const currentRoundMatches = matches.filter((m) => m.round_number === activeLeague.current_round);
    const myNextMatch = currentRoundMatches.find(
      (m) => (m.team1_id === myTeam?.id || m.team2_id === myTeam?.id) && m.status !== 'reported',
    );
    const nextMatchDate = myNextMatch?.scheduled_date || null;
    return { league: activeLeague, myTeam, rank, totalTeams, nextMatchDate };
  }, [leagues, myTeamByLeague, teamsByLeague, matchesByLeague]);

  return (
    <div>
      {viewPlayer && (
        <PlayerProfileModal
          player={viewPlayer}
          onClose={() => setViewPlayer(null)}
          onMessage={() => { setViewPlayer(null); navigate('/dashboard/beskeder?med=' + viewPlayer.id); }}
        />
      )}

      {!embedInKampe && (
        <TabbedFilterCard
          tabs={leagueTopTabs}
          value="liga"
          onTabChange={() => {}}
          tabAriaLabel="Liga format"
          action={isAdmin ? (
            <button type="button" onClick={() => setCreateOpen((v) => !v)} style={btn(true)}>
              {createOpen ? 'Annullér' : <><Plus size={15} /> Opret liga</>}
            </button>
          ) : null}
          bottom={(
            <ScopeSearchControls
              tabs={leagueScopeTabs}
              value={scope}
              onTabChange={(nextScope) => {
                setScope(nextScope);
                setSearch('');
                if (user?.id) mergeLigaSessionPrefs(user.id, { ligaScope: nextScope });
              }}
              searchValue={search}
              onSearchChange={setSearch}
              searchPlaceholder="Søg liga..."
              tabAriaLabel="Liga scope"
              className="pm-kampe-controls-bottom"
              tabsClassName="pm-kampe-segment"
              searchWrapClassName="pm-kampe-search-wrap"
              searchInputClassName="pm-kampe-search-input"
              searchIconClassName="pm-kampe-search-icon"
            />
          )}
          cardStyle={{ marginBottom: '12px' }}
        />
      )}

      {isAdmin && createOpen ? (
        <div
          ref={ligaCreateFormRef}
          className="pm-ui-card pm-create-form-anchor pm-create-form-panel"
          style={{ padding: '20px', marginBottom: '16px', width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}
        >
          <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '14px' }}>Ny liga</div>
          <label style={labelStyle}>Navn</label>
          <input value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} placeholder="F.eks. Forårssæson 2026" style={{ ...inputStyle, marginBottom: '10px' }} />
          <label style={labelStyle}>Beskrivelse <span style={{ fontWeight: 400, color: theme.textLight }}>(valgfri)</span></label>
          <input value={createForm.description} onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))} placeholder="Kort beskrivelse..." style={{ ...inputStyle, marginBottom: '10px' }} />
          <label style={labelStyle}>Type</label>
          <PillTabs
            tabs={[
              { id: 'weekly', label: SEASON_LABELS.weekly },
              { id: 'monthly', label: SEASON_LABELS.monthly },
            ]}
            value={createForm.season_type}
            onChange={(id) => setCreateForm((f) => ({ ...f, season_type: id }))}
            ariaLabel="Liga-type"
            size="sm"
            style={{ marginBottom: '10px' }}
          />
          <DateInputField
            label="Startdato"
            value={createForm.start_date}
            onChange={(e) => setCreateForm((f) => ({ ...f, start_date: e.target.value }))}
            labelStyle={labelStyle}
            inputStyle={{ ...inputStyle, marginBottom: '10px' }}
          />
          <DateInputField
            label="Slutdato"
            value={createForm.end_date}
            onChange={(e) => setCreateForm((f) => ({ ...f, end_date: e.target.value }))}
            labelStyle={labelStyle}
            inputStyle={{ ...inputStyle, marginBottom: '10px' }}
          />
          <label style={labelStyle}>Maks antal hold <span style={{ fontWeight: 400, color: theme.textLight }}>(valgfri)</span></label>
          <input
            type="number"
            min="2"
            value={createForm.max_teams}
            onChange={e => setCreateForm(f => ({ ...f, max_teams: e.target.value }))}
            placeholder="Ubegrænset"
            style={{ ...inputStyle, marginBottom: '14px' }}
          />
          <div className="pm-form-submit pm-form-submit-actions">
            <button
              type="button"
              onClick={createLeague}
              disabled={busyId === 'create'}
              style={btn(true, { size: 'md', fontWeight: 600 })}
            >
              {busyId === 'create' ? 'Opretter…' : 'Opret liga'}
            </button>
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              style={btn(false, { size: 'md', fontWeight: 600 })}
            >
              Annullér
            </button>
          </div>
        </div>
      ) : (
        <>
      {/* Min liga hero — vis brugerens aktive liga øverst */}
      {myActiveLeagueHero && !loading && (
        <div style={{
          background: 'linear-gradient(135deg, #0D2752 0%, #16377E 100%)',
          borderRadius: 16, padding: '18px 18px 16px', marginBottom: 16,
          color: '#fff', position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <svg style={{ width: 13, height: 13, color: '#F59E0B', flexShrink: 0 }} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.2 6.6.8-4.9 4.6 1.3 6.6L12 17l-5.9 3.2 1.3-6.6L2.5 9l6.6-.8Z"/></svg>
            <span style={{ fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.9px', textTransform: 'uppercase', color: '#9DB6DE' }}>Aktiv sæson</span>
          </div>
          <div style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '-0.3px', lineHeight: 1.2, marginBottom: 4 }}>
            {myActiveLeagueHero.league.name}
          </div>
          {myActiveLeagueHero.league.current_round ? (
            <div style={{ fontSize: '12px', color: '#9DB6DE', marginBottom: 14 }}>
              {myActiveLeagueHero.league.season_type === 'weekly' ? 'Ugentlig liga' : 'Månedlig liga'}
              {myActiveLeagueHero.league.total_rounds ? ` · Runde ${myActiveLeagueHero.league.current_round}/${myActiveLeagueHero.league.total_rounds}` : ''}
            </div>
          ) : null}
          <div style={{ display: 'flex', gap: 24, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#9DB6DE', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 3 }}>Placering</div>
              <div style={{ fontSize: '20px', fontWeight: 700 }}>
                {myActiveLeagueHero.rank != null ? (
                  <>#<span>{myActiveLeagueHero.rank}</span> <small style={{ fontSize: '13px', color: '#9DB6DE', fontWeight: 600 }}>/ {myActiveLeagueHero.totalTeams}</small></>
                ) : '—'}
              </div>
            </div>
            {myActiveLeagueHero.nextMatchDate ? (
              <div>
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#9DB6DE', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 3 }}>Næste kamp</div>
                <div style={{ fontSize: '14px', fontWeight: 700 }}>{myActiveLeagueHero.nextMatchDate}</div>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#9DB6DE', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 3 }}>Hold</div>
                <div style={{ fontSize: '14px', fontWeight: 700 }}>{myActiveLeagueHero.myTeam?.name || '—'}</div>
              </div>
            )}
          </div>
          <div style={{ textAlign: 'right' }}>
            <button
              type="button"
              onClick={() => setScheduleLeagueId(myActiveLeagueHero.league.id)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: '#D97706', color: '#fff', border: 'none',
                borderRadius: 10, padding: '9px 16px', fontSize: '13px', fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Se program
              <svg style={{ width: 13, height: 13 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </button>
          </div>
        </div>
      )}

      <div style={{ marginBottom: '14px' }}>
        <SwissRulesBox collapsible />
      </div>

      {/* Ventende invitationer */}
      {pendingInvites.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          {pendingInvites.map(invite => {
            const league = leagues.find(l => l.id === invite.league_id);
            const busy = busyId === invite.id + '-accept' || busyId === invite.id + '-decline';
            return (
              <div key={invite.id} className="pm-feedback-panel pm-feedback-panel--warning" style={{ borderRadius: theme.radius, padding: '14px 16px', marginBottom: '8px', textAlign: 'left' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: theme.warm, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                  ⚡ Holdinvitation
                </div>
                <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '2px' }}>{invite.name}</div>
                <div style={{ fontSize: '12px', color: theme.textMid, marginBottom: '10px' }}>
                  {invite.player1_name} inviterer dig med i {league?.name || 'en liga'}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => acceptInvite(invite)} disabled={busy}
                    style={{ ...btn(true), padding: '7px 14px', fontSize: '13px', background: theme.green, borderColor: theme.green }}>
                    {busyId === invite.id + '-accept' ? 'Accepterer…' : '✓ Acceptér'}
                  </button>
                  <button onClick={() => declineInvite(invite)} disabled={busy}
                    style={{ ...btn(false), padding: '7px 14px', fontSize: '13px', color: theme.red, borderColor: 'var(--pm-danger-border)' }}>
                    Afvis
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Sub-tabs */}
      <PillTabs
        tabs={leagueStatusTabs}
        value={view}
        onChange={(nextView) => {
          setView(nextView);
          if (user?.id) mergeLigaSessionPrefs(user.id, { ligaView: nextView });
        }}
        ariaLabel="Liga status"
        size="sm"
        style={{ marginBottom: '16px' }}
      />

      {loading ? (
        <div className="pm-state-card pm-state-card--loading">
          <div className="pm-spinner pm-state-spinner" />
          <div className="pm-state-title">Indlæser ligaer…</div>
          <div className="pm-state-copy">Vi henter sæsoner, hold og stilling.</div>
        </div>
      ) : loadError ? (
        <div className="pm-state-card pm-state-card--error">
          <div className="pm-state-icon">⚠️</div>
          <div className="pm-state-title">Kunne ikke hente ligaer</div>
          <div className="pm-state-copy">{loadError}</div>
          <div className="pm-state-actions">
            <button type="button" onClick={() => void load()} style={{ ...btn(true), fontSize: '13px' }}>
              Prøv igen
            </button>
          </div>
        </div>
      ) : visibleLeagues.length === 0 ? (
        <div className="pm-state-card pm-state-card--empty" style={{ padding: '52px 20px' }}>
          <EmptyStateIcon icon={Trophy} />
          <div className="pm-state-title">
            {view === 'registration' ? 'Ingen åbne ligaer' : view === 'active' ? 'Ingen aktive ligaer' : 'Ingen afsluttede ligaer'}
          </div>
          {isAdmin && view === 'registration' ? (
            <div className="pm-state-copy">{kampeCreateHint('liga', { embedInKampe })}</div>
          ) : !isAdmin && view === 'registration' ? (
            <div style={{ marginTop: '14px' }}>
              <div className="pm-state-copy" style={{ marginBottom: '14px' }}>
                Der er ingen åbne ligaer i øjeblikket.<br />
                Kontakt en admin for at få oprettet en ny liga.
              </div>
              <button
                onClick={async () => {
                  const { data } = await supabase.from('profiles').select('id').eq('role', 'admin').ilike('full_name', '%Mike Pedersen%').maybeSingle();
                  if (data?.id) navigate('/dashboard/beskeder?med=' + data.id);
                  else showToast('Ingen admin fundet.');
                }}
                style={{ ...btn(true), fontSize: '13px', display: 'inline-flex' }}
              >
                💬 Kontakt admin
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {visibleLeagues.map((league) => {
            const teams = teamsByLeague[league.id] || [];
            const regTeams = allTeamsByLeague[league.id] || [];
            const matches = matchesByLeague[league.id] || [];
            const myTeam = myTeamByLeague[league.id];
            const standings = computeStandings(teams, matches);
            const rankIdx = myTeam ? standings.findIndex((t) => t.id === myTeam.id) : -1;
            const myTeamRank = rankIdx >= 0 ? rankIdx + 1 : null;
            const regionLabel = creatorAreasByUserId[String(league.created_by)] || '';
            const nextMatchLabel = buildNextMatchLabel(league, myTeam, teams, matches);

            return (
              <LigaListCard
                key={league.id}
                league={league}
                regionLabel={regionLabel}
                teams={teams}
                regTeams={regTeams}
                standings={standings}
                myTeam={myTeam}
                myTeamRank={myTeamRank}
                nextMatchLabel={nextMatchLabel}
                onClick={() => setSelectedLeagueId(league.id)}
              />
            );
          })}
        </div>
      )}
        </>
      )}

      {selectedLeague && (() => {
        const teams = teamsByLeague[selectedLeague.id] || [];
        const regTeams = allTeamsByLeague[selectedLeague.id] || [];
        const matches = matchesByLeague[selectedLeague.id] || [];
        const myTeam = myTeamByLeague[selectedLeague.id];
        const joined = !!myTeam;
        const standings = computeStandings(teams, matches);
        const maxTeams = selectedLeague.max_teams || regTeams.length || teams.length;
        const regTeamCount = regTeams.length;
        const isFull = selectedLeague.max_teams && regTeamCount >= selectedLeague.max_teams;
        const showTeamForm = teamFormLeagueId === selectedLeague.id;
        const isCreator = selectedLeague.created_by === user.id;
        const canManageTeams = isAdmin || isCreator;
        const manageToolsOpen = !!openManageTools[selectedLeague.id];
        const busy = busyId === selectedLeague.id || (typeof busyId === 'string' && busyId.startsWith(selectedLeague.id + '-'));
        const regionLabel = creatorAreasByUserId[String(selectedLeague.created_by)] || '';
        const totalRounds = selectedLeague.total_rounds || (maxTeams > 0 ? Math.max(1, maxTeams - 1) : null);
        const badge = getLigaBadge(selectedLeague, { regTeamCount, maxTeams, totalRounds });
        const teamCount = selectedLeague.status === 'registration' ? regTeamCount : teams.length;

        let footer = null;
        if (selectedLeague.status === 'registration' && !joined && !isFull && !showTeamForm) {
          footer = (
            <button
              type="button"
              className="pm-liga-v2-primary-cta"
              style={btn(true)}
              onClick={() => setTeamFormLeagueId(selectedLeague.id)}
            >
              <Plus size={15} /> Tilmeld dit hold
            </button>
          );
        } else if (selectedLeague.status === 'active') {
          footer = (
            <button
              type="button"
              className="pm-liga-v2-secondary-cta"
              style={btn(false)}
              onClick={() => setScheduleLeagueId(selectedLeague.id)}
            >
              Se kampplan & resultater
            </button>
          );
        } else if (selectedLeague.status === 'completed') {
          footer = (
            <button
              type="button"
              className="pm-liga-v2-secondary-cta"
              style={btn(false)}
              onClick={() => setScheduleLeagueId(selectedLeague.id)}
            >
              Se sæsonoversigt
            </button>
          );
        }

        return (
          <LigaDetailSheet
            open
            onClose={closeDetailSheet}
            league={selectedLeague}
            regionLabel={regionLabel}
            teamCount={teamCount}
            totalRounds={totalRounds}
            badgeLabel={badge.label}
            badgeTone={badge.tone}
            footer={footer}
          >
            <LigaSelectedDetail
              league={selectedLeague}
              user={user}
              teams={teams}
              regTeams={regTeams}
              matches={matches}
              myTeam={myTeam}
              standings={standings}
              joined={joined}
              maxTeams={maxTeams}
              filled={regTeamCount}
              busyId={busyId}
              busy={busy}
              isAdmin={isAdmin}
              isCreator={isCreator}
              canManageTeams={canManageTeams}
              showTeamForm={showTeamForm}
              teamName={teamName}
              setTeamName={setTeamName}
              selectedPartner={selectedPartner}
              setSelectedPartner={setSelectedPartner}
              onCreateTeam={() => createTeam(selectedLeague.id)}
              onCancelTeamForm={() => { setTeamFormLeagueId(null); setTeamName(''); setSelectedPartner(null); }}
              onLeaveLeague={() => leaveLeague(selectedLeague.id)}
              onKickTeam={kickTeam}
              onTeamProfile={(t) => { setProfileTeam(t); setProfileTeamLeagueId(selectedLeague.id); }}
              onPlayerClick={openProfile}
              manageToolsOpen={manageToolsOpen}
              toggleManageTools={() => toggleManageTools(selectedLeague.id)}
              onStartLeague={() => startLeague(selectedLeague)}
              onNextRound={() => nextRound(selectedLeague)}
              onCompleteLeague={() => completeLeague(selectedLeague)}
              reportingMatch={reportingMatch}
              setReportingMatch={setReportingMatch}
              scoreText={scoreText}
              setScoreText={setScoreText}
              selectedWinnerId={selectedWinnerId}
              setSelectedWinnerId={setSelectedWinnerId}
              confirmPending={confirmPending}
              setConfirmPending={setConfirmPending}
              cancelReporting={cancelReporting}
              reportResult={reportResult}
              showToast={showToast}
              matchesByLeague={matchesByLeague}
            />
          </LigaDetailSheet>
        );
      })()}

      {scheduleLeague ? (
        <LigaScheduleSheet
          open
          onClose={() => setScheduleLeagueId(null)}
          league={scheduleLeague}
          teams={teamsByLeague[scheduleLeague.id] || []}
          matches={matchesByLeague[scheduleLeague.id] || []}
          myTeam={myTeamByLeague[scheduleLeague.id]}
          currentRound={scheduleLeague.current_round}
          totalRounds={scheduleLeague.total_rounds}
        />
      ) : null}

      {profileTeam ? (
        <LigaTeamProfileSheet
          open
          onClose={() => { setProfileTeam(null); setProfileTeamLeagueId(null); }}
          team={profileTeam}
          leagueId={profileTeamLeagueId}
          matches={profileTeamLeagueId ? (matchesByLeague[profileTeamLeagueId] || []) : []}
          onPlayerClick={openProfile}
          onOpenInMessages={(teamId) => {
            setProfileTeam(null);
            setProfileTeamLeagueId(null);
            navigate(`/dashboard/beskeder?hold=${teamId}`);
          }}
          userId={user.id}
          userName={user.full_name || user.name || 'Spiller'}
          userAvatar={user.avatar}
          canWriteTeamChat={
            isAdmin
            || (profileTeamLeagueId ? !!myTeamByLeague[profileTeamLeagueId] : false)
          }
          showToast={showToast}
        />
      ) : null}
    </div>
  );
}
