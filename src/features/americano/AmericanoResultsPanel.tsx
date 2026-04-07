import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { AmericanoMatchRow, AmericanoParticipant, AmericanoPoints, AmericanoTournament } from './types'

const font = "'Inter', sans-serif"

type Props = {
  tournament: AmericanoTournament
  /** Opretteren af turneringen — kan låse op og rette gemte resultater */
  currentUserId: string
  onSaved: () => void
  showToast: (msg: string) => void
  onProfileStatsRefresh?: () => void
}

function isMatchResultLocked(m: AmericanoMatchRow): boolean {
  const hasScores = m.team_a_score != null && m.team_b_score != null
  if (!hasScores) return false
  if (m.results_locked === false) return false
  return true
}

/** Faktiske kampoint (hvert vundet rally = 1 til holdet). Ikke krav om at vinderen rammer målet P — det er spillets format på banen (fx først til 16), slutstilling kan være 10–6. */
function isValidAmericanoScore(a: number, b: number): boolean {
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) return false
  return a !== b
}

function resolvedMatchScores(
  m: AmericanoMatchRow,
  sc: Record<string, { a: string; b: string }>
): { a: number; b: number } | null {
  const row = sc[m.id]
  if (row && row.a !== '' && row.b !== '') {
    const a = parseInt(row.a, 10)
    const b = parseInt(row.b, 10)
    if (isValidAmericanoScore(a, b)) return { a, b }
  }
  if (m.team_a_score != null && m.team_b_score != null) {
    const a = m.team_a_score
    const b = m.team_b_score
    if (isValidAmericanoScore(a, b)) return { a, b }
  }
  return null
}

function buildLeaderboard(
  participants: AmericanoParticipant[],
  matches: AmericanoMatchRow[],
  scores: Record<string, { a: string; b: string }>
): { id: string; name: string; points: number }[] {
  const totals = new Map<string, number>()
  participants.forEach((p) => totals.set(p.id, 0))
  for (const m of matches) {
    const r = resolvedMatchScores(m, scores)
    if (!r) continue
    const add = (pid: string, pts: number) => totals.set(pid, (totals.get(pid) ?? 0) + pts)
    add(m.team_a_p1, r.a)
    add(m.team_a_p2, r.a)
    add(m.team_b_p1, r.b)
    add(m.team_b_p2, r.b)
  }
  return participants
    .map((p) => ({ id: p.id, name: p.display_name, points: totals.get(p.id) ?? 0 }))
    .sort((x, y) => y.points - x.points)
}

