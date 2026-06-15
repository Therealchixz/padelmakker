import { CalendarDays, MapPin } from 'lucide-react'
import { AvatarCircle } from '../../components/AvatarCircle'
import { formatMatchDateHeadlineDa, formatTimeSlotDa } from '../../lib/matchDisplayUtils'
import {
  getAmericanoTournamentMeta,
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
  roundProgress?: {
    totalRounds: number
    completedRounds: number
    liveRound: number | null
  } | null
  myEloChange?: number | null
  playedDurationMinutes?: number | null
  onClick?: () => void
}

const MAX_AVATARS = 4

function fmtLevel(v: number | null | undefined): string {
  const n = Number(v)
  if (!Number.isFinite(n)) return ''
  return n.toFixed(1)
}

function levelLabel(t: AmericanoTournament): string {
  const min = t.level_min
  const max = t.level_max
  if (min != null && max != null) return `Niveau ${fmtLevel(min)}–${fmtLevel(max)}`
  return 'Alle niveauer'
}

function endTimeLabel(timeSlot: string, durationMinutes: number | null | undefined): string {
  const [h, m] = String(timeSlot || '').split(':').map(Number)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return ''
  const dur = Number(durationMinutes) || 0
  if (dur <= 0) return ''
  const end = h * 60 + m + dur
  return `${String(Math.floor(end / 60) % 24).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`
}

function priceLabel(t: AmericanoTournament): string {
  const p = Number(t.price_per_person)
  if (!Number.isFinite(p) || p <= 0 || t.payment_method === 'free') return 'Gratis'
  return p % 1 === 0 ? `${p} kr.` : `${p.toFixed(2).replace('.', ',')} kr.`
}

