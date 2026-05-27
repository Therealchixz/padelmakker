import type { AmericanoTournament } from './types'
import {
  computeAmericanoPlayedDurationMinutes,
  formatAmericanoDurationLabel,
} from '../../lib/americanoPlayedDuration.js'

export {
  computeAmericanoPlayedDurationMinutes,
  formatAmericanoDurationLabel,
} from '../../lib/americanoPlayedDuration.js'

import { getMexicanoTotalRounds } from '../../lib/mexicanoSchedule.js'
import { americanoBaseRounds, americanoTotalRounds, benchCountPerRound } from '../../lib/americanoRoundRobinSchedule'
export { benchCountPerRound, americanoBaseRounds, americanoTotalRounds }

/** Legacy default — brug estimateMinutesPerRound(points) til nye estimater. */
export const MIN_PER_ROUND = 12

/** Grov minutter pr. runde efter pointformat (inkl. skift/pause). */
export function estimateMinutesPerRound(pointsPerMatch: number): number {
  if (pointsPerMatch === 32) return 16
  if (pointsPerMatch === 24) return 12
  return 9
}

export function formatEstimatedDuration(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return '—'
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return m > 0 ? `ca. ${h} t ${m} min` : `ca. ${h} t`
  }
  return `ca. ${minutes} min`
}

export type CreateFormSchedulePreview = {
  format: AmericanoTournament['format']
  normalRounds: number
  longRounds: number
  selectedRounds: number
  bench: number
  minPerRound: number
  estNormalMin: number
  estLongMin: number
  estSelectedMin: number
  estSelectedLabel: string
  lengthLabel: 'Normal' | 'Lang'
}

/** Forhåndsvisning i opret-form: runder + tid ud fra alle valg. */
export function getCreateFormSchedulePreview(input: {
  format: AmericanoTournament['format']
  playerSlots: number
  courtsPerRound: number
  opponentPasses: number
  pointsPerMatch: number
}): CreateFormSchedulePreview {
  const format = input.format ?? 'americano'
  const playerSlots = Math.max(4, Number(input.playerSlots) || 6)
  const courts = Math.max(1, Number(input.courtsPerRound) || 1)
  const passes = Number(input.opponentPasses) === 2 ? 2 : 1
  const points = Number(input.pointsPerMatch) || 16
  const minPerRound = estimateMinutesPerRound(points)
  const bench = benchCountPerRound(playerSlots, courts)

  const normalRounds =
    format === 'mexicano'
      ? getMexicanoTotalRounds(playerSlots, 1)
      : americanoBaseRounds(playerSlots, courts)
  const longRounds =
    format === 'mexicano'
      ? getMexicanoTotalRounds(playerSlots, 2)
      : americanoTotalRounds(playerSlots, courts, 2)
  const selectedRounds = passes === 2 ? longRounds : normalRounds

  const estSelectedMin = selectedRounds * minPerRound
  return {
    format,
    normalRounds,
    longRounds,
    selectedRounds,
    bench,
    minPerRound,
    estNormalMin: normalRounds * minPerRound,
    estLongMin: longRounds * minPerRound,
    estSelectedMin,
    estSelectedLabel: formatEstimatedDuration(estSelectedMin),
    lengthLabel: passes === 2 ? 'Lang' : 'Normal',
  }
}

export function getAmericanoTournamentMeta(
  tournament: Pick<
    AmericanoTournament,
    'player_slots' | 'opponent_passes' | 'courts_per_round' | 'points_per_match' | 'format'
  >,
) {
  const preview = getCreateFormSchedulePreview({
    format: tournament.format ?? 'americano',
    playerSlots: Number(tournament.player_slots) || 5,
    courtsPerRound: Number(tournament.courts_per_round) || 1,
    opponentPasses: Number(tournament.opponent_passes) || 1,
    pointsPerMatch: Number(tournament.points_per_match) || 16,
  })
  const maxPlayers = Number(tournament.player_slots) || 5
  const courts = Math.max(1, Number(tournament.courts_per_round) || 1)
  return {
    maxPlayers,
    totalRounds: preview.selectedRounds,
    estMinutes: preview.estSelectedMin,
    courts,
    bench: preview.bench,
  }
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
  if (!benchPart) return `${courtsPart} pr. runde`
  return `${courtsPart} pr. runde · ${benchPart}`
}

/** Detail-sheet: tydelig hovedlinje + undertekst for bænk. */
export function formatCourtsBenchDetail(courts: number, bench: number) {
  const benchPart = benchLabel(bench)
  if (!benchPart) {
    return {
      primary: courtsLabel(courts),
      secondary: 'Alle spillere er på banen',
      ariaLabel: `${courtsLabel(courts)} pr. runde — alle spillere er på banen (4 spillere pr. bane)`,
    }
  }
  return {
    primary: courtsLabel(courts),
    secondary: `${benchPart} · 4 spillere pr. bane (2v2)`,
    ariaLabel: `${courtsLabel(courts)} pr. runde — ${benchPart} · 4 spillere pr. bane (2v2)`,
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

export function isAmericanoMatchLocked(m: MatchRow): boolean {
  const hasScores = m.team_a_score != null && m.team_b_score != null
  return hasScores && m.results_locked !== false
}

/** Antal planlagte runder + gennemførte runder ud fra faktiske kampe i DB. */
export function getAmericanoRoundProgressFromMatches(matches: MatchRow[]) {
  if (!matches.length) return null
  const byRound = new Map<number, MatchRow[]>()
  for (const m of matches) {
    const rn = Number(m.round_number) || 0
    if (rn <= 0) continue
    const list = byRound.get(rn) || []
    list.push(m)
    byRound.set(rn, list)
  }
  if (byRound.size === 0) return null
  const totalRounds = Math.max(...byRound.keys())
  let completedRounds = 0
  for (const roundMatches of byRound.values()) {
    if (roundMatches.length > 0 && roundMatches.every(isAmericanoMatchLocked)) {
      completedRounds += 1
    }
  }
  return {
    totalRounds,
    completedRounds,
    liveRound: computeAmericanoActiveRound(matches),
  }
}

/** Første runde uden låst resultat — bruges til «Live Runde X/Y» på listekort. */
export function computeAmericanoActiveRound(matches: MatchRow[]) {
  const sorted = [...matches].sort((a, b) => {
    if (a.round_number !== b.round_number) return a.round_number - b.round_number
    return 0
  })
  for (const m of sorted) {
    if (!isAmericanoMatchLocked(m)) return m.round_number
  }
  if (sorted.length === 0) return null
  return sorted[sorted.length - 1]?.round_number ?? null
}
