import { useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { AmericanoMatchRow, AmericanoTournament } from './types'
import {
  americanoOutcomeColors,
  americanoOutcomeForUserInMatch,
  americanoViewerStatusLabel,
  userIsOnCourtInAmericanoMatch,
} from './americanoOutcomeColors'

const font = "'Inter', sans-serif"

type PartMin = { id: string; user_id: string; display_name: string }

function coercePointsPerMatch(t: AmericanoTournament): 16 | 24 | 32 {
  const ppm = Number(t.points_per_match)
  return ppm === 16 || ppm === 24 || ppm === 32 ? ppm : 16
}

function isValidScore(a: number, b: number, P: number): boolean {
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) return false
  return a + b === P
}

function buildLeaderboardTotals(participants: PartMin[], matches: AmericanoMatchRow[], P: number) {
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

type Props = {
  tournament: AmericanoTournament
  participants: PartMin[]
  currentUserId: string
  /** Kun en afsluttet turnering aben ad gangen (styres af AmericanoTab) */
  summaryOpen: boolean
  onSummaryToggle: () => void
}

export function AmericanoCompletedSummary({
  tournament,
  participants,
  currentUserId,
  summaryOpen: open,
  onSummaryToggle,
}: Props) {
  const [matches, setMatches] = useState<AmericanoMatchRow[] | undefined>(undefined)
  const [loading, setLoading] = useState(false)
  const [fetchErr, setFetchErr] = useState<string | null>(null)

  const P = coercePointsPerMatch(tournament)
  const nameBy = (pid: string) => participants.find((p) => p.id === pid)?.display_name || '?'
  const userIdByPartId = new Map<string, string>()
  participants.forEach((p) => userIdByPartId.set(p.id, p.user_id))

  useEffect(() => {
    if (matches !== undefined) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setFetchErr(null)
      try {
        const { data, error } = await supabase
          .from('americano_matches')
          .select('*')
          .eq('tournament_id', tournament.id)
          .order('round_number', { ascending: true })
          .order('court_index', { ascending: true })
        if (cancelled) return
        if (error) throw error
        setMatches((data || []) as AmericanoMatchRow[])
      } catch (e) {
        if (!cancelled) {
          setFetchErr(e instanceof Error ? e.message : 'Kunne ikke hente kampe')
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

  const mlist = matches ?? []
  const leaderboard = matches !== undefined ? buildLeaderboardTotals(participants, mlist, P) : []
  const sortedMatches = [...mlist].sort((a, b) => {
    if (a.round_number !== b.round_number) return a.round_number - b.round_number
    return a.court_index - b.court_index
  })
  const currentParticipant = participants.find((p) => String(p.user_id) === String(currentUserId))
  const myPlacementIndex = currentParticipant
    ? leaderboard.findIndex((row) => row.id === currentParticipant.id)
    : -1
  const myPlacement = myPlacementIndex >= 0 ? myPlacementIndex + 1 : null
  const myPoints = myPlacementIndex >= 0 ? leaderboard[myPlacementIndex]?.points ?? null : null
  const winner = leaderboard[0]
  const reportedMatches = sortedMatches.filter(
    (m) => m.team_a_score != null && m.team_b_score != null && isValidScore(m.team_a_score, m.team_b_score, P)
  ).length
  const summaryReady = matches !== undefined
  const ctaTitle = open ? 'Skjul fuld stilling og resultater' : 'Se fuld stilling og resultater'
  const ctaCopy = !summaryReady
    ? 'Vi beregner placering og kampresultater...'
    : `Samlet point + alle kampe (${reportedMatches}/${sortedMatches.length} registreret)`

  return (
    <div
      style={{
        marginTop: 12,
        background: 'var(--pm-surface-alt)',
        borderRadius: 8,
        border: '1px solid var(--pm-border)',
        overflow: 'hidden',
        fontFamily: font,
      }}
    >
      <div
        style={{
          padding: '10px 12px 8px',
          borderBottom: '1px solid var(--pm-border)',
          background: 'color-mix(in srgb, var(--pm-accent-bg) 55%, var(--pm-surface-alt))',
        }}
      >
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--pm-text-light)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 7 }}>
          Turneringsresume
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: 6,
          }}
        >
          <div
            style={{
              background: 'var(--pm-surface)',
              border: '1px solid var(--pm-border)',
              borderRadius: 8,
              padding: '7px 8px',
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--pm-text-light)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Din placering
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--pm-text)', marginTop: 2 }}>
              {summaryReady ? (myPlacement ? `#${myPlacement}` : '-') : '...'}
            </div>
          </div>
          <div
            style={{
              background: 'var(--pm-surface)',
              border: '1px solid var(--pm-border)',
              borderRadius: 8,
              padding: '7px 8px',
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--pm-text-light)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Dine point
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--pm-text)', marginTop: 2 }}>
              {summaryReady ? (myPoints != null ? myPoints : '-') : '...'}
            </div>
          </div>
          <div
            style={{
              background: 'var(--pm-surface)',
              border: '1px solid var(--pm-border)',
              borderRadius: 8,
              padding: '7px 8px',
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--pm-text-light)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Vinder
            </div>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--pm-text)', marginTop: 4, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {summaryReady ? winner?.name || '-' : '...'}
            </div>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onSummaryToggle}
        aria-expanded={open}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          width: '100%',
          padding: '10px 12px',
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--pm-accent)' }}>{ctaTitle}</div>
          <div style={{ fontSize: 11, color: 'var(--pm-text-light)', marginTop: 2 }}>
            {ctaCopy}
          </div>
        </div>
        <ChevronDown
          size={18}
          color="#64748B"
          strokeWidth={2}
          style={{
            flexShrink: 0,
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.2s ease',
          }}
          aria-hidden
        />
      </button>

      {open && (
        <div style={{ padding: '0 12px 14px', borderTop: '1px solid #E2E8F0' }}>
          {loading && (
            <div style={{ fontSize: 12, color: 'var(--pm-text-light)', paddingTop: 12 }}>Henter resultater...</div>
          )}
          {fetchErr && !loading && (
            <div style={{ fontSize: 12, color: '#B45309', paddingTop: 12 }}>{fetchErr}</div>
          )}
          {!loading && matches !== undefined && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--pm-text-light)', marginTop: 12, marginBottom: 8 }}>
                Samlet stilling (alle kampoint)
              </div>
              {leaderboard.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--pm-text-light)' }}>Ingen deltagere.</div>
              ) : (
                <ol
                  style={{
                    margin: 0,
                    paddingLeft: 18,
                    fontSize: 13,
                    color: 'var(--pm-text-mid)',
                    lineHeight: 1.65,
                  }}
                >
                  {leaderboard.map((row, idx) => {
                    const pu = participants.find((p) => p.id === row.id)
                    const isMe = pu && String(pu.user_id) === String(currentUserId)
                    return (
                      <li key={row.id}>
                        <span style={{ color: 'var(--pm-text)', fontWeight: idx === 0 ? 700 : 500 }}>{row.name}</span>
                        {isMe ? (
                          <span style={{ color: '#1D4ED8', fontWeight: 600 }}> (dig)</span>
                        ) : null}
                        {' - '}
                        <strong style={{ color: 'var(--pm-text)' }}>{row.points}</strong> point
                      </li>
                    )
                  })}
                </ol>
              )}

              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--pm-text-light)', marginTop: 16, marginBottom: 8 }}>
                Kamp for kamp (format {P} point)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {sortedMatches.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--pm-text-light)' }}>Ingen kampe i turneringen.</div>
                ) : (
                  sortedMatches.map((m, i) => {
                    const a = m.team_a_score
                    const b = m.team_b_score
                    const ok =
                      a != null && b != null && isValidScore(a, b, P)
                    const n1 = nameBy(m.team_a_p1)
                    const n2 = nameBy(m.team_a_p2)
                    const n3 = nameBy(m.team_b_p1)
                    const n4 = nameBy(m.team_b_p2)
                    const onCourt = userIsOnCourtInAmericanoMatch(m, userIdByPartId, currentUserId)
                    const vOut = ok
                      ? americanoOutcomeForUserInMatch(m, userIdByPartId, currentUserId, P)
                      : 'neutral'
                    const statusLabel = americanoViewerStatusLabel(vOut, onCourt)
                    const palKey =
                      vOut === 'win' ? 'win' : vOut === 'loss' ? 'loss' : vOut === 'tie' ? 'tie' : 'neutral'
                    const mpal = americanoOutcomeColors[palKey]
                    const meOnA =
                      userIdByPartId.get(m.team_a_p1) === String(currentUserId) ||
                      userIdByPartId.get(m.team_a_p2) === String(currentUserId)
                    const meOnB =
                      userIdByPartId.get(m.team_b_p1) === String(currentUserId) ||
                      userIdByPartId.get(m.team_b_p2) === String(currentUserId)
                    const teamAWin = ok && a > b
                    const teamBWin = ok && b > a
                    const tieMatch = ok && a === b
                    return (
                      <div
                        key={m.id}
                        style={{
                          padding: '10px 12px',
                          background: 'var(--pm-surface)',
                          borderRadius: 8,
                          border: '1px solid var(--pm-border)',
                          borderLeft: `4px solid ${mpal.border}`,
                          fontSize: 12,
                          color: 'var(--pm-text)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                color: 'var(--pm-text-light)',
                                letterSpacing: '0.04em',
                                textTransform: 'uppercase',
                                background: 'var(--pm-surface-alt)',
                                border: '1px solid var(--pm-border)',
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
                          <span style={{ fontSize: 10, color: 'var(--pm-text-light)', fontWeight: 700 }}>#{i + 1}</span>
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
                              background: teamAWin || tieMatch ? mpal.bg : 'var(--pm-surface-alt)',
                              border: `1px solid ${teamAWin || tieMatch ? mpal.border : 'var(--pm-border)'}`,
                            }}
                          >
                            <div style={{ minWidth: 0, lineHeight: 1.35 }}>
                              <span style={{ fontWeight: 700 }}>{n1}</span> & <span style={{ fontWeight: 700 }}>{n2}</span>
                              {meOnA ? <span style={{ color: 'var(--pm-accent)', fontWeight: 700 }}> (jeres hold)</span> : null}
                            </div>
                            <span
                              style={{
                                minWidth: 30,
                                textAlign: 'center',
                                fontSize: 14,
                                fontWeight: 800,
                                color: teamAWin || tieMatch ? mpal.text : 'var(--pm-text-mid)',
                              }}
                            >
                              {ok ? a : '-'}
                            </span>
                          </div>

                          <div style={{ fontSize: 10, color: 'var(--pm-text-light)', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
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
                              background: teamBWin || tieMatch ? mpal.bg : 'var(--pm-surface-alt)',
                              border: `1px solid ${teamBWin || tieMatch ? mpal.border : 'var(--pm-border)'}`,
                            }}
                          >
                            <div style={{ minWidth: 0, lineHeight: 1.35 }}>
                              <span style={{ fontWeight: 700 }}>{n3}</span> & <span style={{ fontWeight: 700 }}>{n4}</span>
                              {meOnB ? <span style={{ color: 'var(--pm-accent)', fontWeight: 700 }}> (jeres hold)</span> : null}
                            </div>
                            <span
                              style={{
                                minWidth: 30,
                                textAlign: 'center',
                                fontSize: 14,
                                fontWeight: 800,
                                color: teamBWin || tieMatch ? mpal.text : 'var(--pm-text-mid)',
                              }}
                            >
                              {ok ? b : '-'}
                            </span>
                          </div>
                        </div>

                        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--pm-text-light)' }}>
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
      )}
    </div>
  )
}
