import { AvatarCircle } from '../AvatarCircle';
import { matchTimeLabel } from '../../lib/matchDisplayUtils';
import { getKampeListStatusBadge } from '../../lib/kampeListCardStatus';

const DA_MONTHS_SHORT = ['JAN','FEB','MAR','APR','MAJ','JUN','JUL','AUG','SEP','OKT','NOV','DEC'];

function badgeToneClass(tone) {
  if (tone === 'live') return 'pm-kampe-v2-badge--live';
  if (tone === 'open') return 'pm-kampe-v2-badge--open';
  if (tone === 'full') return 'pm-kampe-v2-badge--full';
  if (tone === 'closed') return 'pm-kampe-v2-badge--closed';
  if (tone === 'warm') return 'pm-kampe-v2-badge--warm';
  if (tone === 'green') return 'pm-kampe-v2-badge--green';
  if (tone === 'danger') return 'pm-kampe-v2-badge--danger';
  return 'pm-kampe-v2-badge--neutral';
}

const SLOTS_PER_TEAM = 2;

function teamDisplaySlots(players) {
  const filled = (players || []).slice(0, SLOTS_PER_TEAM);
  return Array.from({ length: SLOTS_PER_TEAM }, (_, i) => filled[i] ?? null);
}

function balanceTeamsForListDisplay(t1, t2) {
  const team1 = t1 || [];
  const team2 = t2 || [];
  if (team1.length <= SLOTS_PER_TEAM && team2.length <= SLOTS_PER_TEAM) {
    return { t1: team1, t2: team2 };
  }
  const all = [...team1, ...team2];
  const half = Math.ceil(all.length / 2);
  return { t1: all.slice(0, half), t2: all.slice(half) };
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
  myRequest = null,
  myEloChange = null,
  unreadCount = 0,
  ctaBusy = false,
  onClick,
  onCtaClick,
}) {
  const venue =
    matchPrefs?.booked === false && !String(match.court_name || '').trim()
      ? 'Bane ikke booket endnu'
      : (match.court_name || 'Padelbane');
  const dull = isFull && !joined && status !== 'completed' && status !== 'in_progress';
  const statusBadge = getKampeListStatusBadge({ status, isClosed, left, isFull });
  const rawT1 = teamStats?.t1 || [];
  const rawT2 = teamStats?.t2 || [];
  const { t1, t2 } = balanceTeamsForListDisplay(rawT1, rawT2);
  const filledCount = rawT1.length + rawT2.length;
  const maxPlayers = match?.max_players || 4;
  const timeLabel = matchTimeLabel(match);
  const badgeDate = match.date ? new Date(String(match.date).slice(0, 10) + 'T00:00:00') : null;
  const badgeDay = badgeDate ? badgeDate.getDate() : null;
  const badgeMon = badgeDate ? DA_MONTHS_SHORT[badgeDate.getMonth()] : null;
  const isCompleted = status === 'completed';
  const showMyEloDelta =
    isCompleted && joined && myEloChange != null && Number.isFinite(Number(myEloChange));
  const eloDelta = showMyEloDelta ? Number(myEloChange) : null;
  const showEloRange =
    !isCompleted && matchPrefs?.min != null && matchPrefs?.max != null;
  const t1Slots = teamDisplaySlots(t1);
  const t2Slots = teamDisplaySlots(t2);
  const showWaitlist = isFull && !joined && !isClosed && status !== 'completed' && status !== 'in_progress';
  const onWaitlist = myRequest?.status === 'pending';
  const ctaLabel = joined
    ? 'Se kamp'
    : showWaitlist
      ? (onWaitlist ? 'På venteliste' : 'Venteliste')
      : 'Tilmeld';

  return (
    <div
      className={`pm-kampe-v2-list-card${dull ? ' pm-kampe-v2-list-card--dull' : ''}${unreadCount ? ' pm-kampe-v2-list-card--unread' : ''}`}
    >
      <button
        type="button"
        className="pm-kampe-v2-list-card-hit"
        onClick={onClick}
        aria-label={`Åbn kamp: ${venue}`}
      >
        <div className="pm-kampe-v2-list-card-top">
          {badgeDay != null ? (
            <div style={{ width: 46, flexShrink: 0, textAlign: 'center', background: 'var(--pm-inset, #F1F4F9)', border: '1px solid var(--pm-border, #E2E8F0)', borderRadius: 10, padding: '6px 0' }}>
              <b style={{ display: 'block', fontSize: 16, fontWeight: 700, lineHeight: 1.1 }}>{badgeDay}</b>
              <span style={{ fontSize: 9.5, fontWeight: 600, textTransform: 'uppercase', color: 'var(--pm-text-light, #8898AA)', letterSpacing: '0.5px' }}>{badgeMon}</span>
            </div>
          ) : null}
          <div className="pm-kampe-v2-list-card-main">
            <div className="pm-kampe-v2-list-datetime pm-kampe-v2-list-datetime--primary" style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--pm-text)' }}>
              {venue}
            </div>
            <div className="pm-kampe-v2-list-venue" style={{ marginTop: 2 }}>
              Kl. {timeLabel}
              {showEloRange ? <> · ELO {matchPrefs.min}–{matchPrefs.max}</> : null}
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
      </button>

      <div className={`pm-kampe-v2-list-card-bottom${isCompleted ? ' pm-kampe-v2-list-card-bottom--completed' : ''}`}>
        <button
          type="button"
          className="pm-kampe-v2-list-card-bottom-open"
          onClick={onClick}
          aria-label={`Åbn kamp: ${venue}`}
        >
          <div className="pm-kampe-v2-list-participants">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} aria-label={`${filledCount} af ${maxPlayers} spillere`}>
              <div style={{ display: 'flex' }}>
                {[...t1Slots, ...t2Slots].map((p, i) => p ? (
                  <AvatarCircle
                    key={p.user_id || `slot-${i}`}
                    avatar={profilesById[String(p.user_id)]?.avatar || p.user_emoji || '🎾'}
                    size={27}
                    emojiSize="10px"
                    style={{ marginLeft: i > 0 ? -9 : 0, border: '2px solid white', zIndex: i + 1 }}
                  />
                ) : (
                  <span
                    key={`empty-${i}`}
                    style={{ width: 27, height: 27, borderRadius: '50%', background: 'var(--pm-inset, #F1F4F9)', border: '2px solid white', marginLeft: i > 0 ? -9 : 0, zIndex: i + 1, display: 'inline-block', flexShrink: 0 }}
                    aria-hidden
                  />
                ))}
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--pm-text-light, #8898AA)' }}>
                {filledCount}/{maxPlayers} spillere
              </span>
            </div>
          </div>
          {showMyEloDelta ? (
            <span
              className={`pm-kampe-v2-list-elo-result${eloDelta >= 0 ? ' pm-kampe-v2-list-elo-result--up' : ' pm-kampe-v2-list-elo-result--down'}`}
            >
              {eloDelta >= 0 ? '+' : ''}
              {eloDelta} ELO
            </span>
          ) : null}
        </button>
        {!isCompleted ? (
          <button
            type="button"
            className={`pm-kampe-v2-list-cta${showWaitlist ? ' pm-kampe-v2-list-cta--ghost' : ''}`}
            onClick={() => onCtaClick?.()}
            disabled={ctaBusy}
            aria-label={ctaLabel}
          >
            {ctaBusy && !onWaitlist ? 'Sender...' : ctaLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