export function AmericanoListCard({
  tournament,
  courtName,
  participants,
  status,
  joined = false,
  tournamentFull = false,
  liveRound = null,
  roundProgress = null,
  myEloChange = null,
  playedDurationMinutes = null,
  onClick,
}: Props) {
  const { maxPlayers, totalRounds: metaTotalRounds } = getAmericanoTournamentMeta(tournament)
  const totalRounds = roundProgress?.totalRounds ?? metaTotalRounds
  const filled = participants.length
  const isCompleted = status === 'completed'
  const isPlaying = status === 'playing'
  const isMexicano = (tournament.format ?? 'americano') === 'mexicano'
  const formatLabel = getTournamentFormatLabel(tournament.format)
  const activeRound = roundProgress?.liveRound ?? liveRound

  const dateHeadline = formatMatchDateHeadlineDa(tournament.tournament_date)
  const startTime = formatTimeSlotDa(tournament.time_slot)
  const endTime = endTimeLabel(tournament.time_slot, tournament.duration_minutes)
  const timeRange = endTime ? `${startTime}–${endTime}` : startTime

  const showMyEloDelta =
    isCompleted && joined && myEloChange != null && Number.isFinite(Number(myEloChange))
  const eloDelta = showMyEloDelta ? Number(myEloChange) : null

  const visibleParticipants = participants.slice(0, MAX_AVATARS)
  const overflow = Math.max(0, filled - MAX_AVATARS)
  const isFull = tournamentFull || (maxPlayers > 0 && filled >= maxPlayers)

  const formatChipBg = isMexicano ? '#F59E0B' : '#22C55E'

  return (
    <div
      role="button"
      tabIndex={0}
      id={`pm-americano-${tournament.id}`}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.() } }}
      aria-label={`Åbn ${formatLabel}: ${tournament.name}`}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        border: '1px solid var(--pm-border)',
        borderRadius: 16,
        overflow: 'hidden',
        background: 'var(--pm-surface)',
        boxShadow: 'var(--pm-shadow-soft)',
        cursor: 'pointer',
        marginBottom: 14,
        scrollMarginTop: '88px',
      }}
    >
      {/* Hero */}
      <div style={{ position: 'relative', background: 'linear-gradient(135deg, #0D2752 0%, #16377E 100%)', padding: '12px 14px', minHeight: 92, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ background: formatChipBg, color: '#fff', fontSize: 9.5, fontWeight: 800, padding: '3px 8px', borderRadius: 5, letterSpacing: '0.6px', textTransform: 'uppercase' }}>
            {formatLabel}
          </span>
          <span style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: 9.5, fontWeight: 600, padding: '3px 8px', borderRadius: 5, border: '1px solid rgba(255,255,255,0.25)' }}>
            {levelLabel(tournament)}
          </span>
          {isPlaying ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(220,38,38,0.9)', color: '#fff', fontSize: 9.5, fontWeight: 800, padding: '3px 8px', borderRadius: 5, letterSpacing: '0.6px' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />
              LIVE
            </span>
          ) : null}
          {isCompleted ? (
            <span style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: 9.5, fontWeight: 700, padding: '3px 8px', borderRadius: 5, border: '1px solid rgba(255,255,255,0.25)' }}>
              Afsluttet
            </span>
          ) : null}
        </div>
        {/* faint court illustration */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ width: 80, height: 38, background: 'rgba(255,255,255,0.10)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.18)', position: 'relative' }}>
            <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.25)' }} />
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '12px 14px' }}>
        <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--pm-text)', letterSpacing: '-0.2px', marginBottom: 7 }}>
          {tournament.name}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--pm-text-light)', marginBottom: 3 }}>
          <CalendarDays size={13} strokeWidth={2} aria-hidden />
          {dateHeadline} · {timeRange}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--pm-text-light)' }}>
          <MapPin size={13} strokeWidth={2} aria-hidden />
          {courtName}
        </div>

        {/* Footer — varierer pr. tilstand */}
        {status === 'registration' ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 12, paddingTop: 11, borderTop: '1px solid var(--pm-border)' }}>
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--pm-text-light)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 1 }}>Pris</div>
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--pm-text)' }}>{priceLabel(tournament)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--pm-text-light)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 1 }}>Pladser</div>
                <div style={{ fontWeight: 700, fontSize: 15, color: isFull ? 'var(--pm-red)' : 'var(--pm-text)' }}>
                  {isFull ? 'FULDT' : `${filled} / ${maxPlayers}`}
                </div>
              </div>
            </div>
            <div
              style={{
                marginTop: 12, padding: 12, borderRadius: 10, textAlign: 'center',
                fontWeight: 700, fontSize: 13,
                background: joined ? 'var(--pm-surface)' : isFull ? 'var(--pm-surface-muted)' : 'var(--pm-navy)',
                color: joined ? 'var(--pm-navy)' : isFull ? 'var(--pm-text-light)' : '#fff',
                border: joined ? '1.5px solid var(--pm-border)' : 'none',
              }}
            >
              {joined ? 'Tilmeldt ✓' : isFull ? 'Fyldt op' : 'Tilmeld'}
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 11, borderTop: '1px solid var(--pm-border)', gap: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--pm-text-mid)' }}>
              {isPlaying
                ? (activeRound != null && totalRounds > 0 ? `Runde ${activeRound} af ${totalRounds}` : 'I gang')
                : `${totalRounds} runder · ${filled} spillere`}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ display: 'flex' }} aria-hidden>
                {visibleParticipants.map((p, idx) => (
                  <AvatarCircle
                    key={p.user_id}
                    avatar={p.avatar || playerInitials(p.display_name)}
                    size={26}
                    emojiSize="11px"
                    style={{ marginLeft: idx > 0 ? -8 : 0, border: '2px solid var(--pm-surface)', zIndex: idx + 1 }}
                  />
                ))}
                {overflow > 0 ? (
                  <span style={{ marginLeft: -8, width: 26, height: 26, borderRadius: '50%', background: 'var(--pm-surface-muted)', border: '2px solid var(--pm-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'var(--pm-text-mid)' }}>
                    +{overflow}
                  </span>
                ) : null}
              </div>
              {showMyEloDelta ? (
                <span style={{ fontSize: 12, fontWeight: 700, color: eloDelta! >= 0 ? 'var(--pm-success)' : 'var(--pm-danger)' }}>
                  Elo {eloDelta! >= 0 ? '+' : '−'}{Math.abs(eloDelta!)}
                </span>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
