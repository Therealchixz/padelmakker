import { CalendarDays, X } from 'lucide-react';
import { AvatarCircle } from '../AvatarCircle';
import { formatMatchDateDa, matchTimeLabel } from '../../lib/matchDisplayUtils';
import { btn } from '../../lib/platformTheme';

export function KampeMatchDetailSheet({
  open,
  onClose,
  match,
  players: _players = [],
  profilesById = {},
  matchPrefs,
  statusLabel,
  status,
  teamStats,
  winnerTeam,
  description,
  primaryAction,
  onExpandFull,
  unreadCount = 0,
}) {
  if (!open || !match) return null;

  const venue =
    matchPrefs?.booked === false && !String(match.court_name || '').trim()
      ? 'Bane ikke booket endnu'
      : (match.court_name || 'Padelbane');
  const t1 = teamStats?.t1 || [];
  const t2 = teamStats?.t2 || [];

  const renderPlayer = (p, teamNum) => {
    if (!p) {
      return (
        <div key={`empty-${teamNum}`} className="pm-kampe-v2-detail-player pm-kampe-v2-detail-player--empty">
          <span className="pm-kampe-v2-detail-empty-slot">Ledig</span>
        </div>
      );
    }
    const elo = teamStats?.playerEloByUserId?.[String(p.user_id)] ?? '—';
    return (
      <div key={p.user_id} className="pm-kampe-v2-detail-player">
        <AvatarCircle
          avatar={profilesById[String(p.user_id)]?.avatar || p.user_emoji || '🎾'}
          size={40}
          emojiSize="16px"
        />
        <span className="pm-kampe-v2-detail-player-name">{(p.user_name || '?').split(' ')[0]}</span>
        <span className="pm-kampe-v2-detail-player-elo">{elo}</span>
      </div>
    );
  };

  return (
    <>
      <button
        type="button"
        className="pm-kampe-v2-sheet-backdrop"
        aria-label="Luk kampdetaljer"
        onClick={onClose}
      />
      <div className="pm-kampe-v2-sheet pm-kampe-v2-detail-sheet" role="dialog" aria-modal="true" aria-label="Kampdetaljer">
        <div className="pm-kampe-v2-sheet-handle" aria-hidden />
        <div className="pm-kampe-v2-detail-head">
          <div>
            <div className="pm-kampe-v2-detail-venue">{venue}</div>
            <div className="pm-kampe-v2-detail-datetime">
              <CalendarDays size={13} aria-hidden />
              {formatMatchDateDa(match.date)} kl. {matchTimeLabel(match)}
            </div>
          </div>
          <button type="button" className="pm-kampe-v2-detail-close" onClick={onClose} aria-label="Luk">
            <X size={18} />
          </button>
        </div>

        <div className="pm-kampe-v2-detail-badges">
          {status === 'in_progress' ? (
            <span className="pm-kampe-v2-badge pm-kampe-v2-badge--live">
              <span className="pm-live-dot" />
              LIVE
            </span>
          ) : winnerTeam ? (
            <span className="pm-kampe-v2-badge pm-kampe-v2-badge--green">Hold {winnerTeam} vandt</span>
          ) : (
            <span className="pm-kampe-v2-badge pm-kampe-v2-badge--neutral">{statusLabel?.text}</span>
          )}
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

        <div className="pm-kampe-v2-detail-teams">
          <div className="pm-kampe-v2-detail-team">
            <div className="pm-kampe-v2-detail-team-label">Hold 1</div>
            <div className="pm-kampe-v2-detail-team-players">
              {renderPlayer(t1[0], 1)}
              {renderPlayer(t1[1], 1)}
            </div>
          </div>
          <div className="pm-kampe-v2-detail-vs">vs</div>
          <div className="pm-kampe-v2-detail-team">
            <div className="pm-kampe-v2-detail-team-label">Hold 2</div>
            <div className="pm-kampe-v2-detail-team-players">
              {renderPlayer(t2[0], 2)}
              {renderPlayer(t2[1], 2)}
            </div>
          </div>
        </div>

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

        {onExpandFull ? (
          <button type="button" className="pm-kampe-v2-detail-expand" onClick={onExpandFull}>
            Fuld kampvisning (chat, admin m.m.) ›
          </button>
        ) : null}
      </div>
    </>
  );
}
