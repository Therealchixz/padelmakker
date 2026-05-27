import { CalendarDays, Clock, LayoutGrid, MapPin } from 'lucide-react'
import { AvatarCircle } from '../../components/AvatarCircle'
import { formatMatchDateHeadlineDa, formatTimeSlotDa } from '../../lib/matchDisplayUtils'
import {
  getAmericanoTournamentMeta,
  getAmericanoDurationLabel,
  getTournamentFormatLabel,
  playerInitials,
} from './americanoDisplayUtils'
import type { AmericanoTournament } from './types'

type ParticipantPreview = {
  user_id: string
  display_name: string
  avatar?: string | null
}

type Props = {
  tournament: AmericanoTournament
  courtName: string
  participants: ParticipantPreview[]
  status: 'registration' | 'playing' | 'completed'
  joined?: boolean
  tournamentFull?: boolean
  liveRound?: number | null
  myEloChange?: number | null
  playedDurationMinutes?: number | null
  onClick?: () => void
}

const MAX_AVATARS = 4

function badgeToneClass(tone: string) {
  if (tone === 'live') return 'pm-kampe-v2-badge--live'
  if (tone === 'open') return 'pm-kampe-v2-badge--open'
  if (tone === 'full') return 'pm-kampe-v2-badge--full'
  if (tone === 'closed') return 'pm-kampe-v2-badge--closed'
  return 'pm-kampe-v2-badge--neutral'
}

export function AmericanoListCard({
  tournament,
  courtName,
  participants,
  status,
  joined = false,
  tournamentFull = false,
  liveRound = null,
  myEloChange = null,
  playedDurationMinutes = null,
  onClick,
}: Props) {
  const { maxPlayers, totalRounds, estMinutes, courts, bench } = getAmericanoTournamentMeta(tournament)
  const durationLabel = getAmericanoDurationLabel(status, playedDurationMinutes, estMinutes)
  const filled = participants.length
  const fillPct = maxPlayers > 0 ? Math.min(100, Math.round((filled / maxPlayers) * 100)) : 0
  const dateHeadline = formatMatchDateHeadlineDa(tournament.tournament_date)
  const timeLabel = formatTimeSlotDa(tournament.time_slot)
  const isCompleted = status === 'completed'
  const isPlaying = status === 'playing'
  const isFullBar = isPlaying || isCompleted || tournamentFull

  const showMyEloDelta =
    isCompleted && joined && myEloChange != null && Number.isFinite(Number(myEloChange))
  const eloDelta = showMyEloDelta ? Number(myEloChange) : null

  let badgeLabel = 'Åben'
  let badgeTone = 'open'
  if (isCompleted) {
    badgeLabel = 'Afsluttet'
    badgeTone = 'closed'
  } else if (isPlaying) {
    badgeTone = 'live'
    badgeLabel =
      liveRound != null && totalRounds > 0
        ? `Live Runde ${liveRound}/${totalRounds}`
        : 'I gang'
  } else if (tournamentFull) {
    badgeLabel = 'Fuld'
    badgeTone = 'full'
  }

  const visibleParticipants = participants.slice(0, MAX_AVATARS)
  const overflow = Math.max(0, filled - MAX_AVATARS)

  return (
    <button
      type="button"
      id={`pm-americano-${tournament.id}`}
      className="pm-americano-v2-list-card"
      onClick={onClick}
      aria-label={`Åbn turnering: ${tournament.name}`}
      style={{ scrollMarginTop: '88px' }}
    >
      <div className="pm-americano-v2-list-top">
        <div className="pm-americano-v2-list-top-main">
          <div className="pm-americano-v2-list-type">{getTournamentFormatLabel(tournament.format)}</div>
          <div className="pm-americano-v2-list-title">{tournament.name}</div>
          <div className="pm-americano-v2-list-datetime">
            <CalendarDays size={13} strokeWidth={2} aria-hidden />
            {dateHeadline} kl. {timeLabel}
          </div>
        </div>
        <span className={`pm-kampe-v2-badge ${badgeToneClass(badgeTone)} pm-americano-v2-list-badge`}>
          {badgeTone === 'live' ? <span className="pm-live-dot" /> : null}
          {badgeLabel}
        </span>
      </div>

      <div className="pm-americano-v2-list-body">
        <div className="pm-americano-v2-list-venue">
          <MapPin size={12} aria-hidden />
          {courtName}
        </div>

        <div className="pm-americano-v2-list-progress-row">
          <div
            className={`pm-americano-v2-list-progress${isFullBar ? ' pm-americano-v2-list-progress--full' : ''}`}
            role="progressbar"
            aria-valuenow={filled}
            aria-valuemin={0}
            aria-valuemax={maxPlayers}
          >
            <div
              className="pm-americano-v2-list-progress-fill"
              style={{ width: `${isFullBar ? 100 : fillPct}%` }}
            />
          </div>
          <span className={`pm-americano-v2-list-progress-count${isFullBar ? ' pm-americano-v2-list-progress-count--full' : ''}`}>
            {filled}/{maxPlayers}
          </span>
        </div>

        <div className="pm-americano-v2-list-footer">
          <div className="pm-americano-v2-list-meta">
            <span className="pm-americano-v2-list-meta-pill">
              <Clock size={11} aria-hidden />
              {totalRounds} runder
            </span>
            <span className="pm-americano-v2-list-meta-pill">
              <LayoutGrid size={11} aria-hidden />
              {courts} bane{courts !== 1 ? 'r' : ''}{bench > 0 ? ` · ${bench} over` : ''}
            </span>
            <span className="pm-americano-v2-list-meta-pill">
              {durationLabel}
            </span>
          </div>

          <div className="pm-americano-v2-list-participants">
            <div className="pm-americano-v2-list-avatar-stack" aria-hidden>
              {visibleParticipants.map((p, idx) => (
                <AvatarCircle
                  key={p.user_id}
                  avatar={p.avatar || playerInitials(p.display_name)}
                  size={28}
                  emojiSize="11px"
                  style={{ zIndex: idx + 1 }}
                />
              ))}
            </div>
            {overflow > 0 ? (
              <span className="pm-americano-v2-list-overflow">+{overflow}</span>
            ) : null}
            {showMyEloDelta ? (
              <span
                className={`pm-kampe-v2-list-elo-result pm-americano-v2-list-elo${eloDelta! >= 0 ? ' pm-kampe-v2-list-elo-result--up' : ' pm-kampe-v2-list-elo-result--down'}`}
              >
                {eloDelta! >= 0 ? '+' : ''}
                {eloDelta} ELO
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </button>
  )
}
