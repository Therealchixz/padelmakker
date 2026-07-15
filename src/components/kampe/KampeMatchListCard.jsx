import { AvatarCircle } from '../AvatarCircle';
import { matchTimeLabel } from '../../lib/matchDisplayUtils';
import { getKampeListStatusBadge } from '../../lib/kampeListCardStatus';
import { formatMatchLevelRangeParts } from '../../lib/padelLevelUtils';

const DA_MONTHS_SHORT = ['JAN','FEB','MAR','APR','MAJ','JUN','JUL','AUG','SEP','OKT','NOV','DEC'];
const MIDDOT = '\u00B7';
const MINUS_SIGN = '\u2212';
const ARROW_RIGHT = '\u2192';
const DEFAULT_LIST_AVATAR = '\u{1F3BE}';

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

function computeSetScoreStr(mr) {
  if (!mr) return null;
  const parts = [];
  for (let i = 1; i <= 3; i++) {
    const g1 = mr[`set${i}_team1`];
    const g2 = mr[`set${i}_team2`];
    if (g1 == null || g2 == null) break;
    const n1 = Number(g1), n2 = Number(g2);
    if (n1 + n2 === 0) break;
    parts.push(`${n1}-${n2}`);
  }
  return parts.length > 0 ? parts.join(` ${MIDDOT} `) : null;
}

const SLOTS_PER_TEAM = 2;

/** Kort holdnavn til VS-raekken, fx "Dig & Mads". */
function teamNameLabel(players, profilesById, currentUserId) {
  const names = (players || []).map((p) => {
    if (currentUserId != null && String(p.user_id) === String(currentUserId)) return 'Dig';
    const full = profilesById[String(p.user_id)]?.name || p.user_name || 'Spiller';
    return String(full).trim().split(/\s+/)[0];
  });
  if (names.length === 0) return '';
  return names.join(' & ');
}

/** Always two slots per hold sa listen visuelt 2 vs 2, ikke en lang raekke. */
function teamDisplaySlots(players) {
  const filled = (players || []).slice(0, SLOTS_PER_TEAM);
  return Array.from({ length: SLOTS_PER_TEAM }, (_, i) => filled[i] ?? null);
}

