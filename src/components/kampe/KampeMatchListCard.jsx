import { AvatarCircle } from '../AvatarCircle';
import { matchTimeLabel, formatMatchDateHeadlineDa } from '../../lib/matchDisplayUtils';
import { getKampeListStatusBadge } from '../../lib/kampeListCardStatus';
import { eloRangeToLevelRange, formatPlaytomicLevel } from '../../lib/padelLevelUtils';

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
  return parts.length > 0 ? parts.join(' · ') : null;
}

const SLOTS_PER_TEAM = 2;

/** Kort holdnavn til VS-rækken, fx "Dig & Mads". */
function teamNameLabel(players, profilesById, currentUserId) {
  const names = (players || []).map((p) => {
    if (currentUserId != null && String(p.user_id) === String(currentUserId)) return 'Dig';
    const full = profilesById[String(p.user_id)]?.name || p.user_name || 'Spiller';
    return String(full).trim().split(/\s+/)[0];
  });
  if (names.length === 0) return '';
  return names.join(' & ');
}

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
  matchResult = null,
  winnerTeam = null,
  myTeam = null,
  currentUserId = null,
  primaryAction = null,
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
  const levelRange = showEloRange ? eloRangeToLevelRange(matchPrefs.min, matchPrefs.max) : null;
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
    <div
      role="button"
      tabIndex={0}
      className={`pm-kampe-v2-list-card${dull ? ' pm-kampe-v2-list-card--dull' : ''}${unreadCount ? ' pm-kampe-v2-list-card--unread' : ''}`}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(); } }}
      aria-label={`Åbn kamp: ${venue}`}
    >
      {isCompleted ? (
        <div className="pm-kampe-v2-list-card-top" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span className={`pm-kampe-v2-badge ${badgeToneClass((completedBadge || statusBadge).tone)}`}>
            {(completedBadge || statusBadge).label}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--pm-text-light, #8898AA)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right' }}>
              {formatMatchDateHeadlineDa(match.date)} · {venue}
            </span>
            {unreadCount > 0 ? (
              <span className="pm-kampe-v2-list-unread">{unreadCount > 9 ? '9+' : unreadCount}</span>
            ) : null}
          </div>
        </div>
      ) : (
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
              {isInProgress && minutesPlayed != null ? (
                <span style={{ color: 'var(--pm-red)', fontWeight: 700 }}>
                  {minutesPlayed > 0 ? `${minutesPlayed} min spillet` : 'Netop startet'}
                </span>
              ) : (
                <>Kl. {timeLabel}</>
              )}
              {match.duration ? <> · {match.duration} min</> : null}
              {showEloRange && levelRange ? <> · Niveau {formatPlaytomicLevel(levelRange.min)}–{formatPlaytomicLevel(levelRange.max)}</> : null}
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
      )}

      {setScoreStr ? (
        <div style={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          gap: 8, padding: '10px 14px 2px', borderTop: '1px solid var(--pm-border)',
          marginTop: 4,
        }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              {t1Slots.map((p, i) => p ? (
                <AvatarCircle
                  key={p.user_id || `vs-t1-${i}`}
                  avatar={profilesById[String(p.user_id)]?.avatar || p.user_emoji || '🎾'}
                  size={24}
                  emojiSize="10px"
                  style={{ marginLeft: i > 0 ? -7 : 0, border: '2px solid white', zIndex: i + 1 }}
                />
              ) : (
                <span key={`vs-t1-empty-${i}`} style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--pm-inset, #F1F4F9)', border: '2px solid white', marginLeft: i > 0 ? -7 : 0, display: 'inline-block', flexShrink: 0 }} aria-hidden />
              ))}
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: didWin ? 'var(--pm-text)' : 'var(--pm-text-mid)', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
              {teamNameLabel(t1, profilesById, currentUserId)}
            </span>
          </div>
          <div style={{ flexShrink: 0, alignSelf: 'center', fontSize: 15, fontWeight: 700, color: 'var(--pm-navy)', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>
            {setScoreStr}
          </div>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
            <div style={{ display: 'flex', justifyContent: 'center', direction: 'rtl' }}>
              {t2Slots.map((p, i) => p ? (
                <AvatarCircle
                  key={p.user_id || `vs-t2-${i}`}
                  avatar={profilesById[String(p.user_id)]?.avatar || p.user_emoji || '🎾'}
                  size={24}
                  emojiSize="10px"
                  style={{ marginLeft: i > 0 ? -7 : 0, border: '2px solid white', zIndex: i + 1 }}
                />
              ) : (
                <span key={`vs-t2-empty-${i}`} style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--pm-inset, #F1F4F9)', border: '2px solid white', marginLeft: i > 0 ? -7 : 0, display: 'inline-block', flexShrink: 0 }} aria-hidden />
              ))}
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: didLose ? 'var(--pm-text-mid)' : 'var(--pm-text)', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
              {teamNameLabel(t2, profilesById, currentUserId)}
            </span>
          </div>
        </div>
      ) : null}

      <div className={`pm-kampe-v2-list-card-bottom${isCompleted ? ' pm-kampe-v2-list-card-bottom--completed' : ''}`}>
        {!setScoreStr ? (
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
        ) : null}
        {!isCompleted && primaryAction ? (
          <button
            type="button"
            className="pm-kampe-v2-list-cta"
            onClick={(e) => { e.stopPropagation(); primaryAction.onClick?.(); }}
            disabled={primaryAction.disabled}
            style={{
              flexShrink: 0,
              padding: '9px 16px',
              borderRadius: 10,
              fontSize: 12.5,
              fontWeight: 700,
              fontFamily: 'inherit',
              cursor: primaryAction.disabled ? 'default' : 'pointer',
              ...(primaryAction.variant === 'secondary'
                ? { background: 'var(--pm-surface, #fff)', color: 'var(--pm-navy, #16377E)', border: '1.5px solid var(--pm-border, #E2E8F0)' }
                : { background: 'var(--pm-navy, #16377E)', color: '#fff', border: 'none' }),
            }}
          >
            {primaryAction.label}
          </button>
        ) : !isCompleted ? (
          <span
            className="pm-kampe-v2-list-cta"
            style={{
              flexShrink: 0,
              padding: '9px 16px',
              borderRadius: 10,
              fontSize: 12.5,
              fontWeight: 700,
              fontFamily: 'inherit',
              background: 'var(--pm-surface, #fff)',
              color: 'var(--pm-navy, #16377E)',
              border: '1.5px solid var(--pm-border, #E2E8F0)',
            }}
          >
            Se kamp
          </span>
        ) : null}
        {showMyEloDelta ? (
          <span
            className={`pm-kampe-v2-list-elo-result${eloDelta >= 0 ? ' pm-kampe-v2-list-elo-result--up' : ' pm-kampe-v2-list-elo-result--down'}`}
          >
            Elo {eloDelta >= 0 ? '+' : '−'}{Math.abs(eloDelta)}
          </span>
        ) : null}
        {setScoreStr ? (
          <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--pm-navy)', marginLeft: 'auto' }}>
            Se detaljer →
          </span>
        ) : null}
      </div>
    </div>
  );
}
