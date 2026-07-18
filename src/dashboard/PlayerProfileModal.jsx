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
import { TWO_V_TWO_ELO_LABEL, TOURNAMENT_ELO_LABEL, TOURNAMENT_MODE_LABEL } from '../lib/tournamentCopy';
import { resolveAmericanoEloDisplay } from '../features/americano/americanoDisplayUtils';
import { useAuth } from '../lib/AuthContext';
import { BeskedChatActions } from '../components/BeskedChatActions';
import { fetchUsersIBlocked } from '../lib/userModeration';

export function PlayerProfileModal({ player, onClose, onMessage = undefined, onInviteMatch = undefined }) {
  const open = !!player;
  const { profile: currentProfile } = useAuth();
  const { sheetRef, dragZoneProps, sheetStyle, sheetClassName } = useBottomSheetDragToClose({
    onClose,
    enabled: open,
  });

  const [dataLoading, setDataLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [iBlockedThem, setIBlockedThem] = useState(false);
  const [statsMode, setStatsMode] = useState('2v2');
  const [streakError, setStreakError] = useState(false);
  const [streakStats, setStreakStats] = useState({ currentStreak: 0, bestStreak: 0 });
  const [ratedHistoryRows, setRatedHistoryRows] = useState([]);
  const [americanoHistoryRows, setAmericanoHistoryRows] = useState([]);
  const [profileRow, setProfileRow] = useState(null);
  const [ligaStats, setLigaStats] = useState(null);
  const [sharedHistory, setSharedHistory] = useState(null);

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
      setSharedHistory(null);
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
    setSharedHistory(null);
    setIBlockedThem(false);

    const canLoadSharedHistory =
      currentProfile?.id && String(currentProfile.id) !== String(player.id);

    try {
      const [pr, hist, amHist, teamsRes, myHistRes, blockedSet] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', player.id).maybeSingle(),
        supabase.from('elo_history').select('*').eq('user_id', player.id).order('date', { ascending: true }),
        supabase
          .from('americano_elo_history')
          .select('id, old_rating, new_rating, change, created_at')
          .eq('user_id', player.id)
          .order('created_at', { ascending: true }),
        supabase.from('league_teams').select('id, league_id').or(`player1_id.eq.${player.id},player2_id.eq.${player.id}`),
        canLoadSharedHistory
          ? supabase
            .from('elo_history')
            .select('match_id, result')
            .eq('user_id', currentProfile.id)
            .not('match_id', 'is', null)
          : Promise.resolve({ data: [], error: null }),
        currentProfile?.id
          ? fetchUsersIBlocked(currentProfile.id).catch(() => new Set())
          : Promise.resolve(new Set()),
      ]);
      setIBlockedThem(blockedSet.has(String(player.id)));

      if (pr.error) throw pr.error;

      const teams = teamsRes.data || [];
      const teamIds = teams.map((t) => t.id);
      const leagueIds = [...new Set(teams.map((t) => t.league_id).filter(Boolean))];

      let leagueMatches = [];
      if (teamIds.length > 0) {
        const { data, error: lmErr } = await supabase
          .from('league_matches')
          .select('winner_id, team1_id, team2_id')
          .eq('status', 'reported')
          .or(`team1_id.in.(${teamIds.join(',')}),team2_id.in.(${teamIds.join(',')})`);
        if (lmErr) throw lmErr;
        leagueMatches = data || [];
      }

      let nextStreakError = false;
      let nextStreakStats = { currentStreak: 0, bestStreak: 0 };
      let nextRatedRows = [];
      if (hist.error) {
        nextStreakError = true;
      } else {
        nextRatedRows = filterRatedEloHistoryRows(hist.data || []);
        nextStreakStats = winStreaksFromEloHistory(nextRatedRows);
      }

      const nextAmericanoRows = amHist.error
        ? []
        : (amHist.data || []).map((row) => ({
          ...row,
          date: row.created_at,
          match_id: row.id,
          result: Number(row.change) > 0 ? 'win' : Number(row.change) < 0 ? 'loss' : 'draw',
        }));

      let nextSharedHistory = null;
      if (canLoadSharedHistory && !hist.error) {
        const viewedMatchIds = new Set(
          (hist.data || []).map((r) => r.match_id).filter(Boolean),
        );
        const shared = (myHistRes.data || []).filter(
          (r) => r.match_id && viewedMatchIds.has(r.match_id),
        );
        if (shared.length > 0) {
          nextSharedHistory = {
            count: shared.length,
            wins: shared.filter((r) => r.result === 'win').length,
          };
        }
      }

      let wins = 0;
      let played = 0;
      for (const m of leagueMatches) {
        const mine = teamIds.includes(m.team1_id) || teamIds.includes(m.team2_id);
        if (!mine) continue;
        played++;
        if (m.winner_id && teamIds.includes(m.winner_id)) wins++;
      }
      const losses = played - wins;
      const nextLigaStats = {
        wins,
        losses,
        played,
        leagues: leagueIds.length,
        winPct: played > 0 ? Math.round((wins / played) * 100) : 0,
      };

      setProfileRow(pr.data || player);
      setStreakError(nextStreakError);
      setStreakStats(nextStreakStats);
      setRatedHistoryRows(nextRatedRows);
      setAmericanoHistoryRows(nextAmericanoRows);
      setSharedHistory(nextSharedHistory);
      setLigaStats(nextLigaStats);
    } catch (e) {
      console.warn('[PlayerProfileModal] load failed:', e);
      setLoadError('Kunne ikke hente profil og statistik. Tjek forbindelsen og prøv igen.');
      setStreakError(true);
      setStreakStats({ currentStreak: 0, bestStreak: 0 });
      setRatedHistoryRows([]);
      setAmericanoHistoryRows([]);
      setProfileRow(player);
      setLigaStats({ wins: 0, losses: 0, played: 0, leagues: 0, winPct: 0 });
      setSharedHistory(null);
    } finally {
      setDataLoading(false);
    }
  }, [player, currentProfile?.id]);

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

  const pRef = dataLoading ? (player || {}) : (profileRow || player || {});
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

  const recentForm = useMemo(
    () =>
      [...ratedHistoryRows]
        .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())
        .slice(0, 4)
        .map((row) => (row.result === 'win' ? 'V' : row.result === 'loss' ? 'T' : 'U')),
    [ratedHistoryRows],
  );

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
            { label: TOURNAMENT_ELO_LABEL, value: americanoElo, color: theme.accent },
            { label: 'Turn.', value: americanoPlayed, color: theme.blue },
            { label: 'Vundne', value: americanoWins, color: theme.warm },
            { label: 'Win %', value: americanoRounds > 0 ? `${americanoWinPct}%` : '—', color: theme.accent },
          ]
        : [
            { label: TWO_V_TWO_ELO_LABEL, value: elo, color: theme.accent },
            { label: 'Kampe', value: games, color: theme.blue },
            { label: 'Win %', value: games != null && games > 0 ? `${winPct}%` : '—', color: theme.accent },
            { label: 'Seneste form', value: null, form: recentForm },
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
        key={`profile-backdrop-${player.id}`}
        type="button"
        className="pm-kampe-v2-sheet-backdrop pm-kampe-v2-sheet-backdrop--stacked"
        aria-label={`Luk profil for ${playerName}`}
        onClick={onClose}
      />
      <div
        key={player.id}
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
        {dataLoading ? (
          <div className="pm-state-card pm-state-card--loading" style={{ margin: '24px 0 32px' }}>
            <div className="pm-spinner pm-state-spinner" />
            <div className="pm-state-title">Indlæser profil…</div>
            <div className="pm-state-copy">Henter statistik og profildetaljer.</div>
          </div>
        ) : (
        <>
        {/* Profile head — centered, matches mockup */}
        <div style={{ textAlign: 'center', marginBottom: '20px', paddingTop: '4px' }}>
          <div style={{ display: 'inline-block', position: 'relative', marginBottom: '10px' }}>
            <AvatarCircle avatar={pRef.avatar} size={72} emojiSize="36px" style={{ background: theme.accentBg, border: '2px solid ' + theme.accent + '40' }} />
            {pRef.level != null && pRef.level !== '' && (
              <div style={{ position: 'absolute', bottom: 0, right: 0, width: 20, height: 20, borderRadius: '50%', background: theme.navy, color: 'var(--pm-on-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid ' + theme.surface }}>
                <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 13 4 4L19 7"/></svg>
              </div>
            )}
          </div>
          <div style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '-0.02em', wordBreak: 'break-word' }}>{pRef.full_name || pRef.name || 'Spiller'}</div>
          {(locationDisplay || pRef.created_at) && (
            <div style={{ fontSize: '12px', color: theme.textMid, marginTop: '3px' }}>
              {[locationDisplay, pRef.created_at ? `Medlem siden ${new Date(pRef.created_at).getFullYear()}` : null].filter(Boolean).join(' · ')}
            </div>
          )}
          <div style={{ display: 'flex', gap: '6px', marginTop: '9px', justifyContent: 'center', flexWrap: 'wrap' }}>
            {pRef.court_side && <span style={tag(theme.navySoft, theme.onAccent)}>{pRef.court_side}</span>}
            {pRef.play_style && <span style={tag(theme.navySoft, theme.onAccent)}>{pRef.play_style}</span>}
            {!dataLoading && elo != null && <span style={tag(theme.accentBg, theme.accent)}>{TWO_V_TWO_ELO_LABEL} {elo}</span>}
            {levelDisplay ? (
              <span style={tag(theme.amberBg, theme.amberText)}>Niveau {formatPlaytomicLevel(pRef.level)}</span>
            ) : null}
            {age && <span style={tag(theme.surfaceAlt, theme.textMid)}>{age} år</span>}
          </div>
        </div>

        {loadError ? (
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

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '11px', padding: '0 0 2px', marginBottom: '16px' }}>
          {activeOverviewCards.map((s, i) => (
            <div key={i} style={{ textAlign: 'center', padding: '13px 15px', background: theme.surfaceAlt, borderRadius: theme.radius, border: '1px solid ' + theme.border }}>
              <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '1.2px', textTransform: 'uppercase', color: theme.textLight }}>{s.label}</div>
              {s.form ? (
                <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginTop: 9 }}>
                  {s.form.length > 0 ? s.form.map((r, j) => (
                    <div key={j} style={{ width: 21, height: 21, borderRadius: '50%', background: r === 'V' ? 'var(--pm-green)' : r === 'T' ? 'var(--pm-red)' : 'var(--pm-border)', color: 'var(--pm-on-accent)', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{r}</div>
                  )) : <div style={{ fontSize: '12px', color: theme.textLight, marginTop: 4 }}>—</div>}
                </div>
              ) : (
                <div style={{ fontSize: '23px', fontWeight: 700, color: theme.accent, marginTop: '4px', letterSpacing: '-0.4px' }}>{s.value}</div>
              )}
            </div>
          ))}
        </div>

        {statsMode === 'liga' ? (
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
            {streakError ? (
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
          {locationDisplay && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span style={{ color: theme.textLight }}>Område</span>
              <span style={{ fontWeight: 600 }}>{locationDisplay}</span>
            </div>
          )}
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

        {sharedHistory && sharedHistory.count > 0 && (
          <div style={{ marginBottom: 16, padding: '12px 14px', background: theme.surfaceAlt, borderRadius: 10, border: '1px solid ' + theme.border }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: theme.textLight, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Fælles historik</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '12.5px', fontWeight: 600, color: theme.text }}>
                I har spillet {sharedHistory.count} kamp{sharedHistory.count !== 1 ? 'e' : ''} sammen
              </div>
              {sharedHistory.wins > 0 && (
                <span style={tag(theme.greenBg, theme.green)}>{sharedHistory.wins} sejr{sharedHistory.wins !== 1 ? 'e' : ''}</span>
              )}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '4px' }}>
          {onInviteMatch && (
            <button type="button" onClick={onInviteMatch} style={{ ...btn(true), width: '100%', justifyContent: 'center' }}>
              Invitér til kamp
            </button>
          )}
          {onMessage && (
            <button type="button" onClick={onMessage} style={{ ...btn(false), width: '100%', justifyContent: 'center' }}>
              <MessageCircle size={15} /> Send besked
            </button>
          )}
          {currentProfile?.id && String(currentProfile.id) !== String(player.id) ? (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }} data-tour="profile-moderation-actions">
              <BeskedChatActions
                otherUserId={player.id}
                otherName={playerName}
                iBlockedThem={iBlockedThem}
                context="profile"
                ariaLabel="Bloker eller anmeld spiller"
                onBlocked={() => setIBlockedThem(true)}
                onUnblocked={() => setIBlockedThem(false)}
              />
            </div>
          ) : null}
        </div>
        </>
        )}
        </div>
      </div>
    </>,
    document.body,
  );
}