/** Fordel spillere pa tvaers af hold hvis DB har >2 pa et hold (aeldre data). */
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
  matchResult = null,
  winnerTeam = null,
  myTeam = null,
  currentUserId = null,
  primaryAction = null,
  attentionReason = null,
  statusNote = null,
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
  const timeLabel = matchTimeLabel(match);
  const badgeDate = match.date ? new Date(String(match.date).slice(0, 10) + 'T00:00:00') : null;
  const badgeDay = badgeDate ? badgeDate.getDate() : null;
  const badgeMon = badgeDate ? DA_MONTHS_SHORT[badgeDate.getMonth()] : null;
  const isCompleted = status === 'completed';
  const isInProgress = status === 'in_progress';
  const minutesPlayed = (() => {
    if (!isInProgress || !match.started_at) return null;
    const ms = Date.now() - new Date(match.started_at).getTime();
    if (!Number.isFinite(ms) || ms < 0) return null;
    return Math.floor(ms / 60000);
  })();
  const showMyEloDelta =
    isCompleted && joined && myEloChange != null && Number.isFinite(Number(myEloChange));
  const eloDelta = showMyEloDelta ? Number(myEloChange) : null;
  const showEloRange =
    !isCompleted && matchPrefs?.min != null && matchPrefs?.max != null;
  const levelRangeParts = showEloRange
    ? formatMatchLevelRangeParts(matchPrefs.min, matchPrefs.max)
    : null;
  const hasConfirmedResult = isCompleted && matchResult?.confirmed && winnerTeam != null;
  const setScoreStr = hasConfirmedResult ? computeSetScoreStr(matchResult) : null;
  const didWin = hasConfirmedResult && myTeam != null && myTeam === winnerTeam;
  const didLose = hasConfirmedResult && myTeam != null && myTeam !== winnerTeam;
  const completedBadge =
    hasConfirmedResult && (didWin || didLose)
      ? didWin
        ? { label: 'Vundet', tone: 'green' }
        : { label: 'Tabt', tone: 'danger' }
      : null;
  const t1Slots = teamDisplaySlots(t1);
  const t2Slots = teamDisplaySlots(t2);
  const defaultAvatar = DEFAULT_LIST_AVATAR;
  const listAvatarSize = 28;

  const renderTeamSlot = (p, i, teamKey, size = listAvatarSize) => {
    if (p) {
      return (
        <AvatarCircle
          key={p.user_id || `${teamKey}-${i}`}
          avatar={profilesById[String(p.user_id)]?.avatar || p.user_emoji || defaultAvatar}
          size={size}
          emojiSize={size <= 24 ? '10px' : '12px'}
        />
      );
    }
    return (
      <span
        key={`${teamKey}-empty-${i}`}
        className="pm-kampe-v2-list-avatar-slot--empty"
        style={size !== listAvatarSize ? { width: size, height: size } : undefined}
        aria-hidden
      />
    );
  };

  const renderSingleTeam = (slots, teamKey, size = listAvatarSize) => (
    <div className={`pm-kampe-v2-list-team pm-kampe-v2-list-team--pill pm-kampe-v2-list-team--${teamKey}`}>
      {slots.map((p, i) => renderTeamSlot(p, i, teamKey, size))}
    </div>
  );

  const renderListTeams = (size = listAvatarSize) => (
    <div className="pm-kampe-v2-list-teams">
      <div className="pm-kampe-v2-list-team pm-kampe-v2-list-team--pill pm-kampe-v2-list-team--t1">
        {t1Slots.map((p, i) => renderTeamSlot(p, i, 't1', size))}
      </div>
      <span className="pm-kampe-v2-list-teams-vs" aria-hidden>vs</span>
      <div className="pm-kampe-v2-list-team pm-kampe-v2-list-team--pill pm-kampe-v2-list-team--t2">
        {t2Slots.map((p, i) => renderTeamSlot(p, i, 't2', size))}
      </div>
    </div>
  );

  const displayBadge = isCompleted && completedBadge ? completedBadge : statusBadge;

  return (
    <div
      role="button"
      tabIndex={0}
      className={`pm-kampe-v2-list-card${dull ? ' pm-kampe-v2-list-card--dull' : ''}${unreadCount ? ' pm-kampe-v2-list-card--unread' : ''}`}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(); } }}
      aria-label={`\u00C5bn kamp: ${venue}`}
    >
      <div className="pm-kampe-v2-list-card-top">
        {badgeDay != null ? (
          <div className="pm-kampe-v2-list-date-badge">
            <b>{badgeDay}</b>
            <span>{badgeMon}</span>
          </div>
        ) : null}
        <div className="pm-kampe-v2-list-card-main">
          <div className="pm-kampe-v2-list-datetime pm-kampe-v2-list-datetime--primary">
            {venue}
          </div>
          <div className="pm-kampe-v2-list-meta">
            <div className="pm-kampe-v2-list-meta-time">
              {isInProgress && minutesPlayed != null ? (
                <span className="pm-kampe-v2-list-meta-live">
                  {minutesPlayed > 0 ? `${minutesPlayed} min spillet` : 'Netop startet'}
                </span>
              ) : (
                <>Kl. {timeLabel}</>
              )}
              {match.duration ? (
                <span className="pm-kampe-v2-list-meta-duration">{match.duration} min</span>
              ) : null}
            </div>
            {!isCompleted && levelRangeParts ? (
              <div className="pm-kampe-v2-list-meta-levels">
                <span className="pm-kampe-v2-list-meta-chip pm-kampe-v2-list-meta-chip--elo">{levelRangeParts.elo}</span>
                <span className="pm-kampe-v2-list-meta-chip pm-kampe-v2-list-meta-chip--niveau">{levelRangeParts.niveau}</span>
              </div>
            ) : null}
          </div>
        </div>
        <div className="pm-kampe-v2-list-badges">
          <span className={`pm-kampe-v2-badge ${badgeToneClass(displayBadge.tone)}`}>
            {displayBadge.tone === 'live' ? <span className="pm-live-dot" /> : null}
            {displayBadge.label}
          </span>
          {unreadCount > 0 ? (
            <span className="pm-kampe-v2-list-unread">{unreadCount > 9 ? '9+' : unreadCount}</span>
          ) : null}
        </div>
      </div>

      {attentionReason || statusNote ? (
        <div className={`pm-kampe-v2-list-note${attentionReason ? ' pm-kampe-v2-list-note--danger' : ''}`}>
          <span className="pm-kampe-v2-list-note-dot" aria-hidden />
          {attentionReason || statusNote}
        </div>
      ) : null}

      {setScoreStr ? (
        <div style={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          gap: 8, padding: '10px 14px 2px', borderTop: '1px solid var(--pm-border)',
          marginTop: 4,
        }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
            {renderSingleTeam(t1Slots, 't1', 24)}
            <span style={{ fontSize: 12, fontWeight: 700, color: didWin ? 'var(--pm-text)' : 'var(--pm-text-mid)', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
              {teamNameLabel(t1, profilesById, currentUserId)}
            </span>
          </div>
          <div style={{ flexShrink: 0, alignSelf: 'center', fontSize: 15, fontWeight: 700, color: 'var(--pm-accent)', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>
            {setScoreStr}
          </div>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
            {renderSingleTeam(t2Slots, 't2', 24)}
            <span style={{ fontSize: 12, fontWeight: 700, color: didLose ? 'var(--pm-text-mid)' : 'var(--pm-text)', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
              {teamNameLabel(t2, profilesById, currentUserId)}
            </span>
          </div>
        </div>
      ) : null}

      <div className="pm-kampe-v2-list-card-bottom pm-kampe-v2-list-card-bottom--open">
        {!setScoreStr && !isCompleted ? (
          <div
            className="pm-kampe-v2-list-roster"
            aria-label={`${filledCount} af ${maxPlayers} spillere`}
          >
            {renderListTeams()}
            <div className="pm-kampe-v2-list-roster-meta">
              <span className="pm-kampe-v2-list-roster-count">
                {filledCount}/{maxPlayers} spillere
              </span>
              {left > 0 ? (
                <span className="pm-kampe-v2-list-roster-open">
                  {MIDDOT} {left} {left === 1 ? 'plads' : 'pladser'} ledig{left === 1 ? '' : 'e'}
                </span>
              ) : null}
              {isFull && !joined ? (
                <span className="pm-kampe-v2-list-roster-full">{MIDDOT} Fuldt</span>
              ) : null}
            </div>
          </div>
        ) : null}
        {!isCompleted && primaryAction ? (
          <div className="pm-kampe-v2-list-card-cta-row">
            <button
              type="button"
              className={`pm-kampe-v2-list-cta pm-kampe-v2-list-cta--block${primaryAction.variant === 'secondary' ? ' pm-kampe-v2-list-cta--secondary' : ''}`}
              onClick={(e) => { e.stopPropagation(); primaryAction.onClick?.(); }}
              disabled={primaryAction.disabled}
            >
              {primaryAction.label}
            </button>
          </div>
        ) : !isCompleted ? (
          <div className="pm-kampe-v2-list-card-cta-row">
            <span className="pm-kampe-v2-list-cta pm-kampe-v2-list-cta--block pm-kampe-v2-list-cta--secondary">
              Se kamp
            </span>
          </div>
        ) : null}
        {isCompleted && showMyEloDelta ? (
          <div className="pm-kampe-v2-list-roster-meta pm-kampe-v2-list-roster-meta--center">
            <span
              className={`pm-kampe-v2-list-elo-result${eloDelta >= 0 ? ' pm-kampe-v2-list-elo-result--up' : ' pm-kampe-v2-list-elo-result--down'}`}
            >
              Elo {eloDelta >= 0 ? '+' : MINUS_SIGN}{Math.abs(eloDelta)}
            </span>
          </div>
        ) : null}
        {isCompleted ? (
          <div className="pm-kampe-v2-list-card-cta-row">
            <span className="pm-kampe-v2-list-cta pm-kampe-v2-list-cta--block pm-kampe-v2-list-cta--secondary">
              Se detaljer {ARROW_RIGHT}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