export function AmericanoResultsPanel({
  tournament,
  currentUserId,
  onSaved,
  showToast,
  onProfileStatsRefresh,
}: Props) {
  const [participants, setParticipants] = useState<AmericanoParticipant[]>([])
  const [matches, setMatches] = useState<AmericanoMatchRow[]>([])
  const [scores, setScores] = useState<Record<string, { a: string; b: string }>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  /** Midlertidigt ulåst af opretter — nulstilles ved genindlæsning */
  const [unlockedIds, setUnlockedIds] = useState<Set<string>>(() => new Set())

  const P = tournament.points_per_match
  const isCreator = String(tournament.creator_id) === String(currentUserId)

  const nameByPartId = useCallback(
    (pid: string) => participants.find((p) => p.id === pid)?.display_name || '?',
    [participants]
  )

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [pRes, mRes] = await Promise.all([
        supabase.from('americano_participants').select('*').eq('tournament_id', tournament.id),
        supabase
          .from('americano_matches')
          .select('*')
          .eq('tournament_id', tournament.id)
          .order('round_number', { ascending: true })
          .order('court_index', { ascending: true }),
      ])
      const plist = (pRes.data || []) as AmericanoParticipant[]
      const mlist = (mRes.data || []) as AmericanoMatchRow[]
      setParticipants(plist)
      setMatches(mlist)
      const sc: Record<string, { a: string; b: string }> = {}
      mlist.forEach((m) => {
        sc[m.id] = {
          a: m.team_a_score != null ? String(m.team_a_score) : '',
          b: m.team_b_score != null ? String(m.team_b_score) : '',
        }
      })
      setScores(sc)
      setUnlockedIds(new Set())
    } catch (e) {
      console.warn(e)
    } finally {
      setLoading(false)
    }
  }, [tournament.id])

  useEffect(() => {
    load()
  }, [load])

  const saveRow = async (m: AmericanoMatchRow) => {
    const s = scores[m.id]
    if (!s) return
    const a = parseInt(s.a, 10)
    const b = parseInt(s.b, 10)
    if (s.a === '' || s.b === '') {
      showToast('Udfyld begge point.')
      return
    }
    if (!isValidAmericanoScore(a, b)) {
      showToast('Ugyldigt: to hele tal ≥ 0, og ikke uafgjort.')
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase
        .from('americano_matches')
        .update({
          team_a_score: a,
          team_b_score: b,
          results_locked: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', m.id)
      if (error) throw error
      showToast('Resultat gemt.')
      await load()
      onProfileStatsRefresh?.()
      onSaved()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      showToast('Kunne ikke gemme: ' + msg)
    } finally {
      setSaving(false)
    }
  }

  const completeTournament = async () => {
    const incomplete = matches.some((m) => {
      const s = scores[m.id]
      if (!s) return true
      const a = parseInt(s.a, 10)
      const b = parseInt(s.b, 10)
      return !isValidAmericanoScore(a, b)
    })
    if (incomplete) {
      showToast('Alle kampe skal have gyldige resultater før afslutning.')
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase
        .from('americano_tournaments')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('id', tournament.id)
      if (error) throw error
      showToast('Turnering afsluttet.')
      onProfileStatsRefresh?.()
      onSaved()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      showToast('Kunne ikke afslutte: ' + msg)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div style={{ fontSize: 12, color: '#8494A7', marginTop: 12 }}>Henter kampe…</div>
  }

  const leaderboard = buildLeaderboard(participants, matches, scores)

  return (
    <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #E2E8F0' }}>
      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: '#0B1120' }}>
        Resultater (ingen ELO)
      </div>
      <p style={{ fontSize: 11, color: '#64748B', margin: '0 0 12px', lineHeight: 1.5 }}>
        <strong>Format {P} point:</strong> Det er det I spiller til på banen (fx først til {P}). Her skriver I den{' '}
        <strong>faktiske slutstilling</strong> — fx <strong>10–6</strong>: hvert vundet rally giver ét point til holdet. De to tal I indtaster,{' '}
        lægges til hver spillers <strong>turneringssum</strong> (vinderholdets spillere får vinderholdets point, taberholdets får deres).
        Efter <strong>Gem</strong> er kampen låst — kun du som opretter kan trykke <strong>Ret resultat</strong> for at ændre den.
      </p>
      <div
        style={{
          background: '#F1F5F9',
          borderRadius: 8,
          padding: '10px 12px',
          marginBottom: 14,
          fontSize: 11,
          color: '#334155',
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 8, color: '#0B1120' }}>Stilling (sum af jeres kampoint)</div>
        <ol style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
          {leaderboard.map((row) => (
            <li key={row.id}>
              {row.name} — <strong>{row.points}</strong> point
            </li>
          ))}
        </ol>
        {leaderboard.length === 0 && <div>Ingen spillere endnu.</div>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {matches.map((m) => {
          const s = scores[m.id] || { a: '', b: '' }
          const locked = isMatchResultLocked(m) && !unlockedIds.has(m.id)
          const n1 = nameByPartId(m.team_a_p1)
          const n2 = nameByPartId(m.team_a_p2)
          const n3 = nameByPartId(m.team_b_p1)
          const n4 = nameByPartId(m.team_b_p2)
          return (
            <div
              key={m.id}
              style={{
                background: '#F8FAFC',
                borderRadius: 8,
                padding: 10,
                fontSize: 11,
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 6, color: '#3E4C63' }}>
                Runde {m.round_number} · Bane {m.court_index + 1}
              </div>
              <div style={{ marginBottom: 8, lineHeight: 1.4 }}>
                <span style={{ color: '#1D4ED8' }}>
                  {n1} + {n2}
                </span>
                <span style={{ margin: '0 6px', color: '#8494A7' }}>vs</span>
                <span style={{ color: '#2563EB' }}>
                  {n3} + {n4}
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                <input
                  type="number"
                  min={0}
                  readOnly={locked}
                  value={s.a}
                  onChange={(e) =>
                    setScores((prev) => ({ ...prev, [m.id]: { ...prev[m.id], a: e.target.value, b: prev[m.id]?.b ?? '' } }))
                  }
                  placeholder="Hold A"
                  style={{
                    width: 72,
                    padding: 6,
                    borderRadius: 6,
                    border: '1px solid #D5DDE8',
                    fontSize: 13,
                    background: locked ? '#F1F5F9' : '#fff',
                  }}
                />
                <span style={{ fontWeight: 700 }}>—</span>
                <input
                  type="number"
                  min={0}
                  readOnly={locked}
                  value={s.b}
                  onChange={(e) =>
                    setScores((prev) => ({ ...prev, [m.id]: { ...prev[m.id], a: prev[m.id]?.a ?? '', b: e.target.value } }))
                  }
                  placeholder="Hold B"
                  style={{
                    width: 72,
                    padding: 6,
                    borderRadius: 6,
                    border: '1px solid #D5DDE8',
                    fontSize: 13,
                    background: locked ? '#F1F5F9' : '#fff',
                  }}
                />
                {locked ? (
                  <>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: '#64748B',
                        padding: '4px 8px',
                        background: '#E2E8F0',
                        borderRadius: 6,
                      }}
                    >
                      Låst
                    </span>
                    {isCreator && (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => setUnlockedIds((prev) => new Set(prev).add(m.id))}
                        style={{
                          fontFamily: font,
                          fontSize: 12,
                          fontWeight: 600,
                          padding: '6px 12px',
                          borderRadius: 6,
                          border: '1px solid #D97706',
                          background: '#fff',
                          color: '#B45309',
                          cursor: saving ? 'wait' : 'pointer',
                        }}
                      >
                        Ret resultat
                      </button>
                    )}
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => saveRow(m)}
                    style={{
                      fontFamily: font,
                      fontSize: 12,
                      fontWeight: 600,
                      padding: '6px 12px',
                      borderRadius: 6,
                      border: 'none',
                      background: '#1D4ED8',
                      color: '#fff',
                      cursor: saving ? 'wait' : 'pointer',
                    }}
                  >
                    Gem
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
      <button
        type="button"
        disabled={saving}
        onClick={completeTournament}
        style={{
          marginTop: 14,
          fontFamily: font,
          fontSize: 12,
          fontWeight: 600,
          padding: '8px 14px',
          borderRadius: 8,
          border: '1px solid #D5DDE8',
          background: '#fff',
          color: '#3E4C63',
          cursor: saving ? 'wait' : 'pointer',
        }}
      >
        Afslut turnering (alle resultater indtastet)
      </button>
    </div>
  )
}
