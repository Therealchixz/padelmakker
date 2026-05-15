import type { CSSProperties, ReactNode } from 'react'
import { isAvatarUrl } from '../../lib/avatarUpload'

/** Antal runder per spiller-count, matcher schedule578.ts og schedule8.ts. */
const ROUNDS_BY_SLOTS: Record<number, number> = {
  5: 5,
  6: 6,
  7: 7,
  8: 7,
}
const MIN_PER_ROUND = 12

const C = {
  accent: '#1D4ED8',
  sky: '#0EA5E9',
  white: '#FFFFFF',
  bgBlue: '#DBEAFE',
  text: '#0B1120',
  textMid: '#3E4C63',
  textDim: '#94A3B8',
  border: '#E2E8F0',
  green: '#059669',
  greenBg: '#D1FAE5',
  amber: '#D97706',
  amberBg: '#FEF3C7',
  trackBg: '#E2E8F0',
  neutralBg: '#F1F5F9',
}

type AmericanoOpenCardPlayer = {
  id: string
  name: string
  avatar: string | null
  isMe: boolean
  /** Vises kun hvis sat — render et lille × i hjørnet af avataren */
  onKick?: () => void
  kickBusy?: boolean
  /** Kald når avataren klikkes — typisk åbn spillerens stats-modal */
  onView?: () => void
}

type AmericanoOpenCardProps = {
  tournamentName: string
  dateLabel: string
  description?: string | null
  maxPlayers: number
  players: AmericanoOpenCardPlayer[]
  opponentPasses?: number | null
  /** Tekst der vises i bunden — typisk Tilmeld/Afmeld og evt. start/admin-knapper */
  actions?: ReactNode
  /** "Du er tilmeldt"-note der vises mellem footer og actions hvis sat */
  joinedNote?: ReactNode
  /** Ekstra blokke vist nedenfor (fx admin-værktøjer, start-turnering-knap) */
  extras?: ReactNode
}

function badgeStyle(bg: string, color: string): CSSProperties {
  return {
    fontSize: 10,
    fontWeight: 700,
    padding: '3px 9px',
    borderRadius: 6,
    background: bg,
    color,
    letterSpacing: 0.2,
    whiteSpace: 'nowrap',
    lineHeight: 1.3,
  }
}

function PlayerInitials({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() || '')
    .join('') || '?'
  return <span style={{ fontSize: 13, fontWeight: 700 }}>{initials}</span>
}

