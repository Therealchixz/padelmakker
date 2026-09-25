import { X } from 'lucide-react';
import { formatMatchDateHeadlineDa, matchTimeLabel } from '../../lib/matchDisplayUtils';
import { getKampeDetailStatusBadge } from '../../lib/kampeListCardStatus';
import { resolveMatchDirectionsQuery } from '../../lib/kampeListFilterCore';
import { btn } from '../../lib/platformTheme';
import { formatMatchLevelRangeLabel } from '../../lib/padelLevelUtils';
import { useBottomSheetDragToClose } from '../../lib/useBottomSheetDragToClose';
import { MatchResultStrip } from '../MatchResultStrip';
import { MatchCompletedDetail } from './MatchCompletedDetail';
import { MatchCourtView } from './MatchCourtView';
import { EventDetailHero } from './EventDetailHero';
import { KampeCreateHeader } from './KampeRedesignToolbar';
import '../../styles/kampdetalje.css';

export function KampeMatchDetailSheet({
  open,
  onClose,
  presentation = 'sheet',
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
  onClaimCourtSide,
  onSetCourtSide,
  onKickPlayer,
  onProfileClick,
}) {
  const isPage = presentation === 'page';
  const { sheetRef, dragZoneProps, sheetStyle, sheetClassName } = useBottomSheetDragToClose({
    onClose,
    enabled: open && !isPage,
  });

  if (!open || !match) return null;

  // En spillet kamp skal ikke stå med "Bane ikke booket".
  const isFinished = status === 'completed' || winnerTeam != null;
  const venue =
    !isFinished && matchPrefs?.booked === false && !String(match.court_name || '').trim()
      ? 'Bane ikke booket endnu'
      : (match.court_name || 'Padelbane');
  const showBooked = matchPrefs?.booked != null && !isFinished;
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

  const detailBody = (
    <>
      <EventDetailHero
        typeLabel="2v2"
        levelLabel={
          matchPrefs?.min != null && matchPrefs?.max != null
            ? formatMatchLevelRangeLabel(matchPrefs.min, matchPrefs.max)
            : null
        }
        status={statusBadge}
        venue={venue}
        directionsQuery={directionsQuery}
        tags={[
          showBooked
            ? { label: matchPrefs.booked ? 'Bane booket' : 'Bane ikke booket', tone: matchPrefs.booked ? 'green' : 'amber' }
            : null,
          unreadCount > 0 ? { label: `${unreadCount} ulæst i chat`, tone: 'amber' } : null,
        ]}
        dateHeadline={formatMatchDateHeadlineDa(match.date)}
        timeLabel={matchTimeLabel(match)}
      />

      {description ? (
        <>
          <div className="pm-kd-section-h"><h3>Om kampen</h3></div>
          <p className="pm-kd-about">{description}</p>
        </>
      ) : null}

      {status === 'completed' && matchResult?.confirmed ? (
        <MatchCompletedDetail
          matchResult={matchResult}
          teamStats={teamStats}
          winnerTeam={winnerTeam}
          currentUserId={currentUserId}
          profilesById={profilesById}
        />
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
        onClaimCourtSide={onClaimCourtSide}
        onSetCourtSide={onSetCourtSide}
        onKickPlayer={onKickPlayer}
        onProfileClick={onProfileClick}
        creatorId={match.creator_id}
      />

      {status === 'completed' && matchResult && !matchResult.confirmed ? (
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
    </>
  );

  if (isPage) {
    return (
      <div className="pm-kampe-v2-detail-page pm-kampe-v2-detail-sheet">
        <KampeCreateHeader title="2v2-kamp" onBack={onClose} />
        <div className="pm-kampe-v2-detail-scroll">{detailBody}</div>
      </div>
    );
  }

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

        <div className="pm-kampe-v2-detail-scroll">{detailBody}</div>
      </div>
    </>
  );
}
