import { useMemo, useState, useEffect, useCallback } from 'react';
import { DateTime } from 'luxon';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { font, theme, heading, btn } from '../lib/platformTheme';
import { resolveDisplayName } from '../lib/platformUtils';
import { statsFromEloHistoryRows, useProfileEloBundle } from '../lib/eloHistoryUtils';
import { supabase } from '../lib/supabase';
import { mergeKampeSessionPrefs } from '../lib/kampeSessionPrefs';
import { Users, MapPin, Swords, Trophy, X } from 'lucide-react';
import { AvatarCircle } from '../components/AvatarCircle';
import { PlayerStatsModal } from '../components/PlayerStatsModal';

export function HomeTab({ user, setTab }) {
  const { user: authUser } = useAuth();
  const navigate = useNavigate();
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
      if (!tournaments || tournaments.length === 0) { setAmericanoFeed([]); return; }

      const tIds = tournaments.map(t => t.id);
      const [{ data: parts }, { data: matches }] = await Promise.all([
        supabase.from('americano_participants').select('id, tournament_id, user_id, display_name').in('tournament_id', tIds),
        supabase.from('americano_matches').select('tournament_id, team_a_p1, team_a_p2, team_b_p1, team_b_p2, team_a_score, team_b_score').in('tournament_id', tIds),
      ]);

      // Fetch avatars for winner user_ids
      const userIds = [...new Set((parts || []).map(p => p.user_id))];
      let avatarMap = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('id, avatar').in('id', userIds);
        (profiles || []).forEach(p => { avatarMap[String(p.id)] = p.avatar; });
      }

      const items = tournaments.map(t => {
        const tParts = (parts || []).filter(p => p.tournament_id === t.id);
        const tMatches = (matches || []).filter(m => m.tournament_id === t.id);
        // Build leaderboard
        const totals = {};
        tParts.forEach(p => { totals[p.id] = 0; });
        tMatches.forEach(m => {
          if (m.team_a_score == null || m.team_b_score == null) return;
          const add = (pid, pts) => { totals[pid] = (totals[pid] || 0) + pts; };
          add(m.team_a_p1, m.team_a_score);
          add(m.team_a_p2, m.team_a_score);
          add(m.team_b_p1, m.team_b_score);
          add(m.team_b_p2, m.team_b_score);
        });
        // Find winner
        let bestPart = null;
        let bestPts = -1;
        tParts.forEach(p => {
          const pts = totals[p.id] || 0;
          if (pts > bestPts) { bestPts = pts; bestPart = p; }
        });
        if (!bestPart) return null;

        const leaderboard = tParts.map(p => ({
          name: p.display_name,
          points: totals[p.id] || 0,
          userId: p.user_id,
          avatar: avatarMap[String(p.user_id)] || '🎾'
        })).sort((a, b) => b.points - a.points);

        return {
          type: 'americano_winner',
          userId: bestPart.user_id,
          name: bestPart.display_name,
          points: bestPts,
          tournamentName: t.name,
          tournamentId: t.id,
          leaderboard: leaderboard,
          avatar: avatarMap[String(bestPart.user_id)] || '🏆',
          created_at: t.updated_at || t.tournament_date,
        };
      }).filter(Boolean);
      setAmericanoFeed(items);
    } catch (e) {
      console.warn('Americano feed error:', e);
      setAmericanoFeed([]);
    }
  }, []);

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

  const goToMatchFromFeed = useCallback((matchId) => {
    if (!matchId) return;
    mergeKampeSessionPrefs(user.id, { scope: 'alle' });
    navigate(`/dashboard/kampe?focus=${encodeURIComponent(String(matchId))}`);
  }, [navigate, user.id]);

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
      {(feed.length > 0 || americanoFeed.length > 0) && (
        <div style={{ marginBottom: "24px" }}>
          <div style={{ fontSize: "12px", fontWeight: 700, color: theme.textLight, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "10px" }}>
            Seneste aktivitet
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {/* Merge and sort all feeds by date */}
            {[...feed, ...americanoFeed]
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

                if (row.type === 'match_group') {
                  const winners = row.players.filter(p => p.win);
                  const losers = row.players.filter(p => !p.win);
                  return (
                    <div key={`match-${i}`} style={{ background: theme.surface, borderRadius: "10px", padding: "8px 14px", border: "1px solid " + theme.border, boxShadow: "0 2px 8px rgba(0,0,0,0.03)", position: "relative", overflow: "hidden" }}>
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
                      <div style={{ display: "flex", justifyContent: "center", marginTop: "8px" }}>
                        <button onClick={() => goToMatchFromFeed(row.match_id)} style={{ ...btn(false), padding: "4px 10px", fontSize: "11px" }}>
                          Åben kamp
                        </button>
                      </div>
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
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" }} onClick={() => setViewTournament(null)}>
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
    </div>
  );
}
