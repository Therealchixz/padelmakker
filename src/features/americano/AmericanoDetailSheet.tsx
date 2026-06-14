import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { Plus, X } from 'lucide-react'
import '../../styles/kampdetalje.css'
import { KampeVenueLocationLine } from '../../components/kampe/KampeVenueLocationLine'
import { resolveCourtNameDirectionsQuery } from '../../lib/kampeListFilterCore'
import { isAvatarUrl } from '../../lib/avatarUpload'
import { useBottomSheetDragToClose } from '../../lib/useBottomSheetDragToClose'
import {
  formatAmericanoLiveRoundLabel,
  formatCourtsBenchDetail,
  getAmericanoTournamentMeta,
  getAmericanoDurationLabel,
  getTournamentFormatLabel,
  playerInitials,
  resolveAmericanoCourtName,
} from './americanoDisplayUtils'
import { AmericanoCompletedCard } from './AmericanoCompletedCard'
import type { AmericanoTournament } from './types'

type CompletedParticipant = {
  id: string
  user_id: string
  display_name: string
  avatar?: string | null
  full_name?: string | null
}

export type AmericanoDetailPlayer = {
  id: string
  user_id: string
  name: string
  avatar?: string | null
  isMe?: boolean
  elo?: number | null
  points?: number | null
  eloChange?: number | null
  onView?: () => void
  onKick?: () => void
  kickBusy?: boolean
}

type Props = {
  open: boolean
  onClose: () => void
  tournament: AmericanoTournament | null
  courts: { id: string; name: string }[]
  dateLabel: string
  status: 'registration' | 'playing' | 'completed'
  participants: AmericanoDetailPlayer[]
  joined?: boolean
  tournamentFull?: boolean
  liveRound?: number | null
  roundProgress?: {
    totalRounds: number
    completedRounds: number
    liveRound: number | null
  } | null
  playedDurationMinutes?: number | null
  description?: string | null
  actions?: ReactNode
  joinedNote?: ReactNode
  extras?: ReactNode
  resultsPanel?: ReactNode
  completedTournament?: {
    participants: CompletedParticipant[]
    currentUserId: string
    isCreator: boolean
    onParticipantView: (userId: string, name: string) => void
  } | null
}

function badgeToneClass(tone: string) {
  if (tone === 'live') return 'pm-kampe-v2-badge--live'
  if (tone === 'open') return 'pm-kampe-v2-badge--open'
  if (tone === 'full') return 'pm-kampe-v2-badge--full'
  if (tone === 'closed') return 'pm-kampe-v2-badge--closed'
  return 'pm-kampe-v2-badge--neutral'
}

function PlayerTile({
  player,
  empty = false,
}: {
  player?: AmericanoDetailPlayer
  empty?: boolean
}) {
  if (empty || !player) {
    return (
      <div className="pm-americano-v2-detail-player pm-americano-v2-detail-player--empty">
        <div className="pm-americano-v2-detail-player-avatar pm-americano-v2-detail-player-avatar--empty">
          <Plus size={14} aria-hidden />
        </div>
        <span className="pm-americano-v2-detail-player-name">Ledig</span>
      </div>
    )
  }

  const av = player.avatar
  const avatarInner =
    av && isAvatarUrl(av) ? (
      <img src={av} alt="" />
    ) : av ? (
      <span>{av}</span>
    ) : (
      <span>{playerInitials(player.name)}</span>
    )

  const avatarEl = (
    <div className="pm-americano-v2-detail-player-avatar">{avatarInner}</div>
  )

  return (
    <div className="pm-americano-v2-detail-player">
      {player.onView ? (
        <button
          type="button"
          className="pm-americano-v2-detail-player-btn"
          onClick={player.onView}
          aria-label={`Se statistik for ${player.name}`}
        >
          {avatarEl}
        </button>
      ) : (
        avatarEl
      )}
      {player.onKick ? (
        <button
          type="button"
          className="pm-americano-v2-detail-player-kick"
          onClick={player.onKick}
          disabled={player.kickBusy}
          aria-label={`Fjern ${player.name}`}
        >
          ×
        </button>
      ) : null}
      <span className={`pm-americano-v2-detail-player-name${player.isMe ? ' pm-americano-v2-detail-player-name--me' : ''}`}>
        {player.name.split(' ')[0]}
        {player.isMe ? ' (dig)' : ''}
      </span>
      {player.elo != null && Number.isFinite(player.elo) ? (
        <span className="pm-americano-v2-detail-player-elo">{Math.round(player.elo)}</span>
      ) : null}
      {player.eloChange != null && Number.isFinite(player.eloChange) ? (
        <span
          className={`pm-americano-v2-detail-player-elo-delta${player.eloChange >= 0 ? ' pm-americano-v2-detail-player-elo-delta--up' : ' pm-americano-v2-detail-player-elo-delta--down'}`}
        >
          {player.eloChange >= 0 ? '+' : ''}
          {player.eloChange} ELO
        </span>
      ) : null}
      {player.points != null ? (
        <span className="pm-americano-v2-detail-player-points">{player.points} pt</span>
      ) : null}
    </div>
  )
}

