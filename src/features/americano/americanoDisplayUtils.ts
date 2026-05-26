import type { AmericanoTournament } from './types'

/** Antal runder per spiller-count — matcher schedule578.ts og schedule8.ts. */
export const ROUNDS_BY_SLOTS: Record<number, number> = {
  5: 5,
  6: 6,
  7: 7,
  8: 7,
}

export const MIN_PER_ROUND = 12

export function getAmericanoTournamentMeta(tournament: Pick<AmericanoTournament, 'player_slots' | 'opponent_passes'>) {
  const maxPlayers = Number(tournament.player_slots) || 5
  const passes = Number(tournament.opponent_passes) === 2 ? 2 : 1
  const baseRounds = ROUNDS_BY_SLOTS[maxPlayers] ?? maxPlayers
  const totalRounds = baseRounds * passes
  const estMinutes = totalRounds * MIN_PER_ROUND
  return { maxPlayers, totalRounds, estMinutes }
}

export function resolveAmericanoCourtName(
  courtId: string | null | undefined,
  courts: { id: string; name: string }[]
) {
  if (!courtId) return 'Bane ikke valgt'
  const hit = courts.find((c) => String(c.id) === String(courtId))
  return hit?.name?.trim() || 'Padelbane'
}

export function playerInitials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() || '')
      .join('') || '?'
  )
}

type MatchRow = {
  round_number: number
  team_a_score: number | null
  team_b_score: number | null
  results_locked?: boolean | null
}

/** Første runde uden låst resultat — bruges til «Live Runde X/Y» på listekort. */
export function computeAmericanoActiveRound(matches: MatchRow[]) {
  const sorted = [...matches].sort((a, b) => {
    if (a.round_number !== b.round_number) return a.round_number - b.round_number
    return 0
  })
  for (const m of sorted) {
    const hasScores = m.team_a_score != null && m.team_b_score != null
    const locked = hasScores && m.results_locked !== false
    if (!locked) return m.round_number
  }
  if (sorted.length === 0) return null
  return sorted[sorted.length - 1]?.round_number ?? null
}
