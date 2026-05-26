import { CalendarDays, Zap } from 'lucide-react';
import { AvatarCircle } from '../AvatarCircle';
import { formatMatchDateDa, matchTimeLabel } from '../../lib/matchDisplayUtils';

function toneClass(tone) {
  if (tone === 'accent') return 'pm-kampe-v2-badge--accent';
  if (tone === 'warm') return 'pm-kampe-v2-badge--warm';
  if (tone === 'blue') return 'pm-kampe-v2-badge--blue';
  return 'pm-kampe-v2-badge--neutral';
}

export function KampeMatchListCard({
  match,
  players = [],
  profilesById = {},
  matchPrefs,
  status,
  statusLabel,
  left,
  isFull,
  joined,
  unreadCount = 0,
  onClick,
}) {
  const venue =
    matchPrefs?.booked === false && !String(match.court_name || '').trim()
      ? 'Bane ikke booket endnu'
      : (match.court_name || 'Padelbane');
  const isLive = status === 'in_progress';
  const dull = isFull && !joined && status !== 'completed' && status !== 'in_progress';

  const slots = [];
  for (let i = 0; i < 4; i += 1) {
    const p = players[i];
    if (p) {
      slots.push(
        <AvatarCircle
          key={p.user_id || i}
          avatar={profilesById[String(p.user_id)]?.avatar || p.user_emoji || '🎾'}
          size={28}
          emojiSize="12px"
          style={{ border: '1.5px solid var(--pm-border)' }}
        />,
      );
    } else {
      slots.push(
        <span key={`empty-${i}`} className="pm-kampe-v2-list-avatar-empty" aria-hidden>
          +
        </span>,
      );
    }
  }

  return (
    <button
      type="button"
      className={`pm-kampe-v2-list-card${dull ? ' pm-kampe-v2-list-card--dull' : ''}${unreadCount ? ' pm-kampe-v2-list-card--unread' : ''}`}
      onClick={onClick}
      aria-label={`Åbn kamp: ${venue}`}
    >
      <div className="pm-kampe-v2-list-card-top">
        <div className="pm-kampe-v2-list-card-main">
          <div className="pm-kampe-v2-list-venue">{venue}</div>
          <div className="pm-kampe-v2-list-datetime">
            <CalendarDays size={12} aria-hidden />
            {formatMatchDateDa(match.date)} · {matchTimeLabel(match)}
          </div>
        </div>
        <div className="pm-kampe-v2-list-badges">
          {isLive ? (
            <span className="pm-kampe-v2-badge pm-kampe-v2-badge--live">
              <span className="pm-live-dot" />
              LIVE
            </span>
          ) : (
            <span className={`pm-kampe-v2-badge ${toneClass(statusLabel?.tone)}`}>
              {statusLabel?.text}
            </span>
          )}
          {unreadCount > 0 ? (
            <span className="pm-kampe-v2-list-unread">{unreadCount > 9 ? '9+' : unreadCount}</span>
          ) : null}
        </div>
      </div>

      <div className="pm-kampe-v2-list-card-bottom">
        <div className="pm-kampe-v2-list-avatars">{slots}</div>
        <div className="pm-kampe-v2-list-meta">
          {matchPrefs?.min != null && matchPrefs?.max != null ? (
            <span className="pm-kampe-v2-list-elo">ELO {matchPrefs.min}–{matchPrefs.max}</span>
          ) : null}
          {match.seeking_player ? (
            <span className="pm-kampe-v2-list-seeking">
              <Zap size={10} aria-hidden />
              Mangler spiller
            </span>
          ) : left > 0 && status === 'open' ? (
            <span className="pm-kampe-v2-list-spots">{left} ledig{left > 1 ? 'e' : ''}</span>
          ) : null}
        </div>
      </div>
    </button>
  );
}
