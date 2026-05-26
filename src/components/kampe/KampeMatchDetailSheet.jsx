import { MapPin, X } from 'lucide-react';
import { formatMatchDateHeadlineDa, matchTimeLabel } from '../../lib/matchDisplayUtils';
import { getKampeDetailStatusBadge } from '../../lib/kampeListCardStatus';
import { btn } from '../../lib/platformTheme';
import { useBottomSheetDragToClose } from '../../lib/useBottomSheetDragToClose';
import { MatchCourtView } from './MatchCourtView';

function badgeToneClass(tone) {
  if (tone === 'live') return 'pm-kampe-v2-badge--live';
  if (tone === 'open') return 'pm-kampe-v2-badge--open';
  if (tone === 'full') return 'pm-kampe-v2-badge--full';
  if (tone === 'closed') return 'pm-kampe-v2-badge--closed';
  if (tone === 'green') return 'pm-kampe-v2-badge--green';
  return 'pm-kampe-v2-badge--neutral';
}

export function KampeMatchDetailSheet({
  open,
  onClose,
  match,
  profilesById = {},
  matchPrefs,
  statusLabel,
  status,
  isClosed = false,
  left = 0,
  isFull = false,
  teamStats,
  winnerTeam,
  description,
  primaryAction,
  joinRequestsPanel = null,
  managePanel = null,
  unreadCount = 0,
  joined = false,
  myTeam = null,
  matchId = null,
  busyId = null,
  isCreator = false,
  isAdmin = false,
  currentUserId = null,
  onSwitchTeam,
  onSwitchPlayerTeam,
  onKickPlayer,
  onProfileClick,
}) {
  const { dragZoneProps, sheetStyle, sheetClassName } = useBottomSheetDragToClose({
    onClose,
    enabled: open,
  });

  if (!open || !match) return null;

  const venue =
    matchPrefs?.booked === false && !String(match.court_name || '').trim()
      ? 'Bane ikke booket endnu'
      : (match.court_name || 'Padelbane');
  const statusBadge = getKampeDetailStatusBadge({
    status,
    isClosed,
    left,
    isFull,
    statusLabel,
    winnerTeam,
  });

  return (
    <>
      <button
        type="button"
        className="pm-kampe-v2-sheet-backdrop"
        aria-label="Luk kampdetaljer"
        onClick={onClose}
      />
      <div
        className={`pm-kampe-v2-sheet pm-kampe-v2-detail-sheet${sheetClassName ? ` ${sheetClassName}` : ''}`}
        style={sheetStyle}
        role="dialog"
        aria-modal="true"
        aria-label="Kampdetaljer"
      >
        <div {...dragZoneProps}>
          <div className="pm-kampe-v2-sheet-handle" />
        </div>
        <div className="pm-kampe-v2-detail-head">
          <div className="pm-kampe-v2-detail-head-main">
            <div className="pm-kampe-v2-detail-venue">{venue}</div>
            <div className="pm-kampe-v2-detail-datetime pm-kampe-v2-detail-datetime--primary">
              {formatMatchDateHeadlineDa(match.date)} · {matchTimeLabel(match)}
            </div>
            <div className="pm-kampe-v2-detail-location">
              <MapPin size={12} aria-hidden />
              {venue}
            </div>
          </div>
          <button type="button" className="pm-kampe-v2-detail-close" onClick={onClose} aria-label="Luk">
            <X size={18} />
          </button>
        </div>

        <div className="pm-kampe-v2-detail-badges">
          <span className={`pm-kampe-v2-badge ${badgeToneClass(statusBadge.tone)}`}>
            {statusBadge.tone === 'live' ? <span className="pm-live-dot" /> : null}
            {statusBadge.label}
          </span>
          {matchPrefs?.min != null && matchPrefs?.max != null ? (
            <span className="pm-kampe-v2-badge pm-kampe-v2-badge--blue">
              ELO {matchPrefs.min}–{matchPrefs.max}
            </span>
          ) : null}
          {matchPrefs?.booked != null ? (
            <span className={`pm-kampe-v2-badge ${matchPrefs.booked ? 'pm-kampe-v2-badge--green' : 'pm-kampe-v2-badge--warm'}`}>
              {matchPrefs.booked ? 'Bane booket' : 'Bane ikke booket'}
            </span>
          ) : null}
          {unreadCount > 0 ? (
            <span className="pm-kampe-v2-badge pm-kampe-v2-badge--warm">{unreadCount} ulæst</span>
          ) : null}
        </div>

        {description ? (
          <p className="pm-kampe-v2-detail-desc">{description}</p>
        ) : null}

        <MatchCourtView
          teamStats={teamStats}
          status={status}
          winnerTeam={winnerTeam}
          profilesById={profilesById}
          readOnly={false}
          joined={joined}
          myTeam={myTeam}
          matchId={matchId}
          busyId={busyId}
          isCreator={isCreator}
          isAdmin={isAdmin}
          currentUserId={currentUserId}
          onSwitchTeam={onSwitchTeam}
          onSwitchPlayerTeam={onSwitchPlayerTeam}
          onKickPlayer={onKickPlayer}
          onProfileClick={onProfileClick}
        />

        {joinRequestsPanel}

        {primaryAction ? (
          <button
            type="button"
            className="pm-kampe-v2-detail-primary"
            style={btn(primaryAction.variant !== 'secondary', { size: 'md', fontWeight: 600 })}
            onClick={primaryAction.onClick}
            disabled={primaryAction.disabled}
          >
            {primaryAction.label}
          </button>
        ) : null}

        {managePanel ? (
          <div className="pm-kampe-v2-detail-manage">{managePanel}</div>
        ) : null}
      </div>
    </>
  );
}
