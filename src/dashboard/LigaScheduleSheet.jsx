import { useMemo } from 'react';
import { ChevronLeft } from 'lucide-react';
import { useBottomSheetDragToClose } from '../lib/useBottomSheetDragToClose';
import { theme } from '../lib/platformTheme';

function matchResultTag(match, myTeamId) {
  if (!match.team2_id) return { label: 'Fri runde', color: theme.textLight, bg: theme.surfaceAlt, border: theme.border };
  if (match.status !== 'reported') return { label: 'Planlagt', color: theme.amber, bg: theme.amberBg, border: theme.amberBorder };

  if (!myTeamId) {
    return { label: match.score_text || '—', color: theme.navy, bg: theme.navySoft, border: 'transparent' };
  }

  const isMyMatch = match.team1_id === myTeamId || match.team2_id === myTeamId;
  if (!isMyMatch) {
    return { label: match.score_text || '—', color: theme.navy, bg: theme.navySoft, border: 'transparent' };
  }

  const iWon = match.winner_id === myTeamId;
  return iWon
    ? { label: 'Vundet', color: theme.green, bg: theme.greenBg, border: 'transparent' }
    : { label: 'Tabt', color: theme.red, bg: theme.redBg, border: 'transparent' };
}

export function LigaScheduleSheet({
  open,
  onClose,
  league,
  teams,
  matches,
  myTeam,
  currentRound,
  totalRounds,
}) {
  const { sheetRef, dragZoneProps, sheetStyle, sheetClassName } = useBottomSheetDragToClose({
    onClose,
    enabled: open,
  });

  const teamMap = useMemo(
    () => Object.fromEntries(teams.map((t) => [t.id, t])),
    [teams],
  );

  const roundsMap = useMemo(() => {
    const m = {};
    for (const match of matches) {
      if (!m[match.round_number]) m[match.round_number] = [];
      m[match.round_number].push(match);
    }
    return m;
  }, [matches]);

  const maxRound = Math.max(
    totalRounds || 0,
    currentRound || 0,
    ...Object.keys(roundsMap).map(Number),
    1,
  );
  const allRounds = Array.from({ length: maxRound }, (_, i) => i + 1);

  if (!open || !league) return null;

  const isCompleted = league.status === 'completed';

  return (
    <>
      <button
        type="button"
        className="pm-kampe-v2-sheet-backdrop pm-kampe-v2-sheet-backdrop--stacked"
        aria-label="Luk kampplan"
        onClick={onClose}
      />
      <div
        ref={sheetRef}
        className={`pm-kampe-v2-sheet pm-liga-v2-schedule-sheet${sheetClassName ? ` ${sheetClassName}` : ''}`}
        style={sheetStyle}
        role="dialog"
        aria-modal="true"
        aria-label={isCompleted ? 'Sæsonoversigt' : 'Kampplan og resultater'}
      >
        <div {...dragZoneProps} className="pm-kampe-v2-sheet-drag-header">
          <div className="pm-kampe-v2-sheet-handle" aria-hidden />
          <button type="button" className="pm-liga-v2-sheet-back" onClick={onClose}>
            <ChevronLeft size={16} aria-hidden />
            Tilbage
          </button>
          <div className="pm-liga-v2-schedule-head">
            <div className="pm-liga-v2-schedule-kicker">
              {isCompleted ? 'SÆSONOVERSIGT' : 'KAMPPLAN & RESULTATER'}
            </div>
            <h2 className="pm-liga-v2-schedule-title">{league.name}</h2>
          </div>
        </div>

        <div className="pm-liga-v2-schedule-body">
          {allRounds.map((rn) => {
            const roundMatches = roundsMap[rn] || [];
            const isCurrent = rn === currentRound;
            const isDone =
              roundMatches.length > 0 && roundMatches.every((m) => m.status === 'reported');
            const isFuture = rn > (currentRound || 0) && !isDone;

            const roundStatusLabel = isDone
              ? 'Afsluttet'
              : isCurrent
                ? 'I gang'
                : isFuture
                  ? 'Kommende'
                  : `Runde ${rn}`;

            return (
              <div key={rn} className="pm-liga-v2-round-section">
                <div className="pm-liga-v2-round-label">
                  <span className="pm-liga-v2-round-label-title">Runde {rn}</span>
                  <span
                    className={`pm-liga-v2-round-label-status${isDone ? ' pm-liga-v2-round-label-status--done' : isCurrent ? ' pm-liga-v2-round-label-status--live' : ''}`}
                  >
                    {roundStatusLabel}
                  </span>
                </div>

                {isFuture && roundMatches.length === 0 ? (
                  <div className="pm-liga-v2-round-future">
                    Genereres efter runde {rn - 1}
                  </div>
                ) : roundMatches.length === 0 ? (
                  <div className="pm-liga-v2-round-future">Ingen kampe</div>
                ) : (
                  roundMatches.map((match) => {
                    const t1 = teamMap[match.team1_id];
                    const t2 = match.team2_id ? teamMap[match.team2_id] : null;
                    const isMyMatch =
                      myTeam &&
                      (match.team1_id === myTeam?.id || match.team2_id === myTeam?.id);
                    const tag = matchResultTag(match, myTeam?.id);

                    const t1Name = t1
                      ? `${t1.player1_name || t1.name}${t1.player2_name ? ` & ${t1.player2_name}` : ''}`
                      : '—';
                    const t2Name = t2
                      ? `${t2.player1_name || t2.name}${t2.player2_name ? ` & ${t2.player2_name}` : ''}`
                      : null;

                    let scoreDetail = null;
                    if (match.status === 'reported' && match.score_text) {
                      scoreDetail = match.score_text;
                    }

                    return (
                      <div
                        key={match.id}
                        className={`pm-liga-v2-match-card${isMyMatch ? ' pm-liga-v2-match-card--mine' : ''}`}
                      >
                        <div className="pm-liga-v2-match-card-body">
                          <div className="pm-liga-v2-match-teams">
                            {t2Name ? (
                              <>
                                <span className="pm-liga-v2-match-team">{t1Name}</span>
                                <span className="pm-liga-v2-match-vs">vs</span>
                                <span className="pm-liga-v2-match-team">{t2Name}</span>
                              </>
                            ) : (
                              <span className="pm-liga-v2-match-team">{t1Name}</span>
                            )}
                          </div>
                          {scoreDetail ? (
                            <div className="pm-liga-v2-match-detail">{scoreDetail}</div>
                          ) : !match.team2_id ? null : (
                            <div className="pm-liga-v2-match-detail">Tid ikke aftalt endnu</div>
                          )}
                        </div>
                        <span
                          className="pm-liga-v2-match-tag"
                          style={{ color: tag.color, background: tag.bg, border: `1px solid ${tag.border}` }}
                        >
                          {tag.label}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            );
          })}

          <div className="pm-liga-v2-schedule-note">
            I aftaler selv tidspunktet for hver runde inden for rundens uge — brug holdchatten eller kontakt din modstander direkte.
          </div>
        </div>
      </div>
    </>
  );
}
