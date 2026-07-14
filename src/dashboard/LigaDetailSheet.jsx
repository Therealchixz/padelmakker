import { MapPin, X } from 'lucide-react';
import { useBottomSheetDragToClose } from '../lib/useBottomSheetDragToClose';
import { ligaTypeLabel } from '../lib/ligaDisplayUtils';
import { groupByDivision } from '../lib/ligaStandings';
import { KampeCreateHeader } from '../components/kampe/KampeRedesignToolbar';

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
  presentation = 'sheet',
  league,
  regionLabel = '',
  teamCount = 0,
  totalRounds = null,
  badgeLabel = '',
  badgeTone = 'neutral',
  children,
  footer,
}) {
  const isPage = presentation === 'page';
  const { sheetRef, dragZoneProps, sheetStyle, sheetClassName } = useBottomSheetDragToClose({
    onClose,
    enabled: open && !isPage,
  });

  if (!open || !league) return null;

  const isRegistration = league.status === 'registration';
  const rounds = totalRounds || league.total_rounds;

  const detailHead = (
    <div className={`pm-liga-v2-detail-head${isPage ? ' pm-liga-v2-detail-head--page' : ''}`}>
      <div className="pm-liga-v2-detail-head-main">
        <div className="pm-liga-v2-detail-type">{ligaTypeLabel(league)}</div>
        {!isPage ? <h2 className="pm-liga-v2-detail-title">{league.name}</h2> : null}
        <div className="pm-liga-v2-detail-meta">
          <MapPin size={12} aria-hidden />
          {regionLabel || 'Danmark'}
          {' · '}
          {isRegistration ? `${league.max_teams || teamCount} hold max` : `${teamCount} hold`}
          {rounds ? ` · ${rounds} runder` : ''}
        </div>
      </div>
      {!isPage ? (
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
      ) : badgeLabel ? (
        <div className="pm-liga-v2-detail-head-right pm-liga-v2-detail-head-right--page">
          <span className={`pm-kampe-v2-badge ${badgeToneClass(badgeTone)}`}>
            {badgeTone === 'live' ? <span className="pm-live-dot" aria-hidden /> : null}
            {badgeLabel}
          </span>
        </div>
      ) : null}
    </div>
  );

  if (isPage) {
    return (
      <div className="pm-kampe-v2-detail-page pm-liga-v2-detail-sheet">
        <KampeCreateHeader title={league.name} onBack={onClose} />
        {detailHead}
        <div className="pm-liga-v2-detail-body">{children}</div>
        {footer ? <div className="pm-liga-v2-detail-footer">{footer}</div> : null}
      </div>
    );
  }

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
          {detailHead}
        </div>
        <div className="pm-liga-v2-detail-body">{children}</div>
        {footer ? <div className="pm-liga-v2-detail-footer">{footer}</div> : null}
      </div>
    </>
  );
}

/**
 * Stilling grupperet pr. division. Ved 1 division vises blot én tabel; ved
 * flere vises en "Division N"-overskrift + tabel for hver (rang nulstilles
 * pr. division, som det forventes i en divisionsliga).
 */
export function LigaDivisionStandings({ standings, myTeamId, numDivisions = 1 }) {
  if ((Number(numDivisions) || 1) <= 1) {
    return <LigaStandingsTable standings={standings} myTeamId={myTeamId} />;
  }
  const groups = groupByDivision(standings);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {groups.map(([division, rows]) => (
        <div key={division}>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--pm-accent)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 8px' }}>
            Division {division}
          </div>
          <LigaStandingsTable standings={rows} myTeamId={myTeamId} />
        </div>
      ))}
    </div>
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
