import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { theme, btn, tag } from '../lib/platformTheme';
import { availabilityTags } from '../lib/platformUtils';
import { filterRatedEloHistoryRows, statsFromEloHistoryRows, winStreaksFromEloHistory } from '../lib/eloHistoryUtils';
import { eloOf } from '../lib/matchDisplayUtils';
import { MapPin, MessageCircle } from 'lucide-react';
import { calcAge, normalizeStringArrayField } from '../lib/profileUtils';
import { levelLabel, DAYS_OF_WEEK } from '../lib/platformConstants';
import { getPlayerSeekingDetails } from '../lib/seekingActivityLabel';
import { AvatarCircle } from '../components/AvatarCircle';

export function PlayerProfileModal({ player, onClose, onMessage = undefined }) {
  const [dataLoading, setDataLoading] = useState(true);
  const [statsMode, setStatsMode] = useState('2v2');
  const [streakError, setStreakError] = useState(false);
  const [streakStats, setStreakStats] = useState({ currentStreak: 0, bestStreak: 0 });
  const [ratedHistoryRows, setRatedHistoryRows] = useState([]);
  const [americanoHistoryRows, setAmericanoHistoryRows] = useState([]);
  const [profileRow, setProfileRow] = useState(null);
  const [ligaStats, setLigaStats] = useState(null);

  useEffect(() => {
    if (!player?.id) {
      setDataLoading(false);
      setStatsMode('2v2');
      setStreakStats({ currentStreak: 0, bestStreak: 0 });
      setRatedHistoryRows([]);
      setAmericanoHistoryRows([]);
      setProfileRow(null);
      setLigaStats(null);
      return;
    }

    let cancelled = false;
    setDataLoading(true);
    setStatsMode('2v2');
    setStreakError(false);
    setRatedHistoryRows([]);
    setAmericanoHistoryRows([]);
    setProfileRow(null);
    setLigaStats(null);

    (async () => {
      try {
        const [pr, hist, amHist, teamsRes] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', player.id).maybeSingle(),
          supabase.from('elo_history').select('*').eq('user_id', player.id).order('date', { ascending: true }),
          supabase
            .from('americano_elo_history')
            .select('id, old_rating, new_rating, change, created_at')
            .eq('user_id', player.id)
            .order('created_at', { ascending: true }),
          supabase.from('league_teams').select('id, league_id').or(`player1_id.eq.${player.id},player2_id.eq.${player.id}`),
        ]);

        if (cancelled) return;
        if (hist.error) throw hist.error;
        if (amHist.error) throw amHist.error;

        const rows = filterRatedEloHistoryRows(hist.data || []);
        setStreakStats(winStreaksFromEloHistory(rows));
        setRatedHistoryRows(rows);
        setAmericanoHistoryRows(
          (amHist.data || []).map((row) => ({
            ...row,
            date: row.created_at,
            match_id: row.id,
            result: Number(row.change) > 0 ? 'win' : Number(row.change) < 0 ? 'loss' : 'draw',
          }))
        );
        setProfileRow(pr.data || player);

        const teams = teamsRes.data || [];
        const teamIds = teams.map((t) => t.id);
        const leagueIds = [...new Set(teams.map((t) => t.league_id).filter(Boolean))];
        if (teamIds.length > 0) {
          const { data: leagueMatches } = await supabase
            .from('league_matches')
            .select('winner_id, team1_id, team2_id')
            .eq('status', 'reported')
            .or(`team1_id.in.(${teamIds.join(',')}),team2_id.in.(${teamIds.join(',')})`);
          let wins = 0;
          let played = 0;
          for (const m of leagueMatches || []) {
            const mine = teamIds.includes(m.team1_id) || teamIds.includes(m.team2_id);
            if (!mine) continue;
            played++;
            if (m.winner_id && teamIds.includes(m.winner_id)) wins++;
          }
          const losses = played - wins;
          const winPct = played > 0 ? Math.round((wins / played) * 100) : 0;
          if (!cancelled) {
            setLigaStats({ wins, losses, played, leagues: leagueIds.length, winPct });
          }
        } else if (!cancelled) {
          setLigaStats({ wins: 0, losses: 0, played: 0, leagues: 0, winPct: 0 });
        }
      } catch {
        if (!cancelled) {
          setStreakError(true);
          setStreakStats({ currentStreak: 0, bestStreak: 0 });
          setRatedHistoryRows([]);
          setAmericanoHistoryRows([]);
          setProfileRow(player);
          setLigaStats({ wins: 0, losses: 0, played: 0, leagues: 0, winPct: 0 });
        }
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [player]);

  const pRef = profileRow || player || {};
  const histStatsModal = statsFromEloHistoryRows(ratedHistoryRows);
  const elo = dataLoading ? null : (histStatsModal?.elo ?? eloOf(pRef));
  const games = dataLoading ? null : (histStatsModal?.games ?? (pRef.games_played || 0));
  const wins = dataLoading ? null : (histStatsModal?.wins ?? (pRef.games_won || 0));
  const winPct = games != null && games > 0 ? Math.round((wins / games) * 100) : 0;

  const americanoElo = useMemo(() => {
    if (americanoHistoryRows.length > 0) {
      const last = americanoHistoryRows[americanoHistoryRows.length - 1];
      if (last?.new_rating != null && Number.isFinite(Number(last.new_rating))) {
        return Math.round(Number(last.new_rating));
      }
    }
    return Math.round(Number(pRef.americano_elo_rating) || 1000);
  }, [americanoHistoryRows, pRef.americano_elo_rating]);

  const americanoPlayed = Number(pRef.americano_played) || americanoHistoryRows.length || 0;
  const americanoWins = Number(pRef.americano_wins) || 0;
  const americanoDraws = Number(pRef.americano_draws) || 0;
  const americanoLosses = Number(pRef.americano_losses) || 0;
  const americanoRounds = americanoWins + americanoDraws + americanoLosses;
  const americanoWinPct = americanoRounds > 0 ? Math.round((americanoWins / americanoRounds) * 100) : 0;

  const americanoForm = useMemo(
    () =>
      [...americanoHistoryRows]
        .sort((a, b) => new Date(b.date || b.created_at || 0).getTime() - new Date(a.date || a.created_at || 0).getTime())
        .slice(0, 5)
        .map((row, idx) => ({
          key: `${row.match_id || row.id || idx}-${idx}`,
          label: row.result === 'win' ? 'V' : row.result === 'loss' ? 'T' : 'U',
          result: row.result,
        })),
    [americanoHistoryRows]
  );

  const activeOverviewCards =
    statsMode === 'liga'
      ? [
          { label: 'Vundet', value: ligaStats?.wins ?? 0, color: theme.green },
          { label: 'Tabt', value: ligaStats?.losses ?? 0, color: theme.red },
          { label: 'Kampe', value: ligaStats?.played ?? 0, color: theme.blue },
          { label: 'Win %', value: ligaStats?.played > 0 ? `${ligaStats.winPct}%` : '—', color: theme.accent },
        ]
      : statsMode === 'americano'
        ? [
            { label: 'ELO', value: americanoElo, color: theme.accent },
            { label: 'Turn.', value: americanoPlayed, color: theme.blue },
            { label: 'Vundne', value: americanoWins, color: theme.warm },
            { label: 'Win %', value: americanoRounds > 0 ? `${americanoWinPct}%` : '—', color: theme.accent },
          ]
        : [
            { label: 'ELO', value: elo, color: theme.accent },
            { label: 'Kampe', value: games, color: theme.blue },
            { label: 'Sejre', value: wins, color: theme.warm },
            { label: 'Win %', value: games != null && games > 0 ? `${winPct}%` : '—', color: theme.accent },
          ];

  const age = calcAge(pRef.birth_year, pRef.birth_month, pRef.birth_day);
  const seekingDetails = useMemo(() => getPlayerSeekingDetails(pRef), [pRef]);

  if (!player) return null;

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: theme.surface, borderRadius: '14px', padding: 'clamp(18px,5vw,28px)', maxWidth: '380px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', border: '1px solid ' + theme.border, maxHeight: '90dvh', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '20px' }}>
          <AvatarCircle avatar={pRef.avatar} size={64} emojiSize="32px" style={{ background: theme.accentBg, border: '2px solid ' + theme.accent + '40' }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '-0.02em', wordBreak: 'break-word' }}>{pRef.full_name || pRef.name || 'Spiller'}</div>
            <div style={{ display: 'flex', gap: '5px', marginTop: '6px', flexWrap: 'wrap' }}>
              {!dataLoading && elo != null && <span style={tag(theme.accentBg, theme.accent)}>2v2 ELO {elo}</span>}
              {!dataLoading && <span style={tag(theme.blueBg, theme.blue)}>Americano ELO {americanoElo}</span>}
              {age && <span style={tag(theme.blueBg, theme.blue)}>{age} år</span>}
              {(pRef.city || pRef.area) && (
                <span style={tag(theme.warmBg, theme.warm)}>
                  <MapPin size={9} /> {pRef.city || pRef.area}
                </span>
              )}
            </div>
          </div>
        </div>

        {seekingDetails && (
          <div
            style={{
              marginBottom: '16px',
              padding: '14px',
              background: '#FEF3C7',
              borderRadius: '10px',
              border: '1px solid #FDE68A',
            }}
          >
            <div
              style={{
                fontSize: '10px',
                fontWeight: 700,
                color: '#B45309',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: '6px',
              }}
            >
              Lige nu
            </div>
            <div style={{ fontSize: '16px', fontWeight: 800, color: '#B45309', marginBottom: '10px', letterSpacing: '-0.02em' }}>
              {seekingDetails.headline}
            </div>
            {seekingDetails.blocks.map((block, idx) => (
              <div
                key={block.type}
                style={{
                  marginBottom: idx < seekingDetails.blocks.length - 1 ? '10px' : 0,
                  paddingBottom: idx < seekingDetails.blocks.length - 1 ? '10px' : 0,
                  borderBottom: idx < seekingDetails.blocks.length - 1 ? '1px solid #FDE68A' : 'none',
                }}
              >
                <div style={{ fontSize: '12px', fontWeight: 700, color: theme.text, marginBottom: '4px' }}>
                  {block.label}
                </div>
                <div style={{ fontSize: '12px', color: theme.textMid, lineHeight: 1.45 }}>{block.summary}</div>
                {block.detail ? (
                  <div style={{ fontSize: '11px', color: theme.textLight, marginTop: '4px' }}>{block.detail}</div>
                ) : null}
              </div>
            ))}
            {seekingDetails.intentLabel ? (
              <div style={{ fontSize: '12px', color: theme.textMid, marginTop: '8px' }}>
                <span style={{ color: theme.textLight }}>Spillestil lige nu: </span>
                <span style={{ fontWeight: 600 }}>{seekingDetails.intentLabel}</span>
              </div>
            ) : null}
            <div style={{ fontSize: '11px', color: theme.textLight, marginTop: '8px', lineHeight: 1.4 }}>
              {seekingDetails.sinceLabel ? `Aktiv siden ${seekingDetails.sinceLabel}` : 'Aktiv nu'}
              {' · '}
              Synlig i {seekingDetails.visibleFor}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', flexWrap: 'wrap' }}>
          <button onClick={() => setStatsMode('2v2')} style={{ ...btn(statsMode === '2v2'), padding: '5px 10px', fontSize: '11px' }}>
            2v2
          </button>
          <button onClick={() => setStatsMode('americano')} style={{ ...btn(statsMode === 'americano'), padding: '5px 10px', fontSize: '11px' }}>
            Americano
          </button>
          <button onClick={() => setStatsMode('liga')} style={{ ...btn(statsMode === 'liga'), padding: '5px 10px', fontSize: '11px' }}>
            Liga
          </button>
        </div>

        {dataLoading ? (
          <div style={{ textAlign: 'center', padding: '16px', color: theme.textMid, fontSize: '13px', marginBottom: '16px' }}>Indlæser statistik...</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '16px' }}>
            {activeOverviewCards.map((s, i) => (
              <div key={i} style={{ textAlign: 'center', padding: '10px 4px', background: theme.surfaceAlt, borderRadius: '8px' }}>
                <div style={{ fontSize: '16px', fontWeight: 800, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: '9px', fontWeight: 700, color: theme.textLight, marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {statsMode === 'liga' ? (
          !dataLoading &&
          ligaStats !== null && (
            <div
              style={{
                marginBottom: '16px',
                padding: '12px 14px',
                background: theme.accentBg,
                borderRadius: '10px',
                border: '1px solid ' + theme.border,
              }}
            >
              <div
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  color: theme.textLight,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: '4px',
                }}
              >
                Ligakampe vundet
              </div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: theme.blue, letterSpacing: '-0.02em' }}>
                🏅 {ligaStats.wins}
              </div>
              <div style={{ fontSize: '11px', color: theme.textMid, marginTop: '6px', lineHeight: 1.4 }}>
                {ligaStats.leagues > 0
                  ? `${ligaStats.leagues} liga${ligaStats.leagues === 1 ? '' : 'er'} · ${ligaStats.played} kampe i alt`
                  : 'Ingen afsluttede ligakampe endnu.'}
              </div>
            </div>
          )
        ) : statsMode === 'americano' ? (
          <div style={{ marginBottom: '16px', padding: '12px 14px', background: theme.surfaceAlt, borderRadius: '10px', border: '1px solid ' + theme.border }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: theme.textLight, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Americano form</div>
            <div style={{ display: 'flex', gap: '5px', alignItems: 'center', marginTop: '8px', marginBottom: '6px' }}>
              {americanoForm.length > 0 ? (
                americanoForm.map((row) => (
                  <div
                    key={row.key}
                    style={{
                      width: '22px',
                      height: '22px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '11px',
                      fontWeight: 700,
                      background: row.result === 'win' ? '#22C55E' : row.result === 'loss' ? '#EF4444' : '#9CA3AF',
                      color: '#fff',
                    }}
                  >
                    {row.label}
                  </div>
                ))
              ) : (
                <div style={{ fontSize: '12px', color: theme.textMid }}>Ingen afsluttede Americano-turneringer endnu.</div>
              )}
            </div>
            <div style={{ fontSize: '11px', color: theme.textMid }}>Seneste {americanoForm.length} Americano-turneringer</div>
          </div>
        ) : statsMode === '2v2' ? (
          <div style={{ marginBottom: '16px', padding: '12px 14px', background: theme.surfaceAlt, borderRadius: '10px', border: '1px solid ' + theme.border }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: theme.textLight, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sejrsstreak</div>
            {dataLoading ? (
              <div style={{ fontSize: '13px', color: theme.textMid, marginTop: '8px' }}>Indlæser...</div>
            ) : streakError ? (
              <div style={{ fontSize: '12px', color: theme.textMid, marginTop: '6px', lineHeight: 1.4 }}>Kunne ikke hente kamphistorik.</div>
            ) : (
              <>
                <div style={{ fontSize: '22px', fontWeight: 800, color: theme.warm, marginTop: '4px', letterSpacing: '-0.02em' }}>
                  {streakStats.currentStreak > 0 ? `🔥 ${streakStats.currentStreak}` : '0'}
                </div>
                <div style={{ fontSize: '11px', color: theme.textMid, marginTop: '4px' }}>Bedste: {streakStats.bestStreak} i træk</div>
              </>
            )}
          </div>
        ) : null}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
          {pRef.level && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span style={{ color: theme.textLight }}>Niveau</span>
              <span style={{ fontWeight: 600 }}>{levelLabel(pRef.level)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
            <span style={{ color: theme.textLight }}>Spillestil</span>
            <span style={{ fontWeight: 600 }}>{pRef.play_style || 'Ikke angivet'}</span>
          </div>
          {pRef.court_side && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span style={{ color: theme.textLight }}>Side på banen</span>
              <span style={{ fontWeight: 600 }}>{pRef.court_side}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
            <span style={{ color: theme.textLight }}>Region</span>
            <span style={{ fontWeight: 600 }}>{pRef.area || pRef.city || 'Ikke angivet'}</span>
          </div>
          {age && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span style={{ color: theme.textLight }}>Alder</span>
              <span style={{ fontWeight: 600 }}>{age} år</span>
            </div>
          )}
          {availabilityTags(pRef).length > 0 && (
            <div style={{ fontSize: '13px' }}>
              <span style={{ color: theme.textLight }}>Tilgængelighed</span>
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px' }}>
                {availabilityTags(pRef).map((a) => (
                  <span key={a} style={tag(theme.accentBg, theme.accent)}>{a}</span>
                ))}
              </div>
            </div>
          )}
          {(() => {
            const days = normalizeStringArrayField(pRef.available_days);
            if (!days.length) return null;
            return (
              <div style={{ fontSize: '13px' }}>
                <span style={{ color: theme.textLight }}>Spilledage</span>
                <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
                  {DAYS_OF_WEEK.map(({ key, label }) => {
                    const active = days.includes(key);
                    return (
                      <div key={key} style={{ flex: 1, textAlign: 'center', padding: '4px 2px', borderRadius: '5px', fontSize: '11px', fontWeight: 700, background: active ? theme.accent : theme.surfaceAlt, color: active ? '#fff' : theme.textLight }}>
                        {label}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>

        {pRef.bio && (
          <p style={{ fontSize: '13px', color: theme.textMid, lineHeight: 1.5, marginBottom: '16px', padding: '12px', background: theme.surfaceAlt, borderRadius: '8px', fontStyle: 'italic' }}>
            &ldquo;{pRef.bio}&rdquo;
          </p>
        )}

        {onMessage && (
          <button onClick={onMessage} style={{ ...btn(true), width: '100%', justifyContent: 'center', marginBottom: '8px' }}>
            <MessageCircle size={15} /> Send besked
          </button>
        )}
        <button onClick={onClose} style={{ ...btn(false), width: '100%', justifyContent: 'center' }}>Luk</button>
      </div>
    </div>
  );
}
