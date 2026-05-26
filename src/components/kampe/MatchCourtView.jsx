import { Plus } from 'lucide-react';
import { AvatarCircle } from '../AvatarCircle';
import { theme } from '../../lib/platformTheme';

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
}) {
  const t1 = teamStats?.t1 || [];
  const t2 = teamStats?.t2 || [];
  const t1Avg = teamStats?.t1Avg;
  const t2Avg = teamStats?.t2Avg;
  const playerElo = (p) => teamStats?.playerEloByUserId?.[String(p.user_id)] ?? 1000;

  const renderPlayer = (p, teamNum) => {
    const canKick =
      !readOnly &&
      (isCreator || isAdmin) &&
      String(p.user_id) !== String(currentUserId) &&
      (status === 'open' || status === 'full');
    const kickingBusy = busyId === matchId + '-kick-' + p.user_id;
    const teamColor = teamNum === 1 ? theme.accent : theme.blue;
    const teamBg = teamNum === 1 ? theme.accentBg : theme.blueBg;

    return (
      <div
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          minWidth: '42px',
        }}
      >
        <button
          type="button"
          onClick={() => {
            const prof = profilesById[String(p.user_id)];
            if (prof && onProfileClick) onProfileClick(prof);
          }}
          aria-label={`Åbn profil for ${p.user_name || 'spiller'}`}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            cursor: onProfileClick ? 'pointer' : 'default',
            border: 'none',
            background: 'transparent',
            padding: 0,
          }}
        >
          <AvatarCircle
            clickable={Boolean(onProfileClick)}
            avatar={profilesById[String(p.user_id)]?.avatar || p.user_emoji || '🎾'}
            size={36}
            emojiSize="16px"
            style={{ background: teamBg, border: `1.5px solid ${teamColor}55` }}
          />
          <span style={{ fontSize: '9px', color: theme.text, marginTop: '3px', fontWeight: 600 }}>
            {(p.user_name || '?').split(' ')[0]}
          </span>
          <span style={{ fontSize: '8px', color: teamColor, fontWeight: 700 }}>{playerElo(p)}</span>
        </button>
        {canKick && onKickPlayer ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onKickPlayer(matchId, p.user_id, p.user_name);
            }}
            disabled={kickingBusy}
            aria-label={`Fjern ${p.user_name || 'spiller'} fra kampen`}
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
              width: 16,
              height: 16,
              borderRadius: '50%',
              border: 'none',
              background: theme.red,
              color: theme.onAccent,
              fontSize: 10,
              fontWeight: 700,
              cursor: kickingBusy ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              lineHeight: 1,
              zIndex: 1,
            }}
          >
            ×
          </button>
        ) : null}
      </div>
    );
  };

  const renderEmptySlot = (teamNum) => {
    const otherTeam = teamNum === 1 ? 2 : 1;
    const canSwitch =
      !readOnly &&
      joined &&
      myTeam === otherTeam &&
      (status === 'open' || status === 'full') &&
      busyId !== matchId + '-switch';
    const teamColor = teamNum === 1 ? theme.accent : theme.blue;
    const teamBg = teamNum === 1 ? theme.accentBg : theme.blueBg;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '42px' }}>
        <button
          type="button"
          onClick={canSwitch && onSwitchTeam ? () => onSwitchTeam(matchId, teamNum) : undefined}
          disabled={!canSwitch}
          aria-label={canSwitch ? `Skift til Hold ${teamNum}` : `Ledig plads på Hold ${teamNum}`}
          title={canSwitch ? `Skift til Hold ${teamNum}` : undefined}
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            border: `1.5px dashed ${teamColor}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: canSwitch ? 'pointer' : 'default',
            background: teamBg,
            transition: 'all 0.15s',
            padding: 0,
            opacity: canSwitch ? 1 : 0.8,
          }}
        >
          <Plus size={12} color={teamColor} />
        </button>
        <span style={{ fontSize: '8px', color: teamColor, fontWeight: 700, marginTop: '3px' }}>
          {canSwitch ? 'Skift' : 'Ledig'}
        </span>
      </div>
    );
  };

  const showTopTeamLabels =
    t1Avg !== null &&
    t2Avg !== null &&
    (status === 'open' || status === 'full' || status === 'in_progress' || status === 'completed');

  return (
    <div className="pm-court-wrap pm-kampe-v2-court-wrap">
      {showTopTeamLabels ? (
        <div className="pm-court-header">
          <div
            className={`pm-court-header-team pm-court-header-team--t1${
              winnerTeam === 1 ? ' pm-court-header-team--winner' : winnerTeam === 2 ? ' pm-court-header-team--loser' : ''
            }`}
          >
            <span className="pm-court-header-label">{winnerTeam === 1 ? '🏆 Hold 1' : 'Hold 1'}</span>
            {t1Avg !== null ? <span className="pm-court-header-elo">Gns. {t1Avg}</span> : null}
          </div>
          <div
            className={`pm-court-header-team pm-court-header-team--t2${
              winnerTeam === 2 ? ' pm-court-header-team--winner' : winnerTeam === 1 ? ' pm-court-header-team--loser' : ''
            }`}
          >
            <span className="pm-court-header-label">{winnerTeam === 2 ? '🏆 Hold 2' : 'Hold 2'}</span>
            {t2Avg !== null ? <span className="pm-court-header-elo">Gns. {t2Avg}</span> : null}
          </div>
        </div>
      ) : null}
      <div className="pm-court">
        <div className="pm-court-line pm-court-line--service-t1" />
        <div className="pm-court-line pm-court-line--service-t2" />
        <div className="pm-court-line pm-court-line--center-t1" />
        <div className="pm-court-line pm-court-line--center-t2" />
        <div className="pm-court-net" />
        <span className="pm-court-vs">vs</span>
        <div className="pm-court-grid">
          <div
            className={`pm-court-side pm-court-side--t1${
              winnerTeam === 1 ? ' pm-court-side--winner' : winnerTeam === 2 ? ' pm-court-side--loser' : ''
            }`}
          >
            <div className="pm-court-player-slot pm-court-player-slot--top">
              {t1[0] ? renderPlayer(t1[0], 1) : renderEmptySlot(1)}
            </div>
            <div className="pm-court-player-slot pm-court-player-slot--bottom">
              {t1[1] ? renderPlayer(t1[1], 1) : renderEmptySlot(1)}
            </div>
          </div>
          <div
            className={`pm-court-side pm-court-side--t2${
              winnerTeam === 2 ? ' pm-court-side--winner' : winnerTeam === 1 ? ' pm-court-side--loser' : ''
            }`}
          >
            <div className="pm-court-player-slot pm-court-player-slot--top">
              {t2[0] ? renderPlayer(t2[0], 2) : renderEmptySlot(2)}
            </div>
            <div className="pm-court-player-slot pm-court-player-slot--bottom">
              {t2[1] ? renderPlayer(t2[1], 2) : renderEmptySlot(2)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
