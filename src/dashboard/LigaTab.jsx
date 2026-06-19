import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useConfirm } from '../lib/ConfirmDialogProvider';
import { theme, btn, inputStyle, labelStyle, font } from '../lib/platformTheme';
import { Trophy, Plus, Check, Copy, ArrowRight } from 'lucide-react';
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
import { computeStandings, generatePairings, assignDivisionsByElo, groupByDivision } from '../lib/ligaStandings';
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
  const [createForm, setCreateForm] = useState({ name: '', region: '', num_divisions: 1, registration_deadline: '', start_date: '', description: '', season_type: 'monthly', end_date: '', max_teams: '', match_system: 'round_robin', points_win: 3, points_draw: 1, points_loss: 0, promotion_spots: 2, relegation_spots: 2, rules_notes: '' });
  const [createStep, setCreateStep] = useState(1);
  const [createStepErr, setCreateStepErr] = useState('');

  // Scroll til toppen ved skift mellem trin i opret-wizarden
  useEffect(() => {
    if (createOpen && typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [createStep, createOpen]);

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
  const [createdLeagueReceipt, setCreatedLeagueReceipt] = useState(null);
  const [ligaReceiptUrlCopied, setLigaReceiptUrlCopied] = useState(false);

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
    if (!createForm.name.trim() || !createForm.start_date) {
      showToast('Udfyld navn og startdato.'); return;
    }
    setBusyId('create');
    try {
      const maxT = createForm.max_teams !== '' ? parseInt(createForm.max_teams, 10) : null;
      const { data: created, error } = await supabase.from('leagues').insert({
        name: createForm.name.trim(),
        description: createForm.description.trim() || null,
        season_type: createForm.season_type,
        start_date: createForm.start_date,
        end_date: createForm.end_date || null,
        max_teams: maxT && maxT > 0 ? maxT : null,
        region: createForm.region || null,
        num_divisions: createForm.num_divisions || 1,
        registration_deadline: createForm.registration_deadline || null,
        match_system: createForm.match_system || 'round_robin',
        points_win: createForm.points_win ?? 3,
        points_draw: createForm.points_draw ?? 1,
        points_loss: createForm.points_loss ?? 0,
        promotion_spots: createForm.promotion_spots ?? 2,
        relegation_spots: createForm.relegation_spots ?? 2,
        rules_notes: createForm.rules_notes.trim() || null,
        created_by: user.id,
      }).select('id').single();
      if (error) throw error;
      setCreateOpen(false);
      setCreateStep(1);
      setCreateStepErr('');
      setCreatedLeagueReceipt({ id: created?.id, name: createForm.name.trim(), start_date: createForm.start_date, end_date: createForm.end_date, max_teams: maxT, num_divisions: createForm.num_divisions || 1, match_system: createForm.match_system, region: createForm.region, registration_deadline: createForm.registration_deadline, points_win: createForm.points_win, points_draw: createForm.points_draw, points_loss: createForm.points_loss });
      setCreateForm({ name: '', region: '', num_divisions: 1, registration_deadline: '', start_date: '', description: '', season_type: 'monthly', end_date: '', max_teams: '', match_system: 'round_robin', points_win: 3, points_draw: 1, points_loss: 0, promotion_spots: 2, relegation_spots: 2, rules_notes: '' });
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
      const numDiv = Math.min(Number(league.num_divisions) || 1, teams.length);
      // Inddel hold i divisioner efter niveau og gem det på holdene
      let teamsWithDiv = teams.map(t => ({ ...t, division: Number(t.division) || 1 }));
      if (numDiv > 1) {
        const divMap = assignDivisionsByElo(teams, numDiv);
        teamsWithDiv = teams.map(t => ({ ...t, division: divMap.get(t.id) || 1 }));
        await Promise.all([...divMap].map(([teamId, d]) =>
          supabase.from('league_teams').update({ division: d }).eq('id', teamId)));
      }
      // Generér runde 1 inden for hver division
      const groups = numDiv > 1 ? groupByDivision(teamsWithDiv) : [[1, teamsWithDiv]];
      const rows = [];
      let totalRounds = 0;
      for (const [, divTeams] of groups) {
        const standings = computeStandings(divTeams, []);
        const pairings = generatePairings(standings, []);
        rows.push(...pairings.map(p => ({
          league_id: league.id, round_number: 1,
          team1_id: p.team1_id, team2_id: p.team2_id || null,
          status: p.team2_id ? 'pending' : 'reported',
          winner_id: p.team2_id ? null : p.team1_id,
        })));
        const r = Math.max(
          Math.ceil(Math.log2(Math.max(2, divTeams.length))),
          divTeams.length <= 6 ? divTeams.length - 1 : 0
        );
        totalRounds = Math.max(totalRounds, r);
      }
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
      const numDiv = Math.min(Number(league.num_divisions) || 1, teams.length);
      // Parr inden for hver division ud fra divisionens egen stilling
      const groups = numDiv > 1 ? groupByDivision(teams) : [[1, teams]];
      const rows = [];
      for (const [, divTeams] of groups) {
        const divTeamIds = new Set(divTeams.map(t => t.id));
        const divMatches = allMatches.filter(m => divTeamIds.has(m.team1_id));
        const standings = computeStandings(divTeams, divMatches);
        const pairings = generatePairings(standings, divMatches);
        rows.push(...pairings.map(p => ({
          league_id: league.id, round_number: round,
          team1_id: p.team1_id, team2_id: p.team2_id || null,
          status: p.team2_id ? 'pending' : 'reported',
          winner_id: p.team2_id ? null : p.team1_id,
        })));
      }
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
    const numDiv = Math.min(Number(activeLeague.num_divisions) || 1, teams.length);
    // Rang inden for spillerens egen division (eller hele ligaen ved 1 division)
    const myDivision = numDiv > 1 ? (Number(myTeam?.division) || 1) : null;
    const divTeams = myDivision ? teams.filter((t) => (Number(t.division) || 1) === myDivision) : teams;
    const divTeamIds = new Set(divTeams.map((t) => t.id));
    const divMatches = myDivision ? matches.filter((m) => divTeamIds.has(m.team1_id)) : matches;
    const standings = computeStandings(divTeams, divMatches, { pointsWin: activeLeague.points_win, pointsDraw: activeLeague.points_draw, pointsLoss: activeLeague.points_loss });
    const rankIdx = myTeam ? standings.findIndex((t) => t.id === myTeam.id) : -1;
    const rank = rankIdx >= 0 ? rankIdx + 1 : null;
    const totalTeams = standings.length;
    const currentRoundMatches = matches.filter((m) => m.round_number === activeLeague.current_round);
    const myNextMatch = currentRoundMatches.find(
      (m) => (m.team1_id === myTeam?.id || m.team2_id === myTeam?.id) && m.status !== 'reported',
    );
    const nextMatchDate = myNextMatch?.scheduled_date || null;
    return { league: activeLeague, myTeam, rank, totalTeams, nextMatchDate, division: myDivision };
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

      {isAdmin && createOpen ? (() => {
        const ligaInputStyle = { ...inputStyle, marginBottom: 0 };
        const REGIONS = ['Region Midtjylland', 'Region Hovedstaden', 'Region Sjælland', 'Region Syddanmark', 'Region Nordjylland'];
        const MATCH_SYSTEMS = [
          { id: 'round_robin', label: 'Alle-mod-alle', desc: 'Standard ligaformat hvor alle hold mødes.' },
          { id: 'swiss', label: 'Swiss-system', desc: 'Hold parres efter stilling — færre kampe, jævnbyrdigt.' },
          { id: 'knockout', label: 'Eliminering', desc: 'Turneringstræ med direkte knockout.' },
        ];
        const SummaryRow = ({ label, value }) => (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--pm-americano-tie-border)' }}>
            <span style={{ fontSize: 12, color: theme.textLight }}>{label}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: theme.text, textAlign: 'right' }}>{value}</span>
          </div>
        );
        return (
        <div
          ref={ligaCreateFormRef}
          className="pm-ui-card pm-create-form-anchor pm-create-form-panel"
          style={{ paddingTop: '16px', paddingBottom: '16px', marginBottom: '16px', width: '100%', maxWidth: '100%', boxSizing: 'border-box', overflow: 'hidden' }}
        >
          {/* Wizard indicator */}
          <div className="pm-wiz" style={{ margin: '0 0 16px' }}>
            {[{ n: 1, label: 'Info' }, { n: 2, label: 'Regler' }, { n: 3, label: 'Bekræft' }].map((s, i, arr) => {
              const state = s.n < createStep ? 'done' : s.n === createStep ? 'on' : '';
              return (
                <span key={s.n} style={{ display: 'contents' }}>
                  <div className={`pm-wiz-step${state ? ' ' + state : ''}`}>
                    <div className="pm-wiz-num">{state === 'done' ? '✓' : s.n}</div>
                    <span className="pm-wiz-label">{s.label}</span>
                  </div>
                  {i < arr.length - 1 && <div className="pm-wiz-line" />}
                </span>
              );
            })}
          </div>

          {/* Step 1: Grundlæggende info */}
          {createStep === 1 && (
            <>
              <div className="pm-field">
                <label>Ligaens navn</label>
                <input
                  value={createForm.name}
                  onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="F.eks. Sommer Liga 2026"
                  style={ligaInputStyle}
                />
              </div>
              <div className="pm-field">
                <label>Region</label>
                <select
                  value={createForm.region}
                  onChange={e => setCreateForm(f => ({ ...f, region: e.target.value }))}
                  style={ligaInputStyle}
                >
                  <option value="">Vælg region</option>
                  {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="pm-field">
                <label>Antal divisioner</label>
                <div className="pm-stepper">
                  <button type="button" className="pm-stepper-btn" onClick={() => setCreateForm(f => ({ ...f, num_divisions: Math.max(1, (f.num_divisions || 1) - 1) }))}>−</button>
                  <span className="pm-stepper-val">{createForm.num_divisions || 1}</span>
                  <button type="button" className="pm-stepper-btn" onClick={() => setCreateForm(f => ({ ...f, num_divisions: Math.min(8, (f.num_divisions || 1) + 1) }))}>+</button>
                </div>
                <div className="pm-field-hint">Hold inddeles i divisioner efter niveau — med op- og nedrykning mellem sæsonerne.</div>
              </div>
              <div className="pm-field">
                <label>Tilmeldingsfrist &amp; sæsonstart</label>
                <div style={{ display: 'flex', gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: theme.textLight, marginBottom: 4 }}>Frist</div>
                    <DateInputField
                      value={createForm.registration_deadline}
                      onChange={e => setCreateForm(f => ({ ...f, registration_deadline: e.target.value }))}
                      inputStyle={ligaInputStyle}
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: theme.textLight, marginBottom: 4 }}>Start</div>
                    <DateInputField
                      value={createForm.start_date}
                      onChange={e => setCreateForm(f => ({ ...f, start_date: e.target.value }))}
                      inputStyle={ligaInputStyle}
                    />
                  </div>
                </div>
              </div>
              <div style={{ margin: '0 18px 14px', background: 'var(--pm-surface-muted)', border: '1px solid var(--pm-americano-tie-border)', borderRadius: 12, padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <svg style={{ width: 15, height: 15, color: 'var(--pm-navy)', flexShrink: 0, marginTop: 1 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
                <span style={{ fontSize: 11.5, color: theme.textLight, lineHeight: 1.55 }}>Du kan konfigurere specifikke regler og kampsystem i de næste trin.</span>
              </div>
              <div className="pm-format-card">
                <b>Skab dit fællesskab</b>
                <p>Ligaer samler spillere på alle niveauer — og giver faste kampe hele sæsonen.</p>
              </div>
            </>
          )}

          {/* Step 2: Divisionsindstillinger / Regler */}
          {createStep === 2 && (
            <>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: theme.textLight, textTransform: 'uppercase', letterSpacing: '1.2px', margin: '0 18px 8px' }}>Kampsystem</div>
              {MATCH_SYSTEMS.map(ms => (
                <div
                  key={ms.id}
                  onClick={() => setCreateForm(f => ({ ...f, match_system: ms.id }))}
                  style={{ margin: '0 18px 9px', padding: '13px 14px', borderRadius: 14, border: `1.5px solid ${createForm.match_system === ms.id ? 'var(--pm-navy)' : 'var(--pm-border)'}`, background: createForm.match_system === ms.id ? 'var(--pm-navy-bg, #EEF2FB)' : 'var(--pm-surface)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: theme.text }}>{ms.label}</div>
                    <div style={{ fontSize: 11.5, color: theme.textLight, marginTop: 2 }}>{ms.desc}</div>
                  </div>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${createForm.match_system === ms.id ? 'var(--pm-navy)' : 'var(--pm-border)'}`, background: createForm.match_system === ms.id ? 'var(--pm-navy)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {createForm.match_system === ms.id && <svg style={{ width: 10, height: 10 }} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 13 4 4L19 7"/></svg>}
                  </div>
                </div>
              ))}

              <div style={{ fontSize: 10.5, fontWeight: 700, color: theme.textLight, textTransform: 'uppercase', letterSpacing: '1.2px', margin: '4px 18px 8px' }}>Pointsystem</div>
              <div style={{ margin: '0 18px 12px', border: '1px solid var(--pm-border)', borderRadius: 14, background: 'var(--pm-surface)', overflow: 'hidden' }}>
                {[
                  { key: 'points_win', label: 'Vundet kamp (2-0 eller 2-1)', desc: 'Standard point for sejr', min: 1, max: 9 },
                  { key: 'points_draw', label: 'Uafgjort kamp', desc: 'Hvis sæt og partier ender lige', min: 0, max: 5 },
                  { key: 'points_loss', label: 'Tabt kamp', desc: 'Gives ofte for fremmøde', min: 0, max: 3 },
                ].map((row, idx, arr) => (
                  <div key={row.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: idx < arr.length - 1 ? '1px solid var(--pm-border)' : 'none' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: theme.text }}>{row.label}</div>
                      <div style={{ fontSize: 11, color: theme.textLight, marginTop: 1 }}>{row.desc}</div>
                    </div>
                    <div className="pm-stepper" style={{ width: 108 }}>
                      <button type="button" className="pm-stepper-btn" style={{ width: 30, height: 30 }} onClick={() => setCreateForm(f => ({ ...f, [row.key]: Math.max(row.min, (f[row.key] ?? 0) - 1) }))}>−</button>
                      <span className="pm-stepper-val" style={{ fontSize: 14 }}>{createForm[row.key] ?? 0}</span>
                      <button type="button" className="pm-stepper-btn" style={{ width: 30, height: 30 }} onClick={() => setCreateForm(f => ({ ...f, [row.key]: Math.min(row.max, (f[row.key] ?? 0) + 1) }))}>+</button>
                    </div>
                  </div>
                ))}
              </div>

              {[
                { key: 'promotion_spots', label: 'Oprykning', desc: 'Antal hold der rykker op', color: 'var(--pm-green, #16A34A)', bg: 'var(--pm-green-bg, #F0FDF4)', border: '#BFE5CF' },
                { key: 'relegation_spots', label: 'Nedrykning', desc: 'Antal hold der rykker ned', color: 'var(--pm-red, #DC2626)', bg: 'var(--pm-red-bg, #FEF2F2)', border: '#F2C7C9' },
              ].map(row => (
                <div key={row.key} style={{ margin: `0 18px 9px`, padding: '10px 14px', borderRadius: 14, border: `1px solid ${row.border}`, background: row.bg, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: row.color }}>{row.label}</div>
                    <div style={{ fontSize: 11, color: theme.textLight, marginTop: 1 }}>{row.desc}</div>
                  </div>
                  <select
                    value={createForm[row.key] ?? 2}
                    onChange={e => setCreateForm(f => ({ ...f, [row.key]: parseInt(e.target.value, 10) }))}
                    style={{ ...ligaInputStyle, width: 72, padding: '7px 10px' }}
                  >
                    {[0,1,2,3,4,5,6].map(n => <option key={n} value={n}>{n} hold</option>)}
                  </select>
                </div>
              ))}

              <div className="pm-field">
                <label>Særlige regler eller noter <span style={{ fontWeight: 400, color: theme.textLight }}>(valgfri)</span></label>
                <textarea
                  value={createForm.rules_notes}
                  onChange={e => setCreateForm(f => ({ ...f, rules_notes: e.target.value }))}
                  placeholder="Eks: 'Golden point ved 40-40' eller 'Match-tiebreak i 3. sæt'..."
                  rows={3}
                  style={{ ...ligaInputStyle, resize: 'vertical' }}
                />
              </div>
              <div className="pm-format-card">
                <b>Officielle regler som udgangspunkt</b>
                <p>Din liga følger de officielle Dansk Padel Forbund-regler, medmindre du tilføjer egne.</p>
              </div>
            </>
          )}

          {/* Step 3: Bekræft */}
          {createStep === 3 && (
            <>
              {/* Grundlæggende info */}
              <div style={{ margin: '0 18px 12px', border: '1px solid var(--pm-border)', borderRadius: 14, background: 'var(--pm-surface)', padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8, marginBottom: 8, borderBottom: '1px solid var(--pm-border)' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: theme.text }}>Grundlæggende info</span>
                  <button type="button" onClick={() => { setCreateStep(1); setCreateStepErr(''); }} style={{ fontSize: 12, fontWeight: 600, color: 'var(--pm-navy)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Redigér</button>
                </div>
                <SummaryRow label="Navn" value={createForm.name || '—'} />
                <SummaryRow label="Region" value={createForm.region || '—'} />
                <SummaryRow label="Antal divisioner" value={createForm.num_divisions || 1} />
                <SummaryRow label="Tilmeldingsfrist" value={createForm.registration_deadline || '—'} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, paddingTop: 6 }}>
                  <span style={{ fontSize: 12, color: theme.textLight }}>Sæsonstart</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>{createForm.start_date || '—'}</span>
                </div>
              </div>
              {/* Regler & kampsystem */}
              <div style={{ margin: '0 18px 14px', border: '1px solid var(--pm-border)', borderRadius: 14, background: 'var(--pm-surface)', padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8, marginBottom: 8, borderBottom: '1px solid var(--pm-border)' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: theme.text }}>Regler &amp; kampsystem</span>
                  <button type="button" onClick={() => { setCreateStep(2); setCreateStepErr(''); }} style={{ fontSize: 12, fontWeight: 600, color: 'var(--pm-navy)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Redigér</button>
                </div>
                <SummaryRow label="Kampsystem" value={{ round_robin: 'Alle-mod-alle', swiss: 'Swiss-system', knockout: 'Eliminering' }[createForm.match_system] || createForm.match_system} />
                <SummaryRow label="Point" value={`${createForm.points_win} sejr · ${createForm.points_draw} uafgjort · ${createForm.points_loss} nederlag`} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, paddingTop: 6 }}>
                  <span style={{ fontSize: 12, color: theme.textLight }}>Op-/nedrykning</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>{createForm.promotion_spots} op · {createForm.relegation_spots} ned</span>
                </div>
              </div>
              <div style={{ margin: '0 18px 14px', background: 'var(--pm-surface-muted)', border: '1.5px solid var(--pm-navy)', borderLeft: '3px solid var(--pm-navy)', borderRadius: 10, padding: '11px 14px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <svg style={{ width: 15, height: 15, color: 'var(--pm-navy)', flexShrink: 0, marginTop: 1 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 11 18-5v12L3 13v-2Z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>
                <span style={{ fontSize: 11.5, color: theme.textLight, lineHeight: 1.6 }}>Når du trykker <b style={{ color: theme.text }}>"Opret liga"</b>, bliver ligaen synlig i oversigten, og hold kan tilmelde sig med det samme.</span>
              </div>
            </>
          )}

          {createStepErr && (
            <div style={{ margin: '0 18px 10px', color: theme.red, fontSize: 12 }}>{createStepErr}</div>
          )}

          {/* Navigation */}
          <div style={{ display: 'flex', gap: 10, padding: '0 18px' }}>
            {createStep > 1 ? (
              <button type="button" onClick={() => { setCreateStep(s => s - 1); setCreateStepErr(''); }} style={{ ...btn(false, { size: 'md', fontWeight: 600 }), flex: 1 }}>
                ← Tilbage
              </button>
            ) : (
              <button type="button" onClick={() => { setCreateOpen(false); setCreateStep(1); setCreateStepErr(''); }} style={{ ...btn(false, { size: 'md', fontWeight: 600 }), flex: 1 }}>
                Annullér
              </button>
            )}
            {createStep < 3 ? (
              <button
                type="button"
                onClick={() => {
                  if (createStep === 1 && !createForm.name.trim()) { setCreateStepErr('Angiv et navn til ligaen.'); return; }
                  if (createStep === 1 && !createForm.start_date) { setCreateStepErr('Angiv en sæsonstart-dato.'); return; }
                  setCreateStepErr('');
                  setCreateStep(s => s + 1);
                }}
                style={{ ...btn(true, { size: 'md', fontWeight: 600 }), flex: 2 }}
              >
                {createStep === 1 ? 'Næste: Divisionsindstillinger →' : 'Næste: Bekræft liga →'}
              </button>
            ) : (
              <button
                type="button"
                onClick={createLeague}
                disabled={busyId === 'create'}
                style={{ ...btn(true, { size: 'md', fontWeight: 600 }), flex: 2 }}
              >
                {busyId === 'create' ? 'Opretter…' : 'Opret liga'}
              </button>
            )}
          </div>
        </div>
        );
      })() : (
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
              {myActiveLeagueHero.division ? `Division ${myActiveLeagueHero.division}` : (myActiveLeagueHero.league.season_type === 'weekly' ? 'Ugentlig liga' : 'Månedlig liga')}
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
            const standings = computeStandings(teams, matches, { pointsWin: league.points_win, pointsDraw: league.points_draw, pointsLoss: league.points_loss });
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

          {/* "Start en ny liga" CTA card */}
          {!isAdmin && view === 'registration' && (
            <button
              type="button"
              onClick={async () => {
                const { data } = await supabase.from('profiles').select('id').eq('role', 'admin').ilike('full_name', '%Mike Pedersen%').maybeSingle();
                if (data?.id) navigate('/dashboard/beskeder?med=' + data.id);
                else showToast('Ingen admin fundet.');
              }}
              style={{ width: '100%', textAlign: 'center', background: theme.surface, border: `1.5px dashed ${theme.border}`, borderRadius: 14, padding: '22px 20px', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: theme.accentBg, color: theme.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <Plus size={20} strokeWidth={2.4} />
              </div>
              <b style={{ fontSize: 14, color: theme.text, display: 'block', marginBottom: 6 }}>Start en ny liga</b>
              <p style={{ fontSize: 12, color: theme.textMid, margin: 0, lineHeight: 1.5 }}>Kan du ikke finde en, der passer? Kontakt en admin for at oprette din egen private eller offentlige liga.</p>
            </button>
          )}
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
        const standings = computeStandings(teams, matches, { pointsWin: selectedLeague.points_win, pointsDraw: selectedLeague.points_draw, pointsLoss: selectedLeague.points_loss });
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

      {/* Liga oprettet kvittering */}
      {createdLeagueReceipt && (() => {
        const r = createdLeagueReceipt;
        const ligaUrl = typeof window !== 'undefined'
          ? `${window.location.origin}/dashboard/kampe`
          : '';
        const handleCopy = () => {
          if (!ligaUrl) return;
          navigator.clipboard?.writeText(ligaUrl).then(() => {
            setLigaReceiptUrlCopied(true);
            setTimeout(() => setLigaReceiptUrlCopied(false), 2000);
          }).catch(() => showToast('Kopiering mislykkedes'));
        };
        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 1200, background: theme.bg, display: 'flex', flexDirection: 'column', fontFamily: font }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid ' + theme.border, background: theme.surface, flexShrink: 0 }}>
              <h2 style={{ flex: 1, fontSize: 17, fontWeight: 800, letterSpacing: '-0.02em', margin: 0, textAlign: 'center' }}>PadelMakker</h2>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 80 }}>
              {/* Checkmark */}
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 24 }}>
                <div style={{ width: 72, height: 72, borderRadius: '50%', background: theme.navy, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Check size={32} strokeWidth={2.8} />
                </div>
              </div>

              {/* Title */}
              <div style={{ textAlign: 'center', padding: '16px 32px 0' }}>
                <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-0.3px', color: theme.text }}>Liga oprettet!</div>
                <p style={{ fontSize: 12.5, color: theme.textMid, marginTop: 6, marginBottom: 0 }}>Ligaen er synlig i oversigten, og hold kan tilmelde sig nu.</p>
              </div>

              {/* Summary card */}
              <div style={{ margin: '16px 18px 0', background: theme.surface, borderRadius: 14, border: '1px solid ' + theme.border, padding: '14px 16px' }}>
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ background: theme.navy, color: '#fff', borderRadius: 6, padding: '3px 9px', fontSize: 11.5, fontWeight: 700, letterSpacing: '0.04em' }}>LIGA</span>
                  {Number(r.num_divisions) > 1 ? (
                    <span style={{ background: theme.navyBg || '#EEF2FB', color: theme.navy, borderRadius: 6, padding: '3px 9px', fontSize: 11.5, fontWeight: 600 }}>{r.num_divisions} divisioner</span>
                  ) : null}
                  <span style={{ background: theme.greenBg, color: theme.green, borderRadius: 6, padding: '3px 9px', fontSize: 11.5, fontWeight: 600 }}>Tilmelding åben</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: theme.text, marginTop: 10 }}>{r.name}</div>
                {(() => {
                  const sys = { round_robin: 'Alle mod alle', swiss: 'Swiss', knockout: 'Knockout' }[r.match_system];
                  const rows = [];
                  if (sys) rows.push(['Kampsystem', `${sys} · ${r.points_win ?? 3} sejr · ${r.points_draw ?? 1} uafgjort · ${r.points_loss ?? 0} nederlag`]);
                  if (r.start_date || r.end_date) rows.push(['Sæson', `${r.start_date || '?'}${r.end_date ? ` – ${r.end_date}` : ''}`]);
                  if (r.registration_deadline) rows.push(['Tilmeldingsfrist', r.registration_deadline]);
                  if (r.region) rows.push(['Region', r.region]);
                  if (r.max_teams) rows.push(['Maks. hold', String(r.max_teams)]);
                  return rows.map(([label, value]) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12, marginTop: 6 }}>
                      <span style={{ color: theme.textLight, flexShrink: 0 }}>{label}</span>
                      <span style={{ color: theme.text, fontWeight: 600, textAlign: 'right' }}>{value}</span>
                    </div>
                  ));
                })()}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 13, paddingTop: 12, borderTop: '1px solid ' + theme.border }}>
                  <span style={{ fontSize: 12, color: theme.textMid }}>Hold tilmeldt</span>
                  <span style={{ fontSize: 11.5, color: theme.textMid, fontWeight: 600 }}>0 hold</span>
                </div>
              </div>

              {/* Share section */}
              <div style={{ fontSize: 11, fontWeight: 700, color: theme.textMid, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '16px 18px 8px' }}>
                Del liga
              </div>
              <div style={{ margin: '0 18px 12px', background: theme.surface, borderRadius: 10, border: '1px solid ' + theme.border, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px' }}>
                <span style={{ flex: 1, fontSize: 12, color: theme.textMid, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {ligaUrl || 'padelmakker.dk/liga/…'}
                </span>
                <button
                  type="button"
                  onClick={handleCopy}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, padding: '5px 10px', borderRadius: 7, border: '1px solid ' + theme.border, background: theme.surfaceAlt, color: ligaReceiptUrlCopied ? theme.green : theme.textMid, cursor: 'pointer', flexShrink: 0, fontFamily: font }}
                >
                  <Copy size={12} />
                  {ligaReceiptUrlCopied ? 'Kopieret!' : 'Kopiér'}
                </button>
              </div>

              {/* Action buttons */}
              <div style={{ padding: '0 18px' }}>
                <button
                  type="button"
                  onClick={() => {
                    if (typeof navigator !== 'undefined' && navigator.share) {
                      void navigator.share({ title: r.name, url: ligaUrl }).catch(() => {});
                    } else {
                      handleCopy();
                    }
                  }}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '11px 16px', borderRadius: 10, border: '1px solid ' + theme.border, background: theme.surface, color: theme.text, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: font }}
                >
                  Invitér hold til ligaen
                </button>
              </div>
            </div>

            {/* CTA bar */}
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '12px 18px', background: theme.surface, borderTop: '1px solid ' + theme.border }}>
              <button
                type="button"
                onClick={() => setCreatedLeagueReceipt(null)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '13px 16px', borderRadius: 12, border: 'none', background: theme.navy, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: font }}
              >
                Gå til liga-oversigt
                <ArrowRight size={16} strokeWidth={2.4} />
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
