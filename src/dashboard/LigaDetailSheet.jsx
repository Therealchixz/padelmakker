import { MapPin, X } from 'lucide-react';
import { useBottomSheetDragToClose } from '../lib/useBottomSheetDragToClose';

function badgeToneClass(tone) {
  if (tone === 'live') return 'pm-kampe-v2-badge--live';
  if (tone === 'open') return 'pm-kampe-v2-badge--open';
  if (tone === 'full') return 'pm-kampe-v2-badge--full';
  if (tone === 'closed') return 'pm-kampe-v2-badge--closed';
  return 'pm-kampe-v2-badge--neutral';
}

export function LigaDetailSheet({
  open,
  onClose,
  league,
  regionLabel = '',
  teamCount = 0,
  totalRounds = null,
  badgeLabel = '',
  badgeTone = 'neutral',
  children,
  footer,
}) {
  const { sheetRef, dragZoneProps, sheetStyle, sheetClassName } = useBottomSheetDragToClose({
    onClose,
    enabled: open,
  });

  if (!open || !league) return null;

  const isRegistration = league.status === 'registration';
  const rounds = totalRounds || league.total_rounds;

  return (
    <>
      <button type="button" className="pm-kampe-v2-sheet-backdrop" aria-label="Luk liga detaljer" onClick={onClose} />
      <div
        ref={sheetRef}
        className={`pm-kampe-v2-sheet pm-liga-v2-detail-sheet${sheetClassName ? ` ${sheetClassName}` : ''}`}
        style={sheetStyle}
        role="dialog"
        aria-modal="true"
        aria-label={league.name}
      >
        <div {...dragZoneProps} className="pm-kampe-v2-sheet-drag-header">
          <div className="pm-kampe-v2-sheet-handle" aria-hidden />
          <div className="pm-liga-v2-detail-head">
            <div className="pm-liga-v2-detail-head-main">
              <div className="pm-liga-v2-detail-type">Liga · Swiss</div>
              <h2 className="pm-liga-v2-detail-title">{league.name}</h2>
              <div className="pm-liga-v2-detail-meta">
                <MapPin size={12} aria-hidden />
                {regionLabel || 'Danmark'}
                {' · '}
                {isRegistration ? `${league.max_teams || teamCount} hold max` : `${teamCount} hold`}
                {rounds ? ` · ${rounds} runder` : ''}
              </div>
            </div>
            <div className="pm-liga-v2-detail-head-right">
              {badgeLabel ? (
                <span className={`pm-kampe-v2-badge ${badgeToneClass(badgeTone)}`}>
                  {badgeTone === 'live' ? <span className="pm-live-dot" aria-hidden /> : null}
                  {badgeLabel}
                </span>
              ) : null}
              <button
                type="button"
                className="pm-kampe-v2-detail-close"
                onClick={onClose}
                onPointerDown={(event) => event.stopPropagation()}
                aria-label="Luk"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        </div>
        <div className="pm-liga-v2-detail-body">{children}</div>
        {footer ? <div className="pm-liga-v2-detail-footer">{footer}</div> : null}
      </div>
    </>
  );
}

export function LigaStandingsTable({ standings, myTeamId, limit = null }) {
  const rows = limit ? standings.slice(0, limit) : standings;
  return (
    <div className="pm-liga-v2-standings">
      <div className="pm-liga-v2-standings-head">
        <span>#</span>
        <span>Hold</span>
        <span>W-L</span>
        <span>Diff</span>
        <span>Pt</span>
      </div>
      {rows.map((t, index) => {
        const isMine = t.id === myTeamId;
        const diffColor = t.gameDiff > 0 ? 'var(--pm-green)' : t.gameDiff < 0 ? 'var(--pm-red)' : 'var(--pm-text-mid)';
        return (
          <div key={t.id} className={`pm-liga-v2-standings-row${isMine ? ' pm-liga-v2-standings-row--mine' : ''}`}>
            <span className={`pm-liga-v2-standings-rank${index === 0 ? ' pm-liga-v2-standings-rank--first' : ''}`}>{index + 1}</span>
            <span className="pm-liga-v2-standings-name">
              {t.name}
              {isMine ? <span className="pm-liga-v2-standings-you"> · dig</span> : null}
            </span>
            <span>{t.wins}-{t.losses}</span>
            <span style={{ color: diffColor }}>{t.gameDiff > 0 ? '+' : ''}{t.gameDiff}</span>
            <span className="pm-liga-v2-standings-pts">{t.points}</span>
          </div>
        );
      })}
    </div>
  );
}
