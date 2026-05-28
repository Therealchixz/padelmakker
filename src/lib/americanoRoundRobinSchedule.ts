/**
 * Generisk Americano-plan for 4–16 spillere.
 *
 * Fairness-mode (Normal):
 * - alle skal kunne være makker + modstander med alle
 * - alle skal have lige mange pauser (sidde over lige meget)
 *
 * Lang = samme plan to gange.
 */

import type { AmericanoMatchInsert } from '../features/americano/types'

type MatchIdx = { teamA: [number, number]; teamB: [number, number] }
type RoundIdx = MatchIdx[]

type BuildResult = {
  rounds: RoundIdx[]
  playCount: number[]
  partnerMet: Set<string>
  oppMet: Set<string>
}

/** Klassisk cirkel-round-robin (ulige n → n runder, lige n → n−1). */
export function roundRobinTotalRounds(n: number): number {
  return n % 2 === 0 ? n - 1 : n
}

/** Auto-skalering af baner: 4-7 -> 1 bane, 8-11 -> 2, 12-15 -> 3, 16 -> 4. */
export function recommendedCourtsPerRound(n: number): number {
  return Math.max(1, Math.floor(n / 4))
}

function clampCourts(n: number, courtsPerRound: number): number {
  const maxCourts = Math.floor(n / 4)
  const minCourts = recommendedCourtsPerRound(n)
  const wanted = Math.max(minCourts, Number(courtsPerRound) || minCourts)
  return Math.max(minCourts, Math.min(wanted, maxCourts))
}

function pairKey(i: number, j: number): string {
  return i < j ? `${i},${j}` : `${j},${i}`
}

function totalPairCombinations(n: number): number {
  return (n * (n - 1)) / 2
}

function theoreticalMinRounds(n: number, courts: number): number {
  const pairs = totalPairCombinations(n)
  const forPartners = Math.ceil(pairs / (2 * courts))
  const forOpponents = Math.ceil(pairs / (4 * courts))
  return Math.max(roundRobinTotalRounds(n), forPartners, forOpponents)
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a)
  let y = Math.abs(b)
  while (y !== 0) {
    const t = x % y
    x = y
    y = t
  }
  return x || 1
}

/** Mindste spring i runder for at pauser kan fordeles helt ligeligt. */
function fairnessRoundStep(n: number, courts: number): number {
  const bench = n - courts * 4
  if (bench <= 0) return 1
  return n / gcd(n, bench)
}

function coverageComplete(n: number, partnerMet: Set<string>, oppMet: Set<string>): boolean {
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const key = pairKey(i, j)
      if (!partnerMet.has(key) || !oppMet.has(key)) return false
    }
  }
  return true
}

function allEqual(values: number[]): boolean {
  if (values.length <= 1) return true
  const first = values[0]
  return values.every((v) => v === first)
}

function isFairPauseDistribution(n: number, courts: number, rounds: number, playCount: number[]): boolean {
  const bench = n - courts * 4
  if (bench <= 0) return true
  if ((bench * rounds) % n !== 0) return false
  return allEqual(playCount)
}

function circleRounds(n: number): Array<Array<[number, number]>> {
  const even = n % 2 === 0
  const size = even ? n : n + 1
  const numRounds = size - 1
  const rotate = Array.from({ length: size - 1 }, (_, i) => i + 1)

  const rounds: Array<Array<[number, number]>> = []
  for (let r = 0; r < numRounds; r++) {
    const order = [0, ...rotate]
    const pairs: Array<[number, number]> = []
    for (let i = 0; i < size / 2; i++) {
      pairs.push([order[i], order[size - 1 - i]])
    }
    rounds.push(pairs)
    rotate.unshift(rotate.pop()!)
  }
  return rounds
}

function circleRoundsToMatches(n: number, courts: number): RoundIdx[] {
  const dummy = n % 2 === 0 ? -1 : n
  const out: RoundIdx[] = []
  for (const pairs of circleRounds(n)) {
    const realPairs = pairs.filter(([a, b]) => a !== dummy && b !== dummy)
    const round: MatchIdx[] = []
    for (let c = 0; c < courts; c++) {
      const pairA = realPairs[c * 2]
      const pairB = realPairs[c * 2 + 1]
      if (!pairA || !pairB) break
      round.push({ teamA: [pairA[0], pairA[1]], teamB: [pairB[0], pairB[1]] })
    }
    if (round.length > 0) out.push(round)
  }
  return out
}