function PlayerAvatar({ avatar, name, clickable }: { avatar: string | null; name: string; clickable: boolean }) {
  return (
    <div
      className={clickable ? 'pm-avatar-circle pm-avatar-circle--clickable' : 'pm-avatar-circle'}
      style={{
        width: 44,
        height: 44,
        borderRadius: '50%',
        background: C.accent,
        color: C.white,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: `2.5px solid ${C.white}`,
        boxShadow: '0 1px 4px rgba(29,78,216,0.2)',
        overflow: 'hidden',
      }}
      aria-hidden
    >
      {avatar && isAvatarUrl(avatar) ? (
        <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : avatar ? (
        <span style={{ fontSize: 20 }}>{avatar}</span>
      ) : (
        <PlayerInitials name={name} />
      )}
    </div>
  )
}

function EmptySlot() {
  return (
    <div
      style={{
        width: 44,
        height: 44,
        borderRadius: '50%',
        border: `2px dashed #CBD5E1`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
      }}
      aria-hidden
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <line x1="7" y1="2" x2="7" y2="12" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" />
        <line x1="2" y1="7" x2="12" y2="7" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  )
}

export function AmericanoOpenCard({
  tournamentName,
  dateLabel,
  description,
  maxPlayers,
  players,
  opponentPasses,
  actions,
  joinedNote,
  extras,
}: AmericanoOpenCardProps) {
  const filled = players.length
  const emptySlots = Math.max(0, maxPlayers - filled)
  const isFull = emptySlots === 0
  const isAlmostFull = emptySlots === 1
  const fillPct = Math.min(100, Math.round((filled / maxPlayers) * 100))

  const baseRounds = ROUNDS_BY_SLOTS[maxPlayers] ?? maxPlayers
  const passes = opponentPasses === 2 ? 2 : 1
  const totalRounds = baseRounds * passes
  const estMinutes = totalRounds * MIN_PER_ROUND

  /** Grid columns afhænger af spillerantal — undgår at en enkelt række ikke fyldes ud */
  const gridCols = maxPlayers <= 4 ? 4 : maxPlayers <= 6 ? 3 : 4

  return (
    <div
      className="pm-ui-card"
      style={{
        background: C.white,
        border: `1px solid ${C.border}`,
        borderRadius: 16,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 14px rgba(0,0,0,0.04)',
        overflow: 'hidden',
      }}
    >
      {/* 1. Badge row */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '14px 16px 0' }}>
        <span style={badgeStyle(isFull ? C.amberBg : C.greenBg, isFull ? C.amber : C.green)}>
          {isFull ? 'Fuld' : 'Åben'}
        </span>
        <span style={badgeStyle(C.bgBlue, C.accent)}>Americano</span>
        <span style={badgeStyle(C.neutralBg, C.textMid)}>
          {filled}/{maxPlayers} spillere
        </span>
      </div>

      {/* 2. Title + meta */}
      <div style={{ padding: '10px 16px 0' }}>
        <div
          style={{
            fontSize: 17,
            fontWeight: 800,
            letterSpacing: '-0.02em',
            color: C.text,
            lineHeight: 1.25,
          }}
        >
          {tournamentName}
        </div>
        <div
          style={{
            marginTop: 3,
            fontSize: 12,
            color: C.textMid,
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <span>📅 {dateLabel}</span>
        </div>
        {description ? (
          <div
            style={{
              marginTop: 6,
              fontSize: 12,
              color: C.textMid,
              fontStyle: 'italic',
              lineHeight: 1.45,
            }}
          >
            {description}
          </div>
        ) : null}
      </div>

      {/* 3. Player area */}
      <div style={{ padding: '16px 16px 0' }}>
        {/* 3a. Fill header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
            gap: 8,
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 600, color: C.textMid }}>
            {filled} af {maxPlayers} tilmeldt
          </span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: isFull ? C.green : isAlmostFull ? C.amber : C.green,
              textAlign: 'right',
            }}
          >
            {isFull
              ? 'Klar til start ✓'
              : `${emptySlots} ${emptySlots === 1 ? 'plads' : 'pladser'} tilbage`}
          </span>
        </div>

        {/* 3b. Progress bar */}
        <div
          style={{
            height: 5,
            borderRadius: 3,
            background: C.trackBg,
            overflow: 'hidden',
            marginBottom: 18,
          }}
        >
          <div
            style={{
              width: `${fillPct}%`,
              height: '100%',
              background: `linear-gradient(90deg, ${C.accent}, ${C.sky})`,
              transition: 'width 0.25s ease',
            }}
          />
        </div>

        {/* 3c. Player grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
            rowGap: 14,
            columnGap: 8,
            justifyItems: 'center',
          }}
        >
          {players.map((p) => {
            const avatarEl = <PlayerAvatar avatar={p.avatar} name={p.name} clickable={Boolean(p.onView)} />
            return (
              <div key={p.id} style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, minWidth: 0 }}>
                {p.onView ? (
                  <button
                    type="button"
                    onClick={p.onView}
                    aria-label={`Åbn statistik for ${p.name}`}
                    title="Se Americano-statistik"
                    style={{
                      border: 'none',
                      background: 'transparent',
                      padding: 0,
                      cursor: 'pointer',
                      display: 'flex',
                    }}
                  >
                    {avatarEl}
                  </button>
                ) : (
                  avatarEl
                )}
                {p.onKick && (
                  <button
                    type="button"
                    onClick={p.onKick}
                    disabled={p.kickBusy}
                    aria-label={`Fjern ${p.name}`}
                    title={`Fjern ${p.name}`}
                    style={{
                      position: 'absolute',
                      top: -4,
                      right: 'calc(50% - 26px)',
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      border: 'none',
                      background: '#DC2626',
                      color: '#FFFFFF',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: p.kickBusy ? 'wait' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 0,
                      lineHeight: 1,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.18)',
                      zIndex: 1,
                    }}
                  >
                    ×
                  </button>
                )}
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: C.text,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: '100%',
                    textAlign: 'center',
                  }}
                  title={p.name}
                >
                  {p.name.split(' ')[0]}
                  {p.isMe ? <span style={{ color: C.accent }}> (dig)</span> : null}
                </span>
              </div>
            )
          })}
          {Array.from({ length: emptySlots }).map((_, i) => (
            <div
              key={`empty-${i}`}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}
            >
              <EmptySlot />
              <span style={{ fontSize: 11, fontWeight: 600, color: C.textDim }}>Ledig</span>
            </div>
          ))}
        </div>

        {/* 3d. Info footer */}
        <div
          style={{
            marginTop: 14,
            paddingTop: 12,
            borderTop: `1px solid ${C.border}`,
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: 14,
            fontSize: 10,
            fontWeight: 500,
            color: C.textDim,
          }}
        >
          <span>⏱ {totalRounds} runder</span>
          <span>⏳ ~{estMinutes} min</span>
          <span>🔄 Alle spiller med alle</span>
        </div>
      </div>

      {/* 4. Actions / joinedNote */}
      {(actions || joinedNote || extras) ? (
        <div style={{ padding: '14px 16px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {actions}
          {joinedNote}
          {extras}
        </div>
      ) : null}
    </div>
  )
}
