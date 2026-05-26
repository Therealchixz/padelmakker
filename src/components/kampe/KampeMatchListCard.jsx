import { CalendarDays, MapPin } from 'lucide-react';
import { AvatarCircle } from '../AvatarCircle';
import { formatMatchDateDa, matchTimeLabel } from '../../lib/matchDisplayUtils';
import { getKampeListStatusBadge } from '../../lib/kampeListCardStatus';

function badgeToneClass(tone) {
  if (tone === 'live') return 'pm-kampe-v2-badge--live';
  if (tone === 'open') return 'pm-kampe-v2-badge--open';
  if (tone === 'full') return 'pm-kampe-v2-badge--full';
  if (tone === 'closed') return 'pm-kampe-v2-badge--closed';
  return 'pm-kampe-v2-badge--neutral';
}

export function KampeMatchListCard({
  match,
  teamStats,
  profilesById = {},
  matchPrefs,
  status,
  left,
  isFull,
  isClosed = false,
  joined,
  unreadCount = 0,
  onClick,
}) {
  const venue =
    matchPrefs?.booked === false && !String(match.court_name || '').trim()
      ? 'Bane ikke booket endnu'
      : (match.court_name || 'Padelbane');
  const dull = isFull && !joined && status !== 'completed' && status !== 'in_progress';
  const statusBadge = getKampeListStatusBadge({ status, isClosed, left, isFull });
  const t1 = teamStats?.t1 || [];
  const t2 = teamStats?.t2 || [];
  const filledCount = t1.length + t2.length;
  const maxPlayers = match?.max_players || 4;

  return (
    <button
      type="button"
      className={`pm-kampe-v2-list-card${dull ? ' pm-kampe-v2-list-card--dull' : ''}${unreadCount ? ' pm-kampe-v2-list-card--unread' : ''}`}
      onClick={onClick}
      aria-label={`Åbn kamp: ${venue}`}
    >
      <div className="pm-kampe-v2-list-card-top">
        <div className="pm-kampe-v2-list-card-main">
          <div className="pm-kampe-v2-list-datetime pm-kampe-v2-list-datetime--primary">
            <CalendarDays size={13} aria-hidden />
            {formatMatchDateDa(match.date)} · {matchTimeLabel(match)}
          </div>
          <div className="pm-kampe-v2-list-venue">
            <MapPin size={12} aria-hidden />
            {venue}
          </div>
        </div>
        <div className="pm-kampe-v2-list-badges">
          <span className={`pm-kampe-v2-badge ${badgeToneClass(statusBadge.tone)}`}>
            {statusBadge.tone === 'live' ? <span className="pm-live-dot" /> : null}
            {statusBadge.label}
          </span>
          {unreadCount > 0 ? (
            <span className="pm-kampe-v2-list-unread">{unreadCount > 9 ? '9+' : unreadCount}</span>
          ) : null}
        </div>
      </div>

      <div className="pm-kampe-v2-list-card-bottom">
        <div className="pm-kampe-v2-list-participants">
          <div className="pm-kampe-v2-list-avatars">
            {[...t1, ...t2].map((p, i) => (
              <AvatarCircle
                key={p.user_id || i}
                avatar={profilesById[String(p.user_id)]?.avatar || p.user_emoji || '🎾'}
                size={28}
                emojiSize="12px"
                style={{ border: '1.5px solid var(--pm-border)' }}
              />
            ))}
            {left > 0 ? (
              <span className="pm-kampe-v2-list-slots-plus">+{left}</span>
            ) : null}
          </div>
          <span className="pm-kampe-v2-list-count">
            {filledCount}/{maxPlayers}
          </span>
        </div>
        {matchPrefs?.min != null && matchPrefs?.max != null ? (
          <span className="pm-kampe-v2-list-elo-pill">
            {matchPrefs.min}–{matchPrefs.max}
          </span>
        ) : null}
      </div>
    </button>
  );
}
