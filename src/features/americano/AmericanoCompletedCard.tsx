import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, ChevronDown, Trophy } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { isAvatarUrl } from '../../lib/avatarUpload'
import { theme } from '../../lib/platformTheme'
import type { AmericanoMatchRow, AmericanoTournament } from './types'
import {
  americanoOutcomeColors,
  americanoOutcomeForUserInMatch,
  americanoViewerStatusLabel,
  userIsOnCourtInAmericanoMatch,
} from './americanoOutcomeColors'

type PartMin = {
  id: string
  user_id: string
  display_name: string
  /** Optional snippet info — bruges til avatar/forkortelse på podium */
  avatar?: string | null
  full_name?: string | null
}

type AmericanoEloSnap = {
  change: number
  oldRating: number | null
  newRating: number | null
}

function eloDeltaColor(delta: number) {
  if (delta > 0) return theme.green
  if (delta < 0) return theme.red
  return theme.textMid
}

function coercePointsPerMatch(t: AmericanoTournament): 16 | 24 | 32 {
  const ppm = Number(t.points_per_match)
  return ppm === 16 || ppm === 24 || ppm === 32 ? ppm : 16
}

function isValidScore(a: number, b: number, P: number): boolean {
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) return false
  return a + b === P
}

function buildLeaderboardTotals(
  participants: PartMin[],
  matches: AmericanoMatchRow[],
  P: number
) {
  const totals = new Map<string, number>()
  participants.forEach((p) => totals.set(p.id, 0))
  for (const m of matches) {
    if (m.team_a_score == null || m.team_b_score == null) continue
    const a = m.team_a_score
    const b = m.team_b_score
    if (!isValidScore(a, b, P)) continue
    const add = (pid: string, pts: number) => totals.set(pid, (totals.get(pid) ?? 0) + pts)
    add(m.team_a_p1, a)
    add(m.team_a_p2, a)
    add(m.team_b_p1, b)
    add(m.team_b_p2, b)
  }
  return participants
    .map((p) => ({ id: p.id, name: p.display_name, points: totals.get(p.id) ?? 0 }))
    .sort((x, y) => y.points - x.points)
}

function firstNameOf(s: string): string {
  return String(s || '').trim().split(/\s+/)[0] || s
}

function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() || '')
      .join('') || '?'
  )
}

type Highlight =
  | { kind: 'biggestWin'; partnerName: string; opponents: [string, string]; a: number; b: number }
  | { kind: 'closestMatch'; mine: [string, string]; theirs: [string, string]; a: number; b: number }
  | { kind: 'bestPartner'; partnerName: string; wins: number; played: number }

