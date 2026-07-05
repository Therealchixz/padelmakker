import { X, CalendarDays, MapPin, ArrowUpRight } from 'lucide-react';
import { formatMatchDateHeadlineDa, matchTimeLabel } from '../../lib/matchDisplayUtils';
import { getKampeDetailStatusBadge } from '../../lib/kampeListCardStatus';
import { resolveMatchDirectionsQuery } from '../../lib/kampeListFilterCore';
import { banerMapsDirectionsUrl } from '../../lib/banerMapLinks';
import { btn } from '../../lib/platformTheme';
import { useBottomSheetDragToClose } from '../../lib/useBottomSheetDragToClose';
import { MatchResultStrip } from '../MatchResultStrip';
import { MatchCourtView } from './MatchCourtView';
import '../../styles/kampdetalje.css';

function heroStatusChipClass(tone) {
  if (tone === 'live') return 'pm-kd-chip--live';
  return 'pm-kd-chip--light pm-kd-hero-status';
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
  matchResult = null,
  myEloChange = null,
  myTeam = null,
  description,
  primaryAction,
  joinRequestsPanel = null,
  managePanel = null,
  unreadCount = 0,
  joined = false,
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
  const { sheetRef, dragZoneProps, sheetStyle, sheetClassName } = useBottomSheetDragToClose({
    onClose,
    enabled: open,
  });

  if (!open || !match) return null;

  const venue =
    matchPrefs?.booked === false && !String(match.court_name || '').trim()
      ? 'Bane ikke booket endnu'
      : (match.court_name || 'Padelbane');
  const directionsQuery = resolveMatchDirectionsQuery(match, profilesById);
  const statusBadge = getKampeDetailStatusBadge({
    status,
    isClosed,
    left,
    isFull,
    statusLabel,
    winnerTeam,
    joined,
    myTeam,
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
        ref={sheetRef}
        className={`pm-kampe-v2-sheet pm-kampe-v2-detail-sheet${sheetClassName ? ` ${sheetClassName}` : ''}`}
        style={sheetStyle}
        role="dialog"
        aria-modal="true"
        aria-label="Kampdetaljer"
      >
        <div {...dragZoneProps} aria-label="Træk her for at lukke">
          <div className="pm-kampe-v2-sheet-handle" aria-hidden />
          <div className="pm-kampe-v2-detail-head pm-kampe-v2-detail-head--hero">
            <div className="pm-kampe-v2-detail-head-toolbar">
              <div className="pm-kampe-v2-detail-type">2v2-kamp</div>
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

        <div className="pm-kampe-v2-detail-scroll">
        <div className="pm-kd-hero">
          <div className="pm-kd-hero-badges">
            <span className="pm-kd-chip pm-kd-chip--light">2V2</span>
            {matchPrefs?.min != null && matchPrefs?.max != null ? (
              <span className="pm-kd-chip pm-kd-chip--amber">
                ELO {matchPrefs.min}–{matchPrefs.max}
              </span>
            ) : null}
            <span className={`pm-kd-chip ${heroStatusChipClass(statusBadge.tone)}`}>
              {statusBadge.tone === 'live' ? <span className="pm-live-dot" /> : null}
              {statusBadge.label}
            </span>
          </div>
          <div className="pm-kd-hero-court" aria-hidden />
        </div>

        <div className="pm-kd-card pm-kd-price-card">
          <h2 className="pm-kd-title">{venue}</h2>
          {matchPrefs?.booked != null || unreadCount > 0 ? (
            <div className="pm-kd-price-meta">
              {matchPrefs?.booked != null ? (
                <span className={`pm-kd-tag ${matchPrefs.booked ? 'pm-kd-tag--green' : 'pm-kd-tag--amber'}`}>
                  {matchPrefs.booked ? 'Bane booket' : 'Bane ikke booket'}
                </span>
              ) : null}
              {unreadCount > 0 ? (
                <span className="pm-kd-tag pm-kd-tag--amber">{unreadCount} ulæst i chat</span>
              ) : null}
            </div>
          ) : null}
          <div className="pm-kd-info-row">
            <div className="pm-kd-info-ic"><CalendarDays size={18} aria-hidden /></div>
            <div>
              <b>{formatMatchDateHeadlineDa(match.date)}</b>
              <span className="pm-kd-info-sub">{matchTimeLabel(match)}</span>
            </div>
          </div>
          <div className="pm-kd-info-row">
            <div className="pm-kd-info-ic"><MapPin size={18} aria-hidden /></div>
            <div>
              <b>{venue}</b>
              {directionsQuery ? (
                <a
                  className="pm-kd-maplink"
                  href={banerMapsDirectionsUrl(directionsQuery)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(event) => event.stopPropagation()}
                >
                  Vis på kort <ArrowUpRight size={11} aria-hidden />
                </a>
              ) : null}
            </div>
          </div>
        </div>

        {description ? (
          <>
            <div className="pm-kd-section-h"><h3>Om kampen</h3></div>
            <p className="pm-kd-about">{description}</p>
          </>
        ) : null}

        <MatchCourtView
          teamStats={teamStats}
          status={status}
          winnerTeam={winnerTeam}
          profilesById={profilesById}
          readOnly={status === 'completed'}
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

        {status === 'completed' && matchResult ? (
          <MatchResultStrip
            matchResult={matchResult}
            myTeam={
              myTeam === 1 ? 'team1' : myTeam === 2 ? 'team2' : null
            }
            eloChange={myEloChange}
          />
        ) : null}

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
      </div>
    </>
  );
}
