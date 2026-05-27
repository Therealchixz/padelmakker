import type { AmericanoTournament } from './types'
import {
  computeAmericanoPlayedDurationMinutes,
  formatAmericanoDurationLabel,
} from '../../lib/americanoPlayedDuration.js'

export {
  computeAmericanoPlayedDurationMinutes,
  formatAmericanoDurationLabel,
} from '../../lib/americanoPlayedDuration.js'

import { roundRobinTotalRounds, benchCountPerRound } from '../../lib/americanoRoundRobinSchedule'
export { benchCountPerRound }

export const MIN_PER_ROUND = 12

export function getAmericanoTournamentMeta(
  tournament: Pick<AmericanoTournament, 'player_slots' | 'opponent_passes' | 'courts_per_round'>,
) {
  const maxPlayers = Number(tournament.player_slots) || 5
  const passes = Number(tournament.opponent_passes) === 2 ? 2 : 1
  const courts = Math.max(1, Number(tournament.courts_per_round) || 1)
  const baseRounds = roundRobinTotalRounds(maxPlayers)
  const totalRounds = baseRounds * passes
  const estMinutes = totalRounds * MIN_PER_ROUND
  const bench = benchCountPerRound(maxPlayers, courts)
  return { maxPlayers, totalRounds, estMinutes, courts, bench }
}

function courtsLabel(courts: number) {
  return courts === 1 ? '1 bane' : `${courts} baner`
}

function benchLabel(bench: number) {
  if (bench <= 0) return null
  return bench === 1 ? '1 spiller sidder over' : `${bench} spillere sidder over`
}

/** Kompakt tekst til listekort-pill. */
export function formatCourtsBenchCompact(courts: number, bench: number) {
  const courtsPart = courtsLabel(courts)
  const benchPart = benchLabel(bench)
  if (!benchPart) return courtsPart
  return `${courtsPart} · ${benchPart}`
}

/** Detail-sheet: tydelig hovedlinje + undertekst for bænk. */
export function formatCourtsBenchDetail(courts: number, bench: number) {
  const benchPart = benchLabel(bench)
  if (!benchPart) {
    return {
      primary: courtsLabel(courts),
      secondary: 'Alle spillere er på banen',
      ariaLabel: `${courtsLabel(courts)} pr. runde — alle spillere er på banen`,
    }
  }
  return {
    primary: courtsLabel(courts),
    secondary: benchPart,
    ariaLabel: `${courtsLabel(courts)} pr. runde — ${benchPart}`,
  }
}

export function getAmericanoDurationLabel(
  status: 'registration' | 'playing' | 'completed',
  playedDurationMinutes: number | null | undefined,
  estMinutes: number,
) {
  if (status === 'completed') {
    return formatAmericanoDurationLabel(playedDurationMinutes ?? null, estMinutes)
  }
  return formatAmericanoDurationLabel(null, estMinutes)
}

export function getTournamentFormatLabel(
  format: AmericanoTournament['format'] | null | undefined,
) {
  return format === 'mexicano' ? 'Mexicano' : 'Americano'
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