function bestMatchForFour(
  players: [number, number, number, number],
  partnerMet: Set<string>,
  oppMet: Set<string>,
): MatchIdx {
  const [p0, p1, p2, p3] = players
  const options: MatchIdx[] = [
    { teamA: [p0, p1], teamB: [p2, p3] },
    { teamA: [p0, p2], teamB: [p1, p3] },
    { teamA: [p0, p3], teamB: [p1, p2] },
  ]

  let best = options[0]
  let bestScore = -1
  for (const o of options) {
    let score = 0
    const [a1, a2] = o.teamA
    const [b1, b2] = o.teamB
    if (!partnerMet.has(pairKey(a1, a2))) score += 12
    if (!partnerMet.has(pairKey(b1, b2))) score += 12
    for (const a of o.teamA) {
      for (const b of o.teamB) {
        if (!oppMet.has(pairKey(a, b))) score += 6
      }
    }
    if (score > bestScore) {
      bestScore = score
      best = o
    }
  }
  return best
}

function recordMatch(m: MatchIdx, partnerMet: Set<string>, oppMet: Set<string>) {
  const [a1, a2] = m.teamA
  const [b1, b2] = m.teamB
  partnerMet.add(pairKey(a1, a2))
  partnerMet.add(pairKey(b1, b2))
  for (const a of m.teamA) {
    for (const b of m.teamB) {
      oppMet.add(pairKey(a, b))
    }
  }
}

function bestRoundMatches(
  selected: number[],
  courts: number,
  partnerMet: Set<string>,
  oppMet: Set<string>,
): MatchIdx[] {
  const k = courts
  if (selected.length !== 4 * k) {
    throw new Error(`Forventede ${4 * k} spillere på banen, fik ${selected.length}`)
  }

  if (k === 1) {
    return [bestMatchForFour(selected as [number, number, number, number], partnerMet, oppMet)]
  }

  let bestRound: MatchIdx[] | null = null
  let bestScore = -1

  const tryPartition = (groups: number[][]) => {
    const matches = groups.map((g) => bestMatchForFour(g as [number, number, number, number], partnerMet, oppMet))
    let score = 0
    for (const m of matches) {
      const [a1, a2] = m.teamA
      const [b1, b2] = m.teamB
      if (!partnerMet.has(pairKey(a1, a2))) score += 12
      if (!partnerMet.has(pairKey(b1, b2))) score += 12
      for (const a of m.teamA) {
        for (const b of m.teamB) {
          if (!oppMet.has(pairKey(a, b))) score += 6
        }
      }
    }
    if (score > bestScore) {
      bestScore = score
      bestRound = matches
    }
  }

  if (k === 2) {
    const combos: number[][] = [
      [0, 1, 2, 3],
      [0, 1, 4, 5],
      [0, 2, 4, 6],
      [0, 3, 5, 6],
      [1, 2, 5, 6],
      [2, 3, 4, 5],
    ]
    for (const idxs of combos) {
      const setA = new Set(idxs)
      const groupA = idxs.map((i) => selected[i])
      const groupB = selected.filter((_, idx) => !setA.has(idx))
      if (groupB.length === 4) tryPartition([groupA, groupB])
    }
  } else {
    const groups: number[][] = []
    for (let c = 0; c < k; c++) {
      groups.push(selected.slice(c * 4, c * 4 + 4))
    }
    tryPartition(groups)
  }

  if (!bestRound) {
    const groups: number[][] = []
    for (let c = 0; c < k; c++) {
      groups.push(selected.slice(c * 4, c * 4 + 4))
    }
    bestRound = groups.map((g) => bestMatchForFour(g as [number, number, number, number], partnerMet, oppMet))
  }

  return bestRound
}

function pickPlayersForRound(n: number, courts: number, playCount: number[]): number[] {
  const onCourt = Math.min(n, courts * 4)
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => {
    const d = playCount[a] - playCount[b]
    return d !== 0 ? d : a - b
  })
  return order.slice(0, onCourt)
}

