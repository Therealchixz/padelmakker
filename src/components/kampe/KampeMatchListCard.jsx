import { MapPin } from 'lucide-react';
import { AvatarCircle } from '../AvatarCircle';
import { formatMatchDateHeadlineDa, matchTimeLabel } from '../../lib/matchDisplayUtils';
import { getKampeListStatusBadge } from '../../lib/kampeListCardStatus';

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

/** Always two slots per hold so listen visuelt 2 vs 2, ikke én lang række. */
function teamDisplaySlots(players) {
  const filled = (players || []).slice(0, SLOTS_PER_TEAM);
  return Array.from({ length: SLOTS_PER_TEAM }, (_, i) => filled[i] ?? null);
}

/** Fordel spillere på tværs af hold hvis DB har >2 på ét hold (ældre data). */
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
  myEloChange = null,
  unreadCount = 0,
  onClick,
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
  const dateHeadline = formatMatchDateHeadlineDa(match.date);
  const timeLabel = matchTimeLabel(match);
  const isCompleted = status === 'completed';
  const showMyEloDelta =
    isCompleted && joined && myEloChange != null && Number.isFinite(Number(myEloChange));
  const eloDelta = showMyEloDelta ? Number(myEloChange) : null;
  const showEloRange =
    !isCompleted && matchPrefs?.min != null && matchPrefs?.max != null;
  const t1Slots = teamDisplaySlots(t1);
  const t2Slots = teamDisplaySlots(t2);
  const renderTeamSlot = (player, teamNum, slotIndex) => {
    if (!player) {
      return (
        <span
          key={`t${teamNum}-empty-${slotIndex}`}
          className="pm-kampe-v2-list-avatar-slot pm-kampe-v2-list-avatar-slot--empty"
          aria-hidden
        />
      );
    }
    return (
      <AvatarCircle
        key={player.user_id || `t${teamNum}-${slotIndex}`}
        avatar={profilesById[String(player.user_id)]?.avatar || player.user_emoji || '🎾'}
        size={28}
        emojiSize="12px"
        style={{ zIndex: slotIndex + 1 }}
      />
    );
  };

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
            {dateHeadline} · {timeLabel}
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

      <div className={`pm-kampe-v2-list-card-bottom${isCompleted ? ' pm-kampe-v2-list-card-bottom--completed' : ''}`}>
        <div className="pm-kampe-v2-list-participants">
          <div
            className="pm-kampe-v2-list-teams"
            aria-label={`${filledCount} af ${maxPlayers} spillere, hold 1 mod hold 2`}
          >
            <div className="pm-kampe-v2-list-team pm-kampe-v2-list-team--t1" aria-label="Hold 1">
              {t1Slots.map((p, i) => renderTeamSlot(p, 1, i))}
            </div>
            <span className="pm-kampe-v2-list-teams-vs" aria-hidden>
              vs
            </span>
            <div className="pm-kampe-v2-list-team pm-kampe-v2-list-team--t2" aria-label="Hold 2">
              {t2Slots.map((p, i) => renderTeamSlot(p, 2, i))}
            </div>
          </div>
          <span className="pm-kampe-v2-list-count">
            {filledCount}/{maxPlayers}
          </span>
        </div>
        {showEloRange ? (
          <span
            className="pm-kampe-v2-list-elo-pill"
            title={`Arrangøren søger spillere med ELO mellem ${matchPrefs.min} og ${matchPrefs.max}`}
          >
            ELO {matchPrefs.min}–{matchPrefs.max}
          </span>
        ) : null}
        {showMyEloDelta ? (
          <span
            className={`pm-kampe-v2-list-elo-result${eloDelta >= 0 ? ' pm-kampe-v2-list-elo-result--up' : ' pm-kampe-v2-list-elo-result--down'}`}
          >
            {eloDelta >= 0 ? '+' : ''}
            {eloDelta} ELO
          </span>
        ) : null}
      </div>
    </button>
  );
}