function computeHighlights(
  matches: AmericanoMatchRow[],
  participants: PartMin[],
  currentUserId: string,
  P: number
): Highlight[] {
  const userIdByPartId = new Map<string, string>()
  participants.forEach((p) => userIdByPartId.set(p.id, p.user_id))
  const nameByPart = (pid: string) =>
    firstNameOf(participants.find((p) => p.id === pid)?.display_name || '?')

  const myParticipant = participants.find((p) => String(p.user_id) === String(currentUserId))
  const myPartId = myParticipant?.id

  const validMatches = matches.filter(
    (m) =>
      m.team_a_score != null &&
      m.team_b_score != null &&
      isValidScore(m.team_a_score, m.team_b_score, P)
  )

  const out: Highlight[] = []

  if (myPartId) {
    /* Bedste sejr: største pointforskel hvor jeg vandt */
    let bestWin: { margin: number; m: AmericanoMatchRow } | null = null
    for (const m of validMatches) {
      const onA = m.team_a_p1 === myPartId || m.team_a_p2 === myPartId
      const onB = m.team_b_p1 === myPartId || m.team_b_p2 === myPartId
      if (!onA && !onB) continue
      const my = onA ? (m.team_a_score as number) : (m.team_b_score as number)
      const opp = onA ? (m.team_b_score as number) : (m.team_a_score as number)
      if (my <= opp) continue
      const margin = my - opp
      if (!bestWin || margin > bestWin.margin) bestWin = { margin, m }
    }
    if (bestWin) {
      const m = bestWin.m
      const onA = m.team_a_p1 === myPartId || m.team_a_p2 === myPartId
      const partnerId = onA
        ? m.team_a_p1 === myPartId
          ? m.team_a_p2
          : m.team_a_p1
        : m.team_b_p1 === myPartId
          ? m.team_b_p2
          : m.team_b_p1
      const opps: [string, string] = onA
        ? [m.team_b_p1, m.team_b_p2]
        : [m.team_a_p1, m.team_a_p2]
      out.push({
        kind: 'biggestWin',
        partnerName: nameByPart(partnerId),
        opponents: [nameByPart(opps[0]), nameByPart(opps[1])],
        a: onA ? (m.team_a_score as number) : (m.team_b_score as number),
        b: onA ? (m.team_b_score as number) : (m.team_a_score as number),
      })
    }

    /* Bedste makker: flest sejre sammen (kun makkerskaber jeg var med i) */
    const partnerStats = new Map<string, { wins: number; played: number; name: string }>()
    for (const m of validMatches) {
      const onA = m.team_a_p1 === myPartId || m.team_a_p2 === myPartId
      const onB = m.team_b_p1 === myPartId || m.team_b_p2 === myPartId
      if (!onA && !onB) continue
      const partnerId = onA
        ? m.team_a_p1 === myPartId
          ? m.team_a_p2
          : m.team_a_p1
        : m.team_b_p1 === myPartId
          ? m.team_b_p2
          : m.team_b_p1
      const my = onA ? (m.team_a_score as number) : (m.team_b_score as number)
      const opp = onA ? (m.team_b_score as number) : (m.team_a_score as number)
      const prev = partnerStats.get(partnerId) || {
        wins: 0,
        played: 0,
        name: nameByPart(partnerId),
      }
      prev.played += 1
      if (my > opp) prev.wins += 1
      partnerStats.set(partnerId, prev)
    }
    let best: { id: string; wins: number; played: number; name: string } | null = null
    partnerStats.forEach((v, id) => {
      if (!best || v.wins > best.wins || (v.wins === best.wins && v.played > best.played)) {
        best = { id, ...v }
      }
    })
    if (best && (best as { wins: number }).wins > 0) {
      const b = best as { wins: number; played: number; name: string }
      out.push({
        kind: 'bestPartner',
        partnerName: b.name,
        wins: b.wins,
        played: b.played,
      })
    }
  }

  /* Tætteste kamp: mindste positive margin på tværs af alle kampe (uafgjorte ekskluderes) */
  let closest: { diff: number; m: AmericanoMatchRow } | null = null
  for (const m of validMatches) {
    const a = m.team_a_score as number
    const b = m.team_b_score as number
    if (a === b) continue
    const diff = Math.abs(a - b)
    if (!closest || diff < closest.diff) closest = { diff, m }
  }
  if (closest) {
    const m = closest.m
    out.push({
      kind: 'closestMatch',
      mine: [nameByPart(m.team_a_p1), nameByPart(m.team_a_p2)],
      theirs: [nameByPart(m.team_b_p1), nameByPart(m.team_b_p2)],
      a: m.team_a_score as number,
      b: m.team_b_score as number,
    })
  }

  return out
}

type Props = {
  tournament: AmericanoTournament
  dateLabel: string
  participants: PartMin[]
  currentUserId: string
  /** Når true er detail-sektionen åben (én ad gangen, styres af AmericanoTab) */
  summaryOpen: boolean
  onSummaryToggle: () => void
}

