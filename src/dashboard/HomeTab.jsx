import { useMemo, useState, useEffect, useCallback } from 'react';
import { DateTime } from 'luxon';
import { useAuth } from '../lib/AuthContext';
import { font, theme, heading, btn } from '../lib/platformTheme';
import { resolveDisplayName } from '../lib/platformUtils';
import { statsFromEloHistoryRows, useProfileEloBundle } from '../lib/eloHistoryUtils';
import { supabase } from '../lib/supabase';
import { Users, MapPin, Swords, Trophy, X } from 'lucide-react';
import { AvatarCircle } from '../components/AvatarCircle';
import { PlayerStatsModal } from '../components/PlayerStatsModal';
import { levelLabel } from '../lib/platformConstants';
import { mergeKampeSessionPrefs } from '../lib/kampeSessionPrefs';

export function HomeTab({ user, setTab }) {
  const { user: authUser } = useAuth();
  const [viewTournament, setViewTournament] = useState(null);
  const [viewPlayer, setViewPlayer] = useState(null);
  const displayName = resolveDisplayName(user, authUser);
  const firstName   = displayName.split(/\s+/)[0];
  const eloSyncKey = `${user.elo_rating}|${user.games_played}|${user.games_won}`;
  const { bundleLoading, profileFresh, ratedRows } = useProfileEloBundle(user.id, eloSyncKey);
  const histStats = useMemo(() => statsFromEloHistoryRows(ratedRows), [ratedRows]);
  const elo = histStats?.elo ?? Math.round(Number(profileFresh?.elo_rating) || 1000);
  const games = histStats?.games ?? (profileFresh?.games_played || 0);
  const wins = histStats?.wins ?? (profileFresh?.games_won || 0);
  const eloBarPct   = Math.min(Math.max((elo / 2000) * 100, 0), 100);

  const [feed, setFeed] = useState([]);
  const [americanoFeed, setAmericanoFeed] = useState([]);
  const [ligaFeed, setLigaFeed] = useState([]);
  const [openMatchFeed, setOpenMatchFeed] = useState([]);
  const [americanoRegFeed, setAmericanoRegFeed] = useState([]);
  const [milestoneFeed, setMilestoneFeed] = useState([]);
  const [seekingFeed, setSeekingFeed] = useState([]);
  const [leagueNewFeed, setLeagueNewFeed] = useState([]);
  const [viewLeague, setViewLeague] = useState(null);

  const fetchFeed = useCallback(async () => {
    // ELO history feed
    const { data: eloDataFull } = await supabase
      .from('elo_history')
      .select('user_id, result, change, date, created_at, match_id, profiles(full_name, name, avatar)')
      .neq('change', 0)
      .not('change', 'is', null)
      .neq('result', 'adjustment')
      .order('created_at', { ascending: false, nullsFirst: false })
      .limit(40);
    
    // Safety: ignore the +0 entries entirely as they are noise
    const eloData = (eloDataFull || []).filter(r => Number(r.change) !== 0);
    
    // Fetch match details for entries with match_id
    const matchIds = [...new Set(eloData.filter(r => r.match_id).map(r => r.match_id))];
    let matchMap = {};
    if (matchIds.length > 0) {
      const [{ data: mRes }, { data: mDetails }] = await Promise.all([
        supabase.from('match_results').select('*').in('match_id', matchIds),
        supabase.from('matches').select('id, court_name, description').in('id', matchIds)
      ]);
      (mRes || []).forEach(r => { matchMap[r.match_id] = { ...matchMap[r.match_id], results: r }; });
      (mDetails || []).forEach(d => { matchMap[d.id] = { ...matchMap[d.id], details: d }; });
    }

    // Grouping logic
    const groupedFeed = [];
    const processedMatchIds = new Set();

    eloData.forEach(row => {
      if (!row.match_id) {
        groupedFeed.push({ ...row, type: 'elo' });
        return;
      }
      if (processedMatchIds.has(row.match_id)) return;

      const sameMatch = eloData.filter(r => r.match_id === row.match_id);
      const mInfo = matchMap[row.match_id];
      
      groupedFeed.push({
        type: 'match_group',
        match_id: row.match_id,
        created_at: row.created_at,
        players: sameMatch.map(r => ({
          id: r.user_id,
          name: r.profiles?.full_name || r.profiles?.name || "Spiller",
          avatar: r.profiles?.avatar || "🎾",
          change: Number(r.change),
          win: r.result === 'win'
        })),
        score: mInfo?.results?.score_display || "—",
        winner: mInfo?.results?.match_winner,
        court: mInfo?.details?.court_name || "Bane",
        description: mInfo?.details?.description
      });
      processedMatchIds.add(row.match_id);
    });

    setFeed(groupedFeed);

    // Americano completed tournaments
    try {
      const { data: tournaments } = await supabase
        .from('americano_tournaments')
        .select('id, name, tournament_date, updated_at')
        .eq('status', 'completed')
        .order('updated_at', { ascending: false })
        .limit(5);
      if (tournaments?.length) {
        const tIds = tournaments.map(t => t.id);
        const [{ data: parts }, { data: matches }] = await Promise.all([
          supabase.from('americano_participants').select('id, tournament_id, user_id, display_name').in('tournament_id', tIds),
          supabase.from('americano_matches').select('tournament_id, team_a_p1, team_a_p2, team_b_p1, team_b_p2, team_a_score, team_b_score').in('tournament_id', tIds),
        ]);
        const userIds = [...new Set((parts || []).map(p => p.user_id))];
        let avatarMap = {};
        if (userIds.length > 0) {
          const { data: profiles } = await supabase.from('profiles').select('id, avatar').in('id', userIds);
          (profiles || []).forEach(p => { avatarMap[String(p.id)] = p.avatar; });
        }
        const items = tournaments.map(t => {
          const tParts = (parts || []).filter(p => p.tournament_id === t.id);
          const tMatches = (matches || []).filter(m => m.tournament_id === t.id);
          const totals = {};
          tParts.forEach(p => { totals[p.id] = 0; });
          tMatches.forEach(m => {
            if (m.team_a_score == null || m.team_b_score == null) return;
            const add = (pid, pts) => { totals[pid] = (totals[pid] || 0) + pts; };
            add(m.team_a_p1, m.team_a_score); add(m.team_a_p2, m.team_a_score);
            add(m.team_b_p1, m.team_b_score); add(m.team_b_p2, m.team_b_score);
          });
          let bestPart = null, bestPts = -1;
          tParts.forEach(p => { const pts = totals[p.id] || 0; if (pts > bestPts) { bestPts = pts; bestPart = p; } });
          if (!bestPart) return null;
          const leaderboard = tParts.map(p => ({ name: p.display_name, points: totals[p.id] || 0, userId: p.user_id, avatar: avatarMap[String(p.user_id)] || '🎾' })).sort((a, b) => b.points - a.points);
          return { type: 'americano_winner', userId: bestPart.user_id, name: bestPart.display_name, points: bestPts, tournamentName: t.name, tournamentId: t.id, leaderboard, avatar: avatarMap[String(bestPart.user_id)] || '🏆', created_at: t.updated_at || t.tournament_date };
        }).filter(Boolean);
        setAmericanoFeed(items);
      } else {
        setAmericanoFeed([]);
      }
    } catch (e) {
      console.warn('Americano feed error:', e);
      setAmericanoFeed([]);
    }

    // Completed leagues feed
    try {
      const { data: completedLeagues } = await supabase
        .from('leagues')
        .select('id, name, updated_at')
        .eq('status', 'completed')
        .order('updated_at', { ascending: false })
        .limit(5);
      if (!completedLeagues?.length) { setLigaFeed([]); return; }
      const lIds = completedLeagues.map(l => l.id);
      const [{ data: teamsData }, { data: matchData }] = await Promise.all([
        supabase.from('league_teams').select('id, league_id, name, player1_id, player1_name, player1_avatar, player2_id, player2_name, player2_avatar').eq('status', 'ready').in('league_id', lIds),
        supabase.from('league_matches').select('league_id, team1_id, team2_id, winner_id, score_text').eq('status', 'reported').in('league_id', lIds),
      ]);
      const items = completedLeagues.map(l => {
        const lTeams = (teamsData || []).filter(t => t.league_id === l.id);
        const lMs = (matchData || []).filter(m => m.league_id === l.id);
        const map = {};
        for (const t of lTeams) map[t.id] = { ...t, points: 0, wins: 0, losses: 0 };
        for (const m of lMs) {
          if (!m.winner_id) continue;
          const winner = map[m.winner_id];
          const loserId = m.winner_id === m.team1_id ? m.team2_id : m.team1_id;
          const loser = loserId ? map[loserId] : null;
          const tb = m.score_text && /7-6|6-7/.test(m.score_text);
          if (winner) { winner.wins++; winner.points += 3; }
          if (loser) { loser.losses++; if (tb) loser.points += 1; }
        }
        const standings = Object.values(map).sort((a, b) => b.points - a.points);
        if (!standings.length) return null;
        return { type: 'liga_completed', leagueId: l.id, leagueName: l.name, champion: standings[0], standings, created_at: l.updated_at };
      }).filter(Boolean);
      setLigaFeed(items);
    } catch (e) {
      console.warn('Liga feed error:', e);
      setLigaFeed([]);
    }

    // New feed types — run in parallel, each isolated so one failure doesn't break the rest
    const [openMatchRes, americanoRegRes, milestoneRes, seekingRes, leagueNewRes] = await Promise.allSettled([
      supabase.from('matches').select('id, creator_id, date, court_name, created_at').eq('status', 'open').gte('date', new Date().toISOString().split('T')[0]).order('created_at', { ascending: false }).limit(5),
      supabase.from('americano_tournaments').select('id, name, tournament_date, time_slot, player_slots, created_at').eq('status', 'registration').order('created_at', { ascending: false }).limit(5),
      supabase.from('elo_history').select('user_id, old_rating, new_rating, created_at, profiles(full_name, name, avatar)').not('old_rating', 'is', null).not('new_rating', 'is', null).order('created_at', { ascending: false, nullsFirst: false }).limit(150),
      supabase.from('profiles').select('id, full_name, name, avatar, level, area, intent_now, last_active_at').eq('seeking_match', true).order('last_active_at', { ascending: false, nullsFirst: false }).limit(5),
      supabase.from('leagues').select('id, name, status, created_at').in('status', ['registration', 'active']).order('created_at', { ascending: false }).limit(5),
    ]);
    try {
      const openMatchesData = openMatchRes.status === 'fulfilled' ? openMatchRes.value.data : null;
      const americanoRegData = americanoRegRes.status === 'fulfilled' ? americanoRegRes.value.data : null;
      const milestoneData = milestoneRes.status === 'fulfilled' ? milestoneRes.value.data : null;
      const seekingData = seekingRes.status === 'fulfilled' ? seekingRes.value.data : null;
      const newLeaguesData = leagueNewRes.status === 'fulfilled' ? leagueNewRes.value.data : null;

      // Open matches
      if (openMatchesData?.length) {
        const creatorIds = [...new Set(openMatchesData.map(m => m.creator_id))];
        const { data: creatorProfiles } = await supabase.from('profiles').select('id, full_name, name, avatar').in('id', creatorIds);
        const pMap = {};
        (creatorProfiles || []).forEach(p => { pMap[p.id] = p; });
        setOpenMatchFeed(openMatchesData.map(m => {
          const p = pMap[m.creator_id] || {};
          return { type: 'open_match', matchId: m.id, creatorName: p.full_name || p.name || 'En spiller', creatorAvatar: p.avatar || '🎾', creatorId: m.creator_id, date: m.date, court: m.court_name || 'Ukendt bane', created_at: m.created_at };
        }));
      }

      // Americano under tilmelding
      if (americanoRegData?.length) {
        const regIds = americanoRegData.map(t => t.id);
        const { data: regParts } = await supabase.from('americano_participants').select('tournament_id').in('tournament_id', regIds);
        const counts = {};
        (regParts || []).forEach(p => { counts[p.tournament_id] = (counts[p.tournament_id] || 0) + 1; });
        setAmericanoRegFeed(americanoRegData.map(t => ({ type: 'americano_registration', tournamentId: t.id, name: t.name, date: t.tournament_date, time: t.time_slot, slots: t.player_slots, participants: counts[t.id] || 0, created_at: t.created_at })));
      }

      // ELO-milepæle
      if (milestoneData?.length) {
        const MILESTONES = [1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900, 2000];
        const items = [];
        const seen = new Set();
        for (const r of milestoneData) {
          const oldR = Number(r.old_rating || 0);
          const newR = Number(r.new_rating || 0);
          const milestone = MILESTONES.find(m => oldR < m && newR >= m);
          if (!milestone) continue;
          const key = `${r.user_id}-${milestone}`;
          if (seen.has(key)) continue;
          seen.add(key);
          items.push({ type: 'elo_milestone', userId: r.user_id, name: r.profiles?.full_name || r.profiles?.name || 'En spiller', avatar: r.profiles?.avatar || '🎾', milestone, created_at: r.created_at });
          if (items.length >= 3) break;
        }
        setMilestoneFeed(items);
      }

      // Spillere der søger makker
      if (seekingData?.length) {
        setSeekingFeed(
          seekingData
            .filter(p => String(p.id) !== String(user.id))
            .slice(0, 3)
            .map(p => ({ type: 'seeking_player', userId: p.id, name: p.full_name || p.name || 'En spiller', avatar: p.avatar || '🎾', level: p.level, area: p.area, intent: p.intent_now, created_at: p.last_active_at }))
        );
      }

      // Nye ligaer
      if (newLeaguesData?.length) {
        const leagueIds = newLeaguesData.map(l => l.id);
        const { data: teams } = await supabase.from('league_teams').select('league_id').in('league_id', leagueIds).eq('status', 'ready');
        const teamCounts = {};
        (teams || []).forEach(t => { teamCounts[t.league_id] = (teamCounts[t.league_id] || 0) + 1; });
        setLeagueNewFeed(newLeaguesData.map(l => ({ type: 'league_new', leagueId: l.id, leagueName: l.name, status: l.status, teamCount: teamCounts[l.id] || 0, created_at: l.created_at })));
      }
    } catch (e) {
      console.warn('Extended feed error:', e);
    }
  }, [user.id]);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  /* Genindlæs feed når appen kommer i forgrunden igen */
  useEffect(() => {
    let lastFetch = 0;
    const onVis = () => {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (now - lastFetch < 30000) return; // maks. ét kald pr. 30 sek.
      lastFetch = now;
      fetchFeed();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [fetchFeed]);

  const formatTimeAgo = (iso) => {
    if (!iso) return "";
    const dt = DateTime.fromISO(iso).setLocale("da");
    if (!dt.isValid) return "";
    
    // Hvis det er over en uge siden, vis bare datoen
    if (Math.abs(dt.diffNow('days').days) > 7) {
      return dt.toFormat('d. MMM');
    }
    
    const rel = dt.toRelative();
    // Gør første bogstav stort hvis nødvendigt
    return rel ? rel.charAt(0).toUpperCase() + rel.slice(1) : "";
  };

  const actions = [
    { icon: <Users   size={20} color={theme.accent} />, title: "Find en makker", desc: "Se ledige spillere",  tab: "makkere" },
    { icon: <MapPin  size={20} color={theme.accent} />, title: "Book en bane",   desc: "Ledige tider",       tab: "baner"   },
    { icon: <Swords  size={20} color={theme.accent} />, title: "Åbne kampe",     desc: "Tilmeld dig nu",     tab: "kampe"   },
    { icon: <Trophy  size={20} color={theme.accent} />, title: "Se ranking",     desc: "Din placering",      tab: "ranking" },
  ];

  return (
    <div>
      <h2 style={{ ...heading("clamp(22px,5vw,26px)"), marginBottom: "4px" }}>Hej {firstName}! 👋</h2>
      <p style={{ color: theme.textMid, fontSize: "14px", marginBottom: "24px" }}>Klar til at spille?</p>

      {/* Stat cards + ELO: vent på frisk DB (undgå flash af forældede tal fra React) */}
      {bundleLoading ? (
        <div style={{ textAlign: "center", padding: "32px 16px", color: theme.textLight, fontSize: "14px", marginBottom: "24px" }}>Indlæser dine tal…</div>
      ) : (
        <>
      <div className="pm-stat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,110px),1fr))", gap: "10px", marginBottom: "24px" }}>
        {[
          { label: "Kampe", value: games, color: theme.blue },
          { label: "Sejre", value: wins,  color: theme.warm },
          { label: "Win %", value: games > 0 ? Math.round((wins / games) * 100) + "%" : "—", color: theme.accent },
        ].map((s, i) => (
          <div key={i} style={{ background: theme.surface, borderRadius: theme.radius, padding: "18px 16px", boxShadow: theme.shadow, border: "1px solid " + theme.border, textAlign: "center" }}>
            <div style={{ fontSize: "26px", fontWeight: 800, color: s.color, fontFamily: font, letterSpacing: "-0.03em" }}>{s.value}</div>
            <div style={{ fontSize: "10px", color: theme.textLight, marginTop: "4px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ background: "linear-gradient(135deg, #1E3A5F, #1D4ED8)", borderRadius: theme.radius, padding: "clamp(18px,4vw,24px)", marginBottom: "24px", color: "#fff", boxShadow: theme.shadow }}>
        <div style={{ fontSize: "10px", opacity: 0.65, marginBottom: "8px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Din ELO-rating</div>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
          <span style={{ fontFamily: font, fontSize: "clamp(40px,10vw,52px)", fontWeight: 800, lineHeight: 1, letterSpacing: "-0.04em" }}>{elo}</span>
          <span style={{ fontSize: "13px", opacity: 0.65, maxWidth: "200px", lineHeight: 1.5 }}>Jo højere ELO, jo stærkere matcher du ift. andre spillere.</span>
        </div>
        <div style={{ marginTop: "18px", background: "rgba(255,255,255,0.15)", borderRadius: "6px", height: "6px", overflow: "hidden" }}>
          <div style={{ width: eloBarPct + "%", height: "100%", background: theme.warm, borderRadius: "6px", transition: "width 0.4s ease" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "6px", fontSize: "10px", opacity: 0.55, letterSpacing: "0.04em" }}>
          <span>0</span><span>Skala op til 2000+</span>
        </div>
      </div>
        </>
      )}

      {/* Aktivitetsfeed */}
      {(feed.length > 0 || americanoFeed.length > 0 || ligaFeed.length > 0 || openMatchFeed.length > 0 || americanoRegFeed.length > 0 || milestoneFeed.length > 0 || seekingFeed.length > 0 || leagueNewFeed.length > 0) && (
        <div style={{ marginBottom: "24px" }}>
          <div style={{ fontSize: "12px", fontWeight: 700, color: theme.textLight, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "10px" }}>
            Seneste aktivitet
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {/* Merge and sort all feeds by date */}
            {[...feed, ...americanoFeed, ...ligaFeed, ...openMatchFeed, ...americanoRegFeed, ...milestoneFeed, ...seekingFeed, ...leagueNewFeed]
              .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
              .slice(0, 15)
              .map((row, i) => {
                if (row.type === 'americano_winner') {
                  return (
                    <div
                      key={`am-${i}`}
                      style={{
                        display: "flex", alignItems: "center", gap: "10px",
                        background: "linear-gradient(135deg, #FFFBEB, #FEF3C7)",
                        borderRadius: "8px", padding: "8px 12px",
                        border: "1.5px solid #F59E0B",
                        position: "relative"
                      }}
                    >
                      <div 
                        onClick={() => setViewPlayer({ id: row.userId, name: row.name })}
                        style={{ cursor: "pointer" }}
                      >
                        <AvatarCircle
                          avatar={row.avatar}
                          size={38}
                          emojiSize="24px"
                          style={{ background: "#FEF3C7", border: "1.5px solid #F59E0B" }}
                        />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "13px", color: theme.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          <span 
                            onClick={() => setViewPlayer({ id: row.userId, name: row.name })}
                            style={{ cursor: "pointer", fontWeight: 700 }}
                          >
                            {row.name}
                          </span> vandt Americano
                        </div>
                        {row.tournamentName && (
                          <div style={{ fontSize: "11px", color: "#92400E", marginTop: "1px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            &ldquo;{row.tournamentName}&rdquo; · {formatTimeAgo(row.created_at)}
                          </div>
                        )}
                      </div>
                      <button 
                        onClick={() => setViewTournament(row)}
                        style={{ ...btn(false), padding: "4px 8px", fontSize: "10px", height: "auto", background: "white", borderColor: "#F59E0B", color: "#92400E" }}
                      >
                        Se resultat
                      </button>
                    </div>
                  );
                }

                if (row.type === 'liga_completed') {
                  const c = row.champion;
                  return (
                    <div key={`liga-${i}`} style={{ display: "flex", alignItems: "center", gap: "10px", background: "linear-gradient(135deg, #EFF6FF, #DBEAFE)", borderRadius: "8px", padding: "8px 12px", border: "1.5px solid #3B82F6" }}>
                      {/* Overlapping avatars for winning team */}
                      <div style={{ display: "flex", position: "relative", width: "46px", height: "34px", flexShrink: 0 }}>
                        <AvatarCircle avatar={c.player1_avatar} size={30} emojiSize="15px" style={{ background: "#DBEAFE", border: "2px solid #fff", position: "absolute", left: 0, top: 2, zIndex: 2 }} />
                        <AvatarCircle avatar={c.player2_avatar} size={30} emojiSize="15px" style={{ background: "#DBEAFE", border: "2px solid #fff", position: "absolute", left: 16, top: 2, zIndex: 1 }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "13px", color: theme.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          <span style={{ fontWeight: 700 }}>{c.name}</span> vandt ligaen 🏆
                        </div>
                        <div style={{ fontSize: "11px", color: "#1E40AF", marginTop: "1px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          &ldquo;{row.leagueName}&rdquo; · {formatTimeAgo(row.created_at)}
                        </div>
                      </div>
                      <button onClick={() => setViewLeague(row)} style={{ ...btn(false), padding: "4px 8px", fontSize: "10px", height: "auto", background: "white", borderColor: "#3B82F6", color: "#1E40AF", flexShrink: 0 }}>
                        Se resultat
                      </button>
                    </div>
                  );
                }

                if (row.type === 'open_match') {
                  const dateStr = row.date ? DateTime.fromISO(row.date).setLocale('da').toFormat('EEE d. MMM') : '';
                  return (
                    <div key={`open-${i}`} style={{ display: "flex", alignItems: "center", gap: "10px", background: "linear-gradient(135deg, #ECFDF5, #D1FAE5)", borderRadius: "8px", padding: "8px 12px", border: "1.5px solid #10B981" }}>
                      <div onClick={() => setViewPlayer({ id: row.creatorId, name: row.creatorName })} style={{ cursor: "pointer" }}>
                        <AvatarCircle avatar={row.creatorAvatar} size={38} emojiSize="24px" style={{ background: "#D1FAE5", border: "1.5px solid #10B981" }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "13px", color: theme.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          <span style={{ fontWeight: 700, cursor: "pointer" }} onClick={() => setViewPlayer({ id: row.creatorId, name: row.creatorName })}>{row.creatorName}</span> søger spillere til <strong>2v2</strong>
                        </div>
                        <div style={{ fontSize: "11px", color: "#065F46", marginTop: "1px" }}>{dateStr} · {row.court}</div>
                      </div>
                      <button onClick={() => { mergeKampeSessionPrefs(user.id, { format: 'padel', view: 'open' }); setTab('kampe'); }} style={{ ...btn(false), padding: "4px 8px", fontSize: "10px", height: "auto", background: "white", borderColor: "#10B981", color: "#065F46", flexShrink: 0 }}>Se kamp</button>
                    </div>
                  );
                }

                if (row.type === 'americano_registration') {
                  const dateStr = row.date ? DateTime.fromISO(row.date).setLocale('da').toFormat('EEE d. MMM') : '';
                  return (
                    <div key={`amreg-${i}`} style={{ display: "flex", alignItems: "center", gap: "10px", background: "linear-gradient(135deg, #FFFBEB, #FEF9C3)", borderRadius: "8px", padding: "8px 12px", border: "1.5px solid #EAB308" }}>
                      <div style={{ width: 38, height: 38, borderRadius: "50%", background: "#FEF3C7", border: "1.5px solid #EAB308", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", flexShrink: 0 }}>🏓</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "13px", fontWeight: 700, color: theme.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.name}</div>
                        <div style={{ fontSize: "11px", color: "#92400E", marginTop: "1px" }}>
                          Americano · {dateStr}{row.time ? ` · ${row.time}` : ''} · {row.participants}/{row.slots} tilmeldt
                        </div>
                      </div>
                      <button onClick={() => { mergeKampeSessionPrefs(user.id, { format: 'americano' }); setTab('kampe'); }} style={{ ...btn(false), padding: "4px 8px", fontSize: "10px", height: "auto", background: "white", borderColor: "#EAB308", color: "#92400E", flexShrink: 0 }}>Tilmeld</button>
                    </div>
                  );
                }

                if (row.type === 'elo_milestone') {
                  return (
                    <div key={`milestone-${i}`} style={{ display: "flex", alignItems: "center", gap: "10px", background: "linear-gradient(135deg, #F5F3FF, #EDE9FE)", borderRadius: "8px", padding: "8px 12px", border: "1.5px solid #7C3AED" }}>
                      <div onClick={() => setViewPlayer({ id: row.userId, name: row.name })} style={{ cursor: "pointer" }}>
                        <AvatarCircle avatar={row.avatar} size={38} emojiSize="24px" style={{ background: "#EDE9FE", border: "1.5px solid #7C3AED" }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "13px", color: theme.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          <span style={{ fontWeight: 700, cursor: "pointer" }} onClick={() => setViewPlayer({ id: row.userId, name: row.name })}>{row.name}</span> nåede {row.milestone} ELO 🎯
                        </div>
                        <div style={{ fontSize: "11px", color: "#5B21B6", marginTop: "1px" }}>{formatTimeAgo(row.created_at)}</div>
                      </div>
                    </div>
                  );
                }

                if (row.type === 'seeking_player') {
                  const levelStr = row.level ? levelLabel(row.level) : null;
                  const sub = [row.area, levelStr].filter(Boolean).join(' · ');
                  return (
                    <div key={`seek-${i}`} style={{ display: "flex", alignItems: "center", gap: "10px", background: "linear-gradient(135deg, #F0F9FF, #E0F2FE)", borderRadius: "8px", padding: "8px 12px", border: "1.5px solid #0EA5E9" }}>
                      <div onClick={() => setViewPlayer({ id: row.userId, name: row.name })} style={{ cursor: "pointer" }}>
                        <AvatarCircle avatar={row.avatar} size={38} emojiSize="24px" style={{ background: "#E0F2FE", border: "1.5px solid #0EA5E9" }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "13px", color: theme.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          <span style={{ fontWeight: 700, cursor: "pointer" }} onClick={() => setViewPlayer({ id: row.userId, name: row.name })}>{row.name}</span> søger makker
                        </div>
                        {sub && <div style={{ fontSize: "11px", color: "#0369A1", marginTop: "1px" }}>{sub}</div>}
                      </div>
                      <button onClick={() => setTab('makkere')} style={{ ...btn(false), padding: "4px 8px", fontSize: "10px", height: "auto", background: "white", borderColor: "#0EA5E9", color: "#0369A1", flexShrink: 0 }}>Se profil</button>
                    </div>
                  );
                }

                if (row.type === 'league_new') {
                  const isReg = row.status === 'registration';
                  return (
                    <div key={`lnew-${i}`} style={{ display: "flex", alignItems: "center", gap: "10px", background: "linear-gradient(135deg, #EFF6FF, #DBEAFE)", borderRadius: "8px", padding: "8px 12px", border: "1.5px solid #3B82F6" }}>
                      <div style={{ width: 38, height: 38, borderRadius: "50%", background: "#DBEAFE", border: "1.5px solid #3B82F6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", flexShrink: 0 }}>🏆</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "13px", fontWeight: 700, color: theme.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.leagueName}</div>
                        <div style={{ fontSize: "11px", color: "#1E40AF", marginTop: "1px" }}>
                          Liga · {isReg ? 'Tilmelding åben' : 'I gang'} · {row.teamCount} hold · {formatTimeAgo(row.created_at)}
                        </div>
                      </div>
                      <button onClick={() => setTab('liga')} style={{ ...btn(false), padding: "4px 8px", fontSize: "10px", height: "auto", background: "white", borderColor: "#3B82F6", color: "#1E40AF", flexShrink: 0 }}>
                        {isReg ? 'Tilmeld' : 'Se liga'}
                      </button>
                    </div>
                  );
                }

                if (row.type === 'match_group') {
                  const winners = row.players.filter(p => p.win);
                  const losers = row.players.filter(p => !p.win);
                  return (
                    <div key={`match-${i}`} style={{ background: theme.surface, borderRadius: "10px", padding: "8px 14px", border: "1px solid " + theme.border, boxShadow: "0 2px 8px rgba(0,0,0,0.03)", position: "relative", overflow: "hidden" }}>
                      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "3px", background: "#10B981" }} />
                      <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: "3px", background: theme.red }} />
                      {/* Venue Header - Centered */}
                      <div style={{ display: "flex", justifyContent: "center", marginBottom: "6px" }}>
                        <div style={{ fontSize: "10px", color: theme.textLight, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", display: "flex", alignItems: "center", gap: "4px", background: "#F8FAFC", padding: "2px 8px", borderRadius: "14px", border: "1px solid #F1F5F9" }}>
                          <MapPin size={9} /> {row.court} · {formatTimeAgo(row.created_at)}
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        {/* Winners (Left) */}
                        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px" }}>
                          {winners.map((p, idx) => (
                            <div key={idx} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <div onClick={() => setViewPlayer(p)} style={{ cursor: "pointer" }}>
                                <AvatarCircle avatar={p.avatar} size={32} emojiSize="18px" />
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <div onClick={() => setViewPlayer(p)} style={{ fontSize: "13px", fontWeight: 700, color: theme.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", cursor: "pointer" }}>{p.name.split(' ')[0]}</div>
                                <div style={{ fontSize: "10px", color: "#10B981", fontWeight: 800 }}>+{p.change} ELO</div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Score (Center) */}
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "0 8px", minWidth: "70px" }}>
                          <div style={{ fontSize: "20px", fontWeight: 900, color: theme.accent, letterSpacing: "0.02em", whiteSpace: "nowrap" }}>{row.score}</div>
                          <div style={{ fontSize: "8px", fontWeight: 800, color: theme.textLight, marginTop: "2px", background: "#F1F5F9", padding: "1px 6px", borderRadius: "8px", letterSpacing: "0.1em" }}>VS</div>
                        </div>

                        {/* Losers (Right) */}
                        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px", alignItems: "flex-end" }}>
                          {losers.map((p, idx) => (
                            <div key={idx} style={{ display: "flex", alignItems: "center", gap: "8px", flexDirection: "row-reverse" }}>
                              <div onClick={() => setViewPlayer(p)} style={{ cursor: "pointer" }}>
                                <AvatarCircle avatar={p.avatar} size={32} emojiSize="18px" />
                              </div>
                              <div style={{ minWidth: 0, textAlign: "right" }}>
                                <div onClick={() => setViewPlayer(p)} style={{ fontSize: "13px", fontWeight: 700, color: theme.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", cursor: "pointer" }}>{p.name.split(' ')[0]}</div>
                                <div style={{ fontSize: "10px", color: theme.red, fontWeight: 800 }}>{p.change} ELO</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {row.description && (
                        <div style={{ marginTop: "8px", paddingTop: "6px", borderTop: "1px dashed #F1F5F9", fontSize: "11px", color: theme.textMid, fontStyle: "italic", textAlign: "center" }}>
                          &ldquo;{row.description}&rdquo;
                        </div>
                      )}
                    </div>
                  );
                }

                // Individual ELO row (fallback)
                const name = row.profiles?.full_name || row.profiles?.name || "En spiller";
                const avatar = row.profiles?.avatar || "🎾";
                const won = row.result === "win";
                const change = Number(row.change) || 0;
                return (
                  <div key={`elo-${i}`} style={{ display: "flex", alignItems: "center", gap: "10px", background: theme.surface, borderRadius: "8px", padding: "9px 12px", border: "1px solid " + theme.border }}>
                    <AvatarCircle
                      avatar={avatar}
                      size={40}
                      emojiSize="26px"
                      style={{ background: "#F1F5F9", border: "1px solid " + theme.border }}
                    />
                    <span style={{ fontSize: "13px", color: theme.text, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      <strong>{name}</strong> {won ? "vandt" : "tabte"}
                    </span>
                    <span style={{ fontSize: "12px", fontWeight: 700, flexShrink: 0, color: change >= 0 ? theme.accent : theme.red }}>
                      {change >= 0 ? "+" : ""}{change} ELO
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="pm-home-grid">
        {actions.map((a, i) => (
          <button key={i} onClick={() => setTab(a.tab)} style={{ background: theme.surface, borderRadius: theme.radius, padding: "clamp(16px,3.5vw,20px)", boxShadow: theme.shadow, border: "1px solid " + theme.border, cursor: "pointer", textAlign: "left", fontFamily: font, display: "flex", flexDirection: "column", transition: "box-shadow 0.15s" }}>
            <div style={{ width: "40px", height: "40px", borderRadius: "8px", background: theme.accentBg, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "12px" }}>
              {a.icon}
            </div>
            <div style={{ fontSize: "clamp(13px,3.5vw,14px)", fontWeight: 700, color: theme.text, letterSpacing: "-0.01em", marginBottom: "3px" }}>{a.title}</div>
            <div style={{ fontSize: "12px", color: theme.textLight }}>{a.desc}</div>
          </button>
        ))}
      </div>

      {/* Modals */}
      {viewTournament && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }} onClick={() => setViewTournament(null)}>
          <div style={{ background: theme.surface, borderRadius: theme.radius, width: "100%", maxWidth: "400px", maxHeight: "85vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.2)" }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: "20px", borderBottom: "1px solid " + theme.border, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: "10px", color: theme.accent, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px" }}>Americano Resultat</div>
                <h3 style={{ fontSize: "18px", fontWeight: 800, color: theme.text, margin: 0 }}>{viewTournament.tournamentName}</h3>
              </div>
              <button onClick={() => setViewTournament(null)} style={{ border: "none", background: "none", cursor: "pointer", color: theme.textLight }}><X size={20} /></button>
            </div>
            
            <div style={{ padding: "20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
              {viewTournament.leaderboard.map((p, idx) => {
                const rank = idx + 1;
                const isWinner = rank === 1;
                const rankIcon = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;
                
                return (
                  <div key={idx} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 14px", background: isWinner ? "#FFFBEB" : theme.surface, borderRadius: "10px", border: "1px solid " + (isWinner ? "#F59E0B" : theme.border) }}>
                    <div style={{ width: "24px", fontSize: "14px", fontWeight: 800, color: isWinner ? "#B45309" : theme.textLight, textAlign: "center" }}>
                      {rankIcon || rank}
                    </div>
                    <AvatarCircle avatar={p.avatar} size={36} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "14px", fontWeight: 700, color: theme.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                    </div>
                    <div style={{ fontSize: "15px", fontWeight: 800, color: isWinner ? "#B45309" : theme.text }}>
                      {p.points} <span style={{ fontSize: "10px", fontWeight: 600, opacity: 0.6 }}>PTS</span>
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div style={{ padding: "16px 20px", borderTop: "1px solid " + theme.border }}>
              <button onClick={() => setViewTournament(null)} style={{ ...btn(true), width: "100%", justifyContent: "center" }}>Luk</button>
            </div>
          </div>
        </div>
      )}

      {viewPlayer && (
        <PlayerStatsModal
          userId={viewPlayer.id}
          fallbackName={viewPlayer.name}
          onClose={() => setViewPlayer(null)}
        />
      )}

      {viewLeague && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }} onClick={() => setViewLeague(null)}>
          <div style={{ background: theme.surface, borderRadius: theme.radius, width: "100%", maxWidth: "400px", maxHeight: "85vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.2)" }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: "20px", borderBottom: "1px solid " + theme.border, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: "10px", color: "#2563EB", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px" }}>Ligaresultat</div>
                <h3 style={{ fontSize: "18px", fontWeight: 800, color: theme.text, margin: 0 }}>{viewLeague.leagueName}</h3>
              </div>
              <button onClick={() => setViewLeague(null)} style={{ border: "none", background: "none", cursor: "pointer", color: theme.textLight }}><X size={20} /></button>
            </div>
            <div style={{ padding: "20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
              {viewLeague.standings.map((t, idx) => {
                const rankIcon = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : null;
                const isChamp = idx === 0;
                return (
                  <div key={t.id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 14px", background: isChamp ? "#EFF6FF" : theme.surface, borderRadius: "10px", border: "1px solid " + (isChamp ? "#3B82F6" : theme.border) }}>
                    <div style={{ width: "24px", fontSize: "14px", fontWeight: 800, color: isChamp ? "#1D4ED8" : theme.textLight, textAlign: "center", flexShrink: 0 }}>
                      {rankIcon || idx + 1}
                    </div>
                    <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
                      <AvatarCircle avatar={t.player1_avatar} size={28} emojiSize="13px" style={{ background: "#DBEAFE", border: "1px solid #BFDBFE" }} />
                      <AvatarCircle avatar={t.player2_avatar} size={28} emojiSize="13px" style={{ background: "#DBEAFE", border: "1px solid #BFDBFE" }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "14px", fontWeight: 700, color: theme.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</div>
                      <div style={{ fontSize: "11px", color: theme.textLight }}>{t.player1_name} & {t.player2_name}</div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: "15px", fontWeight: 800, color: isChamp ? "#1D4ED8" : theme.text }}>{t.points} <span style={{ fontSize: "10px", fontWeight: 600, opacity: 0.6 }}>PTS</span></div>
                      <div style={{ fontSize: "10px", color: theme.textLight }}>{t.wins}W · {t.losses}L</div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ padding: "16px 20px", borderTop: "1px solid " + theme.border }}>
              <button onClick={() => setViewLeague(null)} style={{ ...btn(true), width: "100%", justifyContent: "center" }}>Luk</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