/** Byg præcis targetRounds runder (ingen ekstra). */
function buildScheduleExact(n: number, courts: number, targetRounds: number): BuildResult {
  const circle = circleRoundsToMatches(n, courts)
  const partnerMet = new Set<string>()
  const oppMet = new Set<string>()
  const playCount = Array(n).fill(0)
  const rounds: RoundIdx[] = []

  for (const round of circle.slice(0, Math.min(circle.length, targetRounds))) {
    for (const m of round) recordMatch(m, partnerMet, oppMet)
    for (const m of round) {
      for (const p of [...m.teamA, ...m.teamB]) playCount[p]++
    }
    rounds.push(round)
  }

  while (rounds.length < targetRounds) {
    const selected = pickPlayersForRound(n, courts, playCount)
    const matches = bestRoundMatches(selected, courts, partnerMet, oppMet)
    for (const m of matches) recordMatch(m, partnerMet, oppMet)
    for (const p of selected) playCount[p]++
    rounds.push(matches)
  }

  return { rounds, playCount, partnerMet, oppMet }
}

function computeFairBaseRounds(n: number, courts: number): number {
  const theoretical = theoreticalMinRounds(n, courts)
  const step = fairnessRoundStep(n, courts)
  const start = Math.ceil(theoretical / step) * step

  // Søger deterministisk efter mindste rundeantal der opfylder begge fairness-krav.
  const maxCandidate = start + Math.max(80, n * 12)
  for (let candidate = start; candidate <= maxCandidate; candidate += step) {
    const built = buildScheduleExact(n, courts, candidate)
    const hasCoverage = coverageComplete(n, built.partnerMet, built.oppMet)
    const hasEqualPauses = isFairPauseDistribution(n, courts, candidate, built.playCount)
    if (hasCoverage && hasEqualPauses) {
      return candidate
    }
  }

  // Praktisk fallback: step-justeret teoretisk minimum.
  return start
}

/**
 * Antal runder (Normal): makker+modstander-dækning + lige pauser.
 */
export function americanoBaseRounds(n: number, courtsPerRound = 1): number {
  if (n < 4 || n > 16) {
    throw new Error(`Americano kræver 4–16 spillere, fik ${n}`)
  }
  const courts = clampCourts(n, courtsPerRound)
  return computeFairBaseRounds(n, courts)
}

export function americanoTotalRounds(
  n: number,
  courtsPerRound = 1,
  passes: 1 | 2 = 1,
): number {
  const base = americanoBaseRounds(n, courtsPerRound)
  return base * (passes === 2 ? 2 : 1)
}

export function buildAmericanoRoundRobinMatchRows(
  tournamentId: string,
  participantIds: string[],
  courtsPerRound = 1,
  passes: 1 | 2 = 1,
): AmericanoMatchInsert[] {
  const n = participantIds.length
  if (n < 4 || n > 16) throw new Error(`Americano kræver 4–16 spillere, fik ${n}`)

  const courts = clampCourts(n, courtsPerRound)
  const baseRounds = computeFairBaseRounds(n, courts)
  const schedule = buildScheduleExact(n, courts, baseRounds).rounds
  const passCount: 1 | 2 = passes === 2 ? 2 : 1
  const out: AmericanoMatchInsert[] = []

  for (let pass = 0; pass < passCount; pass++) {
    const roundOffset = pass * baseRounds
    schedule.forEach((round, ri) => {
      const roundNumber = roundOffset + ri + 1
      round.forEach((m, courtIndex) => {
        out.push({
          tournament_id: tournamentId,
          round_number: roundNumber,
          court_index: courtIndex,
          team_a_p1: participantIds[m.teamA[0]],
          team_a_p2: participantIds[m.teamA[1]],
          team_b_p1: participantIds[m.teamB[0]],
          team_b_p2: participantIds[m.teamB[1]],
        })
      })
    })
  }

  return out
}

export function benchCountPerRound(n: number, courtsPerRound: number): number {
  const courts = clampCourts(n, courtsPerRound)
  return n - courts * 4
}