export function AmericanoDetailSheet({
  open,
  onClose,
  tournament,
  courts,
  dateLabel,
  status,
  participants,
  joined: _joined = false,
  tournamentFull = false,
  liveRound = null,
  roundProgress = null,
  playedDurationMinutes = null,
  description,
  actions,
  joinedNote,
  extras,
  resultsPanel,
  completedTournament,
}: Props) {
  const [resultsExpanded, setResultsExpanded] = useState(false)
  const { sheetRef, dragZoneProps, sheetStyle, sheetClassName } = useBottomSheetDragToClose({
    onClose,
    enabled: open,
  })

  useEffect(() => {
    if (!open) setResultsExpanded(false)
  }, [open])

  if (!open || !tournament) return null

  const courtName = resolveAmericanoCourtName(tournament.court_id, courts)
  const directionsQuery = resolveCourtNameDirectionsQuery(courtName)
  const { maxPlayers, totalRounds: metaTotalRounds, estMinutes, courts: courtsPerRound, bench } =
    getAmericanoTournamentMeta(tournament)
  const totalRounds = roundProgress?.totalRounds ?? metaTotalRounds
  const activeLiveRound = roundProgress?.liveRound ?? liveRound
  const courtsBenchDetail = formatCourtsBenchDetail(courtsPerRound, bench)
  const durationLabel = getAmericanoDurationLabel(status, playedDurationMinutes, estMinutes)
  const filled = participants.length
  const emptySlots = Math.max(0, maxPlayers - filled)
  const fillPct = maxPlayers > 0 ? Math.min(100, Math.round((filled / maxPlayers) * 100)) : 0
  const isCompleted = status === 'completed'
  const isPlaying = status === 'playing'
  const isFullBar = isPlaying || isCompleted || tournamentFull

  let badgeLabel = 'Åben'
  let badgeTone = 'open'
  if (isCompleted) {
    badgeLabel = 'Afsluttet'
    badgeTone = 'closed'
  } else if (isPlaying) {
    badgeTone = 'live'
    badgeLabel =
      activeLiveRound != null && totalRounds > 0
        ? formatAmericanoLiveRoundLabel(activeLiveRound, totalRounds)
        : 'I gang'
  } else if (tournamentFull) {
    badgeLabel = 'Fuld'
    badgeTone = 'full'
  }

  const gridCols = maxPlayers <= 4 ? 2 : 2

  return (
    <>
      <button
        type="button"
        className="pm-kampe-v2-sheet-backdrop"
        aria-label="Luk Americano/Mexicano-detaljer"
        onClick={onClose}
      />
      <div
        ref={sheetRef}
        className={`pm-kampe-v2-sheet pm-kampe-v2-detail-sheet pm-americano-v2-detail-sheet${sheetClassName ? ` ${sheetClassName}` : ''}`}
        style={sheetStyle}
        role="dialog"
        aria-modal="true"
        aria-label="Americano/Mexicano-detaljer"
      >
        <div {...dragZoneProps} aria-label="Træk her for at lukke">
          <div className="pm-kampe-v2-sheet-handle" aria-hidden />
          <div className="pm-americano-v2-detail-head">
            <div className="pm-americano-v2-detail-head-main">
              <div className="pm-americano-v2-detail-type">{getTournamentFormatLabel(tournament.format)}</div>
              <h2 className="pm-americano-v2-detail-title">{tournament.name}</h2>
              <div className="pm-americano-v2-detail-location">
                <KampeVenueLocationLine
                  label={courtName}
                  directionsQuery={directionsQuery}
                  className="pm-americano-v2-detail-location-venue"
                  prominent
                />
                <span className="pm-americano-v2-detail-location-date"> · {dateLabel}</span>
              </div>
            </div>
            <div className="pm-americano-v2-detail-head-right">
              <span className={`pm-kampe-v2-badge ${badgeToneClass(badgeTone)}`}>
                {badgeTone === 'live' ? <span className="pm-live-dot" /> : null}
                {badgeLabel}
              </span>
              <button
                type="button"
                className="pm-kampe-v2-detail-close"
                onClick={onClose}
                onPointerDown={(event) => event.stopPropagation()}
                aria-label="Luk"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        </div>

        <div className="pm-americano-v2-detail-scroll">
        {/* Court hero visual */}
        <div className="pm-kd-hero" style={{ marginBottom: 0, borderRadius: 0 }} aria-hidden="true">
          <div className="pm-kd-hero-court" />
          <div className="pm-kd-hero-badges">
            <span className={`pm-kd-chip ${badgeTone === 'live' ? 'pm-kd-chip--amber' : 'pm-kd-chip--navy'}`}>
              {getTournamentFormatLabel(tournament.format).toUpperCase()}
            </span>
            {badgeTone === 'live' ? (
              <span className="pm-kd-chip pm-kd-chip--live">LIVE · {badgeLabel}</span>
            ) : null}
          </div>
        </div>
        <div className="pm-americano-v2-detail-stats">
          <div className="pm-americano-v2-detail-stat">
            <span className="pm-americano-v2-detail-stat-label">Runder</span>
            <span className="pm-americano-v2-detail-stat-value">{totalRounds}</span>
          </div>
          <div className="pm-americano-v2-detail-stat">
            <span className="pm-americano-v2-detail-stat-label">Varighed</span>
            <span className="pm-americano-v2-detail-stat-value">{durationLabel}</span>
          </div>
          <div
            className="pm-americano-v2-detail-stat"
            aria-label={courtsBenchDetail.ariaLabel}
          >
            <span className="pm-americano-v2-detail-stat-label">Pr. runde</span>
            <span className="pm-americano-v2-detail-stat-value">{courtsBenchDetail.primary}</span>
            {courtsBenchDetail.secondary ? (
              <span className="pm-americano-v2-detail-stat-value-sub">{courtsBenchDetail.secondary}</span>
            ) : null}
          </div>
        </div>

        <div className="pm-americano-v2-detail-fill">
          <div className="pm-americano-v2-detail-fill-row">
            <span className="pm-americano-v2-detail-fill-label">
              {filled} af {maxPlayers} tilmeldt
            </span>
            {!isCompleted && !isPlaying && !tournamentFull ? (
              <span className="pm-americano-v2-detail-fill-left">
                {emptySlots} {emptySlots === 1 ? 'plads' : 'pladser'} tilbage
              </span>
            ) : null}
          </div>
          <div className="pm-americano-v2-detail-progress-row">
            <div
              className={`pm-americano-v2-detail-progress${isFullBar ? ' pm-americano-v2-detail-progress--full' : ''}`}
            >
              <div
                className="pm-americano-v2-detail-progress-fill"
                style={{ width: `${isFullBar ? 100 : fillPct}%` }}
              />
            </div>
            <span className={`pm-americano-v2-detail-progress-count${isFullBar ? ' pm-americano-v2-detail-progress-count--full' : ''}`}>
              {filled}/{maxPlayers}
            </span>
          </div>
        </div>

        {description ? (
          <p className="pm-kampe-v2-detail-desc">{description}</p>
        ) : null}

        {!isCompleted ? (
          <div className="pm-americano-v2-detail-players-section">
            <div className="pm-americano-v2-detail-players-label">Spillere</div>
            <div
              className="pm-americano-v2-detail-players-grid"
              style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }}
            >
              {participants.map((p) => (
                <PlayerTile key={p.id} player={p} />
              ))}
              {Array.from({ length: emptySlots }).map((_, i) => (
                <PlayerTile key={`empty-${i}`} empty />
              ))}
            </div>
          </div>
        ) : null}

        {joinedNote}
        {actions}

        {isPlaying && resultsPanel ? (
          <div className="pm-americano-v2-detail-results">{resultsPanel}</div>
        ) : null}

        {isCompleted && completedTournament ? (
          <div className="pm-americano-v2-detail-completed">
            <AmericanoCompletedCard
              tournament={tournament}
              dateLabel={dateLabel}
              participants={completedTournament.participants}
              currentUserId={completedTournament.currentUserId}
              summaryOpen={false}
              onSummaryToggle={() => {}}
              onParticipantView={completedTournament.onParticipantView}
              isCreator={completedTournament.isCreator}
              embedInSheet
              sheetSplitView
              matchesExpanded={resultsExpanded}
            />
            {!resultsExpanded ? (
              <button
                type="button"
                className="pm-americano-v2-detail-result-btn"
                onClick={() => setResultsExpanded(true)}
              >
                Se resultat
              </button>
            ) : null}
          </div>
        ) : null}

        {extras}
        </div>
      </div>
    </>
  )
}
