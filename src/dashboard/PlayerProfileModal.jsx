import { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { theme, btn, tag } from '../lib/platformTheme';
import { availabilityTags } from '../lib/platformUtils';
import { filterRatedEloHistoryRows, statsFromEloHistoryRows, winStreaksFromEloHistory } from '../lib/eloHistoryUtils';
import { eloOf } from '../lib/matchDisplayUtils';
import { MapPin, MessageCircle, X } from 'lucide-react';
import { useBottomSheetDragToClose } from '../lib/useBottomSheetDragToClose';
import { calcAge, normalizeStringArrayField } from '../lib/profileUtils';
import { DAYS_OF_WEEK } from '../lib/platformConstants';
import { profileLevelDisplayText, formatPlaytomicLevel } from '../lib/padelLevelUtils';
import { getPlayerSeekingDetails } from '../lib/seekingActivityLabel';
import { AvatarCircle } from '../components/AvatarCircle';
import { SeekingCallout, SeekingCalloutDetail } from '../components/SeekingCallout';
import { TOURNAMENT_ELO_LABEL, TOURNAMENT_MODE_LABEL } from '../lib/tournamentCopy';
import { resolveAmericanoEloDisplay } from '../features/americano/americanoDisplayUtils';

export function PlayerProfileModal({ player, onClose, onMessage = undefined }) {
  const open = !!player;
  const { sheetRef, dragZoneProps, sheetStyle, sheetClassName } = useBottomSheetDragToClose({
    onClose,
    enabled: open,
  });

  const [dataLoading, setDataLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [statsMode, setStatsMode] = useState('2v2');
  const [streakError, setStreakError] = useState(false);
  const [streakStats, setStreakStats] = useState({ currentStreak: 0, bestStreak: 0 });
  const [ratedHistoryRows, setRatedHistoryRows] = useState([]);
  const [americanoHistoryRows, setAmericanoHistoryRows] = useState([]);
  const [profileRow, setProfileRow] = useState(null);
  const [ligaStats, setLigaStats] = useState(null);

  const loadProfileData = useCallback(async () => {
    if (!player?.id) {
      setDataLoading(false);
      setLoadError(null);
      setStatsMode('2v2');
      setStreakStats({ currentStreak: 0, bestStreak: 0 });
      setRatedHistoryRows([]);
      setAmericanoHistoryRows([]);
      setProfileRow(null);
      setLigaStats(null);
      setStreakError(false);
      return;
    }

    setDataLoading(true);
    setLoadError(null);
    setStatsMode('2v2');
    setStreakError(false);
    setRatedHistoryRows([]);
    setAmericanoHistoryRows([]);
    setProfileRow(null);
    setLigaStats(null);

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

      if (pr.error) throw pr.error;

      setProfileRow(pr.data || player);

      if (hist.error) {
        setStreakError(true);
        setStreakStats({ currentStreak: 0, bestStreak: 0 });
        setRatedHistoryRows([]);
      } else {
        const rows = filterRatedEloHistoryRows(hist.data || []);
        setStreakStats(winStreaksFromEloHistory(rows));
        setRatedHistoryRows(rows);
      }

      if (amHist.error) {
        setAmericanoHistoryRows([]);
      } else {
        setAmericanoHistoryRows(
          (amHist.data || []).map((row) => ({
            ...row,
            date: row.created_at,
            match_id: row.id,
            result: Number(row.change) > 0 ? 'win' : Number(row.change) < 0 ? 'loss' : 'draw',
          }))
        );
      }

      const teams = teamsRes.data || [];
      const teamIds = teams.map((t) => t.id);
      const leagueIds = [...new Set(teams.map((t) => t.league_id).filter(Boolean))];
      if (teamIds.length > 0) {
        const { data: leagueMatches, error: lmErr } = await supabase
          .from('league_matches')
          .select('winner_id, team1_id, team2_id')
          .eq('status', 'reported')
          .or(`team1_id.in.(${teamIds.join(',')}),team2_id.in.(${teamIds.join(',')})`);
        if (lmErr) throw lmErr;
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
        setLigaStats({ wins, losses, played, leagues: leagueIds.length, winPct });
      } else {
        setLigaStats({ wins: 0, losses: 0, played: 0, leagues: 0, winPct: 0 });
      }
    } catch (e) {
      console.warn('[PlayerProfileModal] load failed:', e);
      setLoadError('Kunne ikke hente profil og statistik. Tjek forbindelsen og prøv igen.');
      setStreakError(true);
      setStreakStats({ currentStreak: 0, bestStreak: 0 });
      setRatedHistoryRows([]);
      setAmericanoHistoryRows([]);
      setProfileRow(player);
      setLigaStats({ wins: 0, losses: 0, played: 0, leagues: 0, winPct: 0 });
    } finally {
      setDataLoading(false);
    }
  }, [player]);

  useEffect(() => {
    void loadProfileData();
  }, [loadProfileData]);

  useEffect(() => {
    if (!open || typeof document === 'undefined') return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose?.();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose, open]);

  const pRef = profileRow || player || {};
  const histStatsModal = statsFromEloHistoryRows(ratedHistoryRows);
  const elo = dataLoading ? null : (histStatsModal?.elo ?? eloOf(pRef));
  const games = dataLoading ? null : (histStatsModal?.games ?? (pRef.games_played || 0));
  const wins = dataLoading ? null : (histStatsModal?.wins ?? (pRef.games_won || 0));
  const winPct = games != null && games > 0 ? Math.round((wins / games) * 100) : 0;

  const americanoElo = useMemo(
    () => resolveAmericanoEloDisplay(pRef.americano_elo_rating, americanoHistoryRows),
    [americanoHistoryRows, pRef.americano_elo_rating],
  );

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
  const levelDisplay = profileLevelDisplayText(pRef.level);
  const locationDisplay = [pRef.city, pRef.area].filter(Boolean).join(', ') || null;
  const seekingChannel = player?.seekingChannel === 'kamp' || player?.seekingChannel === 'makker'
    ? player.seekingChannel
    : null;
  const seekingDetails = useMemo(
    () => getPlayerSeekingDetails(pRef, seekingChannel ? { channel: seekingChannel } : {}),
    [pRef, seekingChannel],
  );

  const playerName = pRef.full_name || pRef.name || 'Spiller';

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <>
      <button
        type="button"
        className="pm-kampe-v2-sheet-backdrop pm-kampe-v2-sheet-backdrop--stacked"
        aria-label={`Luk profil for ${playerName}`}
        onClick={onClose}
      />
      <div
        ref={sheetRef}
        className={`pm-kampe-v2-sheet pm-kampe-v2-detail-sheet pm-player-profile-sheet${sheetClassName ? ` ${sheetClassName}` : ''}`}
        style={sheetStyle}
        role="dialog"
        aria-modal="true"
        aria-label={`Profil for ${playerName}`}
      >
        <div {...dragZoneProps} aria-label="Træk her for at lukke">
          <div className="pm-kampe-v2-sheet-handle" aria-hidden />
          <div className="pm-kampe-v2-detail-head">
            <div className="pm-kampe-v2-detail-head-toolbar">
              <div className="pm-kampe-v2-detail-type">Spillerprofil</div>
              <button
                type="button"
                className="pm-kampe-v2-detail-close"
                onClick={onClose}
                onPointerDown={(event) => event.stopPropagation()}
                aria-label="Luk"
              >
                <X size={18} aria-hidden />
              </button>
            </div>
          </div>
        </div>
        <div className="pm-kampe-v2-detail-scroll">
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '20px' }}>
          <AvatarCircle avatar={pRef.avatar} size={64} emojiSize="32px" style={{ background: theme.accentBg, border: '2px solid ' + theme.accent + '40' }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '-0.02em', wordBreak: 'break-word' }}>{pRef.full_name || pRef.name || 'Spiller'}</div>
            <div style={{ display: 'flex', gap: '5px', marginTop: '6px', flexWrap: 'wrap' }}>
              {!dataLoading && elo != null && <span style={tag(theme.accentBg, theme.accent)}>2v2 ELO {elo}</span>}
              {!dataLoading && <span style={tag(theme.blueBg, theme.blue)}>{TOURNAMENT_ELO_LABEL} {americanoElo}</span>}
              {age && <span style={tag(theme.blueBg, theme.blue)}>{age} år</span>}
              {locationDisplay ? (
                <span style={tag(theme.warmBg, theme.warm)}>
                  <MapPin size={9} /> {locationDisplay}
                </span>
              ) : null}
              {levelDisplay ? (
                <span style={tag(theme.blueBg, theme.blue)}>Niveau {formatPlaytomicLevel(pRef.level)}</span>
              ) : null}
            </div>
          </div>
        </div>

        {loadError && !dataLoading ? (
          <div className="pm-state-card pm-state-card--error" style={{ marginBottom: '14px' }}>
            <div className="pm-state-icon" aria-hidden="true">⚠️</div>
            <div className="pm-state-title">Kunne ikke hente alle data</div>
            <div className="pm-state-copy">{loadError}</div>
            <div className="pm-state-actions">
              <button type="button" onClick={() => void loadProfileData()} style={{ ...btn(true), fontSize: '13px' }}>
                Prøv igen
              </button>
            </div>
          </div>
        ) : null}

        {seekingDetails?.blocks?.map((block) => (
          <SeekingCallout
            key={block.type}
            title={block.label}
            meta={`Synlig ${block.duration}${block.sinceLabel ? ` · ${block.sinceLabel}` : ''}`}
          >
            {(block.details?.length ? block.details : block.line ? [block.line] : []).map((detail, detailIdx) => {
              const colon = detail.indexOf(':');
              const hasLabel = colon > 0;
              return (
                <SeekingCalloutDetail
                  key={detailIdx}
                  label={hasLabel ? detail.slice(0, colon) : null}
                  value={hasLabel ? detail.slice(colon + 1).trim() : detail}
                />
              );
            })}
          </SeekingCallout>
        ))}

        <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => setStatsMode('2v2')} style={{ ...btn(statsMode === '2v2'), padding: '5px 10px', fontSize: '11px' }}>
            2v2
          </button>
          <button type="button" onClick={() => setStatsMode('americano')} style={{ ...btn(statsMode === 'americano'), padding: '5px 10px', fontSize: '11px' }}>
            {TOURNAMENT_MODE_LABEL}
          </button>
          <button type="button" onClick={() => setStatsMode('liga')} style={{ ...btn(statsMode === 'liga'), padding: '5px 10px', fontSize: '11px' }}>
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
            <div style={{ fontSize: '10px', fontWeight: 700, color: theme.textLight, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Americano/Mexicano-form</div>
            <div style={{ display: 'flex', gap: '5px', alignItems: 'center', marginTop: '8px', marginBottom: '6px' }}>
              {americanoForm.length > 0 ? (
                americanoForm.map((row) => (
                  <div
                    key={row.key}
                    className={`pm-form-result-dot pm-form-result-dot--${row.result === 'win' ? 'win' : row.result === 'loss' ? 'loss' : 'draw'}`}
                  >
                    {row.label}
                  </div>
                ))
              ) : (
                <div style={{ fontSize: '12px', color: theme.textMid }}>Ingen afsluttede Americano/Mexicano endnu.</div>
              )}
            </div>
            <div style={{ fontSize: '11px', color: theme.textMid }}>Seneste {americanoForm.length} Americano/Mexicano</div>
          </div>
        ) : statsMode === '2v2' ? (
          <div style={{ marginBottom: '16px', padding: '12px 14px', background: theme.surfaceAlt, borderRadius: '10px', border: '1px solid ' + theme.border }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: theme.textLight, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sejrsstreak</div>
            {dataLoading ? (
              <div style={{ fontSize: '13px', color: theme.textMid, marginTop: '8px' }}>Indlæser...</div>
            ) : streakError ? (
              <div style={{ fontSize: '12px', color: theme.textMid, marginTop: '6px', lineHeight: 1.4 }}>
                Kamphistorik kunne ikke hentes.
                <button type="button" onClick={() => void loadProfileData()} style={{ ...btn(false), display: 'block', marginTop: '8px', padding: '6px 12px', fontSize: '12px' }}>
                  Prøv igen
                </button>
              </div>
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
          {levelDisplay ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span style={{ color: theme.textLight }}>Niveau</span>
              <span style={{ fontWeight: 600 }}>{levelDisplay}</span>
            </div>
          ) : null}
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
            <span style={{ color: theme.textLight }}>Område</span>
            <span style={{ fontWeight: 600 }}>{locationDisplay || 'Ikke angivet'}</span>
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
                      <div key={key} className={active ? 'pm-day-pill pm-day-pill--active' : 'pm-day-pill pm-day-pill--inactive'}>
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
          <button type="button" onClick={onMessage} style={{ ...btn(true), width: '100%', justifyContent: 'center' }}>
            <MessageCircle size={15} /> Send besked
          </button>
        )}
        </div>
      </div>
    </>,
    document.body,
  );
}
