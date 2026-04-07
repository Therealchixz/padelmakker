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
}

export function AmericanoCompletedSummary({ tournament, participants, currentUserId }: Props) {
  const [open, setOpen] = useState(false)
  const [matches, setMatches] = useState<AmericanoMatchRow[] | undefined>(undefined)
  const [loading, setLoading] = useState(false)
  const [fetchErr, setFetchErr] = useState<string | null>(null)

  const P = coercePointsPerMatch(tournament)
  const nameBy = (pid: string) => participants.find((p) => p.id === pid)?.display_name || '?'
  const userIdByPartId = new Map<string, string>()
  participants.forEach((p) => userIdByPartId.set(p.id, p.user_id))

  useEffect(() => {
    if (!open || matches !== undefined) return
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
  }, [open, matches, tournament.id])

  const mlist = matches ?? []
  const leaderboard = matches !== undefined ? buildLeaderboardTotals(participants, mlist, P) : []
  const sortedMatches = [...mlist].sort((a, b) => {
    if (a.round_number !== b.round_number) return a.round_number - b.round_number
    return a.court_index - b.court_index
  })

  return (
    <div
      style={{
        marginTop: 12,
        background: '#F8FAFC',
        borderRadius: 8,
        border: '1px solid #E2E8F0',
        overflow: 'hidden',
        fontFamily: font,
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
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
          <div style={{ fontSize: 12, fontWeight: 700, color: '#0B1120' }}>Resultater og stilling</div>
          <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
            {matches === undefined
              ? 'Tryk for at se samlet stilling og alle kampresultater'
              : `Samlet point + alle kampe (${sortedMatches.length} ${sortedMatches.length === 1 ? 'kamp' : 'kampe'})`}
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
            <div style={{ fontSize: 12, color: '#64748B', paddingTop: 12 }}>Henter resultater…</div>
          )}
          {fetchErr && !loading && (
            <div style={{ fontSize: 12, color: '#B45309', paddingTop: 12 }}>{fetchErr}</div>
          )}
          {!loading && matches !== undefined && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', marginTop: 12, marginBottom: 8 }}>
                Samlet stilling (alle kampoint)
              </div>
              {leaderboard.length === 0 ? (
                <div style={{ fontSize: 12, color: '#94A3B8' }}>Ingen deltagere.</div>
              ) : (
                <ol
                  style={{
                    margin: 0,
                    paddingLeft: 18,
                    fontSize: 13,
                    color: '#334155',
                    lineHeight: 1.65,
                  }}
                >
                  {leaderboard.map((row, idx) => {
                    const pu = participants.find((p) => p.id === row.id)
                    const isMe = pu && String(pu.user_id) === String(currentUserId)
                    return (
                      <li key={row.id}>
                        <span style={{ color: '#0F172A', fontWeight: idx === 0 ? 700 : 500 }}>{row.name}</span>
                        {isMe ? (
                          <span style={{ color: '#1D4ED8', fontWeight: 600 }}> (dig)</span>
                        ) : null}
                        {' — '}
                        <strong style={{ color: '#0F172A' }}>{row.points}</strong> point
                      </li>
                    )
                  })}
                </ol>
              )}

              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', marginTop: 16, marginBottom: 8 }}>
                Kamp for kamp (format {P} point)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {sortedMatches.length === 0 ? (
                  <div style={{ fontSize: 12, color: '#94A3B8' }}>Ingen kampe i turneringen.</div>
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
                    return (
                      <div
                        key={m.id}
                        style={{
                          padding: '10px 12px',
                          background: mpal.bg,
                          borderRadius: 8,
                          border: `1px solid ${mpal.border}`,
                          fontSize: 12,
                          color: mpal.text,
                        }}
                      >
                        <div style={{ fontWeight: 700, color: mpal.text, marginBottom: 8, lineHeight: 1.35 }}>
                          #{i + 1} · Runde {m.round_number} - {statusLabel}
                        </div>
                        <div style={{ lineHeight: 1.5 }}>
                          <span style={{ fontWeight: 600 }}>{n1}</span> &{' '}
                          <span style={{ fontWeight: 600 }}>{n2}</span>
                          <span style={{ margin: '0 6px', opacity: 0.75 }}>mod</span>
                          <span style={{ fontWeight: 600 }}>{n3}</span> &{' '}
                          <span style={{ fontWeight: 600 }}>{n4}</span>
                        </div>
                        <div style={{ marginTop: 6, fontWeight: 700, color: mpal.text, fontSize: 13 }}>
                          {ok ? (
                            <>
                              {a} — {b}
                            </>
                          ) : (
                            <span style={{ opacity: 0.65, fontWeight: 600 }}>Ikke registreret</span>
                          )}
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
