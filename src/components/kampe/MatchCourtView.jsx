import { Plus, UserPlus } from 'lucide-react';
import { AvatarCircle } from '../AvatarCircle';
import { formatPlaytomicLevel } from '../../lib/padelLevelUtils';
import {
  getMatchCourtHeaderLabel,
  getMatchCourtOutcomeClasses,
} from '../../lib/matchCourtOutcomeClasses';
import {
  courtSideLabel,
  oppositeCourtSide,
  playerFirstName,
  teamSlotsBySide,
} from '../../lib/matchPlayerCourtSide';

const SLOTS_PER_TEAM = 2;

export function MatchCourtView({
  teamStats,
  status,
  winnerTeam = null,
  profilesById = {},
  readOnly = false,
  joined = false,
  myTeam = null,
  matchId = null,
  busyId = null,
  isCreator = false,
  isAdmin = false,
  currentUserId = null,
  onProfileClick,
  onKickPlayer,
  onSwitchTeam,
  onSwitchPlayerTeam,
  onClaimCourtSide,
  onSetCourtSide,
  creatorId = null,
}) {
  const t1 = teamStats?.t1 || [];
  const t2 = teamStats?.t2 || [];
  const filledCount = t1.length + t2.length;
  const left = Math.max(0, 4 - filledCount);
  const showEloChanges = status === 'completed';
  const outcomeCtx = { status, winnerTeam, joined, myTeam };
  const t1Outcome = getMatchCourtOutcomeClasses(1, outcomeCtx);
  const t2Outcome = getMatchCourtOutcomeClasses(2, outcomeCtx);
  const sidesEditable = !readOnly && (status === 'open' || status === 'full' || status === 'in_progress');

  const playerElo = (p) => teamStats?.playerEloByUserId?.[String(p.user_id)] ?? 1000;
  const playerEloChange = (p) => teamStats?.playerEloChangeByUserId?.[String(p.user_id)];

  const renderPlayerSlot = (player, teamNum, side) => {
    const prof = profilesById[String(player.user_id)];
    const levelLabel =
      prof?.level != null && prof.level !== ''
        ? formatPlaytomicLevel(prof.level)
        : null;
    const otherTeam = teamNum === 1 ? 2 : 1;
    const canKick =
      !readOnly &&
      (isCreator || isAdmin) &&
      String(player.user_id) !== String(currentUserId) &&
      (status === 'open' || status === 'full');
    const kickingBusy = busyId === matchId + '-kick-' + player.user_id;
    const otherTeamPlayerCount = otherTeam === 1 ? t1.length : t2.length;
    const canSwitchPlayer =
      !readOnly &&
      Boolean(onSwitchPlayerTeam) &&
      (isCreator || isAdmin) &&
      (status === 'open' || status === 'full') &&
      otherTeamPlayerCount < SLOTS_PER_TEAM &&
      !String(busyId || '').startsWith(String(matchId) + '-switch-player-' + player.user_id);
    const canChangeSide =
      sidesEditable &&
      Boolean(onSetCourtSide) &&
      (isCreator || isAdmin || String(player.user_id) === String(currentUserId)) &&
      busyId !== matchId + '-side';

    const delta = playerEloChange(player);
    const sideText = courtSideLabel(side);
    const isCreatorPlayer = creatorId != null && String(player.user_id) === String(creatorId);

    return (
      <div className="pm-kd-court-slot">
        {canSwitchPlayer ? (
          <button
            type="button"
            className="pm-kd-court-slot-action"
            onClick={() => onSwitchPlayerTeam(matchId, player.user_id, otherTeam)}
            aria-label={`Flyt ${player.user_name || 'spiller'} til Hold ${otherTeam}`}
          >
            ⇄
          </button>
        ) : null}
        {canKick && onKickPlayer ? (
          <button
            type="button"
            className="pm-kd-court-slot-action pm-kd-court-slot-action--danger"
            onClick={() => onKickPlayer(matchId, player.user_id, player.user_name)}
            disabled={kickingBusy}
            aria-label={`Fjern ${player.user_name || 'spiller'} fra kampen`}
          >
            ×
          </button>
        ) : null}
        <button
          type="button"
          className="pm-kd-court-slot-avatar-btn"
          onClick={() => {
            if (prof && onProfileClick) onProfileClick(prof);
          }}
          aria-label={`Åbn profil for ${player.user_name || 'spiller'}`}
        >
          <AvatarCircle
            clickable={Boolean(prof && onProfileClick)}
            avatar={prof?.avatar || player.user_emoji || '🎾'}
            size={38}
            emojiSize="16px"
          />
        </button>
        <button
          type="button"
          className="pm-kd-court-slot-name"
          onClick={() => {
            if (prof && onProfileClick) onProfileClick(prof);
          }}
        >
          {playerFirstName(player)}
          {isCreatorPlayer ? <span className="pm-kd-court-slot-star" aria-label="Opretter">★</span> : null}
        </button>
        <span className="pm-kd-court-slot-meta">
          {showEloChanges && delta != null
            ? `ELO ${delta >= 0 ? '+' : ''}${delta}`
            : levelLabel
              ? `Niveau ${levelLabel}`
              : `ELO ${playerElo(player)}`}
        </span>
        {canChangeSide ? (
          <button
            type="button"
            className="pm-kd-court-slot-side pm-kd-court-slot-side--btn"
            onClick={() => onSetCourtSide(matchId, player.user_id, oppositeCourtSide(side))}
            aria-label={`Skift til ${courtSideLabel(oppositeCourtSide(side)).toLowerCase()} side`}
          >
            {sideText}
          </button>
        ) : (
          <span className="pm-kd-court-slot-side">{sideText}</span>
        )}
      </div>
    );
  };

  const renderEmptySlot = (teamNum, side) => {
    const otherTeam = teamNum === 1 ? 2 : 1;
    const canSwitchTeam =
      sidesEditable &&
      joined &&
      myTeam === otherTeam &&
      (status === 'open' || status === 'full') &&
      busyId !== matchId + '-switch';
    const canClaimSide =
      sidesEditable &&
      joined &&
      myTeam === teamNum &&
      Boolean(onClaimCourtSide) &&
      busyId !== matchId + '-side';
    const clickable = canSwitchTeam || canClaimSide;
    const onClick = () => {
      if (canClaimSide) onClaimCourtSide(matchId, teamNum, side);
      else if (canSwitchTeam && onSwitchTeam) onSwitchTeam(matchId, teamNum, side);
    };

    const inner = (
      <>
        <div className="pm-kd-court-ghost">
          {clickable ? <Plus size={16} aria-hidden /> : <UserPlus size={16} aria-hidden />}
        </div>
        <b>Ledig plads</b>
        <span className="pm-kd-court-slot-side">{courtSideLabel(side)}</span>
        <span className="pm-kd-court-empty-sub">{clickable ? 'SKIFT HIT' : 'ÅBEN'}</span>
      </>
    );

    if (clickable) {
      return (
        <button
          type="button"
          className="pm-kd-court-slot pm-kd-court-slot--empty pm-kd-court-slot--clickable"
          onClick={onClick}
          aria-label={
            canClaimSide
              ? `Skift til ${courtSideLabel(side).toLowerCase()} side`
              : `Skift til Hold ${teamNum}`
          }
        >
          {inner}
        </button>
      );
    }

    return (
      <div className="pm-kd-court-slot pm-kd-court-slot--empty" aria-label={`Ledig plads på Hold ${teamNum}`}>
        {inner}
      </div>
    );
  };

  const renderHalf = (teamNum, players, outcome) => {
    const slots = teamSlotsBySide(players);
    return (
      <div className={`pm-court-side pm-court-side--t${teamNum}${outcome.side}`}>
        {slots.map(({ side, player }) => (
          <div
            key={`t${teamNum}-${side}`}
            className={`pm-court-player-slot pm-court-player-slot--${side === 'left' ? 'top' : 'bottom'}`}
          >
            {player ? renderPlayerSlot(player, teamNum, side) : renderEmptySlot(teamNum, side)}
          </div>
        ))}
      </div>
    );
  };

  const renderTeamHeader = (teamNum, outcome) => {
    const teamAvg = teamNum === 1 ? teamStats?.t1Avg : teamStats?.t2Avg;
    return (
      <div className={`pm-court-header-team pm-court-header-team--t${teamNum}${outcome.header}`}>
        <span className="pm-court-header-label">
          {getMatchCourtHeaderLabel(teamNum, outcomeCtx)}
        </span>
        {teamAvg != null ? <span className="pm-court-header-elo">Gns. {teamAvg}</span> : null}
      </div>
    );
  };

  return (
    <div className="pm-court-wrap pm-kampe-v2-court-wrap">
      <div className="pm-kd-section-h">
        <h3>{showEloChanges ? 'Deltagere' : `Holdene (${filledCount}/4)`}</h3>
        {left > 0 && status !== 'completed' && status !== 'in_progress' ? (
          <span className="pm-kd-tag pm-kd-tag--amber">
            {left} {left === 1 ? 'plads' : 'pladser'} tilbage
          </span>
        ) : null}
      </div>
      <div className="pm-court-header">
        {renderTeamHeader(1, t1Outcome)}
        {renderTeamHeader(2, t2Outcome)}
      </div>
      <div className="pm-court pm-court--detail">
        <div className="pm-court-line pm-court-line--service-t1" />
        <div className="pm-court-line pm-court-line--service-t2" />
        <div className="pm-court-line pm-court-line--center-t1" />
        <div className="pm-court-line pm-court-line--center-t2" />
        <div className="pm-court-net" />
        <span className="pm-court-vs">vs</span>
        <div className="pm-court-grid">
          {renderHalf(1, t1, t1Outcome)}
          {renderHalf(2, t2, t2Outcome)}
        </div>
      </div>
    </div>
  );
}
