import { ChevronLeft } from 'lucide-react';
import { AvatarCircle } from '../components/AvatarCircle';
import { useBottomSheetDragToClose } from '../lib/useBottomSheetDragToClose';
import { LigaTeamChatPanel } from './LigaTeamChatPanel';

function computeStreak(matches, teamId) {
  const teamMatches = matches
    .filter((m) => m.status === 'reported' && m.winner_id && (m.team1_id === teamId || m.team2_id === teamId))
    .sort((a, b) => (a.round_number || 0) - (b.round_number || 0));
  if (teamMatches.length === 0) return null;
  let streak = 0;
  let kind = null;
  for (let i = teamMatches.length - 1; i >= 0; i--) {
    const won = teamMatches[i].winner_id === teamId;
    const current = won ? 'W' : 'L';
    if (kind == null) {
      kind = current;
      streak = 1;
    } else if (current === kind) {
      streak++;
    } else {
      break;
    }
  }
  return kind ? `${kind}${streak}` : null;
}

export function LigaTeamProfileSheet({
  open,
  onClose,
  team,
  leagueId = null,
  matches = [],
  onPlayerClick,
  userId = null,
  userName = 'Spiller',
  userAvatar = null,
  canWriteTeamChat = false,
  showToast,
}) {
  const { sheetRef, dragZoneProps, sheetStyle, sheetClassName } = useBottomSheetDragToClose({
    onClose,
    enabled: open,
  });

  if (!open || !team) return null;

  const wins = matches.filter((m) => m.status === 'reported' && m.winner_id === team.id).length;
  const losses = matches.filter((m) => {
    if (m.status !== 'reported' || !m.winner_id) return false;
    return (m.team1_id === team.id || m.team2_id === team.id) && m.winner_id !== team.id;
  }).length;
  const winRate = wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : 0;
  const streak = computeStreak(matches, team.id);
  const streakIsWin = streak?.startsWith('W');

  const players = [
    { id: team.player1_id, name: team.player1_name, avatar: team.player1_avatar, role: 'Holdkaptajn' },
    { id: team.player2_id, name: team.player2_name, avatar: team.player2_avatar, role: 'Makker' },
  ];

  return (
    <>
      <button type="button" className="pm-kampe-v2-sheet-backdrop pm-kampe-v2-sheet-backdrop--stacked" aria-label="Luk holdprofil" onClick={onClose} />
      <div
        ref={sheetRef}
        className={`pm-kampe-v2-sheet pm-liga-v2-team-sheet${sheetClassName ? ` ${sheetClassName}` : ''}`}
        style={sheetStyle}
        role="dialog"
        aria-modal="true"
        aria-label={`Hold: ${team.name}`}
      >
        <div {...dragZoneProps} className="pm-kampe-v2-sheet-drag-header">
          <div className="pm-kampe-v2-sheet-handle" aria-hidden />
          <button type="button" className="pm-liga-v2-sheet-back" onClick={onClose}>
            <ChevronLeft size={16} aria-hidden />
            Tilbage
          </button>
        </div>
        <div className="pm-liga-v2-team-body">
          <div className="pm-liga-v2-team-head">
            <div className="pm-liga-v2-team-avatars">
              <AvatarCircle avatar={team.player1_avatar} size={52} emojiSize="22px" className="pm-liga-v2-team-avatar" />
              <AvatarCircle avatar={team.player2_avatar} size={52} emojiSize="22px" className="pm-liga-v2-team-avatar pm-liga-v2-team-avatar--overlap" />
            </div>
            <div>
              <div className="pm-liga-v2-team-kicker">HOLD</div>
              <h2 className="pm-liga-v2-team-title">{team.name}</h2>
            </div>
          </div>

          <div className="pm-liga-v2-team-stats">
            <div className="pm-liga-v2-team-stat">
              <div className="pm-liga-v2-team-stat-val">{wins}-{losses}</div>
              <div className="pm-liga-v2-team-stat-lbl">Sejre</div>
            </div>
            <div className="pm-liga-v2-team-stat">
              <div className="pm-liga-v2-team-stat-val pm-liga-v2-team-stat-val--green">{winRate}%</div>
              <div className="pm-liga-v2-team-stat-lbl">Win-rate</div>
            </div>
            <div className="pm-liga-v2-team-stat">
              <div className={`pm-liga-v2-team-stat-val${streakIsWin ? ' pm-liga-v2-team-stat-val--green' : streak ? ' pm-liga-v2-team-stat-val--red' : ''}`}>
                {streak || '—'}
              </div>
              <div className="pm-liga-v2-team-stat-lbl">Stime</div>
            </div>
          </div>

          <div className="pm-liga-v2-team-players-label">Spillere</div>
          <div className="pm-liga-v2-team-players">
            {players.map((p) => (
              <button
                key={p.id}
                type="button"
                className="pm-liga-v2-team-player"
                onClick={() => onPlayerClick?.(p.id, p.name, p.avatar)}
              >
                <AvatarCircle avatar={p.avatar} size={40} emojiSize="16px" />
                <div className="pm-liga-v2-team-player-main">
                  <div className="pm-liga-v2-team-player-name">{p.name}</div>
                  <div className="pm-liga-v2-team-player-role">{p.role}</div>
                </div>
              </button>
            ))}
          </div>

          {team?.id && leagueId ? (
            <LigaTeamChatPanel
              teamId={team.id}
              leagueId={leagueId}
              teamName={team.name}
              userId={userId}
              userName={userName}
              userAvatar={userAvatar}
              canWrite={canWriteTeamChat}
              showToast={showToast}
            />
          ) : null}
        </div>
      </div>
    </>
  );
}