export function AmericanoCompletedCard({
  tournament,
  dateLabel,
  participants,
  currentUserId,
  summaryOpen: open,
  onSummaryToggle,
}: Props) {
  const [matches, setMatches] = useState<AmericanoMatchRow[] | undefined>(undefined)
  const [eloByUserId, setEloByUserId] = useState<Record<string, AmericanoEloSnap>>({})
  const [loading, setLoading] = useState(false)
  const [fetchErr, setFetchErr] = useState<string | null>(null)

  const P = coercePointsPerMatch(tournament)
  const userIdByPartId = useMemo(() => {
    const m = new Map<string, string>()
    participants.forEach((p) => m.set(p.id, p.user_id))
    return m
  }, [participants])
  const nameBy = (pid: string) =>
    participants.find((p) => p.id === pid)?.display_name || '?'

  useEffect(() => {
    if (matches !== undefined) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setFetchErr(null)
      try {
        const [matchesRes, eloRes] = await Promise.all([
          supabase
            .from('americano_matches')
            .select('*')
            .eq('tournament_id', tournament.id)
            .order('round_number', { ascending: true })
            .order('court_index', { ascending: true }),
          supabase
            .from('americano_elo_history')
            .select('user_id, old_rating, new_rating, change')
            .eq('tournament_id', tournament.id),
        ])
        if (cancelled) return
        if (matchesRes.error) throw matchesRes.error
        if (eloRes.error) throw eloRes.error
        const eloMap: Record<string, AmericanoEloSnap> = {}
        ;(eloRes.data || []).forEach(
          (row: {
            user_id: string
            old_rating: number | null
            new_rating: number | null
            change: number | null
          }) => {
            const uid = String(row.user_id || '')
            if (!uid) return
            eloMap[uid] = {
              change: Number(row.change) || 0,
              oldRating: row.old_rating ?? null,
              newRating: row.new_rating ?? null,
            }
          }
        )
        setEloByUserId(eloMap)
        setMatches((matchesRes.data || []) as AmericanoMatchRow[])
      } catch (e) {
        if (!cancelled) {
          setFetchErr(e instanceof Error ? e.message : 'Kunne ikke hente kampe')
          setEloByUserId({})
          setMatches([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [matches, tournament.id])

  const mlist = useMemo(() => matches ?? [], [matches])
  const leaderboard = matches !== undefined ? buildLeaderboardTotals(participants, mlist, P) : []
  const sortedMatches = [...mlist].sort((a, b) => {
    if (a.round_number !== b.round_number) return a.round_number - b.round_number
    return a.court_index - b.court_index
  })
  const reportedMatches = sortedMatches.filter(
    (m) =>
      m.team_a_score != null &&
      m.team_b_score != null &&
      isValidScore(m.team_a_score, m.team_b_score, P)
  ).length

  const currentParticipant = participants.find(
    (p) => String(p.user_id) === String(currentUserId)
  )
  const myPlacementIndex = currentParticipant
    ? leaderboard.findIndex((row) => row.id === currentParticipant.id)
    : -1
  const myPlacement = myPlacementIndex >= 0 ? myPlacementIndex + 1 : null
  const myPoints = myPlacementIndex >= 0 ? leaderboard[myPlacementIndex]?.points ?? null : null
  const myElo = currentParticipant ? eloByUserId[String(currentParticipant.user_id)] : null
  const winner = leaderboard[0]
  const summaryReady = matches !== undefined
  const podium = leaderboard.slice(0, 3)
  const highlights = useMemo(
    () => (matches === undefined ? [] : computeHighlights(mlist, participants, currentUserId, P)),
    [matches, mlist, participants, currentUserId, P]
  )

  const winnerParticipant = winner ? participants.find((p) => p.id === winner.id) : null
  const podiumColor = (place: number) =>
    place === 1 ? C.gold : place === 2 ? C.silver : C.bronze
  const podiumEmoji = (place: number) =>
    place === 1 ? '🥇' : place === 2 ? '🥈' : '🥉'

  return (
    <div
      className="pm-ui-card"
      style={{
        background: theme.surface,
        border: `1px solid ${theme.border}`,
        borderRadius: 16,
        boxShadow: theme.shadow,
        overflow: 'hidden',
      }}
    >
      {/* 1. Header — fælles blå gradient med 2v2 / Liga / Americano open */}
      <div
        style={{
          background: 'linear-gradient(135deg, #1D4ED8 0%, #1E40AF 100%)',
          color: theme.onAccent,
          padding: '16px 18px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 8,
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                opacity: 0.85,
                marginBottom: 2,
              }}
            >
              Americano · Afsluttet
            </div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 800,
                letterSpacing: '-0.02em',
                lineHeight: 1.2,
              }}
            >
              {tournament.name}
            </div>
            <div
              style={{
                fontSize: 12,
                opacity: 0.9,
                marginTop: 4,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <CalendarDays size={13} strokeWidth={2} aria-hidden />
              {dateLabel}
            </div>
          </div>
          <span
            style={{
              flexShrink: 0,
              fontSize: 11,
              fontWeight: 700,
              padding: '4px 10px',
              borderRadius: 999,
              background: 'rgba(255,255,255,0.22)',
              color: theme.onAccent,
              whiteSpace: 'nowrap',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Trophy size={12} strokeWidth={2.4} aria-hidden />
            Slutspil
          </span>
        </div>

        {/* Vinder-banner */}
        {summaryReady && winner ? (
          <div
            style={{
              marginTop: 14,
              background: 'rgba(255,255,255,0.18)',
              borderRadius: 12,
              padding: '10px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.95)',
                color: C.gold,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                fontSize: 20,
              }}
              aria-hidden
            >
              🏆
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  opacity: 0.9,
                }}
              >
                Vinder
              </div>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 800,
                  lineHeight: 1.2,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {winner.name}
                {winnerParticipant &&
                String(winnerParticipant.user_id) === String(currentUserId) ? (
                  <span style={{ fontWeight: 700, opacity: 0.85 }}> · dig</span>
                ) : null}
              </div>
              <div style={{ fontSize: 12, opacity: 0.9, marginTop: 2 }}>
                {winner.points} point · {reportedMatches} kamp
                {reportedMatches === 1 ? '' : 'e'} spillet
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* 2. Din placering */}
      <div style={{ padding: '14px 16px 0' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: 8,
          }}
        >
          <div
            style={{
              background: theme.surfaceAlt,
              border: `1px solid ${theme.border}`,
              borderRadius: 10,
              padding: '8px 10px',
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: theme.textLight,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Din placering
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: theme.text, marginTop: 2 }}>
              {summaryReady ? (myPlacement ? `#${myPlacement}` : '–') : '…'}
            </div>
          </div>
          <div
            style={{
              background: theme.surfaceAlt,
              border: `1px solid ${theme.border}`,
              borderRadius: 10,
              padding: '8px 10px',
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: theme.textLight,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Dine point
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: theme.text, marginTop: 2 }}>
              {summaryReady ? (myPoints != null ? myPoints : '–') : '…'}
            </div>
          </div>
          <div
            style={{
              background: theme.surfaceAlt,
              border: `1px solid ${theme.border}`,
              borderRadius: 10,
              padding: '8px 10px',
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: theme.textLight,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              ELO ændring
            </div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 800,
                marginTop: 2,
                color: summaryReady && myElo ? eloDeltaColor(myElo.change) : theme.textLight,
              }}
            >
              {summaryReady
                ? myElo
                  ? `${myElo.change > 0 ? '+' : ''}${myElo.change}`
                  : '–'
                : '…'}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Top 3 podium */}
      {summaryReady && podium.length > 0 ? (
        <div style={{ padding: '14px 16px 0' }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: theme.textLight,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: 8,
            }}
          >
            Top 3
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gap: 8,
              alignItems: 'end',
            }}
          >
            {[1, 0, 2].map((idxInOrder) => {
              const row = podium[idxInOrder]
              if (!row) return <div key={`empty-${idxInOrder}`} />
              const place = idxInOrder + 1
              const pu = participants.find((p) => p.id === row.id)
              const isMe = pu && String(pu.user_id) === String(currentUserId)
              const eloSnap = pu ? eloByUserId[String(pu.user_id)] : null
              const color = podiumColor(place)
              /* Visuel højdeforskel via ekstra top-padding — minHeight sikrer at indhold aldrig cuttes */
              const topSpacer = place === 1 ? 18 : place === 2 ? 10 : 4
              const first = firstNameOf(row.name)
              return (
                <div
                  key={row.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 6,
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: '50%',
                      background: color,
                      color: theme.onAccent,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      border: `2.5px solid ${theme.surface}`,
                      boxShadow: `0 1px 4px ${color}55`,
                      overflow: 'hidden',
                    }}
                    aria-hidden
                  >
                    {pu?.avatar && isAvatarUrl(pu.avatar) ? (
                      <img
                        src={pu.avatar}
                        alt=""
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : pu?.avatar ? (
                      <span style={{ fontSize: 20 }}>{pu.avatar}</span>
                    ) : (
                      <span style={{ fontSize: 13 }}>{initialsOf(row.name)}</span>
                    )}
                  </div>
                  <div
                    style={{
                      width: '100%',
                      background: `linear-gradient(180deg, ${color} 0%, ${color}CC 100%)`,
                      color: theme.onAccent,
                      borderRadius: '10px 10px 4px 4px',
                      padding: `${topSpacer}px 6px 10px`,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 4,
                      textAlign: 'center',
                      minWidth: 0,
                    }}
                  >
                    <div style={{ fontSize: 22, lineHeight: 1 }} aria-hidden>
                      {podiumEmoji(place)}
                    </div>
                    <div style={{ minWidth: 0, width: '100%' }}>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 800,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                        title={row.name}
                      >
                        {isMe ? `Dig (${first})` : first}
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.95 }}>
                        {row.points} pt
                      </div>
                      {eloSnap ? (
                        <div style={{ fontSize: 10, opacity: 0.92, marginTop: 1 }}>
                          {eloSnap.change > 0 ? '+' : ''}
                          {eloSnap.change} ELO
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : null}

      {/* 4. Highlights */}
      {summaryReady && highlights.length > 0 ? (
        <div style={{ padding: '14px 16px 0' }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: theme.textLight,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: 8,
            }}
          >
            Højdepunkter
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {highlights.map((h, i) => {
              if (h.kind === 'biggestWin') {
                return (
                  <div
                    key={`hl-${i}`}
                    style={{
                      background: theme.greenBg,
                      border: `1px solid ${theme.green}33`,
                      borderRadius: 10,
                      padding: '8px 10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    <span style={{ fontSize: 18 }} aria-hidden>
                      💪
                    </span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: theme.green }}>
                        Din bedste kamp
                      </div>
                      <div style={{ fontSize: 12, color: theme.text, marginTop: 1 }}>
                        Med {h.partnerName} mod {h.opponents[0]} & {h.opponents[1]} ({h.a}–{h.b})
                      </div>
                    </div>
                  </div>
                )
              }
              if (h.kind === 'closestMatch') {
                return (
                  <div
                    key={`hl-${i}`}
                    style={{
                      background: theme.warmBg,
                      border: `1px solid color-mix(in srgb, var(--pm-warm) 45%, var(--pm-border))`,
                      borderRadius: 10,
                      padding: '8px 10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    <span style={{ fontSize: 18 }} aria-hidden>
                      🔥
                    </span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: theme.warm }}>
                        Tætteste kamp
                      </div>
                      <div style={{ fontSize: 12, color: theme.text, marginTop: 1 }}>
                        {h.mine[0]} & {h.mine[1]} vs {h.theirs[0]} & {h.theirs[1]} ({h.a}–{h.b})
                      </div>
                    </div>
                  </div>
                )
              }
              return (
                <div
                  key={`hl-${i}`}
                  style={{
                    background: theme.accentBg,
                    border: `1px solid ${theme.accent}33`,
                    borderRadius: 10,
                    padding: '8px 10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <span style={{ fontSize: 18 }} aria-hidden>
                    🤝
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: theme.accent }}>
                      Bedste makker
                    </div>
                    <div style={{ fontSize: 12, color: theme.text, marginTop: 1 }}>
                      {h.partnerName} — {h.wins} sejre ud af {h.played} kamp
                      {h.played === 1 ? '' : 'e'}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : null}

      {/* 5. Detail-toggle (accordion) */}
      <button
        type="button"
        onClick={onSummaryToggle}
        aria-expanded={open}
        style={{
          marginTop: 14,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          width: '100%',
          padding: '12px 16px',
          border: 'none',
          borderTop: `1px solid ${theme.border}`,
          background: 'transparent',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: theme.accent }}>
            {open ? 'Skjul fuld stilling og resultater' : 'Se fuld stilling og resultater'}
          </div>
          <div style={{ fontSize: 11, color: theme.textLight, marginTop: 2 }}>
            {!summaryReady
              ? 'Vi beregner placering og kampresultater…'
              : `Samlet point + alle kampe (${reportedMatches}/${sortedMatches.length} registreret)`}
          </div>
        </div>
        <ChevronDown
          size={18}
          color={theme.textLight}
          strokeWidth={2}
          style={{
            flexShrink: 0,
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.2s ease',
          }}
          aria-hidden
        />
      </button>

      {open ? (
        <div style={{ padding: '0 16px 16px', borderTop: `1px solid ${theme.border}` }}>
          {loading && (
            <div style={{ fontSize: 12, color: theme.textLight, paddingTop: 12 }}>
              Henter resultater…
            </div>
          )}
          {fetchErr && !loading && (
            <div style={{ fontSize: 12, color: theme.red, paddingTop: 12 }}>{fetchErr}</div>
          )}
          {!loading && matches !== undefined && (
            <>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: theme.textLight,
                  marginTop: 12,
                  marginBottom: 8,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                Samlet stilling
              </div>
              {leaderboard.length === 0 ? (
                <div style={{ fontSize: 12, color: theme.textLight }}>Ingen deltagere.</div>
              ) : (
                <ol
                  style={{
                    margin: 0,
                    paddingLeft: 18,
                    fontSize: 13,
                    color: theme.textMid,
                    lineHeight: 1.65,
                  }}
                >
                  {leaderboard.map((row, idx) => {
                    const pu = participants.find((p) => p.id === row.id)
                    const isMe = pu && String(pu.user_id) === String(currentUserId)
                    const eloSnap = pu ? eloByUserId[String(pu.user_id)] : null
                    return (
                      <li key={row.id}>
                        <div>
                          <span style={{ color: theme.text, fontWeight: idx === 0 ? 700 : 500 }}>
                            {row.name}
                          </span>
                          {isMe ? (
                            <span style={{ color: theme.accent, fontWeight: 600 }}> (dig)</span>
                          ) : null}
                          {' — '}
                          <strong style={{ color: theme.text }}>{row.points}</strong> point
                        </div>
                        <div
                          style={{
                            marginTop: 1,
                            fontSize: 11,
                            fontWeight: 700,
                            color: eloSnap ? eloDeltaColor(eloSnap.change) : theme.textLight,
                          }}
                        >
                          {eloSnap
                            ? `${eloSnap.change > 0 ? '+' : ''}${eloSnap.change} ELO${
                                eloSnap.newRating != null ? ` (nu ${eloSnap.newRating})` : ''
                              }`
                            : 'ELO –'}
                        </div>
                      </li>
                    )
                  })}
                </ol>
              )}

              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: theme.textLight,
                  marginTop: 16,
                  marginBottom: 8,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                Kamp for kamp (format {P} point)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {sortedMatches.length === 0 ? (
                  <div style={{ fontSize: 12, color: theme.textLight }}>
                    Ingen kampe i turneringen.
                  </div>
                ) : (
                  sortedMatches.map((m, i) => {
                    const a = m.team_a_score
                    const b = m.team_b_score
                    const ok = a != null && b != null && isValidScore(a, b, P)
                    const n1 = nameBy(m.team_a_p1)
                    const n2 = nameBy(m.team_a_p2)
                    const n3 = nameBy(m.team_b_p1)
                    const n4 = nameBy(m.team_b_p2)
                    const onCourt = userIsOnCourtInAmericanoMatch(
                      m,
                      userIdByPartId,
                      currentUserId
                    )
                    const vOut = ok
                      ? americanoOutcomeForUserInMatch(m, userIdByPartId, currentUserId, P)
                      : 'neutral'
                    const statusLabel = americanoViewerStatusLabel(vOut, onCourt)
                    const palKey =
                      vOut === 'win'
                        ? 'win'
                        : vOut === 'loss'
                          ? 'loss'
                          : vOut === 'tie'
                            ? 'tie'
                            : 'neutral'
                    const mpal = americanoOutcomeColors[palKey]
                    const meOnA =
                      userIdByPartId.get(m.team_a_p1) === String(currentUserId) ||
                      userIdByPartId.get(m.team_a_p2) === String(currentUserId)
                    const meOnB =
                      userIdByPartId.get(m.team_b_p1) === String(currentUserId) ||
                      userIdByPartId.get(m.team_b_p2) === String(currentUserId)
                    const teamAWin = ok && (a as number) > (b as number)
                    const teamBWin = ok && (b as number) > (a as number)
                    const tieMatch = ok && a === b
                    const teamAHighlighted = Boolean(teamAWin || tieMatch)
                    const teamBHighlighted = Boolean(teamBWin || tieMatch)
                    return (
                      <div
                        key={m.id}
                        style={{
                          padding: '10px 12px',
                          background: theme.surface,
                          borderRadius: 8,
                          border: `1px solid ${theme.border}`,
                          borderLeft: `4px solid ${mpal.border}`,
                          fontSize: 12,
                          color: theme.text,
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 8,
                            marginBottom: 8,
                          }}
                        >
                          <div
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              minWidth: 0,
                            }}
                          >
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                color: theme.textLight,
                                letterSpacing: '0.04em',
                                textTransform: 'uppercase',
                                background: theme.surfaceAlt,
                                border: `1px solid ${theme.border}`,
                                borderRadius: 999,
                                padding: '2px 8px',
                              }}
                            >
                              Runde {m.round_number}
                            </span>
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                color: mpal.text,
                                background: mpal.bg,
                                border: `1px solid ${mpal.border}`,
                                borderRadius: 999,
                                padding: '2px 8px',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {statusLabel}
                            </span>
                          </div>
                          <span
                            style={{ fontSize: 10, color: theme.textLight, fontWeight: 700 }}
                          >
                            #{i + 1}
                          </span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '1fr auto',
                              alignItems: 'center',
                              gap: 8,
                              borderRadius: 8,
                              padding: '6px 8px',
                              background: teamAHighlighted ? mpal.bg : theme.surfaceAlt,
                              border: `1px solid ${teamAHighlighted ? mpal.border : theme.border}`,
                            }}
                          >
                            <div
                              style={{
                                minWidth: 0,
                                lineHeight: 1.35,
                                color: teamAHighlighted ? mpal.text : theme.text,
                              }}
                            >
                              <span style={{ fontWeight: 700 }}>{n1}</span> &{' '}
                              <span style={{ fontWeight: 700 }}>{n2}</span>
                              {meOnA ? (
                                <span style={{ color: theme.accent, fontWeight: 700 }}>
                                  {' '}
                                  (jeres hold)
                                </span>
                              ) : null}
                            </div>
                            <span
                              style={{
                                minWidth: 30,
                                textAlign: 'center',
                                fontSize: 14,
                                fontWeight: 800,
                                color: teamAHighlighted ? mpal.text : theme.textMid,
                              }}
                            >
                              {ok ? a : '–'}
                            </span>
                          </div>

                          <div
                            style={{
                              fontSize: 10,
                              color: theme.textLight,
                              textAlign: 'center',
                              textTransform: 'uppercase',
                              letterSpacing: '0.04em',
                            }}
                          >
                            mod
                          </div>

                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '1fr auto',
                              alignItems: 'center',
                              gap: 8,
                              borderRadius: 8,
                              padding: '6px 8px',
                              background: teamBHighlighted ? mpal.bg : theme.surfaceAlt,
                              border: `1px solid ${teamBHighlighted ? mpal.border : theme.border}`,
                            }}
                          >
                            <div
                              style={{
                                minWidth: 0,
                                lineHeight: 1.35,
                                color: teamBHighlighted ? mpal.text : theme.text,
                              }}
                            >
                              <span style={{ fontWeight: 700 }}>{n3}</span> &{' '}
                              <span style={{ fontWeight: 700 }}>{n4}</span>
                              {meOnB ? (
                                <span style={{ color: theme.accent, fontWeight: 700 }}>
                                  {' '}
                                  (jeres hold)
                                </span>
                              ) : null}
                            </div>
                            <span
                              style={{
                                minWidth: 30,
                                textAlign: 'center',
                                fontSize: 14,
                                fontWeight: 800,
                                color: teamBHighlighted ? mpal.text : theme.textMid,
                              }}
                            >
                              {ok ? b : '–'}
                            </span>
                          </div>
                        </div>

                        <div style={{ marginTop: 8, fontSize: 11, color: theme.textLight }}>
                          {ok ? 'Slutresultat registreret' : 'Resultat ikke registreret'}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}
