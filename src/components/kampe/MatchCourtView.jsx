import { Plus, UserPlus } from 'lucide-react';
import { AvatarCircle } from '../AvatarCircle';
import { formatPlaytomicLevel } from '../../lib/padelLevelUtils';
import {
  getMatchCourtHeaderLabel,
} from '../../lib/matchCourtOutcomeClasses';

const SLOTS_PER_TEAM = 2;

function teamSlots(players) {
  const filled = (players || []).slice(0, SLOTS_PER_TEAM);
  return Array.from({ length: SLOTS_PER_TEAM }, (_, i) => filled[i] ?? null);
}

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
}) {
  const t1 = teamStats?.t1 || [];
  const t2 = teamStats?.t2 || [];
  const filledCount = t1.length + t2.length;
  const left = Math.max(0, 4 - filledCount);
  const showEloChanges = status === 'completed';
  const outcomeCtx = { status, winnerTeam, joined, myTeam };

  const playerElo = (p) => teamStats?.playerEloByUserId?.[String(p.user_id)] ?? 1000;
  const playerEloChange = (p) => teamStats?.playerEloChangeByUserId?.[String(p.user_id)];

  const renderPlayerSlot = (player, teamNum) => {
    const prof = profilesById[String(player.user_id)];
    const levelLabel =
      prof?.level != null && prof.level !== ''
        ? formatPlaytomicLevel(prof.level)
        : null;
    const games = Number(prof?.games_played) || 0;
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

    const delta = playerEloChange(player);
    const newElo = delta != null ? playerElo(player) + delta : null;

    return (
      <div key={player.user_id || `t${teamNum}-${player.user_name}`} className="pm-kd-slot">
        <button
          type="button"
          className="pm-kd-slot-main"
          onClick={() => {
            if (canSwitchPlayer) {
              onSwitchPlayerTeam(matchId, player.user_id, otherTeam);
              return;
            }
            if (prof && onProfileClick) onProfileClick(prof);
          }}
          aria-label={
            canSwitchPlayer
              ? `Flyt ${player.user_name || 'spiller'} til Hold ${otherTeam}`
              : `Åbn profil for ${player.user_name || 'spiller'}`
          }
        >
          <AvatarCircle
            avatar={prof?.avatar || player.user_emoji || '🎾'}
            size={43}
            emojiSize="18px"
          />
          <div className="pm-kd-slot-copy">
            <div className="pm-kd-slot-name">{player.user_name || 'Spiller'}</div>
            <div className="pm-kd-slot-meta">
              {showEloChanges && delta != null ? (
                <span className="pm-kd-lvl-badge">
                  ELO {playerElo(player)}
                  {levelLabel ? ` · Niveau ${levelLabel}` : ''}
                </span>
              ) : (
                <span className="pm-kd-lvl-badge">
                  ELO {playerElo(player)}
                  {levelLabel ? ` · Niveau ${levelLabel}` : ''}
                </span>
              )}
              {!showEloChanges && games > 0 ? (
                <span className="pm-kd-slot-kampe">{games} kampe</span>
              ) : null}
            </div>
          </div>
        </button>
        {showEloChanges && newElo != null && delta != null ? (
          <div className="pm-kd-slot-elo-end">
            <span className="pm-kd-eyebrow">Ny ELO</span>
            <span className="pm-kd-slot-new-elo">
              {newElo}
              <small className={delta >= 0 ? 'pm-kd-delta--up' : 'pm-kd-delta--down'}>
                ({delta >= 0 ? '+' : ''}
                {delta})
              </small>
            </span>
          </div>
        ) : null}
        {canSwitchPlayer ? (
          <button
            type="button"
            className="pm-kd-slot-action"
            onClick={() => onSwitchPlayerTeam(matchId, player.user_id, otherTeam)}
            aria-label={`Flyt ${player.user_name || 'spiller'} til Hold ${otherTeam}`}
          >
            ⇄
          </button>
        ) : null}
        {canKick && onKickPlayer ? (
          <button
            type="button"
            className="pm-kd-slot-action pm-kd-slot-action--danger"
            onClick={() => onKickPlayer(matchId, player.user_id, player.user_name)}
            disabled={kickingBusy}
            aria-label={`Fjern ${player.user_name || 'spiller'} fra kampen`}
          >
            ×
          </button>
        ) : null}
      </div>
    );
  };

  const renderEmptySlot = (teamNum, slotIndex) => {
    const otherTeam = teamNum === 1 ? 2 : 1;
    const canSwitch =
      !readOnly &&
      joined &&
      myTeam === otherTeam &&
      (status === 'open' || status === 'full') &&
      busyId !== matchId + '-switch';

    return (
      <button
        key={`empty-t${teamNum}-${slotIndex}`}
        type="button"
        className={`pm-kd-slot pm-kd-slot--empty${canSwitch ? ' pm-kd-slot--clickable' : ''}`}
        onClick={canSwitch && onSwitchTeam ? () => onSwitchTeam(matchId, teamNum) : undefined}
        disabled={!canSwitch}
        aria-label={canSwitch ? `Skift til Hold ${teamNum}` : `Ledig plads på Hold ${teamNum}`}
      >
        <div className="pm-kd-ghost">
          {canSwitch ? <Plus size={16} aria-hidden /> : <UserPlus size={16} aria-hidden />}
        </div>
        <div>
          <b>Ledig plads</b>
          <span className="pm-kd-empty-sub">{canSwitch ? 'SKIFT HIT' : 'BLIV DEN NÆSTE!'}</span>
        </div>
      </button>
    );
  };

  const renderTeam = (teamNum, players) => {
    const headerLabel = getMatchCourtHeaderLabel(teamNum, outcomeCtx);
    const teamAvg = teamNum === 1 ? teamStats?.t1Avg : teamStats?.t2Avg;
    const slots = teamSlots(players);

    return (
      <div key={`team-${teamNum}`}>
        <div className="pm-kd-team-label">
          {headerLabel}
          {teamAvg != null ? ` · Gns. ${teamAvg}` : ''}
        </div>
        {slots.map((player, idx) =>
          player ? renderPlayerSlot(player, teamNum) : renderEmptySlot(teamNum, idx)
        )}
      </div>
    );
  };

  return (
    <div className="pm-kampe-v2-court-wrap">
      <div className="pm-kd-section-h">
        <h3>{showEloChanges ? 'Deltagere' : `Holdene (${filledCount}/4)`}</h3>
        {left > 0 && status !== 'completed' && status !== 'in_progress' ? (
          <span className="pm-kd-tag pm-kd-tag--amber">
            {left} {left === 1 ? 'plads' : 'pladser'} tilbage
          </span>
        ) : null}
      </div>
      {renderTeam(1, t1)}
      {renderTeam(2, t2)}
    </div>
  );
}
